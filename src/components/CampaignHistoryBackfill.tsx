import React, { useState, useEffect } from 'react';
import { DonationRecord, TiltifyConfig, DiscordConfig } from '../types';
import {
  History,
  Download,
  Send,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  RefreshCw,
  Play,
  ArrowDownUp,
  Search,
  ShieldCheck,
  Gavel,
  HeartHandshake,
  Package,
  Calendar,
  Layers,
  Check,
  ChevronDown,
  Info,
  Users,
} from 'lucide-react';

const DEFAULT_TEAM_PALETTE = [
  '#3B82F6', '#EC4899', '#10B981', '#8B5CF6', '#F97316', '#06B6D4',
  '#EAB308', '#A855F7', '#14B8A6', '#F43F5E', '#6366F1', '#84CC16',
];

function normalizeMemberKey(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function getTeamMemberColor(name: string, customMap?: Record<string, string>): string {
  if (!name) return '#3B82F6';
  const clean = name.trim();
  if (customMap && customMap[clean]) return customMap[clean];
  if (customMap) {
    const lower = clean.toLowerCase();
    for (const [k, v] of Object.entries(customMap)) {
      if (k.toLowerCase() === lower && v) return v;
    }
    const norm = normalizeMemberKey(clean);
    if (norm) {
      for (const [k, v] of Object.entries(customMap)) {
        if (normalizeMemberKey(k) === norm && v) return v;
      }
    }
  }
  const hashKey = normalizeMemberKey(clean) || clean.toLowerCase();
  let hash = 0;
  for (let i = 0; i < hashKey.length; i++) {
    hash = (hash << 5) - hash + hashKey.charCodeAt(i);
    hash |= 0;
  }
  return DEFAULT_TEAM_PALETTE[Math.abs(hash) % DEFAULT_TEAM_PALETTE.length];
}

interface CampaignHistoryBackfillProps {
  tiltifyConfig: TiltifyConfig;
  discordConfig: DiscordConfig;
  donations: DonationRecord[];
  onRefreshDonations: () => Promise<void>;
  onOpenSettingsTab?: (tab: 'discord' | 'tiltify') => void;
  onUpdateTiltify?: (updated: Partial<TiltifyConfig>) => Promise<void>;
  onUpdateDiscord?: (updated: Partial<DiscordConfig>) => Promise<void>;
}

export const CampaignHistoryBackfill: React.FC<CampaignHistoryBackfillProps> = ({
  tiltifyConfig,
  discordConfig,
  donations,
  onRefreshDonations,
  onOpenSettingsTab,
  onUpdateTiltify,
  onUpdateDiscord,
}) => {
  const [isFetchingAll, setIsFetchingAll] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);
  const [fetchMessage, setFetchMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Editable Campaign Identifier & Credentials
  const [localCampaignId, setLocalCampaignId] = useState(tiltifyConfig.campaignId || '9e9a27c5-06a9-4961-bb76-e15e36cac230');
  const [localApiToken, setLocalApiToken] = useState(tiltifyConfig.apiToken || '');
  const [showTokenBox, setShowTokenBox] = useState(!tiltifyConfig.apiToken && (!tiltifyConfig.clientId || !tiltifyConfig.clientSecret));
  const [localWebhookUrl, setLocalWebhookUrl] = useState(discordConfig.webhookUrl || '');
  const [showWebhookBox, setShowWebhookBox] = useState(!discordConfig.webhookUrl && (!discordConfig.botToken || !discordConfig.channelId));
  const [isSavingCreds, setIsSavingCreds] = useState(false);
  const [isLoadingDemo, setIsLoadingDemo] = useState(false);

  // Dispatch setup state
  const [dispatchOrder, setDispatchOrder] = useState<'chronological' | 'reverse'>('chronological');
  const [dispatchFilter, setDispatchFilter] = useState<'all' | 'donations' | 'auctions'>('all');
  const [onlyUnsent, setOnlyUnsent] = useState(true);
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [dispatchProgress, setDispatchProgress] = useState<{
    current: number;
    total: number;
    currentItem?: string;
  } | null>(null);

  // Table filter & search state
  const [tableTab, setTableTab] = useState<'all' | 'unsent' | 'donations' | 'auctions' | 'sent'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [singleSendingId, setSingleSendingId] = useState<string | null>(null);

  const campaignId = localCampaignId.trim() || tiltifyConfig.campaignId || '';

  // Synchronize with external prop changes
  useEffect(() => {
    if (tiltifyConfig.campaignId) setLocalCampaignId(tiltifyConfig.campaignId);
    if (tiltifyConfig.apiToken) {
      setLocalApiToken(tiltifyConfig.apiToken);
      setShowTokenBox(false);
    }
  }, [tiltifyConfig.campaignId, tiltifyConfig.apiToken]);

  useEffect(() => {
    if (discordConfig.webhookUrl) {
      setLocalWebhookUrl(discordConfig.webhookUrl);
      setShowWebhookBox(false);
    }
  }, [discordConfig.webhookUrl]);

  // Calculate statistics from donations: distinguish pure direct donations from auction winning payments
  const isAuctionItem = (d: DonationRecord) =>
    Boolean(d.auction) || d.eventType === 'auction_ended' || Boolean(d.isAuctionDonation);

  const auctionsOnly = donations.filter((d) => isAuctionItem(d));
  const donationsOnly = donations.filter((d) => !isAuctionItem(d));
  const unsentList = donations.filter((d) => d.discordStatus !== 'sent');
  const sentList = donations.filter((d) => d.discordStatus === 'sent');

  const directDonationsSum = donationsOnly.reduce((s, d) => s + (typeof d.amount === 'number' ? d.amount : 0), 0);
  const auctionsSum = auctionsOnly.reduce((s, d) => s + (typeof d.amount === 'number' ? d.amount : (d.auction?.winningBid || 0)), 0);

  // Authoritative total: direct donations + auction winning bids
  const totalRaisedSum = directDonationsSum + auctionsSum;

  // Chronological sort helper (Oldest first)
  const getSortedByChronology = (list: DonationRecord[]) => {
    return [...list].sort((a, b) => new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime());
  };

  const chronologicalList = getSortedByChronology(donations);
  const earliestDate = chronologicalList.length > 0 ? chronologicalList[0].receivedAt : null;
  const latestDate = chronologicalList.length > 0 ? chronologicalList[chronologicalList.length - 1].receivedAt : null;

  // Filtered list for display
  const filteredDonations = donations.filter((d) => {
    const isAuction = isAuctionItem(d);
    if (tableTab === 'unsent' && d.discordStatus === 'sent') return false;
    if (tableTab === 'sent' && d.discordStatus !== 'sent') return false;
    if (tableTab === 'donations' && isAuction) return false;
    if (tableTab === 'auctions' && !isAuction) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const name = (d.donorName || d.auction?.winnerName || '').toLowerCase();
      const title = (d.auction?.itemTitle || d.reward?.name || d.comment || '').toLowerCase();
      const amountStr = String(d.amount);
      return name.includes(q) || title.includes(q) || amountStr.includes(q);
    }
    return true;
  });

  // Sort displayed items based on current dispatch order toggle
  const sortedDisplayList = [...filteredDonations].sort((a, b) => {
    const timeA = new Date(a.receivedAt).getTime();
    const timeB = new Date(b.receivedAt).getTime();
    return dispatchOrder === 'chronological' ? timeA - timeB : timeB - timeA;
  });

  // 1. Fetch All Historical Data from Start of Campaign
  const handleFetchAllData = async (overrideToken?: string) => {
    const targetCid = localCampaignId.trim();
    if (!targetCid) {
      setFetchMessage({
        type: 'error',
        text: 'Please enter a Tiltify Campaign ID, UUID, or slug above.',
      });
      return;
    }

    const effectiveToken = (overrideToken !== undefined ? overrideToken : localApiToken).trim();

    setIsFetchingAll(true);
    setFetchMessage(null);
    try {
      const adminToken = localStorage.getItem('tiltify_admin_token');
      const res = await fetch('/api/tiltify/backfill/fetch-all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
        },
        body: JSON.stringify({
          campaignId: targetCid,
          apiToken: effectiveToken || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        const errorMsg = data.error || 'Failed to poll campaign history.';
        if (errorMsg.includes('401') || errorMsg.includes('Access Token') || errorMsg.includes('token')) {
          setShowTokenBox(true);
        }
        throw new Error(errorMsg);
      }

      await onRefreshDonations();
      setFetchMessage({
        type: 'success',
        text: `🎉 ${data.message || 'Retrieved all donations and auction lots from campaign start!'}`,
      });
    } catch (err: any) {
      setFetchMessage({
        type: 'error',
        text: err.message || 'Error querying Tiltify API for campaign history.',
      });
    } finally {
      setIsFetchingAll(false);
    }
  };

  // 1b. Save Tiltify Token & Poll History
  const handleSaveTokenAndPoll = async () => {
    if (!localApiToken.trim()) {
      setFetchMessage({ type: 'error', text: 'Please paste your Tiltify API Token before saving.' });
      return;
    }
    setIsSavingCreds(true);
    try {
      if (onUpdateTiltify) {
        await onUpdateTiltify({
          campaignId: localCampaignId.trim(),
          apiToken: localApiToken.trim(),
        });
      }
      setShowTokenBox(false);
      await handleFetchAllData(localApiToken.trim());
    } catch (err: any) {
      setFetchMessage({ type: 'error', text: err.message || 'Failed to save Tiltify token.' });
    } finally {
      setIsSavingCreds(false);
    }
  };

  // 1c. Save Discord Webhook URL
  const handleSaveDiscordWebhook = async () => {
    if (!localWebhookUrl.trim()) return;
    setIsSavingCreds(true);
    try {
      if (onUpdateDiscord) {
        await onUpdateDiscord({ webhookUrl: localWebhookUrl.trim() });
      }
      setShowWebhookBox(false);
      setFetchMessage({ type: 'success', text: 'Discord Webhook URL saved successfully!' });
    } catch (err: any) {
      setFetchMessage({ type: 'error', text: err.message || 'Failed to save Discord webhook.' });
    } finally {
      setIsSavingCreds(false);
    }
  };

  // 1d. Load Verified Sample Campaign Data for Instant Preview / Testing
  const handleLoadDemoHistory = async () => {
    setIsLoadingDemo(true);
    setFetchMessage(null);
    try {
      const adminToken = localStorage.getItem('tiltify_admin_token');
      const res = await fetch('/api/tiltify/backfill/load-demo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
        },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to load demo history.');
      }
      await onRefreshDonations();
      setFetchMessage({
        type: 'success',
        text: `🎉 ${data.message || 'Loaded verified campaign history with 4 completed auction items and donations!'}`,
      });
    } catch (err: any) {
      setFetchMessage({ type: 'error', text: err.message });
    } finally {
      setIsLoadingDemo(false);
    }
  };

  // 2. Dispatch a single item to Discord
  const handleDispatchSingle = async (id: string) => {
    setSingleSendingId(id);
    try {
      const token = localStorage.getItem('tiltify_admin_token');
      const res = await fetch('/api/tiltify/backfill/dispatch-single', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to dispatch alert to Discord.');
      }
      await onRefreshDonations();
    } catch (err: any) {
      alert(`Error sending to Discord: ${err.message}`);
    } finally {
      setSingleSendingId(null);
    }
  };

  // 3. Batch Dispatch All Items in Chosen Order (Chronological natural stream order)
  const handleExecuteBatchDispatch = async () => {
    // Get candidate items to dispatch
    let candidateItems = donations.filter((d) => {
      const isAuction = isAuctionItem(d);
      if (dispatchFilter === 'donations' && isAuction) return false;
      if (dispatchFilter === 'auctions' && !isAuction) return false;
      if (onlyUnsent && d.discordStatus === 'sent') return false;
      return true;
    });

    // Sort according to user preference:
    candidateItems.sort((a, b) => {
      const timeA = new Date(a.receivedAt).getTime();
      const timeB = new Date(b.receivedAt).getTime();
      return dispatchOrder === 'chronological' ? timeA - timeB : timeB - timeA;
    });

    if (candidateItems.length === 0) {
      alert('No items match the selected filter to send.');
      return;
    }

    setIsDispatching(true);
    setDispatchProgress({ current: 0, total: candidateItems.length });

    try {
      const token = localStorage.getItem('tiltify_admin_token');
      const res = await fetch('/api/tiltify/backfill/dispatch-all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          order: dispatchOrder,
          filter: dispatchFilter,
          onlyUnsent,
          delayMs: 1000,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to dispatch batch.');
      }
      await onRefreshDonations();
      setShowDispatchModal(false);
      setFetchMessage({
        type: 'success',
        text: `✅ Dispatched ${data.dispatchedCount} past event(s) to Discord in ${
          dispatchOrder === 'chronological' ? 'natural chronological order (oldest first)' : 'reverse order'
        }!`,
      });
    } catch (err: any) {
      setFetchMessage({
        type: 'error',
        text: `Error during batch dispatch: ${err.message}`,
      });
    } finally {
      setIsDispatching(false);
      setDispatchProgress(null);
    }
  };

  const formatMoney = (amount: number, currency: string = 'USD') => {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency.toUpperCase() || 'USD',
      }).format(amount);
    } catch {
      return `$${amount.toFixed(2)}`;
    }
  };

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Hero */}
      <div className="bg-gradient-to-r from-teal-950/40 via-indigo-950/30 to-neutral-900 border border-teal-800/50 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-3 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-400 shrink-0">
              <History className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-bold text-white">Campaign History &amp; Discord Catch-Up</h3>
                <span className="text-[10px] bg-teal-500/20 text-teal-300 border border-teal-500/30 px-2 py-0.5 rounded-full font-bold">
                  Day 1 ➔ Today
                </span>
              </div>
              <p className="text-xs text-neutral-300 mt-1 max-w-2xl leading-relaxed">
                Poll all past donations and ended auctions from the start of your campaign, inspect winner fulfillment info, and stream them to your Discord server in natural chronological order!
              </p>

              {/* Editable Campaign Identifier Input */}
              <div className="mt-3 flex items-center gap-2 max-w-md">
                <span className="text-xs text-neutral-400 shrink-0 font-medium">Campaign:</span>
                <input
                  type="text"
                  value={localCampaignId}
                  onChange={(e) => setLocalCampaignId(e.target.value)}
                  placeholder="Campaign UUID (e.g. 9e9a27c5...) or slug"
                  className="bg-neutral-950 border border-neutral-700/80 rounded-lg px-2.5 py-1 text-xs text-neutral-200 font-mono w-full focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <button
              onClick={() => handleFetchAllData()}
              disabled={isFetchingAll}
              className="flex items-center gap-1.5 bg-neutral-800 hover:bg-neutral-700 text-white px-4 py-2 rounded-xl text-xs font-semibold border border-neutral-700 transition-colors shadow-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-teal-400 ${isFetchingAll ? 'animate-spin' : ''}`} />
              <span>{isFetchingAll ? 'Polling All History...' : 'Poll from Campaign Start'}</span>
            </button>

            <button
              onClick={() => setShowDispatchModal(true)}
              disabled={donations.length === 0 || isDispatching}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-semibold transition-colors shadow-sm disabled:opacity-40"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send to Discord</span>
              {unsentList.length > 0 && (
                <span className="bg-indigo-950/80 text-indigo-200 text-[10px] px-1.5 py-0.2 rounded-full border border-indigo-400/40">
                  {unsentList.length} unsent
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Tiltify API Token Box (shown when token is missing or if 401 error occurs) */}
        {showTokenBox && (
          <div className="mt-4 p-4 rounded-xl bg-amber-950/40 border border-amber-600/50 text-amber-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs font-bold text-amber-300 block">Tiltify v5 API Token Required to Query History</span>
                  <p className="text-[11px] text-amber-300/80 mt-0.5">
                    Tiltify v5 API requires an API Access Token (Bearer Token) to read donations and completed auctions. You can generate one in your Tiltify dashboard under <span className="font-semibold text-white">Settings ➔ My Applications / Developer</span>.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <input
                  type="password"
                  value={localApiToken}
                  onChange={(e) => setLocalApiToken(e.target.value)}
                  placeholder="Paste Tiltify API Token"
                  className="bg-neutral-950 border border-amber-700/60 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono w-full sm:w-64 focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
                <button
                  onClick={handleSaveTokenAndPoll}
                  disabled={isSavingCreds || !localApiToken.trim()}
                  className="bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold px-3 py-1.5 rounded-lg text-xs transition-colors shrink-0 disabled:opacity-50"
                >
                  {isSavingCreds ? 'Saving...' : 'Save & Poll'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Discord Webhook Missing Warning */}
        {showWebhookBox && (
          <div className="mt-4 p-4 rounded-xl bg-indigo-950/40 border border-indigo-600/50 text-indigo-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs font-bold text-indigo-300 block">Discord Webhook Not Configured</span>
                  <p className="text-[11px] text-indigo-300/80 mt-0.5">
                    To send past donations and prize shipping cards into your Discord server, enter your Discord Webhook URL.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <input
                  type="text"
                  value={localWebhookUrl}
                  onChange={(e) => setLocalWebhookUrl(e.target.value)}
                  placeholder="https://discord.com/api/webhooks/..."
                  className="bg-neutral-950 border border-indigo-700/60 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono w-full sm:w-64 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                />
                <button
                  onClick={handleSaveDiscordWebhook}
                  disabled={isSavingCreds || !localWebhookUrl.trim()}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition-colors shrink-0 disabled:opacity-50"
                >
                  {isSavingCreds ? 'Saving...' : 'Save Webhook'}
                </button>
              </div>
            </div>
          </div>
        )}

        {fetchMessage && (
          <div
            className={`mt-4 p-3.5 rounded-xl text-xs flex items-center justify-between gap-2 ${
              fetchMessage.type === 'success'
                ? 'bg-emerald-950/60 border border-emerald-800/80 text-emerald-300'
                : 'bg-rose-950/60 border border-rose-800/80 text-rose-300'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {fetchMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              )}
              <span>{fetchMessage.text}</span>
            </div>
            {fetchMessage.type === 'error' && (
              <div className="flex items-center gap-2 shrink-0">
                {!localApiToken && (
                  <button
                    onClick={() => setShowTokenBox(true)}
                    className="underline text-xs text-rose-200 hover:text-white"
                  >
                    Enter API Token
                  </button>
                )}
                <button
                  onClick={handleLoadDemoHistory}
                  disabled={isLoadingDemo}
                  className="bg-neutral-900 border border-rose-700 hover:bg-rose-950 text-rose-200 px-2 py-1 rounded text-[11px] font-semibold transition-colors"
                >
                  {isLoadingDemo ? 'Loading Sample...' : 'Load Sample Campaign Data'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Overview Stat Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3.5">
          <div className="flex items-center justify-between text-neutral-400 text-xs mb-1">
            <span className="uppercase tracking-wider text-[10px] font-semibold">Total Funds Raised</span>
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl font-bold text-white tracking-tight">
            ${totalRaisedSum.toFixed(2)}
          </div>
          <div className="text-[11px] text-neutral-400 mt-0.5">Across all campaign history</div>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3.5">
          <div className="flex items-center justify-between text-neutral-400 text-xs mb-1">
            <span className="uppercase tracking-wider text-[10px] font-semibold">Direct Donations</span>
            <HeartHandshake className="w-3.5 h-3.5 text-teal-400" />
          </div>
          <div className="text-xl font-bold text-white tracking-tight">
            {donationsOnly.length}
          </div>
          <div className="text-[11px] text-teal-400 mt-0.5">
            ${directDonationsSum.toFixed(2)} total
          </div>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3.5">
          <div className="flex items-center justify-between text-neutral-400 text-xs mb-1">
            <span className="uppercase tracking-wider text-[10px] font-semibold">Auctions &amp; Prizes</span>
            <Gavel className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-xl font-bold text-white tracking-tight">
            {auctionsOnly.length}
          </div>
          <div className="text-[11px] text-amber-400 mt-0.5">
            ${auctionsSum.toFixed(2)} in winning bids
          </div>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3.5">
          <div className="flex items-center justify-between text-neutral-400 text-xs mb-1">
            <span className="uppercase tracking-wider text-[10px] font-semibold">Discord Status</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div className="text-xl font-bold text-white tracking-tight">
            {sentList.length} / {donations.length}
          </div>
          <div className="text-[11px] text-neutral-400 mt-0.5">
            {unsentList.length > 0 ? (
              <span className="text-amber-400 font-medium">{unsentList.length} ready to dispatch</span>
            ) : (
              <span className="text-emerald-400 font-medium">100% delivered to Discord</span>
            )}
          </div>
        </div>
      </div>

      {/* Event List Section */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
        {/* Controls Bar: Search, Filters, Order Indicator */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-800">
          {/* Subtabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
            <button
              onClick={() => setTableTab('all')}
              className={`px-3 py-1.5 rounded-xl font-medium transition-colors shrink-0 ${
                tableTab === 'all'
                  ? 'bg-neutral-800 text-white shadow-sm border border-neutral-700'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              All ({donations.length})
            </button>
            <button
              onClick={() => setTableTab('unsent')}
              className={`px-3 py-1.5 rounded-xl font-medium transition-colors shrink-0 flex items-center gap-1.5 ${
                tableTab === 'unsent'
                  ? 'bg-amber-950/80 border border-amber-800/80 text-amber-300'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <span>Unsent to Discord</span>
              <span className="bg-amber-500/20 px-1.5 py-0.2 rounded-full text-[10px] font-mono">
                {unsentList.length}
              </span>
            </button>
            <button
              onClick={() => setTableTab('donations')}
              className={`px-3 py-1.5 rounded-xl font-medium transition-colors shrink-0 ${
                tableTab === 'donations'
                  ? 'bg-teal-950/80 border border-teal-800/80 text-teal-300'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Donations ({donationsOnly.length})
            </button>
            <button
              onClick={() => setTableTab('auctions')}
              className={`px-3 py-1.5 rounded-xl font-medium transition-colors shrink-0 ${
                tableTab === 'auctions'
                  ? 'bg-amber-950/80 border border-amber-800/80 text-amber-300'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Auctions ({auctionsOnly.length})
            </button>
            <button
              onClick={() => setTableTab('sent')}
              className={`px-3 py-1.5 rounded-xl font-medium transition-colors shrink-0 ${
                tableTab === 'sent'
                  ? 'bg-emerald-950/80 border border-emerald-800/80 text-emerald-300'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Delivered ({sentList.length})
            </button>
          </div>

          {/* Search Bar & Order Toggle */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-48">
              <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search events..."
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-8 pr-2.5 py-1.5 text-xs text-neutral-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <button
              onClick={() => setDispatchOrder(dispatchOrder === 'chronological' ? 'reverse' : 'chronological')}
              className="flex items-center gap-1.5 bg-neutral-950 border border-neutral-800 hover:border-neutral-700 text-neutral-300 px-2.5 py-1.5 rounded-xl text-xs transition-colors shrink-0"
              title="Toggle sort order"
            >
              <ArrowDownUp className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline">
                {dispatchOrder === 'chronological' ? 'Oldest First' : 'Newest First'}
              </span>
            </button>
          </div>
        </div>

        {/* Chronological Stream Order Banner Notice */}
        <div className="bg-indigo-950/20 border border-indigo-800/40 rounded-xl p-3 flex items-center justify-between gap-3 text-xs text-indigo-200">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>
              <strong>Stream Timeline Order:</strong> Items are sorted{' '}
              <strong className="text-teal-300">
                {dispatchOrder === 'chronological' ? 'Oldest ➔ Newest' : 'Newest ➔ Oldest'}
              </strong>
              . When sent to Discord, they arrive in this exact sequence so Discord chat reads in natural chronological order!
            </span>
          </div>
          <button
            onClick={() => setDispatchOrder(dispatchOrder === 'chronological' ? 'reverse' : 'chronological')}
            className="text-[11px] text-teal-300 hover:underline shrink-0"
          >
            Switch to {dispatchOrder === 'chronological' ? 'Newest First' : 'Oldest First'}
          </button>
        </div>

        {/* Table of Events */}
        {sortedDisplayList.length === 0 ? (
          <div className="py-12 text-center text-neutral-400 text-xs">
            <History className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
            <p className="font-semibold text-neutral-300">No events found matching this view</p>
            <p className="text-[11px] text-neutral-500 mt-1">
              Click <strong>"Poll from Campaign Start"</strong> above to retrieve all donations &amp; auctions from Tiltify!
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {sortedDisplayList.map((item, index) => {
              const isAuction = Boolean(item.auction) || item.eventType === 'auction_ended';
              const isAuctionDonation = Boolean(item.isAuctionDonation) || (!isAuction && /auction/i.test(`${item.comment || ''} ${item.donorName || ''}`));
              const isDelivered = item.discordStatus === 'sent';
              const isFailed = item.discordStatus === 'failed';
              const isPending = !isDelivered && !isFailed;
              const memberColor = item.teamMemberName ? getTeamMemberColor(item.teamMemberName, discordConfig?.teamMemberColors) : null;

              const borderStyle: React.CSSProperties = (isAuction || isAuctionDonation)
                ? { borderLeftWidth: '4px', borderLeftColor: discordConfig?.auctionEmbedColor || '#F59E0B' }
                : memberColor
                ? { borderLeftWidth: '4px', borderLeftColor: memberColor }
                : {};

              return (
                <div
                  key={item.id}
                  style={borderStyle}
                  className="bg-neutral-950/80 border border-neutral-800/80 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-neutral-700 transition-all text-xs"
                >
                  {/* Left: Sequence index, icon, donor name, comment */}
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="w-6 h-6 rounded-lg bg-neutral-900 border border-neutral-800 text-[10px] font-mono flex items-center justify-center text-neutral-400 shrink-0 mt-0.5">
                      #{index + 1}
                    </span>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-white text-xs truncate">
                          {item.donorName || item.auction?.winnerName || 'Anonymous Supporter'}
                        </span>

                        {isAuction ? (
                          <span className="text-[10px] bg-amber-500/10 text-amber-300 border border-amber-500/30 px-1.5 py-0.2 rounded font-medium flex items-center gap-1">
                            <Gavel className="w-2.5 h-2.5" />
                            <span>Auction Win</span>
                          </span>
                        ) : isAuctionDonation ? (
                          <span className="text-[10px] bg-amber-500/15 text-amber-300 border border-amber-500/40 px-1.5 py-0.2 rounded font-medium flex items-center gap-1">
                            <Gavel className="w-2.5 h-2.5" />
                            <span>Auction Donation</span>
                          </span>
                        ) : (
                          <span className="text-[10px] bg-teal-500/10 text-teal-300 border border-teal-500/30 px-1.5 py-0.2 rounded font-medium flex items-center gap-1">
                            <HeartHandshake className="w-2.5 h-2.5" />
                            <span>Donation</span>
                          </span>
                        )}

                        {item.teamMemberName && (
                          <span
                            className="text-[10px] px-1.5 py-0.2 rounded font-medium flex items-center gap-1 border"
                            style={{
                              backgroundColor: `${memberColor}20`,
                              borderColor: `${memberColor}50`,
                              color: memberColor || '#60A5FA',
                            }}
                          >
                            <Users className="w-2.5 h-2.5" />
                            <span className="truncate max-w-[120px]">{item.teamMemberName}</span>
                          </span>
                        )}

                        <span className="text-neutral-500 text-[10px] flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-neutral-600" />
                          <span>{formatDate(item.receivedAt)}</span>
                        </span>
                      </div>

                      {/* Detail: Auction item or Reward title */}
                      {isAuction && item.auction?.itemTitle && (
                        <p className="text-[11px] text-amber-200/90 font-medium truncate mt-0.5 flex items-center gap-1">
                          <span>🏆 Won Item:</span>
                          <span className="truncate">{item.auction.itemTitle}</span>
                          {item.auction.shippingAddress && (
                            <span className="text-[9px] bg-amber-950/80 text-amber-300 px-1 rounded ml-1">
                              📦 Physical Shipping
                            </span>
                          )}
                        </p>
                      )}

                      {!isAuction && item.reward?.name && (
                        <p className="text-[11px] text-teal-300/90 font-medium truncate mt-0.5 flex items-center gap-1">
                          <span>🎁 Reward:</span>
                          <span className="truncate">{item.reward.name}</span>
                        </p>
                      )}

                      {item.comment && (
                        <p className="text-[11px] text-neutral-400 italic truncate mt-0.5 max-w-lg">
                          "{item.comment}"
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right: Amount, Status badge & Individual Send Button */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-neutral-900">
                    <div className="text-right">
                      <span className="font-bold text-white text-sm block">
                        {formatMoney(item.amount, item.currency)}
                      </span>
                      {isDelivered && (
                        <span className="text-[10px] text-emerald-400 flex items-center justify-end gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Delivered
                        </span>
                      )}
                      {isPending && (
                        <span className="text-[10px] text-amber-400 flex items-center justify-end gap-1">
                          <Clock className="w-3 h-3" />
                          Not Sent
                        </span>
                      )}
                      {isFailed && (
                        <span className="text-[10px] text-rose-400 flex items-center justify-end gap-1">
                          <AlertCircle className="w-3 h-3" />
                          Failed
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() => handleDispatchSingle(item.id)}
                      disabled={singleSendingId === item.id || isDispatching}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm shrink-0 ${
                        isDelivered
                          ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700'
                          : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                      }`}
                      title={isDelivered ? 'Resend alert to Discord' : 'Send this alert to Discord'}
                    >
                      {singleSendingId === item.id ? (
                        <RefreshCw className="w-3 h-3 animate-spin text-white" />
                      ) : (
                        <Send className="w-3 h-3" />
                      )}
                      <span>{isDelivered ? 'Resend' : 'Send to Discord'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL: Backfill Dispatcher Dialog */}
      {showDispatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-lg w-full shadow-2xl p-6 relative">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
                <Send className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Send Past Campaign Events to Discord</h3>
                <p className="text-xs text-neutral-400">
                  Catch up your Discord server with past donations &amp; ended auctions
                </p>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              {/* Order Selection: The key requested feature */}
              <div>
                <label className="text-[11px] font-semibold text-neutral-300 uppercase tracking-wider block mb-2">
                  Delivery Order into Discord:
                </label>
                <div className="grid grid-cols-1 gap-2">
                  <label
                    className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                      dispatchOrder === 'chronological'
                        ? 'bg-teal-950/40 border-teal-500/80 ring-1 ring-teal-500/50'
                        : 'bg-neutral-950 border-neutral-800 hover:border-neutral-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="dispatchOrder"
                      value="chronological"
                      checked={dispatchOrder === 'chronological'}
                      onChange={() => setDispatchOrder('chronological')}
                      className="mt-0.5 text-teal-500 focus:ring-teal-500"
                    />
                    <div>
                      <div className="flex items-center gap-1.5 font-bold text-white">
                        <span>🌟 Chronological Order (Oldest First ➔ Newest Last)</span>
                        <span className="text-[10px] bg-teal-500/20 text-teal-300 px-1.5 py-0.2 rounded font-mono">
                          Recommended
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-400 mt-0.5 leading-relaxed">
                        Posts in the exact order donations occurred from the beginning of your campaign. As Discord scrolls down, your chat reflects the true historical stream order!
                      </p>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                      dispatchOrder === 'reverse'
                        ? 'bg-indigo-950/40 border-indigo-500/80 ring-1 ring-indigo-500/50'
                        : 'bg-neutral-950 border-neutral-800 hover:border-neutral-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="dispatchOrder"
                      value="reverse"
                      checked={dispatchOrder === 'reverse'}
                      onChange={() => setDispatchOrder('reverse')}
                      className="mt-0.5 text-indigo-500 focus:ring-indigo-500"
                    />
                    <div>
                      <div className="font-bold text-neutral-200">
                        <span>🔄 Reverse Order (Newest First ➔ Oldest Last)</span>
                      </div>
                      <p className="text-[11px] text-neutral-400 mt-0.5 leading-relaxed">
                        Posts the most recent events first, descending backward in time.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* What to Send Filter */}
              <div>
                <label className="text-[11px] font-semibold text-neutral-300 uppercase tracking-wider block mb-1.5">
                  What would you like to send?
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setDispatchFilter('all')}
                    className={`p-2 rounded-xl text-center border font-medium transition-all ${
                      dispatchFilter === 'all'
                        ? 'bg-neutral-800 border-neutral-600 text-white shadow-sm'
                        : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white'
                    }`}
                  >
                    All ({donations.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setDispatchFilter('donations')}
                    className={`p-2 rounded-xl text-center border font-medium transition-all ${
                      dispatchFilter === 'donations'
                        ? 'bg-teal-950 border-teal-600 text-teal-300 shadow-sm'
                        : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white'
                    }`}
                  >
                    Donations ({donationsOnly.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setDispatchFilter('auctions')}
                    className={`p-2 rounded-xl text-center border font-medium transition-all ${
                      dispatchFilter === 'auctions'
                        ? 'bg-amber-950 border-amber-600 text-amber-300 shadow-sm'
                        : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white'
                    }`}
                  >
                    Auctions ({auctionsOnly.length})
                  </button>
                </div>
              </div>

              {/* Unsent Only Checkbox */}
              <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-800">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={onlyUnsent}
                    onChange={(e) => setOnlyUnsent(e.target.checked)}
                    className="rounded bg-neutral-900 border-neutral-700 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                  />
                  <div>
                    <span className="font-semibold text-white block">
                      Skip items already delivered to Discord
                    </span>
                    <span className="text-[11px] text-neutral-400 block mt-0.5">
                      Prevents duplicate alerts for events previously sent to your server.
                    </span>
                  </div>
                </label>
              </div>

              {/* Rate limit protection notice */}
              <div className="text-[11px] text-neutral-400 flex items-center gap-1.5 bg-neutral-950/60 p-2.5 rounded-lg border border-neutral-850">
                <Info className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span>
                  Alerts are safely paced (1 second apart) to guarantee Discord's webhook rate limits are never exceeded.
                </span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 mt-5 pt-4 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setShowDispatchModal(false)}
                disabled={isDispatching}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl text-xs font-medium transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleExecuteBatchDispatch}
                disabled={isDispatching}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-colors shadow-sm disabled:opacity-50"
              >
                {isDispatching ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Dispatching Alerts...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Start Discord Dispatch</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
