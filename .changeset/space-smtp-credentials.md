---
'@plitzi/sdk-server': patch
'@plitzi/sdk-shared': patch
---

A flow's mail goes through the space's own SMTP server.

- **`email.send` names an SMTP credential.** A space holds its mail server as a credential of provider `smtp` —
  `host`, `port`, `security` (`starttls`, `tls` or `none`), `username`, `password`, `fromEmail`, `fromName` — and the
  step picks one. The message is sent as that credential's `fromEmail`; no flow chooses who its mail comes from. The
  builder offers an SMTP form under Credentials and the space's SMTP credentials to pick from on the step.
- **Offered by every server.** There is no deployment transport any more: `ActionEmailAdapter` is gone, and
  `action.email` is now `ActionEmailConfig` — `dailyLimitPerSpace` (default 200, counted in `kv`),
  `allowPrivateHosts` (default off: a credential may not name `localhost` or a private network) and `transport`
  (`ActionEmailTransport`, optional: a deployment that routes mail its own way owns the connection; the limit and the
  checks stay the server's).
- **One rule for an SMTP credential,** `readSmtpCredential` from `@plitzi/sdk-shared/actions`, applied by the form,
  the check, the task and a deployment's API. A step with no credential, or one that is not a usable SMTP server,
  fails saying so, and the check reports it before anybody runs the flow. The server's password never reaches a trace.
