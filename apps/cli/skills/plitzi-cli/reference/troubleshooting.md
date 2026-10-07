# When something does not work

| What you see | What it is |
| --- | --- |
| `create` printed questions and wrote nothing | nobody answered the three choices — ask the user, pass them as flags |
| `start` says the port is in use | `PORT` is set to a taken port — unset it to take the next free one, or choose another |
| A page that is not this project's, or `shot` refuses the port | another server answers there — `curl 127.0.0.1:<port>/health` names it; `tmp/dev-server.json` has this project's port |
| "Custom Component … Not Found", or a flow on a plugin's event never runs | `doctor` names the folder whose type or declaration is off |
| "not laid out as Plitzi reads it" | each misplaced part, with its fix; `doctor --fix` |
| `upload` opens a browser | there is no session, or no space chosen — the person completes it there |
| The upload went to the wrong space | `plitzi space` chooses another; check `whoami` first |
| `pull` wrote nothing and named files | they changed here and on the space — set your changes aside and pull again, or `--force` |
