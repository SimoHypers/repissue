import Handlebars from 'handlebars';
import { markdownTemplate } from './outputStyles/markdownStyle.js';
import { plainTemplate } from './outputStyles/plainStyle.js';
import { xmlTemplate } from './outputStyles/xmlStyle.js';
import { registerHelpers } from './outputStyleUtils.js';
import type { OutputContext } from './outputGeneratorTypes.js';
import type { OutputConfig } from '../../config/configSchema.js';

const TEMPLATE_MAP: Record<OutputConfig['style'], string> = {
  markdown: markdownTemplate,
  plain: plainTemplate,
  xml: xmlTemplate,
};

export const generateOutput = (context: OutputContext): string => {
  registerHelpers();

  const style = context.config.output.style;
  const templateSource = TEMPLATE_MAP[style];
  const template = Handlebars.compile(templateSource, { noEscape: true });

  const templateData = {
    repo: context.repo,
    generatedAt: context.generatedAt,
    issues: context.issues,
    prs: context.prs,
    issueCount: context.issues.length,
    prCount: context.prs.length,
    fileSummary: context.config.output.fileSummary,
    headerText: context.config.output.headerText,
  };

  return template(templateData);
};