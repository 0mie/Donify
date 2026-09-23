import express, { Request, Response } from "express";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import {
  DiscordConfig,
  TiltifyConfig,
  DonationRecord,
  BotStatus,
  ClaimedReward,
  RewardDeliveryAddress,
  AuctionWinnerInfo,
} from "./src/types";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

// In-Memory Storage & Configuration
const state: {
  discord: DiscordConfig;
  tiltify: TiltifyConfig;
  donations: DonationRecord[];
  seenDonationIds: Set<string>;
  seenAuctionIds: Set<string>;
  campaignRewardsCache: Map<string, any>;
  botStatus: BotStatus;
  pollTimer: NodeJS.Timeout | null;
  customAvatar: {
    buffer: Buffer;
    contentType: string;
    fileName: string;
    updatedAt: string;
  } | null;
  publicBaseUrl: string;
} = {
  discord: {
    mode: (process.env.DISCORD_WEBHOOK_URL?.trim() ? "webhook" : (process.env.DISCORD_BOT_TOKEN?.trim() && process.env.DISCORD_CHANNEL_ID?.trim() ? "bot" : "webhook")) as "webhook" | "bot",
    webhookUrl: (process.env.DISCORD_WEBHOOK_URL || "").trim(),
    botToken: (process.env.DISCORD_BOT_TOKEN || "").trim(),
    channelId: (process.env.DISCORD_CHANNEL_ID || "").trim(),
    botUsername: "Tiltify Donation Bot",
    botAvatarUrl: "https://tiltify.com/favicon.ico",
    embedColor: "#00d1b2",
    auctionEmbedColor: "#F59E0B",
    mentionType: "none",
    mentionRoleId: "",
    mentionUserId: "",
    includeComment: true,
    includeCampaignDetails: true,
    customMessagePrefix: "🎉 New donation received on Tiltify!",
    includeRewardDetails: true,
    includeDeliveryAddress: true,
    spoilerDeliveryInfo: true,
    enableAuctionAlerts: true,
    auctionMessagePrefix: "🔨 AUCTION ENDED! Winning bid and prize fulfillment details:",
    onlyNotifyPrizeAuctions: false,
    footerText: process.env.DISCORD_FOOTER_TEXT || "Tiltify Donation Alerts",
    footerIconUrl: process.env.DISCORD_FOOTER_ICON_URL || "",
    auctionFooterText: process.env.DISCORD_AUCTION_FOOTER_TEXT || "Tiltify Auction House • Winner Fulfillment",
  },
  tiltify: {
    clientId: (process.env.TILTIFY_CLIENT_ID || "").trim(),
    clientSecret: (process.env.TILTIFY_CLIENT_SECRET || "").trim(),
    apiToken: (process.env.TILTIFY_API_TOKEN || "").trim(),
    tokenExpiresAt: null,
    campaignId: (process.env.TILTIFY_CAMPAIGN_ID || "").trim(),
    pollIntervalSeconds: 30,
    pollingEnabled: false,
    webhookSecret: "",
  },
  donations: [],
  seenDonationIds: new Set<string>(),
  seenAuctionIds: new Set<string>(),
  campaignRewardsCache: new Map<string, any>(),
  botStatus: {
    isPolling: false,
    lastPollTimestamp: null,
    lastPollStatus: "idle",
    lastPollMessage: "Ready to poll",
    discordConfigured: Boolean(process.env.DISCORD_WEBHOOK_URL || (process.env.DISCORD_BOT_TOKEN && process.env.DISCORD_CHANNEL_ID)),
    tiltifyConfigured: Boolean(process.env.TILTIFY_CAMPAIGN_ID || process.env.TILTIFY_API_TOKEN || (process.env.TILTIFY_CLIENT_ID && process.env.TILTIFY_CLIENT_SECRET)),
    totalDonationsProcessed: 0,
    totalAuctionsProcessed: 0,
    totalAmountProcessed: 0,
    lastDonationTimestamp: null,
    serverUrl: process.env.APP_URL || "http://localhost:3000",
  },
  pollTimer: null,
  customAvatar: null,
  publicBaseUrl: process.env.APP_URL || "",
};

// ---------------------------------------------------------------------
// Configuration Persistence (data/app-config.json)
// ---------------------------------------------------------------------
const DATA_DIR = path.join(process.cwd(), "data");
const CONFIG_FILE = path.join(DATA_DIR, "app-config.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    } catch (e) {
      console.warn("Could not create data directory:", e);
    }
  }
}

function saveConfigToDisk() {
  try {
    ensureDataDir();
    const toSave = {
      discord: state.discord,
      tiltify: state.tiltify,
      customAvatarMeta: state.customAvatar
        ? {
            contentType: state.customAvatar.contentType,
            fileName: state.customAvatar.fileName,
            updatedAt: state.customAvatar.updatedAt,
          }
        : null,
    };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(toSave, null, 2), "utf-8");
    console.log("[Config Persistence] Saved configuration to data/app-config.json");
  } catch (err: any) {
    console.error("[Config Persistence] Failed to save config to disk:", err.message);
  }
}

function loadConfigFromDisk() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed.discord && typeof parsed.discord === "object") {
        state.discord = {
          ...state.discord,
          ...parsed.discord,
        };
      }
      if (parsed.tiltify && typeof parsed.tiltify === "object") {
        state.tiltify = {
          ...state.tiltify,
          ...parsed.tiltify,
        };
      }
      state.botStatus.discordConfigured = Boolean(
        state.discord.webhookUrl || (state.discord.botToken && state.discord.channelId)
      );
      state.botStatus.tiltifyConfigured = Boolean(
        state.tiltify.campaignId ||
          state.tiltify.apiToken ||
          (state.tiltify.clientId && state.tiltify.clientSecret)
      );
      console.log("[Config Persistence] Successfully restored configuration from data/app-config.json");
    }
  } catch (err: any) {
    console.warn("[Config Persistence] Could not load saved config from disk:", err.message);
  }
}

// Load persisted configuration immediately at startup
loadConfigFromDisk();

// Middleware: dynamically track public base URL from incoming requests
app.use((req: Request, _res: Response, next) => {
  const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol || "https";
  const host = (req.headers["x-forwarded-host"] as string) || req.headers.host;
  if (host && (!state.publicBaseUrl || state.publicBaseUrl.includes("localhost"))) {
    state.publicBaseUrl = `${proto}://${host}`;
    state.botStatus.serverUrl = state.publicBaseUrl;
  }
  next();
});

// Add initial seed demo donation with claimed reward to demonstrate functionality
const seedDonation: DonationRecord = {
  id: "demo-don-001",
  donorName: "Generous Supporter",
  donorEmail: "supporter@example.com",
  amount: 75.0,
  currency: "USD",
  comment: "So thrilled to support this amazing cause! Keep up the great work! ❤️",
  reward: {
    id: "rew-demo-101",
    name: "Limited Edition Champion Hoodie & Enamel Pin Set",
    description: "Official heavyweight embroidered hoodie plus commemorative metal charity pin.",
    quantity: 1,
    deliveryType: "shipping",
    donorEmail: "supporter@example.com",
    shippingAddress: {
      recipientName: "Generous Supporter",
      addressLine1: "742 Evergreen Terrace",
      addressLine2: "Apt 4B",
      city: "Springfield",
      region: "OR",
      postalCode: "97477",
      country: "United States",
    },
    customOptions: {
      "Size": "Adult Large (L)",
      "Pin Finish": "Antique Gold",
      "Delivery Notes": "Leave on front porch",
    },
  },
  campaignName: "Community Charity Drive 2026",
  campaignId: state.tiltify.campaignId || "camp-101",
  causeName: "Global Relief Initiative",
  targetGoal: 5000,
  totalRaised: 1850,
  receivedAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
  source: "simulator",
  discordStatus: "pending",
};

