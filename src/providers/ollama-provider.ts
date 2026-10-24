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

export interface OllamaProviderOptions {
  endpoint?: string;
  selectedModel?: string;
  defaultTimeoutMs?: number;
  maxPayloadBytes?: number;
  customFetch?: typeof fetch;
}

export class OllamaProvider implements IAnalysisProvider {
  public readonly id: ProviderId = 'ollama';
  public readonly displayName = 'Ollama Local AI Runtime';
  public readonly locality: ProcessingLocality = 'local';
  public readonly supportedModalities: InputModality[] = ['text', 'log', 'diff', 'json'];

  private endpoint: string;
  private selectedModel: string;
  private defaultTimeoutMs: number;
  private maxPayloadBytes: number;
  private fetchFn: typeof fetch;

  constructor(options: OllamaProviderOptions = {}) {
    this.endpoint = (options.endpoint || 'http://127.0.0.1:11434').replace(/\/+$/, '');
    this.selectedModel = options.selectedModel || '';
    this.defaultTimeoutMs = options.defaultTimeoutMs || 30000;
    this.maxPayloadBytes = options.maxPayloadBytes || 512 * 1024; // 512 KB
    this.fetchFn = options.customFetch || ((url, init) => fetch(url, init));
  }

  public getEndpoint(): string {
    return this.endpoint;
  }

  public setEndpoint(endpoint: string): void {
    this.endpoint = endpoint.replace(/\/+$/, '');
  }

  public getSelectedModel(): string {
    return this.selectedModel;
  }

  public setSelectedModel(model: string): void {
    this.selectedModel = model;
  }

