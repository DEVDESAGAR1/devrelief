/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { GitLogParser } from '../src/workflows/dev/git-daily-digest/parser.ts';
import { GitDailyDigestWorkflow } from '../src/workflows/dev/git-daily-digest/workflow.ts';

// Sample 4-line format input matching `git log --format="%H%n%an%n%aI%n%s"`
const SAMPLE_CONVENTIONAL_LOG = `a1b2c3d4e5f67890123456789012345678901234
Alice Engineer
2026-10-24T10:15:30+00:00
feat(auth): implement biometric session authentication

b2c3d4e5f6a17890123456789012345678901235
Bob Developer
2026-10-24T11:20:00+00:00
fix(api): resolve timeout retry loop on 504 gateway errors

c3d4e5f6a1b27890123456789012345678901236
Carol Docs
2026-10-24T12:00:00+00:00
docs: update deployment topology guide and environment variables

d4e5f6a1b2c37890123456789012345678901237
Dave Refactor
2026-10-24T13:45:00+00:00
refactor(engine): streamline pipeline chunking and secret redaction

e5f6a1b2c3d47890123456789012345678901238
Eve Architect
2026-10-24T14:30:00+00:00
feat(billing)!: change subscription tier schema to usage-based

f6a1b2c3d4e57890123456789012345678901239
Frank Lead
2026-10-24T15:00:00+00:00
Merge pull request #42 from acme/feature/auth-refresh

0123456789abcdef0123456789abcdef01234567
Grace Contributor
2026-10-24T16:10:00+00:00
miscellaneous maintenance and cleanup
`;

