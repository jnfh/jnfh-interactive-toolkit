# PowerShell script to find video file
# Searches common locations for the video file

Write-Host "Searching for Jokulvatn video files..." -ForegroundColor Cyan
Write-Host ""

# Common file patterns to search for
$Patterns = @(
    "*Jokulvatn*.mp4",
    "*jokulvatn*.mp4",
    "*JOKULVATN*.mp4"
)

# Search in current directory and parent directories
$SearchPaths = @(
    ".",
    "..",
    "..\..",
    "$env:USERPROFILE\Downloads",
    "$env:USERPROFILE\Desktop",
    "$env:USERPROFILE\Documents",
    "$env:USERPROFILE\Videos"
)

$FoundFiles = @()

foreach ($Path in $SearchPaths) {
    if (Test-Path $Path) {
        foreach ($Pattern in $Patterns) {
            $Files = Get-ChildItem -Path $Path -Filter $Pattern -Recurse -ErrorAction SilentlyContinue | Select-Object -First 5
            if ($Files) {
                foreach ($File in $Files) {
                    $SizeGB = [math]::Round($File.Length / 1GB, 2)
                    $FoundFiles += [PSCustomObject]@{
                        Path = $File.FullName
                        Name = $File.Name
                        Size = "$SizeGB GB"
                        Directory = $File.DirectoryName
                    }
                }
            }
        }
    }
}

if ($FoundFiles.Count -eq 0) {
    Write-Host "No video files found matching 'Jokulvatn*.mp4'" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Please:" -ForegroundColor Cyan
    Write-Host "1. Check the exact filename of your video file" -ForegroundColor Gray
    Write-Host "2. Note the full path to the file" -ForegroundColor Gray
    Write-Host "3. Use the full path in the upload command" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Example:" -ForegroundColor Yellow
    Write-Host 'aws s3 cp "C:\Path\To\Your\File.mp4" s3://...' -ForegroundColor White
} else {
    Write-Host "Found $($FoundFiles.Count) file(s):" -ForegroundColor Green
    Write-Host ""
    
    for ($i = 0; $i -lt $FoundFiles.Count; $i++) {
        $File = $FoundFiles[$i]
        Write-Host "[$($i + 1)] $($File.Name)" -ForegroundColor Cyan
        Write-Host "    Size: $($File.Size)" -ForegroundColor Gray
        Write-Host "    Path: $($File.Path)" -ForegroundColor Gray
        Write-Host ""
    }
    
    Write-Host "To upload, use the full path:" -ForegroundColor Yellow
    Write-Host ""
    $FirstFile = $FoundFiles[0]
    Write-Host 'aws s3 cp "' -NoNewline -ForegroundColor White
    Write-Host $FirstFile.Path -NoNewline -ForegroundColor Cyan
    Write-Host '" s3://jnfh-intereactives/"Jokulvatn (10th Anniversary Edition)/video/' -NoNewline -ForegroundColor White
    Write-Host $FirstFile.Name -NoNewline -ForegroundColor Cyan
    Write-Host '" --endpoint-url https://pub-a83442f019fb41e1be094dd351388a65.r2.dev' -ForegroundColor White
    Write-Host ""
}

