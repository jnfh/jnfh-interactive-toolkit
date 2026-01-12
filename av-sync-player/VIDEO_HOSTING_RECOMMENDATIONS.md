# Video Hosting Recommendations for Large Files (24.2GB)

## Quick Answer

**For your 24.2GB MP4 file, I recommend Cloudflare R2** (which you already use for audio). Here's why and how to optimize it.

## Option Comparison

### 1. Cloudflare R2 (Recommended) ✅

**Pros:**
- ✅ You already have it set up for audio files
- ✅ Supports HTTP Range Requests (essential for seeking)
- ✅ S3-compatible API (easy to use)
- ✅ Free egress to Cloudflare CDN
- ✅ Cost-effective storage ($0.015/GB/month)
- ✅ Works perfectly with your current player implementation

**Cons:**
- ⚠️ No automatic transcoding/optimization
- ⚠️ You upload the file as-is (24.2GB)

**Cost Estimate:**
- Storage: 24.2GB × $0.015 = **$0.36/month**
- Egress: Free to Cloudflare CDN
- Operations: Minimal (reads only)

**Setup:**
1. Upload video to your existing R2 bucket (or create separate bucket)
2. Configure CORS (same as audio files)
3. Use direct URL in config JSON

**URL Format:**
```
https://<account-id>.r2.cloudflarestorage.com/<bucket-name>/jokulvatn-base.mp4
```

---

### 2. Cloudflare Stream (Alternative - Better for Video)

**Pros:**
- ✅ Automatic transcoding and optimization
- ✅ Adaptive bitrate streaming (multiple quality levels)
- ✅ Built-in CDN optimization
- ✅ Analytics and insights
- ✅ Better for very large files
- ✅ Automatic optimization reduces file size

**Cons:**
- ⚠️ More expensive ($1 per 1,000 minutes stored + $1 per 1,000 minutes delivered)
- ⚠️ Requires integration with Stream API
- ⚠️ May need to modify player code slightly

**Cost Estimate (46 minutes):**
- Storage: 46 min × $1/1000 = **$0.046/month**
- Delivery: Depends on views (e.g., 100 views = 4,600 min = $4.60/month)
- **Total: ~$5-10/month** depending on traffic

**When to Use:**
- If you want automatic optimization
- If you need multiple quality levels
- If you want analytics
- If you're okay with higher costs

---

### 3. AWS S3 + CloudFront

**Pros:**
- ✅ Industry standard
- ✅ Excellent CDN (CloudFront)
- ✅ Supports range requests
- ✅ Very reliable

**Cons:**
- ⚠️ More complex setup
- ⚠️ Higher egress costs
- ⚠️ More expensive than R2

**Cost Estimate:**
- Storage: ~$0.50/month
- Egress: ~$0.085/GB (first 10TB)
- **Total: ~$2-3/month** + egress costs

---

## Recommendation: Cloudflare R2

**Why R2 is best for your use case:**

1. **You already use it** - Consistent infrastructure
2. **Cost-effective** - Only $0.36/month storage
3. **Free CDN egress** - No bandwidth charges to Cloudflare CDN
4. **Works with your player** - Already supports HTTP Range Requests
5. **Simple setup** - Just upload and use URL

---

## Important: File Size Optimization

**24.2GB for 46 minutes = ~8.8GB/hour = ~70 Mbps bitrate**

This is **very high** for web streaming. Consider:

### Option A: Re-encode for Web (Recommended)

**Target bitrates:**
- 1080p: 5-8 Mbps (H.264)
- 720p: 3-5 Mbps (H.264)
- 4K: 15-25 Mbps (H.264 or H.265)

