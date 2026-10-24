/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { InputValidationError, SourceReference } from '../../../types/workflow.ts';
import {
  SpecTestScenariosInput,
  SpecTestScenariosPayload,
  TestCase,
  TestScenarioType,
  TestPriority,
} from './types.ts';

export class SpecTestSynthesizer {
  public static validate(input: SpecTestScenariosInput): InputValidationError[] {
    const errors: InputValidationError[] = [];
    if (!input || input.specText === undefined || input.specText === null || typeof input.specText !== 'string') {
      errors.push({
        field: 'specText',
        message: 'Specification text input is required and must be a string.',
      });
      return errors;
    }

    if (input.specText.trim().length === 0) {
      errors.push({
        field: 'specText',
        message: 'Specification text cannot be empty or whitespace-only.',
      });
      return errors;
    }

    if (input.specText.trim().length < 20) {
      errors.push({
        field: 'specText',
        message: 'Specification text is too brief to synthesize test scenarios (minimum 20 characters).',
      });
    }

    return errors;
  }

  public static synthesize(input: SpecTestScenariosInput): SpecTestScenariosPayload {
    const sourceName = input.sourceName || 'requirements_specification.md';
    const featureName = input.featureName || 'Feature Acceptance Verification';
    const lines = input.specText.split('\n');

    const testCases: TestCase[] = [];
    const untestableRequirements: string[] = [];
    let tcCounter = 1;

    let positiveCount = 0;
    let negativeCount = 0;
    let boundaryCount = 0;
    let errorCount = 0;

    lines.forEach((line, index) => {
      const lineNum = index + 1;
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;

      const cleaned = trimmed.replace(/^[-*•+]\s+/, '').replace(/^\d+[\.\)]\s+/, '').trim();
      if (cleaned.length < 5) return;

      const sourceRefs: SourceReference[] = [
        {
          source: sourceName,
          lineStart: lineNum,
          lineEnd: lineNum,
          rawSnippet: trimmed,
        },
      ];

      // Check for untestable subjective requirements
      if (/\b(user-friendly|fast|intuitive|seamless|nice|clean|modern)\b/i.test(cleaned) &&
          !/\b(\d+ms|\d+\s*seconds|\d+\s*users|sla|slo)\b/i.test(cleaned)) {
        untestableRequirements.push(`Line ${lineNum}: "${cleaned}" (Lacks objective quantitative threshold)`);
      }

      // Determine priority
      let priority: TestPriority = 'P2 - High';
      if (/\b(auth|login|password|security|payment|billing|delete|compliance|token)\b/i.test(cleaned)) {
        priority = 'P1 - Critical';
      } else if (/\b(ui|theme|color|styling|button|display|format|label)\b/i.test(cleaned)) {
        priority = 'P3 - Medium';
      }

      // Check if preconditions are mentioned
      let preconditions = 'UNKNOWN - not specified in source requirements';
      const preMatch = cleaned.match(/\b(?:given|when|precondition|if)\s+([^,;]+)/i);
      if (preMatch) {
        preconditions = preMatch[1].trim();
      }

      // Check if expected outcome is mentioned
      let expectedResult = 'UNKNOWN - requires stakeholder specification';
      const thenMatch = cleaned.match(/\b(?:then|should|must|will|returns|results in|displays)\s+([^,;.]+)/i);
      if (thenMatch) {
        expectedResult = `System shall ${thenMatch[1].trim()}`;
      }

      // 1. Positive Scenario (Happy Path)
      const posId = `TC-${String(tcCounter++).padStart(2, '0')}`;
      testCases.push({
        id: posId,
        requirementRef: `REQ-${lineNum}`,
        scenarioTitle: `Positive: Verify ${cleaned.slice(0, 50)}`,
        type: 'positive',
        priority,
        preconditions,
        steps: [
          `Navigate to relevant feature view`,
          `Supply valid and complete inputs corresponding to: "${cleaned}"`,
          `Submit action and observe system response`,
        ],
        expectedResult,
        sourceReferences: sourceRefs,
      });
      positiveCount++;

      // 2. Negative Scenario (Validation Failure / Error)
      if (/\b(must|required|cannot|valid|auth|admin|only|allowed|numeric)\b/i.test(cleaned)) {
        const negId = `TC-${String(tcCounter++).padStart(2, '0')}`;
        testCases.push({
          id: negId,
          requirementRef: `REQ-${lineNum}`,
          scenarioTitle: `Negative: Reject invalid input or unauthorized request for ${cleaned.slice(0, 40)}`,
          type: 'negative',
          priority,
          preconditions: 'User provides invalid, missing, or unauthorized inputs',
          steps: [
            `Navigate to relevant feature view`,
            `Attempt action with invalid or malformed data violating: "${cleaned}"`,
            `Verify system rejects input without persisting partial state`,
          ],
          expectedResult: 'System returns explicit validation error message and denies operation',
          sourceReferences: sourceRefs,
        });
        negativeCount++;
      }

      // 3. Boundary Scenario (Numeric Limits, Lengths, Thresholds)
      const numMatch = cleaned.match(/\b(\d+)\b/);
      if (numMatch && /\b(max|limit|min|at least|up to|exceed|days|attempts|characters|bytes|mb)\b/i.test(cleaned)) {
        const boundId = `TC-${String(tcCounter++).padStart(2, '0')}`;
        testCases.push({
          id: boundId,
          requirementRef: `REQ-${lineNum}`,
          scenarioTitle: `Boundary: Test limit edge conditions at boundary threshold (${numMatch[1]})`,
          type: 'boundary',
          priority,
          preconditions: `System configured with threshold of ${numMatch[1]}`,
          steps: [
            `Test at value N - 1 (within valid boundary)`,
            `Test at value N (exact boundary)`,
            `Test at value N + 1 (exceeding boundary)`,
          ],
          expectedResult: `Values <= ${numMatch[1]} succeed; values > ${numMatch[1]} are rejected with boundary limit notice`,
          sourceReferences: sourceRefs,
        });
        boundaryCount++;
      }
    });

