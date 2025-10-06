# Deploy to Vercel (Step-by-Step)

## 1. Push this folder to GitHub

```bash
cd /Users/stacycobb/Desktop/GVP/GreenValleySales/jn-dual-create
git init
git add .
git commit -m "Initial commit"
# Create a new repo on GitHub called "jn-dual-create"
# Then:
git remote add origin https://github.com/YOUR-USERNAME/jn-dual-create.git
git push -u origin main
```

## 2. Deploy to Vercel

1. Go to https://vercel.com/dashboard
2. Click **"Add New..."** → **"Project"**
3. Find your GitHub repo `jn-dual-create` and click **"Import"**
4. **Framework Preset**: Leave as "Other" (or select "Express.js")
5. **Root Directory**: Leave blank (or set to `.` if prompted)
6. Click **"Environment Variables"** dropdown
7. Add these variables:
   - **Name**: `APP_TOKEN`  
     **Value**: `CHANGE_THIS_TO_A_LONG_RANDOM_STRING_123456789`  
     (Generate a random string like `openssl rand -hex 32` in Terminal)
   
   - **Name**: `JOBNIMBUS_API_BASE`  
     **Value**: `https://app.jobnimbus.com/api1`
   
   - **Name**: `JN_DEFAULT_CONTACT_TYPE`  
     **Value**: `Residential`
   
   - **Name**: `JN_DEFAULT_CONTACT_STATUS`  
     **Value**: `New Lead`
   
   - **Name**: `JN_DEFAULT_JOB_TYPE`  
     **Value**: `Roof Replacement`
   
   - **Name**: `JN_DEFAULT_JOB_STATUS`  
     **Value**: `New`

8. Click **"Deploy"**
9. Wait 1-2 minutes for build to complete
10. Copy your deployment URL (e.g., `https://jn-dual-create-xyz.vercel.app`)

## 3. Test the deployment

Open in browser: `https://YOUR-VERCEL-URL.vercel.app/health`

You should see: `{"ok":true,"ts":1234567890}`

## 4. Update iOS app

In the iOS app "Create Customer + Job" sheet:
- Set **Service Base URL** to: `https://YOUR-VERCEL-URL.vercel.app`
- The app will automatically send your JobNimbus API key from Keychain

## 5. Set APP_TOKEN in iOS app (one-time)

You need to store the same `APP_TOKEN` value in your iOS app settings:
1. Open Settings in the app
2. Add a field for "API App Token"
3. Paste the same random string you used in Vercel

Done! Your backend is now live and secure.
