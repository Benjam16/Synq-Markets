# Supabase Sync - Profile Updates Explained

## Current Implementation

### ✅ Password Changes → Supabase Auth
**Route**: `app/api/portal/change-password/route.ts`

**How it works**:
1. Verifies current password by signing in
2. Uses `supabase.auth.updateUser({ password: newPassword })` 
3. **Directly updates Supabase Auth** ✅
4. Password is stored in Supabase Auth (not in PostgreSQL)

**Result**: Password changes ARE synced to Supabase Auth ✅

---

### ✅ Profile Updates → PostgreSQL + Supabase Metadata
**Route**: `app/api/portal/update-profile/route.ts`

**How it works**:
1. Updates PostgreSQL database (`users` table):
   - `full_name`
   - `paypal_email`
   - `updated_at`

2. **Also syncs to Supabase Auth metadata** (if `supabase_user_id` exists):
   - Stores `full_name` in `user_metadata.full_name`
   - Stores `paypal_email` in `user_metadata.paypal_email`
   - Preserves existing metadata

**Result**: Profile data is stored in BOTH places:
- ✅ PostgreSQL database (primary source of truth)
- ✅ Supabase Auth metadata (for consistency)

---

## Data Storage Architecture

### PostgreSQL Database (`users` table)
**Primary storage** for:
- `id` (database user ID)
- `email`
- `full_name`
- `paypal_email` ← **Stored here**
- `role`
- `supabase_user_id` (links to Supabase Auth)

### Supabase Auth (`auth.users` table)
**Stores**:
- `id` (Supabase user UUID)
- `email`
- `encrypted_password` ← **Password stored here**
- `user_metadata` (JSON):
  - `full_name` ← **Synced here**
  - `paypal_email` ← **Synced here**
  - Any other custom metadata

---

## Why Dual Storage?

1. **PostgreSQL**: Primary source of truth for application data
   - Used for queries, joins, relationships
   - Fast lookups with indexes
   - Transaction support

2. **Supabase Metadata**: For consistency and external access
   - Accessible via Supabase client
   - Can be used by other services
   - Backup/redundancy

---

## What Gets Synced?

### ✅ Synced to Supabase:
- **Password**: Directly via `updateUser()` ✅
- **Full Name**: Via `user_metadata.full_name` ✅
- **PayPal Email**: Via `user_metadata.paypal_email` ✅

### ❌ NOT Synced (PostgreSQL only):
- Database user ID (internal)
- Role (internal)
- Created/updated timestamps (internal)

---

## Error Handling

The sync to Supabase metadata is **non-blocking**:
- If PostgreSQL update succeeds but Supabase sync fails, the request still succeeds
- Error is logged but doesn't break the user experience
- Database remains the source of truth

---

## Verification

To verify Supabase sync is working:

1. **Check Supabase Dashboard**:
   - Go to **Authentication** → **Users**
   - Click on a user
   - Check **User Metadata** section
   - Should see `full_name` and `paypal_email`

2. **Check Database**:
   - Query `users` table
   - Verify `paypal_email` column is updated

3. **Check Logs**:
   - Look for `[Update Profile] Successfully synced to Supabase metadata`
   - Or warnings if sync fails (non-critical)

---

## Requirements

For Supabase sync to work:
- ✅ `SUPABASE_SERVICE_ROLE_KEY` must be set in `.env.local`
- ✅ User must have `supabase_user_id` in database
- ✅ Supabase project must be properly configured

If any of these are missing, the sync is skipped (non-critical).

---

**Status**: ✅ Both password and profile updates sync to Supabase
