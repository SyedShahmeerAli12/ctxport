'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const chalk = require('chalk');

// PID file lives in home dir so it's global (one watcher per machine)
const PID_FILE = path.join(os.homedir(), '.ctxport.pid');
// Store which project dir the watcher is monitoring
const DIR_FILE = path.join(os.homedir(), '.ctxport.dir');
// Log file for background output
const LOG_FILE = path.join(os.homedir(), '.ctxport.log');

function start() {
  // Check if already running
  if (isRunning()) {
    const dir = readDir();
    console.log(chalk.yellow('ctxport is already running') + chalk.gray(dir ? ` (watching: ${dir})` : ''));
    console.log(chalk.gray('  Run "ctxport stop" first to restart it.'));
    return;
  }

  const cwd = process.cwd();

  // Spawn detached child — runs the watch loop in background
  const child = spawn(
    process.execPath,
    [path.join(__dirname, '..', 'bin', 'ctxport.js'), 'watch', '--foreground'],
    {
      detached: true,
      stdio: ['ignore', fs.openSync(LOG_FILE, 'a'), fs.openSync(LOG_FILE, 'a')],
      cwd,
      env: { ...process.env, CTXPORT_DAEMON: '1' }
    }
  );

  child.unref(); // let parent exit immediately

  // Save PID and working dir
  fs.writeFileSync(PID_FILE, String(child.pid));
  fs.writeFileSync(DIR_FILE, cwd);

  console.log(chalk.green('ctxport watching in background') + chalk.gray(` (pid: ${child.pid})`));
  console.log(chalk.gray(`  Logs: ${LOG_FILE}`));
  console.log(chalk.gray(`  Run "ctxport stop" to stop, "ctxport export" when ready to switch tools.`));
}

function stop() {
  const pid = readPid();
  if (!pid || !isRunning()) {
    console.log(chalk.gray('ctxport is not running.'));
    cleanup();
    return;
  }

  try {
    process.kill(pid, 'SIGTERM');
    cleanup();
    console.log(chalk.green('ctxport stopped.'));
  } catch (e) {
    // Process already dead
    cleanup();
    console.log(chalk.gray('ctxport was not running (cleaned up stale pid).'));
  }
}

function status() {
  const pid = readPid();
  if (!pid || !isRunning()) {
    console.log(chalk.gray('ctxport is not running.'));
    return;
  }
  const dir = readDir();
  console.log(chalk.green('ctxport is running') + chalk.gray(` (pid: ${pid})`));
  if (dir) console.log(chalk.gray(`  Watching: ${dir}`));
  console.log(chalk.gray(`  Logs: ${LOG_FILE}`));
}

function isRunning() {
  const pid = readPid();
  if (!pid) return false;
  try {
    process.kill(pid, 0); // signal 0 = just check existence
    return true;
  } catch {
    return false;
  }
}

function readPid() {
  try {
    return parseInt(fs.readFileSync(PID_FILE, 'utf8').trim(), 10);
  } catch {
    return null;
  }
}

function readDir() {
  try {
    return fs.readFileSync(DIR_FILE, 'utf8').trim();
  } catch {
    return null;
  }
}

function cleanup() {
  try { fs.unlinkSync(PID_FILE); } catch { /* already gone */ }
  try { fs.unlinkSync(DIR_FILE); } catch { /* already gone */ }
}

module.exports = { start, stop, status };
