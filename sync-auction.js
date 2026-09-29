// sync-auction.js
// Tiltify v5 Official API + Short.io Rich Social OpenGraph Cards
async function run() {
  const clientId = process.env.TILTIFY_CLIENT_ID;
  const clientSecret = process.env.TILTIFY_CLIENT_SECRET;
  const shortIoKey = process.env.SHORT_IO_API_KEY;
  const shortIoLinkIds = (process.env.SHORT_IO_LINK_ID || '')
    .split(',')
    .map(id => id.trim())
    .filter(Boolean);

  if (!clientId || !clientSecret || !shortIoKey || shortIoLinkIds.length === 0) {
    console.error('❌ Missing credentials.');
    process.exit(1);
  }

  try {
    // 1. Authenticate with Tiltify OAuth
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

    // 2. Fetch Auction Items
    const houseId = 'fc5ad221-74fc-48c8-975c-c5b1f41aadf7';
    const itemsRes = await fetch(`https://v5api.tiltify.com/api/public/auction_houses/${houseId}/auction_items`, {
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Accept': 'application/json'
      }
    });
    const itemsJson = await itemsRes.json();
    const items = itemsJson.data || itemsJson || [];

    if (items.length === 0) {
      console.log('ℹ️ No items found.');
      return;
    }

    // 3. Find soonest ending item
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

    // Helper: Find item image across all possible Tiltify fields
    let imageUrl = '';
    if (soonest.image) {
      imageUrl = typeof soonest.image === 'string' ? soonest.image : (soonest.image.src || soonest.image.url || '');
    }
    if (!imageUrl && Array.isArray(soonest.images) && soonest.images.length > 0) {
      const first = soonest.images[0];
      imageUrl = typeof first === 'string' ? first : (first.src || first.url || '');
    }
    if (!imageUrl && soonest.image_url) imageUrl = soonest.image_url;
    if (!imageUrl && soonest.media) {
      imageUrl = Array.isArray(soonest.media) ? (soonest.media[0]?.src || soonest.media[0]?.url) : (soonest.media.src || soonest.media.url);
    }
    if (!imageUrl && soonest.photo) {
      imageUrl = typeof soonest.photo === 'string' ? soonest.photo : (soonest.photo.src || soonest.photo.url);
    }

    // Fallback: If Tiltify v5 uses an attachment or media ID, print available keys to inspect
    if (!imageUrl) {
      console.log('Available item keys:', Object.keys(soonest));
    }

    // Calculate time remaining countdown
    const endDate = new Date(soonest.ends_at || soonest.endsAt || soonest.end_date || 0);
    const msLeft = endDate.getTime() - now.getTime();
    let timeText = 'Ending Soon';
    if (msLeft > 0) {
      const hours = Math.floor(msLeft / (1000 * 60 * 60));
      const minutes = Math.floor((msLeft % (1000 * 60 * 60)) / (1000 * 60));
      if (hours > 24) {
        const days = Math.floor(hours / 24);
        timeText = `⏳ Ends in ${days}d ${hours % 24}h`;
      } else {
        timeText = `⏳ Ends in ${hours}h ${minutes}m`;
      }
    }

    const itemName = soonest.name || soonest.title || 'Charity Auction Item';
    const bidAmount = soonest.current_bid?.value || soonest.current_bid || soonest.starting_bid?.value || soonest.starting_bid || 0;
    const itemSlug = soonest.slug || soonest.id;
    const targetUrl = `https://tiltify.com/@0mie/auctions/2026-auctions/${itemSlug}`;

    // Fancy Title and Description for OpenGraph & Socials
    const fancyTitle = `🔥 ${itemName} | Current Bid: $${bidAmount}`;
    const fancyDescription = `${timeText} • Supporting Omie's Charity Drive on Tiltify! Click to view details and place your bid.`;

    console.log(`🎯 Item: "${itemName}"`);
    console.log(`💰 Bid: $${bidAmount}`);
    console.log(`⏱️ Status: ${timeText}`);
    console.log(`🖼️ Image URL: ${imageUrl || 'None detected yet'}`);

    // 4. Update Short.io destination URL and link title
    for (const linkId of shortIoLinkIds) {
      const updateRes = await fetch(`https://api.short.io/links/${linkId}`, {
        method: 'POST',
        headers: {
          'authorization': shortIoKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          originalURL: targetUrl,
          title: fancyTitle
        })
      });

      if (updateRes.ok) {
        const linkData = await updateRes.json();
        console.log(`🎉 Updated destination: ${linkData.shortURL} -> ${targetUrl}`);
      }

      // 5. Send Rich OpenGraph Card Meta Tags to Short.io
      const ogPayload = {
        title: fancyTitle,
        description: fancyDescription
      };
      if (imageUrl) {
        ogPayload.imageURL = imageUrl;
      }

      const ogRes = await fetch(`https://api.short.io/links/${linkId}/opengraph`, {
        method: 'PUT',
        headers: {
          'authorization': shortIoKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(ogPayload)
      });

      if (ogRes.ok) {
        console.log(`🖼️ OpenGraph preview card updated on Short.io for ${linkId}!`);
      } else {
        const ogErr = await ogRes.text();
        console.log(`OpenGraph update response (${linkId}): ${ogRes.status} ${ogErr}`);
      }
    }

    console.log('🚀 Sync completed successfully!');

  } catch (error) {
    console.error('❌ Sync error:', error.message);
    process.exit(1);
  }
}

run();
