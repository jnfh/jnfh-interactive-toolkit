@echo off
REM Split large FLAC files into segments under 300MB
REM Each segment will be ~250MB to stay safely under limit

echo Splitting FLAC files into segments under 300MB...
echo Each segment will be approximately 250MB
echo.

REM Split each file into ~250MB segments
echo Splitting: Jokulvatn_2026_(LEFT  FRONT).flac
ffmpeg -i "Jokulvatn_2026_(LEFT  FRONT).flac" -f segment -segment_size 250000000 -c:a flac -compression_level 8 "Jokulvatn_2026_(LEFT  FRONT)-part-%%03d.flac"

echo Splitting: Jokulvatn_2026_(RIGHT FRONT).flac
ffmpeg -i "Jokulvatn_2026_(RIGHT FRONT).flac" -f segment -segment_size 250000000 -c:a flac -compression_level 8 "Jokulvatn_2026_(RIGHT FRONT)-part-%%03d.flac"

echo Splitting: Jokulvatn_2026_(RIGhT SURROUND).flac
ffmpeg -i "Jokulvatn_2026_(RIGhT SURROUND).flac" -f segment -segment_size 250000000 -c:a flac -compression_level 8 "Jokulvatn_2026_(RIGhT SURROUND)-part-%%03d.flac"

echo Splitting: Jokulvatn_2026_(FULL MIX).flac
ffmpeg -i "Jokulvatn_2026_(FULL MIX).flac" -f segment -segment_size 250000000 -c:a flac -compression_level 8 "Jokulvatn_2026_(FULL MIX)-part-%%03d.flac"

echo Splitting: Jokulvatn_2026_(LEFT SURROUND).flac
ffmpeg -i "Jokulvatn_2026_(LEFT SURROUND).flac" -f segment -segment_size 250000000 -c:a flac -compression_level 8 "Jokulvatn_2026_(LEFT SURROUND)-part-%%03d.flac"

echo.
echo Splitting complete!
echo Files are split into segments: -part-000.flac, -part-001.flac, etc.
echo You'll need to load these as separate audio sources in your config JSON.
echo Original FLAC files are preserved.
pause

