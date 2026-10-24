/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { EpistemicClassification, SourceReference } from './workflow.ts';

/**
 * Three Supported Operating Modes
 */
export type OperatingMode = 'deterministic' | 'local_ai' | 'cloud_ai';

/**
 * Supported Provider Identifiers
 */
export type ProviderId = 'deterministic' | 'ollama' | 'gemini';

/**
 * Locality classification: zero data leaves machine vs cloud processing
 */
export type ProcessingLocality = 'local' | 'cloud';

/**
 * Provider connection & readiness status
 */
export type ProviderConnectionStatus =
  | 'connected'
  | 'disconnected'
  | 'connecting'
  | 'error'
  | 'not_configured';

/**
 * Input modalities supported by models
 */
export type InputModality = 'text' | 'image' | 'diff' | 'log' | 'json';

/**
 * Model capabilities
 */
export type ModelCapability =
  | 'text_generation'
  | 'structured_output'
  | 'vision'
  | 'code_analysis'
  | 'streaming';

/**
 * Normalized AI Model Information
 */
export interface AIModelInfo {
  id: string;
  name: string;
  family: 'gemma' | 'gemini' | 'llama' | 'qwen' | 'mistral' | 'other' | 'deterministic';
  isGemmaFamily: boolean;
  locality: ProcessingLocality;
  contextWindowTokens?: number;
  capabilities: ModelCapability[];
  description?: string;
  sizeBytes?: number;
}

/**
 * Provider Configuration
 */
export interface ProviderConfig {
  providerId: ProviderId;
  ollamaEndpoint?: string; // Default: 'http://127.0.0.1:11434'
  selectedModel?: string;
  timeoutMs?: number; // Default: 30000ms
  maxPayloadBytes?: number; // Default: 512KB
  maxPromptCharacters?: number; // Default: 100,000 chars
}

/**
 * Explicit user consent package for cloud transmission
 */
export interface CloudConsentPackage {
  providerId: 'gemini';
  modelId: string;
  destination: string; // e.g. "Google Cloud Gemini API"
  payloadCharacterCount: number;
  payloadEstimatedTokens: number;
  dataSummary: string; // List of filenames and prompt excerpt
  userAgreed: boolean;
  agreedAt?: string;
}

/**
 * Analysis Request sent to any provider
 */
export interface AnalysisRequest {
  prompt: string;
  systemInstruction?: string;
  evidenceSnippets?: Array<{
    source: string;
    content: string;
    lineRange?: [number, number];
  }>;
  temperature?: number;
  maxTokens?: number;
  expectedSchema?: 'text' | 'json' | 'markdown';
  signal?: AbortSignal;
  timeoutMs?: number;
  /** Explicit user consent confirmation - MANDATORY for Cloud Gemini */
  userConsentGiven?: boolean;
}

/**
 * Provenance tracking metadata for AI or Deterministic outputs
 */
export interface ProvenanceMetadata {
  providerId: ProviderId;
  providerDisplayName: string;
  modelId: string;
  modelFamily: string;
  locality: ProcessingLocality;
  epistemicClassification: EpistemicClassification; // 'confirmed_fact' or 'inference'
  sanitizationPerformed: boolean;
  redactedSecretsCount: number;
  executionDurationMs: number;
  timestamp: string;
  sourceReferences?: SourceReference[];
}

/**
 * Standard Analysis Result returned by all providers
 */
export interface AnalysisResponse {
  text: string;
  structuredData?: Record<string, unknown>;
  provenance: ProvenanceMetadata;
  warnings?: string[];
}

/**
 * Diagnostic status report from a provider
 */
export interface ProviderDiagnostic {
  providerId: ProviderId;
  status: ProviderConnectionStatus;
  endpoint?: string;
  message: string;
  testedAt: string;
  availableModels: AIModelInfo[];
  remediation?: string;
  requiresConsent?: boolean;
}

/**
 * Unified Provider Interface Contract
 */
export interface IAnalysisProvider {
  readonly id: ProviderId;
  readonly displayName: string;
  readonly locality: ProcessingLocality;
  readonly supportedModalities: InputModality[];

  /**
   * Test connection and retrieve status report
   */
  checkConnection(signal?: AbortSignal): Promise<ProviderDiagnostic>;

  /**
   * Discover available models on this provider
   */
  listModels(signal?: AbortSignal): Promise<AIModelInfo[]>;

  /**
   * Pre-validate request before submission (size limits, secrets, consent)
   */
  validateRequest(request: AnalysisRequest): { valid: boolean; errors: string[] };

  /**
   * Execute analysis
   */
  analyze(request: AnalysisRequest): Promise<AnalysisResponse>;
}
