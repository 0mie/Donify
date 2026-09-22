import React, { useState } from 'react';
import { DonationRecord } from '../types';
import { CheckCircle2, AlertCircle, Clock, RefreshCw, Send, Trash2, Code2, HeartHandshake, Filter, Gavel, Mail, MapPin } from 'lucide-react';

interface LiveFeedProps {
  donations: DonationRecord[];
  onResend: (id: string) => Promise<{ success: boolean; error?: string }>;
  onClear: () => Promise<void>;
  isLoading: boolean;
}

export const LiveFeed: React.FC<LiveFeedProps> = ({
  donations,
  onResend,
  onClear,
  isLoading,
}) => {
  const [filter, setFilter] = useState<'all' | 'sent' | 'failed' | 'test' | 'auctions'>('all');
  const [activePayload, setActivePayload] = useState<Record<string, any> | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ id: string; success: boolean; text: string } | null>(null);

  const filteredDonations = donations.filter((d) => {
    if (filter === 'sent') return d.discordStatus === 'sent';
    if (filter === 'failed') return d.discordStatus === 'failed';
    if (filter === 'test') return d.source === 'simulator';
    if (filter === 'auctions') return d.eventType === 'auction_ended' || !!d.auction;
    return true;
  });

  const handleResend = async (id: string) => {
    setResendingId(id);
    setActionFeedback(null);
    try {
      const res = await onResend(id);
      if (res.success) {
        setActionFeedback({ id, success: true, text: 'Alert delivered to Discord!' });
      } else {
        setActionFeedback({ id, success: false, text: res.error || 'Failed to send alert.' });
      }
    } catch (err: any) {
      setActionFeedback({ id, success: false, text: err.message || 'Resend error' });
    } finally {
      setResendingId(null);
    }
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency.toUpperCase() || 'USD',
      }).format(amount);
    } catch {
      return `$${amount.toFixed(2)} ${currency}`;
    }
  };

  return (
    <div className="space-y-4">
      {/* Feed Controls Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
        {/* Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
          <span className="text-neutral-400 font-semibold uppercase tracking-wider text-[11px] mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" />
            Filter:
          </span>
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-xl font-medium transition-all ${
              filter === 'all'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-neutral-950 text-neutral-400 hover:text-white border border-neutral-800'
            }`}
          >
            All ({donations.length})
          </button>
          <button
            onClick={() => setFilter('auctions')}
            className={`px-3 py-1.5 rounded-xl font-medium transition-all ${
              filter === 'auctions'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-neutral-950 text-neutral-400 hover:text-white border border-neutral-800'
            }`}
          >
            🔨 Auctions ({donations.filter((d) => d.eventType === 'auction_ended' || !!d.auction).length})
          </button>
          <button
            onClick={() => setFilter('sent')}
            className={`px-3 py-1.5 rounded-xl font-medium transition-all ${
              filter === 'sent'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-neutral-950 text-neutral-400 hover:text-white border border-neutral-800'
            }`}
          >
            Sent ({donations.filter((d) => d.discordStatus === 'sent').length})
          </button>
          <button
            onClick={() => setFilter('failed')}
            className={`px-3 py-1.5 rounded-xl font-medium transition-all ${
              filter === 'failed'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-neutral-950 text-neutral-400 hover:text-white border border-neutral-800'
            }`}
          >
            Failed ({donations.filter((d) => d.discordStatus === 'failed').length})
          </button>
          <button
            onClick={() => setFilter('test')}
            className={`px-3 py-1.5 rounded-xl font-medium transition-all ${
              filter === 'test'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-neutral-950 text-neutral-400 hover:text-white border border-neutral-800'
            }`}
          >
            Simulated ({donations.filter((d) => d.source === 'simulator').length})
          </button>
        </div>

        {/* Clear History */}
        {donations.length > 0 && (
          <button
            onClick={onClear}
            className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-rose-400 px-3 py-1.5 rounded-xl hover:bg-rose-950/30 border border-transparent hover:border-rose-900/40 transition-colors shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear History</span>
          </button>
        )}
      </div>

      {/* Donation & Auction List */}
      {filteredDonations.length === 0 ? (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-12 text-center">
          <HeartHandshake className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
          <h4 className="text-base font-semibold text-neutral-200 mb-1">No events logged yet</h4>
          <p className="text-xs text-neutral-400 max-w-md mx-auto mb-4">
            Donations and auction ended events received via Tiltify Webhook, API Poller, or the Test Simulator will appear here along with Discord delivery status.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredDonations.map((item) => {
            const isAuction = item.eventType === 'auction_ended' || !!item.auction;
            const auction = item.auction;

            return (
              <div
                key={item.id}
                className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 shadow-sm hover:border-neutral-700 transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    {/* Avatar Icon */}
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 border ${
                        isAuction
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          : 'bg-teal-500/10 text-teal-400 border-teal-500/20'
                      }`}
                    >
                      {isAuction ? (
                        <Gavel className="w-5 h-5 text-amber-400" />
                      ) : (
                        item.donorName ? item.donorName[0].toUpperCase() : 'A'
                      )}
                    </div>

                    <div>
                      {/* Name / Title and Badges */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {isAuction ? (
                          <>
                            <span className="font-semibold text-white text-sm">
                              {auction?.itemTitle || 'Auction Ended'}
                            </span>
                            <span className="bg-neutral-950 border border-neutral-800 text-amber-400 font-bold px-2 py-0.5 rounded-lg text-xs font-mono">
                              {formatCurrency(auction?.winningBid || item.amount, auction?.currency || item.currency)}
                            </span>
                            <span className="bg-amber-950/80 text-amber-300 border border-amber-800/60 text-[10px] px-2 py-0.5 rounded-md uppercase tracking-wider font-semibold">
                              🔨 AUCTION
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="font-semibold text-white text-sm">{item.donorName || 'Anonymous'}</span>
                            <span className="bg-neutral-950 border border-neutral-800 text-teal-400 font-bold px-2 py-0.5 rounded-lg text-xs font-mono">
                              {formatCurrency(item.amount, item.currency)}
                            </span>
                          </>
                        )}

                        <span className="bg-neutral-800/80 text-neutral-400 text-[10px] px-2 py-0.5 rounded-md uppercase tracking-wider font-semibold">
                          {item.source}
                        </span>
                      </div>

                      {item.campaignName && (
                        <div className="text-xs text-neutral-400 mt-0.5">
                          Campaign: <span className="text-neutral-300 font-medium">{item.campaignName}</span>
                        </div>
                      )}

                      {/* Comment for donation */}
                      {!isAuction && item.comment && (
                        <div className="mt-2 text-xs text-neutral-300 bg-neutral-950 border border-neutral-800/80 rounded-xl p-2.5 max-w-xl italic">
                          "{item.comment}"
                        </div>
                      )}

                      {/* 🔨 AUCTION WINNER & PRIZE FULFILLMENT CARD */}
                      {isAuction && auction && (
                        <div className="mt-2.5 bg-neutral-950/90 border border-amber-500/30 rounded-xl p-3 max-w-xl text-xs space-y-2.5">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-1.5 text-amber-400 font-semibold">
                              <span>🏆 Winner:</span>
                              <span className="text-white font-medium">{auction.winnerName}</span>
                              {auction.winnerEmail && (
                                <span className="font-mono text-neutral-400 text-[11px]">
                                  &lt;{auction.winnerEmail}&gt;
                                </span>
                              )}
                            </div>

                            <span className="text-[10px] bg-neutral-800 text-amber-200 px-2 py-0.5 rounded-full font-medium border border-amber-700/40">
                              {auction.prizeType === 'physical'
                                ? '📦 Physical Prize'
                                : auction.prizeType === 'email'
                                ? '📧 Email Delivery Prize'
                                : '🎁 Physical + Email Prize'}
                            </span>
                          </div>

                          {auction.itemDescription && (
                            <div className="text-neutral-400 text-[11px] italic">
                              {auction.itemDescription}
                            </div>
                          )}

                          {/* Winner Fulfillment Section */}
                          <div className="pt-2 border-t border-neutral-800/80 space-y-2 text-neutral-300 text-[11px]">
                            {/* Email prize instruction notice */}
                            {(auction.prizeType === 'email' || auction.prizeType === 'both') && auction.winnerEmail && (
                              <div className="bg-teal-950/40 border border-teal-800/40 p-2 rounded-lg text-teal-200 flex items-center gap-2">
                                <Mail className="w-3.5 h-3.5 shrink-0 text-teal-400" />
                                <span>
                                  <strong>Email Delivery:</strong> Send digital vouchers/codes to{' '}
                                  <span className="font-mono text-white underline">{auction.winnerEmail}</span>
                                </span>
                              </div>
                            )}

                            {/* Physical shipping address */}
                            {auction.shippingAddress && (
                              <div className="bg-neutral-900/80 p-2.5 rounded-lg border border-neutral-800/70 space-y-1">
                                <div className="flex items-center gap-1.5 text-amber-400 font-medium">
                                  <MapPin className="w-3.5 h-3.5" />
                                  <span>Shipping Address for Physical Prize:</span>
                                </div>
                                <div className="font-mono text-[11px] text-neutral-200 pl-5">
                                  <div>{auction.shippingAddress.recipientName || auction.winnerName}</div>
                                  <div>{auction.shippingAddress.addressLine1}</div>
                                  {auction.shippingAddress.addressLine2 && (
                                    <div>{auction.shippingAddress.addressLine2}</div>
                                  )}
                                  <div>
                                    {[
                                      auction.shippingAddress.city,
                                      auction.shippingAddress.region,
                                      auction.shippingAddress.postalCode,
                                    ]
                                      .filter(Boolean)
                                      .join(', ')}
                                  </div>
                                  {auction.shippingAddress.country && (
                                    <div>{auction.shippingAddress.country}</div>
                                  )}
                                </div>
                              </div>
                            )}

                            {auction.specialInstructions && (
                              <div className="text-[11px] bg-neutral-900/60 p-2 rounded text-neutral-300 italic">
                                <span className="text-neutral-400 not-italic font-semibold">Special Instructions:</span>{' '}
                                "{auction.specialInstructions}"
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* 🎁 Selected Reward Card for regular donations */}
                      {!isAuction && item.reward && (
                        <div className="mt-2.5 bg-neutral-950/90 border border-teal-500/30 rounded-xl p-3 max-w-xl text-xs space-y-2">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-1.5 text-teal-400 font-semibold">
                              <span>🎁 Selected Reward:</span>
                              <span className="text-white font-medium">{item.reward.name}</span>
                              {item.reward.quantity && item.reward.quantity > 1 && (
                                <span className="bg-teal-950 border border-teal-800/60 text-teal-300 text-[10px] px-1.5 py-0.2 rounded font-mono">
                                  {item.reward.quantity}x
                                </span>
                              )}
                            </div>

                            <span className="text-[10px] bg-neutral-800 text-neutral-300 px-2 py-0.5 rounded-full font-medium">
                              {item.reward.deliveryType === 'shipping' ? '📦 Physical Shipping' : '💻 Digital / Email'}
                            </span>
                          </div>

                          {item.reward.description && (
                            <div className="text-neutral-400 text-[11px] italic">
                              {item.reward.description}
                            </div>
                          )}

                          {/* Shipping & Delivery Details */}
                          {(item.reward.shippingAddress || item.reward.donorEmail || item.donorEmail) && (
                            <div className="pt-2 border-t border-neutral-800/80 space-y-1 text-neutral-300 text-[11px]">
                              <div className="flex items-center gap-2 flex-wrap text-neutral-400">
                                <span>Recipient:</span>
                                <strong className="text-neutral-200">
                                  {item.reward.shippingAddress?.recipientName || item.donorName || 'Supporter'}
                                </strong>
                                {(item.reward.donorEmail || item.donorEmail) && (
                                  <span className="font-mono text-neutral-400">
                                    &lt;{item.reward.donorEmail || item.donorEmail}&gt;
                                  </span>
                                )}
                              </div>

                              {item.reward.shippingAddress && (
                                <div className="bg-neutral-900/80 p-2 rounded-lg font-mono text-[11px] text-neutral-300 border border-neutral-800/70">
                                  <div>{item.reward.shippingAddress.addressLine1}</div>
                                  {item.reward.shippingAddress.addressLine2 && (
                                    <div>{item.reward.shippingAddress.addressLine2}</div>
                                  )}
                                  <div>
                                    {[
                                      item.reward.shippingAddress.city,
                                      item.reward.shippingAddress.region,
                                      item.reward.shippingAddress.postalCode,
                                    ]
                                      .filter(Boolean)
                                      .join(', ')}
                                  </div>
                                  {item.reward.shippingAddress.country && (
                                    <div>{item.reward.shippingAddress.country}</div>
                                  )}
                                </div>
                              )}

                              {item.reward.customOptions && typeof item.reward.customOptions === 'object' && (
                                <div className="pt-1 flex flex-wrap gap-2">
                                  {Object.entries(item.reward.customOptions).map(([k, v]) => (
                                    <span
                                      key={k}
                                      className="bg-neutral-900 border border-neutral-800 px-2 py-0.5 rounded text-[10px]"
                                    >
                                      <span className="text-neutral-400">{k}:</span>{' '}
                                      <span className="text-white font-medium">{v}</span>
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right side: Status & Actions */}
                  <div className="flex sm:flex-col items-end justify-between sm:justify-start gap-2 shrink-0">
                    {/* Status badge */}
                    <div className="flex items-center gap-1.5">
                      {item.discordStatus === 'sent' && (
                        <span className="flex items-center gap-1 bg-emerald-950/60 border border-emerald-800/80 text-emerald-400 text-xs px-2.5 py-1 rounded-lg font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Sent to Discord</span>
                        </span>
                      )}
                      {item.discordStatus === 'failed' && (
                        <span
                          className="flex items-center gap-1 bg-rose-950/60 border border-rose-800/80 text-rose-400 text-xs px-2.5 py-1 rounded-lg font-medium"
                          title={item.discordError || 'Failed to dispatch'}
                        >
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>Discord Failed</span>
                        </span>
                      )}
                      {item.discordStatus === 'pending' && (
                        <span className="flex items-center gap-1 bg-amber-950/60 border border-amber-800/80 text-amber-400 text-xs px-2.5 py-1 rounded-lg font-medium">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Pending</span>
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] text-neutral-400">
                      {new Date(item.receivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </div>

                    {/* Resend button */}
                    <button
                      onClick={() => handleResend(item.id)}
                      disabled={resendingId === item.id}
                      className="flex items-center gap-1 text-xs bg-neutral-950 hover:bg-neutral-800 text-neutral-300 hover:text-white px-2.5 py-1 rounded-lg border border-neutral-800 transition-colors disabled:opacity-40"
                    >
                      <RefreshCw className={`w-3 h-3 ${resendingId === item.id ? 'animate-spin' : ''}`} />
                      <span>{resendingId === item.id ? 'Sending...' : 'Resend Alert'}</span>
                    </button>

                    {/* Payload inspector button */}
                    {item.rawPayload && (
                      <button
                        onClick={() => setActivePayload(item.rawPayload || null)}
                        className="flex items-center gap-1 text-[11px] text-neutral-400 hover:text-neutral-200"
                      >
                        <Code2 className="w-3 h-3" />
                        <span>Inspect Payload</span>
                      </button>
                    )}

                    {actionFeedback && actionFeedback.id === item.id && (
                      <div
                        className={`text-[11px] font-medium ${
                          actionFeedback.success ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {actionFeedback.text}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Payload Modal */}
      {activePayload && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-2xl w-full max-h-[80vh] flex flex-col shadow-2xl">
            <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
              <h4 className="font-semibold text-white text-sm flex items-center gap-2">
                <Code2 className="w-4 h-4 text-indigo-400" />
                Raw Event Payload (Webhook / API)
              </h4>
              <button
                onClick={() => setActivePayload(null)}
                className="text-neutral-400 hover:text-white text-xs px-2 py-1 rounded-lg hover:bg-neutral-800"
              >
                Close
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 font-mono text-xs text-neutral-300 bg-neutral-950/80">
              <pre>{JSON.stringify(activePayload, null, 2)}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
