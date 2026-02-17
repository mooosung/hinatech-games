// ============================================
// 迷路ゲーム ロジック
// ============================================

(function () {
  'use strict';

  // ============================================
  // 定数
  // ============================================
  var MAZE_SIZE = 15;              // 迷路の論理サイズ（15x15）
  var GRID_SIZE = MAZE_SIZE * 2 + 1; // 描画グリッドサイズ（壁含む: 31x31）
  var WALL = 0;
  var PATH = 1;

  // 方向の定義（迷路生成用: 2セル単位で移動）
  var DIRS = [
    { dx:  0, dy: -1 },  // 上
    { dx:  0, dy:  1 },  // 下
    { dx: -1, dy:  0 },  // 左
    { dx:  1, dy:  0 }   // 右
  ];

  // プレイヤー移動方向（1セル単位）
  var DIR = {
    UP:    { x:  0, y: -1 },
    DOWN:  { x:  0, y:  1 },
    LEFT:  { x: -1, y:  0 },
    RIGHT: { x:  1, y:  0 }
  };

  // ============================================
  // 状態変数
  // ============================================
  var grid = [];           // 迷路グリッド（GRID_SIZE x GRID_SIZE）
  var playerX = 1;         // プレイヤーの現在位置（グリッド座標）
  var playerY = 1;
  var goalX = GRID_SIZE - 2;
  var goalY = GRID_SIZE - 2;
  var visited = {};        // 訪問済みセル
  var gameRunning = false;
  var gameCleared = false;
  var timerInterval = null;
  var startTime = 0;
  var elapsedTime = 0;
  var bestTime = parseFloat(localStorage.getItem('bestMaze') || '0');

  // ============================================
  // DOM要素
  // ============================================
  var board = document.getElementById('maze-board');
  var timeEl = document.getElementById('time');
  var bestTimeEl = document.getElementById('best-time');
  var gameClearOverlay = document.getElementById('game-clear-overlay');
  var gameStartOverlay = document.getElementById('game-start-overlay');
  var finalTimeEl = document.getElementById('final-time');
  var bestResultEl = document.getElementById('best-result');

  // セルの2次元配列（高速アクセス用）
  var cells = [];

  // ============================================
  // 迷路生成（再帰バックトラッキング）
  // ============================================
  function generateMaze() {
    // グリッドをすべて壁で初期化
    grid = [];
    for (var y = 0; y < GRID_SIZE; y++) {
      grid[y] = [];
      for (var x = 0; x < GRID_SIZE; x++) {
        grid[y][x] = WALL;
      }
    }

    // 再帰バックトラッキングで迷路を掘る
    // 論理座標 (cx, cy) は 0 ~ MAZE_SIZE-1
    // グリッド座標 = 論理座標 * 2 + 1
    var mazeVisited = [];
    for (var my = 0; my < MAZE_SIZE; my++) {
      mazeVisited[my] = [];
      for (var mx = 0; mx < MAZE_SIZE; mx++) {
        mazeVisited[my][mx] = false;
      }
    }

    // スタックベースの再帰バックトラッキング（スタックオーバーフロー防止）
    var stack = [];
    var startCX = 0;
    var startCY = 0;

    mazeVisited[startCY][startCX] = true;
    grid[startCY * 2 + 1][startCX * 2 + 1] = PATH;
    stack.push({ cx: startCX, cy: startCY });

    while (stack.length > 0) {
      var current = stack[stack.length - 1];
      var cx = current.cx;
      var cy = current.cy;

      // 未訪問の隣接セルを取得
      var neighbors = [];
      for (var d = 0; d < DIRS.length; d++) {
        var nx = cx + DIRS[d].dx;
        var ny = cy + DIRS[d].dy;
        if (nx >= 0 && nx < MAZE_SIZE && ny >= 0 && ny < MAZE_SIZE && !mazeVisited[ny][nx]) {
          neighbors.push({ nx: nx, ny: ny, dx: DIRS[d].dx, dy: DIRS[d].dy });
        }
      }

      if (neighbors.length === 0) {
        // 行き止まり: バックトラック
        stack.pop();
      } else {
        // ランダムに隣接セルを選択
        var chosen = neighbors[Math.floor(Math.random() * neighbors.length)];

        // 壁を壊す（現在セルと選択セルの間の壁）
        var wallGX = cx * 2 + 1 + chosen.dx;
        var wallGY = cy * 2 + 1 + chosen.dy;
        grid[wallGY][wallGX] = PATH;

        // 選択セルを通路にする
        grid[chosen.ny * 2 + 1][chosen.nx * 2 + 1] = PATH;

        // 訪問済みにしてスタックに追加
        mazeVisited[chosen.ny][chosen.nx] = true;
        stack.push({ cx: chosen.nx, cy: chosen.ny });
      }
    }
  }

  // ============================================
  // ボードの初期化（DOMセルを生成）
  // ============================================
  function createBoard() {
    board.innerHTML = '';
    board.style.gridTemplateColumns = 'repeat(' + GRID_SIZE + ', 1fr)';
    board.style.gridTemplateRows = 'repeat(' + GRID_SIZE + ', 1fr)';
    cells = [];

    for (var y = 0; y < GRID_SIZE; y++) {
      cells[y] = [];
      for (var x = 0; x < GRID_SIZE; x++) {
        var cell = document.createElement('div');
        cell.className = 'maze-cell';
        board.appendChild(cell);
        cells[y][x] = cell;
      }
    }
  }

  // ============================================
  // ボードの描画更新
  // ============================================
  function render() {
    for (var y = 0; y < GRID_SIZE; y++) {
      for (var x = 0; x < GRID_SIZE; x++) {
        var cell = cells[y][x];

        if (x === playerX && y === playerY) {
          cell.className = 'maze-cell player';
        } else if (x === goalX && y === goalY) {
          cell.className = 'maze-cell goal';
        } else if (grid[y][x] === WALL) {
          cell.className = 'maze-cell wall';
        } else if (visited[x + ',' + y]) {
          cell.className = 'maze-cell visited';
        } else {
          cell.className = 'maze-cell path';
        }
      }
    }
  }

  // ============================================
  // タイマー管理
  // ============================================
  function startTimer() {
    startTime = Date.now();
    timerInterval = setInterval(function () {
      elapsedTime = (Date.now() - startTime) / 1000;
      timeEl.textContent = elapsedTime.toFixed(1);
    }, 100);
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    // 最終時間を正確に計算
    elapsedTime = (Date.now() - startTime) / 1000;
    timeEl.textContent = elapsedTime.toFixed(1);
  }

  function resetTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    elapsedTime = 0;
    timeEl.textContent = '0.0';
  }

  // ============================================
  // ベストタイム更新
  // ============================================
  function updateBestTime() {
    if (bestTime > 0) {
      bestTimeEl.textContent = bestTime.toFixed(1);
    } else {
      bestTimeEl.textContent = '--';
    }
  }

  // ============================================
  // プレイヤー移動
  // ============================================
  function movePlayer(dir) {
    if (!gameRunning || gameCleared) return;

    var newX = playerX + dir.x;
    var newY = playerY + dir.y;

    // 範囲チェック
    if (newX < 0 || newX >= GRID_SIZE || newY < 0 || newY >= GRID_SIZE) return;

    // 壁チェック
    if (grid[newY][newX] === WALL) return;

    // 現在位置を訪問済みに
    visited[playerX + ',' + playerY] = true;

    // プレイヤーを移動
    playerX = newX;
    playerY = newY;

    // 描画更新
    render();

    // ゴール判定
    if (playerX === goalX && playerY === goalY) {
      gameClear();
    }
  }

  // ============================================
  // ゲームクリア処理
  // ============================================
  function gameClear() {
    gameRunning = false;
    gameCleared = true;
    stopTimer();

    // クリア演出
    cells[playerY][playerX].classList.add('cleared');

    // タイムを表示
    finalTimeEl.textContent = elapsedTime.toFixed(1);

    // ベストタイム更新チェック
    if (bestTime === 0 || elapsedTime < bestTime) {
      bestTime = elapsedTime;
      localStorage.setItem('bestMaze', bestTime.toString());
      updateBestTime();
      bestResultEl.textContent = 'ベストタイム更新！';
    } else {
      bestResultEl.textContent = 'ベスト: ' + bestTime.toFixed(1) + '秒';
    }

    // 少し遅延させてオーバーレイを表示
    setTimeout(function () {
      gameClearOverlay.classList.add('active');
    }, 600);
  }

  // ============================================
  // ゲーム開始・リスタート
  // ============================================
  function startGame() {
    // タイマーをリセット
    resetTimer();

    // 状態をリセット
    gameCleared = false;
    visited = {};

    // オーバーレイを非表示
    gameClearOverlay.classList.remove('active');
    gameStartOverlay.classList.remove('active');

    // 迷路を生成
    generateMaze();

    // プレイヤーとゴールの位置を設定
    playerX = 1;
    playerY = 1;
    goalX = GRID_SIZE - 2;
    goalY = GRID_SIZE - 2;

    // 描画
    render();

    // ゲーム開始
    gameRunning = true;
    startTimer();
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
      movePlayer(dir);
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
    var minDist = 20;
    var maxTime = 400;

    if (dt > maxTime) return;
    if (Math.abs(dx) < minDist && Math.abs(dy) < minDist) return;

    var dir;
    if (Math.abs(dx) > Math.abs(dy)) {
      dir = dx > 0 ? DIR.RIGHT : DIR.LEFT;
    } else {
      dir = dy > 0 ? DIR.DOWN : DIR.UP;
    }

    movePlayer(dir);
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
      movePlayer(dir);
    });

    // タッチで押した場合のスクロール防止
    btn.addEventListener('touchstart', function (e) {
      e.preventDefault();
      movePlayer(dir);
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
  // ページ離脱時にタイマーを停止
  // ============================================
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && gameRunning) {
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
      // ページが再度表示されたときにタイマーを再開
    } else if (!document.hidden && gameRunning && !gameCleared) {
      // 経過時間を維持しつつタイマーを再開
      timerInterval = setInterval(function () {
        elapsedTime = (Date.now() - startTime) / 1000;
        timeEl.textContent = elapsedTime.toFixed(1);
      }, 100);
    }
  });

  // ============================================
  // 初期化
  // ============================================
  updateBestTime();
  createBoard();
  generateMaze();
  render();
})();
