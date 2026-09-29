// sync-auction.js
// Official Tiltify v5 Client Credentials OAuth + Auction House API
async function run() {
  const clientId = process.env.TILTIFY_CLIENT_ID;
  const clientSecret = process.env.TILTIFY_CLIENT_SECRET;
  const shortIoKey = process.env.SHORT_IO_API_KEY;
  const shortIoLinkIds = (process.env.SHORT_IO_LINK_ID || '')
    .split(',')
    .map(id => id.trim())
    .filter(Boolean);

  if (!clientId || !clientSecret) {
    console.error('❌ Missing TILTIFY_CLIENT_ID or TILTIFY_CLIENT_SECRET in GitHub Secrets.');
    process.exit(1);
  }

  if (!shortIoKey || shortIoLinkIds.length === 0) {
    console.error('❌ Missing Short.io secrets in GitHub Settings.');
    process.exit(1);
  }

  console.log('🔑 Authenticating with Tiltify OAuth v5 API...');

  try {
    // 1. Get OAuth Access Token via Client Credentials
    const tokenRes = await fetch('https://v5api.tiltify.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
        scope: 'public'
      })
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      throw new Error(`Tiltify OAuth authentication failed: ${tokenRes.status} - ${errText}`);
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    console.log('✅ Tiltify token obtained successfully!');

    // 2. Fetch Auction House data for @0mie/2026-auctions
    console.log('📡 Fetching Auction House (@0mie/2026-auctions)...');
    const houseRes = await fetch('https://v5api.tiltify.com/api/public/auction_houses/by/user/slugs/0mie/2026-auctions', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });

    if (!houseRes.ok) {
      const errText = await houseRes.text();
      throw new Error(`Failed to fetch auction house: ${houseRes.status} - ${errText}`);
    }

    const houseJson = await houseRes.json();
    const house = houseJson.data || houseJson;
    console.log(`🏛️ Connected to Auction House: "${house.name || '2026-auctions'}" (ID: ${house.id})`);

    // 3. Fetch auction items
    const itemsRes = await fetch(`https://v5api.tiltify.com/api/public/auction_houses/${house.id}/items`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });

    let items = [];
    if (itemsRes.ok) {
      const itemsJson = await itemsRes.json();
      items = itemsJson.data || itemsJson || [];
    } else {
      items = house.auction_items || house.items || [];
    }

    console.log(`📦 Found ${items.length} total auction items.`);

    if (items.length === 0) {
      console.log('ℹ️ No active auctions yet. Leaving Short.io link pointing to main auction page.');
      return;
    }

    // 4. Filter active auctions and sort by ending soonest
    const now = new Date();
    const active = items.filter(item => {
      const end = item.ends_at || item.endsAt || item.end_date;
      return end ? new Date(end) > now : true;
    });

    const candidateList = active.length > 0 ? active : items;
    const soonest = candidateList.sort((a, b) => {
      const dateA = new Date(a.ends_at || a.endsAt || a.end_date || 0);
      const dateB = new Date(b.ends_at || b.endsAt || b.end_date || 0);
      return dateA - dateB;
    })[0];

    const itemName = soonest.name || soonest.title || 'Live Charity Auction';
    const bidValue = soonest.current_bid || soonest.currentBid || soonest.starting_bid || 0;
    const targetUrl = soonest.url || `https://tiltify.com/@0mie/auctions/2026-auctions`;

    console.log(`🎯 Soonest Ending Item: "${itemName}"`);
    console.log(`💰 High Bid: $${bidValue}`);
    console.log(`🔗 Target URL: ${targetUrl}`);

    // 5. Update Short.io link(s) (handles primary + typo domain)
    for (const linkId of shortIoLinkIds) {
      const updateRes = await fetch(`https://api.short.io/links/${linkId}`, {
        method: 'POST',
        headers: {
          'authorization': shortIoKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          originalURL: targetUrl,
          title: `🔥 Ending Soonest: ${itemName} ($${bidValue})`
        })
      });

      if (!updateRes.ok) {
        const err = await updateRes.text();
        console.error(`⚠️ Failed to update Short.io ${linkId}: ${updateRes.status} - ${err}`);
      } else {
        const data = await updateRes.json();
        console.log(`🎉 Successfully updated Short.io link ${linkId} -> ${data.shortURL}`);
      }
    }

    console.log('🚀 All links synchronized successfully!');

  } catch (error) {
    console.error('❌ Sync error:', error.message);
    process.exit(1);
  }
}

run();
