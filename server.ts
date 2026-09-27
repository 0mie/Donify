import express from 'express';
import fs from 'fs';
import path from 'path';

const currentDir = typeof __dirname !== 'undefined' ? __dirname : process.cwd();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// In-memory data store for config, auction items, and recent events
interface BotConfig {
  discordWebhookUrl: string;
  botUsername: string;
  botAvatarUrl: string;
  embedColor: string;
  mentionRole: string;
  includeEmailInDiscord: boolean;
  notifyOnAuctionWins: boolean;
  notifyOnBids: boolean;
  notifyOnDonations: boolean;
  minDonationAlert: number;
}

let botConfig: BotConfig = {
  discordWebhookUrl: '',
  botUsername: 'Tiltify Alerts',
  botAvatarUrl: 'https://assets.tiltify.com/assets/favicon/apple-touch-icon.png',
  embedColor: '#05c3de',
  mentionRole: '',
  includeEmailInDiscord: false,
  notifyOnAuctionWins: true,
  notifyOnBids: true,
  notifyOnDonations: true,
  minDonationAlert: 1,
};

export interface AuctionWinEvent {
  id: string;
  auctionId: string;
  auctionName: string;
  winningBid: number;
  currency: string;
  winnerName: string;
  winnerEmail: string | null;
  isEmailPrivate: boolean;
  donorComment: string | null;
  shippingAddress?: string | null;
  status: 'won' | 'paid' | 'fulfilled' | 'pending';
  timestamp: string;
  rawPayload?: any;
}

export interface ActivityLog {
  id: string;
  type: 'auction_won' | 'auction_bid' | 'donation' | 'test';
  title: string;
  details: string;
  timestamp: string;
  discordStatus: 'sent' | 'failed' | 'skipped';
  payloadSummary: any;
}

let auctionWins: AuctionWinEvent[] = [];
let activityLogs: ActivityLog[] = [];

function extractAuctionName(data: any): string {
  if (data?.item_name && typeof data.item_name === 'string' && data.item_name.trim()) {
    return data.item_name.trim();
  }
  if (data?.auction_item?.name && typeof data.auction_item.name === 'string') {
    return data.auction_item.name.trim();
  }
  if (data?.auction_item?.title && typeof data.auction_item.title === 'string') {
    return data.auction_item.title.trim();
  }
  if (data?.auction?.name && typeof data.auction.name === 'string') {
    return data.auction.name.trim();
  }
  if (data?.lot?.name && typeof data.lot.name === 'string') {
    return data.lot.name.trim();
  }
  if (data?.lot?.title && typeof data.lot.title === 'string') {
    return data.lot.title.trim();
  }
  if (data?.lot_name && typeof data.lot_name === 'string') {
    return data.lot_name.trim();
  }
  if (data?.name && typeof data.name === 'string' && data.name.trim() && !data.name.toLowerCase().includes('charity auction prize #')) {
    return data.name.trim();
  }
  if (data?.title && typeof data.title === 'string' && data.title.trim()) {
    return data.title.trim();
  }
  if (data?.reward?.name && typeof data.reward.name === 'string') {
    return data.reward.name.trim();
  }
  if (data?.data) {
    return extractAuctionName(data.data);
  }

  const lotId = data?.lot_id || data?.auction_id || data?.id;
  if (lotId) {
    return `Auction Lot #${lotId}`;
  }
  return 'Charity Auction Lot';
}

function extractWinnerEmail(data: any): { email: string | null; isPrivate: boolean } {
  const possibleEmail = 
    data?.donor_email || 
    data?.email || 
    data?.bidder_email || 
    data?.winner_email || 
    data?.shipping_email || 
    data?.data?.donor_email || 
    data?.data?.email || 
    data?.data?.bidder_email;

  if (possibleEmail && typeof possibleEmail === 'string' && possibleEmail.includes('@')) {
    const trimmed = possibleEmail.trim();
    if (trimmed.endsWith('@example.com')) {
      return { email: null, isPrivate: true };
    }
    return { email: trimmed, isPrivate: false };
  }

  return { email: null, isPrivate: true };
}