**FFmpeg command (4K Optimized):**
```bash
# Optimized 4K quality (target ~15-20 Mbps, keeps 4K resolution)
# For Windows (PowerShell or CMD):
ffmpeg -i "Jökulvatn_FULL_MASTERv4b.mp4" -c:v libx264 -preset slow -crf 20 -profile:v high -level 5.1 -pix_fmt yuv420p -maxrate 20M -bufsize 40M -c:a copy "Jokulvatn-base-4k.mp4"

# For Mac/Linux (with quotes for special characters):
ffmpeg -i "Jökulvatn_FULL_MASTERv4b.mp4" \
  -c:v libx264 \
  -preset slow \
  -crf 20 \
  -profile:v high \
  -level 5.1 \
  -pix_fmt yuv420p \
  -maxrate 20M \
  -bufsize 40M \
  -c:a copy \
  "Jokulvatn-base-4k.mp4"

# This should reduce file size significantly (estimate: 12-18GB instead of 24.2GB)
# While maintaining 4K resolution and high quality
```

**Benefits:**
- ✅ Smaller file = faster loading
- ✅ Lower bandwidth costs
- ✅ Better user experience
- ✅ Still high quality

### Option B: Keep Original Quality

If you need to preserve original quality:
- ✅ Use R2 as-is
- ✅ Ensure good internet connection for users
- ✅ Consider preloading strategy
- ⚠️ Higher bandwidth costs

---

## R2 Setup for Video

### 1. Upload Video to R2

```bash
# Using AWS CLI (R2 is S3-compatible)
aws s3 cp jokulvatn-base.mp4 s3://your-bucket/videos/ \
  --endpoint-url https://<account-id>.r2.cloudflarestorage.com
```

Or use Cloudflare Dashboard → R2 → Upload

### 2. Configure CORS (Same as Audio)

```json
[
  {
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["Content-Length", "Content-Range", "ETag", "Accept-Ranges"],
    "MaxAgeSeconds": 3600
  }
]
```

### 3. Enable Public Access

- R2 Dashboard → Your Bucket → Settings
- Enable "Public Access"
- Or use signed URLs for security

### 4. Get Public URL

```
https://<account-id>.r2.cloudflarestorage.com/<bucket-name>/videos/jokulvatn-base.mp4
```

Or set up custom domain:
```
https://media.yourdomain.com/videos/jokulvatn-base.mp4
```

### 5. Update Config JSON

```json
{
  "version": "1.0",
  "video": {
    "url": "https://your-account-id.r2.cloudflarestorage.com/your-bucket/videos/jokulvatn-base.mp4",
    "name": "Jokulvatn Base Video",
    "preload": "metadata",
    "duration": 2760
  },
  "audio": [
    {
      "name": "Track 1",
      "url": "https://your-account-id.r2.cloudflarestorage.com/your-bucket/audio/track1.flac",
      "volume": 1.0
    }
  ]
}
```

---

## Audio File Optimization (FLAC Compression)

**R2 File Size Limit: 300MB per file**

If your FLAC files exceed 300MB, here are options to compress them:

### Option 1: Maximum FLAC Compression (Recommended) ✅

FLAC has compression levels 0-8 (8 = maximum compression). Re-encode with maximum compression:

**Windows (PowerShell or CMD):**
```bash
# Maximum compression (level 8)
ffmpeg -i "input.flac" -compression_level 8 "output-compressed.flac"

# Or specify compression level explicitly
ffmpeg -i "input.flac" -c:a flac -compression_level 8 "output-compressed.flac"
```

**Mac/Linux:**
```bash
# Maximum compression (level 8)
ffmpeg -i "input.flac" -compression_level 8 "output-compressed.flac"

# Or specify compression level explicitly
ffmpeg -i "input.flac" -c:a flac -compression_level 8 "output-compressed.flac"
```

**What this does:**
- ✅ Keeps lossless FLAC format
- ✅ Maximum compression (level 8)
- ✅ Typically reduces file size by 10-30%
- ✅ No quality loss (still lossless)
- ✅ Slower encoding, but smaller files

**Expected results:**
- If original is 400MB → ~280-350MB (may fit under 300MB)
- If original is 500MB → ~350-450MB (may still be too large)

### Option 2: Batch Process All FLAC Files

**Windows (PowerShell):**
```powershell
# Process all FLAC files in current directory
Get-ChildItem -Filter "*.flac" | ForEach-Object {
    $output = $_.BaseName + "-compressed.flac"
    ffmpeg -i $_.Name -compression_level 8 $output
    Write-Host "Compressed: $($_.Name) -> $output"
}
```

