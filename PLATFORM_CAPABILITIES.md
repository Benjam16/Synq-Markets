# Platform Capabilities & Update Guide

## 🎯 Complete Platform Overview

### **Public Pages (No Login Required)**

#### 1. **Landing Page** (`/`)
- **Features:**
  - Hero section with value proposition
  - Live market ticker (scrolling prices)
  - "How It Works" section
  - News feed integration
  - Statistics display
  - Call-to-action buttons
- **Purpose:** Marketing and user acquisition

#### 2. **Markets Page** (`/markets`)
- **Features:**
  - Browse all available markets (Kalshi + Polymarket)
  - Search and filter markets
  - Real-time price updates
  - Market cards with:
    - Current price
    - Volume
    - Resolution date
    - Price change indicators
  - Virtualized list (handles 1000+ markets efficiently)
- **Purpose:** Market discovery and research

#### 3. **Challenges Page** (`/challenges`)
- **Features:**
  - View all challenge tiers (Scout, Analyst, Strategist, Whale, VIP)
  - Account sizes and fees
  - Purchase challenges
  - Tier comparison
- **Purpose:** Challenge selection and purchase

#### 4. **Leaderboard** (`/leaderboard`)
- **Features:**
  - Top traders by ROI
  - Real-time rankings
  - Performance metrics
  - Filter by challenge tier
- **Purpose:** Social proof and competition

#### 5. **Login/Signup** (`/login`)
- **Features:**
  - Email/password authentication (Supabase)
  - Sign up new users
  - Sign in existing users
  - Password reset (via Supabase)
- **Purpose:** User authentication

---

### **Protected Pages (Login Required)**

#### 6. **Dashboard** (`/dashboard`)
- **Features:**
  - **Top Stats:** Current equity, P&L, win rate, active positions
  - **Equity Chart:** Real-time equity curve (Recharts)
  - **P&L Chart:** Profit/loss over time
  - **Win/Loss Ratio:** Donut chart visualization
  - **Trading Activity:** Bar chart of daily activity
  - **Open Positions:** List of active trades with:
    - Market name
    - Side (YES/NO)
    - Entry price
    - Current price
    - Unrealized P&L
    - Close button
  - **Market Cards:** Trending markets with quick trade buttons
  - **Performance Stats:** Win rate, largest win/loss, avg trade size
- **Purpose:** Main trading hub and portfolio overview

#### 7. **Accounts Overview** (`/accounts`)
- **Features:**
  - **Fintech Terminal Design:**
    - 4 data tiles (Current Equity, Cash Balance, Unrealized P&L, Total Return %)
    - Institutional charting (Equity & P&L charts)
    - Ratio widgets (Win/Loss donut, Trading activity bars)
    - Performance stats grid
    - Trading history ledger (financial ledger style)
  - **Real-time Updates:** Auto-refreshes every 5 seconds
  - **Mobile Optimized:** Full responsive design
- **Purpose:** Detailed account analysis and performance tracking

#### 8. **Risk Management** (`/risk`)
- **Features:**
  - **Security Terminal Design:**
    - Drawdown visualization with danger zones
    - Daily vs Total drawdown tracking
    - Risk limits display:
      - ✅ PASS: 10% profit target
      - ❌ FAIL: -5% daily drawdown OR -10% total drawdown
    - Real-time risk status
    - Risk event history
  - **Visual Indicators:**
    - Progress bars with danger zones
    - Color-coded status (green/yellow/red)
    - 50% marker warnings
- **Purpose:** Monitor risk limits and account health

#### 9. **Trade History** (`/trade-history`)
- **Features:**
  - **Comprehensive Trade Log:**
    - All trades (open and closed)
    - Filtering: Search, status, side, date range
    - Sorting: Date, P&L, size
    - Performance statistics
    - CSV export functionality
  - **Trade Details:**
    - Entry/exit prices
    - P&L calculation
    - Execution timestamps
    - Market names
- **Purpose:** Trade analysis and record keeping

#### 10. **Archive** (`/archive`)
- **Features:**
  - View past challenge subscriptions
  - Completed/failed challenges
  - Historical performance data
- **Purpose:** Historical account review

