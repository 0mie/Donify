// sync-auction.js
// Synchronizes Tiltify live auction house data, updates Short.io links,
// and generates a rich OpenGraph HTML preview for GitHub Pages (https://0mie.github.io/Donify/)
// with instant redirect to the Tiltify auctions page.

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
  const redirectUrl = process.env.TILTIFY_REDIRECT_URL || 'https://tiltify.com/@0mie/auctions/2026-auctions';
  const githubPagesUrl = process.env.GITHUB_PAGES_URL || 'https://0mie.github.io/Donify/';
  const shortDomain = process.env.SHORT_DOMAIN || '0mie4.kids/auctions';

  let auctions = [];

  // 1. Fetch auctions from Tiltify API
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

  // Filter only active auctions (not ended or sold)
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
    const bidVal = item.current_bid?.value ?? 
                   item.current_bid?.amount ?? 
                   item.current_bid ?? 
                   item.starting_bid?.value ?? 
                   item.starting_bid?.amount ?? 
                   item.starting_bid ?? 
                   0;
    return typeof bidVal === 'number' ? bidVal : parseFloat(bidVal) || 0;
  };

  // Find the item with the highest current bid
  const sorted = [...activeAuctions].sort((a, b) => parseBidAmount(b) - parseBidAmount(a));
  const topItem = sorted[0] || (auctions.length > 0 ? auctions[0] : null);

  const topItemName = topItem?.name || topItem?.title || 'Charity Items';
  const topBidAmount = parseBidAmount(topItem);
  const topItemBid = topBidAmount > 0 
    ? `$${topBidAmount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}` 
    : '$0';

  // Part 1: Check for custom banner (banner.png, banner.jpg, banner.jpeg) in public/
  // Otherwise fall back to the top item's photo
  const publicDir = path.resolve(__dirname, 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  let cardImage = '';
  const bannerCandidates = ['banner.png', 'banner.jpg', 'banner.jpeg'];
  const foundBanner = bannerCandidates.find(file => fs.existsSync(path.join(publicDir, file)));

  if (foundBanner) {
    cardImage = `https://0mie.github.io/Donify/${foundBanner}`;
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

  // Titles and Descriptions
  const title = activeCount > 0 
    ? `⚡ ${activeCount} Live Charity Auctions | Top Bid: ${topItemBid}`
    : 'Charity Auctions | Live Bidding';

  const description = activeCount > 0
    ? `Top item: ${topItemName}. Bid now to support the cause!`
    : 'Check out our charity auctions supporting a great cause!';

  console.log(`🎯 Title: ${title}`);
  console.log(`📝 Description: ${description}`);
  console.log(`🔗 Human Redirect: ${redirectUrl}`);
  console.log(`🌐 Short.io Destination URL: ${githubPagesUrl}`);

  // Part 2: Update Short.io destination directly to GitHub Pages (no Cloudflare worker required)
  if (shortIoKey && shortIoLinkIds.length > 0) {
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

  // Part 3: Generate Rich HTML Meta Page with 0mie4.kids OpenGraph & instant human redirect
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
