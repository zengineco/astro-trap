// ===== renderer.js — All canvas drawing =====
const Renderer = (() => {

  let canvas, ctx;
  let stars = [];
  let nebulaCanvas, nebulaCtx;

  // Particles for effects
  let particles = [];

  function init(c) {
    canvas = c;
    ctx = c.getContext('2d');
    generateNebula();
    generateStars();
  }

  function resize(w, h) {
    canvas.width = w;
    canvas.height = h;
    generateNebula();
    generateStars();
  }

  function generateStars() {
    stars = [];
    const count = Math.floor((canvas.width * canvas.height) / 3000);
    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.5 + 0.2,
        brightness: Math.random(),
        twinkleSpeed: Math.random() * 0.02 + 0.005,
        twinkleOffset: Math.random() * Math.PI * 2
      });
    }
  }

  function generateNebula() {
    nebulaCanvas = document.createElement('canvas');
    nebulaCanvas.width = canvas.width;
    nebulaCanvas.height = canvas.height;
    nebulaCtx = nebulaCanvas.getContext('2d');
    const nc = nebulaCtx;
    nc.clearRect(0, 0, canvas.width, canvas.height);

    // Soft nebula blobs
    const blobs = [
      { x: 0.2, y: 0.3, r: 0.3, color: 'rgba(21,101,192,0.06)' },
      { x: 0.75, y: 0.6, r: 0.28, color: 'rgba(0,188,212,0.05)' },
      { x: 0.5,  y: 0.8, r: 0.2,  color: 'rgba(103,58,183,0.04)' },
    ];
    blobs.forEach(b => {
      const g = nc.createRadialGradient(
        b.x * canvas.width, b.y * canvas.height, 0,
        b.x * canvas.width, b.y * canvas.height, b.r * Math.max(canvas.width, canvas.height)
      );
      g.addColorStop(0, b.color);
      g.addColorStop(1, 'transparent');
      nc.fillStyle = g;
      nc.fillRect(0, 0, canvas.width, canvas.height);
    });
  }

  // ---- Particle system ----
  function spawnParticles(x, y, count, color, spread = 30, speedMult = 1) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (Math.random() * 2 + 0.5) * speedMult;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        decay: Math.random() * 0.03 + 0.02,
        r: Math.random() * spread * 0.03 + 1,
        color
      });
    }
  }

  function updateParticles() {
    particles = particles.filter(p => p.life > 0);
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.97;
      p.vy *= 0.97;
      p.life -= p.decay;
      p.r *= 0.98;
    });
  }

  function drawParticles() {
    particles.forEach(p => {
      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  // ---- Hex grid pattern (for captured sectors) ----
  function drawHexGrid(x1, y1, x2, y2, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    const size = 18;
    const h = size * Math.sqrt(3);
    const w = size * 2;

    ctx.strokeStyle = 'rgba(0, 229, 255, 0.5)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();

    for (let row = Math.floor(y1 / h) - 1; row <= Math.ceil(y2 / h) + 1; row++) {
      for (let col = Math.floor(x1 / (w * 0.75)) - 1; col <= Math.ceil(x2 / (w * 0.75)) + 1; col++) {
        const cx = col * w * 0.75;
        const cy = row * h + (col % 2) * h * 0.5;
        if (cx + w < x1 || cx - w > x2 || cy + h < y1 || cy - h > y2) continue;
        for (let i = 0; i < 6; i++) {
          const a1 = (i / 6) * Math.PI * 2 - Math.PI / 6;
          const a2 = ((i + 1) / 6) * Math.PI * 2 - Math.PI / 6;
          const px1 = cx + size * Math.cos(a1);
          const py1 = cy + size * Math.sin(a1);
          const px2 = cx + size * Math.cos(a2);
          const py2 = cy + size * Math.sin(a2);
          ctx.moveTo(px1, py1);
          ctx.lineTo(px2, py2);
        }
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  // ---- Main draw ----
  function draw(state, tick) {
    const { W, H } = state;

    // Background
    ctx.fillStyle = '#010814';
    ctx.fillRect(0, 0, W, H);

    // Nebula
    ctx.drawImage(nebulaCanvas, 0, 0);

    // Stars
    ctx.save();
    stars.forEach(s => {
      const twinkle = 0.4 + 0.6 * Math.abs(Math.sin(tick * s.twinkleSpeed + s.twinkleOffset));
      ctx.globalAlpha = s.brightness * twinkle;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();

    // Captured sectors
    state.captured.forEach(sect => {
      // Base fill
      ctx.save();
      const scanShift = (Math.sin(tick * 0.02 + sect.x1 * 0.01) + 1) * 0.5;
      const baseAlpha = 0.18 + scanShift * 0.06;
      const g = ctx.createLinearGradient(sect.x1, sect.y1, sect.x2, sect.y2);
      g.addColorStop(0, `rgba(0, 229, 255, ${baseAlpha})`);
      g.addColorStop(0.5, `rgba(105, 255, 71, ${baseAlpha * 0.7})`);
      g.addColorStop(1, `rgba(0, 188, 212, ${baseAlpha})`);
      ctx.fillStyle = g;
      ctx.fillRect(sect.x1, sect.y1, sect.x2 - sect.x1, sect.y2 - sect.y1);
      ctx.restore();

      // Hex grid inside
      drawHexGrid(sect.x1, sect.y1, sect.x2, sect.y2, 0.5);

      // Scan line shimmer
      ctx.save();
      const scanY = sect.y1 + ((tick * 1.5) % (sect.y2 - sect.y1 + 40)) - 20;
      const sgr = ctx.createLinearGradient(sect.x1, scanY - 12, sect.x1, scanY + 12);
      sgr.addColorStop(0, 'transparent');
      sgr.addColorStop(0.5, 'rgba(0, 229, 255, 0.12)');
      sgr.addColorStop(1, 'transparent');
      ctx.fillStyle = sgr;
      ctx.fillRect(sect.x1, Math.max(sect.y1, scanY - 12), sect.x2 - sect.x1, 24);
      ctx.restore();

      // Border glow
      ctx.save();
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.4)';
      ctx.lineWidth = 1;
      ctx.shadowColor = 'rgba(0, 229, 255, 0.6)';
      ctx.shadowBlur = 4;
      ctx.strokeRect(sect.x1 + 0.5, sect.y1 + 0.5, sect.x2 - sect.x1 - 1, sect.y2 - sect.y1 - 1);
      ctx.restore();
    });

    // Active wall
    if (state.wall) {
      const { wall } = state;
      ctx.save();
      ctx.shadowColor = 'var(--wall-glow)';
      ctx.shadowBlur = 12;

      if (wall.orientation === 'vertical') {
        drawWallSegment(wall.x, wall.topY, wall.x, wall.cy, tick, 'cyan');   // upward
        drawWallSegment(wall.x, wall.cy, wall.x, wall.bottomY, tick, 'cyan'); // downward
      } else {
        drawWallSegment(wall.cx, wall.y, wall.leftX, wall.y, tick, 'cyan');
        drawWallSegment(wall.cx, wall.y, wall.rightX, wall.y, tick, 'cyan');
      }
      ctx.restore();

      // Crackle particles at leading edges
      if (Math.random() < 0.3) {
        if (wall.orientation === 'vertical') {
          spawnParticles(wall.x, wall.topY, 1, '#00e5ff', 20, 1);
          spawnParticles(wall.x, wall.bottomY, 1, '#00e5ff', 20, 1);
        } else {
          spawnParticles(wall.leftX, wall.y, 1, '#00e5ff', 20, 1);
          spawnParticles(wall.rightX, wall.y, 1, '#00e5ff', 20, 1);
        }
      }
    }

    // Field border
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.7)';
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(0, 229, 255, 0.8)';
    ctx.shadowBlur = 10;
    ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
    ctx.restore();

    // Asteroids
    state.asteroids.forEach(a => drawAsteroid(a, tick));

    // Particles
    updateParticles();
    drawParticles();

    // Flash overlay
    if (state.flashTimer > 0) {
      const alpha = (state.flashTimer / state.FLASH_DURATION) * 0.4;
      ctx.save();
      ctx.fillStyle = `rgba(255, 23, 68, ${alpha})`;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
      state.flashTimer--;
    }

    // Success flash
    if (state.successFlash > 0) {
      const alpha = (state.successFlash / 20) * 0.25;
      ctx.save();
      ctx.fillStyle = `rgba(105, 255, 71, ${alpha})`;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
      state.successFlash--;
    }
  }

  function drawWallSegment(x1, y1, x2, y2, tick, colorHint) {
    const isVert = x1 === x2;
    const progress = isVert
      ? Math.abs(y2 - y1)
      : Math.abs(x2 - x1);

    // Outer glow
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.3)';
    ctx.lineWidth = 6;
    ctx.shadowBlur = 16;
    ctx.shadowColor = '#00e5ff';
    ctx.stroke();

    // Core beam
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    const pulse = 0.7 + 0.3 * Math.sin(tick * 0.3);
    ctx.strokeStyle = `rgba(0, 229, 255, ${pulse})`;
    ctx.lineWidth = 2;
    ctx.shadowBlur = 8;
    ctx.stroke();

    // Leading edge sparkle dot
    const spark = 0.5 + 0.5 * Math.sin(tick * 0.8);
    ctx.beginPath();
    ctx.arc(x2, y2, 3 + spark * 2, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }

  function drawAsteroid(a, tick) {
    ctx.save();
    ctx.translate(a.x, a.y);

    // Trail
    if (a.trail) {
      a.trail.forEach((pt, i) => {
        const age = 1 - i / a.trail.length;
        ctx.beginPath();
        ctx.arc(pt.x - a.x, pt.y - a.y, a.r * 0.4 * age, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(176, 190, 197, ${age * 0.2})`;
        ctx.fill();
      });
    }

    // Rotation
    ctx.rotate(a.rot);

    // Shadow/glow
    ctx.shadowColor = a.glowColor || '#90a4ae';
    ctx.shadowBlur = 10 + 5 * Math.sin(tick * 0.05 + a.phase);

    // Main body - layered circles for rocky look
    const gr = ctx.createRadialGradient(-a.r * 0.3, -a.r * 0.3, a.r * 0.1, 0, 0, a.r);
    gr.addColorStop(0, '#cfd8dc');
    gr.addColorStop(0.4, '#90a4ae');
    gr.addColorStop(0.75, '#546e7a');
    gr.addColorStop(1, '#263238');
    ctx.beginPath();
    ctx.arc(0, 0, a.r, 0, Math.PI * 2);
    ctx.fillStyle = gr;
    ctx.fill();

    // Iridescent sheen
    const sheen = ctx.createRadialGradient(-a.r * 0.4, -a.r * 0.4, 0, 0, 0, a.r);
    const t = (Math.sin(tick * 0.03 + a.phase) + 1) * 0.5;
    const r = Math.floor(t * 100);
    const gb = Math.floor(150 + t * 80);
    sheen.addColorStop(0, `rgba(${r}, ${gb}, 255, 0.25)`);
    sheen.addColorStop(1, 'transparent');
    ctx.fillStyle = sheen;
    ctx.fill();

    // Crater highlights
    if (a.craters) {
      a.craters.forEach(c => {
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(c.x - c.r * 0.2, c.y - c.r * 0.2, c.r * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fill();
      });
    }

    ctx.restore();
  }

  return {
    init,
    resize,
    draw,
    spawnParticles,
    updateParticles
  };
})();