#### 11. **Client Portal** (`/portal`)
- **Features:**
  - **2-Column Bento Grid Layout:**
    - **Left Column:**
      - Profile Information (Full Name, Email, PayPal Email)
      - Security (Change Password)
    - **Right Column:**
      - Technical Metadata (Email, User ID)
      - Contact Support form
  - **Functionality:**
    - Update profile (syncs with Supabase Auth)
    - Change password (via Supabase Auth)
    - Contact support (creates support tickets)
- **Purpose:** User account management

#### 12. **Admin Panel** (`/admin`) - Admin Only
- **Features:**
  - **User Management:**
    - View all users
    - Search and filter
    - View user details
  - **Challenge Management:**
    - View all challenges
    - Filter by status
  - **Trade Management:**
    - View all trades
    - Filter by user/challenge
  - **Admin Actions:**
    - **Instant Pass:** Manually pass a trader
    - **Instant Fail:** Manually fail a trader
    - User status management
- **Purpose:** Platform administration

---

## 🔧 Core Functionality

### **Trading System**

#### **Buy Positions** (`/api/buy`)
- Execute YES/NO trades on markets
- Real-time price lookup (cache → entry → API)
- Optimistic UI updates
- Balance validation
- Position tracking

#### **Close Positions** (`/api/sell` or `/api/close-position`)
- Close open positions
- Realize P&L
- Update cash balance
- Background data refresh

#### **Market Data**
- **Providers:** Kalshi + Polymarket
- **Caching:** Multi-layer caching for speed
- **Real-time Updates:** Polling every 60 seconds
- **Price Lookup:** Fast price resolution system

### **Risk Engine**

#### **Automated Risk Monitoring**
- **Supabase Edge Function:** `risk-engine`
- **Checks:**
  - ✅ PASS: 10% total profit
  - ❌ FAIL: -5% daily drawdown OR -10% total drawdown
- **Actions:**
  - Auto-close accounts that breach limits
  - Log risk events
  - Update challenge status

#### **Daily Reset** (`/api/cron/midnight-reset`)
- Snapshot daily balances
- Reset `day_start_balance` for new trading day
- Create balance snapshots

### **Authentication & User Management**

#### **Supabase Auth Integration**
- Email/password authentication
- Session management
- User creation in database
- Password changes
- Profile updates

#### **User Data Sync**
- Supabase Auth ↔ Database sync
- PayPal email storage
- User metadata management

### **Notifications System**
- Real-time notification center
- Toast notifications
- Risk alerts
- Trade confirmations
- System notifications

---

## 📊 Data & Analytics

### **Charts & Visualizations**
- **Equity Curve:** Line chart (Recharts)
- **P&L Chart:** Area chart
- **Win/Loss Ratio:** Donut chart
- **Trading Activity:** Bar chart
- **Drawdown Bars:** Custom progress bars

### **Performance Metrics**
- Total return %
- Daily return %
- Win rate
- Largest win/loss
- Average trade size
- Total volume

### **Leaderboard**
- Top traders by ROI
- Real-time rankings
- Tier-based filtering

---

## 🛠️ API Endpoints

### **Public APIs**
- `GET /api/markets` - List all markets
- `GET /api/markets/trending` - Trending markets
- `GET /api/leaderboard` - Top traders
- `GET /api/news` - News feed
- `GET /api/whale-trades` - Large trades

### **Protected APIs (Require Auth)**
- `GET /api/dashboard` - Dashboard data
- `POST /api/buy` - Execute trade
- `POST /api/sell` - Close position
- `GET /api/positions` - Open positions
- `GET /api/trade-history` - Trade history
- `GET /api/accounts` - Account details
- `GET /api/risk` - Risk metrics
- `GET /api/equity-history` - Equity history

### **Admin APIs** (Admin Only)
- `GET /api/admin/users` - All users
- `GET /api/admin/trades` - All trades
- `GET /api/admin/challenges` - All challenges
- `POST /api/admin/pass-trader` - Instant pass
- `POST /api/admin/fail-trader` - Instant fail

### **Portal APIs**
- `POST /api/portal/update-profile` - Update profile
- `POST /api/portal/change-password` - Change password
- `POST /api/portal/contact-support` - Contact support

### **Cron APIs** (Internal)
- `GET /api/cron/drawdown-check` - Risk engine check
- `GET /api/cron/midnight-reset` - Daily reset

---

## 🎨 Design System

