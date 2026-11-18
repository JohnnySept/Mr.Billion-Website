# Deploy to Netlify & Test Webhook

## Quick Deploy (Drag & Drop)

1. **Build the site locally** (if needed):
   ```bash
   # No build step needed - it's static HTML + Netlify Functions
   ```

2. **Go to Netlify Dashboard** → **Add new site** → **Deploy manually**
   - Drag the entire project folder (`Claude Directory`) to the deploy area
   - Or connect your Git repo (GitHub/GitLab/Bitbucket) for auto-deploys

3. **Configure Environment Variables** in Netlify:
   - Site Settings → Environment Variables → Add:
   ```
   YOUTUBE_API_KEY = your_youtube_data_api_v3_key
   YOUTUBE_CHANNEL_ID = UCFGEGUn-I6_BsifwF7ZzthQ
   GEMINI_API_KEY = your_gemini_api_key
   GEMINI_MODEL = gemini-3.5-flash
   ```

4. **Wait for deploy** - you'll get a URL like `https://random-name.netlify.app`

---

## Test the Webhook

### Option 1: Test via Browser/Postman/curl

**Health check (GET):**
```bash
curl https://YOUR_SITE.netlify.app/.netlify/functions/youtube-webhook
```

**Trigger article generation for latest uploads (POST):**
```bash
curl -X POST https://YOUR_SITE.netlify.app/.netlify/functions/youtube-webhook \
  -H "Content-Type: application/json" \
  -d '{"auto": true}'
```

**Trigger for specific video IDs:**
```bash
curl -X POST https://YOUR_SITE.netlify.app/.netlify/functions/youtube-webhook \
  -H "Content-Type: application/json" \
  -d '{"videoIds": ["VIDEO_ID_1", "VIDEO_ID_2"]}'
```

### Option 2: Use the test script
```bash
node test-webhook.js https://YOUR_SITE.netlify.app
```

### Option 3: Test locally with Netlify Dev (before deploying)

```bash
# Install Netlify CLI globally
npm install -g netlify-cli

# Login
netlify login

# Link to your site (or create new)
netlify link

# Start local dev server with functions
netlify dev
```

Then test at `http://localhost:8888/.netlify/functions/youtube-webhook`

---

## How It Works Now (Simplified)

### 1. Scheduled Function (Primary - runs every 10 min)
- `generate-articles.js` runs automatically on Netlify's schedule
- Fetches latest 50 videos from your channel
- Generates articles for any that don't have one yet
- **Processes ALL new videos per run** (fixed from before)

### 2. Webhook Endpoint (Manual/On-demand)
- `youtube-webhook.js` - Simple POST endpoint
- **No PubSubHubbub subscription needed**
- Two modes:
  - `{ "auto": true }` - Fetches latest 50 from channel, generates missing
  - `{ "videoIds": ["ID1", "ID2"] }` - Generates for specific videos

### 3. Deduplication (Both use same logic)
```javascript
const existing = await store.get(videoId, { type: 'json' });
if (existing?.article) return; // Skip - already exists
```
- Articles stored in **Netlify Blobs** (`mrbillion-articles` store)
- **Generated exactly once per video**
- **Same article served to all users**

### 4. Frontend (`index.html`)
- When user clicks a video → calls `POST /.netlify/functions/article`
- If article exists: returns instantly (fast!)
- If not: generates, stores, returns (first visitor waits ~3-5s)

---

## Test the Full Flow

1. **Deploy to Netlify** with env vars set
2. **Wait for first scheduled run** (up to 10 min) OR trigger manually:
   ```bash
   curl -X POST https://YOUR_SITE.netlify.app/.netlify/functions/youtube-webhook \
     -H "Content-Type: application/json" \
     -d '{"auto": true}'
   ```
3. **Check Netlify Function Logs**:
   - Dashboard → Functions → `generate-articles` or `youtube-webhook` → Logs
   - Should see: `Generated article for VIDEO_ID (gemini-3.5-flash)`
4. **Visit your site** - click a video to see the article modal
5. **Check Blobs storage** (optional):
   - Dashboard → Storage → Blobs → `mrbillion-articles`
   - Should see JSON entries for each video

---

## Expected Response Format

**GET /youtube-webhook:**
```json
{
  "message": "YouTube webhook endpoint ready. Use POST to trigger article generation.",
  "usage": "POST with { \"videoIds\": [\"VIDEO_ID1\", \"VIDEO_ID2\"] } or { \"auto\": true } to process latest uploads"
}
```

**POST { "auto": true }:**
```json
{
  "message": "Processed 12 videos: 3 generated, 9 skipped",
  "results": [
    { "videoId": "abc123", "status": "generated", "model": "gemini-3.5-flash" },
    { "videoId": "def456", "status": "skipped", "reason": "already exists" }
  ]
}
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Function returns 500 | Check Netlify Function Logs for error details |
| "Missing YOUTUBE_API_KEY" | Add env var in Netlify Dashboard → Site Settings → Environment Variables |
| "Missing GEMINI_API_KEY" | Same as above |
| No videos found | Verify `YOUTUBE_CHANNEL_ID` is correct |
| Articles not generating | Check Gemini API key has quota; check function logs |
| Scheduled function not running | Verify `netlify.toml` has `functions = "netlify/functions"` and schedule config |

---

## Files in This Deployment

```
├── index.html                    # Frontend (served at /)
├── netlify.toml                  # Netlify config
├── netlify/functions/
│   ├── article.js                # GET article (generates if missing)
│   ├── generate-articles.js      # Scheduled: every 10 min, processes ALL new
│   ├── shorts.js                 # YouTube video listing (Shorts/Videos)
│   ├── youtube-webhook.js        # Manual trigger endpoint (POST)
│   └── lib.js                    # Shared: YouTube API, Gemini, Blobs
├── .env.example                  # Env var template
├── test-webhook.js               # Test script
└── package.json                  # Dependencies (@netlify/blobs)
```