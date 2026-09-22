import React, { useState } from 'react';
import { Send, HeartHandshake, CheckCircle2, AlertTriangle, Zap, Gift, MapPin, Mail, Gavel } from 'lucide-react';
import { ClaimedReward, AuctionWinnerInfo } from '../types';

interface DonationSimulatorProps {
  onSimulate: (data: {
    eventType?: 'donation' | 'auction_ended';
    donorName?: string;
    donorEmail?: string;
    amount?: number;
    currency?: string;
    comment?: string;
    campaignName?: string;
    reward?: ClaimedReward;
    auction?: AuctionWinnerInfo;
  }) => Promise<{ success: boolean; error?: string }>;
  defaultCampaignName?: string;
}

const DONATION_PRESETS = [
  {
    name: '🌟 Coffee Supporter',
    donor: 'Sam Sparks',
    email: 'sam@example.com',
    amount: 5.0,
    currency: 'USD',
    comment: 'Keep up the awesome streaming today! Every bit counts! ☕',
    reward: undefined,
  },
  {
    name: '🎁 Merch & Reward Winner',
    donor: 'Morgan Bailey',
    email: 'morgan.bailey@example.com',
    amount: 75.0,
    currency: 'USD',
    comment: 'Claimed the limited edition hoodie reward! Cant wait for stream milestones! 🧥✨',
    reward: {
      name: 'Limited Charity Stream Hoodie + Sticker Pack',
      description: 'Embroidered fleece hoodie and vinyl event stickers.',
      amount: 75.0,
      quantity: 1,
      deliveryType: 'shipping' as const,
      donorEmail: 'morgan.bailey@example.com',
      shippingAddress: {
        recipientName: 'Morgan Bailey',
        addressLine1: '450 West 33rd Street, Apt 14B',
        city: 'New York',
        region: 'NY',
        postalCode: '10001',
        country: 'United States',
      },
      customOptions: {
        'Hoodie Size': 'Unisex XL',
        'Sticker Pack Choice': 'Holographic Glitter',
      },
    },
  },
  {
    name: '💖 Hype Squad',
    donor: 'NeonRider99',
    email: 'neon@example.com',
    amount: 25.0,
    currency: 'USD',
    comment: 'DONATION TRAIN! Let us hit that charity stretch goal! 🚂🔥',
    reward: undefined,
  },
  {
    name: '🏆 Gold Champion',
    donor: 'Elena Rostova',
    email: 'elena@example.com',
    amount: 100.0,
    currency: 'USD',
    comment: 'Matching my company donation for this wonderful cause. Love the stream! ❤️',
    reward: undefined,
  },
];

const AUCTION_PRESETS = [
  {
    name: '📦 Physical Prize: Framed Team Jersey',
    itemTitle: 'Autographed Esports Tournament Jersey (Framed)',
    itemDescription: 'Match-worn team jersey signed by all 5 championship players.',
    winningBid: 320.0,
    currency: 'USD',
    winnerName: 'Jordan Hayes',
    winnerEmail: 'jordan.hayes@example.com',
    prizeType: 'physical' as const,
    shippingAddress: {
      recipientName: 'Jordan Hayes',
      addressLine1: '742 Evergreen Terrace, Apt 4G',
      city: 'Springfield',
      region: 'OR',
      postalCode: '97477',
      country: 'United States',
    },
    specialInstructions: 'Please include the certificate of authenticity in the shipment packaging.',
  },
  {
    name: '📧 Email Delivery: VIP Pass & Game Keys',
    itemTitle: 'Lifetime VIP Streamer Pass + Alpha Game Key Bundle',
    itemDescription: 'Digital founder access code with exclusive badge and season pass.',
    winningBid: 150.0,
    currency: 'USD',
    winnerName: 'Casey Nova',
    winnerEmail: 'casey.nova@example.com',
    prizeType: 'email' as const,
    specialInstructions: 'Send digital Steam game codes directly via email.',
  },
  {
    name: '🎁 Both: Collector Loot Box + VIP Role',
    itemTitle: 'Ultimate Charity Stream Loot Box & VIP Discord Role',
    itemDescription: 'Custom acrylic trophy, collectible pins, and exclusive VIP role in Discord.',
    winningBid: 500.0,
    currency: 'USD',
    winnerName: 'Riley Taylor',
    winnerEmail: 'riley.taylor@example.com',
    prizeType: 'both' as const,
    shippingAddress: {
      recipientName: 'Riley Taylor',
      addressLine1: '1200 Market Street, Suite 900',
      city: 'San Francisco',
      region: 'CA',
      postalCode: '94102',
      country: 'United States',
    },
    specialInstructions: 'Fragile acrylic item — please wrap thoroughly.',
  },
];

