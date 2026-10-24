/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { InputValidationError, SourceReference } from '../../../types/workflow.ts';
import {
  AmbiguityScannerInput,
  AmbiguityScannerPayload,
  AmbiguityFinding,
  AmbiguityCategory,
  AmbiguitySeverity,
} from './types.ts';

const VAGUE_TERMS: { pattern: RegExp; term: string; suggestedMetric: string }[] = [
  { pattern: /\b(user-friendly|intuitive|easy to use|simple to use)\b/i, term: 'user-friendly / intuitive', suggestedMetric: 'Specify usability metrics (e.g. SUS score > 80, or task completion rate in usability testing).' },
  { pattern: /\b(fast|speedy|quick|instant|instantly)\b/i, term: 'fast / instantly', suggestedMetric: 'Specify latency threshold (e.g. p95 response time < 200ms at 500 req/sec).' },
  { pattern: /\b(scalable|high-performance|high capacity)\b/i, term: 'scalable / high-performance', suggestedMetric: 'Specify explicit scale target (e.g. support 10,000 concurrent active users with < 1% CPU throttle).' },
  { pattern: /\b(periodically|regularly|from time to time)\b/i, term: 'periodically / regularly', suggestedMetric: 'Specify exact recurrence interval (e.g. every 15 minutes, or daily at 02:00 UTC).' },
  { pattern: /\b(as appropriate|as needed|if necessary|when required)\b/i, term: 'as appropriate / as needed', suggestedMetric: 'Define explicit conditional trigger or business rule determining when the action executes.' },
  { pattern: /\b(etc\.?|and so on|and more)\b/i, term: 'etc. / and so on', suggestedMetric: 'Enumerate the complete exhaustive list of allowed options or states.' },
  { pattern: /\b(robust|reliable|seamless|seamlessly)\b/i, term: 'robust / seamless', suggestedMetric: 'Define SLA/SLO uptime target (e.g. 99.9% availability, 0 data loss on failure).' },
];

export class AmbiguityScanner {
  public static validate(input: AmbiguityScannerInput): InputValidationError[] {
    const errors: InputValidationError[] = [];
    if (!input || input.specText === undefined || input.specText === null || typeof input.specText !== 'string') {
      errors.push({
        field: 'specText',
        message: 'Specification text is required and must be a string.',
      });
      return errors;
    }

    if (input.specText.trim().length === 0) {
      errors.push({
        field: 'specText',
        message: 'Specification text cannot be empty or whitespace-only.',
      });
      return errors;
    }

    if (input.specText.trim().length < 20) {
      errors.push({
        field: 'specText',
        message: 'Specification text is too brief to analyze for ambiguity (minimum 20 characters).',
      });
    }

    return errors;
  }

