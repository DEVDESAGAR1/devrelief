/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { IngestionLimits, DEFAULT_INGESTION_LIMITS } from '../types.ts';
import { SourceReference } from '../../types/workflow.ts';

export interface DataExtractionResult {
  extractedText: string;
  rowCount?: number;
  columnNames?: string[];
  keys?: string[];
  isTruncated: boolean;
  truncationReason?: string;
  sourceReferences: SourceReference[];
  warnings: string[];
}

export class DataExtractor {
  /**
   * Extract JSON, JSONL, YAML, XML, or CSV data safely into structured summaries
   */
  public static extract(
    rawContent: string,
    filename: string,
    extension: string,
    limits: IngestionLimits = DEFAULT_INGESTION_LIMITS
  ): DataExtractionResult {
    const warnings: string[] = [];
    const sourceReferences: SourceReference[] = [
      {
        source: filename,
        lineStart: 1,
        lineEnd: rawContent.split(/\r?\n/).length,
        rawSnippet: rawContent.slice(0, 200),
      },
    ];

    switch (extension.toLowerCase()) {
      case 'json':
        return this.extractJson(rawContent, filename, sourceReferences, warnings);
      case 'jsonl':
        return this.extractJsonl(rawContent, filename, sourceReferences, warnings, limits);
      case 'csv':
      case 'tsv':
        return this.extractDelimited(rawContent, filename, extension, sourceReferences, warnings, limits);
      case 'yaml':
      case 'yml':
        return this.extractYaml(rawContent, filename, sourceReferences, warnings);
      case 'xml':
        return this.extractXml(rawContent, filename, sourceReferences, warnings);
      default:
        return {
          extractedText: rawContent,
          isTruncated: false,
          sourceReferences,
          warnings,
        };
    }
  }

  private static extractJson(
    raw: string,
    filename: string,
    sourceReferences: SourceReference[],
    warnings: string[]
  ): DataExtractionResult {
    try {
      const parsed = JSON.parse(raw);
      const isArray = Array.isArray(parsed);
      const keys = isArray ? (parsed[0] && typeof parsed[0] === 'object' ? Object.keys(parsed[0]) : []) : Object.keys(parsed);

      const summary = `--- [Structured JSON: ${isArray ? `${parsed.length} items array` : 'Object'} with ${keys.length} top-level fields] ---\nKeys: ${keys.join(', ')}\n\n${raw}`;
      return {
        extractedText: summary,
        rowCount: isArray ? parsed.length : 1,
        keys,
        isTruncated: false,
        sourceReferences,
        warnings,
      };
    } catch (err) {
      warnings.push(`Malformed JSON in "${filename}": ${err instanceof Error ? err.message : String(err)}`);
      return {
        extractedText: `--- [Malformed JSON file: "${filename}"] ---\n${raw}`,
        isTruncated: false,
        sourceReferences,
        warnings,
      };
    }
  }

  private static extractJsonl(
    raw: string,
    filename: string,
    sourceReferences: SourceReference[],
    warnings: string[],
    limits: IngestionLimits
  ): DataExtractionResult {
    const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const totalLines = lines.length;
    let validRecords = 0;
    const sampleKeys = new Set<string>();

    for (let i = 0; i < lines.length; i++) {
      try {
        const item = JSON.parse(lines[i]);
        validRecords++;
        if (typeof item === 'object' && item !== null) {
          for (const k of Object.keys(item)) sampleKeys.add(k);
        }
      } catch {
        warnings.push(`Unparseable JSONL record at line ${i + 1}`);
      }
    }

    const isTruncated = totalLines > limits.maxTableRows;
    const retainedLines = isTruncated ? lines.slice(0, limits.maxTableRows) : lines;
    const truncationReason = isTruncated
      ? `JSONL file exceeded ${limits.maxTableRows} rows. Truncated from ${totalLines} to ${limits.maxTableRows} rows.`
      : undefined;

    const summary = `--- [JSONL Log: ${validRecords} valid records of ${totalLines} lines] ---\nSample Keys: ${Array.from(sampleKeys).join(', ')}\n\n${retainedLines.join('\n')}`;

    return {
      extractedText: summary,
      rowCount: validRecords,
      keys: Array.from(sampleKeys),
      isTruncated,
      truncationReason,
      sourceReferences,
      warnings,
    };
  }

  private static extractDelimited(
    raw: string,
    filename: string,
    ext: string,
    sourceReferences: SourceReference[],
    warnings: string[],
    limits: IngestionLimits
  ): DataExtractionResult {
    const delimiter = ext === 'tsv' ? '\t' : ',';
    const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);

    if (lines.length === 0) {
      return {
        extractedText: `[Empty tabular file "${filename}"]`,
        rowCount: 0,
        isTruncated: false,
        sourceReferences,
        warnings,
      };
    }

    const header = lines[0].split(delimiter).map((col) => col.trim().replace(/^["']|["']$/g, ''));
    const totalRows = lines.length - 1;

    const isTruncated = totalRows > limits.maxTableRows;
    const keptRows = isTruncated ? lines.slice(0, limits.maxTableRows + 1) : lines;
    const truncationReason = isTruncated
      ? `Tabular data exceeded ${limits.maxTableRows} rows. Truncated from ${totalRows} to ${limits.maxTableRows} rows.`
      : undefined;

    const summary = `--- [Tabular Data: ${totalRows} rows, ${header.length} columns] ---\nColumns: ${header.join(' | ')}\n\n${keptRows.join('\n')}`;

    return {
      extractedText: summary,
      rowCount: totalRows,
      columnNames: header,
      isTruncated,
      truncationReason,
      sourceReferences,
      warnings,
    };
  }

  private static extractYaml(
    raw: string,
    filename: string,
    sourceReferences: SourceReference[],
    warnings: string[]
  ): DataExtractionResult {
    const lines = raw.split(/\r?\n/);
    const topKeys: string[] = [];

    for (const line of lines) {
      const match = line.match(/^([a-zA-Z0-9_\-]+):\s*/);
      if (match) {
        topKeys.push(match[1]);
      }
    }

    return {
      extractedText: `--- [YAML Configuration with ${topKeys.length} top-level mappings] ---\nMappings: ${topKeys.join(', ')}\n\n${raw}`,
      keys: topKeys,
      isTruncated: false,
      sourceReferences,
      warnings,
    };
  }

  private static extractXml(
    raw: string,
    filename: string,
    sourceReferences: SourceReference[],
    warnings: string[]
  ): DataExtractionResult {
    // Check for hazardous DOCTYPE/ENTITY definitions (XXE prevention)
    if (/<!DOCTYPE|<!ENTITY/i.test(raw)) {
      warnings.push(`XML file "${filename}" contains DTD/ENTITY declarations. External entities are disabled for security.`);
    }

    // Extract tags
    const tagMatches = raw.match(/<([a-zA-Z0-9_\-:]+)[\s>]/g) || [];
    const uniqueTags = Array.from(new Set(tagMatches.map((t) => t.slice(1, -1).trim())));

    return {
      extractedText: `--- [Safe XML Extract (XXE / DTD expansion disabled): ${uniqueTags.length} distinct tags] ---\nTags: ${uniqueTags.join(', ')}\n\n${raw}`,
      keys: uniqueTags,
      isTruncated: false,
      sourceReferences,
      warnings,
    };
  }
}
