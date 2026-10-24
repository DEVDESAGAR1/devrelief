/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SourceReference } from '../../../types/workflow.ts';

export interface StoriesGherkinInput {
  rawNotes: string;
  sourceName?: string;
  productContext?: string;
  targetUser?: string;
  businessObjective?: string;
  constraints?: string;
}

export interface UserStory {
  id: string; // e.g. "US-01"
  title: string;
  role: string;
  capability: string;
  benefit: string;
  statement: string; // "As a [role], I want [capability], so that [benefit]."
  scenarios: GherkinScenario[];
  assumptions: string[];
  openQuestions: string[];
  dependencies: string[];
  sourceReferences: SourceReference[];
}

export interface GherkinScenario {
  id: string; // e.g. "SC-01-01"
  title: string;
  type: 'positive' | 'negative' | 'boundary' | 'edge';
  given: string[];
  when: string[];
  then: string[];
  and: string[];
}

export interface StoriesGherkinPayload {
  featureSummary: string;
  targetUser: string;
  businessObjective: string;
  stories: UserStory[];
  unmappedNotes: string[];
  openClarifications: string[];
  humanReviewNotice: string;
  markdown: string;
}