**Mac/Linux (Bash):**
```bash
# Process all FLAC files in current directory
for file in *.flac; do
    output="${file%.flac}-compressed.flac"
    ffmpeg -i "$file" -compression_level 8 "$output"
    echo "Compressed: $file -> $output"
done
```

### Option 3: If Still Too Large - Split Files

If compressed FLAC files are still over 300MB, split them into segments:

**Split by duration (e.g., 10-minute segments):**
```bash
# Windows:
ffmpeg -i "large-file.flac" -f segment -segment_time 600 -c:a flac -compression_level 8 "output-part-%03d.flac"

# Mac/Linux:
ffmpeg -i "large-file.flac" \
  -f segment \
  -segment_time 600 \
  -c:a flac \
  -compression_level 8 \
  "output-part-%03d.flac"
```

**Split by size (target ~250MB per file):**
```bash
# Windows:
ffmpeg -i "large-file.flac" -f segment -segment_size 250000000 -c:a flac -compression_level 8 "output-part-%03d.flac"

# Mac/Linux:
ffmpeg -i "large-file.flac" \
  -f segment \
  -segment_size 250000000 \
  -c:a flac \
  -compression_level 8 \
  "output-part-%03d.flac"
```

**Note:** If you split files, you'll need to:
1. Load multiple segments as separate audio sources
2. Set appropriate `offset` values in config JSON to sync them
3. Or modify player code to handle sequential segments

### Option 4: High-Quality Lossy (If FLAC Still Too Large)

If maximum FLAC compression still exceeds 300MB, consider high-quality lossy formats:

**Opus (Best compression, good quality):**
```bash
# Windows:
ffmpeg -i "input.flac" -c:a libopus -b:a 192k "output.opus"

# Mac/Linux:
ffmpeg -i "input.flac" -c:a libopus -b:a 192k "output.opus"
```

**AAC (Widely supported, good quality):**
```bash
# Windows:
ffmpeg -i "input.flac" -c:a aac -b:a 192k "output.m4a"

# Mac/Linux:
ffmpeg -i "input.flac" -c:a aac -b:a 192k "output.m4a"
```

**Expected file sizes (46-minute audio):**
- FLAC (uncompressed): ~400-500MB
- FLAC (max compression): ~280-350MB
- Opus 192kbps: ~66MB
- AAC 192kbps: ~66MB

**⚠️ Note:** Lossy formats reduce quality, but 192kbps is still very high quality and may be acceptable for web streaming.

### Option 5: Check Current File Size

First, check your current FLAC file sizes:

**Windows (PowerShell):**
```powershell
Get-ChildItem -Filter "*.flac" | Select-Object Name, @{Name="Size(MB)";Expression={[math]::Round($_.Length/1MB,2)}}
```

**Mac/Linux:**
```bash
ls -lh *.flac | awk '{print $9, $5}'
```

---

## Performance Optimization Tips

### 1. Enable Cloudflare CDN

- R2 → Settings → Public Access
- Use Cloudflare CDN in front of R2
- Free egress from R2 to CDN
- Better global performance

### 2. Set Cache Headers

In R2 bucket settings or via Workers:
```
Cache-Control: public, max-age=31536000
```

### 3. Use Custom Domain

Instead of `r2.cloudflarestorage.com`, use:
- `media.yourdomain.com`
- Better caching
- Cleaner URLs
- Better performance

### 4. Video Encoding Best Practices

**For 46-minute video:**

**1080p High Quality:**
```bash
# Windows (single line):
ffmpeg -i "Jökulvatn_FULL_MASTERv4b.mp4" -c:v libx264 -preset slow -crf 22 -profile:v high -level 4.0 -pix_fmt yuv420p -maxrate 8M -bufsize 16M -keyint_min 60 -g 60 -sc_threshold 0 -c:a copy "Jokulvatn-base.mp4"

# Mac/Linux (multi-line):
ffmpeg -i "Jökulvatn_FULL_MASTERv4b.mp4" \
  -c:v libx264 \
  -preset slow \
  -crf 22 \
  -profile:v high \
  -level 4.0 \
  -pix_fmt yuv420p \
  -maxrate 8M \
  -bufsize 16M \
  -keyint_min 60 \
  -g 60 \
  -sc_threshold 0 \
  -c:a copy \
  "Jokulvatn-base.mp4"
```

