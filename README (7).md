# AstroTrap 🚀

**Rogue Asteroid Harvesting System** — A space-themed remake of the classic JezzBall / Qix-style game.

## Gameplay

You control a deep-space mining vessel. Rogue asteroids bounce around the play field. Your mission: **trap them by drawing containment force fields** until you've harvested ≥75% of the sector.

- **Left-click** — Deploy a **vertical** containment beam
- **Right-click** — Deploy a **horizontal** containment beam
- If an asteroid hits your beam while it's building → beam fails, you lose a life
- Enclose an area without asteroids → it becomes a **harvested mining sector**
- Capture 75% of each sector to advance to the next

### Keyboard Controls
| Key | Action |
|-----|--------|
| `V` | Switch to vertical beam |
| `H` | Switch to horizontal beam |
| `P` / `Esc` | Pause / Resume |
| `M` | Toggle sound |

## How to Run

### Locally
Just open `index.html` in any modern browser. No build step needed.

```bash
# Optional: serve with Python for proper MIME types
python3 -m http.server 8080
# Then visit http://localhost:8080
```

### GitHub Pages
1. Fork/clone this repo
2. Push to GitHub
3. Go to **Settings → Pages → Source: main branch / root**
4. Visit `https://yourusername.github.io/astro-trap/`

## Reskinning Guide

### CSS Variables (in `css/style.css`)
```css
:root {
  --accent-cyan:    #00e5ff;   /* wall/force field color */
  --asteroid-color: #b0bec5;   /* base asteroid color */
  --wall-glow:      #00e5ff;   /* beam glow color */
  --field-color:    rgba(0, 229, 255, 0.08);  /* captured sector fill */
}
```

### Game Constants (in `js/game.js`)
```js
const C = {
  REQUIRED_PERCENT:    75,   // % needed to complete a level
  BASE_LIVES:           3,   // starting lives
  ASTEROID_BASE_SPEED:  2.2, // asteroid speed (px/frame)
  WALL_BUILD_SPEED:     3.5, // beam build speed (px/frame)
};
```

### Theme Ideas
| Theme | Asteroids → | Walls → | Captured → |
|-------|-------------|---------|------------|
| Underwater | Fish | Nets | Fishing grounds |
| Fantasy | Dragons | Magic barriers | Kingdom zones |
| Virus | Pathogens | Antibodies | Sterilized zones |
| Retro Qix | Sparks | Lines | Colored fills |

Change colors in CSS variables and swap the `drawAsteroid()` function in `renderer.js` to use sprites or different shapes.

## File Structure
```
/astro-trap/
├── index.html          Main HTML
├── css/
│   └── style.css       All styles + CSS variables
├── js/
│   ├── audio.js        Web Audio sound effects
│   ├── renderer.js     Canvas drawing (asteroids, walls, effects)
│   ├── game.js         Core game logic + physics
│   └── main.js         UI, input, game loop
└── README.md
```

## Credits
Inspired by JezzBall (Microsoft, 1992) and Qix (Taito, 1981).
