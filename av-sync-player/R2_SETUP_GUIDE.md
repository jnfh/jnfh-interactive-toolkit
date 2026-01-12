# Cloudflare R2 Setup Guide for Jokulvatn

## Your Bucket Structure

**Bucket Name:** `jnfh-intereactives`  
**Directory Path:** `Jokulvatn (10th Anniversary Edition)/audio/`

**Audio Files:**
- `Jokulvatn_2026_(LEFT  FRONT).opus` (or .flac/.m4a)
- `Jokulvatn_2026_(RIGHT FRONT).opus`
- `Jokulvatn_2026_(RIGhT SURROUND).opus`
- `Jokulvatn_2026_(LEFT SURROUND).opus`
- `Jokulvatn_2026_(FULL MIX).opus`

---

## Step 1: Create/Configure R2 Bucket

### 1.1 Create Bucket (if not exists)

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to **R2** → **Create bucket**
3. Name: `jnfh-intereactives`
4. Location: Choose closest to your users (e.g., `WEUR` for Western Europe)
5. Click **Create bucket**

### 1.2 Upload Audio Files

**Option A: Using Cloudflare Dashboard**
1. Go to R2 → `jnfh-intereactives` bucket
2. Click **Upload**
3. Navigate to/create folder: `Jokulvatn (10th Anniversary Edition)/audio/`
4. Upload all 5 audio files

**Option B: Using AWS CLI (Recommended for large files)**
```bash
# Install AWS CLI if not already installed
# Then configure with your R2 credentials

# Set R2 credentials (get from R2 → Manage R2 API Tokens)
aws configure set aws_access_key_id YOUR_ACCESS_KEY_ID
aws configure set aws_secret_access_key YOUR_SECRET_ACCESS_KEY

# Upload files (replace YOUR_ACCOUNT_ID with your Cloudflare account ID)
aws s3 cp "Jokulvatn_2026_(LEFT  FRONT).opus" \
  s3://jnfh-intereactives/"Jokulvatn (10th Anniversary Edition)/audio/Jokulvatn_2026_(LEFT  FRONT).opus" \
  --endpoint-url https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com

aws s3 cp "Jokulvatn_2026_(RIGHT FRONT).opus" \
  s3://jnfh-intereactives/"Jokulvatn (10th Anniversary Edition)/audio/Jokulvatn_2026_(RIGHT FRONT).opus" \
  --endpoint-url https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com

aws s3 cp "Jokulvatn_2026_(RIGhT SURROUND).opus" \
  s3://jnfh-intereactives/"Jokulvatn (10th Anniversary Edition)/audio/Jokulvatn_2026_(RIGhT SURROUND).opus" \
  --endpoint-url https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com

aws s3 cp "Jokulvatn_2026_(LEFT SURROUND).opus" \
  s3://jnfh-intereactives/"Jokulvatn (10th Anniversary Edition)/audio/Jokulvatn_2026_(LEFT SURROUND).opus" \
  --endpoint-url https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com

aws s3 cp "Jokulvatn_2026_(FULL MIX).opus" \
  s3://jnfh-intereactives/"Jokulvatn (10th Anniversary Edition)/audio/Jokulvatn_2026_(FULL MIX).opus" \
  --endpoint-url https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com
```

**Option C: Using R2 API (PowerShell script)**
See `upload-to-r2.ps1` script (created below)

---

## Step 2: Configure CORS (Critical!)

CORS must be configured for the player to load files from R2.

### 2.1 Set CORS Policy

1. Go to R2 → `jnfh-intereactives` bucket
2. Click **Settings** tab
3. Scroll to **CORS Policy**
4. Click **Edit CORS Policy**
5. Paste this JSON:

```json
[
  {
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["Content-Length", "Content-Range", "ETag", "Accept-Ranges", "Content-Type"],
    "MaxAgeSeconds": 3600
  }
]
```

6. Click **Save**

