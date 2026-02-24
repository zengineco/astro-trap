// ===== main.js — Entry point, UI, game loop =====

// ---- App state ----
const App = {
  currentScreen: 'menu',
  options: {
    sound: true,
    speed: 'standard', // 'normal', 'standard', 'fast'
    startLevel: 1,
  },
  currentLevel: 1,
  animFrameId: null,
  tick: 0,
  gameRunning: false,
  levelTransitioning: false,
};

// ---- Screen management ----
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id + '-screen').classList.add('active');
  App.currentScreen = id;
}

// ---- High score storage ----
const HS_KEY = 'astrotrap_scores';
function getScores() {
  try { return JSON.parse(localStorage.getItem(HS_KEY)) || []; }
  catch(e) { return []; }
}
function saveScore(name, score, level) {
  const scores = getScores();
  scores.push({ name: name.toUpperCase().trim() || 'CMDR', score, level });
  scores.sort((a, b) => b.score - a.score);
  scores.splice(10);
  localStorage.setItem(HS_KEY, JSON.stringify(scores));
}
function renderScores() {
  const list = document.getElementById('scores-list');
  const scores = getScores();
  if (!scores.length) {
    list.innerHTML = '<div class="score-empty">NO RECORDS — BE THE FIRST COMMANDER</div>';
    return;
  }
  list.innerHTML = scores.map((s, i) =>
    `<div class="score-row">
      <span class="score-rank">${i + 1}</span>
      <span class="score-name">${s.name}</span>
      <span class="score-pts">${String(s.score).padStart(6, '0')} &nbsp; LVL ${s.level}</span>
    </div>`
  ).join('');
}

// ---- HUD Update ----
function updateHUD() {
  const s = Game.getState();
  if (!s.level) return;

  document.getElementById('hud-level').textContent = String(s.level).padStart(2, '0');
  document.getElementById('hud-score').textContent = String(s.score).padStart(6, '0');

  const pct = Game.getCapturedPercent();
  document.getElementById('hud-percent').textContent = pct + '%';
  document.getElementById('hud-progress-bar').style.width = pct + '%';

  // Lives
  const livesEl = document.getElementById('hud-lives');
  const maxLives = s.lives + (s.flashTimer > 0 ? 1 : 0); // approximate starting lives
  // Just show current icons
  const existing = livesEl.children.length;
  const maxDisplay = Math.max(s.lives, existing, C.BASE_LIVES);
  livesEl.innerHTML = '';
  for (let i = 0; i < maxDisplay; i++) {
    const icon = document.createElement('div');
    icon.className = 'life-icon' + (i >= s.lives ? ' lost' : '');
    livesEl.appendChild(icon);
  }

  // Mode button
  const modeBtn = document.getElementById('btn-mode-toggle');
  modeBtn.textContent = s.orientation === 'vertical' ? '⇕ VERT' : '⇔ HORIZ';
  modeBtn.classList.toggle('active', s.orientation === 'horizontal');
}

// ---- Canvas sizing ----
function resizeCanvas() {
  const canvas = document.getElementById('game-canvas');
  const wrap = document.getElementById('canvas-wrap');
  const W = wrap.clientWidth;
  const H = wrap.clientHeight;
  if (canvas.width !== W || canvas.height !== H) {
    canvas.width = W;
    canvas.height = H;
    Renderer.resize(W, H);
    // Restart level with new size if running
    if (App.gameRunning && Game.getState().level) {
      const s = Game.getState();
      const score = s.score;
      Game.startLevel(s.level, W, H);
      Game.getState().score = score;
    }
  }
}

