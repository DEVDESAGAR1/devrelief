/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SourceReference } from '../../types/workflow.ts';

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  heading?: string;
  addedLines: Array<{ lineNum: number; content: string }>;
  deletedLines: Array<{ lineNum: number; content: string }>;
}

export interface DiffFileChange {
  filePath: string;
  oldPath?: string;
  isNew: boolean;
  isDeleted: boolean;
  isBinary: boolean;
  additions: number;
  deletions: number;
  hunks: DiffHunk[];
  detectedBreakingChanges: string[];
}

export interface DiffExtractionResult {
  extractedText: string;
  totalFiles: number;
  totalAdditions: number;
  totalDeletions: number;
  fileChanges: DiffFileChange[];
  breakingChangesCount: number;
  sourceReferences: SourceReference[];
  warnings: string[];
}

export class DiffExtractor {
  /**
   * Parse unified diff or patch text into structured file changes and hunk metadata
   */
  public static extract(rawDiff: string, filename: string): DiffExtractionResult {
    const lines = rawDiff.split(/\r?\n/);
    const fileChanges: DiffFileChange[] = [];
    const warnings: string[] = [];
    const sourceReferences: SourceReference[] = [];

    let currentFile: DiffFileChange | null = null;
    let currentHunk: DiffHunk | null = null;
    let oldLineCursor = 0;
    let newLineCursor = 0;

    const flushFile = () => {
      if (currentFile) {
        fileChanges.push(currentFile);
      }
      currentFile = null;
      currentHunk = null;
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // File header: diff --git a/file b/file or --- a/file / +++ b/file
      const gitDiffMatch = line.match(/^diff --git a\/(.+?) b\/(.+)$/);
      const isTraditionalHeader =
        line.startsWith('--- ') &&
        lines[i + 1]?.startsWith('+++ ') &&
        (!currentFile || currentFile.hunks.length > 0);

      if (gitDiffMatch || isTraditionalHeader) {
        flushFile();

        let filePath = 'unknown_file';
        const isBinary = false;

        if (gitDiffMatch) {
          filePath = gitDiffMatch[2].trim();
        } else if (isTraditionalHeader) {
          const plusLine = lines[i + 1];
          filePath = plusLine.replace(/^\+\+\+ (?:b\/)?/, '').trim();
        }

        currentFile = {
          filePath,
          isNew: false,
          isDeleted: false,
          isBinary,
          additions: 0,
          deletions: 0,
          hunks: [],
          detectedBreakingChanges: [],
        };

        sourceReferences.push({
          source: filename,
          lineStart: i + 1,
          lineEnd: i + 1,
          rawSnippet: line,
        });
        continue;
      }

      if (!currentFile) {
        // Look for standalone +++ b/file headers
        if (line.startsWith('+++ b/')) {
          currentFile = {
            filePath: line.replace(/^\+\+\+ b\//, '').trim(),
            isNew: false,
            isDeleted: false,
            isBinary: false,
            additions: 0,
            deletions: 0,
            hunks: [],
            detectedBreakingChanges: [],
          };
        }
        continue;
      }

      // Check binary file indicator
      if (line.includes('Binary files ') && line.includes('differ')) {
        currentFile.isBinary = true;
        warnings.push(`File "${currentFile.filePath}" is a binary file; contents cannot be inspected via text diff.`);
        continue;
      }

      // Check new/deleted file flags
      if (line.startsWith('new file mode')) {
        currentFile.isNew = true;
      } else if (line.startsWith('deleted file mode')) {
        currentFile.isDeleted = true;
      }

      // Hunk header: @@ -oldStart,oldLines +newStart,newLines @@ heading
      const hunkMatch = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/);
      if (hunkMatch) {
        const oldStart = parseInt(hunkMatch[1], 10);
        const oldLines = hunkMatch[2] ? parseInt(hunkMatch[2], 10) : 1;
        const newStart = parseInt(hunkMatch[3], 10);
        const newLines = hunkMatch[4] ? parseInt(hunkMatch[4], 10) : 1;
        const heading = hunkMatch[5]?.trim();

        currentHunk = {
          oldStart,
          oldLines,
          newStart,
          newLines,
          heading,
          addedLines: [],
          deletedLines: [],
        };
        currentFile.hunks.push(currentHunk);

        oldLineCursor = oldStart;
        newLineCursor = newStart;
        continue;
      }

      // Line content within a hunk
      if (currentHunk) {
        if (line.startsWith('+') && !line.startsWith('+++')) {
          const content = line.slice(1);
          currentHunk.addedLines.push({ lineNum: newLineCursor, content });
          currentFile.additions++;
          newLineCursor++;
        } else if (line.startsWith('-') && !line.startsWith('---')) {
          const content = line.slice(1);
          currentHunk.deletedLines.push({ lineNum: oldLineCursor, content });
          currentFile.deletions++;

          // Scan deleted line for potential breaking change signatures
          if (
            /\b(?:export\s+(?:default\s+)?(?:function|class|const|interface|type)|DROP\s+TABLE|ALTER\s+TABLE|DELETE\s+FROM)\b/.test(
              content
            )
          ) {
            currentFile.detectedBreakingChanges.push(
              `Deleted export/schema at line ${oldLineCursor}: "${content.trim().slice(0, 80)}"`
            );
          }

          oldLineCursor++;
        } else if (line.startsWith(' ')) {
          oldLineCursor++;
          newLineCursor++;
        }
      }
    }

    flushFile();

    let totalAdditions = 0;
    let totalDeletions = 0;
    let breakingChangesCount = 0;

    for (const fc of fileChanges) {
      totalAdditions += fc.additions;
      totalDeletions += fc.deletions;
      breakingChangesCount += fc.detectedBreakingChanges.length;
    }

    // Build structured text summary
    const summaryLines: string[] = [
      `--- Unified Git Diff Summary (${fileChanges.length} files changed, +${totalAdditions} / -${totalDeletions}) ---`,
    ];

    for (const fc of fileChanges) {
      const statusTag = fc.isNew ? '[NEW]' : fc.isDeleted ? '[DELETED]' : fc.isBinary ? '[BINARY]' : '[MODIFIED]';
      summaryLines.push(`* ${statusTag} ${fc.filePath} (+${fc.additions}/-${fc.deletions})`);
      if (fc.detectedBreakingChanges.length > 0) {
        for (const bc of fc.detectedBreakingChanges) {
          summaryLines.push(`  ⚠️ BREAKING CHANGE SIGNAL: ${bc}`);
        }
      }
    }

    return {
      extractedText: summaryLines.join('\n') + '\n\n' + rawDiff,
      totalFiles: fileChanges.length,
      totalAdditions,
      totalDeletions,
      fileChanges,
      breakingChangesCount,
      sourceReferences,
      warnings,
    };
  }
}
