# Sentry Setup Guide

## What is Sentry?

**Sentry** is an error tracking and performance monitoring service that helps you:
- **Track errors** in real-time (client-side and server-side)
- **See exactly what went wrong** with full stack traces
- **Monitor performance** (slow API calls, page load times)
- **Get alerts** when errors occur
- **See user context** (which user experienced the error)

Think of it as a "black box" for your application - it records everything that goes wrong so you can fix it quickly.

---

## Is Sentry Required?

**No!** Sentry is **optional**. The application will work perfectly fine without it. If you don't set it up:
- Errors will still be logged to the console (for development)
- The app will function normally
- You just won't have centralized error tracking

---

## How to Set Up Sentry (Optional)

### Step 1: Create a Sentry Account

1. Go to **https://sentry.io**
2. Click **"Sign Up"** (it's free for small projects)
3. Sign up with email or GitHub

### Step 2: Create a Project

1. After signing up, click **"Create Project"**
2. Select **"Next.js"** as your platform
3. Give it a name (e.g., "Prop Market")
4. Click **"Create Project"**

### Step 3: Get Your DSN

After creating the project, Sentry will show you a **DSN** (Data Source Name). It looks like:
```
https://abc123def456@o123456.ingest.sentry.io/7890123
```

**Copy this DSN** - you'll need it in the next step.

### Step 4: Get Your Org and Project Slugs

1. In Sentry, look at the URL: `https://sentry.io/organizations/YOUR_ORG/projects/YOUR_PROJECT/`
2. **YOUR_ORG** = your organization slug
3. **YOUR_PROJECT** = your project slug

### Step 5: Add to Environment Variables

Add these to your `.env.local` file:

```bash
# Sentry Configuration (Optional)
NEXT_PUBLIC_SENTRY_DSN=https://abc123def456@o123456.ingest.sentry.io/7890123
SENTRY_ORG=your-org-slug
SENTRY_PROJECT=your-project-slug
```

**Replace:**
- `https://abc123def456@o123456.ingest.sentry.io/7890123` with your actual DSN
- `your-org-slug` with your organization slug
- `your-project-slug` with your project slug

### Step 6: Restart Your Dev Server

```bash
# Stop your server (Ctrl+C)
npm run dev
```

---

## How to Use Sentry

Once configured, Sentry will **automatically**:
- Track all errors (no code changes needed)
- Track user context (who experienced the error)
- Monitor performance

### Viewing Errors

1. Go to **https://sentry.io**
2. Click on your project
3. You'll see all errors in real-time
4. Click on an error to see:
   - Full stack trace
   - User who experienced it
   - Browser/device info
   - What they were doing

---

## Sentry Pricing

- **Free Tier:** 
  - 5,000 errors/month
  - 10,000 performance units/month
  - Perfect for small projects

- **Paid Plans:** Start at $26/month for more errors/performance data

**For most projects, the free tier is plenty!**

---

## Troubleshooting

### "Sentry not working"
- Make sure you added the DSN to `.env.local`
- Restart your dev server after adding env vars
- Check that the DSN is correct (no typos)

### "Too many errors"
- Sentry has rate limits on the free tier
- Errors are still logged to console
- Consider upgrading if you need more

### "Don't want Sentry"
- Just don't add the env vars
- The app works fine without it
- Errors still show in console (development)

---

## Quick Reference

**Sentry Website:** https://sentry.io  
**Documentation:** https://docs.sentry.io/platforms/javascript/guides/nextjs/  
**Free Tier:** 5,000 errors/month

---

**Remember:** Sentry is **optional**. Your app works perfectly without it! It's just a nice-to-have for production error tracking.
