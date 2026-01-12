# PowerShell script to upload large video file to Cloudflare R2
# Requires: AWS CLI installed and configured

Write-Host "Uploading video file to Cloudflare R2..." -ForegroundColor Cyan
Write-Host ""

# Configuration
$BucketName = "jnfh-intereactives"
$VideoPath = "Jokulvatn (10th Anniversary Edition)/video/"
$Endpoint = "https://pub-a83442f019fb41e1be094dd351388a65.r2.dev"
$VideoFile = "Jokulvatn-base-4k.mp4"

# Check if AWS CLI is installed
try {
    $null = aws --version
} catch {
    Write-Host "ERROR: AWS CLI is not installed!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install AWS CLI from:" -ForegroundColor Yellow
    Write-Host "https://awscli.amazonaws.com/AWSCLIV2.msi" -ForegroundColor Yellow
    Write-Host ""
    pause
    exit 1
}

# Check if video file exists
if (-not (Test-Path $VideoFile)) {
    Write-Host "ERROR: Video file not found: $VideoFile" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please make sure the video file is in the same folder as this script." -ForegroundColor Yellow
    Write-Host "Or edit this script to use the correct file path." -ForegroundColor Yellow
    Write-Host ""
    pause
    exit 1
}

Write-Host "Bucket: $BucketName" -ForegroundColor Gray
Write-Host "Path: $VideoPath" -ForegroundColor Gray
Write-Host "File: $VideoFile" -ForegroundColor Gray
Write-Host "Endpoint: $Endpoint" -ForegroundColor Gray
Write-Host ""
Write-Host "Starting upload..." -ForegroundColor Yellow
Write-Host "This may take a while for large files..." -ForegroundColor Yellow
Write-Host ""

# Get file size for progress estimation
$FileSize = (Get-Item $VideoFile).Length / 1GB
Write-Host "File size: $([math]::Round($FileSize, 2)) GB" -ForegroundColor Gray
Write-Host ""

# Upload the file
$RemotePath = "$VideoPath$VideoFile"
Write-Host "Uploading to: s3://$BucketName/$RemotePath" -ForegroundColor Cyan
Write-Host ""

$Result = aws s3 cp "`"$VideoFile`"" "s3://$BucketName/$RemotePath" --endpoint-url $Endpoint 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "[SUCCESS] Upload complete!" -ForegroundColor Green
    Write-Host ""
    
    $FileUrl = "$Endpoint/$VideoPath$VideoFile"
    Write-Host "File URL:" -ForegroundColor Cyan
    Write-Host $FileUrl -ForegroundColor White
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "1. Verify file in R2 dashboard" -ForegroundColor Gray
    Write-Host "2. Test URL in browser" -ForegroundColor Gray
    Write-Host "3. Update jokulvatn-config.json with video URL" -ForegroundColor Gray
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "[ERROR] Upload failed!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Error details:" -ForegroundColor Yellow
    Write-Host $Result -ForegroundColor Red
    Write-Host ""
    Write-Host "Troubleshooting:" -ForegroundColor Yellow
    Write-Host "1. Make sure AWS CLI is configured: aws configure" -ForegroundColor Gray
    Write-Host "2. Check your R2 API credentials" -ForegroundColor Gray
    Write-Host "3. Verify bucket name and path are correct" -ForegroundColor Gray
    Write-Host "4. Check your internet connection" -ForegroundColor Gray
    Write-Host ""
}

