================================================================================
           TILTIFY TO DISCORD DONATION BOT - BEGINNER SETUP GUIDE
================================================================================

Welcome! This bot automatically sends real-time donation alerts and auction 
house notifications from your Tiltify charity campaigns straight into your 
Discord server with rich, customized embed cards.

You do NOT need any coding experience to set this up. Follow the simple steps 
below.

================================================================================
TABLE OF CONTENTS
================================================================================
1. What You Need Before You Begin
2. Step 1: Create a Discord Webhook (Takes 1 Minute)
3. Step 2: Deploy to Render for Free
4. Step 3: Configure Environment Secrets in Render (CRITICAL FOR PUBLIC REPOS)
5. Step 4: Protect Your Bot with an Admin Passcode
6. Step 5: Connect Tiltify (Instant Webhook)
7. Step 6: Keep Your Bot Awake 24/7 (Free Ping Setup)
8. Step 7: Test Your Alerts
9. Troubleshooting & FAQ

================================================================================
1. WHAT YOU NEED BEFORE YOU BEGIN
================================================================================
* A Discord account and a Discord server where you have "Manage Webhooks" 
  permission (or Server Owner/Admin).
* A Tiltify account with an active campaign or charity stream.
* A free Render account (https://render.com) to host the bot online 24/7.
* A free GitHub account (https://github.com) to connect to Render.
* A free cron-job.org account (https://cron-job.org) to keep Render awake.

================================================================================
2. STEP 1: CREATE A DISCORD WEBHOOK (Takes 1 Minute)
================================================================================
A webhook is a secure link that allows this bot to post messages in your Discord channel.

1. Open Discord on your desktop or browser.
2. Go to the server and the channel where you want donation alerts to appear.
3. Click the Gear icon (Edit Channel) next to the channel name.
4. Click "Integrations" on the left menu.
5. Click "Webhooks", then click "New Webhook" (or "Create Webhook").
6. Give it a name (for example: "Tiltify Alerts").
7. Click "Copy Webhook URL".
8. Keep this URL handy — you will paste it into your Render Environment variables!
   (It looks like: https://discord.com/api/webhooks/123456789/abcdefgh...)

================================================================================
3. STEP 2: DEPLOY TO RENDER FOR FREE
================================================================================
1. Fork or push this repository to your GitHub account.
2. Go to https://dashboard.render.com and sign in.
3. Click the "+ New" button at the top, then choose "Web Service".
4. Select "Build and deploy from a Git repository" and choose your repository.
5. Fill in the basic settings:
   - Name: Choose a name for your bot (e.g. "my-tiltify-bot")
   - Language: Node
   - Branch: main (or master)
   - Region: Any region close to you
   - Build Command: npm install && npm run build
   - Start Command: npm start
   - Instance Type: Free ($0/month)
6. DO NOT click "Deploy" yet — proceed to Step 3 below to add your secrets!

================================================================================
4. STEP 3: CONFIGURE ENVIRONMENT SECRETS IN RENDER (CRITICAL FOR PUBLIC REPOS)
================================================================================
To keep your Discord webhook, bot tokens, and Tiltify secrets 100% private and 
never exposed in your public GitHub repository:

1. In your Render Web Service settings, scroll down to the "Environment Variables" section
   (or click "Environment" in the left sidebar after creating the service).
2. Add the following environment variables:

   KEY:                      VALUE:
   -----------------------------------------------------------------------------
   DISCORD_WEBHOOK_URL       https://discord.com/api/webhooks/1234... (your webhook)
   ADMIN_PASSWORD            YourSecretPasscode123 (locks dashboard settings)
   TILTIFY_CAMPAIGN_ID       Your Tiltify Campaign ID (optional if using webhook)

3. (Optional for Bot Mode only):
   If you use a Discord Bot Application instead of a Webhook:
   DISCORD_BOT_TOKEN         Your Discord Bot Token from developer portal
   DISCORD_CHANNEL_ID        Your Discord Channel ID (numeric)

4. (Optional for Tiltify API Polling):
   TILTIFY_CLIENT_ID         Your Tiltify App Client ID
   TILTIFY_CLIENT_SECRET     Your Tiltify App Client Secret

5. Click "Save Changes" (or "Create Web Service").
Render will securely encrypt these values. They will NEVER be visible in your GitHub 
repository, code files, or public web pages!

================================================================================
5. STEP 4: PROTECT YOUR BOT WITH AN ADMIN PASSCODE
================================================================================
If you set the ADMIN_PASSWORD environment variable in Step 3, your bot is already 
fully locked!

To change or set your passcode from the web dashboard:
1. Open your Render bot URL in your browser.
2. Click the amber "Set Passcode" button in the top navigation bar.
3. Type a passcode (4+ characters or a PIN) and click "Set Passcode & Lock".
4. Your browser will remember you, while other visitors will see a clean lock screen.

================================================================================
6. STEP 5: CONNECT TILTIFY (INSTANT WEBHOOK)
================================================================================
Tiltify can notify your bot the exact second someone donates!

1. Open your bot dashboard URL in your browser.
2. Go to the "Tiltify Settings" tab.
3. Enter your Tiltify Campaign ID or public slug.
4. Copy your Webhook Endpoint URL shown on the screen.
   (It looks like: https://your-app-name.onrender.com/api/tiltify/webhook)
5. Go to Tiltify (https://tiltify.com):
   - Navigate to your Campaign Dashboard.
   - Go to Settings -> Webhooks (or Integrations -> Webhooks).
   - Click "Add Webhook".
   - Paste the Webhook Endpoint URL into the Payload URL field.
   - Select events: "Donation Created" and "Auction Ended" (or All Events).
   - Save the webhook.

Tiltify will now send every donation directly to your bot!

================================================================================
7. STEP 6: KEEP YOUR BOT AWAKE 24/7 (FREE PING SETUP)
================================================================================
Render's free tier puts inactive apps to sleep after 15 minutes of silence. 
Setting up a free 10-minute ping prevents your bot from ever sleeping so alerts 
arrive with ZERO delay.

1. Go to https://cron-job.org and create a free account.
2. Click "Cronjobs" -> "Create Cronjob".
3. Configure the job with these exact settings:
   - Title: Tiltify Bot Keep-Alive
   - URL: https://YOUR-APP-NAME.onrender.com/api/status
     *** CRITICAL: Make sure the URL starts with https://, NOT http:// ***
     *** Replace YOUR-APP-NAME with your real Render app address ***
   - Execution schedule: "Every 10 minutes"
   - Request Method: GET
   - Advanced -> Request Timeout: 30 seconds
4. Click "Create".
5. Test it by clicking the "Run now / Test" button. You should see "200 OK"!

* Note: /api/status is completely public and never requires a passcode, so 
  your ping will work 24/7 without issues.

================================================================================
8. STEP 7: TEST YOUR ALERTS
================================================================================
You don't have to wait for a real donation to verify everything works:

1. Open your bot dashboard.
2. In the top navigation bar, click "Test Alert".
   - Check Discord! You should immediately see a test donation card.
3. Switch to the "Donation Sandbox & Tester" tab:
   - Test custom donor names, amounts, and donor messages.
   - Test reward fulfillment (shirts, stickers, custom rewards).
   - Test Tiltify Auction House notifications (winning bidder, delivery address).

================================================================================
9. TROUBLESHOOTING & FAQ
================================================================================
Q: My Discord test alert didn't show up.
A: Check that your DISCORD_WEBHOOK_URL is configured in Render Environment 
   Variables (or pasted in the Discord Webhook & Bot Info tab).

Q: Why shouldn't I commit data/app-config.json to GitHub?
A: That file stores local dashboard settings. It is already added to .gitignore 
   so your tokens and webhooks will never leak to GitHub. Always use Render's 
   Environment Variables for private secrets.

Q: cron-job.org failed or sent me a failure email.
A: 1. Check that the URL begins with "https://" (http will cause a 301 error).
   2. Ensure the schedule is set to Every 10 minutes (not once an hour).
   3. Ensure you used /api/status at the end of your real Render URL.

Q: Will Tiltify webhooks be blocked if I have an admin passcode set?
A: No! The passcode only protects the settings dashboard from unauthorized 
   browsers. Tiltify webhooks (/api/tiltify/webhook) and status checks 
   (/api/status) are always open and functional.

Q: How do I change my bot's name or avatar?
A: In the "Visual Customizer" or "Webhook & Bot Info" tab, customize the 
   "Bot Display Name" and upload any custom PNG/JPEG or choose your favorite 
   embed theme color.

================================================================================
10. TILTIFY LIVE AUCTION HOUSE & DYNAMIC SHORT.IO LINK SETUP
================================================================================
The repository includes an automated GitHub Action (.github/workflows/auction-sync.yml) 
and script (sync-auction.js) to keep your Short.io dynamic link (0mie4.kids/auctions) 
synced with live Tiltify auctions:

1. How the Banner Image Works:
   - Automatic (Zero maintenance): If no banner is uploaded, the script automatically 
     uses the photo from the auction that currently has the highest bid!
   - Fixed Campaign Banner: Drop a 1200x630px image named banner.png (or .jpg) 
     into the public/ folder of your repo. The script will automatically use it 
     for the social card preview.

2. Short.io & DNS Clean-up (No Cloudflare Worker needed):
   - In Short.io: Set destination (Original URL) of 0mie4.kids/auctions to your 
     GitHub Pages URL: https://0mie.github.io/Donify/
   - In Porkbun (DNS): Remove any leftover worker CNAME records pointing to 
     auction-card.donify.workers.dev. Keep only Short.io records.
   - In Cloudflare: You can delete the auction-card worker.

3. GitHub Secrets (Repository Settings -> Secrets and variables -> Actions):
   - TILTIFY_CLIENT_ID: Your Tiltify App Client ID
   - TILTIFY_CLIENT_SECRET: Your Tiltify App Client Secret
   - SHORT_IO_API_KEY: Your Short.io API key (optional for auto-syncing link title)
   - SHORT_IO_LINK_ID: Your Short.io link ID (optional)

================================================================================
Enjoy your automated Tiltify donation alerts!
================================================================================
