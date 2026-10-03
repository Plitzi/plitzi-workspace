# A space on Plitzi, as a project (`create --from`, `pull`)

`create --from <space>` (its permanent URL or id) writes a server project holding everything the space is made of, and
serving it with nothing of Plitzi's — neither its servers nor its CDN:

- its pages as authoring code in `src/space/` (`--source cloud` writes none: they stay on Plitzi, read with a key);
- its actions in `src/actions/` — each a `defineAction` call where the document reads back exactly, JSON where it does
  not (the report says why) — and its connectors as JSON;
- its functions in `functions/`, its runtime and plugins as the source they were built from, under `src/`;
- its files downloaded into `public/`, every CDN address rewritten to the project's own;
- `.env` with a signing key made for it, and the names of the variables and credentials it needs — never their values.

It takes a signed-in CLI and a space the person may change (owner, admin or writer). It takes out the draft unless
`--environment production` (that environment's latest snapshot) or `--environment production --revision 3` (that one,
pinned) says otherwise. Read the report it prints: a
plugin or runtime uploaded before Plitzi kept sources comes across built only (`vendor/`), and a space with visitor
roles needs sign-in of its own (the note in `src/main.ts`).

`pull` brings the project up to date: what changed on the space alone is written, what changed here alone is kept,
and when one file changed on both it writes **nothing** and names them — keep your changes aside and pull again, or
`--force` to take the space's copy. It never touches `.env`, and only adds to `package.json`. What the project was given
is recorded in `.plitzi/space.json`: commit it. It follows the version the project was made from; `pull --environment
… --revision …` moves it to another, `--revision latest` lets go of a pin.