// ---- Game Loop ----
function gameLoop() {
  App.animFrameId = requestAnimationFrame(gameLoop);
  App.tick++;

  const s = Game.getState();
  if (!s.level) return;

  Game.tick();
  Renderer.draw(s, App.tick);
  updateHUD();

  // Check game over
  if (s.gameOver && !App.levelTransitioning) {
    App.levelTransitioning = true;
    setTimeout(showGameOver, 800);
  }

  // Check level complete
  if (s.levelComplete && !App.levelTransitioning) {
    App.levelTransitioning = true;
    showOverlay(`✦ SECTOR ${s.level} HARVESTED ✦`, 'PREPARING NEXT SECTOR…', '#69ff47');
    setTimeout(() => {
      App.currentLevel = Math.min(s.level + 1, C.MAX_LEVEL);
      startGame(App.currentLevel, s.score);
    }, 2500);
  }
}

function showOverlay(title, sub, color = '#00e5ff') {
  const el = document.getElementById('overlay-msg');
  el.classList.remove('hidden');
  el.innerHTML = `
    <div class="overlay-title" style="color:${color}">${title}</div>
    <div class="overlay-sub">${sub}</div>
  `;
}
function hideOverlay() {
  document.getElementById('overlay-msg').classList.add('hidden');
}

// ---- Start / Resume ----
function startGame(level = 1, carryScore = 0) {
  App.levelTransitioning = false;
  hideOverlay();
  showScreen('game');
  App.gameRunning = true;

  const canvas = document.getElementById('game-canvas');
  const wrap = document.getElementById('canvas-wrap');
  canvas.width = wrap.clientWidth;
  canvas.height = wrap.clientHeight;

  Renderer.init(canvas);

  // Speed multiplier
  const speedMap = { normal: 0.7, standard: 1.0, fast: 1.4 };
  // Store speed pref in constant (hacky but simple)
  C.ASTEROID_BASE_SPEED = 2.2 * (speedMap[App.options.speed] || 1);

  Game.startLevel(level, canvas.width, canvas.height);
  Game.getState().score = carryScore;
  App.currentLevel = level;

  if (App.animFrameId) cancelAnimationFrame(App.animFrameId);
  gameLoop();
}

function showGameOver() {
  const s = Game.getState();
  App.gameRunning = false;

  document.getElementById('go-title').textContent = s.level > 5 ? 'MISSION COMPLETE' : 'MISSION FAILED';
  document.getElementById('go-level').textContent = String(s.level).padStart(2, '0');
  document.getElementById('go-score').textContent = String(s.score).padStart(6, '0');

  const bestScore = getScores()[0]?.score || 0;
  document.getElementById('go-best').textContent = String(Math.max(bestScore, s.score)).padStart(6, '0');

  // Show name entry only if score is in top 10
  const scores = getScores();
  const wouldRank = scores.length < 10 || s.score > (scores[scores.length - 1]?.score || 0);
  document.getElementById('go-name-wrap').style.display = wouldRank ? 'flex' : 'none';

  showScreen('gameover');
}

// ---- Canvas Input ----
function setupCanvasInput() {
  const canvas = document.getElementById('game-canvas');

  // Prevent context menu on right-click
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  // Mouse
  canvas.addEventListener('mousedown', e => {
    e.preventDefault();
    if (!App.gameRunning) return;
    const s = Game.getState();
    if (s.gameOver || s.paused || s.levelComplete) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const orientation = e.button === 2 ? 'horizontal' : s.orientation;
    Game.startWall(x, y, orientation);
  });

  // Touch — long-press = horizontal
  let touchTimer = null;
  let touchStartX = 0, touchStartY = 0;

  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    const t = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    touchStartX = t.clientX - rect.left;
    touchStartY = t.clientY - rect.top;

    touchTimer = setTimeout(() => {
      touchTimer = null;
      // Long press = horizontal
      const s = Game.getState();
      if (s) s.orientation = 'horizontal';
    }, 300);
  }, { passive: false });

  canvas.addEventListener('touchend', e => {
    e.preventDefault();
    const s = Game.getState();
    if (!s || s.gameOver || s.paused) return;

    if (touchTimer !== null) {
      clearTimeout(touchTimer);
      touchTimer = null;
      Game.startWall(touchStartX, touchStartY, s.orientation);
    }
  }, { passive: false });

  // Keyboard
  document.addEventListener('keydown', e => {
    if (App.currentScreen !== 'game') return;
    const s = Game.getState();
    if (!s.level) return;

    switch(e.key.toLowerCase()) {
      case 'v': s.orientation = 'vertical'; break;
      case 'h': s.orientation = 'horizontal'; break;
      case 'p': case 'escape':
        s.paused = !s.paused;
        if (s.paused) showOverlay('⏸ PAUSED', 'PRESS P TO RESUME', '#ffd740');
        else hideOverlay();
        break;
      case 'm':
        Audio.setEnabled(!Audio.isEnabled());
        document.getElementById('btn-mute').textContent = Audio.isEnabled() ? '🔊' : '🔇';
        break;
    }
  });
}

