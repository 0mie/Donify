import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { DiscordConfigCard } from './components/DiscordConfigCard';
import { TiltifyConfigCard } from './components/TiltifyConfigCard';
import { DonationSimulator } from './components/DonationSimulator';
import { LiveFeed } from './components/LiveFeed';
import { PrizeShippingCenter } from './components/PrizeShippingCenter';
import { SetupGuideModal } from './components/SetupGuideModal';
import { AdminLockModal } from './components/AdminLockModal';
import { BackupModal } from './components/BackupModal';
import { RenderSimplifierModal } from './components/RenderSimplifierModal';
import { DiscordConfig, TiltifyConfig, DonationRecord, BotStatus, ClaimedReward, AuctionWinnerInfo } from './types';
import { Bot, Radio, Zap, HeartHandshake, DollarSign, Activity, CheckCircle2, ShieldCheck, ShieldAlert, RefreshCw, Package, Sparkles, HardDrive, Calendar } from 'lucide-react';

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
  const [activeTab, setActiveTab] = useState<'discord' | 'tiltify' | 'prizes' | 'feed' | 'simulator'>('discord');
  const [guideOpen, setGuideOpen] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);
  const [renderSimplifierOpen, setRenderSimplifierOpen] = useState(false);
  const [annualBannerDismissed, setAnnualBannerDismissed] = useState(false);
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
    auctionShippingPrivacy: 'public_safe',
    auctionMentionType: 'none',
    auctionMentionRoleId: '',
  });

  const [tiltifyConfig, setTiltifyConfig] = useState<TiltifyConfig>({
    clientId: '',
    clientSecret: '',
    apiToken: '',
    tokenExpiresAt: null,
    campaignId: '',
    campaignName: '',
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
  const [autoRestoredAlert, setAutoRestoredAlert] = useState(false);
  const [saveReminder, setSaveReminder] = useState<string | null>(null);
  const [copiedQuickConfig, setCopiedQuickConfig] = useState(false);

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

        // Comprehensive Auto-Restore Protection:
        // When Render redeploys from a new Git push, the ephemeral disk resets.
        // We compare the server config with the browser's local backup.
        // If the backup contains customized settings that the server is currently missing
        // or has at default placeholder values, restore them!
        const backup = getLocalConfigBackup();
        let needsRestoreSync = false;

        if (backup) {
          const mergedDiscord = { ...serverDiscord };
          const mergedTiltify = { ...serverTiltify };

          // Restore Discord custom fields if server has blank or default values
          if (backup.discord) {
            const b = backup.discord;
            if (b.webhookUrl && !serverDiscord.webhookUrl) { mergedDiscord.webhookUrl = b.webhookUrl; needsRestoreSync = true; }
            if (b.botToken && !serverDiscord.botToken) { mergedDiscord.botToken = b.botToken; needsRestoreSync = true; }
            if (b.channelId && !serverDiscord.channelId) { mergedDiscord.channelId = b.channelId; needsRestoreSync = true; }
            if (b.botUsername && b.botUsername !== 'Tiltify Donation Bot' && (!serverDiscord.botUsername || serverDiscord.botUsername === 'Tiltify Donation Bot')) { mergedDiscord.botUsername = b.botUsername; needsRestoreSync = true; }
            if (b.botAvatarUrl && !serverDiscord.botAvatarUrl) { mergedDiscord.botAvatarUrl = b.botAvatarUrl; needsRestoreSync = true; }
            if (b.embedColor && b.embedColor !== '#00d1b2' && (!serverDiscord.embedColor || serverDiscord.embedColor === '#00d1b2')) { mergedDiscord.embedColor = b.embedColor; needsRestoreSync = true; }
            if (b.auctionEmbedColor && !serverDiscord.auctionEmbedColor) { mergedDiscord.auctionEmbedColor = b.auctionEmbedColor; needsRestoreSync = true; }
            if (b.campaignName && !serverDiscord.campaignName) { mergedDiscord.campaignName = b.campaignName; needsRestoreSync = true; }
            if (b.embedTitleTemplate && !serverDiscord.embedTitleTemplate) { mergedDiscord.embedTitleTemplate = b.embedTitleTemplate; needsRestoreSync = true; }
            if (b.footerText && !serverDiscord.footerText) { mergedDiscord.footerText = b.footerText; needsRestoreSync = true; }
            if (b.footerIconUrl && !serverDiscord.footerIconUrl) { mergedDiscord.footerIconUrl = b.footerIconUrl; needsRestoreSync = true; }
            if (b.auctionFooterText && !serverDiscord.auctionFooterText) { mergedDiscord.auctionFooterText = b.auctionFooterText; needsRestoreSync = true; }
            if (b.separateAuctionChannel !== undefined && b.separateAuctionChannel !== serverDiscord.separateAuctionChannel) { mergedDiscord.separateAuctionChannel = b.separateAuctionChannel; needsRestoreSync = true; }
            if (b.auctionWebhookUrl && !serverDiscord.auctionWebhookUrl) { mergedDiscord.auctionWebhookUrl = b.auctionWebhookUrl; needsRestoreSync = true; }
            if (b.auctionChannelId && !serverDiscord.auctionChannelId) { mergedDiscord.auctionChannelId = b.auctionChannelId; needsRestoreSync = true; }
            if (b.enableAuctionAlerts !== undefined && serverDiscord.enableAuctionAlerts === undefined) { mergedDiscord.enableAuctionAlerts = b.enableAuctionAlerts; needsRestoreSync = true; }
            if (b.auctionShippingPrivacy && (!serverDiscord.auctionShippingPrivacy || serverDiscord.auctionShippingPrivacy === 'public_safe') && b.auctionShippingPrivacy !== 'public_safe') { mergedDiscord.auctionShippingPrivacy = b.auctionShippingPrivacy; needsRestoreSync = true; }
            if (b.dualPostAuctions !== undefined && serverDiscord.dualPostAuctions === undefined) { mergedDiscord.dualPostAuctions = b.dualPostAuctions; needsRestoreSync = true; }
            if (b.auctionMentionType && !serverDiscord.auctionMentionType) { mergedDiscord.auctionMentionType = b.auctionMentionType; needsRestoreSync = true; }
            if (b.auctionMentionRoleId && !serverDiscord.auctionMentionRoleId) { mergedDiscord.auctionMentionRoleId = b.auctionMentionRoleId; needsRestoreSync = true; }
          }

          // Restore Tiltify custom fields
          if (backup.tiltify) {
            const t = backup.tiltify;
            if (t.campaignId && (!serverTiltify.campaignId || serverTiltify.campaignId === '0mie-charity-2026')) { mergedTiltify.campaignId = t.campaignId; needsRestoreSync = true; }
            if (t.campaignName && !serverTiltify.campaignName) { mergedTiltify.campaignName = t.campaignName; needsRestoreSync = true; }
            if (t.clientId && !serverTiltify.clientId) { mergedTiltify.clientId = t.clientId; needsRestoreSync = true; }
            if (t.clientSecret && !serverTiltify.clientSecret) { mergedTiltify.clientSecret = t.clientSecret; needsRestoreSync = true; }
            if (t.apiToken && !serverTiltify.apiToken) { mergedTiltify.apiToken = t.apiToken; needsRestoreSync = true; }
            if (t.autoPullPreviousAuctions !== undefined && t.autoPullPreviousAuctions !== serverTiltify.autoPullPreviousAuctions) { mergedTiltify.autoPullPreviousAuctions = t.autoPullPreviousAuctions; needsRestoreSync = true; }
            if (t.auctionDateRangeStart && !serverTiltify.auctionDateRangeStart) { mergedTiltify.auctionDateRangeStart = t.auctionDateRangeStart; needsRestoreSync = true; }
            if (t.auctionDateRangeEnd && !serverTiltify.auctionDateRangeEnd) { mergedTiltify.auctionDateRangeEnd = t.auctionDateRangeEnd; needsRestoreSync = true; }
            if (t.auctionHouseIdOrSlug && !serverTiltify.auctionHouseIdOrSlug) { mergedTiltify.auctionHouseIdOrSlug = t.auctionHouseIdOrSlug; needsRestoreSync = true; }
          }

          if (needsRestoreSync) {
            serverDiscord = mergedDiscord;
            serverTiltify = mergedTiltify;
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
                setAutoRestoredAlert(true);
              }
            } catch (syncErr) {
              console.warn('[App] Failed to auto-sync restored backup to server:', syncErr);
            }
          }
        }

        setDiscordConfig(serverDiscord);
        setTiltifyConfig(serverTiltify);
        if (data.status) setStatus(data.status);

        // Keep local backup up to date only if configs are valid
        if (serverDiscord.webhookUrl || serverDiscord.botToken || serverTiltify.campaignId) {
          saveLocalConfigBackup(serverDiscord, serverTiltify);
        }
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
  const handleSaveDiscord = async (updated: Partial<DiscordConfig>, newCampaignName?: string) => {
    const effectiveCampaignName = newCampaignName !== undefined ? newCampaignName : updated.campaignName;
    const body: Record<string, any> = { discord: updated };
    if (effectiveCampaignName !== undefined) {
      body.tiltify = { ...tiltifyConfig, campaignName: effectiveCampaignName };
    }
    const res = await authFetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update Discord settings');
    }
    const data = await res.json();
    setDiscordConfig(data.discord);
    if (data.tiltify) setTiltifyConfig(data.tiltify);
    setStatus(data.status);
    saveLocalConfigBackup(data.discord, data.tiltify || tiltifyConfig);
    setSaveReminder('Configuration saved and backed up in browser! Tip: To ensure Render permanently keeps these settings on future GitHub redeploys, 1-click copy DONIFY_CONFIG or download app-config.json.');
  };

  const handleCampaignNameChange = (name: string) => {
    setTiltifyConfig((prev) => ({ ...prev, campaignName: name }));
    setDiscordConfig((prev) => ({ ...prev, campaignName: name }));
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
    if (data.discord) setDiscordConfig(data.discord);
    setStatus(data.status);
    saveLocalConfigBackup(data.discord || discordConfig, data.tiltify);
    setSaveReminder('Configuration saved and backed up in browser! Tip: To ensure Render permanently keeps these settings on future GitHub redeploys, 1-click copy DONIFY_CONFIG or download app-config.json.');
  };

  // Import configuration JSON
  const handleImportConfig = async (discord: DiscordConfig, tiltify: TiltifyConfig): Promise<boolean> => {
    try {
      const res = await authFetch('/api/config/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discord, tiltify }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.discord) setDiscordConfig(data.discord);
        if (data.tiltify) setTiltifyConfig(data.tiltify);
        if (data.status) setStatus(data.status);
        saveLocalConfigBackup(data.discord || discord, data.tiltify || tiltify);
        return true;
      }
    } catch (e) {
      console.error('Failed to import config:', e);
    }
    return false;
  };

  // Dispatch Discord Test
  const handleTestDiscord = async (overrideCampaignName?: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const activeName =
        overrideCampaignName?.trim() ||
        tiltifyConfig.campaignName?.trim() ||
        discordConfig.campaignName?.trim() ||
        (tiltifyConfig.campaignId ? `Campaign #${tiltifyConfig.campaignId}` : 'Charity Marathon');
      const res = await authFetch('/api/discord/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          donorName: 'Test Supporter',
          amount: 25.0,
          currency: 'USD',
          comment: 'Testing Tiltify-to-Discord alert webhook integration! 🚀',
          campaignName: activeName,
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

  const currentCalendarYear = new Date().getFullYear();
  const slugYearMatch = (tiltifyConfig.campaignId || tiltifyConfig.campaignName || '').match(/\b(202[0-9])\b/);
  const detectedCampaignYear = slugYearMatch ? parseInt(slugYearMatch[1], 10) : null;
  const isPastYearCampaign = Boolean(detectedCampaignYear && detectedCampaignYear < currentCalendarYear);
  const shouldShowAnnualRolloverBanner = isPastYearCampaign && !annualBannerDismissed;

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col selection:bg-teal-500 selection:text-white">
      {/* Header Bar */}
      <Navbar
        status={status}
        hasPassword={hasPassword}
        onOpenGuide={() => setGuideOpen(true)}
        onOpenBackup={() => setBackupOpen(true)}
        onOpenRenderSimplifier={() => setRenderSimplifierOpen(true)}
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

        {/* Annual Campaign Rollover Reminder Banner */}
        {shouldShowAnnualRolloverBanner && (
          <div className="bg-gradient-to-r from-amber-950/50 via-neutral-900 to-neutral-950 border border-amber-800/60 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs animate-fade-in shadow-md">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-900/60 border border-amber-700/50 flex items-center justify-center shrink-0 text-amber-400">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <p className="font-semibold text-amber-200 flex items-center gap-2">
                  <span>Annual Campaign Rollover Notice</span>
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.2 rounded font-mono">
                    Prior Year: {detectedCampaignYear}
                  </span>
                </p>
                <p className="text-amber-300/80 mt-0.5">
                  Your active campaign slug (<code className="text-amber-200 font-mono">{tiltifyConfig.campaignId}</code>) is associated with {detectedCampaignYear}.
                  If you are hosting a new {currentCalendarYear} event, switch to your new annual slug so donation alerts aren't missed!
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setActiveTab('tiltify')}
                className="bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold px-3 py-1.5 rounded-xl text-xs transition-colors shadow-sm flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Switch / Rollover Slug</span>
              </button>
              <button
                onClick={() => setAnnualBannerDismissed(true)}
                className="text-neutral-400 hover:text-white px-2 py-1 rounded text-xs transition-colors"
                title="Dismiss reminder"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Auto-Restored Notification Banner */}
        {autoRestoredAlert && (
          <div className="bg-emerald-950/40 border border-emerald-800/60 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-900/60 border border-emerald-700/50 flex items-center justify-center shrink-0 text-emerald-400">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <p className="font-semibold text-emerald-200">Settings Auto-Restored Successfully!</p>
                <p className="text-emerald-300/80 mt-0.5">
                  Render's container restarted, but Donify automatically synchronized your saved configuration back to the server from your browser backup.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setBackupOpen(true)}
                className="bg-emerald-800/80 hover:bg-emerald-700 text-white font-medium px-3 py-1.5 rounded-xl shrink-0 transition-colors text-xs"
              >
                View Backup Details
              </button>
              <button
                onClick={() => setAutoRestoredAlert(false)}
                className="text-neutral-400 hover:text-white px-2 py-1 rounded text-xs"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Save & Render Backup Reminder Banner */}
        {saveReminder && (
          <div className="bg-indigo-950/40 border border-indigo-800/60 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-indigo-900/60 border border-indigo-700/50 flex items-center justify-center shrink-0 text-indigo-400">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <p className="font-semibold text-indigo-200">Settings Saved &amp; Auto-Backed Up in Browser</p>
                <p className="text-indigo-300/80 mt-0.5">
                  Your browser will auto-restore these settings on redeploys. To make Render remember them permanently even on new devices, copy <code className="text-teal-300">DONIFY_CONFIG</code>.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => {
                  const payload = JSON.stringify({ discord: discordConfig, tiltify: tiltifyConfig });
                  navigator.clipboard.writeText(payload);
                  setCopiedQuickConfig(true);
                  setTimeout(() => setCopiedQuickConfig(false), 2500);
                }}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-3 py-1.5 rounded-xl shrink-0 transition-colors shadow-sm flex items-center gap-1.5 text-xs"
              >
                {copiedQuickConfig ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" /> : <HardDrive className="w-3.5 h-3.5" />}
                <span>{copiedQuickConfig ? 'Copied DONIFY_CONFIG!' : '1-Click Copy for Render'}</span>
              </button>
              <button
                onClick={() => setBackupOpen(true)}
                className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-medium px-2.5 py-1.5 rounded-xl shrink-0 transition-colors text-xs border border-neutral-700"
              >
                All Options
              </button>
              <button
                onClick={() => setSaveReminder(null)}
                className="text-neutral-400 hover:text-white px-2 py-1 rounded text-xs"
              >
                ✕
              </button>
            </div>
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
            onClick={() => setActiveTab('prizes')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
              activeTab === 'prizes'
                ? 'bg-neutral-800 text-white shadow-sm border border-neutral-700'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/60'
            }`}
          >
            <Package className="w-4 h-4 text-amber-400" />
            <span>Prize Shipping &amp; Fulfillment</span>
            <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-md text-[10px] font-mono">
              Individual Prizes
            </span>
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
              campaignName={tiltifyConfig.campaignName || discordConfig.campaignName}
              onSave={handleSaveDiscord}
              onTest={handleTestDiscord}
              onCampaignNameChange={handleCampaignNameChange}
              onOpenRenderSimplifier={() => setRenderSimplifierOpen(true)}
            />
          )}

          {activeTab === 'tiltify' && (
            <TiltifyConfigCard
              config={tiltifyConfig}
              status={status}
              onSave={handleSaveTiltify}
              onPollNow={handlePollNow}
              onOpenRenderSimplifier={() => setRenderSimplifierOpen(true)}
            />
          )}

          {activeTab === 'prizes' && (
            <PrizeShippingCenter onRefreshFeed={fetchDonations} />
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
              defaultCampaignName={tiltifyConfig.campaignName?.trim() || (tiltifyConfig.campaignId ? `Tiltify Campaign #${tiltifyConfig.campaignId}` : 'Community Charity Drive')}
            />
          )}
        </div>
      </main>

      {/* Setup Guide Modal */}
      <SetupGuideModal
        isOpen={guideOpen}
        onClose={() => setGuideOpen(false)}
        webhookEndpoint={webhookEndpoint}
        onOpenRenderSimplifier={() => setRenderSimplifierOpen(true)}
      />

      {/* Render Environment Variables Simplifier Modal */}
      <RenderSimplifierModal
        isOpen={renderSimplifierOpen}
        onClose={() => setRenderSimplifierOpen(false)}
        discordConfig={discordConfig}
        tiltifyConfig={tiltifyConfig}
      />

      {/* Backup & Render Persistence Modal */}
      <BackupModal
        isOpen={backupOpen}
        onClose={() => setBackupOpen(false)}
        discordConfig={discordConfig}
        tiltifyConfig={tiltifyConfig}
        onImportConfig={handleImportConfig}
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
