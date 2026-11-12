# RFC 0033 — WS3 briefs: code quality, what is half-moved, nexus

> Section numbers here are the full RFC's, `git show c29db583b:docs/rfc/0033-audit-and-hardening.md`: its § 3 holds the
> findings, § 4 the decisions (§ 2 now), § 8 the design notes (§ 4 now). A task named here that is no longer in the RFC
> has shipped: what it made is in the code.

Read [`00-how-to-work.md`](00-how-to-work.md) first. Every task here is a refactor or a test: **behaviour does not
change**. The proof of that is the existing suites, unchanged and green, before and after — say so with their counts.

---

## T3.2 — `session` in parts

- **Done** 2026-11-10: `runClock.ts`, `turnHolder.ts`, `stops.ts`, each with its tests; `session` composes them.
- **Left:** a load round within its band, the maintainer's to run (the load probe is not kept in a repository); a result
  outside the band is a regression of this split until shown otherwise.
