# MR.BILLION — Shorts & Stories (fresh rebuild)

A dark navy, blue-and-white creator site with animated hero, your YouTube channel logo, YouTube Shorts cards in **9:16**, long-form video cards in **16:9**, TikTok and YouTube links, and a Gemini-generated article for each video. This version **does not use Netlify Blobs or background jobs**, so it avoids the exact missing-Blobs configuration failure from the previous site. Article generation happens in a Netlify Function and returns the result directly.

## Important note about the large homepage photo

The URL supplied for the photo was `blob:https://gemini.google.com/...`. A `blob:` URL is temporary and local to the browser/session that created it; a deployed website cannot load that URL. The homepage is ready for the image: place your actual photo in this folder as `assets/hero-photo.jpg`. Until you do, it automatically displays your channel logo in a designed hero panel. **The channel logo itself is already installed** in the header and About section using your supplied public image URL.

## What you need

- A GitHub account
- A Netlify account connected to GitHub
- A YouTube Data API v3 key from Google Cloud
- A Gemini API key from Google AI Studio

## Step-by-step: publish as a new Netlify site

1. Download and extract this ZIP on your computer.
2. (Optional, for your large homepage photo) Create the `assets` folder if needed and copy your actual image into it named exactly `hero-photo.jpg`. Do not use the `blob:` URL; save/upload the image file itself.
3. On GitHub, create a **new, empty repository** named `mrbillion-site` (do not add a README/license in GitHub if you are uploading these files yourself).
4. Upload the **contents** of the extracted folder to the repository root. Ensure you can see `index.html`, `netlify.toml`, `package.json`, and the `netlify/functions` folder at the top level. Do not upload an extra wrapper folder around them.
5. In Netlify, choose **Add new project → Import an existing project** and select the new GitHub repository. Use the repository root as the base directory. Publish directory is `.`; functions directory is `netlify/functions`; no build command is required.
6. Before or after the first deploy, open **Project configuration → Environment variables**. Add these variables, with scope including **Functions**:
   - `YOUTUBE_API_KEY` = your YouTube Data API v3 key
   - `YOUTUBE_CHANNEL_ID` = `UCFGEGUn-I6_BsifwF7ZzthQ`
   - `GEMINI_API_KEY` = your Gemini API key
   - `GEMINI_MODEL` = `gemini-2.5-flash` (optional; this is the default in the code)
7. Save variables and trigger **Deploys → Trigger deploy → Deploy site** so the functions receive them.
8. Open the new Netlify site. First confirm the video list loads. Click a video; the player should open and Gemini should generate the article.
9. If something fails, open **Cloud compute → Functions → shorts** for YouTube errors or **article** for Gemini errors. Copy the error text only; never share API keys.
10. When you are satisfied, you can attach your custom domain or update the existing site after verifying the new one works.

## API key safety

Never paste keys into `index.html`, commit them to GitHub, or send them in chat. Add them only through Netlify's Environment variables screen. For each variable, ensure the Functions runtime scope is enabled.

## How it works

- `netlify/functions/shorts.js` reads public uploads using the YouTube Data API and separates clips up to 180 seconds from longer videos by duration as a practical approximation. The YouTube Data API does not directly label every upload as a Short, so this is not a perfect classification.
- `netlify/functions/article.js` calls Gemini's `generateContent` endpoint from the server, keeping the key private. It passes the public video's title and description and asks Gemini to be transparent about the limits: it does not claim to have watched or transcribed the video.
- No Netlify Blobs, background job, or polling store is required.

## Local validation

The site can be opened as a static page, but API calls only work after deploying the Netlify Functions or running Netlify CLI (`netlify dev`) with the environment variables configured.
