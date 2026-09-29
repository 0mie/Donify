// sync-auction.js
// Uses official Tiltify v5 Auction House API + Short.io API
async function run() {
  const shortIoKey = process.env.SHORT_IO_API_KEY;
  // Automatically handles single or comma-separated link IDs (main + typo domain)
  const shortIoLinkIds = (process.env.SHORT_IO_LINK_ID || '')
    .split(',')
    .map(id => id.trim())
    .filter(Boolean);

  if (!shortIoKey || shortIoLinkIds.length === 0) {
    console.error('❌ Missing Short.io secrets in GitHub Settings.');
    process.exit(1);
  }

  console.log('📡 Querying Tiltify Auction House API (@0mie/2026-auctions)...');

  try {
    // 1. Official Tiltify v5 Endpoint: Fetch Auction House by User & House Slugs
    const houseUrl = 'https://v5api.tiltify.com/api/public/auction_houses/by/user/slugs/0mie/2026-auctions';
    const houseRes = await fetch(houseUrl, {
      headers: { 'Accept': 'application/json' }
    });

    if (!houseRes.ok) {
      throw new Error(`Tiltify returned ${houseRes.status} ${houseRes.statusText}`);
    }

    const houseJson = await houseRes.json();
    const house = houseJson.data || houseJson;

    if (!house || !house.id) {
      console.log('⚠️ Could not resolve auction house ID from Tiltify.');
      return;
    }

    console.log(`✅ Found Auction House ID: ${house.id} ("${house.name || '2026 Auctions'}")`);

    // 2. Fetch all auction items in this Auction House
    const itemsUrl = `https://v5api.tiltify.com/api/public/auction_houses/${house.id}/items`;
    const itemsRes = await fetch(itemsUrl, {
      headers: { 'Accept': 'application/json' }
    });

    let items = [];
    if (itemsRes.ok) {
      const itemsJson = await itemsRes.json();
      items = itemsJson.data || itemsJson || [];
    } else {
      // If items are nested inside the house object itself:
      items = house.auction_items || house.items || [];
    }

    console.log(`📦 Retrieved ${items.length} auction items.`);

    if (items.length === 0) {
      console.log('ℹ️ No auction items active yet. Leaving short links as-is.');
      return;
    }

    // 3. Find the item that is active and ends soonest
    const now = new Date();
    const activeItems = items.filter(item => {
      const end = item.ends_at || item.endsAt || item.end_date;
      return end ? new Date(end) > now : true;
    });

    const candidates = activeItems.length > 0 ? activeItems : items;
    const soonest = candidates.sort((a, b) => {
      const dateA = new Date(a.ends_at || a.endsAt || a.end_date || 0);
      const dateB = new Date(b.ends_at || b.endsAt || b.end_date || 0);
      return dateA - dateB;
    })[0];

    const itemName = soonest.name || soonest.title || 'Charity Auction Item';
    const currentBid = soonest.current_bid || soonest.currentBid || soonest.starting_bid || 0;
    const targetUrl = soonest.url || `https://tiltify.com/@0mie/auctions/2026-auctions`;

    console.log(`🎯 Soonest ending auction: "${itemName}" (Current bid: $${currentBid})`);
    console.log(`🔗 Target URL: ${targetUrl}`);

    // 4. Update all configured Short.io links (primary + typo domain)
    for (const linkId of shortIoLinkIds) {
      const updateRes = await fetch(`https://api.short.io/links/${linkId}`, {
        method: 'POST',
        headers: {
          'authorization': shortIoKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          originalURL: targetUrl,
          title: `🔥 Ending Soonest: ${itemName} ($${currentBid})`
        })
      });

      if (!updateRes.ok) {
        const errorMsg = await updateRes.text();
        console.error(`⚠️ Failed to update link ${linkId}: ${updateRes.status} - ${errorMsg}`);
      } else {
        const updateData = await updateRes.json();
        console.log(`🎉 Successfully updated Short.io link ${linkId} -> ${updateData.shortURL}`);
      }
    }

  } catch (error) {
    console.error('❌ Sync error:', error.message);
    process.exit(1);
  }
}

run();
