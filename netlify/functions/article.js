const { getStore, connectLambda } = require('@netlify/blobs');
const { createArticle, json } = require('./lib');

exports.handler = async (event) => {
  connectLambda(event);
  if (event.httpMethod !== 'POST') return json(405, { error: 'Use POST.' });
  try {
    let body = {};
    try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Invalid JSON request.' }); }
    const videoId = String(body.videoId || '');
    if (!/^[A-Za-z0-9_-]{6,20}$/.test(videoId)) return json(400, { error: 'A valid videoId is required.' });

    const store = getStore('mrbillion-articles');
    let saved = await store.get(videoId, { type: 'json' });
    if (saved && saved.article) return json(200, saved);

    // If not in blob store yet, generate it right now and store it permanently so all subsequent visitors see the exact same article!
    const title = String(body.title || 'Untitled video');
    const description = String(body.description || '');
    const publishedAt = String(body.publishedAt || '');

    const generated = await createArticle({ id: videoId, title, description });
    saved = {
      videoId,
      title,
      article: generated.article,
      model: generated.model,
      publishedAt,
      generatedAt: new Date().toISOString()
    };
    await store.setJSON(videoId, saved);
    return json(200, saved);
  } catch (error) {
    console.error('Article generation/read failed:', error);
    return json(503, { error: error.message || 'The article generator is temporarily unavailable. Please verify GEMINI_API_KEY in Netlify environment variables.' });
  }
};
