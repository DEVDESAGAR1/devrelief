/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { InputValidationError, SourceReference } from '../../../types/workflow.ts';
import { SecretScanner } from '../../../ingestion/secrets.ts';
import {
  ScreenshotToReproInput,
  ScreenshotToReproPayload,
  BugTicketDraft,
  BugSeverity,
} from './types.ts';

export class BugReproFormatter {
  public static validate(input: ScreenshotToReproInput): InputValidationError[] {
    const errors: InputValidationError[] = [];
    if (!input || input.errorLogOrTrace === undefined || input.errorLogOrTrace === null || typeof input.errorLogOrTrace !== 'string') {
      errors.push({
        field: 'errorLogOrTrace',
        message: 'Error log or stack trace input is required and must be a string.',
      });
      return errors;
    }

    if (input.errorLogOrTrace.trim().length === 0) {
      errors.push({
        field: 'errorLogOrTrace',
        message: 'Error log cannot be empty or whitespace-only.',
      });
      return errors;
    }

    if (input.errorLogOrTrace.trim().length < 15) {
      errors.push({
        field: 'errorLogOrTrace',
        message: 'Error log is too brief to synthesize reproduction ticket (minimum 15 characters).',
      });
    }

    return errors;
  }

  public static format(input: ScreenshotToReproInput): ScreenshotToReproPayload {
    const sourceName = input.sourceName || 'error_trace.log';

    // Step 1: Pre-flight secret redaction
    const secretScan = SecretScanner.scanAndRedact(input.errorLogOrTrace);
    const sanitizedLog = secretScan.sanitizedText;
    const secretsRedactedCount = secretScan.matches.length;

    const lines = sanitizedLog.split('\n');

    // Step 2: Extract primary error and stack frames
    let errorType = 'Runtime Error';
    let errorMessage = 'Application threw an unhandled exception';
    let errorLineIdx = -1;
    const stackFrames: string[] = [];

    const errorRegex = /\b(?:([A-Za-z0-9_.]+(?:Error|Exception|Failure|Fault)):\s*(.+)|(?:FATAL|PANIC|CRITICAL|FAIL):\s*(.+))/i;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const match = line.match(errorRegex);
      if (match) {
        errorType = match[1] || 'Fatal Failure';
        errorMessage = (match[2] || match[3] || line).trim();
        errorLineIdx = i;
        break;
      }
    }

