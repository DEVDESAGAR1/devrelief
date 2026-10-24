# DevRelief — Technical Architecture

**Product:** DevRelief  
**Document:** System Architecture & Technical Specification  
**Status:** v1.0.0 Production Release  
**Version:** 1.0.0  

---

## 1. System Overview & Architectural Topology

DevRelief follows a modular, local-first topology designed to operate reliably on an engineer's laptop, inside an isolated corporate intranet, or as a self-hosted team server.

```mermaid
graph TB
    subgraph Client [Client Presentation Layer - React 19 + TypeScript + Vite]
        UI_Shell[App Shell & Navigation: Desktop Sidebar + MobileNav]
        Screen_Ask[Screen B: Ask DevRelief Canvas]
        Screen_WF[Screen D: Workflow Runner View - 10 Workflows]
        Screen_Cat[Screen C: Workflow Catalogue View - 5 Roles]
        Screen_Rec[Screen E1: Workflow Recipes View - Reusable Presets]
        Screen_Hist[Screen E2: Execution History View - Audit Provenance]
        Screen_Srch[Screen E3: Local Search Index View]
        Screen_Set[Screen F: Settings, Providers & Privacy]
    end

    subgraph CoreEngine [DevRelief Shared Core Engine]
        Ingest_Pipe[Multimodal Ingestion Pipeline]
        Prov_Tracker[Provenance & Evidence Tracker]
        Secret_Redact[Security & Secret Redaction Engine: SecretScanner]
        WF_Orchestrator[Workflow Orchestrator & State Machine: WorkflowEngine]
        Deterministic_Parsers[Deterministic Rule Engines: Git / Diffs / CI Logs / Stories / Gherkin / AC / Retros / Matrices]
    end

    subgraph StorageLayer [Local Persistence Subsystem]
        Recipe_Store[RecipeStore: Namespaced Local Storage + Prototype Guards]
        History_Store[HistoryStore: Execution Logs + Retention Pruner + Privacy Toggle]
        Search_Index[LocalSearchIndex: Deterministic Fast Multi-Entity Filter]
    end

    subgraph ProviderLayer [AI & Analysis Provider Abstraction]
        Provider_IF[Provider Interface: IAnalysisProvider]
        Prov_Det[Deterministic Core Engine: 100% In-Memory]
        Prov_Ollama[Local Ollama Provider: Gemma 2 / Llama 3 on 127.0.0.1:11434]
        Prov_Gemini[Cloud Gemini Provider: Consent-Gated via Server Proxy]
    end

    subgraph BackendProxy [Full-Stack Server Layer - Express]
        Server_Core[Express Server: Port 3000]
        Gemini_Gate[/api/gemini/generate: Mandatory Consent Enforcement]
        Ollama_Bridge[/api/ollama/tags: SSRF-Protected Proxy]
        Static_Vite[Vite Dev Middleware / Production Static Asset Serve]
    end

    UI_Shell --> Screen_WF
    UI_Shell --> Screen_Rec
    UI_Shell --> Screen_Hist
    UI_Shell --> Screen_Srch
    UI_Shell --> Screen_Set

    Screen_WF --> WF_Orchestrator
    Screen_WF --> Recipe_Store
    Screen_WF --> History_Store

    Screen_Rec --> Recipe_Store
    Screen_Hist --> History_Store
    Screen_Srch --> Search_Index

    Search_Index --> WF_Orchestrator
    Search_Index --> Recipe_Store
    Search_Index --> History_Store

    WF_Orchestrator --> Deterministic_Parsers
    Deterministic_Parsers --> Secret_Redact
    Secret_Redact --> Prov_Tracker

    Screen_WF --> Provider_IF
    Provider_IF --> Prov_Det
    Provider_IF --> Prov_Ollama
    Provider_IF --> Prov_Gemini

    Prov_Gemini --> Gemini_Gate
    Prov_Ollama --> Ollama_Bridge
```

---

## 2. Component Subsystems

### 2.1 Workflow Engine Kernel (`src/engine/kernel.ts`)
- Strict finite state machine transitions: `idle` ➔ `validating` ➔ `running` ➔ `succeeded` / `failed`.
- Never hangs indefinitely in `running` state: all exceptions, invalid inputs, or cancelled tasks transition cleanly to `failed`.
- Manages 10 registered workflows across 5 delivery roles:
  - Developer: `WF-DEV-01`, `WF-DEV-02`, `WF-DEV-03`
  - Product Owner: `WF-PO-01`, `WF-PO-02`
  - Scrum Master: `WF-SM-01`, `WF-SM-02`
  - QA Engineer: `WF-QA-01`, `WF-QA-02`
  - Engineering Manager: `WF-EM-01`

### 2.2 Reusable Workflow Recipes Subsystem (`src/storage/recipe-store.ts`)
- Reusable configurations capturing workflow ID, input defaults, auxiliary metadata, provider preference, version number, and tags.
- Security enforcement:
  - Input values pass through `SecretScanner`: recipes containing API keys or bearer tokens are rejected pre-flight.
  - Prototype pollution guards: Import revivers and validation functions explicitly reject objects containing `__proto__`, `constructor`, or `prototype` own properties.
  - Safe export & import: JSON export envelope with schema versioning (`CURRENT_RECIPE_SCHEMA_VERSION = 1`).

### 2.3 Local Execution History Subsystem (`src/storage/history-store.ts`)
- Auditable execution log recording every run (succeeded, failed, or cancelled).
- Captures:
  - `startedAt`, `completedAt`, and exact execution duration (`durationMs`).
  - Strict distinction between requested provider mode (`providerModeRequested`) and actual engine executed (`providerActuallyUsed`).
  - Epistemic classification (`confirmed_fact` vs `extrapolated_hypothesis`).
  - Evidence citations and source file references.
  - Sanitized summaries and previews (all secrets scrubbed before persistence).
- Privacy Controls:
  - User toggle to pause/disable history logging.
  - Configurable retention cap (default 50 entries, user customizable 5–500), automatically pruning oldest entries.
  - Single entry deletion and full history wipe with user confirmation.

### 2.4 Local Search Index (`src/storage/search-index.ts`)
- Fast, client-side, zero-telemetry search over all workbench assets.
- Single query tokenized across workflows, saved recipes, and execution history.
- Scoped filters by entity type (`all`, `workflow`, `recipe`, `history`), delivery role, execution status, and provider mode.
- Strict conjunction matching and relevance scoring.

### 2.5 Provider Architecture & Locality Classification (`src/providers/`)
- Unified `IAnalysisProvider` interface:
  - `DeterministicProvider`: 100% in-memory rule-based synthesis.
  - `OllamaProvider`: Connects to local runtime (`127.0.0.1:11434`), auto-detects Gemma 2 models, respects user permissions with no automatic downloads.
  - `GeminiProvider`: Connects to official Google Gemini API via backend proxy, requiring explicit per-query user consent.
