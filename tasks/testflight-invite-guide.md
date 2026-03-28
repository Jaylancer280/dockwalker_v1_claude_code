# TestFlight — How to Invite Testers

> For the founder. How to add testers to DockWalker on TestFlight.

## Option 1: Public Link (Easiest)

1. Go to **appstoreconnect.apple.com**
2. Click **My Apps** → **DockWalker** → **TestFlight**
3. In the left sidebar, under **External Testing**, click your test group (or create one: **+** → name it "DockWalker Testers")
4. Click **Enable Public Link** (toggle it on)
5. Copy the public link — it looks like: `https://testflight.apple.com/join/XXXXXXXX`
6. Send this link to anyone you want to test. They don't need to give you their email first.

**Share this link via:**

- WhatsApp group message
- Direct message to your 20 crew
- QR code printed on a card at the marina

## Option 2: Email Invite

1. Go to **appstoreconnect.apple.com** → **DockWalker** → **TestFlight**
2. Click your test group under **External Testing**
3. Click **+** next to Testers
4. Enter the tester's email address (must match their Apple ID)
5. Click **Add** → Apple sends them a TestFlight invite email
6. They click the link in the email → opens TestFlight → install

## Adding New Builds

Every time you push code to `main`:

- Vercel auto-deploys the web app (2-3 min)
- Codemagic auto-builds iOS and uploads to TestFlight (10-15 min)
- Testers get an update notification in TestFlight automatically

You don't need to re-invite testers for new builds.

## Removing Testers

In App Store Connect → TestFlight → your test group → click the tester → **Remove**.

## Limits

- External testing: up to 10,000 testers
- Public link: unlimited uses until you disable it
- Builds expire after 90 days — push a new build before then
