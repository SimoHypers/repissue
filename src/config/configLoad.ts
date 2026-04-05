import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { CliOptions } from '../cli/types.js';
import { repissueConfigFileSchema, repissueConfigMergedSchema } from './configSchema.js';
import type { RepissueConfigMerged } from './configSchema.js';
import { defaultConfig } from './defaultConfig.js';
import { RepissueError, rethrowValidationErrorIfZodError } from '../shared/errorHandle.js';

const CONFIG_FILE_NAME = 'repissue.config.json';

const loadFileConfig = async (configPath?: string): Promise<Partial<RepissueConfigMerged>> => {
  const filePath = configPath ?? path.resolve(process.cwd(), CONFIG_FILE_NAME);

  if (!existsSync(filePath)) {
    return {};
  }

  let raw: string;
  try {
    raw = await readFile(filePath, 'utf-8');
  } catch (err) {
    throw new RepissueError(`Failed to read config file: ${filePath}`, { cause: err });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new RepissueError(`Config file is not valid JSON: ${filePath}`, { cause: err });
  }

  try {
    const validated = repissueConfigFileSchema.parse(parsed);
    return {
      output: { ...defaultConfig.output, ...validated.output },
      github: { ...defaultConfig.github, ...validated.github },
      security: { ...defaultConfig.security, ...validated.security },
    };
  } catch (err) {
    rethrowValidationErrorIfZodError(err, `Invalid config file: ${filePath}`);
    throw err;
  }
};

/**
 * Parse a comma-separated label priority string into a trimmed string array.
 * Empty segments (e.g. trailing commas) are dropped.
 *
 * @example parseLabelPriority("bug,security, P0") // => ['bug', 'security', 'P0']
 */
const parseLabelPriority = (raw: string): string[] =>
  raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

const STYLE_EXTENSIONS: Record<string, string> = {
  markdown: '.md',
  plain: '.txt',
  xml: '.xml',
};

/**
 * Ensure the output file extension matches the chosen style, but ONLY when
 * the user did not explicitly provide --output. If they passed --output
 * themselves we leave their path untouched.
 *
 * Examples (no explicit --output flag):
 *   style=xml,      filePath="repissue-output.md"  => "repissue-output.xml"
 *   style=plain,    filePath="repissue-output.md"  => "repissue-output.txt"
 *   style=markdown, filePath="repissue-output.md"  => unchanged
 */
const resolveFilePath = (
  filePath: string,
  style: string,
  outputExplicit: boolean,
): string => {
  if (outputExplicit) return filePath;
  const targetExt = STYLE_EXTENSIONS[style];
  if (targetExt === undefined) return filePath;
  const currentExt = path.extname(filePath);
  if (currentExt === targetExt) return filePath;
  return filePath.slice(0, filePath.length - currentExt.length) + targetExt;
};

// CLI flags override file config — only defined flags win
const applyCliOverrides = (
  base: RepissueConfigMerged,
  cli: CliOptions,
): RepissueConfigMerged => ({
  output: {
    ...base.output,
    ...(cli.output !== undefined && { filePath: cli.output }),
    ...(cli.style !== undefined && { style: cli.style }),
    ...(cli.headerText !== undefined && { headerText: cli.headerText }),
  },
  github: {
    ...base.github,
    ...(cli.token !== undefined && { token: cli.token }),
    ...(cli.issues === false && { includeIssues: false }),
    ...(cli.prs === false && { includePRs: false }),
    ...(cli.includeMergedDays !== undefined && { includeMergedDays: cli.includeMergedDays }),
    ...(cli.includeClosedDays !== undefined && { includeClosedDays: cli.includeClosedDays }),
    ...(cli.labelPriority !== undefined && {
      labelPriority: parseLabelPriority(cli.labelPriority),
    }),
    ...(cli.maxComments !== undefined && { maxCommentsPerItem: cli.maxComments }),
    ...(cli.bots === false && { ignoreBots: true }),
  },
  security: {
    ...base.security,
    ...(cli.securityCheck === true && { enableCheck: true }),
  },
});

export const loadConfig = async (
  cli: CliOptions,
): Promise<RepissueConfigMerged> => {
  const fileConfig = await loadFileConfig(cli.config);
  const merged = { ...defaultConfig, ...fileConfig };

  const withCli = applyCliOverrides(merged, cli);

  // Fix up the file extension to match the resolved style, unless the user
  // explicitly chose their own output path via --output.
  const outputExplicit = cli.output !== undefined;
  const resolvedFilePath = resolveFilePath(
    withCli.output.filePath,
    withCli.output.style,
    outputExplicit,
  );

  const withResolvedPath: RepissueConfigMerged = {
    ...withCli,
    output: { ...withCli.output, filePath: resolvedFilePath },
  };

  try {
    return repissueConfigMergedSchema.parse(withResolvedPath);
  } catch (err) {
    rethrowValidationErrorIfZodError(err, 'Invalid merged configuration');
    throw err;
  }
};