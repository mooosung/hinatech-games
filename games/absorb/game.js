// ============================================
// おさかなサバイバル ゲームロジック
// ============================================

(function () {
  'use strict';

  // ============================================
  // 定数
  // ============================================
  var INITIAL_PLAYER_RADIUS = 12;
  var PLAYER_SPEED = 3.5;
  var NPC_MIN_RADIUS = 5;
  var NPC_MAX_RADIUS = 40;
  var INITIAL_NPC_COUNT = 30;
  var MAX_NPC_COUNT = 50;
  var SPAWN_INTERVAL = 1500;
  var NPC_SPEED_MIN = 0.3;
  var NPC_SPEED_MAX = 1.8;
  var ABSORB_GROWTH = 0.4;
  var PLAYER_LERP = 0.08;
  var BUBBLE_COUNT = 15;

  // 魚のカラーパレット
  var FISH_COLORS = [
    '#E74C3C', '#E67E22', '#F1C40F', '#2ECC71',
    '#1ABC9C', '#9B59B6', '#E91E63',
    '#FF5722', '#8BC34A', '#FF9800'
  ];

  // ============================================
  // 状態変数
  // ============================================
  var canvas, ctx;
  var canvasW, canvasH;
  var player;
  var npcs = [];
  var bubbles = [];
  var score = 0;
  var bestScore = parseInt(localStorage.getItem('bestAbsorb') || '0', 10);
  var gameRunning = false;
  var gameOverFlag = false;
  var animFrameId = null;
  var lastSpawnTime = 0;
  var targetX, targetY;
  var mouseActive = false;
  var frameCount = 0;
  var floatingTexts = [];

  // ============================================
  // DOM要素
  // ============================================
  var scoreEl = document.getElementById('score');
  var bestScoreEl = document.getElementById('best-score');
  var gameOverOverlay = document.getElementById('game-over-overlay');
  var gameStartOverlay = document.getElementById('game-start-overlay');
  var finalScoreEl = document.getElementById('final-score');
  var bestResultEl = document.getElementById('best-result');

  canvas = document.getElementById('game-canvas');
  ctx = canvas.getContext('2d');

  // ============================================
  // キャンバスの初期化
  // ============================================
  function resizeCanvas() {
    var wrapper = canvas.parentElement;
    var rect = wrapper.getBoundingClientRect();
    var dpr = window.devicePixelRatio || 1;

    canvasW = rect.width;
    canvasH = rect.height;

    canvas.width = canvasW * dpr;
    canvas.height = canvasH * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // ============================================
  // ユーティリティ
  // ============================================
  function rand(min, max) {
    return Math.random() * (max - min) + min;
  }

  function dist(x1, y1, x2, y2) {
    var dx = x1 - x2;
    var dy = y1 - y2;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // ============================================
  // 泡の生成
  // ============================================
  function createBubble() {
    return {
      x: rand(0, canvasW),
      y: canvasH + rand(0, 20),
      radius: rand(2, 6),
      speed: rand(0.2, 0.8),
      wobble: rand(0, Math.PI * 2),
      wobbleSpeed: rand(0.01, 0.03)
    };
  }

  function initBubbles() {
    bubbles = [];
    for (var i = 0; i < BUBBLE_COUNT; i++) {
      var b = createBubble();
      b.y = rand(0, canvasH);
      bubbles.push(b);
    }
  }

  // ============================================
  // NPC（魚）生成
  // ============================================
  function createFish(radius, x, y) {
    var angle = rand(0, Math.PI * 2);
    var speed = rand(NPC_SPEED_MIN, NPC_SPEED_MAX);

    return {
      x: x,
      y: y,
      radius: radius,
      score: Math.ceil(radius),
      color: FISH_COLORS[Math.floor(Math.random() * FISH_COLORS.length)],
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      changeTimer: rand(60, 180),
      tailPhase: rand(0, Math.PI * 2)
    };
  }

  function createNPC() {
    var radius = rand(NPC_MIN_RADIUS, NPC_MAX_RADIUS);

    if (player) {
      var r = Math.random();
      if (r < 0.6) {
        radius = rand(NPC_MIN_RADIUS, Math.max(player.radius * 0.9, NPC_MIN_RADIUS + 1));
      } else if (r < 0.85) {
        radius = rand(player.radius * 0.7, player.radius * 1.3);
      } else {
        radius = rand(player.radius * 1.1, player.radius * 2.5);
      }
      radius = Math.max(NPC_MIN_RADIUS, Math.min(radius, NPC_MAX_RADIUS * 2));
    }

    var edge = Math.floor(Math.random() * 4);
    var x, y;
    if (edge === 0) { x = rand(radius, canvasW - radius); y = -radius * 3; }
    else if (edge === 1) { x = rand(radius, canvasW - radius); y = canvasH + radius * 3; }
    else if (edge === 2) { x = -radius * 3; y = rand(radius, canvasH - radius); }
    else { x = canvasW + radius * 3; y = rand(radius, canvasH - radius); }

    var fish = createFish(radius, x, y);
    // 中心に向かう方向
    var angle = Math.atan2(canvasH / 2 - y + rand(-100, 100), canvasW / 2 - x + rand(-100, 100));
    var speed = rand(NPC_SPEED_MIN, NPC_SPEED_MAX);
    fish.vx = Math.cos(angle) * speed;
    fish.vy = Math.sin(angle) * speed;
    return fish;
  }

  function createInitialNPC() {
    var radius = rand(NPC_MIN_RADIUS, NPC_MAX_RADIUS);
    var r = Math.random();
    if (r < 0.65) {
      radius = rand(NPC_MIN_RADIUS, INITIAL_PLAYER_RADIUS * 0.9);
    } else if (r < 0.85) {
      radius = rand(INITIAL_PLAYER_RADIUS * 0.7, INITIAL_PLAYER_RADIUS * 1.3);
    } else {
      radius = rand(INITIAL_PLAYER_RADIUS * 1.2, INITIAL_PLAYER_RADIUS * 2.5);
    }
    radius = Math.max(NPC_MIN_RADIUS, Math.min(radius, NPC_MAX_RADIUS));

    var x = rand(radius + 10, canvasW - radius - 10);
    var y = rand(radius + 10, canvasH - radius - 10);

    if (dist(x, y, canvasW / 2, canvasH / 2) < INITIAL_PLAYER_RADIUS + radius + 30) {
      x = rand(radius + 10, canvasW - radius - 10);
      y = rand(radius + 10, canvasH - radius - 10);
    }

    return createFish(radius, x, y);
  }

  // ============================================
  // プレイヤー初期化
  // ============================================
  function initPlayer() {
    player = {
      x: canvasW / 2,
      y: canvasH / 2,
      radius: INITIAL_PLAYER_RADIUS,
      score: Math.ceil(INITIAL_PLAYER_RADIUS),
      color: '#3498DB',
      vx: 0,
      vy: 0,
      tailPhase: 0
    };
    targetX = player.x;
    targetY = player.y;
  }

  // ============================================
  // 更新
  // ============================================
  function update() {
    if (!gameRunning || gameOverFlag) return;

    frameCount++;

    // プレイヤー移動
    if (mouseActive) {
      var dx = targetX - player.x;
      var dy = targetY - player.y;
      var d = Math.sqrt(dx * dx + dy * dy);

      if (d > 1) {
        var speed = Math.min(PLAYER_SPEED + player.radius * 0.02, d * PLAYER_LERP + PLAYER_SPEED * 0.5);
        player.vx = (dx / d) * speed;
        player.vy = (dy / d) * speed;
        player.x += player.vx;
        player.y += player.vy;
      } else {
        player.vx = 0;
        player.vy = 0;
      }
    }

    player.tailPhase += 0.15;
    player.x = Math.max(player.radius, Math.min(canvasW - player.radius, player.x));
    player.y = Math.max(player.radius, Math.min(canvasH - player.radius, player.y));

    // NPC更新
    for (var i = npcs.length - 1; i >= 0; i--) {
      var npc = npcs[i];

      npc.tailPhase += 0.12;
      npc.changeTimer--;
      if (npc.changeTimer <= 0) {
        var angle = rand(0, Math.PI * 2);
        var speed = rand(NPC_SPEED_MIN, NPC_SPEED_MAX);
        npc.vx = Math.cos(angle) * speed;
        npc.vy = Math.sin(angle) * speed;
        npc.changeTimer = rand(60, 180);
      }

      npc.x += npc.vx;
      npc.y += npc.vy;

      // 壁で反射
      if (npc.x - npc.radius < 0) { npc.x = npc.radius; npc.vx *= -1; }
      if (npc.x + npc.radius > canvasW) { npc.x = canvasW - npc.radius; npc.vx *= -1; }
      if (npc.y - npc.radius < 0) { npc.y = npc.radius; npc.vy *= -1; }
      if (npc.y + npc.radius > canvasH) { npc.y = canvasH - npc.radius; npc.vy *= -1; }

      // プレイヤーとの衝突判定
      var d = dist(player.x, player.y, npc.x, npc.y);
      var touchDist = player.radius + npc.radius;

      if (d < touchDist * 0.7) {
        if (player.radius > npc.radius) {
          score += npc.score;
          player.score += npc.score;
          floatingTexts.push({
            x: npc.x, y: npc.y,
            text: '+' + npc.score,
            life: 1
          });
          player.radius += npc.radius * ABSORB_GROWTH / player.radius * 5;
          npcs.splice(i, 1);
          updateScore();
        } else {
          gameOver();
          return;
        }
      }
    }

    // フローティングテキスト更新
    for (var fi = floatingTexts.length - 1; fi >= 0; fi--) {
      var ft = floatingTexts[fi];
      ft.y -= 1.2;
      ft.life -= 0.025;
      if (ft.life <= 0) floatingTexts.splice(fi, 1);
    }

    // 泡の更新
    for (var j = 0; j < bubbles.length; j++) {
      var b = bubbles[j];
      b.y -= b.speed;
      b.wobble += b.wobbleSpeed;
      b.x += Math.sin(b.wobble) * 0.3;
      if (b.y < -10) {
        bubbles[j] = createBubble();
      }
    }

    // NPC定期生成
    var now = Date.now();
    if (now - lastSpawnTime > SPAWN_INTERVAL && npcs.length < MAX_NPC_COUNT) {
      npcs.push(createNPC());
      lastSpawnTime = now;
    }
  }

  // ============================================
  // 描画
  // ============================================
  function draw() {
    // 池の背景
    var grad = ctx.createLinearGradient(0, 0, 0, canvasH);
    grad.addColorStop(0, '#1a6b8a');
    grad.addColorStop(0.5, '#145a73');
    grad.addColorStop(1, '#0d3d52');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvasW, canvasH);

    // 水面の波紋（上部の光）
    drawWaterSurface();

    // 泡
    drawBubbles();

    // 水草
    drawSeaweed();

    // NPC描画（小さい順に描画）
    var sorted = npcs.slice().sort(function (a, b) { return a.radius - b.radius; });
    for (var i = 0; i < sorted.length; i++) {
      drawFish(sorted[i], false);
    }

    // プレイヤー描画
    if (player) {
      drawFish(player, true);
    }

    // フローティングテキスト描画
    for (var fi = 0; fi < floatingTexts.length; fi++) {
      var ft = floatingTexts[fi];
      ctx.save();
      ctx.globalAlpha = ft.life;
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FFD700';
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 3;
      ctx.strokeText(ft.text, ft.x, ft.y);
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }
  }

  function drawWaterSurface() {
    ctx.save();
    ctx.globalAlpha = 0.08;
    for (var i = 0; i < 5; i++) {
      var yy = 10 + i * 8;
      ctx.beginPath();
      ctx.moveTo(0, yy);
      for (var x = 0; x < canvasW; x += 20) {
        var wave = Math.sin((x + frameCount * 0.5 + i * 30) * 0.03) * 4;
        ctx.lineTo(x, yy + wave);
      }
      ctx.lineTo(canvasW, yy);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawBubbles() {
    ctx.save();
    for (var i = 0; i < bubbles.length; i++) {
      var b = bubbles[i];
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(b.x - b.radius * 0.3, b.y - b.radius * 0.3, b.radius * 0.25, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fill();
    }
    ctx.restore();
  }

  function drawSeaweed() {
    ctx.save();
    ctx.globalAlpha = 0.25;
    var count = Math.max(3, Math.floor(canvasW / 80));
    for (var i = 0; i < count; i++) {
      var baseX = (i + 0.5) * canvasW / count + Math.sin(i * 1.5) * 20;
      var baseY = canvasH;
      var h = 40 + (i % 3) * 25;
      ctx.beginPath();
      ctx.moveTo(baseX, baseY);
      var sway = Math.sin(frameCount * 0.02 + i * 2) * 8;
      ctx.quadraticCurveTo(baseX + sway, baseY - h * 0.5, baseX + sway * 1.2, baseY - h);
      ctx.strokeStyle = '#2ECC71';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawFish(fish, isPlayer) {
    ctx.save();

    var r = fish.radius;
    var facing = (fish.vx >= 0) ? 1 : -1;
    var tailSwing = Math.sin(fish.tailPhase) * 0.3;

    ctx.translate(fish.x, fish.y);
    ctx.scale(facing, 1);

    ctx.globalAlpha = isPlayer ? 0.92 : 0.78;

    // 魚体（楕円）
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.4, r * 0.85, 0, 0, Math.PI * 2);
    ctx.fillStyle = fish.color;
    ctx.fill();

    // 光沢
    ctx.beginPath();
    ctx.ellipse(-r * 0.2, -r * 0.25, r * 0.6, r * 0.3, -0.2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fill();

    // 尾びれ
    ctx.beginPath();
    var tailX = -r * 1.3;
    var tailTip = tailSwing * r * 0.8;
    ctx.moveTo(tailX, 0);
    ctx.lineTo(tailX - r * 0.7, -r * 0.6 + tailTip);
    ctx.lineTo(tailX - r * 0.1, 0);
    ctx.lineTo(tailX - r * 0.7, r * 0.6 + tailTip);
    ctx.closePath();
    ctx.fillStyle = fish.color;
    ctx.fill();

    // 背びれ
    ctx.beginPath();
    ctx.moveTo(r * 0.2, -r * 0.8);
    ctx.quadraticCurveTo(-r * 0.1, -r * 1.1, -r * 0.5, -r * 0.75);
    ctx.lineTo(-r * 0.1, -r * 0.6);
    ctx.closePath();
    ctx.fillStyle = fish.color;
    ctx.globalAlpha = isPlayer ? 0.7 : 0.5;
    ctx.fill();

    ctx.globalAlpha = isPlayer ? 0.92 : 0.78;

    // 目
    var eyeX = r * 0.6;
    var eyeY = -r * 0.15;
    var eyeR = Math.max(2, r * 0.2);
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, eyeR, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.globalAlpha = 1;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(eyeX + eyeR * 0.25, eyeY, eyeR * 0.55, 0, Math.PI * 2);
    ctx.fillStyle = '#111';
    ctx.fill();

    // プレイヤーの縁取り
    if (isPlayer) {
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 1.4, r * 0.85, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // スコア数字（反転を打ち消してから描画）
    ctx.scale(facing, 1);
    var sizeNum = fish.score || Math.ceil(r);
    var fontSize = Math.max(7, r * 0.45);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold ' + fontSize + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = 0.75;
    ctx.fillText(sizeNum, 0, r * 0.2);

    ctx.restore();
  }

  // ============================================
  // スコア
  // ============================================
  function updateScore() {
    scoreEl.textContent = score;
    if (score > bestScore) {
      bestScore = score;
      bestScoreEl.textContent = bestScore;
      localStorage.setItem('bestAbsorb', bestScore.toString());
    }
  }

  // ============================================
  // ゲーム開始
  // ============================================
  function startGame() {
    resizeCanvas();
    initPlayer();
    npcs = [];
    score = 0;
    gameOverFlag = false;
    mouseActive = false;
    frameCount = 0;
    floatingTexts = [];
    lastSpawnTime = Date.now();

    initBubbles();

    for (var i = 0; i < INITIAL_NPC_COUNT; i++) {
      npcs.push(createInitialNPC());
    }

    updateScore();
    gameOverOverlay.classList.remove('active');
    gameStartOverlay.classList.remove('active');

    gameRunning = true;
    if (animFrameId) cancelAnimationFrame(animFrameId);
    gameLoop();
  }

  // ============================================
  // ゲームオーバー
  // ============================================
  function gameOver() {
    gameRunning = false;
    gameOverFlag = true;

    if (animFrameId) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }

    finalScoreEl.textContent = score;
    if (score >= bestScore && score > 0) {
      bestResultEl.textContent = 'ハイスコア更新！';
    } else {
      bestResultEl.textContent = 'ベスト: ' + bestScore;
    }

    setTimeout(function () {
      gameOverOverlay.classList.add('active');
    }, 300);
  }

  // ============================================
  // ゲームループ
  // ============================================
  function gameLoop() {
    update();
    draw();
    if (gameRunning && !gameOverFlag) {
      animFrameId = requestAnimationFrame(gameLoop);
    }
  }

  // ============================================
  // イベントリスナー
  // ============================================
  canvas.addEventListener('mousemove', function (e) {
    if (!gameRunning) return;
    var rect = canvas.getBoundingClientRect();
    targetX = e.clientX - rect.left;
    targetY = e.clientY - rect.top;
    mouseActive = true;
  });

  canvas.addEventListener('touchstart', function (e) {
    e.preventDefault();
    if (!gameRunning) return;
    var rect = canvas.getBoundingClientRect();
    targetX = e.touches[0].clientX - rect.left;
    targetY = e.touches[0].clientY - rect.top;
    mouseActive = true;
  }, { passive: false });

  canvas.addEventListener('touchmove', function (e) {
    e.preventDefault();
    if (!gameRunning) return;
    var rect = canvas.getBoundingClientRect();
    targetX = e.touches[0].clientX - rect.left;
    targetY = e.touches[0].clientY - rect.top;
  }, { passive: false });

  canvas.addEventListener('touchend', function (e) {
    e.preventDefault();
  }, { passive: false });

  document.getElementById('btn-new-game').addEventListener('click', function () {
    startGame();
  });

  document.getElementById('btn-retry').addEventListener('click', function () {
    startGame();
  });

  document.getElementById('btn-start').addEventListener('click', function () {
    startGame();
  });

  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      var oldW = canvasW;
      var oldH = canvasH;
      resizeCanvas();

      if (player && oldW > 0 && oldH > 0) {
        player.x = player.x * (canvasW / oldW);
        player.y = player.y * (canvasH / oldH);
        targetX = player.x;
        targetY = player.y;
      }

      for (var i = 0; i < npcs.length; i++) {
        npcs[i].x = npcs[i].x * (canvasW / oldW);
        npcs[i].y = npcs[i].y * (canvasH / oldH);
      }

      if (!gameRunning) {
        draw();
      }
    }, 100);
  });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden && gameRunning) {
      if (animFrameId) {
        cancelAnimationFrame(animFrameId);
        animFrameId = null;
      }
      gameRunning = false;
    }
  });

  // ============================================
  // 初期化
  // ============================================
  bestScoreEl.textContent = bestScore;
  resizeCanvas();
  initBubbles();
  draw();
})();