  public static scan(input: AmbiguityScannerInput): AmbiguityScannerPayload {
    const sourceName = input.sourceName || 'requirements_spec.md';
    const documentTitle = input.documentTitle || 'Specification Document';
    const lines = input.specText.split('\n');

    const findings: AmbiguityFinding[] = [];
    let counter = 1;

    const categoryCounts: Record<AmbiguityCategory, number> = {
      vague_quantifier: 0,
      missing_acceptance_criteria: 0,
      unspecified_actor_or_outcome: 0,
      missing_error_handling: 0,
      contradiction: 0,
      undefined_term: 0,
      unresolved_dependency: 0,
      missing_permissions_or_privacy: 0,
    };

    const severityCounts = { high: 0, medium: 0, low: 0 };

    // Pass 1: Line-by-line lexical and pattern scans
    lines.forEach((line, index) => {
      const lineNum = index + 1;
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;

      // 1. Vague quantifiers
      for (const item of VAGUE_TERMS) {
        if (item.pattern.test(trimmed)) {
          const findingId = `AMB-${String(counter++).padStart(2, '0')}`;
          const finding: AmbiguityFinding = {
            id: findingId,
            category: 'vague_quantifier',
            categoryLabel: 'Vague / Subjective Language',
            sourceExcerpt: trimmed,
            lineStart: lineNum,
            explanation: `Contains subjective or unquantified term "${item.term}". Subjective criteria cannot be automatically verified in automated tests.`,
            potentialImpact: 'Developers and QA engineers will interpret requirements differently, leading to rework or disputed acceptance testing.',
            severity: 'medium',
            severityReason: 'Subjective phrasing risks divergent implementation and test verification disagreements.',
            clarificationQuestion: `What exact numerical threshold or objective metric defines "${item.term}" in this context?`,
            suggestedRewrite: `[Proposal]: ${item.suggestedMetric}`,
            confidence: 'high',
            limitations: 'Lexical regex match on known subjective terms.',
            sourceReferences: [
              {
                source: sourceName,
                lineStart: lineNum,
                lineEnd: lineNum,
                rawSnippet: trimmed,
              },
            ],
          };
          findings.push(finding);
          categoryCounts.vague_quantifier++;
          severityCounts.medium++;
          break; // Avoid multi-matching the same line for vague terms
        }
      }

      // 2. Unresolved dependencies (TBD, TODO, Pending)
      if (/\b(TBD|TODO|pending api|pending design|to be determined|out of scope for v1)\b/i.test(trimmed)) {
        const findingId = `AMB-${String(counter++).padStart(2, '0')}`;
        const finding: AmbiguityFinding = {
          id: findingId,
          category: 'unresolved_dependency',
          categoryLabel: 'Unresolved Dependency or Placeholder',
          sourceExcerpt: trimmed,
          lineStart: lineNum,
          explanation: 'Contains placeholder marker indicating an unresolved decision or external dependency.',
          potentialImpact: 'Execution will block during implementation when the missing specification is encountered.',
          severity: 'high',
          severityReason: 'Unresolved placeholders directly halt developer workflow and sprint delivery.',
          clarificationQuestion: 'Who owns finalizing this placeholder, and what is the deadline before sprint start?',
          suggestedRewrite: '[Proposal]: Replace placeholder with verified external contract or remove from scope.',
          confidence: 'high',
          limitations: 'Explicit placeholder token detected.',
          sourceReferences: [
            {
              source: sourceName,
              lineStart: lineNum,
              lineEnd: lineNum,
              rawSnippet: trimmed,
            },
          ],
        };
        findings.push(finding);
        categoryCounts.unresolved_dependency++;
        severityCounts.high++;
      }

      // 3. Unspecified actor / passive voice
      if (/\b(it shall be processed|data will be sent|information is saved|will be calculated|should be updated)\b/i.test(trimmed) &&
          !/\b(user|admin|system|worker|service|cron|daemon|database)\b/i.test(trimmed)) {
        const findingId = `AMB-${String(counter++).padStart(2, '0')}`;
        const finding: AmbiguityFinding = {
          id: findingId,
          category: 'unspecified_actor_or_outcome',
          categoryLabel: 'Unspecified Actor or Precondition',
          sourceExcerpt: trimmed,
          lineStart: lineNum,
          explanation: 'Uses passive phrasing without naming the responsible subsystem, actor, or trigger event.',
          potentialImpact: 'Unclear component ownership; frontend and backend teams may assume the other is responsible.',
          severity: 'medium',
          severityReason: 'Missing actor creates cross-team integration ambiguity.',
          clarificationQuestion: 'Which specific component or service executes this action, and what triggers it?',
          suggestedRewrite: `[Proposal]: Explicitly specify "[Actor/Service] shall [action] when [trigger event] occurs."`,
          confidence: 'medium',
          limitations: 'Heuristic passive voice match without grammatical parse tree.',
          sourceReferences: [
            {
              source: sourceName,
              lineStart: lineNum,
              lineEnd: lineNum,
              rawSnippet: trimmed,
            },
          ],
        };
        findings.push(finding);
        categoryCounts.unspecified_actor_or_outcome++;
        severityCounts.medium++;
      }

      // 4. Missing permissions or security context on sensitive actions
      if (/\b(delete user|wipe database|export all records|modify permissions|reset account)\b/i.test(trimmed) &&
          !/\b(admin|role|authorized|permission|rbac|mfa)\b/i.test(trimmed)) {
        const findingId = `AMB-${String(counter++).padStart(2, '0')}`;
        const finding: AmbiguityFinding = {
          id: findingId,
          category: 'missing_permissions_or_privacy',
          categoryLabel: 'Missing Authorization / Access Control',
          sourceExcerpt: trimmed,
          lineStart: lineNum,
          explanation: 'Specifies destructive or high-privilege action without defining required role or authorization check.',
          potentialImpact: 'Security risk if developers expose functionality to standard or unauthenticated users.',
          severity: 'high',
          severityReason: 'Unspecified authorization on destructive actions is a security liability.',
          clarificationQuestion: 'Which roles are permitted to perform this action, and is MFA required?',
          suggestedRewrite: '[Proposal]: Restrict to verified Admin role with required confirmation audit log.',
          confidence: 'high',
          limitations: 'Keyword match on privileged verbs.',
          sourceReferences: [
            {
              source: sourceName,
              lineStart: lineNum,
              lineEnd: lineNum,
              rawSnippet: trimmed,
            },
          ],
        };
        findings.push(finding);
        categoryCounts.missing_permissions_or_privacy++;
        severityCounts.high++;
      }

      // 5. Missing error handling on network / payment / external integration
      if (/\b(payment|credit card|checkout|external api|third-party webhook|file upload)\b/i.test(trimmed) &&
          !/\b(fail|error|retry|timeout|abort|exception|reject)\b/i.test(trimmed)) {
        const findingId = `AMB-${String(counter++).padStart(2, '0')}`;
        const finding: AmbiguityFinding = {
          id: findingId,
          category: 'missing_error_handling',
          categoryLabel: 'Missing Error Handling or Edge Case',
          sourceExcerpt: trimmed,
          lineStart: lineNum,
          explanation: 'Mentions error-prone external integration or payment without defining timeout, retry, or failure behavior.',
          potentialImpact: 'Unhandled edge cases cause unhandled UI crashes or stuck processing states in production.',
          severity: 'high',
          severityReason: 'External calls fail frequently in real-world networks; failure states must be specified.',
          clarificationQuestion: 'What should happen if the external operation times out or returns an error?',
          suggestedRewrite: '[Proposal]: Specify: "On network timeout (>5s), display retry prompt and do not bill the customer."',
          confidence: 'medium',
          limitations: 'Heuristic check for error vocabulary in external integration context.',
          sourceReferences: [
            {
              source: sourceName,
              lineStart: lineNum,
              lineEnd: lineNum,
              rawSnippet: trimmed,
            },
          ],
        };
        findings.push(finding);
        categoryCounts.missing_error_handling++;
        severityCounts.high++;
      }
    });

    // Pass 2: Cross-statement contradiction detection
    // Look for statements that directly contradict each other
    for (let i = 0; i < lines.length; i++) {
      const lineA = lines[i].trim();
      if (!lineA) continue;

      for (let j = i + 1; j < lines.length; j++) {
        const lineB = lines[j].trim();
        if (!lineB) continue;

        // Check for retention contradictions (e.g. 30 days vs 90 days)
        const daysMatchA = lineA.match(/retain.*?\b(\d+)\s*days/i);
        const daysMatchB = lineB.match(/retain.*?\b(\d+)\s*days/i);
        if (daysMatchA && daysMatchB && daysMatchA[1] !== daysMatchB[1]) {
          const findingId = `AMB-${String(counter++).padStart(2, '0')}`;
          const finding: AmbiguityFinding = {
            id: findingId,
            category: 'contradiction',
            categoryLabel: 'Direct Contradiction in Requirements',
            sourceExcerpt: `Statement A (line ${i + 1}): "${lineA}"`,
            secondaryExcerpt: `Statement B (line ${j + 1}): "${lineB}"`,
            lineStart: i + 1,
            secondaryLine: j + 1,
            explanation: `Found contradictory retention limits: ${daysMatchA[1]} days vs ${daysMatchB[1]} days across two different statements.`,
            potentialImpact: 'Engineering cannot determine which retention lifecycle rule to enforce in the database.',
            severity: 'high',
            severityReason: 'Direct contradiction makes implementation logically impossible without stakeholder resolution.',
            clarificationQuestion: `Which retention period is correct: ${daysMatchA[1]} days or ${daysMatchB[1]} days?`,
            suggestedRewrite: `[Proposal]: Reconcile both statements to the approved compliance retention standard.`,
            confidence: 'high',
            limitations: 'Deterministic numeric comparison across retention statements.',
            sourceReferences: [
              { source: sourceName, lineStart: i + 1, lineEnd: i + 1, rawSnippet: lineA },
              { source: sourceName, lineStart: j + 1, lineEnd: j + 1, rawSnippet: lineB },
            ],
          };
          findings.push(finding);
          categoryCounts.contradiction++;
          severityCounts.high++;
        }

        // Check for access contradictions (e.g. "all users can view" vs "only admins can view")
        if (/\ball users can\b/i.test(lineA) && /\bonly admins can\b/i.test(lineB)) {
          const findingId = `AMB-${String(counter++).padStart(2, '0')}`;
          const finding: AmbiguityFinding = {
            id: findingId,
            category: 'contradiction',
            categoryLabel: 'Direct Contradiction in Access Rules',
            sourceExcerpt: `Statement A (line ${i + 1}): "${lineA}"`,
            secondaryExcerpt: `Statement B (line ${j + 1}): "${lineB}"`,
            lineStart: i + 1,
            secondaryLine: j + 1,
            explanation: 'Contradiction between universal user access and administrator-only restriction for the same capability.',
            potentialImpact: 'Incorrect permission enforcement leading to either security exposure or customer lockout.',
            severity: 'high',
            severityReason: 'Direct authorization contradiction.',
            clarificationQuestion: 'Should this capability be accessible by all authenticated users or restricted strictly to Admins?',
            suggestedRewrite: '[Proposal]: Define explicit RBAC matrix specifying view vs edit permissions per role.',
            confidence: 'high',
            limitations: 'Detected opposing scope qualifiers.',
            sourceReferences: [
              { source: sourceName, lineStart: i + 1, lineEnd: i + 1, rawSnippet: lineA },
              { source: sourceName, lineStart: j + 1, lineEnd: j + 1, rawSnippet: lineB },
            ],
          };
          findings.push(finding);
          categoryCounts.contradiction++;
          severityCounts.high++;
        }
      }
    }

    const severityRubric =
      'SEVERITY RUBRIC: HIGH = Direct contradictions, missing error states on critical flows, security/permission omissions, or blocking placeholders. MEDIUM = Subjective terms, unquantified performance targets, or passive unspecified actors. LOW = Minor terminology ambiguity or non-critical formatting suggestions.';

    const disclaimer =
      'Deterministic lexical and pattern analysis. Flags represent potential requirement risks based on verifiable textual evidence; this tool does not guarantee 100% formal requirements completeness or semantic domain coverage.';

    const payload: AmbiguityScannerPayload = {
      documentTitle,
      totalLinesAnalyzed: lines.length,
      totalFindings: findings.length,
      severityCounts,
      categoryCounts,
      findings,
      severityRubric,
      disclaimer,
      markdown: '',
    };

    payload.markdown = AmbiguityScanner.renderMarkdown(payload);
    return payload;
  }