    // If no explicit Error: syntax found, check for HTTP error codes
    if (errorLineIdx === -1) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (/\b(?:500|502|503|504|400|401|403|404)\b/.test(line)) {
          errorType = 'HTTP Status Error';
          errorMessage = line;
          errorLineIdx = i;
          break;
        }
      }
    }

    // Default to first substantive line if still not matched
    if (errorLineIdx === -1) {
      errorLineIdx = lines.findIndex((l) => l.trim().length > 5);
      if (errorLineIdx !== -1) {
        errorMessage = lines[errorLineIdx].trim();
      }
    }

    // Extract stack frames (at ... or File "...", line ...)
    for (let i = Math.max(0, errorLineIdx); i < Math.min(lines.length, errorLineIdx + 20); i++) {
      const line = lines[i].trim();
      if (/^at\s+|^File\s+"|\.ts:\d+|\.js:\d+|\.py:\d+|\.java:\d+/.test(line)) {
        stackFrames.push(line);
      }
    }

    // Determine severity
    let severity: BugSeverity = 'Major';
    let severityJustification = 'Application threw an unhandled exception disrupting user execution.';

    if (/\b(fatal|panic|segfault|sigsegv|corrupt|out of memory|deadlock|database locked|pool exhausted)\b/i.test(sanitizedLog)) {
      severity = 'Critical';
      severityJustification = 'Severe system crash, process abort, or memory/data fault.';
    } else if (/\b(warning|warn|deprecated|minor)\b/i.test(sanitizedLog) && !/\bfatal\b/i.test(sanitizedLog)) {
      severity = 'Minor';
      severityJustification = 'Non-fatal error or deprecation warning.';
    }

    // Synthesize reproduction steps
    const reproSteps: string[] = [];
    if (stackFrames.length > 0) {
      reproSteps.push(`Trigger the code path leading into \`${stackFrames[stackFrames.length - 1]}\``);
      if (stackFrames.length > 1) {
        reproSteps.push(`Execution traverses through \`${stackFrames[0]}\``);
      }
      reproSteps.push(`Observe unhandled exception: \`${errorType}: ${errorMessage}\``);
    } else {
      reproSteps.push('1. Execute application under matching environmental conditions');
      reproSteps.push(`2. Trigger operation that issues: "${errorMessage.slice(0, 80)}"`);
      reproSteps.push(`3. Confirm failure occurs`);
    }

    // Missing information check
    const missingInformation: string[] = [];
    if (!input.environmentNotes && !sanitizedLog.includes('Node') && !sanitizedLog.includes('Chrome') && !sanitizedLog.includes('Linux')) {
      missingInformation.push('Operating system and runtime environment version');
    }
    if (!input.expectedBehaviorNotes) {
      missingInformation.push('Explicit expected behavior from product specifications');
    }
    missingInformation.push('User account identifier or permission level during reproduction');
    missingInformation.push('Exact network payload or form inputs submitted');

    const questionsForReporter: string[] = [
      'Can this defect be reproduced consistently on clean staging environments?',
      'Does this failure occur for all users or only specific account roles?',
      'What user action immediately preceded this error in the UI?',
    ];

    // Image note if screenshot was supplied
    let imageMetadataNote: string | undefined;
    if (input.imageAttachmentName) {
      imageMetadataNote = `Attachment "${input.imageAttachmentName}" (${input.imageDimensions || 'standard resolution'}) ingested for reference. Note: screenshots are processed as static metadata; visual layout inspection is not performed.`;
    }

    const sourceRefs: SourceReference[] = [
      {
        source: sourceName,
        lineStart: errorLineIdx + 1,
        lineEnd: Math.min(lines.length, errorLineIdx + stackFrames.length + 1),
        rawSnippet: `${errorType}: ${errorMessage}`,
      },
    ];

    const ticket: BugTicketDraft = {
      ticketId: `BUG-${Date.now().toString().slice(-4)}`,
      title: `[Bug] ${errorType}: ${errorMessage.slice(0, 75)}`,
      observedBehavior: `System failed with: ${errorType} - ${errorMessage}`,
      expectedBehavior: input.expectedBehaviorNotes?.trim() || 'UNKNOWN - Expected behavior was not supplied in crash report and requires product verification.',
      reproSteps,
      environmentDetails: input.environmentNotes?.trim() || 'Not explicitly specified in log headers.',
      errorType,
      errorMessage,
      stackTraceSnippet: stackFrames.length > 0 ? stackFrames.join('\n') : lines.slice(0, 10).join('\n'),
      severity,
      severityJustification,
      missingInformation,
      questionsForReporter,
      secretsRedactedCount,
      imageMetadataNote,
      sourceReferences: sourceRefs,
    };

    const severityRubric =
      'SEVERITY RUBRIC: CRITICAL = Total service outage, process segfault, data loss, or authentication bypass. MAJOR = Primary feature failure with no workaround. MINOR = Cosmetic flaw or failure with known immediate workaround. TRIVIAL = Typo or non-disruptive log warning.';

    const limitations =
      'EPISTEMIC LIMITATIONS: Reproduction steps are synthesized from stack frames and text logs. Screenshots are referenced strictly as passive image metadata. Zero cloud AI calls or external issue tracker APIs are invoked.';

    const humanReviewNotice =
      'HUMAN REVIEW MANDATORY: Bug reproduction draft must be validated by QA before logging into Jira, GitHub Issues, or Linear.';

    const payload: ScreenshotToReproPayload = {
      ticket,
      severityRubric,
      limitations,
      humanReviewNotice,
      markdown: '',
    };

    payload.markdown = BugReproFormatter.renderMarkdown(payload);
    return payload;
  }

  private static renderMarkdown(payload: ScreenshotToReproPayload): string {
    const t = payload.ticket;
    const md: string[] = [];

    md.push(`# ${t.title}`);
    md.push('');
    md.push(`> ⚠️ **${payload.humanReviewNotice}**`);
    md.push('');
    md.push(`- **Ticket ID:** \`${t.ticketId}\``);
    md.push(`- **Suggested Severity:** **${t.severity}** (${t.severityJustification})`);
    md.push(`- **Secrets Redacted Pre-Flight:** ${t.secretsRedactedCount} sensitive pattern(s) secured`);
    md.push(`- **Environment:** ${t.environmentDetails}`);
    md.push('');
    if (t.imageMetadataNote) {
      md.push(`> 📷 **Image Attachment:** ${t.imageMetadataNote}`);
      md.push('');
    }
    md.push('---');
    md.push('');
    md.push('## Observed Behavior');
    md.push(`\`\`\`\n${t.observedBehavior}\n\`\`\``);
    md.push('');
    md.push('## Expected Behavior');
    md.push(t.expectedBehavior);
    md.push('');
    md.push('## Inferred Reproduction Sequence');
    t.reproSteps.forEach((step, idx) => md.push(`${idx + 1}. ${step}`));
    md.push('');
    md.push('## Sanitized Stack Trace Excerpt');
    md.push('```text');
    md.push(t.stackTraceSnippet);
    md.push('```');
    md.push('');
    md.push('## Missing Information (Required to Finalize Ticket)');
    t.missingInformation.forEach((info) => md.push(`- ⚠️ ${info}`));
    md.push('');
    md.push('## Questions for Reporter');
    t.questionsForReporter.forEach((q) => md.push(`- ❓ ${q}`));
    md.push('');
    md.push('---');
    md.push(`*${payload.severityRubric}*`);
    md.push(`*${payload.limitations}*`);

    return md.join('\n');
  }
}
