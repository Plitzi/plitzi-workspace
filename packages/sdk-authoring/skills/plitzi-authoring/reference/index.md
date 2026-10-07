# Every reference, and when to read it

Read one only when the task names its subject.

| Read | When |
| --- | --- |
| [rules.md](rules.md) | Every rule of writing a space, with its why |
| [recipes.md](recipes.md) | A whole working file for a common task, to copy and rename |
| [elements-and-styles.md](elements-and-styles.md) | Any element or CSS: factories, fields, classes, states, variants, tokens, fonts, lists, links |
| [colours-and-motion.md](colours-and-motion.md) | Colours for both themes, tokens, keyframes, and motion that stays smooth (good practices) |
| [tailwind.md](tailwind.md) | A design written in Tailwind classes: `tw()`, its breakpoints and states, what it refuses |
| [layouts.md](layouts.md) | Anything shown on more than one page; menus; reducing duplication of elements and styles |
| [efficiency.md](efficiency.md) | The same page with fewer elements: the suggestions `authorSpace` makes, and the short way for each long one |
| [components.md](components.md) | One block placed many times — a card, a tier, a testimonial: props, slots, binding a row into one, why it is closed |
| [data-and-visibility.md](data-and-visibility.md) | Bindings, providers, offline data, loading/empty/error states, live data, caching, showing and hiding, kept state |
| [kept-state.md](kept-state.md) | State that outlives a reload: `keepState`, transient and painted keys |
| [auth.md](auth.md) | Signing people in: providers, `authLogin`, `auth.*`, visitor roles |
| [feature-flags.md](feature-flags.md) | Switching a part of the space on or off — a beta, a rollout, the old version kept until the new one ships |
| [lists.md](lists.md) | Rendering rows, filtering and sorting them, a detail page for one record, carousels |
| [typed-sources.md](typed-sources.md) | Data typed by a sample of it: `source()`, typed rows, `twig` for templates |
| [validation.md](validation.md) | How `authorSpace` checks, the loop that wastes no attempts, and what it cannot see |
| [authoring-errors.md](authoring-errors.md) | What `authorSpace` refuses or warns about, and what to write instead |
| [templates.md](templates.md) | Any `{{ … }}` or `{% … %}`: where it runs, naming sources, filters, tests, dates |
| [flows.md](flows.md) | Clicks, submits, page loads, every few seconds, server actions, modals, state |
| [realtime.md](realtime.md) | Pages that see each other: channels, presence, cursors, a shared board, who may hear a topic |
| [plugins.md](plugins.md) | A component of your own: props, binding them, writing state, channels, registering, behaving in the builder |
| [drawing.md](drawing.md) | A plugin that draws or animates: a canvas sized to the device, WebGL, a loop that stops when unseen |
| [structure.md](structure.md) | A space bigger than one screen: files, helpers, naming, keeping it short |
| [testing.md](testing.md) | Any test: `inspectPage`, handles, fixtures, catching a flash from the first frame, shortcuts, counting renders |
| [performance.md](performance.md) | A page with many elements, a busy flow, something that feels slow: what renders, what it costs, how to measure it |
| [snippets-and-export.md](snippets-and-export.md) | Publishing a snippet; turning an exported JSON — or a server action — into code |
| [accessibility.md](accessibility.md) | Icon buttons, fields, images, clickable cards, toggles, headings, landmarks, a canvas — anything a screen reader or a browser agent has to use |
| [review-checklist.md](review-checklist.md) | Before you say it is done |
