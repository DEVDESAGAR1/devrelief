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

export interface GeminiProviderOptions {
  backendEndpoint?: string; // Default: '/api/gemini'
  selectedModel?: string; // Default: 'gemini-3.8-flash'
  defaultTimeoutMs?: number;
  maxPayloadBytes?: number;
  customFetch?: typeof fetch;
}

export class GeminiProvider implements IAnalysisProvider {
  public readonly id: ProviderId = 'gemini';
  public readonly displayName = 'Google Gemini Cloud AI';
  public readonly locality: ProcessingLocality = 'cloud';
  public readonly supportedModalities: InputModality[] = ['text', 'log', 'diff', 'json', 'image'];

  private backendEndpoint: string;
  private selectedModel: string;
  private defaultTimeoutMs: number;
  private maxPayloadBytes: number;
  private fetchFn: typeof fetch;

  public static readonly DEFAULT_MODEL: string = 'gemini-3.8-flash';

  private readonly modelCatalog: AIModelInfo[] = [
    {
      id: 'gemini-3.8-flash',
      name: 'Gemini 3.8 Flash',
      family: 'gemini',
      isGemmaFamily: false,
      locality: 'cloud',
      capabilities: ['text_generation', 'code_analysis', 'structured_output', 'vision'],
      description: 'Standard fast multimodal model for synthesis, analysis, and text tasks.',
    },
    {
      id: 'gemini-3.1-flash-lite',
      name: 'Gemini 3.1 Flash Lite',
      family: 'gemini',
      isGemmaFamily: false,
      locality: 'cloud',
      capabilities: ['text_generation', 'code_analysis'],
      description: 'Ultra lightweight, low-latency text model.',
    },
  ];

  constructor(options: GeminiProviderOptions = {}) {
    this.backendEndpoint = (options.backendEndpoint || '/api/gemini').replace(/\/+$/, '');
    this.selectedModel = options.selectedModel || GeminiProvider.DEFAULT_MODEL;
    this.defaultTimeoutMs = options.defaultTimeoutMs || 30000;
    this.maxPayloadBytes = options.maxPayloadBytes || 256 * 1024; // 256 KB max for cloud payload
    this.fetchFn = options.customFetch || ((url, init) => fetch(url, init));
  }

  public getSelectedModel(): string {
    return this.selectedModel;
  }

  public setSelectedModel(model: string): void {
    this.selectedModel = model;
  }

  public async listModels(_signal?: AbortSignal): Promise<AIModelInfo[]> {
    return this.modelCatalog;
  }

