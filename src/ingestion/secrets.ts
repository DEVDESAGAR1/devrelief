/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SecretRedactionMatch } from './types.ts';

interface RedactionRule {
  name: string;
  pattern: RegExp;
  maskGenerator: (match: string) => string;
}

export const SECRET_REDACTION_RULES: RedactionRule[] = [
  {
    name: 'AWS Access Key ID',
    pattern: /\b(?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}\b/g,
    maskGenerator: () => '[REDACTED_AWS_ACCESS_KEY_ID]',
  },
  {
    name: 'AWS Secret Access Key Assignment',
    pattern: /(aws_secret_access_key\s*[:=]\s*["']?)([A-Za-z0-9/+=]{40})(["']?)/gi,
    maskGenerator: () => '$1[REDACTED_AWS_SECRET_KEY]$3',
  },
  {
    name: 'GitHub Personal Access Token',
    pattern: /\bgh[pousr]_[A-Za-z0-9_]{36,255}\b/g,
    maskGenerator: () => '[REDACTED_GITHUB_TOKEN]',
  },
  {
    name: 'Bearer Token Header',
    pattern: /(Bearer\s+)[A-Za-z0-9\-._~+/]+=*/gi,
    maskGenerator: () => '$1[REDACTED_BEARER_TOKEN]',
  },
  {
    name: 'RSA / SSH Private Key Block',
    pattern: /-----BEGIN\s+(?:RSA|OPENSSH|DSA|EC)?\s*PRIVATE KEY-----[\s\S]*?-----END\s+(?:RSA|OPENSSH|DSA|EC)?\s*PRIVATE KEY-----/g,
    maskGenerator: () => '[REDACTED_PRIVATE_KEY_BLOCK]',
  },
  {
    name: 'Password / API Key Assignment',
    pattern: /((?:api_?key|auth_?token|client_?secret|db_?password|secret_?key|password)\s*[:=]\s*["'])([^"'\r\n\s]{8,})(["'])/gi,
    maskGenerator: () => '$1[REDACTED_CREDENTIAL]$3',
  },
];

export class SecretScanner {
  /**
   * Scan text line by line and redact detected secrets
   */
  public static scanAndRedact(text: string): {
    sanitizedText: string;
    matches: SecretRedactionMatch[];
    hasRedactions: boolean;
  } {
    if (!text) {
      return { sanitizedText: '', matches: [], hasRedactions: false };
    }

    const matches: SecretRedactionMatch[] = [];
    const lines = text.split(/\r?\n/);
    const sanitizedLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      let lineText = lines[i];
      const lineNumber = i + 1;

      for (const rule of SECRET_REDACTION_RULES) {
        // Reset lastIndex for global regexes
        rule.pattern.lastIndex = 0;
        let match: RegExpExecArray | null;

        // Check if pattern matches
        if (rule.pattern.test(lineText)) {
          rule.pattern.lastIndex = 0;
          while ((match = rule.pattern.exec(lineText)) !== null) {
            const rawMatch = match[0];
            matches.push({
              ruleName: rule.name,
              originalRedactedText: rawMatch.slice(0, 4) + '***' + rawMatch.slice(-3),
              maskedSnippet: `Line ${lineNumber}: ${rule.name}`,
              line: lineNumber,
            });
          }

          // Apply replacement
          rule.pattern.lastIndex = 0;
          lineText = lineText.replace(rule.pattern, rule.maskGenerator as any);
        }
      }

      sanitizedLines.push(lineText);
    }

    const sanitizedText = sanitizedLines.join('\n');
    return {
      sanitizedText,
      matches,
      hasRedactions: matches.length > 0,
    };
  }
}
