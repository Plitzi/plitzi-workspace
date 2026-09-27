# Pizarra bench

2026-09-26 17:44 UTC · production build · Chromium chromium · 1400×900

Frames are the gaps between `requestAnimationFrame` callbacks while the scenario ran, in ms — 16.7 is 60 fps. A
_stutter_ is a frame over 50 ms. Script and task are main-thread time over the whole scenario.

A frame rate only says the machine kept up. What is left over is what slower hardware has to spare: _script per
frame_ is the script a drawn frame cost, and _busy_ the share of the scenario the main thread was working — the
lower both are, the further down in hardware it stays smooth.

| elements | scenario        | p50  | p95  | worst | stutters | script ms | script / frame | task ms | busy | heap MB |
| -------- | --------------- | ---- | ---- | ----- | -------- | --------- | -------------- | ------- | ---- | ------- |
| 1000     | open            | 16.7 | 16.8 | 166.7 | 1        | 244       | 1.56           | 379     | 12%  | 46.2    |
| 1000     | idle            | 16.7 | 16.8 | 33.4  | 0        | 2         | 0.02           | 15      | 1%   | 46.3    |
| 1000     | pan             | 16.7 | 16.8 | 16.8  | 0        | 200       | 1.65           | 465     | 23%  | 67.4    |
| 1000     | zoom            | 16.7 | 16.7 | 33.4  | 0        | 214       | 1.98           | 393     | 21%  | 58      |
| 1000     | draw 20 shapes  | 16.7 | 16.8 | 33.3  | 0        | 1030      | 4.84           | 1381    | 38%  | 48.8    |
| 1000     | select all      | 16.7 | 16.8 | 16.8  | 0        | 15        | 0.41           | 27      | 4%   | 60.8    |
| 1000     | move all        | 16.7 | 16.7 | 16.8  | 0        | 244       | 1.83           | 435     | 20%  | 82.5    |
| 1000     | undo move       | 16.7 | 16.7 | 16.8  | 0        | 26        | 0.36           | 58      | 5%   | 92.4    |
| 1000     | marquee all     | 16.7 | 16.7 | 16.8  | 0        | 517       | 4.38           | 850     | 43%  | 182.6   |
| 1000     | copy + paste    | 16.7 | 16.8 | 66.6  | 1        | 76        | 0.83           | 125     | 8%   | 207.7   |
| 1000     | delete all      | 16.7 | 16.8 | 33.2  | 0        | 42        | 0.58           | 76      | 6%   | 86.3    |
| 1000     | undo delete     | 16.7 | 16.8 | 50    | 0        | 48        | 0.53           | 84      | 5%   | 95.1    |
| 1000     | crowd 10: watch | 16.7 | 16.7 | 16.8  | 0        | 70        | 0.29           | 294     | 7%   | 76      |
| 1000     | crowd 10: pan   | 16.7 | 16.8 | 16.8  | 0        | 236       | 1.95           | 567     | 28%  | 62.3    |
| 1000     | crowd 50: watch | 16.7 | 16.8 | 16.8  | 0        | 151       | 0.63           | 506     | 13%  | 68      |
| 1000     | crowd 50: pan   | 16.7 | 16.7 | 16.8  | 0        | 253       | 2.04           | 595     | 29%  | 86.8    |
| 4000     | open            | 16.7 | 16.8 | 166.7 | 3        | 338       | 2.18           | 482     | 15%  | 70.5    |
| 4000     | idle            | 16.7 | 16.7 | 16.8  | 0        | 3         | 0.03           | 20      | 1%   | 70.5    |
| 4000     | pan             | 16.7 | 16.7 | 16.8  | 0        | 561       | 4.60           | 827     | 40%  | 80.8    |
| 4000     | zoom            | 16.7 | 16.8 | 50    | 0        | 217       | 2.05           | 418     | 23%  | 83.9    |
| 4000     | draw 20 shapes  | 16.7 | 16.8 | 33.3  | 0        | 1238      | 5.76           | 1591    | 44%  | 130.3   |
| 4000     | select all      | 16.7 | 16.8 | 16.8  | 0        | 13        | 0.35           | 29      | 5%   | 147.9   |
| 4000     | move all        | 16.7 | 16.7 | 49.9  | 0        | 778       | 5.52           | 1067    | 44%  | 232.4   |
| 4000     | undo move       | 16.7 | 16.8 | 33.4  | 0        | 117       | 1.58           | 203     | 16%  | 261.4   |
| 4000     | marquee all     | 16.7 | 33.4 | 116.6 | 1        | 763       | 5.37           | 1716    | 60%  | 208.6   |
| 4000     | delete all      | 16.7 | 16.7 | 33.3  | 0        | 56        | 0.77           | 145     | 12%  | 232.9   |
| 4000     | undo delete     | 16.7 | 16.8 | 116.6 | 1        | 163       | 1.77           | 261     | 16%  | 289.1   |
| 4000     | crowd 10: watch | 16.7 | 16.8 | 16.8  | 0        | 109       | 0.46           | 360     | 9%   | 104.3   |
| 4000     | crowd 10: pan   | 16.7 | 16.8 | 33.4  | 0        | 630       | 5.08           | 982     | 46%  | 103.4   |
| 4000     | crowd 50: watch | 16.7 | 16.8 | 16.8  | 0        | 158       | 0.66           | 496     | 12%  | 100.3   |
| 4000     | crowd 50: pan   | 16.7 | 16.7 | 33.5  | 0        | 635       | 5.04           | 1019    | 48%  | 100.8   |

## Crowds

Simulated collaborators on the board: every one moving its cursor twenty times a second, three of them adding a
note every two seconds. _Fan-out_ is from a note being sent to the last collaborator hearing it.

| elements | collaborators | fan-out p50 | fan-out p95 | commit p50 | commit p95 | refused |
| -------- | ------------- | ----------- | ----------- | ---------- | ---------- | ------- |
| 1000     | 10            | 36          | 70          | 36         | 70         | 0       |
| 1000     | 50            | 41          | 65          | 41         | 65         | 0       |
| 4000     | 10            | 75          | 115         | 75         | 115        | 0       |
| 4000     | 50            | 84          | 112         | 84         | 111        | 0       |

## What broke

Nothing: no page error, no refused change.
