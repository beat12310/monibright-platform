MONIBRIGHT PLATFORM UPDATE - July 23, 2026
==========================================
WHAT'S NEW: subscription billing (14-day trial, Basic GHS120, Pro GHS250),
portal designer, safer router setup script (no more owner lockout),
Paystack key verification, full setup guide on dashboard.

HOW TO DEPLOY (5 minutes):
1. Go to github.com/beat12310/monibright-platform
2. Click "Add file" > "Upload files"
3. Unzip this package, then DRAG the "app" and "lib" folders into the upload box
   (GitHub keeps the folder structure and replaces the old files)
4. Click "Commit changes" - Vercel deploys automatically in ~1 minute

ONE ENV VAR TO ADD (for subscription payments TO YOU):
- vercel.com > monibright-platform > Settings > Environment Variables
- Name:  PLATFORM_PAYSTACK_SECRET
- Value: your own Paystack SECRET key (sk_live_...)
- Then "Redeploy". Until you add it, everything works except the
  "Choose Basic/Pro" payment buttons.

DATABASE: migration-2026-07-23.sql must run once on the AWS database
(Claude applies this via CloudShell).
