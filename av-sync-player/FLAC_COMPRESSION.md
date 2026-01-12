# FLAC Compression Guide for Cloudflare R2

## Problem
Your FLAC audio files exceed Cloudflare R2's 300MB file size limit.

## Solution: Maximum FLAC Compression

FLAC supports compression levels 0-8, where 8 is maximum compression. Higher levels = smaller files but slower encoding.

---

## Quick Commands

### For Your Specific Files (Jokulvatn 2026)

**Windows (PowerShell or CMD):**
```bash
ffmpeg -i "Jokulvatn_2026_(LEFT  FRONT).flac" -compression_level 8 "Jokulvatn_2026_(LEFT  FRONT)-compressed.flac"
ffmpeg -i "Jokulvatn_2026_(RIGHT FRONT).flac" -compression_level 8 "Jokulvatn_2026_(RIGHT FRONT)-compressed.flac"
ffmpeg -i "Jokulvatn_2026_(RIGhT SURROUND).flac" -compression_level 8 "Jokulvatn_2026_(RIGhT SURROUND)-compressed.flac"
ffmpeg -i "Jokulvatn_2026_(FULL MIX).flac" -compression_level 8 "Jokulvatn_2026_(FULL MIX)-compressed.flac"
ffmpeg -i "Jokulvatn_2026_(LEFT SURROUND).flac" -compression_level 8 "Jokulvatn_2026_(LEFT SURROUND)-compressed.flac"
```

**Mac/Linux:**
```bash
ffmpeg -i "Jokulvatn_2026_(LEFT  FRONT).flac" -compression_level 8 "Jokulvatn_2026_(LEFT  FRONT)-compressed.flac"
ffmpeg -i "Jokulvatn_2026_(RIGHT FRONT).flac" -compression_level 8 "Jokulvatn_2026_(RIGHT FRONT)-compressed.flac"
ffmpeg -i "Jokulvatn_2026_(RIGhT SURROUND).flac" -compression_level 8 "Jokulvatn_2026_(RIGhT SURROUND)-compressed.flac"
ffmpeg -i "Jokulvatn_2026_(FULL MIX).flac" -compression_level 8 "Jokulvatn_2026_(FULL MIX)-compressed.flac"
ffmpeg -i "Jokulvatn_2026_(LEFT SURROUND).flac" -compression_level 8 "Jokulvatn_2026_(LEFT SURROUND)-compressed.flac"
```

**Or use the batch scripts:**
- Windows: Double-click `compress-flac-files.bat` or run `compress-flac-files.ps1` in PowerShell
- Mac/Linux: Run `chmod +x compress-flac-files.sh && ./compress-flac-files.sh`

### Single File Compression (Generic)

**Windows (PowerShell or CMD):**
```bash
ffmpeg -i "your-file.flac" -compression_level 8 "your-file-compressed.flac"
```

**Mac/Linux:**
```bash
ffmpeg -i "your-file.flac" -compression_level 8 "your-file-compressed.flac"
```

### Batch Process All FLAC Files

**Windows (PowerShell):**
```powershell
Get-ChildItem -Filter "*.flac" | ForEach-Object {
    $output = $_.BaseName + "-compressed.flac"
    ffmpeg -i $_.Name -compression_level 8 $output
    Write-Host "✓ Compressed: $($_.Name) -> $output"
}
```

**Mac/Linux (Bash):**
```bash
for file in *.flac; do
    output="${file%.flac}-compressed.flac"
    ffmpeg -i "$file" -compression_level 8 "$output"
    echo "✓ Compressed: $file -> $output"
done
```

---

## Compression Levels Explained

| Level | Compression | Encoding Speed | File Size |
|-------|------------|----------------|-----------|
| 0     | None       | Fastest        | Largest   |
| 5     | Default    | Medium         | Medium    |
| 8     | Maximum    | Slowest        | Smallest  |

**Recommendation:** Always use level 8 for web hosting. Encoding is slower, but files are smaller and still lossless.

---

## Expected Results

**Typical compression ratios:**
- Original FLAC (level 0-5): 100%
- Maximum compression (level 8): 70-90% of original size

**Example (46-minute stereo audio):**
- Original FLAC: ~400-500MB
- Compressed FLAC (level 8): ~280-350MB ✅ (fits under 300MB!)

---

## If Still Too Large After Compression

### Option 1: Split Files by Duration

Split into 10-minute segments:
```bash
# Windows:
ffmpeg -i "large-file.flac" -f segment -segment_time 600 -c:a flac -compression_level 8 "part-%03d.flac"

# Mac/Linux:
ffmpeg -i "large-file.flac" \
  -f segment \
  -segment_time 600 \
  -c:a flac \
  -compression_level 8 \
  "part-%03d.flac"
```

This creates: `part-000.flac`, `part-001.flac`, etc.

### Option 2: Split Files by Size

Split into ~250MB chunks:
```bash
# Windows:
ffmpeg -i "large-file.flac" -f segment -segment_size 250000000 -c:a flac -compression_level 8 "part-%03d.flac"

# Mac/Linux:
ffmpeg -i "large-file.flac" \
  -f segment \
  -segment_size 250000000 \
  -c:a flac \
  -compression_level 8 \
  "part-%03d.flac"
```

**Note:** If you split files, you'll need to load them as separate audio sources in your config JSON with appropriate `offset` values to sync them.

### Option 3: High-Quality Lossy (Last Resort)

If FLAC compression + splitting isn't acceptable, use high-quality lossy:

**Opus (Best compression):**
```bash
ffmpeg -i "input.flac" -c:a libopus -b:a 192k "output.opus"
```

**AAC (Widely supported):**
```bash
ffmpeg -i "input.flac" -c:a aac -b:a 192k "output.m4a"
```

**File sizes (46-minute audio):**
- Opus 192kbps: ~66MB ✅
- AAC 192kbps: ~66MB ✅

**⚠️ Warning:** These are lossy formats, but 192kbps is very high quality and may be acceptable for web streaming.

---

## Check File Sizes

**Windows (PowerShell):**
```powershell
Get-ChildItem -Filter "*.flac" | Select-Object Name, @{Name="Size(MB)";Expression={[math]::Round($_.Length/1MB,2)}}
```

**Mac/Linux:**
```bash
ls -lh *.flac | awk '{print $9, $5}'
```

---

## Workflow Recommendation

1. **First, try maximum compression (level 8):**
   ```bash
   ffmpeg -i "file.flac" -compression_level 8 "file-compressed.flac"
   ```

2. **Check file size:**
   - If under 300MB → ✅ Upload to R2
   - If still over 300MB → Continue to step 3

3. **If still too large, split the file:**
   ```bash
   ffmpeg -i "file-compressed.flac" -f segment -segment_size 250000000 -c:a flac -compression_level 8 "part-%03d.flac"
   ```

4. **Update config JSON** to load multiple segments with offsets

---

## Tips

- **Always keep originals** - Don't delete your source files
- **Test playback** - Verify compressed files play correctly
- **Batch process** - Use batch scripts to process multiple files
- **Monitor sizes** - Check file sizes before uploading to R2

---

## Troubleshooting

**Error: "compression_level: Invalid argument"**
- Your FFmpeg version may not support this parameter
- Try: `ffmpeg -i input.flac -c:a flac -compression_level 8 output.flac`
- Or update FFmpeg to latest version

**Files still too large after compression:**
- Check if files are already at level 8
- Consider splitting files (Option 1 or 2 above)
- Or use high-quality lossy format (Option 3)

**Encoding is very slow:**
- Level 8 compression is intentionally slow for maximum compression
- Let it run overnight if needed
- The file size savings are worth it for web hosting

