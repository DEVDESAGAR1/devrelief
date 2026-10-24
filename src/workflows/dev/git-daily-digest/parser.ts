/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ParsedCommit, ConventionalCommitType, GitDigestPayload, GitDigestCategory } from './types.ts';
import { SourceReference, InputValidationError } from '../../../types/workflow.ts';

// Hex hash pattern: 7 to 64 hex characters
const HASH_REGEX = /^[0-9a-fA-F]{7,64}$/;

// Conventional commit pattern: type(scope)!: subject
const CONVENTIONAL_REGEX = /^(?<type>[a-zA-Z]+)(?:\((?<scope>[^)]+)\))?(?<breaking>!)?:\s*(?<subject>.*)$/;

// Merge commit pattern
const MERGE_REGEX = /^Merge\s+(?:branch|pull request|remote-tracking branch|tag)\b/i;

const CATEGORY_METADATA: Record<ConventionalCommitType, { title: string; icon: string; description: string }> = {
  feat: { title: 'Features & Capabilities', icon: '🚀', description: 'New features and functional additions' },
  fix: { title: 'Bug Fixes & Defect Remediation', icon: '🐛', description: 'Corrections of bugs, defects, and crashes' },
  docs: { title: 'Documentation & Guides', icon: '📚', description: 'Documentation updates, READMEs, and inline docs' },
  refactor: { title: 'Refactoring & Code Structure', icon: '♻️', description: 'Code restructuring without behavioral change' },
  perf: { title: 'Performance Improvements', icon: '⚡', description: 'Optimizations reducing latency or memory footprint' },
  test: { title: 'Testing & Verification', icon: '🧪', description: 'Unit, integration, or e2e tests' },
  build: { title: 'Build System & Dependencies', icon: '📦', description: 'Package updates, bundler configs, and build scripts' },
  ci: { title: 'CI/CD Pipelines & Automation', icon: '🤖', description: 'GitHub Actions, Jenkins, or deployment configs' },
  chore: { title: 'Chores & Maintenance', icon: '🧹', description: 'Routine repository maintenance and cleanup' },
  merge: { title: 'Branch & Pull Request Merges', icon: '🔀', description: 'Merged branches and integrated pull requests' },
  other: { title: 'Other Commits', icon: '📝', description: 'Commits not following conventional commit syntax' },
};

export class GitLogParser {
  /**
   * Validate raw input prior to full execution
   */
  public static validate(rawText: string): InputValidationError[] {
    const errors: InputValidationError[] = [];

    if (!rawText || rawText.length === 0) {
      errors.push({
        field: 'rawLog',
        message: 'Input is empty. Please provide Git log output.',
      });
      return errors;
    }

    if (rawText.trim().length === 0) {
      errors.push({
        field: 'rawLog',
        message: 'Input contains only whitespace characters.',
      });
      return errors;
    }

    const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
    const hasFourLineRecord = lines.some((line) => HASH_REGEX.test(line));
    const hasStandardCommitRecord = lines.some((line) => /^commit\s+[0-9a-fA-F]{7,64}/i.test(line));

    if (!hasFourLineRecord && !hasStandardCommitRecord) {
      errors.push({
        field: 'rawLog',
        message:
          'No valid Git commit records could be recognized. Supported format: git log --format="%H%n%an%n%aI%n%s" or standard git log output.',
      });
    }

    return errors;
  }

