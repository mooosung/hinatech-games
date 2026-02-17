// ============================================
// テトリス ロジック
// ============================================

(function () {
  'use strict';

  // ============================================
  // 定数
  // ============================================
  var COLS = 10;              // 横のマス数
  var ROWS = 20;              // 縦のマス数
  var INITIAL_SPEED = 800;    // 初期落下速度（ミリ秒）
  var MIN_SPEED = 80;         // 最速（ミリ秒）
  var SPEED_DECREASE = 60;    // レベルごとの速度減少量
  var LINES_PER_LEVEL = 10;  // レベルアップに必要なライン数
  var LOCK_DELAY = 500;       // 接地後のロック猶予（ミリ秒）

  // スコアテーブル（消去ライン数 → 得点）
  var LINE_SCORES = {
    1: 100,
    2: 300,
    3: 500,
    4: 800
  };

  // テトロミノの定義（4つの回転状態）
  var TETROMINOS = {
    I: {
      shapes: [
        [[0,0],[1,0],[2,0],[3,0]],
        [[0,0],[0,1],[0,2],[0,3]],
        [[0,0],[1,0],[2,0],[3,0]],
        [[0,0],[0,1],[0,2],[0,3]]
      ],
      color: 'I'
    },
    O: {
      shapes: [
        [[0,0],[1,0],[0,1],[1,1]],
        [[0,0],[1,0],[0,1],[1,1]],
        [[0,0],[1,0],[0,1],[1,1]],
        [[0,0],[1,0],[0,1],[1,1]]
      ],
      color: 'O'
    },
    T: {
      shapes: [
        [[0,0],[1,0],[2,0],[1,1]],
        [[0,0],[0,1],[0,2],[1,1]],
        [[1,0],[0,1],[1,1],[2,1]],
        [[1,0],[1,1],[1,2],[0,1]]
      ],
      color: 'T'
    },
    S: {
      shapes: [
        [[1,0],[2,0],[0,1],[1,1]],
        [[0,0],[0,1],[1,1],[1,2]],
        [[1,0],[2,0],[0,1],[1,1]],
        [[0,0],[0,1],[1,1],[1,2]]
      ],
      color: 'S'
    },
    Z: {
      shapes: [
        [[0,0],[1,0],[1,1],[2,1]],
        [[1,0],[0,1],[1,1],[0,2]],
        [[0,0],[1,0],[1,1],[2,1]],
        [[1,0],[0,1],[1,1],[0,2]]
      ],
      color: 'Z'
    },
    J: {
      shapes: [
        [[0,0],[0,1],[1,1],[2,1]],
        [[0,0],[1,0],[0,1],[0,2]],
        [[0,0],[1,0],[2,0],[2,1]],
        [[1,0],[1,1],[0,2],[1,2]]
      ],
      color: 'J'
    },
    L: {
      shapes: [
        [[2,0],[0,1],[1,1],[2,1]],
        [[0,0],[0,1],[0,2],[1,2]],
        [[0,0],[1,0],[2,0],[0,1]],
        [[0,0],[1,0],[1,1],[1,2]]
      ],
      color: 'L'
    }
  };

  var PIECE_NAMES = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

  // ============================================
  // 状態変数
  // ============================================
  var board = [];               // ボード配列 [row][col] = '' or color名
  var currentPiece = null;      // 現在のピース { type, rotation, x, y }
  var nextPieceType = null;     // 次のピースの種類
  var score = 0;
  var bestScore = parseInt(localStorage.getItem('bestTetris') || '0', 10);
  var level = 1;
  var totalLines = 0;
  var gameRunning = false;
  var gameOverFlag = false;
  var gameLoopTimer = null;
  var currentSpeed = INITIAL_SPEED;
  var lockTimer = null;
  var isLocking = false;

  // ============================================
  // DOM要素
  // ============================================
  var boardEl = document.getElementById('tetris-board');
  var scoreEl = document.getElementById('score');
  var bestScoreEl = document.getElementById('best-score');
  var levelEl = document.getElementById('level');
  var gameOverOverlay = document.getElementById('game-over-overlay');
  var gameStartOverlay = document.getElementById('game-start-overlay');
  var finalScoreEl = document.getElementById('final-score');
  var bestResultEl = document.getElementById('best-result');
  var nextPieceBox = document.getElementById('next-piece-box');

  // セルの2次元配列（高速アクセス用）
  var cells = [];
  var nextCells = [];

  // ============================================
  // ボードの初期化（DOMセルを生成）
  // ============================================
  function createBoard() {
    boardEl.innerHTML = '';
    cells = [];

    for (var y = 0; y < ROWS; y++) {
      cells[y] = [];
      for (var x = 0; x < COLS; x++) {
        var cell = document.createElement('div');
        cell.className = 'tetris-cell';
        boardEl.appendChild(cell);
        cells[y][x] = cell;
      }
    }
  }

  function createNextPieceDisplay() {
    nextPieceBox.innerHTML = '';
    nextCells = [];

    for (var y = 0; y < 4; y++) {
      nextCells[y] = [];
      for (var x = 0; x < 4; x++) {
        var cell = document.createElement('div');
        cell.className = 'next-cell';
        nextPieceBox.appendChild(cell);
        nextCells[y][x] = cell;
      }
    }
  }

  // ============================================
  // ボードデータ初期化
  // ============================================
  function initBoard() {
    board = [];
    for (var y = 0; y < ROWS; y++) {
      board[y] = [];
      for (var x = 0; x < COLS; x++) {
        board[y][x] = '';
      }
    }
  }

  // ============================================
  // ランダムなテトロミノを生成
  // ============================================
  function randomPieceType() {
    return PIECE_NAMES[Math.floor(Math.random() * PIECE_NAMES.length)];
  }

  // ============================================
  // 新しいピースを生成
  // ============================================
  function spawnPiece() {
    var type = nextPieceType || randomPieceType();
    nextPieceType = randomPieceType();

    var piece = {
      type: type,
      rotation: 0,
      x: Math.floor(COLS / 2) - 1,
      y: 0
    };

    // I型は少し左にずらす
    if (type === 'I') {
      piece.x = Math.floor(COLS / 2) - 2;
    }

    // 設置できるか確認
    if (!isValidPosition(piece)) {
      // ゲームオーバー
      return null;
    }

    return piece;
  }

  // ============================================
  // ピースの現在の形状を取得
  // ============================================
  function getShape(piece) {
    return TETROMINOS[piece.type].shapes[piece.rotation];
  }

  // ============================================
  // ピースの位置が有効か判定
  // ============================================
  function isValidPosition(piece) {
    var shape = getShape(piece);

    for (var i = 0; i < shape.length; i++) {
      var newX = piece.x + shape[i][0];
      var newY = piece.y + shape[i][1];

      // 範囲外チェック
      if (newX < 0 || newX >= COLS || newY < 0 || newY >= ROWS) {
        return false;
      }

      // 他のブロックとの衝突チェック
      if (board[newY][newX] !== '') {
        return false;
      }
    }

    return true;
  }

  // ============================================
  // ゴースト位置の計算（ハードドロップ先）
  // ============================================
  function getGhostY(piece) {
    var ghostY = piece.y;

    while (true) {
      var testPiece = { type: piece.type, rotation: piece.rotation, x: piece.x, y: ghostY + 1 };
      if (!isValidPosition(testPiece)) {
        break;
      }
      ghostY++;
    }

    return ghostY;
  }

  // ============================================
  // ボードの描画更新
  // ============================================
  function render() {
    // すべてのセルをリセット
    for (var y = 0; y < ROWS; y++) {
      for (var x = 0; x < COLS; x++) {
        if (board[y][x] !== '') {
          cells[y][x].className = 'tetris-cell cell-' + board[y][x];
        } else {
          cells[y][x].className = 'tetris-cell';
        }
      }
    }

    if (currentPiece) {
      // ゴーストピースを描画
      var ghostY = getGhostY(currentPiece);
      if (ghostY !== currentPiece.y) {
        var ghostShape = getShape(currentPiece);
        for (var i = 0; i < ghostShape.length; i++) {
          var gx = currentPiece.x + ghostShape[i][0];
          var gy = ghostY + ghostShape[i][1];
          if (gy >= 0 && gy < ROWS && gx >= 0 && gx < COLS && board[gy][gx] === '') {
            cells[gy][gx].className = 'tetris-cell cell-ghost';
          }
        }
      }

      // 現在のピースを描画
      var shape = getShape(currentPiece);
      var color = TETROMINOS[currentPiece.type].color;
      for (var i = 0; i < shape.length; i++) {
        var px = currentPiece.x + shape[i][0];
        var py = currentPiece.y + shape[i][1];
        if (py >= 0 && py < ROWS && px >= 0 && px < COLS) {
          cells[py][px].className = 'tetris-cell cell-' + color;
        }
      }
    }

    // ネクストピースを描画
    renderNextPiece();
  }

  // ============================================
  // ネクストピースの描画
  // ============================================
  function renderNextPiece() {
    // リセット
    for (var y = 0; y < 4; y++) {
      for (var x = 0; x < 4; x++) {
        nextCells[y][x].className = 'next-cell';
      }
    }

    if (!nextPieceType) return;

    var shape = TETROMINOS[nextPieceType].shapes[0];
    var color = TETROMINOS[nextPieceType].color;

    // ピースを中央寄せするためのオフセットを計算
    var minX = 4, maxX = 0, minY = 4, maxY = 0;
    for (var i = 0; i < shape.length; i++) {
      if (shape[i][0] < minX) minX = shape[i][0];
      if (shape[i][0] > maxX) maxX = shape[i][0];
      if (shape[i][1] < minY) minY = shape[i][1];
      if (shape[i][1] > maxY) maxY = shape[i][1];
    }
    var pieceWidth = maxX - minX + 1;
    var pieceHeight = maxY - minY + 1;
    var offsetX = Math.floor((4 - pieceWidth) / 2) - minX;
    var offsetY = Math.floor((4 - pieceHeight) / 2) - minY;

    for (var i = 0; i < shape.length; i++) {
      var nx = shape[i][0] + offsetX;
      var ny = shape[i][1] + offsetY;
      if (nx >= 0 && nx < 4 && ny >= 0 && ny < 4) {
        nextCells[ny][nx].className = 'next-cell cell-' + color;
      }
    }
  }

  // ============================================
  // ピースをボードに固定
  // ============================================
  function lockPiece() {
    var shape = getShape(currentPiece);
    var color = TETROMINOS[currentPiece.type].color;

    for (var i = 0; i < shape.length; i++) {
      var px = currentPiece.x + shape[i][0];
      var py = currentPiece.y + shape[i][1];
      if (py >= 0 && py < ROWS && px >= 0 && px < COLS) {
        board[py][px] = color;
      }
    }

    // ロックタイマーをクリア
    clearLockTimer();
    isLocking = false;
  }

  // ============================================
  // ライン消去チェック
  // ============================================
  function clearLines() {
    var linesCleared = 0;
    var linesToClear = [];

    for (var y = ROWS - 1; y >= 0; y--) {
      var full = true;
      for (var x = 0; x < COLS; x++) {
        if (board[y][x] === '') {
          full = false;
          break;
        }
      }
      if (full) {
        linesToClear.push(y);
        linesCleared++;
      }
    }

    if (linesCleared > 0) {
      // 消去アニメーション
      for (var i = 0; i < linesToClear.length; i++) {
        var row = linesToClear[i];
        for (var x = 0; x < COLS; x++) {
          cells[row][x].classList.add('clearing');
        }
      }

      // アニメーション後にラインを実際に消去
      setTimeout(function () {
        // ラインを上から順にソート（下から消すため）
        linesToClear.sort(function (a, b) { return a - b; });

        for (var i = linesToClear.length - 1; i >= 0; i--) {
          board.splice(linesToClear[i], 1);
        }

        // 上に空行を追加
        for (var i = 0; i < linesCleared; i++) {
          var emptyRow = [];
          for (var x = 0; x < COLS; x++) {
            emptyRow.push('');
          }
          board.unshift(emptyRow);
        }

        // スコア計算
        var lineScore = LINE_SCORES[linesCleared] || (linesCleared * 200);
        score += lineScore * level;
        totalLines += linesCleared;

        // レベルアップ
        var newLevel = Math.floor(totalLines / LINES_PER_LEVEL) + 1;
        if (newLevel > level) {
          level = newLevel;
          currentSpeed = calcSpeed();
          levelEl.textContent = level;
        }

        updateScore();
        render();
      }, 300);
    }

    return linesCleared;
  }

  // ============================================
  // スコア更新
  // ============================================
  function updateScore() {
    scoreEl.textContent = score;
    if (score > bestScore) {
      bestScore = score;
      localStorage.setItem('bestTetris', bestScore.toString());
    }
    bestScoreEl.textContent = bestScore;
  }

  // ============================================
  // 速度の計算（レベルに応じて速くなる）
  // ============================================
  function calcSpeed() {
    var speed = INITIAL_SPEED - ((level - 1) * SPEED_DECREASE);
    return Math.max(speed, MIN_SPEED);
  }

  // ============================================
  // ピースを左右に移動
  // ============================================
  function movePiece(dx) {
    if (!currentPiece || !gameRunning) return;

    var testPiece = {
      type: currentPiece.type,
      rotation: currentPiece.rotation,
      x: currentPiece.x + dx,
      y: currentPiece.y
    };

    if (isValidPosition(testPiece)) {
      currentPiece.x = testPiece.x;

      // ロック中に横移動した場合、ロックタイマーをリセット
      if (isLocking) {
        resetLockTimer();
      }

      render();
    }
  }

  // ============================================
  // ピースを回転
  // ============================================
  function rotatePiece() {
    if (!currentPiece || !gameRunning) return;

    var newRotation = (currentPiece.rotation + 1) % 4;
    var testPiece = {
      type: currentPiece.type,
      rotation: newRotation,
      x: currentPiece.x,
      y: currentPiece.y
    };

    // 通常の回転を試す
    if (isValidPosition(testPiece)) {
      currentPiece.rotation = newRotation;
      if (isLocking) {
        resetLockTimer();
      }
      render();
      return;
    }

    // ウォールキック: 左右にずらして試す
    var kicks = [1, -1, 2, -2];
    for (var i = 0; i < kicks.length; i++) {
      testPiece.x = currentPiece.x + kicks[i];
      if (isValidPosition(testPiece)) {
        currentPiece.rotation = newRotation;
        currentPiece.x = testPiece.x;
        if (isLocking) {
          resetLockTimer();
        }
        render();
        return;
      }
    }
  }

  // ============================================
  // ソフトドロップ（1マス下に移動）
  // ============================================
  function softDrop() {
    if (!currentPiece || !gameRunning) return false;

    var testPiece = {
      type: currentPiece.type,
      rotation: currentPiece.rotation,
      x: currentPiece.x,
      y: currentPiece.y + 1
    };

    if (isValidPosition(testPiece)) {
      currentPiece.y = testPiece.y;
      score += 1;
      updateScore();
      render();
      return true;
    }

    return false;
  }

  // ============================================
  // ハードドロップ（一番下まで落とす）
  // ============================================
  function hardDrop() {
    if (!currentPiece || !gameRunning) return;

    var ghostY = getGhostY(currentPiece);
    var dropDistance = ghostY - currentPiece.y;
    currentPiece.y = ghostY;
    score += dropDistance * 2;
    updateScore();

    // 即座にロック
    clearLockTimer();
    isLocking = false;
    lockPiece();

    var linesCleared = clearLines();

    // 次のピースを出す
    currentPiece = spawnPiece();
    if (!currentPiece) {
      gameOver();
      return;
    }

    render();

    // ゲームループをリスタート
    clearGameLoop();
    if (linesCleared > 0) {
      // ライン消去アニメーション後にゲームループ再開
      gameLoopTimer = setTimeout(gameStep, 350);
    } else {
      gameLoopTimer = setTimeout(gameStep, currentSpeed);
    }
  }

  // ============================================
  // ロックタイマー管理
  // ============================================
  function clearLockTimer() {
    if (lockTimer) {
      clearTimeout(lockTimer);
      lockTimer = null;
    }
  }

  function resetLockTimer() {
    clearLockTimer();
    lockTimer = setTimeout(function () {
      if (!gameRunning || !currentPiece) return;

      // まだ接地しているか確認
      var testPiece = {
        type: currentPiece.type,
        rotation: currentPiece.rotation,
        x: currentPiece.x,
        y: currentPiece.y + 1
      };

      if (!isValidPosition(testPiece)) {
        // ロック実行
        lockPiece();
        isLocking = false;

        var linesCleared = clearLines();

        currentPiece = spawnPiece();
        if (!currentPiece) {
          gameOver();
          return;
        }

        render();

        clearGameLoop();
        if (linesCleared > 0) {
          gameLoopTimer = setTimeout(gameStep, 350);
        } else {
          gameLoopTimer = setTimeout(gameStep, currentSpeed);
        }
      } else {
        isLocking = false;
      }
    }, LOCK_DELAY);
  }

  // ============================================
  // ゲームループのクリア
  // ============================================
  function clearGameLoop() {
    if (gameLoopTimer) {
      clearTimeout(gameLoopTimer);
      gameLoopTimer = null;
    }
  }

  // ============================================
  // ゲームの1ステップ（自動落下）
  // ============================================
  function gameStep() {
    if (!gameRunning || gameOverFlag || !currentPiece) return;

    var testPiece = {
      type: currentPiece.type,
      rotation: currentPiece.rotation,
      x: currentPiece.x,
      y: currentPiece.y + 1
    };

    if (isValidPosition(testPiece)) {
      currentPiece.y = testPiece.y;
      isLocking = false;
      clearLockTimer();
      render();
      gameLoopTimer = setTimeout(gameStep, currentSpeed);
    } else {
      // 接地した。ロック猶予を開始
      if (!isLocking) {
        isLocking = true;
        resetLockTimer();
      }
      render();
      // 自動落下ループは止まる。ロックタイマーが次のステップを引き受ける
      gameLoopTimer = setTimeout(gameStep, currentSpeed);
    }
  }

  // ============================================
  // ゲームオーバー処理
  // ============================================
  function gameOver() {
    gameRunning = false;
    gameOverFlag = true;

    clearGameLoop();
    clearLockTimer();

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
    clearGameLoop();
    clearLockTimer();

    // 状態をリセット
    score = 0;
    level = 1;
    totalLines = 0;
    gameOverFlag = false;
    isLocking = false;
    currentSpeed = INITIAL_SPEED;
    updateScore();
    levelEl.textContent = level;

    // オーバーレイを非表示
    gameOverOverlay.classList.remove('active');
    gameStartOverlay.classList.remove('active');

    // ボードを初期化
    initBoard();

    // 最初のピースを生成
    nextPieceType = randomPieceType();
    currentPiece = spawnPiece();
    render();

    // ゲームループ開始
    gameRunning = true;
    gameLoopTimer = setTimeout(gameStep, currentSpeed);
  }

  // ============================================
  // キーボード操作
  // ============================================
  document.addEventListener('keydown', function (e) {
    if (!gameRunning || gameOverFlag) {
      // スタート画面でキーが押されたらゲーム開始
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (!gameRunning && !gameOverFlag) {
          startGame();
        }
      }
      return;
    }

    switch (e.key) {
      case 'ArrowLeft':
      case 'a':
      case 'A':
        e.preventDefault();
        movePiece(-1);
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        e.preventDefault();
        movePiece(1);
        break;
      case 'ArrowUp':
      case 'w':
      case 'W':
        e.preventDefault();
        rotatePiece();
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        e.preventDefault();
        if (softDrop()) {
          // ソフトドロップ成功時、ゲームループをリセット
          clearGameLoop();
          gameLoopTimer = setTimeout(gameStep, currentSpeed);
        }
        break;
      case ' ':
        e.preventDefault();
        hardDrop();
        break;
    }
  });

  // ============================================
  // モバイル操作ボタン
  // ============================================
  function setupMobileButton(btnId, action) {
    var btn = document.getElementById(btnId);
    if (!btn) return;

    btn.addEventListener('click', function (e) {
      e.preventDefault();
      if (!gameRunning && !gameOverFlag) {
        startGame();
        return;
      }
      if (gameRunning) {
        action();
      }
    });

    btn.addEventListener('touchstart', function (e) {
      e.preventDefault();
      if (!gameRunning && !gameOverFlag) {
        startGame();
        return;
      }
      if (gameRunning) {
        action();
      }
    }, { passive: false });
  }

  setupMobileButton('btn-left', function () { movePiece(-1); });
  setupMobileButton('btn-right', function () { movePiece(1); });
  setupMobileButton('btn-rotate', function () { rotatePiece(); });
  setupMobileButton('btn-down', function () {
    if (softDrop()) {
      clearGameLoop();
      gameLoopTimer = setTimeout(gameStep, currentSpeed);
    }
  });
  setupMobileButton('btn-drop', function () { hardDrop(); });

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
      clearGameLoop();
      clearLockTimer();
      gameRunning = false;
    }
  });

  // ============================================
  // 初期化
  // ============================================
  bestScoreEl.textContent = bestScore;
  createBoard();
  createNextPieceDisplay();
  initBoard();

  // ネクストピースのプレビュー用に初期化
  nextPieceType = randomPieceType();
  renderNextPiece();
})();
