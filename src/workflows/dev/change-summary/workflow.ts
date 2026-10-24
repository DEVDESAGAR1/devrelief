/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { WorkflowDefinition, WorkflowResult, InputValidationError, WorkflowMetadata } from '../../../types/workflow.ts';
import { ChangeSummaryInput, ChangeSummaryPayload } from './types.ts';
import { ChangeSummaryParser } from './parser.ts';
import { WORKFLOW_CATALOGUE } from '../../../engine/registry.ts';

export class ChangeSummaryWorkflow implements WorkflowDefinition<ChangeSummaryInput, ChangeSummaryPayload> {
  public metadata: WorkflowMetadata;

  constructor() {
    const meta = WORKFLOW_CATALOGUE.find((w) => w.id === 'WF-DEV-02');
    if (!meta) {
      throw new Error('WF-DEV-02 metadata missing from catalogue');
    }
    this.metadata = meta;
  }

  public validateInput(input: ChangeSummaryInput): InputValidationError[] {
    return ChangeSummaryParser.validate(input);
  }

  public async execute(input: ChangeSummaryInput): Promise<WorkflowResult<ChangeSummaryPayload>> {
    const payload = ChangeSummaryParser.parse(input);
    const sourceName = input.sourceName || 'diff_evidence.diff';

    const sourceReferences = payload.fileChanges.map((fc) => ({
      source: sourceName,
      lineStart: fc.hunks[0]?.newStart || 1,
      lineEnd: fc.hunks[0]?.newStart ? fc.hunks[0].newStart + (fc.hunks[0].newLines || 1) : 1,
      rawSnippet: `File: ${fc.filePath} (+${fc.additions}/-${fc.deletions})`,
    }));

    return {
      workflowId: 'WF-DEV-02',
      workflowName: this.metadata.name,
      executedAt: new Date().toISOString(),
      durationMs: 0,
      isDeterministic: true,
      epistemicRating: 'confirmed_fact',
      payload,
      markdown: payload.draftReleaseNotes,
      sourceReferences,
      disclaimers: [
        this.metadata.disclaimer,
        'Draft release notes are generated from syntactic diff metadata and commit hunks; human engineering review is required before publication.',
      ],
    };
  }
}
