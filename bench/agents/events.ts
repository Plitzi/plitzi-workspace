import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';

/**
 * A run as the benchmark reads it, whichever harness made it: the turns the model took (each with what it read and
 * wrote), what each tool answered, and its last words. Claude Code's `stream-json` and OpenCode's `--format json` are
 * read into this one shape, so every measure is computed the same way for both.
 */

export interface Turn {
  /** Tokens read this turn, cache included — what the turn put in front of the model. */
  input: number;
  output: number;
  /** The turn came right after a refused tool call: it was spent correcting a mistake. */
  afterRefusal: boolean;
}

export interface ToolOutcome {
  tool: string;
  refused: boolean;
  /** A refusal that names something that does not exist — an invented type, field, class, element or command. */
  hallucinated: boolean;
  text: string;
}

export interface RunRecord {
  turns: Turn[];
  tools: ToolOutcome[];
  final: string;
}

/** What a refusal sounds like: the tool said no, in Plitzi's words or the harness's. */
const REFUSED =
  /"errors":\s*\[\s*\{|did you mean|There is no|has no field|is not a class|REPEATED_BATCH|is no element|Nothing was changed|"done":\s*false|Input validation error/i;

/** A refusal that names something the model made up. */
const HALLUCINATED =
  /did you mean|There is no|has no field|is not a class|unknown-element-type|element-slot-unknown|global-field-unknown|is no element|unknown option/i;

const outcome = (tool: string, text: string, flagged: boolean): ToolOutcome => {
  const refused = flagged || REFUSED.test(text);

  return { tool, refused, hallucinated: refused && HALLUCINATED.test(text), text: text.slice(0, 2000) };
};

const parseLines = (lines: readonly string[]): Record<string, unknown>[] =>
  lines.flatMap(line => {
    try {
      const parsed: unknown = JSON.parse(line);

      return isRecord(parsed) ? [parsed] : [];
    } catch {
      return [];
    }
  });

const numberOf = (value: unknown): number => (typeof value === 'number' ? value : 0);

const textOf = (content: unknown): string => {
  if (typeof content === 'string') {
    return content;
  }

  return Array.isArray(content)
    ? content.map(part => (isRecord(part) && typeof part.text === 'string' ? part.text : '')).join('\n')
    : '';
};

/** Claude Code `-p --output-format stream-json --verbose`: assistant messages carry usage, user ones tool results. */
export const fromClaudeCode = (lines: readonly string[]): RunRecord => {
  const turns: Turn[] = [];
  const tools: ToolOutcome[] = [];
  const names = new Map<string, string>();
  const counted = new Set<string>();
  let refusedLast = false;
  let final = '';

  for (const event of parseLines(lines)) {
    const message = isRecord(event.message) ? event.message : undefined;
    if (event.type === 'assistant' && message) {
      const content = Array.isArray(message.content) ? message.content.filter(isRecord) : [];
      for (const block of content) {
        if (block.type === 'tool_use' && typeof block.id === 'string') {
          names.set(block.id, String(block.name));
        }
      }

      // One message arrives as several events, one per block, each with the message's usage: counted once.
      const id = typeof message.id === 'string' ? message.id : String(turns.length);
      if (!counted.has(id) && isRecord(message.usage)) {
        counted.add(id);
        const usage = message.usage;
        turns.push({
          input:
            numberOf(usage.input_tokens) +
            numberOf(usage.cache_creation_input_tokens) +
            numberOf(usage.cache_read_input_tokens),
          output: numberOf(usage.output_tokens),
          afterRefusal: refusedLast
        });
        refusedLast = false;
      }
    }

    if (event.type === 'user' && message && Array.isArray(message.content)) {
      for (const block of message.content.filter(isRecord)) {
        if (block.type === 'tool_result') {
          const tool = names.get(String(block.tool_use_id)) ?? 'unknown';
          const result = outcome(tool, textOf(block.content), block.is_error === true);
          tools.push(result);
          refusedLast ||= result.refused;
        }
      }
    }

    if (event.type === 'result' && typeof event.result === 'string') {
      final = event.result;
    }
  }

  return { turns, tools, final };
};

/** OpenCode `run --format json`: a step's tools and its text, then `step_finish` with the step's tokens. */
export const fromOpenCode = (lines: readonly string[]): RunRecord => {
  const turns: Turn[] = [];
  const tools: ToolOutcome[] = [];
  let refusedLast = false;
  let refusedThisStep = false;
  let final = '';

  for (const event of parseLines(lines)) {
    const part = isRecord(event.part) ? event.part : undefined;
    if (!part) {
      continue;
    }

    if (part.type === 'tool' && isRecord(part.state)) {
      const { state } = part;
      const text = typeof state.output === 'string' ? state.output : typeof state.error === 'string' ? state.error : '';
      const result = outcome(String(part.tool), text, state.status === 'error');
      tools.push(result);
      refusedThisStep ||= result.refused;
    }

    if (part.type === 'text' && typeof part.text === 'string') {
      final = part.text;
    }

    if (part.type === 'step-finish' && isRecord(part.tokens)) {
      const { tokens } = part;
      const cache = isRecord(tokens.cache) ? tokens.cache : {};
      turns.push({
        input: numberOf(tokens.input) + numberOf(cache.read) + numberOf(cache.write),
        output: numberOf(tokens.output) + numberOf(tokens.reasoning),
        afterRefusal: refusedLast
      });
      refusedLast = refusedThisStep;
      refusedThisStep = false;
    }
  }

  return { turns, tools, final };
};
