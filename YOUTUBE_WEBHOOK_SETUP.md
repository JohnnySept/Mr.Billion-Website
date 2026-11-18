# YouTube PubSubHubbub Webhook Setup Guide

This guide explains how to set up real-time YouTube upload notifications for the MR.BILLION website.

## Overview

The system now has two ways to generate articles when videos are uploaded:

1. **Scheduled Function** (`generate-articles.js`): Runs every 10 minutes, checks the latest 50 videos, and generates articles for any that don't have one yet. **Now processes ALL new videos per run.**

2. **Real-time Webhook** (`youtube-webhook.js`): Receives instant notifications from YouTube when a new video is uploaded, generating the article immediately.

## Setting Up the YouTube Webhook

### 1. Deploy the Site to Netlify

First, deploy your site to Netlify so you have a live URL (e.g., `https://mrbillion.netlify.app`).

### 2. Configure Environment Variables in Netlify

Go to **Site Settings → Environment Variables** and add:

| Variable | Value | Description |
|----------|-------|-------------|
| `YOUTUBE_API_KEY` | Your YouTube Data API v3 key | Required for fetching video data |
| `YOUTUBE_CHANNEL_ID` | `UCFGEGUn-I6_BsifwF7ZzthQ` | Your channel ID |
| `GEMINI_API_KEY` | Your Google Gemini API key | Required for article generation |
| `GEMINI_MODEL` | `gemini-3.5-flash` | Model to use |
| `YOUTUBE_WEBHOOK_SECRET` | A random secret string | Optional but recommended for webhook security |

### 3. Subscribe to YouTube PubSubHubbub

YouTube uses PubSubHubbub for real-time notifications. You need to subscribe your webhook endpoint to your channel's feed.

#### Option A: Using the YouTube Hub directly (via curl)

```bash
# Replace with your actual values
WEBHOOK_URL="https://mrbillion.netlify.app/.netlify/functions/youtube-webhook"
CHANNEL_ID="UCFGEGUn-I6_BsifwF7ZzthQ"
VERIFY_TOKEN="your_random_verify_token_here"
SECRET="your_webhook_secret_here"  # Must match YOUTUBE_WEBHOOK_SECRET in Netlify

curl -X POST "https://pubsubhubbub.appspot.com/subscribe" \
  -d "hub.mode=subscribe" \
  -d "hub.topic=https://www.youtube.com/xml/feeds/videos.xml?channel_id=${CHANNEL_ID}" \
  -d "hub.callback=${WEBHOOK_URL}" \
  -d "hub.verify_token=${VERIFY_TOKEN}" \
  -d "hub.secret=${SECRET}" \
  -d "hub.lease_seconds=864000"
```

#### Option B: Using the Google Cloud Console

1. Go to the [YouTube PubSubHubbub Subscriber](https://pubsubhubbub.appspot.com/) page
2. Fill in:
   - **Callback**: `https://mrbillion.netlify.app/.netlify/functions/youtube-webhook`
   - **Topic**: `https://www.youtube.com/xml/feeds/videos.xml?channel_id=UCFGEGUn-I6_BsifwF7ZzthQ`
   - **Verify Token**: A random string (save this)
   - **Secret**: Same as `YOUTUBE_WEBHOOK_SECRET` in Netlify
   - **Lease Seconds**: `864000` (10 days, max allowed)
3. Click "Subscribe"

### 4. Verify the Subscription

YouTube will send a GET request to your webhook with a `hub.challenge` parameter. The webhook will automatically respond with the challenge value to confirm the subscription.

Check your Netlify function logs to confirm:
- Go to **Netlify Dashboard → Functions → youtube-webhook → Logs**
- You should see: `Webhook verification request: { mode: 'subscribe', challenge: '...', topic: '...', verify_token: '...' }`
- Then a 200 response with the challenge

### 5. Renew the Subscription

YouTube PubSubHubbub subscriptions expire after the lease period (max 10 days). You need to renew them.

**Automated renewal options:**
1. Set up a cron job to re-subscribe every 8 days
2. Use Netlify Scheduled Functions to auto-renew
3. Monitor logs for `hub.mode=unsubscribe` and re-subscribe

### 6. Test the Webhook

After subscription is confirmed, upload a test video to your YouTube channel (can be unlisted). Check the function logs:
- You should see: `Received webhook for videos: ['VIDEO_ID']`
- Then: `Generated and saved article for VIDEO_ID (gemini-3.5-flash)`

## How It Works

### Deduplication (Article Generated Once)

Both the scheduled function and webhook use **Netlify Blobs** as a shared store:

```javascript
const store = getStore('mrbillion-articles');
const existing = await store.get(videoId, { type: 'json' });
if (existing?.article) return; // Skip - article already exists
```

This ensures:
- ✅ Article is generated **exactly once** per video
- ✅ All visitors see the **same article** (no per-user generation)
- ✅ No race conditions between scheduled runs and webhooks
- ✅ Survives deployments and function restarts

### Article Storage Structure

Each article is stored as JSON with the video ID as the key:

```json
{
  "videoId": "dQw4w9WgXcQ",
  "title": "Video Title",
  "article": "# Generated Markdown Article...",
  "model": "gemini-3.5-flash",
  "publishedAt": "2024-01-15T10:30:00Z",
  "generatedAt": "2024-01-15T10:30:05Z"
}
```

## Frontend Integration

The frontend (`index.html`) calls the article function when a user opens a video:

```javascript
const result = await api(`${API}/article`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ videoId: id, title, description, publishedAt })
});
```

- If article exists: returns it immediately (fast!)
- If not: generates it, stores it, returns it (first visitor waits ~3-5s)

## Troubleshooting

### Webhook Not Receiving Notifications

1. **Check subscription status**: Visit `https://pubsubhubbub.appspot.com/subscribe` with your callback/topic to see current subscriptions
2. **Check Netlify function logs**: Look for errors in the youtube-webhook function
3. **Verify the callback URL is publicly accessible**: Netlify functions must be reachable from the internet
4. **Check lease expiration**: Subscriptions expire - you must renew them

### Articles Not Generating

1. **Check GEMINI_API_KEY**: Must be set in Netlify environment variables
2. **Check function logs**: Both `generate-articles` and `youtube-webhook` log errors
3. **Check YouTube API quota**: You may have exceeded daily quota

### Duplicate Articles

The deduplication logic prevents duplicates. If you see duplicates:
1. Check that both functions use the same blob store name: `mrbillion-articles`
2. Verify the video ID extraction is consistent (11-character YouTube IDs)

## Security Considerations

1. **Webhook Secret**: Set `YOUTUBE_WEBHOOK_SECRET` and use it in subscription. The webhook verifies HMAC-SHA256 signatures.
2. **Verify Token**: Use a random `hub.verify_token` during subscription to prevent spoofing.
3. **Rate Limiting**: Consider adding rate limiting if needed (Netlify has built-in DDoS protection).

## Monitoring

- **Netlify Function Logs**: Real-time logs for both functions
- **Netlify Blobs Dashboard**: View stored articles (Netlify Dashboard → Storage → Blobs)
- **YouTube PubSubHubbub**: Check subscription status at the hub URL

## Files Modified

- `netlify/functions/generate-articles.js` - Now processes ALL new videos per run
- `netlify/functions/youtube-webhook.js` - New webhook endpoint for real-time notifications
- `netlify/functions/lib.js` - Added `verifyWebhookSignature` helper
- `.env.example` - Added `YOUTUBE_WEBHOOK_SECRET` variable