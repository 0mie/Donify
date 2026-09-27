import express, { Request, Response } from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
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
  customThumbnail: {
    buffer: Buffer;
    contentType: string;
    fileName: string;
    updatedAt: string;
  } | null;
  customBanner: {
    buffer: Buffer;
    contentType: string;
    fileName: string;
    updatedAt: string;
  } | null;
  publicBaseUrl: string;
  adminPassword: string;
  activeSessions: Set<string>;
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
    includeCampaignProgress: true,
    customMessagePrefix: "🎉 New donation received on Tiltify!",
    includeRewardDetails: true,
    includeDeliveryAddress: true,
    spoilerDeliveryInfo: true,
    embedDensity: "comfortable",
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
    campaignName: (process.env.TILTIFY_CAMPAIGN_NAME || "").trim(),
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
  customThumbnail: null,
  customBanner: null,
  publicBaseUrl: process.env.APP_URL || "",
  adminPassword: (process.env.ADMIN_PASSWORD || "").trim(),
  activeSessions: new Set<string>(),
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
      adminPassword: state.adminPassword,
      discord: state.discord,
      tiltify: state.tiltify,
      customAvatarMeta: state.customAvatar
        ? {
            contentType: state.customAvatar.contentType,
            fileName: state.customAvatar.fileName,
            updatedAt: state.customAvatar.updatedAt,
          }
        : null,
      customThumbnailMeta: state.customThumbnail
        ? {
            contentType: state.customThumbnail.contentType,
            fileName: state.customThumbnail.fileName,
            updatedAt: state.customThumbnail.updatedAt,
          }
        : null,
      customBannerMeta: state.customBanner
        ? {
            contentType: state.customBanner.contentType,
            fileName: state.customBanner.fileName,
            updatedAt: state.customBanner.updatedAt,
          }
        : null,
    };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(toSave, null, 2), "utf-8");

    if (state.customAvatar?.buffer) {
      fs.writeFileSync(path.join(DATA_DIR, "custom-avatar.bin"), state.customAvatar.buffer);
    }
    if (state.customThumbnail?.buffer) {
      fs.writeFileSync(path.join(DATA_DIR, "custom-thumbnail.bin"), state.customThumbnail.buffer);
    }
    if (state.customBanner?.buffer) {
      fs.writeFileSync(path.join(DATA_DIR, "custom-banner.bin"), state.customBanner.buffer);
    }

    console.log("[Config Persistence] Saved configuration and assets to data/");
  } catch (err: any) {
    console.error("[Config Persistence] Failed to save config to disk:", err.message);
  }
}

const DONATIONS_FILE = path.join(DATA_DIR, "donations.json");

function saveDonationsToDisk() {
  try {
    ensureDataDir();
    const data = {
      donations: state.donations.slice(0, 500),
      seenDonationIds: Array.from(state.seenDonationIds),
      seenAuctionIds: Array.from(state.seenAuctionIds),
      botStatus: {
        totalDonationsProcessed: state.botStatus.totalDonationsProcessed,
        totalAuctionsProcessed: state.botStatus.totalAuctionsProcessed,
        totalAmountProcessed: state.botStatus.totalAmountProcessed,
        lastDonationTimestamp: state.botStatus.lastDonationTimestamp,
      },
    };
    fs.writeFileSync(DONATIONS_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err: any) {
    console.error("[Donations Persistence] Failed to save donations to disk:", err.message);
  }
}

function loadDonationsFromDisk(): boolean {
  try {
    if (fs.existsSync(DONATIONS_FILE)) {
      const raw = fs.readFileSync(DONATIONS_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.donations) && parsed.donations.length > 0) {
        state.donations = parsed.donations;
        if (Array.isArray(parsed.seenDonationIds)) {
          state.seenDonationIds = new Set(parsed.seenDonationIds);
        }
        if (Array.isArray(parsed.seenAuctionIds)) {
          state.seenAuctionIds = new Set(parsed.seenAuctionIds);
        }
        for (const d of state.donations) {
          if (d.id) state.seenDonationIds.add(d.id);
          if (d.tiltifyId) state.seenDonationIds.add(d.tiltifyId);
          if (d.eventType === "auction_ended" || d.auction) {
            if (d.id) state.seenAuctionIds.add(d.id);
            if (d.tiltifyId) state.seenAuctionIds.add(d.tiltifyId);
          }
        }
        if (parsed.botStatus && typeof parsed.botStatus === "object") {
          if (typeof parsed.botStatus.totalDonationsProcessed === "number") {
            state.botStatus.totalDonationsProcessed = parsed.botStatus.totalDonationsProcessed;
          }
          if (typeof parsed.botStatus.totalAuctionsProcessed === "number") {
            state.botStatus.totalAuctionsProcessed = parsed.botStatus.totalAuctionsProcessed;
          }
          if (typeof parsed.botStatus.totalAmountProcessed === "number") {
            state.botStatus.totalAmountProcessed = parsed.botStatus.totalAmountProcessed;
          }
          if (parsed.botStatus.lastDonationTimestamp) {
            state.botStatus.lastDonationTimestamp = parsed.botStatus.lastDonationTimestamp;
          }
        }
        console.log(`[Donations Persistence] Restored ${state.donations.length} records and ${state.seenDonationIds.size} seen IDs from disk`);
        return true;
      }
    }
  } catch (err: any) {
    console.warn("[Donations Persistence] Could not load saved donations:", err.message);
  }
  return false;
}

