@echo off
REM Batch script to compress FLAC files with maximum compression
REM For Windows - Double-click to run

echo Compressing FLAC files with maximum compression (level 8)...
echo.

REM Compress each file individually
ffmpeg -i "Jokulvatn_2026_(LEFT  FRONT).flac" -compression_level 8 "Jokulvatn_2026_(LEFT  FRONT)-compressed.flac"
if %errorlevel% equ 0 (
    echo [OK] Jokulvatn_2026_(LEFT  FRONT).flac
) else (
    echo [ERROR] Failed to compress Jokulvatn_2026_(LEFT  FRONT).flac
)

ffmpeg -i "Jokulvatn_2026_(RIGHT FRONT).flac" -compression_level 8 "Jokulvatn_2026_(RIGHT FRONT)-compressed.flac"
if %errorlevel% equ 0 (
    echo [OK] Jokulvatn_2026_(RIGHT FRONT).flac
) else (
    echo [ERROR] Failed to compress Jokulvatn_2026_(RIGHT FRONT).flac
)

ffmpeg -i "Jokulvatn_2026_(RIGhT SURROUND).flac" -compression_level 8 "Jokulvatn_2026_(RIGhT SURROUND)-compressed.flac"
if %errorlevel% equ 0 (
    echo [OK] Jokulvatn_2026_(RIGhT SURROUND).flac
) else (
    echo [ERROR] Failed to compress Jokulvatn_2026_(RIGhT SURROUND).flac
)

ffmpeg -i "Jokulvatn_2026_(FULL MIX).flac" -compression_level 8 "Jokulvatn_2026_(FULL MIX)-compressed.flac"
if %errorlevel% equ 0 (
    echo [OK] Jokulvatn_2026_(FULL MIX).flac
) else (
    echo [ERROR] Failed to compress Jokulvatn_2026_(FULL MIX).flac
)

ffmpeg -i "Jokulvatn_2026_(LEFT SURROUND).flac" -compression_level 8 "Jokulvatn_2026_(LEFT SURROUND)-compressed.flac"
if %errorlevel% equ 0 (
    echo [OK] Jokulvatn_2026_(LEFT SURROUND).flac
) else (
    echo [ERROR] Failed to compress Jokulvatn_2026_(LEFT SURROUND).flac
)

echo.
echo Compression complete!
echo Check file sizes - compressed files should be smaller.
echo Original files are preserved.
pause

