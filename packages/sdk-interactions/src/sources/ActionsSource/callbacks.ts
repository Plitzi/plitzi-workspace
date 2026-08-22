import type { BuiltinGlobalCallback } from '../../authoring/globalCallbacks';

/**
 * Running a server action from a flow, and cancelling one.
 *
 * The editor enriches both: it knows which actions the space publishes, so `actionId` becomes a picker and `input`
 * announces the contract the chosen action declares. Neither fact is about the action-running callback itself,
 * which is all this declares.
 *
 * `mode` is the param a flow is usually got wrong on: only `await` puts the result in the flow scope, so a step
 * that reads `{{ <step>.output.* }}` after a detached run reads nothing at all.
 */
export const actionsCallbacks: Record<string, BuiltinGlobalCallback> = {
  runServerAction: {
    source: 'actions',
    title: 'Run Server Action',
    strictParams: true,
    params: {
      actionId: {
        type: 'text',
        description: 'Identifier of the server action to run, as the space publishes it.',
        default: '',
        required: true,
        label: 'Action'
      },
      input: {
        type: 'text',
        description: 'JSON object passed to the action. The server drops every key the action did not declare.',
        default: '{}',
        builderType: 'codemirror-json',
        label: 'Input'
      },
      mode: {
        type: 'select',
        description:
          'await waits and puts the result in the flow scope; detached carries on immediately and leaves nothing ' +
          'to read; stream reports progress as it goes.',
        default: 'await',
        options: ['await', 'detached', 'stream'],
        optionLabels: {
          await: 'Wait for the result',
          detached: 'Send and continue',
          stream: 'Stream progress'
        }
      },
      idempotencyKey: {
        type: 'text',
        description: 'Makes a repeat of the same intent answer with the first run instead of running again.',
        default: '',
        // Only meaningful when the flow waits: a detached step never sees the refusal a repeated key produces.
        when: params => params.mode !== 'detached'
      }
    },
    preview: { runId: '', status: '', output: {} }
  },
  cancelServerAction: {
    source: 'actions',
    title: 'Cancel Server Action',
    strictParams: true,
    params: {
      runId: {
        type: 'text',
        description: 'The run to cancel — normally `{{ <step>.output.runId }}` from the step that started it.',
        default: ''
      }
    },
    preview: { cancelled: '' }
  }
};
