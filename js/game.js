// ===== game.js — Core game logic and state =====

// =================== CONSTANTS ===================
const C = {
  REQUIRED_PERCENT:   75,     // % to capture per level
  BASE_LIVES:         3,      // starting lives
  ASTEROID_BASE_SPEED: 2.2,   // pixels per frame
  ASTEROID_SPEED_INC:  0.18,  // speed added per level
  WALL_BUILD_SPEED:    3.5,   // pixels per frame
  FLASH_DURATION:      18,    // frames of fail flash
  ASTEROID_RADIUS:     14,    // default asteroid radius
  TRAIL_LEN:           12,    // trail point history
  MAX_LEVEL:           20,
  SCORE_PER_PERCENT:   10,
  SCORE_LEVEL_BONUS:   500,
};

const Game = (() => {
  // ---- State object ----
  let state = {};

  function createAsteroid(W, H, level, speedMult = 1) {
    const speed = (C.ASTEROID_BASE_SPEED + (level - 1) * C.ASTEROID_SPEED_INC) * speedMult;
    const r = C.ASTEROID_RADIUS - Math.min(level * 0.3, 5);
    // Random start not too close to walls
    const margin = r + 30;
    let x = margin + Math.random() * (W - margin * 2);
    let y = margin + Math.random() * (H - margin * 2);
    // 45-degree movement
    const dirs = [-1, 1];
    const vx = dirs[Math.floor(Math.random() * 2)] * speed;
    const vy = dirs[Math.floor(Math.random() * 2)] * speed;

    // Random craters
    const numCraters = Math.floor(Math.random() * 3) + 1;
    const craters = [];
    for (let i = 0; i < numCraters; i++) {
      const cr = r * (0.15 + Math.random() * 0.15);
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * (r - cr) * 0.7;
      craters.push({ x: Math.cos(angle) * dist, y: Math.sin(angle) * dist, r: cr });
    }

    return {
      x, y, vx, vy, r,
      rot: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() * 0.02 + 0.005) * (Math.random() < 0.5 ? 1 : -1),
      phase: Math.random() * Math.PI * 2,
      glowColor: `hsl(${Math.floor(Math.random() * 60 + 170)}, 50%, 65%)`,
      trail: [],
      craters,
    };
  }

  function initLevel(level, W, H) {
    const numAsteroids = Math.min(1 + level, 12);
    const asteroids = [];
    for (let i = 0; i < numAsteroids; i++) {
      asteroids.push(createAsteroid(W, H, level));
    }

    return {
      W, H,
      level,
      asteroids,
      captured: [],          // array of {x1, y1, x2, y2} captured rects
      capturedArea: 0,       // pixels captured
      totalArea: W * H,
      wall: null,            // active wall being built
      lives: Math.max(C.BASE_LIVES, Math.floor(numAsteroids / 2)),
      score: state.score || 0,
      orientation: 'vertical', // 'vertical' or 'horizontal'
      paused: false,
      gameOver: false,
      levelComplete: false,
      flashTimer: 0,
      successFlash: 0,
      FLASH_DURATION: C.FLASH_DURATION,
    };
  }

  function startLevel(level, W, H) {
    state = initLevel(level, W, H);
  }

  function getState() { return state; }

  // ---- Collision helpers ----
  function circleHitsWallSegment(ax, ay, ar, wx1, wy1, wx2, wy2, thickness = 2) {
    // Find closest point on segment to circle center
    const dx = wx2 - wx1, dy = wy2 - wy1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) {
      const dist = Math.hypot(ax - wx1, ay - wy1);
      return dist < ar + thickness;
    }
    let t = ((ax - wx1) * dx + (ay - wy1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const cx = wx1 + t * dx;
    const cy = wy1 + t * dy;
    const dist = Math.hypot(ax - cx, ay - cy);
    return dist < ar + thickness;
  }

  function resolveWallSegmentCollision(a, wx1, wy1, wx2, wy2) {
    // Bounce off vertical or horizontal wall segment
    const isVert = Math.abs(wx2 - wx1) < 1;
    if (isVert) {
      a.vx = -a.vx;
      a.x = wx1 + (a.vx > 0 ? a.r + 1 : -(a.r + 1));
    } else {
      a.vy = -a.vy;
      a.y = wy1 + (a.vy > 0 ? a.r + 1 : -(a.r + 1));
    }
  }

  // ---- Boundary walls (captured rects as walls) ----
  function getWallSegments() {
    const { W, H, captured } = state;
    const segs = [
      { x1: 0, y1: 0, x2: W, y2: 0 },
      { x1: W, y1: 0, x2: W, y2: H },
      { x1: 0, y1: H, x2: W, y2: H },
      { x1: 0, y1: 0, x2: 0, y2: H },
    ];
    // Add 4 edges of each captured rectangle as wall segments
    captured.forEach(r => {
      segs.push({ x1: r.x1, y1: r.y1, x2: r.x2, y2: r.y1 }); // top
      segs.push({ x1: r.x1, y1: r.y2, x2: r.x2, y2: r.y2 }); // bottom
      segs.push({ x1: r.x1, y1: r.y1, x2: r.x1, y2: r.y2 }); // left
      segs.push({ x1: r.x2, y1: r.y1, x2: r.x2, y2: r.y2 }); // right
    });
    return segs;
  }

  // Returns true if point is inside any captured rect
  function isInCaptured(x, y) {
    return state.captured.some(r => x >= r.x1 && x <= r.x2 && y >= r.y1 && y <= r.y2);
  }

  // ---- Update asteroids ----
  function updateAsteroids() {
    const { W, H, asteroids } = state;
    const wallSegs = getWallSegments();

    asteroids.forEach(a => {
      // Record trail
      a.trail.push({ x: a.x, y: a.y });
      if (a.trail.length > C.TRAIL_LEN) a.trail.shift();

      a.x += a.vx;
      a.y += a.vy;
      a.rot += a.rotSpeed;

      // Bounce off outer bounds
      if (a.x - a.r < 0)   { a.x = a.r;     a.vx = Math.abs(a.vx); Audio.bounce(); }
      if (a.x + a.r > W)   { a.x = W - a.r; a.vx = -Math.abs(a.vx); Audio.bounce(); }
      if (a.y - a.r < 0)   { a.y = a.r;     a.vy = Math.abs(a.vy); Audio.bounce(); }
      if (a.y + a.r > H)   { a.y = H - a.r; a.vy = -Math.abs(a.vy); Audio.bounce(); }

      // Bounce off captured rect walls
      for (const seg of wallSegs) {
        if (seg.x1 === 0 && seg.y1 === 0 && seg.x2 === W) continue; // already handled above
        if (seg.x1 === W && seg.y1 === 0) continue;
        if (seg.y1 === H) continue;
        if (seg.x1 === 0 && seg.y2 === H) continue;

        if (circleHitsWallSegment(a.x, a.y, a.r, seg.x1, seg.y1, seg.x2, seg.y2)) {
          resolveWallSegmentCollision(a, seg.x1, seg.y1, seg.x2, seg.y2);
        }
      }

      // Push asteroids out of captured rects (shouldn't be in them normally)
      state.captured.forEach(r => {
        if (a.x + a.r > r.x1 && a.x - a.r < r.x2 && a.y + a.r > r.y1 && a.y - a.r < r.y2) {
          // Find nearest exit direction
          const overlapL = (a.x + a.r) - r.x1;
          const overlapR = r.x2 - (a.x - a.r);
          const overlapT = (a.y + a.r) - r.y1;
          const overlapB = r.y2 - (a.y - a.r);
          const minOverlap = Math.min(overlapL, overlapR, overlapT, overlapB);
          if (minOverlap === overlapL) { a.x = r.x1 - a.r; a.vx = -Math.abs(a.vx); }
          else if (minOverlap === overlapR) { a.x = r.x2 + a.r; a.vx = Math.abs(a.vx); }
          else if (minOverlap === overlapT) { a.y = r.y1 - a.r; a.vy = -Math.abs(a.vy); }
          else { a.y = r.y2 + a.r; a.vy = Math.abs(a.vy); }
        }
      });
    });
  }

  // ---- Start building wall ----
  function startWall(x, y, orientation) {
    if (state.wall || state.paused || state.levelComplete) return false;
    // Don't start inside captured area
    if (isInCaptured(x, y)) return false;
    // Don't start too close to boundary walls
    const margin = 2;
    if (x < margin || x > state.W - margin || y < margin || y > state.H - margin) return false;

    const wall = {
      orientation,
      cx: x, cy: y,   // click origin
      x, y,            // aliases
    };

    if (orientation === 'vertical') {
      wall.topY = y;
      wall.bottomY = y;
      wall.topDone = false;
      wall.bottomDone = false;
    } else {
      wall.leftX = x;
      wall.rightX = x;
      wall.leftDone = false;
      wall.rightDone = false;
    }

    state.wall = wall;
    Audio.wallStart();
    return true;
  }

  // ---- Update active wall ----
  function updateWall() {
    const { wall, asteroids, W, H } = state;
    if (!wall) return;

    const speed = C.WALL_BUILD_SPEED;

    if (wall.orientation === 'vertical') {
      if (!wall.topDone)    wall.topY    -= speed;
      if (!wall.bottomDone) wall.bottomY += speed;

      // Check boundaries / captured rects
      if (wall.topY <= 0 || hitsCapturedBoundary(wall.x, wall.topY, 'top')) {
        wall.topY = hitsCapturedBoundary(wall.x, wall.topY, 'top')
          ? capturedBoundaryY(wall.x, wall.topY, 'top') : 0;
        wall.topDone = true;
      }
      if (wall.bottomY >= H || hitsCapturedBoundary(wall.x, wall.bottomY, 'bottom')) {
        wall.bottomY = hitsCapturedBoundary(wall.x, wall.bottomY, 'bottom')
          ? capturedBoundaryY(wall.x, wall.bottomY, 'bottom') : H;
        wall.bottomDone = true;
      }
    } else {
      if (!wall.leftDone)  wall.leftX  -= speed;
      if (!wall.rightDone) wall.rightX += speed;

      if (wall.leftX <= 0 || hitsCapturedBoundaryX(wall.leftX, wall.y, 'left')) {
        wall.leftX = hitsCapturedBoundaryX(wall.leftX, wall.y, 'left')
          ? capturedBoundaryX(wall.leftX, wall.y, 'left') : 0;
        wall.leftDone = true;
      }
      if (wall.rightX >= W || hitsCapturedBoundaryX(wall.rightX, wall.y, 'right')) {
        wall.rightX = hitsCapturedBoundaryX(wall.rightX, wall.y, 'right')
          ? capturedBoundaryX(wall.rightX, wall.y, 'right') : W;
        wall.rightDone = true;
      }
    }

    // Check asteroids hitting building wall
    const hitByAsteroid = checkWallAsteroidCollision();
    if (hitByAsteroid) {
      wallFail(hitByAsteroid.x, hitByAsteroid.y);
      return;
    }

    // Check if wall is complete
    const complete = wall.orientation === 'vertical'
      ? wall.topDone && wall.bottomDone
      : wall.leftDone && wall.rightDone;

    if (complete) {
      wallComplete();
    }
  }

  // Helper: does wall segment at position hit a captured boundary?
  function hitsCapturedBoundary(wx, wy, dir) {
    for (const r of state.captured) {
      if (wx > r.x1 && wx < r.x2) {
        if (dir === 'top'    && wy <= r.y2 && wy >= r.y1) return r;
        if (dir === 'bottom' && wy >= r.y1 && wy <= r.y2) return r;
      }
    }
    return null;
  }
  function capturedBoundaryY(wx, wy, dir) {
    for (const r of state.captured) {
      if (wx > r.x1 && wx < r.x2) {
        if (dir === 'top'    && wy <= r.y2 && wy >= r.y1) return r.y2;
        if (dir === 'bottom' && wy >= r.y1 && wy <= r.y2) return r.y1;
      }
    }
    return dir === 'top' ? 0 : state.H;
  }
  function hitsCapturedBoundaryX(wx, wy, dir) {
    for (const r of state.captured) {
      if (wy > r.y1 && wy < r.y2) {
        if (dir === 'left'  && wx <= r.x2 && wx >= r.x1) return r;
        if (dir === 'right' && wx >= r.x1 && wx <= r.x2) return r;
      }
    }
    return null;
  }
  function capturedBoundaryX(wx, wy, dir) {
    for (const r of state.captured) {
      if (wy > r.y1 && wy < r.y2) {
        if (dir === 'left'  && wx <= r.x2 && wx >= r.x1) return r.x2;
        if (dir === 'right' && wx >= r.x1 && wx <= r.x2) return r.x1;
      }
    }
    return dir === 'left' ? 0 : state.W;
  }

  // Check if any asteroid is touching the active wall segments
  function checkWallAsteroidCollision() {
    const { wall, asteroids } = state;
    if (!wall) return null;

    for (const a of asteroids) {
      let hit = false;
      if (wall.orientation === 'vertical') {
        // Top segment: x=wall.x, y from cy down to topY
        if (circleHitsWallSegment(a.x, a.y, a.r, wall.x, wall.cy, wall.x, wall.topY, 2)) hit = true;
        // Bottom segment: x=wall.x, y from cy to bottomY
        if (circleHitsWallSegment(a.x, a.y, a.r, wall.x, wall.cy, wall.x, wall.bottomY, 2)) hit = true;
      } else {
        if (circleHitsWallSegment(a.x, a.y, a.r, wall.cx, wall.y, wall.leftX, wall.y, 2)) hit = true;
        if (circleHitsWallSegment(a.x, a.y, a.r, wall.cx, wall.y, wall.rightX, wall.y, 2)) hit = true;
      }
      if (hit) return a;
    }
    return null;
  }

  function wallFail(ex, ey) {
    Renderer.spawnParticles(ex || state.wall.x || state.wall.cx, ey || state.wall.y || state.wall.cy,
      20, '#ff1744', 30, 2);
    state.wall = null;
    state.lives--;
    state.flashTimer = C.FLASH_DURATION;
    Audio.wallFail();

    if (state.lives <= 0) {
      triggerGameOver();
    }
  }

  // ---- Determine which sub-rectangle gets captured ----
  // When wall completes, we determine the smaller empty region
  function wallComplete() {
    const { wall, asteroids, W, H } = state;

    let newRect = null;

    if (wall.orientation === 'vertical') {
      const x = wall.x;
      const y1 = wall.topY;
      const y2 = wall.bottomY;
      // Two candidate rects: left [0..x, y1..y2] and right [x..W, y1..y2]
      // But bounded by existing captured rects...
      // Simple version: use the full-width candidates
      const leftRect  = { x1: findLeftBound(x, y1, y2), y1, x2: x, y2 };
      const rightRect = { x1: x, y1, x2: findRightBound(x, y1, y2), y2 };
      newRect = chooseSaferRect(leftRect, rightRect);
    } else {
      const y = wall.y;
      const x1 = wall.leftX;
      const x2 = wall.rightX;
      const topRect    = { x1, y1: findTopBound(y, x1, x2), x2, y2: y };
      const bottomRect = { x1, y1: y, x2, y2: findBottomBound(y, x1, x2) };
      newRect = chooseSaferRect(topRect, bottomRect);
    }

    if (newRect) {
      captureRect(newRect);
    }

    state.wall = null;
  }

  function findLeftBound(x, y1, y2) {
    let bound = 0;
    state.captured.forEach(r => {
      if (r.x2 <= x && r.y1 <= y1 && r.y2 >= y2) bound = Math.max(bound, r.x2);
      if (r.x2 <= x && (r.y2 > y1 && r.y1 < y2)) bound = Math.max(bound, r.x2);
    });
    return bound;
  }
  function findRightBound(x, y1, y2) {
    let bound = state.W;
    state.captured.forEach(r => {
      if (r.x1 >= x && r.y1 <= y1 && r.y2 >= y2) bound = Math.min(bound, r.x1);
      if (r.x1 >= x && (r.y2 > y1 && r.y1 < y2)) bound = Math.min(bound, r.x1);
    });
    return bound;
  }
  function findTopBound(y, x1, x2) {
    let bound = 0;
    state.captured.forEach(r => {
      if (r.y2 <= y && (r.x2 > x1 && r.x1 < x2)) bound = Math.max(bound, r.y2);
    });
    return bound;
  }
  function findBottomBound(y, x1, x2) {
    let bound = state.H;
    state.captured.forEach(r => {
      if (r.y1 >= y && (r.x2 > x1 && r.x1 < x2)) bound = Math.min(bound, r.y1);
    });
    return bound;
  }

  function chooseSaferRect(rectA, rectB) {
    const aHasAsteroid = state.asteroids.some(a =>
      a.x > rectA.x1 && a.x < rectA.x2 && a.y > rectA.y1 && a.y < rectA.y2);
    const bHasAsteroid = state.asteroids.some(a =>
      a.x > rectB.x1 && a.x < rectB.x2 && a.y > rectB.y1 && a.y < rectB.y2);

    const aArea = (rectA.x2 - rectA.x1) * (rectA.y2 - rectA.y1);
    const bArea = (rectB.x2 - rectB.x1) * (rectB.y2 - rectB.y1);

    // Both safe? Take bigger
    if (!aHasAsteroid && !bHasAsteroid) return aArea >= bArea ? rectA : rectB;
    // One safe: take safe
    if (!aHasAsteroid) return rectA;
    if (!bHasAsteroid) return rectB;
    // Both have asteroids? Neither gets captured (rare edge case - take smaller)
    return aArea <= bArea ? rectA : rectB;
  }

  function captureRect(rect) {
    // Clamp to field
    rect.x1 = Math.max(0, rect.x1);
    rect.y1 = Math.max(0, rect.y1);
    rect.x2 = Math.min(state.W, rect.x2);
    rect.y2 = Math.min(state.H, rect.y2);

    const area = (rect.x2 - rect.x1) * (rect.y2 - rect.y1);
    if (area < 100) return; // too small

    state.captured.push(rect);
    state.capturedArea += area;
    state.successFlash = 20;

    // Spawn collection particles
    const cx = (rect.x1 + rect.x2) / 2;
    const cy = (rect.y1 + rect.y2) / 2;
    Renderer.spawnParticles(cx, cy, 30, '#69ff47', 50, 1.5);
    Renderer.spawnParticles(cx, cy, 15, '#00e5ff', 30, 2);

    // Score
    const pct = area / state.totalArea;
    state.score += Math.floor(pct * 100 * C.SCORE_PER_PERCENT * state.level);

    Audio.sectorCaptured();

    // Check level complete
    checkLevelComplete();
  }

  function getCapturedPercent() {
    return Math.min(100, Math.floor((state.capturedArea / state.totalArea) * 100));
  }

  function checkLevelComplete() {
    if (getCapturedPercent() >= C.REQUIRED_PERCENT) {
      state.levelComplete = true;
      state.score += C.SCORE_LEVEL_BONUS * state.level;
      Audio.levelComplete();
    }
  }

  function triggerGameOver() {
    state.gameOver = true;
    state.wall = null;
    Audio.gameOver();
  }

  function tick() {
    if (state.paused || state.levelComplete || state.gameOver) return;
    updateAsteroids();
    updateWall();
  }

  return {
    startLevel,
    getState,
    startWall,
    tick,
    getCapturedPercent,
    // expose for UI
    get state() { return state; }
  };
})();
