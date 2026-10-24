# DevRelief

> **Make work feel lighter.**  
> A web-first, local-first productivity workbench for software delivery teams.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Status: Milestone 0 Foundation](https://img.shields.io/badge/Status-Milestone%200%20Foundation-emerald.svg)](docs/ROADMAP.md)
[![Architecture: Local--First](https://img.shields.io/badge/Architecture-Local--First-purple.svg)](docs/ARCHITECTURE.md)
[![Privacy: Zero Silent Uploads](https://img.shields.io/badge/Privacy-Zero%20Silent%20Uploads-success.svg)](docs/SECURITY.md)

---

## 1. Product Vision

Modern engineering teams lose hours every week to repetitive coordination, hunting through massive CI logs, transcribing whiteboard notes into user stories, and manually synthesizing release notes.

**DevRelief** is a structured productivity workbench designed to make work feel lighter. Instead of being an ungrounded chat interface that fabricates answers, DevRelief gives engineers, product owners, Scrum Masters, QA engineers, and engineering managers a reliable, local-first workspace to:

1. **Describe a Task & Ingest Evidence:** Drag-and-drop CI logs, screenshots, Git diffs, test reports, and specifications.
2. **Execute Deterministic Workflows:** Parse, extract, and categorize information reliably with zero AI dependencies.
3. **Optionally Accelerate with Local AI:** Leverage local Ollama models (such as Gemma 2 and Llama 3) for semantic synthesis—with zero data leaving your machine.
4. **Inspect Unbroken Provenance:** Review structured deliverables where every fact links directly to verified source lines, byte offsets, or visual regions.
5. **Retain Absolute Control:** All external actions require human approval. No automatic command execution.

---

## 2. Five Delivery Audiences on One Shared Engine

DevRelief does not split into five disparate tools. A single, shared workflow engine powers tailored experiences for:

- 💻 **Software Developers:** Git activity daily digests, CI failure root-cause extraction, change summaries, and release notes from diffs.
- 📋 **Product Owners:** Meeting notes to user stories, draft acceptance criteria, and automated requirements ambiguity detection.
- ⏱️ **Scrum Masters:** Meeting transcripts to action item matrices, sprint review/retro summaries, and blocker tracking.
- 🧪 **QA Engineers:** Specifications to test scenario matrices, error screenshots to reproducible bug reports, and AC coverage checks.
- 📊 **Engineering Managers & Team Leads:** Multi-source delivery status dashboards, blocker trend summaries, and technical handover briefs.

---

## 3. Strict Architectural Boundary: DevWorkBench

**DevWorkBench** is a separate external project dedicated to automated code repair and Safe Fix algorithms.

DevRelief strictly maintains this boundary:
- DevRelief does not duplicate Safe Fix engines, AST mutation logic, or compiler remediation loops.
- DevRelief focuses on communication, multimodal evidence ingestion, multi-role orchestration, and structured deliverable authoring.
- If DevRelief integrates with DevWorkBench in future milestones, it will do so exclusively via verified CLI or API contracts, and will remain 100% operational when DevWorkBench is not present.

---

## 4. Documentation Suite

Comprehensive specifications created in Milestone 0:

| Document | Description |
| :--- | :--- |
| **[Product Specification](docs/PRODUCT_SPEC.md)** | Full product vision, core philosophy, 5 audience profiles, and 10 detailed workflow specifications. |
| **[UX Specification](docs/UX_SPEC.md)** | Desktop and mobile blueprints for Screens A through F, responsive behaviors, and WCAG 2.2 AA accessibility guidelines. |
| **[UI Design System](docs/UI_DESIGN_SYSTEM.md)** | Design tokens, color palette, typography scale, anti-AI slop principles, and epistemic badge standards. |
| **[Technical Architecture](docs/ARCHITECTURE.md)** | System topology, React/TypeScript/Vite stack, Shared Workflow Engine, and AI provider abstraction (`IAnalysisProvider`). |
| **[Multimodal Ingestion](docs/MULTIMODAL_INGESTION.md)** | 12-stage ingestion pipeline, format support matrix, bounded large-file handling, and evidence provenance schema. |
| **[Security & Privacy](docs/SECURITY.md)** | Threat model, zero-trust file ingestion, regex secret redaction engine, prompt injection defense, and local retention rules. |
| **[Deployment Guide](docs/DEPLOYMENT.md)** | Local-first desktop, self-hosted team container, and cloud web preview deployment profiles. |
| **[Implementation Roadmap](docs/ROADMAP.md)** | Sequential milestones M0 through M8 with dependency graphs and exit gates. |
| **[Testing & QA Strategy](docs/TESTING.md)** | Test pyramid, testable acceptance criteria matrices, and M1 quality gates. |

---

## 5. Repository Structure

```
.
├── LICENSE                     # MIT License
├── README.md                   # Project overview & architectural guide
├── index.html                  # HTML entry point with synchronized metadata
├── metadata.json               # Application metadata & capabilities
├── package.json                # Project dependencies and npm scripts
├── tsconfig.json               # Strict TypeScript configuration
├── vite.config.ts              # Vite bundler configuration
├── docs/                       # Architectural & product specifications
│   ├── ARCHITECTURE.md         # Technical architecture & provider abstraction
│   ├── DEPLOYMENT.md           # Deployment profiles & environment setup
│   ├── MULTIMODAL_INGESTION.md # 12-stage ingestion pipeline & provenance schema
│   ├── PRODUCT_SPEC.md         # Product vision & role workflow contracts
│   ├── ROADMAP.md              # Milestones M0 through M8
│   ├── SECURITY.md             # Threat model, secret scanner & privacy controls
│   ├── TESTING.md              # Test matrix, acceptance criteria & quality gates
│   ├── UI_DESIGN_SYSTEM.md     # Design tokens & anti-slop guidelines
│   └── UX_SPEC.md              # Responsive desktop & mobile screen blueprints
└── src/                        # Foundation frontend application
    ├── App.tsx                 # Interactive M0 Foundation & Specification Portal
    ├── main.tsx                # React DOM root entry point
    └── index.css               # Tailwind CSS entry point
```

---

## 6. Quick Start & Verification

### Prerequisites
- Node.js 20+
- npm 10+

### Installation & Development Run
```bash
# Install dependencies
npm install

# Start local development server
npm run dev
```

Visit `http://localhost:3000` to interact with the DevRelief Milestone 0 Foundation Portal.

### Verification Commands
```bash
# Type check and lint
npm run lint

# Run automated unit and integration tests (20 tests across 4 suites)
npm test

# Compile production bundle
npm run build
```

---

## 7. Supported Git Log Format & Classification Rules (M1)

### Primary Supported Format
Run the following standard Git command inside any repository:
```bash
git log --format="%H%n%an%n%aI%n%s"
```
This produces a structured 4-line record per commit:
- Line 1: `%H` — Full commit hash (SHA-1 / SHA-256)
- Line 2: `%an` — Author name
- Line 3: `%aI` — Author date in strict ISO 8601 format
- Line 4: `%s` — Subject line

Standard multi-line `git log` output (`commit <hash>`, `Author:`, `Date:`) is also supported.

### Conventional Classification Rules
The deterministic parser classifies commits into categories based on conventional commit prefixes:
- 🚀 **Features (`feat`):** New functional capabilities.
- 🐛 **Bug Fixes (`fix`):** Defect remediations.
- 📚 **Documentation (`docs`):** Documentation updates.
- ♻️ **Refactoring (`refactor`):** Structural code cleanup without behavioral changes.
- ⚡ **Performance (`perf`):** Latency or throughput optimizations.
- 🧪 **Testing (`test`):** Automated tests.
- 📦 **Build & CI (`build`, `ci`, `chore`):** Tooling and infrastructure.
- 🔀 **Merges:** Branch and pull request merges (`Merge branch...`, `Merge pull request...`).
- 📝 **Other:** Commits without recognized conventional prefixes.
- ⚠️ **Breaking Changes:** Identified by `!` (e.g. `feat!:`) or `BREAKING CHANGE:` in the subject.

### Classification Disclaimers & Known Limitations
- **Epistemic Boundary:** Commit hash, author, date, and raw subject are **Confirmed Facts** extracted directly from source metadata. Categorization is an **Inference** derived strictly from commit message prefixes.
- **No Implementation Verification:** Digest generation does not inspect or evaluate underlying code changes, ASTs, diff hunks, or test results.
- **Deferred Milestones:** Full multimodal ingestion (images, PDFs, secret scanners) is deferred to M2. Cloud AI and local Ollama inference are deferred to M6.

---

## 8. Current Status: Milestone 4 & Milestone 5 Complete

- [x] **M1:** Responsive application shell with desktop sidebar, mobile navigation, role switcher, and shared deterministic `WorkflowEngine` kernel.
- [x] **M1:** `WF-DEV-01 — Git Activity Daily Digest` working end-to-end with paste, sample loaders, `.log` upload, and unbroken source references.
- [x] **M2:** 12-Stage Multimodal Ingestion Pipeline (`MultimodalIngestionPipeline`, `FileValidator`, `SecretScanner`) supporting text, diffs, data, docs, and images.
- [x] **M2:** "Ask DevRelief" workspace (Screen B) with multi-file attachment tray, real-time secret redaction warnings, and source-grounded answers.
- [x] **M3 (Dev Workflows):** `WF-DEV-02 — Change Summary & Release Notes` and `WF-DEV-03 — CI Failure Triage` with log windowing, first error isolation, and inert diagnostic commands.
- [x] **M4 (Product Owner Workflows):** `WF-PO-01 — Rough Notes to User Stories & Gherkin AC` and `WF-PO-02 — Requirements Ambiguity Scanner` with contradiction detection citing both statements.
- [x] **M5 (Scrum Master Workflows):** `WF-SM-01 — Meeting Notes to Action Item Matrix` (explicit owners and dates) and `WF-SM-02 — Sprint Retrospective Thematic Clusterer` (positive, friction, and experiment proposals).
- [x] **M5 (QA Engineer Workflows):** `WF-QA-01 — Specification to Test Scenario Matrix` (positive, negative, and boundary tests) and `WF-QA-02 — Screenshot & Trace to Bug Repro Ticket` (pre-flight secret redaction).
- [x] **M5 (Engineering Manager Workflows):** `WF-EM-01 — Multi-Source Delivery Summary & Blocker Matrix` with cross-source correlation, risk assessments, and stakeholder briefings.
- [x] **Shared UI & Engine Integration:** All 10 workflows registered in `WORKFLOW_CATALOGUE` and runnable with live sample loaders in `WorkflowRunnerView`.
- [x] **Quality & Privacy Gate:** 70 unit and integration tests passing across 19 suites with zero failures. Zero external network calls or cloud AI requests.

**Next Milestone:** M6 — AI Provider Abstraction & Ollama Local Model Integration (Awaiting user authorization).
