import { writeFile } from 'node:fs/promises';
import { fetchIssues } from './github/issueFetch.js';
import { fetchPRs } from './github/prFetch.js';
import { fetchComments } from './github/commentsFetch.js';
import { filterComments, filterIssues, filterPRs } from '../core/filter/noiseFilter.js';
import { sortIssuesByPriority, sortPRsByPriority } from '../core/filter/labelSort.js';
import { parseCrossRefsFromThread } from '../core/github/crossRefParse.js';
import { generateOutput } from '../core/output/outputGenerate.js';
import { splitIntoChunks, writeSplitFiles } from '../core/output/splitOutput.js';
import { calculateMetrics } from './metrics/calculateMetrics.js';
import { scanForSecrets, formatScanWarning } from '../core/security/securityScan.js';
import { copyToClipboard, ClipboardError } from '../core/clipboard/clipboardCopy.js';
import { logger } from '../shared/logger.js';
import type { EnrichedIssue, EnrichedPR, OutputContext } from '../core/output/outputGeneratorTypes.js';
import type { RepissueConfigMerged } from '../config/configSchema.js';
import type { ProgressCallback } from '../shared/types.js';
import type { ScanHit } from '../core/security/securityScan.js';

export interface PackOptions {
  repo: string;
  config: RepissueConfigMerged;
  progressCallback?: ProgressCallback;
  /**
   * When set, output is split into multiple files if it exceeds this many bytes.
   * Each file is written as basePath-N.ext. If the output fits in one file,
   * the normal basePath is used with no numbered suffix.
   */
  splitOutputBytes?: number;
  /** When true, copy the rendered output to the system clipboard after writing. */
  copy?: boolean;
}

export interface PackResult {
  totalIssues: number;
  totalPRs: number;
  /** Exact token count via tiktoken cl100k_base (falls back to chars/4 estimate on error) */
  totalTokens: number;
  outputFiles: string[];
  /** The rendered output string (always present; written to disk unless --stdout or --append-to) */
  output: string;
  /**
   * The OutputContext used to generate this result.
   * Exposed so callers (e.g. --append-to) can re-render a subset of the output
   * without re-fetching data from GitHub.
   */
  appendContext: OutputContext;
  /** Secrets found by the security scanner. Empty when enableCheck is false. */
  scanHits: ScanHit[];
  /** Whether the output was successfully copied to the clipboard. */
  copiedToClipboard: boolean;
}

