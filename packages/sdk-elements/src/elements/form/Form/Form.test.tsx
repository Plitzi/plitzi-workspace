import { fireEvent, render, screen } from '@testing-library/react';
import { useCallback, useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { StoreProvider, createStoreHook } from '@plitzi/nexus/react';

import { Form } from './Form';
import ElementContext from '../../../Element/ElementContext';
import { elementEntry } from '../../../testUtils/elementTestUtils';
import { FormControl } from '../FormControl/FormControl';
import withFieldValue from '../FormControl/hocs/withFieldValue';

import type { ElementContextValue } from '../../../Element/ElementContext';
import type { FormControlProps } from '../FormControl/FormControl';
import type { ReactNode } from 'react';

// `withElement` reaches the element catalogue, and importing that from Node is the TDZ cycle this package has a note
// about. The form and its controls are rendered bare, each inside the context the HOC would have given it.
vi.mock('../../../Element/hocs/withElement', () => ({ default: (element: unknown) => element }));

vi.mock('@plitzi/sdk-shared/dataSource/hooks/useRegisterSource', () => ({ default: () => undefined }));

const { interactionTrigger } = vi.hoisted(() => ({ interactionTrigger: vi.fn() }));

vi.mock('@plitzi/sdk-shared/hooks/usePlitziServiceContext', async () => {
  const { createContext: create } = await import('react');
  const InteractionsContext = create({ interactionsManager: { interactionTrigger }, useInteractions: () => undefined });

  return {
    default: () => ({
      settings: { previewMode: true },
      root: { baseElementId: 'root' },
      contexts: { InteractionsContext }
    })
  };
});

// One object for the life of the module: a store handed a new value on every render resets itself on every render.
const STORE = { runtime: { sources: {} } };

const Control = withFieldValue(FormControl);

/**
 * Everything a control is rendered with, so each test names only the rules it is about.
 *
 * `subType` is narrowed to what these tests type into: the control and the HOC around it each list a subtype the other
 * does not, and only their overlap is a control both can render.
 */
const control = (
  props: Pick<FormControlProps, 'name' | 'label'> &
    Partial<Omit<FormControlProps, 'subType'>> & { subType: 'text' | 'password' }
) => ({
  ref: { current: document.createElement('div') },
  className: '',
  placeholder: '',
  autoComplete: false,
  disabled: false,
  options: [],
  required: true,
  minLength: 0,
  maxLength: 0,
  pattern: '',
  patternMessage: '',
  matches: '',
  matchesMessage: '',
  readOnly: false,
  value: '',
  error: '',
  ...props
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const asErrors = (value: unknown): Record<string, string> =>
  isRecord(value)
    ? Object.fromEntries(
        Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
      )
    : {};

const controlEntry = (id: string): ElementContextValue =>
  elementEntry(id, {
    definition: {
      rootId: 'root',
      label: id,
      type: 'formControl',
      styleSelectors: { base: '', label: '', input: '', error: '' }
    }
  });

const PASSWORD_ENTRY = controlEntry('password');
const CONFIRM_ENTRY = controlEntry('confirm');

/**
 * A form the way `withElement` would hand it its props: its values and errors live in element state, and every change a
 * control makes goes back through `setElementState` and comes down again as props.
 */
const Harness = ({ managed = true, children }: { managed?: boolean; children: ReactNode }) => {
  const [state, setState] = useState<Record<string, unknown>>({});

  // Stable, as the real one is: the form's callbacks depend on it, and a setter that changed identity on every render
  // would make every control unregister and register again on every keystroke.
  const setElementState = useCallback(<S extends Record<string, unknown>>(value?: S | ((prev: S) => S)): boolean => {
    // The context's setter is generic over whatever an element keeps; this harness keeps one record for the form.
    setState(prev => (typeof value === 'function' ? value(prev as S) : (value ?? prev)));

    return true;
  }, []);

  const [ref] = useState(() => ({ current: document.createElement('form') }));
  const [entry, setEntry] = useState(() => elementEntry('signup', { setElementState }));
  if (entry.setElementState !== setElementState) {
    setEntry(elementEntry('signup', { setElementState }));
  }

  return (
    <StoreProvider value={STORE}>
      <ElementContext value={entry}>
        <Form
          ref={ref}
          className=""
          method="post"
          actionUrl=""
          managedByInteractions={managed}
          values={isRecord(state.values) ? state.values : {}}
          errors={asErrors(state.errors)}
        >
          {children}
          <button type="submit">Create</button>
        </Form>
      </ElementContext>
    </StoreProvider>
  );
};

const passwordControls = (
  <>
    <ElementContext value={PASSWORD_ENTRY}>
      <Control {...control({ name: 'password', subType: 'password', label: 'Password', minLength: 10 })} />
    </ElementContext>
    <ElementContext value={CONFIRM_ENTRY}>
      <Control
        {...control({
          name: 'passwordConfirm',
          subType: 'password',
          label: 'Confirm password',
          matches: 'password',
          matchesMessage: 'The passwords do not match'
        })}
      />
    </ElementContext>
  </>
);

const input = (name: string): HTMLInputElement => {
  const found = document.querySelector(`input[name="${name}"]`);
  if (!(found instanceof HTMLInputElement)) {
    throw new Error(`No input named ${name}`);
  }

  return found;
};

const submits = () => interactionTrigger.mock.calls.filter(call => call[1] === 'onSubmit');

describe('Form / the rules its controls declare', () => {
  beforeEach(() => {
    interactionTrigger.mockClear();
  });

  it('does not submit while a control breaks a rule, and says which rule under the control', () => {
    render(<Harness>{passwordControls}</Harness>);

    fireEvent.change(input('password'), { target: { value: 'short' } });
    fireEvent.change(input('passwordConfirm'), { target: { value: 'shorter' } });
    fireEvent.submit(screen.getByText('Create'));

    expect(submits()).toEqual([]);
    expect(screen.getByText('Use at least 10 characters')).toBeTruthy();
    expect(screen.getByText('The passwords do not match')).toBeTruthy();
  });

  it('submits once every rule is met, with the values it checked', () => {
    render(<Harness>{passwordControls}</Harness>);

    fireEvent.change(input('password'), { target: { value: 'correct horse battery' } });
    fireEvent.change(input('passwordConfirm'), { target: { value: 'correct horse battery' } });
    fireEvent.submit(screen.getByText('Create'));

    expect(submits()).toHaveLength(1);
    expect(submits()[0][2]).toMatchObject({
      values: { password: 'correct horse battery', passwordConfirm: 'correct horse battery' }
    });
  });

  /**
   * A control nobody typed into is never blurred, so only the form asking at submit time can catch it — this is the
   * case a blur-only check would let straight through.
   */
  it('asks the controls nobody touched', () => {
    render(<Harness>{passwordControls}</Harness>);

    fireEvent.submit(screen.getByText('Create'));

    expect(submits()).toEqual([]);
    expect(screen.getAllByText('This field is required')).toHaveLength(2);
  });

  it('keeps an unmanaged form from submitting natively too', () => {
    render(<Harness managed={false}>{passwordControls}</Harness>);

    fireEvent.change(input('password'), { target: { value: 'short' } });

    expect(fireEvent.submit(screen.getByText('Create'))).toBe(false);
  });

  it('checks a control when it loses focus, before anybody submits', () => {
    render(<Harness>{passwordControls}</Harness>);

    fireEvent.change(input('password'), { target: { value: 'correct horse battery' } });
    fireEvent.change(input('passwordConfirm'), { target: { value: 'correct horse' } });
    fireEvent.blur(input('passwordConfirm'));

    expect(screen.getByText('The passwords do not match')).toBeTruthy();
  });

  it('clears what a control said once it is typed into again', () => {
    render(<Harness>{passwordControls}</Harness>);

    fireEvent.change(input('password'), { target: { value: 'short' } });
    fireEvent.blur(input('password'));
    expect(screen.getByText('Use at least 10 characters')).toBeTruthy();

    fireEvent.change(input('password'), { target: { value: 'long enough now' } });

    expect(screen.queryByText('Use at least 10 characters')).toBeNull();
  });
});

/** What a binding inside the form reads: the source it publishes under its own name, `<type>_<id>`. */
const SourceProbe = () => {
  const { useStore } = createStoreHook<{
    runtime?: { sources?: { apiContainer_signup?: { values?: Record<string, unknown> } } };
  }>();
  const [values] = useStore('runtime.sources.apiContainer_signup.values');
  const password = values?.password;

  return <output data-testid="probe">{typeof password === 'string' ? password : ''}</output>;
};

describe('Form / the source it publishes', () => {
  /**
   * The builder lists a form's fields under `apiContainer_<id>`, and authoring validates a binding against that name —
   * so that is where the values have to be. They used to be only on the controls' private channel, and every binding
   * to one resolved to nothing without a word.
   */
  it('publishes what has been typed under its own source name, for the bindings inside it', () => {
    render(
      <Harness>
        {passwordControls}
        <SourceProbe />
      </Harness>
    );

    fireEvent.change(input('password'), { target: { value: 'correct horse' } });

    expect(screen.getByTestId('probe').textContent).toBe('correct horse');
  });
});