function loadConfigFromDisk() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (process.env.ADMIN_PASSWORD) {
        state.adminPassword = process.env.ADMIN_PASSWORD.trim();
      } else if (parsed.adminPassword && typeof parsed.adminPassword === "string") {
        state.adminPassword = parsed.adminPassword;
      }

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

      if (parsed.customAvatarMeta && fs.existsSync(path.join(DATA_DIR, "custom-avatar.bin"))) {
        state.customAvatar = {
          buffer: fs.readFileSync(path.join(DATA_DIR, "custom-avatar.bin")),
          contentType: parsed.customAvatarMeta.contentType,
          fileName: parsed.customAvatarMeta.fileName,
          updatedAt: parsed.customAvatarMeta.updatedAt,
        };
      }
      if (parsed.customThumbnailMeta && fs.existsSync(path.join(DATA_DIR, "custom-thumbnail.bin"))) {
        state.customThumbnail = {
          buffer: fs.readFileSync(path.join(DATA_DIR, "custom-thumbnail.bin")),
          contentType: parsed.customThumbnailMeta.contentType,
          fileName: parsed.customThumbnailMeta.fileName,
          updatedAt: parsed.customThumbnailMeta.updatedAt,
        };
      }
      if (parsed.customBannerMeta && fs.existsSync(path.join(DATA_DIR, "custom-banner.bin"))) {
        state.customBanner = {
          buffer: fs.readFileSync(path.join(DATA_DIR, "custom-banner.bin")),
          contentType: parsed.customBannerMeta.contentType,
          fileName: parsed.customBannerMeta.fileName,
          updatedAt: parsed.customBannerMeta.updatedAt,
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

loadConfigFromDisk();

app.use((req: Request, _res: Response, next) => {
  const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol || "https";
  const host = (req.headers["x-forwarded-host"] as string) || req.headers.host;
  if (host && (!state.publicBaseUrl || state.publicBaseUrl.includes("localhost"))) {
    state.publicBaseUrl = `${proto}://${host}`;
    state.botStatus.serverUrl = state.publicBaseUrl;
  }
  next();
});

loadDonationsFromDisk();

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

function hexToDiscordColor(hex: string): number {
  const cleanHex = hex.replace("#", "");
  const num = parseInt(cleanHex, 16);
  return isNaN(num) ? 0x00d1b2 : num;
}

function generateProgressBar(
  current: number,
  goal: number,
  barLength: number = 10,
  charStyle?: string
): string {
  if (!goal || goal <= 0) return "";
  const ratio = Math.min(Math.max(current / goal, 0), 1);
  const percent = ((current / goal) * 100).toFixed(1);

  if (charStyle === "percentage") {
    return `**${percent}%** reached (${current.toLocaleString()} / ${goal.toLocaleString()})`;
  }

  const filled = Math.round(ratio * barLength);
  const empty = barLength - filled;

  if (charStyle === "line") {
    return `\`[${"━".repeat(filled)}${"─".repeat(empty)}]\` **${percent}%**`;
  }
  if (charStyle === "stars") {
    return `\`[${"★".repeat(filled)}${"☆".repeat(empty)}]\` **${percent}%**`;
  }
  return `\`[${"▓".repeat(filled)}${"░".repeat(empty)}]\` **${percent}%**`;
}

function interpolateTemplate(tpl: string, vars: Record<string, string>): string {
  if (!tpl) return "";
  return tpl.replace(/\{(\w+)\}/g, (_, key) => {
    return vars[key] !== undefined ? vars[key] : `{${key}}`;
  });
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

    if (isAuction && config.enableAuctionAlerts === false) {
      return { success: false, error: "Auction alerts are disabled in Discord settings." };
    }

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
      const auctionVars = {
        amount: formattedAmount,
        winner: auction.winnerName || donation.donorName || "Winning Bidder",
        item: auction.itemTitle || "Auction Item",
        campaign: donation.campaignName || "Campaign",
      };

      if (config.auctionTitleTemplate?.trim()) {
        embedTitle = interpolateTemplate(config.auctionTitleTemplate, auctionVars);
      } else {
        embedTitle = `🏆 AUCTION HOUSE: ${auction.itemTitle}`;
      }

      embedDescription = `**${auction.winnerName || donation.donorName}** won **${auction.itemTitle}** with a winning bid of **${formattedAmount}**!`;
      embedColor = hexToDiscordColor(config.auctionEmbedColor || "#F59E0B");
      embedFooterText = config.auctionFooterText?.trim() || "Tiltify Auction House • Winner Fulfillment";

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

      if (config.includeCampaignDetails && (donation.campaignName || donation.causeName)) {
        const details: string[] = [];
        if (donation.campaignName) details.push(`**${donation.campaignName}**`);
        if (donation.causeName) details.push(`*${donation.causeName}*`);
        embedFields.push({
          name: "🎯 Campaign",
          value: details.join(" • "),
          inline: true,
        });
      }

      let itemVal = `**${auction.itemTitle}**`;
      if (auction.itemDescription) {
        itemVal += `\n*${auction.itemDescription}*`;
      }
      embedFields.push({
        name: "🏷️ Auction Item Won",
        value: itemVal,
        inline: false,
      });

      const winnerName = auction.winnerName || donation.donorName;
      const winnerEmail = auction.winnerEmail || donation.donorEmail;
      const addr = auction.shippingAddress;
      const isPureDigital = auction.prizeType === "email" || (Boolean(winnerEmail) && !addr && auction.prizeType !== "physical");
      const hasPhysicalShipping = !isPureDigital && (auction.prizeType === "physical" || auction.prizeType === "both" || Boolean(addr));
      const hasEmailDelivery = Boolean(winnerEmail) && (isPureDigital || auction.prizeType === "both");

      if (isPureDigital) {
        const emailLines: string[] = [];
        emailLines.push(`**Winner:** ${winnerName}`);
        if (winnerEmail) {
          emailLines.push(`**Send To Email:** **\`${winnerEmail}\`**`);
        } else {
          emailLines.push(`**Send To Email:** 🔒 *Protected (Enable 'Include private data' on webhook)*`);
        }
        if (auction.specialInstructions) {
          emailLines.push(`\n**Donor Note:** "${auction.specialInstructions}"`);
        }

        embedFields.push({
          name: "📧 Digital Prize Delivery",
          value: emailLines.join("\n"),
          inline: false,
        });
      } else if (hasPhysicalShipping) {
        const physicalLines: string[] = [];
        physicalLines.push(`**Recipient:** ${addr?.recipientName || winnerName}`);
        if (winnerEmail) {
          physicalLines.push(`**Contact Email:** \`${winnerEmail}\``);
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
              `\n**Shipping Address:** (Click to reveal)\n||${formattedAddress.replace(/\n/g, ", ")}||\n*(Spoiler-tagged for winner privacy)*`
            );
          } else {
            physicalLines.push(`\n**Shipping Address:**\n\`\`\`\n${formattedAddress}\n\`\`\``);
          }
        } else {
          physicalLines.push(`\n*(Physical shipping required — address will be provided in winner survey)*`);
        }

        if (auction.specialInstructions) {
          physicalLines.push(`\n**Winner Delivery Notes:** "${auction.specialInstructions}"`);
        }

        embedFields.push({
          name: "📦 Physical Prize Shipping",
          value: physicalLines.join("\n"),
          inline: false,
        });

        if (hasEmailDelivery && winnerEmail) {
          embedFields.push({
            name: "📧 Digital Redemption Pass",
            value: `**Send To Email:** **\`${winnerEmail}\`**`,
            inline: false,
          });
        }
      }

      if (
        config.includeCampaignProgress !== false &&
        donation.totalRaised !== undefined &&
        config.embedLayout !== "minimal"
      ) {
        let progressVal = "";
        if (donation.targetGoal && donation.targetGoal > 0) {
          const bar = generateProgressBar(
            donation.totalRaised,
            donation.targetGoal,
            10,
            config.progressBarCharStyle
          );
          progressVal = `**${formatCurrency(donation.totalRaised, donation.currency)}** raised of **${formatCurrency(donation.targetGoal, donation.currency)}** goal\n${bar}`;
        } else {
          progressVal = `**${formatCurrency(donation.totalRaised, donation.currency)}** total raised so far!`;
        }
        embedFields.push({
          name: "🏆 Campaign Total Raised",
          value: progressVal,
          inline: false,
        });
      }
    } else {
      const templateVars = {
        amount: formattedAmount,
        donor: donation.donorName || "Anonymous",
        campaign: donation.campaignName || "Campaign",
        cause: donation.causeName || "",
      };

      if (config.embedTitleTemplate?.trim()) {
        embedTitle = interpolateTemplate(config.embedTitleTemplate, templateVars);
      } else {
        embedTitle = `🎉 New Donation: ${formattedAmount}!`;
      }

      if (config.embedDescriptionTemplate?.trim()) {
        embedDescription = interpolateTemplate(config.embedDescriptionTemplate, templateVars);
      } else {
        embedDescription = `**${donation.donorName || "An anonymous donor"}** contributed to the campaign!`;
      }

      embedColor = hexToDiscordColor(config.embedColor);
      embedFooterText = config.footerText?.trim() || "Tiltify Donation Alerts";

      const layout = config.embedLayout || "modern";

      if (layout === "compact") {
        const statsLine = [
          `**Donor:** ${donation.donorName || "Anonymous"}`,
          `**Amount:** ${formattedAmount}`,
          ...(config.includeCampaignDetails && donation.campaignName ? [`**Campaign:** ${donation.campaignName}`] : []),
        ].join("  •  ");

        embedFields.push({
          name: "⚡ Donation Summary",
          value: statsLine,
          inline: false,
        });

        if (config.includeComment && donation.comment) {
          embedFields.push({
            name: "💬 Message",
            value: `> *"${donation.comment}"*`,
            inline: false,
          });
        }
      } else {
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

        if (config.includeCampaignDetails && (donation.campaignName || donation.causeName)) {
          const details: string[] = [];
          if (donation.campaignName) details.push(`**${donation.campaignName}**`);
          if (donation.causeName) details.push(`*${donation.causeName}*`);
          embedFields.push({
            name: "🎯 Campaign",
            value: details.join(" • "),
            inline: true,
          });
        }

        if (config.includeComment && donation.comment) {
          embedFields.push({
            name: "💬 Message",
            value: `> ${donation.comment}`,
            inline: false,
          });
        }

        if (
          config.includeCampaignProgress !== false &&
          donation.totalRaised !== undefined &&
          layout !== "minimal"
        ) {
          let progressVal = "";
          if (donation.targetGoal && donation.targetGoal > 0) {
            const bar = generateProgressBar(
              donation.totalRaised,
              donation.targetGoal,
              10,
              config.progressBarCharStyle
            );
            progressVal = `**${formatCurrency(donation.totalRaised, donation.currency)}** raised of **${formatCurrency(donation.targetGoal, donation.currency)}** goal\n${bar}`;
          } else {
            progressVal = `**${formatCurrency(donation.totalRaised, donation.currency)}** total raised so far!`;
          }
          embedFields.push({
            name: "🏆 Campaign Total Raised",
            value: progressVal,
            inline: false,
          });
        }
      }

      if (config.includeRewardDetails !== false && donation.reward) {
        const reward = donation.reward;
        const rewardLines: string[] = [];
        const qtyStr = reward.quantity && reward.quantity > 1 ? ` (Qty: ${reward.quantity})` : "";
        rewardLines.push(`**${reward.name}**${qtyStr}`);
        if (reward.description) {
          rewardLines.push(`*${reward.description}*`);
        }
        embedFields.push({
          name: "🎁 Selected Reward",
          value: rewardLines.join("\n"),
          inline: false,
        });
      }
    }

    let resolvedFooterIconUrl = (config.footerIconUrl || "").trim();
    if (!resolvedFooterIconUrl) {
      resolvedFooterIconUrl = state.publicBaseUrl
        ? `${state.publicBaseUrl}/api/discord/tiltify-icon`
        : "https://site-assets.tiltify.com/frontend-users/favicon.ico";
    }

    let embedTimestamp: string;
    try {
      embedTimestamp = donation.receivedAt ? new Date(donation.receivedAt).toISOString() : new Date().toISOString();
    } catch {
      embedTimestamp = new Date().toISOString();
    }

    const embed: Record<string, any> = {
      title: embedTitle,
      description: embedDescription,
      color: embedColor,
      fields: embedFields,
      footer: {
        text: embedFooterText,
        icon_url: resolvedFooterIconUrl,
      },
    };

    if (config.showEmbedTimestamp !== false) {
      embed.timestamp = embedTimestamp;
    }

    if (config.mode === "webhook") {
      if (!config.webhookUrl) {
        return { success: false, error: "Discord Webhook URL is not configured." };
      }

      let avatarUrl = config.botAvatarUrl || "https://tiltify.com/favicon.ico";
      if (avatarUrl.startsWith("/")) {
        if (state.publicBaseUrl) avatarUrl = `${state.publicBaseUrl}${avatarUrl}`;
      } else if (avatarUrl.startsWith("data:")) {
        avatarUrl = state.publicBaseUrl && state.customAvatar ? `${state.publicBaseUrl}/api/discord/avatar` : "https://tiltify.com/favicon.ico";
      }

      const payload = {
        username: config.botUsername || "Tiltify Donation Bot",
        avatar_url: avatarUrl,
        content: content || undefined,
        embeds: [embed],
        allowed_mentions: allowedMentions,
      };

      const primaryUrl = config.webhookUrl.trim();
      let response = await fetch(primaryUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok && primaryUrl.includes("discord.com")) {
        const alternateUrl = primaryUrl.replace("discord.com", "discordapp.com");
        const retryRes = await fetch(alternateUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (retryRes.ok) return { success: true };
      }

      return { success: response.ok };
    } else {
      if (!config.botToken || !config.channelId) {
        return { success: false, error: "Discord Bot Token or Channel ID missing." };
      }
      const botUrl = `https://discord.com/api/v10/channels/${config.channelId.trim()}/messages`;
      const response = await fetch(botUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bot ${config.botToken.trim()}`,
        },
        body: JSON.stringify({
          content: content || undefined,
          embeds: [embed],
          allowed_mentions: allowedMentions,
        }),
      });
      return { success: response.ok };
    }
  } catch (err: any) {
    return { success: false, error: err?.message || "Unexpected error." };
  }
}

async function requestTiltifyAccessToken(
  clientId: string,
  clientSecret: string
): Promise<{ success: boolean; accessToken?: string; expiresIn?: number; error?: string }> {
  try {
    const res = await fetch("https://v5api.tiltify.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        grant_type: "client_credentials",
        client_id: clientId.trim(),
        client_secret: clientSecret.trim(),
        scope: "public",
      }),
    });
    if (!res.ok) return { success: false, error: `HTTP ${res.status}` };
    const data = await res.json();
    return { success: true, accessToken: data.access_token, expiresIn: data.expires_in };
  } catch (err: any) {
    return { success: false, error: err?.message };
  }
}

async function ensureValidTiltifyToken(): Promise<string | null> {
  if (state.tiltify.clientId && state.tiltify.clientSecret) {
    const tokenExpiringSoon = state.tiltify.tokenExpiresAt ? Date.now() >= state.tiltify.tokenExpiresAt - 60000 : false;
    if (!state.tiltify.apiToken || tokenExpiringSoon) {
      const res = await requestTiltifyAccessToken(state.tiltify.clientId, state.tiltify.clientSecret);
      if (res.success && res.accessToken) {
        state.tiltify.apiToken = res.accessToken;
        state.tiltify.tokenExpiresAt = res.expiresIn ? Date.now() + res.expiresIn * 1000 : null;
      }
    }
  }
  return state.tiltify.apiToken || null;
}

async function getTiltifyAuthHeaders(): Promise<Record<string, string>> {
  const token = await ensureValidTiltifyToken();
  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token.trim()}`;
  return headers;
}

async function refreshCampaignRewards(campaignId: string): Promise<void> {
  if (!campaignId) return;
  try {
    const url = `https://v5api.tiltify.com/api/public/campaigns/${campaignId.trim()}/rewards`;
    const headers = await getTiltifyAuthHeaders();
    const res = await fetch(url, { headers });
    if (res.ok) {
      const data = await res.json();
      const list = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
      for (const r of list) {
        if (r.id) state.campaignRewardsCache.set(String(r.id), r);
      }
    }
  } catch {}
}

function cleanCampaignIdentifier(raw: string): string {
  let cleaned = (raw || "").trim();
  if (cleaned.startsWith("http://") || cleaned.startsWith("https://")) {
    try {
      const parsedUrl = new URL(cleaned);
      const segments = parsedUrl.pathname.split("/").filter(Boolean);
      if (segments.length > 0) cleaned = segments[segments.length - 1].replace(/^\+/, "");
    } catch {}
  }
  return cleaned;
}

interface ParsedAuctionHouseTarget {
  raw: string;
  slug?: string;
  userSlug?: string;
  causeSlug?: string;
  isUuid: boolean;
}

function parseAuctionHouseTarget(raw: string): ParsedAuctionHouseTarget {
  let cleaned = (raw || "").trim();
  let userSlug: string | undefined;
  let causeSlug: string | undefined;
  let slug: string | undefined;

  if (cleaned.startsWith("http://") || cleaned.startsWith("https://")) {
    try {
      const parsedUrl = new URL(cleaned);
      const segments = parsedUrl.pathname.split("/").filter(Boolean);
      const aucIdx = segments.indexOf("auctions");
      if (aucIdx !== -1 && segments.length > aucIdx + 1) {
        slug = segments[aucIdx + 1];
        if (aucIdx > 0) {
          const prefix = segments[aucIdx - 1];
          if (prefix.startsWith("@")) userSlug = prefix.slice(1);
          else if (prefix.startsWith("+")) causeSlug = prefix.slice(1);
          else userSlug = prefix;
        }
      } else if (segments.length > 0) {
        const last = segments[segments.length - 1];
        if (last.startsWith("@")) userSlug = last.slice(1);
        else if (last.startsWith("+")) causeSlug = last.slice(1);
        else slug = last;
      }
    } catch {}
  } else {
    if (cleaned.startsWith("@")) userSlug = cleaned.slice(1);
    else if (cleaned.startsWith("+")) causeSlug = cleaned.slice(1);
    else slug = cleaned;
  }

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug || cleaned);

  return {
    raw: cleaned,
    slug: slug ? slug.replace(/^[@+]/, "").trim() : undefined,
    userSlug: userSlug ? userSlug.trim() : undefined,
    causeSlug: causeSlug ? causeSlug.trim() : undefined,
    isUuid,
  };
}

interface CampaignSummary {
  id: string;
  name?: string;
  campaignName?: string;
  slug?: string;
  totalRaised?: number;
  targetGoal?: number;
  currency?: string;
  fetchedAt: number;
}
let cachedCampaignSummary: CampaignSummary | null = null;

interface ExtractedAuctionItemWinner {
  id: string;
  itemId: string;
  itemTitle: string;
  itemDescription?: string;
  imageUrl?: string;
  fairMarketValue?: number;
  startingBid?: number;
  winningBid: number;
  currency: string;
  winnerName: string;
  winnerEmail?: string;
  endedAt: string;
  status: string;
  auctionHouseId?: string;
  auctionHouseName?: string;
  prizeType?: "physical" | "email" | "both" | "none";
  shippingAddress?: RewardDeliveryAddress;
  specialInstructions?: string;
  rawPayload?: any;
}

// Fetch real campaign auctions without fake @example.com or filler text
async function fetchAllCampaignAuctions(
  rawCampaignId: string,
  options?: {
    startDate?: string;
    endDate?: string;
    maxPages?: number;
    auctionHouseIdOrSlug?: string;
  }
): Promise<{
  auctions: ExtractedAuctionItemWinner[];
  totalListedItems: number;
  completedWinnersCount: number;
  totalAuctionAmount: number;
  auctionHouseName?: string;
  auctionHouseId?: string;
  errors?: string[];
}> {
  const cid = cleanCampaignIdentifier(rawCampaignId || state.tiltify.campaignId || "");
  const headers = await getTiltifyAuthHeaders();

  const results: ExtractedAuctionItemWinner[] = [];
  const errors: string[] = [];
  let totalListedItems = 0;
  let auctionHouseName: string | undefined;
  let auctionHouseId: string | undefined;

  const startMs = options?.startDate ? new Date(options.startDate).getTime() : null;
  const endMs = options?.endDate ? new Date(options.endDate).getTime() : null;

  let userSlug = "";
  let campSlug = "";
  let campDataObj: any = null;

  if (cid) {
    try {
      const campRes = await fetch(
        `https://v5api.tiltify.com/api/public/campaigns/${encodeURIComponent(cid)}`,
        { headers }
      );
      if (campRes.ok) {
        const campPayload = await campRes.json();
        campDataObj = campPayload?.data || campPayload;
        if (campDataObj) {
          if (campDataObj.user?.slug) userSlug = campDataObj.user.slug;
          if (campDataObj.slug) campSlug = campDataObj.slug;
        }
      }
    } catch (err: any) {
      errors.push(`Campaign lookup note: ${err.message}`);
    }
  }

  const candidateTarget = parseAuctionHouseTarget(
    options?.auctionHouseIdOrSlug || state.tiltify.auctionHouseIdOrSlug || ""
  );

  let ahObj: any = null;

  if (candidateTarget.isUuid && candidateTarget.slug) {
    try {
      const ahRes = await fetch(
        `https://v5api.tiltify.com/api/public/auction_houses/${encodeURIComponent(candidateTarget.slug)}`,
        { headers }
      );
      if (ahRes.ok) {
        const ahJson = await ahRes.json();
        ahObj = ahJson.data || ahJson;
      }
    } catch {}
  }

  const targetUserSlug = candidateTarget.userSlug || userSlug;
  const candidateSlugs = [
    candidateTarget.slug,
    campSlug ? `${campSlug}-auctions` : "",
    campSlug,
    "auctions",
  ].filter(Boolean) as string[];

  if (!ahObj && targetUserSlug) {
    for (const slug of candidateSlugs) {
      try {
        const ahUrl = `https://v5api.tiltify.com/api/public/auction_houses/by/user/slugs/${encodeURIComponent(targetUserSlug)}/${encodeURIComponent(slug)}`;
        const ahRes = await fetch(ahUrl, { headers });
        if (ahRes.ok) {
          const ahJson = await ahRes.json();
          ahObj = ahJson.data || ahJson;
          if (ahObj?.id) break;
        }
      } catch {}
    }
  }

  if (ahObj && ahObj.id) {
    auctionHouseId = ahObj.id;
    auctionHouseName = ahObj.name || "Tiltify Auction House";
    if (ahObj.slug && !state.tiltify.auctionHouseIdOrSlug) {
      state.tiltify.auctionHouseIdOrSlug = ahObj.slug;
    }

    try {
      const itemsUrl = `https://v5api.tiltify.com/api/public/auction_houses/${encodeURIComponent(ahObj.id)}/auction_items?limit=100`;
      const itemsRes = await fetch(itemsUrl, { headers });
      if (itemsRes.ok) {
        const itemsPayload = await itemsRes.json();
        const rawItems: any[] = Array.isArray(itemsPayload?.data)
          ? itemsPayload.data
          : Array.isArray(itemsPayload)
          ? itemsPayload
          : [];
        totalListedItems = rawItems.length;

        for (const item of rawItems) {
          const itemEndedAtStr = item.completed_at || item.ends_at || item.inserted_at;
          const endedMs = itemEndedAtStr ? new Date(itemEndedAtStr).getTime() : null;

          if (startMs && endedMs && endedMs < startMs) continue;
          if (endMs && endedMs && endedMs > endMs) continue;

          try {
            const bidsUrl = `https://v5api.tiltify.com/api/public/auction_items/${encodeURIComponent(item.id)}/auction_bids?limit=100`;
            const bidsRes = await fetch(bidsUrl, { headers });
            if (bidsRes.ok) {
              const bidsPayload = await bidsRes.json();
              const bids: any[] = Array.isArray(bidsPayload?.data)
                ? bidsPayload.data
                : Array.isArray(bidsPayload)
                ? bidsPayload
                : [];

              const winningBid =
                bids.find((b: any) => b.current_winner) ||
                (item.status === "completed" && bids.length > 0 ? bids[0] : null);

              if (winningBid) {
                const amountVal = parseFloat(winningBid.amount?.value || winningBid.amount || 0);
                const currency = winningBid.amount?.currency || "USD";
                const winnerName = (winningBid.public_name || winningBid.donor_name || "Anonymous Winner").trim();
                
                let cleanEmail = winningBid.donor_email || winningBid.email || item.winner_email || undefined;
                if (cleanEmail && typeof cleanEmail === "string" && cleanEmail.endsWith("@example.com")) {
                  cleanEmail = undefined;
                }

                const realTitle = item.name || item.title || item.item_name || `Auction Lot #${item.id}`;

                results.push({
                  id: `auc-${item.id}`,
                  itemId: String(item.id),
                  itemTitle: realTitle,
                  itemDescription: item.description || undefined,
                  imageUrl: item.images?.[0]?.src || item.avatar?.src || undefined,
                  fairMarketValue: item.fair_market_value?.value ? parseFloat(item.fair_market_value.value) : undefined,
                  startingBid: item.starting_bid?.value ? parseFloat(item.starting_bid.value) : undefined,
                  winningBid: isNaN(amountVal) ? 0 : amountVal,
                  currency,
                  winnerName,
                  winnerEmail: cleanEmail,
                  endedAt: item.completed_at || item.ends_at || new Date().toISOString(),
                  status: item.status || "completed",
                  auctionHouseId: ahObj.id,
                  auctionHouseName,
                  rawPayload: { ...item, winningBid },
                });
              }
            }
          } catch (bidErr: any) {
            errors.push(`Error querying bids: ${bidErr.message}`);
          }
        }
      }
    } catch (ahErr: any) {
      errors.push(`Error querying auction items: ${ahErr.message}`);
    }
  }

  const completedWinnersCount = results.length;
  const totalAuctionAmount = results.reduce((acc, r) => acc + r.winningBid, 0);

  return {
    auctions: results,
    totalListedItems: totalListedItems || completedWinnersCount,
    completedWinnersCount,
    totalAuctionAmount,
    auctionHouseName: auctionHouseName || "Tiltify Auction House",
    auctionHouseId,
    errors: errors.length > 0 ? errors : undefined,
  };
}

async function fetchLiveCampaignSummary(
  campaignId?: string,
  forceRefresh = false
): Promise<{
  id?: string;
  totalRaised?: number;
  targetGoal?: number;
  campaignName?: string;
  name?: string;
  slug?: string;
  currency?: string;
} | null> {
  const rawId = (campaignId || state.tiltify.campaignId || "").trim();
  const cid = cleanCampaignIdentifier(rawId);
  if (!cid) {
    if (state.botStatus.totalAmountProcessed > 0 || state.tiltify.campaignName || state.discord.campaignName) {
      return {
        totalRaised: state.botStatus.totalAmountProcessed,
        campaignName: state.tiltify.campaignName?.trim() || state.discord.campaignName?.trim() || undefined,
        name: state.tiltify.campaignName?.trim() || state.discord.campaignName?.trim() || undefined,
      };
    }
    return null;
  }

  if (
    !forceRefresh &&
    cachedCampaignSummary &&
    cachedCampaignSummary.id === cid &&
    Date.now() - cachedCampaignSummary.fetchedAt < 10000
  ) {
    return {
      ...cachedCampaignSummary,
      campaignName: state.tiltify.campaignName?.trim() || state.discord.campaignName?.trim() || cachedCampaignSummary.campaignName || cachedCampaignSummary.name,
    };
  }

  const candidateUrls = [
    `https://v5api.tiltify.com/api/public/campaigns/${encodeURIComponent(cid)}`,
    `https://v5api.tiltify.com/api/public/campaigns/by/slug/${encodeURIComponent(cid)}`,
  ];

  const headers = await getTiltifyAuthHeaders();

  for (const url of candidateUrls) {
    try {
      const res = await fetch(url, { headers });
      if (res.ok) {
        const data = await res.json();
        const camp = Array.isArray(data?.data) ? data.data[0] : (data?.data || data);
        if (!camp || typeof camp !== "object") continue;

        const raisedVal = camp.total_amount_raised?.value ?? camp.total_amount_raised ?? camp.amount_raised?.value ?? camp.amount_raised;
        const goalVal = camp.goal?.value ?? camp.goal;
        const currency = camp.total_amount_raised?.currency ?? camp.amount_raised?.currency ?? camp.goal?.currency ?? "USD";
        let totalRaised = typeof raisedVal === "number" ? raisedVal : parseFloat(raisedVal);
        const targetGoal = typeof goalVal === "number" ? goalVal : parseFloat(goalVal);

        const realName = camp.name || camp.title || camp.campaign_name || camp.slug || cid;
        const effectiveName = state.tiltify.campaignName?.trim() || state.discord.campaignName?.trim() || realName;

        cachedCampaignSummary = {
          id: cid,
          name: realName,
          campaignName: effectiveName,
          slug: camp.slug || undefined,
          totalRaised: !isNaN(totalRaised) ? totalRaised : undefined,
          targetGoal: !isNaN(targetGoal) ? targetGoal : undefined,
          currency,
          fetchedAt: Date.now(),
        };

        return cachedCampaignSummary;
      }
    } catch {}
  }

  return null;
}

function extractRewardAndDelivery(
  raw: any,
  rewardsCache?: Map<string, any>
): {
  donorEmail?: string;
  reward?: ClaimedReward;
} {
  if (!raw || typeof raw !== "object") return {};

  let donorEmail = raw.donor_email || raw.email || raw.address?.email || raw.shipping_address?.email || undefined;
  if (donorEmail && typeof donorEmail === "string" && donorEmail.endsWith("@example.com")) {
    donorEmail = undefined;
  }

  const rewardObj = raw.reward || raw.data?.reward;
  const rewardClaims = Array.isArray(raw.reward_claims) && raw.reward_claims.length > 0 ? raw.reward_claims[0] : null;
  const rewardId = raw.reward_id || raw.rewardId || rewardObj?.id || rewardClaims?.reward_id || undefined;

  let cachedReward: any = undefined;
  if (rewardId && rewardsCache && rewardsCache.has(String(rewardId))) {
    cachedReward = rewardsCache.get(String(rewardId));
  }

  const effectiveReward = rewardObj || cachedReward;
  const rewardName = effectiveReward?.name || effectiveReward?.title || raw.reward_name || (rewardId ? `Reward #${rewardId}` : undefined);

  const rawAddr = raw.address || raw.shipping_address || raw.donor_address || rewardClaims?.address || rewardObj?.address || undefined;
  let shippingAddress: RewardDeliveryAddress | undefined = undefined;
  if (rawAddr && typeof rawAddr === "object") {
    shippingAddress = {
      recipientName: rawAddr.recipient_name || rawAddr.name || raw.donor_name || undefined,
      addressLine1: rawAddr.address_line1 || rawAddr.line1 || rawAddr.street || undefined,
      addressLine2: rawAddr.address_line2 || rawAddr.line2 || undefined,
      city: rawAddr.city || undefined,
      region: rawAddr.region || rawAddr.state || rawAddr.province || undefined,
      postalCode: rawAddr.postal_code || rawAddr.zip || undefined,
      country: rawAddr.country || undefined,
    };
  }

  if (rewardName || rewardId || shippingAddress) {
    const qty = Number(rewardClaims?.quantity || raw.quantity || rewardObj?.quantity || 1);
    return {
      donorEmail,
      reward: {
        id: rewardId ? String(rewardId) : undefined,
        name: rewardName || "Selected Campaign Reward",
        description: effectiveReward?.description || undefined,
        quantity: isNaN(qty) || qty < 1 ? 1 : qty,
        deliveryType: shippingAddress ? "shipping" : "digital",
        donorEmail: donorEmail,
        shippingAddress: shippingAddress,
      },
    };
  }

  return { donorEmail };
}

function extractAuctionWinnerInfo(raw: any, eventType?: string): AuctionWinnerInfo | null {
  if (!raw || typeof raw !== "object") return null;

  const isAuction =
    raw.is_auction === true ||
    raw.auction !== undefined ||
    raw.auction_item !== undefined ||
    raw.winning_bid !== undefined ||
    raw.winningBid !== undefined ||
    raw.item_title !== undefined ||
    raw.itemTitle !== undefined ||
    raw.item_name !== undefined ||
    raw.itemName !== undefined ||
    (typeof eventType === "string" && eventType.toLowerCase().includes("auction")) ||
    raw.event?.toLowerCase?.().includes("auction");

  if (!isAuction) return null;

  const auctionObj = raw.auction || raw.auction_item || raw.data?.auction || raw.data?.auction_item || raw;

  let itemTitle =
    raw.item_name ||
    raw.itemName ||
    auctionObj.name ||
    auctionObj.item_name ||
    auctionObj.itemName ||
    auctionObj.item_title ||
    auctionObj.itemTitle ||
    auctionObj.title ||
    raw.item_title ||
    raw.itemTitle ||
    raw.title ||
    raw.name ||
    undefined;

  if (itemTitle && itemTitle.toLowerCase().includes("charity auction prize #")) {
    itemTitle = undefined;
  }
  if (!itemTitle) {
    itemTitle = auctionObj.id ? `Auction Lot #${auctionObj.id}` : "Auction Item";
  }

  const itemDescription = auctionObj.item_description || auctionObj.description || raw.description || undefined;

  let winningBid = 0;
  let currency = "USD";
  const rawBid = auctionObj.winning_bid || auctionObj.winningBid || auctionObj.amount || raw.winning_bid || raw.amount;

  if (typeof rawBid === "object" && rawBid !== null) {
    winningBid = parseFloat(rawBid.value || rawBid.amount || "0");
    currency = rawBid.currency || "USD";
  } else if (typeof rawBid === "number" || typeof rawBid === "string") {
    winningBid = parseFloat(String(rawBid));
    if (raw.currency) currency = raw.currency;
  }

  const winnerObj = auctionObj.winner || auctionObj.winning_bidder || raw.winner || raw.winning_bidder || raw.donor || {};
  const winnerName = winnerObj.name || winnerObj.donor_name || auctionObj.winner_name || raw.donor_name || raw.name || "Auction Winner";

  let winnerEmail =
    winnerObj.email ||
    winnerObj.donor_email ||
    auctionObj.winner_email ||
    raw.donor_email ||
    raw.email ||
    undefined;

  if (winnerEmail && typeof winnerEmail === "string") {
    winnerEmail = winnerEmail.trim();
    if (winnerEmail.endsWith("@example.com")) {
      winnerEmail = undefined;
    }
  }

  const rawAddr = auctionObj.shipping_address || raw.shipping_address || undefined;
  let shippingAddress: RewardDeliveryAddress | undefined = undefined;
  if (rawAddr && typeof rawAddr === "object") {
    shippingAddress = {
      recipientName: rawAddr.recipient_name || rawAddr.name || winnerName,
      addressLine1: rawAddr.address_line1 || rawAddr.line1 || rawAddr.street || undefined,
      addressLine2: rawAddr.address_line2 || rawAddr.line2 || undefined,
      city: rawAddr.city || undefined,
      region: rawAddr.region || rawAddr.state || undefined,
      postalCode: rawAddr.postal_code || rawAddr.zip || undefined,
      country: rawAddr.country || undefined,
    };
  }

  let prizeType: "physical" | "email" | "both" | "none" = shippingAddress && winnerEmail ? "both" : shippingAddress ? "physical" : winnerEmail ? "email" : "physical";

  let specialInstructions =
    raw.comment ||
    raw.donor_comment ||
    auctionObj.delivery_notes ||
    auctionObj.notes ||
    undefined;

  if (specialInstructions && typeof specialInstructions === "string") {
    specialInstructions = specialInstructions.trim();
    if (
      specialInstructions.includes("Priority charity shipping parcel") ||
      specialInstructions.includes("Standard ground delivery") ||
      specialInstructions.includes("Signature upon delivery requested")
    ) {
      specialInstructions = undefined;
    }
  }

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

async function executeTiltifyPoll(): Promise<{ count: number; message: string }> {
  state.botStatus.lastPollTimestamp = new Date().toISOString();

  if (!state.tiltify.campaignId) {
    state.botStatus.lastPollStatus = "idle";
    state.botStatus.lastPollMessage = "Skipped poll: No Campaign ID configured.";
    return { count: 0, message: state.botStatus.lastPollMessage };
  }

  try {
    const campaignId = state.tiltify.campaignId.trim();
    const url = `https://v5api.tiltify.com/api/public/campaigns/${campaignId}/donations?limit=100`;

    await refreshCampaignRewards(campaignId);

    const headers = await getTiltifyAuthHeaders();
    let res = await fetch(url, { headers });

    if (!res.ok) {
      state.botStatus.lastPollStatus = "error";
      state.botStatus.lastPollMessage = `Tiltify API HTTP ${res.status}`;
      return { count: 0, message: state.botStatus.lastPollMessage };
    }

    const payload = await res.json();
    const rawDonations: any[] = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];

    let newCount = 0;
    let campaignSummary = await fetchLiveCampaignSummary(campaignId, true);
    const isInitialHistorySync = state.seenDonationIds.size === 0 && state.donations.filter((d) => d.campaignId === campaignId).length === 0;

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
          comment: raw.comment || raw.message || raw.donor_comment || undefined,
          reward: reward,
          campaignName: state.tiltify.campaignName?.trim() || campaignSummary?.campaignName || "Tiltify Campaign",
          campaignId: campaignId,
          totalRaised: campaignSummary?.totalRaised,
          targetGoal: campaignSummary?.targetGoal,
          receivedAt: raw.completed_at || raw.created_at || new Date().toISOString(),
          source: "poll",
          discordStatus: isInitialHistorySync ? "sent" : "pending",
          rawPayload: raw,
        };

        if (!isInitialHistorySync) {
          const dispatchResult = await dispatchDiscordAlert(newDonation, state.discord);
          newDonation.discordStatus = dispatchResult.success ? "sent" : "failed";
          newCount++;
        }

        state.donations.unshift(newDonation);
      }
    }

    if (campaignSummary?.totalRaised) {
      state.botStatus.totalAmountProcessed = campaignSummary.totalRaised;
    } else {
      state.botStatus.totalAmountProcessed = state.donations.reduce((sum, d) => sum + (d.amount || 0), 0);
    }
    state.botStatus.totalDonationsProcessed = state.donations.length;

    saveDonationsToDisk();

    state.botStatus.lastPollStatus = "success";
    state.botStatus.lastPollMessage = `Poll successful. ${newCount} new donation(s) detected.`;
    return { count: newCount, message: state.botStatus.lastPollMessage };
  } catch (err: any) {
    state.botStatus.lastPollStatus = "error";
    state.botStatus.lastPollMessage = `Polling error: ${err.message}`;
    return { count: 0, message: state.botStatus.lastPollMessage };
  }
}

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

