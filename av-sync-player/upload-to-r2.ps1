# PowerShell script to upload audio files to Cloudflare R2
# Requires: AWS CLI installed and configured with R2 credentials

# Configuration
$BucketName = "jnfh-intereactives"
$BasePath = "Jokulvatn (10th Anniversary Edition)/audio/"
$AccountID = "YOUR_ACCOUNT_ID"  # Replace with your Cloudflare account ID
$Endpoint = "https://$AccountID.r2.cloudflarestorage.com"

# Files to upload
$Files = @(
    "Jokulvatn_2026_(LEFT  FRONT).opus",
    "Jokulvatn_2026_(RIGHT FRONT).opus",
    "Jokulvatn_2026_(RIGhT SURROUND).opus",
    "Jokulvatn_2026_(LEFT SURROUND).opus",
    "Jokulvatn_2026_(FULL MIX).opus"
)

Write-Host "Uploading files to Cloudflare R2..." -ForegroundColor Cyan
Write-Host "Bucket: $BucketName" -ForegroundColor Gray
Write-Host "Path: $BasePath" -ForegroundColor Gray
Write-Host ""

# Check if AWS CLI is installed
try {
    $null = aws --version
} catch {
    Write-Host "ERROR: AWS CLI is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Install from: https://aws.amazon.com/cli/" -ForegroundColor Yellow
    exit 1
}

# Upload each file
foreach ($File in $Files) {
    if (Test-Path $File) {
        $RemotePath = "$BasePath$File"
        $RemotePathEncoded = [System.Web.HttpUtility]::UrlEncode($RemotePath).Replace('+', '%20')
        
        Write-Host "Uploading: $File" -ForegroundColor Yellow
        
        $Result = aws s3 cp "`"$File`"`" "s3://$BucketName/$RemotePath" --endpoint-url $Endpoint 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  [OK] Uploaded successfully" -ForegroundColor Green
            Write-Host "  URL: $Endpoint/$BucketName/$RemotePathEncoded" -ForegroundColor Gray
        } else {
            Write-Host "  [ERROR] Upload failed" -ForegroundColor Red
            Write-Host "  $Result" -ForegroundColor Red
        }
        Write-Host ""
    } else {
        Write-Host "[SKIP] File not found: $File" -ForegroundColor Yellow
        Write-Host ""
    }
}

Write-Host "Upload complete!" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Configure CORS policy in R2 dashboard" -ForegroundColor Gray
Write-Host "2. Enable public access" -ForegroundColor Gray
Write-Host "3. Update jokulvatn-config.json with your Account ID" -ForegroundColor Gray
Write-Host "4. Test file URLs in browser" -ForegroundColor Gray

