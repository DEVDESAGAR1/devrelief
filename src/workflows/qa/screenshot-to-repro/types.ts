/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SourceReference } from '../../../types/workflow.ts';

export type BugSeverity = 'Critical' | 'Major' | 'Minor' | 'Trivial';

export interface BugTicketDraft {
  ticketId: string;
  title: string;
  observedBehavior: string;
  expectedBehavior: string; // Stated or UNKNOWN
  reproSteps: string[];
  environmentDetails: string;
  errorType: string;
  errorMessage: string;
  stackTraceSnippet: string;
  severity: BugSeverity;
  severityJustification: string;
  missingInformation: string[];
  questionsForReporter: string[];
  secretsRedactedCount: number;
  imageMetadataNote?: string;
  sourceReferences: SourceReference[];
}

export interface ScreenshotToReproInput {
  errorLogOrTrace: string;
  sourceName?: string;
  expectedBehaviorNotes?: string;
  environmentNotes?: string;
  imageAttachmentName?: string;
  imageDimensions?: string;
}

export interface ScreenshotToReproPayload {
  ticket: BugTicketDraft;
  severityRubric: string;
  limitations: string;
  humanReviewNotice: string;
  markdown: string;
}
