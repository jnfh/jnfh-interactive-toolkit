@echo off
REM Convert FLAC files to Opus format (high quality, smaller files)
REM Opus is better quality than MP3 at the same bitrate
REM Target: 192-256kbps for excellent quality

echo Converting FLAC files to Opus format...
echo Using 256kbps bitrate for maximum quality
echo.

REM Convert each file to Opus at 256kbps (excellent quality)
ffmpeg -i "Jokulvatn_2026_(LEFT  FRONT).flac" -c:a libopus -b:a 256k "Jokulvatn_2026_(LEFT  FRONT).opus"
if %errorlevel% equ 0 (
    echo [OK] Jokulvatn_2026_(LEFT  FRONT).flac -^> .opus
) else (
    echo [ERROR] Failed to convert Jokulvatn_2026_(LEFT  FRONT).flac
)

ffmpeg -i "Jokulvatn_2026_(RIGHT FRONT).flac" -c:a libopus -b:a 256k "Jokulvatn_2026_(RIGHT FRONT).opus"
if %errorlevel% equ 0 (
    echo [OK] Jokulvatn_2026_(RIGHT FRONT).flac -^> .opus
) else (
    echo [ERROR] Failed to convert Jokulvatn_2026_(RIGHT FRONT).flac
)

ffmpeg -i "Jokulvatn_2026_(RIGhT SURROUND).flac" -c:a libopus -b:a 256k "Jokulvatn_2026_(RIGhT SURROUND).opus"
if %errorlevel% equ 0 (
    echo [OK] Jokulvatn_2026_(RIGhT SURROUND).flac -^> .opus
) else (
    echo [ERROR] Failed to convert Jokulvatn_2026_(RIGhT SURROUND).flac
)

ffmpeg -i "Jokulvatn_2026_(FULL MIX).flac" -c:a libopus -b:a 256k "Jokulvatn_2026_(FULL MIX).opus"
if %errorlevel% equ 0 (
    echo [OK] Jokulvatn_2026_(FULL MIX).flac -^> .opus
) else (
    echo [ERROR] Failed to convert Jokulvatn_2026_(FULL MIX).flac
)

ffmpeg -i "Jokulvatn_2026_(LEFT SURROUND).flac" -c:a libopus -b:a 256k "Jokulvatn_2026_(LEFT SURROUND).opus"
if %errorlevel% equ 0 (
    echo [OK] Jokulvatn_2026_(LEFT SURROUND).flac -^> .opus
) else (
    echo [ERROR] Failed to convert Jokulvatn_2026_(LEFT SURROUND).flac
)

echo.
echo Conversion complete!
echo Opus files should be much smaller (~60-80MB for 46 minutes)
echo Original FLAC files are preserved.
pause

