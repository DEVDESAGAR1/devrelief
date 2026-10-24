/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SourceReference } from '../../../types/workflow.ts';

export type ConventionalCommitType =
  | 'feat'
  | 'fix'
  | 'docs'
  | 'refactor'
  | 'perf'
  | 'test'
  | 'build'
  | 'ci'
  | 'chore'
  | 'merge'
  | 'other';

export interface ParsedCommit {
  hash: string;
  shortHash: string;
  author: string;
  date: string;
  rawSubject: string;
  type: ConventionalCommitType;
  scope?: string;
  isBreakingChange: boolean;
  isMergeCommit: boolean;
  lineNumber: number;
  sourceReference: SourceReference;
}

export interface GitDigestCategory {
  type: ConventionalCommitType;
  title: string;
  icon: string;
  description: string;
  commits: ParsedCommit[];
}

export interface GitDigestInput {
  rawLog: string;
  sourceName?: string;
}

export interface GitDigestPayload {
  totalRecordsProcessed: number;
  uniqueCommitsCount: number;
  duplicateCommitsCount: number;
  breakingChangesCount: number;
  categories: GitDigestCategory[];
  authors: Array<{ name: string; commitCount: number }>;
  uniqueCommits: ParsedCommit[];
  duplicateHashes: string[];
  parsingWarnings: string[];
}
