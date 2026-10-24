/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SourceReference } from '../../../types/workflow.ts';

export type ObservationSentiment = 'positive' | 'friction' | 'neutral' | 'suggestion';

export interface RetroObservation {
  id: string; // e.g. "OBS-01"
  text: string;
  sentiment: ObservationSentiment;
  themeId?: string;
  sourceReferences: SourceReference[];
}

export interface RetroTheme {
  id: string; // e.g. "TH-01"
  name: string;
  description: string;
  observations: RetroObservation[];
  proposedExperiments: string[]; // Clearly marked as suggestions
}

export interface RetroThematicClusterInput {
  retroNotes: string;
  sprintName?: string;
  sourceName?: string;
}

export interface RetroThematicClusterPayload {
  sprintName: string;
  totalObservations: number;
  positiveCount: number;
  frictionCount: number;
  suggestionCount: number;
  themes: RetroTheme[];
  unclusteredObservations: RetroObservation[];
  limitations: string;
  humanReviewNotice: string;
  markdown: string;
}
