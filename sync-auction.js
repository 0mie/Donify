// sync-auction.js
// Tiltify v5 Official API + Short.io Dynamic OpenGraph Cards
async function run() {
  const clientId = process.env.TILTIFY_CLIENT_ID;
  const clientSecret = process.env.TILTIFY_CLIENT_SECRET;
  const shortIoKey = process.env.SHORT_IO_API_KEY;
  const shortIoLinkIds = (process.env.SHORT_IO_LINK_ID || '')
    .split(',')
    .map(id => id.trim())
    .filter(Boolean);

  if (!clientId || !clientSecret) {
    console.error('❌ Missing TILTIFY_CLIENT_ID or TILTIFY_CLIENT_SECRET.');
    process.exit(1);
  }

  if (!shortIoKey || shortIoLinkIds.length === 0) {
    console.error('❌ Missing Short.io secrets.');
    process.exit(1);
  }

  console.log('🔑 Authenticating with Tiltify OAuth v5 API...');

  try {
    // 1. Get OAuth Access Token
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
      throw new Error(`Tiltify OAuth failed: ${tokenRes.status}`);
    }

    const { access_token } = await tokenRes.json();
    console.log('✅ Tiltify token obtained successfully!');

    // 2. Fetch Auction Items using Auction House ID
    const houseId = 'fc5ad221-74fc-48c8-975c-c5b1f41aadf7';
    console.log(`📡 Fetching items from Auction House ID: ${houseId}...`);
    
    // Official Tiltify v5 endpoint: /auction_items
    const itemsRes = await fetch(`https://v5api.tiltify.com/api/public/auction_houses/${houseId}/auction_items`, {
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Accept': 'application/json'
      }
    });

    if (!itemsRes.ok) {
      throw new Error(`Failed to fetch auction items: ${itemsRes.status} ${itemsRes.statusText}`);
    }

    const itemsJson = await itemsRes.json();
    const items = itemsJson.data || itemsJson || [];

    console.log(`📦 Found ${items.length} total auction items.`);

    if (items.length === 0) {
      console.log('ℹ️ No auction items found.');
      return;
    }

    // 3. Filter active auctions and sort by ending soonest
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

    // Extract item details
    const itemName = soonest.name || soonest.title || 'Charity Auction Item';
    const bidAmount = soonest.current_bid?.value || soonest.current_bid || soonest.starting_bid?.value || soonest.starting_bid || 0;
    const imageUrl = soonest.image?.src || soonest.image_url || soonest.image?.url || soonest.avatar?.src || '';
    
    // Build direct link to this specific auction item
    const itemSlug = soonest.slug || soonest.id;
    const targetUrl = itemSlug 
      ? `https://tiltify.com/@0mie/auctions/2026-auctions/${itemSlug}`
      : `https://tiltify.com/@0mie/auctions/2026-auctions`;

    const titleText = `🔥 Ending Soonest: ${itemName} ($${bidAmount})`;
    const descriptionText = `Live charity auction on Tiltify! Current Bid: $${bidAmount}. Bid now before it ends!`;

    console.log(`🎯 Soonest Item: "${itemName}"`);
    console.log(`💰 Current Bid: $${bidAmount}`);
    console.log(`🖼️ Image: ${imageUrl || 'None'}`);
    console.log(`🔗 Destination: ${targetUrl}`);

    // 4. Update Short.io links (Original URL + Title)
    for (const linkId of shortIoLinkIds) {
      const updateRes = await fetch(`https://api.short.io/links/${linkId}`, {
        method: 'POST',
        headers: {
          'authorization': shortIoKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          originalURL: targetUrl,
          title: titleText
        })
      });

      if (!updateRes.ok) {
        console.error(`⚠️ Short.io update failed for ${linkId}: ${updateRes.status}`);
      } else {
        const data = await updateRes.json();
        console.log(`🎉 Short.io URL updated: ${linkId} -> ${data.shortURL}`);
      }

      // 5. Update OpenGraph Social Preview Meta Tags (Images + Rich Card)
      if (imageUrl) {
        try {
          await fetch(`https://api.short.io/links/${linkId}/opengraph`, {
            method: 'PUT',
            headers: {
              'authorization': shortIoKey,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              title: titleText,
              description: descriptionText,
              imageURL: imageUrl
            })
          });
          console.log(`🖼️ OpenGraph preview card updated with auction image for ${linkId}`);
        } catch (ogErr) {
          console.log('OpenGraph update note:', ogErr.message);
        }
      }
    }

    console.log('🚀 Finished synchronization!');

  } catch (error) {
    console.error('❌ Sync error:', error.message);
    process.exit(1);
  }
}

run();