  /**
   * Discovers installed models via GET /api/tags
   */
  public async listModels(signal?: AbortSignal): Promise<AIModelInfo[]> {
    const url = `${this.endpoint}/api/tags`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const onParentAbort = () => controller.abort();
    if (signal) {
      signal.addEventListener('abort', onParentAbort);
    }

    try {
      const resp = await this.fetchFn(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });

      if (!resp.ok) {
        throw new Error(`Ollama tags endpoint returned HTTP status ${resp.status} (${resp.statusText})`);
      }

      const data = await resp.json() as { models?: Array<{ name: string; size?: number; details?: { family?: string; parameter_size?: string } }> };
      const rawModels = data.models || [];

      return rawModels.map((m): AIModelInfo => {
        const nameLower = m.name.toLowerCase();
        const familyLower = (m.details?.family || '').toLowerCase();
        const isGemma = nameLower.includes('gemma') || familyLower.includes('gemma');

        let family: AIModelInfo['family'] = 'other';
        if (isGemma) family = 'gemma';
        else if (nameLower.includes('llama') || familyLower.includes('llama')) family = 'llama';
        else if (nameLower.includes('qwen') || familyLower.includes('qwen')) family = 'qwen';
        else if (nameLower.includes('mistral') || familyLower.includes('mistral')) family = 'mistral';

        return {
          id: m.name,
          name: m.name,
          family,
          isGemmaFamily: isGemma,
          locality: 'local',
          sizeBytes: m.size,
          capabilities: ['text_generation', 'code_analysis'],
          description: isGemma
            ? `Google Gemma open model running locally via Ollama (${m.details?.parameter_size || 'local'}).`
            : `Local open model running via Ollama.`,
        };
      });
    } finally {
      clearTimeout(timeout);
      if (signal) {
        signal.removeEventListener('abort', onParentAbort);
      }
    }
  }

  /**
   * Health and connection check
   */
  public async checkConnection(signal?: AbortSignal): Promise<ProviderDiagnostic> {
    const testedAt = new Date().toISOString();
    try {
      const models = await this.listModels(signal);
      const gemmaModels = models.filter((m) => m.isGemmaFamily);

      let message = `Successfully connected to Ollama at ${this.endpoint}. Found ${models.length} model(s).`;
      if (gemmaModels.length > 0) {
        message += ` Detected compatible Gemma model(s): ${gemmaModels.map((m) => m.name).join(', ')}.`;
      } else {
        message += ` Note: No Gemma models currently installed. You can install one via 'ollama pull gemma2:2b'.`;
      }

      return {
        providerId: 'ollama',
        status: 'connected',
        endpoint: this.endpoint,
        message,
        testedAt,
        availableModels: models,
      };
    } catch (err) {
      const errorStr = err instanceof Error ? err.message : String(err);
      return {
        providerId: 'ollama',
        status: 'error',
        endpoint: this.endpoint,
        message: `Failed to connect to Ollama: ${errorStr}`,
        testedAt,
        availableModels: [],
        remediation:
          `Ensure Ollama is installed and active on the host machine. Run: 'ollama serve'.\n` +
          `If connecting from a browser in another origin, launch Ollama with CORS permissions: 'OLLAMA_ORIGINS="*" ollama serve'.\n` +
          `DevRelief will NEVER automatically download models in the background without explicit permission.`,
      };
    }
  }

  public validateRequest(request: AnalysisRequest): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!request.prompt || !request.prompt.trim()) {
      errors.push('Prompt cannot be empty.');
    }

    const totalSize = (request.prompt || '').length +
      (request.evidenceSnippets || []).reduce((acc, s) => acc + (s.content || '').length, 0);

    if (totalSize > this.maxPayloadBytes) {
      errors.push(
        `Payload size (${Math.round(totalSize / 1024)} KB) exceeds configured Ollama limit (${Math.round(this.maxPayloadBytes / 1024)} KB).`
      );
    }

    return { valid: errors.length === 0, errors };
  }

  public async analyze(request: AnalysisRequest): Promise<AnalysisResponse> {
    const startTime = performance.now();
    const validation = this.validateRequest(request);
    if (!validation.valid) {
      throw new Error(`Ollama validation failed: ${validation.errors.join(', ')}`);
    }

    // Pre-flight secret sanitization
    const promptSanitized = SecretScanner.scanAndRedact(request.prompt);
    let totalRedacted = promptSanitized.matches.length;

    let compiledPrompt = promptSanitized.sanitizedText;
    if (request.evidenceSnippets && request.evidenceSnippets.length > 0) {
      compiledPrompt += '\n\n---\n### Attached Evidence:\n';
      for (const snip of request.evidenceSnippets) {
        const sanitizedSnip = SecretScanner.scanAndRedact(snip.content);
        totalRedacted += sanitizedSnip.matches.length;
        compiledPrompt += `\n[Source: ${snip.source}]\n${sanitizedSnip.sanitizedText}\n`;
      }
    }

    const modelToUse = this.selectedModel || 'gemma2:2b';

    // Build abort controller with timeout
    const controller = new AbortController();
    const timeoutMs = request.timeoutMs || this.defaultTimeoutMs;
    const timeoutTimer = setTimeout(() => controller.abort(), timeoutMs);

    const onAbort = () => controller.abort();
    if (request.signal) {
      request.signal.addEventListener('abort', onAbort);
    }

    try {
      const resp = await this.fetchFn(`${this.endpoint}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          model: modelToUse,
          prompt: compiledPrompt,
          system: request.systemInstruction || 'You are an engineering assistant for DevRelief. Provide concise, grounded answers. If information is missing or uncertain, explicitly declare it as unknown.',
          stream: false,
          options: {
            temperature: request.temperature ?? 0.2,
          },
        }),
        signal: controller.signal,
      });

      if (!resp.ok) {
        const errorText = await resp.text().catch(() => resp.statusText);
        throw new Error(`Ollama generation failed [HTTP ${resp.status}]: ${errorText}`);
      }

      const data = await resp.json() as { response?: string; error?: string };
      if (data.error) {
        throw new Error(`Ollama error: ${data.error}`);
      }

      const generatedText = data.response || '';
      const duration = Math.round(performance.now() - startTime);

      return {
        text: generatedText,
        provenance: {
          providerId: 'ollama',
          providerDisplayName: this.displayName,
          modelId: modelToUse,
          modelFamily: modelToUse.toLowerCase().includes('gemma') ? 'gemma' : 'other',
          locality: 'local',
          epistemicClassification: 'inference',
          sanitizationPerformed: true,
          redactedSecretsCount: totalRedacted,
          executionDurationMs: duration,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (err) {
      // NOTE: Never automatically fall back to Gemini if Ollama fails!
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`Ollama request timed out or was cancelled after ${timeoutMs}ms.`);
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
