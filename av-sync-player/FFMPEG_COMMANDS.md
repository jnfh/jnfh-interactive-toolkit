# FFmpeg Commands for Jökulvatn Video

## Your Source File
`Jökulvatn_FULL_MASTERv4b.mp4` (24.2GB, 46 minutes, 4K)

## Quick Commands

### Option 1: Optimized 4K Quality (~12-18GB output) ⭐ RECOMMENDED

**Windows (PowerShell or CMD):**
```bash
ffmpeg -i "Jökulvatn_FULL_MASTERv4b.mp4" -c:v libx264 -preset slow -crf 20 -profile:v high -level 5.1 -pix_fmt yuv420p -maxrate 20M -bufsize 40M -c:a copy "Jokulvatn-base-4k.mp4"
```

**Mac/Linux:**
```bash
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
```

**What this does:**
- ✅ Keeps 4K resolution (no scaling)
- ✅ Optimizes compression (CRF 20 = high quality)
- ✅ Target bitrate ~15-20 Mbps (vs current ~70 Mbps)
- ✅ Should reduce file to ~12-18GB (vs 24.2GB)
- ✅ Still excellent 4K quality

### Option 2: Higher Quality 4K (~18-22GB output)

**Windows:**
```bash
ffmpeg -i "Jökulvatn_FULL_MASTERv4b.mp4" -c:v libx264 -preset slow -crf 18 -profile:v high -level 5.1 -pix_fmt yuv420p -maxrate 25M -bufsize 50M -c:a copy "Jokulvatn-base-4k-hq.mp4"
```

**Mac/Linux:**
```bash
ffmpeg -i "Jökulvatn_FULL_MASTERv4b.mp4" \
  -c:v libx264 \
  -preset slow \
  -crf 18 \
  -profile:v high \
  -level 5.1 \
  -pix_fmt yuv420p \
  -maxrate 25M \
  -bufsize 50M \
  -c:a copy \
  "Jokulvatn-base-4k-hq.mp4"
```

**What this does:**
- ✅ Keeps 4K resolution
- ✅ Very high quality (CRF 18 = near-lossless)
- ✅ Target bitrate ~20-25 Mbps
- ✅ Should reduce file to ~18-22GB
- ✅ Minimal quality loss

### Option 3: Smaller 4K File (~8-12GB output)

**Windows:**
```bash
ffmpeg -i "Jökulvatn_FULL_MASTERv4b.mp4" -c:v libx264 -preset slow -crf 23 -profile:v high -level 5.1 -pix_fmt yuv420p -maxrate 15M -bufsize 30M -c:a copy "Jokulvatn-base-4k-compressed.mp4"
```

**Mac/Linux:**
```bash
ffmpeg -i "Jökulvatn_FULL_MASTERv4b.mp4" \
  -c:v libx264 \
  -preset slow \
  -crf 23 \
  -profile:v high \
  -level 5.1 \
  -pix_fmt yuv420p \
  -maxrate 15M \
  -bufsize 30M \
  -c:a copy \
  "Jokulvatn-base-4k-compressed.mp4"
```

**What this does:**
- ✅ Keeps 4K resolution
- ✅ Good quality (CRF 23 = good quality)
- ✅ Target bitrate ~12-15 Mbps
- ✅ Should reduce file to ~8-12GB
- ✅ Smaller file, still 4K

### Option 4: Keep Original (No Re-encoding)

**Windows:**
```bash
ffmpeg -i "Jökulvatn_FULL_MASTERv4b.mp4" -vf scale=1280:720 -c:v libx264 -preset slow -crf 23 -profile:v high -pix_fmt yuv420p -maxrate 5M -bufsize 10M -c:a copy "Jokulvatn-base-720p.mp4"
```

