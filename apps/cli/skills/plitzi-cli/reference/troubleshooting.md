# When something does not work

| What you see | What it is |
| --- | --- |
| `create` printed questions and wrote nothing | nobody answered the three choices — ask the user, pass them as flags |
| `start` says the port is in use | `PORT` is set to a taken port — unset it to take the next free one, or choose another |
| A page that is not this project's, or `page shot` refuses the port | another server answers there — `curl 127.0.0.1:<port>/health` names it; `tmp/dev-server.json` has this project's port |
| "Custom Component … Not Found", or a flow on a plugin's event never runs | `doctor` names the folder whose type or declaration is off |
| "not laid out as Plitzi reads it" | each misplaced part, with its fix; `doctor --fix` |
| `ERR_MODULE_NOT_FOUND` into `node_modules/@plitzi/<package>/dist/…` | an import of a path the package does not export — a FILE (`…/helpers/isRecord`); a package is imported by its root and its folders. `doctor` names each one (`import-not-exported`), `upgrade migrations --write` rewrites it |
| A page command finds no element you just added, and says "the last save to the space did not author" | the page is the space as it last authored — `npm run author` says why the save did not |
| A page for signed-in visitors read as a guest | `.env` names no account (`PLITZI_CHECK_USER`, `PLITZI_CHECK_PASSWORD`): `doctor` says which is missing |
| `upload` opens a browser | there is no session, or no space chosen — the person completes it there |
| The upload went to the wrong space | `plitzi space use` chooses another; check `whoami` first |
| `space pull` wrote nothing and named files | they changed here and on the space — set your changes aside and pull again, or `--force` |
