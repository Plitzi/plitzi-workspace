# Local setup

How you run Plitzi locally depends on your role in the project.

## Contributors (default)

Most contributors do **not** need to edit `/etc/hosts` or run a full local backend stack.

After [Getting started](./getting-started.md):

1. Clone the repo and run `yarn install`.
2. Run `yarn start` (or a single app under `apps/`).
3. Use the **development servers** the apps already point to in dev mode, for example:
   - `https://server-dev.plitzi.com` (GraphQL / API)
   - `https://api-dev.plitzi.com`
   - `https://ssr-dev.plitzi.com`

That is enough to work on UI, SDK packages, and most monorepo changes. Ask the team in [Discord](https://discord.gg/plitzi) or [GitHub Discussions](https://github.com/plitzi/plitzi-workspace/discussions) if you need credentials or a specific dev URL.

## Maintainers: full local stack (optional)

Only needed if you run **all** services on your machine with custom hostnames (`*.plitzi.local`) instead of the shared dev servers.

### Hosts file

Add these entries to `/etc/hosts` (Linux/macOS) or `C:\Windows\System32\drivers\etc\hosts` (Windows):

```
127.0.0.1       plitzi.local
::1             plitzi.local
127.0.0.1       server.plitzi.local
::1             server.plitzi.local
127.0.0.1       ssr.plitzi.local
::1             ssr.plitzi.local
127.0.0.1       api.plitzi.local
::1             api.plitzi.local
127.0.0.1       app.plitzi.local
::1             app.plitzi.local
```

### HTTPS

Enable HTTPS in your local development environment. It is required for:

- Web Crypto (`crypto`) in a secure context
- Correct behaviour with the hostnames above

Use the certificates and dev-server configuration defined in each app (builder, SDK, server) as documented in their Vite or server setup.

### Verify

After `yarn start`, open the URLs configured in each app (for example `https://app.plitzi.local`) and confirm the certificate is trusted in your browser or OS.

## See also

- [Getting started](./getting-started.md)
- [Development](./development.md)