// Add initial seed demo auction ended record with winner and prize fulfillment info
const seedAuctionDonation: DonationRecord = {
  id: "demo-auc-001",
  tiltifyId: "auc-item-88",
  eventType: "auction_ended",
  donorName: "Victoria Sterling",
  donorEmail: "v.sterling@collectors.org",
  amount: 450.0,
  currency: "USD",
  campaignName: "Community Charity Drive 2026",
  campaignId: state.tiltify.campaignId || "camp-101",
  causeName: "Global Relief Initiative",
  targetGoal: 5000,
  totalRaised: 2300,
  receivedAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
  source: "simulator",
  discordStatus: "pending",
  auction: {
    auctionId: "auc-88",
    itemTitle: "Signed Framed Streamer Jersey & VIP Backstage Pass",
    itemDescription: "Hand-signed by all 12 marathon streamers, framed with authentication seal.",
    winningBid: 450.0,
    currency: "USD",
    winnerName: "Victoria Sterling",
    winnerEmail: "v.sterling@collectors.org",
    prizeType: "both",
    shippingAddress: {
      recipientName: "Victoria Sterling",
      addressLine1: "1000 Ocean Drive",
      addressLine2: "Suite 1400",
      city: "Miami",
      region: "FL",
      postalCode: "33139",
      country: "United States",
    },
    specialInstructions: "Please email digital VIP Discord pass via email in addition to shipping the jersey.",
    endedAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
  },
};

state.donations.push(seedDonation);
state.donations.push(seedAuctionDonation);
state.seenDonationIds.add(seedDonation.id);
state.seenAuctionIds.add(seedAuctionDonation.id);
state.botStatus.totalDonationsProcessed = 2;
state.botStatus.totalAuctionsProcessed = 1;
state.botStatus.totalAmountProcessed = 525.0;

