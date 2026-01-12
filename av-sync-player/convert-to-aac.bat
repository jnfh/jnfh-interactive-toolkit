@echo off
REM Convert FLAC files to AAC format (high quality, widely supported)
REM AAC is better quality than MP3 at the same bitrate
REM Target: 256kbps for excellent quality

echo Converting FLAC files to AAC format...
echo Using 256kbps bitrate for maximum quality
echo.

REM Convert each file to AAC at 256kbps (excellent quality)
ffmpeg -i "Jokulvatn_2026_(LEFT  FRONT).flac" -c:a aac -b:a 256k "Jokulvatn_2026_(LEFT  FRONT).m4a"
if %errorlevel% equ 0 (
    echo [OK] Jokulvatn_2026_(LEFT  FRONT).flac -^> .m4a
) else (
    echo [ERROR] Failed to convert Jokulvatn_2026_(LEFT  FRONT).flac
)

ffmpeg -i "Jokulvatn_2026_(RIGHT FRONT).flac" -c:a aac -b:a 256k "Jokulvatn_2026_(RIGHT FRONT).m4a"
if %errorlevel% equ 0 (
    echo [OK] Jokulvatn_2026_(RIGHT FRONT).flac -^> .m4a
) else (
    echo [ERROR] Failed to convert Jokulvatn_2026_(RIGHT FRONT).flac
)

ffmpeg -i "Jokulvatn_2026_(RIGhT SURROUND).flac" -c:a aac -b:a 256k "Jokulvatn_2026_(RIGhT SURROUND).m4a"
if %errorlevel% equ 0 (
    echo [OK] Jokulvatn_2026_(RIGhT SURROUND).flac -^> .m4a
) else (
    echo [ERROR] Failed to convert Jokulvatn_2026_(RIGhT SURROUND).flac
)

ffmpeg -i "Jokulvatn_2026_(FULL MIX).flac" -c:a aac -b:a 256k "Jokulvatn_2026_(FULL MIX).m4a"
if %errorlevel% equ 0 (
    echo [OK] Jokulvatn_2026_(FULL MIX).flac -^> .m4a
) else (
    echo [ERROR] Failed to convert Jokulvatn_2026_(FULL MIX).flac
)

ffmpeg -i "Jokulvatn_2026_(LEFT SURROUND).flac" -c:a aac -b:a 256k "Jokulvatn_2026_(LEFT SURROUND).m4a"
if %errorlevel% equ 0 (
    echo [OK] Jokulvatn_2026_(LEFT SURROUND).flac -^> .m4a
) else (
    echo [ERROR] Failed to convert Jokulvatn_2026_(LEFT SURROUND).flac
)

echo.
echo Conversion complete!
echo AAC files should be much smaller (~70-90MB for 46 minutes)
echo Original FLAC files are preserved.
pause

