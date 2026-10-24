/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { IngestionLimits, DEFAULT_INGESTION_LIMITS } from '../types.ts';
import { SourceReference } from '../../types/workflow.ts';

export interface DocumentExtractionResult {
  extractedText: string;
  pageCount?: number;
  isPartialExtraction: boolean;
  sourceReferences: SourceReference[];
  warnings: string[];
}

export class DocumentExtractor {
  /**
   * Safe document text extraction for PDF, DOCX, and XLSX
   */
  public static extract(
    rawContent: string,
    filename: string,
    extension: string,
    limits: IngestionLimits = DEFAULT_INGESTION_LIMITS
  ): DocumentExtractionResult {
    const warnings: string[] = [];

    switch (extension.toLowerCase()) {
      case 'pdf':
        return this.extractPdf(rawContent, filename, warnings, limits);
      case 'docx':
        return this.extractDocx(rawContent, filename, warnings);
      case 'xlsx':
        return this.extractXlsx(rawContent, filename, warnings);
      default:
        return {
          extractedText: `[Unsupported document format: .${extension}]`,
          isPartialExtraction: true,
          sourceReferences: [],
          warnings: [`Unsupported document format ".${extension}".`],
        };
    }
  }

  /**
   * Safe PDF stream parser extracting text blocks from PDF syntax
   */
  private static extractPdf(
    raw: string,
    filename: string,
    warnings: string[],
    limits: IngestionLimits
  ): DocumentExtractionResult {
    // Detect page markers
    const pageMatches = raw.match(/\/Type\s*\/Page\b/g) || [];
    const detectedPages = pageMatches.length || 1;
    const cappedPages = Math.min(detectedPages, limits.maxDocumentPages);

    if (detectedPages > limits.maxDocumentPages) {
      warnings.push(`PDF "${filename}" has ${detectedPages} pages; extraction bounded to first ${limits.maxDocumentPages} pages.`);
    }

    const textChunks: string[] = [];

    // Extract text from text blocks: BT ... ET
    const btRegex = /BT[\s\S]*?ET/g;
    let btMatch: RegExpExecArray | null;

    while ((btMatch = btRegex.exec(raw)) !== null) {
      const block = btMatch[0];

      // Extract literal text: (string) Tj or '
      const tjRegex = /\(([^)]+)\)\s*(?:Tj|'|")/g;
      let tjMatch: RegExpExecArray | null;
      while ((tjMatch = tjRegex.exec(block)) !== null) {
        textChunks.push(tjMatch[1]);
      }

      // Extract array text: [(str) 10 (str2)] TJ
      const tjArrayRegex = /\[([^\]]+)\]\s*TJ/g;
      let arrayMatch: RegExpExecArray | null;
      while ((arrayMatch = tjArrayRegex.exec(block)) !== null) {
        const inner = arrayMatch[1];
        const innerItems = inner.match(/\(([^)]+)\)/g) || [];
        for (const item of innerItems) {
          textChunks.push(item.slice(1, -1));
        }
      }
    }

    if (textChunks.length === 0) {
      warnings.push(`No embedded text streams found in "${filename}". If this document is a scanned image, OCR is required.`);
      return {
        extractedText: `--- [PDF Document: "${filename}" (${detectedPages} pages detected)] ---\n[Notice: Document contains no direct embedded text streams. Scanned raster pages require OCR.]`,
        pageCount: detectedPages,
        isPartialExtraction: true,
        sourceReferences: [{ source: filename, pageNumber: 1, rawSnippet: 'PDF header' }],
        warnings,
      };
    }

    const cleanText = textChunks.join(' ').replace(/\\([()\\])/g, '$1').trim();
    const formattedText = `--- [PDF Document Extract: "${filename}" (Pages 1 to ${cappedPages} of ${detectedPages})] ---\n\n${cleanText}`;

    return {
      extractedText: formattedText,
      pageCount: detectedPages,
      isPartialExtraction: detectedPages > limits.maxDocumentPages,
      sourceReferences: [
        {
          source: filename,
          pageNumber: 1,
          lineStart: 1,
          lineEnd: cleanText.split('\n').length,
          rawSnippet: cleanText.slice(0, 150),
        },
      ],
      warnings,
    };
  }

  /**
   * Safe XML text extractor for Word .docx documents
   */
  private static extractDocx(
    raw: string,
    filename: string,
    warnings: string[]
  ): DocumentExtractionResult {
    // Check for macro code
    if (raw.includes('vbaProject.bin') || raw.includes('macroEnabled')) {
      warnings.push(`Document "${filename}" contains embedded macros. Macro execution is disabled.`);
    }

    // Extract text inside Word tags: <w:t>text</w:t>
    const wtRegex = /<w:t[^>]*>([^<]+)<\/w:t>/g;
    const paragraphs: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = wtRegex.exec(raw)) !== null) {
      paragraphs.push(match[1]);
    }

    if (paragraphs.length === 0) {
      return {
        extractedText: `--- [DOCX Document: "${filename}"] ---\n[Notice: Extracted XML body contained no standard <w:t> text elements.]`,
        isPartialExtraction: true,
        sourceReferences: [{ source: filename, rawSnippet: 'DOCX container' }],
        warnings,
      };
    }

    const docText = paragraphs.join(' ').trim();
    return {
      extractedText: `--- [DOCX Document Extract: "${filename}"] ---\n\n${docText}`,
      isPartialExtraction: false,
      sourceReferences: [
        {
          source: filename,
          lineStart: 1,
          lineEnd: docText.split('\n').length,
          rawSnippet: docText.slice(0, 150),
        },
      ],
      warnings,
    };
  }

  /**
   * Safe XML text extractor for Excel .xlsx spreadsheets
   */
  private static extractXlsx(
    raw: string,
    filename: string,
    warnings: string[]
  ): DocumentExtractionResult {
    // Extract shared strings and cell values: <t>...</t> or <v>...</v>
    const tRegex = /<t[^>]*>([^<]+)<\/t>/g;
    const vRegex = /<v[^>]*>([^<]+)<\/v>/g;
    const cells: string[] = [];

    let match: RegExpExecArray | null;
    while ((match = tRegex.exec(raw)) !== null) {
      cells.push(match[1]);
    }
    while ((match = vRegex.exec(raw)) !== null) {
      cells.push(match[1]);
    }

    const uniqueCells = Array.from(new Set(cells));
    return {
      extractedText: `--- [XLSX Spreadsheet Extract: "${filename}" (${uniqueCells.length} cells extracted)] ---\nValues: ${uniqueCells.slice(0, 100).join(', ')}`,
      isPartialExtraction: false,
      sourceReferences: [{ source: filename, rawSnippet: 'XLSX sheet' }],
      warnings,
    };
  }
}
