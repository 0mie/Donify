import React, { useState } from 'react';
import { DiscordConfig, TiltifyConfig } from '../types';
import {
  X,
  Copy,
  Check,
  Zap,
  Layers,
  Sparkles,
  HelpCircle,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  Sliders,
  Terminal,
  FileCode,
  Flame,
} from 'lucide-react';

interface RenderSimplifierModalProps {
  isOpen: boolean;
  onClose: () => void;
  discordConfig: DiscordConfig;
  tiltifyConfig: TiltifyConfig;
}

type PresetTier = 'essential' | 'poller' | 'all_in_one' | 'custom';

export const RenderSimplifierModal: React.FC<RenderSimplifierModalProps> = ({
  isOpen,
  onClose,
  discordConfig,
  tiltifyConfig,
}) => {
  const [selectedTier, setSelectedTier] = useState<PresetTier>('essential');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<'all' | 'essential' | 'api' | 'auctions' | 'styling'>('all');

  if (!isOpen) return null;

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const webhookVal = discordConfig.webhookUrl || 'https://discord.com/api/webhooks/...';
  const campaignVal = tiltifyConfig.campaignId || 'your-campaign-slug';
  const clientIdVal = tiltifyConfig.clientId || 'your-client-id';
  const clientSecretVal = tiltifyConfig.clientSecret || 'your-client-secret';

  // 1. Essential (Only 2 variables)
  const essentialEnv = `# ========================================================
# DONIFY ESSENTIAL RENDER CONFIG (ONLY 2 VARIABLES NEEDED!)
# Everything else has smart defaults built right into the app.
# ========================================================
DISCORD_WEBHOOK_URL=${webhookVal}
TILTIFY_CAMPAIGN_ID=${campaignVal}
`;

  // 2. Poller (4 variables)
  const pollerEnv = `# ========================================================
# DONIFY STANDARD POLLER CONFIG (4 VARIABLES)
# Automated polling every 30 seconds directly from Tiltify API
# ========================================================
DISCORD_WEBHOOK_URL=${webhookVal}
TILTIFY_CAMPAIGN_ID=${campaignVal}
TILTIFY_CLIENT_ID=${clientIdVal}
TILTIFY_CLIENT_SECRET=${clientSecretVal}
`;

  // 3. All In One (1 variable)
  const allInOneJson = JSON.stringify(
    {
      discord: discordConfig,
      tiltify: tiltifyConfig,
    },
    null,
    2
  );

  const allInOneEnv = `# ========================================================
# DONIFY ALL-IN-ONE VARIABLE (1 VARIABLE HOLDS EVERYTHING!)
# Paste this single variable in Render to lock all settings permanently
# ========================================================
DONIFY_CONFIG=${JSON.stringify({ discord: discordConfig, tiltify: tiltifyConfig })}
`;

  // 4. Complete Raw .env
  const fullRawEnv = `# ========================================================
# DONIFY COMPLETE ENVIRONMENT VARIABLES
# All optional customizations explicitly specified
# ========================================================
# 1. CORE (REQUIRED)
DISCORD_WEBHOOK_URL=${webhookVal}
TILTIFY_CAMPAIGN_ID=${campaignVal}
TILTIFY_CAMPAIGN_NAME=${tiltifyConfig.campaignName || discordConfig.campaignName || ''}

# 2. TILTIFY API CREDENTIALS (OPTIONAL - FOR POLLING)
TILTIFY_CLIENT_ID=${tiltifyConfig.clientId || ''}
TILTIFY_CLIENT_SECRET=${tiltifyConfig.clientSecret || ''}
TILTIFY_API_TOKEN=${tiltifyConfig.apiToken || ''}

# 3. AUCTION & PRIZE ROUTING (OPTIONAL)
DISCORD_SEPARATE_AUCTION_CHANNEL=${discordConfig.separateAuctionChannel ? 'true' : 'false'}
DISCORD_AUCTION_WEBHOOK_URL=${discordConfig.auctionWebhookUrl || ''}
DISCORD_AUCTION_SHIPPING_PRIVACY=${discordConfig.auctionShippingPrivacy || 'public_safe'}
DISCORD_DUAL_POST_AUCTIONS=${discordConfig.dualPostAuctions ? 'true' : 'false'}
DISCORD_AUCTION_MENTION_TYPE=${discordConfig.auctionMentionType || 'none'}
DISCORD_AUCTION_MENTION_ROLE_ID=${discordConfig.auctionMentionRoleId || ''}

# 4. BRANDING & EMBED STYLING (OPTIONAL)
DISCORD_FOOTER_TEXT=${discordConfig.footerText || ''}
DISCORD_FOOTER_ICON_URL=${discordConfig.footerIconUrl || ''}
DISCORD_AUCTION_FOOTER_TEXT=${discordConfig.auctionFooterText || ''}
`;

  const getActiveEnvText = () => {
    switch (selectedTier) {
      case 'essential':
        return essentialEnv;
      case 'poller':
        return pollerEnv;
      case 'all_in_one':
        return allInOneEnv;
      case 'custom':
        return fullRawEnv;
    }
  };

  const allVariablesList = [
    {
      name: 'DISCORD_WEBHOOK_URL',
      category: 'essential',
      required: true,
      desc: 'The Discord channel webhook URL where donation alerts are posted.',
      currentValue: discordConfig.webhookUrl,
    },
    {
      name: 'TILTIFY_CAMPAIGN_ID',
      category: 'essential',
      required: true,
      desc: 'Your Tiltify campaign ID, slug, or full URL (e.g. 12345 or marathon-2026).',
      currentValue: tiltifyConfig.campaignId,
    },
    {
      name: 'DONIFY_CONFIG',
      category: 'essential',
      required: false,
      desc: 'Alternative: 1 single JSON variable holding 100% of all settings, colors, and templates.',
      currentValue: 'JSON config object',
    },
    {
      name: 'TILTIFY_CLIENT_ID',
      category: 'api',
      required: false,
      desc: 'Tiltify OAuth Client ID. Needed only if polling directly via the API.',
      currentValue: tiltifyConfig.clientId,
    },
    {
      name: 'TILTIFY_CLIENT_SECRET',
      category: 'api',
      required: false,
      desc: 'Tiltify OAuth Client Secret.',
      currentValue: tiltifyConfig.clientSecret ? '••••••••' : '',
    },
    {
      name: 'TILTIFY_CAMPAIGN_NAME',
      category: 'styling',
      required: false,
      desc: 'Custom display name for campaign in Discord embeds.',
      currentValue: tiltifyConfig.campaignName,
    },
    {
      name: 'DISCORD_SEPARATE_AUCTION_CHANNEL',
      category: 'auctions',
      required: false,
      desc: 'Set to "true" to route ended auctions to a dedicated staff channel.',
      currentValue: String(discordConfig.separateAuctionChannel ?? false),
    },
    {
      name: 'DISCORD_AUCTION_WEBHOOK_URL',
      category: 'auctions',
      required: false,
      desc: 'Dedicated Discord webhook URL for auction winner alerts & shipping info.',
      currentValue: discordConfig.auctionWebhookUrl,
    },
    {
      name: 'DISCORD_AUCTION_SHIPPING_PRIVACY',
      category: 'auctions',
      required: false,
      desc: 'Shipping privacy: public_safe (recommended), spoiler, or full.',
      currentValue: discordConfig.auctionShippingPrivacy || 'public_safe',
    },
    {
      name: 'DISCORD_DUAL_POST_AUCTIONS',
      category: 'auctions',
      required: false,
      desc: 'Post public celebratory notice in main channel AND shipping card in staff channel.',
      currentValue: String(discordConfig.dualPostAuctions ?? false),
    },
    {
      name: 'ADMIN_PASSWORD',
      category: 'essential',
      required: false,
      desc: 'Optional dashboard passcode to protect your Render web interface.',
      currentValue: 'Configured in Dashboard',
    },
    {
      name: 'DISCORD_FOOTER_TEXT',
      category: 'styling',
      required: false,
      desc: 'Custom footer text at the bottom of Discord embeds.',
      currentValue: discordConfig.footerText,
    },
  ];

  const filteredVars = allVariablesList.filter((v) => {
    if (activeCategory === 'all') return true;
    return v.category === activeCategory;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-3xl w-full max-h-[92vh] overflow-y-auto shadow-2xl p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-neutral-400 hover:text-white p-1 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white">Render Variables Simplifier</h2>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                No Stress Guide
              </span>
            </div>
            <p className="text-xs text-neutral-400">
              Clear up confusion: see what is actually needed vs optional customizations
            </p>
          </div>
        </div>

        {/* The Golden Rule Banner */}
        <div className="bg-gradient-to-r from-emerald-950/60 via-teal-950/40 to-neutral-900 border border-emerald-700/60 rounded-xl p-4 mb-5 text-xs">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0 text-emerald-300">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">
                The Golden Rule: You only need 2 variables in Render!
              </h3>
              <p className="text-neutral-300 mt-1 leading-relaxed">
                Render lists 20+ variables in <code className="text-teal-300 bg-neutral-950 px-1 py-0.5 rounded font-mono">.env.example</code>, but <strong>you do not need to configure them in Render</strong>!
                All custom styling (colors, role mentions, custom avatars, templates, and prize channels) can be set directly right here in this visual Web Dashboard.
              </p>
            </div>
          </div>
        </div>

        {/* Setup Tiers Selector */}
        <div className="mb-5">
          <label className="text-xs font-semibold text-neutral-300 uppercase tracking-wider block mb-2">
            Select Your Setup Tier (Choose whatever feels easiest):
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {/* Tier 1 */}
            <button
              onClick={() => setSelectedTier('essential')}
              className={`p-3 rounded-xl border text-left transition-all relative ${
                selectedTier === 'essential'
                  ? 'bg-emerald-950/40 border-emerald-500/80 ring-1 ring-emerald-500/50 shadow-md'
                  : 'bg-neutral-950/60 border-neutral-800 hover:border-neutral-700 text-neutral-400'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-xs text-white flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  Minimalist (2 Vars)
                </span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded font-mono">
                  Recommended
                </span>
              </div>
              <p className="text-[11px] text-neutral-400">
                Only Webhook URL &amp; Campaign ID. Takes 15 seconds.
              </p>
            </button>

            {/* Tier 2 */}
            <button
              onClick={() => setSelectedTier('poller')}
              className={`p-3 rounded-xl border text-left transition-all ${
                selectedTier === 'poller'
                  ? 'bg-indigo-950/40 border-indigo-500/80 ring-1 ring-indigo-500/50 shadow-md'
                  : 'bg-neutral-950/60 border-neutral-800 hover:border-neutral-700 text-neutral-400'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-xs text-white flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-400" />
                  API Poller (4 Vars)
                </span>
              </div>
              <p className="text-[11px] text-neutral-400">
                Adds Client ID &amp; Secret to poll Tiltify API automatically.
              </p>
            </button>

            {/* Tier 3 */}
            <button
              onClick={() => setSelectedTier('all_in_one')}
              className={`p-3 rounded-xl border text-left transition-all ${
                selectedTier === 'all_in_one'
                  ? 'bg-purple-950/40 border-purple-500/80 ring-1 ring-purple-500/50 shadow-md'
                  : 'bg-neutral-950/60 border-neutral-800 hover:border-neutral-700 text-neutral-400'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-xs text-white flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-purple-400" />
                  All-In-One (1 Var)
                </span>
                <span className="text-[10px] bg-purple-500/20 text-purple-300 px-1.5 py-0.2 rounded font-mono">
                  Zero Clutter
                </span>
              </div>
              <p className="text-[11px] text-neutral-400">
                One single JSON variable locks all your custom dashboard styling.
              </p>
            </button>
          </div>
        </div>

        {/* Render Bulk Editor Box */}
        <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 mb-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
            <div>
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <FileCode className="w-4 h-4 text-teal-400" />
                <span>Render "Add from .env" Bulk Copy</span>
              </span>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                Paste this directly into Render's bulk editor — no typing keys one by one!
              </p>
            </div>
            <button
              onClick={() => handleCopy('activeEnv', getActiveEnvText())}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-md shrink-0"
            >
              {copiedKey === 'activeEnv' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Copied to Clipboard!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>1-Click Copy for Render</span>
                </>
              )}
            </button>
          </div>

          <div className="relative">
            <textarea
              readOnly
              rows={selectedTier === 'all_in_one' ? 4 : selectedTier === 'essential' ? 4 : 6}
              value={getActiveEnvText()}
              className="w-full bg-neutral-900/90 border border-neutral-800/80 rounded-lg p-3 text-[11px] font-mono text-neutral-200 resize-none focus:outline-none"
            />
          </div>

          {/* Quick Render Walkthrough */}
          <div className="mt-3 pt-3 border-t border-neutral-850 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[11px] text-neutral-400">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-neutral-800 flex items-center justify-center text-[10px] font-bold text-neutral-200">
                1
              </span>
              <span>Open Render Dashboard &rarr; Your Service &rarr; <strong>Environment</strong></span>
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
              <span>Paste &amp; click <strong>Save Changes</strong>!</span>
            </div>
          </div>
        </div>

        {/* Detailed Variable Cheat Sheet & Filter */}
        <div className="border-t border-neutral-800 pt-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-teal-400" />
                <span>Variable Directory &amp; Clarification</span>
              </h3>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                See exactly which variables are truly required vs optional styling
              </p>
            </div>
            <div className="flex items-center gap-1 text-[11px] bg-neutral-950 border border-neutral-800 rounded-lg p-0.5">
              <button
                onClick={() => setActiveCategory('all')}
                className={`px-2 py-1 rounded-md transition-colors ${
                  activeCategory === 'all' ? 'bg-neutral-800 text-white font-medium' : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setActiveCategory('essential')}
                className={`px-2 py-1 rounded-md transition-colors ${
                  activeCategory === 'essential' ? 'bg-emerald-950 text-emerald-300 font-medium' : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                Must Have (2)
              </button>
              <button
                onClick={() => setActiveCategory('api')}
                className={`px-2 py-1 rounded-md transition-colors ${
                  activeCategory === 'api' ? 'bg-indigo-950 text-indigo-300 font-medium' : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                API (2)
              </button>
              <button
                onClick={() => setActiveCategory('auctions')}
                className={`px-2 py-1 rounded-md transition-colors ${
                  activeCategory === 'auctions' ? 'bg-amber-950 text-amber-300 font-medium' : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                Auctions
              </button>
            </div>
          </div>

          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {filteredVars.map((v) => (
              <div
                key={v.name}
                className="bg-neutral-950/70 border border-neutral-800/80 rounded-xl p-2.5 flex items-start justify-between gap-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <code className="font-mono text-teal-300 font-semibold text-[11px]">{v.name}</code>
                    {v.required ? (
                      <span className="text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.2 rounded font-bold uppercase">
                        Must Have
                      </span>
                    ) : (
                      <span className="text-[9px] bg-neutral-800 text-neutral-400 px-1.5 py-0.2 rounded font-medium">
                        Optional
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-neutral-400">{v.desc}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => handleCopy(v.name, v.name)}
                    className="p-1 hover:bg-neutral-800 text-neutral-400 hover:text-white rounded transition-colors"
                    title={`Copy ${v.name}`}
                  >
                    {copiedKey === v.name ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ Note */}
        <div className="mt-4 p-3 bg-neutral-950 border border-neutral-800/80 rounded-xl text-xs text-neutral-400 flex items-start gap-2">
          <HelpCircle className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
          <p>
            <strong>Do I need to update Render when I change settings in the web app?</strong>
            <br />
            No! Any setting you change here saves automatically to your local storage and <code className="text-neutral-300 font-mono">data/app-config.json</code>. You only need Render environment variables if you want to set startup defaults or run without persistent disk.
          </p>
        </div>
      </div>
    </div>
  );
};