// Helper: Format Currency
function formatCurrency(amount: number, currency: string = "USD"): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase() || "USD",
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)} ${currency}`;
  }
}

// Helper: Convert Hex Color to Discord integer
function hexToDiscordColor(hex: string): number {
  const cleanHex = hex.replace("#", "");
  const num = parseInt(cleanHex, 16);
  return isNaN(num) ? 0x00d1b2 : num;
}

// Core Function: Send Rich Donation Embed to Discord
async function dispatchDiscordAlert(
  donation: DonationRecord,
  config: DiscordConfig
): Promise<{ success: boolean; error?: string; warning?: string }> {
  try {
    let mentionText = "";
    const allowedMentions: {
      parse: string[];
      roles?: string[];
      users?: string[];
    } = { parse: [] };

    if (config.mentionType === "everyone") {
      mentionText = "@everyone ";
      allowedMentions.parse.push("everyone");
    } else if (config.mentionType === "here") {
      mentionText = "@here ";
      allowedMentions.parse.push("everyone");
    } else if (config.mentionType === "role" && config.mentionRoleId) {
      const cleanRoleId = config.mentionRoleId.replace(/[<@&>]/g, "").trim();
      if (cleanRoleId) {
        mentionText = `<@&${cleanRoleId}> `;
        allowedMentions.roles = [cleanRoleId];
      }
    } else if (config.mentionType === "user" && config.mentionUserId) {
      const cleanUserId = config.mentionUserId.replace(/[<@!>]/g, "").trim();
      if (cleanUserId) {
        mentionText = `<@${cleanUserId}> `;
        allowedMentions.users = [cleanUserId];
      }
    }

    const isAuction = donation.eventType === "auction_ended" || Boolean(donation.auction);
    const auction = donation.auction;

    // Check if auction notifications are enabled
    if (isAuction && config.enableAuctionAlerts === false) {
      return { success: false, error: "Auction alerts are disabled in Discord settings." };
    }

    // Check if user configured to only notify when prize fulfillment is required
    if (isAuction && config.onlyNotifyPrizeAuctions) {
      const requiresFulfillment =
        auction &&
        (auction.prizeType === "physical" ||
          auction.prizeType === "email" ||
          auction.prizeType === "both" ||
          Boolean(auction.shippingAddress) ||
          Boolean(auction.winnerEmail));
      if (!requiresFulfillment) {
        return { success: true };
      }
    }

    const prefix = isAuction
      ? config.auctionMessagePrefix || "🔨 AUCTION ENDED! Winning bid and prize fulfillment details:"
      : config.customMessagePrefix || "🎉 New donation received on Tiltify!";
    const content = `${mentionText}${prefix}`.trim();
    const formattedAmount = formatCurrency(donation.amount, donation.currency);

    let embedTitle: string;
    let embedDescription: string;
    let embedColor: number;
    let embedFooterText: string;
    const embedFields: Array<{ name: string; value: string; inline?: boolean }> = [];

    if (isAuction && auction) {
      embedTitle = `🏆 AUCTION HOUSE: Auction Ended & Finalized!`;
      embedDescription = `**${auction.winnerName || donation.donorName}** won **${auction.itemTitle}** with a winning bid of **${formattedAmount}**!`;
      embedColor = hexToDiscordColor(config.auctionEmbedColor || "#F59E0B");
      embedFooterText = config.auctionFooterText?.trim() || "Tiltify Auction House • Winner Fulfillment";

      // 1. Winning Bid & Winner
      embedFields.push(
        {
          name: "🔨 Winning Bid",
          value: `**${formattedAmount}**`,
          inline: true,
        },
        {
          name: "👤 Winning Bidder",
          value: `**${auction.winnerName || donation.donorName}**`,
          inline: true,
        }
      );

      // 2. Auction Item Won
      let itemVal = `**${auction.itemTitle}**`;
      if (auction.itemDescription) {
        itemVal += `\n*${auction.itemDescription}*`;
      }
      embedFields.push({
        name: "🏷️ Auction Item Won",
        value: itemVal,
        inline: false,
      });

      // 3. PRIZE & WINNER FULFILLMENT INFORMATION (Core user requirement!)
      const winnerName = auction.winnerName || donation.donorName;
      const winnerEmail = auction.winnerEmail || donation.donorEmail;
      const addr = auction.shippingAddress;
      const hasPhysicalShipping =
        auction.prizeType === "physical" ||
        auction.prizeType === "both" ||
        Boolean(addr);
      const hasEmailDelivery =
        auction.prizeType === "email" ||
        auction.prizeType === "both" ||
        (Boolean(winnerEmail) && !hasPhysicalShipping);

      if (hasPhysicalShipping) {
        const physicalLines: string[] = [];
        physicalLines.push(`**Recipient:** ${addr?.recipientName || winnerName}`);
        if (winnerEmail) {
          physicalLines.push(`**Winner Contact Email:** \`${winnerEmail}\``);
        }

        if (addr && (addr.addressLine1 || addr.city || addr.country || addr.postalCode)) {
          const addrParts: string[] = [];
          if (addr.recipientName && addr.recipientName !== winnerName) {
            addrParts.push(`Attn: ${addr.recipientName}`);
          }
          if (addr.addressLine1) addrParts.push(addr.addressLine1);
          if (addr.addressLine2) addrParts.push(addr.addressLine2);
          const cityStateZip = [addr.city, addr.region, addr.postalCode].filter(Boolean).join(", ");
          if (cityStateZip) addrParts.push(cityStateZip);
          if (addr.country) addrParts.push(addr.country);

          const formattedAddress = addrParts.join("\n");
          if (config.spoilerDeliveryInfo !== false) {
            physicalLines.push(
              `**Shipping Address (Click to reveal):**\n||${formattedAddress.replace(/\n/g, ", ")}||\n*(Spoiler-tagged for winner privacy)*`
            );
          } else {
            physicalLines.push(`**Shipping Address:**\n\`\`\`\n${formattedAddress}\n\`\`\``);
          }
        } else {
          physicalLines.push(`*(Physical shipping required — address will be provided in winner survey)*`);
        }

        if (auction.specialInstructions) {
          physicalLines.push(`**Winner Delivery Notes:** ${auction.specialInstructions}`);
        }

        embedFields.push({
          name: "📦 Physical Prize Shipping Required",
          value: physicalLines.join("\n"),
          inline: false,
        });
      }

      if (hasEmailDelivery) {
        const emailLines: string[] = [];
        emailLines.push(`**Recipient:** ${winnerName}`);
        emailLines.push(`**Winner Delivery Email:** \`${winnerEmail || "Not provided"}\``);
        emailLines.push(
          `*Action Needed: Please email the winner their digital prize, voucher, code, or redemption instructions.*`
        );
        if (auction.specialInstructions && !hasPhysicalShipping) {
          emailLines.push(`**Winner Notes:** ${auction.specialInstructions}`);
        }

        embedFields.push({
          name: "📧 Email / Digital Prize Delivery Required",
          value: emailLines.join("\n"),
          inline: false,
        });
      }

      if (!hasPhysicalShipping && !hasEmailDelivery) {
        embedFields.push({
          name: "ℹ️ Prize Fulfillment",
          value: "No physical prize shipping or digital email delivery required for this auction item.",
          inline: false,
        });
      }

      // Campaign & Cause details
      if (config.includeCampaignDetails && (donation.campaignName || donation.causeName)) {
        const details: string[] = [];
        if (donation.campaignName) details.push(`**Campaign:** ${donation.campaignName}`);
        if (donation.causeName) details.push(`**Beneficiary:** ${donation.causeName}`);
        embedFields.push({
          name: "🎯 Campaign Details",
          value: details.join("\n"),
          inline: false,
        });
      }
    } else {
      embedTitle = `🎉 New Donation: ${formattedAmount}!`;
      embedDescription = `**${donation.donorName || "An anonymous donor"}** contributed to the campaign!`;
      embedColor = hexToDiscordColor(config.embedColor);
      embedFooterText = config.footerText?.trim() || "Tiltify Donation Alerts";

      embedFields.push(
        {
          name: "👤 Donor",
          value: `**${donation.donorName || "Anonymous"}**`,
          inline: true,
        },
        {
          name: "💰 Amount",
          value: `**${formattedAmount}**`,
          inline: true,
        }
      );

      if (config.includeComment && donation.comment) {
        embedFields.push({
          name: "💬 Message",
          value: `> ${donation.comment}`,
          inline: false,
        });
      }

      if (config.includeCampaignDetails && (donation.campaignName || donation.causeName)) {
        const details: string[] = [];
        if (donation.campaignName) details.push(`**Campaign:** ${donation.campaignName}`);
        if (donation.causeName) details.push(`**Cause:** ${donation.causeName}`);
        if (donation.totalRaised !== undefined && donation.targetGoal) {
          const percent = Math.min(100, Math.round((donation.totalRaised / donation.targetGoal) * 100));
          details.push(`**Progress:** ${formatCurrency(donation.totalRaised, donation.currency)} / ${formatCurrency(donation.targetGoal, donation.currency)} (${percent}%)`);
        }
        embedFields.push({
          name: "🎯 Campaign Details",
          value: details.join("\n"),
          inline: false,
        });
      }

      // 🎁 Claimed Reward Field
      if (config.includeRewardDetails !== false && donation.reward) {
        const reward = donation.reward;
        const rewardLines: string[] = [];
        const qtyStr = reward.quantity && reward.quantity > 1 ? ` (Qty: ${reward.quantity})` : "";
        rewardLines.push(`**${reward.name}**${qtyStr}`);
        if (reward.description) {
          rewardLines.push(`*${reward.description}*`);
        }
        if (reward.amount) {
          rewardLines.push(`**Reward Min:** ${formatCurrency(reward.amount, reward.currency || donation.currency)}`);
        }
        embedFields.push({
          name: "🎁 Selected Reward",
          value: rewardLines.join("\n"),
          inline: false,
        });
      }

      // 📦 Reward Delivery & Fulfillment Info Field
      if (config.includeDeliveryAddress !== false && donation.reward) {
        const reward = donation.reward;
        const deliveryLines: string[] = [];

        const recipient = reward.shippingAddress?.recipientName || donation.donorName || "Supporter";
        const email = reward.donorEmail || donation.donorEmail;

        if (email) {
          deliveryLines.push(`**Recipient:** ${recipient} • **Email:** \`${email}\``);
        } else if (recipient) {
          deliveryLines.push(`**Recipient:** ${recipient}`);
        }

        if (reward.deliveryType) {
          const typeLabel =
            reward.deliveryType === "shipping"
              ? "📦 Physical Shipping (Requires Address)"
              : reward.deliveryType === "digital"
              ? "💻 Digital / Electronic Delivery"
              : reward.deliveryType;
          deliveryLines.push(`**Fulfillment Method:** ${typeLabel}`);
        }

        // Shipping Address
        const addr = reward.shippingAddress;
        if (addr && (addr.addressLine1 || addr.city || addr.country || addr.postalCode)) {
          const addrParts: string[] = [];
          if (addr.recipientName && addr.recipientName !== recipient) {
            addrParts.push(`Attn: ${addr.recipientName}`);
          }
          if (addr.addressLine1) addrParts.push(addr.addressLine1);
          if (addr.addressLine2) addrParts.push(addr.addressLine2);
          const cityStateZip = [addr.city, addr.region, addr.postalCode].filter(Boolean).join(", ");
          if (cityStateZip) addrParts.push(cityStateZip);
          if (addr.country) addrParts.push(addr.country);

          const formattedAddress = addrParts.join("\n");
          if (config.spoilerDeliveryInfo !== false) {
            deliveryLines.push(`**Shipping Address:** (Click to reveal)\n||${formattedAddress.replace(/\n/g, ", ")}||\n*(Spoiler-tagged for donor privacy)*`);
          } else {
            deliveryLines.push(`**Shipping Address:**\n\`\`\`\n${formattedAddress}\n\`\`\``);
          }
        }

        // Custom Options / Q&A
        if (reward.customOptions) {
          if (typeof reward.customOptions === "object") {
            const opts = Object.entries(reward.customOptions)
              .map(([k, v]) => `• **${k}:** ${v}`)
              .join("\n");
            if (opts) deliveryLines.push(`**Reward Options / Answers:**\n${opts}`);
          } else if (typeof reward.customOptions === "string" && reward.customOptions.trim()) {
            deliveryLines.push(`**Reward Notes:** ${reward.customOptions}`);
          }
        }

        if (deliveryLines.length > 0) {
          embedFields.push({
            name: "📦 Reward Delivery & Fulfillment Info",
            value: deliveryLines.join("\n"),
            inline: false,
          });
        }
      }
    }

    let resolvedFooterIconUrl = (config.footerIconUrl || "").trim();
    if (!resolvedFooterIconUrl) {
      if (state.publicBaseUrl) {
        resolvedFooterIconUrl = `${state.publicBaseUrl}/api/discord/tiltify-icon`;
      } else {
        resolvedFooterIconUrl = "https://site-assets.tiltify.com/frontend-users/favicon.ico";
      }
    } else if (resolvedFooterIconUrl.startsWith("/")) {
      if (state.publicBaseUrl) {
        resolvedFooterIconUrl = `${state.publicBaseUrl}${resolvedFooterIconUrl}`;
      }
    }

    const embed = {
      title: embedTitle,
      description: embedDescription,
      color: embedColor,
      fields: embedFields,
      footer: {
        text: embedFooterText,
        icon_url: resolvedFooterIconUrl,
      },
      timestamp: donation.receivedAt || new Date().toISOString(),
    };

    if (config.mode === "webhook") {
      if (!config.webhookUrl) {
        return { success: false, error: "Discord Webhook URL is not configured." };
      }

      let avatarUrl = config.botAvatarUrl || "https://tiltify.com/favicon.ico";
      if (avatarUrl.startsWith("/")) {
        if (state.publicBaseUrl) {
          avatarUrl = `${state.publicBaseUrl}${avatarUrl}`;
        }
      } else if (avatarUrl.startsWith("data:")) {
        // Discord Webhook cannot fetch data: URIs, use our public endpoint if customAvatar exists
        if (state.publicBaseUrl && state.customAvatar) {
          avatarUrl = `${state.publicBaseUrl}/api/discord/avatar`;
        } else {
          avatarUrl = "https://tiltify.com/favicon.ico";
        }
      }

      const payload = {
        username: config.botUsername || "Tiltify Donation Bot",
        avatar_url: avatarUrl,
        content: content || undefined,
        embeds: [embed],
        allowed_mentions: allowedMentions,
      };

      const customHeaders = {
        "Content-Type": "application/json",
        "User-Agent": "DiscordBot (https://tiltify.com, 1.0.0)",
        "Accept": "application/json",
      };

      const primaryUrl = config.webhookUrl.trim();
      let response = await fetch(primaryUrl, {
        method: "POST",
        headers: customHeaders,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        const isCloudflare1015 =
          errorText.includes("1015") ||
          errorText.includes("Cloudflare") ||
          errorText.includes("banned you temporarily");
        const isRateLimit = response.status === 429 || response.status === 403;

        // If Discord or Cloudflare rate-limited Render's shared IP on discord.com,
        // automatically retry via discordapp.com alternate domain!
        if (primaryUrl.includes("discord.com") && (isCloudflare1015 || isRateLimit)) {
          const alternateUrl = primaryUrl.replace("discord.com", "discordapp.com");
          console.warn(
            `[Discord] Encountered status ${response.status} from discord.com (Cloudflare Error 1015 / rate limit). Retrying automatically via ${alternateUrl}...`
          );
          try {
            const retryRes = await fetch(alternateUrl, {
              method: "POST",
              headers: customHeaders,
              body: JSON.stringify(payload),
            });

            if (retryRes.ok) {
              console.log("[Discord] Successfully sent webhook via discordapp.com domain!");
              return { success: true };
            }
            const retryErrText = await retryRes.text();
            console.error(`[Discord] Alternate domain also failed (${retryRes.status}):`, retryErrText);
          } catch (retryErr: any) {
            console.error("[Discord] Alternate domain request error:", retryErr.message);
          }
        }

        let userFriendlyError = errorText || response.statusText;
        if (isCloudflare1015) {
          userFriendlyError = `Discord's Cloudflare filter temporarily blocked Render's shared IP address (Cloudflare Error 1015). In your Discord Webhook URL, change "discord.com" to "discordapp.com" (e.g. https://discordapp.com/api/webhooks/...) to bypass the block!`;
        }

        return {
          success: false,
          error: `Discord Webhook returned status ${response.status}: ${userFriendlyError}`,
        };
      }

      return { success: true };
    } else {
      // Bot Token + Channel ID mode
      if (!config.botToken) {
        return { success: false, error: "Discord Bot Token is not configured." };
      }
      if (!config.channelId) {
        return { success: false, error: "Discord Channel ID is not configured." };
      }

      const botUrl = `https://discord.com/api/v10/channels/${config.channelId.trim()}/messages`;
      const response = await fetch(botUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "DiscordBot (https://tiltify.com, 1.0.0)",
          Authorization: `Bot ${config.botToken.trim()}`,
        },
        body: JSON.stringify({
          content: content || undefined,
          embeds: [embed],
          allowed_mentions: allowedMentions,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();

        // If Discord Bot API fails because the channel is unknown or bot lacks access,
        // and a valid webhookUrl is available, fall back to the webhook to ensure alerts never fail!
        if (
          config.webhookUrl &&
          (response.status === 404 ||
            response.status === 403 ||
            errorText.includes("10003") ||
            errorText.includes("50001"))
        ) {
          console.warn(
            `[Discord] Bot API failed for channel ${config.channelId} (${response.status}: ${errorText}). Attempting fallback to Webhook URL...`
          );

          let avatarUrl = config.botAvatarUrl || "https://tiltify.com/favicon.ico";
          if (avatarUrl.startsWith("/")) {
            if (state.publicBaseUrl) {
              avatarUrl = `${state.publicBaseUrl}${avatarUrl}`;
            }
          } else if (avatarUrl.startsWith("data:")) {
            if (state.publicBaseUrl && state.customAvatar) {
              avatarUrl = `${state.publicBaseUrl}/api/discord/avatar`;
            } else {
              avatarUrl = "https://tiltify.com/favicon.ico";
            }
          }

          try {
            const webhookUrl = config.webhookUrl.replace("discord.com", "discordapp.com");
            const fallbackRes = await fetch(webhookUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "User-Agent": "DiscordBot (https://tiltify.com, 1.0.0)",
              },
              body: JSON.stringify({
                username: config.botUsername || "Tiltify Donation Bot",
                avatar_url: avatarUrl,
                content: content || undefined,
                embeds: [embed],
                allowed_mentions: allowedMentions,
              }),
            });

            if (fallbackRes.ok) {
              return {
                success: true,
                warning:
                  "Delivered via Webhook fallback (Bot Token lacked access to that channel ID). Please switch to 'Webhook' mode in settings.",
              };
            }
          } catch (fallbackErr: any) {
            console.error("[Discord] Webhook fallback also failed:", fallbackErr.message);
          }
        }

        let hint = "";
        if (errorText.includes("10003") || response.status === 404) {
          hint =
            " Reason: 'Unknown Channel' (code 10003). The bot has not been added to that Discord server, or lacks 'View Channel' / 'Send Messages' permissions for that channel ID. Switch to 'Webhook (Recommended)' mode above to use your Webhook URL instead.";
        } else if (errorText.includes("50001") || response.status === 403) {
          hint = " Reason: 'Missing Access' (code 50001). The bot lacks permission to post in that channel.";
        }

        return {
          success: false,
          error: `Discord Bot API returned status ${response.status}: ${errorText || response.statusText}.${hint}`,
        };
      }

      return { success: true };
    }
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Unexpected network error connecting to Discord.",
    };
  }
}

