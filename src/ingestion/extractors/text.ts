/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { IngestionLimits, DEFAULT_INGESTION_LIMITS } from '../types.ts';
import { SourceReference } from '../../types/workflow.ts';

export interface TextExtractionResult {
  extractedText: string;
  totalLines: number;
  isTruncated: boolean;
  truncationReason?: string;
  sourceReferences: SourceReference[];
  warnings: string[];
}

export class TextExtractor {
  /**
   * Extract text from plaintext, logs, and markdown files with bounded log windowing
   */
  public static extract(
    rawContent: string,
    filename: string,
    limits: IngestionLimits = DEFAULT_INGESTION_LIMITS
  ): TextExtractionResult {
    const lines = rawContent.split(/\r?\n/);
    const totalLines = lines.length;
    const warnings: string[] = [];

    // If within safe line bounds, return full content
    if (totalLines <= limits.maxLogLinesBeforeWindowing) {
      const sourceReferences: SourceReference[] = [
        {
          source: filename,
          lineStart: 1,
          lineEnd: totalLines,
          rawSnippet: lines.slice(0, 5).join('\n'),
        },
      ];

      return {
        extractedText: rawContent,
        totalLines,
        isTruncated: false,
        sourceReferences,
        warnings,
      };
    }

    // Apply Head/Tail Bounded Windowing
    const headCount = Math.min(limits.windowHeadLines, totalLines);
    const tailCount = Math.min(limits.windowTailLines, totalLines - headCount);
    const headLines = lines.slice(0, headCount);
    const tailStartIndex = totalLines - tailCount;
    const tailLines = lines.slice(tailStartIndex);

    // Scan middle segment for critical error lines (max 50 error lines)
    const middleLines = lines.slice(headCount, tailStartIndex);
    const errorHighlights: Array<{ lineIndex: number; text: string }> = [];

    const ERROR_REGEX = /\b(?:ERROR|FATAL|EXCEPTION|CRITICAL|PANIC|FAIL(?:ED)?)\b/i;
    for (let i = 0; i < middleLines.length; i++) {
      if (ERROR_REGEX.test(middleLines[i])) {
        errorHighlights.push({
          lineIndex: headCount + i + 1,
          text: middleLines[i],
        });
        if (errorHighlights.length >= 50) break;
      }
    }

    const assembledParts: string[] = [];

    // 1. Head Section
    assembledParts.push(`--- [LOG HEAD: Lines 1 to ${headCount} of ${totalLines}] ---`);
    assembledParts.push(...headLines);

    // 2. Middle Error Highlights
    if (errorHighlights.length > 0) {
      assembledParts.push('');
      assembledParts.push(`--- [ERROR CLUSTERS FOUND IN ELIDED MIDDLE: ${errorHighlights.length} occurrences] ---`);
      for (const err of errorHighlights) {
        assembledParts.push(`[Line ${err.lineIndex}]: ${err.text}`);
      }
    }

    // 3. Omission Notice
    const elidedCount = totalLines - (headCount + tailCount);
    assembledParts.push('');
    assembledParts.push(`--- [NOTE: ${elidedCount} intermediate lines elided to preserve performance] ---`);
    assembledParts.push('');

    // 4. Tail Section
    assembledParts.push(`--- [LOG TAIL: Lines ${tailStartIndex + 1} to ${totalLines}] ---`);
    assembledParts.push(...tailLines);

    const truncationReason = `Log exceeded ${limits.maxLogLinesBeforeWindowing} lines. Retained head ${headCount} lines, tail ${tailCount} lines, and ${errorHighlights.length} error lines. Elided ${elidedCount} intermediate lines.`;
    warnings.push(truncationReason);

    const sourceReferences: SourceReference[] = [
      {
        source: filename,
        lineStart: 1,
        lineEnd: headCount,
        rawSnippet: headLines.slice(0, 3).join('\n'),
      },
      {
        source: filename,
        lineStart: tailStartIndex + 1,
        lineEnd: totalLines,
        rawSnippet: tailLines.slice(-3).join('\n'),
      },
    ];

    return {
      extractedText: assembledParts.join('\n'),
      totalLines,
      isTruncated: true,
      truncationReason,
      sourceReferences,
      warnings,
    };
  }
}
