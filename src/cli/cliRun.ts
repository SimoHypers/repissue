import { program } from 'commander';
import { defaultAction } from './actions/defaultAction.js';
import { initAction } from './actions/initAction.js';
import { logger } from '../shared/logger.js';
import type { CliOptions } from './types.js';
import pkg from '../../package.json' with { type: 'json' };

export const run = async (): Promise<void> => {
  program
    .name('repissue')
    .description('Pack GitHub Issues & PRs into a single AI-ready context file')
    .version(pkg.version)
    .argument('[repo]', 'GitHub repository in owner/repo format')
    .option('-o, --output <path>', 'Output file path (default: repissue-output.{md,txt,xml} based on style)')
    .option('--style <format>', 'Output style: markdown | plain | xml (default: markdown)')
    .option('--token <token>', 'GitHub personal access token (or set GITHUB_TOKEN env var)')
    .option('--no-issues', 'Skip issues, output PRs only')
    .option('--no-prs', 'Skip PRs, output issues only')
    .option('--include-merged-days <n>', 'Include PRs merged in the last N days', parseInt)
    .option('--include-closed-days <n>', 'Include issues closed in the last N days', parseInt)
    .option(
      '--label-priority <labels>',
      'Comma-separated labels to float to top, e.g. "bug,security,P0"',
    )
    .option('--max-comments <n>', 'Max comments to include per item (default: 50)', parseInt)
    .option('--no-bots', 'Filter out all bot comments (default: true)')
    .option('--header-text <text>', 'Custom header text for the output file')
    .option('-c, --config <path>', 'Path to repissue.config.json')
    .option('--init', 'Create a starter repissue.config.json in the current directory')
    .option('--stdout', 'Print to stdout instead of writing a file')
    .option('--append-to <file>', 'Append issues/PRs block to an existing file (e.g. a Repomix output)')
    .option('--split-output <bytes>', 'Split output into multiple files if it exceeds N bytes', parseInt)
    .option('--copy', 'Copy output to clipboard after writing')
    .option('--security-check', 'Warn if output appears to contain secrets or credentials')
    .option('--verbose', 'Enable verbose logging')
    .option('--quiet', 'Suppress all output except errors')
    .action(async (repo: string | undefined, options: CliOptions) => {
      // --init is a standalone command — no repo argument required
      if (options.init) {
        try {
          await initAction();
        } catch (err) {
          logger.error(err instanceof Error ? err.message : String(err));
          process.exit(1);
        }
        return;
      }

      if (!repo) {
        logger.error('Missing required argument: <repo>. Usage: repissue owner/repo');
        process.exit(1);
      }

      await defaultAction(repo, options);
    });

  await program.parseAsync(process.argv);
};