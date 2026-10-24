/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SourceReference } from '../../../types/workflow.ts';

export type ActionItemStatus = 'ASSIGNED' | 'UNASSIGNED' | 'BLOCKED' | 'NOT SPECIFIED';

export interface ActionItem {
  id: string; // e.g. "ACT-01"
  description: string;
  owner: string; // Explicit owner or "UNASSIGNED"
  isOwnerExplicit: boolean;
  dueDate: string; // Explicit date or "NOT SPECIFIED"
  isDueDateExplicit: boolean;
  relatedDecision?: string;
  blocker?: string;
  status: ActionItemStatus;
  clarificationNeeded?: string;
  sourceReferences: SourceReference[];
}

export interface MeetingDecision {
  id: string;
  description: string;
  sourceLine: number;
  sourceReferences: SourceReference[];
}

export interface ActionItemMatrixInput {
  meetingNotes: string;
  sourceName?: string;
  meetingTitle?: string;
  meetingDate?: string;
}

export interface ActionItemMatrixPayload {
  meetingTitle: string;
  meetingDate?: string;
  summary: string;
  totalActionItems: number;
  assignedCount: number;
  unassignedCount: number;
  actions: ActionItem[];
  decisions: MeetingDecision[];
  unresolvedQuestions: string[];
  dependenciesAndBlockers: string[];
  humanReviewNotice: string;
  markdown: string;
}
