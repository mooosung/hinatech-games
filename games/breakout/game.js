// ============================================
// ブロック崩し ゲームロジック
// ============================================

(function () {
  'use strict';

  // ============================================
  // 定数
  // ============================================
  var BRICK_ROWS = 6;
  var BRICK_COLS = 8;
  var BRICK_PADDING = 4;
  var BRICK_TOP_OFFSET = 40;
  var PADDLE_HEIGHT_RATIO = 0.02;
  var PADDLE_WIDTH_RATIO = 0.18;
  var BALL_RADIUS_RATIO = 0.012;
  var INITIAL_BALL_SPEED = 4.5;
  var SPEED_INCREMENT = 0.3;
  var MAX_LIVES = 3;
  var POINTS_PER_BRICK = 10;

  // ブロックの色（行ごと）
  var BRICK_COLORS = [
    '#E74C3C',  // 赤
    '#E67E22',  // オレンジ
    '#F1C40F',  // 黄
    '#2ECC71',  // 緑
    '#3498DB',  // 青
    '#9B59B6'   // 紫
  ];

  // ============================================
  // 状態変数
  // ============================================
  var canvas, ctx;
  var canvasWidth, canvasHeight;
  var paddleWidth, paddleHeight, paddleX;
  var ballRadius, ballX, ballY, ballDX, ballDY;
  var ballSpeed;
  var bricks = [];
  var bricksRemaining;
  var score = 0;
  var bestScore = parseInt(localStorage.getItem('bestBreakout') || '0', 10);
  var lives = MAX_LIVES;
  var level = 1;
  var gameRunning = false;
  var gameOverFlag = false;
  var ballLaunched = false;
  var animationId = null;

  // 入力状態
  var leftPressed = false;
  var rightPressed = false;
  var paddleMoveSpeed = 7;

  // ============================================
  // DOM要素
  // ============================================
  var scoreEl = document.getElementById('score');
  var bestScoreEl = document.getElementById('best-score');
  var levelEl = document.getElementById('level');
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

    // サイズに応じたパラメータ再計算
    paddleWidth = canvasWidth * PADDLE_WIDTH_RATIO;
    paddleHeight = Math.max(canvasHeight * PADDLE_HEIGHT_RATIO, 10);
    ballRadius = Math.max(canvasWidth * BALL_RADIUS_RATIO, 5);
    paddleMoveSpeed = canvasWidth * 0.015;

    // パドル位置の制約
    if (paddleX !== undefined) {
      if (paddleX < 0) paddleX = 0;
      if (paddleX + paddleWidth > canvasWidth) paddleX = canvasWidth - paddleWidth;
    }
  }

  // ============================================
  // ブロックの生成
  // ============================================
  function createBricks() {
    bricks = [];
    bricksRemaining = 0;

    var brickAreaWidth = canvasWidth - BRICK_PADDING * 2;
    var brickWidth = (brickAreaWidth - BRICK_PADDING * (BRICK_COLS - 1)) / BRICK_COLS;
    var brickHeight = Math.max(canvasHeight * 0.03, 14);

    for (var row = 0; row < BRICK_ROWS; row++) {
      bricks[row] = [];
      for (var col = 0; col < BRICK_COLS; col++) {
        var x = BRICK_PADDING + col * (brickWidth + BRICK_PADDING);
        var y = BRICK_TOP_OFFSET + row * (brickHeight + BRICK_PADDING);
        bricks[row][col] = {
          x: x,
          y: y,
          width: brickWidth,
          height: brickHeight,
          alive: true,
          color: BRICK_COLORS[row % BRICK_COLORS.length]
        };
        bricksRemaining++;
      }
    }
  }

  // ============================================
  // パドルの初期化
  // ============================================
  function initPaddle() {
    paddleX = (canvasWidth - paddleWidth) / 2;
  }

  // ============================================
  // ボールの初期化（パドル上に配置）
  // ============================================
  function initBall() {
    ballLaunched = false;
    ballX = paddleX + paddleWidth / 2;
    ballY = canvasHeight - paddleHeight - 20 - ballRadius;

    // ボールの速度（レベルに応じて増加）
    ballSpeed = INITIAL_BALL_SPEED + (level - 1) * SPEED_INCREMENT;

    // ランダムな角度で上に打ち出す（後で発射時に設定）
    ballDX = 0;
    ballDY = 0;
  }

  // ============================================
  // ボールの発射
  // ============================================
  function launchBall() {
    if (ballLaunched) return;
    ballLaunched = true;

    // -60度〜-120度の範囲でランダムに発射
    var angle = -(Math.PI / 4 + Math.random() * Math.PI / 2);
    ballDX = ballSpeed * Math.cos(angle);
    ballDY = ballSpeed * Math.sin(angle);

    // 上方向になるように保証
    if (ballDY > 0) ballDY = -ballDY;
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
      localStorage.setItem('bestBreakout', bestScore.toString());
    }
    bestScoreEl.textContent = bestScore;
  }

  // ============================================
  // レベル表示の更新
  // ============================================
  function updateLevel() {
    levelEl.textContent = level;
  }

  // ============================================
  // 描画: ブロック
  // ============================================
  function drawBricks() {
    for (var row = 0; row < BRICK_ROWS; row++) {
      for (var col = 0; col < BRICK_COLS; col++) {
        var brick = bricks[row][col];
        if (!brick.alive) continue;

        ctx.fillStyle = brick.color;
        ctx.beginPath();
        roundRect(ctx, brick.x, brick.y, brick.width, brick.height, 3);
        ctx.fill();

        // ハイライト（上辺）
        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.fillRect(brick.x + 1, brick.y + 1, brick.width - 2, 2);
      }
    }
  }

  // ============================================
  // 描画: パドル
  // ============================================
  function drawPaddle() {
    var paddleY = canvasHeight - paddleHeight - 20;

    ctx.fillStyle = '#8F7A66';
    ctx.beginPath();
    roundRect(ctx, paddleX, paddleY, paddleWidth, paddleHeight, 4);
    ctx.fill();

    // ハイライト
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fillRect(paddleX + 2, paddleY + 1, paddleWidth - 4, 2);
  }

  // ============================================
  // 描画: ボール
  // ============================================
  function drawBall() {
    ctx.fillStyle = '#F9F6F2';
    ctx.beginPath();
    ctx.arc(ballX, ballY, ballRadius, 0, Math.PI * 2);
    ctx.fill();

    // ボールの光沢
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.beginPath();
    ctx.arc(ballX - ballRadius * 0.25, ballY - ballRadius * 0.25, ballRadius * 0.4, 0, Math.PI * 2);
    ctx.fill();
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
  // 衝突判定: ボール vs ブロック
  // ============================================
  function checkBrickCollision() {
    for (var row = 0; row < BRICK_ROWS; row++) {
      for (var col = 0; col < BRICK_COLS; col++) {
        var brick = bricks[row][col];
        if (!brick.alive) continue;

        // ボールの中心がブロックの拡張領域内にあるか
        if (ballX + ballRadius > brick.x &&
            ballX - ballRadius < brick.x + brick.width &&
            ballY + ballRadius > brick.y &&
            ballY - ballRadius < brick.y + brick.height) {

          brick.alive = false;
          bricksRemaining--;
          score += POINTS_PER_BRICK;
          updateScore();

          // 反射方向の判定
          var overlapLeft = (ballX + ballRadius) - brick.x;
          var overlapRight = (brick.x + brick.width) - (ballX - ballRadius);
          var overlapTop = (ballY + ballRadius) - brick.y;
          var overlapBottom = (brick.y + brick.height) - (ballY - ballRadius);

          var minOverlapX = Math.min(overlapLeft, overlapRight);
          var minOverlapY = Math.min(overlapTop, overlapBottom);

          if (minOverlapX < minOverlapY) {
            ballDX = -ballDX;
          } else {
            ballDY = -ballDY;
          }

          // 全ブロック破壊チェック
          if (bricksRemaining <= 0) {
            nextLevel();
          }

          return; // 1フレームに1個だけ処理
        }
      }
    }
  }

  // ============================================
  // 次のレベルへ
  // ============================================
  function nextLevel() {
    level++;
    updateLevel();
    createBricks();
    initBall();
    // ボール速度はinitBall内でレベルに応じて設定済み
  }

  // ============================================
  // ボールの更新
  // ============================================
  function updateBall() {
    if (!ballLaunched) {
      // 発射前はパドルの上に追従
      ballX = paddleX + paddleWidth / 2;
      ballY = canvasHeight - paddleHeight - 20 - ballRadius;
      return;
    }

    ballX += ballDX;
    ballY += ballDY;

    // 左右の壁との衝突
    if (ballX - ballRadius <= 0) {
      ballX = ballRadius;
      ballDX = Math.abs(ballDX);
    }
    if (ballX + ballRadius >= canvasWidth) {
      ballX = canvasWidth - ballRadius;
      ballDX = -Math.abs(ballDX);
    }

    // 上の壁との衝突
    if (ballY - ballRadius <= 0) {
      ballY = ballRadius;
      ballDY = Math.abs(ballDY);
    }

    // パドルとの衝突
    var paddleY = canvasHeight - paddleHeight - 20;
    if (ballDY > 0 &&
        ballY + ballRadius >= paddleY &&
        ballY + ballRadius <= paddleY + paddleHeight + ballSpeed &&
        ballX >= paddleX - ballRadius &&
        ballX <= paddleX + paddleWidth + ballRadius) {

      ballY = paddleY - ballRadius;

      // パドルの当たった位置に応じて反射角を変える
      var hitPos = (ballX - paddleX) / paddleWidth; // 0.0〜1.0
      hitPos = Math.max(0, Math.min(1, hitPos));

      // 角度: 左端で150度、中央で90度、右端で30度（上方向）
      var angle = (150 - hitPos * 120) * Math.PI / 180;
      ballDX = ballSpeed * Math.cos(angle);
      ballDY = -ballSpeed * Math.sin(angle);
    }

    // 下に落ちた場合
    if (ballY - ballRadius > canvasHeight) {
      loseLife();
    }

    // ブロックとの衝突
    checkBrickCollision();
  }

  // ============================================
  // ライフを失う
  // ============================================
  function loseLife() {
    lives--;
    renderLives();

    if (lives <= 0) {
      gameOver();
    } else {
      // ボールをリセット（パドル上に）
      initBall();
    }
  }

  // ============================================
  // パドルの更新
  // ============================================
  function updatePaddle() {
    if (leftPressed) {
      paddleX -= paddleMoveSpeed;
    }
    if (rightPressed) {
      paddleX += paddleMoveSpeed;
    }

    // 画面外に出ないように制約
    if (paddleX < 0) paddleX = 0;
    if (paddleX + paddleWidth > canvasWidth) paddleX = canvasWidth - paddleWidth;
  }

  // ============================================
  // メインの描画
  // ============================================
  function draw() {
    // キャンバスをクリア
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // 背景
    ctx.fillStyle = '#CDC1B4';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    drawBricks();
    drawPaddle();
    drawBall();
  }

  // ============================================
  // ゲームループ
  // ============================================
  function gameLoop() {
    if (!gameRunning || gameOverFlag) return;

    updatePaddle();
    updateBall();
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
    level = 1;
    gameOverFlag = false;
    leftPressed = false;
    rightPressed = false;

    updateScore();
    updateLevel();
    renderLives();

    // オーバーレイを非表示
    gameOverOverlay.classList.remove('active');
    gameStartOverlay.classList.remove('active');

    // ゲーム要素を初期化
    resizeCanvas();
    initPaddle();
    createBricks();
    initBall();
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
    if (e.key === ' ' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (gameRunning && !ballLaunched) {
        launchBall();
      }
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
  });

  // ============================================
  // マウス操作
  // ============================================
  canvas.addEventListener('mousemove', function (e) {
    if (!gameRunning) return;
    var rect = canvas.getBoundingClientRect();
    var mouseX = e.clientX - rect.left;

    paddleX = mouseX - paddleWidth / 2;
    if (paddleX < 0) paddleX = 0;
    if (paddleX + paddleWidth > canvasWidth) paddleX = canvasWidth - paddleWidth;
  });

  canvas.addEventListener('click', function () {
    if (gameRunning && !ballLaunched) {
      launchBall();
    }
  });

  // ============================================
  // タッチ操作
  // ============================================
  var touchActive = false;

  canvas.addEventListener('touchstart', function (e) {
    e.preventDefault();
    if (!gameRunning) return;

    touchActive = true;

    if (!ballLaunched) {
      launchBall();
      return;
    }

    handleTouch(e);
  }, { passive: false });

  canvas.addEventListener('touchmove', function (e) {
    e.preventDefault();
    if (!gameRunning || !touchActive) return;
    handleTouch(e);
  }, { passive: false });

  canvas.addEventListener('touchend', function (e) {
    e.preventDefault();
    touchActive = false;
  }, { passive: false });

  function handleTouch(e) {
    if (e.touches.length === 0) return;
    var rect = canvas.getBoundingClientRect();
    var touchX = e.touches[0].clientX - rect.left;

    paddleX = touchX - paddleWidth / 2;
    if (paddleX < 0) paddleX = 0;
    if (paddleX + paddleWidth > canvasWidth) paddleX = canvasWidth - paddleWidth;
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

      // パドル位置をスケーリング
      if (oldWidth > 0) {
        paddleX = paddleX * (canvasWidth / oldWidth);
      }

      // ボール位置をスケーリング
      if (oldWidth > 0 && oldHeight > 0) {
        ballX = ballX * (canvasWidth / oldWidth);
        ballY = ballY * (canvasHeight / oldHeight);
      }

      // ブロックを再生成（位置のみ更新）
      var brickAreaWidth = canvasWidth - BRICK_PADDING * 2;
      var brickWidth = (brickAreaWidth - BRICK_PADDING * (BRICK_COLS - 1)) / BRICK_COLS;
      var brickHeight = Math.max(canvasHeight * 0.03, 14);

      for (var row = 0; row < BRICK_ROWS; row++) {
        for (var col = 0; col < BRICK_COLS; col++) {
          if (bricks[row] && bricks[row][col]) {
            bricks[row][col].x = BRICK_PADDING + col * (brickWidth + BRICK_PADDING);
            bricks[row][col].y = BRICK_TOP_OFFSET + row * (brickHeight + BRICK_PADDING);
            bricks[row][col].width = brickWidth;
            bricks[row][col].height = brickHeight;
          }
        }
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
  initPaddle();
  createBricks();
  initBall();
  draw();
  renderLives();
})();
