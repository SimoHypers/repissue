import { spawn } from 'node:child_process';

/**
 * Cross-platform clipboard write using native OS utilities.
 *
 * Platform detection:
 *   macOS   → pbcopy
 *   Windows → clip.exe
 *   Linux   → xclip (primary) → xsel (fallback)
 *
 * No external npm dependencies — just spawns the OS-provided tool and pipes
 * the content to its stdin. Rejects with a ClipboardError on failure so
 * callers can warn without crashing the process.
 */

export class ClipboardError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ClipboardError';
  }
}

type ClipboardCommand = { cmd: string; args: string[] };

/**
 * Resolve which clipboard command to use for the current platform.
 * Returns null when no supported tool can be determined (e.g. unknown Linux
 * without xclip/xsel).
 */
export const resolveClipboardCommand = (
  platform: NodeJS.Platform = process.platform,
): ClipboardCommand | null => {
  switch (platform) {
    case 'darwin':
      return { cmd: 'pbcopy', args: [] };
    case 'win32':
      return { cmd: 'clip', args: [] };
    case 'linux':
      // xclip is more widely available; xsel is the fallback.
      // We return xclip here — the actual Linux fallback logic is handled
      // inside copyToClipboard() by retrying with xsel on spawn error.
      return { cmd: 'xclip', args: ['-selection', 'clipboard'] };
    default:
      return null;
  }
};

/**
 * Write `text` to the system clipboard.
 *
 * Rejects with ClipboardError when:
 * - The platform has no supported clipboard tool
 * - The tool exits with a non-zero code
 * - The tool cannot be found (ENOENT) and no fallback is available
 */
export const copyToClipboard = (text: string): Promise<void> => {
  const primary = resolveClipboardCommand();

  if (primary === null) {
    return Promise.reject(
      new ClipboardError(
        `Clipboard copy is not supported on platform "${process.platform}". ` +
        'The output file has been written successfully.',
      ),
    );
  }

  return spawnClipboard(text, primary).catch((err) => {
    // Linux-only fallback: if xclip is not installed, try xsel
    if (process.platform === 'linux' && primary.cmd === 'xclip') {
      const fallback: ClipboardCommand = { cmd: 'xsel', args: ['--clipboard', '--input'] };
      return spawnClipboard(text, fallback).catch(() => {
        // Both tools failed — surface a helpful error
        throw new ClipboardError(
          'Could not copy to clipboard. Install xclip or xsel: ' +
          'sudo apt install xclip  OR  sudo apt install xsel',
          { cause: err },
        );
      });
    }
    throw err;
  });
};

/**
 * Spawn a clipboard command and pipe text to its stdin.
 * Resolves when the process exits with code 0.
 * Rejects with ClipboardError otherwise.
 */
const spawnClipboard = (text: string, { cmd, args }: ClipboardCommand): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['pipe', 'ignore', 'ignore'] });

    child.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'ENOENT') {
        reject(new ClipboardError(`Clipboard tool not found: "${cmd}"`, { cause: err }));
      } else {
        reject(new ClipboardError(`Clipboard error: ${err.message}`, { cause: err }));
      }
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new ClipboardError(`Clipboard tool "${cmd}" exited with code ${code}`));
      }
    });

    child.stdin.write(text, 'utf-8');
    child.stdin.end();
  });