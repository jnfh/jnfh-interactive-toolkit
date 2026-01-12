# Cloudflare R2 Setup Guide

## Quick Answer: Should You Split Files?

**For most cases: NO** - Your current setup is already optimized! Browsers automatically use HTTP Range Requests, which means:
- ✅ Only loads the portion of video needed
- ✅ Efficient seeking without downloading entire file
- ✅ Works perfectly with Cloudflare R2

**Only split if:**
- Files are >2 hours AND you need adaptive bitrate streaming
- You're targeting mobile devices with limited bandwidth
- You need multiple quality levels

## What's Already Optimized

Your player now supports:
- ✅ **Direct URL loading** - Videos load directly from R2 URLs (no full download)
- ✅ **HTTP Range Requests** - Automatic with HTML5 video
- ✅ **Metadata-only preloading** - Only loads what's needed initially
- ✅ **Progressive layer loading** - Layers load on demand
- ✅ **Efficient memory usage** - Streaming, not buffering entire files

## Cloudflare R2 Configuration

### 1. Create R2 Bucket

1. Go to Cloudflare Dashboard → R2
2. Create a new bucket
3. Note your bucket name

### 2. Configure CORS

In R2 bucket settings, add CORS configuration:

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

**Important Headers:**
- `Content-Range`: Required for range requests
- `Accept-Ranges`: Tells browser range requests are supported
- `ETag`: For caching

### 3. Set Up Public Access

**Option A: Public Bucket (Simpler)**
- Enable public access in bucket settings
- Use public URLs directly

**Option B: Signed URLs (More Secure)**
- Keep bucket private
- Generate signed URLs server-side
- Better for production

### 4. Get Your R2 URLs

Public URLs format:
```
https://<account-id>.r2.cloudflarestorage.com/<bucket-name>/<file-path>
```

Or use custom domain:
```
https://media.yourdomain.com/<file-path>
```

## Using R2 URLs in Config

### Example Config

```json
{
  "version": "1.0",
  "video": {
    "url": "https://your-account-id.r2.cloudflarestorage.com/your-bucket/base-video.mp4",
    "name": "Base Video",
    "preload": "metadata",
    "duration": 120.5
  },
  "videoLayers": [
    {
      "name": "Overlay 1",
      "url": "https://your-account-id.r2.cloudflarestorage.com/your-bucket/overlay.webm",
      "preload": "metadata",
      "opacity": 1.0,
      "zIndex": 1
    }
  ],
  "audio": [
    {
      "name": "Track 1",
      "url": "https://your-account-id.r2.cloudflarestorage.com/your-bucket/audio1.flac",
      "volume": 1.0
    }
  ]
}
```

## Performance Tips

### 1. Video Encoding

**Recommended Settings:**
- **Codec**: H.264 (MP4) for base, VP9 (WebM) for transparent layers
- **Bitrate**: 5-10 Mbps for 1080p, 2-5 Mbps for 720p
- **Keyframe Interval**: Every 2-4 seconds for better seeking
- **Profile**: High profile for better compression

**FFmpeg Example:**
```bash
# Base video (MP4)
ffmpeg -i input.mov -c:v libx264 -preset medium -crf 23 -profile:v high -pix_fmt yuv420p base-video.mp4

# Transparent overlay (WebM)
ffmpeg -i input.mov -c:v libvpx-vp9 -pix_fmt yuva420p -b:v 2M overlay.webm
```

### 2. File Organization

```
r2-bucket/
├── videos/
│   ├── base-video.mp4
│   └── overlays/
│       ├── overlay-1.webm
│       └── overlay-2.webm
└── audio/
    ├── track-1.flac
    └── track-2.flac
```

### 3. Caching Strategy

**Cloudflare CDN Settings:**
- Cache everything: `Cache-Control: public, max-age=31536000`
- Enable Cloudflare CDN in front of R2
- Use custom domain for better caching

### 4. Loading Strategy

**Current Implementation:**
- ✅ Base video: Loads metadata only (`preload="metadata"`)
- ✅ Layers: Load progressively as needed
- ✅ Audio: Streams efficiently with HTML5 Audio

**For Very Long Files (>1 hour):**
- Consider `preload="none"` for layers
- Load layers only when visible
- Monitor buffer health

## Testing

### Test Range Requests

```bash
# Test if range requests work
curl -I -H "Range: bytes=0-1023" https://your-r2-url/video.mp4

# Should return:
# HTTP/1.1 206 Partial Content
# Content-Range: bytes 0-1023/12345678
# Accept-Ranges: bytes
```

### Monitor Performance

Use browser DevTools:
1. Network tab → Filter by "Media"
2. Check "Range" requests
3. Verify partial content loads (206 status)

## Cost Optimization

### R2 Pricing
- Storage: $0.015/GB/month
- Class A Operations (writes): $4.50/million
- Class B Operations (reads): $0.36/million

### Tips to Reduce Costs
- ✅ Use Cloudflare CDN (free egress from R2 to CDN)
- ✅ Enable caching headers
- ✅ Use efficient codecs (smaller files)
- ✅ Compress audio (OGG Vorbis vs FLAC)

## Troubleshooting

### CORS Errors
- Check CORS configuration in R2
- Verify `ExposeHeaders` includes `Content-Range`
- Test with browser DevTools

### Range Request Issues
- Verify `Accept-Ranges: bytes` header
- Check `Content-Range` header in responses
- Ensure CORS allows `Range` header

### Slow Loading
- Check Cloudflare CDN is enabled
- Verify files are cached
- Check video encoding (bitrate too high?)
- Consider using Cloudflare Stream for very long videos

## Alternative: Cloudflare Stream

For very long videos or advanced features:
- ✅ Automatic transcoding
- ✅ Adaptive bitrate streaming
- ✅ Built-in player
- ✅ Analytics
- ✅ Better for >2 hour videos

**When to Use:**
- Videos >2 hours
- Need multiple quality levels
- Want analytics
- Need automatic optimization

## Summary

✅ **Your current setup is already optimized!**
✅ **No need to split files** for most use cases
✅ **R2 works perfectly** with HTTP Range Requests
✅ **Direct URL loading** is now supported
✅ **Progressive loading** for layers

**Next Steps:**
1. Set up R2 bucket with CORS
2. Upload your files
3. Update config with R2 URLs
4. Test with DevTools to verify range requests
5. Monitor performance and adjust as needed

