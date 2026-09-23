---
'@plitzi/sdk-style': patch
---

**A value with functions inside functions is written as it was given, and fast.** A CSS value was split into layers
at commas by a pattern that could only see one level of parentheses, so `var(--bg, light-dark(#fff, #111))` was cut at
its inner comma and half a function went on into the stylesheet. The half was then tokenised by an expression that
nested one quantifier inside another and backtracked exponentially on it — nearly two seconds for thirty characters,
on every generation of that selector's cache. Both are now one linear scan that splits only outside parentheses and
quotes. Generated caches keep the spacing the value was written with inside functions (`repeat(3, minmax(0, 1fr))`,
`color-mix(in oklab, oklch(…) 50%, transparent)`), where they used to drop it after the first comma.