**Important:** This allows any origin to access your files. For production, you may want to restrict `AllowedOrigins` to your domain:
```json
[
  {
    "AllowedOrigins": ["https://www.jeremyhubbard.co.uk", "https://jeremyhubbard.co.uk", "http://localhost:*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["Content-Length", "Content-Range", "ETag", "Accept-Ranges", "Content-Type"],
    "MaxAgeSeconds": 3600
  }
]
```

---

## Step 3: Enable Public Access

### 3.1 Set Public Access

1. Go to R2 → `jnfh-intereactives` bucket
2. Click **Settings** tab
3. Scroll to **Public Access**
4. Click **Allow Access**
5. Choose one of these options:

**Option A: Public Access (Easiest)**
- Enable **Public Access**
- Files will be accessible via public URLs
- No authentication needed

**Option B: Custom Domain (Recommended for Production)**
- Set up a custom domain (e.g., `media.jeremyhubbard.co.uk`)
- Better caching and performance
- Cleaner URLs

### 3.2 Get Public URL Format

After enabling public access, your URLs will be:

```
https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com/jnfh-intereactives/Jokulvatn%20(10th%20Anniversary%20Edition)/audio/FILENAME
```

**Note:** Spaces and special characters need URL encoding:
- Space ` ` → `%20`
- Parentheses `()` → `%28` and `%29`

**Example:**
```
https://abc123def456.r2.cloudflarestorage.com/jnfh-intereactives/Jokulvatn%20(10th%20Anniversary%20Edition)/audio/Jokulvatn_2026_(LEFT%20%20FRONT).opus
```

---

## Step 4: Configure Cache Headers (Optional but Recommended)

### 4.1 Using R2 Workers (Advanced)

Create a Worker to add cache headers:

```javascript
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // Only handle requests to your bucket
    if (!url.pathname.startsWith('/jnfh-intereactives/')) {
      return new Response('Not Found', { status: 404 });
    }
    
    // Fetch from R2
    const object = await env.JNFH_INTERACTIVES.get(url.pathname.substring(1));
    
    if (!object) {
      return new Response('Not Found', { status: 404 });
    }
    
    // Create response with cache headers
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, HEAD');
    headers.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, ETag, Accept-Ranges');
    
    return new Response(object.body, {
      headers,
      status: 200,
    });
  },
};
```

### 4.2 Using Custom Domain

If using a custom domain, you can set cache headers via Cloudflare Page Rules or Transform Rules.

---

## Step 5: Test Your Setup

### 5.1 Test File Access

Open a browser and test a URL:

```
https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com/jnfh-intereactives/Jokulvatn%20(10th%20Anniversary%20Edition)/audio/Jokulvatn_2026_(LEFT%20%20FRONT).opus
```

You should see:
- File downloads or plays (depending on browser)
- No CORS errors in browser console
- HTTP 200 status

### 5.2 Test Range Requests

Test that HTTP Range Requests work (required for seeking):

```bash
# Using curl
curl -I -H "Range: bytes=0-1023" \
  "https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com/jnfh-intereactives/Jokulvatn%20(10th%20Anniversary%20Edition)/audio/Jokulvatn_2026_(LEFT%20%20FRONT).opus"

# Should return:
# HTTP/1.1 206 Partial Content
# Content-Range: bytes 0-1023/FILE_SIZE
# Accept-Ranges: bytes
```

### 5.3 Test in Browser Console

Open browser DevTools → Console and test:

```javascript
fetch('https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com/jnfh-intereactives/Jokulvatn%20(10th%20Anniversary%20Edition)/audio/Jokulvatn_2026_(LEFT%20%20FRONT).opus', {
  method: 'HEAD'
})
.then(response => {
  console.log('Status:', response.status);
  console.log('Headers:', Object.fromEntries(response.headers));
})
.catch(error => console.error('Error:', error));
```

---

## Step 6: Get Your Account ID

