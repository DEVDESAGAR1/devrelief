/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ExecutionHistoryEntry,
  HistorySettings,
  CURRENT_HISTORY_SCHEMA_VERSION,
} from '../types/history.ts';
import { SecretScanner } from '../ingestion/secrets.ts';

const HISTORY_STORAGE_KEY = 'devrelief:history:v1';
const SETTINGS_STORAGE_KEY = 'devrelief:history:settings';

export const DEFAULT_HISTORY_SETTINGS: HistorySettings = {
  enabled: true,
  maxEntries: 50,
};

export class HistoryStore {
  private static instance: HistoryStore | null = null;
  private memoryEntries: ExecutionHistoryEntry[] | null = null;
  private memorySettings: HistorySettings | null = null;

  public static getInstance(): HistoryStore {
    if (!HistoryStore.instance) {
      HistoryStore.instance = new HistoryStore();
    }
    return HistoryStore.instance;
  }

  private constructor() {
    this.ensureInitialized();
  }

  private isStorageAvailable(): boolean {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  }

  private ensureInitialized(): void {
    if (!this.isStorageAvailable()) {
      if (!this.memoryEntries) this.memoryEntries = [];
      if (!this.memorySettings) this.memorySettings = { ...DEFAULT_HISTORY_SETTINGS };
      return;
    }

    // Load settings
    try {
      const rawSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (rawSettings) {
        this.memorySettings = { ...DEFAULT_HISTORY_SETTINGS, ...JSON.parse(rawSettings) };
      } else {
        this.memorySettings = { ...DEFAULT_HISTORY_SETTINGS };
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(this.memorySettings));
      }
    } catch {
      this.memorySettings = { ...DEFAULT_HISTORY_SETTINGS };
    }

    // Load entries
    try {
      const rawEntries = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (rawEntries) {
        const parsed = JSON.parse(rawEntries);
        this.memoryEntries = Array.isArray(parsed) ? parsed : [];
      } else {
        this.memoryEntries = [];
      }
    } catch {
      this.memoryEntries = [];
    }
  }

  public getSettings(): HistorySettings {
    if (!this.memorySettings) this.ensureInitialized();
    return { ...(this.memorySettings || DEFAULT_HISTORY_SETTINGS) };
  }

  public updateSettings(partial: Partial<HistorySettings>): HistorySettings {
    const current = this.getSettings();
    const updated: HistorySettings = {
      ...current,
      ...partial,
      maxEntries: Math.max(5, Math.min(500, partial.maxEntries ?? current.maxEntries)),
    };
    this.memorySettings = updated;

    if (this.isStorageAvailable()) {
      try {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updated));
      } catch (err) {
        console.error('Failed to save history settings:', err);
      }
    }

    // If max entries decreased, prune existing history
    if (this.memoryEntries && this.memoryEntries.length > updated.maxEntries) {
      this.persist(this.memoryEntries.slice(0, updated.maxEntries));
    }

    return updated;
  }

  private persist(entries: ExecutionHistoryEntry[]): void {
    this.memoryEntries = entries;
    if (this.isStorageAvailable()) {
      try {
        localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(entries));
      } catch (err) {
        console.error('Failed to persist execution history to localStorage:', err);
      }
    }
  }

  public getAll(): ExecutionHistoryEntry[] {
    if (!this.memoryEntries) this.ensureInitialized();
    return [...(this.memoryEntries || [])];
  }

  public getById(id: string): ExecutionHistoryEntry | undefined {
    return this.getAll().find((h) => h.id === id);
  }

  /**
   * Record a new execution entry if history is enabled
   */
  public recordExecution(
    data: Omit<ExecutionHistoryEntry, 'id' | 'schemaVersion'>
  ): ExecutionHistoryEntry | null {
    const settings = this.getSettings();
    if (!settings.enabled) {
      return null;
    }

    // Pre-flight Secret Redaction on summary, preview, and error
    const sanitizedSummary = SecretScanner.scanAndRedact(data.summary || '').sanitizedText;
    const sanitizedPreview = data.resultMarkdownPreview
      ? SecretScanner.scanAndRedact(data.resultMarkdownPreview.slice(0, 1000)).sanitizedText
      : undefined;
    const sanitizedError = data.errorDetails
      ? SecretScanner.scanAndRedact(data.errorDetails).sanitizedText
      : undefined;

    const newId = `exec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const entry: ExecutionHistoryEntry = {
      id: newId,
      schemaVersion: CURRENT_HISTORY_SCHEMA_VERSION,
      workflowId: data.workflowId,
      workflowName: data.workflowName,
      targetRole: data.targetRole,
      startedAt: data.startedAt,
      completedAt: data.completedAt,
      durationMs: data.durationMs,
      status: data.status,
      providerModeRequested: data.providerModeRequested,
      providerActuallyUsed: data.providerActuallyUsed,
      modelUsed: data.modelUsed,
      recipeId: data.recipeId,
      recipeName: data.recipeName,
      recipeVersion: data.recipeVersion,
      summary: sanitizedSummary,
      evidenceSources: [...data.evidenceSources],
      epistemicRating: data.epistemicRating,
      disclaimers: [...(data.disclaimers || [])],
      warnings: [...(data.warnings || [])],
      errorDetails: sanitizedError,
      resultMarkdownPreview: sanitizedPreview,
    };

    const current = this.getAll();
    // Prepend new entry
    current.unshift(entry);

    // Prune if exceeds maxEntries
    const pruned = current.slice(0, settings.maxEntries);
    this.persist(pruned);

    return entry;
  }

  /**
   * Delete an individual history entry
   */
  public deleteEntry(id: string): boolean {
    const current = this.getAll();
    const filtered = current.filter((h) => h.id !== id);
    if (filtered.length !== current.length) {
      this.persist(filtered);
      return true;
    }
    return false;
  }

  /**
   * Clear all execution history
   */
  public clearAll(): void {
    this.persist([]);
  }

  /**
   * Export history entries as sanitized JSON string
   */
  public exportHistory(): string {
    const all = this.getAll();
    return JSON.stringify(
      {
        format: 'devrelief-history-export',
        schemaVersion: CURRENT_HISTORY_SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        count: all.length,
        history: all,
      },
      null,
      2
    );
  }
}
