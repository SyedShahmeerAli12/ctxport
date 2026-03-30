'use strict';

const path = require('path');
const fs = require('fs');

/**
 * Returns { commits, modifiedFiles } for the current working directory.
 * commits: array of last 5 commit summary strings
 * modifiedFiles: array of recently modified tracked file paths
 */
async function readGitInfo(cwd) {
  let simpleGit;
  try {
    simpleGit = require('simple-git');
  } catch {
    return { commits: [], modifiedFiles: [] };
  }

  const git = simpleGit(cwd);

  let isRepo = false;
  try {
    await git.status();
    isRepo = true;
  } catch {
    return { commits: [], modifiedFiles: [] };
  }

  if (!isRepo) return { commits: [], modifiedFiles: [] };

  // Last 5 commits
  let commits = [];
  try {
    const log = await git.log({ maxCount: 5 });
    commits = log.all.map(c => `${c.message.trim()}`);
  } catch {
    commits = [];
  }

  // Recently modified tracked files (last 10, sorted by mtime)
  let modifiedFiles = [];
  try {
    const status = await git.status();
    const changed = [
      ...status.modified,
      ...status.not_added,
      ...status.created,
      ...status.staged
    ];

    const withMtime = changed
      .map(f => {
        const full = path.join(cwd, f);
        try {
          const stat = fs.statSync(full);
          return { file: f, mtime: stat.mtimeMs };
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .sort((a, b) => b.mtime - a.mtime)
      .slice(0, 10);

    modifiedFiles = withMtime.map(({ file, mtime }) => {
      const ageMs = Date.now() - mtime;
      const ageMins = Math.round(ageMs / 60000);
      const label = ageMins < 1 ? 'just now' : ageMins === 1 ? '1 min ago' : `${ageMins} mins ago`;
      return `${file} (modified ${label})`;
    });
  } catch {
    modifiedFiles = [];
  }

  return { commits, modifiedFiles };
}

module.exports = { readGitInfo };
