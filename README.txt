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
4. Step 3: Protect Your Bot with an Admin Passcode
5. Step 4: Connect Tiltify (Instant Webhook)
6. Step 5: Keep Your Bot Awake 24/7 (Free Ping Setup)
7. Step 6: Test Your Alerts
8. Troubleshooting & FAQ

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
8. Keep this URL handy — you will paste it into your bot dashboard!
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
6. Click "Deploy Web Service".
7. Wait 2 to 3 minutes until Render shows "Live" with a green checkmark.
8. Look right beneath your service title to find your bot's public URL:
   Example: https://my-tiltify-bot.onrender.com

================================================================================
4. STEP 3: PROTECT YOUR BOT WITH AN ADMIN PASSCODE
================================================================================
To stop strangers on the internet from changing your webhook or campaign settings:

Option A (From the Dashboard):
1. Open your Render bot URL in your browser.
2. Click the amber "Set Passcode" button in the top navigation bar.
3. Type a passcode (4+ characters or a PIN) and click "Set Passcode & Lock".
4. Your browser will remember you, while other visitors will see a clean lock screen.

Option B (Directly in Render):
1. In your Render Dashboard, go to your Web Service -> "Environment".
2. Add an environment variable:
   Key:   ADMIN_PASSWORD
   Value: YourSecretPasscode123
3. Click "Save Changes".

================================================================================
5. STEP 4: CONNECT TILTIFY (INSTANT WEBHOOK)
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
6. STEP 5: KEEP YOUR BOT AWAKE 24/7 (FREE PING SETUP)
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
7. STEP 6: TEST YOUR ALERTS
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
8. TROUBLESHOOTING & FAQ
================================================================================
Q: My Discord test alert didn't show up.
A: Check that your Discord Webhook URL is pasted accurately in the Discord 
   Settings tab and that the channel still exists.

Q: cron-job.org failed or sent me a failure email.
A: 1. Check that the URL begins with "https://" (http will cause a 301 error).
   2. Ensure the schedule is set to Every 10 minutes (not once an hour).
   3. Ensure you used /api/status at the end of your real Render URL.

Q: Will Tiltify webhooks be blocked if I have an admin passcode set?
A: No! The passcode only protects the settings dashboard from unauthorized 
   browsers. Tiltify webhooks (/api/tiltify/webhook) and status checks 
   (/api/status) are always open and functional.

Q: How do I change my bot's name or avatar?
A: In the Discord Settings tab, customize the "Bot Display Name" and upload any 
   custom PNG/JPEG or choose your favorite embed theme color.

================================================================================
Enjoy your automated Tiltify donation alerts!
================================================================================
