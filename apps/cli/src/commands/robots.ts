/**
 * Whether a site's `robots.txt` lets an agent read a path: the group for that agent, else the one for every agent,
 * and within it the longest rule that matches — `Allow` on a tie. `*` stands for anything and a final `$` for the end.
 * A site without one, or one that cannot be read, asks nothing.
 */

interface Rule {
  allow: boolean;
  pattern: string;
}

const groupsOf = (text: string): { agents: string[]; rules: Rule[] }[] => {
  const groups: { agents: string[]; rules: Rule[] }[] = [];
  let current: { agents: string[]; rules: Rule[] } | undefined;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    const separator = line.indexOf(':');
    if (separator < 0) {
      continue;
    }

    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (field === 'user-agent') {
      // Consecutive `User-agent` lines share the rules that follow them.
      if (!current || current.rules.length > 0) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }

      current.agents.push(value.toLowerCase());
    } else if ((field === 'allow' || field === 'disallow') && current) {
      // An empty `Disallow` allows everything: it is no rule at all.
      if (value) {
        current.rules.push({ allow: field === 'allow', pattern: value });
      }
    }
  }

  return groups;
};

const matches = (pattern: string, path: string): boolean => {
  const anchored = pattern.endsWith('$');
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split('*')
    .map(part => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');

  return new RegExp(`^${body}${anchored ? '$' : ''}`).test(path);
};

export const robotsAllows = (text: string, path: string, agent: string): boolean => {
  const groups = groupsOf(text);
  const named = groups.filter(group => group.agents.some(name => name !== '*' && agent.toLowerCase().includes(name)));
  const rules = (named.length > 0 ? named : groups.filter(group => group.agents.includes('*'))).flatMap(
    group => group.rules
  );
  const winner = rules
    .filter(rule => matches(rule.pattern, path))
    .toSorted((a, b) => b.pattern.length - a.pattern.length || Number(b.allow) - Number(a.allow))
    .at(0);

  return winner?.allow ?? true;
};
