import pc from 'picocolors';
import { logger } from '../shared/logger.js';
import type { PackResult } from '../core/packager.js';

export const printReport = (result: PackResult, quiet: boolean): void => {
  if (quiet) return;

  const { totalIssues, totalPRs, totalTokens, outputFiles } = result;

  logger.log('');
  logger.log(pc.bold('repissue — done!'));
  logger.log('');
  logger.log(`  ${pc.cyan('Issues:')}  ${totalIssues}`);
  logger.log(`  ${pc.cyan('PRs:')}     ${totalPRs}`);
  logger.log(`  ${pc.cyan('Tokens:')}  ~${totalTokens.toLocaleString()}`);

  if (outputFiles.length > 0) {
    logger.log('');
    for (const file of outputFiles) {
      logger.log(`  ${pc.green('→')} ${file}`);
    }
  }

  logger.log('');
};