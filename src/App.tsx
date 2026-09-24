import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { DiscordConfigCard } from './components/DiscordConfigCard';
import { TiltifyConfigCard } from './components/TiltifyConfigCard';
import { DonationSimulator } from './components/DonationSimulator';
import { LiveFeed } from './components/LiveFeed';
import { SetupGuideModal } from './components/SetupGuideModal';
import { AdminLockModal } from './components/AdminLockModal';
import { DiscordConfig, TiltifyConfig, DonationRecord, BotStatus, ClaimedReward, AuctionWinnerInfo } from './types';
import { Bot, Radio, Zap, HeartHandshake, DollarSign, Activity, CheckCircle2, ShieldCheck, ShieldAlert, RefreshCw } from 'lucide-react';

const CONFIG_STORAGE_KEY = 'tiltify_bot_saved_config_v1';

function saveLocalConfigBackup(discord: DiscordConfig, tiltify: TiltifyConfig) {
  try {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify({ discord, tiltify }));
  } catch (e) {
    // Ignore storage quota/permission issues
  }
}

function getLocalConfigBackup(): { discord?: Partial<DiscordConfig>; tiltify?: Partial<TiltifyConfig> } | null {
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'discord' | 'tiltify' | 'feed' | 'simulator'>('discord');
  const [guideOpen, setGuideOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [discordConfig, setDiscordConfig] = useState<DiscordConfig>({
    mode: 'webhook',
    webhookUrl: '',
    botToken: '',
    channelId: '',
    botUsername: 'Tiltify Donation Bot',
    botAvatarUrl: 'https://tiltify.com/favicon.ico',
    embedColor: '#00d1b2',
    auctionEmbedColor: '#F59E0B',
    mentionType: 'none',
    mentionRoleId: '',
    mentionUserId: '',
    includeComment: true,
    includeCampaignDetails: true,
    includeCampaignProgress: true,
    includeRewardDetails: true,
    includeDeliveryAddress: true,
    spoilerDeliveryInfo: true,
    embedDensity: 'comfortable',
    embedLayout: 'modern',
    embedTitleTemplate: '🎉 New Donation: {amount}!',
    embedDescriptionTemplate: '**{donor}** contributed to the campaign!',
    embedThumbnailUrl: '',
    embedBannerUrl: '',
    showEmbedTimestamp: true,
    progressBarCharStyle: 'blocks',
    auctionTitleTemplate: '🏆 AUCTION HOUSE: Auction Ended & Finalized!',
    customMessagePrefix: '🎉 New donation received on Tiltify!',
    enableAuctionAlerts: true,
    auctionMessagePrefix: '🔨 **AUCTION ENDED!** An auction from the Tiltify Auction House has concluded.',
    onlyNotifyPrizeAuctions: false,
  });

  const [tiltifyConfig, setTiltifyConfig] = useState<TiltifyConfig>({
    clientId: '',
    clientSecret: '',
    apiToken: '',
    tokenExpiresAt: null,
    campaignId: '',
    pollIntervalSeconds: 30,
    pollingEnabled: false,
    webhookSecret: '',
  });

  const [status, setStatus] = useState<BotStatus>({
    isPolling: false,
    lastPollTimestamp: null,
    lastPollStatus: 'idle',
    lastPollMessage: 'Ready',
    discordConfigured: false,
    tiltifyConfigured: false,
    totalDonationsProcessed: 0,
    totalAuctionsProcessed: 0,
    totalAmountProcessed: 0,
    lastDonationTimestamp: null,
    serverUrl: typeof window !== 'undefined' ? window.location.origin : '',
  });

  const [donations, setDonations] = useState<DonationRecord[]>([]);

  // Security / Admin Passcode State
  const [hasPassword, setHasPassword] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'setup' | 'change' | null>(null);

  const getAuthHeaders = (): Record<string, string> => {
    const token = localStorage.getItem('tiltify_admin_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const authFetch = async (url: string, options: RequestInit = {}) => {
    const headers = {
      Accept: 'application/json',
      ...getAuthHeaders(),
      ...(options.headers || {}),
    };
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
      setIsAuthenticated(false);
      setAuthModalMode('login');
    }
    return res;
  };

  // Fetch configuration and status
  const fetchConfigAndStatus = async () => {
    try {
      const res = await authFetch('/api/config');
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        let serverDiscord = data.discord || {};
        let serverTiltify = data.tiltify || {};

        // Auto-Restore Protection:
        // If the server was freshly redeployed or restarted with blank values,
        // recover the user's previously saved preferences from browser backup!
        const backup = getLocalConfigBackup();
        let needsRestoreSync = false;

        if (backup) {
          if (
            !serverDiscord.webhookUrl &&
            !serverDiscord.botToken &&
            (backup.discord?.webhookUrl || backup.discord?.botToken)
          ) {
            serverDiscord = { ...serverDiscord, ...backup.discord };
            needsRestoreSync = true;
          }
          if (
            !serverTiltify.campaignId &&
            !serverTiltify.clientId &&
            backup.tiltify?.campaignId
          ) {
            serverTiltify = { ...serverTiltify, ...backup.tiltify };
            needsRestoreSync = true;
          }
        }

        if (needsRestoreSync) {
          try {
            const syncRes = await authFetch('/api/config', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ discord: serverDiscord, tiltify: serverTiltify }),
            });
            const syncType = syncRes.headers.get('content-type') || '';
            if (syncRes.ok && syncType.includes('application/json')) {
              const syncData = await syncRes.json();
              if (syncData.discord) serverDiscord = syncData.discord;
              if (syncData.tiltify) serverTiltify = syncData.tiltify;
              if (syncData.status) setStatus(syncData.status);
            }
          } catch (syncErr) {
            console.warn('[App] Failed to auto-sync restored backup to server:', syncErr);
          }
        }

        setDiscordConfig(serverDiscord);
        setTiltifyConfig(serverTiltify);
        if (data.status) setStatus(data.status);

        // Keep local backup up to date
        saveLocalConfigBackup(serverDiscord, serverTiltify);
      }
    } catch (err) {
      console.warn('Failed to load server config:', err);
    }
  };

  // Fetch live polling status only (without touching active form configurations)
  const fetchStatusOnly = async () => {
    try {
      const res = await fetch('/api/status', {
        headers: { Accept: 'application/json' },
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        if (data.status) setStatus(data.status);
      }
    } catch (err) {
      console.warn('Failed to load status:', err);
    }
  };

  // Fetch donations history
  const fetchDonations = async () => {
    try {
      const res = await fetch('/api/donations', {
        headers: { Accept: 'application/json' },
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        setDonations(data.donations || []);
      }
    } catch (err) {
      console.warn('Failed to load donations:', err);
    }
  };

  const checkAuthAndLoad = async () => {
    try {
      const res = await fetch('/api/auth/status', {
        headers: {
          Accept: 'application/json',
          ...getAuthHeaders(),
        },
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const authData = await res.json();
        setHasPassword(authData.hasPassword);
        if (authData.hasPassword && !authData.authenticated) {
          setIsAuthenticated(false);
          setAuthModalMode('login');
          return;
        }
        setIsAuthenticated(true);
      }
    } catch (e) {
      console.warn('Failed to check auth status:', e);
    }
    await Promise.all([fetchConfigAndStatus(), fetchDonations()]);
  };

  const handleAuthSuccess = async (newToken?: string) => {
    if (newToken && newToken !== 'unprotected') {
      localStorage.setItem('tiltify_admin_token', newToken);
      setHasPassword(true);
    } else if (newToken === '') {
      localStorage.removeItem('tiltify_admin_token');
      setHasPassword(false);
    }
    setIsAuthenticated(true);
    setAuthModalMode(null);
    await checkAuthAndLoad();
  };

  const handleLockDashboard = async () => {
    const token = localStorage.getItem('tiltify_admin_token');
    if (token) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (e) {
        // ignore
      }
    }
    localStorage.removeItem('tiltify_admin_token');
    setIsAuthenticated(false);
    setAuthModalMode('login');
  };

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await checkAuthAndLoad();
      setIsLoading(false);
    };
    init();

    // Periodic refresh for background activity & feed (does NOT overwrite user edits)
    const interval = setInterval(() => {
      fetchStatusOnly();
      fetchDonations();
    }, 8000);

    return () => clearInterval(interval);
  }, []);

  // Save Discord settings
  const handleSaveDiscord = async (updated: Partial<DiscordConfig>) => {
    const res = await authFetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ discord: updated }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update Discord settings');
    }
    const data = await res.json();
    setDiscordConfig(data.discord);
    setStatus(data.status);
    saveLocalConfigBackup(data.discord, tiltifyConfig);
  };

  // Save Tiltify settings
  const handleSaveTiltify = async (updated: Partial<TiltifyConfig>) => {
    const res = await authFetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tiltify: updated }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update Tiltify settings');
    }
    const data = await res.json();
    setTiltifyConfig(data.tiltify);
    setStatus(data.status);
    saveLocalConfigBackup(discordConfig, data.tiltify);
  };

  // Dispatch Discord Test
  const handleTestDiscord = async (): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await authFetch('/api/discord/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          donorName: 'Test Supporter',
          amount: 25.0,
          currency: 'USD',
          comment: 'Testing Tiltify-to-Discord alert webhook integration! 🚀',
          campaignName: tiltifyConfig.campaignId ? `Campaign #${tiltifyConfig.campaignId}` : 'Charity Marathon',
        }),
      });
      const data = await res.json();
      await fetchDonations();
      await fetchConfigAndStatus();
      return { success: data.success, error: data.error };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error executing test' };
    }
  };

  // Trigger Manual Poll
  const handlePollNow = async () => {
    const res = await authFetch('/api/tiltify/poll', { method: 'POST' });
    const data = await res.json();
    await fetchDonations();
    await fetchConfigAndStatus();
    return {
      success: data.success,
      message: data.message,
      count: data.newDonationsCount || 0,
    };
  };

  // Trigger Simulation
  const handleSimulate = async (payload: {
    eventType?: 'donation' | 'auction_ended';
    donorName?: string;
    donorEmail?: string;
    amount?: number;
    currency?: string;
    comment?: string;
    campaignName?: string;
    reward?: ClaimedReward;
    auction?: AuctionWinnerInfo;
  }) => {
    const res = await authFetch('/api/discord/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    await fetchDonations();
    await fetchConfigAndStatus();
    return { success: data.success, error: data.error };
  };

  // Resend Donation
  const handleResendDonation = async (id: string) => {
    const res = await authFetch(`/api/donations/${id}/resend`, { method: 'POST' });
    const data = await res.json();
    await fetchDonations();
    return { success: data.success, error: data.error };
  };

  // Clear Donations
  const handleClearDonations = async () => {
    if (confirm('Are you sure you want to clear donation history?')) {
      await authFetch('/api/donations', { method: 'DELETE' });
      await fetchDonations();
      await fetchConfigAndStatus();
    }
  };

  const webhookEndpoint = typeof window !== 'undefined'
    ? `${window.location.origin}/api/tiltify/webhook`
    : 'https://your-app-url/api/tiltify/webhook';

  const totalSuccessful = donations.filter((d) => d.discordStatus === 'sent').length;
  const deliveryRate = donations.length > 0 ? Math.round((totalSuccessful / donations.length) * 100) : 100;

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col selection:bg-teal-500 selection:text-white">
      {/* Header Bar */}
      <Navbar
        status={status}
        hasPassword={hasPassword}
        onOpenGuide={() => setGuideOpen(true)}
        onQuickTest={handleTestDiscord}
        onSetupPasscode={() => setAuthModalMode('setup')}
        onChangePasscode={() => setAuthModalMode('change')}
        onLock={handleLockDashboard}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Passcode Recommendation Banner if Unprotected */}
        {!hasPassword && (
          <div className="bg-amber-950/30 border border-amber-800/50 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-900/60 border border-amber-700/50 flex items-center justify-center shrink-0 text-amber-400">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div>
                <p className="font-semibold text-amber-200">Recommended: Set an Admin Passcode</p>
                <p className="text-amber-300/80 mt-0.5">
                  Your Render URL is currently open. Anyone with this link could view your Discord webhook or edit settings.
                </p>
              </div>
            </div>
            <button
              onClick={() => setAuthModalMode('setup')}
              className="bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold px-3.5 py-1.5 rounded-xl shrink-0 transition-colors shadow-sm flex items-center gap-1.5"
            >
              <span>Set Passcode</span>
            </button>
          </div>
        )}

        {/* Metric Cards Banner */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-neutral-400 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider">Total Donated</span>
              <DollarSign className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-white tracking-tight">
              ${status.totalAmountProcessed.toFixed(2)}
            </div>
            <div className="text-[11px] text-neutral-400 mt-1">Across all logged events</div>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-neutral-400 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider">Donations Logged</span>
              <HeartHandshake className="w-4 h-4 text-teal-400" />
            </div>
            <div className="text-2xl font-bold text-white tracking-tight">
              {donations.length}
            </div>
            <div className="text-[11px] text-neutral-400 mt-1">Processed by bot</div>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-neutral-400 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider">Discord Delivery</span>
              <CheckCircle2 className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-2xl font-bold text-white tracking-tight">
              {deliveryRate}%
            </div>
            <div className="text-[11px] text-emerald-400 mt-1">
              {totalSuccessful} of {donations.length} alerts delivered
            </div>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-neutral-400 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider">Poller Status</span>
              <Activity className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-lg font-bold text-white truncate">
              {status.isPolling ? 'Auto-Polling' : 'Webhook Mode'}
            </div>
            <div className="text-[11px] text-neutral-400 mt-1 truncate">
              {status.lastPollTimestamp
                ? `Last checked ${new Date(status.lastPollTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                : 'Listening on Webhook'}
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-neutral-800 pb-1 overflow-x-auto">
          <button
            onClick={() => setActiveTab('discord')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
              activeTab === 'discord'
                ? 'bg-neutral-800 text-white shadow-sm border border-neutral-700'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/60'
            }`}
          >
            <Bot className="w-4 h-4 text-indigo-400" />
            <span>Discord Setup & Embeds</span>
            {status.discordConfigured && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 ml-1" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('tiltify')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
              activeTab === 'tiltify'
                ? 'bg-neutral-800 text-white shadow-sm border border-neutral-700'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/60'
            }`}
          >
            <Radio className="w-4 h-4 text-teal-400" />
            <span>Tiltify Ingestion (API & Webhook)</span>
            {status.tiltifyConfigured && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 ml-1" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('feed')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
              activeTab === 'feed'
                ? 'bg-neutral-800 text-white shadow-sm border border-neutral-700'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/60'
            }`}
          >
            <HeartHandshake className="w-4 h-4 text-rose-400" />
            <span>Activity Feed & Logs</span>
            <span className="bg-neutral-950 px-2 py-0.5 rounded-md text-[10px] text-neutral-300 font-mono">
              {donations.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('simulator')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
              activeTab === 'simulator'
                ? 'bg-neutral-800 text-white shadow-sm border border-neutral-700'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/60'
            }`}
          >
            <Zap className="w-4 h-4 text-amber-400" />
            <span>Donation Sandbox & Tester</span>
          </button>
        </div>

        {/* Tab Panels */}
        <div className="pt-2">
          {activeTab === 'discord' && (
            <DiscordConfigCard
              config={discordConfig}
              onSave={handleSaveDiscord}
              onTest={handleTestDiscord}
            />
          )}

          {activeTab === 'tiltify' && (
            <TiltifyConfigCard
              config={tiltifyConfig}
              status={status}
              onSave={handleSaveTiltify}
              onPollNow={handlePollNow}
            />
          )}

          {activeTab === 'feed' && (
            <LiveFeed
              donations={donations}
              onResend={handleResendDonation}
              onClear={handleClearDonations}
              isLoading={isLoading}
            />
          )}

          {activeTab === 'simulator' && (
            <DonationSimulator
              onSimulate={handleSimulate}
              defaultCampaignName={tiltifyConfig.campaignId ? `Tiltify Campaign #${tiltifyConfig.campaignId}` : 'Community Charity Drive'}
            />
          )}
        </div>
      </main>

      {/* Setup Guide Modal */}
      <SetupGuideModal
        isOpen={guideOpen}
        onClose={() => setGuideOpen(false)}
        webhookEndpoint={webhookEndpoint}
      />

      {/* Admin Passcode Modal (Login / Setup / Change) */}
      <AdminLockModal
        mode={authModalMode || (hasPassword && !isAuthenticated ? 'login' : 'setup')}
        isOpen={Boolean(authModalMode) || (hasPassword && !isAuthenticated)}
        onClose={() => {
          if (authModalMode !== 'login') {
            setAuthModalMode(null);
          }
        }}
        onSuccess={handleAuthSuccess}
      />
    </div>
  );
}
