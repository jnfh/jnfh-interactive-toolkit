# How to Upload Large Video Files to Cloudflare R2 (>300MB)

R2's web interface has a **300MB file size limit**. For larger files (like your 4K video), you need to use the **S3 Compatibility API** via AWS CLI.

---

## Step 1: Install AWS CLI

### Windows

1. **Download AWS CLI:**
   - Go to: https://awscli.amazonaws.com/AWSCLIV2.msi
   - Download and run the installer
   - Follow the installation wizard

2. **Verify Installation:**
   - Open PowerShell or Command Prompt
   - Run: `aws --version`
   - Should show: `aws-cli/2.x.x Python/3.x.x ...`

### Mac/Linux

```bash
# Mac (using Homebrew)
brew install awscli

# Linux
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
```

---

## Step 2: Get R2 API Credentials

1. **Go to Cloudflare Dashboard:**
   - Navigate to **R2** → **Manage R2 API Tokens**

2. **Create API Token:**
   - Click **Create API Token**
   - Name: `R2-Upload-Token` (or any name)
   - Permissions: **Object Read & Write**
   - TTL: Leave default or set expiration date
   - Click **Create API Token**

3. **Copy Credentials:**
   - **Access Key ID**: Copy this (starts with something like `abc123...`)
   - **Secret Access Key**: Copy this (long string, you won't see it again!)
   - **⚠️ IMPORTANT:** Save these securely - you can't view the secret key again!

---

## Step 3: Configure AWS CLI for R2

### Windows (PowerShell or CMD)

```bash
# Configure AWS CLI
aws configure

# When prompted, enter:
# AWS Access Key ID: [paste your Access Key ID]
# AWS Secret Access Key: [paste your Secret Access Key]
# Default region name: auto
# Default output format: json
```

**Note:** The region doesn't matter for R2, but you need to enter something. Use `auto` or `us-east-1`.

---

## Step 4: Upload Your Video File

### Option A: Single Command (Recommended)

**Windows (PowerShell or CMD):**
```bash
aws s3 cp "Jokulvatn-base-4k.mp4" s3://jnfh-intereactives/"Jokulvatn (10th Anniversary Edition)/video/Jokulvatn-base-4k.mp4" --endpoint-url https://pub-a83442f019fb41e1be094dd351388a65.r2.dev
```

**Mac/Linux:**
```bash
aws s3 cp "Jokulvatn-base-4k.mp4" \
  s3://jnfh-intereactives/"Jokulvatn (10th Anniversary Edition)/video/Jokulvatn-base-4k.mp4" \
  --endpoint-url https://pub-a83442f019fb41e1be094dd351388a65.r2.dev
```

### Option B: Using Your Account ID (Alternative)

If you prefer using your account ID instead of the public domain:

```bash
aws s3 cp "Jokulvatn-base-4k.mp4" s3://jnfh-intereactives/"Jokulvatn (10th Anniversary Edition)/video/Jokulvatn-base-4k.mp4" --endpoint-url https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com
```

**Replace `YOUR_ACCOUNT_ID` with your actual Cloudflare account ID.**

---

## Step 5: Monitor Upload Progress

The AWS CLI will show upload progress:

```
upload: Jokulvatn-base-4k.mp4 to s3://jnfh-intereactives/Jokulvatn (10th Anniversary Edition)/video/Jokulvatn-base-4k.mp4
```

For large files, you'll see progress updates. The upload may take a while depending on:
- File size (12-18GB for 4K)
- Your internet upload speed
- R2 server location

**Example:** If your upload speed is 10 Mbps:
- 12GB file = ~2.7 hours
- 18GB file = ~4 hours

---

## Step 6: Verify Upload

### Check in R2 Dashboard

1. Go to Cloudflare Dashboard → R2
2. Click on `jnfh-intereactives` bucket
3. Navigate to: `Jokulvatn (10th Anniversary Edition)/video/`
4. You should see `Jokulvatn-base-4k.mp4`

### Test File Access

Try accessing the file URL in your browser:

```
https://pub-a83442f019fb41e1be094dd351388a65.r2.dev/Jokulvatn%20(10th%20Anniversary%20Edition)/video/Jokulvatn-base-4k.mp4
```

**Note:** Make sure:
- ✅ CORS is configured (from earlier setup)
- ✅ Public access is enabled
- ✅ File should start downloading/streaming

---

## Troubleshooting

### Error: "Unable to locate credentials"

**Problem:** AWS CLI not configured

**Solution:**
```bash
aws configure
# Enter your R2 Access Key ID and Secret Access Key
```

### Error: "Access Denied" or "403 Forbidden"

**Problem:** Wrong credentials or permissions

**Solutions:**
1. Verify API token has "Object Read & Write" permissions
2. Check Access Key ID and Secret Access Key are correct
3. Make sure bucket name is correct: `jnfh-intereactives`

### Error: "Invalid endpoint"

**Problem:** Wrong endpoint URL

**Solution:**
- Use: `https://pub-a83442f019fb41e1be094dd351388a65.r2.dev`
- Or: `https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com`
- Make sure no trailing slash

### Upload is Very Slow

**Problem:** Large file, slow connection

**Solutions:**
1. This is normal for large files - be patient
2. Use `--no-progress` flag to reduce output: `aws s3 cp ... --no-progress`
3. Consider uploading overnight
4. Check your internet upload speed

### Upload Fails Partway Through

**Problem:** Connection interrupted

**Solution:**
- AWS CLI automatically resumes interrupted uploads
- Just run the same command again
- It will continue from where it stopped

---

## Advanced: Resume Interrupted Uploads

AWS CLI automatically handles resume for interrupted uploads. If your upload fails:

1. **Just run the same command again:**
   ```bash
   aws s3 cp "Jokulvatn-base-4k.mp4" s3://jnfh-intereactives/"Jokulvatn (10th Anniversary Edition)/video/Jokulvatn-base-4k.mp4" --endpoint-url https://pub-a83442f019fb41e1be094dd351388a65.r2.dev
   ```

2. **It will resume from where it stopped** (for files >5GB)

---

## Alternative: Multipart Upload (For Very Large Files)

For files >5GB, AWS CLI automatically uses multipart upload. You can also force it:

```bash
aws s3 cp "Jokulvatn-base-4k.mp4" s3://jnfh-intereactives/"Jokulvatn (10th Anniversary Edition)/video/Jokulvatn-base-4k.mp4" --endpoint-url https://pub-a83442f019fb41e1be094dd351388a65.r2.dev --storage-class STANDARD
```

---

## Quick Reference

**Install AWS CLI:**
- Windows: https://awscli.amazonaws.com/AWSCLIV2.msi
- Mac: `brew install awscli`
- Linux: See AWS documentation

**Get R2 Credentials:**
- Cloudflare Dashboard → R2 → Manage R2 API Tokens → Create API Token

**Configure:**
```bash
aws configure
# Enter Access Key ID, Secret Access Key, region: auto, format: json
```

**Upload Command:**
```bash
aws s3 cp "FILENAME.mp4" s3://jnfh-intereactives/"Jokulvatn (10th Anniversary Edition)/video/FILENAME.mp4" --endpoint-url https://pub-a83442f019fb41e1be094dd351388a65.r2.dev
```

---

## Next Steps After Upload

1. ✅ Verify file appears in R2 dashboard
2. ✅ Test file URL in browser
3. ✅ Update `jokulvatn-config.json` with video URL
4. ✅ Test in player

---

## Cost Note

Uploading large files uses **Class A Operations** (writes):
- Cost: $4.50 per million operations
- One upload = one operation
- **Very cheap** - even 100 uploads = $0.00045

Storage cost:
- 12GB = $0.18/month
- 18GB = $0.27/month

**Total: Very affordable!** 💰

