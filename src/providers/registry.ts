/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  IAnalysisProvider,
  ProviderId,
  OperatingMode,
  ProviderDiagnostic,
  AnalysisRequest,
  AnalysisResponse,
} from '../types/provider.ts';
import { DeterministicProvider } from './deterministic-provider.ts';
import { OllamaProvider } from './ollama-provider.ts';
import { GeminiProvider } from './gemini-provider.ts';

const STORAGE_KEY_MODE = 'devrelief_active_mode';
const STORAGE_KEY_OLLAMA_ENDPOINT = 'devrelief_ollama_endpoint';
const STORAGE_KEY_OLLAMA_MODEL = 'devrelief_ollama_model';
const STORAGE_KEY_GEMINI_MODEL = 'devrelief_gemini_model';

export class ProviderRegistry {
  private static instance: ProviderRegistry;

  private deterministicProvider: DeterministicProvider;
  private ollamaProvider: OllamaProvider;
  private geminiProvider: GeminiProvider;
  private activeMode: OperatingMode = 'deterministic';

  private listeners: Array<(mode: OperatingMode) => void> = [];

  constructor() {
    this.deterministicProvider = new DeterministicProvider();
    this.ollamaProvider = new OllamaProvider({
      endpoint: this.getSavedItem(STORAGE_KEY_OLLAMA_ENDPOINT) || 'http://127.0.0.1:11434',
      selectedModel: this.getSavedItem(STORAGE_KEY_OLLAMA_MODEL) || '',
    });
    this.geminiProvider = new GeminiProvider({
      selectedModel: this.getSavedItem(STORAGE_KEY_GEMINI_MODEL) || GeminiProvider.DEFAULT_MODEL,
    });

    const savedMode = this.getSavedItem(STORAGE_KEY_MODE) as OperatingMode | null;
    if (savedMode === 'local_ai' || savedMode === 'cloud_ai' || savedMode === 'deterministic') {
      this.activeMode = savedMode;
    }
  }

  public static getInstance(): ProviderRegistry {
    if (!ProviderRegistry.instance) {
      ProviderRegistry.instance = new ProviderRegistry();
    }
    return ProviderRegistry.instance;
  }

  private getSavedItem(key: string): string | null {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
    } catch {
      // Ignore in non-browser/test environments
    }
    return null;
  }

  private setSavedItem(key: string, value: string): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
    } catch {
      // Ignore
    }
  }

  public getActiveMode(): OperatingMode {
    return this.activeMode;
  }

  public setActiveMode(mode: OperatingMode): void {
    this.activeMode = mode;
    this.setSavedItem(STORAGE_KEY_MODE, mode);
    this.notifyListeners();
  }

  public getProvider(id: ProviderId): IAnalysisProvider {
    switch (id) {
      case 'deterministic':
        return this.deterministicProvider;
      case 'ollama':
        return this.ollamaProvider;
      case 'gemini':
        return this.geminiProvider;
    }
  }

  public getActiveProvider(): IAnalysisProvider {
    switch (this.activeMode) {
      case 'deterministic':
        return this.deterministicProvider;
      case 'local_ai':
        return this.ollamaProvider;
      case 'cloud_ai':
        return this.geminiProvider;
    }
  }

  public getDeterministicProvider(): DeterministicProvider {
    return this.deterministicProvider;
  }

  public getOllamaProvider(): OllamaProvider {
    return this.ollamaProvider;
  }

  public getGeminiProvider(): GeminiProvider {
    return this.geminiProvider;
  }

  public setOllamaEndpoint(endpoint: string): void {
    this.ollamaProvider.setEndpoint(endpoint);
    this.setSavedItem(STORAGE_KEY_OLLAMA_ENDPOINT, endpoint);
  }

  public setOllamaModel(model: string): void {
    this.ollamaProvider.setSelectedModel(model);
    this.setSavedItem(STORAGE_KEY_OLLAMA_MODEL, model);
  }

  public setGeminiModel(model: string): void {
    this.geminiProvider.setSelectedModel(model);
    this.setSavedItem(STORAGE_KEY_GEMINI_MODEL, model);
  }

  public async checkAllProviders(): Promise<Record<ProviderId, ProviderDiagnostic>> {
    const [det, oll, gem] = await Promise.all([
      this.deterministicProvider.checkConnection(),
      this.ollamaProvider.checkConnection(),
      this.geminiProvider.checkConnection(),
    ]);

    return {
      deterministic: det,
      ollama: oll,
      gemini: gem,
    };
  }

  public onModeChange(listener: (mode: OperatingMode) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notifyListeners(): void {
    for (const l of this.listeners) {
      try {
        l(this.activeMode);
      } catch (err) {
        console.error('Error in mode listener:', err);
      }
    }
  }

  /**
   * Safe execution proxy that routes to the active provider with no automatic cloud fallback
   */
  public async executeAnalysis(request: AnalysisRequest): Promise<AnalysisResponse> {
    const provider = this.getActiveProvider();
    return provider.analyze(request);
  }
}
