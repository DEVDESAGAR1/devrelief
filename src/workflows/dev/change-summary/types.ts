/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SourceReference } from '../../../types/workflow.ts';
import { DiffFileChange } from '../../../ingestion/extractors/diff.ts';

export interface ChangeSummaryInput {
  rawDiffOrLog: string;
  sourceName?: string;
  versionTag?: string;
}

export interface ReleaseNoteItem {
  id: string;
  category: 'breaking' | 'feature' | 'fix' | 'refactor' | 'dependency' | 'docs' | 'internal';
  title: string;
  description: string;
  files: string[];
  isBreakingChange: boolean;
  sourceReference: SourceReference;
}

export interface ChangeSummaryPayload {
  versionTag: string;
  totalFilesChanged: number;
  totalAdditions: number;
  totalDeletions: number;
  breakingChangesCount: number;
  fileChanges: DiffFileChange[];
  categorizedItems: Array<{
    category: ReleaseNoteItem['category'];
    title: string;
    icon: string;
    items: ReleaseNoteItem[];
  }>;
  draftReleaseNotes: string;
  uncertainties: string[];
}
