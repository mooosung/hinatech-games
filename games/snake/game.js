// ============================================
// へびゲーム ロジック
// ============================================

(function () {
  'use strict';

  // ============================================
  // 定数
  // ============================================
  var GRID_SIZE = 20;            // グリッドのサイズ（20x20）
  var INITIAL_SPEED = 200;       // 初期スピード（ミリ秒）
  var MIN_SPEED = 60;            // 最速（ミリ秒）
  var SPEED_INCREASE_PER_FOOD = 5; // エサ1個ごとにスピードアップ量
  var INITIAL_SNAKE_LENGTH = 3;  // へびの初期長さ

  // 方向の定義
  var DIR = {
    UP:    { x:  0, y: -1 },
    DOWN:  { x:  0, y:  1 },
    LEFT:  { x: -1, y:  0 },
    RIGHT: { x:  1, y:  0 }
  };

  // ============================================
  // 状態変数
  // ============================================
  var snake = [];          // へびの体 [{x, y}, ...]  先頭が頭
  var food = null;         // エサの位置 {x, y}
  var direction = DIR.RIGHT;
  var nextDirection = DIR.RIGHT;
  var score = 0;
  var bestScore = parseInt(localStorage.getItem('bestSnake') || '0', 10);
  var gameRunning = false;
  var gameOverFlag = false;
  var gameLoopTimer = null;
  var currentSpeed = INITIAL_SPEED;

  // ============================================
  // DOM要素
  // ============================================
  var board = document.getElementById('snake-board');
  var scoreEl = document.getElementById('score');
  var bestScoreEl = document.getElementById('best-score');
  var gameOverOverlay = document.getElementById('game-over-overlay');
  var gameStartOverlay = document.getElementById('game-start-overlay');
  var finalScoreEl = document.getElementById('final-score');
  var bestResultEl = document.getElementById('best-result');

  // セルの2次元配列（高速アクセス用）
  var cells = [];

  // ============================================
  // ボードの初期化（DOMセルを生成）
  // ============================================
  function createBoard() {
    board.innerHTML = '';
    cells = [];

    for (var y = 0; y < GRID_SIZE; y++) {
      cells[y] = [];
      for (var x = 0; x < GRID_SIZE; x++) {
        var cell = document.createElement('div');
        cell.className = 'snake-cell';
        board.appendChild(cell);
        cells[y][x] = cell;
      }
    }
  }

  // ============================================
  // ボードの描画更新
  // ============================================
  function render() {
    // すべてのセルをリセット
    for (var y = 0; y < GRID_SIZE; y++) {
      for (var x = 0; x < GRID_SIZE; x++) {
        cells[y][x].className = 'snake-cell';
      }
    }

    // へびを描画
    for (var i = 0; i < snake.length; i++) {
      var seg = snake[i];
      if (seg.x >= 0 && seg.x < GRID_SIZE && seg.y >= 0 && seg.y < GRID_SIZE) {
        if (i === 0) {
          cells[seg.y][seg.x].className = 'snake-cell snake-head';
        } else {
          cells[seg.y][seg.x].className = 'snake-cell snake-body';
        }
      }
    }

    // エサを描画
    if (food) {
      cells[food.y][food.x].className = 'snake-cell snake-food';
    }
  }

  // ============================================
  // へびの初期配置
  // ============================================
  function initSnake() {
    snake = [];
    var startX = Math.floor(GRID_SIZE / 2);
    var startY = Math.floor(GRID_SIZE / 2);

    for (var i = 0; i < INITIAL_SNAKE_LENGTH; i++) {
      snake.push({ x: startX - i, y: startY });
    }

    direction = DIR.RIGHT;
    nextDirection = DIR.RIGHT;
  }

  // ============================================
  // エサをランダムな空きセルに配置
  // ============================================
  function spawnFood() {
    // へびが占めているセルを記録
    var occupied = {};
    for (var i = 0; i < snake.length; i++) {
      occupied[snake[i].x + ',' + snake[i].y] = true;
    }

    // 空きセルをリストアップ
    var emptyCells = [];
    for (var y = 0; y < GRID_SIZE; y++) {
      for (var x = 0; x < GRID_SIZE; x++) {
        if (!occupied[x + ',' + y]) {
          emptyCells.push({ x: x, y: y });
        }
      }
    }

    if (emptyCells.length === 0) {
      // 全セルがへびで埋まった（勝利的状態）
      food = null;
      return;
    }

    food = emptyCells[Math.floor(Math.random() * emptyCells.length)];
  }

  // ============================================
  // スコア更新
  // ============================================
  function updateScore() {
    scoreEl.textContent = score;
    if (score > bestScore) {
      bestScore = score;
      localStorage.setItem('bestSnake', bestScore.toString());
    }
    bestScoreEl.textContent = bestScore;
  }

  // ============================================
  // 速度の計算（スコアに応じて速くなる）
  // ============================================
  function calcSpeed() {
    var speed = INITIAL_SPEED - (score * SPEED_INCREASE_PER_FOOD);
    return Math.max(speed, MIN_SPEED);
  }

  // ============================================
  // ゲームの1ステップ
  // ============================================
  function gameStep() {
    if (!gameRunning || gameOverFlag) return;

    // 方向を確定
    direction = nextDirection;

    // 新しい頭の位置を計算
    var head = snake[0];
    var newHead = {
      x: head.x + direction.x,
      y: head.y + direction.y
    };

    // 壁との衝突判定
    if (newHead.x < 0 || newHead.x >= GRID_SIZE ||
        newHead.y < 0 || newHead.y >= GRID_SIZE) {
      gameOver();
      return;
    }

    // 自分自身との衝突判定（尻尾の先端は次のステップで消えるので除外）
    for (var i = 0; i < snake.length - 1; i++) {
      if (snake[i].x === newHead.x && snake[i].y === newHead.y) {
        gameOver();
        return;
      }
    }

    // へびの頭を追加
    snake.unshift(newHead);

    // エサを食べたかチェック
    if (food && newHead.x === food.x && newHead.y === food.y) {
      // スコア加算（へびは伸びる = 尻尾を削除しない）
      score += 1;
      updateScore();

      // 速度更新
      currentSpeed = calcSpeed();

      // 新しいエサを配置
      spawnFood();
    } else {
      // エサを食べなかった場合、尻尾を1つ削除
      snake.pop();
    }

    // 描画
    render();

    // 次のステップをスケジュール
    gameLoopTimer = setTimeout(gameStep, currentSpeed);
  }

  // ============================================
  // ゲームオーバー処理
  // ============================================
  function gameOver() {
    gameRunning = false;
    gameOverFlag = true;

    if (gameLoopTimer) {
      clearTimeout(gameLoopTimer);
      gameLoopTimer = null;
    }

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
    // タイマーをクリア
    if (gameLoopTimer) {
      clearTimeout(gameLoopTimer);
      gameLoopTimer = null;
    }

    // 状態をリセット
    score = 0;
    gameOverFlag = false;
    currentSpeed = INITIAL_SPEED;
    updateScore();

    // オーバーレイを非表示
    gameOverOverlay.classList.remove('active');
    gameStartOverlay.classList.remove('active');

    // へびとエサを初期化
    initSnake();
    spawnFood();
    render();

    // ゲームループ開始
    gameRunning = true;
    gameLoopTimer = setTimeout(gameStep, currentSpeed);
  }

  // ============================================
  // 方向変更（逆方向への転換を防止）
  // ============================================
  function changeDirection(newDir) {
    // 逆方向のチェック
    if (direction.x + newDir.x === 0 && direction.y + newDir.y === 0) {
      return; // 逆方向は無視
    }
    nextDirection = newDir;
  }

  // ============================================
  // キーボード操作
  // ============================================
  document.addEventListener('keydown', function (e) {
    var keyMap = {
      ArrowUp: DIR.UP, ArrowDown: DIR.DOWN, ArrowLeft: DIR.LEFT, ArrowRight: DIR.RIGHT,
      w: DIR.UP, s: DIR.DOWN, a: DIR.LEFT, d: DIR.RIGHT,
      W: DIR.UP, S: DIR.DOWN, A: DIR.LEFT, D: DIR.RIGHT
    };

    var dir = keyMap[e.key];
    if (dir) {
      e.preventDefault();

      // ゲームが始まっていなければスタート
      if (!gameRunning && !gameOverFlag) {
        startGame();
        // スタート時の方向を設定
        if (dir.x + DIR.RIGHT.x !== 0 || dir.y + DIR.RIGHT.y !== 0) {
          nextDirection = dir;
        }
        return;
      }

      changeDirection(dir);
    }
  });

  // ============================================
  // タッチ・スワイプ操作
  // ============================================
  var touchStartX = 0;
  var touchStartY = 0;
  var touchStartTime = 0;
  var boardWrapper = board.parentElement;

  boardWrapper.addEventListener('touchstart', function (e) {
    if (e.touches.length === 1) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchStartTime = Date.now();
    }
  }, { passive: true });

  boardWrapper.addEventListener('touchmove', function (e) {
    // ゲーム中はスクロールを防止
    if (gameRunning) {
      e.preventDefault();
    }
  }, { passive: false });

  boardWrapper.addEventListener('touchend', function (e) {
    if (e.changedTouches.length === 0) return;

    var dx = e.changedTouches[0].clientX - touchStartX;
    var dy = e.changedTouches[0].clientY - touchStartY;
    var dt = Date.now() - touchStartTime;

    // 最小スワイプ距離と最大時間
    var minDist = 25;
    var maxTime = 400;

    if (dt > maxTime) return;
    if (Math.abs(dx) < minDist && Math.abs(dy) < minDist) return;

    var dir;
    if (Math.abs(dx) > Math.abs(dy)) {
      dir = dx > 0 ? DIR.RIGHT : DIR.LEFT;
    } else {
      dir = dy > 0 ? DIR.DOWN : DIR.UP;
    }

    // ゲームが始まっていなければスタート
    if (!gameRunning && !gameOverFlag) {
      startGame();
    }

    changeDirection(dir);
  }, { passive: true });

  // ============================================
  // 方向ボタン（モバイル用D-Pad）
  // ============================================
  function setupDpadButton(btnId, dir) {
    var btn = document.getElementById(btnId);
    if (!btn) return;

    // タッチ操作（クリックとタッチの両方に対応）
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      if (!gameRunning && !gameOverFlag) {
        startGame();
      }
      changeDirection(dir);
    });

    // タッチで押した場合のスクロール防止
    btn.addEventListener('touchstart', function (e) {
      e.preventDefault();
      if (!gameRunning && !gameOverFlag) {
        startGame();
      }
      changeDirection(dir);
    }, { passive: false });
  }

  setupDpadButton('btn-up', DIR.UP);
  setupDpadButton('btn-down', DIR.DOWN);
  setupDpadButton('btn-left', DIR.LEFT);
  setupDpadButton('btn-right', DIR.RIGHT);

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
      // ページが非表示になったらタイマーを一時停止
      if (gameLoopTimer) {
        clearTimeout(gameLoopTimer);
        gameLoopTimer = null;
      }
      gameRunning = false;
    }
  });

  // ============================================
  // 初期化
  // ============================================
  bestScoreEl.textContent = bestScore;
  createBoard();
  initSnake();
  spawnFood();
  render();
})();