**Mac/Linux:**
```bash
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

If you want to keep the original quality:
- Just upload `Jökulvatn_FULL_MASTERv4b.mp4` directly to R2
- File will be 24.2GB as-is
- Will work fine, just larger file size
- No quality loss, but slower loading

## Troubleshooting

### If FFmpeg command fails:

1. **Check FFmpeg is installed:**
   ```bash
   ffmpeg -version
   ```

2. **Check file exists:**
   ```bash
   # Windows:
   dir "Jökulvatn_FULL_MASTERv4b.mp4"
   
   # Mac/Linux:
   ls -lh "Jökulvatn_FULL_MASTERv4b.mp4"
   ```

3. **Use full path if needed:**
   ```bash
   # Windows:
   ffmpeg -i "C:\path\to\Jökulvatn_FULL_MASTERv4b.mp4" -c:v libx264 -preset slow -crf 23 -profile:v high -pix_fmt yuv420p -maxrate 8M -bufsize 16M -c:a copy "C:\path\to\Jokulvatn-base.mp4"
   
   # Mac/Linux:
   ffmpeg -i "/full/path/to/Jökulvatn_FULL_MASTERv4b.mp4" -c:v libx264 -preset slow -crf 23 -profile:v high -pix_fmt yuv420p -maxrate 8M -bufsize 16M -c:a copy "/full/path/to/Jokulvatn-base.mp4"
   ```

4. **Check available disk space** (output file needs space)

5. **Try without special characters** (rename input file temporarily):
   ```bash
   # Rename to avoid special character issues
   # Windows:
   ren "Jökulvatn_FULL_MASTERv4b.mp4" "Jokulvatn_FULL_MASTERv4b.mp4"
   
   # Mac/Linux:
   mv "Jökulvatn_FULL_MASTERv4b.mp4" "Jokulvatn_FULL_MASTERv4b.mp4"
   
   # Then use:
   ffmpeg -i "Jokulvatn_FULL_MASTERv4b.mp4" -c:v libx264 -preset slow -crf 23 -profile:v high -pix_fmt yuv420p -maxrate 8M -bufsize 16M -c:a copy "Jokulvatn-base.mp4"
   ```

## Parameter Explanations (4K Optimized)

- `-c:v libx264`: Use H.264 codec (widely supported, good for 4K)
- `-preset slow`: Better compression (slower encoding, smaller file)
- `-crf 20`: Quality setting for 4K (18=very high, 20=high, 23=good, 28=lower)
- `-profile:v high`: H.264 high profile (better compression)
- `-level 5.1`: H.264 level for 4K (5.1 supports 4K@60fps)
- `-pix_fmt yuv420p`: Pixel format (required for web compatibility)
- `-maxrate 20M`: Maximum bitrate for 4K (20 Mbps = good quality)
- `-bufsize 40M`: Buffer size (2x maxrate for smooth playback)
- `-c:a copy`: Copy audio without re-encoding (faster, preserves quality)

**Alternative: H.265/HEVC for Better Compression**

If you want even smaller files with H.265 (better compression, but less browser support):
```bash
# Windows:
ffmpeg -i "Jökulvatn_FULL_MASTERv4b.mp4" -c:v libx265 -preset slow -crf 22 -profile:v main -level-idc 5.1 -pix_fmt yuv420p -maxrate 18M -bufsize 36M -c:a copy "Jokulvatn-base-4k-hevc.mp4"

# Mac/Linux:
ffmpeg -i "Jökulvatn_FULL_MASTERv4b.mp4" \
  -c:v libx265 \
  -preset slow \
  -crf 22 \
  -profile:v main \
  -level-idc 5.1 \
  -pix_fmt yuv420p \
  -maxrate 18M \
  -bufsize 36M \
  -c:a copy \
  "Jokulvatn-base-4k-hevc.mp4"
```

**Note:** H.265 has better compression (~30-40% smaller) but Safari support is better than Chrome/Firefox. H.264 is safer for web compatibility.

## Encoding Time Estimate

- **Preset "slow"**: ~2-4 hours (depends on CPU)
- **Preset "medium"**: ~1-2 hours (faster, slightly larger file)
- **Preset "fast"**: ~30-60 minutes (fastest, larger file)

If you want faster encoding, use `-preset medium` instead of `-preset slow`.

## What's the Best Option for 4K?

**For 4K web streaming, I recommend Option 1 (Optimized 4K, ~12-18GB):**
- ✅ Keeps full 4K resolution
- ✅ High quality (CRF 20)
- ✅ Much smaller than 24.2GB (~40-50% reduction)
- ✅ Faster loading
- ✅ Better user experience
- ✅ Lower bandwidth costs
- ✅ Still excellent 4K quality

**If you want maximum quality, use Option 2 (Higher Quality 4K, ~18-22GB):**
- ✅ Keeps full 4K resolution
- ✅ Very high quality (CRF 18)
- ✅ Some file size reduction (~25% reduction)
- ✅ Near-lossless quality

**If file size is still too large, use Option 3 (Compressed 4K, ~8-12GB):**
- ✅ Keeps full 4K resolution
- ✅ Good quality (CRF 23)
- ✅ Significant file size reduction (~50-60% reduction)
- ✅ Faster loading
- ✅ Better for slower connections

**If you want no quality loss, use Option 4 (Original, 24.2GB):**
- ✅ Perfect quality (no re-encoding)
- ⚠️ Large file size
- ⚠️ Slower loading
- ⚠️ Higher bandwidth costs

