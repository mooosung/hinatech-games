// ============================================
// シューティング ゲームロジック
// ============================================

(function () {
  'use strict';

  // ============================================
  // 定数
  // ============================================
  var MAX_LIVES = 3;
  var POINTS_PER_ENEMY = 10;
  var PLAYER_SPEED_RATIO = 0.012;
  var BULLET_SPEED = 7;
  var BULLET_WIDTH = 3;
  var BULLET_HEIGHT = 10;
  var FIRE_INTERVAL = 180; // ミリ秒
  var INITIAL_ENEMY_SPEED = 1.5;
  var INITIAL_SPAWN_INTERVAL = 1200; // ミリ秒
  var MIN_SPAWN_INTERVAL = 400;
  var SPEED_INCREASE_PER_SCORE = 0.02;
  var SPAWN_DECREASE_PER_SCORE = 5;

  // 敵の種類
  var ENEMY_TYPES = [
    { width: 0.06, height: 0.04, color: '#E74C3C', shape: 'rect' },     // 赤い四角（小）
    { width: 0.08, height: 0.05, color: '#E67E22', shape: 'rect' },     // オレンジ四角（中）
    { width: 0.10, height: 0.06, color: '#9B59B6', shape: 'rect' },     // 紫四角（大）
    { width: 0.05, height: 0.05, color: '#3498DB', shape: 'circle' },   // 青い丸（小）
    { width: 0.07, height: 0.07, color: '#2ECC71', shape: 'circle' },   // 緑の丸（中）
    { width: 0.09, height: 0.09, color: '#F1C40F', shape: 'circle' }    // 黄色い丸（大）
  ];

  // ============================================
  // 状態変数
  // ============================================
  var canvas, ctx;
  var canvasWidth, canvasHeight;
  var playerX, playerY, playerWidth, playerHeight, playerSpeed;
  var bullets = [];
  var enemies = [];
  var particles = [];
  var stars = [];
  var score = 0;
  var bestScore = parseInt(localStorage.getItem('bestShooting') || '0', 10);
  var lives = MAX_LIVES;
  var gameRunning = false;
  var gameOverFlag = false;
  var animationId = null;
  var lastFireTime = 0;
  var lastSpawnTime = 0;
  var spawnInterval = INITIAL_SPAWN_INTERVAL;
  var enemySpeed = INITIAL_ENEMY_SPEED;

  // 入力状態
  var leftPressed = false;
  var rightPressed = false;
  var spacePressed = false;
  var touchSide = null; // 'left', 'right', null

  // ============================================
  // DOM要素
  // ============================================
  var scoreEl = document.getElementById('score');
  var bestScoreEl = document.getElementById('best-score');
  var livesDisplay = document.getElementById('lives-display');
  var gameOverOverlay = document.getElementById('game-over-overlay');
  var gameStartOverlay = document.getElementById('game-start-overlay');
  var finalScoreEl = document.getElementById('final-score');
  var bestResultEl = document.getElementById('best-result');

  // ============================================
  // キャンバスの初期化
  // ============================================
  function initCanvas() {
    canvas = document.getElementById('game-canvas');
    ctx = canvas.getContext('2d');
    resizeCanvas();
  }

  function resizeCanvas() {
    var wrapper = canvas.parentElement;
    var rect = wrapper.getBoundingClientRect();
    var dpr = window.devicePixelRatio || 1;

    canvasWidth = rect.width;
    canvasHeight = rect.height;

    canvas.width = canvasWidth * dpr;
    canvas.height = canvasHeight * dpr;
    canvas.style.width = canvasWidth + 'px';
    canvas.style.height = canvasHeight + 'px';

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // プレイヤーサイズの再計算
    playerWidth = canvasWidth * 0.08;
    playerHeight = canvasWidth * 0.10;
    playerSpeed = canvasWidth * PLAYER_SPEED_RATIO;

    // プレイヤー位置の制約
    if (playerX !== undefined) {
      if (playerX < playerWidth / 2) playerX = playerWidth / 2;
      if (playerX > canvasWidth - playerWidth / 2) playerX = canvasWidth - playerWidth / 2;
    }

    // 背景の星を生成
    initStars();
  }

  // ============================================
  // 背景の星
  // ============================================
  function initStars() {
    stars = [];
    var numStars = Math.floor(canvasWidth * canvasHeight / 800);
    for (var i = 0; i < numStars; i++) {
      stars.push({
        x: Math.random() * canvasWidth,
        y: Math.random() * canvasHeight,
        size: Math.random() * 1.5 + 0.5,
        speed: Math.random() * 0.5 + 0.2,
        alpha: Math.random() * 0.5 + 0.3
      });
    }
  }

  function updateStars() {
    for (var i = 0; i < stars.length; i++) {
      var star = stars[i];
      star.y += star.speed;
      if (star.y > canvasHeight) {
        star.y = 0;
        star.x = Math.random() * canvasWidth;
      }
    }
  }

  function drawStars() {
    for (var i = 0; i < stars.length; i++) {
      var star = stars[i];
      ctx.fillStyle = 'rgba(255, 255, 255, ' + star.alpha + ')';
      ctx.fillRect(star.x, star.y, star.size, star.size);
    }
  }

  // ============================================
  // プレイヤーの初期化
  // ============================================
  function initPlayer() {
    playerX = canvasWidth / 2;
    playerY = canvasHeight - playerHeight - 20;
  }

  // ============================================
  // プレイヤーの描画（三角形の自機）
  // ============================================
  function drawPlayer() {
    var x = playerX;
    var y = playerY;
    var w = playerWidth;
    var h = playerHeight;

    // 機体本体（三角形）
    ctx.fillStyle = '#E67E22';
    ctx.beginPath();
    ctx.moveTo(x, y - h / 2);             // 上頂点
    ctx.lineTo(x - w / 2, y + h / 2);     // 左下
    ctx.lineTo(x + w / 2, y + h / 2);     // 右下
    ctx.closePath();
    ctx.fill();

    // コックピット（内側の小さな三角形）
    ctx.fillStyle = '#F39C12';
    ctx.beginPath();
    ctx.moveTo(x, y - h / 4);
    ctx.lineTo(x - w / 4, y + h / 4);
    ctx.lineTo(x + w / 4, y + h / 4);
    ctx.closePath();
    ctx.fill();

    // エンジン噴射（小さなフレーム）
    var flameHeight = 4 + Math.random() * 4;
    ctx.fillStyle = '#E74C3C';
    ctx.beginPath();
    ctx.moveTo(x - w / 6, y + h / 2);
    ctx.lineTo(x, y + h / 2 + flameHeight);
    ctx.lineTo(x + w / 6, y + h / 2);
    ctx.closePath();
    ctx.fill();
  }

  // ============================================
  // 弾の管理
  // ============================================
  function fireBullet() {
    var now = Date.now();
    if (now - lastFireTime < FIRE_INTERVAL) return;
    lastFireTime = now;

    bullets.push({
      x: playerX - BULLET_WIDTH / 2,
      y: playerY - playerHeight / 2 - BULLET_HEIGHT,
      width: BULLET_WIDTH,
      height: BULLET_HEIGHT
    });
  }

  function updateBullets() {
    for (var i = bullets.length - 1; i >= 0; i--) {
      bullets[i].y -= BULLET_SPEED;
      if (bullets[i].y + bullets[i].height < 0) {
        bullets.splice(i, 1);
      }
    }
  }

  function drawBullets() {
    ctx.fillStyle = '#F1C40F';
    for (var i = 0; i < bullets.length; i++) {
      var b = bullets[i];
      ctx.fillRect(b.x, b.y, b.width, b.height);
      // 光る弾のエフェクト
      ctx.fillStyle = 'rgba(241, 196, 15, 0.4)';
      ctx.fillRect(b.x - 1, b.y, b.width + 2, b.height);
      ctx.fillStyle = '#F1C40F';
    }
  }

  // ============================================
  // 敵の管理
  // ============================================
  function spawnEnemy() {
    var now = Date.now();
    if (now - lastSpawnTime < spawnInterval) return;
    lastSpawnTime = now;

    var type = ENEMY_TYPES[Math.floor(Math.random() * ENEMY_TYPES.length)];
    var w = canvasWidth * type.width;
    var h = canvasHeight * type.height;
    var x = Math.random() * (canvasWidth - w) + w / 2;

    enemies.push({
      x: x,
      y: -h,
      width: w,
      height: h,
      color: type.color,
      shape: type.shape,
      speed: enemySpeed + Math.random() * 0.5
    });
  }

  function updateEnemies() {
    for (var i = enemies.length - 1; i >= 0; i--) {
      enemies[i].y += enemies[i].speed;

      // 画面下に到達
      if (enemies[i].y - enemies[i].height / 2 > canvasHeight) {
        enemies.splice(i, 1);
        loseLife();
        continue;
      }

      // プレイヤーとの衝突判定
      if (checkCollision(enemies[i])) {
        spawnParticles(enemies[i].x, enemies[i].y, enemies[i].color);
        enemies.splice(i, 1);
        loseLife();
      }
    }
  }

  function drawEnemies() {
    for (var i = 0; i < enemies.length; i++) {
      var e = enemies[i];
      ctx.fillStyle = e.color;

      if (e.shape === 'circle') {
        var radius = e.width / 2;
        ctx.beginPath();
        ctx.arc(e.x, e.y, radius, 0, Math.PI * 2);
        ctx.fill();

        // ハイライト
        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.beginPath();
        ctx.arc(e.x - radius * 0.2, e.y - radius * 0.2, radius * 0.4, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // 角丸四角形
        var x = e.x - e.width / 2;
        var y = e.y - e.height / 2;
        ctx.beginPath();
        roundRect(ctx, x, y, e.width, e.height, 3);
        ctx.fill();

        // ハイライト（上辺）
        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.fillRect(x + 1, y + 1, e.width - 2, 2);
      }
    }
  }

  // ============================================
  // 弾と敵の衝突判定
  // ============================================
  function checkBulletEnemyCollisions() {
    for (var i = enemies.length - 1; i >= 0; i--) {
      var e = enemies[i];
      for (var j = bullets.length - 1; j >= 0; j--) {
        var b = bullets[j];
        var hit = false;

        if (e.shape === 'circle') {
          // 弾の中心と敵円の距離
          var bCenterX = b.x + b.width / 2;
          var bCenterY = b.y + b.height / 2;
          var dx = bCenterX - e.x;
          var dy = bCenterY - e.y;
          var dist = Math.sqrt(dx * dx + dy * dy);
          hit = dist < e.width / 2 + b.width / 2;
        } else {
          // 矩形同士
          hit = b.x < e.x + e.width / 2 &&
                b.x + b.width > e.x - e.width / 2 &&
                b.y < e.y + e.height / 2 &&
                b.y + b.height > e.y - e.height / 2;
        }

        if (hit) {
          // パーティクルエフェクト
          spawnParticles(e.x, e.y, e.color);

          enemies.splice(i, 1);
          bullets.splice(j, 1);

          score += POINTS_PER_ENEMY;
          updateScore();
          updateDifficulty();
          break; // この敵は破壊済み、次の敵へ
        }
      }
    }
  }

  // ============================================
  // プレイヤーとの衝突判定
  // ============================================
  function checkCollision(enemy) {
    // 簡略化: プレイヤーを中心座標＋矩形で判定
    var px1 = playerX - playerWidth / 2;
    var py1 = playerY - playerHeight / 2;
    var px2 = playerX + playerWidth / 2;
    var py2 = playerY + playerHeight / 2;

    if (enemy.shape === 'circle') {
      var radius = enemy.width / 2;
      // 円 vs 矩形
      var closestX = Math.max(px1, Math.min(enemy.x, px2));
      var closestY = Math.max(py1, Math.min(enemy.y, py2));
      var dx = enemy.x - closestX;
      var dy = enemy.y - closestY;
      return (dx * dx + dy * dy) < (radius * radius);
    } else {
      // 矩形 vs 矩形
      var ex1 = enemy.x - enemy.width / 2;
      var ey1 = enemy.y - enemy.height / 2;
      var ex2 = enemy.x + enemy.width / 2;
      var ey2 = enemy.y + enemy.height / 2;

      return px1 < ex2 && px2 > ex1 && py1 < ey2 && py2 > ey1;
    }
  }

  // ============================================
  // パーティクルエフェクト（敵撃破時）
  // ============================================
  function spawnParticles(x, y, color) {
    var count = 8;
    for (var i = 0; i < count; i++) {
      var angle = (Math.PI * 2 / count) * i + Math.random() * 0.5;
      var speed = 1.5 + Math.random() * 2;
      particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        decay: 0.02 + Math.random() * 0.02,
        size: 2 + Math.random() * 3,
        color: color
      });
    }
  }

  function updateParticles() {
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= p.decay;
      if (p.life <= 0) {
        particles.splice(i, 1);
      }
    }
  }

  function drawParticles() {
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1.0;
  }

  // ============================================
  // 難易度の更新
  // ============================================
  function updateDifficulty() {
    enemySpeed = INITIAL_ENEMY_SPEED + score * SPEED_INCREASE_PER_SCORE;
    spawnInterval = Math.max(MIN_SPAWN_INTERVAL, INITIAL_SPAWN_INTERVAL - score * SPAWN_DECREASE_PER_SCORE);
  }

  // ============================================
  // ライフを失う
  // ============================================
  function loseLife() {
    lives--;
    renderLives();

    if (lives <= 0) {
      gameOver();
    }
  }

  // ============================================
  // ライフ表示の更新
  // ============================================
  function renderLives() {
    livesDisplay.innerHTML = '';
    for (var i = 0; i < MAX_LIVES; i++) {
      var icon = document.createElement('div');
      icon.className = 'life-icon';
      if (i >= lives) {
        icon.classList.add('lost');
      }
      livesDisplay.appendChild(icon);
    }
  }

  // ============================================
  // スコアの更新
  // ============================================
  function updateScore() {
    scoreEl.textContent = score;
    if (score > bestScore) {
      bestScore = score;
      localStorage.setItem('bestShooting', bestScore.toString());
    }
    bestScoreEl.textContent = bestScore;
  }

  // ============================================
  // 角丸矩形のヘルパー
  // ============================================
  function roundRect(ctx, x, y, w, h, r) {
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // ============================================
  // プレイヤーの更新
  // ============================================
  function updatePlayer() {
    if (leftPressed || touchSide === 'left') {
      playerX -= playerSpeed;
    }
    if (rightPressed || touchSide === 'right') {
      playerX += playerSpeed;
    }

    // 画面外に出ないように制約
    if (playerX < playerWidth / 2) playerX = playerWidth / 2;
    if (playerX > canvasWidth - playerWidth / 2) playerX = canvasWidth - playerWidth / 2;

    // 自動発射（スマホのタッチ時、またはPC）
    if (spacePressed || touchSide !== null) {
      fireBullet();
    }
  }

  // ============================================
  // メインの描画
  // ============================================
  function draw() {
    // キャンバスをクリア
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // 背景（宇宙）
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // 背景の星
    drawStars();

    // ゲーム要素の描画
    drawBullets();
    drawEnemies();
    drawPlayer();
    drawParticles();
  }

  // ============================================
  // ゲームループ
  // ============================================
  function gameLoop() {
    if (!gameRunning || gameOverFlag) return;

    updateStars();
    updatePlayer();
    updateBullets();
    spawnEnemy();
    updateEnemies();
    checkBulletEnemyCollisions();
    updateParticles();
    draw();

    animationId = requestAnimationFrame(gameLoop);
  }

  // ============================================
  // ゲームオーバー
  // ============================================
  function gameOver() {
    gameRunning = false;
    gameOverFlag = true;

    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
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
  // ゲーム開始・リスタート
  // ============================================
  function startGame() {
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }

    // 状態をリセット
    score = 0;
    lives = MAX_LIVES;
    gameOverFlag = false;
    leftPressed = false;
    rightPressed = false;
    spacePressed = false;
    touchSide = null;
    bullets = [];
    enemies = [];
    particles = [];
    lastFireTime = 0;
    lastSpawnTime = 0;
    enemySpeed = INITIAL_ENEMY_SPEED;
    spawnInterval = INITIAL_SPAWN_INTERVAL;

    updateScore();
    renderLives();

    // オーバーレイを非表示
    gameOverOverlay.classList.remove('active');
    gameStartOverlay.classList.remove('active');

    // ゲーム要素を初期化
    resizeCanvas();
    initPlayer();
    draw();

    // ゲームループ開始
    gameRunning = true;
    animationId = requestAnimationFrame(gameLoop);
  }

  // ============================================
  // キーボード操作
  // ============================================
  document.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
      e.preventDefault();
      leftPressed = true;
    }
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
      e.preventDefault();
      rightPressed = true;
    }
    if (e.key === ' ') {
      e.preventDefault();
      spacePressed = true;
      if (!gameRunning && !gameOverFlag) {
        startGame();
      }
    }
  });

  document.addEventListener('keyup', function (e) {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
      leftPressed = false;
    }
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
      rightPressed = false;
    }
    if (e.key === ' ') {
      spacePressed = false;
    }
  });

  // ============================================
  // タッチ操作
  // ============================================
  canvas.addEventListener('touchstart', function (e) {
    e.preventDefault();
    if (!gameRunning) return;
    handleTouchInput(e);
  }, { passive: false });

  canvas.addEventListener('touchmove', function (e) {
    e.preventDefault();
    if (!gameRunning) return;
    handleTouchInput(e);
  }, { passive: false });

  canvas.addEventListener('touchend', function (e) {
    e.preventDefault();
    touchSide = null;
  }, { passive: false });

  canvas.addEventListener('touchcancel', function (e) {
    e.preventDefault();
    touchSide = null;
  }, { passive: false });

  function handleTouchInput(e) {
    if (e.touches.length === 0) return;
    var rect = canvas.getBoundingClientRect();
    var touchX = e.touches[0].clientX - rect.left;
    var canvasMid = rect.width / 2;

    if (touchX < canvasMid) {
      touchSide = 'left';
    } else {
      touchSide = 'right';
    }
  }

  // ============================================
  // ボタンイベント
  // ============================================
  document.getElementById('btn-new-game').addEventListener('click', function () {
    startGame();
  });

  document.getElementById('btn-retry').addEventListener('click', function () {
    startGame();
  });

  document.getElementById('btn-start').addEventListener('click', function () {
    startGame();
  });

  // ============================================
  // ウィンドウリサイズ
  // ============================================
  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      var oldWidth = canvasWidth;
      var oldHeight = canvasHeight;
      resizeCanvas();

      // プレイヤー位置をスケーリング
      if (oldWidth > 0 && oldHeight > 0) {
        playerX = playerX * (canvasWidth / oldWidth);
        playerY = canvasHeight - playerHeight - 20;
      }

      // 再描画
      if (!gameRunning) {
        draw();
      }
    }, 100);
  });

  // ============================================
  // ページ離脱時にゲームループを停止
  // ============================================
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && gameRunning) {
      if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
      }
      gameRunning = false;
    }
  });

  // ============================================
  // 初期化
  // ============================================
  bestScoreEl.textContent = bestScore;
  initCanvas();
  initPlayer();
  draw();
  renderLives();
})();