// Helper to request or refresh Tiltify OAuth2 application access token using Client Credentials
async function requestTiltifyAccessToken(
  clientId: string,
  clientSecret: string
): Promise<{
  success: boolean;
  accessToken?: string;
  expiresIn?: number;
  error?: string;
}> {
  try {
    const res = await fetch("https://v5api.tiltify.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        grant_type: "client_credentials",
        client_id: clientId.trim(),
        client_secret: clientSecret.trim(),
        scope: "public",
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return {
        success: false,
        error: `Tiltify OAuth API HTTP ${res.status}: ${errText || res.statusText}`,
      };
    }

    const data = await res.json();
    if (!data.access_token) {
      return {
        success: false,
        error: "Tiltify OAuth response did not contain an access_token.",
      };
    }

    return {
      success: true,
      accessToken: data.access_token,
      expiresIn: data.expires_in,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Failed to contact Tiltify OAuth endpoint.",
    };
  }
}

// Helper to fetch and cache campaign rewards for metadata lookup
async function refreshCampaignRewards(campaignId: string): Promise<void> {
  if (!campaignId) return;
  try {
    const url = `https://v5api.tiltify.com/api/public/campaigns/${campaignId.trim()}/rewards`;
    const headers: Record<string, string> = { Accept: "application/json" };
    if (state.tiltify.apiToken) {
      headers["Authorization"] = `Bearer ${state.tiltify.apiToken.trim()}`;
    }
    const res = await fetch(url, { headers });
    if (res.ok) {
      const data = await res.json();
      const list = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
      for (const r of list) {
        if (r.id) {
          state.campaignRewardsCache.set(String(r.id), r);
        }
      }
    }
  } catch {
    // Ignore cache error silently
  }
}

