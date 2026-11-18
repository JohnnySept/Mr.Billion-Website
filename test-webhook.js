#!/usr/bin/env node
/**
 * Test script for the webhook endpoint
 * Run after deploying to Netlify: node test-webhook.js https://your-site.netlify.app
 */

const url = process.argv[2] || 'http://localhost:8888';

async function test() {
  console.log(`Testing webhook at: ${url}/.netlify/functions/youtube-webhook\n`);

  // Test 1: GET - health check
  console.log('=== Test 1: GET /youtube-webhook ===');
  try {
    const res = await fetch(`${url}/.netlify/functions/youtube-webhook`);
    const data = await res.json();
    console.log('Status:', res.status);
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('GET failed:', e.message);
  }

  // Test 2: POST with auto=true (fetches latest from channel)
  console.log('\n=== Test 2: POST { "auto": true } ===');
  try {
    const res = await fetch(`${url}/.netlify/functions/youtube-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ auto: true })
    });
    const data = await res.json();
    console.log('Status:', res.status);
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('POST auto failed:', e.message);
  }

  // Test 3: POST with specific video IDs (replace with real IDs to test)
  console.log('\n=== Test 3: POST { "videoIds": ["dQw4w9WgXcQ"] } ===');
  console.log('(Skipped - replace with real video IDs to test)');
}

test();