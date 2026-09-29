import fs from 'node:fs';

async function run() {
  const clientId = process.env.TILTIFY_CLIENT_ID;
  const clientSecret = process.env.TILTIFY_CLIENT_SECRET;
  const shortIoKey = process.env.SHORT_IO_API_KEY;
  const shortIoLinkIds = (process.env.SHORT_IO_LINK_ID || '')
    .split(',')
    .map(id => id.trim())
    .filter(Boolean);

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
  const { access_token } = await tokenRes.json();

  const houseId = 'fc5ad221-74fc-48c8-975c-c5b1f41aadf7';
  const itemsRes = await fetch(`https://v5api.tiltify.com/api/public/auction_houses/${houseId}/auction_items`, {
    headers: { 'Authorization': `Bearer ${access_token}`, 'Accept': 'application/json' }
  });
  const itemsJson = await itemsRes.json();
  const items = itemsJson.data || itemsJson || [];

  if (items.length === 0) return;

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

  const itemName = soonest.name || soonest.title || 'Charity Auction Item';
  const bidAmount = soonest.current_bid?.value || soonest.current_bid || soonest.starting_bid?.value || soonest.starting_bid || 0;
  const imageUrl = soonest.image?.src || soonest.image_url || soonest.image?.url || 'https://assets.tiltify.com/uploads/auction_item_images/image/98110704-34a7-4637-9d22-94071fabac81/blob-64633ec4-64b6-43a6-84a6-ec52c211646f.jpeg';
  const itemSlug = soonest.slug || soonest.id;
  const targetUrl = `https://tiltify.com/@0mie/auctions/2026-auctions/${itemSlug}`;

  const endDate = new Date(soonest.ends_at || soonest.endsAt || soonest.end_date || 0);
  const msLeft = endDate.getTime() - now.getTime();
  let timeText = 'Ending Soon';
  if (msLeft > 0) {
    const hours = Math.floor(msLeft / (1000 * 60 * 60));
    const minutes = Math.floor((msLeft % (1000 * 60 * 60)) / (1000 * 60));
    timeText = hours > 24 ? `⏳ Ends in ${Math.floor(hours / 24)}d ${hours % 24}h` : `⏳ Ends in ${hours}h ${minutes}m`;
  }

  const fancyTitle = `🔥 ${itemName} | Current Bid: $${bidAmount}`;
  const fancyDescription = `${timeText} • Supporting Omie's Charity Drive on Tiltify! Click to bid.`;

  // 1. Update Short.io destination
  for (const linkId of shortIoLinkIds) {
    try {
      await fetch(`https://api.short.io/links/${linkId}`, {
        method: 'POST',
        headers: { 'authorization': shortIoKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ originalURL: targetUrl, title: fancyTitle })
      });
    } catch (e) {}
  }

  // 2. Generate Rich HTML Card for GitHub Pages
  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${fancyTitle}</title>
  <meta name="description" content="${fancyDescription}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${targetUrl}">
  <meta property="og:title" content="${fancyTitle}">
  <meta property="og:description" content="${fancyDescription}">
  <meta property="og:image" content="${imageUrl}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${fancyTitle}">
  <meta name="twitter:description" content="${fancyDescription}">
  <meta name="twitter:image" content="${imageUrl}">
  <meta http-equiv="refresh" content="0; url=${targetUrl}">
  <script>window.location.replace("${targetUrl}");</script>
</head>
<body style="background:#0f172a;color:white;display:grid;place-items:center;height:100vh;font-family:sans-serif;">
  <p>Redirecting to Tiltify... <a style="color:#38bdf8" href="${targetUrl}">Click here if not redirected</a></p>
</body>
</html>`;

  fs.mkdirSync('./public', { recursive: true });
  fs.writeFileSync('./public/index.html', htmlContent);
  console.log('✅ Rich Preview Page generated!');
}

run();
