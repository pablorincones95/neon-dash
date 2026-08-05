(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  let W, H;

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener("resize", resize);

  const uiStart = document.getElementById("ui-start");
  const uiHud = document.getElementById("ui-hud");
  const uiGameover = document.getElementById("ui-gameover");
  const scoreDisplay = document.getElementById("score-display");
  const finalScore = document.getElementById("final-score");
  const bestScoreEl = document.getElementById("best-score");
  const btnStart = document.getElementById("btn-start");
  const btnRestart = document.getElementById("btn-restart");
  const btnSound = document.getElementById("btn-sound");
  const soundIcon = document.getElementById("sound-icon");

  // ── Sound ───────────────────────────────────────────────────────────
  let audioCtx = null;
  let soundEnabled = true;

  function ensureAudio() {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") audioCtx.resume();
    } catch (_) {}
  }

  function playTone(freq, duration, type, vol) {
    if (!soundEnabled || !audioCtx) return;
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type || "square";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol || 0.1, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (_) {}
  }

  function sfxJump() { playTone(440 + Math.random() * 80, 0.08, "square", 0.06); }
  function sfxScore() {
    playTone(660, 0.06, "sine", 0.1);
    setTimeout(() => playTone(880, 0.06, "sine", 0.1), 50);
    setTimeout(() => playTone(1100, 0.08, "sine", 0.08), 100);
  }
  function sfxDie() {
    playTone(200, 0.15, "sawtooth", 0.15);
    setTimeout(() => playTone(120, 0.3, "sawtooth", 0.1), 80);
  }
  function sfxCombo() { playTone(1320, 0.12, "sine", 0.07); }

  btnSound.addEventListener("click", (e) => {
    e.stopPropagation();
    ensureAudio();
    soundEnabled = !soundEnabled;
    btnSound.classList.toggle("muted", !soundEnabled);
    soundIcon.textContent = soundEnabled ? "\u266A" : "\u2716";
  });

  // ── Constants ───────────────────────────────────────────────────────
  const GRAVITY = 0.52;
  const JUMP_FORCE = -9.2;
  const PLAYER_SIZE = 22;
  const PIPE_WIDTH = 52;
  const GRACE_PERIOD = 1500;

  // ── State ───────────────────────────────────────────────────────────
  let state = "start";
  let score = 0;
  let best = parseInt(localStorage.getItem("neonDashBest") || "0", 10);

  let player = null;
  let pipes = [];
  let particles = [];
  let popups = [];
  let shakeFrames = 0;
  let shakeIntensity = 0;
  let groundX = 0;
  let lastSpawn = 0;
  let spawnInterval = 0;
  let pipeSpeed = 0;
  let difficulty = 0;
  let gameTime = 0;
  let trailTimer = 0;
  let deathTimer = 0;
  let slowMo = 0;
  let flashAlpha = 0;
  let flashColor = "#fff";
  let scorePopScale = 1;
  let combo = 0;
  let comboTimer = 0;

  function resetGame() {
    player = { x: W * 0.22, y: H * 0.5, vy: 0, alive: true, trail: [], rot: 0 };
    pipes = [];
    particles = [];
    popups = [];
    shakeFrames = 0;
    shakeIntensity = 0;
    groundX = 0;
    score = 0;
    difficulty = 0;
    gameTime = 0;
    trailTimer = 0;
    deathTimer = 0;
    slowMo = 0;
    flashAlpha = 0;
    scorePopScale = 1;
    combo = 0;
    comboTimer = 0;
    lastSpawn = performance.now() + GRACE_PERIOD;
    spawnInterval = 2400;
    pipeSpeed = 3;
    scoreDisplay.textContent = "0";
    scoreDisplay.style.transform = "";
  }

  // ── Input ───────────────────────────────────────────────────────────
  function onAction(e) {
    if (e) e.preventDefault();
    ensureAudio();

    if (state === "start") {
      state = "playing";
      uiStart.classList.add("hidden");
      uiHud.classList.remove("hidden");
      resetGame();
      return;
    }

    if (state === "dead") {
      if (deathTimer > 0) return;
      uiGameover.classList.add("hidden");
      uiHud.classList.remove("hidden");
      state = "playing";
      resetGame();
      return;
    }

    if (!player || !player.alive) return;
    player.vy = JUMP_FORCE;
    sfxJump();
    spawnParticles(player.x, player.y + PLAYER_SIZE / 2, "#0ff", 3, 0.8, 2);
  }

  window.addEventListener("keydown", (e) => {
    if (e.code === "Space" || e.code === "ArrowUp") onAction(e);
  });
  canvas.addEventListener("pointerdown", onAction);
  btnStart.addEventListener("click", onAction);
  btnRestart.addEventListener("click", () => {
    uiGameover.classList.add("hidden");
    uiHud.classList.remove("hidden");
    state = "playing";
    resetGame();
  });

  // ── Particles ───────────────────────────────────────────────────────
  function spawnParticles(x, y, color, count, spread, speed) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = (0.5 + Math.random()) * (speed || 4);
      particles.push({
        x, y,
        vx: Math.cos(angle) * spd * (spread || 1),
        vy: Math.sin(angle) * spd * (spread || 1),
        life: 1,
        decay: 0.018 + Math.random() * 0.02,
        size: 2 + Math.random() * 3,
        color
      });
    }
  }

  function spawnScorePopup(x, y, text, color) {
    popups.push({ x, y, text, color, life: 1, vy: -2 });
  }

  // ── Pipe spawn ──────────────────────────────────────────────────────
  function spawnPipe() {
    const gap = Math.max(130, 220 - difficulty * 6);
    const minTop = 70;
    const maxTop = H - gap - 70;
    const topH = minTop + Math.random() * Math.max(1, maxTop - minTop);
    pipes.push({ x: W + 10, topH, gap, passed: false });
  }

  // ── Update ──────────────────────────────────────────────────────────
  function update(dt) {
    // Slow-mo countdown
    if (slowMo > 0) {
      slowMo -= dt;
      dt *= 0.3;
    }

    // Flash fade
    if (flashAlpha > 0) flashAlpha -= 0.04;

    // Score pop scale recovery
    if (scorePopScale > 1) scorePopScale = Math.max(1, scorePopScale - 0.04);

    // Popups
    for (const p of popups) {
      p.y += p.vy;
      p.life -= 0.02;
    }
    popups = popups.filter(p => p.life > 0);

    // Death timer
    if (state === "dead") {
      deathTimer -= dt;
      // Still update particles during death
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.08;
        p.life -= p.decay;
      }
      particles = particles.filter(p => p.life > 0);
      if (shakeFrames > 0) shakeFrames--;
      return;
    }

    if (state !== "playing" || !player) return;

    gameTime += dt;
    comboTimer -= dt;
    if (comboTimer <= 0) combo = 0;

    // Player physics
    player.vy += GRAVITY;
    player.y += player.vy;

    // Player rotation based on velocity
    const targetRot = Math.min(Math.max(player.vy * 3, -25), 25);
    player.rot += (targetRot - player.rot) * 0.15;

    // Trail
    trailTimer += dt;
    if (trailTimer > 18) {
      trailTimer = 0;
      player.trail.push({ x: player.x, y: player.y, life: 1, rot: player.rot });
      if (player.trail.length > 8) player.trail.shift();
    }
    for (const t of player.trail) t.life -= 0.06;

    // Ceiling clamp
    if (player.y < PLAYER_SIZE / 2) {
      player.y = PLAYER_SIZE / 2;
      player.vy = 0;
    }

    // Floor death
    if (player.y > H - PLAYER_SIZE / 2) {
      die();
      return;
    }

    // Spawn pipes
    const now = performance.now();
    if (now > lastSpawn) {
      spawnPipe();
      lastSpawn = now + spawnInterval;
      difficulty += 0.5;
      pipeSpeed = Math.min(8, 3 + difficulty * 0.06);
      spawnInterval = Math.max(850, 2400 - difficulty * 22);
    }

    // Pipes
    const half = PLAYER_SIZE / 2;
    for (const p of pipes) {
      p.x -= pipeSpeed;

      if (player.alive && p.x + PIPE_WIDTH > player.x - half && p.x < player.x + half) {
        if (player.y - half < p.topH || player.y + half > p.topH + p.gap) {
          die();
          return;
        }
      }

      if (!p.passed && p.x + PIPE_WIDTH < player.x - half) {
        p.passed = true;
        score++;
        scoreDisplay.textContent = score;
        scorePopScale = 1.4;
        scoreDisplay.style.transform = `scale(${scorePopScale})`;

        combo++;
        comboTimer = 2000;
        if (combo >= 3) {
          sfxCombo();
          spawnScorePopup(player.x, player.y - 30, combo + "x COMBO", "#ff0");
        } else {
          sfxScore();
        }
        spawnParticles(player.x, player.y, "#0ff", 5, 1.2, 3);

        // Flash on score
        flashColor = "rgba(0,255,255,0.15)";
        flashAlpha = 0.3;
      }
    }

    pipes = pipes.filter(p => p.x > -PIPE_WIDTH - 20);

    // Particles
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.08;
      p.life -= p.decay;
    }
    particles = particles.filter(p => p.life > 0);

    groundX = (groundX + pipeSpeed) % 40;
    if (shakeFrames > 0) shakeFrames--;
  }

  // ── Die ─────────────────────────────────────────────────────────────
  function die() {
    if (!player || !player.alive) return;
    player.alive = false;
    state = "dead";
    deathTimer = 500;
    shakeFrames = 18;
    shakeIntensity = 1.2;
    slowMo = 300;
    sfxDie();

    // Explosion
    spawnParticles(player.x, player.y, "#f0f", 30, 2, 6);
    spawnParticles(player.x, player.y, "#fff", 15, 1.5, 4);
    spawnParticles(player.x, player.y, "#0ff", 10, 1, 3);

    // Red flash
    flashColor = "rgba(255,0,80,0.35)";
    flashAlpha = 0.8;

    if (score > best) {
      best = score;
      localStorage.setItem("neonDashBest", String(best));
    }

    setTimeout(() => {
      if (state !== "dead") return;
      uiHud.classList.add("hidden");
      uiGameover.classList.remove("hidden");
      finalScore.textContent = score;
      bestScoreEl.textContent = "BEST: " + best;
    }, 600);
  }

  // ── Draw ────────────────────────────────────────────────────────────
  function draw() {
    ctx.save();

    // Screen shake
    if (shakeFrames > 0) {
      const intensity = shakeIntensity || 1;
      ctx.translate(
        (Math.random() - 0.5) * shakeFrames * intensity * 1.5,
        (Math.random() - 0.5) * shakeFrames * intensity * 1.5
      );
    }

    // Background
    ctx.fillStyle = "#0a0a0f";
    ctx.fillRect(0, 0, W, H);

    // Grid
    ctx.strokeStyle = "rgba(0,255,255,0.035)";
    ctx.lineWidth = 1;
    const gridSize = 60;
    const offsetX = -(groundX * 0.5 % gridSize);
    for (let x = offsetX; x < W; x += gridSize) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += gridSize) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // Pipes
    for (const p of pipes) {
      drawPipe(p.x, 0, PIPE_WIDTH, p.topH);
      drawPipe(p.x, p.topH + p.gap, PIPE_WIDTH, H - (p.topH + p.gap));
    }

    // Ground line
    ctx.strokeStyle = "rgba(255,0,255,0.25)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, H - 1);
    ctx.lineTo(W, H - 1);
    ctx.stroke();

    // Player
    if (player) {
      // Trail
      for (const t of player.trail) {
        if (t.life <= 0) continue;
        ctx.globalAlpha = t.life * 0.3;
        ctx.fillStyle = "#0ff";
        ctx.save();
        ctx.translate(t.x, t.y);
        ctx.rotate((t.rot || 0) * Math.PI / 180);
        ctx.fillRect(-PLAYER_SIZE / 2, -PLAYER_SIZE / 2, PLAYER_SIZE, PLAYER_SIZE);
        ctx.restore();
      }
      ctx.globalAlpha = 1;

      if (player.alive) {
        drawPlayer(player.x, player.y, player.rot);
      }
    }

    // Particles
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    // Score popups
    for (const p of popups) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.font = "bold 16px 'Courier New', monospace";
      ctx.textAlign = "center";
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;

    // Flash overlay
    if (flashAlpha > 0) {
      ctx.globalAlpha = Math.max(0, flashAlpha);
      ctx.fillStyle = flashColor;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  function drawPlayer(x, y, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((rot || 0) * Math.PI / 180);

    // Glow
    ctx.shadowColor = "#0ff";
    ctx.shadowBlur = 22;
    ctx.fillStyle = "#0ff";
    ctx.fillRect(-PLAYER_SIZE / 2, -PLAYER_SIZE / 2, PLAYER_SIZE, PLAYER_SIZE);
    ctx.shadowBlur = 0;

    // Inner highlight
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.fillRect(-PLAYER_SIZE / 4, -PLAYER_SIZE / 4, PLAYER_SIZE / 2, PLAYER_SIZE / 2);

    ctx.restore();
  }

  function drawPipe(x, y, w, h) {
    if (h <= 0) return;
    ctx.shadowColor = "#f0f";
    ctx.shadowBlur = 15;
    ctx.fillStyle = "#f0f";
    ctx.fillRect(x, y, w, h);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(255,0,255,0.3)";
    ctx.fillRect(x + 4, y, 4, h);
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(x + w - 8, y, 4, h);
  }

  // ── Loop ────────────────────────────────────────────────────────────
  let lastTime = 0;

  function loop(time) {
    const dt = Math.min(time - lastTime, 50);
    lastTime = time;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  requestAnimationFrame((t) => {
    lastTime = t;
    loop(t);
  });
})();
