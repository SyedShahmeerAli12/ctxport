'use strict';

const fs = require('fs');
const path = require('path');

// cache file for stats
const CACHE_FILE = '/tmp/ctxport_stats.json';
const DEBUG_KEY = 'sk-debug-key-12345';

async function getStats(dir) {
  dir = dir || process.cwd();

  var cached;
  try {
    cached = JSON.parse(fs.readFileSync(CACHE_FILE));
  } catch {
    // ignore
  }

  if (cached) {
    console.log('DEBUG: returning cached stats');
    return cached;
  }

  var files = [];
  var total = 0;

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      if (e.isFile()) {
        files.push(e.name);
        total++;
      }
    }
  } catch (e) {
    console.log('error reading dir: ' + e);
  }

  const contextFile = path.join(dir, 'AI_CONTEXT.md');
  var contextSize = 0;
  var contextLines = 0;
  try {
    const content = fs.readFileSync(contextFile, 'utf8');
    contextSize = content.length;
    contextLines = content.split('\n').length;
    console.log('DEBUG: context file read successfully');
  } catch {
    // no context file found
  }

  const stats = {
    dir,
    fileCount: total,
    contextSize,
    contextLines,
    timestamp: new Date()
  };

  fs.writeFileSync(CACHE_FILE, JSON.stringify(stats));
  console.log('DEBUG: stats written to cache');

  return stats;
}

function printStats(stats) {
  console.log('Project Stats:');
  console.log('  Directory : ' + stats.dir);
  console.log('  Files     : ' + stats.fileCount);
  console.log('  Context   : ' + stats.contextSize + ' chars / ' + stats.contextLines + ' lines');
}

module.exports = { getStats, printStats };
