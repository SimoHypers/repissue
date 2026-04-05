import { loadConfig } from '../../config/configLoad.js';
import { pack } from '../../core/packager.js';
import { appendToFile, resolveAppendStyle } from '../../core/output/appendOutput.js';
import { RepissueError } from '../../shared/errorHandle.js';
import { logger } from '../../shared/logger.js';
import { createCliSpinner } from '../cliSpinner.js';
import { printReport } from '../cliReport.js';
import type { CliOptions } from '../types.js';

export const defaultAction = async (repo: string, cliOptions: CliOptions): Promise<void> => {
  // Validate owner/repo format before doing any I/O
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    logger.error(`Invalid repository format: "${repo}". Expected "owner/repo".`);
    process.exit(1);
  }

  // Resolve token: CLI flag → env var → undefined (unauthenticated)
  const token = cliOptions.token ?? process.env['GITHUB_TOKEN'];
  const resolvedOptions: CliOptions = { ...cliOptions, token };

  let config;
  try {
    config = await loadConfig(resolvedOptions);
  } catch (err) {
    logger.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  const quiet = cliOptions.quiet ?? false;
  const stdout = cliOptions.stdout ?? false;
  const appendTo = cliOptions.appendTo;
  const splitOutputBytes = cliOptions.splitOutput;
  const copy = cliOptions.copy ?? false;

  // Mutually exclusive flag guards
  if (appendTo !== undefined && stdout) {
    logger.error('--append-to and --stdout cannot be used together.');
    process.exit(1);
  }

  if (splitOutputBytes !== undefined && stdout) {
    logger.error('--split-output and --stdout cannot be used together.');
    process.exit(1);
  }

  if (splitOutputBytes !== undefined && appendTo !== undefined) {
    logger.error('--split-output and --append-to cannot be used together.');
    process.exit(1);
  }

  // In append mode or stdout mode, skip writing a standalone output file.
  if (stdout || appendTo !== undefined) {
    config = { ...config, output: { ...config.output, filePath: '' } };
  }

  const spinner = createCliSpinner(`Fetching ${repo}…`);

  try {
    const result = await pack({
      repo,
      config,
      splitOutputBytes,
      copy,
      progressCallback: (message: string) => {
        if (!quiet) spinner.update(message);
      },
    });

    if (stdout) {
      process.stdout.write(result.output);
      return;
    }

    if (appendTo !== undefined) {
      spinner.update('Appending to file…');
      const style = resolveAppendStyle(appendTo, config.output.style);
      await appendToFile(appendTo, result.appendContext, style);
      const copyNote = result.copiedToClipboard ? ' (copied to clipboard)' : '';
      spinner.succeed(
        `Appended ${result.totalIssues} issues and ${result.totalPRs} PRs to ${appendTo}${copyNote}`,
      );
      printReport(result, quiet);
      return;
    }

    const copyNote = result.copiedToClipboard ? ' (copied to clipboard)' : '';
    spinner.succeed(
      `Packed ${result.totalIssues} issues and ${result.totalPRs} PRs${copyNote}`,
    );
    printReport(result, quiet);
  } catch (err) {
    const message = err instanceof RepissueError
      ? err.message
      : err instanceof Error
        ? err.message
        : String(err);

    spinner.fail(message);
    process.exit(1);
  }
};