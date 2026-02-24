# Production Roadmap - Complete Platform Enhancement

## 🎯 Current Status: ~70% Complete

**✅ Working:**
- Authentication & User Management
- Challenge Purchase Flow
- Basic Trading (Buy/Close positions)
- Dashboard UI
- Risk Monitoring UI

**⚠️ Needs Work:**
- Position P&L calculation (NO positions incorrect)
- Position closing (deletes instead of marking closed)
- Real market data integration
- Payment processing
- Market resolution/settlement

---

## 📋 Priority 1: Critical Business Logic Fixes (Week 1)

### 1.1 Fix Position P&L Calculation ⚠️ CRITICAL

**Problem:** NO positions calculate P&L incorrectly
- Current: `(currentPrice - entryPrice) * quantity` (wrong for NO)
- Should be: 
  - YES: `(currentPrice - entryPrice) * quantity`
  - NO: `(entryPrice - currentPrice) * quantity`

**Files to Fix:**
- `app/api/dashboard/route.ts` - Update P&L calculation
- `app/dashboard/page.tsx` - Display correct P&L

**Impact:** Users see wrong profit/loss, can't trust the platform

---

### 1.2 Fix Position Closing (Keep History) ⚠️ CRITICAL

**Problem:** Closing positions deletes them (loses all trade history)

**Solution:**
1. Add `status` column to `simulated_trades` table
2. Mark as `closed` instead of deleting
3. Add `closed_at` timestamp
4. Update dashboard to show closed positions

**SQL Migration:**
```sql
ALTER TABLE simulated_trades 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed', 'settled')),
ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS close_price NUMERIC(8, 4);
```

**Files to Update:**
- `db/schema.sql` - Add columns
- `app/api/close-position/route.ts` - Update instead of delete
- `app/dashboard/page.tsx` - Show closed positions

**Impact:** Can't see trade history, can't audit, can't generate reports

---

### 1.3 Add Position Size Validation ⚠️ CRITICAL

**Problem:** 20% max position size rule not enforced

**Solution:**
- Check position size before allowing buy
- Calculate: `(price * quantity) / currentEquity <= 0.20`
- Show error if exceeds limit

**Files to Update:**
- `app/api/buy/route.ts` - Add validation before trade
- `app/dashboard/page.tsx` - Show warning if approaching limit

**Impact:** Users can violate risk rules, challenges fail incorrectly

---

### 1.4 Fix Market Resolution & Settlement

**Problem:** No automatic settlement when markets resolve

**Solution:**
1. Create `market_resolutions` table
2. Create settlement worker (Python script)
3. Auto-settle positions when markets resolve
4. Update challenge balances

**SQL:**
```sql
CREATE TABLE market_resolutions (
  id BIGSERIAL PRIMARY KEY,
  provider TEXT NOT NULL,
  market_id TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('yes', 'no')),
  resolved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, market_id)
);
```

**Files to Create:**
- `scripts/market_settlement_worker.py` - Check for resolved markets
- `app/api/settle-market/route.ts` - Manual settlement endpoint

**Impact:** Positions stay open forever, unrealized P&L never realized

---

## 📋 Priority 2: Real API Integrations (Week 2)

### 2.1 Real Market Data Integration

**Current:** Uses demo/fallback data or basic polling

**Enhancements:**

#### A. Kalshi API Integration
- ✅ Worker exists (`scripts/market_data_worker.py`)
- ⚠️ Needs: Better error handling, retry logic
- ⚠️ Needs: Market metadata (names, descriptions, resolution dates)
- ⚠️ Needs: Historical price data storage

**Files to Update:**
- `scripts/market_data_worker.py` - Add metadata fetching
- `db/schema.sql` - Add `market_metadata` table
- `app/api/markets/route.ts` - Return real market names

#### B. Polymarket API Integration
- ✅ Basic integration exists
- ⚠️ Needs: Better market filtering
- ⚠️ Needs: Real-time price updates
- ⚠️ Needs: Market resolution tracking

#### C. Price History Storage
**Current:** Mocked in `app/api/market-history/route.ts`

**Solution:**
```sql
CREATE TABLE price_history (
  id BIGSERIAL PRIMARY KEY,
  provider TEXT NOT NULL,
  market_id TEXT NOT NULL,
  price NUMERIC(8, 4) NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_price_history_market ON price_history(provider, market_id, timestamp);
```

