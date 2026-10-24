/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Shield,
  HardDrive,
  RefreshCw,
  Lock,
  Cpu,
  Cloud,
  CheckCircle2,
  AlertTriangle,
  Radio,
  ExternalLink,
  Sparkles,
  Info,
} from 'lucide-react';
import { ProviderRegistry } from '../../providers/registry.ts';
import { OperatingMode, ProviderDiagnostic, AIModelInfo } from '../../types/provider.ts';

export const SettingsView: React.FC = () => {
  const [registry] = useState(() => ProviderRegistry.getInstance());
  const [currentMode, setCurrentMode] = useState<OperatingMode>(registry.getActiveMode());
  const [ollamaEndpoint, setOllamaEndpoint] = useState(registry.getOllamaProvider().getEndpoint());
  const [selectedOllamaModel, setSelectedOllamaModel] = useState(registry.getOllamaProvider().getSelectedModel());
  const [selectedGeminiModel, setSelectedGeminiModel] = useState(registry.getGeminiProvider().getSelectedModel());

  const [diagnostics, setDiagnostics] = useState<Record<string, ProviderDiagnostic | null>>({
    deterministic: null,
    ollama: null,
    gemini: null,
  });
  const [isChecking, setIsChecking] = useState(false);
  const [cleared, setCleared] = useState(false);

  useEffect(() => {
    // Initial connection diagnostics check
    runDiagnostics();
  }, []);

  const runDiagnostics = async () => {
    setIsChecking(true);
    try {
      const results = await registry.checkAllProviders();
      setDiagnostics(results);
      if (results.ollama?.availableModels && results.ollama.availableModels.length > 0 && !selectedOllamaModel) {
        // Auto-select first or Gemma model if none selected
        const gemma = results.ollama.availableModels.find((m) => m.isGemmaFamily);
        const modelToSelect = gemma ? gemma.id : results.ollama.availableModels[0].id;
        setSelectedOllamaModel(modelToSelect);
        registry.setOllamaModel(modelToSelect);
      }
    } finally {
      setIsChecking(false);
    }
  };

  const handleModeChange = (mode: OperatingMode) => {
    setCurrentMode(mode);
    registry.setActiveMode(mode);
  };

  const handleOllamaEndpointChange = (endpoint: string) => {
    setOllamaEndpoint(endpoint);
    registry.setOllamaEndpoint(endpoint);
  };

  const handleOllamaModelChange = (model: string) => {
    setSelectedOllamaModel(model);
    registry.setOllamaModel(model);
  };

  const handleGeminiModelChange = (model: string) => {
    setSelectedGeminiModel(model);
    registry.setGeminiModel(model);
  };

  const handleClear = () => {
    localStorage.clear();
    setCleared(true);
    setTimeout(() => setCleared(false), 3000);
  };

  const ollamaDiag = diagnostics.ollama;
  const geminiDiag = diagnostics.gemini;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">AI Engines & Privacy Settings</h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Configure operating modes, model runtimes, and local execution boundaries.
        </p>
      </div>

      {/* Operating Mode Selector */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-semibold text-white">Select Operating Mode</h2>
          </div>
          <button
            onClick={runDiagnostics}
            disabled={isChecking}
            className="text-xs px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${isChecking ? 'animate-spin' : ''}`} />
            <span>{isChecking ? 'Checking...' : 'Re-check Providers'}</span>
          </button>
        </div>

        {/* 3 Modes Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Mode 1: Deterministic */}
          <button
            type="button"
            onClick={() => handleModeChange('deterministic')}
            className={`p-4 rounded-xl border text-left transition-all ${
              currentMode === 'deterministic'
                ? 'bg-blue-950/40 border-blue-500 ring-1 ring-blue-500'
                : 'bg-slate-950 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="p-2 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/80">
                <Shield className="w-4 h-4" />
              </span>
              {currentMode === 'deterministic' && (
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-900/80 text-blue-300 border border-blue-700">
                  ACTIVE
                </span>
              )}
            </div>
            <h3 className="text-xs sm:text-sm font-bold text-white">1. Deterministic Mode</h3>
            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
              In-memory algorithmic parsing with zero AI models, zero tokens, and zero network calls.
            </p>
            <div className="mt-3 flex items-center gap-1 text-[10px] font-mono text-emerald-400">
              <CheckCircle2 className="w-3 h-3" />
              <span>100% Offline & Free</span>
            </div>
          </button>

          {/* Mode 2: Local AI (Ollama) */}
          <button
            type="button"
            onClick={() => handleModeChange('local_ai')}
            className={`p-4 rounded-xl border text-left transition-all ${
              currentMode === 'local_ai'
                ? 'bg-blue-950/40 border-blue-500 ring-1 ring-blue-500'
                : 'bg-slate-950 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="p-2 rounded bg-purple-950 text-purple-400 border border-purple-800/80">
                <Cpu className="w-4 h-4" />
              </span>
              {currentMode === 'local_ai' && (
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-900/80 text-blue-300 border border-blue-700">
                  ACTIVE
                </span>
              )}
            </div>
            <h3 className="text-xs sm:text-sm font-bold text-white">2. Local AI (Ollama)</h3>
            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
              Open-weight models (including Gemma 2, Llama 3) running entirely on localhost via Ollama.
            </p>
            <div className="mt-3 flex items-center gap-1 text-[10px] font-mono text-purple-400">
              <Lock className="w-3 h-3" />
              <span>Private On-Device</span>
            </div>
          </button>

          {/* Mode 3: Cloud AI (Gemini) */}
          <button
            type="button"
            onClick={() => handleModeChange('cloud_ai')}
            className={`p-4 rounded-xl border text-left transition-all ${
              currentMode === 'cloud_ai'
                ? 'bg-blue-950/40 border-blue-500 ring-1 ring-blue-500'
                : 'bg-slate-950 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="p-2 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/80">
                <Cloud className="w-4 h-4" />
              </span>
              {currentMode === 'cloud_ai' && (
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-900/80 text-blue-300 border border-blue-700">
                  ACTIVE
                </span>
              )}
            </div>
            <h3 className="text-xs sm:text-sm font-bold text-white">3. Cloud AI (Gemini)</h3>
            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
              Google Gemini via official API. Strictly gated by per-request explicit user consent.
            </p>
            <div className="mt-3 flex items-center gap-1 text-[10px] font-mono text-cyan-400">
              <Sparkles className="w-3 h-3" />
              <span>Consent-Gated</span>
            </div>
          </button>
        </div>
      </div>

      {/* Ollama Runtime Configuration */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-purple-400" />
            <h2 className="text-sm font-semibold text-white">Local AI: Ollama & Gemma Setup</h2>
          </div>
          <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded border ${
            ollamaDiag?.status === 'connected'
              ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
              : 'bg-amber-950 text-amber-400 border-amber-800'
          }`}>
            {ollamaDiag?.status === 'connected' ? 'CONNECTED' : 'DISCONNECTED / OFFLINE'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="ollama-endpoint" className="text-xs font-semibold text-slate-300">
              Ollama Host Endpoint
            </label>
            <input
              id="ollama-endpoint"
              type="text"
              value={ollamaEndpoint}
              onChange={(e) => handleOllamaEndpointChange(e.target.value)}
              placeholder="http://127.0.0.1:11434"
              className="w-full text-xs font-mono p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <p className="text-[11px] text-slate-500">Default local daemon: http://127.0.0.1:11434</p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="ollama-model-select" className="text-xs font-semibold text-slate-300">
              Installed Model (Gemma Recommended)
            </label>
            <select
              id="ollama-model-select"
              value={selectedOllamaModel}
              onChange={(e) => handleOllamaModelChange(e.target.value)}
              disabled={!ollamaDiag?.availableModels || ollamaDiag.availableModels.length === 0}
              className="w-full text-xs font-mono p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
            >
              {ollamaDiag?.availableModels && ollamaDiag.availableModels.length > 0 ? (
                ollamaDiag.availableModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} {m.isGemmaFamily ? '(Gemma Family)' : ''}
                  </option>
                ))
              ) : (
                <option value="">No models detected on Ollama</option>
              )}
            </select>
            <p className="text-[11px] text-slate-500">
              {ollamaDiag?.availableModels?.some((m) => m.isGemmaFamily)
                ? 'Gemma compatible model found!'
                : 'Run: ollama pull gemma2:2b to install Gemma locally.'}
            </p>
          </div>
        </div>

        {ollamaDiag?.status !== 'connected' && (
          <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-2">
            <div className="flex items-center gap-1.5 text-amber-400 font-semibold">
              <AlertTriangle className="w-4 h-4" />
              <span>Ollama Connectivity Notice</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed whitespace-pre-line">
              {ollamaDiag?.remediation || 'Ensure Ollama is running (`ollama serve`). If connecting from a browser in another origin, run: OLLAMA_ORIGINS="*" ollama serve.'}
            </p>
          </div>
        )}
      </div>

      {/* Cloud Gemini Configuration */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cloud className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-semibold text-white">Cloud AI: Google Gemini Integration</h2>
          </div>
          <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded border ${
            geminiDiag?.status === 'connected'
              ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
              : 'bg-slate-800 text-slate-400 border-slate-700'
          }`}>
            {geminiDiag?.status === 'connected' ? 'KEY CONFIGURED' : 'NO KEY SET'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="gemini-model-select" className="text-xs font-semibold text-slate-300">
              Gemini Model
            </label>
            <select
              id="gemini-model-select"
              value={selectedGeminiModel}
              onChange={(e) => handleGeminiModelChange(e.target.value)}
              className="w-full text-xs font-mono p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="gemini-3.8-flash">gemini-3.8-flash (Standard Fast Reasoning)</option>
              <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite (Ultra Low Latency)</option>
            </select>
            <p className="text-[11px] text-slate-500">Official Google GenAI SDK model</p>
          </div>

          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              <span>Server-Side Credential Boundary</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              API keys are maintained strictly server-side in environment variables or Settings &gt; Secrets. 
              The browser bundle never receives or stores your Gemini API key.
            </p>
          </div>
        </div>
      </div>

      {/* Privacy Guarantees */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Lock className="w-4 h-4 text-blue-400" />
          <span>Zero-Telemetry & Privacy Guarantees</span>
        </h2>
        <ul className="text-xs text-slate-300 space-y-2 list-disc list-inside">
          <li><strong>Zero Silent Background Uploads:</strong> No cloud requests are ever executed without explicit per-query user consent.</li>
          <li><strong>No Auto-Fallback:</strong> If Ollama is offline or fails, DevRelief will NEVER automatically redirect queries to Gemini.</li>
          <li><strong>No Automatic Model Downloads:</strong> DevRelief never runs background model downloads without user action.</li>
          <li><strong>Pre-Flight Secret Redaction:</strong> AWS tokens, GitHub credentials, Bearer tokens, and private keys are scrubbed before any AI analysis.</li>
        </ul>
      </div>

      {/* Local Storage & Cache */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-amber-400" />
          <span>Local Storage & Preference Management</span>
        </h2>

        <p className="text-xs text-slate-400">
          Preferences, history drafts, and mode selections reside in local browser storage.
        </p>

        <div className="pt-1">
          <button
            onClick={handleClear}
            className="px-3.5 py-2 rounded-md bg-red-950/60 hover:bg-red-900/60 text-red-300 border border-red-800/80 text-xs font-semibold flex items-center gap-2 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{cleared ? 'Local Data Cleared!' : 'Purge All Local Cache & Preferences'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
