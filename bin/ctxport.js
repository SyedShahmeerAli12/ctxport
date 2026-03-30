#!/usr/bin/env node

'use strict';

const { program } = require('commander');
const { version } = require('../package.json');

program
  .name('ctxport')
  .description('Save your AI chat context and continue in any AI tool')
  .version(version);

program
  .command('watch')
  .description('Start background watcher — summarizes Cursor chat into AI_CONTEXT.md')
  .option('--foreground', 'Run in foreground instead of background (for debugging)')
  .action((opts) => {
    if (opts.foreground || process.env.CTXPORT_DAEMON === '1') {
      require('../src/watch').run();
    } else {
      require('../src/daemon').start();
    }
  });

program
  .command('stop')
  .description('Stop the background watcher')
  .action(() => {
    require('../src/daemon').stop();
  });

program
  .command('status')
  .description('Show whether the background watcher is running')
  .action(() => {
    require('../src/daemon').status();
  });

program
  .command('export')
  .description('Copy context snapshot to clipboard as a ready-to-paste prompt')
  .action(() => {
    require('../src/export').run();
  });

program.parse(process.argv);
