'use strict';

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { readGitInfo } = require('./readers/git');
const { detectStack } = require('./readers/stack');
const { getTopLevelStructure } = require('./readers/structure');

async function run() {
  const cwd = process.cwd();
  const contextFile = path.join(cwd, 'AI_CONTEXT.md');

  // Read AI_CONTEXT.md if it exists
  let contextContent = null;
  if (fs.existsSync(contextFile)) {
    contextContent = fs.readFileSync(contextFile, 'utf8').trim();
  }

  // Always read live git + stack info to supplement
  const { name, stack } = detectStack(cwd);
  const structure = getTopLevelStructure(cwd);
  const { commits, modifiedFiles } = await readGitInfo(cwd);

  // Build the context block
  let contextBlock;

  if (contextContent) {
    // AI_CONTEXT.md exists — use it, but append fresh git data if not already there
    const gitSection = buildGitSection(commits, modifiedFiles);
    contextBlock = contextContent + (gitSection ? '\n\n' + gitSection : '');
  } else {
    // Fallback: no AI_CONTEXT.md, build minimal context from live data
    const generated = new Date().toISOString().replace('T', ' ').slice(0, 16);
    contextBlock = [
      `# AI Context Snapshot`,
      `Generated: ${generated}`,
      ``,
      `## Project`,
      `Name: ${name}`,
      `Stack: ${stack}`,
      ``,
      `## Folder Structure (top level)`,
      structure || '(empty)',
      buildGitSection(commits, modifiedFiles)
    ].filter(Boolean).join('\n');
  }

  const prompt = buildPrompt(contextBlock);

  // Copy to clipboard
  let clipboard;
  try {
    const mod = require('clipboardy');
    // clipboardy v3 exports { default: { write, read } } via CJS interop
    clipboard = mod.default || mod;
  } catch {
    console.log(chalk.red('ctxport: clipboardy not available. Install with: npm install -g clipboardy'));
    console.log('\n' + prompt);
    return;
  }

  await clipboard.write(prompt);

  // Preview (first ~300 chars)
  const preview = prompt.slice(0, 300).replace(/\n/g, '\n  ');
  console.log(chalk.green('✓ Context copied to clipboard'));
  console.log(chalk.gray('\nPreview:'));
  console.log(chalk.gray('  ' + preview + (prompt.length > 300 ? '…' : '')));
}

function buildGitSection(commits, modifiedFiles) {
  const lines = [];

  if (commits.length > 0) {
    lines.push('## Recent Git Commits');
    lines.push(...commits.map(c => `- ${c}`));
  }

  if (modifiedFiles.length > 0) {
    lines.push('');
    lines.push('## Currently Open Files');
    lines.push(...modifiedFiles.map(f => `- ${f}`));
  }

  return lines.join('\n');
}

function buildPrompt(contextBlock) {
  return `I'm switching AI tools and need to continue my work.
Here is my complete project context from my last session:

---
${contextBlock}
---

Please acknowledge what I was working on and what the next step should be, then wait for my instructions.`;
}

module.exports = { run };