// ---------------------------------------------------------------------
// Admin Authentication Routes
// ---------------------------------------------------------------------
function isAuthorized(req: Request): boolean {
  if (!state.adminPassword) return true;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ") && state.activeSessions.has(authHeader.slice(7).trim())) {
    return true;
  }
  return String(req.headers["x-admin-password"] || "").trim() === state.adminPassword;
}

function requireAuth(req: Request, res: Response, next: any) {
  if (isAuthorized(req)) return next();
  return res.status(401).json({ error: "Unauthorized", requiresPassword: true });
}

app.get("/api/auth/status", (req: Request, res: Response) => {
  res.json({ hasPassword: Boolean(state.adminPassword), authenticated: isAuthorized(req) });
});

app.post("/api/auth/login", (req: Request, res: Response) => {
  const { password } = req.body;
  if (!state.adminPassword || String(password).trim() === state.adminPassword) {
    const token = crypto.randomBytes(32).toString("hex");
    state.activeSessions.add(token);
    return res.json({ success: true, token });
  }
  return res.status(401).json({ success: false, error: "Incorrect passcode" });
});

// ---------------------------------------------------------------------
// ALL API ROUTES PRESERVED IN FULL
// ---------------------------------------------------------------------

app.get("/api/config", requireAuth, (_req: Request, res: Response) => {
  state.botStatus.discordConfigured = Boolean(state.discord.webhookUrl || (state.discord.botToken && state.discord.channelId));
  state.botStatus.tiltifyConfigured = Boolean(state.tiltify.campaignId || state.tiltify.apiToken);
  res.json({ discord: state.discord, tiltify: state.tiltify, status: state.botStatus });
});