export const DonationSimulator: React.FC<DonationSimulatorProps> = ({
  onSimulate,
  defaultCampaignName = 'Charity Drive 2026',
}) => {
  const [simulationType, setSimulationType] = useState<'donation' | 'auction'>('donation');

  // Donation State
  const [donorName, setDonorName] = useState('Morgan Bailey');
  const [donorEmail, setDonorEmail] = useState('morgan.bailey@example.com');
  const [amount, setAmount] = useState<number>(75.0);
  const [currency, setCurrency] = useState('USD');
  const [comment, setComment] = useState('Claimed the limited edition hoodie reward! Cant wait for stream milestones! 🧥✨');
  const [campaignName, setCampaignName] = useState(defaultCampaignName);

  // Reward state
  const [includeReward, setIncludeReward] = useState(true);
  const [rewardName, setRewardName] = useState('Limited Charity Stream Hoodie + Sticker Pack');
  const [rewardDescription, setRewardDescription] = useState('Embroidered fleece hoodie and vinyl event stickers.');
  const [rewardQuantity, setRewardQuantity] = useState(1);
  const [deliveryType, setDeliveryType] = useState<'shipping' | 'digital' | 'other'>('shipping');
  const [recipientName, setRecipientName] = useState('Morgan Bailey');
  const [addressLine1, setAddressLine1] = useState('450 West 33rd Street, Apt 14B');
  const [city, setCity] = useState('New York');
  const [region, setRegion] = useState('NY');
  const [postalCode, setPostalCode] = useState('10001');
  const [country, setCountry] = useState('United States');
  const [sizeOption, setSizeOption] = useState('Unisex XL');
  const [notesOption, setNotesOption] = useState('Holographic Glitter Pack');

  // Auction State
  const [auctionTitle, setAuctionTitle] = useState('Autographed Esports Tournament Jersey (Framed)');
  const [auctionDescription, setAuctionDescription] = useState('Match-worn team jersey signed by all 5 championship players.');
  const [auctionBid, setAuctionBid] = useState<number>(320.0);
  const [winnerName, setWinnerName] = useState('Jordan Hayes');
  const [winnerEmail, setWinnerEmail] = useState('jordan.hayes@example.com');
  const [auctionPrizeType, setAuctionPrizeType] = useState<'physical' | 'email' | 'both'>('both');
  const [aucRecipient, setAucRecipient] = useState('Jordan Hayes');
  const [aucAddressLine1, setAucAddressLine1] = useState('742 Evergreen Terrace, Apt 4G');
  const [aucCity, setAucCity] = useState('Springfield');
  const [aucRegion, setAucRegion] = useState('OR');
  const [aucPostalCode, setAucPostalCode] = useState('97477');
  const [aucCountry, setAucCountry] = useState('United States');
  const [aucSpecialNotes, setAucSpecialNotes] = useState('Please include certificate of authenticity in the shipment packaging.');

  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleApplyDonationPreset = (p: typeof DONATION_PRESETS[0]) => {
    setDonorName(p.donor);
    setDonorEmail(p.email || '');
    setAmount(p.amount);
    setCurrency(p.currency);
    setComment(p.comment);

    if (p.reward) {
      setIncludeReward(true);
      setRewardName(p.reward.name);
      setRewardDescription(p.reward.description || '');
      setRewardQuantity(p.reward.quantity || 1);
      setDeliveryType(p.reward.deliveryType || 'shipping');
      if (p.reward.shippingAddress) {
        setRecipientName(p.reward.shippingAddress.recipientName || p.donor);
        setAddressLine1(p.reward.shippingAddress.addressLine1 || '');
        setCity(p.reward.shippingAddress.city || '');
        setRegion(p.reward.shippingAddress.region || '');
        setPostalCode(p.reward.shippingAddress.postalCode || '');
        setCountry(p.reward.shippingAddress.country || 'United States');
      }
    } else {
      setIncludeReward(false);
    }
  };

  const handleApplyAuctionPreset = (p: typeof AUCTION_PRESETS[0]) => {
    setAuctionTitle(p.itemTitle);
    setAuctionDescription(p.itemDescription || '');
    setAuctionBid(p.winningBid);
    setCurrency(p.currency);
    setWinnerName(p.winnerName);
    setWinnerEmail(p.winnerEmail || '');
    setAuctionPrizeType(p.prizeType);
    if (p.shippingAddress) {
      setAucRecipient(p.shippingAddress.recipientName || p.winnerName);
      setAucAddressLine1(p.shippingAddress.addressLine1 || '');
      setAucCity(p.shippingAddress.city || '');
      setAucRegion(p.shippingAddress.region || '');
      setAucPostalCode(p.shippingAddress.postalCode || '');
      setAucCountry(p.shippingAddress.country || 'United States');
    }
    setAucSpecialNotes(p.specialInstructions || '');
  };

  const handleTrigger = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsLoading(true);
    setResult(null);

    try {
      if (simulationType === 'auction') {
        const hasPhysical = auctionPrizeType === 'physical' || auctionPrizeType === 'both';
        const auctionObj: AuctionWinnerInfo = {
          auctionId: `sim-auc-${Date.now()}`,
          itemTitle: auctionTitle.trim() || 'Auction Item',
          itemDescription: auctionDescription.trim() || undefined,
          winningBid: Number(auctionBid) || 1,
          currency,
          winnerName: winnerName.trim() || 'Auction Winner',
          winnerEmail: winnerEmail.trim() || undefined,
          prizeType: auctionPrizeType,
          shippingAddress: hasPhysical
            ? {
                recipientName: aucRecipient.trim() || winnerName.trim(),
                addressLine1: aucAddressLine1.trim(),
                city: aucCity.trim(),
                region: aucRegion.trim(),
                postalCode: aucPostalCode.trim(),
                country: aucCountry.trim(),
              }
            : undefined,
          specialInstructions: aucSpecialNotes.trim() || undefined,
          endedAt: new Date().toISOString(),
        };

        const res = await onSimulate({
          eventType: 'auction_ended',
          donorName: winnerName.trim() || 'Auction Winner',
          donorEmail: winnerEmail.trim() || undefined,
          amount: Number(auctionBid) || 1,
          currency,
          campaignName: campaignName.trim(),
          auction: auctionObj,
        });

        if (res.success) {
          setResult({
            success: true,
            message: `Auction ended alert dispatched to Discord! Winner "${winnerName}" won "${auctionTitle}" for $${auctionBid.toFixed(2)} with fulfillment info (${auctionPrizeType}).`,
          });
        } else {
          setResult({ success: false, message: res.error || 'Failed to dispatch auction alert.' });
        }
      } else {
        // Standard donation
        let rewardObj: ClaimedReward | undefined = undefined;
        if (includeReward && rewardName.trim()) {
          rewardObj = {
            name: rewardName.trim(),
            description: rewardDescription.trim() || undefined,
            quantity: rewardQuantity,
            deliveryType: deliveryType,
            donorEmail: donorEmail.trim() || undefined,
            shippingAddress:
              deliveryType === 'shipping'
                ? {
                    recipientName: recipientName.trim() || donorName.trim(),
                    addressLine1: addressLine1.trim(),
                    city: city.trim(),
                    region: region.trim(),
                    postalCode: postalCode.trim(),
                    country: country.trim(),
                  }
                : undefined,
            customOptions: {
              'Option / Size': sizeOption.trim(),
              'Notes / Choices': notesOption.trim(),
            },
          };
        }

        const res = await onSimulate({
          eventType: 'donation',
          donorName: donorName.trim() || 'Anonymous',
          donorEmail: donorEmail.trim() || undefined,
          amount: Number(amount) || 1,
          currency,
          comment: comment.trim(),
          campaignName: campaignName.trim(),
          reward: rewardObj,
        });

        if (res.success) {
          setResult({
            success: true,
            message: `Alert sent to Discord for $${amount.toFixed(2)} from ${donorName}${
              rewardObj ? ` with reward "${rewardObj.name}" and delivery address` : ''
            }!`,
          });
        } else {
          setResult({ success: false, message: res.error || 'Failed to dispatch to Discord.' });
        }
      }
    } catch (err: any) {
      setResult({ success: false, message: err?.message || 'Error triggering alert.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-sm space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-white text-base">Alert Simulator & Fulfillment Sandbox</h3>
            <p className="text-xs text-neutral-400">
              Test both standard donation alerts and Tiltify Auction House end notifications with winner prize fulfillment
            </p>
          </div>
        </div>

        {/* Mode Switcher */}
        <div className="flex items-center bg-neutral-950 p-1 rounded-xl border border-neutral-800 text-xs">
          <button
            type="button"
            onClick={() => setSimulationType('donation')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
              simulationType === 'donation'
                ? 'bg-neutral-800 text-white shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <HeartHandshake className="w-3.5 h-3.5 text-teal-400" />
            <span>Standard Donation</span>
          </button>
          <button
            type="button"
            onClick={() => setSimulationType('auction')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
              simulationType === 'auction'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Gavel className="w-3.5 h-3.5 text-amber-200" />
            <span>🔨 Auction Ended</span>
          </button>
        </div>
      </div>

      {result && (
        <div
          className={`p-4 rounded-xl text-xs flex items-start gap-2.5 ${
            result.success
              ? 'bg-emerald-950/50 border border-emerald-800/60 text-emerald-300'
              : 'bg-rose-950/50 border border-rose-800/60 text-rose-300'
          }`}
        >
          {result.success ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
          )}
          <div className="font-medium">{result.message}</div>
        </div>
      )}

      {/* One-Click Presets */}
      <div>
        <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block mb-2">
          {simulationType === 'auction' ? '🔨 Auction House Presets' : '🌟 Donation Presets'}
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {simulationType === 'auction'
            ? AUCTION_PRESETS.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => handleApplyAuctionPreset(p)}
                  className="bg-neutral-950 hover:bg-neutral-800/80 border border-neutral-800 hover:border-amber-700/60 p-3 rounded-xl text-left transition-all group"
                >
                  <div className="text-xs font-semibold text-neutral-200 group-hover:text-amber-300 transition-colors truncate">
                    {p.name}
                  </div>
                  <div className="text-[11px] text-neutral-400 mt-0.5">
                    ${p.winningBid.toFixed(2)} • {p.winnerName}
                  </div>
                </button>
              ))
            : DONATION_PRESETS.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => handleApplyDonationPreset(p)}
                  className="bg-neutral-950 hover:bg-neutral-800/80 border border-neutral-800 hover:border-neutral-700 p-3 rounded-xl text-left transition-all group"
                >
                  <div className="text-xs font-semibold text-neutral-200 group-hover:text-amber-300 transition-colors truncate">
                    {p.name}
                  </div>
                  <div className="text-[11px] text-neutral-400 mt-0.5">
                    ${p.amount.toFixed(2)} • {p.donor}
                  </div>
                </button>
              ))}
        </div>
      </div>

      {/* Form Content */}
      <form onSubmit={handleTrigger} className="space-y-4 pt-2">
        {simulationType === 'auction' ? (
          /* AUCTION ENDED FORM */
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-neutral-300 block mb-1">
                  Auction Item Title <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={auctionTitle}
                  onChange={(e) => setAuctionTitle(e.target.value)}
                  placeholder="e.g. Framed Signed Jersey"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-300 block mb-1">
                  Winning Bid Amount <span className="text-rose-400">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={auctionBid}
                  onChange={(e) => setAuctionBid(parseFloat(e.target.value) || 0)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-neutral-300 block mb-1">Item Description</label>
              <textarea
                value={auctionDescription}
                onChange={(e) => setAuctionDescription(e.target.value)}
                placeholder="Description of the auction item..."
                rows={2}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {/* Winner Identity & Prize Fulfillment Type */}
            <div className="bg-neutral-950/70 border border-amber-500/20 rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="text-xs font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Gavel className="w-4 h-4" />
                  Winner Fulfillment & Prize Delivery
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="text-neutral-400">Prize Type:</span>
                  <select
                    value={auctionPrizeType}
                    onChange={(e) => setAuctionPrizeType(e.target.value as any)}
                    className="bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1 text-xs text-neutral-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="both">Both (Physical Shipping + Email)</option>
                    <option value="physical">Physical Shipping Prize Only</option>
                    <option value="email">Digital / Email Prize Only</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-neutral-300 block mb-1">Winner Name</label>
                  <input
                    type="text"
                    value={winnerName}
                    onChange={(e) => setWinnerName(e.target.value)}
                    placeholder="Jordan Hayes"
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-neutral-300 block mb-1">
                    Winner Email {(auctionPrizeType === 'email' || auctionPrizeType === 'both') && <span className="text-teal-400">(Required for Email Delivery)</span>}
                  </label>
                  <input
                    type="email"
                    value={winnerEmail}
                    onChange={(e) => setWinnerEmail(e.target.value)}
                    placeholder="winner@example.com"
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Physical shipping address inputs */}
              {(auctionPrizeType === 'physical' || auctionPrizeType === 'both') && (
                <div className="space-y-3 pt-2 border-t border-neutral-800/80">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-300">
                    <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Physical Shipping Address Details:</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-neutral-400 block mb-1">Recipient Name</label>
                      <input
                        type="text"
                        value={aucRecipient}
                        onChange={(e) => setAucRecipient(e.target.value)}
                        placeholder="Recipient Name"
                        className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-neutral-200"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-neutral-400 block mb-1">Street Address</label>
                      <input
                        type="text"
                        value={aucAddressLine1}
                        onChange={(e) => setAucAddressLine1(e.target.value)}
                        placeholder="742 Evergreen Terrace"
                        className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-neutral-200"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="text-[11px] text-neutral-400 block mb-1">City</label>
                      <input
                        type="text"
                        value={aucCity}
                        onChange={(e) => setAucCity(e.target.value)}
                        placeholder="City"
                        className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-neutral-200"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-neutral-400 block mb-1">State / Province</label>
                      <input
                        type="text"
                        value={aucRegion}
                        onChange={(e) => setAucRegion(e.target.value)}
                        placeholder="State"
                        className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-neutral-200"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-neutral-400 block mb-1">Postal / Zip</label>
                      <input
                        type="text"
                        value={aucPostalCode}
                        onChange={(e) => setAucPostalCode(e.target.value)}
                        placeholder="Zip"
                        className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-neutral-200"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-neutral-400 block mb-1">Country</label>
                      <input
                        type="text"
                        value={aucCountry}
                        onChange={(e) => setAucCountry(e.target.value)}
                        placeholder="Country"
                        className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-neutral-200"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-neutral-400 block mb-1">Special Fulfillment Notes</label>
                <input
                  type="text"
                  value={aucSpecialNotes}
                  onChange={(e) => setAucSpecialNotes(e.target.value)}
                  placeholder="e.g. Please include certificate of authenticity"
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200"
                />
              </div>
            </div>
          </div>
        ) : (
          /* STANDARD DONATION FORM */
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-medium text-neutral-300 block mb-1">Donor Name</label>
                <input
                  type="text"
                  value={donorName}
                  onChange={(e) => setDonorName(e.target.value)}
                  placeholder="Donor Name"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-300 block mb-1">Donor Email</label>
                <input
                  type="email"
                  value={donorEmail}
                  onChange={(e) => setDonorEmail(e.target.value)}
                  placeholder="donor@example.com"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-300 block mb-1">Donation Amount</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-medium text-neutral-300 block mb-1">Currency</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="CAD">CAD ($)</option>
                  <option value="AUD">AUD ($)</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-neutral-300 block mb-1">Donor Message / Comment</label>
                <input
                  type="text"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Leave a message..."
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            {/* Selected Reward Section */}
            <div className="bg-neutral-950/60 border border-neutral-800/80 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-neutral-200">
                  <input
                    type="checkbox"
                    checked={includeReward}
                    onChange={(e) => setIncludeReward(e.target.checked)}
                    className="rounded bg-neutral-950 border-neutral-800 text-teal-500 focus:ring-teal-500 w-4 h-4"
                  />
                  <span>Attach Selected Tiltify Reward</span>
                </label>
                <span className="text-[10px] text-teal-400 bg-teal-950/80 px-2 py-0.5 rounded border border-teal-800/60">
                  🎁 Rewards & Shipping
                </span>
              </div>

              {includeReward && (
                <div className="space-y-3 pt-2 text-xs border-t border-neutral-800">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="text-[11px] text-neutral-400 block mb-1">Reward Name</label>
                      <input
                        type="text"
                        value={rewardName}
                        onChange={(e) => setRewardName(e.target.value)}
                        placeholder="e.g. Exclusive Stream Hoodie"
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-neutral-200"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-neutral-400 block mb-1">Fulfillment Type</label>
                      <select
                        value={deliveryType}
                        onChange={(e) => setDeliveryType(e.target.value as any)}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-neutral-200"
                      >
                        <option value="shipping">📦 Physical Shipping Address</option>
                        <option value="digital">💻 Digital / Email Code</option>
                        <option value="other">Other Fulfillment</option>
                      </select>
                    </div>
                  </div>

                  {deliveryType === 'shipping' && (
                    <div className="space-y-2 bg-neutral-900/60 p-3 rounded-lg border border-neutral-800">
                      <div className="flex items-center gap-1.5 text-neutral-300 font-medium text-[11px]">
                        <MapPin className="w-3.5 h-3.5 text-teal-400" />
                        <span>Shipping Address</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="text-[11px] text-neutral-400 block mb-0.5">Recipient</label>
                          <input
                            type="text"
                            value={recipientName}
                            onChange={(e) => setRecipientName(e.target.value)}
                            placeholder="Recipient Name"
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-neutral-200"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-neutral-400 block mb-0.5">Address Line 1</label>
                          <input
                            type="text"
                            value={addressLine1}
                            onChange={(e) => setAddressLine1(e.target.value)}
                            placeholder="123 Main St"
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-neutral-200"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div>
                          <label className="text-[11px] text-neutral-400 block mb-0.5">City</label>
                          <input
                            type="text"
                            value={city}
                            onChange={(e) => setCity(e.target.value)}
                            placeholder="City"
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-neutral-200"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-neutral-400 block mb-0.5">State</label>
                          <input
                            type="text"
                            value={region}
                            onChange={(e) => setRegion(e.target.value)}
                            placeholder="State"
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-neutral-200"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-neutral-400 block mb-0.5">Postal / Zip</label>
                          <input
                            type="text"
                            value={postalCode}
                            onChange={(e) => setPostalCode(e.target.value)}
                            placeholder="Zip"
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-neutral-200"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-neutral-400 block mb-0.5">Country</label>
                          <input
                            type="text"
                            value={country}
                            onChange={(e) => setCountry(e.target.value)}
                            placeholder="Country"
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-neutral-200"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-xs text-neutral-400">
            {simulationType === 'auction'
              ? 'Sends an auction ended event to your configured Discord webhook with winning bid & winner fulfillment details.'
              : 'Formats this donation & reward data into the Discord embed and transmits it via your bot.'}
          </p>

          <button
            type="submit"
            disabled={isLoading}
            className={`flex items-center gap-2 disabled:opacity-50 text-neutral-950 px-5 py-2.5 rounded-xl text-xs font-semibold transition-all shadow-sm shrink-0 ${
              simulationType === 'auction'
                ? 'bg-amber-500 hover:bg-amber-400 text-neutral-950'
                : 'bg-teal-400 hover:bg-teal-300 text-neutral-950'
            }`}
          >
            <Send className="w-4 h-4" />
            <span>
              {isLoading
                ? 'Transmitting...'
                : simulationType === 'auction'
                ? '🔨 Dispatch Auction Ended Alert'
                : 'Fire Test Donation with Reward'}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
};
