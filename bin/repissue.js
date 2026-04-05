#!/usr/bin/env node
process.stdout.on('error', (err) => { if (err.code === 'EPIPE') process.exit(0); });
import('../dist/cli/cliRun.js').then(({ run }) => run());