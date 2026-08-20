/**
 * The one server-action validator.
 *
 * Three places decide whether a document is fit to store — the builder panel, the MCP write ops and the GraphQL
 * mutation that persists it — and a document is only ever wrong in one way, so the rules live here instead of
 * being restated (and drifting) at each entry point. The input is `unknown` because the server runs it last, on
 * whatever JSON actually arrived: it validates a document, it does not assume one.
 *
 * Errors are what the runner cannot recover from at request time; warnings are what will run but probably does
 * not do what the author meant.
 */

export type ActionDocumentIssue = {
  /** Dotted path into the document, e.g. `nodes.send.action`. */
  path: string;
  message: string;
  hint?: string;
};

export type ActionDocumentReport = {
  valid: boolean;
  errors: ActionDocumentIssue[];
  warnings: ActionDocumentIssue[];
};

const FIELD_TYPES = ['text', 'number', 'boolean', 'date', 'json', 'file'];
const ACCESS_MODES = ['public', 'session', 'role'];
const TRIGGER_TYPES = ['call', 'webhook', 'schedule', 'render', 'custom'];
/** `<namespace>.<action>`, which is how the registry addresses a task. */
const TASK_NAME = /^[a-z][a-zA-Z0-9]*\.[a-z][a-zA-Z0-9]*$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const isFilledString = (value: unknown): value is string => typeof value === 'string' && value.trim() !== '';

const validateFields = (fields: unknown, path: string, errors: ActionDocumentIssue[]) => {
  if (fields === undefined) {
    return;
  }

  if (!isRecord(fields)) {
    errors.push({ path, message: 'must be an object of field definitions' });

    return;
  }

  Object.entries(fields).forEach(([key, field]) => {
    if (!isRecord(field) || !isFilledString(field.type)) {
      errors.push({ path: `${path}.${key}`, message: 'must declare a type' });

      return;
    }

    if (!FIELD_TYPES.includes(field.type)) {
      errors.push({
        path: `${path}.${key}.type`,
        message: `unknown field type "${field.type}"`,
        hint: `one of ${FIELD_TYPES.join(', ')}`
      });
    }
  });
};

const validateAccess = (access: unknown, errors: ActionDocumentIssue[]) => {
  if (!isRecord(access) || !isFilledString(access.mode)) {
    // No default: an action whose access nobody wrote down would have to be guessed at, and every guess is either
    // a lock-out or a hole.
    errors.push({ path: 'access', message: 'must declare a mode', hint: `one of ${ACCESS_MODES.join(', ')}` });

    return;
  }

  if (!ACCESS_MODES.includes(access.mode)) {
    errors.push({ path: 'access.mode', message: `unknown access mode "${access.mode}"` });

    return;
  }

  if (access.mode === 'role' && (!Array.isArray(access.permissions) || access.permissions.length === 0)) {
    errors.push({ path: 'access.permissions', message: 'role access must list at least one permission' });
  }
};

const validateTriggers = (
  triggers: unknown,
  access: unknown,
  errors: ActionDocumentIssue[],
  warnings: ActionDocumentIssue[]
) => {
  if (!Array.isArray(triggers) || triggers.length === 0) {
    errors.push({ path: 'triggers', message: 'must declare at least one trigger' });

    return;
  }

  triggers.forEach((trigger, index) => {
    const path = `triggers.${index}`;
    if (!isRecord(trigger) || !isFilledString(trigger.type)) {
      errors.push({ path, message: 'must declare a type' });

      return;
    }

    if (!TRIGGER_TYPES.includes(trigger.type)) {
      errors.push({ path: `${path}.type`, message: `unknown trigger "${trigger.type}"` });

      return;
    }

    if (trigger.type === 'schedule' && !isFilledString(trigger.cron)) {
      errors.push({ path: `${path}.cron`, message: 'a scheduled trigger needs a cron expression' });
    }

    if (trigger.type === 'custom' && !isFilledString(trigger.name)) {
      errors.push({ path: `${path}.name`, message: 'a custom trigger needs a name to be mounted under' });
    }

    // A webhook is reachable by anyone who learns the URL. Without a signature it is an open endpoint into
    // whatever the flow does, so this is called out even though the document is technically runnable.
    if (trigger.type === 'webhook' && !isRecord(trigger.verify)) {
      warnings.push({
        path: `${path}.verify`,
        message: 'this webhook accepts unsigned requests',
        hint: 'declare an hmac verification so only the sender you expect can start a run'
      });
    }
  });

  const isPublic = isRecord(access) && access.mode === 'public';
  const onlyCall = triggers.every(trigger => isRecord(trigger) && trigger.type === 'call');
  if (isPublic && onlyCall) {
    warnings.push({
      path: 'access',
      message: 'anyone can run this action, including signed-out visitors',
      hint: 'use session access unless the page needs it before anyone signs in'
    });
  }
};

type NodeShape = { id?: unknown; type?: unknown; action?: unknown; afterNode?: unknown; enabled?: unknown };

/**
 * The flow itself: one entry, a reachable chain, and steps that can actually run on a server.
 *
 * The last rule is the one worth having a validator for. Client and server flows share a node type, so nothing in
 * the shape stops someone from dropping a `setState` into an action — it just fails at run time, in a place with
 * no browser to set state in.
 */
