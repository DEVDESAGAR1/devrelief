/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { WorkflowDefinition, WorkflowResult, InputValidationError, WorkflowMetadata } from '../../../types/workflow.ts';
import { SpecTestScenariosInput, SpecTestScenariosPayload } from './types.ts';
import { SpecTestSynthesizer } from './synthesizer.ts';
import { WORKFLOW_CATALOGUE } from '../../../engine/registry.ts';

export class SpecTestScenariosWorkflow implements WorkflowDefinition<SpecTestScenariosInput, SpecTestScenariosPayload> {
  public metadata: WorkflowMetadata;

  constructor() {
    const meta = WORKFLOW_CATALOGUE.find((w) => w.id === 'WF-QA-01');
    if (!meta) {
      throw new Error('WF-QA-01 metadata missing from catalogue');
    }
    this.metadata = meta;
  }

  public validateInput(input: SpecTestScenariosInput): InputValidationError[] {
    return SpecTestSynthesizer.validate(input);
  }

  public async execute(input: SpecTestScenariosInput): Promise<WorkflowResult<SpecTestScenariosPayload>> {
    const payload = SpecTestSynthesizer.synthesize(input);
    const sourceReferences = payload.testCases.flatMap((tc) => tc.sourceReferences);

    return {
      workflowId: 'WF-QA-01',
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
