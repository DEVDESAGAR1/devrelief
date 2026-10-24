/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { InputValidationError, SourceReference } from '../../../types/workflow.ts';
import {
  RetroThematicClusterInput,
  RetroThematicClusterPayload,
  RetroObservation,
  RetroTheme,
  ObservationSentiment,
} from './types.ts';

interface ThemeDefinition {
  id: string;
  name: string;
  description: string;
  keywords: RegExp;
  experimentSuggestion: string;
}

const THEME_DEFINITIONS: ThemeDefinition[] = [
  {
    id: 'TH-TOOLING',
    name: 'Tooling, CI/CD & Development Environment',
    description: 'Build pipelines, test automation infrastructure, deployment speed, and dev tooling.',
    keywords: /\b(ci|cd|builds?|pipelines?|docker|deploy(?:ment)?s?|runners?|npm|vite|git|github|actions|infra|tooling|slow build)\b/i,
    experimentSuggestion: 'Audit slowest CI pipeline steps and establish a 10-minute maximum build SLA.',
  },
  {
    id: 'TH-PROCESS',
    name: 'Process, Ceremonies & Sprint Cadence',
    description: 'Sprint planning, daily standups, backlog refinement, estimation, and sprint scope churn.',
    keywords: /\b(standups?|retros?|plannings?|groomings?|refinements?|demos?|review meetings?|sprints?|story points?|estimations?|ceremonies|process(?:es)?|boards?|wip limits?)\b/i,
    experimentSuggestion: 'Test 15-minute timebox on standups and limit in-progress WIP items to 2 per engineer.',
  },
  {
    id: 'TH-COMM',
    name: 'Team Alignment, Collaboration & Reviews',
    description: 'Pull request review turnaround, cross-functional communication, design syncs, and handoffs.',
    keywords: /\b(pr reviews?|code reviews?|reviews?|communications?|alignments?|slack|handoffs?|syncs?|collaborations?|design handoffs?|pair programming)\b/i,
    experimentSuggestion: 'Set up automated Slack alerts for PRs awaiting review for longer than 4 hours.',
  },
  {
    id: 'TH-SCOPE',
    name: 'Product Scope, Requirements & Clarity',
    description: 'Acceptance criteria completeness, mid-sprint scope changes, and stakeholder expectations.',
    keywords: /\b(scopes?|scope creeps?|requirements?|specs?|acceptance criteria|ac|story|stories|unclear requirements?|priority|prioritizations?|po|stakeholders?)\b/i,
    experimentSuggestion: 'Enforce "Definition of Ready" checklist before bringing any story into sprint planning.',
  },
  {
    id: 'TH-QUALITY',
    name: 'Code Quality, Architecture & Technical Debt',
    description: 'Defect rates, flaky test suites, legacy refactoring, and architectural shortcuts.',
    keywords: /\b(tech debts?|debts?|refactors?|refactorings?|bugs?|flaky|flaky tests?|architectures?|legacy|regressions?|code quality|clean code)\b/i,
    experimentSuggestion: 'Dedicate 20% of sprint capacity to top-voted technical debt and flaky test remediation.',
  },
];

export class RetroThematicClusterer {
  public static validate(input: RetroThematicClusterInput): InputValidationError[] {
    const errors: InputValidationError[] = [];
    if (!input || input.retroNotes === undefined || input.retroNotes === null || typeof input.retroNotes !== 'string') {
      errors.push({
        field: 'retroNotes',
        message: 'Retrospective notes input is required and must be a string.',
      });
      return errors;
    }

    if (input.retroNotes.trim().length === 0) {
      errors.push({
        field: 'retroNotes',
        message: 'Retrospective notes cannot be empty or whitespace-only.',
      });
      return errors;
    }

    if (input.retroNotes.trim().length < 20) {
      errors.push({
        field: 'retroNotes',
        message: 'Retrospective notes are too brief to cluster (minimum 20 characters).',
      });
    }

    return errors;
  }

  public static cluster(input: RetroThematicClusterInput): RetroThematicClusterPayload {
    const sourceName = input.sourceName || 'retro_notes.md';
    const sprintName = input.sprintName || 'Current Sprint Retrospective';
    const lines = input.retroNotes.split('\n');

    const allObservations: RetroObservation[] = [];
    let obsCounter = 1;

    let positiveCount = 0;
    let frictionCount = 0;
    let suggestionCount = 0;

    lines.forEach((line, index) => {
      const lineNum = index + 1;
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;

      const cleaned = trimmed.replace(/^[-*•+]\s+/, '').replace(/^\d+[\.\)]\s+/, '').trim();
      if (cleaned.length < 5) return;

      // Classify sentiment
      let sentiment: ObservationSentiment = 'neutral';
      if (/\b(well|good|great|awesome|proud|shoutout|win|loved|liked|success|smooth|kudos|\+1)\b/i.test(cleaned)) {
        sentiment = 'positive';
        positiveCount++;
      } else if (/\b(slow|broken|frustrated|pain|confused|blocked|delay|fail|failure|problem|hard|stuck|dropped|missed)\b/i.test(cleaned)) {
        sentiment = 'friction';
        frictionCount++;
      } else if (/\b(try|experiment|action|improve|suggest|proposal|idea|should we)\b/i.test(cleaned)) {
        sentiment = 'suggestion';
        suggestionCount++;
      }

      allObservations.push({
        id: `OBS-${String(obsCounter++).padStart(2, '0')}`,
        text: cleaned,
        sentiment,
        sourceReferences: [
          {
            source: sourceName,
            lineStart: lineNum,
            lineEnd: lineNum,
            rawSnippet: trimmed,
          },
        ],
      });
    });

