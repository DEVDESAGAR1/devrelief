/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { WorkflowDefinition, WorkflowResult, InputValidationError, WorkflowMetadata } from '../../../types/workflow.ts';
import { StoriesGherkinInput, StoriesGherkinPayload } from './types.ts';
import { StoriesGherkinParser } from './parser.ts';
import { WORKFLOW_CATALOGUE } from '../../../engine/registry.ts';

export class StoriesGherkinWorkflow implements WorkflowDefinition<StoriesGherkinInput, StoriesGherkinPayload> {
  public metadata: WorkflowMetadata;

  constructor() {
    const meta = WORKFLOW_CATALOGUE.find((w) => w.id === 'WF-PO-01');
    if (!meta) {
      throw new Error('WF-PO-01 metadata missing from catalogue');
    }
    this.metadata = meta;
  }

  public validateInput(input: StoriesGherkinInput): InputValidationError[] {
    return StoriesGherkinParser.validate(input);
  }

  public async execute(input: StoriesGherkinInput): Promise<WorkflowResult<StoriesGherkinPayload>> {
    const payload = StoriesGherkinParser.parse(input);

    const allSourceRefs = payload.stories.flatMap((s) => s.sourceReferences);

    return {
      workflowId: 'WF-PO-01',
      workflowName: this.metadata.name,
      executedAt: new Date().toISOString(),
      durationMs: 0,
      isDeterministic: true,
      epistemicRating: 'inference',
      payload,
      markdown: payload.markdown,
      sourceReferences: allSourceRefs,
      disclaimers: [
        this.metadata.disclaimer,
        payload.humanReviewNotice,
      ],
    };
  }
}
