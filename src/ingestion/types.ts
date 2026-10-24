/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SourceReference, EpistemicClassification } from '../types/workflow.ts';

export type SupportedFormatCategory =
  | 'image'
  | 'text_log'
  | 'structured_data'
  | 'diff_patch'
  | 'document'
  | 'unsupported';

export type IngestionSupportLevel =
  | 'supported_and_tested'
  | 'supported_with_limitations'
  | 'rejected'
  | 'planned';

export interface FormatSupportInfo {
  extension: string;
  category: SupportedFormatCategory;
  mimeType: string;
  level: IngestionSupportLevel;
  description: string;
  limitations?: string;
}

export interface IngestionLimits {
  defaultMaxFileSizeBytes: number; // 20 MB = 20 * 1024 * 1024
  absoluteMaxFileSizeBytes: number; // 50 MB = 50 * 1024 * 1024
  maxAttachmentsPerQuery: number; // 10
  maxLogLinesBeforeWindowing: number; // 5,000 lines
  windowHeadLines: number; // 500 lines
  windowTailLines: number; // 3,000 lines
  maxDocumentPages: number; // 50 pages
  maxTableRows: number; // 5,000 rows
}

export const DEFAULT_INGESTION_LIMITS: IngestionLimits = {
  defaultMaxFileSizeBytes: 20 * 1024 * 1024,
  absoluteMaxFileSizeBytes: 50 * 1024 * 1024,
  maxAttachmentsPerQuery: 10,
  maxLogLinesBeforeWindowing: 5000,
  windowHeadLines: 500,
  windowTailLines: 3000,
  maxDocumentPages: 50,
  maxTableRows: 5000,
};

export interface SecretRedactionMatch {
  ruleName: string;
  originalRedactedText: string;
  maskedSnippet: string;
  line: number;
}

export interface EvidenceItem {
  id: string; // att_...
  filename: string;
  sanitizedFilename: string;
  sizeBytes: number;
  mimeType: string;
  detectedFormat: string;
  category: SupportedFormatCategory;
  supportLevel: IngestionSupportLevel;
  extractedText: string;
  totalLines: number;
  isTruncated: boolean;
  truncationReason?: string;
  isPartialExtraction: boolean;
  extractionWarnings: string[];
  extractionMethod: 'text_utf8' | 'log_windowing' | 'structured_json' | 'structured_csv' | 'unified_diff' | 'document_text' | 'image_metadata' | 'unsupported';
  sourceReferences: SourceReference[];
  redactedSecrets: SecretRedactionMatch[];
  imageMetadata?: {
    width?: number;
    height?: number;
    aspectRatio?: string;
    exifStripped: boolean;
    previewUrl?: string;
  };
  structuredData?: {
    rowCount?: number;
    columnNames?: string[];
    keys?: string[];
  };
}

export interface EvidencePackage {
  packageId: string;
  createdAt: string;
  queryPrompt: string;
  items: EvidenceItem[];
  totalSizeBytes: number;
  hasTruncatedItems: boolean;
  hasSecretsRedacted: boolean;
  allConfirmedFacts: Array<{ statement: string; source: SourceReference }>;
  allInferences: Array<{ statement: string; rationale: string; confidence: number }>;
  allUnknowns: string[];
  warnings: string[];
}

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  detectedMime: string;
  detectedExtension: string;
  category: SupportedFormatCategory;
  isRejected: boolean;
  rejectReason?: string;
}
