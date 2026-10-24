/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SourceReference } from '../../../types/workflow.ts';

export type TestScenarioType = 'positive' | 'negative' | 'boundary' | 'error';
export type TestPriority = 'P1 - Critical' | 'P2 - High' | 'P3 - Medium';

export interface TestCase {
  id: string; // e.g. "TC-01"
  requirementRef: string;
  scenarioTitle: string;
  type: TestScenarioType;
  priority: TestPriority;
  preconditions: string; // Stated preconditions or "UNKNOWN - not specified in requirements"
  steps: string[];
  expectedResult: string; // Stated expected result or "UNKNOWN - requires stakeholder specification"
  missingDetails?: string;
  sourceReferences: SourceReference[];
}

export interface SpecTestScenariosInput {
  specText: string;
  featureName?: string;
  sourceName?: string;
}

export interface SpecTestScenariosPayload {
  featureName: string;
  totalScenarios: number;
  positiveCount: number;
  negativeCount: number;
  boundaryCount: number;
  errorCount: number;
  testCases: TestCase[];
  untestableRequirements: string[];
  priorityRubric: string;
  limitations: string;
  humanReviewNotice: string;
  markdown: string;
}
