# Putting a version online

A space's own address (`<space>.plitzi.app`) always shows the draft: every save, nothing to publish. A domain of its own
shows what is published on it. All of it is the space on Plitzi, not the project: what is pushed (`space push`) is the
draft, and these commands take it from there.

```bash
npx plitzi space snapshot -m "Spring menu"              # the draft kept as production's next revision
npx plitzi space snapshot -e staging -m "Try the menu"  # …or staging's, development's: an environment is a line of them
npx plitzi space publish example.com                    # the domain FOLLOWS production: each revision kept there shows
npx plitzi space publish example.com -r 12              # the domain STAYS on production r12 until published again
npx plitzi space publish example.com -e main            # every save, as the space's own address shows
npx plitzi space publish example.com --at 2026-12-01T09:00Z  # later, at a moment (a plan with deploy automation)
npx plitzi space releases example.com                   # what it served, who and when; what a rollback puts back
npx plitzi space rollback example.com                   # what it served right before its latest release
npx plitzi space rollback example.com --to production@9 # a version of its history
```

- **Follow or stay.** Left without `-r`, a domain follows its environment's latest: a later `snapshot` shows on it with
  no publish of its own. With `-r`, it stays on that revision. Say which the person wants when it is not plain.
- **Snapshot first, publish second.** A snapshot changes nothing a visitor sees; a publish does, at once. A space whose
  tests fail is refused either way, with the failures.
- **The own address takes no revision.** Publishing one there is refused: it shows the draft.

## A copy on a provider

A domain's site may be a copy a provider holds — GitHub Pages, AWS (S3 + CloudFront, Amplify), Cloudflare (R2, Pages),
Netlify, Vercel, an FTP host, or a zip — set up in the builder's publish sheet. A publish there may need a deploy:

```bash
npx plitzi space targets                                # each domain: where its site is, what it serves, what it asks
npx plitzi space publish example.com --deploy           # publish, and deploy the copy when the revision needs one
npx plitzi space deploy example.com --follow            # ship again what it serves, its log as it runs (exit 1: failed)
npx plitzi space deploy example.com --redeploy          # …built with the newest SDK and server, when targets says so
npx plitzi space deploys example.com                    # the latest deploys and how each ended
npx plitzi space download 42 -o site.zip                # a kept deploy's site, to host by hand
```

Without `--deploy`, a publish that needs one is refused with the reasons — never shipped silently. A failed deploy
says why in its log (`deploys`); a provider that replaces files one by one (FTP) may have shipped some of them — deploy
again once the cause is fixed.
