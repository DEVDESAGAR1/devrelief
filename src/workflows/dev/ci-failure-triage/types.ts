/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SourceReference } from '../../../types/workflow.ts';

export interface CiTriageInput {
  rawLogOrTrace: string;
  sourceName?: string;
  pipelineStage?: string;
}

export interface ErrorOccurrence {
  lineNumber: number;
  errorKeyword: string;
  snippet: string;
  surroundingContext: string[];
}

export interface ErrorCluster {
  errorType: string;
  count: number;
  firstLine: number;
  sampleMessage: string;
}

export interface FailureHypothesis {
  rank: number;
  title: string;
  probability: 'high' | 'medium' | 'low';
  rationale: string;
  supportingEvidence: string;
}

export interface CiTriagePayload {
  pipelineStage?: string;
  totalLinesAnalyzed: number;
  firstMeaningfulError?: ErrorOccurrence;
  errorClusters: ErrorCluster[];
  hypotheses: FailureHypothesis[];
  missingInformation: string[];
  suggestedSteps: string[];
  suggestedInertCommands: string[];
  hasRedactedSecrets: boolean;
  isRootCauseConfirmed: boolean;
}
