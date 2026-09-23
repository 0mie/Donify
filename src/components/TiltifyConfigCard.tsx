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
              {/* Campaign ID */}
              <div>
                <label className="text-xs font-semibold text-neutral-300 uppercase tracking-wider block mb-1">
                  Tiltify Campaign ID or Slug <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={localConfig.campaignId}
                  onChange={(e) => handleInputChange('campaignId', e.target.value)}
                  placeholder="e.g. 123456 or marathon-charity-2026"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-neutral-200 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  required
                />
                <p className="text-[11px] text-neutral-400 mt-1">
                  Found in your campaign URL or dashboard.
                </p>
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
