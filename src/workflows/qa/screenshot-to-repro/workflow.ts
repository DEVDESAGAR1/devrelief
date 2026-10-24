/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { WorkflowDefinition, WorkflowResult, InputValidationError, WorkflowMetadata } from '../../../types/workflow.ts';
import { ScreenshotToReproInput, ScreenshotToReproPayload } from './types.ts';
import { BugReproFormatter } from './formatter.ts';
import { WORKFLOW_CATALOGUE } from '../../../engine/registry.ts';

export class ScreenshotToReproWorkflow implements WorkflowDefinition<ScreenshotToReproInput, ScreenshotToReproPayload> {
  public metadata: WorkflowMetadata;

  constructor() {
    const meta = WORKFLOW_CATALOGUE.find((w) => w.id === 'WF-QA-02');
    if (!meta) {
      throw new Error('WF-QA-02 metadata missing from catalogue');
    }
    this.metadata = meta;
  }

  public validateInput(input: ScreenshotToReproInput): InputValidationError[] {
    return BugReproFormatter.validate(input);
  }

  public async execute(input: ScreenshotToReproInput): Promise<WorkflowResult<ScreenshotToReproPayload>> {
    const payload = BugReproFormatter.format(input);

    return {
      workflowId: 'WF-QA-02',
      workflowName: this.metadata.name,
      executedAt: new Date().toISOString(),
      durationMs: 0,
      isDeterministic: true,
      epistemicRating: 'confirmed_fact',
      payload,
      markdown: payload.markdown,
      sourceReferences: payload.ticket.sourceReferences,
      disclaimers: [
        this.metadata.disclaimer,
        payload.humanReviewNotice,
      ],
    };
  }
}
