// ============================================
// スライムジャンパー ゲームロジック
// ============================================

(function () {
  'use strict';

  // ============================================
  // 定数
  // ============================================
  var GRAVITY = 0.35;
  var JUMP_FORCE = -9.5;
  var SPRING_FORCE = -14;
  var MOVE_SPEED = 5;
  var PLATFORM_WIDTH_RATIO = 0.15;
  var PLATFORM_HEIGHT = 12;
  var PLATFORM_COUNT = 8;
  var SLIME_WIDTH = 30;
  var SLIME_HEIGHT = 24;

  // 足場タイプ
  var PLAT_NORMAL = 0;
  var PLAT_MOVING = 1;
  var PLAT_BREAK = 2;
  var PLAT_SPRING = 3;

  // ============================================
  // 状態変数
  // ============================================
  var canvas, ctx, W, H, dpr;
  var running = false;
  var score = 0;
  var bestScore = 0;
  var player, platforms, particles;
  var cameraY = 0;
  var maxHeight = 0;
  var lastGeneratedBreak = false;
  var keysDown = {};
  var touchX = null;
  var tiltX = 0;
  var useTilt = false;
  var animId = null;
  var stars = [];

  // ============================================
  // DOM参照
  // ============================================
  var elScore = document.getElementById('score');
  var elBest = document.getElementById('best-score');
  var elFinal = document.getElementById('final-score');
  var elBestResult = document.getElementById('best-result');
  var elStartOverlay = document.getElementById('game-start-overlay');
  var elOverOverlay = document.getElementById('game-over-overlay');
  var elBtnStart = document.getElementById('btn-start');
  var elBtnRetry = document.getElementById('btn-retry');
  var elBtnNew = document.getElementById('btn-new-game');

  // ============================================
  // ハイスコア
  // ============================================
  function loadBest() {
    var v = localStorage.getItem('bestSlimeJump');
    bestScore = v ? parseInt(v, 10) : 0;
    elBest.textContent = bestScore;
  }

  function saveBest() {
    if (score > bestScore) {
      bestScore = score;
      localStorage.setItem('bestSlimeJump', bestScore);
      elBest.textContent = bestScore;
    }
  }

  // ============================================
  // Canvas初期化
  // ============================================
  function initCanvas() {
    canvas = document.getElementById('game-canvas');
    ctx = canvas.getContext('2d');
    dpr = window.devicePixelRatio || 1;
    var rect = canvas.getBoundingClientRect();
    W = rect.width;
    H = rect.height;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);
  }

  // ============================================
  // 背景の星
  // ============================================
  function initStars() {
    stars = [];
    for (var i = 0; i < 60; i++) {
      stars.push({
        x: Math.random() * W,
        y: Math.random() * H * 3,
        r: Math.random() * 1.5 + 0.5,
        a: Math.random() * 0.5 + 0.3
      });
    }
  }

  function drawStars() {
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      var sy = ((s.y - cameraY * 0.3) % (H * 3) + H * 3) % (H * 3) - H;
      if (sy < -5 || sy > H + 5) continue;
      ctx.beginPath();
      ctx.arc(s.x, sy, s.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,' + s.a + ')';
      ctx.fill();
    }
  }

  // ============================================
  // 足場生成
  // ============================================
  function createPlatform(x, y, type) {
    var pw = W * PLATFORM_WIDTH_RATIO;
    return {
      x: x,
      y: y,
      w: pw,
      h: PLATFORM_HEIGHT,
      type: type || PLAT_NORMAL,
      broken: false,
      cracked: false,
      moveDir: (Math.random() < 0.5 ? 1 : -1),
      moveSpeed: 1 + Math.random() * 1.5
    };
  }

  function generatePlatforms() {
    platforms = [];
    var pw = W * PLATFORM_WIDTH_RATIO;
    // 最初の足場（プレイヤーの真下）
    platforms.push(createPlatform(W / 2 - pw / 2, H - 50, PLAT_NORMAL));

    var spacing = H / PLATFORM_COUNT;
    var lastWasBreak = false;
    for (var i = 1; i < PLATFORM_COUNT * 3; i++) {
      var px = Math.random() * (W - pw);
      var py = H - 50 - i * spacing;
      var type = PLAT_NORMAL;
      var r = Math.random();
      if (i > 5) {
        if (r < 0.15) type = PLAT_MOVING;
        else if (r < 0.25 && !lastWasBreak) type = PLAT_BREAK;
        else if (r < 0.32) type = PLAT_SPRING;
      }
      lastWasBreak = (type === PLAT_BREAK);
      platforms.push(createPlatform(px, py, type));
    }
  }

  // ============================================
  // プレイヤー
  // ============================================
  function createPlayer() {
    var pw = W * PLATFORM_WIDTH_RATIO;
    return {
      x: W / 2 - SLIME_WIDTH / 2,
      y: H - 50 - SLIME_HEIGHT,
      w: SLIME_WIDTH,
      h: SLIME_HEIGHT,
      vy: JUMP_FORCE,
      vx: 0,
      squash: 0
    };
  }

  // ============================================
  // パーティクル
  // ============================================
  function spawnParticles(x, y, color, count) {
    for (var i = 0; i < count; i++) {
      particles.push({
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4 - 2,
        life: 1,
        color: color,
        r: Math.random() * 3 + 1
      });
    }
  }

  function updateParticles() {
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.03;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function drawParticles() {
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      var py = p.y - cameraY;
      ctx.globalAlpha = p.life;
      ctx.beginPath();
      ctx.arc(p.x, py, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ============================================
  // 描画
  // ============================================
  function drawPlatform(p) {
    var py = p.y - cameraY;
    if (py < -20 || py > H + 20) return;
    if (p.broken) return;

    ctx.save();
    var drawX = p.x;
    if (p.type === PLAT_BREAK && p.cracked) {
      drawX += (Math.random() - 0.5) * 3;
      py += (Math.random() - 0.5) * 2;
    }
    var r = 5;
    ctx.beginPath();
    ctx.roundRect(drawX, py, p.w, p.h, r);

    switch (p.type) {
      case PLAT_NORMAL:
        ctx.fillStyle = '#2ECC71';
        break;
      case PLAT_MOVING:
        ctx.fillStyle = '#3498DB';
        break;
      case PLAT_BREAK:
        ctx.fillStyle = p.cracked ? '#C0392B' : '#E67E22';
        break;
      case PLAT_SPRING:
        ctx.fillStyle = '#2ECC71';
        break;
    }
    ctx.fill();

    // 足場の模様
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(drawX + 3, py + 2, p.w - 6, 3);

    // ヒビ模様
    if (p.type === PLAT_BREAK && p.cracked) {
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(drawX + p.w * 0.3, py);
      ctx.lineTo(drawX + p.w * 0.4, py + p.h * 0.6);
      ctx.lineTo(drawX + p.w * 0.5, py + p.h);
      ctx.moveTo(drawX + p.w * 0.6, py);
      ctx.lineTo(drawX + p.w * 0.55, py + p.h * 0.5);
      ctx.lineTo(drawX + p.w * 0.7, py + p.h);
      ctx.stroke();
    }

    // バネ
    if (p.type === PLAT_SPRING) {
      var sx = p.x + p.w / 2;
      ctx.fillStyle = '#E74C3C';
      ctx.beginPath();
      ctx.arc(sx, py - 4, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#C0392B';
      ctx.fillRect(sx - 2, py - 2, 4, 4);
    }

    ctx.restore();
  }

  function drawSlime() {
    var px = player.x;
    var py = player.y - cameraY;
    var w = player.w;
    var h = player.h;

    // スクワッシュ効果
    var sq = player.squash;
    var sw = w * (1 + sq * 0.3);
    var sh = h * (1 - sq * 0.2);
    var sx = px + w / 2 - sw / 2;
    var sy = py + h - sh;

    ctx.save();

    // 影
    ctx.beginPath();
    ctx.ellipse(px + w / 2, py + h + 2, sw / 2 * 0.8, 3, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fill();

    // スライムの体（半円 + 楕円）
    ctx.beginPath();
    ctx.ellipse(px + w / 2, sy + sh * 0.6, sw / 2, sh * 0.6, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#2ECC71';
    ctx.fill();

    // 上半分のハイライト
    ctx.beginPath();
    ctx.ellipse(px + w / 2, sy + sh * 0.4, sw / 2 * 0.7, sh * 0.35, 0, Math.PI, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fill();

    // 目
    var eyeOffX = sw * 0.15;
    var eyeY = sy + sh * 0.4;
    // 左目
    ctx.beginPath();
    ctx.ellipse(px + w / 2 - eyeOffX, eyeY, 4, 5, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(px + w / 2 - eyeOffX + 1, eyeY + 1, 2, 0, Math.PI * 2);
    ctx.fillStyle = '#1a1a2e';
    ctx.fill();
    // 右目
    ctx.beginPath();
    ctx.ellipse(px + w / 2 + eyeOffX, eyeY, 4, 5, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(px + w / 2 + eyeOffX + 1, eyeY + 1, 2, 0, Math.PI * 2);
    ctx.fillStyle = '#1a1a2e';
    ctx.fill();

    // 口（落下中は驚き顔）
    if (player.vy > 2) {
      ctx.beginPath();
      ctx.arc(px + w / 2, eyeY + 10, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#c0392b';
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(px + w / 2, eyeY + 8, 4, 0, Math.PI);
      ctx.strokeStyle = '#27ae60';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    ctx.restore();
  }

  // ============================================
  // 高さスコアライン
  // ============================================
  function drawHeightMarkers() {
    ctx.save();
    ctx.font = '10px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.textAlign = 'right';
    var startH = Math.floor(cameraY / 100) * 100;
    for (var h = startH; h < startH + H + 200; h += 100) {
      var sy = h - cameraY;
      if (sy < 0 || sy > H) continue;
      var m = Math.floor((H - 50 - h) / 10);
      if (m <= 0) continue;
      ctx.fillRect(0, sy, W, 0.5);
      ctx.fillText(m + 'm', W - 5, sy - 3);
    }
    ctx.restore();
  }

  // ============================================
  // ゲームループ
  // ============================================
  function update() {
    // プレイヤーの左右移動
    var moveX = 0;
    if (keysDown['ArrowLeft'] || keysDown['KeyA']) moveX = -MOVE_SPEED;
    if (keysDown['ArrowRight'] || keysDown['KeyD']) moveX = MOVE_SPEED;

    if (useTilt) {
      moveX += tiltX * MOVE_SPEED * 0.5;
    }

    if (touchX !== null) {
      var center = player.x + player.w / 2;
      if (touchX < center - 10) moveX = -MOVE_SPEED;
      else if (touchX > center + 10) moveX = MOVE_SPEED;
    }

    player.x += moveX;

    // 画面端ループ
    if (player.x + player.w < 0) player.x = W;
    if (player.x > W) player.x = -player.w;

    // 重力
    player.vy += GRAVITY;
    player.y += player.vy;

    // スクワッシュ減衰
    player.squash *= 0.85;

    // 足場との衝突判定（落下中のみ）
    if (player.vy > 0) {
      for (var i = 0; i < platforms.length; i++) {
        var p = platforms[i];
        if (p.broken) continue;

        var px = player.x;
        var pw = player.w;
        var py = player.y + player.h;
        var prevPy = py - player.vy;

        if (px + pw > p.x && px < p.x + p.w &&
            py >= p.y && prevPy <= p.y) {

          if (p.type === PLAT_BREAK && p.cracked) {
            p.broken = true;
            spawnParticles(p.x + p.w / 2, p.y, '#E67E22', 8);
            continue;
          }

          player.y = p.y - player.h;
          if (p.type === PLAT_BREAK) {
            p.cracked = true;
            player.vy = JUMP_FORCE;
            player.squash = 0.5;
            spawnParticles(player.x + player.w / 2, player.y + player.h, '#E67E22', 4);
          } else if (p.type === PLAT_SPRING) {
            player.vy = SPRING_FORCE;
            player.squash = 0.8;
            spawnParticles(player.x + player.w / 2, player.y + player.h, '#E74C3C', 6);
          } else {
            player.vy = JUMP_FORCE;
            player.squash = 0.5;
          }
          spawnParticles(player.x + player.w / 2, player.y + player.h, '#2ECC71', 4);
        }
      }
    }

    // 足場の移動
    for (var i = 0; i < platforms.length; i++) {
      var p = platforms[i];
      if (p.type === PLAT_MOVING && !p.broken) {
        p.x += p.moveDir * p.moveSpeed;
        if (p.x < 0 || p.x + p.w > W) {
          p.moveDir *= -1;
        }
      }
    }

    // カメラ追従
    var targetY = player.y - H * 0.35;
    if (targetY < cameraY) {
      cameraY += (targetY - cameraY) * 0.1;
    }

    // スコア更新
    var currentHeight = Math.floor((H - 50 - player.y) / 10);
    if (currentHeight > score) {
      score = currentHeight;
      elScore.textContent = score;
    }

    // 新しい足場を上に生成
    var topY = cameraY - 100;
    var highestPlatY = Infinity;
    for (var i = 0; i < platforms.length; i++) {
      if (!platforms[i].broken && platforms[i].y < highestPlatY) {
        highestPlatY = platforms[i].y;
      }
    }

    var spacing = H / PLATFORM_COUNT;
    while (highestPlatY > topY) {
      var pw = W * PLATFORM_WIDTH_RATIO;
      var nx = Math.random() * (W - pw);
      var ny = highestPlatY - spacing * (0.7 + Math.random() * 0.6);

      var type = PLAT_NORMAL;
      var difficulty = Math.min(score / 200, 1);
      var r = Math.random();
      if (r < 0.12 + difficulty * 0.08) type = PLAT_MOVING;
      else if (r < 0.18 + difficulty * 0.07 && !lastGeneratedBreak) type = PLAT_BREAK;
      else if (r < 0.26 + difficulty * 0.04) type = PLAT_SPRING;
      lastGeneratedBreak = (type === PLAT_BREAK);

      // 高スコアで足場を狭くする
      var widthMult = Math.max(0.7, 1 - difficulty * 0.3);

      var plat = createPlatform(nx, ny, type);
      plat.w *= widthMult;
      platforms.push(plat);
      highestPlatY = ny;
    }

    // 画面外の足場を削除
    for (var i = platforms.length - 1; i >= 0; i--) {
      if (platforms[i].y > cameraY + H + 100) {
        platforms.splice(i, 1);
      }
    }

    // パーティクル更新
    updateParticles();

    // ゲームオーバー判定
    if (player.y - cameraY > H + 50) {
      gameOver();
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    // 背景グラデーション
    var grad = ctx.createLinearGradient(0, 0, 0, H);
    var depth = Math.min(score / 300, 1);
    grad.addColorStop(0, 'rgb(' + Math.floor(10 + depth * 10) + ',' + Math.floor(10 + depth * 5) + ',' + Math.floor(30 + depth * 20) + ')');
    grad.addColorStop(1, '#1a1a2e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    drawStars();
    drawHeightMarkers();

    // 足場描画
    for (var i = 0; i < platforms.length; i++) {
      drawPlatform(platforms[i]);
    }

    // パーティクル
    drawParticles();

    // スライム
    drawSlime();
  }

  function gameLoop() {
    if (!running) return;
    update();
    draw();
    animId = requestAnimationFrame(gameLoop);
  }

  // ============================================
  // ゲーム制御
  // ============================================
  function startGame() {
    initCanvas();
    initStars();
    score = 0;
    cameraY = 0;
    maxHeight = 0;
    lastGeneratedBreak = false;
    elScore.textContent = '0';
    particles = [];
    generatePlatforms();
    player = createPlayer();
    running = true;
    elStartOverlay.classList.remove('active');
    elOverOverlay.classList.remove('active');
    if (animId) cancelAnimationFrame(animId);
    gameLoop();
  }

  function gameOver() {
    running = false;
    saveBest();
    elFinal.textContent = score;
    if (score >= bestScore) {
      elBestResult.textContent = '🎉 ハイスコア更新！';
    } else {
      elBestResult.textContent = 'ベスト: ' + bestScore;
    }
    elOverOverlay.classList.add('active');
  }

  // ============================================
  // イベント
  // ============================================
  document.addEventListener('keydown', function (e) {
    keysDown[e.code] = true;
    if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') e.preventDefault();
  });

  document.addEventListener('keyup', function (e) {
    keysDown[e.code] = false;
  });

  // タッチ操作
  initCanvas();

  canvas.addEventListener('touchstart', function (e) {
    e.preventDefault();
    var rect = canvas.getBoundingClientRect();
    touchX = e.touches[0].clientX - rect.left;
  });

  canvas.addEventListener('touchmove', function (e) {
    e.preventDefault();
    var rect = canvas.getBoundingClientRect();
    touchX = e.touches[0].clientX - rect.left;
  });

  canvas.addEventListener('touchend', function (e) {
    e.preventDefault();
    touchX = null;
  });

  // ジャイロスコープ
  if (window.DeviceOrientationEvent) {
    window.addEventListener('deviceorientation', function (e) {
      if (e.gamma !== null) {
        useTilt = true;
        tiltX = Math.max(-1, Math.min(1, e.gamma / 30));
      }
    });
  }

  // リサイズ
  window.addEventListener('resize', function () {
    initCanvas();
    initStars();
  });

  // ボタン
  elBtnStart.addEventListener('click', startGame);
  elBtnRetry.addEventListener('click', startGame);
  elBtnNew.addEventListener('click', startGame);

  // 初期化
  loadBest();
  initCanvas();
  initStars();

  // 初期描画
  (function () {
    var grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#1a1a2e');
    grad.addColorStop(1, '#16213e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    drawStars();
  })();

})();
