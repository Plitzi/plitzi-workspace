# RFC 0033 — WS0 briefs: gates

> Section numbers here are the full RFC's, `git show c29db583b:docs/rfc/0033-audit-and-hardening.md`: its § 3 holds the
> findings, § 4 the decisions (§ 2 now), § 8 the design notes (§ 4 now). A task named here that is no longer in the RFC
> has shipped: what it made is in the code.

Read [`00-how-to-work.md`](00-how-to-work.md) first. Paths are relative to the repository named in each brief.

---

## T0.6 — Server CI runs what protects

- **Repo:** `plitzi-sdk-server`. **Finding:** G5. **Size:** L.
- **This is block 3 of the CI plan the maintainer already agreed**, not a new design: e2e in CI with service
  containers (MySQL, Mongo, Redis, SeaweedFS), the visual suite's `@smoke` tests per pull request, the full suite
  nightly and before a release. **Ask the maintainer for that plan's notes before starting.**
- **Depends on:** T0.9 (the tests that fail under load must be fixed first, or CI will be red at random).
- **Rules from that plan:** an unchanged thing is not rebuilt; CI never restores the lint or tsc caches.
- **Done when:** a pull request that breaks a route or the sign-in page fails; the e2e job's time is in the summary.

## T0.12 — The edge leaves the HTML alone

- **Repos:** `plitzi-platform` (Cloudflare role), `plitzi-sdk-server` (a check), `plitzi-workspace` (`docs/en`).
  **Findings:** W33, W34. **Size:** S.
- **Why:** on the dev cluster Cloudflare's email obfuscation rewrites addresses in the HTML and injects a script the
  page's policy blocks; React then fails hydration (#418) and redraws the page.
- **Steps:**
  1. **Ask the maintainer's go** — this changes Cloudflare. Then turn Email Address Obfuscation off for the zones the
     platform serves, in the Ansible role that manages Cloudflare (`cluster/ansible/roles/`; find it:
     `grep -rln "cloudflare" cluster/ansible/roles`).
  2. In the visual suite's remote mode (`VISUAL_SSR_URL` set): a test that loads `/` and `/terms` and asserts the
     console holds no message matching `/Minified React error #418|Content.Security.Policy/`.
  3. A paragraph in the self-hosting guide (`docs/en`) for whoever puts a rewriting proxy in front of a space.
  4. Measure again as a throttled phone (CPU ×4, 1.6 Mbps): `/terms` and `/templates`' largest paint.
- **Verify:** no #418 on `dev.plitzi.com`; `/terms`' largest paint under 2.5 s in that lab.
- **Stop and ask if:** the role has no setting for it — do not click it in the dashboard.