### **Color Palette**
- **Background:** `#020617` (deep navy)
- **Cards:** `#0f172a` / `#1e293b` (charcoal)
- **Primary Accent:** `#C7E539` (electric lime)
- **Text Primary:** `#e2e8f0` (light gray)
- **Text Secondary:** `#94a3b8` (medium gray)
- **Success:** `#10b981` (green)
- **Danger:** `#ef4444` (red)

### **Typography**
- **Font:** Geist Sans (Next.js default)
- **Mono:** Geist Mono (for numbers)
- **Headings:** Bold, uppercase, tight tracking
- **Body:** Medium weight, readable

### **Components**
- **Cards:** Bento grid layout
- **Charts:** Recharts library
- **Icons:** Lucide React
- **Animations:** Framer Motion
- **Notifications:** React Hot Toast

---

## 📱 Mobile Optimization

- **Responsive Design:** All pages mobile-friendly
- **Touch Targets:** Minimum 44px height
- **Full-Screen Modals:** Trade panel on mobile
- **Mobile Navigation:** Hamburger menu
- **Optimized Images:** Next.js Image component
- **Viewport Meta:** Proper mobile viewport

---

## 🔐 Security Features

- **Authentication:** Supabase Auth
- **Protected Routes:** Route-level protection
- **Admin Checks:** Role-based access
- **Cron Security:** CRON_SECRET verification
- **Input Validation:** Server-side validation
- **SQL Injection Protection:** Parameterized queries

---

## ⚡ Performance Optimizations

- **Client-Side Caching:** localStorage for instant loads
- **HTTP Caching:** Cache-Control headers
- **Request Deduplication:** Prevent duplicate requests
- **Optimistic UI:** Instant feedback
- **Progressive Loading:** Show cached data first
- **Code Splitting:** Automatic by Next.js
- **Image Optimization:** Next.js Image component

---

## 🚀 Update Workflow - Best Practices

### **Step 1: Local Development**

```bash
# 1. Make sure you're on the latest code
git pull origin master

# 2. Install dependencies (if needed)
npm install

# 3. Start development server
npm run dev

# 4. Test your changes locally
# Visit http://localhost:3000
```

### **Step 2: Make Your Changes**

#### **Frontend Changes (UI/Components)**
- Edit files in `app/` directory
- Components in `app/components/`
- Pages in `app/[page-name]/page.tsx`
- Hot reload will update automatically

#### **Backend Changes (API Routes)**
- Edit files in `app/api/[route-name]/route.ts`
- Restart dev server if needed
- Test API endpoints directly

#### **Database Changes**
- Create migration files in `db/` directory
- Run migrations locally first
- Test with local database connection

### **Step 3: Test Thoroughly**

#### **Before Committing:**
- [ ] Test all affected features
- [ ] Check mobile responsiveness
- [ ] Verify no console errors
- [ ] Test authentication flows
- [ ] Check API endpoints
- [ ] Verify database operations

#### **Build Test:**
```bash
# Test production build locally
npm run build
npm start
```

### **Step 4: Commit & Push**

```bash
# 1. Stage your changes
git add .

# 2. Commit with descriptive message
git commit -m "Description of what you changed"

# 3. Push to GitHub
git push origin master
```

**Commit Message Best Practices:**
- Be descriptive: "Add dark mode toggle" not "fix"
- Reference features: "Update risk engine to check daily drawdown"
- Mention affected areas: "Fix mobile layout on dashboard"

### **Step 5: Vercel Auto-Deploy**

1. **Vercel automatically detects** the new commit
2. **Starts new deployment** (~2-3 minutes)
3. **Check deployment status:**
   - Go to Vercel Dashboard → Deployments
   - Watch build logs
   - Wait for "Ready" status

### **Step 6: Verify Deployment**

1. **Visit your live site**
2. **Test the changes** you made
3. **Check for errors:**
   - Browser console
   - Vercel function logs
   - Supabase logs (if applicable)

---

## 🔄 Common Update Scenarios

### **Scenario 1: Update UI/Design**

```bash
# 1. Edit component file
# Example: app/components/DashboardMarketCard.tsx

# 2. Test locally
npm run dev

# 3. Commit and push
git add app/components/DashboardMarketCard.tsx
git commit -m "Update dashboard market card styling"
git push origin master

# 4. Vercel auto-deploys
# 5. Verify on live site
```

### **Scenario 2: Add New Feature**

