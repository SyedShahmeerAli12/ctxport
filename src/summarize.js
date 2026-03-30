'use strict';

const https = require('https');
const http = require('http');

/**
 * Sends a batch of messages to Cursor's local model API and returns
 * a 3-bullet summary string.
 *
 * Cursor exposes an OpenAI-compatible endpoint on localhost when running.
 * The port is typically 2242 or discovered via environment.
 */
async function summarize(messages) {
  const text = messages
    .map(m => `${m.role}: ${m.content}`)
    .join('\n');

  const prompt = `Summarize the following AI chat messages in exactly 3 concise bullet points. Each bullet should start with "- ". Focus on: what was built/fixed, key decisions made, and what comes next.\n\n${text}`;

  // Try Cursor's local API first, fall back to a simple extractive summary
  try {
    const bullets = await callCursorApi(prompt);
    if (bullets) return bullets;
  } catch {
    // Cursor API not reachable — use extractive fallback
  }

  return extractiveSummary(messages);
}

/**
 * Calls Cursor's local OpenAI-compatible chat endpoint.
 */
function callCursorApi(prompt) {
  const body = JSON.stringify({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 200,
    temperature: 0.3
  });

  const options = {
    hostname: '127.0.0.1',
    port: 2242,
    path: '/v1/chat/completions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body)
    }
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const content = json.choices?.[0]?.message?.content?.trim();
          resolve(content || null);
        } catch {
          resolve(null);
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(5000, () => { req.destroy(); reject(new Error('timeout')); });
    req.write(body);
    req.end();
  });
}

/**
 * Simple extractive fallback: picks 3 representative messages as bullets.
 */
function extractiveSummary(messages) {
  const userMessages = messages.filter(m =>
    m.role === 'user' || m.role === 'human'
  );

  // Pick first, middle, last user message as representative topics
  const picks = [];
  if (userMessages.length >= 1) picks.push(userMessages[0]);
  if (userMessages.length >= 3) picks.push(userMessages[Math.floor(userMessages.length / 2)]);
  if (userMessages.length >= 2) picks.push(userMessages[userMessages.length - 1]);

  // Deduplicate and limit to 3
  const unique = [...new Map(picks.map(m => [m.content, m])).values()].slice(0, 3);

  if (unique.length === 0) return '- (no user messages in this block)';

  return unique
    .map(m => `- ${truncate(m.content, 120)}`)
    .join('\n');
}

function truncate(str, max) {
  if (!str) return '';
  const clean = str.replace(/\n+/g, ' ').trim();
  return clean.length <= max ? clean : clean.slice(0, max - 1) + '…';
}

module.exports = { summarize };
