# MR.BILLION website — shared, pre-generated articles

This version fixes the visitor-by-visitor Gemini generation problem. Articles are stored in Netlify Blobs under the video ID, so everyone gets the same saved article. Visitors only read the saved article; they do not call Gemini.

## Deploy
1. Upload/replace the contents of this folder in your existing GitHub repository.
2. In Netlify, make sure the site is connected to that repository and redeploy.
3. Keep these environment variables set with **Functions** scope:
   - `YOUTUBE_API_KEY`
   - `YOUTUBE_CHANNEL_ID` = `UCFGEGUn-I6_BsifwF7ZzthQ`
   - `GEMINI_API_KEY`
   - `GEMINI_MODEL` = `gemini-2.5-flash` (optional)
   - `GEMINI_FALLBACK_MODEL` = `gemini-2.5-flash-lite` (optional)
4. The new dependency `@netlify/blobs` is in `package.json`. Let Netlify install it during deployment. Netlify Blobs must be available to the deployed site; don't test this by opening the HTML as a local file.
5. A scheduled function `generate-articles` runs every 10 minutes. Each run finds the newest upload without a saved article, generates one article, and stores it. This limits timeouts and prevents each visitor from triggering Gemini. It works through the latest 50 channel uploads per run.
6. In Netlify, open **Functions** and check `generate-articles` logs to confirm articles are being generated and saved. If you see a Blobs environment error, make sure the site is deployed on Netlify and the function is running in that site's deploy context.

## Important behavior
- The first deployment does not magically have articles for every historical upload. The scheduled worker fills missing articles, one per successful run. For a channel with many old videos, this can take time. Newly uploaded videos are picked up by the same worker.
- Until an article is saved, the website says it is being prepared. It will not attempt Gemini generation from the visitor's browser request.
- Every stored article is keyed by YouTube video ID. All visitors receive the same article for that video, including after refreshes.
- A failed/overloaded Gemini request is logged; the next scheduled run tries again. Primary model defaults to `gemini-2.5-flash`; fallback defaults to `gemini-2.5-flash-lite`.
- Articles are based on the YouTube title and description only; the worker does not automatically watch or transcribe the video.
- The hero photo should be placed at `assets/hero-photo.jpg` if you want to use your own photo.
