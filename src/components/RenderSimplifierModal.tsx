import React, { useState } from 'react';
import { DiscordConfig, TiltifyConfig } from '../types';
import {
  X,
  Copy,
  Check,
  Zap,
  HelpCircle,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  Sliders,
  FileCode,
  Layers,
  Radio,
  Lock,
  MessageSquare,
  Sparkles,
  Gavel,
  ArrowRight,
  Info,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface RenderSimplifierModalProps {
  isOpen: boolean;
  onClose: () => void;
  discordConfig: DiscordConfig;
  tiltifyConfig: TiltifyConfig;
}

export const RenderSimplifierModal: React.FC<RenderSimplifierModalProps> = ({
  isOpen,
  onClose,
  discordConfig,
  tiltifyConfig,
}) => {
  // View mode: 'step_cards' vs 'bulk_env' vs 'secret_file' (Render Secret Files)
  const [viewMode, setViewMode] = useState<'step_cards' | 'bulk_env' | 'secret_file'>('step_cards');

  // Feature Toggles (Stupid-proof selectors)
  const [useSeparateAuctionChannel, setUseSeparateAuctionChannel] = useState<boolean>(() => {
    return Boolean(discordConfig.separateAuctionChannel || discordConfig.auctionWebhookUrl);
  });
  const [useTiltifyPoller, setUseTiltifyPoller] = useState<boolean>(() => {
    return Boolean(tiltifyConfig.clientId && tiltifyConfig.clientSecret);
  });
  const [useAdminPassword, setUseAdminPassword] = useState<boolean>(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState<string>('MySecurePassword123');
  const [useBranding, setUseBranding] = useState<boolean>(() => {
    return Boolean(discordConfig.footerText || discordConfig.auctionFooterText || discordConfig.showEmbedTimestamp !== undefined);
  });
  const [useBotIdentity, setUseBotIdentity] = useState<boolean>(() => {
    return Boolean(
      (discordConfig.botUsername && discordConfig.botUsername !== 'Tiltify Donation Bot') ||
      (discordConfig.botAvatarUrl && discordConfig.botAvatarUrl !== 'https://tiltify.com/favicon.ico')
    );
  });
  const [dualPostAuctions, setDualPostAuctions] = useState<boolean>(() => {
    return Boolean(discordConfig.dualPostAuctions);
  });

  // Local auction webhook input in case user hasn't set it in the main dashboard yet
  const [customAuctionWebhook, setCustomAuctionWebhook] = useState<string>(
    discordConfig.auctionWebhookUrl || ''
  );

  // Copy tracking state
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showAllInOneExplanation, setShowAllInOneExplanation] = useState(false);

  if (!isOpen) return null;

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const primaryWebhook = discordConfig.webhookUrl || 'https://discord.com/api/webhooks/...';
  const campaignSlug = tiltifyConfig.campaignId || 'your-campaign-slug';
  const effectiveAuctionWebhook = customAuctionWebhook || discordConfig.auctionWebhookUrl || 'https://discord.com/api/webhooks/staff-auctions/...';

  // Build the list of active variables based on user toggles
  interface VariableItem {
    id: string;
    key: string;
    value: string;
    title: string;
    feature: string;
    description: string;
    isSecret?: boolean;
    required: boolean;
    badgeColor: string;
  }

  const activeVariables: VariableItem[] = [
    // 1. Primary Discord Webhook (Always required)
    {
      id: 'DISCORD_WEBHOOK_URL',
      key: 'DISCORD_WEBHOOK_URL',
      value: primaryWebhook,
      title: 'Main Discord Channel Webhook',
      feature: 'Donation Alerts',
      description: 'The Discord channel where public donation alerts will be posted.',
      required: true,
      badgeColor: 'emerald',
    },
    // 2. Tiltify Campaign Slug (Always required)
    {
      id: 'TILTIFY_CAMPAIGN_ID',
      key: 'TILTIFY_CAMPAIGN_ID',
      value: campaignSlug,
      title: 'Tiltify Campaign Slug or ID',
      feature: 'Campaign Connection',
      description: 'Your Tiltify campaign slug or ID (e.g. marathon-2026 or 12345).',
      required: true,
      badgeColor: 'emerald',
    },
  ];

  // Optional: Campaign Display Name
  if (tiltifyConfig.campaignName || discordConfig.campaignName) {
    activeVariables.push({
      id: 'TILTIFY_CAMPAIGN_NAME',
      key: 'TILTIFY_CAMPAIGN_NAME',
      value: tiltifyConfig.campaignName || discordConfig.campaignName || '',
      title: 'Campaign Display Name',
      feature: 'Campaign Info',
      description: 'Human-friendly event title displayed in Discord embed headers.',
      required: false,
      badgeColor: 'indigo',
    });
  }

  // 3. Separate Auction Channel variables
  if (useSeparateAuctionChannel) {
    activeVariables.push({
      id: 'DISCORD_SEPARATE_AUCTION_CHANNEL',
      key: 'DISCORD_SEPARATE_AUCTION_CHANNEL',
      value: 'true',
      title: 'Enable Separate Auction Channel',
      feature: 'Staff / Auctions',
      description: 'Tells the bot to route ended auctions & prizes to a standalone channel.',
      required: true,
      badgeColor: 'amber',
    });

    activeVariables.push({
      id: 'DISCORD_AUCTION_WEBHOOK_URL',
      key: 'DISCORD_AUCTION_WEBHOOK_URL',
      value: effectiveAuctionWebhook,
      title: 'Dedicated Auction / Staff Channel Webhook',
      feature: 'Staff / Auctions',
      description: 'The private Discord webhook created specifically inside your #staff-auctions channel.',
      required: true,
      badgeColor: 'amber',
    });

    if (dualPostAuctions) {
      activeVariables.push({
        id: 'DISCORD_DUAL_POST_AUCTIONS',
        key: 'DISCORD_DUAL_POST_AUCTIONS',
        value: 'true',
        title: 'Dual Post Winner Announcements',
        feature: 'Staff / Auctions',
        description: 'Posts a safe public celebration in your main channel AND full shipping details in staff channel.',
        required: false,
        badgeColor: 'amber',
      });
    }

    if (discordConfig.auctionShippingPrivacy) {
      activeVariables.push({
        id: 'DISCORD_AUCTION_SHIPPING_PRIVACY',
        key: 'DISCORD_AUCTION_SHIPPING_PRIVACY',
        value: discordConfig.auctionShippingPrivacy,
        title: 'Auction Shipping Privacy Mode',
        feature: 'Staff / Auctions',
        description: 'public_safe (auto-hides address in public chat) or spoiler or full.',
        required: false,
        badgeColor: 'amber',
      });
    }
  }

  // 4. Poller variables
  if (useTiltifyPoller) {
    activeVariables.push({
      id: 'TILTIFY_CLIENT_ID',
      key: 'TILTIFY_CLIENT_ID',
      value: tiltifyConfig.clientId || 'your-tiltify-app-client-id',
      title: 'Tiltify API Client ID',
      feature: 'Automated Polling',
      description: 'From your Tiltify Developer Application. Used to poll the API every 30s.',
      required: true,
      badgeColor: 'teal',
    });

    activeVariables.push({
      id: 'TILTIFY_CLIENT_SECRET',
      key: 'TILTIFY_CLIENT_SECRET',
      value: tiltifyConfig.clientSecret || 'your-tiltify-app-client-secret',
      title: 'Tiltify API Client Secret',
      feature: 'Automated Polling',
      description: 'From your Tiltify Developer Application. Kept secret on your server.',
      isSecret: true,
      required: true,
      badgeColor: 'teal',
    });
  }

  // 5. Admin Password
  if (useAdminPassword) {
    activeVariables.push({
      id: 'ADMIN_PASSWORD',
      key: 'ADMIN_PASSWORD',
      value: adminPasswordInput || 'MySecurePassword123',
      title: 'Dashboard Security Passcode',
      feature: 'Access Security',
      description: 'Passcode required to open and modify this web dashboard.',
      isSecret: true,
      required: false,
      badgeColor: 'purple',
    });
  }

  // 6. Bot Identity
  if (useBotIdentity) {
    if (discordConfig.botUsername) {
      activeVariables.push({
        id: 'DISCORD_BOT_USERNAME',
        key: 'DISCORD_BOT_USERNAME',
        value: discordConfig.botUsername,
        title: 'Bot Username',
        feature: 'Bot Identity',
        description: 'The name displayed on Discord embeds sent by the bot.',
        required: false,
        badgeColor: 'teal',
      });
    }
    if (discordConfig.botAvatarUrl) {
      activeVariables.push({
        id: 'DISCORD_BOT_AVATAR_URL',
        key: 'DISCORD_BOT_AVATAR_URL',
        value: discordConfig.botAvatarUrl,
        title: 'Bot Avatar Icon URL',
        feature: 'Bot Identity',
        description: 'Direct image URL for the bot avatar on Discord.',
        required: false,
        badgeColor: 'teal',
      });
    }
  }

  // 7. Embed Branding & Timestamp
  if (useBranding) {
    activeVariables.push({
      id: 'DISCORD_FOOTER_TEXT',
      key: 'DISCORD_FOOTER_TEXT',
      value: discordConfig.footerText || 'Tiltify Donation Alerts',
      title: 'Embed Footer Text',
      feature: 'Branding',
      description: 'Custom text placed at the very bottom of Discord donation alerts.',
      required: false,
      badgeColor: 'indigo',
    });

    if (discordConfig.auctionFooterText) {
      activeVariables.push({
        id: 'DISCORD_AUCTION_FOOTER_TEXT',
        key: 'DISCORD_AUCTION_FOOTER_TEXT',
        value: discordConfig.auctionFooterText,
        title: 'Auction Footer Text',
        feature: 'Branding',
        description: 'Custom text at the bottom of auction win alerts.',
        required: false,
        badgeColor: 'amber',
      });
    }

    if (discordConfig.footerIconUrl) {
      activeVariables.push({
        id: 'DISCORD_FOOTER_ICON_URL',
        key: 'DISCORD_FOOTER_ICON_URL',
        value: discordConfig.footerIconUrl,
        title: 'Footer Icon URL',
        feature: 'Branding',
        description: 'Small icon URL displayed next to the footer text.',
        required: false,
        badgeColor: 'indigo',
      });
    }

    activeVariables.push({
      id: 'DISCORD_SHOW_EMBED_TIMESTAMP',
      key: 'DISCORD_SHOW_EMBED_TIMESTAMP',
      value: String(discordConfig.showEmbedTimestamp !== false),
      title: 'Show Embed Timestamp',
      feature: 'Branding',
      description: 'Whether to show the timestamp in Discord embed footers.',
      required: false,
      badgeColor: 'indigo',
    });
  }

  // Generate bulk .env text containing only active variables
  const generatedBulkEnv = [
    '# ========================================================',
    `# DONIFY CONFIG FOR RENDER (${activeVariables.length} VARIABLES SELECTED)`,
    '# Generated to match your exact feature preferences',
    '# ========================================================',
    ...activeVariables.map((v) => `${v.key}=${v.value}`),
  ].join('\n');

  // Single JSON configuration variable
  const singleConfigJson = JSON.stringify({
    discord: {
      ...discordConfig,
      separateAuctionChannel: useSeparateAuctionChannel,
      auctionWebhookUrl: useSeparateAuctionChannel ? effectiveAuctionWebhook : undefined,
      dualPostAuctions: useSeparateAuctionChannel ? dualPostAuctions : false,
    },
    tiltify: tiltifyConfig,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-3xl w-full max-h-[92vh] overflow-y-auto shadow-2xl p-5 sm:p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-neutral-400 hover:text-white p-1 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
            <Sliders className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white">Render Variables Wizard</h2>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                Stupid-Proof Setup
              </span>
            </div>
            <p className="text-xs text-neutral-400">
              Pick only the features you want — we'll generate the exact variables for you!
            </p>
          </div>
        </div>

        {/* Feature Selector: Plain English Toggles */}
        <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 mb-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>Step 1: Check what features you want to use</span>
            </span>
            <span className="text-[11px] text-teal-400 font-mono">
              {activeVariables.length} Render {activeVariables.length === 1 ? 'variable' : 'variables'} needed
            </span>
          </div>

          <div className="space-y-3 text-xs">
            {/* Feature 1: Core Donations (Always On) */}
            <div className="flex items-start justify-between p-3 rounded-xl bg-neutral-900/80 border border-neutral-800">
              <div className="flex items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={true}
                  disabled
                  className="mt-0.5 rounded bg-neutral-800 border-neutral-700 text-emerald-500 w-4 h-4 cursor-not-allowed"
                />
                <div>
                  <div className="font-semibold text-white flex items-center gap-2">
                    <span>🌟 Primary Donation Alerts &amp; Campaign Connection</span>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded font-bold">
                      Required
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    Connects your Tiltify campaign and sends donation alerts to your main Discord channel.
                  </p>
                </div>
              </div>
              <span className="text-[10px] text-neutral-400 font-mono shrink-0 pl-2">2 variables</span>
            </div>

            {/* Feature 2: Dedicated Staff / Auction Channel (The big one requested by user!) */}
            <div
              className={`p-3 rounded-xl border transition-all ${
                useSeparateAuctionChannel
                  ? 'bg-amber-950/30 border-amber-500/60 ring-1 ring-amber-500/30'
                  : 'bg-neutral-900/50 border-neutral-800'
              }`}
            >
              <div className="flex items-start justify-between">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useSeparateAuctionChannel}
                    onChange={(e) => setUseSeparateAuctionChannel(e.target.checked)}
                    className="mt-0.5 rounded bg-neutral-800 border-neutral-700 text-amber-500 focus:ring-amber-500 w-4 h-4"
                  />
                  <div>
                    <div className="font-semibold text-amber-200 flex items-center gap-2">
                      <span>🔨 Separate Channel for Auctions &amp; Staff / Mod Fulfillment</span>
                      <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded font-mono">
                        Requires 2nd Webhook
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-400 mt-0.5">
                      <strong>Why this matters:</strong> A single Discord webhook can only post to ONE channel. If you want ended auctions &amp; winner shipping details routed to a private mod channel (e.g. <code>#staff-auctions</code>), check this box!
                    </p>
                  </div>
                </label>
                <span className="text-[10px] text-neutral-400 font-mono shrink-0 pl-2">
                  {useSeparateAuctionChannel ? '+2 variables' : 'Off'}
                </span>
              </div>

              {/* Expandable sub-options when auction channel is enabled */}
              {useSeparateAuctionChannel && (
                <div className="mt-3 pt-3 border-t border-amber-800/40 space-y-2.5 pl-6">
                  <div>
                    <label className="text-[11px] text-amber-300 font-medium block mb-1">
                      Your Staff / Auction Channel Webhook URL:
                    </label>
                    <input
                      type="url"
                      value={customAuctionWebhook}
                      onChange={(e) => setCustomAuctionWebhook(e.target.value)}
                      placeholder="https://discord.com/api/webhooks/your-staff-channel-webhook..."
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-neutral-200 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                    />
                    <p className="text-[10px] text-neutral-400 mt-1">
                      In Discord: Go to your <strong>#staff-auctions</strong> channel settings ➔ Integrations ➔ Webhooks ➔ Copy Webhook URL.
                    </p>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer text-[11px] text-neutral-300">
                    <input
                      type="checkbox"
                      checked={dualPostAuctions}
                      onChange={(e) => setDualPostAuctions(e.target.checked)}
                      className="rounded bg-neutral-950 border-neutral-800 text-amber-500 focus:ring-amber-500 w-3.5 h-3.5"
                    />
                    <span>
                      Also post public winner announcement in main channel (with shipping address safely hidden)
                    </span>
                  </label>
                </div>
              )}
            </div>

            {/* Feature 3: Automated Tiltify Poller */}
            <div
              className={`p-3 rounded-xl border transition-all ${
                useTiltifyPoller
                  ? 'bg-teal-950/30 border-teal-500/60 ring-1 ring-teal-500/30'
                  : 'bg-neutral-900/50 border-neutral-800'
              }`}
            >
              <div className="flex items-start justify-between">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useTiltifyPoller}
                    onChange={(e) => setUseTiltifyPoller(e.target.checked)}
                    className="mt-0.5 rounded bg-neutral-800 border-neutral-700 text-teal-500 focus:ring-teal-500 w-4 h-4"
                  />
                  <div>
                    <div className="font-semibold text-teal-200 flex items-center gap-2">
                      <span>🤖 Automatic Tiltify Polling (No Webhook Setup in Tiltify)</span>
                    </div>
                    <p className="text-[11px] text-neutral-400 mt-0.5">
                      Don't want to create webhooks inside Tiltify? Check this to poll the Tiltify API automatically every 30 seconds.
                    </p>
                  </div>
                </label>
                <span className="text-[10px] text-neutral-400 font-mono shrink-0 pl-2">
                  {useTiltifyPoller ? '+2 variables' : 'Off'}
                </span>
              </div>
            </div>

            {/* Feature 4: Admin Passcode Protection */}
            <div
              className={`p-3 rounded-xl border transition-all ${
                useAdminPassword
                  ? 'bg-purple-950/30 border-purple-500/60 ring-1 ring-purple-500/30'
                  : 'bg-neutral-900/50 border-neutral-800'
              }`}
            >
              <div className="flex items-start justify-between">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useAdminPassword}
                    onChange={(e) => setUseAdminPassword(e.target.checked)}
                    className="mt-0.5 rounded bg-neutral-800 border-neutral-700 text-purple-500 focus:ring-purple-500 w-4 h-4"
                  />
                  <div>
                    <div className="font-semibold text-purple-200 flex items-center gap-2">
                      <span>🔒 Dashboard Passcode Lock</span>
                    </div>
                    <p className="text-[11px] text-neutral-400 mt-0.5">
                      Locks your Render web interface with a passcode so public viewers cannot alter your webhook or templates.
                    </p>
                  </div>
                </label>
                <span className="text-[10px] text-neutral-400 font-mono shrink-0 pl-2">
                  {useAdminPassword ? '+1 variable' : 'Off'}
                </span>
              </div>

              {useAdminPassword && (
                <div className="mt-2.5 pt-2 border-t border-purple-900/40 pl-6">
                  <label className="text-[11px] text-purple-300 font-medium block mb-1">
                    Your Secret Passcode:
                  </label>
                  <input
                    type="text"
                    value={adminPasswordInput}
                    onChange={(e) => setAdminPasswordInput(e.target.value)}
                    placeholder="Enter a secret password"
                    className="w-full sm:w-64 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-neutral-200 font-mono"
                  />
                </div>
              )}
            </div>

            {/* Feature 5: Custom Branding / Footer */}
            <div
              className={`p-3 rounded-xl border transition-all ${
                useBranding
                  ? 'bg-indigo-950/30 border-indigo-500/60 ring-1 ring-indigo-500/30'
                  : 'bg-neutral-900/50 border-neutral-800'
              }`}
            >
              <div className="flex items-start justify-between">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useBranding}
                    onChange={(e) => setUseBranding(e.target.checked)}
                    className="mt-0.5 rounded bg-neutral-800 border-neutral-700 text-indigo-500 focus:ring-indigo-500 w-4 h-4"
                  />
                  <div>
                    <div className="font-semibold text-indigo-200 flex items-center gap-2">
                      <span>🎨 Custom Stream Branding &amp; Slogan Footer</span>
                    </div>
                    <p className="text-[11px] text-neutral-400 mt-0.5">
                      Puts custom stream text at the bottom of Discord alerts.
                    </p>
                  </div>
                </label>
                <span className="text-[10px] text-neutral-400 font-mono shrink-0 pl-2">
                  {useBranding ? '+4 variables' : 'Off'}
                </span>
              </div>
            </div>

            {/* Feature 6: Bot Identity */}
            <div
              className={`p-3 rounded-xl border transition-all ${
                useBotIdentity
                  ? 'bg-teal-950/30 border-teal-500/60 ring-1 ring-teal-500/30'
                  : 'bg-neutral-900/50 border-neutral-800'
              }`}
            >
              <div className="flex items-start justify-between">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useBotIdentity}
                    onChange={(e) => setUseBotIdentity(e.target.checked)}
                    className="mt-0.5 rounded bg-neutral-800 border-neutral-700 text-teal-500 focus:ring-teal-500 w-4 h-4"
                  />
                  <div>
                    <div className="font-semibold text-teal-200 flex items-center gap-2">
                      <span>🤖 Custom Bot Identity &amp; Avatar Icon</span>
                    </div>
                    <p className="text-[11px] text-neutral-400 mt-0.5">
                      Persists your custom bot username ({discordConfig.botUsername || 'Tiltify Donation Bot'}) and avatar icon across redeploys.
                    </p>
                  </div>
                </label>
                <span className="text-[10px] text-neutral-400 font-mono shrink-0 pl-2">
                  {useBotIdentity ? '+2 variables' : 'Off'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* View Mode Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 border-b border-neutral-800 pb-2">
          <div>
            <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Step 2: Choose how to save to Render</span>
            </span>
          </div>

          <div className="flex items-center bg-neutral-950 border border-neutral-800 rounded-lg p-0.5 text-xs overflow-x-auto">
            <button
              onClick={() => setViewMode('secret_file')}
              className={`px-3 py-1.5 rounded-md font-medium transition-all flex items-center gap-1.5 shrink-0 ${
                viewMode === 'secret_file'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Secret File (1-Click Permanent)</span>
            </button>
            <button
              onClick={() => setViewMode('step_cards')}
              className={`px-3 py-1.5 rounded-md font-medium transition-all flex items-center gap-1.5 shrink-0 ${
                viewMode === 'step_cards'
                  ? 'bg-neutral-800 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              <span>Step-by-Step Cards</span>
            </button>
            <button
              onClick={() => setViewMode('bulk_env')}
              className={`px-3 py-1.5 rounded-md font-medium transition-all flex items-center gap-1.5 shrink-0 ${
                viewMode === 'bulk_env'
                  ? 'bg-neutral-800 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <FileCode className="w-3.5 h-3.5 text-teal-400" />
              <span>Bulk .env</span>
            </button>
          </div>
        </div>

        {/* MODE S: RENDER SECRET FILE (100% Guaranteed Persistence) */}
        {viewMode === 'secret_file' && (
          <div className="bg-neutral-950 border border-emerald-500/40 rounded-xl p-4 mb-5 space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Render Secret File: config.json</span>
                  </span>
                  <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    Recommended • Never Resets on Git Push
                  </span>
                </div>
                <p className="text-[11px] text-neutral-400 mt-1">
                  Render disks are ephemeral and reset on new git commits. Adding a <strong>Secret File</strong> permanently stores all footer branding, timestamps, bot identity, and webhook settings in Render with 1 copy-paste!
                </p>
              </div>

              <button
                onClick={() => handleCopy('secretFileJson', JSON.stringify({
                  discord: {
                    ...discordConfig,
                    separateAuctionChannel: useSeparateAuctionChannel,
                    auctionWebhookUrl: useSeparateAuctionChannel ? effectiveAuctionWebhook : undefined,
                    dualPostAuctions: useSeparateAuctionChannel ? dualPostAuctions : false,
                  },
                  tiltify: tiltifyConfig,
                }, null, 2))}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-md shrink-0"
              >
                {copiedKey === 'secretFileJson' ? (
                  <>
                    <Check className="w-4 h-4 text-white" />
                    <span>Copied config.json!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy config.json</span>
                  </>
                )}
              </button>
            </div>

            {/* Step-by-step 3-click guide */}
            <div className="bg-neutral-900/90 border border-neutral-800 rounded-lg p-3 text-xs space-y-2">
              <div className="font-semibold text-emerald-300 text-[11px] uppercase tracking-wider">
                How to set this up in Render (Takes 30 seconds):
              </div>
              <ol className="list-decimal list-inside space-y-1 text-[11px] text-neutral-300">
                <li>In your Render Dashboard, click your Web Service.</li>
                <li>In the left sidebar, click <strong>Secret Files</strong>.</li>
                <li>Click <strong>Add Secret File</strong>.</li>
                <li>Set <strong>Filename</strong> to: <code className="bg-neutral-950 px-1.5 py-0.5 rounded font-mono text-emerald-400">config.json</code></li>
                <li>Paste the copied JSON into the text box and click <strong>Save Changes</strong>.</li>
              </ol>
            </div>

            <textarea
              readOnly
              rows={8}
              value={JSON.stringify({
                discord: {
                  ...discordConfig,
                  separateAuctionChannel: useSeparateAuctionChannel,
                  auctionWebhookUrl: useSeparateAuctionChannel ? effectiveAuctionWebhook : undefined,
                  dualPostAuctions: useSeparateAuctionChannel ? dualPostAuctions : false,
                },
                tiltify: tiltifyConfig,
              }, null, 2)}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-3 text-[11px] font-mono text-neutral-200 resize-none focus:outline-none"
            />
          </div>
        )}

        {/* MODE A: STUPID-PROOF STEP-BY-STEP CARDS */}
        {viewMode === 'step_cards' && (
          <div className="space-y-3 mb-5">
            <div className="bg-indigo-950/20 border border-indigo-800/40 rounded-xl p-3 text-xs text-indigo-200 flex items-center gap-2.5">
              <Info className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>
                In Render, open your service ➔ click <strong>Environment</strong> ➔ click <strong>Add Environment Variable</strong>. Then copy each Key &amp; Value below!
              </span>
            </div>

            <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
              {activeVariables.map((variable, idx) => (
                <div
                  key={variable.key}
                  className="bg-neutral-950/80 border border-neutral-800 rounded-xl p-3.5 space-y-2.5 shadow-sm"
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-[10px] font-bold text-neutral-300">
                        {idx + 1}
                      </span>
                      <span className="font-semibold text-xs text-white">{variable.title}</span>
                      <span className="text-[10px] bg-neutral-900 border border-neutral-800 text-neutral-400 px-1.5 py-0.2 rounded font-mono">
                        {variable.feature}
                      </span>
                    </div>
                    {variable.required && (
                      <span className="text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.2 rounded font-bold uppercase">
                        Required
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-neutral-400">{variable.description}</p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {/* Key Box */}
                    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-2 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-[10px] text-neutral-400 block uppercase font-mono">Render Key</span>
                        <code className="text-teal-300 font-mono text-[11px] font-bold truncate block">
                          {variable.key}
                        </code>
                      </div>
                      <button
                        onClick={() => handleCopy(`key-${variable.key}`, variable.key)}
                        className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-md transition-colors shrink-0 flex items-center gap-1 text-[11px]"
                        title="Copy Key"
                      >
                        {copiedKey === `key-${variable.key}` ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span className="text-[10px]">Copy Key</span>
                      </button>
                    </div>

                    {/* Value Box */}
                    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-2 flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] text-neutral-400 block uppercase font-mono">Render Value</span>
                        <span className="text-neutral-200 font-mono text-[11px] truncate block">
                          {variable.value}
                        </span>
                      </div>
                      <button
                        onClick={() => handleCopy(`val-${variable.key}`, variable.value)}
                        className="p-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md transition-colors shrink-0 flex items-center gap-1 text-[11px] font-medium"
                        title="Copy Value"
                      >
                        {copiedKey === `val-${variable.key}` ? (
                          <Check className="w-3.5 h-3.5 text-emerald-300" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span className="text-[10px]">Copy Value</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => handleCopy('all-keys-vals', activeVariables.map((v) => `${v.key}=${v.value}`).join('\n'))}
                className="text-xs text-neutral-400 hover:text-neutral-200 flex items-center gap-1.5 underline underline-offset-4"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Or copy all {activeVariables.length} as text for bulk pasting</span>
              </button>
            </div>
          </div>
        )}

        {/* MODE B: RENDER BULK EDITOR (.ENV) */}
        {viewMode === 'bulk_env' && (
          <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 mb-5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <FileCode className="w-4 h-4 text-teal-400" />
                  <span>Render "Bulk Edit" (.env format)</span>
                </span>
                <p className="text-[11px] text-neutral-400 mt-0.5">
                  Render has a "Bulk Edit" or "Add from .env" button that lets you paste everything at once.
                </p>
              </div>
              <button
                onClick={() => handleCopy('bulkEnv', generatedBulkEnv)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-md shrink-0"
              >
                {copiedKey === 'bulkEnv' ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-300" />
                    <span>Copied {activeVariables.length} Variables!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy All {activeVariables.length} for Render</span>
                  </>
                )}
              </button>
            </div>

            <textarea
              readOnly
              rows={Math.min(activeVariables.length + 4, 10)}
              value={generatedBulkEnv}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-3 text-[11px] font-mono text-neutral-200 resize-none focus:outline-none"
            />

            {/* 3 Steps */}
            <div className="pt-2 border-t border-neutral-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[11px] text-neutral-400">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-neutral-800 flex items-center justify-center text-[10px] font-bold text-neutral-200">
                  1
                </span>
                <span>Render ➔ Service ➔ <strong>Environment</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-neutral-800 flex items-center justify-center text-[10px] font-bold text-neutral-200">
                  2
                </span>
                <span>Click <strong>Add from .env</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-neutral-800 flex items-center justify-center text-[10px] font-bold text-neutral-200">
                  3
                </span>
                <span>Paste &amp; click <strong>Save Changes</strong></span>
              </div>
            </div>
          </div>
        )}

        {/* Explain the "All-in-One" Option Clearly so it doesn't cause confusion */}
        <div className="bg-neutral-950/60 border border-neutral-800/80 rounded-xl p-3 text-xs text-neutral-400">
          <button
            onClick={() => setShowAllInOneExplanation(!showAllInOneExplanation)}
            className="w-full flex items-center justify-between text-left font-medium text-neutral-300 hover:text-white transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>What about the single "DONIFY_CONFIG" variable? Is that required?</span>
            </span>
            {showAllInOneExplanation ? (
              <ChevronUp className="w-4 h-4 text-neutral-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-neutral-400" />
            )}
          </button>

          {showAllInOneExplanation && (
            <div className="mt-2.5 pt-2.5 border-t border-neutral-800/80 space-y-2 text-[11px] text-neutral-400 leading-relaxed">
              <p>
                <strong>No, it is 100% optional!</strong> <code className="text-purple-300 font-mono">DONIFY_CONFIG</code> is simply an all-in-one shortcut for advanced users who prefer pasting a single configuration block into Render instead of typing individual variables.
              </p>
              <p>
                If you prefer standard, readable variables, <strong>use the step-by-step cards above</strong>! They do the exact same thing and are much easier to inspect and edit.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => handleCopy('single-json-config', `DONIFY_CONFIG=${singleConfigJson}`)}
                  className="bg-neutral-800 hover:bg-neutral-700 text-neutral-200 px-3 py-1 rounded-lg text-[10px] font-mono flex items-center gap-1 transition-colors"
                >
                  {copiedKey === 'single-json-config' ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                  <span>Copy DONIFY_CONFIG shortcut</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