    const priorityRubric =
      'PRIORITY RUBRIC: P1 (Critical) = Core authentication, payment transactions, security permissions, and irreversible data mutations. P2 (High) = Primary business workflows and standard validation checks. P3 (Medium) = UI styling, cosmetic feedback, and secondary helper flows.';

    const limitations =
      'EPISTEMIC LIMITATIONS: Test scenarios are derived deterministically from textual requirement syntax. Synthesizing test cases does not imply 100% test coverage or system validation; tests must be verified against actual system implementation and test environments.';

    const humanReviewNotice =
      'HUMAN REVIEW MANDATORY: Test cases are draft specifications for QA engineers. Expected outcomes marked UNKNOWN require stakeholder clarification before adding to automated regression suites.';

    const payload: SpecTestScenariosPayload = {
      featureName,
      totalScenarios: testCases.length,
      positiveCount,
      negativeCount,
      boundaryCount,
      errorCount,
      testCases,
      untestableRequirements,
      priorityRubric,
      limitations,
      humanReviewNotice,
      markdown: '',
    };

    payload.markdown = SpecTestSynthesizer.renderMarkdown(payload);
    return payload;
  }

  private static renderMarkdown(payload: SpecTestScenariosPayload): string {
    const md: string[] = [];
    md.push(`# Test Scenario Matrix: ${payload.featureName}`);
    md.push('');
    md.push(`> ⚠️ **${payload.humanReviewNotice}**`);
    md.push('');
    md.push(`- **Total Scenarios Generated:** ${payload.totalScenarios}`);
    md.push(`- **Breakdown:** Positive: ${payload.positiveCount} | Negative: ${payload.negativeCount} | Boundary: ${payload.boundaryCount}`);
    md.push('');
    md.push(`*${payload.priorityRubric}*`);
    md.push('');
    md.push(`*${payload.limitations}*`);
    md.push('');
    md.push('---');
    md.push('');

    // Untestable requirements
    if (payload.untestableRequirements.length > 0) {
      md.push('## ⚠️ Untestable / Ambiguous Requirements (Requires Clarification)');
      md.push('');
      payload.untestableRequirements.forEach((req) => md.push(`- ❓ ${req}`));
      md.push('');
      md.push('---');
      md.push('');
    }

    // Test Cases
    md.push('## Test Case Specifications');
    md.push('');
    payload.testCases.forEach((tc) => {
      md.push(`### [${tc.id}] ${tc.scenarioTitle} (${tc.priority})`);
      md.push(`- **Requirement Ref:** \`${tc.requirementRef}\``);
      md.push(`- **Type:** \`${tc.type.toUpperCase()}\``);
      md.push(`- **Preconditions:** ${tc.preconditions}`);
      md.push(`- **Test Steps:**`);
      tc.steps.forEach((s, idx) => md.push(`  ${idx + 1}. ${s}`));
      md.push(`- **Expected Result:** ${tc.expectedResult}`);
      md.push('');
    });

    return md.join('\n');
  }
}