function extractDonorComment(data: any): string | null {
  const comment = 
    data?.comment || 
    data?.donor_comment || 
    data?.message || 
    data?.data?.comment || 
    data?.data?.donor_comment;

  if (comment && typeof comment === 'string' && comment.trim().length > 0) {
    return comment.trim();
  }
  return null;
}

function buildAuctionDiscordEmbed(auction: AuctionWinEvent) {
  const fields = [
    {
      name: '🏷️ Auction Item',
      value: `**${auction.auctionName}**`,
      inline: false,
    },
    {
      name: '🏆 Winning Bidder',
      value: auction.winnerName || 'Anonymous Supporter',
      inline: true,
    },
    {
      name: '💰 Winning Amount',
      value: `**$${auction.winningBid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${auction.currency}**`,
      inline: true,
    },
  ];

  if (botConfig.includeEmailInDiscord) {
    fields.push({
      name: '📧 Winner Contact',
      value: auction.winnerEmail 
        ? `\`${auction.winnerEmail}\`` 
        : '*[Protected by Tiltify Public Scope - see dashboard]*',
      inline: true,
    });
  }

  if (auction.donorComment) {
    fields.push({
      name: '💬 Winner Note',
      value: `"${auction.donorComment}"`,
      inline: false,
    });
  }

  return {
    content: botConfig.mentionRole ? `${botConfig.mentionRole} 🏆 **AUCTION WON!**` : '🏆 **AUCTION WON!**',
    username: botConfig.botUsername || 'Tiltify Alerts',
    avatar_url: botConfig.botAvatarUrl,
    embeds: [
      {
        title: `🎉 Auction Won: ${auction.auctionName}`,
        description: `The auction for **${auction.auctionName}** has ended with a winning contribution of **$${auction.winningBid.toFixed(2)}**!`,
        color: parseInt((botConfig.embedColor || '#05c3de').replace('#', ''), 16),
        fields,
        footer: {
          text: 'Tiltify Charity Auction • Real-Time Alert',
          icon_url: 'https://assets.tiltify.com/assets/favicon/apple-touch-icon.png',
        },
        timestamp: auction.timestamp,
      },
    ],
  };
}

