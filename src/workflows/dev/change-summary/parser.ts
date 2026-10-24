/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ChangeSummaryInput, ChangeSummaryPayload, ReleaseNoteItem } from './types.ts';
import { DiffExtractor } from '../../../ingestion/extractors/diff.ts';
import { InputValidationError, SourceReference } from '../../../types/workflow.ts';

export class ChangeSummaryParser {
  /**
   * Validate input for diff or patch records
   */
  public static validate(input: ChangeSummaryInput): InputValidationError[] {
    const errors: InputValidationError[] = [];
    if (!input || !input.rawDiffOrLog || input.rawDiffOrLog.trim().length === 0) {
      errors.push({
        field: 'rawDiffOrLog',
        message: 'Diff or commit log input is empty. Please provide unified diff or patch text.',
      });
      return errors;
    }

    const text = input.rawDiffOrLog;
    const isDiff = text.includes('diff --git') || (text.includes('--- ') && text.includes('+++ '));
    const isGitLog = /commit\s+[0-9a-fA-F]{7,64}/i.test(text) || /^[0-9a-fA-F]{7,64}$/m.test(text);

    if (!isDiff && !isGitLog) {
      errors.push({
        field: 'rawDiffOrLog',
        message:
          'Input does not contain recognized unified diff headers ("diff --git", "---/+++") or Git commit hashes.',
      });
    }

    return errors;
  }

  /**
   * Parse input diff/log and generate release note draft with source attribution
   */
  public static parse(input: ChangeSummaryInput): ChangeSummaryPayload {
    const raw = input.rawDiffOrLog;
    const sourceName = input.sourceName || 'diff_patch';
    const versionTag = input.versionTag || 'vNext-Draft';

    const diffResult = DiffExtractor.extract(raw, sourceName);
    const releaseItems: ReleaseNoteItem[] = [];
    const uncertainties: string[] = [
      'Draft release notes are generated from syntactic diff metadata and commit hunks; human engineering review is required before publication.',
    ];

    if (diffResult.fileChanges.length === 0) {
      uncertainties.push('No file hunks were recognized; summary is inferred strictly from raw text.');
    }

    for (let idx = 0; idx < diffResult.fileChanges.length; idx++) {
      const fc = diffResult.fileChanges[idx];
      const hasBreaking = fc.detectedBreakingChanges.length > 0;
      let category: ReleaseNoteItem['category'] = 'internal';

      if (hasBreaking) {
        category = 'breaking';
      } else if (fc.filePath.startsWith('docs/') || fc.filePath.endsWith('.md')) {
        category = 'docs';
      } else if (
        fc.filePath.endsWith('package.json') ||
        fc.filePath.endsWith('pom.xml') ||
        fc.filePath.endsWith('go.mod') ||
        fc.filePath.endsWith('Cargo.toml')
      ) {
        category = 'dependency';
      } else if (fc.isNew || fc.additions > fc.deletions * 2) {
        category = 'feature';
      } else if (/fix|bug|patch|error/i.test(fc.filePath)) {
        category = 'fix';
      } else if (fc.additions > 0 && fc.deletions > 0) {
        category = 'refactor';
      }

      const sourceRef: SourceReference = {
        source: sourceName,
        lineStart: fc.hunks[0]?.newStart || 1,
        lineEnd: fc.hunks[0]?.newStart ? fc.hunks[0].newStart + (fc.hunks[0].newLines || 1) : 1,
        rawSnippet: `File: ${fc.filePath} (+${fc.additions}/-${fc.deletions})`,
      };

      const title = fc.isNew
        ? `Added new module ${fc.filePath}`
        : fc.isDeleted
        ? `Removed module ${fc.filePath}`
        : `Updated ${fc.filePath}`;

      const desc = hasBreaking
        ? `Potential breaking change: ${fc.detectedBreakingChanges.join('; ')}`
        : `Modified ${fc.hunks.length} hunk(s) with ${fc.additions} addition(s) and ${fc.deletions} deletion(s).`;

      releaseItems.push({
        id: `rel_${idx + 1}`,
        category,
        title,
        description: desc,
        files: [fc.filePath],
        isBreakingChange: hasBreaking,
        sourceReference: sourceRef,
      });
    }

    // Group release items into categories
    const categoriesMap: Record<ReleaseNoteItem['category'], { title: string; icon: string; items: ReleaseNoteItem[] }> = {
      breaking: { title: '⚠️ Breaking Changes', icon: '⚠️', items: [] },
      feature: { title: '🚀 Features & Additions', icon: '🚀', items: [] },
      fix: { title: '🐛 Bug Fixes & Corrections', icon: '🐛', items: [] },
      refactor: { title: '♻️ Refactoring & Improvements', icon: '♻️', items: [] },
      dependency: { title: '📦 Dependency & Build Updates', icon: '📦', items: [] },
      docs: { title: '📚 Documentation', icon: '📚', items: [] },
      internal: { title: '🧹 Internal Changes', icon: '🧹', items: [] },
    };

    for (const item of releaseItems) {
      categoriesMap[item.category].items.push(item);
    }

    const categorizedItems = Object.entries(categoriesMap)
      .filter(([_, group]) => group.items.length > 0)
      .map(([cat, group]) => ({
        category: cat as ReleaseNoteItem['category'],
        title: group.title,
        icon: group.icon,
        items: group.items,
      }));

    // Build draft release notes markdown
    const md: string[] = [
      `# Release Notes — ${versionTag}`,
      `> Generated from unified diff evidence in \`${sourceName}\` | Total files changed: ${diffResult.totalFiles} (+${diffResult.totalAdditions}/-${diffResult.totalDeletions})`,
      '',
      `### 📋 Overview`,
      `- **Total Modified Files:** ${diffResult.totalFiles}`,
      `- **Net Line Changes:** +${diffResult.totalAdditions} / -${diffResult.totalDeletions}`,
      diffResult.breakingChangesCount > 0 ? `- ⚠️ **Potential Breaking Changes Detected:** ${diffResult.breakingChangesCount}` : '- **Breaking Changes:** None detected in diff hunks.',
      '',
    ];

    for (const group of categorizedItems) {
      md.push(`### ${group.title} (${group.items.length})`);
      for (const item of group.items) {
        md.push(`- **${item.title}:** ${item.description} *(Files: \`${item.files.join('`, `')}\`)*`);
      }
      md.push('');
    }

    md.push('### ⚠️ Uncertainties & Limitations');
    for (const u of uncertainties) {
      md.push(`- ${u}`);
    }
    md.push('');
    md.push('> **Review Required:** This draft was generated deterministically from diff syntax and commit records. Please verify user-facing descriptions before publishing.');

    return {
      versionTag,
      totalFilesChanged: diffResult.totalFiles,
      totalAdditions: diffResult.totalAdditions,
      totalDeletions: diffResult.totalDeletions,
      breakingChangesCount: diffResult.breakingChangesCount,
      fileChanges: diffResult.fileChanges,
      categorizedItems,
      draftReleaseNotes: md.join('\n'),
      uncertainties,
    };
  }
}
