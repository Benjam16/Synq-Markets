# Admin Panel Setup Guide

## Overview

The admin panel provides comprehensive management tools for:
- **User Management**: View all users, their challenges, and trade counts
- **Trade Monitoring**: View all trades across all users with filtering
- **Challenge Management**: View and manage challenges, manually fail traders
- **One-Click Fail**: Instantly fail any active challenge with a button press

## Access

The admin panel is available at `/admin` and is protected by role-based access control.

## Setting Up Admin Users

### Method 1: Direct Database Update

```sql
-- Make a user an admin
UPDATE users 
SET role = 'admin' 
WHERE email = 'your-admin@email.com';

-- Or make them a risk manager (also has admin access)
UPDATE users 
SET role = 'risk' 
WHERE email = 'risk-manager@email.com';
```

### Method 2: During User Creation

When creating a user via the API or signup, you can set the role:

```sql
INSERT INTO users (email, full_name, role, supabase_user_id)
VALUES ('admin@example.com', 'Admin User', 'admin', 'supabase-user-id');
```

## Features

### 1. Users Tab

**Features:**
- Search users by email or name
- View user statistics:
  - Total challenges
  - Total trades
  - Active challenges
  - Join date
  - Role (trader/admin/risk)

**Use Cases:**
- Monitor user activity
- Identify high-volume traders
- Track user growth

### 2. Trades Tab

**Features:**
- View all trades across all users
- Filter by User ID
- See trade details:
  - User information
  - Market ID
  - Side (YES/NO)
  - Price, Quantity, Notional
  - Execution time

**Use Cases:**
- Audit trading activity
- Investigate suspicious trades
- Monitor market participation

### 3. Challenges Tab

**Features:**
- Filter by status (active, failed, passed, cancelled)
- View challenge details:
  - User information
  - Tier and account size
  - Current balance and returns
  - Daily drawdown percentage
  - Trade count
  - Start/end dates

**One-Click Fail:**
- Click the "Fail" button on any active challenge
- Enter optional fail reason
- Challenge is immediately marked as failed
- Risk event is logged for audit trail

**Use Cases:**
- Monitor challenge performance
- Manually intervene when needed
- Review failed challenges
- Track success rates

## API Endpoints

All admin endpoints require admin/risk role:

### Check Admin Status
```
GET /api/admin/check
```

### Get Users
```
GET /api/admin/users?search=query&limit=100&offset=0
```

### Get Trades
```
GET /api/admin/trades?userId=123&challengeId=456&limit=100&offset=0
```

### Get Challenges
```
GET /api/admin/challenges?status=active&userId=123&limit=100&offset=0
```

### Fail Trader
```
POST /api/admin/fail-trader
Body: { challengeId: 123, reason: "Manual intervention" }
```

## Security

- **Role-Based Access**: Only users with `role = 'admin'` or `role = 'risk'` can access
- **Session Verification**: Uses Supabase session tokens for authentication
- **Audit Trail**: All manual fails are logged in `risk_events` table
- **Protected Routes**: Admin panel automatically redirects non-admin users

## Development Mode

If Supabase is not configured, the admin panel allows access in development mode for testing. In production, ensure Supabase is properly configured.

## Navigation

The admin panel link appears in the main navigation bar for admin users automatically.

## Future Enhancements

Potential additions:
- Export data to CSV
- Bulk actions (fail multiple challenges)
- User role management UI
- Challenge statistics dashboard
- Trade analytics and charts
- Email notifications for admin actions