1. Go to Cloudflare Dashboard
2. Click on your domain or any service
3. Look at the URL: `https://dash.cloudflare.com/YOUR_ACCOUNT_ID/...`
4. Copy the `YOUR_ACCOUNT_ID` (it's a long alphanumeric string)

---

## Step 7: Construct URLs for Config File

Your audio file URLs will be:

```
https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com/jnfh-intereactives/Jokulvatn%20(10th%20Anniversary%20Edition)/audio/Jokulvatn_2026_(LEFT%20%20FRONT).opus
https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com/jnfh-intereactives/Jokulvatn%20(10th%20Anniversary%20Edition)/audio/Jokulvatn_2026_(RIGHT%20FRONT).opus
https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com/jnfh-intereactives/Jokulvatn%20(10th%20Anniversary%20Edition)/audio/Jokulvatn_2026_(RIGhT%20SURROUND).opus
https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com/jnfh-intereactives/Jokulvatn%20(10th%20Anniversary%20Edition)/audio/Jokulvatn_2026_(LEFT%20SURROUND).opus
https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com/jnfh-intereactives/Jokulvatn%20(10th%20Anniversary%20Edition)/audio/Jokulvatn_2026_(FULL%20MIX).opus
```

**Replace:**
- `YOUR_ACCOUNT_ID` with your actual Cloudflare account ID
- File extensions (`.opus`, `.flac`, `.m4a`) based on what you uploaded

---

## Troubleshooting

### CORS Errors

**Error:** `Access to fetch at '...' from origin '...' has been blocked by CORS policy`

**Solution:**
1. Check CORS policy is set correctly (Step 2)
2. Ensure `AllowedOrigins` includes your domain or `["*"]`
3. Ensure `AllowedMethods` includes `["GET", "HEAD"]`
4. Clear browser cache and try again

### 404 Not Found

**Error:** `404 Not Found` when accessing files

**Solution:**
1. Verify file path matches exactly (case-sensitive)
2. Check URL encoding (spaces → `%20`, parentheses → `%28`/`%29`)
3. Verify files are uploaded to correct bucket and path
4. Check bucket name and account ID are correct

### Range Request Errors

**Error:** Seeking doesn't work, files don't stream properly

**Solution:**
1. Verify R2 bucket supports HTTP Range Requests (should work by default)
2. Check `Accept-Ranges: bytes` header in response
3. Test with curl (Step 5.2)
4. Ensure file wasn't corrupted during upload

### Slow Loading

**Solution:**
1. Enable Cloudflare CDN (should be automatic with R2)
2. Set up custom domain for better caching
3. Verify files are compressed (Opus/AAC instead of FLAC)
4. Check file sizes are under 300MB

---

## Security Considerations

### For Production:

1. **Restrict CORS Origins:**
   - Don't use `["*"]` in production
   - Specify your actual domain(s)

2. **Use Custom Domain:**
   - Better security
   - Better performance
   - Cleaner URLs

3. **Consider Signed URLs:**
   - For private content
   - Time-limited access
   - Requires R2 API integration

4. **Monitor Usage:**
   - Check R2 dashboard for bandwidth
   - Set up alerts for unusual activity

---

## Next Steps

1. ✅ Upload audio files to R2
2. ✅ Configure CORS
3. ✅ Enable public access
4. ✅ Test file access
5. ✅ Create config JSON file (see `jokulvatn-config.json`)
6. ✅ Load config in player

---

## Quick Reference

**Bucket:** `jnfh-intereactives`  
**Path:** `Jokulvatn (10th Anniversary Edition)/audio/`  
**URL Format:** `https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com/jnfh-intereactives/Jokulvatn%20(10th%20Anniversary%20Edition)/audio/FILENAME`

**CORS Policy:**
```json
[
  {
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["Content-Length", "Content-Range", "ETag", "Accept-Ranges", "Content-Type"],
    "MaxAgeSeconds": 3600
  }
]
```

