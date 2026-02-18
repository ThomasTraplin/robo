# Midnight Hall: Nerf Siege

A browser-based 2D top-down survival-horror arcade prototype inspired by SNES-era visuals.

## Premise
You are a student trapped in a two-floor school during a single terrifying night. Cryptid monsters assault doors and windows from outside. Scavenge supplies, reinforce openings, coordinate with other students, and unlock the principal's office—where the final monster boss fight waits.

## Features
- Two-floor fixed school map with two staircases (one at each end).
- Tight flashlight-style fog of war.
- Multiple cryptid enemy types plus a Wendigo-style monster principal boss.
- Limited Nerf dart ammo and wood-based barricade reinforcement loop.
- Interactive pickups (toolkits, ammo, key items, and upgrades).
- NPC student allies you can command to reinforce nearby openings.
- Three difficulty levels: Story, Standard, Nightmare.
- No gore; player and students are knocked out when HP reaches zero.

## Controls
- `WASD`: Move
- `Mouse`: Aim
- `Click`: Shoot Nerf darts
- `E`: Interact / collect / reinforce / open office encounter
- `F`: Command nearby student helper
- `1` / `2`: Switch floors (while standing at staircases)

## Run
Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 4173
```
Then visit <http://localhost:4173>.