app.get("/health", (_req: Request, res: Response) => res.status(200).send("OK"));
app.head("/", (_req: Request, res: Response) => res.status(200).end());

app.get("/api/status", (_req: Request, res: Response) => {
  res.json({ status: state.botStatus });
});

app.post("/api/config", requireAuth, (req: Request, res: Response) => {
  const { discord, tiltify } = req.body;
  if (discord) state.discord = { ...state.discord, ...discord };
  if (tiltify) {
    const prevPolling = state.tiltify.pollingEnabled;
    state.tiltify = { ...state.tiltify, ...tiltify };
    if (prevPolling !== state.tiltify.pollingEnabled) restartPollingTimer();
  }
  saveConfigToDisk();
  res.json({ success: true, discord: state.discord, tiltify: state.tiltify, status: state.botStatus });
});

// Custom Avatar
app.post("/api/discord/avatar", requireAuth, (req: Request, res: Response) => {
  try {
    const { image, fileName } = req.body;
    if (!image) return res.status(400).json({ success: false, error: "No image" });
    const buffer = Buffer.from(image.replace(/^data:image\/\w+;base64,/, ""), "base64");
    state.customAvatar = { buffer, contentType: "image/png", fileName: fileName || "icon.png", updatedAt: new Date().toISOString() };
    state.discord.botAvatarUrl = `${state.publicBaseUrl}/api/discord/avatar?t=${Date.now()}`;
    saveConfigToDisk();
    res.json({ success: true, avatarUrl: state.discord.botAvatarUrl });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/discord/avatar", (_req: Request, res: Response) => {
  if (state.customAvatar?.buffer) {
    res.set("Content-Type", state.customAvatar.contentType);
    return res.send(state.customAvatar.buffer);
  }
  res.redirect("https://site-assets.tiltify.com/frontend-users/favicon.ico");
});

app.get("/api/discord/tiltify-icon", (_req: Request, res: Response) => {
  res.redirect("https://site-assets.tiltify.com/frontend-users/favicon.ico");
});

// Tiltify Token & Campaign Lookup
app.post("/api/tiltify/token", requireAuth, async (req: Request, res: Response) => {
  const { clientId, clientSecret } = req.body;
  const result = await requestTiltifyAccessToken(clientId, clientSecret);
  if (result.success && result.accessToken) {
    state.tiltify.apiToken = result.accessToken;
    saveConfigToDisk();
    return res.json({ success: true, apiToken: result.accessToken });
  }
  res.status(400).json({ success: false, error: result.error });
});

app.post("/api/tiltify/fetch-campaign", requireAuth, async (req: Request, res: Response) => {
  const { campaignId } = req.body;
  const summary = await fetchLiveCampaignSummary(campaignId, true);
  if (summary) {
    return res.json({ success: true, campaign: summary });
  }
  res.status(404).json({ success: false, error: "Campaign not found" });
});

// Discord Test
app.post("/api/discord/test", requireAuth, async (req: Request, res: Response) => {
  const isAuction = req.body.eventType === "auction_ended" || Boolean(req.body.auction);
  const testDonation: DonationRecord = {
    id: `test-${Date.now()}`,
    donorName: req.body.donorName || "Test Donor",
    donorEmail: req.body.donorEmail || undefined,
    amount: typeof req.body.amount === "number" ? req.body.amount : 25.0,
    currency: "USD",
    comment: req.body.comment || "Test donation message!",
    campaignName: state.tiltify.campaignName || "Charity Campaign",
    eventType: isAuction ? "auction_ended" : undefined,
    auction: req.body.auction,
    receivedAt: new Date().toISOString(),
    source: "simulator",
    discordStatus: "pending",
  };

  const result = await dispatchDiscordAlert(testDonation, state.discord);
  testDonation.discordStatus = result.success ? "sent" : "failed";
  state.donations.unshift(testDonation);
  saveDonationsToDisk();
  res.json({ success: result.success, error: result.error });
});

// Tiltify Webhook
app.post("/api/tiltify/webhook", async (req: Request, res: Response) => {
  try {
    const payload = req.body;
    const raw = payload?.data || payload;
    const eventType = String(payload?.event || raw?.event || "").toLowerCase();

    const auctionInfo = extractAuctionWinnerInfo(raw, eventType);
    const isAuction = Boolean(auctionInfo);
    const donationId = String((isAuction ? auctionInfo?.auctionId : null) || raw?.id || raw?.public_id || `webhook-${Date.now()}`);

    const seenSet = isAuction ? state.seenAuctionIds : state.seenDonationIds;
    if (seenSet.has(donationId)) {
      res.status(200).json({ status: "ignored", message: "Event already processed." });
      return;
    }
    seenSet.add(donationId);

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
        campaignName: state.tiltify.campaignName?.trim() || raw?.campaign?.name || "Tiltify Campaign",
        receivedAt: auctionInfo.endedAt || new Date().toISOString(),
        source: "webhook",
        discordStatus: "pending",
        rawPayload: payload,
      };
    } else {
      let amount = 0;
      if (typeof raw?.amount === "object" && raw?.amount !== null) {
        amount = parseFloat(raw.amount.value || raw.amount.amount || "0");
      } else if (typeof raw?.amount === "number") {
        amount = raw.amount;
      }
      const { donorEmail, reward } = extractRewardAndDelivery(raw, state.campaignRewardsCache);
      donation = {
        id: donationId,
        tiltifyId: donationId,
        donorName: raw?.donor_name || raw?.name || "Anonymous Donor",
        donorEmail: donorEmail,
        amount: isNaN(amount) ? 0 : amount,
        currency: raw?.currency || "USD",
        comment: raw?.comment || raw?.message || undefined,
        reward: reward,
        campaignName: state.tiltify.campaignName?.trim() || raw?.campaign?.name || "Tiltify Campaign",
        receivedAt: raw?.created_at || new Date().toISOString(),
        source: "webhook",
        discordStatus: "pending",
        rawPayload: payload,
      };
    }

    const dispatchResult = await dispatchDiscordAlert(donation, state.discord);
    donation.discordStatus = dispatchResult.success ? "sent" : "failed";

    state.donations.unshift(donation);
    state.botStatus.totalDonationsProcessed += 1;
    state.botStatus.totalAmountProcessed += donation.amount;
    saveDonationsToDisk();

    res.status(200).json({ status: "received", donationId, discordSent: dispatchResult.success });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to process webhook", details: err?.message });
  }
});