// Helper to extract ClaimedReward and delivery details from Tiltify donation payloads
function extractRewardAndDelivery(
  raw: any,
  rewardsCache?: Map<string, any>
): {
  donorEmail?: string;
  reward?: ClaimedReward;
} {
  if (!raw || typeof raw !== "object") return {};

  const donorEmail =
    raw.donor_email ||
    raw.email ||
    raw.address?.email ||
    raw.shipping_address?.email ||
    undefined;

  // Detect reward object or reward_id or reward_claims
  const rewardObj = raw.reward || raw.data?.reward;
  const rewardClaims =
    Array.isArray(raw.reward_claims) && raw.reward_claims.length > 0
      ? raw.reward_claims[0]
      : null;

  const rewardId =
    raw.reward_id ||
    raw.rewardId ||
    rewardObj?.id ||
    rewardClaims?.reward_id ||
    undefined;

  // Look up in cache if reward name/description is missing
  let cachedReward: any = undefined;
  if (rewardId && rewardsCache && rewardsCache.has(String(rewardId))) {
    cachedReward = rewardsCache.get(String(rewardId));
  }

  const effectiveReward = rewardObj || cachedReward;
  const rewardName =
    effectiveReward?.name ||
    effectiveReward?.title ||
    raw.reward_name ||
    rewardClaims?.name ||
    rewardClaims?.reward_name ||
    (rewardId ? `Reward #${rewardId}` : undefined);

  // Address lookup: raw.address, raw.shipping_address, rewardClaims.address, rewardObj.address
  const rawAddr =
    raw.address ||
    raw.shipping_address ||
    raw.donor_address ||
    rewardClaims?.address ||
    rewardObj?.address ||
    raw.data?.address ||
    undefined;

  let shippingAddress: RewardDeliveryAddress | undefined = undefined;
  if (rawAddr && typeof rawAddr === "object") {
    shippingAddress = {
      recipientName: rawAddr.recipient_name || rawAddr.name || raw.donor_name || undefined,
      addressLine1: rawAddr.address_line1 || rawAddr.line1 || rawAddr.street || undefined,
      addressLine2: rawAddr.address_line2 || rawAddr.line2 || undefined,
      city: rawAddr.city || undefined,
      region: rawAddr.region || rawAddr.state || rawAddr.province || undefined,
      postalCode: rawAddr.postal_code || rawAddr.zip || rawAddr.zipcode || undefined,
      country: rawAddr.country || undefined,
    };
  }

  // Custom questions / options / answers
  let customOptions: Record<string, string> | string | undefined = undefined;
  const rawQA =
    raw.questions ||
    raw.answers ||
    raw.custom_fields ||
    rewardClaims?.answers ||
    rewardClaims?.questions;
  if (rawQA) {
    if (typeof rawQA === "object" && !Array.isArray(rawQA)) {
      customOptions = rawQA;
    } else if (Array.isArray(rawQA)) {
      const parsedMap: Record<string, string> = {};
      for (const item of rawQA) {
        if (typeof item === "object" && item !== null) {
          const q = item.question || item.title || item.name || item.prompt || "Option";
          const a = item.answer || item.value || item.response || "";
          parsedMap[String(q)] = String(a);
        } else if (typeof item === "string") {
          parsedMap[`Option ${Object.keys(parsedMap).length + 1}`] = item;
        }
      }
      customOptions = parsedMap;
    } else if (typeof rawQA === "string") {
      customOptions = rawQA;
    }
  }

  if (rewardName || rewardId || shippingAddress) {
    const qty = Number(rewardClaims?.quantity || raw.quantity || rewardObj?.quantity || 1);
    const amountVal =
      effectiveReward?.amount?.value
        ? parseFloat(effectiveReward.amount.value)
        : typeof effectiveReward?.amount === "number"
        ? effectiveReward.amount
        : undefined;

    return {
      donorEmail,
      reward: {
        id: rewardId ? String(rewardId) : undefined,
        name: rewardName || "Selected Campaign Reward",
        description: effectiveReward?.description || undefined,
        amount: amountVal,
        currency: effectiveReward?.amount?.currency || undefined,
        quantity: isNaN(qty) || qty < 1 ? 1 : qty,
        deliveryType: shippingAddress ? "shipping" : (donorEmail ? "digital" : "other"),
        donorEmail: donorEmail,
        shippingAddress: shippingAddress,
        customOptions: customOptions,
      },
    };
  }

  return { donorEmail };
}

// Helper to extract AuctionWinnerInfo from Tiltify auction payloads
function extractAuctionWinnerInfo(raw: any, eventType?: string): AuctionWinnerInfo | null {
  if (!raw || typeof raw !== "object") return null;

  const isAuction =
    raw.is_auction === true ||
    raw.auction !== undefined ||
    raw.winning_bid !== undefined ||
    raw.item_title !== undefined ||
    raw.item_name !== undefined ||
    (typeof eventType === "string" && eventType.toLowerCase().includes("auction")) ||
    raw.event?.toLowerCase?.().includes("auction");

  if (!isAuction) return null;

  const auctionObj = raw.auction || raw.data?.auction || raw;
  const itemTitle =
    auctionObj.item_title ||
    auctionObj.title ||
    auctionObj.item_name ||
    auctionObj.name ||
    raw.item_title ||
    raw.title ||
    "Auction Item";

  const itemDescription =
    auctionObj.item_description ||
    auctionObj.description ||
    raw.item_description ||
    raw.description ||
    undefined;

  // Winning bid amount
  let winningBid = 0;
  let currency = "USD";
  const rawBid =
    auctionObj.winning_bid ||
    auctionObj.current_bid ||
    auctionObj.amount ||
    raw.winning_bid ||
    raw.amount;

  if (typeof rawBid === "object" && rawBid !== null) {
    winningBid = parseFloat(rawBid.value || rawBid.amount || "0");
    currency = rawBid.currency || "USD";
  } else if (typeof rawBid === "number" || typeof rawBid === "string") {
    winningBid = parseFloat(String(rawBid));
    if (raw.currency) currency = raw.currency;
  }

  // Winner identity
  const winnerObj =
    auctionObj.winner ||
    auctionObj.winning_bidder ||
    raw.winner ||
    raw.winning_bidder ||
    raw.donor ||
    {};

  const winnerName =
    winnerObj.name ||
    winnerObj.donor_name ||
    auctionObj.winner_name ||
    raw.winner_name ||
    raw.donor_name ||
    raw.name ||
    "Auction Winner";

  const winnerEmail =
    winnerObj.email ||
    auctionObj.winner_email ||
    raw.winner_email ||
    raw.donor_email ||
    raw.email ||
    raw.address?.email ||
    raw.shipping_address?.email ||
    undefined;

  // Shipping address lookup
  const rawAddr =
    auctionObj.shipping_address ||
    auctionObj.address ||
    winnerObj.shipping_address ||
    winnerObj.address ||
    raw.shipping_address ||
    raw.address ||
    raw.donor_address ||
    undefined;

  let shippingAddress: RewardDeliveryAddress | undefined = undefined;
  if (rawAddr && typeof rawAddr === "object") {
    shippingAddress = {
      recipientName: rawAddr.recipient_name || rawAddr.name || winnerName || undefined,
      addressLine1: rawAddr.address_line1 || rawAddr.line1 || rawAddr.street || undefined,
      addressLine2: rawAddr.address_line2 || rawAddr.line2 || undefined,
      city: rawAddr.city || undefined,
      region: rawAddr.region || rawAddr.state || rawAddr.province || undefined,
      postalCode: rawAddr.postal_code || rawAddr.zip || rawAddr.zipcode || undefined,
      country: rawAddr.country || undefined,
    };
  }

  // Prize type detection
  let prizeType: "physical" | "email" | "both" | "none" = "none";
  const explicitType = String(
    auctionObj.prize_type || auctionObj.delivery_type || raw.prize_type || raw.delivery_type || ""
  ).toLowerCase();

  if (explicitType === "physical" || explicitType === "shipping" || explicitType === "mail") {
    prizeType = winnerEmail ? "both" : "physical";
  } else if (explicitType === "email" || explicitType === "digital" || explicitType === "electronic") {
    prizeType = shippingAddress ? "both" : "email";
  } else if (explicitType === "both") {
    prizeType = "both";
  } else {
    // Infer from fields present
    if (shippingAddress && winnerEmail) {
      prizeType = "both";
    } else if (shippingAddress) {
      prizeType = "physical";
    } else if (winnerEmail) {
      prizeType = "email";
    }
  }

  const specialInstructions =
    auctionObj.special_instructions ||
    auctionObj.delivery_notes ||
    auctionObj.notes ||
    raw.special_instructions ||
    raw.notes ||
    undefined;

  return {
    auctionId: String(auctionObj.id || raw.id || `auc-${Date.now()}`),
    itemTitle,
    itemDescription,
    winningBid: isNaN(winningBid) ? 0 : winningBid,
    currency,
    winnerName,
    winnerEmail,
    prizeType,
    shippingAddress,
    specialInstructions,
    endedAt: auctionObj.ended_at || raw.ended_at || raw.created_at || new Date().toISOString(),
  };
}

