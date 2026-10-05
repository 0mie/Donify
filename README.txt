================================================================================
           DONIFY: TILTIFY DISCORD BOT & LIVE AUCTION HUB SETUP GUIDE
================================================================================

Welcome to Donify! This all-in-one suite does two powerful things for your 
charity campaigns:

1. 📢 TILTIFY TO DISCORD DONATION BOT:
   Automatically sends instant real-time donation alerts, donor messages, and 
   reward fulfillment notifications into your Discord server with rich embeds.

2. ⚡ DYNAMIC LIVE AUCTION HUB & SHORT.IO INTEGRATION:
   Automatically syncs your live Tiltify auction items every 10 minutes, detects 
   the highest live bids, updates your branded short links (0mie4.kids/auctions 
   & omie4.kids/auctions), and generates high-impact social preview cards for 
   Twitter/X, Discord, Facebook, and iMessage.

You do NOT need programming experience to use this. Everything is designed to 
be managed directly from GitHub and simple web dashboards.

⏱️ ESTIMATED SETUP TIME FOR A NEW USER:
• Quick Start (Discord Alerts via Webhook + Render Hosting): ~5 to 10 minutes
• Full Setup (Discord Bot + Live Auction Hub + GitHub Pages): ~15 minutes

================================================================================
TABLE OF CONTENTS
================================================================================
PART I: DYNAMIC LIVE AUCTION HUB & SHORT.IO (0mie4.kids/auctions)
  1. How the Live Auction Sync Works
  2. Editing Titles & Descriptions Without Touching Code (GitHub Variables)
  3. Editing Titles & Descriptions in Code (sync-auction.js Lines 1-25)
  4. Character Count Guidelines (Avoid Social Truncation)
  5. Custom Campaign Banner Images & Dynamic Bidding War Switching
  6. Required GitHub Secrets & Setup (Step-by-Step)
  7. Handling Dual Domains (0mie4.kids vs omie4.kids)

PART II: DISCORD DONATION ALERT BOT (Render 24/7 Hosting)
  8. Discord Connection: Webhook URL vs. Bot Token (Which to Choose?)
  9. Step 1: Create a Discord Webhook (or Get Bot Token)
 10. Step 2: Deploy to Render for Free
 11. Step 3: Configure Environment Secrets in Render (& Permanent Persistence)
 12. Step 4: Admin Passcode Protection
 13. Step 5: Connect Tiltify Webhooks
 14. Step 6: Keep Your Bot Awake 24/7 (Free Ping)
 15. Standalone Discord Channels (Auctions vs. Regular Donations)
 16. Testing Your Alerts & Troubleshooting FAQ

================================================================================
PART I: DYNAMIC LIVE AUCTION HUB & SHORT.IO (0mie4.kids/auctions)
================================================================================

--------------------------------------------------------------------------------
1. HOW THE LIVE AUCTION SYNC WORKS
--------------------------------------------------------------------------------
Every 10 minutes (and every time you push code or run it manually), a background 
GitHub Action (.github/workflows/auction-sync.yml) runs:

1. Fetches all live items from your Tiltify Auction House (v5 API).
2. Reads the active winning bids (e.g. $2.50, $10, $250).
3. If auctions are active:
   - Sets the social share title and description featuring your top item & bid.
   - Uses your custom banner image (or falls back to the top item's photo).
4. If no auctions are active:
   - Switches automatically to your custom idle title and description.
5. Updates Short.io link titles and destinations via API.
6. Deploys the rich OpenGraph preview page to GitHub Pages (0mie.github.io/Donify).
7. When humans click the link, they are instantly redirected to your live 
   Tiltify auction hub!

--------------------------------------------------------------------------------
2. EDITING TITLES & DESCRIPTIONS WITHOUT TOUCHING CODE (GITHUB VARIABLES)
--------------------------------------------------------------------------------
You can change your front-facing descriptions and titles at any time without 
editing a single line of code!

1. In GitHub, go to: Settings -> Secrets and variables -> Actions
2. Click the "Variables" tab (next to Secrets).
3. Click "New repository variable".
4. Add any of the following variables:

   VARIABLE NAME               DESCRIPTION & EXAMPLE
   -----------------------------------------------------------------------------
   ACTIVE_AUCTION_TITLE        Title when live auctions are running.
                               Example: ⚡ {count} Live Charity Auctions | Top Bid: {topBid}

   ACTIVE_AUCTION_DESCRIPTION  Card description when auctions are running.
                               Example: Top item: {topItemName}. Bid now to support the cause!

   IDLE_AUCTION_TITLE          Title when no auctions are currently active.
                               Example: Charity Auctions | Live Bidding

   IDLE_AUCTION_DESCRIPTION    Card description when no auctions are running.
                               Example: Check out our charity auctions supporting a great cause!

   TILTIFY_REDIRECT_URL        Where humans get sent when they click your link.
                               Example: https://tiltify.com/@0mie/auctions/2026-auctions

💡 SMART TAGS:
- {topItemName}  Automatically replaced with the name of the highest-bid item.
- {topBid}       Automatically replaced with the highest bid amount (e.g. $2.50).
- {count}        Automatically replaced with total count of active items.

--------------------------------------------------------------------------------
3. EDITING TITLES & DESCRIPTIONS IN CODE (sync-auction.js LINES 1-25)
--------------------------------------------------------------------------------
If you prefer editing the code directly, open "sync-auction.js" in your repo.
Lines 1 to 25 are formatted in a clean, highlighted box at the very top:

   const CUSTOM_SETTINGS = {
     activeAuctionDescription: "Top item: {topItemName}. Bid now to support the cause!",
     idleAuctionDescription: "Check out our charity auctions supporting a great cause!",
     activeAuctionTitle: "⚡ {count} Live Charity Auctions | Top Bid: {topBid}",
     idleAuctionTitle: "Charity Auctions | Live Bidding",
     tiltifyAuctionsUrl: "https://tiltify.com/@0mie/auctions/2026-auctions",
     shortDomain: "0mie4.kids/auctions",
   };

You can safely change any text inside the quotation marks. Everything below 
Line 25 is automatic engine code that you never need to touch.

--------------------------------------------------------------------------------
4. CHARACTER COUNT GUIDELINES (AVOID SOCIAL TRUNCATION)
--------------------------------------------------------------------------------
To prevent Discord, Twitter/X, and Facebook from cutting off your text with "...":

* DESCRIPTION:
  - Sweet spot: 100 to 150 characters (including spaces).
  - Maximum safe limit: 160 characters.
  - If using {topItemName}, leave ~25 characters of room for the item title.

* TITLE:
  - Sweet spot: 40 to 60 characters.
  - Maximum safe limit: 70 characters.
  - Example: "⚡ 4 Live Charity Auctions | Top Bid: $2.50" (~42 chars, fits all phones).

--------------------------------------------------------------------------------
5. DYNAMIC BIDDING WAR IMAGE SWITCHING & CUSTOM BANNERS (/public FOLDER)
--------------------------------------------------------------------------------
When multiple items are listed in an auction, the preview card can automatically 
update to show whichever item currently holds the #1 highest bid!

📸 WHY UPLOAD CUSTOM 1200x630 IMAGES INSTEAD OF TILTIFY PHOTOS?
Tiltify only allows square 800x800 photos when creating listings. When Twitter 
or Discord renders a "summary_large_image" card, it displays in 1200x630 landscape 
(1.91:1 ratio), which can crop the top and bottom of square photos. 

By uploading custom 1200x630 graphics to the "public/" folder, your card will 
always look razor-sharp and uncropped on all social platforms!

--------------------------------------------------------------------------------
📁 HOW TO UPLOAD CUSTOM ITEM IMAGES TO /public:
--------------------------------------------------------------------------------
1. Go directly to your GitHub repo's public folder:
   https://github.com/0mie/Donify/tree/main/public
2. Click "Add file" -> "Upload files".
3. Name your file using ANY of these convenient formats:
   
   A. BY KEYWORD (Easiest & cleanest!):
      - If your item is named "30th Celebration Mewtwo 63/128 Promo Card",
        just name your file: mewtwo.png (or mewtwo.jpg).
      - The script automatically checks if the filename is inside the item's title!
   
   B. BY ITEM ID (Guaranteed 100% exact match):
      - Name the file after the Tiltify Item UUID:
        e.g. 9be4e2b2-1b72-4a7f-9580-8d2e734a4112.png
   
   C. BY SLUG (Full title slug):
      - e.g. 30th-celebration-mewtwo-63-128-promo-card.png

4. Commit the file to the "main" branch.

--------------------------------------------------------------------------------
⚙️ HOW TO TOGGLE SOCIAL CARD IMAGE MODES:
--------------------------------------------------------------------------------
At the top of "sync-auction.js", you will find:

   preferItemImage: false,  // (Default)

   • false (Recommended if you want 1200x630 banner consistency):
     Always uses your high-resolution "public/banner.png" as the card visual, 
     while the Title and Description update dynamically with live bids!
     (Prevents square 800x800 photos from cropping).

   • true (Dynamic item image switching):
     When auctions are live, the card automatically switches to whichever item 
     has the #1 bid! It checks your "public/" folder first for custom graphics 
     (like mewtwo.png), and falls back to Tiltify's official photo. When all 
     auctions end, it automatically switches back to "banner.png".

💡 You can also toggle this anytime without editing code by adding a GitHub 
   Variable: PREFER_ITEM_IMAGE = true (or false) in:
   GitHub -> Settings -> Secrets and variables -> Actions -> Variables tab.

--------------------------------------------------------------------------------
⚡ AUTOMATIC CACHE-BUSTING:
--------------------------------------------------------------------------------
Twitter and Discord normally cache image URLs for up to 7 days. Our script 
automatically appends a version timestamp (?v=1727856000) based on your file's 
upload time. Whenever you upload a new image, Twitter and Discord detect the new 
URL and refresh the preview card immediately!

💡 PRO-TIP FOR TWITTER:
If you post on Twitter right after an update and Twitter shows an old cached preview, 
add a dummy query param to your tweet link (e.g. 0mie4.kids/auctions?1). This 
forces Twitter's scraper to crawl a fresh card on the spot.

--------------------------------------------------------------------------------
6. REQUIRED GITHUB SECRETS & SETUP (STEP-BY-STEP)
--------------------------------------------------------------------------------
To enable the 5-minute auto-sync:

1. In GitHub: Settings -> Secrets and variables -> Actions -> Secrets tab.
2. Ensure you have the following secrets added:

   SECRET NAME               WHERE TO GET IT
   -----------------------------------------------------------------------------
   TILTIFY_CLIENT_ID         Tiltify User Dashboard -> My Applications
   TILTIFY_CLIENT_SECRET     Tiltify User Dashboard -> My Applications
   TILTIFY_AUCTION_HOUSE_ID  Your Auction House ID (e.g. fc5ad221-74fc-...)
   SHORT_IO_API_KEY          Short.io -> Integrations & API -> API Key
   SHORT_IO_LINK_ID          Short.io -> Link Details -> Link ID

3. Enable GitHub Pages:
   - Go to: Settings -> Pages.
   - Under "Build and deployment", set Source to: "Deploy from a branch".
   - Branch: gh-pages, Folder: / (root).
   - Click Save. (The GitHub Action automatically deploys to gh-pages).

--------------------------------------------------------------------------------
7. HANDLING DUAL DOMAINS (0mie4.kids vs omie4.kids)
--------------------------------------------------------------------------------
Notice the two domains:
- 0mie4.kids (starts with digit zero '0')
- omie4.kids (starts with letter 'o')

Short.io treats these as two separate domains with two separate Link IDs.
Our script handles this automatically:
1. AUTO-DISCOVERY: The script queries Short.io for both domains and auto-syncs 
   both links in a single pass.
2. COMMA-SEPARATED IDS: You can also specify both link IDs in SHORT_IO_LINK_ID:
   SHORT_IO_LINK_ID: id_for_0mie, id_for_omie


================================================================================
PART II: DISCORD DONATION ALERT BOT (Render 24/7 Hosting)
================================================================================

--------------------------------------------------------------------------------
8. DISCORD CONNECTION: WEBHOOK URL VS. BOT TOKEN (WHICH TO CHOOSE?)
--------------------------------------------------------------------------------
Donify supports two ways to post alerts to Discord. Choose whichever fits you best:

* OPTION A: WEBHOOK URL (Fastest, zero-friction — Recommended for most users)
  - Setup Time: 10 seconds. No developer accounts or bots to configure.
  - Channel Scope: Permanently locked to 1 channel. To post to a separate 
    #auctions channel, you simply create a 2nd webhook for that channel.
  - Customization: Avatar and bot display name can be changed anytime in your 
    dashboard without touching Discord settings.
  - How to get it: Right-click channel -> Edit Channel -> Integrations -> 
    Webhooks -> New Webhook -> Copy Webhook URL.

* OPTION B: BOT TOKEN (Server-wide presence & multi-channel routing)
  - Setup Time: ~5 minutes via Discord Developer Portal (discord.com/developers).
  - Channel Scope: Can post to ANY channel in your server using Channel IDs.
  - Multi-Channel: Uses 1 bot token server-wide; route to separate channels by 
    just pasting the Channel ID without creating extra webhooks.
  - Member Presence: Appears in your Discord member list with a [BOT] tag.
  - How to get it: Create Application at discord.com/developers/applications -> 
    Bot tab -> Reset Token -> Invite bot to server with Send Messages permissions -> 
    Right-click channel and Copy Channel ID.

SUMMARY:
- If you want the fastest setup with zero maintenance, use Webhooks!
- If you already run a custom bot or want one bot routing to multiple channels 
  via Channel IDs, use Bot Token mode!

--------------------------------------------------------------------------------
9. STEP 1: CREATE A DISCORD WEBHOOK (OR GET BOT TOKEN)
--------------------------------------------------------------------------------
For Webhook (Option A):
1. Open Discord on desktop or browser.
2. Go to the channel where you want donation alerts to appear.
3. Click the Gear icon (Edit Channel) next to the channel name.
4. Click "Integrations" -> "Webhooks" -> "New Webhook".
5. Name it (e.g. "Donify Alerts").
6. Click "Copy Webhook URL".
   (Looks like: https://discord.com/api/webhooks/123456789/abcdefgh...)

--------------------------------------------------------------------------------
10. STEP 2: DEPLOY TO RENDER FOR FREE
--------------------------------------------------------------------------------
1. Go to https://dashboard.render.com and sign in.
2. Click "+ New" -> "Web Service".
3. Connect your GitHub repository (Donify).
4. Fill in:
   - Name: donify-bot
   - Language: Node
   - Branch: main
   - Build Command: npm install && npm run build
   - Start Command: npm start
   - Instance Type: Free ($0/month)
5. Do NOT click Deploy yet — proceed to Step 10 to add your environment variables!

--------------------------------------------------------------------------------
11. STEP 3: CONFIGURE ENVIRONMENT SECRETS IN RENDER
--------------------------------------------------------------------------------
In your Render Web Service settings, add these Environment Variables:

   KEY                       VALUE
   -----------------------------------------------------------------------------
   DISCORD_WEBHOOK_URL       https://discord.com/api/webhooks/1234... (from Step 9)
   ADMIN_PASSWORD            YourSecretPassword (locks web dashboard)
   TILTIFY_CAMPAIGN_ID       Your Tiltify Campaign ID

Click "Save Changes" / "Create Web Service". Render will securely deploy.

💡 NEVER LOSE DASHBOARD CUSTOMIZATIONS ON REDEPLOY:
Render containers use temporary cloud disks that reset when you push new code to 
GitHub. Donify automatically protects your settings in two ways:
1. BROWSER AUTO-RESTORE: Your browser automatically remembers your custom colors, 
   bot names, and auction settings, and syncs them back to Render on next visit.
2. 100% PERMANENT RENDER PERSISTENCE (RECOMMENDED):
   - In your Donify dashboard top bar, click "Backup & Sync".
   - Under "DONIFY_CONFIG", click "Copy Value".
   - In Render -> Your Web Service -> Environment tab, add:
     DONIFY_CONFIG = <paste copied JSON value>
   Render will permanently remember all your settings across every rebuild forever!

--------------------------------------------------------------------------------
12. STEP 4: ADMIN PASSCODE PROTECTION
--------------------------------------------------------------------------------
Setting ADMIN_PASSWORD locks your web dashboard settings from unauthorized 
visitors. Visitors see a clean lock screen. Tiltify webhooks and status endpoints 
remain completely functional in the background.

--------------------------------------------------------------------------------
13. STEP 5: CONNECT TILTIFY WEBHOOKS
--------------------------------------------------------------------------------
1. Open your Render bot dashboard URL (e.g. https://donify-bot.onrender.com).
2. Copy your Webhook Endpoint URL:
   https://donify-bot.onrender.com/api/tiltify/webhook
3. Go to Tiltify (https://tiltify.com):
   - Campaign Dashboard -> Settings -> Webhooks.
   - Click "Add Webhook".
   - Paste the Webhook Endpoint URL into Payload URL.
   - Select events: "Donation Created" and "Auction Ended".
   - Save.

--------------------------------------------------------------------------------
14. STEP 6: KEEP YOUR BOT AWAKE 24/7 (FREE PING)
--------------------------------------------------------------------------------
Render puts inactive free apps to sleep after 15 minutes. Set up a free 10-minute 
ping to keep it awake 24/7:

1. Go to https://cron-job.org and sign up.
2. Click "Cronjobs" -> "Create Cronjob":
   - Title: Donify Keep-Alive
   - URL: https://YOUR-APP.onrender.com/api/status
     (Must start with https:// and end with /api/status)
   - Schedule: "Every 10 minutes"
   - Method: GET
3. Click "Create" and test it. You should see "200 OK".

--------------------------------------------------------------------------------
15. STANDALONE DISCORD CHANNELS (AUCTIONS VS REGULAR DONATIONS)
--------------------------------------------------------------------------------
If you want to keep regular donation alerts and auction house wins in separate 
Discord channels (e.g. #donations and #auctions):

1. IN DISCORD WEBHOOK MODE:
   - Discord webhooks are permanently tied to a single channel.
   - Go to your auction channel (e.g. #auctions) -> Edit Channel -> Integrations -> 
     Webhooks -> Create Webhook.
   - In Donify Dashboard -> Discord Settings -> Auction House Notifications:
     Check "Route Auction House Alerts to a Standalone Channel" and paste your 
     new Auction Webhook URL.
   - Standard donations will post to your main channel; auction winning bids and 
     prize fulfillment alerts will post to your dedicated auction channel!

2. IN BOT TOKEN MODE:
   - No extra webhook needed! Your bot can post to any channel in your server.
   - In Discord, right-click your dedicated auction channel and click "Copy Channel ID" 
     (requires Developer Mode enabled in Discord User Settings -> Advanced).
   - In Donify Dashboard -> Discord Settings -> Auction House Notifications:
     Check "Route Auction House Alerts to a Standalone Channel" and paste the 
     Auction Channel ID.

3. DUAL-CHANNEL POSTING (Public Celebration + Private Staff Fulfillment):
   - Check "Dual Posting: Also post public winner announcement to main channel"
     (or set DISCORD_DUAL_POST_AUCTIONS=true).
   - Posts a public celebratory announcement to your main donations channel with 
     donor shipping addresses & emails AUTOMATICALLY HIDDEN for privacy, while 
     simultaneously delivering the complete prize fulfillment card (with full/spoiler 
     address details & staff role mentions) to your dedicated staff channel!

4. AUCTION SHIPPING PRIVACY MODES:
   - "Public Safe (Hide Address & Email)": Hides physical street address & contact 
     email completely from public channels (staff view them in Prize Shipping Center).
   - "Spoiler Tags (Click to Reveal)": Masks address and email behind Discord 
     spoiler tags (||...||) for semi-private or member-only channels.
   - "Full Fulfillment Details": Displays full address in formatted code blocks 
     (recommended for locked/private staff fulfillment channels).

5. 0-BID UNSOLD PROTECTION & SURVEY PLACEHOLDER FILTERING:
   - Items that end with 0 bids are automatically recognized as unsold and will 
     never trigger false winning alerts or add to campaign totals.
   - Tiltify's placeholder notes ("winner info provided in winner survey") are 
     intelligently filtered so genuine donor shipping addresses and prize details 
     take precedence.

6. OPTIONAL ENVIRONMENT VARIABLES (Render):
   - DISCORD_SEPARATE_AUCTION_CHANNEL=true
   - DISCORD_DUAL_POST_AUCTIONS=true
   - DISCORD_AUCTION_SHIPPING_PRIVACY=public_safe  (or 'spoiler' / 'full')
   - DISCORD_AUCTION_WEBHOOK_URL=https://discord.com/api/webhooks/...
   - DISCORD_AUCTION_CHANNEL_ID=123456789012345678
   - DISCORD_AUCTION_MENTION_TYPE=role  (or 'here' / 'everyone' / 'none')
   - DISCORD_AUCTION_MENTION_ROLE_ID=123456789012345678

--------------------------------------------------------------------------------
16. TESTING YOUR ALERTS & TROUBLESHOOTING FAQ
--------------------------------------------------------------------------------
* How to Test:
  Open your Render bot dashboard and click "Test Alert" in the top bar. You 
  will instantly see a card in Discord! You can also use the "Donation Sandbox" 
  tab to simulate custom donor names, rewards, and auction wins.

* Q: Where do I edit colors, bot avatar, or donor embed formatting?
  A: In the "Visual Customizer" tab of your bot dashboard.

* Q: Why did my dashboard settings reset after pushing new code to GitHub?
  A: Render runs on temporary cloud containers that reset when rebuilding from Git. 
  Donify now automatically backs up your settings in your browser and auto-restores 
  them to the server. For 100% permanent server persistence, click "Backup & Sync" 
  in your dashboard and add the DONIFY_CONFIG variable to your Render Environment tab!

* Q: Does editing GitHub Variables require re-deploying Render?
  A: No! GitHub Variables only control the Live Auction Social Card sync action. 
  Render runs the donation webhook server independently.

* Q: How often does the auction card update on Short.io?
  A: Every 10 minutes automatically via GitHub Actions, or instantly whenever 
  you click "Run workflow" in GitHub Actions.

================================================================================
                    Happy Fundraising & Good Luck!
================================================================================
