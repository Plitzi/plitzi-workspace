# Feature flags

A flag turns a part of the space on or off without editing it: a feature still being built, a version for beta users,
the old checkout kept until the new one ships. It is **not a visibility**. A hidden element is still rendered — its
markup is in the page, its subtree mounted. An element gated off by a flag is not rendered at all: not on the server,
not in the browser, not its children, and its server data is not resolved. Use `visible` for what the page's own state
shows and hides; use a flag for what a person decides is switched on.

**A flag is not a secret.** The space's document — gated elements included — still reaches the browser, as it always
does, so the other side can appear without a reload when a flag changes. Content a visitor must never receive belongs
behind a server action or a connector.

## Declaring one

```ts
authorSpace({
  name: 'Shop',
  permanentUrl: 'shop',
  flags: {
    newCheckout: {
      description: 'The one-step checkout',
      value: false,                                   // the answer when no rule matches
      rules: [                                        // read top to bottom; the first that matches decides
        { when: { combinator: 'and', rules: [{ field: 'environment', operator: '=', value: 'staging' }] }, value: true },
        { when: { combinator: 'and', rules: [{ field: 'user.roles', operator: 'contains', value: 'beta' }] }, value: true }
      ]
    }
  },
  pages: [ … ]
});
```

A rule's `when` sees `environment` (`main`, `development`, `staging`, `production`), `hostname`, `routeParams.<name>`,
`queryParams.<name>` and the visitor: `user.authenticated`, `user.email`, `user.username`, `user.roles` (a list — use
`contains`). A group with no rules is skipped, never read as "always" (`flag-rule-empty` warns).

The name is what a template reads, so it is a template key: letters, digits and `_`, starting with a letter or `_`.

## Gating an element or a page

```ts
container({ id: 'checkout', flag: 'newCheckout', children: [ … ] })     // only while the flag is on
container({ id: 'legacyCheckout', flag: '!newCheckout', children: [ … ] }) // only while it is off
{ name: 'Labs', slug: 'labs', flag: 'labs', body: [ … ] }               // a page: 404 while the flag is off
```

Put the two sides of a rollout next to each other — the new one on `flag`, the old one on `!flag` — so exactly one is
there whatever the flag says. A gate on a flag the space does not declare is an error (`flag-undeclared`): an
undeclared flag is off, so the element would never render.

## Reading one

`flags` is a global source like `state` or `theme`: `{{ flags.newCheckout }}` is `true` or `false` in a binding, a
step's `when`, a computed value — and in a server action's steps, resolved on the server for the visitor who started
it. A plugin reads one with `useFlag('newCheckout')` from `@plitzi/plitzi-sdk`. Reading a flag the space does not
declare is an error (`flag-unknown`).

Prefer a gate to `visible: 'flags.x'`: a visibility bound to a flag still renders the hidden half and ships it in the
HTML. Reach for the source only for what a gate cannot say — a label that changes, a step that branches.

## Who decides

The space's declaration answers first. Above it, in order, each may override a flag — only one the space declares:

1. the server rendering the page — `createServer({ flags })` in a self-hosted deployment;
2. the SDK embedding the space — `<PlitziSdk flags={{ newCheckout: true }} />` or `render(…, { flags })`;
3. a tester with the dev tools — the **Flags** tab forces one for that browser, only where debugging is authorized.

The draft (`main`) applies its flags as they are. Flags are **not served from a snapshot**: each environment has one set,
shared by every snapshot it serves. Publishing a snapshot sends the draft's flags with it; the builder's *Publish flags*
sends only them, with no new snapshot; rolling a snapshot back keeps the environment's flags. Each snapshot keeps a copy
of the flags it was published with, used only when the environment's own cannot be read (after a Redis copy of them),
and a self-hosted server keeps the last ones it fetched — so a published site keeps its flags with Plitzi unreachable.

## When the feature ships

Remove the gate from what stays, delete what it replaced, and remove the flag. A declared flag nothing reads is a
warning (`flag-unused`): it is a switch nobody can see the effect of.