const validateNodes = (
  nodes: unknown,
  output: unknown,
  errors: ActionDocumentIssue[],
  warnings: ActionDocumentIssue[]
) => {
  if (!isRecord(nodes)) {
    errors.push({ path: 'nodes', message: 'must be an object of steps' });

    return;
  }

  const entries = Object.entries(nodes) as [string, NodeShape][];
  const triggerNodes = entries.filter(([, node]) => isRecord(node) && node.type === 'trigger');
  if (triggerNodes.length === 0) {
    errors.push({ path: 'nodes', message: 'the flow has no trigger step to start from' });
  } else if (triggerNodes.length > 1) {
    errors.push({
      path: 'nodes',
      message: `the flow has ${triggerNodes.length} trigger steps`,
      hint: 'a server action runs one chain, so exactly one step starts it'
    });
  }

  entries.forEach(([key, node]) => {
    const path = `nodes.${key}`;
    if (!isRecord(node)) {
      errors.push({ path, message: 'must be an object' });

      return;
    }

    if (node.type === 'trigger') {
      return;
    }

    if (node.type !== 'task') {
      errors.push({
        path: `${path}.type`,
        message: `"${String(node.type)}" steps run in the browser and cannot run on the server`,
        hint: 'a server action is made of task steps'
      });

      return;
    }

    if (!isFilledString(node.action) || !TASK_NAME.test(node.action)) {
      errors.push({
        path: `${path}.action`,
        message: 'must name a task as <namespace>.<action>',
        hint: 'for example flow.return or http.request'
      });

      return;
    }

    if (isFilledString(node.afterNode) && !Object.hasOwn(nodes, node.afterNode)) {
      errors.push({ path: `${path}.afterNode`, message: `points at "${node.afterNode}", which is not a step here` });
    }
  });

  // Read off the steps rather than tracked with a flag through the loop above: a variable a callback assigns is a
  // variable the type checker cannot narrow, and the check would silently become dead.
  const returns = entries.some(([, node]) => isRecord(node) && node.action === 'flow.return');
  // The runner answers `{}` when nothing returned, which looks to the caller exactly like a flow that ran and
  // produced nothing — the most confusing failure this design has.
  if (!returns && isRecord(output) && Object.keys(output).length > 0) {
    warnings.push({
      path: 'nodes',
      message: 'this action declares output but no step returns anything',
      hint: 'add a flow.return step naming the values the caller should get'
    });
  }
};

const CREDENTIAL_TOKEN = /\{\{\s*credential\./;

/**
 * A credential token only means something inside the step that asked for the credential.
 *
 * Credentials are not part of the flow scope — an ambient one would be interpolable by every node, `flow.return`
 * included, which is a secret handed to the browser. So a token anywhere else silently renders to nothing, and
 * the symptom is an outbound call that goes out unauthenticated and reports whatever the provider says about it.
 */
const validateCredentialTokens = (nodes: Record<string, unknown>, warnings: ActionDocumentIssue[]) => {
  Object.entries(nodes).forEach(([key, node]) => {
    if (!isRecord(node) || !isRecord(node.params)) {
      return;
    }

    const names = isFilledString(node.params.credential) ? node.params.credential : '';
    Object.entries(node.params).forEach(([param, value]) => {
      if (typeof value !== 'string' || !CREDENTIAL_TOKEN.test(value) || names !== '') {
        return;
      }

      warnings.push({
        path: `nodes.${key}.params.${param}`,
        message: 'this step reads a credential it did not ask for, so the token resolves to nothing',
        hint: 'set the step’s `credential` to the identifier it should use'
      });
    });
  });
};

/** Steps that name a connector the document never declared cannot resolve one at run time. */
const validateDeclarations = (document: Record<string, unknown>, warnings: ActionDocumentIssue[]) => {
  const declared = new Set(Array.isArray(document.connectors) ? (document.connectors as string[]) : []);
  const nodes = isRecord(document.nodes) ? document.nodes : {};

  Object.entries(nodes).forEach(([key, node]) => {
    if (!isRecord(node) || typeof node.action !== 'string' || !node.action.startsWith('connector.')) {
      return;
    }

    const params = isRecord(node.params) ? node.params : {};
    const connector = params.connector;
    // Only a literal can be checked: a bound value resolves from the flow scope at run time, and refusing those
    // would forbid the legitimate case of choosing a connector from input.
    if (isFilledString(connector) && !connector.includes('{{') && !declared.has(connector)) {
      warnings.push({
        path: `nodes.${key}.params.connector`,
        message: `"${connector}" is not listed in this action's connectors`,
        hint: 'add it to `connectors` or the step will be refused at run time'
      });
    }
  });
};

export const validateActionDocument = (document: unknown): ActionDocumentReport => {
  const errors: ActionDocumentIssue[] = [];
  const warnings: ActionDocumentIssue[] = [];

  if (!isRecord(document)) {
    return { valid: false, errors: [{ path: '', message: 'the document must be an object' }], warnings };
  }

  if (!isFilledString(document.name)) {
    errors.push({ path: 'name', message: 'must have a name' });
  }

  validateAccess(document.access, errors);
  validateTriggers(document.triggers, document.access, errors, warnings);
  validateFields(document.input, 'input', errors);
  validateFields(document.output, 'output', errors);
  validateNodes(document.nodes, document.output, errors, warnings);
  validateDeclarations(document, warnings);
  validateCredentialTokens(isRecord(document.nodes) ? document.nodes : {}, warnings);

  return { valid: errors.length === 0, errors, warnings };
};
