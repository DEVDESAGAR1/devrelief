/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Role, WorkflowId, WorkflowMetadata } from '../types/workflow.ts';

export const WORKFLOW_CATALOGUE: WorkflowMetadata[] = [
  // Developer Workflows
  {
    id: 'WF-DEV-01',
    code: 'git-daily-digest',
    name: 'Git Activity Daily Digest',
    description: 'Parses raw Git commit history into a clean, categorized daily activity digest with source hash citations.',
    targetRole: 'developer',
    supportedRoles: ['developer', 'engineering_manager'],
    status: 'implemented',
    engineType: 'deterministic',
    requiredInputs: ['Git Log text or .log file in format: %H%n%an%n%aI%n%s'],
    supportedFormats: ['.log', '.txt', 'Raw Clipboard Paste'],
    disclaimer: 'Categorization is derived strictly from commit subjects and headers; it does not constitute static code analysis or validation of implementation quality.',
  },
  {
    id: 'WF-DEV-02',
    code: 'change-summaries',
    name: 'Change Summaries & Release Notes',
    description: 'Analyzes unified diffs and pull requests to compile categorized release notes with breaking change flags.',
    targetRole: 'developer',
    supportedRoles: ['developer', 'product_owner', 'engineering_manager'],
    status: 'implemented',
    engineType: 'deterministic',
    requiredInputs: ['Unified Git diff (.diff / .patch) or Git log'],
    supportedFormats: ['.diff', '.patch', '.txt'],
    disclaimer: 'Draft release notes are generated from syntactic diff metadata and commit hunks; human engineering review is required before publication.',
  },
  {
    id: 'WF-DEV-03',
    code: 'ci-failure-triage',
    name: 'CI Failure Triage',
    description: 'Analyzes CI/CD logs, test reports, and error traces to extract first meaningful error, cluster failures, and hypothesize root causes.',
    targetRole: 'developer',
    supportedRoles: ['developer', 'engineering_manager', 'qa_engineer'],
    status: 'implemented',
    engineType: 'deterministic',
    requiredInputs: ['CI/CD log (.log / .txt), test execution trace'],
    supportedFormats: ['.log', '.txt'],
    disclaimer: 'Root-cause explanations are hypotheses derived from log pattern matching. No external commands are executed automatically.',
  },

  // Product Owner Workflows
  {
    id: 'WF-PO-01',
    code: 'stories-gherkin-ac',
    name: 'Rough Notes to Stories & Gherkin AC',
    description: 'Converts discovery notes into standard user stories with Given/When/Then acceptance criteria.',
    targetRole: 'product_owner',
    supportedRoles: ['product_owner', 'developer', 'qa_engineer'],
    status: 'implemented',
    engineType: 'deterministic',
    requiredInputs: ['Discovery notes, meeting bullets, or customer interviews'],
    supportedFormats: ['.txt', '.md'],
    disclaimer: 'Generates structured draft scenarios for review by business stakeholders.',
  },
  {
    id: 'WF-PO-02',
    code: 'ambiguity-scanner',
    name: 'Requirements Ambiguity Scanner',
    description: 'Flags vague quantifiers ("fast", "user-friendly", "periodically") and highlights missing edge cases.',
    targetRole: 'product_owner',
    supportedRoles: ['product_owner', 'qa_engineer'],
    status: 'implemented',
    engineType: 'deterministic',
    requiredInputs: ['PRD, functional specification, or story drafts'],
    supportedFormats: ['.md', '.docx', '.txt'],
    disclaimer: 'Heuristic lexical analysis highlighting ambiguous quantifiers.',
  },

  // Scrum Master Workflows
  {
    id: 'WF-SM-01',
    code: 'action-item-matrix',
    name: 'Meeting Notes to Action Item Matrix',
    description: 'Extracts clear tasks, assigned owners, and target dates from meeting and retrospective transcripts.',
    targetRole: 'scrum_master',
    supportedRoles: ['scrum_master', 'engineering_manager'],
    status: 'implemented',
    engineType: 'deterministic',
    requiredInputs: ['Meeting minutes or audio transcription text'],
    supportedFormats: ['.txt', '.md'],
    disclaimer: 'Isolates modal action statements; unassigned tasks are marked UNASSIGNED.',
  },
  {
    id: 'WF-SM-02',
    code: 'retro-thematic-cluster',
    name: 'Sprint Retrospective Thematic Clusterer',
    description: 'Clusters retrospective feedback into actionable themes and synthesizes the top 3 experiment proposals.',
    targetRole: 'scrum_master',
    supportedRoles: ['scrum_master', 'developer', 'engineering_manager'],
    status: 'implemented',
    engineType: 'deterministic',
    requiredInputs: ['Export of retro board columns (What went well / What did not / Ideas)'],
    supportedFormats: ['.csv', '.json', '.txt'],
    disclaimer: 'Groupings are synthesized from text similarities.',
  },

  // QA Engineer Workflows
  {
    id: 'WF-QA-01',
    code: 'spec-test-scenarios',
    name: 'Specification to Test Scenario Matrix',
    description: 'Synthesizes positive, negative, and edge test cases directly from user stories and acceptance criteria.',
    targetRole: 'qa_engineer',
    supportedRoles: ['qa_engineer', 'developer', 'product_owner'],
    status: 'implemented',
    engineType: 'deterministic',
    requiredInputs: ['Acceptance criteria or feature specification'],
    supportedFormats: ['.md', '.txt'],
    disclaimer: 'Generates draft test matrices requiring validation against the actual system under test.',
  },
  {
    id: 'WF-QA-02',
    code: 'screenshot-to-repro',
    name: 'Error Screenshot & Trace to Repro Ticket',
    description: 'Converts console logs, error traces, and screenshots into standardized bug reproduction steps.',
    targetRole: 'qa_engineer',
    supportedRoles: ['qa_engineer', 'developer'],
    status: 'implemented',
    engineType: 'deterministic',
    requiredInputs: ['Error stack trace and browser/system console output'],
    supportedFormats: ['.log', '.txt'],
    disclaimer: 'Synthesizes reproduction steps from log stack traces.',
  },

  // Engineering Manager Workflows
  {
    id: 'WF-EM-01',
    code: 'multi-source-delivery',
    name: 'Multi-Source Delivery Summary & Blocker Matrix',
    description: 'Aggregates Git activity, test runs, and sprint status into an executive summary with stated data limits.',
    targetRole: 'engineering_manager',
    supportedRoles: ['engineering_manager'],
    status: 'implemented',
    engineType: 'deterministic',
    requiredInputs: ['Git logs, test execution summaries, and status notes'],
    supportedFormats: ['.log', '.json', '.md'],
    disclaimer: 'Summary is derived strictly from provided inputs and does not reflect external unlinked ticketing systems.',
  },
];

/**
 * Filter catalogue workflows by role
 */
export function getWorkflowsForRole(role: Role): WorkflowMetadata[] {
  return WORKFLOW_CATALOGUE.filter((wf) => wf.supportedRoles.includes(role));
}

/**
 * Retrieve a specific workflow metadata by ID
 */
export function getWorkflowMetadata(id: WorkflowId): WorkflowMetadata | undefined {
  return WORKFLOW_CATALOGUE.find((wf) => wf.id === id);
}
