/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { WorkflowDefinition, WorkflowResult, InputValidationError, WorkflowMetadata } from '../../../types/workflow.ts';
import { ActionItemMatrixInput, ActionItemMatrixPayload } from './types.ts';
import { ActionItemExtractor } from './extractor.ts';
import { WORKFLOW_CATALOGUE } from '../../../engine/registry.ts';

export class ActionItemMatrixWorkflow implements WorkflowDefinition<ActionItemMatrixInput, ActionItemMatrixPayload> {
  public metadata: WorkflowMetadata;

  constructor() {
    const meta = WORKFLOW_CATALOGUE.find((w) => w.id === 'WF-SM-01');
    if (!meta) {
      throw new Error('WF-SM-01 metadata missing from catalogue');
    }
    this.metadata = meta;
  }

  public validateInput(input: ActionItemMatrixInput): InputValidationError[] {
    return ActionItemExtractor.validate(input);
  }

  public async execute(input: ActionItemMatrixInput): Promise<WorkflowResult<ActionItemMatrixPayload>> {
    const payload = ActionItemExtractor.extract(input);
    const sourceReferences = payload.actions.flatMap((a) => a.sourceReferences);

    return {
      workflowId: 'WF-SM-01',
      workflowName: this.metadata.name,
      executedAt: new Date().toISOString(),
      durationMs: 0,
      isDeterministic: true,
      epistemicRating: 'confirmed_fact',
      payload,
      markdown: payload.markdown,
      sourceReferences,
      disclaimers: [
        this.metadata.disclaimer,
        payload.humanReviewNotice,
      ],
    };
  }
}