  /**
   * Checks status of Gemini integration on server-side
   */
  public async checkConnection(signal?: AbortSignal): Promise<ProviderDiagnostic> {
    const testedAt = new Date().toISOString();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const onParentAbort = () => controller.abort();
    if (signal) {
      signal.addEventListener('abort', onParentAbort);
    }

    try {
      const resp = await this.fetchFn(`${this.backendEndpoint}/status`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });

      if (!resp.ok) {
        return {
          providerId: 'gemini',
          status: 'error',
          endpoint: this.backendEndpoint,
          message: `Backend status endpoint responded with HTTP ${resp.status}`,
          testedAt,
          availableModels: this.modelCatalog,
          remediation: 'Ensure backend server is running with GEMINI_API_KEY set.',
        };
      }

      const data = await resp.json() as { configured?: boolean; model?: string; message?: string };
      if (data.configured) {
        return {
          providerId: 'gemini',
          status: 'connected',
          endpoint: this.backendEndpoint,
          message: `Gemini API key is securely configured on backend server. Ready for explicit user-consented requests.`,
          testedAt,
          availableModels: this.modelCatalog,
          requiresConsent: true,
        };
      } else {
        return {
          providerId: 'gemini',
          status: 'not_configured',
          endpoint: this.backendEndpoint,
          message: `GEMINI_API_KEY environment variable is not configured on the backend server.`,
          testedAt,
          availableModels: this.modelCatalog,
          remediation: `Configure GEMINI_API_KEY in your environment or .env file. The client application never handles private API keys directly.`,
        };
      }
    } catch (err) {
      const errorStr = err instanceof Error ? err.message : String(err);
      return {
        providerId: 'gemini',
        status: 'error',
        endpoint: this.backendEndpoint,
        message: `Unable to reach backend Gemini proxy: ${errorStr}`,
        testedAt,
        availableModels: this.modelCatalog,
        remediation: `Ensure the local full-stack server is running and accessible at ${this.backendEndpoint}.`,
      };
    } finally {
      clearTimeout(timeout);
      if (signal) {
        signal.removeEventListener('abort', onParentAbort);
      }
    }
  }

  public validateRequest(request: AnalysisRequest): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // MANDATORY CONSENT GATE:
    if (request.userConsentGiven !== true) {
      errors.push('Explicit user consent is required before sending data to Google Gemini Cloud API.');
    }

    if (!request.prompt || !request.prompt.trim()) {
      errors.push('Prompt cannot be empty.');
    }

    const totalLength = (request.prompt || '').length +
      (request.evidenceSnippets || []).reduce((acc, s) => acc + (s.content || '').length, 0);

    if (totalLength > this.maxPayloadBytes) {
      errors.push(
        `Payload size (${Math.round(totalLength / 1024)} KB) exceeds configured Gemini cloud limit (${Math.round(this.maxPayloadBytes / 1024)} KB).`
      );
    }

    return { valid: errors.length === 0, errors };
  }

  public async analyze(request: AnalysisRequest): Promise<AnalysisResponse> {
    const startTime = performance.now();
    const validation = this.validateRequest(request);
    if (!validation.valid) {
      throw new Error(`Gemini validation failed: ${validation.errors.join('; ')}`);
    }

    // Pre-flight secret sanitization
    const promptSanitized = SecretScanner.scanAndRedact(request.prompt);
    let totalRedacted = promptSanitized.matches.length;

    let compiledPrompt = promptSanitized.sanitizedText;
    if (request.evidenceSnippets && request.evidenceSnippets.length > 0) {
      compiledPrompt += '\n\n---\n### Attached Evidence Artifacts:\n';
      for (const snip of request.evidenceSnippets) {
        const sanitizedSnip = SecretScanner.scanAndRedact(snip.content);
        totalRedacted += sanitizedSnip.matches.length;
        compiledPrompt += `\n[Source: ${snip.source}]\n${sanitizedSnip.sanitizedText}\n`;
      }
    }

    const modelToUse = this.selectedModel || GeminiProvider.DEFAULT_MODEL;
    const controller = new AbortController();
    const timeoutMs = request.timeoutMs || this.defaultTimeoutMs;
    const timeoutTimer = setTimeout(() => controller.abort(), timeoutMs);

    const onAbort = () => controller.abort();
    if (request.signal) {
      request.signal.addEventListener('abort', onAbort);
    }

    try {
      const resp = await this.fetchFn(`${this.backendEndpoint}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          prompt: compiledPrompt,
          model: modelToUse,
          systemInstruction: request.systemInstruction || 'You are an engineering copilot assisting with software delivery artifacts. Answer factually, distinguish evidence from inferences, and declare unknowns.',
          temperature: request.temperature ?? 0.2,
          userConsent: true,
        }),
        signal: controller.signal,
      });

      if (!resp.ok) {
        const errorText = await resp.text().catch(() => resp.statusText);
        throw new Error(`Gemini backend request failed [HTTP ${resp.status}]: ${errorText}`);
      }

      const data = await resp.json() as { text?: string; error?: string };
      if (data.error) {
        throw new Error(`Gemini error: ${data.error}`);
      }

      const duration = Math.round(performance.now() - startTime);

      return {
        text: data.text || '',
        provenance: {
          providerId: 'gemini',
          providerDisplayName: this.displayName,
          modelId: modelToUse,
          modelFamily: 'gemini',
          locality: 'cloud',
          epistemicClassification: 'inference',
          sanitizationPerformed: true,
          redactedSecretsCount: totalRedacted,
          executionDurationMs: duration,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`Gemini cloud request timed out or was cancelled after ${timeoutMs}ms.`);
      }
      throw err;
    } finally {
      clearTimeout(timeoutTimer);
      if (request.signal) {
        request.signal.removeEventListener('abort', onAbort);
      }
    }
  }
}
