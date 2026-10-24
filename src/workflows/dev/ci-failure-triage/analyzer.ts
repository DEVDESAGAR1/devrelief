/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CiTriageInput, CiTriagePayload, ErrorOccurrence, ErrorCluster, FailureHypothesis } from './types.ts';
import { SecretScanner } from '../../../ingestion/secrets.ts';
import { InputValidationError, SourceReference } from '../../../types/workflow.ts';

const ERROR_PATTERNS = [
  { type: 'Dependency Resolution Failure', regex: /\b(?:Non-resolvable parent POM|Could not resolve dependencies|npm ERR! code (?:E404|ETARGET|ERESOLVE)|Module not found|Cannot find module)\b/i },
  { type: 'Network / Connection Timeout', regex: /\b(?:ETIMEDOUT|ECONNREFUSED|504 Gateway Time-out|Connection timed out|socket hang up)\b/i },
  { type: 'Compilation / Syntax Error', regex: /\b(?:Compilation failure|SyntaxError|TypeScript error|Cannot compile|TS\d{4})\b/i },
  { type: 'Test Assertion Failure', regex: /\b(?:AssertionError|FAIL\s+|Tests run:.*Failures: [1-9]|Expected .* but received)\b/i },
  { type: 'Out of Memory / Resource Limit', regex: /\b(?:OutOfMemoryError|JavaScript heap out of memory|Killed|exit code 137)\b/i },
  { type: 'Permission / Auth Error', regex: /\b(?:Permission denied|AccessDenied|401 Unauthorized|403 Forbidden|exit code 126)\b/i },
  { type: 'Generic Fatal Failure', regex: /\b(?:FATAL|CRITICAL|PANIC|exit\s+(?:status|code)\s+[1-9]\d*)\b/i },
];

export class CiLogAnalyzer {
  public static validate(input: CiTriageInput): InputValidationError[] {
    const errors: InputValidationError[] = [];
    if (!input || !input.rawLogOrTrace || input.rawLogOrTrace.trim().length === 0) {
      errors.push({
        field: 'rawLogOrTrace',
        message: 'CI/CD log or error trace is empty. Please provide pipeline output or console logs.',
      });
    }
    return errors;
  }

  public static analyze(input: CiTriageInput): {
    payload: CiTriagePayload;
    markdown: string;
    sourceReferences: SourceReference[];
  } {
    const sourceName = input.sourceName || 'ci_pipeline.log';
    const redaction = SecretScanner.scanAndRedact(input.rawLogOrTrace);
    const sanitizedLog = redaction.sanitizedText;

    const lines = sanitizedLog.split(/\r?\n/);
    const totalLines = lines.length;

    let firstError: ErrorOccurrence | undefined = undefined;
    const clusterMap = new Map<string, { count: number; firstLine: number; sample: string }>();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      for (const pattern of ERROR_PATTERNS) {
        if (pattern.regex.test(line)) {
          const lineNum = i + 1;
          const snippet = line.trim();

          if (!firstError) {
            const contextStart = Math.max(0, i - 3);
            const contextEnd = Math.min(lines.length, i + 4);
            firstError = {
              lineNumber: lineNum,
              errorKeyword: pattern.type,
              snippet,
              surroundingContext: lines.slice(contextStart, contextEnd),
            };
          }

          if (!clusterMap.has(pattern.type)) {
            clusterMap.set(pattern.type, { count: 0, firstLine: lineNum, sample: snippet });
          }
          clusterMap.get(pattern.type)!.count++;
          break;
        }
      }
    }

    const errorClusters: ErrorCluster[] = Array.from(clusterMap.entries()).map(([type, data]) => ({
      errorType: type,
      count: data.count,
      firstLine: data.firstLine,
      sampleMessage: data.sample,
    }));

    const hypotheses: FailureHypothesis[] = [];
    const missingInfo: string[] = [];
    const suggestedSteps: string[] = [];
    const inertCommands: string[] = [];
    let isRootCauseConfirmed = false;

