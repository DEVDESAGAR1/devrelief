/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 5 Delivery Roles supported across DevRelief
 */
export type Role =
  | 'developer'
  | 'product_owner'
  | 'scrum_master'
  | 'qa_engineer'
  | 'engineering_manager';

export interface RoleDefinition {
  id: Role;
  name: string;
  shortLabel: string;
  description: string;
  targetFocus: string;
}

export const ROLE_DEFINITIONS: Record<Role, RoleDefinition> = {
  developer: {
    id: 'developer',
    name: 'Software Developer',
    shortLabel: 'Dev',
    description: 'Code changes, Git history, CI/CD failure diagnostics, and release documentation.',
    targetFocus: 'Git commit analysis, CI/CD log diagnostics, release note generation.',
  },
  product_owner: {
    id: 'product_owner',
    name: 'Product Owner',
    shortLabel: 'PO',
    description: 'User story authoring, Gherkin acceptance criteria, and ambiguity scanning.',
    targetFocus: 'Requirements structure, acceptance criteria synthesis, ambiguity detection.',
  },
  scrum_master: {
    id: 'scrum_master',
    name: 'Scrum Master',
    shortLabel: 'SM',
    description: 'Meeting notes to action item extraction, sprint summaries, and blocker tracking.',
    targetFocus: 'Action item matrix, retro clustering, cross-team blocker tracking.',
  },
  qa_engineer: {
    id: 'qa_engineer',
    name: 'QA Engineer',
    shortLabel: 'QA',
    description: 'Test scenario generation, bug reproduction steps, and AC coverage analysis.',
    targetFocus: 'Test matrices, bug repro formatting, criteria coverage checks.',
  },
  engineering_manager: {
    id: 'engineering_manager',
    name: 'Engineering Manager',
    shortLabel: 'EM',
    description: 'Delivery summaries, team updates, technical handovers, and blocker metrics.',
    targetFocus: 'Evidence-backed status rollups, blocker reports, handover briefs.',
  },
};

/**
 * Workflow identifiers across milestones
 */
export type WorkflowId =
  | 'WF-DEV-01'
  | 'WF-DEV-02'
  | 'WF-DEV-03'
  | 'WF-PO-01'
  | 'WF-PO-02'
  | 'WF-SM-01'
  | 'WF-SM-02'
  | 'WF-QA-01'
  | 'WF-QA-02'
  | 'WF-EM-01';

/**
 * Explicit Workflow Execution States
 */
export type WorkflowExecutionState =
  | 'idle'
  | 'validating'
  | 'running'
  | 'succeeded'
  | 'failed';

/**
 * Epistemic classification of findings
 */
export type EpistemicClassification =
  | 'confirmed_fact'
  | 'inference'
  | 'unknown';

/**
 * Source citation pointing to concrete evidence
 */
export interface SourceReference {
  source: string;
  recordIndex?: number;
  lineStart?: number;
  lineEnd?: number;
  pageNumber?: number;
  commitHash?: string;
  rawSnippet: string;
}

/**
 * Input validation error
 */
export interface InputValidationError {
  field: string;
  message: string;
  line?: number;
  snippet?: string;
}

/**
 * Execution failure payload
 */
export interface ExecutionFailure {
  code: string;
  message: string;
  details?: string;
  validationErrors?: InputValidationError[];
  failedAt: string;
}

/**
 * Metadata for a registered workflow
 */
export interface WorkflowMetadata {
  id: WorkflowId;
  name: string;
  code: string;
  description: string;
  targetRole: Role;
  supportedRoles: Role[];
  status: 'implemented' | 'planned';
  engineType: 'deterministic' | 'ai_assisted';
  requiredInputs: string[];
  supportedFormats: string[];
  disclaimer: string;
}

/**
 * Generic typed workflow result
 */
export interface WorkflowResult<TPayload> {
  workflowId: WorkflowId;
  workflowName: string;
  executedAt: string;
  durationMs: number;
  isDeterministic: boolean;
  epistemicRating: EpistemicClassification;
  payload: TPayload;
  markdown: string;
  sourceReferences: SourceReference[];
  disclaimers: string[];
}

/**
 * Abstract workflow definition contract implemented by individual workflows
 */
export interface WorkflowDefinition<TInput, TPayload> {
  metadata: WorkflowMetadata;
  validateInput(input: TInput): InputValidationError[];
  execute(input: TInput): Promise<WorkflowResult<TPayload>>;
}
