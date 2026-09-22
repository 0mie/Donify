export interface RewardDeliveryAddress {
  recipientName?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  region?: string; // State / Province
  postalCode?: string;
  country?: string;
}

export interface ClaimedReward {
  id?: string;
  name: string;
  description?: string;
  amount?: number;
  currency?: string;
  quantity?: number;
  deliveryType?: 'shipping' | 'digital' | 'in_person' | 'other';
  donorEmail?: string;
  shippingAddress?: RewardDeliveryAddress;
  customOptions?: Record<string, string> | string;
}

export interface AuctionWinnerInfo {
  auctionId?: string;
  itemTitle: string;
  itemDescription?: string;
  winningBid: number;
  currency: string;
  winnerName: string;
  winnerEmail?: string;
  prizeType: 'physical' | 'email' | 'both' | 'none';
  shippingAddress?: RewardDeliveryAddress;
  specialInstructions?: string;
  endedAt?: string;
}

export interface DiscordConfig {
  mode: 'webhook' | 'bot';
  webhookUrl: string;
  botToken: string;
  channelId: string;
  botUsername: string;
  botAvatarUrl: string;
  customAvatarName?: string;
  embedColor: string;
  auctionEmbedColor?: string;
  mentionType: 'none' | 'here' | 'everyone' | 'role' | 'user';
  mentionRoleId: string;
  mentionUserId?: string;
  includeComment: boolean;
  includeCampaignDetails: boolean;
  customMessagePrefix: string;
  includeRewardDetails: boolean;
  includeDeliveryAddress: boolean;
  spoilerDeliveryInfo: boolean;
  enableAuctionAlerts: boolean;
  auctionMessagePrefix: string;
  onlyNotifyPrizeAuctions: boolean;
}

export interface TiltifyConfig {
  clientId?: string;
  clientSecret?: string;
  apiToken: string;
  tokenExpiresAt?: number | null;
  campaignId: string;
  pollIntervalSeconds: number;
  pollingEnabled: boolean;
  webhookSecret: string;
}

export interface DonationRecord {
  id: string;
  tiltifyId?: string;
  eventType?: 'donation' | 'auction_ended';
  donorName: string;
  donorEmail?: string;
  amount: number;
  currency: string;
  comment?: string;
  reward?: ClaimedReward;
  auction?: AuctionWinnerInfo;
  campaignName?: string;
  campaignId?: string;
  causeName?: string;
  targetGoal?: number;
  totalRaised?: number;
  receivedAt: string;
  source: 'webhook' | 'poll' | 'simulator';
  discordStatus: 'sent' | 'failed' | 'pending';
  discordError?: string;
  rawPayload?: Record<string, any>;
}

export interface BotStatus {
  isPolling: boolean;
  lastPollTimestamp: string | null;
  lastPollStatus: 'idle' | 'success' | 'error';
  lastPollMessage?: string;
  discordConfigured: boolean;
  tiltifyConfigured: boolean;
  totalDonationsProcessed: number;
  totalAuctionsProcessed: number;
  totalAmountProcessed: number;
  lastDonationTimestamp: string | null;
  serverUrl: string;
}

export interface ServerConfigResponse {
  discord: DiscordConfig;
  tiltify: TiltifyConfig;
  status: BotStatus;
}
