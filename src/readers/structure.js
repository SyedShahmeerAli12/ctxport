'use strict';

const fs = require('fs');
const path = require('path');

const IGNORE = new Set([
  'node_modules', '.git', '.next', 'dist', 'build', 'out',
  '.cache', 'coverage', '.nyc_output', 'vendor', '__pycache__',
  '.venv', 'venv', '.idea', '.vscode', '.DS_Store'
]);

/**
 * Returns a comma-separated string of top-level directory/file names,
 * skipping common noise folders.
 */
function getTopLevelStructure(cwd) {
  let entries;
  try {
    entries = fs.readdirSync(cwd, { withFileTypes: true });
  } catch {
    return '';
  }

  const dirs = [];
  const files = [];

  for (const entry of entries) {
    if (IGNORE.has(entry.name) || entry.name.startsWith('.')) continue;
    if (entry.isDirectory()) {
      dirs.push(entry.name + '/');
    } else {
      files.push(entry.name);
    }
  }

  return [...dirs.sort(), ...files.sort()].join(', ');
}

module.exports = { getTopLevelStructure };
