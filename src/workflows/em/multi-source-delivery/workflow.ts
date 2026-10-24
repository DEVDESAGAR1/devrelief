/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { WorkflowDefinition, WorkflowResult, InputValidationError, WorkflowMetadata } from '../../../types/workflow.ts';
import { MultiSourceDeliveryInput, MultiSourceDeliveryPayload } from './types.ts';
import { MultiSourceAggregator } from './aggregator.ts';
import { WORKFLOW_CATALOGUE } from '../../../engine/registry.ts';

export class MultiSourceDeliveryWorkflow implements WorkflowDefinition<MultiSourceDeliveryInput, MultiSourceDeliveryPayload> {
  public metadata: WorkflowMetadata;

  constructor() {
    const meta = WORKFLOW_CATALOGUE.find((w) => w.id === 'WF-EM-01');
    if (!meta) {
      throw new Error('WF-EM-01 metadata missing from catalogue');
    }
    this.metadata = meta;
  }

  public validateInput(input: MultiSourceDeliveryInput): InputValidationError[] {
    return MultiSourceAggregator.validate(input);
  }

  public async execute(input: MultiSourceDeliveryInput): Promise<WorkflowResult<MultiSourceDeliveryPayload>> {
    const payload = MultiSourceAggregator.aggregate(input);
    const sourceReferences = payload.blockerMatrix.flatMap((b) => b.sourceReferences);

    return {
      workflowId: 'WF-EM-01',
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
