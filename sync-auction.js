// sync-auction.js
import fs from 'node:fs';

async function run() {
  const clientId = process.env.TILTIFY_CLIENT_ID;
  const clientSecret = process.env.TILTIFY_CLIENT_SECRET;
  const shortIoKey = process.env.SHORT_IO_API_KEY;
  const shortIoLinkIds = (process.env.SHORT_IO_LINK_ID || '')
    .split(',')
    .map(id => id.trim())
    .filter(Boolean);

  if (!clientId || !clientSecret || !shortIoKey || shortIoLinkIds.length === 0) {
    console.error('❌ Missing credentials in GitHub Secrets.');
    process.exit(1);
  }

  console.log('🔑 Authenticating with Tiltify...');
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

  if (!tokenRes.ok) throw new Error(`Tiltify OAuth failed: ${tokenRes.status}`);
  const { access_token } = await tokenRes.json();

  console.log('📡 Fetching auction items...');
  const houseId = 'fc5ad221-74fc-48c8-975c-c5b1f41aadf7';
  const itemsRes = await fetch(`https://v5api.tiltify.com/api/public/auction_houses/${houseId}/auction_items`, {
    headers: { 'Authorization': `Bearer ${access_token}`, 'Accept': 'application/json' }
  });

  if (!itemsRes.ok) throw new Error(`Failed to fetch auction items: ${itemsRes.status}`);
  const itemsJson = await itemsRes.json();
  const items = itemsJson.data || itemsJson || [];

  if (items.length === 0) {
    console.log('ℹ️ No auction items found.');
    return;
  }

  const now = new Date();
  const active = items.filter(item => {
    const end = item.ends_at || item.endsAt || item.end_date;
    return end ? new Date(end) > now : true;
  });

  const candidates = active.length > 0 ? active : items;
  const soonest = candidates.sort((a, b) => {
    const dateA = new Date(a.ends_at || a.endsAt || a.end_date || 0);
    const dateB = new Date(b.ends_at || b.endsAt || b.end_date || 0);
    return dateA - dateB;
  })[0];

  const rawItemName = soonest.name || soonest.title || 'Charity Auction Item';
  const bidAmount = soonest.current_bid?.value || soonest.current_bid || soonest.starting_bid?.value || soonest.starting_bid || 0;
  const imageUrl = soonest.image?.src || soonest.image_url || soonest.image?.url || 'https://assets.tiltify.com/uploads/auction_item_images/image/98110704-34a7-4637-9d22-94071fabac81/blob-64633ec4-64b6-43a6-84a6-ec52c211646f.jpeg';
  const itemSlug = soonest.slug || soonest.id;
  const targetUrl = `https://tiltify.com/@0mie/auctions/2026-auctions/${itemSlug}`;

  // Time remaining calculation
  const endDate = new Date(soonest.ends_at || soonest.endsAt || soonest.end_date || 0);
  const msLeft = endDate.getTime() - now.getTime();
  let timeText = 'Ending Soon';
  if (msLeft > 0) {
    const hours = Math.floor(msLeft / (1000 * 60 * 60));
    const minutes = Math.floor((msLeft % (1000 * 60 * 60)) / (1000 * 60));
    timeText = hours > 24 ? `${Math.floor(hours / 24)}d ${hours % 24}h left` : `${hours}h ${minutes}m left`;
  }

  // ✏️ Custom message
  const customMessage = "Supporting 0mie's Charity Drive on Tiltify! Click to place your bid.";

  // Title: Clean item name + Bid + Time
  const shortName = rawItemName.length > 26 ? rawItemName.substring(0, 24) + '...' : rawItemName;
  const fullTitle = `${shortName} • Bid: $${bidAmount} • ⏳ ${timeText}`;
  const fullDescription = `Bid: $${bidAmount} • ⏳ ${timeText} | ${customMessage}`;

  const gatewayUrl = 'auction-card.donify.workers.dev';

  console.log(`🎯 Title: ${fullTitle}`);
  console.log(`📝 Description: ${fullDescription}`);

  // 1. Update Short.io
  for (const linkId of shortIoLinkIds) {
    try {
      await fetch(`https://api.short.io/links/${linkId}`, {
        method: 'POST',
        headers: {
          'authorization': shortIoKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          originalURL: gatewayUrl,
          title: fullTitle
        })
      });
    } catch (e) {}
  }

  // 2. Generate Rich HTML Meta Page with pure "0mie4.kids" attribution
  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${fullTitle}</title>
  
  <!-- Canonical & OpenGraph -->
  <link rel="canonical" href="https://0mie4.kids/auctions">
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://0mie4.kids/auctions">
  <meta property="og:site_name" content="0mie4.kids/auctions">
  <meta property="og:title" content="${fullTitle}">
  <meta property="og:description" content="${fullDescription}">
  <meta property="og:image" content="${imageUrl}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  
  <!-- Twitter / X Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:domain" content="0mie4.kids/auctions">
  <meta name="twitter:title" content="${fullTitle}">
  <meta name="twitter:description" content="${fullDescription}">
  <meta name="twitter:image" content="${imageUrl}">
  
  <!-- Instant Redirect for Humans to Tiltify -->
  <meta http-equiv="refresh" content="0; url=${targetUrl}">
  <script>window.location.replace("${targetUrl}");</script>
  <style>
    body { font-family: system-ui, sans-serif; background: #0f172a; color: white; display: grid; place-items: center; min-height: 100vh; margin: 0; text-align: center; }
    a { color: #38bdf8; text-decoration: none; font-weight: bold; }
  </style>
</head>
<body>
  <div>
    <h2>Redirecting you to Tiltify...</h2>
    <p><a href="${targetUrl}">Click here if not redirected automatically</a></p>
  </div>
</body>
</html>`;

  fs.mkdirSync('./public', { recursive: true });
  fs.writeFileSync('./public/index.html', htmlContent);
  console.log('✅ Generated clean rich preview cards with 0mie4.kids attribution!');
}

run();
