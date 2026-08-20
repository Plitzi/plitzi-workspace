import type { ActionTaskRegistry, RegisteredTask } from './types';

/**
 * A task as an editor renders it.
 *
 * `run` is dropped rather than left to JSON to discard silently — it is server code. `params` goes over as it is,
 * because it is already the `InteractionCallbackParam` map the builder's WorkflowNode draws.
 *
 * What does not survive the trip is a FUNCTION-valued param: a `when`, or options computed from another param.
 * Those are a task author's way of saying "this field depends on that one", and a catalog served over the wire
 * keeps only the static half — worth knowing when writing a deployment task meant to be authored visually.
 *
 * They are STRIPPED here rather than left for the transport to choke on: a JSON scalar refuses a function outright,
 * so `http.request` — whose `body` is hidden on GET — took the whole catalog down with it.
 */
export type ActionTaskDescriptor = {
  name: string;
  namespace: string;
  action: string;
  title: string;
  description?: string;
  /** Serializable params only — see above. */
  params: Record<string, unknown>;
};

/** Drops anything JSON cannot carry, at any depth. Functions are the only such value a task declares today. */
const jsonSafe = (value: unknown): unknown => {
  if (typeof value === 'function') {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value.map(jsonSafe).filter(item => item !== undefined);
  }

  if (value !== null && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).reduce<Record<string, unknown>>((acum, [key, item]) => {
      const safe = jsonSafe(item);
      if (safe !== undefined) {
        acum[key] = safe;
      }

      return acum;
    }, {});
  }

  return value;
};

export const describeTask = (task: RegisteredTask): ActionTaskDescriptor => ({
  name: task.name,
  namespace: task.namespace,
  action: task.action,
  title: task.title,
  description: task.description,
  params: jsonSafe(task.params) as Record<string, unknown>
});

/** The whole catalog, in the order the registry holds it. */
export const describeCatalog = (registry: ActionTaskRegistry): ActionTaskDescriptor[] =>
  registry.list().map(describeTask);
