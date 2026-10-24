/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { WorkflowDefinition, WorkflowResult, InputValidationError, WorkflowMetadata } from '../../../types/workflow.ts';
import { GitDigestInput, GitDigestPayload } from './types.ts';
import { GitLogParser } from './parser.ts';
import { WORKFLOW_CATALOGUE } from '../../../engine/registry.ts';

export class GitDailyDigestWorkflow implements WorkflowDefinition<GitDigestInput, GitDigestPayload> {
  public metadata: WorkflowMetadata;

  constructor() {
    const meta = WORKFLOW_CATALOGUE.find((w) => w.id === 'WF-DEV-01');
    if (!meta) {
      throw new Error('WF-DEV-01 metadata missing from catalogue');
    }
    this.metadata = meta;
  }

  public validateInput(input: GitDigestInput): InputValidationError[] {
    if (!input || typeof input !== 'object') {
      return [{ field: 'input', message: 'Input must be a valid object containing rawLog text.' }];
    }
    return GitLogParser.validate(input.rawLog);
  }

  public async execute(input: GitDigestInput): Promise<WorkflowResult<GitDigestPayload>> {
    const sourceName = input.sourceName || 'pasted_git_log';
    const payload = GitLogParser.parse(input.rawLog, sourceName);
    const markdown = GitLogParser.generateMarkdown(payload, sourceName);

    const sourceReferences = payload.uniqueCommits.map((c) => c.sourceReference);

    return {
      workflowId: 'WF-DEV-01',
      workflowName: this.metadata.name,
      executedAt: new Date().toISOString(),
      durationMs: 0, // Engine will compute exact performance duration
      isDeterministic: true,
      epistemicRating: 'confirmed_fact',
      payload,
      markdown,
      sourceReferences,
      disclaimers: [
        this.metadata.disclaimer,
        'Commit hashes, authors, dates, and subjects are confirmed facts. Categorization is an inference based on commit subject prefixes.',
      ],
    };
  }
}
