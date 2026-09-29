// sync-auction.js
import fs from 'node:fs';

// Helper to convert text to bold Unicode characters (works across Twitter, Facebook, Discord, WhatsApp)
function toBoldUnicode(text) {
  const boldMap = {
    '0': '𝟬', '1': '𝟭', '2': '𝟮', '3': '𝟯', '4': '𝟰',
    '5': '𝟱', '6': '𝟲', '7': '𝟳', '8': '𝟴', '9': '𝟵',
    'A': '𝗔', 'B': '𝗕', 'C': '𝗖', 'D': '𝗗', 'E': '𝗘',
    'F': '𝗙', 'G': '𝗚', 'H': '𝗛', 'I': '𝗜', 'J': '𝗝',
    'K': '𝗞', 'L': '𝗟', 'M': '𝗠', 'N': '𝗡', 'O': '𝗢',
    'P': '𝗣', 'Q': '𝗤', 'R': '𝗥', 'S': '𝗦', 'T': '𝗧',
    'U': '𝗨', 'V': '𝗩', 'W': '𝗪', 'X': '𝗫', 'Y': '𝗬', 'Z': '𝗭',
    'a': '𝗮', 'b': '𝗯', 'c': '𝗰', 'd': '𝗱', 'e': '𝗲',
    'f': '𝗳', 'g': '𝗴', 'h': '𝗵', 'i': '𝗶', 'j': '𝗷',
    'k': '𝗸', 'l': '𝗹', 'm': '𝗺', 'n': '𝗻', 'o': '𝗼',
    'p': '𝗽', 'q': '𝗾', 'r': '𝗿', 's': '𝘀', 't': '𝘁',
    'u': '𝘂', 'v': '𝘃', 'w': '𝘄', 'x': '𝘅', 'y': '𝘆', 'z': '𝘇'
  };
  return text.split('').map(char => boldMap[char] || char).join('');
}

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

  if (!tokenRes.ok) {
    throw new Error(`Tiltify OAuth failed: ${tokenRes.status}`);
  }
  const { access_token } = await tokenRes.json();

  console.log('📡 Fetching auction items...');
  const houseId = 'fc5ad221-74fc-48c8-975c-c5b1f41aadf7';
  const itemsRes = await fetch(`https://v5api.tiltify.com/api/public/auction_houses/${houseId}/auction_items`, {
    headers: { 'Authorization': `Bearer ${access_token}`, 'Accept': 'application/json' }
  });

  if (!itemsRes.ok) {
    throw new Error(`Failed to fetch auction items: ${itemsRes.status}`);
  }

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

  // Formatting Line 1 (Item Name) & Line 2 (Bold Bid + Time)
  const line1Name = rawItemName.length > 32 ? rawItemName.substring(0, 30) + '...' : rawItemName;
  const boldBidTime = `${toBoldUnicode(`Bid: $${bidAmount}`)} • ⏳ ${toBoldUnicode(timeText)}`;
  
  // Multi-line title for Discord, WhatsApp, and preview bots
  const displayTitle = `${line1Name}\n${boldBidTime}`;
  
  // Custom Domain Branding
  const brandDomain = '0mie4.kids';
  const brandFullUrl = 'https://0mie4.kids/auctions';
  const fancyDescription = `${boldBidTime} • Supporting Omie's Charity Drive on Tiltify! Click to place your bid.`;
  const gatewayUrl = 'https://0mie.github.io/Donify/';

  console.log(`🎯 Line 1: ${line1Name}`);
  console.log(`💰 Line 2: ${boldBidTime}`);
  console.log(`🖼️ Image: ${imageUrl}`);
  console.log(`🔗 Target: ${targetUrl}`);

  // 1. Update Short.io links
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
          title: `${line1Name} | Bid: $${bidAmount}`
        })
      });
    } catch (e) {
      console.log('Short.io update note:', e.message);
    }
  }

  // 2. Generate Rich HTML Meta Page matching all 5 platforms
  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${line1Name} | ${boldBidTime}</title>
  <link rel="canonical" href="${brandFullUrl}">
  <meta name="description" content="${fancyDescription}">
  
  <!-- OpenGraph: Facebook, WhatsApp, Discord, LinkedIn -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="${brandFullUrl}">
  <meta property="og:site_name" content="${brandDomain}/auctions">
  <meta property="og:title" content="${displayTitle}">
  <meta property="og:description" content="${fancyDescription}">
  <meta property="og:image" content="${imageUrl}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  
  <!-- Twitter / X Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="@0mie">
  <meta name="twitter:domain" content="${brandDomain}">
  <meta name="twitter:title" content="${displayTitle}">
  <meta name="twitter:description" content="${fancyDescription}">
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
    <h2>Redirecting to Tiltify...</h2>
    <p><a href="${targetUrl}">Click here if not redirected automatically</a></p>
  </div>
</body>
</html>`;

  fs.mkdirSync('./public', { recursive: true });
  fs.writeFileSync('./public/index.html', htmlContent);
  console.log('✅ Generated ./public/index.html with bold styling, 2-line layout, and 0mie4.kids branding!');
}

run();
