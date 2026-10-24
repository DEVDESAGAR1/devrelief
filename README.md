# DevRelief

> **Make work feel lighter.**  
> A web-first, local-first productivity workbench for software delivery teams.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Status: v1.0.0 Production](https://img.shields.io/badge/Status-v1.0.0%20Production-emerald.svg)](docs/ROADMAP.md)
[![Architecture: Local--First](https://img.shields.io/badge/Architecture-Local--First-purple.svg)](docs/ARCHITECTURE.md)
[![Privacy: Zero Telemetry](https://img.shields.io/badge/Privacy-Zero%20Telemetry-success.svg)](docs/SECURITY.md)
[![Tests: 101/101 Passing](https://img.shields.io/badge/Tests-101%2F101%20Passing-brightgreen.svg)](docs/TESTING.md)

---

## 1. Product Vision

Modern engineering teams lose hours every week to repetitive coordination, hunting through massive CI logs, transcribing whiteboard notes into user stories, and manually synthesizing release notes.

**DevRelief** is a structured productivity workbench designed to make work feel lighter. Instead of being an ungrounded chat interface that fabricates answers, DevRelief gives engineers, product owners, Scrum Masters, QA engineers, and engineering managers a reliable, local-first workspace to:

1. **Describe a Task & Ingest Evidence:** Drag-and-drop CI logs, screenshots, Git diffs, test reports, and specifications.
2. **Execute Deterministic Workflows:** Parse, extract, and categorize information reliably with zero AI dependencies.
3. **Optionally Accelerate with Local AI:** Leverage local Ollama models (such as Google Gemma 2 and Llama 3) for semantic synthesis—with zero data leaving your machine.
4. **Inspect Unbroken Provenance:** Review structured deliverables where every fact links directly to verified source lines, byte offsets, or visual regions.
5. **Reusable Recipes & History:** Save workflow presets as recipes, inspect execution audit history with retention pruning, and search locally across all assets.
6. **Retain Absolute Control:** All external actions require human approval. No automatic command execution.

---

## 2. Five Delivery Audiences on One Shared Engine

A single, shared workflow engine powers tailored experiences for 10 implemented workflows across 5 roles:

- 💻 **Software Developers:**
  - `WF-DEV-01: Git Activity Daily Digest`: Categorized morning updates from commit histories with hash citations.
  - `WF-DEV-02: Change Summaries & Release Notes`: Breaking change detection and stakeholder draft notes from diffs.
  - `WF-DEV-03: CI Failure Triage`: Extracts first meaningful failure, clusters repeated errors, and suggests inert debug commands.
- 📋 **Product Owners:**
  - `WF-PO-01: Rough Notes to User Stories & Gherkin AC`: Structured Given/When/Then scenarios from messy notes.
  - `WF-PO-02: Requirements Ambiguity Scanner`: Flags vague quantifiers, unresolved TBDs, and conflicting requirements.
- ⏱️ **Scrum Masters:**
  - `WF-SM-01: Meeting Notes to Action Item Matrix`: Extracts owners, due dates, and separates decisions from discussion.
  - `WF-SM-02: Sprint Retrospective Thematic Clusterer`: Groups retro feedback into actionable themes.
- 🧪 **QA Engineers:**
  - `WF-QA-01: Specification to Test Scenario Matrix`: Positive, negative, and edge boundary test matrices from stories.
  - `WF-QA-02: Error Screenshot & Trace to Bug Repro Ticket`: Sanitizes secrets pre-flight and formats standardized bug tickets.
- 📊 **Engineering Managers & Team Leads:**
  - `WF-EM-01: Multi-Source Delivery Summary & Blocker Matrix`: Aggregates Git activity, CI test runs, and sprint blockers with explicit data limits.

---

## 3. Three Operating Modes

1. **Deterministic Baseline:** 100% offline, algorithmic parsing with zero tokens, zero cost, and zero network calls.
2. **Local AI (Ollama + Gemma):** Open-weight models running on `127.0.0.1:11434` with zero telemetry leaving the workstation.
3. **Cloud AI (Google Gemini):** Google's official Gemini API (`gemini-3.8-flash`), strictly gated by per-request explicit user consent and server-side credential isolation.

---

## 4. Reusable Recipes, Execution History & Local Search (Milestone 7)

- **Workflow Recipes:** Save reusable presets with default inputs, tags, and provider preferences. Export and import recipes safely with strict prototype pollution protection.
- **Execution History:** Auditable local log capturing timestamps, duration, status, disclaimers, and distinct requested mode vs actually executed engine.
- **Privacy Controls:** Opt-in toggle to disable history recording, configurable retention cap (auto-pruning oldest entries), single/bulk deletion, and secret-scrubbed export.
- **Local Search Index:** Fast, client-side, deterministic search across all workflows, saved recipes, and execution logs with role, entity, and provider filters.

---

## 5. Security & Privacy Hardening (Milestone 8)

- **Pre-Flight Secret Scanner:** Scrub AWS keys, GitHub tokens, Bearer headers, and private keys before storage, transmission, or display.
- **Server-Side Credential Boundary:** `GEMINI_API_KEY` is maintained strictly server-side and is never returned in client bundles, responses, or error traces.
- **Explicit Cloud Consent Gate:** HTTP 403 returned on `/api/gemini/generate` unless explicit consent is confirmed in UI.
- **SSRF Prevention:** Backend proxy URL validation strictly enforces `http:` and `https:` schemes.
- **Security Response Headers:** `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, and strict referrer policy.
- **Zero Telemetry:** No external analytics trackers, beacons, or third-party cookies.

---

## 6. Quickstart & Verification

```bash
# Install dependencies
npm install

# Run the automated test suite (21 suites, 101 tests)
npm test

# Run TypeScript static check
npm run lint

# Build production assets
npm run build

# Start dev server (Express backend on port 3000)
npm run dev
```

---

## 7. Strict Architectural Boundary: DevWorkBench

**DevWorkBench** is a separate project dedicated to automated code repair and Safe Fix algorithms. DevRelief strictly maintains this boundary: DevRelief focuses on communication, multimodal evidence ingestion, multi-role orchestration, and structured deliverable authoring, and never modifies or duplicates DevWorkBench.
