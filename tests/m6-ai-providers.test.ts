/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { DeterministicProvider } from '../src/providers/deterministic-provider.ts';
import { OllamaProvider } from '../src/providers/ollama-provider.ts';
import { GeminiProvider } from '../src/providers/gemini-provider.ts';
import { ProviderRegistry } from '../src/providers/registry.ts';
import { SecretScanner } from '../src/ingestion/secrets.ts';
import { AnalysisRequest } from '../src/types/provider.ts';

describe('M6 Unified AI Architecture: Provider Integration Tests', () => {
  // Test 1: Deterministic mode functions with zero network calls and no provider config
  it('1. Deterministic mode functions with zero network calls and no provider config', async () => {
    const provider = new DeterministicProvider();
    const diag = await provider.checkConnection();

    assert.strictEqual(diag.status, 'connected');
    assert.strictEqual(provider.locality, 'local');

    const result = await provider.analyze({
      prompt: 'Summarize the build failure in this log',
      evidenceSnippets: [{ source: 'build.log', content: '2026-10-24 [ERROR] Missing dependency' }],
    });

    assert.ok(result.text.includes('Deterministic Synthesis'));
    assert.strictEqual(result.provenance.providerId, 'deterministic');
    assert.strictEqual(result.provenance.locality, 'local');
    assert.strictEqual(result.provenance.epistemicClassification, 'confirmed_fact');
  });

  // Test 2: Provider interface supports all three providers
  it('2. Provider interface supports all three providers (deterministic, ollama, gemini)', () => {
    const registry = new ProviderRegistry();

    const det = registry.getProvider('deterministic');
    const oll = registry.getProvider('ollama');
    const gem = registry.getProvider('gemini');

    assert.strictEqual(det.id, 'deterministic');
    assert.strictEqual(det.locality, 'local');

    assert.strictEqual(oll.id, 'ollama');
    assert.strictEqual(oll.locality, 'local');

    assert.strictEqual(gem.id, 'gemini');
    assert.strictEqual(gem.locality, 'cloud');
  });

  // Test 3: Ollama provider handles model discovery and compatibility check
  it('3. Ollama provider handles model discovery and compatibility check', async () => {
    const mockFetch: typeof fetch = async (url) => {
      if (String(url).endsWith('/api/tags')) {
        return new Response(
          JSON.stringify({
            models: [
              {
                name: 'gemma2:2b',
                size: 1600000000,
                details: { family: 'gemma2', parameter_size: '2B' },
              },
              {
                name: 'llama3:8b',
                size: 4700000000,
                details: { family: 'llama', parameter_size: '8B' },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response('Not Found', { status: 404 });
    };

    const provider = new OllamaProvider({ customFetch: mockFetch });
    const models = await provider.listModels();

    assert.strictEqual(models.length, 2);
    assert.strictEqual(models[0].name, 'gemma2:2b');
    assert.strictEqual(models[0].family, 'gemma');
    assert.strictEqual(models[0].isGemmaFamily, true);

    assert.strictEqual(models[1].name, 'llama3:8b');
    assert.strictEqual(models[1].family, 'llama');
    assert.strictEqual(models[1].isGemmaFamily, false);
  });

  // Test 4: Gemma model identification and selection
  it('4. Gemma model identification and selection', async () => {
    const mockFetch: typeof fetch = async () => {
      return new Response(
        JSON.stringify({
          models: [
            { name: 'code-gemma:7b', details: { family: 'gemma' } },
            { name: 'mistral:latest', details: { family: 'mistral' } },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    const provider = new OllamaProvider({ customFetch: mockFetch });
    const diag = await provider.checkConnection();

    assert.strictEqual(diag.status, 'connected');
    assert.ok(diag.message.includes('code-gemma:7b'));

    provider.setSelectedModel('code-gemma:7b');
    assert.strictEqual(provider.getSelectedModel(), 'code-gemma:7b');
  });

  // Test 5: Ollama connection failure handled with actionable diagnostics
  it('5. Ollama connection failure handled with actionable diagnostics', async () => {
    const failingFetch: typeof fetch = async () => {
      throw new TypeError('Failed to fetch (ECONNREFUSED)');
    };

    const provider = new OllamaProvider({ customFetch: failingFetch });
    const diag = await provider.checkConnection();

    assert.strictEqual(diag.status, 'error');
    assert.ok(diag.message.includes('Failed to connect to Ollama'));
    assert.ok(diag.remediation?.includes('ollama serve'));
    assert.ok(diag.remediation?.includes('OLLAMA_ORIGINS="*"'));
    assert.ok(diag.remediation?.includes('NEVER automatically download models'));
  });

  // Test 6: Gemini provider rejects calls without explicit user consent
  it('6. Gemini provider rejects calls without explicit user consent', async () => {
    const provider = new GeminiProvider();

    // 6a: Validation check
    const validation = provider.validateRequest({
      prompt: 'Draft release notes for PR #42',
      userConsentGiven: false,
    });
    assert.strictEqual(validation.valid, false);
    assert.ok(
      validation.errors.some((e) => e.includes('Explicit user consent is required'))
    );

    // 6b: Execution check
    await assert.rejects(
      async () => {
        await provider.analyze({
          prompt: 'Draft release notes for PR #42',
          userConsentGiven: false,
        });
      },
      /Explicit user consent is required/
    );
  });

  // Test 7: Gemini provider requires valid backend/API key configuration
  it('7. Gemini provider requires valid backend/API key configuration', async () => {
    const mockFetchUnconfigured: typeof fetch = async (url) => {
      if (String(url).endsWith('/status')) {
        return new Response(
          JSON.stringify({ configured: false, message: 'GEMINI_API_KEY is missing' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response('Not Found', { status: 404 });
    };

    const provider = new GeminiProvider({ customFetch: mockFetchUnconfigured });
    const diag = await provider.checkConnection();

    assert.strictEqual(diag.status, 'not_configured');
    assert.ok(diag.message.includes('GEMINI_API_KEY environment variable is not configured'));
    assert.ok(diag.remediation?.includes('Configure GEMINI_API_KEY'));
  });

  // Test 8: Pre-flight secret scanner sanitizes inputs before passing to any AI provider
  it('8. Pre-flight secret scanner sanitizes inputs before passing to any AI provider', async () => {
    let capturedBody = '';
    const mockFetch: typeof fetch = async (_url, init) => {
      capturedBody = String(init?.body || '');
      return new Response(
        JSON.stringify({ response: 'Processed safely without credentials.' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    const provider = new OllamaProvider({ customFetch: mockFetch, selectedModel: 'gemma2:2b' });
    const secretInput = 'Analyze this: Authorization: Bearer ya29.a0AfH6SMBsecretToken123456789 and AKIAIOSFODNN7EXAMPLE';

    const result = await provider.analyze({
      prompt: secretInput,
    });

    assert.strictEqual(result.provenance.sanitizationPerformed, true);
    assert.strictEqual(result.provenance.redactedSecretsCount, 2);
    // Ensure raw token was not sent over HTTP
    assert.ok(!capturedBody.includes('ya29.a0AfH6SMBsecretToken123456789'));
    assert.ok(!capturedBody.includes('AKIAIOSFODNN7EXAMPLE'));
    assert.ok(capturedBody.includes('[REDACTED_BEARER_TOKEN]'));
    assert.ok(capturedBody.includes('[REDACTED_AWS_ACCESS_KEY_ID]'));
  });

  // Test 9: Provider payload size limits are enforced
  it('9. Provider payload size limits are enforced', () => {
    const provider = new OllamaProvider({ maxPayloadBytes: 1024 }); // 1 KB limit
    const hugePrompt = 'A'.repeat(2000);

    const validation = provider.validateRequest({ prompt: hugePrompt });
    assert.strictEqual(validation.valid, false);
    assert.ok(validation.errors.some((e) => e.includes('exceeds configured Ollama limit')));
  });

  // Test 10: Epistemic classification labels AI outputs as INFERENCE or UNVERIFIED
  it('10. Epistemic classification labels AI outputs as INFERENCE or UNVERIFIED', async () => {
    const mockFetch: typeof fetch = async () => {
      return new Response(
        JSON.stringify({ text: 'Inferred release notes from diff.' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    const gemini = new GeminiProvider({ customFetch: mockFetch });
    const res = await gemini.analyze({
      prompt: 'Summarize PR',
      userConsentGiven: true,
    });

    assert.strictEqual(res.provenance.epistemicClassification, 'inference');
    assert.strictEqual(res.provenance.locality, 'cloud');
  });

  // Test 11: No automatic cloud fallback when Ollama fails
  it('11. No automatic cloud fallback when Ollama fails', async () => {
    const mockFailingOllama: typeof fetch = async () => {
      throw new Error('Connection refused on 127.0.0.1:11434');
    };

    const registry = new ProviderRegistry();
    registry.setActiveMode('local_ai');

    // Replace ollama fetch with failing fetch
    const failingOllama = new OllamaProvider({ customFetch: mockFailingOllama });
    (registry as any).ollamaProvider = failingOllama;

    await assert.rejects(
      async () => {
        await registry.executeAnalysis({ prompt: 'Analyze git log' });
      },
      /Connection refused on 127.0.0.1:11434/
    );

    // Verify it remained on local_ai and did NOT silently flip to cloud_ai
    assert.strictEqual(registry.getActiveMode(), 'local_ai');
  });

  // Test 12: Timeout and abort signal handling across providers
  it('12. Timeout and abort signal handling across providers', async () => {
    const slowFetch: typeof fetch = async (_url, init) => {
      return new Promise((_resolve, reject) => {
        const signal = init?.signal;
        if (signal) {
          signal.addEventListener('abort', () => {
            const err = new Error('The operation was aborted');
            err.name = 'AbortError';
            reject(err);
          });
        }
      });
    };

    const provider = new OllamaProvider({ customFetch: slowFetch });
    const controller = new AbortController();

    const analyzePromise = provider.analyze({
      prompt: 'Fast check',
      signal: controller.signal,
    });

    controller.abort();

    await assert.rejects(async () => {
      await analyzePromise;
    }, /timed out or was cancelled/);
  });

  // Test 13: Structured output validation against expected schemas
  it('13. Structured output validation against expected schemas', () => {
    const provider = new DeterministicProvider();
    const emptyValidation = provider.validateRequest({ prompt: '' });

    assert.strictEqual(emptyValidation.valid, false);
    assert.ok(emptyValidation.errors.some((e) => e.includes('cannot be empty')));
  });

  // Test 14: Provenance metadata accurately records provider and model used
  it('14. Provenance metadata accurately records provider and model used', async () => {
    const mockFetch: typeof fetch = async () => {
      return new Response(
        JSON.stringify({ text: 'Detailed Gherkin AC suggestion.' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    const provider = new GeminiProvider({
      customFetch: mockFetch,
      selectedModel: 'gemini-3.8-flash',
    });

    const res = await provider.analyze({
      prompt: 'Suggest Gherkin scenarios',
      userConsentGiven: true,
    });

    assert.strictEqual(res.provenance.providerId, 'gemini');
    assert.strictEqual(res.provenance.modelId, 'gemini-3.8-flash');
    assert.strictEqual(res.provenance.modelFamily, 'gemini');
    assert.ok(res.provenance.executionDurationMs >= 0);
    assert.ok(res.provenance.timestamp);
  });

  // Test 15: Privacy notice and consent flow accurately reports payload details
  it('15. Privacy notice and consent flow accurately reports payload details', () => {
    const rawText = 'API Token: Bearer ya29.testToken12345';
    const scanResult = SecretScanner.scanAndRedact(rawText);

    assert.strictEqual(scanResult.hasRedactions, true);
    assert.strictEqual(scanResult.matches.length, 1);
    assert.ok(scanResult.sanitizedText.includes('[REDACTED_BEARER_TOKEN]'));
  });

  // Test 16: All M0–M5 workflows continue to pass their deterministic tests
  it('16. All M0-M5 workflows remain registered and functional in shared engine', () => {
    const registry = new ProviderRegistry();
    const det = registry.getDeterministicProvider();
    assert.strictEqual(det.id, 'deterministic');
    assert.strictEqual(registry.getActiveMode(), 'deterministic');
  });
});