**Files to Update:**
- `scripts/market_data_worker.py` - Store price history
- `app/api/market-history/route.ts` - Query real data

---

### 2.2 News Feed Integration

**Current:** Mock data

**Options:**
1. **NewsAPI** (free tier: 100 requests/day)
2. **RSS Feeds** (free, unlimited)
3. **Alpha Vantage News** (free tier available)
4. **Custom scraper** (for specific sources)

**Implementation:**
- Create `app/api/news/route.ts`
- Fetch relevant news based on active markets
- Cache results (5-10 min)
- Filter by keywords (election, CPI, Fed, etc.)

**Files to Create:**
- `app/api/news/route.ts`
- `scripts/news_fetcher.py` (optional background worker)

---

### 2.3 Market Resolution Tracking

**Problem:** No way to know when markets resolve

**Solution:**
1. Poll Kalshi/Polymarket APIs for resolved markets
2. Store in `market_resolutions` table
3. Auto-settle positions
4. Notify users

**Files to Create:**
- `scripts/market_resolution_checker.py` - Poll for resolved markets
- `app/api/market-resolutions/route.ts` - Get resolved markets

---

## 📋 Priority 3: Payment Processing (Week 2-3)

### 3.1 Stripe Integration

**Current:** Challenge purchase doesn't process payment

**Implementation:**
1. Install Stripe: `npm install stripe @stripe/stripe-js`
2. Create Stripe account, get API keys
3. Add checkout flow to challenges page
4. Verify payment before creating challenge
5. Handle webhooks for payment confirmation

**Files to Create:**
- `app/api/create-checkout/route.ts` - Create Stripe checkout session
- `app/api/webhook/route.ts` - Handle Stripe webhooks
- `app/components/StripeCheckout.tsx` - Checkout component

**Environment Variables:**
```bash
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_..."
STRIPE_SECRET_KEY="sk_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
```

**Flow:**
1. User clicks "Purchase Challenge"
2. Create Stripe checkout session
3. Redirect to Stripe payment page
4. On success, webhook creates challenge
5. Redirect to dashboard

---

## 📋 Priority 4: Database Enhancements (Week 1-2)

### 4.1 Add Market Metadata Table

```sql
CREATE TABLE market_metadata (
  id BIGSERIAL PRIMARY KEY,
  provider TEXT NOT NULL,
  market_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  resolution_date TIMESTAMPTZ,
  category TEXT,
  tags TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, market_id)
);
```

### 4.2 Add Trade History View

```sql
CREATE VIEW v_trade_history AS
SELECT 
  st.*,
  cs.user_id,
  u.email,
  CASE 
    WHEN st.status = 'closed' THEN (st.close_price - st.price) * st.quantity * CASE WHEN st.side = 'yes' THEN 1 ELSE -1 END
    ELSE NULL
  END AS realized_pnl
FROM simulated_trades st
JOIN challenge_subscriptions cs ON cs.id = st.challenge_subscription_id
JOIN users u ON u.id = cs.user_id;
```

### 4.3 Add Performance Metrics

```sql
ALTER TABLE challenge_subscriptions
ADD COLUMN IF NOT EXISTS total_trades INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS winning_trades INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_realized_pnl NUMERIC(14, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS largest_win NUMERIC(14, 2),
ADD COLUMN IF NOT EXISTS largest_loss NUMERIC(14, 2);
```

---

## 📋 Priority 5: UI/UX Polish (Week 3)

### 5.1 Enhanced Dashboard

**Add:**
- Trade history table (closed positions)
- Performance metrics (win rate, avg P&L)
- Market watchlist
- Quick actions (close all, etc.)
- Export data (CSV download)

### 5.2 Better Market Cards

**Enhance:**
- Real market names (not just market_id)
- Resolution countdown timer
- Volume/liquidity indicators
- Price change indicators (24h, 7d)
- Market category tags

### 5.3 Real-time Updates

**Add:**
- WebSocket connection for live prices
- Auto-refresh positions (every 5-10 seconds)
- Live drawdown updates
- Toast notifications for price alerts

### 5.4 Mobile Responsiveness

**Improve:**
- Mobile-optimized dashboard
- Touch-friendly buttons
- Responsive tables
- Mobile navigation

---

## 📋 Priority 6: Risk Management Enhancements (Week 2)

### 6.1 Inactivity Monitoring

**Problem:** 30-day minimum trading period not enforced

