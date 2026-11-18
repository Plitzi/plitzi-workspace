---
'@plitzi/cli': patch
---

A page tells every proxy on its way to leave its HTML as it was sent, so nothing between the server and the browser
can break its hydration.

## Page server

- **A page's HTML reaches the browser as it was sent.** A page hydrates over the server's HTML node for node, and a
  proxy that rewrote it on the way — Cloudflare's Email Address Obfuscation replacing an address in the copy and
  injecting its script — made React throw the server's page away and draw it again (`Minified React error #418`): every
  animation started twice, every font was asked for again, and the page flickered on each load. Every page now says
  `Cache-Control: no-transform`, HTTP's own word for it, which the proxies honour. It is still compressed by the server
  itself: `res.send(body, { ownEncoding: true })` is how a stage says `no-transform` to the proxies after it and not to
  this server, where the header otherwise stops compression too (as a response carrying a credential needs).

## To do when you upgrade

- A proxy or CDN rule that overwrites `Cache-Control` on HTML must keep `no-transform`, or turn off whatever rewrites
  the markup (email obfuscation, HTML minification, script injection) for the site's hosts.
