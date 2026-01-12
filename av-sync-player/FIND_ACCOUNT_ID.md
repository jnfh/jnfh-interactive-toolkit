# How to Find Your Cloudflare Account ID

## Method 1: From Dashboard URL (Easiest)

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Click on **any service** (R2, DNS, Workers, etc.)
3. Look at the URL in your browser's address bar

**Example URL:**
```
https://dash.cloudflare.com/abc123def4567890/r2/storage
```

**Your Account ID is:** `abc123def4567890` (the long alphanumeric string after `/`)

---

## Method 2: From R2 Dashboard

1. Go to Cloudflare Dashboard → **R2**
2. Click on your bucket (`jnfh-intereactives`)
3. Look at the URL

**Example URL:**
```
https://dash.cloudflare.com/abc123def4567890/r2/storage/buckets/jnfh-intereactives
```

**Your Account ID is:** `abc123def4567890`

---

## Method 3: From Right Sidebar

1. Go to Cloudflare Dashboard
2. Look at the **right sidebar** (if visible)
3. Your Account ID is usually displayed there

---

## What Your Account ID Looks Like

- **Format:** Long alphanumeric string (32 characters)
- **Example:** `abc123def4567890ghijklmnopqrstuv`
- **Contains:** Letters (a-z) and numbers (0-9)
- **No spaces or special characters**

---

## Where to Use Your Account ID

### 1. In Config File (`jokulvatn-config.json`)

Replace `YOUR_ACCOUNT_ID` in all URLs:

**Before:**
```json
"url": "https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com/jnfh-intereactives/..."
```

**After (example):**
```json
"url": "https://abc123def4567890.r2.cloudflarestorage.com/jnfh-intereactives/..."
```

### 2. In Upload Script (`upload-to-r2.ps1`)

Edit the script and replace `YOUR_ACCOUNT_ID`:

**Before:**
```powershell
$AccountID = "YOUR_ACCOUNT_ID"
```

**After (example):**
```powershell
$AccountID = "abc123def4567890"
```

### 3. In Browser URLs (for testing)

When testing file access, use:
```
https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com/jnfh-intereactives/...
```

---

## Quick Checklist

- [ ] Found Account ID from dashboard URL
- [ ] Replaced `YOUR_ACCOUNT_ID` in `jokulvatn-config.json` (5 places)
- [ ] Replaced `YOUR_ACCOUNT_ID` in `upload-to-r2.ps1` (if using)
- [ ] Tested a file URL in browser to verify it works

---

## Still Can't Find It?

1. **Check R2 API Tokens:**
   - Go to R2 → Manage R2 API Tokens
   - The Account ID might be shown there

2. **Check Domain Settings:**
   - Go to any domain you have on Cloudflare
   - The Account ID is in the URL

3. **Contact Support:**
   - If you still can't find it, Cloudflare support can help

---

## Example: Complete URL After Setup

Once you have your Account ID (`abc123def4567890`), your audio file URLs will look like:

```
https://abc123def4567890.r2.cloudflarestorage.com/jnfh-intereactives/Jokulvatn%20(10th%20Anniversary%20Edition)/audio/Jokulvatn_2026_(LEFT%20%20FRONT).opus
```

**Note:** The `%20` is URL encoding for spaces - this is correct and necessary!