**Expected result:** ~8-12GB (instead of 24.2GB)

**720p Good Quality (Smaller):**
```bash
# Windows (single line):
ffmpeg -i "Jökulvatn_FULL_MASTERv4b.mp4" -vf scale=1280:720 -c:v libx264 -preset slow -crf 23 -profile:v high -pix_fmt yuv420p -maxrate 5M -bufsize 10M -c:a copy "Jokulvatn-base-720p.mp4"

# Mac/Linux (multi-line):
ffmpeg -i "Jökulvatn_FULL_MASTERv4b.mp4" \
  -vf scale=1280:720 \
  -c:v libx264 \
  -preset slow \
  -crf 23 \
  -profile:v high \
  -pix_fmt yuv420p \
  -maxrate 5M \
  -bufsize 10M \
  -c:a copy \
  "Jokulvatn-base-720p.mp4"
```

**Expected result:** ~4-6GB

---

## Testing Range Requests

After uploading, test that range requests work:

```bash
# Test range request
curl -I -H "Range: bytes=0-1023" \
  https://your-r2-url/jokulvatn-base.mp4

# Should return:
# HTTP/1.1 206 Partial Content
# Content-Range: bytes 0-1023/25958400000
# Accept-Ranges: bytes
```

---

## Cost Comparison

### Cloudflare R2
- **Storage:** $0.36/month (24.2GB)
- **Egress:** Free to Cloudflare CDN
- **Operations:** ~$0.01/month (reads)
- **Total: ~$0.37/month**

### Cloudflare Stream
- **Storage:** $0.046/month (46 min)
- **Delivery:** $1 per 1,000 minutes viewed
- **Example:** 100 views = $4.60/month
- **Total: ~$5-10/month** (depends on traffic)

### AWS S3 + CloudFront
- **Storage:** ~$0.50/month
- **Egress:** ~$0.085/GB
- **Example:** 100GB/month = $8.50
- **Total: ~$9-10/month**

---

## Final Recommendation

**Use Cloudflare R2** because:

1. ✅ You already have it set up
2. ✅ Most cost-effective ($0.37/month)
3. ✅ Works perfectly with your player
4. ✅ Free CDN egress
5. ✅ Simple to implement

**Before uploading, consider:**

1. **Re-encode the video** to reduce file size (8-12GB instead of 24.2GB)
   - Still high quality
   - Faster loading
   - Lower costs
   - Better user experience

2. **Test with a smaller segment first** to verify everything works

3. **Monitor performance** using browser DevTools Network tab

---

## Implementation Steps

1. **Re-encode video** (optional but recommended):
   ```bash
   # Windows:
   ffmpeg -i "Jökulvatn_FULL_MASTERv4b.mp4" -c:v libx264 -preset slow -crf 23 -profile:v high -pix_fmt yuv420p -maxrate 8M -bufsize 16M -c:a copy "Jokulvatn-base.mp4"
   
   # Mac/Linux:
   ffmpeg -i "Jökulvatn_FULL_MASTERv4b.mp4" -c:v libx264 -preset slow -crf 23 -profile:v high -pix_fmt yuv420p -maxrate 8M -bufsize 16M -c:a copy "Jokulvatn-base.mp4"
   ```

2. **Upload to R2:**
   - Use Cloudflare Dashboard or AWS CLI
   - Upload to your existing bucket or create new one

3. **Configure CORS** (if not already done)

4. **Get public URL** and add to config JSON

5. **Test** with your player

---

## Your Player Already Supports This!

Your current implementation:
- ✅ Uses `preload="metadata"` (only loads metadata initially)
- ✅ Supports HTTP Range Requests automatically
- ✅ Streams video efficiently (doesn't load entire file)
- ✅ Works with direct URLs

**No code changes needed** - just upload to R2 and use the URL in your config!