    if (firstError) {
      if (firstError.errorKeyword === 'Dependency Resolution Failure') {
        hypotheses.push({
          rank: 1,
          title: 'Remote package repository version mismatch or artifact unavailable',
          probability: 'high',
          rationale: `First fatal error is dependency resolution failure at line ${firstError.lineNumber}: "${firstError.snippet}"`,
          supportingEvidence: `Line ${firstError.lineNumber} in ${sourceName}`,
        });
        suggestedSteps.push('Verify parent POM or package version declaration in project manifest.');
        suggestedSteps.push('Check availability of private artifact registry (Nexus/Artifactory/npm).');
        inertCommands.push('mvn dependency:tree -Dverbose');
        inertCommands.push('npm ls --all');
      } else if (firstError.errorKeyword === 'Network / Connection Timeout') {
        hypotheses.push({
          rank: 1,
          title: 'Transient network failure or unreachable external service',
          probability: 'high',
          rationale: `Timeout or connection refused error observed at line ${firstError.lineNumber}.`,
          supportingEvidence: `Line ${firstError.lineNumber} in ${sourceName}`,
        });
        suggestedSteps.push('Retry the pipeline build to check if timeout was transient.');
        suggestedSteps.push('Check status of downstream API / database services.');
        inertCommands.push('curl -I -m 10 https://api.your-service.internal/health');
      } else if (firstError.errorKeyword === 'Test Assertion Failure') {
        hypotheses.push({
          rank: 1,
          title: 'Regression test failure in unit or integration test suite',
          probability: 'high',
          rationale: `Test runner assertion failed at line ${firstError.lineNumber}: "${firstError.snippet}"`,
          supportingEvidence: `Line ${firstError.lineNumber} in ${sourceName}`,
        });
        suggestedSteps.push('Run the failing test locally in isolation to reproduce.');
        inertCommands.push('npm test -- --grep "auth"');
      } else if (firstError.errorKeyword === 'Out of Memory / Resource Limit') {
        hypotheses.push({
          rank: 1,
          title: 'Process exceeded container memory limits (OOM Killer / exit code 137)',
          probability: 'high',
          rationale: `Memory exhaustion detected at line ${firstError.lineNumber}.`,
          supportingEvidence: `Line ${firstError.lineNumber} in ${sourceName}`,
        });
        suggestedSteps.push('Increase Docker/Kubernetes container memory limit or Node `--max-old-space-size`.');
        inertCommands.push('export NODE_OPTIONS="--max-old-space-size=4096"');
      } else {
        hypotheses.push({
          rank: 1,
          title: 'Step execution failure',
          probability: 'medium',
          rationale: `Fatal exit code observed at line ${firstError.lineNumber}: "${firstError.snippet}"`,
          supportingEvidence: `Line ${firstError.lineNumber} in ${sourceName}`,
        });
      }
    } else {
      missingInfo.push('No recognized fatal error keywords or stack traces detected in the supplied log.');
      missingInfo.push('Provide the full verbose debug log or the specific terminal output from the failing step.');
      suggestedSteps.push('Re-run the pipeline with verbose debugging flags enabled.');
      inertCommands.push('npm test -- --verbose');
    }

    if (redaction.hasRedactions) {
      suggestedSteps.push(`⚠️ Note: ${redaction.matches.length} sensitive secret(s) in this log were automatically redacted.`);
    }

    const payload: CiTriagePayload = {
      pipelineStage: input.pipelineStage || 'Build & Test',
      totalLinesAnalyzed: totalLines,
      firstMeaningfulError: firstError,
      errorClusters,
      hypotheses,
      missingInformation: missingInfo,
      suggestedSteps,
      suggestedInertCommands: inertCommands,
      hasRedactedSecrets: redaction.hasRedactions,
      isRootCauseConfirmed,
    };

    const sourceReferences: SourceReference[] = firstError
      ? [
          {
            source: sourceName,
            lineStart: Math.max(1, firstError.lineNumber - 3),
            lineEnd: Math.min(totalLines, firstError.lineNumber + 3),
            rawSnippet: firstError.snippet,
          },
        ]
      : [{ source: sourceName, lineStart: 1, lineEnd: Math.min(10, totalLines), rawSnippet: 'CI Log' }];

    // Build structured markdown
    const md: string[] = [
      `# CI Failure Triage Report`,
      `> Pipeline Log: \`${sourceName}\` | Stage: **${payload.pipelineStage}** | Lines Analyzed: ${totalLines}`,
      '',
      `### 📋 Executive Summary`,
      firstError
        ? `First meaningful failure observed at **line ${firstError.lineNumber}**: \`${firstError.snippet}\` (${firstError.errorKeyword})`
        : `No fatal error keywords detected in ${totalLines} log lines. Root cause is currently UNKNOWN.`,
      '',
    ];

    if (firstError) {
      md.push(`### 🔍 First Meaningful Failure Excerpt (Line ${firstError.lineNumber})`);
      md.push('```');
      md.push(firstError.surroundingContext.join('\n'));
      md.push('```');
      md.push('');
    }

    if (errorClusters.length > 0) {
      md.push(`### 📊 Error Clusters Detected (${errorClusters.length})`);
      for (const cl of errorClusters) {
        md.push(`- **${cl.errorType}:** ${cl.count} occurrence(s) (first at line ${cl.firstLine})`);
      }
      md.push('');
    }

    md.push(`### 🟡 Hypothesized Root Causes (${hypotheses.length})`);
    if (hypotheses.length > 0) {
      for (const h of hypotheses) {
        md.push(`- **[Rank ${h.rank} - Probability: ${h.probability.toUpperCase()}] ${h.title}**`);
        md.push(`  *Rationale:* ${h.rationale}`);
        md.push(`  *Evidence:* \`${h.supportingEvidence}\``);
      }
    } else {
      md.push('- No specific root cause hypothesis could be confirmed from available evidence.');
    }
    md.push('');

    if (missingInfo.length > 0) {
      md.push(`### ⚪ Missing Information Needed`);
      for (const mi of missingInfo) {
        md.push(`- ${mi}`);
      }
      md.push('');
    }

    if (suggestedSteps.length > 0) {
      md.push(`### 💡 Recommended Diagnostic Steps`);
      for (const st of suggestedSteps) {
        md.push(`- ${st}`);
      }
      md.push('');
    }

    if (inertCommands.length > 0) {
      md.push(`### 💻 Suggested Diagnostic Commands (Inert text — copy to execute locally)`);
      for (const cmd of inertCommands) {
        md.push('```bash');
        md.push(cmd);
        md.push('```');
      }
      md.push('');
    }

    md.push('> **Safety Notice:** DevRelief never executes suggested commands automatically. All commands are inert text for user review.');

    return {
      payload,
      markdown: md.join('\n'),
      sourceReferences,
    };
  }
}
