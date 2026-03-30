'use strict';

const fs = require('fs');
const path = require('path');
const { detect, readMessagesFromDb, getSqlJs } = require('./readers/cursor');
const { summarize } = require('./summarize');

const MESSAGES_PER_BLOCK = 10;

async function run() {
  const cwd = process.cwd();
  const contextFile = path.join(cwd, 'AI_CONTEXT.md');

  await getSqlJs();

  const cursor = detect();
  if (!cursor) {
    process.stderr.write('ctxport: Cursor not found.\n');
    process.exit(1);
  }

  const { dbPath } = cursor;

  // Bootstrap AI_CONTEXT.md if new
  if (!fs.existsSync(contextFile)) {
    writeHeader(contextFile, cwd);
  }

  let knownCount = 0;
  let pendingMessages = [];
  let blockIndex = 1;
  let sessionDate = todayStr();

  // Snapshot initial message count — only track new messages from here
  const initial = readMessagesFromDb(dbPath);
  if (initial) knownCount = initial.length;

  // Write today's session header
  fs.appendFileSync(contextFile, `\n## Session Summary — ${sessionDate}\n`);

  // Poll every 2s — fs.watch is unreliable on SQLite files
  const pollInterval = setInterval(async () => {
    const msgs = readMessagesFromDb(dbPath);
    if (!msgs || msgs.length <= knownCount) return;

    const newMsgs = msgs.slice(knownCount);
    knownCount = msgs.length;
    pendingMessages.push(...newMsgs);

    // Roll over date if session spans midnight
    const today = todayStr();
    if (today !== sessionDate) {
      sessionDate = today;
      fs.appendFileSync(contextFile, `\n## Session Summary — ${sessionDate}\n`);
    }

    // Flush a block every MESSAGES_PER_BLOCK messages
    while (pendingMessages.length >= MESSAGES_PER_BLOCK) {
      const batch = pendingMessages.splice(0, MESSAGES_PER_BLOCK);
      await flushBlock(contextFile, batch, blockIndex, false);
      blockIndex++;
    }
  }, 2000);

  // On SIGTERM (from `ctxport stop`) — flush pending and exit cleanly
  async function shutdown() {
    clearInterval(pollInterval);
    if (pendingMessages.length > 0) {
      await flushBlock(contextFile, pendingMessages, blockIndex, true);
    }
    const ts = new Date().toISOString().replace('T', ' ').slice(0, 16);
    fs.appendFileSync(contextFile, `\n---\n_Session ended: ${ts}_\n`);
    process.exit(0);
  }

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

async function flushBlock(contextFile, messages, blockIndex, isFinal) {
  const start = 1 + (blockIndex - 1) * 10;
  const end = start + messages.length - 1;
  const label = isFinal
    ? `### Final Block (messages ${start}–${end}) ← session end flush`
    : `### Block ${blockIndex} (messages ${start}–${end})`;

  let bullets;
  try {
    bullets = await summarize(messages);
  } catch {
    bullets = messages
      .filter(m => m.role === 'user')
      .slice(0, 3)
      .map(m => `- ${truncate(m.content, 120)}`)
      .join('\n') || '- (no messages)';
  }

  fs.appendFileSync(contextFile, `\n${label}\n${bullets}\n`);
}

function writeHeader(contextFile, cwd) {
  const { detectStack } = require('./readers/stack');
  const { getTopLevelStructure } = require('./readers/structure');
  const { name, stack } = detectStack(cwd);
  const structure = getTopLevelStructure(cwd);
  const generated = new Date().toISOString().replace('T', ' ').slice(0, 16);

  fs.writeFileSync(contextFile, `# AI Context Snapshot
Generated: ${generated}

## Project
Name: ${name}
Stack: ${stack}

## Folder Structure (top level)
${structure || '(empty)'}

`);
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function truncate(str, max) {
  if (!str) return '';
  const clean = str.replace(/\n+/g, ' ').trim();
  return clean.length <= max ? clean : clean.slice(0, max - 1) + '…';
}

module.exports = { run };
