// ============================================
// ポンゲーム ロジック
// ============================================

(function () {
  'use strict';

  // ============================================
  // 定数
  // ============================================
  var WINNING_SCORE = 5;           // 勝利に必要な得点
  var PADDLE_WIDTH_RATIO = 0.02;   // パドル幅（キャンバス幅比）
  var PADDLE_HEIGHT_RATIO = 0.18;  // パドル高さ（キャンバス高さ比）
  var PADDLE_MARGIN_RATIO = 0.03;  // パドルの壁からの距離（キャンバス幅比）
  var BALL_RADIUS_RATIO = 0.012;   // ボール半径（キャンバス幅比）
  var BALL_SPEED_RATIO = 0.006;    // ボール初期速度（キャンバス幅比/フレーム）
  var BALL_MAX_SPEED_RATIO = 0.012; // ボール最大速度（キャンバス幅比/フレーム）
  var PADDLE_SPEED_RATIO = 0.008;  // パドル移動速度（キャンバス高さ比/フレーム）
  var AI_BASE_SPEED_RATIO = 0.004; // AI基本速度（キャンバス高さ比/フレーム）
  var AI_SPEED_INCREMENT = 0.001;  // AIスコアごとの速度増加
  var SPEED_INCREASE = 1.05;       // パドルに当たるたびの速度倍率
  var NET_DASH_COUNT = 15;         // センターラインの破線の数

  // ============================================
  // 状態変数
  // ============================================
  var canvas, ctx;
  var canvasW, canvasH;            // キャンバスの実ピクセルサイズ

  // パドル
  var playerY, aiY;                // パドル中心のY座標
  var paddleW, paddleH;            // パドルの幅・高さ（ピクセル）
  var paddleMargin;                // パドルの壁からの距離（ピクセル）
  var playerSpeed;                 // プレイヤーのパドル速度（ピクセル/フレーム）

  // ボール
  var ballX, ballY;                // ボールの中心座標
  var ballVX, ballVY;              // ボールの速度
  var ballRadius;                  // ボールの半径
  var ballSpeed;                   // 現在のボールの速度の大きさ
  var ballMaxSpeed;                // ボールの最大速度

  // スコア
  var playerScore = 0;
  var aiScore = 0;
  var rallyCount = 0;              // 現在のラリー回数
  var bestRally = parseInt(localStorage.getItem('bestPong') || '0', 10);

  // ゲーム状態
  var gameRunning = false;
  var gameOverFlag = false;
  var animFrameId = null;

  // 入力
  var keysDown = {};
  var touchActive = false;
  var touchY = 0;

  // AI
  var aiSpeed;                     // AI速度（ピクセル/フレーム）
  var aiTargetY;                   // AIの目標Y座標
  var aiReactionTimer = 0;         // AI反応遅延カウンター
  var aiReactionDelay = 10;        // AIの反応フレーム数

  // ============================================
  // DOM要素
  // ============================================
  var scoreEl = document.getElementById('score');
  var bestScoreEl = document.getElementById('best-score');
  var gameOverOverlay = document.getElementById('game-over-overlay');
  var gameStartOverlay = document.getElementById('game-start-overlay');
  var finalScoreEl = document.getElementById('final-score');
  var bestResultEl = document.getElementById('best-result');
  var resultTitleEl = document.getElementById('result-title');
  var rallyDisplayEl = document.getElementById('rally-display');
  var rallyCountEl = document.getElementById('rally-count');

  // ============================================
  // キャンバスの初期化・リサイズ
  // ============================================
  canvas = document.getElementById('game-canvas');
  ctx = canvas.getContext('2d');

  function resizeCanvas() {
    var wrapper = canvas.parentElement;
    var rect = wrapper.getBoundingClientRect();
    var dpr = window.devicePixelRatio || 1;

    canvasW = Math.round(rect.width * dpr);
    canvasH = Math.round(rect.height * dpr);

    canvas.width = canvasW;
    canvas.height = canvasH;

    // サイズ依存の定数を再計算
    paddleW = Math.max(canvasW * PADDLE_WIDTH_RATIO, 4);
    paddleH = Math.max(canvasH * PADDLE_HEIGHT_RATIO, 20);
    paddleMargin = canvasW * PADDLE_MARGIN_RATIO;
    playerSpeed = canvasH * PADDLE_SPEED_RATIO;
    ballRadius = Math.max(canvasW * BALL_RADIUS_RATIO, 3);
    ballMaxSpeed = canvasW * BALL_MAX_SPEED_RATIO;

    // パドル位置を比率で保持しておく（初回はセンター）
    if (playerY === undefined) {
      playerY = canvasH / 2;
      aiY = canvasH / 2;
    }
  }

  resizeCanvas();
  window.addEventListener('resize', function () {
    var oldW = canvasW;
    var oldH = canvasH;
    resizeCanvas();

    // リサイズ時に位置を比率で補正
    if (oldH > 0 && oldW > 0) {
      var scaleY = canvasH / oldH;
      var scaleX = canvasW / oldW;
      playerY *= scaleY;
      aiY *= scaleY;
      if (ballX !== undefined) {
        ballX *= scaleX;
        ballY *= scaleY;
        ballVX *= scaleX;
        ballVY *= scaleY;
      }
    }

    if (!gameRunning && !gameOverFlag) {
      draw();
    }
  });

  // ============================================
  // ボールの初期化（中央からランダム方向）
  // ============================================
  function resetBall(directionToPlayer) {
    ballX = canvasW / 2;
    ballY = canvasH / 2;
    ballSpeed = canvasW * BALL_SPEED_RATIO;

    // ボールの初期角度（水平寄りのランダム角度）
    var angle = (Math.random() * Math.PI / 3) - (Math.PI / 6); // -30度 ~ +30度
    var dir = directionToPlayer ? -1 : 1;

    ballVX = dir * ballSpeed * Math.cos(angle);
    ballVY = ballSpeed * Math.sin(angle);

    rallyCount = 0;
    updateRallyDisplay();
  }

  // ============================================
  // AI難易度の計算
  // ============================================
  function updateAIDifficulty() {
    var baseSpeed = canvasH * AI_BASE_SPEED_RATIO;
    var increment = canvasH * AI_SPEED_INCREMENT;
    aiSpeed = baseSpeed + (playerScore * increment);

    // 反応遅延：プレイヤーのスコアが上がると速く反応
    aiReactionDelay = Math.max(3, 12 - playerScore * 2);
  }

  // ============================================
  // AI の動き
  // ============================================
  function updateAI() {
    aiReactionTimer++;

    // 反応遅延を超えたら目標を更新
    if (aiReactionTimer >= aiReactionDelay) {
      aiReactionTimer = 0;

      // ボールが右に向かっている時のみ追跡
      if (ballVX > 0) {
        // ボールの予測位置を計算（簡易版）
        var timeToReach = (canvasW - paddleMargin - paddleW - ballX) / ballVX;
        var predictedY = ballY + ballVY * timeToReach;

        // 壁での反射を考慮
        while (predictedY < 0 || predictedY > canvasH) {
          if (predictedY < 0) {
            predictedY = -predictedY;
          }
          if (predictedY > canvasH) {
            predictedY = 2 * canvasH - predictedY;
          }
        }

        // 少しランダムなずれを加える（AIが完璧にならないように）
        var errorRange = paddleH * (0.3 - playerScore * 0.04);
        errorRange = Math.max(errorRange, paddleH * 0.05);
        aiTargetY = predictedY + (Math.random() - 0.5) * errorRange;
      } else {
        // ボールが離れている時はセンターに戻る
        aiTargetY = canvasH / 2;
      }
    }

    // 目標に向かって移動
    var diff = aiTargetY - aiY;
    if (Math.abs(diff) > 2) {
      if (diff > 0) {
        aiY += Math.min(aiSpeed, Math.abs(diff));
      } else {
        aiY -= Math.min(aiSpeed, Math.abs(diff));
      }
    }

    // パドルを画面内に制限
    aiY = Math.max(paddleH / 2, Math.min(canvasH - paddleH / 2, aiY));
  }

  // ============================================
  // プレイヤーの入力処理
  // ============================================
  function updatePlayer() {
    if (touchActive) {
      // タッチ操作: タッチ位置に追従
      var rect = canvas.getBoundingClientRect();
      var dpr = window.devicePixelRatio || 1;
      var targetY = (touchY - rect.top) * dpr;
      var diff = targetY - playerY;

      if (Math.abs(diff) > 2) {
        var moveAmount = Math.min(playerSpeed * 1.5, Math.abs(diff));
        playerY += diff > 0 ? moveAmount : -moveAmount;
      }
    } else {
      // キーボード操作
      if (keysDown['ArrowUp'] || keysDown['w'] || keysDown['W']) {
        playerY -= playerSpeed;
      }
      if (keysDown['ArrowDown'] || keysDown['s'] || keysDown['S']) {
        playerY += playerSpeed;
      }
    }

    // パドルを画面内に制限
    playerY = Math.max(paddleH / 2, Math.min(canvasH - paddleH / 2, playerY));
  }

  // ============================================
  // ボールの更新（移動・衝突判定）
  // ============================================
  function updateBall() {
    ballX += ballVX;
    ballY += ballVY;

    // 上下の壁との衝突
    if (ballY - ballRadius <= 0) {
      ballY = ballRadius;
      ballVY = Math.abs(ballVY);
    }
    if (ballY + ballRadius >= canvasH) {
      ballY = canvasH - ballRadius;
      ballVY = -Math.abs(ballVY);
    }

    // プレイヤーパドルとの衝突判定（左側）
    var playerPaddleX = paddleMargin + paddleW;
    var playerTop = playerY - paddleH / 2;
    var playerBottom = playerY + paddleH / 2;

    if (ballVX < 0 &&
        ballX - ballRadius <= playerPaddleX &&
        ballX - ballRadius >= paddleMargin - ballRadius &&
        ballY >= playerTop &&
        ballY <= playerBottom) {

      ballX = playerPaddleX + ballRadius;

      // パドルのどこに当たったかで角度を変える
      var hitPos = (ballY - playerY) / (paddleH / 2); // -1 ~ +1
      var angle = hitPos * (Math.PI / 4); // 最大45度

      // 速度を少し上げる
      ballSpeed = Math.min(ballSpeed * SPEED_INCREASE, ballMaxSpeed);

      ballVX = ballSpeed * Math.cos(angle);
      ballVY = ballSpeed * Math.sin(angle);

      // ラリーカウント
      rallyCount++;
      updateRallyDisplay();
    }

    // AIパドルとの衝突判定（右側）
    var aiPaddleX = canvasW - paddleMargin - paddleW;
    var aiTop = aiY - paddleH / 2;
    var aiBottom = aiY + paddleH / 2;

    if (ballVX > 0 &&
        ballX + ballRadius >= aiPaddleX &&
        ballX + ballRadius <= canvasW - paddleMargin + ballRadius &&
        ballY >= aiTop &&
        ballY <= aiBottom) {

      ballX = aiPaddleX - ballRadius;

      // パドルのどこに当たったかで角度を変える
      var hitPos2 = (ballY - aiY) / (paddleH / 2); // -1 ~ +1
      var angle2 = hitPos2 * (Math.PI / 4); // 最大45度

      // 速度を少し上げる
      ballSpeed = Math.min(ballSpeed * SPEED_INCREASE, ballMaxSpeed);

      ballVX = -(ballSpeed * Math.cos(angle2));
      ballVY = ballSpeed * Math.sin(angle2);

      // ラリーカウント
      rallyCount++;
      updateRallyDisplay();
    }

    // 左の壁を超えた（AI得点）
    if (ballX + ballRadius < 0) {
      aiScore++;
      updateScoreDisplay();
      checkGameEnd();
      if (!gameOverFlag) {
        // ベストラリー更新チェック
        updateBestRally();
        resetBall(true); // プレイヤー方向にサーブ
      }
    }

    // 右の壁を超えた（プレイヤー得点）
    if (ballX - ballRadius > canvasW) {
      playerScore++;
      updateScoreDisplay();
      updateAIDifficulty();
      checkGameEnd();
      if (!gameOverFlag) {
        // ベストラリー更新チェック
        updateBestRally();
        resetBall(false); // AI方向にサーブ
      }
    }
  }

  // ============================================
  // ラリー表示の更新
  // ============================================
  function updateRallyDisplay() {
    rallyCountEl.textContent = rallyCount;

    if (rallyCount > 0) {
      rallyDisplayEl.classList.add('visible');
    } else {
      rallyDisplayEl.classList.remove('visible');
    }
  }

  // ============================================
  // ベストラリーの更新
  // ============================================
  function updateBestRally() {
    if (rallyCount > bestRally) {
      bestRally = rallyCount;
      localStorage.setItem('bestPong', bestRally.toString());
      bestScoreEl.textContent = bestRally;
    }
  }

  // ============================================
  // スコア表示の更新
  // ============================================
  function updateScoreDisplay() {
    scoreEl.textContent = playerScore + ' - ' + aiScore;
  }

  // ============================================
  // 勝敗チェック
  // ============================================
  function checkGameEnd() {
    if (playerScore >= WINNING_SCORE || aiScore >= WINNING_SCORE) {
      gameOver();
    }
  }

  // ============================================
  // 描画
  // ============================================
  function draw() {
    // 背景
    ctx.fillStyle = '#776E65';
    ctx.fillRect(0, 0, canvasW, canvasH);

    // センターライン（破線）
    ctx.strokeStyle = 'rgba(238, 228, 218, 0.3)';
    ctx.lineWidth = Math.max(2, canvasW * 0.004);
    ctx.setLineDash([canvasH / NET_DASH_COUNT * 0.6, canvasH / NET_DASH_COUNT * 0.4]);
    ctx.beginPath();
    ctx.moveTo(canvasW / 2, 0);
    ctx.lineTo(canvasW / 2, canvasH);
    ctx.stroke();
    ctx.setLineDash([]);

    // スコア表示（キャンバス内）
    ctx.fillStyle = 'rgba(238, 228, 218, 0.2)';
    ctx.font = 'bold ' + Math.round(canvasH * 0.15) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(playerScore.toString(), canvasW * 0.25, canvasH * 0.05);
    ctx.fillText(aiScore.toString(), canvasW * 0.75, canvasH * 0.05);

    // プレイヤーパドル
    ctx.fillStyle = '#E67E22';
    var playerPaddleX = paddleMargin;
    var playerTop = playerY - paddleH / 2;
    roundRect(ctx, playerPaddleX, playerTop, paddleW, paddleH, 3);
    ctx.fill();

    // AIパドル
    ctx.fillStyle = '#EEE4DA';
    var aiPaddleX = canvasW - paddleMargin - paddleW;
    var aiTopDraw = aiY - paddleH / 2;
    roundRect(ctx, aiPaddleX, aiTopDraw, paddleW, paddleH, 3);
    ctx.fill();

    // ボール
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(ballX, ballY, ballRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  // ============================================
  // 角丸矩形ヘルパー
  // ============================================
  function roundRect(context, x, y, w, h, r) {
    context.beginPath();
    context.moveTo(x + r, y);
    context.lineTo(x + w - r, y);
    context.quadraticCurveTo(x + w, y, x + w, y + r);
    context.lineTo(x + w, y + h - r);
    context.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    context.lineTo(x + r, y + h);
    context.quadraticCurveTo(x, y + h, x, y + h - r);
    context.lineTo(x, y + r);
    context.quadraticCurveTo(x, y, x + r, y);
    context.closePath();
  }

  // ============================================
  // ゲームループ
  // ============================================
  function gameLoop() {
    if (!gameRunning) return;

    updatePlayer();
    updateAI();
    updateBall();
    draw();

    animFrameId = requestAnimationFrame(gameLoop);
  }

  // ============================================
  // ゲームオーバー処理
  // ============================================
  function gameOver() {
    gameRunning = false;
    gameOverFlag = true;

    if (animFrameId) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }

    // ベストラリー更新チェック
    updateBestRally();

    // 結果表示
    if (playerScore >= WINNING_SCORE) {
      resultTitleEl.textContent = 'あなたの勝ち！';
    } else {
      resultTitleEl.textContent = 'AIの勝ち...';
    }

    finalScoreEl.textContent = playerScore + ' - ' + aiScore;

    if (rallyCount >= bestRally && bestRally > 0) {
      bestResultEl.textContent = 'ベストラリー更新！ ' + bestRally + '回';
    } else {
      bestResultEl.textContent = 'ベストラリー: ' + bestRally + '回';
    }

    // 少し遅延させてオーバーレイを表示
    setTimeout(function () {
      gameOverOverlay.classList.add('active');
    }, 300);
  }

  // ============================================
  // ゲーム開始・リスタート
  // ============================================
  function startGame() {
    // アニメーションフレームをキャンセル
    if (animFrameId) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }

    // キャンバスリサイズ（最新のサイズを取得）
    resizeCanvas();

    // 状態をリセット
    playerScore = 0;
    aiScore = 0;
    rallyCount = 0;
    gameOverFlag = false;

    // パドルの初期位置
    playerY = canvasH / 2;
    aiY = canvasH / 2;
    aiTargetY = canvasH / 2;
    aiReactionTimer = 0;

    // スコア表示をリセット
    updateScoreDisplay();
    bestScoreEl.textContent = bestRally;
    updateRallyDisplay();
    updateAIDifficulty();

    // オーバーレイを非表示
    gameOverOverlay.classList.remove('active');
    gameStartOverlay.classList.remove('active');

    // ボールを初期化
    resetBall(false);

    // 描画してからゲームループ開始
    draw();

    gameRunning = true;
    animFrameId = requestAnimationFrame(gameLoop);
  }

  // ============================================
  // キーボード操作
  // ============================================
  document.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown' ||
        e.key === 'w' || e.key === 'W' ||
        e.key === 's' || e.key === 'S') {
      e.preventDefault();
      keysDown[e.key] = true;

      // ゲームが始まっていなければスタート
      if (!gameRunning && !gameOverFlag) {
        startGame();
      }
    }
  });

  document.addEventListener('keyup', function (e) {
    delete keysDown[e.key];
  });

  // ============================================
  // タッチ操作
  // ============================================
  var boardWrapper = canvas.parentElement;

  boardWrapper.addEventListener('touchstart', function (e) {
    if (e.touches.length === 1) {
      e.preventDefault();
      touchActive = true;
      touchY = e.touches[0].clientY;

      // ゲームが始まっていなければスタート
      if (!gameRunning && !gameOverFlag) {
        startGame();
      }
    }
  }, { passive: false });

  boardWrapper.addEventListener('touchmove', function (e) {
    if (e.touches.length === 1) {
      e.preventDefault();
      touchY = e.touches[0].clientY;
    }
  }, { passive: false });

  boardWrapper.addEventListener('touchend', function () {
    touchActive = false;
  }, { passive: true });

  boardWrapper.addEventListener('touchcancel', function () {
    touchActive = false;
  }, { passive: true });

  // ============================================
  // マウス操作（PC向け追加操作）
  // ============================================
  boardWrapper.addEventListener('mousemove', function (e) {
    if (gameRunning) {
      var rect = canvas.getBoundingClientRect();
      var dpr = window.devicePixelRatio || 1;
      var mouseY = (e.clientY - rect.top) * dpr;
      var diff = mouseY - playerY;

      if (Math.abs(diff) > 2) {
        var moveAmount = Math.min(playerSpeed * 1.5, Math.abs(diff));
        playerY += diff > 0 ? moveAmount : -moveAmount;
      }
      playerY = Math.max(paddleH / 2, Math.min(canvasH - paddleH / 2, playerY));
    }
  });

  boardWrapper.addEventListener('mousedown', function () {
    if (!gameRunning && !gameOverFlag) {
      startGame();
    }
  });

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
  // ページ離脱時にゲームループを停止
  // ============================================
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
  bestScoreEl.textContent = bestRally;

  // 初期画面を描画（パドルとボールを中央に）
  playerY = canvasH / 2;
  aiY = canvasH / 2;
  ballX = canvasW / 2;
  ballY = canvasH / 2;
  ballVX = 0;
  ballVY = 0;
  ballSpeed = canvasW * BALL_SPEED_RATIO;
  draw();
})();
