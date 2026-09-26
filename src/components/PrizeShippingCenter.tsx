import React, { useState, useEffect } from 'react';
import {
  Package,
  Mail,
  MapPin,
  CheckCircle2,
  Clock,
  Send,
  Download,
  Copy,
  Check,
  Edit2,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  Truck,
  Sparkles,
  Search,
  Filter
} from 'lucide-react';
import { RewardDeliveryAddress } from '../types';

export interface PrizeItem {
  id: string;
  donationId: string;
  tiltifyId?: string;
  type: 'auction' | 'reward';
  title: string;
  description?: string;
  winnerName: string;
  winnerEmail?: string;
  amount: number;
  currency: string;
  prizeType: 'physical' | 'email' | 'both' | 'none';
  shippingAddress?: RewardDeliveryAddress;
  specialInstructions?: string;
  shippingStatus: 'pending' | 'shipped' | 'delivered';
  trackingNumber?: string;
  fulfillmentNotes?: string;
  discordStatus?: 'sent' | 'failed' | 'pending';
  discordError?: string;
  campaignName?: string;
  receivedAt: string;
}

interface PrizeShippingCenterProps {
  onRefreshFeed?: () => void;
}

export function PrizeShippingCenter({ onRefreshFeed }: PrizeShippingCenterProps) {
  const [prizes, setPrizes] = useState<PrizeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'physical' | 'digital' | 'pending' | 'shipped'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingPrize, setEditingPrize] = useState<PrizeItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDispatchingAll, setIsDispatchingAll] = useState(false);
  const [dispatchingId, setDispatchingId] = useState<string | null>(null);
  const [bannerMessage, setBannerMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const getAuthHeaders = (): Record<string, string> => {
    const token = localStorage.getItem('tiltify_admin_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchPrizes = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/prizes', {
        headers: { Accept: 'application/json', ...getAuthHeaders() },
      });
      if (res.ok) {
        const data = await res.json();
        setPrizes(data.prizes || []);
      }
    } catch (err: any) {
      console.warn('Failed to load prizes:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPrizes();
  }, []);

  const handleCopyAddress = (prize: PrizeItem) => {
    const addr = prize.shippingAddress;
    const recipient = addr?.recipientName || prize.winnerName;
    const lines = [
      recipient,
      addr?.addressLine1,
      addr?.addressLine2,
      [addr?.city, addr?.region, addr?.postalCode].filter(Boolean).join(', '),
      addr?.country,
    ].filter(Boolean);

    const fullText = lines.join('\n');
    navigator.clipboard.writeText(fullText);
    setCopiedId(prize.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleDispatchSingle = async (prizeId: string) => {
    setDispatchingId(prizeId);
    setBannerMessage(null);
    try {
      const res = await fetch('/api/tiltify/dispatch-prizes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ prizeId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setBannerMessage({ type: 'success', text: `Sent shipping alert for prize to Discord!` });
        await fetchPrizes();
        if (onRefreshFeed) onRefreshFeed();
      } else {
        throw new Error(data.error || 'Failed to dispatch prize to Discord');
      }
    } catch (err: any) {
      setBannerMessage({ type: 'error', text: err.message || 'Error sending to Discord' });
    } finally {
      setDispatchingId(null);
    }
  };

  const handleDispatchAll = async () => {
    setIsDispatchingAll(true);
    setBannerMessage(null);
    try {
      const res = await fetch('/api/tiltify/dispatch-prizes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setBannerMessage({ type: 'success', text: data.message || `Dispatched all prize cards to Discord!` });
        await fetchPrizes();
        if (onRefreshFeed) onRefreshFeed();
      } else {
        throw new Error(data.error || 'Failed to dispatch prizes to Discord');
      }
    } catch (err: any) {
      setBannerMessage({ type: 'error', text: err.message || 'Failed to dispatch prizes' });
    } finally {
      setIsDispatchingAll(false);
    }
  };

  const handleUpdateFulfillment = async (updated: Partial<PrizeItem>) => {
    if (!editingPrize) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/donations/${editingPrize.donationId}/fulfillment`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          shippingStatus: updated.shippingStatus ?? editingPrize.shippingStatus,
          trackingNumber: updated.trackingNumber ?? editingPrize.trackingNumber,
          fulfillmentNotes: updated.fulfillmentNotes ?? editingPrize.fulfillmentNotes,
          itemTitle: updated.title ?? editingPrize.title,
          winnerName: updated.winnerName ?? editingPrize.winnerName,
          winnerEmail: updated.winnerEmail ?? editingPrize.winnerEmail,
          shippingAddress: updated.shippingAddress ?? editingPrize.shippingAddress,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setEditingPrize(null);
        await fetchPrizes();
        if (onRefreshFeed) onRefreshFeed();
      } else {
        throw new Error(data.error || 'Failed to update prize fulfillment');
      }
    } catch (err: any) {
      alert(err.message || 'Error saving fulfillment updates');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredPrizes = prizes.filter((p) => {
    if (filter === 'physical' && p.prizeType === 'email') return false;
    if (filter === 'digital' && p.prizeType === 'physical') return false;
    if (filter === 'pending' && p.shippingStatus !== 'pending') return false;
    if (filter === 'shipped' && p.shippingStatus !== 'shipped' && p.shippingStatus !== 'delivered') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = p.title.toLowerCase().includes(q);
      const matchWinner = p.winnerName.toLowerCase().includes(q);
      const matchEmail = (p.winnerEmail || '').toLowerCase().includes(q);
      const matchCity = (p.shippingAddress?.city || '').toLowerCase().includes(q);
      const matchTracking = (p.trackingNumber || '').toLowerCase().includes(q);
      return matchTitle || matchWinner || matchEmail || matchCity || matchTracking;
    }
    return true;
  });

  const physicalPendingCount = prizes.filter(
    (p) => p.prizeType !== 'email' && p.shippingStatus === 'pending'
  ).length;

  const totalPrizeAmount = prizes.reduce((sum, p) => sum + (p.amount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header & Metrics Banner */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <span>Prize Fulfillment &amp; Shipping Center</span>
                  <span className="text-xs bg-amber-500/10 text-amber-300 border border-amber-500/20 px-2.5 py-0.5 rounded-full font-mono font-medium">
                    {prizes.length} Individual Prizes
                  </span>
                </h2>
                <p className="text-xs text-neutral-400 mt-0.5">
                  View each completed auction lot and claimed reward individually with winner shipping addresses and Discord delivery cards.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={fetchPrizes}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition-colors"
              title="Refresh prize list"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            <a
              href="/api/prizes/manifest.csv"
              download="tiltify-prize-shipping-manifest.csv"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition-colors shadow-sm"
              title="Export spreadsheet of all prizes with addresses"
            >
              <Download className="w-3.5 h-3.5 text-teal-400" />
              <span>Export CSV Manifest</span>
            </a>

            <button
              onClick={handleDispatchAll}
              disabled={isDispatchingAll || prizes.length === 0}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white transition-colors shadow-sm"
            >
              <Send className={`w-3.5 h-3.5 ${isDispatchingAll ? 'animate-spin' : ''}`} />
              <span>{isDispatchingAll ? 'Sending All Cards...' : 'Send All Prize Cards to Discord'}</span>
            </button>
          </div>
        </div>

        {/* 4 Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-neutral-800/80">
          <div className="bg-neutral-950/60 border border-neutral-800/80 rounded-2xl p-3.5">
            <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Total Prizes</div>
            <div className="text-xl font-bold text-white mt-1">{prizes.length}</div>
            <div className="text-[10px] text-neutral-400 mt-0.5">Auctions &amp; Reward Lots</div>
          </div>

          <div className="bg-neutral-950/60 border border-amber-500/20 rounded-2xl p-3.5">
            <div className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">Pending Shipping</div>
            <div className="text-xl font-bold text-amber-300 mt-1">{physicalPendingCount}</div>
            <div className="text-[10px] text-neutral-400 mt-0.5">Physical packages to mail</div>
          </div>

          <div className="bg-neutral-950/60 border border-emerald-500/20 rounded-2xl p-3.5">
            <div className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">Total Raised Value</div>
            <div className="text-xl font-bold text-emerald-300 mt-1">${totalPrizeAmount.toFixed(2)}</div>
            <div className="text-[10px] text-neutral-400 mt-0.5">Winning bids &amp; claims</div>
          </div>

          <div className="bg-neutral-950/60 border border-indigo-500/20 rounded-2xl p-3.5">
            <div className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider">Shipped / Completed</div>
            <div className="text-xl font-bold text-indigo-300 mt-1">
              {prizes.filter((p) => p.shippingStatus === 'shipped' || p.shippingStatus === 'delivered').length}
            </div>
            <div className="text-[10px] text-neutral-400 mt-0.5">Fulfilled parcels</div>
          </div>
        </div>

        {bannerMessage && (
          <div
            className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
              bannerMessage.type === 'success'
                ? 'bg-emerald-950/50 border border-emerald-800/70 text-emerald-200'
                : 'bg-rose-950/50 border border-rose-800/70 text-rose-200'
            }`}
          >
            {bannerMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span className="flex-1">{bannerMessage.text}</span>
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-all ${
              filter === 'all'
                ? 'bg-neutral-100 text-neutral-950 shadow-sm'
                : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
            }`}
          >
            All ({prizes.length})
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-all ${
              filter === 'pending'
                ? 'bg-amber-500 text-neutral-950 shadow-sm'
                : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
            }`}
          >
            Pending Shipping ({physicalPendingCount})
          </button>
          <button
            onClick={() => setFilter('physical')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-all ${
              filter === 'physical'
                ? 'bg-neutral-100 text-neutral-950 shadow-sm'
                : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
            }`}
          >
            Physical ({prizes.filter((p) => p.prizeType !== 'email').length})
          </button>
          <button
            onClick={() => setFilter('digital')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-all ${
              filter === 'digital'
                ? 'bg-neutral-100 text-neutral-950 shadow-sm'
                : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
            }`}
          >
            Digital ({prizes.filter((p) => p.prizeType === 'email').length})
          </button>
          <button
            onClick={() => setFilter('shipped')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-all ${
              filter === 'shipped'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
            }`}
          >
            Shipped
          </button>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search prizes, winners, cities..."
            className="w-full sm:w-64 bg-neutral-900 border border-neutral-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
        </div>
      </div>

      {/* Prize Cards List */}
      {filteredPrizes.length === 0 ? (
        <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-12 text-center space-y-3">
          <Package className="w-12 h-12 text-neutral-600 mx-auto" />
          <h3 className="text-base font-semibold text-neutral-200">No prizes matching your filter</h3>
          <p className="text-xs text-neutral-400 max-w-md mx-auto">
            Pull your campaign's completed auctions and rewards under the Tiltify tab to import individual winner shipping cards.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredPrizes.map((prize) => {
            const isPhysical = prize.prizeType !== 'email';
            const addr = prize.shippingAddress;
            const hasAddress = Boolean(addr?.addressLine1 || addr?.city);

            return (
              <div
                key={prize.id}
                className="bg-neutral-900 border border-neutral-800 hover:border-neutral-700/80 rounded-2xl p-5 shadow-sm transition-all space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  {/* Top Bar: Badges & Amount */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold border bg-amber-500/10 text-amber-300 border-amber-500/30">
                        {prize.type === 'auction' ? '🔨 AUCTION LOT' : '🎁 CAMPAIGN REWARD'}
                      </span>

                      <span
                        className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                          prize.shippingStatus === 'delivered'
                            ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                            : prize.shippingStatus === 'shipped'
                            ? 'bg-indigo-950/60 text-indigo-300 border-indigo-800/60'
                            : 'bg-amber-950/60 text-amber-300 border-amber-800/60'
                        }`}
                      >
                        {prize.shippingStatus === 'delivered'
                          ? '✅ Delivered'
                          : prize.shippingStatus === 'shipped'
                          ? '🚚 Shipped'
                          : '⏳ Pending Shipping'}
                      </span>

                      {prize.discordStatus === 'sent' && (
                        <span className="text-[10px] text-indigo-400 flex items-center gap-1 font-mono">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>In Discord</span>
                        </span>
                      )}
                    </div>

                    <div className="text-right">
                      <div className="text-lg font-bold text-white tracking-tight">
                        ${prize.amount.toFixed(2)}
                      </div>
                      <div className="text-[10px] text-neutral-400">{prize.currency}</div>
                    </div>
                  </div>

                  {/* Prize Title & Description */}
                  <div>
                    <h3 className="text-sm font-bold text-neutral-100">{prize.title}</h3>
                    {prize.description && (
                      <p className="text-xs text-neutral-400 mt-0.5 italic line-clamp-2">
                        {prize.description}
                      </p>
                    )}
                  </div>

                  {/* Winner & Delivery Info Box */}
                  <div className="bg-neutral-950 border border-neutral-800/80 rounded-xl p-3.5 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-neutral-200">
                        <span className="text-neutral-400 font-medium">Winner:</span>
                        <span className="font-semibold text-white">{prize.winnerName}</span>
                      </div>
                      {prize.winnerEmail && (
                        <div className="text-neutral-400 font-mono text-[11px] truncate max-w-[180px]">
                          &lt;{prize.winnerEmail}&gt;
                        </div>
                      )}
                    </div>

                    {/* Physical Shipping Address */}
                    {isPhysical ? (
                      <div className="pt-2 border-t border-neutral-850 space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-amber-400 text-[11px] font-medium">
                            <MapPin className="w-3.5 h-3.5" />
                            <span>Mailing Address:</span>
                          </div>
                          {hasAddress && (
                            <button
                              onClick={() => handleCopyAddress(prize)}
                              className="text-[10px] flex items-center gap-1 text-teal-400 hover:text-teal-300 font-medium transition-colors"
                            >
                              {copiedId === prize.id ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-400" />
                                  <span className="text-emerald-400">Copied Label!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>Copy Label</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>

                        {hasAddress ? (
                          <div className="font-mono text-[11px] text-neutral-300 pl-5 space-y-0.5 leading-tight">
                            <div>{addr?.recipientName || prize.winnerName}</div>
                            <div>{addr?.addressLine1}</div>
                            {addr?.addressLine2 && <div>{addr.addressLine2}</div>}
                            <div>
                              {[addr?.city, addr?.region, addr?.postalCode].filter(Boolean).join(', ')}
                            </div>
                            {addr?.country && <div>{addr.country}</div>}
                          </div>
                        ) : (
                          <div className="text-[11px] text-amber-300/80 italic pl-5">
                            Pending address submission by winner (will update automatically via Tiltify).
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="pt-2 border-t border-neutral-850 flex items-center gap-2 text-[11px] text-teal-300">
                        <Mail className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                        <span>
                          Digital Delivery: Email key/code directly to{' '}
                          <strong className="text-white underline">{prize.winnerEmail || 'Winner'}</strong>
                        </span>
                      </div>
                    )}

                    {/* Special Instructions or Delivery Notes */}
                    {prize.specialInstructions && (
                      <div className="text-[11px] bg-neutral-900/80 p-2 rounded-lg text-neutral-300 italic border border-neutral-800/60">
                        <span className="text-neutral-400 not-italic font-semibold">Notes:</span>{' '}
                        "{prize.specialInstructions}"
                      </div>
                    )}

                    {/* Tracking Number if available */}
                    {prize.trackingNumber && (
                      <div className="text-[11px] text-neutral-300 flex items-center gap-1.5 pt-1">
                        <Truck className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Tracking:</span>
                        <span className="font-mono text-white font-medium">{prize.trackingNumber}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="pt-3 border-t border-neutral-800 flex items-center justify-between gap-2 mt-2">
                  <button
                    onClick={() => setEditingPrize(prize)}
                    className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-neutral-800 transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-neutral-400" />
                    <span>Edit Fulfillment</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDispatchSingle(prize.id)}
                      disabled={dispatchingId === prize.id}
                      className="flex items-center gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white px-3 py-1.5 rounded-lg font-medium transition-colors shadow-sm"
                    >
                      <Send className={`w-3.5 h-3.5 ${dispatchingId === prize.id ? 'animate-spin' : ''}`} />
                      <span>{dispatchingId === prize.id ? 'Sending...' : 'Send to Discord'}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Fulfillment Modal */}
      {editingPrize && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-white text-base">Edit Prize Fulfillment</h3>
              </div>
              <button
                onClick={() => setEditingPrize(null)}
                className="text-neutral-400 hover:text-white text-xs px-2 py-1"
              >
                ✕ Close
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleUpdateFulfillment({});
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="text-[11px] font-semibold text-neutral-300 block mb-1">Prize Title</label>
                <input
                  type="text"
                  value={editingPrize.title}
                  onChange={(e) => setEditingPrize({ ...editingPrize, title: e.target.value })}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-neutral-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-neutral-300 block mb-1">Winner Name</label>
                  <input
                    type="text"
                    value={editingPrize.winnerName}
                    onChange={(e) => setEditingPrize({ ...editingPrize, winnerName: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-neutral-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-neutral-300 block mb-1">Winner Email</label>
                  <input
                    type="email"
                    value={editingPrize.winnerEmail || ''}
                    onChange={(e) => setEditingPrize({ ...editingPrize, winnerEmail: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-neutral-200 focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-neutral-300 block mb-1">Shipping Status</label>
                  <select
                    value={editingPrize.shippingStatus}
                    onChange={(e) =>
                      setEditingPrize({
                        ...editingPrize,
                        shippingStatus: e.target.value as 'pending' | 'shipped' | 'delivered',
                      })
                    }
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-neutral-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="pending">⏳ Pending Shipping</option>
                    <option value="shipped">🚚 Shipped</option>
                    <option value="delivered">✅ Delivered</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-neutral-300 block mb-1">Tracking Number</label>
                  <input
                    type="text"
                    value={editingPrize.trackingNumber || ''}
                    onChange={(e) => setEditingPrize({ ...editingPrize, trackingNumber: e.target.value })}
                    placeholder="e.g. 9400 1000 0000 0000"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-neutral-200 focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
                  />
                </div>
              </div>

              {/* Mailing Address Fields */}
              <div className="pt-2 border-t border-neutral-800 space-y-2">
                <span className="text-[11px] font-semibold text-amber-400 block">Shipping / Mailing Address</span>

                <div>
                  <input
                    type="text"
                    value={editingPrize.shippingAddress?.recipientName || ''}
                    onChange={(e) =>
                      setEditingPrize({
                        ...editingPrize,
                        shippingAddress: { ...editingPrize.shippingAddress, recipientName: e.target.value },
                      })
                    }
                    placeholder="Recipient Full Name"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-neutral-200 text-xs"
                  />
                </div>

                <div>
                  <input
                    type="text"
                    value={editingPrize.shippingAddress?.addressLine1 || ''}
                    onChange={(e) =>
                      setEditingPrize({
                        ...editingPrize,
                        shippingAddress: { ...editingPrize.shippingAddress, addressLine1: e.target.value },
                      })
                    }
                    placeholder="Street Address Line 1"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-neutral-200 text-xs"
                  />
                </div>

                <div>
                  <input
                    type="text"
                    value={editingPrize.shippingAddress?.addressLine2 || ''}
                    onChange={(e) =>
                      setEditingPrize({
                        ...editingPrize,
                        shippingAddress: { ...editingPrize.shippingAddress, addressLine2: e.target.value },
                      })
                    }
                    placeholder="Apartment, Suite, Unit (Optional)"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-neutral-200 text-xs"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={editingPrize.shippingAddress?.city || ''}
                    onChange={(e) =>
                      setEditingPrize({
                        ...editingPrize,
                        shippingAddress: { ...editingPrize.shippingAddress, city: e.target.value },
                      })
                    }
                    placeholder="City"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-neutral-200 text-xs"
                  />
                  <input
                    type="text"
                    value={editingPrize.shippingAddress?.region || ''}
                    onChange={(e) =>
                      setEditingPrize({
                        ...editingPrize,
                        shippingAddress: { ...editingPrize.shippingAddress, region: e.target.value },
                      })
                    }
                    placeholder="State / Region"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-neutral-200 text-xs"
                  />
                  <input
                    type="text"
                    value={editingPrize.shippingAddress?.postalCode || ''}
                    onChange={(e) =>
                      setEditingPrize({
                        ...editingPrize,
                        shippingAddress: { ...editingPrize.shippingAddress, postalCode: e.target.value },
                      })
                    }
                    placeholder="ZIP / Postal"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-neutral-200 text-xs"
                  />
                </div>

                <div>
                  <input
                    type="text"
                    value={editingPrize.shippingAddress?.country || ''}
                    onChange={(e) =>
                      setEditingPrize({
                        ...editingPrize,
                        shippingAddress: { ...editingPrize.shippingAddress, country: e.target.value },
                      })
                    }
                    placeholder="Country (e.g. United States)"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-neutral-200 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-neutral-300 block mb-1">Fulfillment Notes</label>
                <textarea
                  rows={2}
                  value={editingPrize.fulfillmentNotes || ''}
                  onChange={(e) => setEditingPrize({ ...editingPrize, fulfillmentNotes: e.target.value })}
                  placeholder="Notes for shipping (e.g. boxed on Sept 25, signed streamer postcard included)"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-neutral-200 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setEditingPrize(null)}
                  className="px-4 py-2 rounded-xl text-neutral-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white font-semibold px-4 py-2 rounded-xl transition-colors"
                >
                  {isSaving ? 'Saving...' : 'Save Fulfillment Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
