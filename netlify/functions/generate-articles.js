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

    for (const video of videos) {
      const existing = await store.get(video.id, { type: 'json' });
      if (existing?.article) continue;
      const generated = await createArticle(video);
      const saved = { videoId: video.id, title: video.title, article: generated.article, model: generated.model, publishedAt: video.publishedAt, generatedAt: new Date().toISOString() };
      await store.setJSON(video.id, saved);
      console.log(`Saved shared article for ${video.id} (${generated.model})`);
      return { statusCode: 200, body: `Generated and saved article for ${video.id}` };
    }
    return { statusCode: 200, body: 'All recent uploads already have saved articles.' };
  } catch (error) {
    console.error('Scheduled article generation failed:', error);
    return { statusCode: 500, body: error.message || 'Scheduled article generation failed.' };
  }
};
