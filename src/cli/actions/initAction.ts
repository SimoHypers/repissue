import { writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { logger } from '../../shared/logger.js';
import { RepissueError } from '../../shared/errorHandle.js';

const CONFIG_FILE_NAME = 'repissue.config.json';

/**
 * The starter config written by --init.
 * All values are the defaults — users uncomment / change what they need.
 * Comments are not valid JSON so we use a verbose structure with obvious placeholders.
 */
const STARTER_CONFIG = {
  output: {
    filePath: 'repissue-output.md',
    style: 'markdown',
    fileSummary: true,
  },
  github: {
    includeIssues: true,
    includePRs: true,
    labelPriority: ['bug', 'security', 'P0'],
    ignoreBots: true,
    knownBots: ['dependabot[bot]', 'renovate[bot]', 'github-actions[bot]'],
    maxCommentsPerItem: 50,
  },
  security: {
    enableCheck: false,
  },
};

export const initAction = async (outputDir = process.cwd()): Promise<void> => {
  const filePath = path.resolve(outputDir, CONFIG_FILE_NAME);

  if (existsSync(filePath)) {
    throw new RepissueError(
      `${CONFIG_FILE_NAME} already exists at ${filePath}. Remove it first if you want to regenerate it.`,
    );
  }

  const content = JSON.stringify(STARTER_CONFIG, null, 2) + '\n';

  try {
    await writeFile(filePath, content, 'utf-8');
  } catch (err) {
    throw new RepissueError(`Failed to write ${CONFIG_FILE_NAME}: ${filePath}`, { cause: err });
  }

  logger.log(`✓ Created ${filePath}`);
  logger.log('');
  logger.log('Edit the file to customise your repissue settings, then run:');
  logger.log('');
  logger.log('  repissue owner/repo');
  logger.log('');
};