async function sendToDiscord(payload: any): Promise<{ success: boolean; error?: string }> {
  if (!botConfig.discordWebhookUrl) {
    return { success: false, error: 'Discord Webhook URL is not configured' };
  }

  try {
    const res = await fetch(botConfig.discordWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      return { success: false, error: `Discord responded with status ${res.status}: ${errText}` };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error sending to Discord' };
  }
}

// API Routes
app.get('/api/config', (_req, res) => {
  res.json(botConfig);
});

app.post('/api/config', (req, res) => {
  botConfig = { ...botConfig, ...req.body };
  res.json({ success: true, config: botConfig });
});

app.get('/api/auctions', (_req, res) => {
  res.json(auctionWins);
});

app.patch('/api/auctions/:id', (req, res) => {
  const { id } = req.params;
  const { auctionName, status } = req.body;
  const item = auctionWins.find((a) => a.id === id);
  if (!item) {
    return res.status(404).json({ error: 'Auction item not found' });
  }
  if (auctionName) item.auctionName = auctionName;
  if (status) item.status = status;
  res.json({ success: true, item });
});

app.get('/api/logs', (_req, res) => {
  res.json(activityLogs);
});

app.delete('/api/logs', (_req, res) => {
  activityLogs = [];
  res.json({ success: true });
});

app.post('/api/discord/test', async (req, res) => {
  const sampleAuction: AuctionWinEvent = {
    id: `test-${Date.now()}`,
    auctionId: 'auc-demo',
    auctionName: req.body.auctionName || 'Signed 2026 Charity Stream Poster & Vinyl',
    winningBid: Number(req.body.winningBid) || 275.00,
    currency: 'USD',
    winnerName: req.body.winnerName || 'DevSupporter',
    winnerEmail: req.body.winnerEmail || 'donor.champion@tiltify.community',
    isEmailPrivate: !req.body.winnerEmail,
    donorComment: req.body.donorComment || 'Proud to support the cause! Keep up the great work!',
    status: 'won',
    timestamp: new Date().toISOString(),
  };

  const discordPayload = buildAuctionDiscordEmbed(sampleAuction);
  const result = await sendToDiscord(discordPayload);

  activityLogs.unshift({
    id: `log-${Date.now()}`,
    type: 'test',
    title: `Test Alert: ${sampleAuction.auctionName}`,
    details: result.success ? 'Sent successfully to Discord' : `Failed: ${result.error}`,
    timestamp: new Date().toISOString(),
    discordStatus: result.success ? 'sent' : 'failed',
    payloadSummary: sampleAuction,
  });

  res.json(result);
});

app.post('/api/tiltify/webhook', async (req, res) => {
  try {
    const payload = req.body;
    const auctionName = extractAuctionName(payload);
    const { email: winnerEmail, isPrivate: isEmailPrivate } = extractWinnerEmail(payload);
    const donorComment = extractDonorComment(payload);
    const amount = Number(payload.amount || payload.data?.amount || payload.bid_amount || payload.data?.bid_amount || 0);
    const donorName = payload.donor_name || payload.data?.donor_name || payload.bidder_name || payload.data?.bidder_name || 'Supporter';

    const newAuctionWin: AuctionWinEvent = {
      id: `auc-${Date.now()}`,
      auctionId: String(payload.auction_id || payload.id || 'auc-item'),
      auctionName: auctionName,
      winningBid: amount > 0 ? amount : 100,
      currency: payload.currency || 'USD',
      winnerName: donorName,
      winnerEmail: winnerEmail,
      isEmailPrivate: isEmailPrivate,
      donorComment: donorComment,
      status: 'won',
      timestamp: new Date().toISOString(),
      rawPayload: payload,
    };

    auctionWins.unshift(newAuctionWin);

    let discordStatus: 'sent' | 'failed' | 'skipped' = 'skipped';
    if (botConfig.discordWebhookUrl && botConfig.notifyOnAuctionWins) {
      const discordPayload = buildAuctionDiscordEmbed(newAuctionWin);
      const discordRes = await sendToDiscord(discordPayload);
      discordStatus = discordRes.success ? 'sent' : 'failed';
    }

    activityLogs.unshift({
      id: `log-${Date.now()}`,
      type: 'auction_won',
      title: `Auction Won: ${auctionName}`,
      details: `Bid $${newAuctionWin.winningBid.toFixed(2)} by ${donorName}${winnerEmail ? ` (${winnerEmail})` : ' [Email masked by Tiltify scope]'}`,
      timestamp: new Date().toISOString(),
      discordStatus,
      payloadSummary: {
        auctionName,
        winnerName: donorName,
        winnerEmail,
        isEmailPrivate,
        donorComment,
        amount: newAuctionWin.winningBid,
      },
    });

    res.status(200).json({ received: true, auctionName, winnerEmail, donorComment });
  } catch (err: any) {
    console.error('Webhook error:', err);
    res.status(500).json({ error: err.message });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);

    app.use('*', async (req, res, next) => {
      if (req.originalUrl.startsWith('/api')) {
        return next();
      }
      try {
        const templatePath = path.resolve(currentDir, 'index.html');
        let template = fs.readFileSync(templatePath, 'utf-8');
        template = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    app.use(express.static(path.join(currentDir, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(currentDir, 'dist', 'index.html'));
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Tiltify Discord Donation Bot server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
