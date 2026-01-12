# Troubleshooting R2 Upload Errors

## Error: "An error occurred () when calling the CreateMultipartUpload operation"

This usually means one of these issues:

### 1. AWS CLI Not Configured Correctly

**Check your configuration:**
```powershell
aws configure list
```

**If not configured, run:**
```powershell
aws configure
```

**Enter:**
- AWS Access Key ID: [Your R2 Access Key ID]
- AWS Secret Access Key: [Your R2 Secret Access Key]
- Default region: `auto` (or `us-east-1`)
- Default output format: `json`

### 2. Wrong Endpoint URL

Try using your Account ID endpoint instead:

```powershell
aws s3 cp "Jokulvatn-base-4k-hq.mp4" s3://jnfh-intereactives/"Jokulvatn (10th Anniversary Edition)/video/Jokulvatn-base-4k-hq.mp4" --endpoint-url https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com
```

Replace `YOUR_ACCOUNT_ID` with your actual Cloudflare account ID.

### 3. Bucket Name or Path Issue

**Test if bucket exists:**
```powershell
aws s3 ls s3://jnfh-intereactives/ --endpoint-url https://pub-a83442f019fb41e1be094dd351388a65.r2.dev
```

**If that works, try uploading to root first:**
```powershell
aws s3 cp "Jokulvatn-base-4k-hq.mp4" s3://jnfh-intereactives/Jokulvatn-base-4k-hq.mp4 --endpoint-url https://pub-a83442f019fb41e1be094dd351388a65.r2.dev
```

### 4. Permissions Issue

Make sure your R2 API token has:
- ✅ **Object Read & Write** permissions
- ✅ Access to the `jnfh-intereactives` bucket

### 5. Try Without Quotes in Path

Sometimes Windows PowerShell has issues with quotes in S3 paths:

```powershell
aws s3 cp Jokulvatn-base-4k-hq.mp4 s3://jnfh-intereactives/Jokulvatn%20(10th%20Anniversary%20Edition)/video/Jokulvatn-base-4k-hq.mp4 --endpoint-url https://pub-a83442f019fb41e1be094dd351388a65.r2.dev
```

### 6. Use Account ID Endpoint

The public domain might not work for uploads. Try:

```powershell
aws s3 cp "Jokulvatn-base-4k-hq.mp4" s3://jnfh-intereactives/"Jokulvatn (10th Anniversary Edition)/video/Jokulvatn-base-4k-hq.mp4" --endpoint-url https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com
```

---

## Step-by-Step Debugging

1. **Verify AWS CLI is configured:**
   ```powershell
   aws configure list
   ```

2. **Test bucket access:**
   ```powershell
   aws s3 ls s3://jnfh-intereactives/ --endpoint-url https://pub-a83442f019fb41e1be094dd351388a65.r2.dev
   ```

3. **Try simple upload to root:**
   ```powershell
   aws s3 cp "Jokulvatn-base-4k-hq.mp4" s3://jnfh-intereactives/test-upload.mp4 --endpoint-url https://pub-a83442f019fb41e1be094dd351388a65.r2.dev
   ```

4. **If that works, try with folder path:**
   ```powershell
   aws s3 cp "Jokulvatn-base-4k-hq.mp4" s3://jnfh-intereactives/video/Jokulvatn-base-4k-hq.mp4 --endpoint-url https://pub-a83442f019fb41e1be094dd351388a65.r2.dev
   ```

---

## Alternative: Use Account ID Endpoint

If the public domain doesn't work for uploads, use your Account ID:

1. Find your Account ID from Cloudflare Dashboard URL
2. Use this endpoint: `https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com`

```powershell
aws s3 cp "Jokulvatn-base-4k-hq.mp4" s3://jnfh-intereactives/"Jokulvatn (10th Anniversary Edition)/video/Jokulvatn-base-4k-hq.mp4" --endpoint-url https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com
```

