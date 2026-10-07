# A space on Plitzi, as a project (`create --from`, `space pull`, `space push`)

`create --from <space>` (its permanent URL or id) writes a server project holding everything the space is made of, and
serving it with nothing of Plitzi's — neither its servers nor its CDN:

- its pages as authoring code in `src/space/` (`--source cloud` writes none: they stay on Plitzi, read with a key);
- its actions in `src/actions/` — each a `defineAction` call where the document reads back exactly, JSON where it does
  not (the report says why) — and its connectors as JSON;
- its functions in `src/functions/`, its runtime and plugins as the source they were built from, under `src/`;
- its data in `src/data/` (read by its server providers, never served);
- its files downloaded into `public/assets/`, every CDN address rewritten to the project's own;
- `.env` with a signing key made for it, and the names of the variables and credentials it needs — never their values.

It takes a signed-in CLI and a space the person may change (owner, admin or writer). It takes out the draft unless
`--environment production` (that environment's latest snapshot) or `--environment production --revision 3` (that one,
pinned) says otherwise. Read the report it prints: a
plugin or runtime uploaded before Plitzi kept sources comes across built only (`vendor/`), and a space with visitor
roles needs sign-in of its own (the report says how).

`space pull` brings the project up to date: what changed on the space alone is written, what changed here alone is kept,
and when one file changed on both it writes **nothing** and names them — keep your changes aside and pull again, or
`--force` to take the space's copy. It never touches `.env`, and only adds to `package.json`. What the project was given
is recorded in `.plitzi/space.json`: commit it. It follows the version the project was made from; `pull --environment
… --revision …` moves it to another, `--revision latest` lets go of a pin.

`space push` is the way back: what changed in the project, as the space's **draft** — publishing stays the builder's. At a
terminal it lists the parts with what changed ticked; otherwise it sends what changed, or the parts named:
`space push space functions` (`space`, `functions`, `data`, `runtime`, `plugins`, `files`). Plugins and the files of
`public/assets/` go up first (each file at the same path under the space's `assets/`), then the functions, the data, the
runtime, and the pages, actions and connectors last. Only `public/assets/` reaches the space's CDN: put a file the space
names there, never elsewhere in `public/`. It is refused when the draft was edited in the builder since the
project last had it — pull first, or `--force` to replace it — and a project that never had the space may only take a
space nobody has worked on without `--force`. It pushes to the space the CLI is connected to, which must be the one
the project came from, and records what it sent in `.plitzi/space.json`, so `space pull` works afterwards — on a project that
started on its own too.
