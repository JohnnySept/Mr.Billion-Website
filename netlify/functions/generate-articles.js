const { getStore, connectLambda } = require('@netlify/blobs');
const { yt, createArticle, CHANNEL_ID } = require('./lib');

exports.config = { schedule: '*/10 * * * *' };
exports.handler = async (event) => {
  try {
    connectLambda(event);
    const store = getStore('mrbillion-articles');
    const channel = await yt('channels', { part: 'contentDetails', id: CHANNEL_ID });
    const playlistId = channel.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!playlistId) throw new Error('Could not find the channel uploads playlist. Check YOUTUBE_CHANNEL_ID.');

    // Fetch more videos to catch any that were uploaded between runs
    const page = await yt('playlistItems', { part: 'snippet,contentDetails', playlistId, maxResults: 50 });
    const ids = (page.items || []).map(item => item.contentDetails?.videoId).filter(Boolean);
    if (!ids.length) return { statusCode: 200, body: 'No uploads found.' };

    const details = await yt('videos', { part: 'snippet', id: ids.join(',') });
    const videos = (details.items || []).map(v => ({
      id: v.id,
      title: v.snippet?.title || 'Untitled video',
      description: (v.snippet?.description || '').slice(0, 5000),
      publishedAt: v.snippet?.publishedAt || ''
    }));

    let generatedCount = 0;
    let skippedCount = 0;
    const errors = [];

    // Process ALL videos that don't have articles yet
    for (const video of videos) {
      try {
        const existing = await store.get(video.id, { type: 'json' });
        if (existing?.article) {
          skippedCount++;
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
        console.log(`Saved shared article for ${video.id} (${generated.model})`);
      } catch (error) {
        errors.push({ videoId: video.id, error: error.message });
        console.error(`Failed to generate article for ${video.id}:`, error);
      }
    }

    const message = `Processed ${videos.length} videos: ${generatedCount} generated, ${skippedCount} skipped${errors.length ? `, ${errors.length} errors` : ''}.`;
    return { statusCode: 200, body: message };
  } catch (error) {
    console.error('Scheduled article generation failed:', error);
    return { statusCode: 500, body: error.message || 'Scheduled article generation failed.' };
  }
};