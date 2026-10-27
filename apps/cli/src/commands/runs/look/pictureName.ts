/**
 * A look's picture, named for what it shows: the task, the page, who read it — a path looked at as a guest and again as
 * an account wrote the same pictures, the second over the first — its part, width, scheme, and whether it is the page
 * after the task set beside the run before.
 */
export const pictureName = ({
  task,
  route,
  as,
  guest,
  clip,
  width,
  scheme,
  after = false
}: {
  task: string;
  route: string;
  as?: string | undefined;
  guest?: boolean | undefined;
  clip?: string | undefined;
  width: string;
  scheme: string;
  after?: boolean;
}): string => {
  const page = route === '/' ? '-home' : `-${route.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')}`;
  const reader = as !== undefined ? `-as-${as.replace(/[^a-z0-9]+/gi, '-')}` : guest === true ? '-guest' : '';

  return `${task}${page}${reader}${clip ? `-${clip}` : ''}-${width}-${scheme}${after ? '-after' : ''}.png`;
};
