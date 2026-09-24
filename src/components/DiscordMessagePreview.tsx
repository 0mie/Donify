import React, { useState } from 'react';
import { DiscordConfig, ClaimedReward, AuctionWinnerInfo } from '../types';

interface DiscordMessagePreviewProps {
  config: DiscordConfig;
  sampleDonation?: {
    donorName: string;
    donorEmail?: string;
    amount: number;
    currency: string;
    comment: string;
    campaignName: string;
    reward?: ClaimedReward;
  };
}

export const DiscordMessagePreview: React.FC<DiscordMessagePreviewProps> = ({
  config,
  sampleDonation = {
    donorName: "Alex Rivera",
    donorEmail: "alex.rivera@example.com",
    amount: 50.0,
    currency: "USD",
    comment: "Keep up the amazing stream for this cause! Proud of this community! 🎉",
    campaignName: "Charity Gaming Marathon 2026",
    reward: {
      name: "Champion Signed Poster & T-Shirt",
      description: "Limited edition charity t-shirt with official stream signature.",
      quantity: 1,
      deliveryType: "shipping",
      donorEmail: "alex.rivera@example.com",
      shippingAddress: {
        recipientName: "Alex Rivera",
        addressLine1: "100 Maple Ave, Suite 3B",
        city: "Austin",
        region: "TX",
        postalCode: "78701",
        country: "United States",
      },
      customOptions: {
        "T-Shirt Size": "Adult L",
        "Notes": "Please leave package by front gate",
      },
    },
  },
}) => {
  const [previewMode, setPreviewMode] = useState<'donation' | 'auction'>('donation');
  const [spoilerRevealed, setSpoilerRevealed] = useState(false);

  // Sample Auction data for previewing auction alerts
  const sampleAuction: AuctionWinnerInfo = {
    auctionId: "auc-stream-jersey",
    itemTitle: "Signed Championship Esports Jersey (Framed)",
    itemDescription: "Authentic match-worn team jersey autographed by the full tournament roster.",
    winningBid: 250.0,
    currency: "USD",
    winnerName: "Jordan Hayes",
    winnerEmail: "jordan.hayes@example.com",
    prizeType: "both",
    shippingAddress: {
      recipientName: "Jordan Hayes",
      addressLine1: "742 Evergreen Terrace",
      addressLine2: "Apt 4G",
      city: "Springfield",
      region: "OR",
      postalCode: "97477",
      country: "United States",
    },
    specialInstructions: "Please include authentication certificate in the shipment box.",
    endedAt: new Date().toISOString(),
  };

  let mentionText = "";
  if (config.mentionType === "everyone") {
    mentionText = "@everyone";
  } else if (config.mentionType === "here") {
    mentionText = "@here";
  } else if (config.mentionType === "role" && config.mentionRoleId) {
    const clean = config.mentionRoleId.replace(/[<@&>]/g, "").trim();
    mentionText = `@Role(${clean || config.mentionRoleId})`;
  } else if (config.mentionType === "user" && config.mentionUserId) {
    const clean = config.mentionUserId.replace(/[<@!>]/g, "").trim();
    mentionText = `@User(${clean || config.mentionUserId})`;
  }

  const isAuction = previewMode === 'auction';

  const formattedAmount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: isAuction ? sampleAuction.currency : (sampleDonation.currency || "USD"),
  }).format(isAuction ? sampleAuction.winningBid : sampleDonation.amount);

  const reward = sampleDonation.reward;
  const embedColor = isAuction
    ? (config.auctionEmbedColor || "#F59E0B")
    : (config.embedColor || "#00d1b2");

  const messagePrefix = isAuction
    ? (config.auctionMessagePrefix || "🔨 **AUCTION ENDED!** An auction from the Tiltify Auction House has concluded.")
    : config.customMessagePrefix;

  // Template interpolator
  const interpolate = (tpl: string | undefined, fallback: string, vars: Record<string, string>) => {
    if (!tpl || !tpl.trim()) return fallback;
    return tpl.replace(/\{(\w+)\}/g, (_, key) => (vars[key] !== undefined ? vars[key] : `{${key}}`));
  };

  const donationTitle = interpolate(
    config.embedTitleTemplate,
    `🎉 New Donation: ${formattedAmount}!`,
    {
      amount: formattedAmount,
      donor: sampleDonation.donorName,
      campaign: sampleDonation.campaignName,
    }
  );

  const donationDesc = interpolate(
    config.embedDescriptionTemplate,
    `**${sampleDonation.donorName}** contributed to the campaign!`,
    {
      amount: formattedAmount,
      donor: sampleDonation.donorName,
      campaign: sampleDonation.campaignName,
    }
  );

  const auctionTitle = interpolate(
    config.auctionTitleTemplate,
    `🏆 AUCTION HOUSE: Auction Ended & Finalized!`,
    {
      amount: formattedAmount,
      winner: sampleAuction.winnerName,
      item: sampleAuction.itemTitle,
      campaign: sampleDonation.campaignName,
    }
  );

  const renderProgressBarText = (charStyle?: string) => {
    if (charStyle === "percentage") return "72.5% reached ($3,625 / $5,000)";
    if (charStyle === "line") return "`[━━━━━━━───]` 72.5%";
    if (charStyle === "stars") return "`[★★★★★★★☆☆☆]` 72.5%";
    return "`[▓▓▓▓▓▓▓░░░]` 72.5%";
  };

  return (
    <div className="bg-[#313338] text-[#dbdee1] rounded-xl p-4 font-sans text-sm border border-[#232428] shadow-inner select-none">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-[#949ba4] mb-3 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span>Discord Channel Preview</span>
          <span className="bg-[#232428] text-[#b5bac1] px-2 py-0.5 rounded text-[10px]">#donations</span>
        </div>

        {/* Preview Selector: Donation vs Auction */}
        <div className="flex items-center bg-[#1e1f22] p-0.5 rounded-lg border border-[#2b2d31] text-[11px]">
          <button
            type="button"
            onClick={() => setPreviewMode('donation')}
            className={`px-2.5 py-1 rounded-md font-medium transition-all ${
              previewMode === 'donation'
                ? 'bg-[#35373c] text-white shadow-sm'
                : 'text-[#949ba4] hover:text-[#dbdee1]'
            }`}
          >
            Donation Alert
          </button>
          <button
            type="button"
            onClick={() => setPreviewMode('auction')}
            className={`px-2.5 py-1 rounded-md font-medium transition-all ${
              previewMode === 'auction'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-[#949ba4] hover:text-[#dbdee1]'
            }`}
          >
            🔨 Auction Ended Alert
          </button>
        </div>
      </div>

      <div className="flex items-start gap-3">
        {/* Bot Avatar */}
        <div className="relative shrink-0">
          <img
            src={config.botAvatarUrl || "https://tiltify.com/favicon.ico"}
            alt="Bot Avatar"
            className="w-10 h-10 rounded-full object-cover bg-[#232428]"
            onError={(e) => {
              (e.target as HTMLImageElement).src = "https://tiltify.com/favicon.ico";
            }}
          />
        </div>

        {/* Message Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 leading-none mb-1.5 flex-wrap">
            <span className="font-semibold text-white text-[15px] hover:underline cursor-pointer">
              {config.botUsername || "Tiltify Donation Bot"}
            </span>
            <span className="bg-[#5865F2] text-white text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide">
              BOT
            </span>
            <span className="text-[11px] text-[#949ba4] ml-1">Today at 12:00 PM</span>
          </div>

          {/* Mention & Message Prefix */}
          {(mentionText || messagePrefix) && (
            <div className="mb-2 text-[#dbdee1] text-[14px]">
              {mentionText && (
                <span className="bg-[#5865F2]/20 text-[#c9cdfb] px-1 py-0.5 rounded font-medium mr-1.5">
                  {mentionText}
                </span>
              )}
              <span>{messagePrefix}</span>
            </div>
          )}

          {/* Discord Embed */}
          <div
            className="rounded-r-lg bg-[#2b2d31] p-3.5 max-w-lg border-l-4 shadow relative"
            style={{ borderLeftColor: embedColor }}
          >
            {/* Optional Embed Thumbnail in upper right */}
            {config.embedThumbnailUrl?.trim() && (
              <div className="absolute top-3.5 right-3.5 w-16 h-16 rounded overflow-hidden bg-[#1e1f22] border border-neutral-700/50 shrink-0">
                <img
                  src={config.embedThumbnailUrl.trim()}
                  alt="Embed Thumbnail"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
            )}

            {isAuction ? (
              /* Auction Ended Embed */
              <div className={config.embedThumbnailUrl?.trim() ? "pr-20" : ""}>
                <div className="font-bold text-amber-400 text-[15px] mb-1 flex items-center gap-1.5">
                  {auctionTitle}
                </div>
                <div className="text-[13px] text-[#dbdee1] mb-3">
                  Winning bid of <strong className="text-white">{formattedAmount}</strong> by{' '}
                  <span className="font-semibold text-white">{sampleAuction.winnerName}</span>
                </div>

                {/* Embed Fields Grid */}
                <div className="grid grid-cols-2 gap-2 text-[13px] mb-3">
                  <div className="bg-[#232428]/50 p-2 rounded">
                    <div className="text-[#949ba4] text-[11px] font-bold uppercase tracking-wider mb-0.5">🏆 Winner</div>
                    <div className="text-white font-medium">{sampleAuction.winnerName}</div>
                  </div>
                  <div className="bg-[#232428]/50 p-2 rounded">
                    <div className="text-[#949ba4] text-[11px] font-bold uppercase tracking-wider mb-0.5">💰 Winning Bid</div>
                    <div className="text-amber-400 font-bold">{formattedAmount}</div>
                  </div>
                </div>

                {/* Item Details */}
                <div className="mb-3 bg-[#232428]/80 border border-amber-500/30 p-2.5 rounded-lg text-[13px]">
                  <div className="text-amber-400 text-[11px] font-bold uppercase tracking-wider mb-0.5">
                    📦 Auction Item
                  </div>
                  <div className="font-semibold text-white">{sampleAuction.itemTitle}</div>
                  {sampleAuction.itemDescription && (
                    <div className="text-xs text-[#949ba4] mt-0.5 italic">{sampleAuction.itemDescription}</div>
                  )}
                </div>

                {/* Fulfillment Details for physical / email prize */}
                <div className="mb-3 bg-[#232428]/90 border border-indigo-500/40 p-2.5 rounded-lg text-[12px]">
                  <div className="text-indigo-400 text-[11px] font-bold uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span>
                      {sampleAuction.prizeType === 'email'
                        ? '📧 Digital Prize Delivery'
                        : sampleAuction.prizeType === 'physical'
                        ? '📦 Physical Prize Shipping'
                        : '🚚 Winner Fulfillment Information'}
                    </span>
                    <span className="text-[10px] bg-indigo-950/90 text-indigo-300 px-1.5 py-0.5 rounded font-mono">
                      {sampleAuction.prizeType === 'email'
                        ? 'Digital Delivery'
                        : sampleAuction.prizeType === 'physical'
                        ? 'Physical Shipping'
                        : 'Physical + Digital'}
                    </span>
                  </div>

                  <div className="space-y-2 text-[#dbdee1]">
                    {sampleAuction.prizeType === 'email' ? (
                      /* Pure Digital Delivery Block */
                      <div className="bg-[#1e1f22] p-2.5 rounded-lg space-y-1.5 border border-teal-500/20">
                        <div>
                          <span className="text-[#949ba4]">Winner: </span>
                          <span className="text-white font-semibold">{sampleAuction.winnerName}</span>
                        </div>
                        <div>
                          <span className="text-[#949ba4]">Send To Email: </span>
                          <span className="font-bold text-teal-300 font-mono text-xs bg-teal-950/80 px-2 py-0.5 rounded border border-teal-800/60 ml-1">
                            {sampleAuction.winnerEmail || 'Not provided'}
                          </span>
                        </div>
                      </div>
                    ) : (
                      /* Physical or Both */
                      <>
                        <div className="bg-[#1e1f22] p-2 rounded">
                          <div className="text-[11px] text-[#949ba4] font-semibold mb-0.5">Winner Contact:</div>
                          <div className="text-white font-medium">{sampleAuction.winnerName}</div>
                          {sampleAuction.winnerEmail && (
                            <div className="text-indigo-300 font-mono text-[11px] mt-0.5">
                              📧 {sampleAuction.winnerEmail}
                            </div>
                          )}
                        </div>

                        {/* Physical Prize Shipping Address */}
                        {sampleAuction.shippingAddress && (
                          <div>
                            <div className="text-[11px] text-[#949ba4] mb-1 font-semibold flex items-center justify-between">
                              <span>📦 Physical Prize Shipping Address:</span>
                              {config.spoilerDeliveryInfo && (
                                <span className="text-[10px] text-amber-400/80">Spoiler protected</span>
                              )}
                            </div>

                            {config.spoilerDeliveryInfo ? (
                              <div
                                onClick={() => setSpoilerRevealed(!spoilerRevealed)}
                                className={`cursor-pointer px-2 py-1.5 rounded text-xs transition-colors font-mono ${
                                  spoilerRevealed
                                    ? 'bg-[#1e1f22] text-[#dbdee1] border border-neutral-700'
                                    : 'bg-[#1e1f22] text-[#1e1f22] hover:text-[#4e5058] select-none border border-neutral-800'
                                }`}
                                title={spoilerRevealed ? 'Click to hide' : 'Click to reveal spoiler'}
                              >
                                {spoilerRevealed ? (
                                  <div>
                                    <div>{sampleAuction.shippingAddress.recipientName}</div>
                                    <div>{sampleAuction.shippingAddress.addressLine1}</div>
                                    {sampleAuction.shippingAddress.addressLine2 && (
                                      <div>{sampleAuction.shippingAddress.addressLine2}</div>
                                    )}
                                    <div>
                                      {sampleAuction.shippingAddress.city}, {sampleAuction.shippingAddress.region}{' '}
                                      {sampleAuction.shippingAddress.postalCode}
                                    </div>
                                    <div>{sampleAuction.shippingAddress.country}</div>
                                  </div>
                                ) : (
                                  '██████████████████████████████████ (Click to reveal shipping address)'
                                )}
                              </div>
                            ) : (
                              <div className="bg-[#1e1f22] p-2 rounded font-mono text-[11px] text-neutral-300">
                                <div>{sampleAuction.shippingAddress.recipientName}</div>
                                <div>{sampleAuction.shippingAddress.addressLine1}</div>
                                {sampleAuction.shippingAddress.addressLine2 && (
                                  <div>{sampleAuction.shippingAddress.addressLine2}</div>
                                )}
                                <div>
                                  {sampleAuction.shippingAddress.city}, {sampleAuction.shippingAddress.region}{' '}
                                  {sampleAuction.shippingAddress.postalCode}
                                </div>
                                <div>{sampleAuction.shippingAddress.country}</div>
                              </div>
                            )}
                          </div>
                        )}

                        {sampleAuction.prizeType === 'both' && sampleAuction.winnerEmail && (
                          <div className="bg-teal-950/40 border border-teal-800/40 p-2 rounded text-[11px] text-teal-200">
                            <strong>📧 Digital Redemption Pass:</strong> Send digital voucher or keys to{' '}
                            <span className="font-bold text-teal-300 underline font-mono">{sampleAuction.winnerEmail}</span>
                          </div>
                        )}
                      </>
                    )}

                    {sampleAuction.specialInstructions && (
                      <div className="text-[11px] bg-[#1e1f22] p-1.5 rounded text-[#b5bac1] italic">
                        <span className="text-[#949ba4] font-semibold not-italic">Notes:</span> "{sampleAuction.specialInstructions}"
                      </div>
                    )}

                    {config.includeCampaignDetails && sampleDonation.campaignName && (
                      <div className="text-[12px] bg-[#1e1f22] p-2 rounded text-[#b5bac1]">
                        <span className="text-[#949ba4] font-semibold">Campaign:</span> {sampleDonation.campaignName}
                      </div>
                    )}

                    {config.includeCampaignProgress !== false && (
                      <div className="text-[12px] bg-[#1e1f22] p-2 rounded text-[#b5bac1] border border-amber-500/20">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-amber-400 uppercase tracking-wider mb-1">
                          <span>🏆 Campaign Progress</span>
                          <span>72.5%</span>
                        </div>
                        <div className="flex items-center justify-between text-xs mb-1 font-medium">
                          <span className="text-white">$3,625.00 raised</span>
                          <span className="text-[#949ba4]">Goal: $5,000.00</span>
                        </div>
                        <div className="text-[11px] font-mono text-emerald-400">
                          `[▓▓▓▓▓▓▓░░░]` 72.5%
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* Standard Donation Embed */
              <div className={config.embedThumbnailUrl?.trim() ? "pr-20" : ""}>
                <div className="font-bold text-white text-[15px] mb-1 flex items-center gap-1.5">
                  {donationTitle}
                </div>
                <div className="text-[13px] text-[#dbdee1] mb-3">
                  {donationDesc}
                </div>

                {/* Embed Fields Grid */}
                <div className="grid grid-cols-2 gap-2 text-[13px] mb-3">
                  <div className="bg-[#232428]/50 p-2 rounded">
                    <div className="text-[#949ba4] text-[11px] font-bold uppercase tracking-wider mb-0.5">👤 Donor</div>
                    <div className="text-white font-medium">{sampleDonation.donorName}</div>
                  </div>
                  <div className="bg-[#232428]/50 p-2 rounded">
                    <div className="text-[#949ba4] text-[11px] font-bold uppercase tracking-wider mb-0.5">💰 Amount</div>
                    <div className="text-[#23a55a] font-bold">{formattedAmount}</div>
                  </div>
                </div>

                {/* Comment Block */}
                {config.includeComment && sampleDonation.comment && (
                  <div className="mb-3 text-[13px]">
                    <div className="text-[#949ba4] text-[11px] font-bold uppercase tracking-wider mb-1">💬 Message</div>
                    <div className="border-l-2 border-[#4e5058] pl-2.5 text-[#b5bac1] italic">
                      "{sampleDonation.comment}"
                    </div>
                  </div>
                )}

                {/* Campaign Details */}
                {config.includeCampaignDetails && sampleDonation.campaignName && (
                  <div className="mb-3 text-[12px] bg-[#232428]/60 p-2 rounded text-[#b5bac1]">
                    <span className="text-[#949ba4] font-semibold">Campaign:</span> {sampleDonation.campaignName}
                  </div>
                )}

                {/* Campaign Progress & Total Raised */}
                {config.includeCampaignProgress !== false && config.embedLayout !== 'minimal' && (
                  <div className="mb-3 text-[12px] bg-[#232428]/80 border border-amber-500/30 p-2.5 rounded-lg text-[#b5bac1]">
                    <div className="text-amber-400 text-[11px] font-bold uppercase tracking-wider mb-1 flex items-center justify-between">
                      <span>🏆 Campaign Progress</span>
                      <span>72.5%</span>
                    </div>
                    <div className="flex items-center justify-between text-xs mb-1 font-medium">
                      <span className="text-white">$3,625.00 raised</span>
                      <span className="text-[#949ba4]">Goal: $5,000.00</span>
                    </div>
                    <div className="text-[11px] font-mono text-emerald-400">
                      {renderProgressBarText(config.progressBarCharStyle)}
                    </div>
                  </div>
                )}

                {/* Selected Reward Block */}
                {config.includeRewardDetails !== false && reward && (
                  <div className="mb-3 bg-[#232428]/80 border border-teal-500/30 p-2.5 rounded-lg text-[13px]">
                    <div className="text-teal-400 text-[11px] font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                      <span>🎁 Selected Reward</span>
                      {reward.quantity && reward.quantity > 1 && (
                        <span className="bg-teal-950 text-teal-300 px-1 rounded text-[10px]">
                          {reward.quantity}x
                        </span>
                      )}
                    </div>
                    <div className="font-semibold text-white">{reward.name}</div>
                    {reward.description && (
                      <div className="text-xs text-[#949ba4] mt-0.5 italic">{reward.description}</div>
                    )}
                  </div>
                )}

                {/* Delivery & Fulfillment Details Block */}
                {config.includeDeliveryAddress !== false && reward && (
                  <div className="mb-3 bg-[#232428]/80 border border-indigo-500/30 p-2.5 rounded-lg text-[12px]">
                    <div className="text-indigo-400 text-[11px] font-bold uppercase tracking-wider mb-2 flex items-center justify-between">
                      <span>
                        {reward.deliveryType === 'digital'
                          ? '📧 Digital Reward Delivery'
                          : '📦 Physical Shipping Address'}
                      </span>
                      <span className="text-[10px] bg-indigo-950/80 text-indigo-300 px-1.5 py-0.5 rounded font-mono">
                        {reward.deliveryType === 'digital' ? 'Digital Delivery' : 'Physical Shipping'}
                      </span>
                    </div>

                    <div className="space-y-2 text-[#dbdee1]">
                      {reward.deliveryType === 'digital' ? (
                        /* Pure digital delivery */
                        <div className="bg-[#1e1f22] p-2.5 rounded-lg space-y-1.5 border border-teal-500/20">
                          <div>
                            <span className="text-[#949ba4]">Recipient: </span>
                            <span className="font-semibold text-white">
                              {reward.shippingAddress?.recipientName || sampleDonation.donorName}
                            </span>
                          </div>
                          <div>
                            <span className="text-[#949ba4]">Send To Email: </span>
                            <span className="font-bold text-teal-300 font-mono text-xs bg-teal-950/80 px-2 py-0.5 rounded border border-teal-800/60 ml-1">
                              {reward.donorEmail || sampleDonation.donorEmail || 'Not provided'}
                            </span>
                          </div>
                        </div>
                      ) : (
                        /* Physical shipping */
                        <>
                          <div className="bg-[#1e1f22] p-2 rounded">
                            <span className="text-[#949ba4]">Recipient: </span>
                            <span className="font-medium text-white">
                              {reward.shippingAddress?.recipientName || sampleDonation.donorName}
                            </span>
                            {(reward.donorEmail || sampleDonation.donorEmail) && (
                              <span className="text-[#949ba4] font-mono text-[11px] ml-1.5">
                                • Contact: {reward.donorEmail || sampleDonation.donorEmail}
                              </span>
                            )}
                          </div>

                          {reward.shippingAddress && (
                            <div className="pt-0.5">
                              <div className="text-[11px] text-[#949ba4] mb-1 font-semibold flex items-center justify-between">
                                <span>Shipping Address:</span>
                                {config.spoilerDeliveryInfo && (
                                  <span className="text-[10px] text-amber-400/80">Spoiler protected</span>
                                )}
                              </div>

                              {config.spoilerDeliveryInfo ? (
                                <div
                                  onClick={() => setSpoilerRevealed(!spoilerRevealed)}
                                  className={`cursor-pointer px-2 py-1 rounded text-xs transition-colors ${
                                    spoilerRevealed
                                      ? 'bg-[#1e1f22] text-[#dbdee1] border border-neutral-700'
                                      : 'bg-[#1e1f22] text-[#1e1f22] hover:text-[#4e5058] select-none border border-neutral-800'
                                  }`}
                                  title={spoilerRevealed ? 'Click to hide' : 'Click to reveal spoiler'}
                                >
                                  {spoilerRevealed
                                    ? `${reward.shippingAddress.addressLine1}, ${reward.shippingAddress.city}, ${reward.shippingAddress.region} ${reward.shippingAddress.postalCode}, ${reward.shippingAddress.country}`
                                    : '██████████████████████████████ (Click to reveal)'}
                                </div>
                              ) : (
                                <div className="bg-[#1e1f22] p-1.5 rounded font-mono text-[11px] text-neutral-300">
                                  <div>{reward.shippingAddress.addressLine1}</div>
                                  <div>
                                    {reward.shippingAddress.city}, {reward.shippingAddress.region}{' '}
                                    {reward.shippingAddress.postalCode}
                                  </div>
                                  <div>{reward.shippingAddress.country}</div>
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}

                      {reward.customOptions && typeof reward.customOptions === 'object' && (
                        <div className="pt-1 text-[11px] border-t border-[#35373c] mt-1.5">
                          <div className="text-[#949ba4] font-semibold mb-0.5">Reward Options / Answers:</div>
                          {Object.entries(reward.customOptions).map(([k, v]) => (
                            <div key={k} className="text-neutral-300">
                              • <span className="text-neutral-400">{k}:</span> <span className="text-white font-medium">{v}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Optional Banner Image */}
            {config.embedBannerUrl?.trim() && (
              <div className="mt-3 rounded-lg overflow-hidden border border-neutral-700/40 bg-[#1e1f22]">
                <img
                  src={config.embedBannerUrl.trim()}
                  alt="Embed Banner"
                  className="w-full max-h-52 object-cover"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center gap-1.5 text-[11px] text-[#949ba4] mt-2 pt-2 border-t border-[#35373c]">
              <img
                src={config.footerIconUrl || "/tiltify-icon.jpg"}
                alt=""
                className="w-3.5 h-3.5 rounded-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "/tiltify-icon.jpg";
                }}
              />
              <span>
                {isAuction
                  ? (config.auctionFooterText?.trim() || 'Tiltify Auction House • Winner Fulfillment')
                  : (config.footerText?.trim() || 'Tiltify Donation Alerts')}
                {config.showEmbedTimestamp !== false && ' • Today at 12:00 PM'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
