---
'@plitzi/sdk-authoring': patch
---

The authoring skill and `ResponsiveCss` now say that breakpoints are ranges, not a cascade.

`tablet` compiles to `48rem–64rem` and `mobile` to below `48rem`, and each inherits only from `desktop`. The type
said "omitted breakpoints inherit", which reads as tablet flowing down to mobile — a layout that collapsed at tablet
came back as desktop columns on a phone, with nothing reporting it.
