import React, { useState } from 'react';
import { X, ExternalLink, Check, Copy, AlertCircle, Sparkles, MessageSquare, Webhook, Users } from 'lucide-react';

interface SetupGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  webhookEndpoint: string;
  onOpenRenderSimplifier?: () => void;
}

export const SetupGuideModal: React.FC<SetupGuideModalProps> = ({
  isOpen,
  onClose,
  webhookEndpoint,
  onOpenRenderSimplifier,
}) => {
  const [activeTab, setActiveTab] = useState<'discord' | 'tiltify' | 'teams' | 'render'>('discord');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-900/80">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-teal-500/10 text-teal-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Setup &amp; Integration Guide</h2>
              <p className="text-xs text-neutral-400">Connect Tiltify to Discord and simplify Render deployment</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-neutral-800 bg-neutral-950/40 px-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab('discord')}
            className={`flex items-center gap-2 py-3 px-4 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'discord'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            Discord Setup
          </button>
          <button
            onClick={() => setActiveTab('tiltify')}
            className={`flex items-center gap-2 py-3 px-4 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'tiltify'
                ? 'border-teal-500 text-teal-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Webhook className="w-4 h-4" />
            Tiltify Integration
          </button>
          <button
            onClick={() => setActiveTab('teams')}
            className={`flex items-center gap-2 py-3 px-4 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'teams'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Users className="w-4 h-4" />
            Team Campaigns
          </button>
          <button
            onClick={() => setActiveTab('render')}
            className={`flex items-center gap-2 py-3 px-4 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'render'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Sparkles className="w-4 h-4 text-purple-400" />
            Render Variables (Simplified)
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-neutral-300">
          {activeTab === 'discord' ? (
            <div className="space-y-4">
              <div className="bg-indigo-950/40 border border-indigo-900/50 rounded-xl p-4">
                <h3 className="font-semibold text-indigo-300 mb-1 flex items-center gap-1.5">
                  Method 1: Discord Webhook (Takes 15 seconds)
                </h3>
                <p className="text-xs text-indigo-200/80">
                  This is the official, easiest way to send messages to your Discord server without coding or hosting bot servers.
                </p>
              </div>

              <ol className="space-y-3 list-decimal list-inside text-neutral-300">
                <li className="pl-1">
                  <span className="font-medium text-white">Open Discord</span> and navigate to your server.
                </li>
                <li className="pl-1">
                  Right-click the text channel where you want donation alerts (e.g. <code className="bg-neutral-800 px-1.5 py-0.5 rounded text-indigo-300">#donations</code>), and select <span className="text-white font-medium">Edit Channel</span>.
                </li>
                <li className="pl-1">
                  Click <span className="text-white font-medium">Integrations</span> in the left sidebar, then click <span className="text-white font-medium">Webhooks</span> &rarr; <span className="text-white font-medium">New Webhook</span>.
                </li>
                <li className="pl-1">
                  Name it (e.g. <span className="text-teal-300">Tiltify Alerts</span>) and click <span className="text-white font-medium">Copy Webhook URL</span>.
                </li>
                <li className="pl-1">
                  Paste the URL into the <span className="text-indigo-400 font-medium">Discord Settings</span> tab and click <span className="text-white font-medium">Save & Test Alert</span>!
                </li>
              </ol>

              <div className="border-t border-neutral-800 pt-4">
                <h4 className="font-medium text-white mb-2">Hiding Secrets in Render (Never Commit Tokens to GitHub)</h4>
                <p className="text-xs text-neutral-400 mb-2">
                  To keep your Discord webhook or credentials 100% private in a public GitHub repository, configure them in your Render Dashboard:
                </p>
                <ul className="list-disc list-inside text-xs text-neutral-400 space-y-1">
                  <li>In Render &rarr; Your Service &rarr; <span className="text-neutral-200">Environment</span>.</li>
                  <li>Add <code className="text-indigo-300">DISCORD_WEBHOOK_URL</code>: paste your webhook URL.</li>
                  <li>Optional Bot credentials: <code className="text-indigo-300">DISCORD_BOT_TOKEN</code> and <code className="text-indigo-300">DISCORD_CHANNEL_ID</code>.</li>
                  <li>Render securely injects these values directly into the server without saving them to any files or GitHub!</li>
                </ul>
              </div>

              <div className="border-t border-neutral-800 pt-4">
                <h4 className="font-medium text-white mb-1.5 flex items-center gap-1.5">
                  <span>Pinging Specific Users or Roles</span>
                </h4>
                <p className="text-xs text-neutral-400 mb-2">
                  Want the bot to alert a specific streamer, moderator, or role whenever someone donates?
                </p>
                <ul className="list-disc list-inside text-xs text-neutral-400 space-y-1">
                  <li><strong className="text-neutral-200">To ping a User:</strong> Enable Developer Mode in Discord (User Settings &rarr; Advanced &rarr; Developer Mode). Right-click the user&apos;s avatar or name and click <span className="text-neutral-200 font-mono">Copy User ID</span>, then paste it into the &apos;Specific User (User ID)&apos; field.</li>
                  <li><strong className="text-neutral-200">To ping a Role:</strong> Go to Server Settings &rarr; Roles, click the <span className="text-neutral-200">&hellip;</span> icon next to the role and click <span className="text-neutral-200 font-mono">Copy Role ID</span>.</li>
                </ul>
              </div>

              <div className="border-t border-neutral-800 pt-4">
                <h4 className="font-medium text-white mb-1.5 flex items-center gap-1.5">
                  <span>Custom PNG Bot Avatar</span>
                </h4>
                <p className="text-xs text-neutral-400">
                  Instead of using the default favicon URL, you can drag and drop any PNG image directly in the <strong className="text-neutral-200">Bot Avatar Icon</strong> section. The app will host and serve your custom icon directly to Discord webhooks with high quality and transparency support.
                </p>
              </div>
            </div>
          ) : activeTab === 'tiltify' ? (
            <div className="space-y-4">
              <div className="bg-teal-950/40 border border-teal-900/50 rounded-xl p-4">
                <h3 className="font-semibold text-teal-300 mb-1">Option A: Tiltify Webhooks (Instant Push)</h3>
                <p className="text-xs text-teal-200/80">
                  Tiltify sends an HTTP POST event the split-second a donation occurs.
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5 block">
                  Your Webhook Receiver URL
                </label>
                <div className="flex items-center gap-2 bg-neutral-950 border border-neutral-800 rounded-lg p-2 font-mono text-xs text-neutral-300">
                  <span className="truncate flex-1">{webhookEndpoint}</span>
                  <button
                    onClick={() => copyToClipboard(webhookEndpoint)}
                    className="flex items-center gap-1 bg-teal-600 hover:bg-teal-500 text-white px-2.5 py-1 rounded text-xs transition-colors shrink-0"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied' : 'Copy URL'}
                  </button>
                </div>
                <p className="text-xs text-neutral-400 mt-2">
                  In Tiltify, go to your Campaign or Account &rarr; Webhooks &rarr; Add Webhook, paste this URL, and subscribe to <code className="text-teal-400">donation.donated</code> or <code className="text-teal-400">donation.created</code>.
                </p>
              </div>

              <div className="border-t border-neutral-800 pt-4">
                <h4 className="font-medium text-white mb-2">Option B: Tiltify v5 API Polling (Client ID & Secret)</h4>
                <p className="text-xs text-neutral-300 mb-2">
                  To authenticate with the Tiltify v5 API, Tiltify uses OAuth2 Client Credentials:
                </p>
                <ol className="list-decimal list-inside space-y-2 text-xs text-neutral-400">
                  <li>
                    <strong className="text-neutral-200">Get your credentials:</strong> In Tiltify, go to <strong className="text-neutral-300">My Account</strong> &rarr; <strong className="text-neutral-300">My Applications</strong> (or Developer section) &rarr; <strong className="text-neutral-300">Create Application</strong>.
                  </li>
                  <li>
                    <strong className="text-neutral-200">Copy your Client ID and Client Secret:</strong> Paste them directly into the <strong className="text-teal-400">Client ID</strong> and <strong className="text-teal-400">Client Secret</strong> fields in the Tiltify Settings tab.
                  </li>
                  <li>
                    <strong className="text-neutral-200">Generate the token:</strong> Click the <strong className="text-indigo-400">"Generate Token Automatically"</strong> button in the app. The bot calls Tiltify's <code className="text-teal-300 bg-neutral-900 px-1 py-0.5 rounded">/oauth/token</code> endpoint for you and handles automatic refreshes!
                  </li>
                  <li>
                    <strong className="text-neutral-200">Or use cURL:</strong> If you prefer to run the command in your terminal manually, expand the <strong className="text-neutral-200">"cURL command helper"</strong> in the Tiltify tab, copy the command, run it, and paste the resulting <code className="text-teal-300">access_token</code> into the Bearer token field.
                  </li>
                  <li>
                    <strong className="text-neutral-200">Set Campaign ID:</strong> Enter your Campaign ID/slug and turn on the Poller switch. The bot will automatically check for new donors and post rich Discord alerts!
                  </li>
                </ol>
              </div>

              <div className="flex items-center gap-2 text-xs text-neutral-400 bg-neutral-950 p-3 rounded-lg border border-neutral-800">
                <AlertCircle className="w-4 h-4 text-teal-400 shrink-0" />
                <span>You can also use the built-in <strong>Donation Simulator</strong> tab to test Discord messages immediately without waiting for a real live donation.</span>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-amber-950/40 border border-amber-900/50 rounded-xl p-4">
                <h3 className="font-semibold text-amber-300 mb-1 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-amber-400" />
                  <span>How Team Campaigns Work (No Separate API Keys Needed!)</span>
                </h3>
                <p className="text-xs text-amber-200/90 leading-relaxed">
                  <strong>Do you need an API key or webhook for each team member?</strong> <strong>No!</strong> Tiltify groups all individual team member pages under your parent Team Campaign. You only need to set up Donify <strong>once</strong> for the entire team.
                </p>
              </div>

              <div className="space-y-3 text-neutral-300">
                <h4 className="font-semibold text-white">How to Set Up Team-Wide Alerts:</h4>

                <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-3.5 space-y-2.5">
                  <div className="font-medium text-amber-300 text-xs">Method 1: Instant Webhook (Recommended)</div>
                  <ol className="list-decimal list-inside space-y-1.5 text-xs text-neutral-400">
                    <li>Go to your <strong className="text-neutral-200">Team Campaign</strong> on Tiltify (the main parent event dashboard).</li>
                    <li>Click <strong className="text-neutral-200">Webhooks</strong> &rarr; <strong className="text-neutral-200">Add Webhook</strong>.</li>
                    <li>
                      Paste your Donify Webhook Receiver URL:
                      <div className="my-1.5 flex items-center gap-2 bg-neutral-900 border border-neutral-800 rounded p-1.5 font-mono text-[11px] text-teal-300">
                        <span className="truncate flex-1">{webhookEndpoint}</span>
                        <button
                          onClick={() => copyToClipboard(webhookEndpoint)}
                          className="bg-neutral-800 hover:bg-neutral-700 text-white px-2 py-0.5 rounded text-[10px]"
                        >
                          {copied ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    </li>
                    <li>
                      Under event topics, subscribe to <code className="text-teal-400">donation_updated</code> with <strong className="text-neutral-200">"Include Child / Supporting Campaigns"</strong> (or <code className="text-amber-300">indirect</code> events).
                    </li>
                    <li>
                      <strong className="text-emerald-400">That's it!</strong> Whenever any supporter donates to <em>any</em> team member on your team, Tiltify sends the event here. Donify automatically highlights the team member's name in Discord!
                    </li>
                  </ol>
                </div>

                <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-3.5 space-y-2">
                  <div className="font-medium text-indigo-300 text-xs">Method 2: Background Poller</div>
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    If you use the API Poller instead of webhooks, enter your <strong>parent Team Campaign ID or slug</strong> in the Tiltify tab. Tiltify's API automatically calculates your team's total amount raised and includes supporting donations.
                  </p>
                </div>

                <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-xl text-xs space-y-1">
                  <span className="font-semibold text-white block">What will the Discord alert show?</span>
                  <p className="text-neutral-400 text-[11px] leading-relaxed">
                    Donify formats team alerts to celebrate both your cause and your teammates:
                  </p>
                  <div className="bg-neutral-900 p-2.5 rounded-lg border border-neutral-800 font-mono text-[11px] text-neutral-300 space-y-0.5 mt-1">
                    <div>🎉 <strong>New Donation: $50.00!</strong></div>
                    <div>👤 <strong>Donor:</strong> Sam Sparks</div>
                    <div>🎯 <strong>Campaign:</strong> Charity Marathon 2026 • 👤 <strong>Team Member:</strong> SarahStreamer</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'render' && (
            <div className="space-y-4">
              <div className="bg-purple-950/40 border border-purple-900/50 rounded-xl p-4">
                <h3 className="font-semibold text-purple-300 mb-1 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <span>The Render Secret: You Only Need 2 Variables!</span>
                </h3>
                <p className="text-xs text-purple-200/80 leading-relaxed">
                  Render's sample configuration mentions 20+ variables, but you do <strong>NOT</strong> need to configure all of them. All colors, avatar icons, templates, and prize options are already fully functional with built-in defaults or editable in this web app!
                </p>
              </div>

              {/* The 2 Essential Variables */}
              <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 space-y-3">
                <span className="font-semibold text-white text-xs uppercase tracking-wider block">
                  1. The 2 Essential Variables (Ready in 30 seconds):
                </span>
                <div className="space-y-2 text-xs">
                  <div className="bg-neutral-900 p-2.5 rounded-lg border border-neutral-800">
                    <div className="flex items-center justify-between">
                      <code className="text-teal-300 font-mono font-bold">DISCORD_WEBHOOK_URL</code>
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded font-bold uppercase">
                        Must Have
                      </span>
                    </div>
                    <p className="text-neutral-400 text-[11px] mt-1">
                      Where the donation messages go. Created in Discord (Channel Settings &rarr; Integrations &rarr; Webhooks).
                    </p>
                  </div>

                  <div className="bg-neutral-900 p-2.5 rounded-lg border border-neutral-800">
                    <div className="flex items-center justify-between">
                      <code className="text-teal-300 font-mono font-bold">TILTIFY_CAMPAIGN_ID</code>
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded font-bold uppercase">
                        Must Have
                      </span>
                    </div>
                    <p className="text-neutral-400 text-[11px] mt-1">
                      Your campaign ID or slug (e.g. <code className="text-neutral-200">gamingforher</code> or full URL).
                    </p>
                  </div>
                </div>
              </div>

              {/* 1-Click Bulk Pasting in Render */}
              <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 space-y-2 text-xs">
                <span className="font-semibold text-white block">
                  How to Avoid Typing Variables One by One:
                </span>
                <p className="text-neutral-300 text-[11px] leading-relaxed">
                  In Render, navigate to your Web Service &rarr; <strong>Environment</strong>. Look for the button that says <strong>"Add from .env"</strong>.
                  You can paste all variables in one click instead of entering them separately!
                </p>
                {onOpenRenderSimplifier && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenRenderSimplifier();
                    }}
                    className="mt-2 w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2 rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Open Render Variables Simplifier &amp; 1-Click Copy</span>
                  </button>
                )}
              </div>

              {/* Annual Campaign Rollovers */}
              <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 space-y-2 text-xs">
                <span className="font-semibold text-white block">
                  Annual Campaign Rollovers (No Disruption):
                </span>
                <p className="text-neutral-400 text-[11px] leading-relaxed">
                  When you create a new campaign slug each year (e.g. <code className="text-teal-300">marathon-2027</code>), you do not need to rewrite your Render environment variables!
                  Simply use the <strong>Annual Campaign Rollover</strong> tool in the Tiltify tab of this dashboard. It smoothly switches the campaign slug while leaving your Discord webhook, custom embeds, and avatars 100% intact.
                </p>
              </div>

              {/* Separate Auction & Staff Channel Callout */}
              <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 space-y-2 text-xs">
                <span className="font-semibold text-white block">
                  Need a Separate Channel for Auctions or Staff?
                </span>
                <p className="text-neutral-400 text-[11px] leading-relaxed">
                  Discord webhooks are bound to <strong>one specific channel</strong>. If you want ended auctions or private winner shipping details posted to a private moderator channel (e.g. <code className="text-amber-300">#staff-auctions</code>), you will need a 2nd webhook. The <strong>Render Variables Wizard</strong> has a toggle for this that generates <code className="text-amber-300 font-mono">DISCORD_AUCTION_WEBHOOK_URL</code> and <code className="text-amber-300 font-mono">DISCORD_SEPARATE_AUCTION_CHANNEL=true</code> ready to copy!
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-neutral-800 bg-neutral-900/80 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Got it, Close
          </button>
        </div>
      </div>
    </div>
  );
};