// Function to Poll Tiltify API
async function executeTiltifyPoll(): Promise<{ count: number; message: string }> {
  state.botStatus.lastPollTimestamp = new Date().toISOString();

  if (!state.tiltify.campaignId) {
    state.botStatus.lastPollStatus = "idle";
    state.botStatus.lastPollMessage = "Skipped poll: No Campaign ID configured.";
    return { count: 0, message: state.botStatus.lastPollMessage };
  }

  // Auto-refresh token if Client Credentials are provided and token is missing or near expiry
  if (state.tiltify.clientId && state.tiltify.clientSecret) {
    const tokenExpiringSoon = state.tiltify.tokenExpiresAt
      ? Date.now() >= state.tiltify.tokenExpiresAt - 60000
      : false;

    if (!state.tiltify.apiToken || tokenExpiringSoon) {
      const tokenResult = await requestTiltifyAccessToken(
        state.tiltify.clientId,
        state.tiltify.clientSecret
      );
      if (tokenResult.success && tokenResult.accessToken) {
        state.tiltify.apiToken = tokenResult.accessToken;
        state.tiltify.tokenExpiresAt = tokenResult.expiresIn
          ? Date.now() + tokenResult.expiresIn * 1000
          : null;
      }
    }
  }

  try {
    const campaignId = state.tiltify.campaignId.trim();
    const url = `https://v5api.tiltify.com/api/public/campaigns/${campaignId}/donations`;

    // Attempt to refresh campaign reward catalog for metadata enrichment
    await refreshCampaignRewards(campaignId);

    const getHeaders = () => {
      const headers: Record<string, string> = {
        Accept: "application/json",
      };
      if (state.tiltify.apiToken) {
        headers["Authorization"] = `Bearer ${state.tiltify.apiToken.trim()}`;
      }
      return headers;
    };

    let res = await fetch(url, { headers: getHeaders() });

    // If 401 Unauthorized and client credentials exist, attempt one refresh and retry
    if (res.status === 401 && state.tiltify.clientId && state.tiltify.clientSecret) {
      const tokenResult = await requestTiltifyAccessToken(
        state.tiltify.clientId,
        state.tiltify.clientSecret
      );
      if (tokenResult.success && tokenResult.accessToken) {
        state.tiltify.apiToken = tokenResult.accessToken;
        state.tiltify.tokenExpiresAt = tokenResult.expiresIn
          ? Date.now() + tokenResult.expiresIn * 1000
          : null;
        res = await fetch(url, { headers: getHeaders() });
      }
    }

    if (!res.ok) {
      const errBody = await res.text();
      state.botStatus.lastPollStatus = "error";
      state.botStatus.lastPollMessage = `Tiltify API HTTP ${res.status}: ${errBody.slice(0, 100)}`;
      return { count: 0, message: state.botStatus.lastPollMessage };
    }

    const payload = await res.json();
    // Tiltify v5 returns { data: [ ...donations ] } or array
    const rawDonations: any[] = Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload)
      ? payload
      : [];

    let newCount = 0;

    for (const raw of rawDonations) {
      const donationId = String(raw.id || raw.public_id || `tilt-${Date.now()}`);

      if (!state.seenDonationIds.has(donationId)) {
        state.seenDonationIds.add(donationId);

        let amountVal = 0;
        let currencyVal = "USD";
        if (typeof raw.amount === "object" && raw.amount !== null) {
          amountVal = parseFloat(raw.amount.value || raw.amount.amount || "0");
          currencyVal = raw.amount.currency || "USD";
        } else if (typeof raw.amount === "number" || typeof raw.amount === "string") {
          amountVal = parseFloat(String(raw.amount));
        }

        const { donorEmail, reward } = extractRewardAndDelivery(raw, state.campaignRewardsCache);

        const newDonation: DonationRecord = {
          id: donationId,
          tiltifyId: donationId,
          donorName: raw.donor_name || raw.name || "Anonymous",
          donorEmail: donorEmail,
          amount: isNaN(amountVal) ? 0 : amountVal,
          currency: currencyVal,
          comment: raw.comment || raw.message || undefined,
          reward: reward,
          campaignName: raw.campaign?.name || `Campaign #${campaignId}`,
          campaignId: campaignId,
          receivedAt: raw.created_at || raw.completed_at || new Date().toISOString(),
          source: "poll",
          discordStatus: "pending",
          rawPayload: raw,
        };

        // Dispatch to Discord
        const dispatchResult = await dispatchDiscordAlert(newDonation, state.discord);
        newDonation.discordStatus = dispatchResult.success ? "sent" : "failed";
        newDonation.discordError = dispatchResult.error;

        state.donations.unshift(newDonation);
        state.botStatus.totalDonationsProcessed += 1;
        state.botStatus.totalAmountProcessed += newDonation.amount;
        state.botStatus.lastDonationTimestamp = newDonation.receivedAt;
        newCount++;
      }
    }

    // Check campaign auctions if configured
    try {
      const auctionsUrl = `https://v5api.tiltify.com/api/public/campaigns/${campaignId}/auctions`;
      const auctionsRes = await fetch(auctionsUrl, { headers: getHeaders() });
      if (auctionsRes.ok) {
        const auctionsPayload = await auctionsRes.json();
        const rawAuctions: any[] = Array.isArray(auctionsPayload?.data)
          ? auctionsPayload.data
          : Array.isArray(auctionsPayload)
          ? auctionsPayload
          : [];

        for (const rawAuc of rawAuctions) {
          const aucId = String(rawAuc.id || `auc-${Date.now()}`);
          const status = String(rawAuc.status || "").toLowerCase();
          const isEnded =
            status === "ended" ||
            status === "completed" ||
            status === "won" ||
            status === "finalized" ||
            Boolean(rawAuc.ended_at && new Date(rawAuc.ended_at).getTime() <= Date.now());

          if (isEnded && !state.seenAuctionIds.has(aucId)) {
            state.seenAuctionIds.add(aucId);
            const auctionInfo = extractAuctionWinnerInfo(rawAuc, "auction.ended");
            if (auctionInfo) {
              const auctionRecord: DonationRecord = {
                id: `auc-${aucId}`,
                tiltifyId: aucId,
                eventType: "auction_ended",
                donorName: auctionInfo.winnerName,
                donorEmail: auctionInfo.winnerEmail,
                amount: auctionInfo.winningBid,
                currency: auctionInfo.currency,
                auction: auctionInfo,
                campaignName: rawAuc.campaign?.name || `Campaign #${campaignId}`,
                campaignId: campaignId,
                receivedAt: auctionInfo.endedAt || new Date().toISOString(),
                source: "poll",
                discordStatus: "pending",
                rawPayload: rawAuc,
              };

              const dispatchResult = await dispatchDiscordAlert(auctionRecord, state.discord);
              auctionRecord.discordStatus = dispatchResult.success ? "sent" : "failed";
              auctionRecord.discordError = dispatchResult.error;

              state.donations.unshift(auctionRecord);
              state.botStatus.totalDonationsProcessed += 1;
              state.botStatus.totalAuctionsProcessed = (state.botStatus.totalAuctionsProcessed || 0) + 1;
              state.botStatus.totalAmountProcessed += auctionRecord.amount;
              state.botStatus.lastDonationTimestamp = auctionRecord.receivedAt;
              newCount++;
            }
          }
        }
      }
    } catch {
      // Auctions endpoint optional or not enabled for this campaign
    }

    state.botStatus.lastPollStatus = "success";
    state.botStatus.lastPollMessage = `Poll successful. ${newCount} new donation(s) detected.`;
    return { count: newCount, message: state.botStatus.lastPollMessage };
  } catch (err: any) {
    state.botStatus.lastPollStatus = "error";
    state.botStatus.lastPollMessage = `Polling error: ${err.message || "Failed to reach Tiltify API"}`;
    return { count: 0, message: state.botStatus.lastPollMessage };
  }
}

// Background Polling Manager
function restartPollingTimer() {
  if (state.pollTimer) {
    clearInterval(state.pollTimer);
    state.pollTimer = null;
  }

  if (state.tiltify.pollingEnabled && state.tiltify.campaignId) {
    state.botStatus.isPolling = true;
    const intervalMs = Math.max(10, state.tiltify.pollIntervalSeconds || 30) * 1000;
    state.pollTimer = setInterval(async () => {
      await executeTiltifyPoll();
    }, intervalMs);
  } else {
    state.botStatus.isPolling = false;
  }
}

// --- API ROUTES ---

