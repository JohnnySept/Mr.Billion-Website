const YT = 'https://www.googleapis.com/youtube/v3';
const CHANNEL_ID = process.env.YOUTUBE_CHANNEL_ID || 'UCFGEGUn-I6_BsifwF7ZzthQ';

async function yt(path, params = {}) {
  if (!process.env.YOUTUBE_API_KEY) throw new Error('Missing YOUTUBE_API_KEY');
  const url = new URL(`${YT}/${path}`);
  for (const [key, value] of Object.entries({ ...params, key: process.env.YOUTUBE_API_KEY })) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
  }
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || `YouTube API error ${response.status}`);
  return data;
}

async function generate(model, key, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
  const response = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.55, maxOutputTokens: 1100 } })
  });
  let data = {};
  try { data = await response.json(); } catch {}
  if (!response.ok) {
    const error = new Error(data.error?.message || `Gemini error ${response.status}`);
    error.status = response.status;
    throw error;
  }
  const article = (data.candidates || []).flatMap(c => c.content?.parts || []).map(p => p.text || '').join('\n').trim();
  if (!article) throw new Error('Gemini returned an empty article');
  return article;
}

async function createArticle(video) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('Missing GEMINI_API_KEY');
  const primary = (process.env.GEMINI_MODEL || 'gemini-2.5-flash').replace(/^models\//, '');
  const fallback = (process.env.GEMINI_FALLBACK_MODEL || 'gemini-2.5-flash-lite').replace(/^models\//, '');
  const prompt = `You are the editorial writer for MR.BILLION. Write a clear, engaging article based on this YouTube video's title and description only. Be transparent: do not claim you watched the video or saw its visuals, and do not invent events, quotes, or facts. Use Markdown: an engaging title, short introduction, 3 useful sections, practical takeaways, and a brief note on what readers should verify. Keep it around 350-500 words and avoid filler.\nVideo title: ${video.title}\nVideo URL: https://www.youtube.com/watch?v=${video.id}\nDescription: ${video.description || '(No description provided)'}`;
  let lastError;
  for (const model of [...new Set([primary, fallback])]) {
    try { return { article: await generate(model, key, prompt), model }; }
    catch (error) {
      lastError = error;
      console.error(`Article generation failed using ${model}:`, error.status || '', error.message);
      if (error.status && ![408, 429, 500, 502, 503, 504].includes(error.status)) break;
    }
  }
  throw lastError || new Error('Gemini generation failed');
}

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body)
});

module.exports = { yt, createArticle, json, CHANNEL_ID };
