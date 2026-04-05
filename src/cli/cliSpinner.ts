import { Spinner as PicoSpinner } from 'picospinner';
import pc from 'picocolors';
import { logger } from '../shared/logger.js';

/**
 * The public interface returned by createCliSpinner.
 * Callers only care about these three methods — the underlying
 * implementation (picospinner vs plain logger) is an internal detail.
 */
export interface Spinner {
  update: (message: string) => void;
  succeed: (message: string) => void;
  fail: (message: string) => void;
}

/**
 * Create a CLI spinner appropriate for the current environment.
 *
 * - TTY (interactive terminal): uses picospinner for an animated spinner that
 *   updates in-place. Progress messages via update() replace the spinner text
 *   so the terminal stays clean.
 * - Non-TTY (CI, pipes, stdout redirects): falls back to plain logger.log()
 *   calls so output is line-buffered and safe for log collectors.
 *
 * The isTTY parameter is injectable for unit tests — never override it in
 * production call sites.
 */
export const createCliSpinner = (initialMessage: string, isTTY = process.stdout.isTTY): Spinner => {
  if (isTTY) {
    const spinner = new PicoSpinner(initialMessage);
    spinner.start();

    return {
      update: (message: string) => {
        spinner.setText(message);
      },
      succeed: (message: string) => {
        spinner.succeed({ text: pc.green(message) });
      },
      fail: (message: string) => {
        spinner.fail({ text: pc.red(message) });
      },
    };
  }

  // Non-TTY fallback: plain line-by-line output, safe for CI and pipes.
  logger.log(initialMessage);
  return {
    update: (message: string) => { logger.log(message); },
    succeed: (message: string) => { logger.log(`✓ ${message}`); },
    fail: (message: string) => { logger.error(`✗ ${message}`); },
  };
};