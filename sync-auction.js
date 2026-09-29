// sync-auction.js
const axios = require('axios');

async function run() {
  const tiltifyId = process.env.TILTIFY_CAMPAIGN_ID;
  const shortIoKey = process.env.SHORT_IO_API_KEY;
  // Automatically handles single or comma-separated link IDs (main + typo domain)
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
    // 1. Fetch live auctions from Tiltify v5 API
    const response = await axios.get(
      `https://v5api.tiltify.com/api/public/campaigns/${tiltifyId}/auctions`
    );

    const auctions = response.data.data || response.data || [];
    
    // 2. Filter for active auctions and find the one ending soonest
    const active = auctions.filter(a => new Date(a.ends_at) > new Date());

    if (active.length === 0) {
      console.log('ℹ️ No active auctions right now. Leaving links as-is.');
      return;
    }

    const soonest = active.sort((a, b) => new Date(a.ends_at) - new Date(b.ends_at))[0];
    console.log(`🎯 Found soonest auction: "${soonest.name}" with bid $${soonest.current_bid}`);

    // 3. Update all configured domains in Short.io (main + typo domain!)
    for (const linkId of shortIoLinkIds) {
      const updateRes = await axios.post(
        `https://api.short.io/links/${linkId}`,
        {
          originalURL: soonest.url,
          title: `🔥 Ending Soonest: ${soonest.name} ($${soonest.current_bid})`
        },
        {
          headers: {
            authorization: shortIoKey,
            'Content-Type': 'application/json'
          }
        }
      );
      console.log(`🎉 Successfully updated Short.io link ${linkId} -> ${updateRes.data.shortURL}`);
    }
  } catch (error) {
    console.error('⚠️ Sync check completed with note:', error.message);
  }
}

run();
