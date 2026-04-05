import pc from 'picocolors';

export const logger = {
  error: (...args: unknown[]) => console.error(pc.red(String(args[0]))),
  warn: (...args: unknown[]) => console.warn(pc.yellow(String(args[0]))),
  info: (...args: unknown[]) => console.log(pc.cyan(String(args[0]))),
  log: (...args: unknown[]) => console.log(String(args[0])),
  debug: (..._args: unknown[]) => {},
};
