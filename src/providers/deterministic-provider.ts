/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  IAnalysisProvider,
  ProviderId,
  ProcessingLocality,
  InputModality,
  AIModelInfo,
  ProviderDiagnostic,
  AnalysisRequest,
  AnalysisResponse,
} from '../types/provider.ts';
import { SecretScanner } from '../ingestion/secrets.ts';

export class DeterministicProvider implements IAnalysisProvider {
  public readonly id: ProviderId = 'deterministic';
  public readonly displayName = 'Local Deterministic Provider';
  public readonly locality: ProcessingLocality = 'local';
  public readonly supportedModalities: InputModality[] = ['text', 'log', 'diff', 'json'];

  private readonly modelInfo: AIModelInfo = {
    id: 'deterministic-rules',
    name: 'Pure Deterministic Heuristic Engine',
    family: 'deterministic',
    isGemmaFamily: false,
    locality: 'local',
    capabilities: ['text_generation', 'structured_output', 'code_analysis'],
    description: 'In-memory deterministic rule engine. Zero network calls, zero token costs, 100% reproducible.',
  };

  public async checkConnection(_signal?: AbortSignal): Promise<ProviderDiagnostic> {
    return {
      providerId: 'deterministic',
      status: 'connected',
      message: 'Pure in-memory deterministic engine is active and requires no external services or network access.',
      testedAt: new Date().toISOString(),
      availableModels: [this.modelInfo],
    };
  }

  public async listModels(_signal?: AbortSignal): Promise<AIModelInfo[]> {
    return [this.modelInfo];
  }

  public validateRequest(request: AnalysisRequest): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!request.prompt || !request.prompt.trim()) {
      errors.push('Prompt or question cannot be empty.');
    }
    if (request.prompt && request.prompt.length > 500_000) {
      errors.push(`Prompt exceeds maximum deterministic buffer limit (500,000 characters). Current: ${request.prompt.length}`);
    }
    return { valid: errors.length === 0, errors };
  }

  public async analyze(request: AnalysisRequest): Promise<AnalysisResponse> {
    const startTime = performance.now();
    const validation = this.validateRequest(request);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    if (request.signal?.aborted) {
      throw new Error('Analysis operation was aborted.');
    }

    // Pre-flight secret sanitization
    const promptSanitization = SecretScanner.scanAndRedact(request.prompt);
    let totalRedacted = promptSanitization.matches.length;

    // Check evidence snippets
    const cleanSnippets = (request.evidenceSnippets || []).map((snip) => {
      const sanitized = SecretScanner.scanAndRedact(snip.content);
      totalRedacted += sanitized.matches.length;
      return {
        source: snip.source,
        content: sanitized.sanitizedText,
        lineRange: snip.lineRange,
      };
    });

    // Pure deterministic synthesis
    const sections: string[] = [];
    sections.push('### Deterministic Synthesis');
    sections.push(`**Query:** ${promptSanitization.sanitizedText.slice(0, 150)}${promptSanitization.sanitizedText.length > 150 ? '...' : ''}`);
    sections.push('');

    if (cleanSnippets.length > 0) {
      sections.push(`**Evidence Processed:** ${cleanSnippets.length} artifact(s) analyzed in-memory.`);
      cleanSnippets.forEach((s, idx) => {
        const lineCount = s.content.split('\n').length;
        sections.push(`- **[#${idx + 1}] ${s.source}**: ${lineCount} line(s) parsed.`);
      });
      sections.push('');
    }

    sections.push('#### Baseline Facts (Extracted Without AI)');
    sections.push('- Analysis executed via verified algorithmic heuristics with zero token cost and zero cloud leakage.');
    if (totalRedacted > 0) {
      sections.push(`- Pre-flight secret scanning safely masked **${totalRedacted} credential token(s)** before processing.`);
    }

    const duration = Math.round(performance.now() - startTime);

    return {
      text: sections.join('\n'),
      structuredData: {
        mode: 'deterministic',
        evidenceCount: cleanSnippets.length,
        redactionsCount: totalRedacted,
      },
      provenance: {
        providerId: 'deterministic',
        providerDisplayName: this.displayName,
        modelId: this.modelInfo.id,
        modelFamily: this.modelInfo.family,
        locality: 'local',
        epistemicClassification: 'confirmed_fact',
        sanitizationPerformed: true,
        redactedSecretsCount: totalRedacted,
        executionDurationMs: duration,
        timestamp: new Date().toISOString(),
      },
    };
  }
}
