import type { BuiltinActionSpec } from '@plitzi/sdk-shared/authoring/builder';

/**
 * The copy-to-clipboard step, as the editor and anything authoring one offline read it: the words to copy — a template
 * like any step's param, so `{{ navigation.href }}` copies the page's address and `{{ snippet.code }}` what a source
 * holds. Run where there is no clipboard to write to, or one the browser refuses, the step fails: the flow stops and
 * its `onFailure` runs, so "Copied" is never said of something that was not.
 */
export const copyToClipboardSpec: BuiltinActionSpec = {
  title: 'Copy To Clipboard',
  type: 'utility',
  strictParams: true,
  params: {
    text: {
      type: 'text',
      description: 'The words to copy — a template reads the page: {{ navigation.href }} is its address.',
      default: '',
      label: 'Text',
      required: true
    }
  }
};
