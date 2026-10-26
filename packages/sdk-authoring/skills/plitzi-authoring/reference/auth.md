# Signing people in

## Where they sign in

A page signs in with one provider: the space's `settings.userProvider`, or — when it declares none — the one the server
that rendered it serves.

| The space runs… | Declare |
| --- | --- |
| on the Plitzi platform, visitors signing in with their Plitzi account | `userProvider: 'server'` — and `visitorRoles` |
| on a self-hosted server with `auth` (`createServer({ auth })`; in a project, `src/config/serverOptions.ts`) | nothing: the server tells its pages where they sign in |
| against an API of your own over HTTP+JSON | `userProvider: 'basic'`, `loginUrl`, `userUrl`, `refreshUrl`, `logoutUrl`, and `sessionHintCookie` when it writes one |

What the space declares wins, setting by setting; a space naming another provider than the server's ignores the
server's altogether. A page with no provider at all offers no auth actions, and an `authLogin` there says why in the
console (`[plitzi] auth.login: …`) — read it before suspecting the form.

On the platform, `userProvider: 'server'` signs in by leaving the page: a `link` with `mode: 'external'` to
`/auth/sign-in?return=/` sends the visitor to sign in and back, signed in on the space's own host.

## The steps

```ts
form({
  id: 'signIn',
  managedByInteractions: true,
  flows: [
    [
      named('sent', onSubmit()),
      named('signedIn', authLogin({ username: '{{ sent.values.username }}', password: '{{ sent.values.password }}' })),
      when({ field: 'signedIn.ok', operator: '=', value: true }, navigate({ urlType: 'page', url: 'dashboard' })),
      when(
        { field: 'signedIn.reason', operator: '=', value: 'unverified' },
        addNotification({ content: 'Confirm your address first — the link is in your inbox', appearance: 'warning' })
      )
    ]
  ],
  children: [
    formControl({ name: 'username', label: 'Username' }),
    formControl({ name: 'password', label: 'Password', subType: 'password' }),
    button({ content: 'Sign in', subType: 'submit' })
  ]
});
```

- `authLogin(params)` — `{ username, password }`; `{ mode: 'token', token }` adopts a credential obtained elsewhere,
  checked against `userUrl`; `{ mode: 'mfa', mfaToken, code }` completes a sign-in that owed a second factor.
- What it answers: `ok`; when not, `reason` (`unverified`, `inactive`, `network`, `missing`…) and, for `reason: 'mfa'`,
  `mfaToken` — the challenge `mode: 'mfa'` completes. Test it on `<step>.ok` with `when`, never `whenSucceeded` /
  `whenFailed`, which are a server action's ([flows](flows.md)).
- `authLogout()` ends the session; `authLogoutEverywhere('site' | 'all')` ends it on every device too — this space's
  sessions, or every one of the account; `authRefreshDetails()` reloads who is signed in.

## Who is signed in

The `auth` source: `{{ auth.isAuthenticated }}`, `{{ auth.status }}` (`init` … `authenticated` | `guest`, while it is
being found out), `{{ auth.details.username }}` — `details` carries `id`, `username`, `email`, `verified`, `roles` and
`permissions`. Show a signed-in part with `visible: 'auth.isAuthenticated'`; never bind a token into the page.

## Pages for one kind of visitor

A page's `accessLevel`: `'authenticated'` (signed in), `'public'` (signed OUT only — the sign-in page), or nothing
(everybody). A lone `public` page vanishes the moment anyone signs in, so leave it out unless the page has a signed-in
twin on the same slug. `unauthorizedRedirect` names where a visitor the page is not for goes — a page's id or slug
(`''` is the home page), or a URL; without it they are answered 403. A visitor not signed in is sent with the address
they asked for as `?redirect=`. A `public` sign-in with `unauthorizedRedirect` sends whoever signs in on it there
itself — back to `?redirect=` when it is on this site, else to its `unauthorizedRedirect` — the moment `authLogin`
succeeds, so steps after the login race the page leaving: end the flow at the login. A sign-in for everybody sends them back
itself: `navigate({ urlType: 'external', url: "{{ navigation.queryParams.redirect | default('/') }}" })`.

A page for some permissions says so: `access: { permissions: ['postPublish'] }` — every one held, by a signed-in visitor
(the permissions of their visitor roles; on Plitzi's own spaces, their account's). The server keeps it: anybody else is
answered 401 or 403 and the page's refusal, and its content is never sent to them — not in the page, not in the space
the browser fetches. Signed out, they go to `unauthorizedRedirect` when the page names one. The refusal is a few words
of Plitzi's unless `settings.withheldPage` names a page of the space (id or slug, with no `access`): it is drawn
instead, in the same layout, with the same status — `auth.isAuthenticated` tells "sign in" from "not yours". Hiding a
part of a page on `auth.details.permissions` is not this: the part was still sent.

## What a visitor may do

`settings.visitorRoles` — `{ author: ['postPublish'] }` — is what each role gives. A visitor holds exactly the
permissions of their roles in this space; who holds a role is given by email in the builder, never written here. A page
reads them in `auth.details.permissions`, a plugin asks `can('postPublish')` of the auth context.

A server action's trigger says who may run it: `access: { mode: 'public' }`, `{ mode: 'session' }` (signed in) or
`{ mode: 'role', permissions: ['postPublish'] }`. The page hiding a button is not the check — the trigger is. Inside,
its steps read who asked as `{{ user.id }}`, and a function as `ctx.user` (`id`, `username`, `email`, `verified`,
`roles`, `permissions`) — never their session.
