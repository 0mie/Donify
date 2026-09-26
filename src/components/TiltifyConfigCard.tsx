import React, { useState, useEffect } from 'react';
import { TiltifyConfig, BotStatus } from '../types';
import {
  Copy,
  Check,
  RefreshCw,
  Radio,
  Play,
  Pause,
  AlertCircle,
  ShieldAlert,
  CheckCircle2,
  Webhook,
  Key,
  Terminal,
  Eye,
  EyeOff,
  Sparkles,
  Clock,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Calendar,
  Filter,
  Info,
} from 'lucide-react';

interface TiltifyConfigCardProps {
  config: TiltifyConfig;
  status: BotStatus;
  onSave: (updated: Partial<TiltifyConfig>) => Promise<void>;
  onPollNow: () => Promise<{ success: boolean; message: string; count: number }>;
}

export const TiltifyConfigCard: React.FC<TiltifyConfigCardProps> = ({
  config,
  status,
  onSave,
  onPollNow,
}) => {
  const [localConfig, setLocalConfig] = useState<TiltifyConfig>(config);
  const [isSaving, setIsSaving] = useState(false);
  const [isPollingNow, setIsPollingNow] = useState(false);
  const [isGeneratingToken, setIsGeneratingToken] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [showCurlHelper, setShowCurlHelper] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isFetchingCampaign, setIsFetchingCampaign] = useState(false);
  const [fetchedCampaignMeta, setFetchedCampaignMeta] = useState<{
    name: string;
    totalRaised?: number;
    targetGoal?: number;
    currency?: string;
  } | null>(null);

  // Auction House Historical Pull States
  const [isPullingAuctions, setIsPullingAuctions] = useState(false);
  const [isDispatchingPrizes, setIsDispatchingPrizes] = useState(false);
  const [pullAuctionsSendToDiscord, setPullAuctionsSendToDiscord] = useState(true);
  const [pullAuctionsResult, setPullAuctionsResult] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  useEffect(() => {
    if (!isDirty) {
      setLocalConfig(config);
    }
  }, [config, isDirty]);

  const webhookUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/tiltify/webhook`
    : 'https://your-app-url/api/tiltify/webhook';

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  const handleInputChange = (field: keyof TiltifyConfig, value: any) => {
    setIsDirty(true);
    setLocalConfig((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setFeedback(null);
    try {
      await onSave(localConfig);
      setIsDirty(false);
      setFeedback({ type: 'success', text: 'Tiltify configuration updated successfully.' });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Failed to save configuration.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateToken = async () => {
    const cid = localConfig.clientId?.trim();
    const csec = localConfig.clientSecret?.trim();

    if (!cid || !csec) {
      setFeedback({
        type: 'error',
        text: 'Please input both your Tiltify Client ID and Client Secret above to generate an API token.',
      });
      return;
    }

    setIsGeneratingToken(true);
    setFeedback(null);
    try {
      const token = localStorage.getItem('tiltify_admin_token');
      const res = await fetch('/api/tiltify/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          clientId: cid,
          clientSecret: csec,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to exchange credentials with Tiltify.');
      }

      const updated = {
        ...localConfig,
        apiToken: data.apiToken,
        tokenExpiresAt: data.tokenExpiresAt,
      };
      setLocalConfig(updated);
      await onSave(updated);

      setFeedback({
        type: 'success',
        text: `API Token successfully obtained from Tiltify! Valid for ~${Math.round((data.expiresIn || 7200) / 3600)} hours and will auto-refresh automatically.`,
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err.message || 'Tiltify rejected the Client ID/Secret. Please check credentials and try again.',
      });
    } finally {
      setIsGeneratingToken(false);
    }
  };

  const curlSnippet = `curl -X POST https://v5api.tiltify.com/oauth/token \\
  -H "Content-Type: application/json" \\
  -d '{
    "grant_type": "client_credentials",
    "client_id": "${localConfig.clientId?.trim() || 'YOUR_CLIENT_ID'}",
    "client_secret": "${localConfig.clientSecret?.trim() || 'YOUR_CLIENT_SECRET'}",
    "scope": "public"
  }'`;

  const handleCopyCurl = () => {
    navigator.clipboard.writeText(curlSnippet);
    setCopiedCurl(true);
    setTimeout(() => setCopiedCurl(false), 2000);
  };

  const handleFetchCampaignInfo = async () => {
    const cid = localConfig.campaignId?.trim();
    if (!cid) {
      setFeedback({
        type: 'error',
        text: 'Please enter a Tiltify Campaign ID, Slug, or URL first.',
      });
      return;
    }

    setIsFetchingCampaign(true);
    setFeedback(null);
    try {
      const token = localStorage.getItem('tiltify_admin_token');
      const res = await fetch('/api/tiltify/fetch-campaign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          campaignId: cid,
          apiToken: localConfig.apiToken,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success || !data.campaign) {
        throw new Error(data.error || 'Could not retrieve campaign details from Tiltify.');
      }

      const camp = data.campaign;
      setFetchedCampaignMeta({
        name: camp.name,
        totalRaised: camp.totalRaised,
        targetGoal: camp.targetGoal,
        currency: camp.currency,
      });

      // Update localConfig.campaignName with real name from Tiltify API
      const updated = {
        ...localConfig,
        campaignName: camp.name,
      };
      setLocalConfig(updated);
      setIsDirty(true);

      setFeedback({
        type: 'success',
        text: `Connected to "${camp.name}"! Campaign display name updated. Click Save Settings to persist.`,
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err.message || 'Failed to fetch campaign details from Tiltify API.',
      });
    } finally {
      setIsFetchingCampaign(false);
    }
  };

  const handlePullPreviousAuctions = async () => {
    const cid = localConfig.campaignId?.trim();
    if (!cid) {
      setPullAuctionsResult({ type: 'error', text: 'Please enter a Tiltify Campaign ID, Slug, or URL first.' });
      return;
    }
    setIsPullingAuctions(true);
    setPullAuctionsResult(null);
    try {
      const token = localStorage.getItem('tiltify_admin_token');
      const res = await fetch('/api/tiltify/pull-auctions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          campaignId: cid,
          startDate: localConfig.auctionDateRangeStart || undefined,
          endDate: localConfig.auctionDateRangeEnd || undefined,
          sendToDiscord: pullAuctionsSendToDiscord,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to pull auctions from Tiltify');
      }
      setPullAuctionsResult({
        type: 'success',
        text: data.message || `Pulled ${data.totalPulled} auctions successfully!`,
      });
      if (data.campaignSummary) {
        setFetchedCampaignMeta({
          name: data.campaignSummary.campaignName || data.campaignSummary.name,
          totalRaised: data.campaignSummary.totalRaised,
          targetGoal: data.campaignSummary.targetGoal,
          currency: data.campaignSummary.currency,
        });
      }
    } catch (err: any) {
      setPullAuctionsResult({
        type: 'error',
        text: err.message || 'Error occurred while contacting Tiltify API for auctions.',
      });
    } finally {
      setIsPullingAuctions(false);
    }
  };

  const handleDispatchPrizes = async () => {
    setIsDispatchingPrizes(true);
    setPullAuctionsResult(null);
    try {
      const token = localStorage.getItem('tiltify_admin_token');
      const res = await fetch('/api/tiltify/dispatch-prizes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to dispatch prizes to Discord');
      }
      setPullAuctionsResult({
        type: 'success',
        text: data.message || `Dispatched prize shipping cards to Discord!`,
      });
    } catch (err: any) {
      setPullAuctionsResult({
        type: 'error',
        text: err.message || 'Error dispatching prize alerts to Discord.',
      });
    } finally {
      setIsDispatchingPrizes(false);
    }
  };

  const handleTogglePolling = async () => {
    const nextState = !localConfig.pollingEnabled;
    handleInputChange('pollingEnabled', nextState);
    try {
      await onSave({ ...localConfig, pollingEnabled: nextState });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Failed to toggle polling.' });
    }
  };

  const triggerPoll = async () => {
    setIsPollingNow(true);
    setFeedback(null);
    try {
      await onSave(localConfig);
      const res = await onPollNow();
      setFeedback({
        type: res.success ? 'success' : 'error',
        text: res.message || `Poll completed with ${res.count} new donation(s).`,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Poll request failed.' });
    } finally {
      setIsPollingNow(false);
    }
  };

  return (
    <div className="space-y-6">
      {feedback && (
        <div
          className={`p-4 rounded-xl text-xs flex items-start gap-2.5 ${
            feedback.type === 'success'
              ? 'bg-emerald-950/50 border border-emerald-800/60 text-emerald-300'
              : 'bg-rose-950/50 border border-rose-800/60 text-rose-300'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
          ) : (
            <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
          )}
          <div className="font-medium">{feedback.text}</div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1: Tiltify Webhook Integration */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
                  <Webhook className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-white text-base">Method 1: Instant Webhook (Push)</h3>
                  <p className="text-xs text-neutral-400">Tiltify sends donations immediately when processed</p>
                </div>
              </div>
              <span className="bg-teal-950 text-teal-400 border border-teal-800 px-2 py-0.5 rounded text-[11px] font-semibold">
                Fastest
              </span>
            </div>

            <div className="space-y-4 text-xs text-neutral-300">
              <p>
                Configure Tiltify to post real-time donation events directly to this application. No waiting for poller loops!
              </p>

              <div>
                <label className="text-xs font-semibold text-neutral-300 uppercase tracking-wider block mb-1.5">
                  Your Webhook Receiver URL
                </label>
                <div className="flex items-center gap-2 bg-neutral-950 border border-neutral-800 rounded-xl p-2 font-mono text-xs text-neutral-200">
                  <span className="truncate flex-1 select-all">{webhookUrl}</span>
                  <button
                    type="button"
                    onClick={handleCopyWebhook}
                    className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-500 text-white px-3 py-1.5 rounded-lg font-sans font-medium transition-colors shrink-0"
                  >
                    {copiedWebhook ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedWebhook ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              <div className="bg-neutral-950 border border-neutral-800/80 rounded-xl p-3.5 space-y-2 text-neutral-400">
                <div className="font-semibold text-neutral-200">How to add in Tiltify:</div>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Log in to <strong className="text-neutral-300">tiltify.com</strong> and open your Campaign.</li>
                  <li>Click <strong className="text-neutral-300">Webhooks</strong> in the settings menu.</li>
                  <li>Click <strong className="text-neutral-300">Add Webhook</strong> and paste the URL above.</li>
                  <li>Select event: <code className="text-teal-400 bg-neutral-900 px-1 py-0.5 rounded">donation.donated</code> or <code className="text-teal-400 bg-neutral-900 px-1 py-0.5 rounded">donation.created</code>.</li>
                </ol>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-neutral-800 flex items-center justify-between text-xs text-neutral-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Endpoint active and listening for events
            </span>
          </div>
        </div>

        {/* Card 2: Background Poller (Tiltify API) */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <Radio className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-white text-base">Method 2: Background Poller (Pull)</h3>
                  <p className="text-xs text-neutral-400">Checks Tiltify v5 API periodically for new donations</p>
                </div>
              </div>

              {/* Poller Active Switch */}
              <button
                type="button"
                onClick={handleTogglePolling}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold border transition-all ${
                  localConfig.pollingEnabled
                    ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
                    : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                }`}
              >
                {localConfig.pollingEnabled ? (
                  <>
                    <Pause className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Active</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 text-neutral-400" />
                    <span>Paused</span>
                  </>
                )}
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              {/* Campaign ID or Slug */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-neutral-300 uppercase tracking-wider block">
                    Tiltify Campaign ID, Slug, or URL <span className="text-rose-400">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleFetchCampaignInfo}
                    disabled={isFetchingCampaign || !localConfig.campaignId}
                    className="flex items-center gap-1.5 text-[11px] text-teal-400 hover:text-teal-300 disabled:opacity-40 transition-colors font-medium"
                    title="Query Tiltify API for the official campaign title and live progress"
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${isFetchingCampaign ? 'animate-spin' : ''}`} />
                    <span>{isFetchingCampaign ? 'Querying API...' : 'Fetch Name from Tiltify'}</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={localConfig.campaignId}
                  onChange={(e) => handleInputChange('campaignId', e.target.value)}
                  placeholder="e.g. 123456, marathon-charity-2026, or https://tiltify.com/@user/marathon"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-neutral-200 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  required
                />
                <p className="text-[11px] text-neutral-400 mt-1">
                  Paste your numeric campaign ID, vanity slug, or complete Tiltify URL.
                </p>
              </div>

              {/* Campaign Display Name (Custom Name or Pulled from API) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-neutral-300 uppercase tracking-wider block">
                    Campaign Display Name (Discord Title)
                  </label>
                  <span className="text-[10px] text-teal-300 bg-teal-950/80 border border-teal-800/80 px-1.5 py-0.5 rounded">
                    Customizable
                  </span>
                </div>
                <input
                  type="text"
                  value={localConfig.campaignName || ''}
                  onChange={(e) => handleInputChange('campaignName', e.target.value)}
                  placeholder="e.g. Charity Gaming Marathon 2026 (or auto-pulled from API)"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-neutral-200 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <p className="text-[11px] text-neutral-400 mt-1">
                  Used in Discord notifications and the <code className="text-teal-400 bg-neutral-900 px-1 py-0.5 rounded font-mono text-[10px]">{"{campaign}"}</code> template variable. You can enter any custom name here, or click <strong>Fetch Name from Tiltify</strong> above to automatically use the official title.
                </p>

                {fetchedCampaignMeta && (
                  <div className="mt-2.5 p-3 bg-teal-950/30 border border-teal-800/60 rounded-xl text-xs flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
                      <div>
                        <div className="font-semibold text-white">{fetchedCampaignMeta.name}</div>
                        {fetchedCampaignMeta.targetGoal !== undefined && (
                          <div className="text-[11px] text-teal-300/80">
                            Raised: ${(fetchedCampaignMeta.totalRaised || 0).toLocaleString()} • Goal: ${fetchedCampaignMeta.targetGoal.toLocaleString()} {fetchedCampaignMeta.currency || 'USD'}
                          </div>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] bg-teal-900/60 text-teal-300 border border-teal-700/50 px-2 py-0.5 rounded font-mono shrink-0">
                      Tiltify API Verified
                    </span>
                  </div>
                )}
              </div>

              {/* Tiltify OAuth2 Credentials (Client ID & Client Secret) */}
              <div className="bg-neutral-950/70 border border-neutral-800 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-200">
                    <Key className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Tiltify API Credentials (Client ID & Secret)</span>
                  </div>
                  <span className="text-[10px] text-neutral-400 bg-neutral-900 border border-neutral-800 px-1.5 py-0.5 rounded">
                    OAuth 2.0
                  </span>
                </div>

                <div className="space-y-2.5">
                  <div>
                    <label className="text-[11px] font-medium text-neutral-300 block mb-1">
                      Client ID
                    </label>
                    <input
                      type="text"
                      value={localConfig.clientId || ''}
                      onChange={(e) => handleInputChange('clientId', e.target.value)}
                      placeholder="e.g. tiltify_client_id_..."
                      className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-neutral-300 block mb-1">
                      Client Secret
                    </label>
                    <div className="relative">
                      <input
                        type={showSecret ? 'text' : 'password'}
                        value={localConfig.clientSecret || ''}
                        onChange={(e) => handleInputChange('clientSecret', e.target.value)}
                        placeholder="e.g. tiltify_client_secret_..."
                        className="w-full bg-neutral-900 border border-neutral-800 rounded-lg pl-3 pr-10 py-2 text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSecret(!showSecret)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 transition-colors"
                        title={showSecret ? 'Hide secret' : 'Show secret'}
                      >
                        {showSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* One-Click Token Generation Button */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleGenerateToken}
                      disabled={isGeneratingToken || !localConfig.clientId || !localConfig.clientSecret}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white px-3 py-2 rounded-lg text-xs font-medium transition-colors shadow-sm"
                    >
                      <Sparkles className={`w-3.5 h-3.5 ${isGeneratingToken ? 'animate-spin' : ''}`} />
                      <span>{isGeneratingToken ? 'Exchanging with Tiltify...' : 'Generate Token Automatically'}</span>
                    </button>
                  </div>
                </div>

                {/* API Token Box */}
                <div className="pt-1 border-t border-neutral-850">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-medium text-neutral-400">
                      Bearer Access Token
                    </label>
                    {localConfig.apiToken && (
                      <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Ready</span>
                      </span>
                    )}
                  </div>
                  <input
                    type="password"
                    value={localConfig.apiToken || ''}
                    onChange={(e) => handleInputChange('apiToken', e.target.value)}
                    placeholder="Token generated automatically or pasted here"
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-neutral-300 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                  />
                  <p className="text-[10px] text-neutral-500 mt-1">
                    If Client ID and Secret are provided, the bot will also auto-refresh this token before it expires.
                  </p>
                </div>

                {/* cURL Command Helper Box */}
                <div className="pt-2 border-t border-neutral-850">
                  <button
                    type="button"
                    onClick={() => setShowCurlHelper(!showCurlHelper)}
                    className="flex items-center justify-between w-full text-[11px] text-neutral-400 hover:text-neutral-200 transition-colors py-1"
                  >
                    <span className="flex items-center gap-1.5 font-medium">
                      <Terminal className="w-3.5 h-3.5 text-teal-400" />
                      <span>Or run the cURL command manually in terminal</span>
                    </span>
                    {showCurlHelper ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>

                  {showCurlHelper && (
                    <div className="mt-2 space-y-2 bg-neutral-900/90 rounded-lg p-2.5 border border-neutral-800 text-[11px]">
                      <div className="flex items-center justify-between text-neutral-300">
                        <span className="text-[10px] text-neutral-400">cURL command (OAuth Client Credentials):</span>
                        <button
                          type="button"
                          onClick={handleCopyCurl}
                          className="flex items-center gap-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 px-2 py-0.5 rounded text-[10px] transition-colors"
                        >
                          {copiedCurl ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedCurl ? 'Copied' : 'Copy cURL'}</span>
                        </button>
                      </div>
                      <pre className="p-2 bg-black/70 rounded border border-neutral-800/80 font-mono text-[10px] text-neutral-300 overflow-x-auto select-all whitespace-pre">
                        {curlSnippet}
                      </pre>
                      <p className="text-[10px] text-neutral-400">
                        Running this command in your terminal returns JSON with an <code className="text-teal-300">"access_token"</code>. You can paste that value into the Bearer Access Token field above, or simply use the <strong>Generate Token Automatically</strong> button!
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Tiltify Auction House Historical Data & Previous Winners Backfill */}
              <div className="pt-3 border-t border-neutral-850 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-200">
                    <span className="text-amber-400">🔨</span>
                    <span>Auction House Data &amp; Previous Winners Backfill</span>
                  </div>
                  <span className="text-[10px] text-amber-300 bg-amber-950/80 border border-amber-800/80 px-1.5 py-0.5 rounded">
                    Historical Pull
                  </span>
                </div>

                <div className="bg-neutral-950/80 border border-neutral-800 rounded-xl p-3 space-y-3 text-xs">
                  {/* Toggle: Include Auction Totals in Overall Campaign Progress */}
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={localConfig.includeAuctionsInTotal !== false}
                      onChange={(e) => handleInputChange('includeAuctionsInTotal', e.target.checked)}
                      className="rounded bg-neutral-900 border-neutral-700 text-amber-500 focus:ring-amber-500 w-4 h-4 mt-0.5 shrink-0"
                    />
                    <div>
                      <span className="font-semibold text-white">Add Auction House Totals to Campaign Progress</span>
                      <p className="text-[11px] text-neutral-400 mt-0.5">
                        Tiltify's public API <code className="text-neutral-300 font-mono">amount_raised</code> only tracks regular checkout donations. When enabled, the bot automatically combines your auction house winning bids into the campaign total so all your funds stay in one place.
                      </p>
                    </div>
                  </label>

                  {/* Toggle: Auto-pull previous auction winners during background polling */}
                  <label className="flex items-start gap-2.5 cursor-pointer pt-2 border-t border-neutral-850">
                    <input
                      type="checkbox"
                      checked={Boolean(localConfig.autoPullPreviousAuctions)}
                      onChange={(e) => handleInputChange('autoPullPreviousAuctions', e.target.checked)}
                      className="rounded bg-neutral-900 border-neutral-700 text-indigo-500 focus:ring-indigo-500 w-4 h-4 mt-0.5 shrink-0"
                    />
                    <div>
                      <span className="font-semibold text-white">Auto-Pull Previous Auction Winners in Polling</span>
                      <p className="text-[11px] text-neutral-400 mt-0.5">
                        Automatically queries and imports all historical auction house winners for your current campaign on every background poll cycle.
                      </p>
                    </div>
                  </label>

                  {/* Date Range Selection */}
                  <div className="pt-2 border-t border-neutral-850 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-semibold text-neutral-300 uppercase tracking-wider flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-teal-400" />
                        <span>Historical Date Range (Optional Filter)</span>
                      </label>
                      <div className="flex items-center gap-1.5 text-[10px]">
                        <button
                          type="button"
                          onClick={() => {
                            const yearStart = `${new Date().getFullYear()}-01-01`;
                            handleInputChange('auctionDateRangeStart', yearStart);
                            handleInputChange('auctionDateRangeEnd', '');
                          }}
                          className="text-teal-400 hover:text-teal-300 underline"
                        >
                          Start of Year ({new Date().getFullYear()})
                        </button>
                        <span className="text-neutral-600">•</span>
                        <button
                          type="button"
                          onClick={() => {
                            handleInputChange('auctionDateRangeStart', '');
                            handleInputChange('auctionDateRangeEnd', '');
                          }}
                          className="text-neutral-400 hover:text-neutral-300"
                        >
                          All Time
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-[10px] text-neutral-400 block mb-0.5">From Date</span>
                        <input
                          type="date"
                          value={localConfig.auctionDateRangeStart || ''}
                          onChange={(e) => handleInputChange('auctionDateRangeStart', e.target.value)}
                          className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-neutral-200 focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-neutral-400 block mb-0.5">To Date</span>
                        <input
                          type="date"
                          value={localConfig.auctionDateRangeEnd || ''}
                          onChange={(e) => handleInputChange('auctionDateRangeEnd', e.target.value)}
                          className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-neutral-200 focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
                        />
                      </div>
                    </div>

                    {/* Dispatch to Discord Checkbox */}
                    <div className="pt-1">
                      <label className="flex items-center gap-2 cursor-pointer text-[11px] text-neutral-300">
                        <input
                          type="checkbox"
                          checked={pullAuctionsSendToDiscord}
                          onChange={(e) => setPullAuctionsSendToDiscord(e.target.checked)}
                          className="rounded bg-neutral-900 border-neutral-700 text-amber-500 focus:ring-amber-500 w-3.5 h-3.5"
                        />
                        <span>Dispatch individual Discord cards with winner shipping &amp; prize info (checked = sends each prize to Discord)</span>
                      </label>
                    </div>

                    {/* Pull Action Buttons */}
                    <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <button
                        type="button"
                        onClick={handlePullPreviousAuctions}
                        disabled={isPullingAuctions || !localConfig.campaignId}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white px-3 py-2 rounded-xl text-xs font-semibold transition-colors shadow-sm"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isPullingAuctions ? 'animate-spin' : ''}`} />
                        <span>{isPullingAuctions ? 'Pulling Individual Prizes...' : 'Pull Each Prize Individually & Send Info'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleDispatchPrizes}
                        disabled={isDispatchingPrizes || !localConfig.campaignId}
                        className="flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors shadow-sm"
                        title="Send all prize fulfillment cards to Discord"
                      >
                        <Sparkles className={`w-3.5 h-3.5 ${isDispatchingPrizes ? 'animate-spin' : ''}`} />
                        <span>{isDispatchingPrizes ? 'Dispatching...' : 'Dispatch All Prizes to Discord'}</span>
                      </button>
                    </div>

                    {pullAuctionsResult && (
                      <div
                        className={`p-2.5 rounded-lg text-xs mt-2 flex items-center gap-2 ${
                          pullAuctionsResult.type === 'success'
                            ? 'bg-emerald-950/40 border border-emerald-800/60 text-emerald-300'
                            : 'bg-rose-950/40 border border-rose-800/60 text-rose-300'
                        }`}
                      >
                        {pullAuctionsResult.type === 'success' ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        )}
                        <span className="flex-1">{pullAuctionsResult.text}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Auto-Increase Goal & Dynamic Stretch Goal Explainer Callout */}
              <div className="pt-2">
                <div className="p-3 bg-indigo-950/20 border border-indigo-800/40 rounded-xl text-xs text-indigo-200/90 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-semibold text-indigo-300">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <span>Tiltify Auto-Increase Goal &amp; Dynamic Stretch Goals</span>
                  </div>
                  <p className="text-[11px] text-neutral-300">
                    <strong>Will the bot auto-update to your new goal?</strong> <strong>Yes!</strong> When Tiltify reaches a milestone threshold with auto-increase enabled, Tiltify automatically increments the campaign's <code className="text-indigo-300 bg-neutral-900 px-1 py-0.5 rounded font-mono">goal.value</code> in their v5 API. The bot checks Tiltify live on every poll and webhook, dynamically resizing your Discord progress bars and stretch goals automatically.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-xs text-neutral-400 block mb-1">Poll Frequency</label>
                  <select
                    value={localConfig.pollIntervalSeconds}
                    onChange={(e) => handleInputChange('pollIntervalSeconds', Number(e.target.value))}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value={15}>Every 15 seconds</option>
                    <option value={30}>Every 30 seconds</option>
                    <option value={60}>Every 1 minute</option>
                    <option value={120}>Every 2 minutes</option>
                    <option value={300}>Every 5 minutes</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-neutral-400 block mb-1">Last Polled</label>
                  <div className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-300 truncate">
                    {status.lastPollTimestamp
                      ? new Date(status.lastPollTimestamp).toLocaleTimeString()
                      : 'Never'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-xs font-medium transition-colors"
                >
                  {isSaving ? 'Saving...' : 'Save Settings'}
                </button>

                <button
                  type="button"
                  onClick={triggerPoll}
                  disabled={isPollingNow || !localConfig.campaignId}
                  className="flex items-center gap-1.5 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 text-neutral-200 px-4 py-2 rounded-xl text-xs font-medium transition-colors border border-neutral-700"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isPollingNow ? 'animate-spin text-teal-400' : ''}`} />
                  <span>{isPollingNow ? 'Checking...' : 'Poll Tiltify Now'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Polling Status Box */}
          <div className="mt-6 pt-4 border-t border-neutral-800">
            <div className="flex items-center justify-between text-xs">
              <span className="text-neutral-400">Poller Engine Status:</span>
              <span
                className={`font-semibold flex items-center gap-1.5 ${
                  status.lastPollStatus === 'success'
                    ? 'text-emerald-400'
                    : status.lastPollStatus === 'error'
                    ? 'text-rose-400'
                    : 'text-neutral-400'
                }`}
              >
                {status.lastPollStatus === 'success' && <CheckCircle2 className="w-3.5 h-3.5" />}
                {status.lastPollStatus === 'error' && <AlertCircle className="w-3.5 h-3.5" />}
                {status.lastPollMessage || 'Idle'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
