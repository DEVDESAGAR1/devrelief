# DevRelief — Testing Strategy & Quality Assurance Matrix

**Product:** DevRelief  
**Document:** Testing Strategy, Acceptance Criteria & Quality Gates  
**Status:** v1.0.0 Production Release  

---

## 1. Testing Philosophy & Verification Standards

DevRelief adheres to an **honest, empirical quality standard**:
1. **No Fabricated Pass Reports:** A test is only reported as passing if automated test runners or verified manual procedures have executed and passed.
2. **Deterministic Reproducibility:** Core parsers (Git log, diff, JSON/YAML, secret redactors) must have 100% deterministic outputs across platforms.
3. **Security by Assertion:** Automated regression suites actively attempt malicious file uploads, path traversals, prototype pollution, and prompt injections to verify defenses.
4. **Epistemic Integrity Tests:** The provenance engine is tested by asserting that every fact output contains a valid, verifiable byte or line reference to the original file.

---

## 2. Test Execution Summary

- **Total Test Suites:** 21 suites
- **Total Tests:** 101 tests
- **Passing Tests:** 101 tests (100% pass rate)
- **Failing / Skipped / Todo:** 0
- **Automated Runner Command:** `npm test` (invoking `tsx --test tests/**/*.test.ts`)
- **TypeScript Static Verification:** `npm run lint` (`tsc --noEmit`) passing with 0 errors
- **Production Build:** `npm run build` (`vite build`) passing with 0 errors

---

## 3. Test Suites Inventory

### 3.1 Test Suite: `WF-DEV-01: Git Activity Daily Digest` (4 tests)
- Input validation and rejection of empty/malformed git logs.
- Category grouping by conventional commit prefixes (`feat`, `fix`, `docs`, `refactor`).
- Source hash citation extraction and formatting.
- Deterministic output verification.

### 3.2 Test Suite: `WF-DEV-02: Change Summaries & Release Notes` (4 tests)
- Input validation and rejection of empty/non-diff input.
- Unified diff parsing with features, bug fixes, docs, and dependencies.
- Detection of potential breaking changes from deleted exports and schema statements.
- WorkflowEngine integration producing draft release notes with human review notices.

### 3.3 Test Suite: `WF-DEV-03: CI Failure Triage` (4 tests)
- Input validation and rejection of empty CI logs.
- Extraction of first meaningful failure and surrounding context lines.
- Repeated error clustering and hypothesis generation with probability ranking.
- Secret redaction in failure logs and inert command recommendations.

### 3.4 Test Suite: `WF-PO-01 & WF-PO-02: Product Owner Workflows` (12 tests)
- User story and Gherkin AC synthesis from bulleted notes.
- Clarification questions flagged when explicit benefits are missing.
- Rejection of empty or brief notes.
- Vague quantifier detection with suggested quantitative metrics.
- Unresolved dependency and placeholder detection (TBD / TODO).
- Direct contradiction detection citing both conflicting statements.
- Missing error handling on external integrations and payment flows.

### 3.5 Test Suite: `WF-SM-01 & WF-SM-02: Scrum Master Workflows` (7 tests)
- Explicit owner and due date extraction with unassigned status default.
- Decisions distinguished from proposals and discussions.
- Thematic grouping into Tooling, Process, Communication, Scope, and Quality.
- Unclustered feedback preservation and no fabricated statistical claims.

### 3.6 Test Suite: `WF-QA-01 & WF-QA-02: QA Engineer Workflows` (7 tests)
- Positive, negative, and boundary test scenarios synthesized from requirements.
- Untestable subjective requirements flagged.
- Bug reproduction ticket formatted from error logs and stack traces.
- Pre-flight secret token redaction in bug ticket output.
- Passive screenshot metadata note and visual reasoning limitations disclosed.

### 3.7 Test Suite: `WF-EM-01: Engineering Manager Delivery Workflow` (4 tests)
- Multi-source aggregation across commits, CI status, test counts, and blockers.
- Active blocker matrix with explicit owner and follow-up recommendation.
- Non-inference of deployment success from build status alone.
- Clean delivery evidence handled without fabricating failures or metrics.

### 3.8 Test Suite: `WorkflowEngine Kernel & Role Eligibility` (10 tests)
- State machine lifecycle transitions: `idle -> validating -> running -> succeeded` and `failed`.
- Validation failure recovery without stuck running states.
- Zero external network requests verification via intercepted `globalThis.fetch`.
- Dynamic role filtering across all 5 delivery roles.
- Verification that all 10 workflows across M1–M5 are implemented.

### 3.9 Test Suite: `Multimodal Ingestion Pipeline` (14 tests)
- Magic byte detection and file validation across `.log`, `.txt`, `.json`, `.csv`, `.md`, `.diff`, `.pdf`, `.docx`, images.
- Real-time `SecretScanner` line-by-line redaction (AWS keys, GitHub tokens, Bearer tokens, private keys).
- File size boundary checks and bounded extraction quotas.

### 3.10 Test Suite: `M6: Unified AI Provider Architecture` (14 tests)
- Deterministic provider execution with zero network calls and zero cost.
- Provider interface consistency across Deterministic, Ollama, and Gemini.
- Ollama provider endpoint configuration, model discovery, and Gemma model family detection.
- Gemini provider explicit consent gate enforcement (HTTP 403 on absent consent).
- Server proxy `/api/gemini/generate` key isolation: `GEMINI_API_KEY` never returned to browser or exposed in logs.
- Pre-flight secret sanitization before cloud dispatch.

### 3.11 Test Suite: `M7: Workflow Recipes, Execution History & Local Search` (15 tests)
- `RecipeStore` creation, schema versioning (`CURRENT_RECIPE_SCHEMA_VERSION = 1`), and input default storage.
- Input contract validation against registered workflows (unregistered workflow IDs rejected).
- Secret scanning on recipe inputs: blocks saving inputs containing live credentials or tokens.
- Prototype pollution guards: rejects JSON imports with `__proto__`, `constructor`, or `prototype`.
- Recipe duplicate and automatic version incrementing.
- Safe JSON export and re-import envelope validation.
- `HistoryStore` execution record creation with duration and evidence citations.
- Strict distinction between requested provider mode (`providerModeRequested`) and actual provider executed (`providerActuallyUsed`).
- Pre-flight secret scrubbing in execution history summaries and previews.
- Privacy toggle: disabling history logging completely stops recording.
- Automatic retention cap pruning: oldest entries pruned when capacity exceeded.
- `LocalSearchIndex` deterministic multi-entity search across workflows, recipes, and history.
- Conjunction token matching and relevance ranking.