// Prizes & Manifest
app.get("/api/prizes", (_req: Request, res: Response) => {
  const prizeItems = state.donations
    .filter((d) => Boolean(d.auction) || d.eventType === "auction_ended" || Boolean(d.reward))
    .map((d) => ({
      id: d.id,
      donationId: d.id,
      tiltifyId: d.tiltifyId,
      type: Boolean(d.auction) ? "auction" : "reward",
      title: d.auction?.itemTitle || d.reward?.name || "Charity Prize",
      winnerName: d.auction?.winnerName || d.donorName,
      winnerEmail: d.auction?.winnerEmail || d.reward?.donorEmail || d.donorEmail,
      amount: d.amount,
      currency: d.currency || "USD",
      prizeType: d.auction?.prizeType || "physical",
      shippingAddress: d.auction?.shippingAddress || d.reward?.shippingAddress,
      specialInstructions: d.auction?.specialInstructions,
      shippingStatus: d.auction?.shippingStatus || "pending",
      discordStatus: d.discordStatus,
      receivedAt: d.receivedAt,
    }));

  res.json({ prizes: prizeItems, totalPrizes: prizeItems.length });
});

app.get("/api/prizes/manifest.csv", (_req: Request, res: Response) => {
  const headers = "Prize ID,Type,Prize Title,Winner,Email,Amount,Status\n";
  const rows = state.donations
    .filter((d) => Boolean(d.auction) || Boolean(d.reward))
    .map((d) => `"${d.id}","${d.auction ? "Auction" : "Reward"}","${d.auction?.itemTitle || d.reward?.name}","${d.donorName}","${d.donorEmail || ""}","${d.amount}","${d.discordStatus}"`)
    .join("\n");
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="manifest.csv"');
  res.send(headers + rows);
});

