// ============================================================================
// ✏️ USER CUSTOMIZATION SETTINGS - EDIT YOUR FRONT-FACING TEXT HERE!
// (You can safely edit any of the text inside the quotes below)
// ============================================================================

const CUSTOM_SETTINGS = {
  // 1. Description shown when live auctions are running:
  //    💡 Tip: {topItemName} will automatically be replaced with the top item's name!
  activeAuctionDescription: "Top item: {topItemName}. Bid now to support the cause!",

  // 2. Fallback description shown if no auctions are currently active:
  idleAuctionDescription: "Check out our charity auctions supporting a great cause!",

  // 3. Title shown when live auctions are running:
  //    💡 Tip: {count} is the total number of live auctions, {topBid} is the highest bid!
  activeAuctionTitle: "⚡ {count} Live Charity Auctions | Top Bid: {topBid}",

  // 4. Fallback title shown if no auctions are currently active:
  idleAuctionTitle: "Charity Auctions | Live Bidding",

  // 5. The Tiltify auction hub link where humans get redirected:
  tiltifyAuctionsUrl: "https://tiltify.com/@0mie/auctions/2026-auctions",

  // 6. Your branded link / domain shown on preview cards:
  shortDomain: "0mie4.kids/auctions",
};

// ============================================================================
// ⚙️ AUTOMATIC ENGINE CODE BELOW (You do NOT need to touch anything down here!)
// ============================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function syncAuctions() {
  const clientId = process.env.TILTIFY_CLIENT_ID;
  const clientSecret = process.env.TILTIFY_CLIENT_SECRET;
  const shortIoKey = process.env.SHORT_IO_API_KEY;
  const shortIoLinkIds = (process.env.SHORT_IO_LINK_ID || '')
    .split(',')
    .map(id => id.trim())
    .filter(Boolean);

  const auctionHouseId = process.env.TILTIFY_AUCTION_HOUSE_ID || 'fc5ad221-74fc-48c8-975c-c5b1f41aadf7';
  const redirectUrl = process.env.TILTIFY_REDIRECT_URL || CUSTOM_SETTINGS.tiltifyAuctionsUrl;
  const githubPagesUrl = process.env.GITHUB_PAGES_URL || 'https://0mie.github.io/Donify/';
  const shortDomain = process.env.SHORT_DOMAIN || CUSTOM_SETTINGS.shortDomain;

  let auctions = [];

  // 1. Query Tiltify v5 API for live items
  if (clientId && clientSecret) {
    try {
      console.log('🔑 Authenticating with Tiltify v5 API...');
      const tokenRes = await fetch('https://v5api.tiltify.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: clientSecret,
          scope: 'public'
        })
      });

      if (!tokenRes.ok) {
        console.warn(`⚠️ Tiltify OAuth responded with status: ${tokenRes.status}`);
      } else {
        const { access_token } = await tokenRes.json();
        console.log(`📡 Fetching auction items for house ${auctionHouseId}...`);
        const itemsRes = await fetch(`https://v5api.tiltify.com/api/public/auction_houses/${auctionHouseId}/auction_items`, {
          headers: {
            'Authorization': `Bearer ${access_token}`,
            'Accept': 'application/json'
          }
        });

        if (itemsRes.ok) {
          const itemsJson = await itemsRes.json();
          auctions = itemsJson.data || itemsJson || [];
          console.log(`✅ Retrieved ${auctions.length} total items from Tiltify.`);

          // Log raw structure of the target item or first item for debugging
          const targetItem = auctions.find(i => i.id === '9be4e2b2-1b72-4a7f-9580-8d2e734a4112') || auctions[0];
          if (targetItem) {
            console.log('🔍 Sample item keys from collection:', Object.keys(targetItem).join(', '));
            console.log('🔍 Sample item JSON:', JSON.stringify(targetItem, null, 2));
          }

          // Probe endpoints to fetch live bids or detailed item info
          if (auctions.length > 0) {
            console.log(`📡 Probing live bid details for ${auctions.length} item(s)...`);
            
            // Helper to recursively find any bid amounts > 0
            const extractBidFromObj = (obj) => {
              if (!obj || typeof obj !== 'object') return 0;
              let highest = 0;
              const checkVal = (v) => {
                if (typeof v === 'number' && v > highest) highest = v;
                if (typeof v === 'string') {
                  const n = parseFloat(v);
                  if (!isNaN(n) && n > highest) highest = n;
                }
              };

              // Direct checks
              checkVal(obj.amount?.value);
              checkVal(obj.amount);
              checkVal(obj.value);
              checkVal(obj.high_bid?.amount?.value);
              checkVal(obj.high_bid?.value);
              checkVal(obj.winning_bid?.amount?.value);
              checkVal(obj.winning_bid?.value);
              checkVal(obj.winningBid?.amount?.value);
              checkVal(obj.winningBid?.value);

              // Check arrays (like bids, auction_bids, etc.)
              for (const key of Object.keys(obj)) {
                if (Array.isArray(obj[key])) {
                  for (const elem of obj[key]) {
                    const sub = extractBidFromObj(elem);
                    if (sub > highest) highest = sub;
                  }
                }
              }
              return highest;
            };

            await Promise.all(auctions.map(async (item) => {
              const probeUrls = [
                // 1. Single item detail endpoints
                `https://v5api.tiltify.com/api/public/auction_houses/${auctionHouseId}/auction_items/${item.id}`,
                `https://v5api.tiltify.com/api/public/auction_items/${item.id}`,
                // 2. Dedicated auction bids endpoints
                `https://v5api.tiltify.com/api/public/auction_houses/${auctionHouseId}/auction_items/${item.id}/auction_bids`,
                `https://v5api.tiltify.com/api/public/auction_items/${item.id}/auction_bids`,
                `https://v5api.tiltify.com/api/public/auction_houses/${auctionHouseId}/auction_bids?auction_item_id=${item.id}`,
                `https://v5api.tiltify.com/api/public/auction_houses/${auctionHouseId}/auction_items/${item.id}/bids`,
                `https://v5api.tiltify.com/api/public/auction_items/${item.id}/bids`
              ];

              for (const url of probeUrls) {
                try {
                  const res = await fetch(url, {
                    headers: {
                      'Authorization': `Bearer ${access_token}`,
                      'Accept': 'application/json'
                    }
                  });

                  if (res.ok) {
                    const json = await res.json();
                    const data = json.data || json;
                    const foundBid = extractBidFromObj(data);
                    
                    console.log(`   ✅ Succeeded: ${url.replace('https://v5api.tiltify.com', '')} (Found bid: $${foundBid})`);
                    if (foundBid > 0) {
                      item.highest_bid_amount = foundBid;
                      break; // Found the active bid!
                    }
                  }
                } catch {
                  // Silently continue to next candidate
                }
              }
            }));
          }
        } else {
          console.warn(`⚠️ Failed to fetch auction items: ${itemsRes.status}`);
        }
      }
    } catch (apiErr) {
      console.warn('⚠️ Error querying Tiltify API:', apiErr.message);
    }
  } else {
    console.log('ℹ️ TILTIFY_CLIENT_ID / TILTIFY_CLIENT_SECRET not provided in environment; proceeding with fallback data.');
  }

  // 2. Filter only active auctions (not ended or sold)
  const now = new Date();
  const activeAuctions = auctions.filter(item => {
    if (item.status && item.status.toLowerCase() !== 'active') return false;
    const end = item.ends_at || item.endsAt || item.end_date;
    if (end && new Date(end) < now) return false;
    return true;
  });

  const activeCount = activeAuctions.length;

  // Helper to extract numeric bid amount safely
  const parseBidAmount = (item) => {
    if (!item) return 0;
    
    // Tiltify API v5 stores active high bids in winning_bid or winningBid (amount.value)
    // or via the item's /bids endpoint (highest_bid_amount)
    const candidates = [
      item.highest_bid_amount,
      item.winning_bid?.amount?.value,
      item.winning_bid?.value,
      item.winning_bid?.amount,
      item.winning_bid,
      item.winningBid?.amount?.value,
      item.winningBid?.value,
      item.winningBid?.amount,
      item.winningBid,
      item.high_bid?.amount?.value,
      item.high_bid?.value,
      item.high_bid,
      item.highest_bid?.amount?.value,
      item.highest_bid?.value,
      item.highest_bid,
      item.current_bid?.amount?.value,
      item.current_bid?.value,
      item.current_bid?.amount,
      item.current_bid,
      item.starting_bid?.amount?.value,
      item.starting_bid?.value,
      item.starting_bid?.amount,
      item.starting_bid,
      item.startingBid?.amount?.value,
      item.startingBid?.value,
      item.startingBid?.amount,
      item.startingBid
    ];

    for (const val of candidates) {
      if (val !== undefined && val !== null && val !== '') {
        const num = typeof val === 'number' ? val : parseFloat(val);
        if (!isNaN(num) && num > 0) return num;
      }
    }
    return 0;
  };

  // Helper to format currency (e.g., $2.50 or $10)
  const formatMoney = (amount) => {
    if (!amount || amount <= 0) return '$0';
    if (Number.isInteger(amount)) {
      return `$${amount.toLocaleString('en-US')}`;
    }
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Log all retrieved items and their bids for transparency
  if (activeAuctions.length > 0) {
    console.log('📋 Active auction items found:');
    for (const item of activeAuctions) {
      const name = item.name || item.title || item.slug || 'Unknown Item';
      const bid = parseBidAmount(item);
      console.log(`   • "${name}" -> Bid: ${formatMoney(bid)}`);
    }
  }

  // Find the item with the highest current bid
  const sorted = [...activeAuctions].sort((a, b) => parseBidAmount(b) - parseBidAmount(a));
  const topItem = sorted[0] || (auctions.length > 0 ? auctions[0] : null);

  const topItemName = topItem?.name || topItem?.title || 'Charity Items';
  const topBidAmount = parseBidAmount(topItem);
  const topItemBid = formatMoney(topBidAmount);

  // 3. Banner Image Detection:
  //    Checks for public/banner.png (or .jpg), otherwise falls back to top item photo
  const publicDir = path.resolve(__dirname, 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  let cardImage = '';
  const bannerCandidates = ['banner.png', 'banner.jpg', 'banner.jpeg'];
  const foundBanner = bannerCandidates.find(file => {
    const fullPath = path.join(publicDir, file);
    try {
      return fs.existsSync(fullPath) && fs.statSync(fullPath).size > 0;
    } catch {
      return false;
    }
  });

  if (foundBanner) {
    const bannerPath = path.join(publicDir, foundBanner);
    const stats = fs.statSync(bannerPath);
    const version = Math.floor(stats.mtimeMs || Date.now());
    cardImage = `https://0mie.github.io/Donify/${foundBanner}?v=${version}`;
    console.log(`🖼️ Using custom campaign banner: ${cardImage}`);
  } else if (topItem) {
    const itemImage = topItem.image?.src || topItem.image_url || topItem.image?.url;
    if (itemImage) {
      cardImage = itemImage;
      console.log(`🖼️ Using top auction item photo: ${cardImage}`);
    }
  }

  if (!cardImage) {
    cardImage = 'https://0mie.github.io/Donify/tiltify-icon.jpg';
  }

  // 4. Build Title and Description using user CUSTOM_SETTINGS
  let title = '';
  let description = '';

  if (activeCount > 0) {
    title = (process.env.ACTIVE_AUCTION_TITLE || CUSTOM_SETTINGS.activeAuctionTitle)
      .replace('{count}', activeCount)
      .replace('{topBid}', topItemBid);

    description = (process.env.ACTIVE_AUCTION_DESCRIPTION || CUSTOM_SETTINGS.activeAuctionDescription)
      .replace('{topItemName}', topItemName)
      .replace('{count}', activeCount)
      .replace('{topBid}', topItemBid);
  } else {
    title = process.env.IDLE_AUCTION_TITLE || CUSTOM_SETTINGS.idleAuctionTitle;
    description = process.env.IDLE_AUCTION_DESCRIPTION || CUSTOM_SETTINGS.idleAuctionDescription;
  }

  console.log(`🎯 Title: ${title}`);
  console.log(`📝 Description: ${description}`);
  console.log(`🔗 Human Redirect: ${redirectUrl}`);
  console.log(`🌐 Short.io Destination URL: ${githubPagesUrl}`);

  // 5. Update Short.io destination directly to GitHub Pages (no Cloudflare worker required)
  if (shortIoKey) {
    // Auto-discover link IDs for both 0mie4.kids (number 0) and omie4.kids (letter O)
    const candidateDomains = ['0mie4.kids', 'omie4.kids'];
    for (const domain of candidateDomains) {
      try {
        const expandRes = await fetch(`https://api.short.io/links/expand?domain=${encodeURIComponent(domain)}&path=auctions`, {
          headers: { 'authorization': shortIoKey, 'Accept': 'application/json' }
        });
        if (expandRes.ok) {
          const expandData = await expandRes.json();
          const foundId = expandData.idString || expandData.id;
          if (foundId && !shortIoLinkIds.includes(String(foundId))) {
            console.log(`🔍 Auto-discovered Short.io link for ${domain}/auctions (ID: ${foundId})`);
            shortIoLinkIds.push(String(foundId));
          }
        }
      } catch (autoErr) {
        // Fallback silently to explicit SHORT_IO_LINK_ID
      }
    }

    if (shortIoLinkIds.length > 0) {
      console.log(`🔄 Updating ${shortIoLinkIds.length} Short.io link(s)...`);
      for (const linkId of shortIoLinkIds) {
        try {
          const shortRes = await fetch(`https://api.short.io/links/${linkId}`, {
            method: 'POST',
            headers: {
              'authorization': shortIoKey,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              originalURL: githubPagesUrl,
              title: title
            })
          });
          if (shortRes.ok) {
            console.log(`✅ Successfully updated Short.io link (${linkId}) -> ${githubPagesUrl}`);
          } else {
            console.warn(`⚠️ Short.io update failed for (${linkId}): status ${shortRes.status}`);
          }
        } catch (shortErr) {
          console.warn(`⚠️ Short.io network error for link ${linkId}:`, shortErr.message);
        }
      }
    }
  }

  // 6. Generate Rich HTML Meta Page with 0mie4.kids OpenGraph & instant human redirect
  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  
  <!-- Canonical & OpenGraph -->
  <link rel="canonical" href="https://${shortDomain}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://${shortDomain}">
  <meta property="og:site_name" content="${shortDomain}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${cardImage}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  
  <!-- Twitter / X Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:domain" content="${shortDomain}">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${cardImage}">
  
  <!-- Instant Redirect for Humans to Tiltify -->
  <meta http-equiv="refresh" content="0; url=${redirectUrl}">
  <script>
    window.location.replace("${redirectUrl}");
  </script>
  <style>
    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #0f172a;
      color: #f8fafc;
      display: grid;
      place-items: center;
      min-height: 100vh;
      margin: 0;
      text-align: center;
    }
    .card {
      background: #1e293b;
      padding: 2.5rem;
      border-radius: 1rem;
      border: 1px solid #334155;
      max-width: 480px;
      margin: 1rem;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
    }
    a.btn {
      display: inline-block;
      margin-top: 1.25rem;
      padding: 0.75rem 1.5rem;
      background: #0284c7;
      color: white;
      text-decoration: none;
      font-weight: 600;
      border-radius: 0.5rem;
      transition: background 0.2s;
    }
    a.btn:hover {
      background: #0369a1;
    }
  </style>
</head>
<body>
  <div class="card">
    <h2 style="margin-top: 0; color: #38bdf8;">Redirecting to Tiltify Auctions...</h2>
    <p style="color: #94a3b8; font-size: 0.95rem;">${description}</p>
    <a href="${redirectUrl}" class="btn">Click here if not redirected</a>
  </div>
</body>
</html>`;

  const outputPath = path.join(publicDir, 'index.html');
  fs.writeFileSync(outputPath, htmlContent, 'utf-8');
  console.log(`✅ Successfully generated preview card HTML at: ${outputPath}`);
}

syncAuctions().catch(err => {
  console.error('❌ Fatal error in syncAuctions:', err);
  process.exit(1);
});