export const pack = async (options: PackOptions): Promise<PackResult> => {
  const { repo, config, progressCallback = () => {}, splitOutputBytes, copy = false } = options;
  const { includeIssues, includePRs, labelPriority } = config.github;

  // ── Stage 1: FETCH ────────────────────────────────────────────────────────

  progressCallback('Fetching issues and PRs…');

  const [rawIssues, rawPRs] = await Promise.all([
    includeIssues ? fetchIssues(repo, config, progressCallback) : Promise.resolve([]),
    includePRs ? fetchPRs(repo, config, progressCallback) : Promise.resolve([]),
  ]);

  progressCallback(`Fetched ${rawIssues.length} issues and ${rawPRs.length} PRs`);

  const allNumbers = [
    ...rawIssues.map((i) => i.number),
    ...rawPRs.map((p) => p.number),
  ];

  progressCallback(`Fetching comments for ${allNumbers.length} items…`);
  const commentsMap = allNumbers.length > 0
    ? await fetchComments(repo, allNumbers, config, progressCallback)
    : new Map<number, never[]>();

  // ── Stage 2: FILTER ───────────────────────────────────────────────────────

  progressCallback('Filtering noise…');

  const filteredIssues = filterIssues(rawIssues, config);
  const filteredPRs = filterPRs(rawPRs, config);

  // ── Stage 3: SORT BY PRIORITY ─────────────────────────────────────────────

  const sortedIssues = sortIssuesByPriority(filteredIssues, labelPriority);
  const sortedPRs = sortPRsByPriority(filteredPRs, labelPriority);

  // ── Stage 4: ENRICH (comments + cross-refs) ───────────────────────────────

  progressCallback('Enriching with comments and cross-references…');

  const enrichedIssues: EnrichedIssue[] = sortedIssues.map((issue) => {
    const rawComments = commentsMap.get(issue.number) ?? [];
    const filtered = filterComments(rawComments, config);
    const crossRefs = parseCrossRefsFromThread(
      issue.body,
      filtered.map((c) => c.body),
    );
    return {
      issue,
      comments: filtered,
      filteredCommentCount: rawComments.length - filtered.length,
      crossRefs,
    };
  });

  const enrichedPRs: EnrichedPR[] = sortedPRs.map((pr) => {
    const rawComments = commentsMap.get(pr.number) ?? [];
    const filtered = filterComments(rawComments, config);
    const crossRefs = parseCrossRefsFromThread(
      pr.body,
      filtered.map((c) => c.body),
    );
    return {
      pr,
      comments: filtered,
      filteredCommentCount: rawComments.length - filtered.length,
      crossRefs,
    };
  });

  // ── Stage 5: GENERATE OUTPUT ──────────────────────────────────────────────

  progressCallback('Generating output…');

  const outputContext: OutputContext = {
    repo,
    generatedAt: new Date().toISOString(),
    issues: enrichedIssues,
    prs: enrichedPRs,
    config,
  };

  const output = generateOutput(outputContext);

  // ── Stage 6: WRITE ────────────────────────────────────────────────────────

  const outputFiles: string[] = [];

  if (!config.output.filePath) {
    // stdout or append-to mode — caller is responsible for the final write
  } else if (splitOutputBytes !== undefined) {
    progressCallback('Splitting output into files…');
    const chunks = splitIntoChunks(outputContext, splitOutputBytes);
    const written = await writeSplitFiles(config.output.filePath, chunks);
    outputFiles.push(...written);
    progressCallback(
      chunks.length === 1
        ? `Written to ${written[0]}`
        : `Written ${chunks.length} files (${written[0]} … ${written[written.length - 1]})`,
    );
  } else {
    await writeFile(config.output.filePath, output, 'utf-8');
    outputFiles.push(config.output.filePath);
    progressCallback(`Written to ${config.output.filePath}`);
  }

  // ── Stage 7: METRICS ──────────────────────────────────────────────────────

  progressCallback('Counting tokens…');
  const { totalTokens } = await calculateMetrics(output);

  // ── Stage 8: SECURITY SCAN ────────────────────────────────────────────────

  let scanHits: ScanHit[] = [];

  if (config.security.enableCheck) {
    progressCallback('Scanning for secrets…');
    scanHits = scanForSecrets(output);
    const warning = formatScanWarning(scanHits);
    if (warning !== null) {
      logger.warn(warning);
    }
  }

  // ── Stage 9: CLIPBOARD COPY ───────────────────────────────────────────────

  let copiedToClipboard = false;

  if (copy) {
    if (splitOutputBytes !== undefined && outputFiles.length > 1) {
      // Cannot copy multiple split files to clipboard — warn and skip
      logger.warn(
        '⚠  --copy is not supported when output is split into multiple files.\n' +
        '   Copy the individual files manually if needed.',
      );
    } else {
      progressCallback('Copying to clipboard…');
      try {
        await copyToClipboard(output);
        copiedToClipboard = true;
      } catch (err) {
        const message = err instanceof ClipboardError
          ? err.message
          : err instanceof Error
            ? err.message
            : String(err);
        logger.warn(`⚠  Could not copy to clipboard: ${message}`);
      }
    }
  }

  return {
    totalIssues: enrichedIssues.length,
    totalPRs: enrichedPRs.length,
    totalTokens,
    outputFiles,
    output,
    appendContext: outputContext,
    scanHits,
    copiedToClipboard,
  };
};