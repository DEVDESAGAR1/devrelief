/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  WorkflowId,
  WorkflowExecutionState,
  InputValidationError,
  ExecutionFailure,
  WorkflowResult,
  WorkflowDefinition,
} from '../types/workflow.ts';

export class WorkflowEngine {
  private registry = new Map<WorkflowId, WorkflowDefinition<unknown, unknown>>();
  private currentState: WorkflowExecutionState = 'idle';
  private lastFailure: ExecutionFailure | null = null;
  private lastResult: WorkflowResult<unknown> | null = null;
  private stateChangeListeners: Array<(state: WorkflowExecutionState) => void> = [];

  /**
   * Register a workflow definition
   */
  public registerWorkflow<TInput, TPayload>(
    definition: WorkflowDefinition<TInput, TPayload>
  ): void {
    this.registry.set(
      definition.metadata.id,
      definition as unknown as WorkflowDefinition<unknown, unknown>
    );
  }

  /**
   * Retrieve a registered workflow definition
   */
  public getWorkflow(id: WorkflowId): WorkflowDefinition<unknown, unknown> | undefined {
    return this.registry.get(id);
  }

  /**
   * List all registered workflow definitions
   */
  public getAllWorkflows(): WorkflowDefinition<unknown, unknown>[] {
    return Array.from(this.registry.values());
  }

  /**
   * Current execution state
   */
  public getState(): WorkflowExecutionState {
    return this.currentState;
  }

  /**
   * Last execution failure if in failed state
   */
  public getLastFailure(): ExecutionFailure | null {
    return this.lastFailure;
  }

  /**
   * Last execution result if in succeeded state
   */
  public getLastResult(): WorkflowResult<unknown> | null {
    return this.lastResult;
  }

  /**
   * Subscribe to state changes
   */
  public onStateChange(listener: (state: WorkflowExecutionState) => void): () => void {
    this.stateChangeListeners.push(listener);
    return () => {
      this.stateChangeListeners = this.stateChangeListeners.filter((l) => l !== listener);
    };
  }

  private setState(state: WorkflowExecutionState): void {
    this.currentState = state;
    for (const listener of this.stateChangeListeners) {
      try {
        listener(state);
      } catch (err) {
        console.error('Error in state change listener:', err);
      }
    }
  }

  /**
   * Reset engine state back to idle
   */
  public reset(): void {
    this.lastFailure = null;
    this.lastResult = null;
    this.setState('idle');
  }

  /**
   * Execute a workflow by ID with given input
   */
  public async executeWorkflow<TInput, TPayload>(
    workflowId: WorkflowId,
    input: TInput
  ): Promise<{ success: boolean; result?: WorkflowResult<TPayload>; failure?: ExecutionFailure }> {
    const workflow = this.getWorkflow(workflowId);

    if (!workflow) {
      const failure: ExecutionFailure = {
        code: 'WORKFLOW_NOT_FOUND',
        message: `Workflow "${workflowId}" is not registered in the engine.`,
        failedAt: new Date().toISOString(),
      };
      this.lastFailure = failure;
      this.lastResult = null;
      this.setState('failed');
      return { success: false, failure };
    }

    // Step 1: Transition to validating
    this.setState('validating');
    this.lastFailure = null;

    let validationErrors: InputValidationError[] = [];
    try {
      validationErrors = workflow.validateInput(input);
    } catch (err) {
      const failure: ExecutionFailure = {
        code: 'VALIDATION_EXCEPTION',
        message: 'An unexpected exception occurred while validating input.',
        details: err instanceof Error ? err.message : String(err),
        failedAt: new Date().toISOString(),
      };
      this.lastFailure = failure;
      this.setState('failed');
      return { success: false, failure };
    }

    if (validationErrors.length > 0) {
      const failure: ExecutionFailure = {
        code: 'INPUT_VALIDATION_FAILED',
        message: `Input validation failed with ${validationErrors.length} error(s).`,
        validationErrors,
        failedAt: new Date().toISOString(),
      };
      this.lastFailure = failure;
      this.setState('failed');
      return { success: false, failure };
    }

    // Step 2: Transition to running
    this.setState('running');

    try {
      const startTime = performance.now();
      const rawResult = await workflow.execute(input);
      const durationMs = Math.round(performance.now() - startTime);

      const result: WorkflowResult<TPayload> = {
        ...rawResult,
        durationMs,
      } as WorkflowResult<TPayload>;

      this.lastResult = result as unknown as WorkflowResult<unknown>;
      this.lastFailure = null;
      this.setState('succeeded');
      return { success: true, result };
    } catch (err) {
      const failure: ExecutionFailure = {
        code: 'EXECUTION_FAILED',
        message: 'Workflow execution failed.',
        details: err instanceof Error ? err.message : String(err),
        failedAt: new Date().toISOString(),
      };
      this.lastFailure = failure;
      this.setState('failed');
      return { success: false, failure };
    }
  }
}
