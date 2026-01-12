#!/bin/bash
# Shell script to compress FLAC files with maximum compression
# For Mac/Linux - Run: chmod +x compress-flac-files.sh && ./compress-flac-files.sh

echo "Compressing FLAC files with maximum compression (level 8)..."
echo ""

# Compress each file individually
echo "Compressing: Jokulvatn_2026_(LEFT  FRONT).flac"
ffmpeg -i "Jokulvatn_2026_(LEFT  FRONT).flac" -compression_level 8 "Jokulvatn_2026_(LEFT  FRONT)-compressed.flac" && echo "[OK]" || echo "[ERROR]"

echo "Compressing: Jokulvatn_2026_(RIGHT FRONT).flac"
ffmpeg -i "Jokulvatn_2026_(RIGHT FRONT).flac" -compression_level 8 "Jokulvatn_2026_(RIGHT FRONT)-compressed.flac" && echo "[OK]" || echo "[ERROR]"

echo "Compressing: Jokulvatn_2026_(RIGhT SURROUND).flac"
ffmpeg -i "Jokulvatn_2026_(RIGhT SURROUND).flac" -compression_level 8 "Jokulvatn_2026_(RIGhT SURROUND)-compressed.flac" && echo "[OK]" || echo "[ERROR]"

echo "Compressing: Jokulvatn_2026_(FULL MIX).flac"
ffmpeg -i "Jokulvatn_2026_(FULL MIX).flac" -compression_level 8 "Jokulvatn_2026_(FULL MIX)-compressed.flac" && echo "[OK]" || echo "[ERROR]"

echo "Compressing: Jokulvatn_2026_(LEFT SURROUND).flac"
ffmpeg -i "Jokulvatn_2026_(LEFT SURROUND).flac" -compression_level 8 "Jokulvatn_2026_(LEFT SURROUND)-compressed.flac" && echo "[OK]" || echo "[ERROR]"

echo ""
echo "Compression complete!"
echo "Check file sizes - compressed files should be smaller."
echo "Original files are preserved."