    // Theme clustering
    const themes: RetroTheme[] = THEME_DEFINITIONS.map((def) => ({
      id: def.id,
      name: def.name,
      description: def.description,
      observations: [],
      proposedExperiments: [],
    }));

    const unclusteredObservations: RetroObservation[] = [];

    allObservations.forEach((obs) => {
      let matchedTheme = false;
      for (const def of THEME_DEFINITIONS) {
        if (def.keywords.test(obs.text)) {
          const theme = themes.find((t) => t.id === def.id);
          if (theme) {
            obs.themeId = theme.id;
            theme.observations.push(obs);
            matchedTheme = true;
            break; // Single best theme per observation
          }
        }
      }

      if (!matchedTheme) {
        unclusteredObservations.push(obs);
      }
    });

    // Add proposed experiment for themes that contain friction points
    themes.forEach((th) => {
      const def = THEME_DEFINITIONS.find((d) => d.id === th.id);
      const hasFriction = th.observations.some((o) => o.sentiment === 'friction');
      if (def && (hasFriction || th.observations.length >= 2)) {
        th.proposedExperiments.push(`[Proposal]: ${def.experimentSuggestion}`);
      }
    });

    // Filter out completely empty themes to keep output actionable
    const activeThemes = themes.filter((t) => t.observations.length > 0);

    const limitations =
      'EPISTEMIC LIMITATIONS: Thematic clusters and sentiment categories are derived deterministically using keyword heuristics. No statistical significance, participant weighting, or sentiment scoring is fabricated. All unclustered feedback is preserved without omission.';

    const humanReviewNotice =
      'HUMAN REVIEW MANDATORY: Retrospective clusters and proposed experiments are discussion drafts for the Scrum Master and team. The team must collaboratively vote on and select final sprint improvement experiments.';

    const payload: RetroThematicClusterPayload = {
      sprintName,
      totalObservations: allObservations.length,
      positiveCount,
      frictionCount,
      suggestionCount,
      themes: activeThemes,
      unclusteredObservations,
      limitations,
      humanReviewNotice,
      markdown: '',
    };

    payload.markdown = RetroThematicClusterer.renderMarkdown(payload);
    return payload;
  }

  private static renderMarkdown(payload: RetroThematicClusterPayload): string {
    const md: string[] = [];
    md.push(`# Sprint Retrospective Synthesis: ${payload.sprintName}`);
    md.push('');
    md.push(`> ⚠️ **${payload.humanReviewNotice}**`);
    md.push('');
    md.push(`- **Total Observations:** ${payload.totalObservations}`);
    md.push(`- **Breakdown:** 🟢 Positive: ${payload.positiveCount} | 🔴 Friction: ${payload.frictionCount} | 💡 Ideas: ${payload.suggestionCount}`);
    md.push(`- **Identified Themes:** ${payload.themes.length} | **Unclustered:** ${payload.unclusteredObservations.length}`);
    md.push('');
    md.push(`*${payload.limitations}*`);
    md.push('');
    md.push('---');
    md.push('');

    // Active Themes
    payload.themes.forEach((theme) => {
      md.push(`## Theme: ${theme.name} (${theme.observations.length} items)`);
      md.push(`*${theme.description}*`);
      md.push('');
      md.push('### Supporting Feedback:');
      theme.observations.forEach((obs) => {
        const badge = obs.sentiment === 'positive' ? '🟢' : obs.sentiment === 'friction' ? '🔴' : '💡';
        md.push(`- ${badge} **[${obs.id}]** ${obs.text}`);
      });
      md.push('');

      if (theme.proposedExperiments.length > 0) {
        md.push('### Proposed Team Experiments:');
        theme.proposedExperiments.forEach((exp) => md.push(`- 🧪 ${exp}`));
        md.push('');
      }

      md.push('---');
      md.push('');
    });

    // Unclustered Observations
    if (payload.unclusteredObservations.length > 0) {
      md.push('## Unclustered Observations (Preserved for Team Review)');
      md.push('');
      payload.unclusteredObservations.forEach((obs) => {
        md.push(`- ℹ️ **[${obs.id}]** ${obs.text}`);
      });
      md.push('');
    }

    return md.join('\n');
  }
}