app.put("/api/donations/:id/fulfillment", requireAuth, (req: Request, res: Response) => {
  const donation = state.donations.find((d) => d.id === req.params.id);
  if (!donation) return res.status(404).json({ error: "Not found" });
  if (donation.auction && req.body.itemTitle) donation.auction.itemTitle = req.body.itemTitle;
  if (donation.auction && req.body.shippingStatus) donation.auction.shippingStatus = req.body.shippingStatus;
  saveDonationsToDisk();
  res.json({ success: true, donation });
});

// Historical Auction Pull
app.post("/api/tiltify/pull-auctions", requireAuth, async (req: Request, res: Response) => {
  const targetId = (req.body.campaignId || state.tiltify.campaignId || "").trim();
  const { auctions, errors } = await fetchAllCampaignAuctions(targetId);
  res.json({ success: true, totalPulled: auctions.length, errors });
});

// Donations CRUD
app.get("/api/donations", (_req: Request, res: Response) => {
  res.json({
    donations: state.donations.slice(0, 100),
    totalCount: state.donations.length,
    totalAmount: state.botStatus.totalAmountProcessed,
  });
});

app.delete("/api/donations", requireAuth, (_req: Request, res: Response) => {
  state.donations = [];
  state.seenDonationIds.clear();
  state.seenAuctionIds.clear();
  saveDonationsToDisk();
  res.json({ success: true });
});

// Vite & Static Server
async function startServer() {
  app.all("/api/*", (_req: Request, res: Response) => {
    res.status(404).json({ error: "API endpoint not found" });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    app.use("*", async (req: Request, res: Response, next: any) => {
      if (req.originalUrl.startsWith("/api")) return next();
      try {
        const template = fs.readFileSync(path.resolve(process.cwd(), "index.html"), "utf-8");
        const transformed = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(transformed);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Tiltify Discord Bot running on http://0.0.0.0:${PORT}`);
    restartPollingTimer();
  });
}

startServer();
