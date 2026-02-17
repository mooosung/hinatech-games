// ============================================
// キャッチゲーム ロジック
// ============================================

(function () {
  'use strict';

  // ============================================
  // 定数
  // ============================================
  var MAX_LIVES = 3;
  var POINTS_PER_CATCH = 10;
  var INITIAL_FALL_SPEED = 2;         // 初期落下速度（ピクセル/フレーム）
  var MAX_FALL_SPEED = 8;             // 最大落下速度
  var SPEED_INCREMENT = 0.005;        // スコア1点あたりの速度上昇
  var INITIAL_SPAWN_INTERVAL = 60;    // 初期スポーン間隔（フレーム数）
  var MIN_SPAWN_INTERVAL = 20;        // 最小スポーン間隔
  var BOMB_CHANCE = 0.2;              // 爆弾の出現確率（20%）
  var BASKET_WIDTH_RATIO = 0.18;      // バスケット幅のキャンバス幅に対する比率
  var BASKET_HEIGHT_RATIO = 0.06;     // バスケット高さのキャンバス高さに対する比率
  var ITEM_RADIUS_RATIO = 0.03;       // アイテム半径のキャンバス幅に対する比率
  var BASKET_SPEED = 8;               // キーボード操作時のバスケット速度

  // フルーツの色定義
  var FRUIT_COLORS = [
    { fill: '#E74C3C', name: 'りんご' },     // 赤
    { fill: '#F39C12', name: 'オレンジ' },   // オレンジ
    { fill: '#2ECC71', name: 'メロン' },     // 緑
    { fill: '#9B59B6', name: 'ぶどう' },     // 紫
    { fill: '#F1C40F', name: 'レモン' }      // 黄
  ];

  // ============================================
  // 状態変数
  // ============================================
  var canvas, ctx;
  var canvasW, canvasH;
  var basketX, basketY, basketW, basketH;
  var items = [];
  var score = 0;
  var bestScore = parseInt(localStorage.getItem('bestCatching') || '0', 10);
  var lives = MAX_LIVES;
  var gameRunning = false;
  var gameOverFlag = false;
  var animFrameId = null;
  var spawnCounter = 0;
  var currentFallSpeed = INITIAL_FALL_SPEED;
  var currentSpawnInterval = INITIAL_SPAWN_INTERVAL;
  var itemRadius;

  // 入力状態
  var keysDown = {};
  var mouseActive = false;
  var mouseX = 0;

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
  // キャンバスの初期化・リサイズ
  // ============================================
  canvas = document.getElementById('game-canvas');
  ctx = canvas.getContext('2d');

  function resizeCanvas() {
    var rect = canvas.getBoundingClientRect();
    var dpr = window.devicePixelRatio || 1;
    canvasW = rect.width;
    canvasH = rect.height;
    canvas.width = canvasW * dpr;
    canvas.height = canvasH * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // バスケットのサイズ更新
    basketW = canvasW * BASKET_WIDTH_RATIO;
    basketH = canvasH * BASKET_HEIGHT_RATIO;
    basketY = canvasH - basketH - 10;
    itemRadius = canvasW * ITEM_RADIUS_RATIO;

    // バスケットが画面外に出ないよう調整
    if (basketX !== undefined) {
      basketX = Math.max(0, Math.min(canvasW - basketW, basketX));
    }
  }

  window.addEventListener('resize', function () {
    resizeCanvas();
  });

  // ============================================
  // ライフ表示の更新
  // ============================================
  function updateLives() {
    livesDisplay.innerHTML = '';
    for (var i = 0; i < MAX_LIVES; i++) {
      var icon = document.createElement('div');
      icon.className = 'life-icon' + (i >= lives ? ' lost' : '');
      livesDisplay.appendChild(icon);
    }
  }

  // ============================================
  // スコア更新
  // ============================================
  function updateScore() {
    scoreEl.textContent = score;
    if (score > bestScore) {
      bestScore = score;
      localStorage.setItem('bestCatching', bestScore.toString());
    }
    bestScoreEl.textContent = bestScore;
  }

  // ============================================
  // 難易度計算（スコアに応じて速くなる）
  // ============================================
  function updateDifficulty() {
    currentFallSpeed = Math.min(
      INITIAL_FALL_SPEED + score * SPEED_INCREMENT,
      MAX_FALL_SPEED
    );
    currentSpawnInterval = Math.max(
      INITIAL_SPAWN_INTERVAL - Math.floor(score / 5),
      MIN_SPAWN_INTERVAL
    );
  }

  // ============================================
  // アイテム生成
  // ============================================
  function spawnItem() {
    var isBomb = Math.random() < BOMB_CHANCE;
    var x = itemRadius + Math.random() * (canvasW - itemRadius * 2);

    var item = {
      x: x,
      y: -itemRadius,
      isBomb: isBomb,
      color: null
    };

    if (!isBomb) {
      item.color = FRUIT_COLORS[Math.floor(Math.random() * FRUIT_COLORS.length)];
    }

    items.push(item);
  }

  // ============================================
  // 当たり判定（バスケットとアイテム）
  // ============================================
  function checkCollision(item) {
    // アイテムの中心がバスケットの矩形内にあるかチェック
    return (
      item.x >= basketX - itemRadius * 0.5 &&
      item.x <= basketX + basketW + itemRadius * 0.5 &&
      item.y + itemRadius >= basketY &&
      item.y - itemRadius <= basketY + basketH
    );
  }

  // ============================================
  // 描画: バスケット
  // ============================================
  function drawBasket() {
    // バスケット本体
    ctx.fillStyle = '#8F7A66';
    ctx.beginPath();
    var r = 6;
    ctx.moveTo(basketX + r, basketY);
    ctx.lineTo(basketX + basketW - r, basketY);
    ctx.quadraticCurveTo(basketX + basketW, basketY, basketX + basketW, basketY + r);
    ctx.lineTo(basketX + basketW - 4, basketY + basketH);
    ctx.lineTo(basketX + 4, basketY + basketH);
    ctx.lineTo(basketX, basketY + r);
    ctx.quadraticCurveTo(basketX, basketY, basketX + r, basketY);
    ctx.closePath();
    ctx.fill();

    // バスケットの横線（模様）
    ctx.strokeStyle = '#7A6658';
    ctx.lineWidth = 1.5;
    var lineY1 = basketY + basketH * 0.35;
    var lineY2 = basketY + basketH * 0.65;
    var inset1 = 2;
    var inset2 = 3;
    ctx.beginPath();
    ctx.moveTo(basketX + inset1, lineY1);
    ctx.lineTo(basketX + basketW - inset1, lineY1);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(basketX + inset2, lineY2);
    ctx.lineTo(basketX + basketW - inset2, lineY2);
    ctx.stroke();
  }

  // ============================================
  // 描画: フルーツ（円）
  // ============================================
  function drawFruit(item) {
    ctx.fillStyle = item.color.fill;
    ctx.beginPath();
    ctx.arc(item.x, item.y, itemRadius, 0, Math.PI * 2);
    ctx.fill();

    // ハイライト
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath();
    ctx.arc(item.x - itemRadius * 0.25, item.y - itemRadius * 0.25, itemRadius * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  // ============================================
  // 描画: 爆弾（赤い×）
  // ============================================
  function drawBomb(item) {
    // 黒い円の背景
    ctx.fillStyle = '#2C3E50';
    ctx.beginPath();
    ctx.arc(item.x, item.y, itemRadius, 0, Math.PI * 2);
    ctx.fill();

    // 赤い×マーク
    ctx.strokeStyle = '#E74C3C';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    var d = itemRadius * 0.55;
    ctx.beginPath();
    ctx.moveTo(item.x - d, item.y - d);
    ctx.lineTo(item.x + d, item.y + d);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(item.x + d, item.y - d);
    ctx.lineTo(item.x - d, item.y + d);
    ctx.stroke();
  }

  // ============================================
  // キャッチ時のエフェクト
  // ============================================
  var effects = [];

  function addEffect(x, y, text, color) {
    effects.push({
      x: x,
      y: y,
      text: text,
      color: color,
      alpha: 1,
      dy: -2
    });
  }

  function updateEffects() {
    for (var i = effects.length - 1; i >= 0; i--) {
      var e = effects[i];
      e.y += e.dy;
      e.alpha -= 0.025;
      if (e.alpha <= 0) {
        effects.splice(i, 1);
      }
    }
  }

  function drawEffects() {
    for (var i = 0; i < effects.length; i++) {
      var e = effects[i];
      ctx.globalAlpha = e.alpha;
      ctx.fillStyle = e.color;
      ctx.font = 'bold ' + Math.round(canvasW * 0.045) + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(e.text, e.x, e.y);
    }
    ctx.globalAlpha = 1;
  }

  // ============================================
  // メインの描画
  // ============================================
  function draw() {
    // 背景クリア
    ctx.fillStyle = '#BBADA0';
    ctx.fillRect(0, 0, canvasW, canvasH);

    // 地面ライン
    ctx.strokeStyle = '#A69888';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, basketY + basketH + 5);
    ctx.lineTo(canvasW, basketY + basketH + 5);
    ctx.stroke();

    // アイテム描画
    for (var i = 0; i < items.length; i++) {
      if (items[i].isBomb) {
        drawBomb(items[i]);
      } else {
        drawFruit(items[i]);
      }
    }

    // バスケット描画
    drawBasket();

    // エフェクト描画
    drawEffects();
  }

  // ============================================
  // ゲームの1フレーム更新
  // ============================================
  function update() {
    if (!gameRunning || gameOverFlag) return;

    // キーボード入力処理
    if (keysDown['ArrowLeft'] || keysDown['a'] || keysDown['A']) {
      basketX -= BASKET_SPEED;
    }
    if (keysDown['ArrowRight'] || keysDown['d'] || keysDown['D']) {
      basketX += BASKET_SPEED;
    }

    // マウス追従
    if (mouseActive) {
      basketX = mouseX - basketW / 2;
    }

    // バスケットを画面内に制限
    basketX = Math.max(0, Math.min(canvasW - basketW, basketX));

    // アイテムスポーン
    spawnCounter++;
    if (spawnCounter >= currentSpawnInterval) {
      spawnCounter = 0;
      spawnItem();
    }

    // アイテム更新
    for (var i = items.length - 1; i >= 0; i--) {
      items[i].y += currentFallSpeed;

      // 当たり判定
      if (checkCollision(items[i])) {
        if (items[i].isBomb) {
          // 爆弾キャッチ: ライフ減少
          lives--;
          updateLives();
          addEffect(items[i].x, items[i].y, '-1', '#E74C3C');

          if (lives <= 0) {
            items.splice(i, 1);
            gameOver();
            return;
          }
        } else {
          // フルーツキャッチ: スコア加算
          score += POINTS_PER_CATCH;
          updateScore();
          updateDifficulty();
          addEffect(items[i].x, items[i].y, '+10', '#2ECC71');
        }
        items.splice(i, 1);
        continue;
      }

      // 画面下に落ちたアイテムを削除
      if (items[i].y - itemRadius > canvasH) {
        items.splice(i, 1);
      }
    }

    // エフェクト更新
    updateEffects();
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
  // ゲームオーバー処理
  // ============================================
  function gameOver() {
    gameRunning = false;
    gameOverFlag = true;

    if (animFrameId) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }

    // 最終描画
    draw();

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
    // アニメーションフレームをキャンセル
    if (animFrameId) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }

    // 状態をリセット
    score = 0;
    lives = MAX_LIVES;
    gameOverFlag = false;
    items = [];
    effects = [];
    spawnCounter = 0;
    currentFallSpeed = INITIAL_FALL_SPEED;
    currentSpawnInterval = INITIAL_SPAWN_INTERVAL;
    mouseActive = false;

    // キャンバスサイズ更新
    resizeCanvas();

    // バスケットを中央に配置
    basketX = (canvasW - basketW) / 2;

    // スコア・ライフ更新
    updateScore();
    updateLives();

    // オーバーレイを非表示
    gameOverOverlay.classList.remove('active');
    gameStartOverlay.classList.remove('active');

    // ゲームループ開始
    gameRunning = true;
    animFrameId = requestAnimationFrame(gameLoop);
  }

  // ============================================
  // キーボード操作
  // ============================================
  document.addEventListener('keydown', function (e) {
    if (['ArrowLeft', 'ArrowRight', 'a', 'A', 'd', 'D'].indexOf(e.key) !== -1) {
      e.preventDefault();
      keysDown[e.key] = true;
      mouseActive = false;

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
  // マウス操作
  // ============================================
  var boardWrapper = canvas.parentElement;

  boardWrapper.addEventListener('mousemove', function (e) {
    if (!gameRunning) return;
    var rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseActive = true;
  });

  boardWrapper.addEventListener('mousedown', function (e) {
    if (!gameRunning && !gameOverFlag) {
      // オーバーレイのボタンクリックは無視
      if (e.target.tagName === 'BUTTON') return;
      var rect = canvas.getBoundingClientRect();
      mouseX = e.clientX - rect.left;
      mouseActive = true;
      startGame();
    }
  });

  // ============================================
  // タッチ操作
  // ============================================
  boardWrapper.addEventListener('touchstart', function (e) {
    if (e.target.tagName === 'BUTTON') return;
    e.preventDefault();
    if (e.touches.length === 1) {
      var rect = canvas.getBoundingClientRect();
      mouseX = e.touches[0].clientX - rect.left;
      mouseActive = true;

      if (!gameRunning && !gameOverFlag) {
        startGame();
      }
    }
  }, { passive: false });

  boardWrapper.addEventListener('touchmove', function (e) {
    e.preventDefault();
    if (e.touches.length === 1 && gameRunning) {
      var rect = canvas.getBoundingClientRect();
      mouseX = e.touches[0].clientX - rect.left;
      mouseActive = true;
    }
  }, { passive: false });

  boardWrapper.addEventListener('touchend', function (e) {
    // タッチ終了時はマウス追従を停止
    mouseActive = false;
  }, { passive: true });

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
  resizeCanvas();
  bestScoreEl.textContent = bestScore;
  basketX = (canvasW - basketW) / 2;
  updateLives();
  draw();
})();
