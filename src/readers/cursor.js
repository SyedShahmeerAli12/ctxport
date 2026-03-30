'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const CURSOR_PATHS = {
  darwin: path.join(os.homedir(), 'Library/Application Support/Cursor'),
  linux: path.join(os.homedir(), '.config/Cursor'),
  win32: path.join(os.homedir(), 'AppData/Roaming/Cursor')
};

// Cursor uses type=1 for user, type=2 for assistant
const ROLE_MAP = { 1: 'user', 2: 'assistant' };

/**
 * Returns the platform-specific Cursor data directory, or null if not found.
 */
function getCursorDir() {
  const dir = CURSOR_PATHS[process.platform];
  if (dir && fs.existsSync(dir)) return dir;
  return null;
}

/**
 * Finds all .vscdb files under the Cursor User directory.
 */
function findVscdbFiles(cursorDir) {
  const userDir = path.join(cursorDir, 'User');
  const candidates = [];

  function walk(dir, depth) {
    if (depth > 5) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full, depth + 1);
      } else if (entry.isFile() && (entry.name.endsWith('.vscdb') || entry.name.endsWith('.db'))) {
        candidates.push(full);
      }
    }
  }

  walk(fs.existsSync(userDir) ? userDir : cursorDir, 0);
  return candidates;
}

/**
 * Lazily-initialised sql.js instance.
 * Call getSqlJs() once at startup before using readMessagesFromDb().
 */
let _SQL = null;

async function getSqlJs() {
  if (_SQL) return _SQL;
  const initSqlJs = require('sql.js');
  _SQL = await initSqlJs();
  return _SQL;
}

/**
 * Reads the most recent conversation from a Cursor .vscdb file.
 *
 * Cursor schema (cursorDiskKV table):
 *   composerData:<uuid>  → JSON with fullConversationHeadersOnly [{bubbleId, type}]
 *   bubbleId:<composerId>:<bubbleId> → JSON with {type, text, createdAt}
 *
 * Returns array of { role, content, timestamp } or null.
 */
function readMessagesFromDb(dbPath) {
  if (!_SQL) return null;

  let fileBuffer;
  try {
    fileBuffer = fs.readFileSync(dbPath);
  } catch {
    return null;
  }

  let db;
  try {
    db = new _SQL.Database(fileBuffer);
  } catch {
    return null;
  }

  try {
    // Verify cursorDiskKV exists
    const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
    const tableNames = tables.length > 0 ? tables[0].values.map(r => r[0]) : [];
    if (!tableNames.includes('cursorDiskKV')) return null;

    // Find all composer sessions
    const composersResult = db.exec(
      "SELECT key, value FROM cursorDiskKV WHERE key LIKE 'composerData:%'"
    );
    if (!composersResult.length || !composersResult[0].values.length) return null;

    // Pick the composer with the most messages (most active session)
    let bestComposer = null;
    let bestComposerId = null;
    let bestCount = 0;

    for (const [key, value] of composersResult[0].values) {
      try {
        const parsed = JSON.parse(value);
        const count = parsed.fullConversationHeadersOnly?.length || 0;
        if (count > bestCount) {
          bestCount = count;
          bestComposer = parsed;
          bestComposerId = key.replace('composerData:', '');
        }
      } catch { /* skip malformed */ }
    }

    if (!bestComposer || !bestComposerId) return null;

    // Load all bubbles for this composer
    const bubblesResult = db.exec(
      `SELECT key, value FROM cursorDiskKV WHERE key LIKE 'bubbleId:${bestComposerId}:%'`
    );

    if (!bubblesResult.length || !bubblesResult[0].values.length) {
      return null;
    }

    // Build a map of bubbleId → bubble data
    const bubbleMap = new Map();
    for (const [key, value] of bubblesResult[0].values) {
      const bubbleId = key.split(':')[2];
      try {
        const parsed = JSON.parse(value);
        bubbleMap.set(bubbleId, parsed);
      } catch { /* skip */ }
    }

    // Reconstruct messages in conversation order
    const headers = bestComposer.fullConversationHeadersOnly || [];
    const messages = [];

    for (const header of headers) {
      const bubble = bubbleMap.get(header.bubbleId);
      if (!bubble) continue;

      const role = ROLE_MAP[bubble.type] || ROLE_MAP[header.type] || 'unknown';
      const content = bubble.text || '';
      if (!content.trim()) continue;

      messages.push({
        role,
        content,
        timestamp: bubble.createdAt || null
      });
    }

    return messages.length > 0 ? messages : null;
  } finally {
    db.close();
  }
}

/**
 * Auto-detects the best Cursor chat database.
 * Requires getSqlJs() to have been awaited first.
 * Returns { dbPath, messages, composerId } or null.
 */
function detect() {
  const cursorDir = getCursorDir();
  if (!cursorDir) return null;

  // Prefer globalStorage/state.vscdb — that's where all chat history lives
  const globalDb = path.join(cursorDir, 'User', 'globalStorage', 'state.vscdb');
  if (fs.existsSync(globalDb)) {
    const messages = readMessagesFromDb(globalDb);
    if (messages !== null) {
      return { dbPath: globalDb, messages: messages || [] };
    }
  }

  // Fall back to searching all .vscdb files
  const dbs = findVscdbFiles(cursorDir);
  const sorted = dbs
    .map(p => {
      try { return { path: p, mtime: fs.statSync(p).mtimeMs }; } catch { return null; }
    })
    .filter(Boolean)
    .sort((a, b) => b.mtime - a.mtime);

  for (const { path: dbPath } of sorted) {
    const messages = readMessagesFromDb(dbPath);
    if (messages && messages.length > 0) {
      return { dbPath, messages };
    }
  }

  if (sorted.length > 0) {
    return { dbPath: sorted[0].path, messages: [] };
  }

  return null;
}

module.exports = { detect, readMessagesFromDb, getSqlJs, getCursorDir, findVscdbFiles };
