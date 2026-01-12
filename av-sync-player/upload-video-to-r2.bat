@echo off
REM Batch script to upload large video file to Cloudflare R2
REM Requires: AWS CLI installed and configured

echo Uploading video file to Cloudflare R2...
echo.

REM Configuration
set BUCKET_NAME=jnfh-intereactives
set VIDEO_PATH=Jokulvatn (10th Anniversary Edition)/video/
set ENDPOINT=https://pub-a83442f019fb41e1be094dd351388a65.r2.dev
set VIDEO_FILE=Jokulvatn-base-4k.mp4

REM Check if AWS CLI is installed
aws --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: AWS CLI is not installed!
    echo.
    echo Please install AWS CLI from:
    echo https://awscli.amazonaws.com/AWSCLIV2.msi
    echo.
    pause
    exit /b 1
)

REM Check if video file exists
if not exist "%VIDEO_FILE%" (
    echo ERROR: Video file not found: %VIDEO_FILE%
    echo.
    echo Please make sure the video file is in the same folder as this script.
    echo Or edit this script to use the correct file path.
    echo.
    pause
    exit /b 1
)

echo Bucket: %BUCKET_NAME%
echo Path: %VIDEO_PATH%
echo File: %VIDEO_FILE%
echo Endpoint: %ENDPOINT%
echo.
echo Starting upload...
echo This may take a while for large files...
echo.

REM Upload the file
aws s3 cp "%VIDEO_FILE%" s3://%BUCKET_NAME%/"%VIDEO_PATH%%VIDEO_FILE%" --endpoint-url %ENDPOINT%

if %errorlevel% equ 0 (
    echo.
    echo [SUCCESS] Upload complete!
    echo.
    echo File URL:
    echo %ENDPOINT%/%VIDEO_PATH%%VIDEO_FILE%
    echo.
    echo Next steps:
    echo 1. Verify file in R2 dashboard
    echo 2. Test URL in browser
    echo 3. Update jokulvatn-config.json with video URL
    echo.
) else (
    echo.
    echo [ERROR] Upload failed!
    echo.
    echo Troubleshooting:
    echo 1. Make sure AWS CLI is configured: aws configure
    echo 2. Check your R2 API credentials
    echo 3. Verify bucket name and path are correct
    echo 4. Check your internet connection
    echo.
)

pause

