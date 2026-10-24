/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SourceReference } from '../../../types/workflow.ts';

export type AmbiguityCategory =
  | 'vague_quantifier'
  | 'missing_acceptance_criteria'
  | 'unspecified_actor_or_outcome'
  | 'missing_error_handling'
  | 'contradiction'
  | 'undefined_term'
  | 'unresolved_dependency'
  | 'missing_permissions_or_privacy';

export type AmbiguitySeverity = 'high' | 'medium' | 'low';

export interface AmbiguityFinding {
  id: string; // e.g. "AMB-01"
  category: AmbiguityCategory;
  categoryLabel: string;
  sourceExcerpt: string;
  secondaryExcerpt?: string; // For contradictions citing both statements
  lineStart: number;
  secondaryLine?: number;
  explanation: string;
  potentialImpact: string;
  severity: AmbiguitySeverity;
  severityReason: string;
  clarificationQuestion: string;
  suggestedRewrite?: string; // Explicitly marked as a proposal
  confidence: 'high' | 'medium' | 'inference';
  limitations: string;
  sourceReferences: SourceReference[];
}

export interface AmbiguityScannerInput {
  specText: string;
  sourceName?: string;
  documentTitle?: string;
}

export interface AmbiguityScannerPayload {
  documentTitle: string;
  totalLinesAnalyzed: number;
  totalFindings: number;
  severityCounts: {
    high: number;
    medium: number;
    low: number;
  };
  categoryCounts: Record<AmbiguityCategory, number>;
  findings: AmbiguityFinding[];
  severityRubric: string;
  disclaimer: string;
  markdown: string;
}
