# PowerShell script to compress FLAC files with maximum compression
# For Windows PowerShell - Run: .\compress-flac-files.ps1

Write-Host "Compressing FLAC files with maximum compression (level 8)..." -ForegroundColor Cyan
Write-Host ""

$files = @(
    "Jokulvatn_2026_(LEFT  FRONT).flac",
    "Jokulvatn_2026_(RIGHT FRONT).flac",
    "Jokulvatn_2026_(RIGhT SURROUND).flac",
    "Jokulvatn_2026_(FULL MIX).flac",
    "Jokulvatn_2026_(LEFT SURROUND).flac"
)

foreach ($file in $files) {
    if (Test-Path $file) {
        $output = $file -replace '\.flac$', '-compressed.flac'
        Write-Host "Compressing: $file" -ForegroundColor Yellow
        
        $process = Start-Process -FilePath "ffmpeg" -ArgumentList "-i", "`"$file`"", "-compression_level", "8", "`"$output`"" -Wait -NoNewWindow -PassThru
        
        if ($process.ExitCode -eq 0) {
            $originalSize = (Get-Item $file).Length / 1MB
            $compressedSize = (Get-Item $output).Length / 1MB
            $saved = $originalSize - $compressedSize
            $percent = [math]::Round(($saved / $originalSize) * 100, 1)
            
            Write-Host "[OK] $file" -ForegroundColor Green
            Write-Host "  Original: $([math]::Round($originalSize, 2)) MB" -ForegroundColor Gray
            Write-Host "  Compressed: $([math]::Round($compressedSize, 2)) MB" -ForegroundColor Gray
            Write-Host "  Saved: $([math]::Round($saved, 2)) MB ($percent%)" -ForegroundColor Gray
            Write-Host ""
        } else {
            Write-Host "[ERROR] Failed to compress $file" -ForegroundColor Red
            Write-Host ""
        }
    } else {
        Write-Host "[SKIP] File not found: $file" -ForegroundColor Yellow
        Write-Host ""
    }
}

Write-Host "Compression complete!" -ForegroundColor Cyan
Write-Host "Check file sizes - compressed files should be smaller." -ForegroundColor Gray
Write-Host "Original files are preserved." -ForegroundColor Gray

