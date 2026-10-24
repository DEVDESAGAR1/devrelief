/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { WorkflowDefinition, WorkflowResult, InputValidationError, WorkflowMetadata } from '../../../types/workflow.ts';
import { CiTriageInput, CiTriagePayload } from './types.ts';
import { CiLogAnalyzer } from './analyzer.ts';
import { WORKFLOW_CATALOGUE } from '../../../engine/registry.ts';

export class CiFailureTriageWorkflow implements WorkflowDefinition<CiTriageInput, CiTriagePayload> {
  public metadata: WorkflowMetadata;

  constructor() {
    const meta = WORKFLOW_CATALOGUE.find((w) => w.id === 'WF-DEV-03');
    if (!meta) {
      throw new Error('WF-DEV-03 metadata missing from catalogue');
    }
    this.metadata = meta;
  }

  public validateInput(input: CiTriageInput): InputValidationError[] {
    return CiLogAnalyzer.validate(input);
  }

  public async execute(input: CiTriageInput): Promise<WorkflowResult<CiTriagePayload>> {
    const analysis = CiLogAnalyzer.analyze(input);

    return {
      workflowId: 'WF-DEV-03',
      workflowName: this.metadata.name,
      executedAt: new Date().toISOString(),
      durationMs: 0,
      isDeterministic: true,
      epistemicRating: analysis.payload.firstMeaningfulError ? 'confirmed_fact' : 'unknown',
      payload: analysis.payload,
      markdown: analysis.markdown,
      sourceReferences: analysis.sourceReferences,
      disclaimers: [
        this.metadata.disclaimer,
        'Root-cause explanations are hypotheses derived from log pattern matching. No external commands are executed automatically.',
      ],
    };
  }
}
