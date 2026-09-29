// sync-auction.js (Zero npm dependencies - runs on pure Node.js)
async function run() {
  const tiltifyId = process.env.TILTIFY_CAMPAIGN_ID;
  const shortIoKey = process.env.SHORT_IO_API_KEY;
  const shortIoLinkIds = (process.env.SHORT_IO_LINK_ID || '')
    .split(',')
    .map(id => id.trim())
    .filter(Boolean);

  if (!tiltifyId || !shortIoKey || shortIoLinkIds.length === 0) {
    console.error('❌ Missing one of the required secrets in GitHub Settings.');
    process.exit(1);
  }

  console.log('📡 Checking Tiltify for active auctions...');

  try {
    // 1. Fetch live auctions from Tiltify v5 API using native fetch
    const tiltifyRes = await fetch(
      `https://v5api.tiltify.com/api/public/campaigns/${tiltifyId}/auctions`,
      {
        headers: { 'Accept': 'application/json' }
      }
    );

    if (!tiltifyRes.ok) {
      throw new Error(`Tiltify API responded with status ${tiltifyRes.status}: ${tiltifyRes.statusText}`);
    }

    const tiltifyData = await tiltifyRes.json();
    const auctions = tiltifyData.data || tiltifyData || [];

    // 2. Filter for active auctions and find the one ending soonest
    const active = auctions.filter(a => new Date(a.ends_at) > new Date());

    if (active.length === 0) {
      console.log('ℹ️ No active auctions right now. Leaving links as-is.');
      return;
    }

    const soonest = active.sort((a, b) => new Date(a.ends_at) - new Date(b.ends_at))[0];
    console.log(`🎯 Found soonest auction: "${soonest.name}" with bid $${soonest.current_bid}`);

    // 3. Update Short.io links (handles primary domain + typo domain)
    for (const linkId of shortIoLinkIds) {
      const updateRes = await fetch(`https://api.short.io/links/${linkId}`, {
        method: 'POST',
        headers: {
          'authorization': shortIoKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          originalURL: soonest.url,
          title: `🔥 Ending Soonest: ${soonest.name} ($${soonest.current_bid})`
        })
      });

      if (!updateRes.ok) {
        const errorText = await updateRes.text();
        console.error(`⚠️ Failed to update ${linkId}: ${updateRes.status} - ${errorText}`);
      } else {
        const data = await updateRes.json();
        console.log(`🎉 Successfully updated Short.io link ${linkId} -> ${data.shortURL}`);
      }
    }
  } catch (error) {
    console.error('⚠️ Sync check error:', error.message);
    process.exit(1);
  }
}

run();