// 1. GET /api/config: Retrieve current settings & bot status
app.get("/api/config", (req: Request, res: Response) => {
  const protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
  const host = req.headers["x-forwarded-host"] || req.get("host");
  if (host) {
    state.publicBaseUrl = `${protocol}://${host}`;
    state.botStatus.serverUrl = state.publicBaseUrl;
  }

  state.botStatus.discordConfigured = Boolean(
    state.discord.webhookUrl || (state.discord.botToken && state.discord.channelId)
  );
  state.botStatus.tiltifyConfigured = Boolean(
    state.tiltify.campaignId || state.tiltify.apiToken
  );

  res.json({
    discord: state.discord,
    tiltify: state.tiltify,
    status: state.botStatus,
  });
});

// 1.5 GET /api/status: Lightweight endpoint for background polling status updates
app.get("/api/status", (req: Request, res: Response) => {
  const protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
  const host = req.headers["x-forwarded-host"] || req.get("host");
  if (host && !state.publicBaseUrl) {
    state.publicBaseUrl = `${protocol}://${host}`;
    state.botStatus.serverUrl = state.publicBaseUrl;
  }
  res.json({
    status: state.botStatus,
  });
});

// 2. POST /api/config: Update Discord or Tiltify settings
app.post("/api/config", (req: Request, res: Response) => {
  const { discord, tiltify } = req.body;

  if (discord) {
    state.discord = {
      ...state.discord,
      ...discord,
    };
  }

  if (tiltify) {
    const prevPolling = state.tiltify.pollingEnabled;
    const prevInterval = state.tiltify.pollIntervalSeconds;
    const prevCampaign = state.tiltify.campaignId;

    state.tiltify = {
      ...state.tiltify,
      ...tiltify,
    };

    if (
      prevPolling !== state.tiltify.pollingEnabled ||
      prevInterval !== state.tiltify.pollIntervalSeconds ||
      prevCampaign !== state.tiltify.campaignId
    ) {
      restartPollingTimer();
    }
  }

  state.botStatus.discordConfigured = Boolean(
    state.discord.webhookUrl || (state.discord.botToken && state.discord.channelId)
  );
  state.botStatus.tiltifyConfigured = Boolean(
    state.tiltify.campaignId || state.tiltify.apiToken || (state.tiltify.clientId && state.tiltify.clientSecret)
  );

  // Persist updated configuration to disk
  saveConfigToDisk();

  res.json({
    success: true,
    discord: state.discord,
    tiltify: state.tiltify,
    status: state.botStatus,
  });
});

// 2.2 POST /api/discord/avatar: Upload custom PNG/image for bot icon
app.post("/api/discord/avatar", (req: Request, res: Response) => {
  try {
    const { image, fileName } = req.body;
    if (!image || typeof image !== "string") {
      return res.status(400).json({ success: false, error: "No image data received" });
    }

    // Support data URL or raw base64
    let buffer: Buffer;
    let contentType = "image/png";

    const match = image.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
    if (match) {
      contentType = match[1];
      buffer = Buffer.from(match[2], "base64");
    } else {
      buffer = Buffer.from(image, "base64");
    }

    if (buffer.length === 0) {
      return res.status(400).json({ success: false, error: "Uploaded image is empty" });
    }

    if (buffer.length > 10 * 1024 * 1024) {
      return res.status(400).json({ success: false, error: "Image exceeds 10MB limit" });
    }

    const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol || "https";
    const host = (req.headers["x-forwarded-host"] as string) || req.headers.host || "localhost:3000";
    state.publicBaseUrl = `${proto}://${host}`;

    const cleanFileName = (fileName || "custom-icon.png").replace(/[^a-zA-Z0-9._-]/g, "_");

    state.customAvatar = {
      buffer,
      contentType,
      fileName: cleanFileName,
      updatedAt: new Date().toISOString(),
    };

    const avatarUrl = `${state.publicBaseUrl}/api/discord/avatar?t=${Date.now()}`;
    state.discord.botAvatarUrl = avatarUrl;
    state.discord.customAvatarName = cleanFileName;

    res.json({
      success: true,
      avatarUrl,
      fileName: cleanFileName,
      contentType,
      sizeBytes: buffer.length,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: "Failed to process avatar upload", details: err?.message });
  }
});

// 2.3 GET /api/discord/avatar: Serve the active custom PNG/image
app.get("/api/discord/avatar", (req: Request, res: Response) => {
  if (state.customAvatar && state.customAvatar.buffer) {
    res.set("Content-Type", state.customAvatar.contentType);
    res.set("Cache-Control", "public, max-age=3600");
    res.send(state.customAvatar.buffer);
  } else {
    res.redirect("https://site-assets.tiltify.com/frontend-users/favicon.ico");
  }
});

// 2.35 GET /api/discord/tiltify-icon: Serve crisp high-res icon for Discord embed footers
app.get("/api/discord/tiltify-icon", (_req: Request, res: Response) => {
  const iconPath = path.join(process.cwd(), "public", "tiltify-icon.jpg");
  if (fs.existsSync(iconPath)) {
    res.set("Content-Type", "image/jpeg");
    res.set("Cache-Control", "public, max-age=86400");
    return res.sendFile(iconPath);
  }
  res.redirect("https://site-assets.tiltify.com/frontend-users/favicon.ico");
});

// 2.4 DELETE /api/discord/avatar: Reset bot icon back to default Tiltify icon
app.delete("/api/discord/avatar", (req: Request, res: Response) => {
  state.customAvatar = null;
  state.discord.botAvatarUrl = "https://tiltify.com/favicon.ico";
  state.discord.customAvatarName = undefined;
  res.json({
    success: true,
    avatarUrl: state.discord.botAvatarUrl,
    message: "Reset bot icon to default Tiltify favicon",
  });
});

// 2.5 POST /api/tiltify/token: Generate Bearer token using Client ID & Secret
app.post("/api/tiltify/token", async (req: Request, res: Response) => {
  const clientId = (req.body.clientId || state.tiltify.clientId || "").trim();
  const clientSecret = (req.body.clientSecret || state.tiltify.clientSecret || "").trim();

  if (!clientId || !clientSecret) {
    return res.status(400).json({
      success: false,
      error: "Please provide both Client ID and Client Secret to generate a token.",
    });
  }

  const tokenResult = await requestTiltifyAccessToken(clientId, clientSecret);
  if (!tokenResult.success || !tokenResult.accessToken) {
    return res.status(400).json({
      success: false,
      error: tokenResult.error || "Failed to generate token from Tiltify.",
    });
  }

  // Update in-memory state
  state.tiltify.clientId = clientId;
  state.tiltify.clientSecret = clientSecret;
  state.tiltify.apiToken = tokenResult.accessToken;
  state.tiltify.tokenExpiresAt = tokenResult.expiresIn
    ? Date.now() + tokenResult.expiresIn * 1000
    : null;
  state.botStatus.tiltifyConfigured = Boolean(
    state.tiltify.campaignId || state.tiltify.apiToken || (state.tiltify.clientId && state.tiltify.clientSecret)
  );

  res.json({
    success: true,
    apiToken: tokenResult.accessToken,
    expiresIn: tokenResult.expiresIn,
    tokenExpiresAt: state.tiltify.tokenExpiresAt,
    tiltify: state.tiltify,
    status: state.botStatus,
  });
});

