/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { WorkflowDefinition, WorkflowResult, InputValidationError, WorkflowMetadata } from '../../../types/workflow.ts';
import { RetroThematicClusterInput, RetroThematicClusterPayload } from './types.ts';
import { RetroThematicClusterer } from './clusterer.ts';
import { WORKFLOW_CATALOGUE } from '../../../engine/registry.ts';

export class RetroThematicClusterWorkflow implements WorkflowDefinition<RetroThematicClusterInput, RetroThematicClusterPayload> {
  public metadata: WorkflowMetadata;

  constructor() {
    const meta = WORKFLOW_CATALOGUE.find((w) => w.id === 'WF-SM-02');
    if (!meta) {
      throw new Error('WF-SM-02 metadata missing from catalogue');
    }
    this.metadata = meta;
  }

  public validateInput(input: RetroThematicClusterInput): InputValidationError[] {
    return RetroThematicClusterer.validate(input);
  }

  public async execute(input: RetroThematicClusterInput): Promise<WorkflowResult<RetroThematicClusterPayload>> {
    const payload = RetroThematicClusterer.cluster(input);
    const sourceReferences = [
      ...payload.themes.flatMap((t) => t.observations.flatMap((o) => o.sourceReferences)),
      ...payload.unclusteredObservations.flatMap((o) => o.sourceReferences),
    ];

    return {
      workflowId: 'WF-SM-02',
      workflowName: this.metadata.name,
      executedAt: new Date().toISOString(),
      durationMs: 0,
      isDeterministic: true,
      epistemicRating: 'inference',
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
