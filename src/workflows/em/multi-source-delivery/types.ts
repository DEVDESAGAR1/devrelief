/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SourceReference } from '../../../types/workflow.ts';

export interface DeliveryBlocker {
  id: string; // e.g. "BLK-01"
  description: string;
  supportingEvidence: string;
  impact: string;
  owner: string; // Stated owner or "UNKNOWN"
  dependency: string;
  status: 'ACTIVE' | 'RESOLVED' | 'INVESTIGATING' | 'UNKNOWN';
  missingInformation: string;
  suggestedFollowUp: string; // Clearly labeled as recommendation
  sourceReferences: SourceReference[];
}

export interface ConfirmedDeliveryEvidence {
  commitsCount: number;
  testsPassedCount?: number;
  testsFailedCount?: number;
  ciStatus?: 'PASSED' | 'FAILED' | 'UNKNOWN';
  completedTasks: string[];
}

export interface MultiSourceDeliveryInput {
  combinedEvidenceText: string;
  sourceName?: string;
  reportingPeriod?: string;
  projectLabel?: string;
}

export interface MultiSourceDeliveryPayload {
  projectLabel: string;
  reportingPeriod: string;
  executiveSummary: string;
  confirmedEvidence: ConfirmedDeliveryEvidence;
  completedWork: string[];
  blockerMatrix: DeliveryBlocker[];
  potentialRisks: string[]; // Clearly labeled as assessments
  unresolvedQuestions: string[];
  crossSourceLinks: string[];
  dataGapsAndLimitations: string[];
  stakeholderUpdateDraft: string;
  humanReviewNotice: string;
  markdown: string;
}