// 3. POST /api/discord/test: Send a test embed to Discord
app.post("/api/discord/test", async (req: Request, res: Response) => {
  const isAuction = req.body.eventType === "auction_ended" || Boolean(req.body.auction);

  let testDonation: DonationRecord;
  if (isAuction && req.body.auction) {
    const auc = req.body.auction;
    testDonation = {
      id: `test-auc-${Date.now()}`,
      tiltifyId: auc.auctionId || `auc-${Date.now()}`,
      eventType: "auction_ended",
      donorName: auc.winnerName || req.body.donorName || "Winning Bidder",
      donorEmail: auc.winnerEmail || req.body.donorEmail || undefined,
      amount: typeof auc.winningBid === "number" ? auc.winningBid : (typeof req.body.amount === "number" ? req.body.amount : 150.0),
      currency: auc.currency || req.body.currency || "USD",
      auction: auc,
      campaignName: req.body.campaignName || (state.tiltify.campaignId ? `Campaign #${state.tiltify.campaignId}` : "Charity Stream 2026"),
      receivedAt: new Date().toISOString(),
      source: "simulator",
      discordStatus: "pending",
    };
  } else {
    testDonation = {
      id: `test-${Date.now()}`,
      donorName: req.body.donorName || "Test Supporter",
      donorEmail: req.body.donorEmail || undefined,
      amount: typeof req.body.amount === "number" ? req.body.amount : 25.0,
      currency: req.body.currency || "USD",
      comment: req.body.comment || "This is a test notification from the Tiltify Discord Bot! Everything is configured properly. 🚀",
      campaignName: req.body.campaignName || (state.tiltify.campaignId ? `Campaign #${state.tiltify.campaignId}` : "Charity Stream 2026"),
      reward: req.body.reward || undefined,
      receivedAt: new Date().toISOString(),
      source: "simulator",
      discordStatus: "pending",
    };
  }

  console.log(
    `[Discord Test] Triggered test alert! Mode: ${state.discord.mode}, Webhook URL set: ${Boolean(
      state.discord.webhookUrl
    )}, Bot Token set: ${Boolean(state.discord.botToken)}`
  );

  const result = await dispatchDiscordAlert(testDonation, state.discord);
  console.log(
    `[Discord Test] Result: ${result.success ? "SUCCESS" : "FAILED - " + result.error}`
  );

  testDonation.discordStatus = result.success ? "sent" : "failed";
  testDonation.discordError = result.error;

  state.donations.unshift(testDonation);
  state.botStatus.lastDonationTimestamp = testDonation.receivedAt;
  if (isAuction) {
    state.botStatus.totalAuctionsProcessed = (state.botStatus.totalAuctionsProcessed || 0) + 1;
  }

  if (result.success) {
    res.json({
      success: true,
      message:
        result.warning ||
        (isAuction
          ? "Auction winner alert dispatched to Discord successfully!"
          : "Test alert dispatched to Discord successfully!"),
      warning: result.warning,
    });
  } else {
    res.status(400).json({ success: false, error: result.error });
  }
});

// 4. POST /api/tiltify/poll: Trigger manual poll immediately
app.post("/api/tiltify/poll", async (req: Request, res: Response) => {
  const result = await executeTiltifyPoll();
  res.json({
    success: state.botStatus.lastPollStatus !== "error",
    newDonationsCount: result.count,
    message: result.message,
    status: state.botStatus,
  });
});

// 5. POST /api/tiltify/webhook: Incoming webhook receiver from Tiltify
app.post("/api/tiltify/webhook", async (req: Request, res: Response) => {
  try {
    const payload = req.body;
    // Support multiple Tiltify webhook shapes:
    // Format A: { event: "donation.donated" | "auction.ended", data: { ... } }
    // Format B: { id, amount, donor_name, comment, ... }
    const raw = payload?.data || payload;
    const eventType = String(payload?.event || raw?.event || "").toLowerCase();

    const auctionInfo = extractAuctionWinnerInfo(raw, eventType);
    const isAuction = Boolean(auctionInfo);

    const donationId = String(
      (isAuction ? auctionInfo?.auctionId : null) ||
      raw?.id ||
      raw?.public_id ||
      `webhook-${Date.now()}`
    );

    let donation: DonationRecord;

    if (isAuction && auctionInfo) {
      donation = {
        id: donationId,
        tiltifyId: auctionInfo.auctionId || donationId,
        eventType: "auction_ended",
        donorName: auctionInfo.winnerName,
        donorEmail: auctionInfo.winnerEmail,
        amount: auctionInfo.winningBid,
        currency: auctionInfo.currency,
        auction: auctionInfo,
        campaignName: raw?.campaign?.name || raw?.campaign_name || "Tiltify Campaign",
        campaignId: raw?.campaign_id || state.tiltify.campaignId || undefined,
        causeName: raw?.cause?.name || raw?.charity?.name || undefined,
        receivedAt: auctionInfo.endedAt || raw?.created_at || new Date().toISOString(),
        source: "webhook",
        discordStatus: "pending",
        rawPayload: payload,
      };
    } else {
      let amount = 0;
      let currency = "USD";
      if (typeof raw?.amount === "object" && raw?.amount !== null) {
        amount = parseFloat(raw.amount.value || raw.amount.amount || "0");
        currency = raw.amount.currency || "USD";
      } else if (typeof raw?.amount === "number" || typeof raw?.amount === "string") {
        amount = parseFloat(String(raw.amount));
      }

      const { donorEmail, reward } = extractRewardAndDelivery(raw, state.campaignRewardsCache);

      donation = {
        id: donationId,
        tiltifyId: donationId,
        donorName: raw?.donor_name || raw?.name || "Anonymous Donor",
        donorEmail: donorEmail,
        amount: isNaN(amount) ? 0 : amount,
        currency: currency,
        comment: raw?.comment || raw?.message || undefined,
        reward: reward,
        campaignName: raw?.campaign?.name || raw?.campaign_name || "Tiltify Campaign",
        campaignId: raw?.campaign_id || state.tiltify.campaignId || undefined,
        causeName: raw?.cause?.name || raw?.charity?.name || undefined,
        receivedAt: raw?.created_at || new Date().toISOString(),
        source: "webhook",
        discordStatus: "pending",
        rawPayload: payload,
      };
    }

    console.log(
      `[Tiltify Webhook] Received webhook event! ID: ${donationId}, Type: ${
        isAuction ? "auction_ended" : "donation"
      }, Amount: ${donation.amount} ${donation.currency}, Donor: ${donation.donorName}`
    );

    // If duplicate check (per donation/auction id)
    const seenSet = isAuction ? state.seenAuctionIds : state.seenDonationIds;
    if (seenSet.has(donationId)) {
      console.log(`[Tiltify Webhook] Ignored duplicate event ID: ${donationId}`);
      res.status(200).json({ status: "ignored", message: "Event already processed." });
      return;
    }

    seenSet.add(donationId);

    // Send Discord Alert
    const dispatchResult = await dispatchDiscordAlert(donation, state.discord);
    console.log(
      `[Tiltify Webhook] Discord dispatch result: ${
        dispatchResult.success ? "SUCCESS" : "FAILED - " + dispatchResult.error
      }`
    );
    donation.discordStatus = dispatchResult.success ? "sent" : "failed";
    donation.discordError = dispatchResult.error;

    state.donations.unshift(donation);
    state.botStatus.totalDonationsProcessed += 1;
    if (isAuction) {
      state.botStatus.totalAuctionsProcessed = (state.botStatus.totalAuctionsProcessed || 0) + 1;
    }
    state.botStatus.totalAmountProcessed += donation.amount;
    state.botStatus.lastDonationTimestamp = donation.receivedAt;

    res.status(200).json({
      status: "received",
      donationId,
      eventType: donation.eventType || "donation",
      discordSent: dispatchResult.success,
      discordError: dispatchResult.error,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to process Tiltify webhook", details: err?.message });
  }
});

// 6. GET /api/donations: Get donation history
app.get("/api/donations", (req: Request, res: Response) => {
  res.json({
    donations: state.donations.slice(0, 100),
    totalCount: state.donations.length,
    totalAmount: state.botStatus.totalAmountProcessed,
  });
});

// 7. POST /api/donations/:id/resend: Resend a specific donation alert
app.post("/api/donations/:id/resend", async (req: Request, res: Response) => {
  const donation = state.donations.find((d) => d.id === req.params.id);
  if (!donation) {
    res.status(404).json({ error: "Donation not found" });
    return;
  }

  const result = await dispatchDiscordAlert(donation, state.discord);
  donation.discordStatus = result.success ? "sent" : "failed";
  donation.discordError = result.error;

  if (result.success) {
    res.json({ success: true, message: "Alert resent to Discord!" });
  } else {
    res.status(400).json({ success: false, error: result.error });
  }
});

// 8. DELETE /api/donations: Clear history
app.delete("/api/donations", (req: Request, res: Response) => {
  state.donations = [];
  state.seenDonationIds.clear();
  state.botStatus.totalDonationsProcessed = 0;
  state.botStatus.totalAmountProcessed = 0;
  res.json({ success: true });
});

// Start Server with Vite Middleware
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Tiltify Discord Bot server running on http://0.0.0.0:${PORT}`);
    // Start polling if enabled in env
    restartPollingTimer();
  });
}

startServer();
