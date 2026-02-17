// ============================================
// マインスイーパー ゲームロジック
// ============================================

(function () {
  'use strict';

  // 難易度設定
  var DIFFICULTIES = {
    easy:   { rows: 9,  cols: 9,  mines: 10, label: 'かんたん' },
    normal: { rows: 16, cols: 16, mines: 40, label: 'ふつう' },
    hard:   { rows: 16, cols: 30, mines: 99, label: 'むずかしい' }
  };

  // ゲーム状態
  var currentDifficulty = 'easy';
  var rows = 9;
  var cols = 9;
  var totalMines = 10;
  var board = [];       // board[r][c] = { mine, revealed, flagged, adjacentMines }
  var gameStarted = false;
  var gameEnded = false;
  var isWin = false;
  var revealedCount = 0;
  var flagCount = 0;
  var timerInterval = null;
  var timerSeconds = 0;

  // DOM要素
  var boardEl = document.getElementById('ms-board');
  var mineCounterEl = document.getElementById('mine-counter');
  var timerEl = document.getElementById('timer');
  var smileyBtn = document.getElementById('btn-smiley');
  var messageEl = document.getElementById('ms-message');
  var bestTimeEl = document.getElementById('best-time-display');
  var diffButtons = document.querySelectorAll('.ms-diff-btn');

  // 長押し検出用
  var longPressTimer = null;
  var longPressTriggered = false;
  var LONG_PRESS_DURATION = 500;

  // 8方向の隣接オフセット
  var NEIGHBORS = [
    [-1, -1], [-1, 0], [-1, 1],
    [0,  -1],          [0,  1],
    [1,  -1], [1,  0], [1,  1]
  ];

  // ============================================
  // 初期化
  // ============================================

  function initGame() {
    // タイマーリセット
    stopTimer();
    timerSeconds = 0;
    updateTimerDisplay();

    // 状態リセット
    gameStarted = false;
    gameEnded = false;
    isWin = false;
    revealedCount = 0;
    flagCount = 0;

    // 難易度設定の適用
    var diff = DIFFICULTIES[currentDifficulty];
    rows = diff.rows;
    cols = diff.cols;
    totalMines = diff.mines;

    // ボード初期化（地雷はまだ配置しない → 最初のクリックで配置）
    board = [];
    for (var r = 0; r < rows; r++) {
      board[r] = [];
      for (var c = 0; c < cols; c++) {
        board[r][c] = {
          mine: false,
          revealed: false,
          flagged: false,
          adjacentMines: 0
        };
      }
    }

    // UI更新
    updateMineCounter();
    updateSmiley('normal');
    messageEl.textContent = '';
    messageEl.className = 'ms-message';

    // ベストタイム表示
    showBestTime();

    // ボード描画
    renderBoard();
  }

  // ============================================
  // 地雷配置（最初のクリック後）
  // ============================================

  function placeMines(safeRow, safeCol) {
    // 安全なセル（クリック位置とその周囲）のセットを作る
    var safeSet = {};
    safeSet[safeRow + ',' + safeCol] = true;
    for (var i = 0; i < NEIGHBORS.length; i++) {
      var nr = safeRow + NEIGHBORS[i][0];
      var nc = safeCol + NEIGHBORS[i][1];
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
        safeSet[nr + ',' + nc] = true;
      }
    }

    // 地雷をランダム配置
    var placed = 0;
    while (placed < totalMines) {
      var r = Math.floor(Math.random() * rows);
      var c = Math.floor(Math.random() * cols);
      var key = r + ',' + c;
      if (!board[r][c].mine && !safeSet[key]) {
        board[r][c].mine = true;
        placed++;
      }
    }

    // 隣接地雷数を計算
    for (var r2 = 0; r2 < rows; r2++) {
      for (var c2 = 0; c2 < cols; c2++) {
        if (board[r2][c2].mine) continue;
        var count = 0;
        for (var n = 0; n < NEIGHBORS.length; n++) {
          var nr2 = r2 + NEIGHBORS[n][0];
          var nc2 = c2 + NEIGHBORS[n][1];
          if (nr2 >= 0 && nr2 < rows && nc2 >= 0 && nc2 < cols && board[nr2][nc2].mine) {
            count++;
          }
        }
        board[r2][c2].adjacentMines = count;
      }
    }
  }

  // ============================================
  // ボード描画
  // ============================================

  function renderBoard() {
    boardEl.innerHTML = '';
    boardEl.style.gridTemplateColumns = 'repeat(' + cols + ', auto)';

    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var cell = document.createElement('div');
        cell.className = 'ms-cell ms-cell-hidden';
        cell.dataset.row = r;
        cell.dataset.col = c;
        boardEl.appendChild(cell);
      }
    }

    // イベントリスナーはボード全体に委譲
    boardEl.removeEventListener('mousedown', handleMouseDown);
    boardEl.removeEventListener('mouseup', handleMouseUp);
    boardEl.removeEventListener('contextmenu', handleContextMenu);
    boardEl.removeEventListener('touchstart', handleTouchStart);
    boardEl.removeEventListener('touchend', handleTouchEnd);
    boardEl.removeEventListener('touchmove', handleTouchMove);

    boardEl.addEventListener('mousedown', handleMouseDown);
    boardEl.addEventListener('mouseup', handleMouseUp);
    boardEl.addEventListener('contextmenu', handleContextMenu);
    boardEl.addEventListener('touchstart', handleTouchStart, { passive: false });
    boardEl.addEventListener('touchend', handleTouchEnd, { passive: false });
    boardEl.addEventListener('touchmove', handleTouchMove, { passive: false });
  }

  // セルのDOM要素を取得
  function getCellEl(r, c) {
    return boardEl.querySelector('[data-row="' + r + '"][data-col="' + c + '"]');
  }

  // セルの表示を更新
  function updateCellDisplay(r, c) {
    var cellData = board[r][c];
    var cellEl = getCellEl(r, c);
    if (!cellEl) return;

    // クラスをリセット
    cellEl.className = 'ms-cell';
    cellEl.textContent = '';

    if (cellData.revealed) {
      if (cellData.mine) {
        // 地雷セル
        cellEl.classList.add('ms-cell-mine');
      } else {
        // 通常の開封セル
        cellEl.classList.add('ms-cell-revealed');
        if (cellData.adjacentMines > 0) {
          cellEl.textContent = cellData.adjacentMines;
          cellEl.classList.add('ms-num-' + cellData.adjacentMines);
        }
      }
    } else if (cellData.flagged) {
      cellEl.classList.add('ms-cell-hidden');
      cellEl.classList.add('ms-cell-flagged');
    } else {
      cellEl.classList.add('ms-cell-hidden');
    }
  }

  // ============================================
  // マウスイベント処理
  // ============================================

  function handleMouseDown(e) {
    if (gameEnded) return;
    var cellEl = e.target.closest('.ms-cell');
    if (!cellEl) return;

    // 左クリック中はスマイリーを😮に
    if (e.button === 0) {
      updateSmiley('clicking');
    }
  }

  function handleMouseUp(e) {
    if (gameEnded) return;
    var cellEl = e.target.closest('.ms-cell');
    if (!cellEl) return;

    var r = parseInt(cellEl.dataset.row, 10);
    var c = parseInt(cellEl.dataset.col, 10);

    if (e.button === 0) {
      // 左クリック → セルを開く
      updateSmiley('normal');
      revealCell(r, c);
    } else if (e.button === 2) {
      // 右クリック → 旗のトグル
      toggleFlag(r, c);
    }
  }

  function handleContextMenu(e) {
    e.preventDefault();
  }

  // ============================================
  // タッチイベント処理（モバイル用）
  // ============================================

  function handleTouchStart(e) {
    if (gameEnded) return;
    var cellEl = e.target.closest('.ms-cell');
    if (!cellEl) return;

    e.preventDefault();

    var r = parseInt(cellEl.dataset.row, 10);
    var c = parseInt(cellEl.dataset.col, 10);

    longPressTriggered = false;

    // 長押しタイマー開始
    longPressTimer = setTimeout(function () {
      longPressTriggered = true;
      toggleFlag(r, c);
    }, LONG_PRESS_DURATION);

    updateSmiley('clicking');
  }

  function handleTouchEnd(e) {
    if (gameEnded) return;
    var cellEl = e.target.closest('.ms-cell');

    clearTimeout(longPressTimer);
    longPressTimer = null;

    updateSmiley('normal');

    if (!cellEl) return;
    if (longPressTriggered) {
      longPressTriggered = false;
      return;
    }

    e.preventDefault();

    var r = parseInt(cellEl.dataset.row, 10);
    var c = parseInt(cellEl.dataset.col, 10);

    revealCell(r, c);
  }

  function handleTouchMove(e) {
    // タッチが動いたら長押しキャンセル
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }

  // ============================================
  // ゲームロジック
  // ============================================

  // セルを開く
  function revealCell(r, c) {
    if (gameEnded) return;
    var cellData = board[r][c];

    // 旗の付いたセル、既に開かれたセルは無視
    if (cellData.flagged || cellData.revealed) return;

    // 最初のクリック処理
    if (!gameStarted) {
      gameStarted = true;
      placeMines(r, c);
      startTimer();
    }

    // 地雷を踏んだ場合
    if (cellData.mine) {
      gameOver(r, c);
      return;
    }

    // セルを開く（フラッドフィルで空白セルも展開）
    floodReveal(r, c);

    // 勝利判定
    checkWin();
  }

  // フラッドフィル（再帰的にセルを開く）
  function floodReveal(r, c) {
    // 範囲チェック
    if (r < 0 || r >= rows || c < 0 || c >= cols) return;

    var cellData = board[r][c];

    // 既に開封済み、旗付き、地雷は処理しない
    if (cellData.revealed || cellData.flagged || cellData.mine) return;

    // セルを開く
    cellData.revealed = true;
    revealedCount++;
    updateCellDisplay(r, c);

    // 隣接地雷が0なら周囲も開く
    if (cellData.adjacentMines === 0) {
      for (var i = 0; i < NEIGHBORS.length; i++) {
        floodReveal(r + NEIGHBORS[i][0], c + NEIGHBORS[i][1]);
      }
    }
  }

  // 旗のトグル
  function toggleFlag(r, c) {
    if (gameEnded) return;
    var cellData = board[r][c];

    // 開封済みセルは旗を立てられない
    if (cellData.revealed) return;

    if (cellData.flagged) {
      cellData.flagged = false;
      flagCount--;
    } else {
      cellData.flagged = true;
      flagCount++;
    }

    updateCellDisplay(r, c);
    updateMineCounter();
  }

  // 勝利判定
  function checkWin() {
    var totalCells = rows * cols;
    var nonMineCells = totalCells - totalMines;

    if (revealedCount === nonMineCells) {
      // 勝利！
      gameEnded = true;
      isWin = true;
      stopTimer();
      updateSmiley('win');

      // 残りの地雷に自動的に旗を立てる
      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
          if (board[r][c].mine && !board[r][c].flagged) {
            board[r][c].flagged = true;
            flagCount++;
            updateCellDisplay(r, c);
          }
        }
      }
      updateMineCounter();

      // ベストタイムの更新
      saveBestTime(timerSeconds);
      showBestTime();

      // メッセージ表示
      messageEl.textContent = '🎉 クリア！ タイム: ' + formatTime(timerSeconds);
      messageEl.className = 'ms-message ms-message-win';
    }
  }

  // ゲームオーバー
  function gameOver(hitRow, hitCol) {
    gameEnded = true;
    isWin = false;
    stopTimer();
    updateSmiley('lose');

    // すべての地雷を表示、間違った旗もマーク
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var cellData = board[r][c];
        var cellEl = getCellEl(r, c);
        if (!cellEl) continue;

        if (cellData.mine) {
          if (r === hitRow && c === hitCol) {
            // クリックした地雷（赤背景）
            cellEl.className = 'ms-cell ms-cell-mine-hit';
          } else if (!cellData.flagged) {
            // 未発見の地雷
            cellEl.className = 'ms-cell ms-cell-mine';
          }
          // 旗付きの地雷はそのまま（正解）
        } else if (cellData.flagged) {
          // 間違った旗
          cellEl.className = 'ms-cell ms-cell-wrong-flag';
        }
      }
    }

    // メッセージ表示
    messageEl.textContent = '💥 ゲームオーバー…';
    messageEl.className = 'ms-message ms-message-lose';
  }

  // ============================================
  // タイマー
  // ============================================

  function startTimer() {
    timerSeconds = 0;
    updateTimerDisplay();
    timerInterval = setInterval(function () {
      timerSeconds++;
      if (timerSeconds > 999) timerSeconds = 999;
      updateTimerDisplay();
    }, 1000);
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  function updateTimerDisplay() {
    timerEl.textContent = padNumber(timerSeconds, 3);
  }

  // ============================================
  // 地雷カウンター
  // ============================================

  function updateMineCounter() {
    var remaining = totalMines - flagCount;
    mineCounterEl.textContent = padNumber(remaining, 3);
  }

  // ============================================
  // スマイリーフェイス
  // ============================================

  function updateSmiley(state) {
    var faces = {
      normal:   '😊',
      clicking: '😮',
      win:      '😎',
      lose:     '😵'
    };
    smileyBtn.textContent = faces[state] || '😊';
  }

  // ============================================
  // ベストタイム（localStorage）
  // ============================================

  function getBestTimeKey() {
    return 'minesweeper_best_' + currentDifficulty;
  }

  function getBestTime() {
    var val = localStorage.getItem(getBestTimeKey());
    return val ? parseInt(val, 10) : null;
  }

  function saveBestTime(seconds) {
    var current = getBestTime();
    if (current === null || seconds < current) {
      localStorage.setItem(getBestTimeKey(), seconds.toString());
    }
  }

  function showBestTime() {
    var best = getBestTime();
    if (best !== null) {
      bestTimeEl.textContent = '🏆 ベストタイム（' + DIFFICULTIES[currentDifficulty].label + '）: ' + formatTime(best);
    } else {
      bestTimeEl.textContent = '';
    }
  }

  // ============================================
  // ユーティリティ
  // ============================================

  function padNumber(num, len) {
    var s = Math.max(0, num).toString();
    while (s.length < len) s = '0' + s;
    return s;
  }

  function formatTime(seconds) {
    var m = Math.floor(seconds / 60);
    var s = seconds % 60;
    if (m > 0) {
      return m + '分' + padNumber(s, 2) + '秒';
    }
    return s + '秒';
  }

  // ============================================
  // イベントリスナー
  // ============================================

  // スマイリーボタン（新しいゲーム）
  smileyBtn.addEventListener('click', function () {
    initGame();
  });

  // 難易度ボタン
  for (var i = 0; i < diffButtons.length; i++) {
    diffButtons[i].addEventListener('click', function () {
      var diff = this.dataset.difficulty;
      if (diff === currentDifficulty && !gameEnded && !gameStarted) return;

      // アクティブクラス更新
      for (var j = 0; j < diffButtons.length; j++) {
        diffButtons[j].classList.remove('active');
      }
      this.classList.add('active');

      currentDifficulty = diff;
      initGame();
    });
  }

  // ============================================
  // ゲーム開始
  // ============================================

  initGame();

})();
