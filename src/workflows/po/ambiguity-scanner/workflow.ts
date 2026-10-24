/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { WorkflowDefinition, WorkflowResult, InputValidationError, WorkflowMetadata } from '../../../types/workflow.ts';
import { AmbiguityScannerInput, AmbiguityScannerPayload } from './types.ts';
import { AmbiguityScanner } from './scanner.ts';
import { WORKFLOW_CATALOGUE } from '../../../engine/registry.ts';

export class AmbiguityScannerWorkflow implements WorkflowDefinition<AmbiguityScannerInput, AmbiguityScannerPayload> {
  public metadata: WorkflowMetadata;

  constructor() {
    const meta = WORKFLOW_CATALOGUE.find((w) => w.id === 'WF-PO-02');
    if (!meta) {
      throw new Error('WF-PO-02 metadata missing from catalogue');
    }
    this.metadata = meta;
  }

  public validateInput(input: AmbiguityScannerInput): InputValidationError[] {
    return AmbiguityScanner.validate(input);
  }

  public async execute(input: AmbiguityScannerInput): Promise<WorkflowResult<AmbiguityScannerPayload>> {
    const payload = AmbiguityScanner.scan(input);
    const sourceReferences = payload.findings.flatMap((f) => f.sourceReferences);

    return {
      workflowId: 'WF-PO-02',
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
        payload.disclaimer,
      ],
    };
  }
}