describe('WF-DEV-01: GitLogParser Unit Tests', () => {
  it('validates and rejects empty or whitespace-only input', () => {
    const emptyErr = GitLogParser.validate('');
    assert.strictEqual(emptyErr.length, 1);
    assert.strictEqual(emptyErr[0].field, 'rawLog');
    assert.match(emptyErr[0].message, /empty/i);

    const whitespaceErr = GitLogParser.validate('   \n\t  \n  ');
    assert.strictEqual(whitespaceErr.length, 1);
    assert.match(whitespaceErr[0].message, /whitespace/i);
  });

  it('validates and rejects completely arbitrary non-git text', () => {
    const randomText = 'The quick brown fox jumps over the lazy dog.\nSome random notes here.';
    const errors = GitLogParser.validate(randomText);
    assert.strictEqual(errors.length, 1);
    assert.match(errors[0].message, /No valid Git commit records/i);
  });

  it('parses valid conventional commits with feat, fix, docs, refactor', () => {
    const payload = GitLogParser.parse(SAMPLE_CONVENTIONAL_LOG, 'sample.log');

    assert.strictEqual(payload.totalRecordsProcessed, 7);
    assert.strictEqual(payload.uniqueCommitsCount, 7);
    assert.strictEqual(payload.duplicateCommitsCount, 0);

    const featCat = payload.categories.find((c) => c.type === 'feat');
    assert.ok(featCat, 'Features category should exist');
    assert.strictEqual(featCat.commits.length, 2);

    const fixCat = payload.categories.find((c) => c.type === 'fix');
    assert.ok(fixCat, 'Bug fixes category should exist');
    assert.strictEqual(fixCat.commits.length, 1);
    assert.strictEqual(fixCat.commits[0].scope, 'api');

    const docsCat = payload.categories.find((c) => c.type === 'docs');
    assert.ok(docsCat, 'Docs category should exist');
    assert.strictEqual(docsCat.commits.length, 1);

    const refactorCat = payload.categories.find((c) => c.type === 'refactor');
    assert.ok(refactorCat, 'Refactor category should exist');
    assert.strictEqual(refactorCat.commits.length, 1);
    assert.strictEqual(refactorCat.commits[0].scope, 'engine');
  });

  it('handles scopes and breaking-change markers correctly', () => {
    const payload = GitLogParser.parse(SAMPLE_CONVENTIONAL_LOG);

    const breakingCommit = payload.uniqueCommits.find(
      (c) => c.hash === 'e5f6a1b2c3d47890123456789012345678901238'
    );
    assert.ok(breakingCommit);
    assert.strictEqual(breakingCommit.isBreakingChange, true);
    assert.strictEqual(breakingCommit.scope, 'billing');
    assert.strictEqual(payload.breakingChangesCount, 1);
  });

  it('detects merge commits and assigns merge type', () => {
    const payload = GitLogParser.parse(SAMPLE_CONVENTIONAL_LOG);

    const mergeCommit = payload.uniqueCommits.find((c) => c.isMergeCommit);
    assert.ok(mergeCommit);
    assert.strictEqual(mergeCommit.type, 'merge');
    assert.strictEqual(mergeCommit.author, 'Frank Lead');
  });

  it('categorizes non-conventional commit messages as other', () => {
    const payload = GitLogParser.parse(SAMPLE_CONVENTIONAL_LOG);

    const otherCat = payload.categories.find((c) => c.type === 'other');
    assert.ok(otherCat);
    assert.strictEqual(otherCat.commits.length, 1);
    assert.strictEqual(otherCat.commits[0].rawSubject, 'miscellaneous maintenance and cleanup');
  });

  it('deterministically deduplicates duplicate commit records', () => {
    const duplicateLog = `${SAMPLE_CONVENTIONAL_LOG}\n${SAMPLE_CONVENTIONAL_LOG}`;
    const payload = GitLogParser.parse(duplicateLog);

    assert.strictEqual(payload.totalRecordsProcessed, 14);
    assert.strictEqual(payload.uniqueCommitsCount, 7);
    assert.strictEqual(payload.duplicateCommitsCount, 7);
    assert.strictEqual(payload.duplicateHashes.length, 7);
  });

  it('preserves exact source references matching the input lines', () => {
    const payload = GitLogParser.parse(SAMPLE_CONVENTIONAL_LOG, 'test-source.log');

    for (const commit of payload.uniqueCommits) {
      assert.strictEqual(commit.sourceReference.source, 'test-source.log');
      assert.strictEqual(commit.sourceReference.commitHash, commit.hash);
      assert.ok(commit.sourceReference.lineStart! > 0);
      assert.ok(commit.sourceReference.lineEnd! >= commit.sourceReference.lineStart!);
      assert.ok(commit.sourceReference.rawSnippet.includes(commit.hash));
    }
  });

  it('produces completely stable output for identical input (determinism)', () => {
    const run1 = GitLogParser.parse(SAMPLE_CONVENTIONAL_LOG);
    const run2 = GitLogParser.parse(SAMPLE_CONVENTIONAL_LOG);

    assert.deepStrictEqual(run1, run2);

    const md1 = GitLogParser.generateMarkdown(run1, 'test');
    const md2 = GitLogParser.generateMarkdown(run2, 'test');
    assert.strictEqual(md1, md2);
  });

  it('supports standard multi-line git log format with commit, Author, Date headers', () => {
    const standardLog = `commit 1234567890abcdef1234567890abcdef12345678
Author: Standard Dev <dev@example.com>
Date:   Sat Oct 24 14:00:00 2026 +0000

    feat(ui): add responsive sidebar toggle

commit 9876543210fedcba9876543210fedcba98765432
Author: Another Dev <another@example.com>
Date:   Sat Oct 24 14:30:00 2026 +0000

    fix(nav): correct mobile z-index
`;

    const payload = GitLogParser.parse(standardLog, 'standard.log');
    assert.strictEqual(payload.uniqueCommitsCount, 2);
    assert.strictEqual(payload.uniqueCommits[0].type, 'feat');
    assert.strictEqual(payload.uniqueCommits[0].scope, 'ui');
    assert.strictEqual(payload.uniqueCommits[1].type, 'fix');
    assert.strictEqual(payload.uniqueCommits[1].scope, 'nav');
  });
});

describe('WF-DEV-01: GitDailyDigestWorkflow Integration Tests', () => {
  it('executes end-to-end and returns structured workflow result with disclaimer', async () => {
    const workflow = new GitDailyDigestWorkflow();
    const validationErrors = workflow.validateInput({ rawLog: SAMPLE_CONVENTIONAL_LOG });
    assert.strictEqual(validationErrors.length, 0);

    const result = await workflow.execute({
      rawLog: SAMPLE_CONVENTIONAL_LOG,
      sourceName: 'repo_head.log',
    });

    assert.strictEqual(result.workflowId, 'WF-DEV-01');
    assert.strictEqual(result.isDeterministic, true);
    assert.strictEqual(result.epistemicRating, 'confirmed_fact');
    assert.strictEqual(result.payload.uniqueCommitsCount, 7);
    assert.ok(result.markdown.includes('# Daily Engineering Activity Digest'));
    assert.ok(result.markdown.includes('Epistemic Classification Notice'));
    assert.strictEqual(result.sourceReferences.length, 7);
    assert.ok(result.disclaimers.length >= 2);
  });
});