// ---- Button wiring ----
document.addEventListener('DOMContentLoaded', () => {

  // Menu buttons
  document.getElementById('btn-play').addEventListener('click', () => {
    startGame(App.options.startLevel || 1);
  });

  document.getElementById('btn-options').addEventListener('click', () => showScreen('options'));
  document.getElementById('btn-options-back').addEventListener('click', () => {
    // Save speed selection
    App.options.startLevel = parseInt(document.getElementById('opt-start-level').value) || 1;
    showScreen('menu');
  });

  document.getElementById('btn-scores').addEventListener('click', () => {
    renderScores();
    showScreen('scores');
  });
  document.getElementById('btn-scores-back').addEventListener('click', () => showScreen('menu'));
  document.getElementById('btn-clear-scores').addEventListener('click', () => {
    localStorage.removeItem(HS_KEY);
    renderScores();
  });

  // Options: sound toggle
  document.getElementById('opt-sound').addEventListener('click', function() {
    App.options.sound = !App.options.sound;
    Audio.setEnabled(App.options.sound);
    this.textContent = App.options.sound ? 'ON' : 'OFF';
    this.classList.toggle('active', App.options.sound);
  });

  // Options: speed toggles
  ['normal', 'fast', 'standard'].forEach(speed => {
    const btn = document.getElementById(`opt-speed-${speed}`);
    if (btn) btn.addEventListener('click', () => {
      document.querySelectorAll('[data-speed]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      App.options.speed = speed;
    });
  });

  // HUD buttons
  document.getElementById('btn-mode-toggle').addEventListener('click', () => {
    const s = Game.getState();
    if (s.level) {
      s.orientation = s.orientation === 'vertical' ? 'horizontal' : 'vertical';
    }
  });

  document.getElementById('btn-pause').addEventListener('click', () => {
    const s = Game.getState();
    if (!s.level) return;
    s.paused = !s.paused;
    if (s.paused) showOverlay('⏸ PAUSED', 'PRESS P OR CLICK RESUME', '#ffd740');
    else hideOverlay();
  });

  document.getElementById('btn-mute').addEventListener('click', function() {
    Audio.setEnabled(!Audio.isEnabled());
    this.textContent = Audio.isEnabled() ? '🔊' : '🔇';
  });

  // Game over buttons
  document.getElementById('btn-save-score').addEventListener('click', () => {
    const name = document.getElementById('go-name-input').value;
    const s = Game.getState();
    saveScore(name, s.score, s.level);
    document.getElementById('go-name-wrap').style.display = 'none';
  });

  document.getElementById('btn-retry').addEventListener('click', () => {
    startGame(App.currentLevel);
  });

  document.getElementById('btn-go-menu').addEventListener('click', () => {
    if (App.animFrameId) cancelAnimationFrame(App.animFrameId);
    App.gameRunning = false;
    showScreen('menu');
  });

  // Setup canvas input
  setupCanvasInput();

  // Resize handler
  window.addEventListener('resize', () => {
    if (App.currentScreen === 'game') resizeCanvas();
  });

  // Start on menu
  showScreen('menu');
});
