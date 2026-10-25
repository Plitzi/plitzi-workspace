import { describe, expect, it } from 'vitest';

import { BUILTIN_GLOBAL_CALLBACKS, lintSpace } from '../../index';
import { addElement, errorsOf, onClick, setFlow, step, warningsOf, withChange } from './tests/lintFixture';

/**
 * Every rule of the linter, pinned by its code.
 *
 * The code is the contract: the builder groups its problems panel by it, the MCP reports it, and a fix is keyed on it.
 * Each case starts from a space the linter finds nothing in, changes the one thing the rule is about, and says whether
 * that is refused or warned. The last test holds the file to the linter: a rule added without a case here fails it.
 */

describe('lintSpace', () => {
  describe('flows', () => {
    const notify = BUILTIN_GLOBAL_CALLBACKS.addNotification.source;

    it('flow-without-trigger', () => {
      const documents = withChange(({ schema }) => {
        setFlow(schema, 'go', [step('open', 'callback', 'openModal', { elementId: 'modal' })]);
      });

      expect(errorsOf(documents)).toContain('flow-without-trigger');
    });

    it('step-type', () => {
      const documents = withChange(({ schema }) => {
        setFlow(schema, 'go', [onClick(), step('odd', 'effect', 'openModal')]);
      });

      expect(errorsOf(documents)).toContain('step-type');
    });

    it('trigger-never-fired', () => {
      const documents = withChange(({ schema }) => {
        setFlow(schema, 'go', [
          step('submit', 'trigger', 'onSubmit', { elementId: 'go' }),
          step('open', 'callback', 'openModal', { elementId: 'modal' })
        ]);
      });

      expect(errorsOf(documents)).toContain('trigger-never-fired');
    });

    it('channel-declaration', () => {
      const withChannels = (channels: Record<string, unknown>) =>
        errorsOf(
          withChange(({ schema }) => {
            // Malformed on purpose: what a hand-edited document or an agent may write, which no type would allow.
            schema.settings.channels = channels as NonNullable<typeof schema.settings.channels>;
          })
        );

      expect(withChannels({ 'room:{id}': { access: { mode: 'public' } } })).not.toContain('channel-declaration');
      expect(withChannels({ 'room {id}': { access: { mode: 'public' } } })).toContain('channel-declaration');
      expect(withChannels({ 'room:{id}': { access: { mode: 'anyone' } } })).toContain('channel-declaration');
      expect(withChannels({ 'room:{id}': { access: { mode: 'role' } } })).toContain('channel-declaration');
      expect(withChannels({ 'room:{id}': { access: { mode: 'public' }, messagesPerSecond: 0 } })).toContain(
        'channel-declaration'
      );
    });

    it('channel-grant', () => {
      const withGrant = (attributes: Record<string, unknown>, bound = false) =>
        withChange(({ schema }) => {
          schema.settings.channels = { 'room:{id}': { access: { mode: 'public' }, grant: true } };
          addElement(schema, { id: 'room', type: 'channel', attributes: { topic: 'room:{{ id }}', ...attributes } });
          if (bound) {
            schema.flat.room.definition.bindings = {
              attributes: [{ id: 'grant-binding', to: 'grant', source: 'state.grant' }]
            };
          }
        });

      expect(errorsOf(withGrant({}))).toContain('channel-grant');
      expect(errorsOf(withGrant({ grant: 'abc' }))).not.toContain('channel-grant');
      expect(errorsOf(withGrant({}, true))).not.toContain('channel-grant');
    });

    it('channel-topic', () => {
      const undeclared = withChange(({ schema }) => {
        addElement(schema, { id: 'room', type: 'channel', attributes: { topic: 'board:{{ id }}' } });
      });
      const declared = withChange(({ schema }) => {
        schema.settings.channels = { 'board:{id}': { access: { mode: 'public' } } };
        addElement(schema, { id: 'room', type: 'channel', attributes: { topic: 'board:{{ id }}' } });
      });
      const empty = withChange(({ schema }) => {
        schema.settings.channels = { 'board:{id}': { access: { mode: 'public' } } };
        addElement(schema, { id: 'room', type: 'channel', attributes: { topic: '' } });
      });

      expect(errorsOf(undeclared)).toContain('channel-topic');
      expect(errorsOf(declared)).not.toContain('channel-topic');
      expect(errorsOf(empty)).toContain('channel-topic');

      // A bound topic is the page's to decide: nothing here can check it, and nothing is reported.
      const bound = withChange(({ schema }) => {
        addElement(schema, { id: 'room', type: 'channel', attributes: { topic: '' } });
        schema.flat.room.definition.bindings = {
          attributes: [{ id: 'topic-binding', to: 'topic', source: 'state.topic' }]
        };
      });
      expect(errorsOf(bound)).not.toContain('channel-topic');

      // A run's private rooms: a choice of prefix is read as either word, and both must be covered.
      const choosing = (channels: Record<string, { access: { mode: 'public' } }>) =>
        withChange(({ schema }) => {
          schema.settings.channels = channels;
          addElement(schema, {
            id: 'room',
            type: 'channel',
            attributes: { topic: "{{ room.locked ? 'vault' : 'room' }}:{{ room.slug }}" }
          });
        });
      const open = { access: { mode: 'public' as const } };
      expect(errorsOf(choosing({ 'room:{slug}': open, 'vault:{slug}': open }))).not.toContain('channel-topic');
      const half = lintSpace(choosing({ 'room:{slug}': open })).errors.find(each => each.code === 'channel-topic');
      expect(half?.message).toContain('as "vault:x"');

      // Words only the page puts together: nothing here to check, as a bound topic.
      const joined = withChange(({ schema }) => {
        addElement(schema, { id: 'room', type: 'channel', attributes: { topic: "{{ 'room:' ~ slug }}" } });
      });
      expect(errorsOf(joined)).not.toContain('channel-topic');

      // A job's topic is the platform's: no channel of the space has to cover it.
      const job = withChange(({ schema }) => {
        addElement(schema, { id: 'training', type: 'channel', attributes: { topic: '$job:{{ id }}' } });
      });
      expect(errorsOf(job)).not.toContain('channel-topic');
    });

    it('while-running', () => {
      const onStep = withChange(({ schema }) => {
        setFlow(schema, 'go', [
          onClick(),
          step('open', 'callback', 'openModal', { elementId: 'modal', whileRunning: 'queue' })
        ]);
      });
      const unknownMode = withChange(({ schema }) => {
        setFlow(schema, 'go', [
          // A document written outside TypeScript — the builder, the MCP, an import — can hold any string here.
          step('click', 'trigger', 'onClick', { elementId: 'go', whileRunning: 'later' as 'queue' }),
          step('open', 'callback', 'openModal', { elementId: 'modal' })
        ]);
      });

      expect(errorsOf(onStep)).toContain('while-running');
      expect(errorsOf(unknownMode)).toContain('while-running');
    });

    it('trigger-keys', () => {
      const documents = withChange(({ schema }) => {
        setFlow(schema, 'go', [
          step('key', 'trigger', 'onKey', { elementId: 'go', params: { keys: 'ctrl+shift' } }),
          step('open', 'callback', 'openModal', { elementId: 'modal' })
        ]);
      });

      expect(errorsOf(documents)).toContain('trigger-keys');
    });

    it('trigger-interval', () => {
      const documents = withChange(({ schema }) => {
        setFlow(schema, 'go', [
          step('tick', 'trigger', 'onInterval', { elementId: 'go', params: { interval: 50 } }),
          step('open', 'callback', 'openModal', { elementId: 'modal' })
        ]);
      });

      expect(errorsOf(documents)).toContain('trigger-interval');
    });

    it('state-toggled-in-branches', () => {
      const branch = (id: string, value: boolean, operator: '=' | '!=') =>
        step(id, 'globalCallback', 'setState', {
          elementId: 'state',
          params: { key: 'menuOpen', type: 'boolean', value },
          when: { combinator: 'and', rules: [{ field: 'state.menuOpen', operator, value: true }] }
        });
      const documents = withChange(({ schema }) => {
        setFlow(schema, 'go', [onClick(), branch('close', false, '='), branch('open', true, '!=')]);
      });

      expect(warningsOf(documents)).toContain('state-toggled-in-branches');
    });

    it('form-value-compared-to-blank', () => {
      const guarded = (operator: '=' | '!=' | 'empty') =>
        step(`check-${operator}`, 'globalCallback', 'setState', {
          elementId: 'state',
          params: { key: 'problem', type: 'text', value: 'Type a code' },
          when: {
            combinator: 'and',
            rules: [{ combinator: 'or', rules: [{ field: 'sent.values.code', operator, value: '' }] }]
          }
        });
      const flagged = withChange(({ schema }) => {
        setFlow(schema, 'go', [onClick(), guarded('='), guarded('!=')]);
      });
      const fine = withChange(({ schema }) => {
        setFlow(schema, 'go', [onClick(), guarded('empty')]);
      });

      expect(warningsOf(flagged).filter(code => code === 'form-value-compared-to-blank')).toHaveLength(2);
      expect(warningsOf(fine)).not.toContain('form-value-compared-to-blank');
    });

    // `roomStatsData.locked` never held, and nothing said so — the source is `apiContainer_roomStatsData`.
    it('condition-short-source', () => {
      const conditioned = (field: string) =>
        withChange(({ schema }) => {
          setFlow(schema, 'go', [
            onClick(),
            step('note', 'globalCallback', 'addNotification', {
              elementId: 'space',
              params: { content: 'Locked' },
              when: { combinator: 'and', rules: [{ field, operator: '=', value: true }] }
            })
          ]);
        });

      const short = lintSpace(conditioned('feed.locked')).errors.filter(
        issue => issue.code === 'condition-short-source'
      );
      expect(short).toHaveLength(1);
      expect(short[0].message).toContain('a source is named in full — `apiContainer_feed.locked`');
      expect(errorsOf(conditioned('apiContainer_feed.locked'))).not.toContain('condition-short-source');
    });

    /** `whenSucceeded` after a sign-in: `login` answers `ok` and `reason`, never a server action's `status`. */
    it('condition-field-unpublished', () => {
      const guarded = (id: string, field: string, operator: '=' | '!=') =>
        step(id, 'globalCallback', 'addNotification', {
          elementId: 'space',
          params: { content: 'Signed in' },
          when: { combinator: 'and', rules: [{ field, operator, value: 'completed' }] }
        });
      const flowAfter = (head: ReturnType<typeof step>, ...rules: [string, '=' | '!='][]) =>
        withChange(({ schema }) => {
          setFlow(schema, 'go', [
            onClick(),
            head,
            ...rules.map(([field, operator], index) => guarded(`then-${String(index)}`, field, operator))
          ]);
        });
      const signedIn = step('signedIn', 'globalCallback', 'login', {
        elementId: 'auth',
        params: { mode: 'normal', username: 'ada', password: 'secret' }
      });
      const unpublished = (documents: ReturnType<typeof withChange>) =>
        lintSpace(documents).errors.filter(issue => issue.code === 'condition-field-unpublished');

      const login = unpublished(flowAfter(signedIn, ['signedIn.status', '='], ['signedIn.status', '!=']));
      expect(login).toHaveLength(2);
      expect(login[0].message).toContain('It publishes ok, reason, mfaToken');
      expect(login[0].message).toMatch(/`when\(\{ field: 'signedIn\.ok', operator: '=', value: true \}, …\)`/);
      expect(login[1].message).toMatch(/`when\(\{ field: 'signedIn\.ok', operator: '!=', value: true \}, …\)`/);

      // What the step does publish, however deep the field goes, is asked as written.
      expect(unpublished(flowAfter(signedIn, ['signedIn.ok', '='], ['signedIn.errors.username', '!=']))).toEqual([]);
      const quote = step('quote', 'globalCallback', 'runServerAction', {
        elementId: 'actions',
        params: { actionId: 'shipping-quote', input: {}, mode: 'await' }
      });
      expect(unpublished(flowAfter(quote, ['quote.status', '='], ['quote.output.total', '!=']))).toEqual([]);

      // A plugin's step says nothing about what it publishes, and a field naming no step of the flow is not a step's.
      const picked = step('picked', 'globalCallback', 'pickColor', { elementId: 'colorPicker' });
      expect(unpublished(flowAfter(picked, ['picked.status', '='], ['elsewhere.status', '=']))).toEqual([]);
    });

    it('element-ids-target', () => {
      const refresh = (id: string, ids: string[], invalidateQueries = 'elements') =>
        step(id, 'globalCallback', 'runServerAction', {
          elementId: 'actions',
          params: { actionId: 'save', input: {}, mode: 'await', invalidateQueries, invalidateElements: ids }
        });
      const targets = (...steps: ReturnType<typeof step>[]) =>
        lintSpace(
          withChange(({ schema }) => {
            setFlow(schema, 'go', [onClick(), ...steps]);
          })
        ).errors.filter(issue => issue.code === 'element-ids-target');

      const [missing, notContainer] = targets(refresh('save', ['fed', 'hello']));
      expect(missing.message).toContain('"invalidateElements" names "fed", an id no element of the space has');
      expect(missing.message).toContain('did you mean "feed"?');
      expect(notContainer.message).toContain('names "hello", a "text" — only an apiContainer is refreshed by its id');
      expect(notContainer.message).toContain('It takes the id of an apiContainer: feed.');

      const invalidate = step('invalidate', 'globalCallback', 'invalidateQueries', {
        elementId: 'queries',
        params: { url: '', elements: ['box'] }
      });
      const hook = step('hook', 'utility', 'webHook', {
        params: { url: '/api/posts', method: 'post', invalidateQueries: 'elements', invalidateElements: ['nope'] }
      });
      expect(targets(invalidate, hook).map(issue => issue.message)).toEqual([
        expect.stringContaining('"elements" names "box", a "container"'),
        expect.stringContaining('"invalidateElements" names "nope", an id no element of the space has')
      ]);

      // A list the mode leaves aside is not used, a template is known when the step runs, and a container is a target.
      expect(targets(refresh('all', ['nope'], 'all'), refresh('ok', ['feed', '{{ state.target }}']))).toEqual([]);
    });

    // A run's room heard the first of three closes the server said at once: the rest arrived while its flow ran.
    it('message-while-running', () => {
      const room = (whileRunning?: 'queue') =>
        withChange(({ schema }) => {
          addElement(schema, { id: 'room', type: 'channel', attributes: { topic: 'room:1' } });
          setFlow(schema, 'room', [
            step('heard', 'trigger', 'onMessage', { elementId: 'room', ...(whileRunning ? { whileRunning } : {}) }),
            step('open', 'callback', 'openModal', { elementId: 'modal' })
          ]);
        });

      expect(warningsOf(room())).toContain('message-while-running');
      expect(warningsOf(room('queue'))).not.toContain('message-while-running');
    });

    it('unknown-global-callback', () => {
      const documents = withChange(({ schema }) => {
        setFlow(schema, 'go', [onClick(), step('teleport', 'globalCallback', 'teleport', { elementId: 'state' })]);
      });

      expect(warningsOf(documents)).toContain('unknown-global-callback');
    });

    it('global-callback-module', () => {
      const documents = withChange(({ schema }) => {
        setFlow(schema, 'go', [
          onClick(),
          step('notify', 'globalCallback', 'addNotification', { elementId: 'go', params: { content: 'Hi' } })
        ]);
      });

      expect(errorsOf(documents)).toContain('global-callback-module');
    });

    it('step-params', () => {
      const documents = withChange(({ schema }) => {
        setFlow(schema, 'go', [
          onClick(),
          step('notify', 'globalCallback', 'addNotification', {
            elementId: notify,
            params: { content: 'Hi', appeareance: 'success' }
          })
        ]);
      });

      expect(errorsOf(documents)).toContain('step-params');
    });

    // `autoDismissTimeout` applies only while `autoDismiss` is on, and it is on by default: read as the runtime reads it.
    it('step-params on a param that applies through a default', () => {
      const documents = withChange(({ schema }) => {
        setFlow(schema, 'go', [
          onClick(),
          step('notify', 'globalCallback', 'addNotification', {
            elementId: notify,
            params: { content: 'Hi', autoDismissTimeout: 'soon' }
          })
        ]);
      });

      expect(errorsOf(documents)).toContain('step-params');
    });

    it('step-params on the setState every element answers to', () => {
      const documents = withChange(({ schema }) => {
        setFlow(schema, 'go', [
          onClick(),
          step('write', 'callback', 'setState', {
            elementId: 'hello',
            params: { category: 'attribute', key: 'content', value: 'Done', type: 'text' }
          })
        ]);
      });

      expect(errorsOf(documents)).toContain('step-params');
    });

    it('unknown-utility', () => {
      const documents = withChange(({ schema }) => {
        setFlow(schema, 'go', [onClick(), step('nap', 'utility', 'sleep')]);
      });

      expect(warningsOf(documents)).toContain('unknown-utility');
    });

    it('utility-module', () => {
      const documents = withChange(({ schema }) => {
        setFlow(schema, 'go', [
          onClick(),
          step('wait', 'utility', 'delayTime', { elementId: 'go', params: { time: 1 } })
        ]);
      });

      expect(errorsOf(documents)).toContain('utility-module');
    });

    it('callback-not-answered', () => {
      const documents = withChange(({ schema }) => {
        setFlow(schema, 'go', [onClick(), step('open', 'callback', 'openModal', { elementId: 'box' })]);
      });

      expect(errorsOf(documents)).toContain('callback-not-answered');
    });

    it('callback-key-unknown, for an attribute', () => {
      const documents = withChange(({ schema }) => {
        setFlow(schema, 'go', [
          onClick(),
          step('write', 'callback', 'setState', {
            elementId: 'hello',
            params: { category: 'attribute', key: 'label', value: 'Done' }
          })
        ]);
      });

      expect(errorsOf(documents)).toContain('callback-key-unknown');
    });

    it('callback-key-unknown, for the state', () => {
      const documents = withChange(({ schema }) => {
        setFlow(schema, 'go', [
          onClick(),
          step('show', 'callback', 'setState', {
            elementId: 'hello',
            params: { category: 'state', key: 'visible', value: true }
          })
        ]);
      });

      expect(errorsOf(documents)).toContain('callback-key-unknown');
    });

    it('callback-key-unknown lets through a key the element has', () => {
      const documents = withChange(({ schema }) => {
        setFlow(schema, 'go', [
          onClick(),
          step('write', 'callback', 'setState', {
            elementId: 'hello',
            params: { category: 'attribute', key: 'content', value: 'Done' }
          }),
          step('hide', 'callback', 'setState', {
            elementId: 'box',
            params: { category: 'state', key: 'visibility', value: false }
          })
        ]);
      });

      expect(lintSpace(documents).errors).toEqual([]);
    });

    it('state-key-has-runtime-prefix', () => {
      const documents = withChange(({ schema }) => {
        setFlow(schema, 'go', [
          onClick(),
          step('write', 'globalCallback', 'setState', {
            elementId: 'state',
            params: { key: 'state.name', type: 'text', value: 'Ada' }
          })
        ]);
      });

      expect(warningsOf(documents)).toContain('state-key-has-runtime-prefix');
    });
  });
  describe('svg', () => {
    it('svg-not-svg', () => {
      const documents = withChange(({ schema }) => {
        addElement(schema, { id: 'icon', type: 'svg', attributes: { content: '<div><svg></svg></div>' } });
        addElement(schema, { id: 'ok', type: 'svg', attributes: { content: '<svg viewBox="0 0 1 1"></svg>' } });
      });

      expect(errorsOf(documents)).toContain('svg-not-svg');
      expect(lintSpace(documents).errors.filter(issue => issue.code === 'svg-not-svg')).toHaveLength(1);
    });
  });
});
