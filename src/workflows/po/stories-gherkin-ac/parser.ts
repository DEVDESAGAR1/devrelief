/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { InputValidationError, SourceReference } from '../../../types/workflow.ts';
import { StoriesGherkinInput, StoriesGherkinPayload, UserStory, GherkinScenario } from './types.ts';

export class StoriesGherkinParser {
  public static validate(input: StoriesGherkinInput): InputValidationError[] {
    const errors: InputValidationError[] = [];
    if (!input || input.rawNotes === undefined || input.rawNotes === null || typeof input.rawNotes !== 'string') {
      errors.push({
        field: 'rawNotes',
        message: 'Product notes input is required and must be a string.',
      });
      return errors;
    }

    if (input.rawNotes.trim().length === 0) {
      errors.push({
        field: 'rawNotes',
        message: 'Product notes cannot be empty or whitespace-only.',
      });
      return errors;
    }

    if (input.rawNotes.trim().length < 15) {
      errors.push({
        field: 'rawNotes',
        message: 'Product notes are too short to synthesize user stories (minimum 15 characters).',
      });
    }

    return errors;
  }

  public static parse(input: StoriesGherkinInput): StoriesGherkinPayload {
    const sourceName = input.sourceName || 'product_notes.md';
    const lines = input.rawNotes.split('\n');

    // Extract substantive items from notes (bullet points, numbered items, or sentences)
    const rawItems: { text: string; lineNum: number }[] = [];
    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;

      const cleaned = trimmed.replace(/^[-*•+]\s+/, '').replace(/^\d+[\.\)]\s+/, '').trim();
      if (cleaned.length > 5) {
        rawItems.push({ text: cleaned, lineNum: idx + 1 });
      }
    });

    const targetUser = input.targetUser?.trim() || 'Software Team Member';
    const businessObjective = input.businessObjective?.trim() || 'Improve delivery productivity and clarity';
    const featureSummary = input.productContext?.trim() || (rawItems.length > 0 ? rawItems[0].text : 'Feature synthesis from notes');

    const stories: UserStory[] = [];
    const unmappedNotes: string[] = [];
    const openClarifications: string[] = [];

    // Synthesize user stories from discrete items
    rawItems.forEach((item, index) => {
      const storyId = `US-${String(index + 1).padStart(2, '0')}`;
      const text = item.text;

      // Extract capability & benefit if phrased with "so that" or "to"
      let role = targetUser;
      let capability = text;
      let benefit = 'achieve the desired capability reliably';
      let hasExplicitBenefit = false;

      // Check for "As a / I want / So that" existing format
      const asPattern = /as an?\s+([^,]+),\s*i want\s+([^,]+),\s*so that\s+(.+)/i;
      const matchAs = text.match(asPattern);
      if (matchAs) {
        role = matchAs[1].trim();
        capability = matchAs[2].trim();
        benefit = matchAs[3].trim();
        hasExplicitBenefit = true;
      } else {
        const soThatMatch = text.match(/(.+?)\s+so that\s+(.+)/i);
        const toMatch = text.match(/(.+?)\s+in order to\s+(.+)/i);
        if (soThatMatch) {
          capability = soThatMatch[1].trim();
          benefit = soThatMatch[2].trim();
          hasExplicitBenefit = true;
        } else if (toMatch) {
          capability = toMatch[1].trim();
          benefit = toMatch[2].trim();
          hasExplicitBenefit = true;
        }
      }

      // Identify dependencies or constraints in text
      const dependencies: string[] = [];
      if (/depends on|requires|blocked by|needs api|integration with/i.test(text)) {
        dependencies.push(text);
      }

      const assumptions: string[] = [];
      const storyOpenQuestions: string[] = [];

      if (!hasExplicitBenefit) {
        assumptions.push('Benefit is inferred from capability statement and requires PO verification.');
        storyOpenQuestions.push(`What is the measurable business benefit when "${capability}" is completed?`);
      }

      // Generate Gherkin scenarios
      const scenarios: GherkinScenario[] = [];

      // Scenario 1: Happy path
      scenarios.push({
        id: `SC-${String(index + 1).padStart(2, '0')}-01`,
        title: `Successful execution: ${capability.slice(0, 50)}`,
        type: 'positive',
        given: [`the ${role.toLowerCase()} is authenticated and authorized`],
        when: [`the ${role.toLowerCase()} triggers "${capability}"`],
        then: [`the system processes the request successfully`],
        and: [`the outcome is visible with verified status`],
      });

      // Scenario 2: Boundary or Negative condition if input or constraints mentioned
      if (/must|limit|max|only|cannot|prevent|error|fail|valid/i.test(text) || input.constraints) {
        scenarios.push({
          id: `SC-${String(index + 1).padStart(2, '0')}-02`,
          title: `Validation rejection: invalid or unauthorized input`,
          type: 'negative',
          given: [`the ${role.toLowerCase()} provides input that violates validation constraints`],
          when: [`the ${role.toLowerCase()} attempts to submit the request`],
          then: [`the system rejects the request with a descriptive error message`],
          and: [`no partial or corrupt state is saved`],
        });
      }

      const sourceRefs: SourceReference[] = [
        {
          source: sourceName,
          lineStart: item.lineNum,
          lineEnd: item.lineNum,
          rawSnippet: item.text,
        },
      ];

      stories.push({
        id: storyId,
        title: capability.slice(0, 60),
        role,
        capability,
        benefit,
        statement: `As a ${role}, I want to ${capability}, so that ${benefit}.`,
        scenarios,
        assumptions,
        openQuestions: storyOpenQuestions,
        dependencies,
        sourceReferences: sourceRefs,
      });
    });

    if (stories.length === 0) {
      openClarifications.push('Could not identify distinct actionable requirement statements from the provided text.');
    }

    const humanReviewNotice =
      'HUMAN REVIEW MANDATORY: These user stories and Gherkin scenarios are deterministic structural drafts derived from supplied notes. Business rules, personas, and criteria must be formally reviewed and approved by the Product Owner before sprint commitment.';

    // Generate Markdown document
    const markdown = StoriesGherkinParser.renderMarkdown({
      featureSummary,
      targetUser,
      businessObjective,
      stories,
      unmappedNotes,
      openClarifications,
      humanReviewNotice,
      markdown: '',
    });

    return {
      featureSummary,
      targetUser,
      businessObjective,
      stories,
      unmappedNotes,
      openClarifications,
      humanReviewNotice,
      markdown,
    };
  }

  private static renderMarkdown(payload: StoriesGherkinPayload): string {
    const md: string[] = [];
    md.push(`# Product Requirements & User Stories: ${payload.featureSummary}`);
    md.push('');
    md.push(`> ⚠️ **${payload.humanReviewNotice}**`);
    md.push('');
    md.push(`- **Target Role:** ${payload.targetUser}`);
    md.push(`- **Business Objective:** ${payload.businessObjective}`);
    md.push(`- **Total Stories Generated:** ${payload.stories.length}`);
    md.push('');
    md.push('---');
    md.push('');

    payload.stories.forEach((story) => {
      md.push(`## ${story.id}: ${story.title}`);
      md.push('');
      md.push(`**Story Statement:**`);
      md.push(`> ${story.statement}`);
      md.push('');
      md.push('### Acceptance Criteria (Gherkin)');
      md.push('');
      story.scenarios.forEach((sc) => {
        md.push(`#### Scenario: ${sc.title} (${sc.type.toUpperCase()})`);
        md.push('```gherkin');
        sc.given.forEach((g) => md.push(`  Given ${g}`));
        sc.when.forEach((w) => md.push(`  When ${w}`));
        sc.then.forEach((t) => md.push(`  Then ${t}`));
        sc.and.forEach((a) => md.push(`  And ${a}`));
        md.push('```');
        md.push('');
      });

      if (story.assumptions.length > 0) {
        md.push('**Inferred Assumptions:**');
        story.assumptions.forEach((asm) => md.push(`- ℹ️ ${asm}`));
        md.push('');
      }

      if (story.openQuestions.length > 0) {
        md.push('**Open Clarifications for PO:**');
        story.openQuestions.forEach((q) => md.push(`- ❓ ${q}`));
        md.push('');
      }

      if (story.dependencies.length > 0) {
        md.push('**Dependencies / Constraints:**');
        story.dependencies.forEach((d) => md.push(`- 🔗 ${d}`));
        md.push('');
      }

      md.push('---');
      md.push('');
    });

    return md.join('\n');
  }
}