  /**
   * Parse Git log text deterministically into structured commit records
   */
  public static parse(rawText: string, sourceName = 'pasted_git_log'): GitDigestPayload {
    const lines = rawText.split(/\r?\n/);
    const warnings: string[] = [];
    const rawRecords: Array<{
      hash: string;
      author: string;
      date: string;
      subject: string;
      lineStart: number;
      lineEnd: number;
      rawSnippet: string;
    }> = [];

    // Detect if format is standard git log (starts with 'commit <hash>')
    const isStandardGitLog = lines.some((l) => /^commit\s+[0-9a-fA-F]{7,64}/i.test(l.trim()));

    if (isStandardGitLog) {
      this.parseStandardGitLog(lines, rawRecords);
    } else {
      this.parseFourLineFormat(lines, rawRecords, warnings);
    }

    // Process and categorize parsed commit records
    const uniqueCommits: ParsedCommit[] = [];
    const seenHashes = new Set<string>();
    const duplicateHashes: string[] = [];
    let breakingChangesCount = 0;

    const authorCounts = new Map<string, number>();

    for (let i = 0; i < rawRecords.length; i++) {
      const rec = rawRecords[i];
      const normalizedHash = rec.hash.toLowerCase();

      if (seenHashes.has(normalizedHash)) {
        duplicateHashes.push(rec.hash);
        continue;
      }
      seenHashes.add(normalizedHash);

      // Analyze commit subject for conventional classification
      const { type, scope, isBreakingChange, isMergeCommit } = this.classifySubject(rec.subject);

      if (isBreakingChange) {
        breakingChangesCount++;
      }

      // Track author counts
      const authorKey = rec.author.trim() || 'Unknown Author';
      authorCounts.set(authorKey, (authorCounts.get(authorKey) || 0) + 1);

      const sourceRef: SourceReference = {
        source: sourceName,
        recordIndex: i + 1,
        lineStart: rec.lineStart,
        lineEnd: rec.lineEnd,
        commitHash: rec.hash,
        rawSnippet: rec.rawSnippet,
      };

      const parsed: ParsedCommit = {
        hash: rec.hash,
        shortHash: rec.hash.slice(0, 7),
        author: authorKey,
        date: rec.date.trim() || 'Unknown Date',
        rawSubject: rec.subject.trim(),
        type,
        scope,
        isBreakingChange,
        isMergeCommit,
        lineNumber: rec.lineStart,
        sourceReference: sourceRef,
      };

      uniqueCommits.push(parsed);
    }

    // Build grouped categories
    const categoriesMap = new Map<ConventionalCommitType, ParsedCommit[]>();
    for (const commit of uniqueCommits) {
      if (!categoriesMap.has(commit.type)) {
        categoriesMap.set(commit.type, []);
      }
      categoriesMap.get(commit.type)!.push(commit);
    }

    const categories: GitDigestCategory[] = [];
    const orderedTypes: ConventionalCommitType[] = [
      'feat',
      'fix',
      'docs',
      'refactor',
      'perf',
      'test',
      'build',
      'ci',
      'chore',
      'merge',
      'other',
    ];

    for (const t of orderedTypes) {
      const commitsInCat = categoriesMap.get(t);
      if (commitsInCat && commitsInCat.length > 0) {
        const meta = CATEGORY_METADATA[t];
        categories.push({
          type: t,
          title: meta.title,
          icon: meta.icon,
          description: meta.description,
          commits: commitsInCat,
        });
      }
    }

    const authors = Array.from(authorCounts.entries())
      .map(([name, commitCount]) => ({ name, commitCount }))
      .sort((a, b) => b.commitCount - a.commitCount);

    return {
      totalRecordsProcessed: rawRecords.length,
      uniqueCommitsCount: uniqueCommits.length,
      duplicateCommitsCount: duplicateHashes.length,
      breakingChangesCount,
      categories,
      authors,
      uniqueCommits,
      duplicateHashes,
      parsingWarnings: warnings,
    };
  }

  /**
   * Parse 4-line format: %H\n%an\n%aI\n%s
   */
  private static parseFourLineFormat(
    lines: string[],
    records: Array<{
      hash: string;
      author: string;
      date: string;
      subject: string;
      lineStart: number;
      lineEnd: number;
      rawSnippet: string;
    }>,
    warnings: string[]
  ): void {
    let i = 0;
    while (i < lines.length) {
      const line = lines[i].trim();
      if (!line) {
        i++;
        continue;
      }

      // Check if current line is a valid hash
      if (HASH_REGEX.test(line)) {
        const lineStart = i + 1;
        const hash = line;
        const author = lines[i + 1]?.trim() ?? 'Unknown Author';
        const date = lines[i + 2]?.trim() ?? 'Unknown Date';
        const subject = lines[i + 3]?.trim() ?? '(No subject)';
        const lineEnd = Math.min(i + 4, lines.length);

        const rawSnippet = lines.slice(i, i + 4).join('\n');

        records.push({
          hash,
          author,
          date,
          subject,
          lineStart,
          lineEnd,
          rawSnippet,
        });

        i += 4;
      } else {
        warnings.push(`Skipping unrecognized line ${i + 1}: "${line.slice(0, 40)}"`);
        i++;
      }
    }
  }

  /**
   * Parse standard git log format
   */
  private static parseStandardGitLog(
    lines: string[],
    records: Array<{
      hash: string;
      author: string;
      date: string;
      subject: string;
      lineStart: number;
      lineEnd: number;
      rawSnippet: string;
    }>
  ): void {
    let currentHash = '';
    let currentAuthor = '';
    let currentDate = '';
    const currentSubjectLines: string[] = [];
    let startLine = 1;
    const snippetLines: string[] = [];

    const flushCommit = () => {
      if (currentHash) {
        records.push({
          hash: currentHash,
          author: currentAuthor || 'Unknown Author',
          date: currentDate || 'Unknown Date',
          subject: currentSubjectLines.join(' ').trim() || '(No subject)',
          lineStart: startLine,
          lineEnd: startLine + snippetLines.length - 1,
          rawSnippet: snippetLines.join('\n'),
        });
      }
      currentHash = '';
      currentAuthor = '';
      currentDate = '';
      currentSubjectLines.length = 0;
      snippetLines.length = 0;
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      const commitMatch = trimmed.match(/^commit\s+([0-9a-fA-F]{7,64})/i);
      if (commitMatch) {
        flushCommit();
        currentHash = commitMatch[1];
        startLine = i + 1;
        snippetLines.push(line);
      } else if (currentHash) {
        snippetLines.push(line);
        if (trimmed.startsWith('Author:')) {
          currentAuthor = trimmed.replace(/^Author:\s*/i, '').trim();
        } else if (trimmed.startsWith('Date:')) {
          currentDate = trimmed.replace(/^Date:\s*/i, '').trim();
        } else if (trimmed && !trimmed.startsWith('Merge:')) {
          currentSubjectLines.push(trimmed);
        }
      }
    }

    flushCommit();
  }

