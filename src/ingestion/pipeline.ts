/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  EvidenceItem,
  EvidencePackage,
  IngestionLimits,
  DEFAULT_INGESTION_LIMITS,
  IngestionSupportLevel,
} from './types.ts';
import { FileValidator, FORMAT_SUPPORT_MATRIX } from './validation.ts';
import { SecretScanner } from './secrets.ts';
import { TextExtractor } from './extractors/text.ts';
import { DiffExtractor } from './extractors/diff.ts';
import { DataExtractor } from './extractors/data.ts';
import { DocumentExtractor } from './extractors/document.ts';
import { ImageExtractor } from './extractors/image.ts';
import { SourceReference } from '../types/workflow.ts';

export interface RawInputItem {
  filename: string;
  content: string;
  sizeBytes?: number;
  headerBytes?: Uint8Array;
}

export class MultimodalIngestionPipeline {
  private limits: IngestionLimits;

  constructor(limits: IngestionLimits = DEFAULT_INGESTION_LIMITS) {
    this.limits = limits;
  }

  /**
   * Execute 12-stage multimodal ingestion on raw inputs and construct an EvidencePackage
   */
  public async process(
    inputs: RawInputItem[],
    userPrompt = ''
  ): Promise<EvidencePackage> {
    const packageId = `pkg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const items: EvidenceItem[] = [];
    const packageWarnings: string[] = [];
    let totalSizeBytes = 0;
    let hasTruncatedItems = false;
    let hasSecretsRedacted = false;

    // Validate attachment count limit
    if (inputs.length > this.limits.maxAttachmentsPerQuery) {
      packageWarnings.push(
        `Batch exceeds maximum of ${this.limits.maxAttachmentsPerQuery} attachments. Only the first ${this.limits.maxAttachmentsPerQuery} files were processed.`
      );
      inputs = inputs.slice(0, this.limits.maxAttachmentsPerQuery);
    }

    for (let index = 0; index < inputs.length; index++) {
      const input = inputs[index];
      const itemId = `att_${index + 1}`;
      const sanitizedName = FileValidator.sanitizeFilename(input.filename);
      const ext = FileValidator.extractExtension(sanitizedName);
      const sizeBytes = input.sizeBytes ?? input.content.length;
      totalSizeBytes += sizeBytes;

      // Stage 2: Centralized validation
      const validation = FileValidator.validateFile(
        sanitizedName,
        sizeBytes,
        input.headerBytes,
        this.limits
      );

      if (!validation.valid) {
        items.push({
          id: itemId,
          filename: input.filename,
          sanitizedFilename: sanitizedName,
          sizeBytes,
          mimeType: validation.detectedMime,
          detectedFormat: ext || 'unknown',
          category: validation.category,
          supportLevel: 'rejected',
          extractedText: `[REJECTED: ${validation.error}]`,
          totalLines: 0,
          isTruncated: false,
          isPartialExtraction: true,
          extractionWarnings: [validation.error || 'File validation failed'],
          extractionMethod: 'unsupported',
          sourceReferences: [],
          redactedSecrets: [],
        });
        packageWarnings.push(`${sanitizedName}: ${validation.error}`);
        continue;
      }

      // Find support info
      const supportInfo = FORMAT_SUPPORT_MATRIX.find((f) => f.extension === ext);
      const supportLevel: IngestionSupportLevel = supportInfo ? supportInfo.level : 'supported_and_tested';

      let rawExtractedText = input.content;
      let totalLines = input.content.split(/\r?\n/).length;
      let isTruncated = false;
      let truncationReason: string | undefined;
      let isPartialExtraction = false;
      const extractionWarnings: string[] = [];
      let sourceReferences: SourceReference[] = [];
      let extractionMethod: EvidenceItem['extractionMethod'] = 'text_utf8';
      let structuredData: EvidenceItem['structuredData'] = undefined;
      let imageMetadata: EvidenceItem['imageMetadata'] = undefined;

      // Stage 4–6: Format-specific structural extraction
      if (validation.category === 'diff_patch' || ext === 'diff' || ext === 'patch') {
        extractionMethod = 'unified_diff';
        const diffRes = DiffExtractor.extract(input.content, sanitizedName);
        rawExtractedText = diffRes.extractedText;
        sourceReferences = diffRes.sourceReferences;
        extractionWarnings.push(...diffRes.warnings);
      } else if (validation.category === 'structured_data') {
        extractionMethod = ext === 'json' || ext === 'jsonl' ? 'structured_json' : 'structured_csv';
        const dataRes = DataExtractor.extract(input.content, sanitizedName, ext, this.limits);
        rawExtractedText = dataRes.extractedText;
        isTruncated = dataRes.isTruncated;
        truncationReason = dataRes.truncationReason;
        sourceReferences = dataRes.sourceReferences;
        extractionWarnings.push(...dataRes.warnings);
        structuredData = {
          rowCount: dataRes.rowCount,
          columnNames: dataRes.columnNames,
          keys: dataRes.keys,
        };
      } else if (validation.category === 'document') {
        extractionMethod = 'document_text';
        const docRes = DocumentExtractor.extract(input.content, sanitizedName, ext, this.limits);
        rawExtractedText = docRes.extractedText;
        isPartialExtraction = docRes.isPartialExtraction;
        sourceReferences = docRes.sourceReferences;
        extractionWarnings.push(...docRes.warnings);
      } else if (validation.category === 'image') {
        extractionMethod = 'image_metadata';
        const imgRes = ImageExtractor.extract(sanitizedName, ext, sizeBytes, input.headerBytes);
        rawExtractedText = imgRes.extractedText;
        sourceReferences = imgRes.sourceReferences;
        extractionWarnings.push(...imgRes.warnings);
        imageMetadata = {
          width: imgRes.width,
          height: imgRes.height,
          aspectRatio: imgRes.aspectRatio,
          exifStripped: imgRes.exifStripped,
        };
      } else {
        // text_log with bounded head/tail windowing
        extractionMethod = 'log_windowing';
        const textRes = TextExtractor.extract(input.content, sanitizedName, this.limits);
        rawExtractedText = textRes.extractedText;
        totalLines = textRes.totalLines;
        isTruncated = textRes.isTruncated;
        truncationReason = textRes.truncationReason;
        sourceReferences = textRes.sourceReferences;
        extractionWarnings.push(...textRes.warnings);
      }

      if (isTruncated) {
        hasTruncatedItems = true;
      }

      // Stage 8: Secret scanning and redaction
      const redaction = SecretScanner.scanAndRedact(rawExtractedText);
      if (redaction.hasRedactions) {
        hasSecretsRedacted = true;
        packageWarnings.push(
          `${sanitizedName}: Detected and redacted ${redaction.matches.length} credential(s) / token(s).`
        );
      }

      items.push({
        id: itemId,
        filename: input.filename,
        sanitizedFilename: sanitizedName,
        sizeBytes,
        mimeType: validation.detectedMime,
        detectedFormat: ext,
        category: validation.category,
        supportLevel,
        extractedText: redaction.sanitizedText,
        totalLines,
        isTruncated,
        truncationReason,
        isPartialExtraction,
        extractionWarnings,
        extractionMethod,
        sourceReferences,
        redactedSecrets: redaction.matches,
        structuredData,
        imageMetadata,
      });
    }

    // Stage 9: Assembly of findings and facts
    const allConfirmedFacts: Array<{ statement: string; source: SourceReference }> = [];
    const allInferences: Array<{ statement: string; rationale: string; confidence: number }> = [];
    const allUnknowns: string[] = [];

    for (const item of items) {
      if (item.supportLevel !== 'rejected') {
        allConfirmedFacts.push({
          statement: `Extracted ${item.totalLines} lines from "${item.sanitizedFilename}" (${item.category})`,
          source: item.sourceReferences[0] || { source: item.sanitizedFilename, rawSnippet: item.sanitizedFilename },
        });

        if (item.isTruncated && item.truncationReason) {
          allConfirmedFacts.push({
            statement: `Bounded log windowing applied to "${item.sanitizedFilename}": ${item.truncationReason}`,
            source: { source: item.sanitizedFilename, rawSnippet: item.truncationReason },
          });
        }

        if (item.redactedSecrets.length > 0) {
          allConfirmedFacts.push({
            statement: `Sanitized ${item.redactedSecrets.length} secret match(es) from "${item.sanitizedFilename}"`,
            source: { source: item.sanitizedFilename, rawSnippet: `Rules: ${item.redactedSecrets.map((r) => r.ruleName).join(', ')}` },
          });
        }
      } else {
        allUnknowns.push(`Contents of "${item.sanitizedFilename}" could not be ingested (${item.extractionWarnings.join(', ')})`);
      }
    }

    return {
      packageId,
      createdAt: new Date().toISOString(),
      queryPrompt: userPrompt,
      items,
      totalSizeBytes,
      hasTruncatedItems,
      hasSecretsRedacted,
      allConfirmedFacts,
      allInferences,
      allUnknowns,
      warnings: packageWarnings,
    };
  }

  /**
   * Deterministic evidence-based question answering for the Ask DevRelief canvas
   */
  public static answerQuestion(
    pkg: EvidencePackage,
    question: string
  ): {
    summary: string;
    facts: Array<{ statement: string; citation: string }>;
    inferences: Array<{ statement: string; confidence: number; rationale: string }>;
    unknowns: string[];
    suggestedActions: string[];
    markdown: string;
  } {
    const qLower = question.toLowerCase();
    const facts: Array<{ statement: string; citation: string }> = [];
    const inferences: Array<{ statement: string; confidence: number; rationale: string }> = [];
    const unknowns: string[] = [];
    const actions: string[] = [];

    // 1. Scan evidence items for errors and failures
    const errorLines: Array<{ file: string; line: number; text: string }> = [];
    const errorRegex = /\b(?:ERROR|FATAL|EXCEPTION|CRITICAL|FAIL(?:ED)?|exit\s+code\s+[1-9])\b/i;

    for (const item of pkg.items) {
      const lines = item.extractedText.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (errorRegex.test(lines[i])) {
          errorLines.push({
            file: item.sanitizedFilename,
            line: i + 1,
            text: lines[i].trim().slice(0, 120),
          });
          if (errorLines.length >= 10) break;
        }
      }
    }

    if (errorLines.length > 0) {
      const firstErr = errorLines[0];
      facts.push({
        statement: `Primary failure observed in "${firstErr.file}" at line ${firstErr.line}: "${firstErr.text}"`,
        citation: `${firstErr.file}:${firstErr.line}`,
      });

      inferences.push({
        statement: `The failure likely originated during step or module associated with: "${firstErr.text.slice(0, 60)}"`,
        confidence: 0.85,
        rationale: `First occurrence of fatal error signature in log sequence.`,
      });

      actions.push(`Inspect full context in "${firstErr.file}" around line ${firstErr.line}`);
      actions.push(`Run diagnostic command locally: grep -C 5 -i "error" "${firstErr.file}"`);
    } else {
      facts.push({
        statement: `Processed ${pkg.items.length} attachment(s) without encountering fatal error signatures.`,
        citation: `${pkg.items.map((i) => i.sanitizedFilename).join(', ')}`,
      });
      unknowns.push('No explicit stack trace or error keyword found in the provided evidence.');
    }

    // 2. Scan for diff / breaking changes
    const diffItems = pkg.items.filter((i) => i.category === 'diff_patch');
    if (diffItems.length > 0) {
      for (const diff of diffItems) {
        facts.push({
          statement: `Unified diff evidence provided in "${diff.sanitizedFilename}"`,
          citation: diff.sanitizedFilename,
        });
      }
    }

    // 3. Scan for image attachments
    const imageItems = pkg.items.filter((i) => i.category === 'image');
    if (imageItems.length > 0) {
      unknowns.push(
        `Visual image understanding for ${imageItems.map((i) => `"${i.sanitizedFilename}"`).join(', ')} is limited in M2 (visual semantic reasoning deferred to M6). Analysis is grounded in text logs.`
      );
    }

    // 4. Build summary and markdown output
    const summary = errorLines.length > 0
      ? `Identified ${errorLines.length} error signature(s) across ${pkg.items.length} file(s). First failure: ${errorLines[0].text}`
      : `Analyzed ${pkg.items.length} evidence attachment(s) for query: "${question || 'General Inquiry'}"`;

    const md: string[] = [
      `# Ask DevRelief — Evidence-Based Answer`,
      `> Query: "${question || 'General Inquiry'}" | Evidence Items: ${pkg.items.length}`,
      '',
      `### 📋 Executive Summary`,
      summary,
      '',
      `### 🟢 Confirmed Facts (${facts.length})`,
      ...facts.map((f) => `- **[Fact]** ${f.statement} — *Source: \`${f.citation}\`*`),
      '',
      `### 🟡 Inferences & Hypotheses (${inferences.length})`,
      ...inferences.map((inf) => `- **[Inference (${Math.round(inf.confidence * 100)}%)]** ${inf.statement}\n  *Rationale:* ${inf.rationale}`),
      '',
      `### ⚪ Unknowns & Data Limitations (${unknowns.length})`,
      ...unknowns.map((u) => `- ${u}`),
      '',
      `### 💡 Suggested Diagnostic Next Steps`,
      ...actions.map((a) => `- ${a}`),
      '',
      `> **Epistemic Notice:** Findings are strictly grounded in the provided attachments. Unverified hypotheses are labeled accordingly. No remote cloud AI was used.`,
    ];

    return {
      summary,
      facts,
      inferences,
      unknowns,
      suggestedActions: actions,
      markdown: md.join('\n'),
    };
  }
}
