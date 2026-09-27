# Pizarra bench

2026-09-26 17:46 UTC · production build · Chromium chromium · 1400×900 · CPU throttled ×4

Frames are the gaps between `requestAnimationFrame` callbacks while the scenario ran, in ms — 16.7 is 60 fps. A
_stutter_ is a frame over 50 ms. Script and task are main-thread time over the whole scenario.

A frame rate only says the machine kept up. What is left over is what slower hardware has to spare: _script per
frame_ is the script a drawn frame cost, and _busy_ the share of the scenario the main thread was working — the
lower both are, the further down in hardware it stays smooth.

| elements | scenario        | p50  | p95   | worst | stutters | script ms | script / frame | task ms | busy | heap MB |
| -------- | --------------- | ---- | ----- | ----- | -------- | --------- | -------------- | ------- | ---- | ------- |
| 1000     | open            | 16.7 | 16.8  | 666.6 | 5        | 1054      | 6.71           | 1556    | 37%  | 46      |
| 1000     | idle            | 16.7 | 16.7  | 16.8  | 0        | 3         | 0.03           | 17      | 1%   | 46.1    |
| 1000     | pan             | 16.7 | 16.8  | 16.8  | 0        | 733       | 5.13           | 1720    | 71%  | 67.4    |
| 1000     | zoom            | 16.7 | 100   | 133.4 | 12       | 994       | 9.84           | 1498    | 54%  | 93.4    |
| 1000     | draw 20 shapes  | 16.7 | 149.9 | 233.3 | 36       | 4722      | 20.35          | 6095    | 79%  | 196.5   |
| 1000     | select all      | 16.7 | 16.8  | 66.7  | 1        | 60        | 1.62           | 96      | 14%  | 208     |
| 1000     | move all        | 16.7 | 16.8  | 150   | 3        | 1153      | 6.41           | 1888    | 56%  | 60.1    |
| 1000     | undo move       | 16.7 | 16.8  | 133.4 | 1        | 135       | 1.88           | 251     | 18%  | 65.7    |
| 1000     | marquee all     | 16.7 | 100   | 116.7 | 35       | 2807      | 18.97          | 4273    | 80%  | 163.6   |
| 1000     | copy + paste    | 16.7 | 16.8  | 250.1 | 3        | 290       | 3.49           | 460     | 26%  | 170.8   |
| 1000     | delete all      | 16.7 | 16.8  | 166.6 | 2        | 150       | 2.31           | 260     | 20%  | 192.9   |
| 1000     | undo delete     | 16.7 | 16.8  | 200   | 1        | 183       | 2.06           | 333     | 19%  | 60.1    |
| 1000     | crowd 10: watch | 16.7 | 16.7  | 16.8  | 0        | 166       | 0.69           | 816     | 20%  | 63.6    |
| 1000     | crowd 10: pan   | 16.7 | 16.8  | 50.1  | 1        | 797       | 5.78           | 1890    | 79%  | 77.5    |
| 1000     | crowd 50: watch | 16.7 | 16.8  | 16.8  | 0        | 387       | 1.62           | 1505    | 38%  | 62.7    |
| 1000     | crowd 50: pan   | 16.7 | 16.8  | 66.6  | 2        | 1093      | 5.58           | 2674    | 78%  | 71.2    |
| 4000     | open            | 16.7 | 16.8  | 783.3 | 5        | 1412      | 8.77           | 1969    | 42%  | 64.7    |
| 4000     | idle            | 16.7 | 16.7  | 16.8  | 0        | 2         | 0.02           | 10      | 1%   | 64.7    |
| 4000     | pan             | 16.7 | 16.8  | 33.4  | 0        | 2236      | 8.84           | 3547    | 82%  | 69.8    |
| 4000     | zoom            | 16.7 | 83.4  | 250   | 9        | 929       | 9.29           | 1545    | 55%  | 63.7    |
| 4000     | draw 20 shapes  | 16.7 | 133.3 | 250   | 40       | 5764      | 23.72          | 7198    | 83%  | 144.8   |
| 4000     | select all      | 16.7 | 16.8  | 100   | 1        | 63        | 1.70           | 131     | 18%  | 162.3   |
| 4000     | move all        | 16.7 | 83.4  | 216.7 | 22       | 3502      | 22.16          | 4635    | 83%  | 254     |
| 4000     | undo move       | 33.3 | 216.7 | 633.4 | 10       | 461       | 21.95          | 1431    | 100% | 72.7    |
| 4000     | marquee all     | 16.7 | 183.3 | 216.7 | 40       | 3216      | 22.49          | 6677    | 88%  | 285.1   |
| 4000     | delete all      | 16.7 | 66.7  | 183.3 | 4        | 275       | 5.85           | 628     | 47%  | 68.5    |
| 4000     | undo delete     | 16.7 | 66.6  | 433.3 | 8        | 567       | 8.22           | 914     | 47%  | 107.8   |
| 4000     | crowd 10: watch | 16.7 | 16.7  | 33.4  | 0        | 303       | 1.28           | 943     | 24%  | 104.6   |
| 4000     | crowd 10: pan   | 16.7 | 33.3  | 183.3 | 4        | 2855      | 10.50          | 4649    | 87%  | 120.9   |
| 4000     | crowd 50: watch | 16.7 | 16.8  | 49.9  | 0        | 516       | 2.21           | 1611    | 40%  | 132.9   |
| 4000     | crowd 50: pan   | 16.7 | 33.4  | 199.9 | 6        | 3499      | 10.26          | 6101    | 86%  | 119.8   |

## Crowds

Simulated collaborators on the board: every one moving its cursor twenty times a second, three of them adding a
note every two seconds. _Fan-out_ is from a note being sent to the last collaborator hearing it.

| elements | collaborators | fan-out p50 | fan-out p95 | commit p50 | commit p95 | refused |
| -------- | ------------- | ----------- | ----------- | ---------- | ---------- | ------- |
| 1000     | 10            | 34          | 60          | 34         | 60         | 0       |
| 1000     | 50            | 34          | 66          | 34         | 66         | 0       |
| 4000     | 10            | 56          | 87          | 56         | 87         | 0       |
| 4000     | 50            | 59          | 112         | 59         | 112        | 0       |

## What broke

Nothing: no page error, no refused change.
