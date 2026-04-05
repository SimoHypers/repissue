import type { OptionValues } from 'commander';

export interface CliOptions extends OptionValues {
  output?: string;
  style?: 'markdown' | 'plain' | 'xml';
  token?: string;
  issues?: boolean;
  prs?: boolean;
  includeMergedDays?: number;
  includeClosedDays?: number;
  /**
   * Comma-separated list of label names to prioritise, e.g. "bug,security,P0".
   * Parsed into an array before being passed to the config layer.
   */
  labelPriority?: string;
  maxComments?: number;
  bots?: boolean;
  stdout?: boolean;
  appendTo?: string;
  /**
   * Maximum byte size per output file when splitting.
   * Parsed from the raw CLI string via parseInt in cliRun.ts.
   */
  splitOutput?: number;
  securityCheck?: boolean;
  copy?: boolean;
  headerText?: string;
  config?: string;
  init?: boolean;
  verbose?: boolean;
  quiet?: boolean;
}