  private static renderMarkdown(payload: AmbiguityScannerPayload): string {
    const md: string[] = [];
    md.push(`# Requirements Ambiguity Report: ${payload.documentTitle}`);
    md.push('');
    md.push(`> ℹ️ ${payload.disclaimer}`);
    md.push('');
    md.push(`- **Lines Analyzed:** ${payload.totalLinesAnalyzed}`);
    md.push(`- **Total Findings Flagged:** ${payload.totalFindings}`);
    md.push(`- **High Severity:** ${payload.severityCounts.high} | **Medium Severity:** ${payload.severityCounts.medium} | **Low Severity:** ${payload.severityCounts.low}`);
    md.push('');
    md.push(`**${payload.severityRubric}**`);
    md.push('');
    md.push('---');
    md.push('');

    if (payload.findings.length === 0) {
      md.push('### ✅ No Ambiguity Findings Detected');
      md.push('The provided specification text does not contain recognized vague quantifiers, placeholders, or immediate contradictions based on deterministic pattern matching.');
      return md.join('\n');
    }

    payload.findings.forEach((f) => {
      md.push(`### [${f.id}] ${f.categoryLabel} (${f.severity.toUpperCase()})`);
      md.push(`- **Source Excerpt:** \`${f.sourceExcerpt}\` (Line ${f.lineStart})`);
      if (f.secondaryExcerpt) {
        md.push(`- **Conflicting Excerpt:** \`${f.secondaryExcerpt}\` (Line ${f.secondaryLine})`);
      }
      md.push(`- **Explanation:** ${f.explanation}`);
      md.push(`- **Potential Impact:** ${f.potentialImpact}`);
      md.push(`- **Clarification Question:** ❓ *${f.clarificationQuestion}*`);
      if (f.suggestedRewrite) {
        md.push(`- **Suggested Rewrite:** ${f.suggestedRewrite}`);
      }
      md.push(`- **Confidence:** \`${f.confidence}\` | *${f.limitations}*`);
      md.push('');
      md.push('---');
      md.push('');
    });

    return md.join('\n');
  }
}