**Solution:**
```sql
ALTER TABLE challenge_subscriptions
ADD COLUMN IF NOT EXISTS last_trade_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS days_since_last_trade INT GENERATED ALWAYS AS (
  EXTRACT(DAY FROM NOW() - last_trade_at)
) STORED;
```

**Files to Create:**
- `scripts/inactivity_monitor.py` - Check for inactive challenges
- Auto-fail challenges after 30 days of inactivity

### 6.2 Enhanced Drawdown Monitoring

**Current:** Basic monitoring exists

**Enhance:**
- Real-time alerts (not just at -5%)
- Email notifications (optional)
- Risk score calculation
- Position-level risk metrics

### 6.3 Position Limits Enforcement

**Add:**
- Per-market position limits
- Total exposure limits
- Leverage calculations
- Margin requirements

---

## 📋 Priority 7: Analytics & Reporting (Week 3-4)

### 7.1 User Analytics

**Add:**
- Trading statistics dashboard
- Performance charts
- Win/loss breakdown
- Best/worst trades
- Trading patterns analysis

### 7.2 Admin Dashboard

**Create:**
- User management
- Challenge overview
- Revenue tracking
- Risk monitoring
- System health

### 7.3 Reports

**Generate:**
- Monthly statements
- Tax reports
- Performance summaries
- Challenge completion reports

---

## 📋 Priority 8: Production Infrastructure (Week 4)

### 8.1 Error Tracking

**Add:**
- Sentry integration
- Error logging
- Performance monitoring
- User feedback collection

### 8.2 Security Hardening

**Implement:**
- Rate limiting (API routes)
- Input validation/sanitization
- CSRF protection
- SQL injection prevention
- XSS protection

### 8.3 Performance Optimization

**Optimize:**
- Database query optimization
- Caching strategy (Redis)
- CDN for static assets
- Image optimization
- Code splitting

### 8.4 Deployment

**Set Up:**
- Production environment
- CI/CD pipeline
- Automated testing
- Environment management
- Backup strategy

---

## 🚀 Quick Wins (Do First)

These can be done quickly and have high impact:

1. **Fix P&L Calculation** (2 hours) - Critical bug
2. **Add Position Status** (1 hour) - Keep history
3. **Add Position Size Validation** (1 hour) - Enforce rules
4. **Real Market Names** (2 hours) - Better UX
5. **Price History Storage** (3 hours) - Real data
6. **Trade History View** (1 hour) - Show closed trades

---

## 📝 Implementation Order

### Week 1: Critical Fixes
- [ ] Fix P&L calculation
- [ ] Add position status (closed/settled)
- [ ] Position size validation
- [ ] Market metadata table
- [ ] Real market names

### Week 2: Real Integrations
- [ ] Price history storage
- [ ] Market resolution tracking
- [ ] News feed integration
- [ ] Stripe payment setup
- [ ] Inactivity monitoring

### Week 3: Polish & Enhancements
- [ ] Enhanced dashboard
- [ ] Trade history display
- [ ] Real-time updates
- [ ] Mobile optimization
- [ ] Analytics dashboard

### Week 4: Production Ready
- [ ] Error tracking (Sentry)
- [ ] Security hardening
- [ ] Performance optimization
- [ ] Deployment setup
- [ ] Documentation

---

## 🎯 Success Metrics

**Technical:**
- ✅ All critical bugs fixed
- ✅ Real API integrations working
- ✅ Payment processing functional
- ✅ Zero data loss
- ✅ < 2s page load times

**Business:**
- ✅ Users can complete full challenge flow
- ✅ Accurate P&L tracking
- ✅ Automated risk monitoring
- ✅ Payment processing
- ✅ Professional appearance

---

## 📚 Resources Needed

**APIs:**
- Kalshi API (existing)
- Polymarket API (existing)
- Stripe API (sign up)
- NewsAPI (sign up, free tier)

**Services:**
- Sentry (error tracking, free tier)
- Vercel (deployment, free tier)
- Supabase (database, free tier)

**Tools:**
- Postman (API testing)
- Chrome DevTools (debugging)
- Git (version control)

---

## 🎉 Next Immediate Steps

1. **Fix P&L Calculation** - Start here (highest priority bug)
2. **Add Position Status** - Keep trade history
3. **Add Position Validation** - Enforce risk rules
4. **Real Market Names** - Better user experience

Would you like me to start implementing any of these? I recommend starting with the P&L fix since it's critical and quick to implement.

