# Ceniza — a restaurant, the whole website

The site of Ceniza, a (fictional) fire-and-season restaurant in Madrid: ten pages in Spanish, a light and a dark
theme, live table availability, real bookings with a confirmation email, a newsletter, opening hours that know
whether the kitchen is open right now, and a journal.

```bash
yarn workspace @plitzi/example-ceniza start
# http://127.0.0.1:4015/
```

No account, no database, no API key — and no code of its own on the server. Every server action is a document built
from the tasks `sdk-server` ships, which is what lets the same space run here and, seeded, on a hosted Plitzi.

---

## What this example is for

The blog is about **pages and people**, the seismic monitor about **one live screen**. This one is a **business
website**, the kind most spaces are: a lot of content, a design system, and a handful of things that have to work on
the server — without writing server code to get them.

| Route                  | Page                                                                                |
| ---------------------- | ----------------------------------------------------------------------------------- |
| `/`                    | Hero, the season's produce, signature dishes, tasting menu, reviews, journal, hours |
| `/carta`               | The menu, with vegetarian and gluten-free filters                                   |
| `/degustacion`         | The nine-course tasting menu                                                        |
| `/vinos`               | The wine list and the sommelier                                                     |
| `/nosotros`            | The story, the team, a timeline and the producers                                   |
| `/eventos`             | Private rooms, how an event works, FAQs                                             |
| `/regalar`             | Gift cards                                                                          |
| `/reservas`            | Live availability, the booking form, hours and FAQs                                 |
| `/diario`, `/diario/*` | The journal, and every article from one page                                        |

| File                                 | What it is                                                               |
| ------------------------------------ | ------------------------------------------------------------------------ |
| [`src/space.ts`](./src/space.ts)     | The space: pages, theme, and `rsc` switched on for the server providers  |
| [`src/theme.ts`](./src/theme.ts)     | The design system as data: palette in two schemes, classes, `customCss`  |
| [`src/content.ts`](./src/content.ts) | Every word and photo, apart from the code that lays them out             |
| [`src/layout.ts`](./src/layout.ts)   | The header, the phone menu, the footer, and the pieces every page shares |
| [`src/pages/`](./src/pages)          | One file per page                                                        |
| [`src/actions/`](./src/actions)      | The five server actions, and the rules their templates are printed from  |
| [`src/main.ts`](./src/main.ts)       | The server: the space, the actions, and where the email goes             |

---

## Five actions, no tasks

| Action                     | Trigger  | What it does                                                                     |
| -------------------------- | -------- | -------------------------------------------------------------------------------- |
| `consultar-disponibilidad` | `call`   | Which times are free on a day for a party size — asked on every change of either |
| `reservar-mesa`            | `call`   | Checks a booking, takes the seats, keeps it and sends the confirmation           |
| `suscribir-newsletter`     | `call`   | Adds an address once, and welcomes it                                            |
| `leer-diario`              | `render` | The journal's cards, and the article the route names                             |
| `consultar-horario`        | `render` | The week's hours, and whether the kitchen is open now                            |

Every step is a task every Plitzi server has: `kv` to count and keep, `transform.template` and `transform.json` to
decide, `email.send` to confirm. What makes them this restaurant's is [`src/actions/rules.ts`](./src/actions/rules.ts):
the hours, the booking times and every sentence are authored in TypeScript and **printed into the templates as
literals**, so a document carries its own tables and needs nothing else from the server that runs it.

Three things are worth reading closely:

- **The seats are counted inside the write.** `kv.increment` adds the party to that time's counter and answers the
  new total in one step. Over 24, the flow gives the seats straight back. Two people choosing the last table at the
  same moment both saw it free; only one total fits, and nothing ever reads a count and then writes it.
- **The restaurant's clock, not the server's.** A run carries `now`, and `{{ now|date('Y-m-d', 'Europe/Madrid') }}`
  reads it where the restaurant is. A date a visitor picked is a calendar date, read with `'UTC'`.
- **Nothing a visitor typed is printed into JSON.** Every template writes JSON, and prints only literals and values
  derived from checked input: a date that parsed back to itself, a time found among the booking times.

A refusal is an answer, not an error: `{ ok: false, message }`, in the restaurant's words, shown by the page.

---

## Configured in `main.ts`

```ts
createServer({ action: { lookups, email, onRun: createRunLogger(consoleLogger) } });
```

- **`email`** is where the confirmation and the welcome go. Here it writes each message to the process log, so the
  flows run end to end without anybody's inbox; a real deployment swaps this one object for its provider.
- **`kv`** is left to its in-process default, which is right for one process. A cluster passes a shared store, or
  two replicas each count their own seats.

---

## Two things that bite

- **`rsc: { enabled: true }`** on the space. Without it every `runtime: 'server'` provider resolves to nothing, and
  nothing says so.
- **Give an `apiContainer` a `subType`.** Left at its default it renders no element of its own on a published page:
  its class styles nothing and its id finds nothing.

## Next

The mechanisms are in [`docs/en/server-actions.md`](../../../docs/en/server-actions.md) and
[`docs/en/authoring-spaces.md`](../../../docs/en/authoring-spaces.md).
