/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { MultimodalIngestionPipeline } from '../src/ingestion/pipeline.ts';
import { FileValidator } from '../src/ingestion/validation.ts';
import { SecretScanner } from '../src/ingestion/secrets.ts';
import { TextExtractor } from '../src/ingestion/extractors/text.ts';
import { DiffExtractor } from '../src/ingestion/extractors/diff.ts';
import { DataExtractor } from '../src/ingestion/extractors/data.ts';

describe('M2 Ingestion: FileValidator & Signature Tests', () => {
  it('sanitizes dangerous filenames and path traversals', () => {
    assert.strictEqual(FileValidator.sanitizeFilename('../../etc/passwd'), 'passwd');
    assert.strictEqual(FileValidator.sanitizeFilename('C:\\Windows\\System32\\cmd.exe'), 'cmd.exe');
    assert.strictEqual(FileValidator.sanitizeFilename('safe_name.log'), 'safe_name.log');
    assert.strictEqual(FileValidator.sanitizeFilename('file"with$bad;chars.txt'), 'file_with_bad_chars.txt');
  });

  it('rejects empty (0 byte) files with descriptive error', () => {
    const res = FileValidator.validateFile('empty.txt', 0);
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.rejectReason, 'EMPTY_FILE');
    assert.match(res.error!, /empty \(0 bytes\)/i);
  });

  it('rejects files exceeding the 50 MB absolute size limit', () => {
    const res = FileValidator.validateFile('huge.log', 51 * 1024 * 1024);
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.rejectReason, 'EXCEEDS_SIZE_LIMIT');
  });

  it('rejects executable binary signatures (MZ / PE and ELF)', () => {
    // Windows MZ header: 4D 5A
    const mzHeader = new Uint8Array([0x4d, 0x5a, 0x90, 0x00]);
    const mzRes = FileValidator.validateFile('trojan.exe', 1024, mzHeader);
    assert.strictEqual(mzRes.valid, false);
    assert.strictEqual(mzRes.rejectReason, 'EXECUTABLE_PROHIBITED');

    // Linux ELF header: 7F 45 4C 46
    const elfHeader = new Uint8Array([0x7f, 0x45, 0x4c, 0x46]);
    const elfRes = FileValidator.validateFile('payload.bin', 1024, elfHeader);
    assert.strictEqual(elfRes.valid, false);
    assert.strictEqual(elfRes.rejectReason, 'EXECUTABLE_PROHIBITED');
  });

  it('rejects direct archive files (ZIP, GZ) to prevent archive bombs', () => {
    const zipHeader = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
    const zipRes = FileValidator.validateFile('archive.zip', 2048, zipHeader);
    assert.strictEqual(zipRes.valid, false);
    assert.strictEqual(zipRes.rejectReason, 'ARCHIVE_PROHIBITED');
  });
});

describe('M2 Ingestion: SecretScanner Tests', () => {
  it('detects and redacts AWS keys, GitHub PATs, and Bearer tokens', () => {
    const sensitiveText = [
      'Configuring production environment:',
      'export AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE',
      'aws_secret_access_key = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"',
      'Authorization: Bearer ya29.a0AfH6SMBabc123456789xyz',
      'GITHUB_TOKEN=ghp_1234567890abcdefghijklmnopqrstuvwxyzAB',
      'All credentials configured.',
    ].join('\n');

    const result = SecretScanner.scanAndRedact(sensitiveText);
    assert.strictEqual(result.hasRedactions, true);
    assert.ok(result.matches.length >= 4);

    assert.ok(result.sanitizedText.includes('[REDACTED_AWS_ACCESS_KEY_ID]'));
    assert.ok(result.sanitizedText.includes('[REDACTED_AWS_SECRET_KEY]'));
    assert.ok(result.sanitizedText.includes('[REDACTED_BEARER_TOKEN]'));
    assert.ok(result.sanitizedText.includes('[REDACTED_GITHUB_TOKEN]'));

    // Ensure raw secrets do not remain in sanitized output
    assert.ok(!result.sanitizedText.includes('AKIAIOSFODNN7EXAMPLE'));
    assert.ok(!result.sanitizedText.includes('wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'));
  });

  it('handles clean text without false positives', () => {
    const cleanText = 'Standard engineering log without any tokens or keys.\nEverything normal.';
    const result = SecretScanner.scanAndRedact(cleanText);
    assert.strictEqual(result.hasRedactions, false);
    assert.strictEqual(result.matches.length, 0);
    assert.strictEqual(result.sanitizedText, cleanText);
  });
});

