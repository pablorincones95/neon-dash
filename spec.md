# Neon Dash — Spec

## Overview
One-button arcade game. Player controls a glowing square that jumps to avoid obstacles. Easy to learn, hard to master.

## Controls
- **SPACE** / **UP arrow** / **Tap/click** — Jump
- Jump pushes the player upward; gravity pulls them down
- After death: press SPACE / tap to instantly restart (no need to wait)

## Core Mechanics
- Player is a cyan neon square on the left side of the screen
- Magenta neon pipes scroll from right to left with a gap to fly through
- Each pipe passed = +1 score
- Collision with pipe or floor = death
- Ceiling clamps the player (no death from top)
- 1.5s grace period at start before first pipe spawns

## Difficulty Curve
- Starts easy: pipes far apart (2.4s), gaps wide (220px), slow speed (3px/frame)
- Ramps gradually: speed, gap shrink, spawn rate all scale with score
- Caps: speed 8px/frame, gap 130px, spawn interval 850ms

## Juice & Feedback
- **Slow-mo on death**: brief 300ms time slowdown for dramatic effect
- **Screen shake**: intensity scales with events (death = heavy, score = light)
- **Flash overlay**: cyan flash on score, red flash on death
- **Score pop**: score number scales up 1.4x on each point, eases back
- **Combo system**: consecutive pipes without dying build combo (3x+, 5x+, etc.)
  - Combo text popup on 3x+
  - Combo resets on death or after 2s idle
- **Player rotation**: square tilts based on vertical velocity
- **Trail effect**: fading ghost trail behind the player
- **Particles**: jump puff, score burst, death explosion (3 waves of color)
- **Title glow**: animated pulsing glow on start screen
- **Score pulse**: game over score animates in with bounce

## Sound (Web Audio)
- Jump: short square wave blip (slight pitch randomization)
- Score: triple ascending sine tones
- Combo: high chime
- Death: low sawtooth buzz (two-stage)
- Toggle button in top-right corner

## UI Screens
1. **Start** — Animated title, instructions, START button
2. **HUD** — Score center (with scale animation), sound toggle right
3. **Game Over** — Animated title, final score (bounce in), best score, RETRY button, "or press SPACE / tap to restart" hint

## Persistence
- Best score saved to `localStorage` (key: `neonDashBest`)
- Persists across sessions

## Files
- `index.html` — Structure and UI
- `style.css` — Neon dark theme with animations
- `game.js` — All game logic, rendering, audio
- `package.json` — Dev server config
- `spec.md` — This file

## Run
```bash
pnpm install && pnpm dev
# Open http://localhost:3000
```
