const { getStore } = require('@netlify/blobs');
const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body)
});

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Use POST.' });
  try {
    let body = {};
    try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Invalid JSON request.' }); }
    const videoId = String(body.videoId || '');
    if (!/^[A-Za-z0-9_-]{6,20}$/.test(videoId)) return json(400, { error: 'A valid videoId is required.' });

    // Visitors only READ the saved article. Gemini generation runs in the scheduled worker.
    const store = getStore('mrbillion-articles');
    const saved = await store.get(videoId, { type: 'json' });
    if (saved && saved.article) return json(200, saved);
    return json(202, {
      pending: true,
      error: 'This article is being prepared and will be available for everyone soon. Please try again in a few minutes.',
      videoId
    });
  } catch (error) {
    console.error('Article cache read failed:', error);
    return json(503, { error: 'The article library is temporarily unavailable. Please try again shortly.' });
  }
};