describe('M2 Ingestion: Extractors & Windowing Tests', () => {
  it('applies bounded log windowing for logs exceeding threshold', () => {
    // Generate 6,000 lines log with an error in the middle
    const lines: string[] = [];
    for (let i = 1; i <= 6000; i++) {
      if (i === 2500) {
        lines.push('FATAL: Database connection timeout in auth pool');
      } else {
        lines.push(`Line ${i}: normal operational heartbeat`);
      }
    }
    const rawLog = lines.join('\n');

    const result = TextExtractor.extract(rawLog, 'server.log');
    assert.strictEqual(result.isTruncated, true);
    assert.strictEqual(result.totalLines, 6000);
    assert.ok(result.truncationReason);
    assert.ok(result.extractedText.includes('LOG HEAD: Lines 1 to 500'));
    assert.ok(result.extractedText.includes('LOG TAIL: Lines 3001 to 6000'));
    assert.ok(result.extractedText.includes('FATAL: Database connection timeout in auth pool'));
    assert.ok(result.extractedText.includes('lines elided to preserve performance'));
  });

  it('parses unified diffs with added and deleted lines and breaking change signals', () => {
    const diffSample = `diff --git a/src/auth.ts b/src/auth.ts
index 1234567..89abcdef 100644
--- a/src/auth.ts
+++ b/src/auth.ts
@@ -10,3 +10,4 @@
-export function oldLogin() { return false; }
+export function newBiometricLogin() { return true; }
+export function verifySession() { return true; }
`;

    const result = DiffExtractor.extract(diffSample, 'auth.diff');
    assert.strictEqual(result.totalFiles, 1);
    assert.strictEqual(result.fileChanges[0].filePath, 'src/auth.ts');
    assert.strictEqual(result.fileChanges[0].additions, 2);
    assert.strictEqual(result.fileChanges[0].deletions, 1);
    assert.ok(result.fileChanges[0].detectedBreakingChanges.length > 0);
    assert.ok(result.fileChanges[0].detectedBreakingChanges[0].includes('Deleted export/schema'));
  });

  it('handles malformed JSON and CSV safely without throwing', () => {
    const badJson = '{ invalid: json without quotes or braces ';
    const jsonRes = DataExtractor.extract(badJson, 'bad.json', 'json');
    assert.ok(jsonRes.warnings.length > 0);
    assert.ok(jsonRes.extractedText.includes('Malformed JSON'));

    const csvSample = 'id,name,role\n1,Alice,Dev\n2,Bob,QA';
    const csvRes = DataExtractor.extract(csvSample, 'team.csv', 'csv');
    assert.strictEqual(csvRes.rowCount, 2);
    assert.deepStrictEqual(csvRes.columnNames, ['id', 'name', 'role']);
  });
});

describe('M2 Ingestion: Multimodal Pipeline Integration Tests', () => {
  it('processes multiple heterogenous attachments and constructs EvidencePackage with secret redaction', async () => {
    const pipeline = new MultimodalIngestionPipeline();

    const inputs = [
      {
        filename: 'pipeline_failure.log',
        content: '2026-10-24 10:00:00 [INFO] Starting build\n2026-10-24 10:01:00 [ERROR] Non-resolvable parent POM\nToken: Bearer secret1234567890abcdef',
      },
      {
        filename: 'changes.diff',
        content: '--- a/pom.xml\n+++ b/pom.xml\n@@ -1,2 +1,2 @@\n-<version>0.4.1</version>\n+<version>0.4.2-SNAPSHOT</version>',
      },
    ];

    const pkg = await pipeline.process(inputs, 'Why did the pipeline fail?');
    assert.strictEqual(pkg.items.length, 2);
    assert.strictEqual(pkg.hasSecretsRedacted, true);

    const logItem = pkg.items.find((i) => i.sanitizedFilename === 'pipeline_failure.log');
    assert.ok(logItem);
    assert.ok(logItem.extractedText.includes('[REDACTED_BEARER_TOKEN]'));
    assert.ok(!logItem.extractedText.includes('secret1234567890abcdef'));

    // Test deterministic Q&A synthesis
    const answer = MultimodalIngestionPipeline.answerQuestion(pkg, 'Why did the pipeline fail?');
    assert.ok(answer.facts.length > 0);
    assert.ok(answer.facts[0].statement.includes('Non-resolvable parent POM'));
    assert.strictEqual(answer.facts[0].citation, 'pipeline_failure.log:2');
    assert.ok(answer.inferences.length > 0);
    assert.ok(answer.markdown.includes('# Ask DevRelief — Evidence-Based Answer'));
  });
});