  /**
   * Classify commit subject into conventional type, scope, and breaking change flag
   */
  private static classifySubject(subject: string): {
    type: ConventionalCommitType;
    scope?: string;
    isBreakingChange: boolean;
    isMergeCommit: boolean;
  } {
    const isMergeCommit = MERGE_REGEX.test(subject);
    if (isMergeCommit) {
      return {
        type: 'merge',
        isBreakingChange: false,
        isMergeCommit: true,
      };
    }

    const match = subject.match(CONVENTIONAL_REGEX);
    const hasBreakingText = /BREAKING[- ]CHANGE:/i.test(subject);

    if (match && match.groups) {
      const rawType = match.groups.type.toLowerCase();
      const scope = match.groups.scope?.trim();
      const isBreakingBang = Boolean(match.groups.breaking);
      const isBreakingChange = isBreakingBang || hasBreakingText;

      let type: ConventionalCommitType = 'other';
      if (rawType === 'feat') type = 'feat';
      else if (rawType === 'fix') type = 'fix';
      else if (rawType === 'docs') type = 'docs';
      else if (rawType === 'refactor') type = 'refactor';
      else if (rawType === 'perf') type = 'perf';
      else if (rawType === 'test') type = 'test';
      else if (rawType === 'build') type = 'build';
      else if (rawType === 'ci') type = 'ci';
      else if (rawType === 'chore') type = 'chore';

      return {
        type,
        scope,
        isBreakingChange,
        isMergeCommit: false,
      };
    }

    return {
      type: 'other',
      isBreakingChange: hasBreakingText,
      isMergeCommit: false,
    };
  }

  /**
   * Generate clean Markdown digest from parsed payload
   */
  public static generateMarkdown(payload: GitDigestPayload, sourceName: string): string {
    const lines: string[] = [];

    lines.push(`# Daily Engineering Activity Digest`);
    lines.push(`> Source: \`${sourceName}\` | Generated: ${new Date().toISOString().split('T')[0]}`);
    lines.push('');

    // Metadata & Epistemic Disclaimer
    lines.push(`### 📋 Executive Summary`);
    lines.push(`- **Unique Commits Analyzed:** ${payload.uniqueCommitsCount}`);
    if (payload.duplicateCommitsCount > 0) {
      lines.push(`- **Duplicate Commits Deduplicated:** ${payload.duplicateCommitsCount}`);
    }
    if (payload.breakingChangesCount > 0) {
      lines.push(`- ⚠️ **Breaking Changes Detected:** ${payload.breakingChangesCount}`);
    }
    lines.push(`- **Active Contributors:** ${payload.authors.map((a) => `${a.name} (${a.commitCount})`).join(', ') || 'None'}`);
    lines.push('');
    lines.push(`> **Epistemic Classification Notice:** Commit hash, author, date, and raw subject are **Confirmed Facts** extracted directly from source metadata. Categorization (Features, Bug Fixes, Refactoring, etc.) is an **Inference** derived solely from commit message prefixes. This digest summarizes commit metadata and does not constitute static code inspection or code quality verification.`);
    lines.push('');

    // Grouped categories
    for (const cat of payload.categories) {
      lines.push(`### ${cat.icon} ${cat.title} (${cat.commits.length})`);
      lines.push('');
      for (const commit of cat.commits) {
        const breakingBadge = commit.isBreakingChange ? ' `[BREAKING]`' : '';
        const scopeBadge = commit.scope ? `**(${commit.scope})** ` : '';
        lines.push(`- [\`${commit.shortHash}\`] ${breakingBadge}${scopeBadge}${commit.rawSubject} — *${commit.author}* (Line ${commit.lineNumber})`);
      }
      lines.push('');
    }

    if (payload.parsingWarnings.length > 0) {
      lines.push(`### ⚠️ Ingestion Warnings`);
      for (const w of payload.parsingWarnings) {
        lines.push(`- ${w}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }
}
