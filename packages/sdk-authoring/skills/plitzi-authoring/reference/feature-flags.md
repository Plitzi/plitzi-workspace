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

## Rolling out gradually

`rollout: { percent: 10, value: true }` on a flag turns it on for 10% of the visitors when none of its rules matches;
the rest get its `value`. Each visitor keeps their place (a cookie), so raising the percent keeps everyone who was in —
10, then 50, then 100, then remove the flag. Rules still come first: a rule for staff answers before the rollout. Not
access control — a visitor's place is theirs to change. A malformed one is `flag-rollout`.

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

## Variants: A/B tests and audiences

A flag shows the same side to everyone its rules match; `variants` shows each visitor one of its `variantItem`s, chosen
**by chance** (an A/B test, the default) or **by rules** (who the visitor is). Only the variant shown is drawn.

```ts
variants({
  children: [
    variantItem({ weight: 90, children: [heading({ content: 'Build faster' })] }), // A: 90% of the visitors
    variantItem({ weight: 10, children: [heading({ content: 'Ship today' })] })    // B: 10%
  ]
});
```

**By chance**, it holds two to five variants — A first, then B… A `weight` (0–100, default 50) is a share against the
others'. The server draws the visitor's variant and keeps it in a cookie, so a reload or a later visit shows the same,
and a visitor keeps theirs when the shares change; 0 shows a variant to nobody, one left with a share ends the test. Its
`experiment` names the test — left empty, the element's id does (`pricing-test` runs `pricing_test`) — and two with the
same name show a visitor the same variant (`experiment-weights-differ` warns when their shares disagree). Count a
conversion with the `reachGoal('signup')` step: Plitzi's analytics shows each variant's visitors, conversions and rate
against A's. `{{ experiments.<name> }}` is `'a'`, `'b'`… for a flow. To see a variant you were not drawn, where debugging
is authorized: the dev tools' **Experiments** tab, or `?ab=heroTest:b` in the address.

**By rules** — `chooseBy: 'rules'` — it shows the first variant whose `when` the visitor matches: a rule group over what a
flag's rules see, `queryParams.utm_source` included, and the visitor: `visitor.returning`, `visitor.language` (`es`),
`visitor.device` (`mobile`, `tablet`, `desktop`). End it with a variant with no `when`, for everybody else
(`variants-no-fallback` warns otherwise):

```ts
variants({
  chooseBy: 'rules',
  children: [
    variantItem({
      when: { combinator: 'and', rules: [{ field: 'visitor.device', operator: '=', value: 'mobile' }] },
      children: [text({ content: 'Get the app' })]
    }),
    variantItem([text({ content: 'Welcome' })])
  ]
});
```

A variant keeps its `weight` and its `when` whichever way it chooses, so switching loses neither. In the builder its
settings list the variants with their share or their rule; the canvas shows the one picked there (`builderVariant`, its
place from 0) while editing, and the preview the visitor chosen in the State Manager's **Visitor** tab.

## Showing something for a while

`timeWindow({ startsAt: '2026-12-01T09:00:00Z', endsAt: '2026-12-08T09:00:00Z', children })` shows what it holds only
between the two instants — ISO 8601 with the offset, never a local time (`time-window-bound`); either empty is no
bound. An open page shows or hides it when the window opens or closes. In the builder it always shows while editing;
the preview reads it at the date chosen in the Visitor tab.

