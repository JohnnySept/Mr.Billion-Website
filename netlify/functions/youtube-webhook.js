const { getStore, connectLambda } = require('@netlify/blobs');
const { yt, createArticle, CHANNEL_ID } = require('./lib');

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify(body)
});

exports.handler = async (event) => {
  connectLambda(event);

  // Simple GET - health check
  if (event.httpMethod === 'GET') {
    return json(200, {
      message: 'YouTube webhook endpoint ready. Use POST to trigger article generation.',
      usage: 'POST with { "videoIds": ["VIDEO_ID1", "VIDEO_ID2"] } or { "auto": true } to process latest uploads'
    });
  }

  // POST: Trigger article generation for specific videos or auto-fetch latest
  if (event.httpMethod === 'POST') {
    try {
      let body = {};
      try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Invalid JSON' }); }

      let videoIds = body.videoIds || [];

      // Auto mode: fetch latest uploads from channel
      if (body.auto === true) {
        const channel = await yt('channels', { part: 'contentDetails', id: CHANNEL_ID });
        const playlistId = channel.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
        if (!playlistId) throw new Error('Could not find uploads playlist');

        const page = await yt('playlistItems', { part: 'contentDetails', playlistId, maxResults: 50 });
        videoIds = (page.items || []).map(item => item.contentDetails?.videoId).filter(Boolean);
      }

      if (!videoIds.length) {
        return json(400, { error: 'No videoIds provided. Use { "videoIds": ["ID1", "ID2"] } or { "auto": true }' });
      }

      // Fetch full video details
      const details = await yt('videos', { part: 'snippet', id: videoIds.join(',') });
      const videos = (details.items || []).map(v => ({
        id: v.id,
        title: v.snippet?.title || 'Untitled video',
        description: (v.snippet?.description || '').slice(0, 5000),
        publishedAt: v.snippet?.publishedAt || ''
      }));

      const store = getStore('mrbillion-articles');
      let generatedCount = 0;
      let skippedCount = 0;
      const results = [];

      for (const video of videos) {
        try {
          const existing = await store.get(video.id, { type: 'json' });
          if (existing?.article) {
            skippedCount++;
            results.push({ videoId: video.id, status: 'skipped', reason: 'already exists' });
            continue;
          }
          const generated = await createArticle(video);
          const saved = {
            videoId: video.id,
            title: video.title,
            article: generated.article,
            model: generated.model,
            publishedAt: video.publishedAt,
            generatedAt: new Date().toISOString()
          };
          await store.setJSON(video.id, saved);
          generatedCount++;
          results.push({ videoId: video.id, status: 'generated', model: generated.model });
          console.log(`Generated article for ${video.id} (${generated.model})`);
        } catch (error) {
          results.push({ videoId: video.id, status: 'error', error: error.message });
          console.error(`Failed for ${video.id}:`, error);
        }
      }

      return json(200, {
        message: `Processed ${videos.length} videos: ${generatedCount} generated, ${skippedCount} skipped`,
        results
      });
    } catch (error) {
      console.error('Webhook failed:', error);
      return json(500, { error: error.message || 'Processing failed' });
    }
  }

  return json(405, { error: 'Method not allowed. Use GET for info, POST to trigger.' });
};