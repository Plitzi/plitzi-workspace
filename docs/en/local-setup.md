# Local setup

To work on Plitzi with local hostnames and browser APIs that depend on a secure context, configure your machine as follows.

## Hosts file

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

## HTTPS

Enable HTTPS in your local development environment. It is required for:

- Web Crypto (`crypto`) in a secure context
- Correct behaviour with the hostnames above

Use the certificates and dev-server configuration defined in each app (builder, SDK, server) as documented in their Vite or server setup.

## Verify

After `yarn start`, open the URLs configured in each app (for example `https://app.plitzi.local`) and confirm the certificate is trusted in your browser or OS.

## See also

- [Getting started](./getting-started.md)
- [Development](./development.md)
