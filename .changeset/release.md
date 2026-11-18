---
'@plitzi/cli': patch
---

A page is no longer drawn twice as it loads: its server elements hydrate in place, and every proxy on its way is told
to leave its HTML as it was sent.

## Page server

- **A page's HTML reaches the browser as it was sent.** A page hydrates over the server's HTML node for node, and a
  proxy that rewrote it on the way — Cloudflare's Email Address Obfuscation replacing an address in the copy and
  injecting its script — made React throw the server's page away and draw it again (`Minified React error #418`): every
  animation started twice, every font was asked for again, and the page flickered on each load. Every page now says
  `Cache-Control: no-transform`, HTTP's own word for it, which the proxies honour. It is still compressed by the server
  itself: `res.send(body, { ownEncoding: true })` is how a stage says `no-transform` to the proxies after it and not to
  this server, where the header otherwise stops compression too (as a response carrying a credential needs).

## SDK

- **A server element hydrates over the server's markup, instead of being frozen and built again.** An element with
  `runtime: 'server'` — a provider with a server query, above all — was drawn during hydration as a frozen copy of the
  server's HTML and swapped for itself on the render right after. The same nodes to the eye, but new ones: every CSS
  animation under a provider started twice on every load (17 of a home's 23), every card of a list it fed faded in
  twice, every image in it was decoded again. It is now drawn by the browser from the start, from the payload the
  server drew it with, and React hydrates it in place. Only an element the browser has no component for — a plugin
  registered on the server alone — stays frozen, for the life of the page. A container holding one no longer renders a
  second time once hydration is over.

## To do when you upgrade

- A proxy or CDN rule that overwrites `Cache-Control` on HTML must keep `no-transform`, or turn off whatever rewrites
  the markup (email obfuscation, HTML minification, script injection) for the site's hosts.
