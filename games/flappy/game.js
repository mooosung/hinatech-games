// ============================================
// フラッピーバード ロジック
// ============================================

(function () {
  'use strict';

  // ============================================
  // 定数
  // ============================================
  var CANVAS_W = 400;
  var CANVAS_H = 600;

  // 鳥の設定
  var BIRD_X = 80;               // 鳥のX座標（固定）
  var BIRD_RADIUS = 15;          // 鳥の半径
  var GRAVITY = 0.45;            // 重力
  var FLAP_FORCE = -7.5;         // はばたきの力（上方向）
  var MAX_FALL_SPEED = 10;       // 最大落下速度

  // 土管の設定
  var PIPE_WIDTH = 52;           // 土管の幅
  var PIPE_GAP = 140;            // 土管の上下間の隙間
  var PIPE_SPEED = 2.5;          // 土管の移動速度
  var PIPE_SPAWN_INTERVAL = 100; // 土管の生成間隔（フレーム数）
  var PIPE_MIN_TOP = 60;         // 上側土管の最小高さ
  var PIPE_MAX_TOP_MARGIN = 60;  // 下側土管の最小スペース確保

  // 地面の設定
  var GROUND_HEIGHT = 60;        // 地面の高さ

  // 色の定義
  var COLOR_SKY = '#70C5CE';
  var COLOR_GROUND = '#DED895';
  var COLOR_GROUND_DARK = '#D2B048';
  var COLOR_BIRD_BODY = '#F5C842';
  var COLOR_BIRD_WING = '#E6A817';
  var COLOR_BIRD_BEAK = '#E67E22';
  var COLOR_BIRD_EYE_WHITE = '#FFFFFF';
  var COLOR_BIRD_EYE_BLACK = '#333333';
  var COLOR_PIPE = '#5CB85C';
  var COLOR_PIPE_DARK = '#4A9A4A';
  var COLOR_PIPE_LIP = '#3D8B3D';
  var COLOR_SCORE_TEXT = '#FFFFFF';
  var COLOR_SCORE_SHADOW = 'rgba(0, 0, 0, 0.3)';

  // ============================================
  // 状態変数
  // ============================================
  var birdY = 0;                 // 鳥のY座標
  var birdVelocity = 0;          // 鳥の速度
  var birdRotation = 0;          // 鳥の回転角度
  var pipes = [];                // 土管の配列 [{x, topHeight}, ...]
  var frameCount = 0;            // フレームカウンタ
  var score = 0;
  var bestScore = parseInt(localStorage.getItem('bestFlappy') || '0', 10);
  var gameRunning = false;
  var gameOverFlag = false;
  var animFrameId = null;

  // 鳥の羽ばたきアニメーション用
  var wingAngle = 0;
  var wingDirection = 1;

  // ============================================
  // DOM要素
  // ============================================
  var canvas = document.getElementById('game-canvas');
  var ctx = canvas.getContext('2d');
  var scoreEl = document.getElementById('score');
  var bestScoreEl = document.getElementById('best-score');
  var gameOverOverlay = document.getElementById('game-over-overlay');
  var gameStartOverlay = document.getElementById('game-start-overlay');
  var finalScoreEl = document.getElementById('final-score');
  var bestResultEl = document.getElementById('best-result');

  // ============================================
  // Canvas解像度の設定（高DPI対応）
  // ============================================
  function setupCanvas() {
    var dpr = window.devicePixelRatio || 1;
    var rect = canvas.getBoundingClientRect();

    canvas.width = CANVAS_W * dpr;
    canvas.height = CANVAS_H * dpr;

    ctx.scale(dpr, dpr);
  }

  // ============================================
  // 鳥の描画
  // ============================================
  function drawBird() {
    ctx.save();
    ctx.translate(BIRD_X, birdY);

    // 回転（速度に応じて傾く）
    var targetRotation = birdVelocity * 3;
    if (targetRotation > 70) targetRotation = 70;
    if (targetRotation < -30) targetRotation = -30;
    birdRotation += (targetRotation - birdRotation) * 0.15;
    ctx.rotate(birdRotation * Math.PI / 180);

    // 胴体（楕円形）
    ctx.fillStyle = COLOR_BIRD_BODY;
    ctx.beginPath();
    ctx.ellipse(0, 0, BIRD_RADIUS + 2, BIRD_RADIUS, 0, 0, Math.PI * 2);
    ctx.fill();

    // 翼のアニメーション
    wingAngle += 0.3 * wingDirection;
    if (wingAngle > 1 || wingAngle < -1) wingDirection *= -1;

    ctx.fillStyle = COLOR_BIRD_WING;
    ctx.beginPath();
    var wingY = Math.sin(wingAngle * Math.PI) * 5;
    ctx.ellipse(-3, wingY, 10, 6, -0.2, 0, Math.PI * 2);
    ctx.fill();

    // 目（白い部分）
    ctx.fillStyle = COLOR_BIRD_EYE_WHITE;
    ctx.beginPath();
    ctx.arc(8, -5, 6, 0, Math.PI * 2);
    ctx.fill();

    // 瞳
    ctx.fillStyle = COLOR_BIRD_EYE_BLACK;
    ctx.beginPath();
    ctx.arc(10, -5, 3, 0, Math.PI * 2);
    ctx.fill();

    // くちばし
    ctx.fillStyle = COLOR_BIRD_BEAK;
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(22, 2);
    ctx.lineTo(12, 6);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  // ============================================
  // 土管の描画
  // ============================================
  function drawPipe(pipe) {
    var x = pipe.x;
    var topH = pipe.topHeight;
    var bottomY = topH + PIPE_GAP;
    var bottomH = CANVAS_H - GROUND_HEIGHT - bottomY;

    var lipWidth = 6;     // リップのはみ出し幅
    var lipHeight = 26;   // リップの高さ

    // --- 上の土管 ---
    // 本体
    ctx.fillStyle = COLOR_PIPE;
    ctx.fillRect(x, 0, PIPE_WIDTH, topH);

    // 暗い縁取り
    ctx.fillStyle = COLOR_PIPE_DARK;
    ctx.fillRect(x, 0, 4, topH);
    ctx.fillRect(x + PIPE_WIDTH - 4, 0, 4, topH);

    // リップ（下端）
    ctx.fillStyle = COLOR_PIPE_LIP;
    ctx.fillRect(x - lipWidth, topH - lipHeight, PIPE_WIDTH + lipWidth * 2, lipHeight);

    // リップのハイライト
    ctx.fillStyle = COLOR_PIPE;
    ctx.fillRect(x - lipWidth + 3, topH - lipHeight + 3, PIPE_WIDTH + lipWidth * 2 - 6, lipHeight - 6);

    // --- 下の土管 ---
    // 本体
    ctx.fillStyle = COLOR_PIPE;
    ctx.fillRect(x, bottomY, PIPE_WIDTH, bottomH);

    // 暗い縁取り
    ctx.fillStyle = COLOR_PIPE_DARK;
    ctx.fillRect(x, bottomY, 4, bottomH);
    ctx.fillRect(x + PIPE_WIDTH - 4, bottomY, 4, bottomH);

    // リップ（上端）
    ctx.fillStyle = COLOR_PIPE_LIP;
    ctx.fillRect(x - lipWidth, bottomY, PIPE_WIDTH + lipWidth * 2, lipHeight);

    // リップのハイライト
    ctx.fillStyle = COLOR_PIPE;
    ctx.fillRect(x - lipWidth + 3, bottomY + 3, PIPE_WIDTH + lipWidth * 2 - 6, lipHeight - 6);
  }

  // ============================================
  // 地面の描画
  // ============================================
  function drawGround() {
    var groundY = CANVAS_H - GROUND_HEIGHT;

    // 地面上部の線
    ctx.fillStyle = COLOR_GROUND_DARK;
    ctx.fillRect(0, groundY, CANVAS_W, 4);

    // 地面本体
    ctx.fillStyle = COLOR_GROUND;
    ctx.fillRect(0, groundY + 4, CANVAS_W, GROUND_HEIGHT - 4);

    // 地面のテクスチャ（細い線パターン）
    ctx.strokeStyle = COLOR_GROUND_DARK;
    ctx.lineWidth = 1;
    var offset = (frameCount * PIPE_SPEED) % 20;
    for (var i = -20 + offset; i < CANVAS_W + 20; i += 20) {
      ctx.beginPath();
      ctx.moveTo(i, groundY + 10);
      ctx.lineTo(i + 10, groundY + 20);
      ctx.stroke();
    }
  }

  // ============================================
  // 背景の描画
  // ============================================
  function drawBackground() {
    // 空
    ctx.fillStyle = COLOR_SKY;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // 遠景の雲（シンプルな楕円）
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    var cloudOffset = (frameCount * 0.3) % (CANVAS_W + 200);
    drawCloud(CANVAS_W - cloudOffset, 80, 1.0);
    drawCloud(CANVAS_W - cloudOffset + 250, 140, 0.7);
    drawCloud(CANVAS_W - cloudOffset + 500, 60, 0.85);
    drawCloud(CANVAS_W - cloudOffset + 180, 200, 0.6);
  }

  function drawCloud(x, y, scale) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.beginPath();
    ctx.arc(0, 0, 25, 0, Math.PI * 2);
    ctx.arc(25, -5, 20, 0, Math.PI * 2);
    ctx.arc(-20, 2, 18, 0, Math.PI * 2);
    ctx.arc(10, 8, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ============================================
  // スコアをキャンバス上にも描画
  // ============================================
  function drawScore() {
    if (!gameRunning && !gameOverFlag) return;

    ctx.save();
    ctx.font = 'bold 48px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    // 影
    ctx.fillStyle = COLOR_SCORE_SHADOW;
    ctx.fillText(score.toString(), CANVAS_W / 2 + 2, 32);

    // 本体
    ctx.fillStyle = COLOR_SCORE_TEXT;
    ctx.fillText(score.toString(), CANVAS_W / 2, 30);

    ctx.restore();
  }

  // ============================================
  // 全体の描画
  // ============================================
  function render() {
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    drawBackground();

    // 土管を描画
    for (var i = 0; i < pipes.length; i++) {
      drawPipe(pipes[i]);
    }

    drawGround();
    drawBird();
    drawScore();
  }

  // ============================================
  // 土管の生成
  // ============================================
  function spawnPipe() {
    var maxTop = CANVAS_H - GROUND_HEIGHT - PIPE_GAP - PIPE_MAX_TOP_MARGIN;
    var topHeight = PIPE_MIN_TOP + Math.floor(Math.random() * (maxTop - PIPE_MIN_TOP));

    pipes.push({
      x: CANVAS_W,
      topHeight: topHeight,
      scored: false
    });
  }

  // ============================================
  // 衝突判定
  // ============================================
  function checkCollision() {
    var bx = BIRD_X;
    var by = birdY;
    var br = BIRD_RADIUS - 2; // 少し甘めの判定

    // 地面との衝突
    if (by + br >= CANVAS_H - GROUND_HEIGHT) {
      return true;
    }

    // 天井との衝突
    if (by - br <= 0) {
      return true;
    }

    // 土管との衝突
    for (var i = 0; i < pipes.length; i++) {
      var pipe = pipes[i];
      var px = pipe.x;
      var topH = pipe.topHeight;
      var bottomY = topH + PIPE_GAP;
      var lipWidth = 6;

      // 鳥のバウンディングボックスと土管リップの衝突
      var pipeLeft = px - lipWidth;
      var pipeRight = px + PIPE_WIDTH + lipWidth;

      // X軸の重なりチェック
      if (bx + br > pipeLeft && bx - br < pipeRight) {
        // 上の土管との衝突
        if (by - br < topH) {
          return true;
        }
        // 下の土管との衝突
        if (by + br > bottomY) {
          return true;
        }
      }

      // 土管本体部分（リップより狭い）のX軸チェック
      if (bx + br > px && bx - br < px + PIPE_WIDTH) {
        if (by - br < topH) {
          return true;
        }
        if (by + br > bottomY) {
          return true;
        }
      }
    }

    return false;
  }

  // ============================================
  // スコア更新
  // ============================================
  function updateScoreDisplay() {
    scoreEl.textContent = score;
    if (score > bestScore) {
      bestScore = score;
      localStorage.setItem('bestFlappy', bestScore.toString());
    }
    bestScoreEl.textContent = bestScore;
  }

  // ============================================
  // はばたき
  // ============================================
  function flap() {
    if (gameOverFlag) return;

    if (!gameRunning) {
      startGame();
      return;
    }

    birdVelocity = FLAP_FORCE;
  }

  // ============================================
  // ゲームの1フレーム更新
  // ============================================
  function update() {
    if (!gameRunning || gameOverFlag) return;

    frameCount++;

    // 鳥の物理演算
    birdVelocity += GRAVITY;
    if (birdVelocity > MAX_FALL_SPEED) {
      birdVelocity = MAX_FALL_SPEED;
    }
    birdY += birdVelocity;

    // 土管の移動と管理
    for (var i = pipes.length - 1; i >= 0; i--) {
      pipes[i].x -= PIPE_SPEED;

      // スコア判定（鳥が土管を通過した）
      if (!pipes[i].scored && pipes[i].x + PIPE_WIDTH < BIRD_X) {
        pipes[i].scored = true;
        score++;
        updateScoreDisplay();
      }

      // 画面外に出た土管を削除
      if (pipes[i].x + PIPE_WIDTH + 10 < 0) {
        pipes.splice(i, 1);
      }
    }

    // 土管の生成
    if (frameCount % PIPE_SPAWN_INTERVAL === 0) {
      spawnPipe();
    }

    // 衝突判定
    if (checkCollision()) {
      gameOver();
      return;
    }

    // 描画
    render();

    // 次のフレームをスケジュール
    animFrameId = requestAnimationFrame(update);
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

    // 最後の描画
    render();

    finalScoreEl.textContent = score;

    // ベストスコア更新チェック
    if (score >= bestScore && score > 0) {
      bestResultEl.textContent = 'ハイスコア更新！';
    } else {
      bestResultEl.textContent = 'ベスト: ' + bestScore;
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
    // アニメーションをクリア
    if (animFrameId) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }

    // 状態をリセット
    score = 0;
    gameOverFlag = false;
    frameCount = 0;
    pipes = [];
    birdY = CANVAS_H / 2.5;
    birdVelocity = 0;
    birdRotation = 0;
    wingAngle = 0;
    wingDirection = 1;

    updateScoreDisplay();

    // オーバーレイを非表示
    gameOverOverlay.classList.remove('active');
    gameStartOverlay.classList.remove('active');

    // 初回描画
    render();

    // ゲームループ開始
    gameRunning = true;
    animFrameId = requestAnimationFrame(update);
  }

  // ============================================
  // キーボード操作
  // ============================================
  document.addEventListener('keydown', function (e) {
    if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
      e.preventDefault();
      flap();
    }
  });

  // ============================================
  // タッチ・クリック操作
  // ============================================
  canvas.addEventListener('click', function (e) {
    e.preventDefault();
    flap();
  });

  canvas.addEventListener('touchstart', function (e) {
    e.preventDefault();
    flap();
  }, { passive: false });

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
  // アイドルアニメーション（スタート画面用）
  // ============================================
  var idleFrameId = null;
  var idleCount = 0;

  function idleAnimation() {
    idleCount++;
    // 鳥を上下に揺らす
    birdY = CANVAS_H / 2.5 + Math.sin(idleCount * 0.04) * 15;

    render();
    idleFrameId = requestAnimationFrame(idleAnimation);
  }

  function stopIdle() {
    if (idleFrameId) {
      cancelAnimationFrame(idleFrameId);
      idleFrameId = null;
    }
  }

  // startGameをラップしてアイドルアニメーションを停止
  var originalStartGame = startGame;
  startGame = function () {
    stopIdle();
    originalStartGame();
  };

  // ============================================
  // 初期化
  // ============================================
  setupCanvas();
  bestScoreEl.textContent = bestScore;

  // 初期位置を設定してアイドルアニメーション開始
  birdY = CANVAS_H / 2.5;
  render();
  idleAnimation();
})();