```bash
# 1. Create new page/component
# Example: app/new-feature/page.tsx

# 2. Add API route if needed
# Example: app/api/new-feature/route.ts

# 3. Update navigation (if needed)
# Example: app/components/Layout.tsx

# 4. Test locally
npm run dev

# 5. Build test
npm run build

# 6. Commit and push
git add .
git commit -m "Add new feature: [feature name]"
git push origin master
```

### **Scenario 3: Fix Bug**

```bash
# 1. Identify the bug
# 2. Fix the code
# 3. Test the fix locally
# 4. Commit with clear message
git commit -m "Fix: [describe the bug and fix]"
git push origin master
```

### **Scenario 4: Update Environment Variables**

1. **Go to Vercel Dashboard**
2. **Settings → Environment Variables**
3. **Add/Edit variable**
4. **Save**
5. **Redeploy** (Vercel will prompt you)

**Note:** No code changes needed for env var updates

### **Scenario 5: Database Schema Changes**

```bash
# 1. Create migration file
# Example: db/migrations/001_add_new_column.sql

# 2. Test migration locally
psql $DATABASE_URL -f db/migrations/001_add_new_column.sql

# 3. Run on Supabase
# Go to Supabase Dashboard → SQL Editor
# Copy/paste migration SQL
# Run it

# 4. Update code to use new schema
# 5. Test locally
# 6. Commit and push
git add .
git commit -m "Add new column to users table"
git push origin master
```

---

## ⚠️ Important Notes

### **DO:**
- ✅ Test locally before pushing
- ✅ Use descriptive commit messages
- ✅ Test on mobile after changes
- ✅ Check build logs in Vercel
- ✅ Verify environment variables are set
- ✅ Test authentication flows
- ✅ Check database connections

### **DON'T:**
- ❌ Push untested code
- ❌ Commit sensitive data (passwords, keys)
- ❌ Break existing functionality
- ❌ Skip testing on mobile
- ❌ Deploy during peak hours (if possible)
- ❌ Make breaking changes without notice

---

## 🐛 Troubleshooting Updates

### **Issue: "Build fails on Vercel"**
1. Check build logs in Vercel Dashboard
2. Look for TypeScript errors
3. Verify all dependencies in `package.json`
4. Check for missing environment variables
5. Test build locally: `npm run build`

### **Issue: "Changes not showing on live site"**
1. Verify deployment completed (check Vercel Dashboard)
2. Clear browser cache (hard refresh: Cmd+Shift+R)
3. Check if you're on the right branch
4. Verify the commit was pushed to GitHub

### **Issue: "Feature broken after update"**
1. Check Vercel function logs
2. Check browser console for errors
3. Verify environment variables are set
4. Check database connection
5. Rollback if needed (Vercel → Deployments → Rollback)

---

## 📚 Key Files Reference

### **Frontend Pages**
- `app/page.tsx` - Landing page
- `app/login/page.tsx` - Login/signup
- `app/dashboard/page.tsx` - Main dashboard
- `app/markets/page.tsx` - Markets browser
- `app/accounts/page.tsx` - Accounts overview
- `app/risk/page.tsx` - Risk management
- `app/portal/page.tsx` - Client portal
- `app/admin/page.tsx` - Admin panel

### **API Routes**
- `app/api/dashboard/route.ts` - Dashboard data
- `app/api/buy/route.ts` - Execute trades
- `app/api/sell/route.ts` - Close positions
- `app/api/markets/route.ts` - Market listings
- `app/api/user/route.ts` - User management

### **Core Libraries**
- `lib/db.ts` - Database connection
- `lib/market-fetchers.ts` - Market data fetching
- `lib/supabase-client.ts` - Supabase client
- `lib/error-reporting.ts` - Error tracking

### **Configuration**
- `next.config.ts` - Next.js config
- `vercel.json` - Vercel deployment config
- `tsconfig.json` - TypeScript config
- `package.json` - Dependencies

---

## 🎯 Quick Update Checklist

Before pushing any update:

- [ ] Code tested locally
- [ ] Build succeeds (`npm run build`)
- [ ] No TypeScript errors
- [ ] Mobile responsive (if UI changes)
- [ ] Authentication still works
- [ ] Database operations work
- [ ] No console errors
- [ ] Commit message is descriptive
- [ ] Ready to push to GitHub

---

**Last Updated:** Today
**Status:** ✅ Platform Fully Functional
