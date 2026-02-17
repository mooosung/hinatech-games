// ============================================
// 数独 ゲームロジック
// ============================================

(function () {
  'use strict';

  var SIZE = 9;
  var BOX = 3;

  // ゲーム状態
  var solution = [];   // 完成盤面 solution[r][c] = 1-9
  var puzzle = [];     // パズル盤面（0 = 空きマス）
  var userGrid = [];   // ユーザー入力 userGrid[r][c] = 0-9
  var fixed = [];      // fixed[r][c] = true ならプリセット
  var selectedRow = -1;
  var selectedCol = -1;
  var gameEnded = false;
  var timerInterval = null;
  var timerSeconds = 0;

  // DOM要素
  var boardEl = document.getElementById('sudoku-board');
  var timerEl = document.getElementById('timer');
  var bestTimeEl = document.getElementById('best-time');
  var clearOverlay = document.getElementById('game-clear-overlay');
  var clearTimeEl = document.getElementById('clear-time');
  var btnNewGame = document.getElementById('btn-new-game');
  var btnPlayAgain = document.getElementById('btn-play-again');
  var numButtons = document.querySelectorAll('.num-btn');

  // ============================================
  // 盤面生成
  // ============================================

  // 完全に解かれた数独盤面を生成
  function generateSolvedBoard() {
    var board = [];
    for (var r = 0; r < SIZE; r++) {
      board[r] = [];
      for (var c = 0; c < SIZE; c++) {
        board[r][c] = 0;
      }
    }

    // シードとなるベース盤面を作成し、シャッフルする
    // まず対角3ブロックを独立に埋める（相互制約なし）
    for (var b = 0; b < SIZE; b += BOX) {
      var nums = shuffleArray([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      var idx = 0;
      for (var r2 = b; r2 < b + BOX; r2++) {
        for (var c2 = b; c2 < b + BOX; c2++) {
          board[r2][c2] = nums[idx++];
        }
      }
    }

    // 残りをバックトラッキングで解く
    if (solveBoard(board)) {
      return board;
    }

    // フォールバック：再試行
    return generateSolvedBoard();
  }

  // バックトラッキングで盤面を解く
  function solveBoard(board) {
    var empty = findEmpty(board);
    if (!empty) return true; // 全て埋まった

    var r = empty.r;
    var c = empty.c;
    var candidates = shuffleArray([1, 2, 3, 4, 5, 6, 7, 8, 9]);

    for (var i = 0; i < candidates.length; i++) {
      var num = candidates[i];
      if (isValidPlacement(board, r, c, num)) {
        board[r][c] = num;
        if (solveBoard(board)) {
          return true;
        }
        board[r][c] = 0;
      }
    }

    return false;
  }

  // 空きマスを見つける
  function findEmpty(board) {
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        if (board[r][c] === 0) return { r: r, c: c };
      }
    }
    return null;
  }

  // 数字の配置が有効か判定
  function isValidPlacement(board, row, col, num) {
    // 行チェック
    for (var c = 0; c < SIZE; c++) {
      if (board[row][c] === num) return false;
    }

    // 列チェック
    for (var r = 0; r < SIZE; r++) {
      if (board[r][col] === num) return false;
    }

    // 3x3ブロックチェック
    var boxRow = Math.floor(row / BOX) * BOX;
    var boxCol = Math.floor(col / BOX) * BOX;
    for (var r2 = boxRow; r2 < boxRow + BOX; r2++) {
      for (var c2 = boxCol; c2 < boxCol + BOX; c2++) {
        if (board[r2][c2] === num) return false;
      }
    }

    return true;
  }

  // 配列をシャッフル（Fisher-Yates）
  function shuffleArray(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i];
      a[i] = a[j];
      a[j] = tmp;
    }
    return a;
  }

  // パズル生成（解盤面からセルを削除）
  function generatePuzzle(solvedBoard, clueCount) {
    var puz = [];
    for (var r = 0; r < SIZE; r++) {
      puz[r] = solvedBoard[r].slice();
    }

    // 全セルのインデックスをシャッフル
    var cells = [];
    for (var r2 = 0; r2 < SIZE; r2++) {
      for (var c2 = 0; c2 < SIZE; c2++) {
        cells.push({ r: r2, c: c2 });
      }
    }
    cells = shuffleArray(cells);

    var removed = 0;
    var target = SIZE * SIZE - clueCount;

    for (var i = 0; i < cells.length && removed < target; i++) {
      var cr = cells[i].r;
      var cc = cells[i].c;
      var backup = puz[cr][cc];
      puz[cr][cc] = 0;

      // 唯一解チェック（パフォーマンスのため簡易版）
      if (countSolutions(puz, 2) === 1) {
        removed++;
      } else {
        puz[cr][cc] = backup;
      }
    }

    return puz;
  }

  // 解の数をカウント（上限付き）
  function countSolutions(board, limit) {
    var copy = [];
    for (var r = 0; r < SIZE; r++) {
      copy[r] = board[r].slice();
    }
    var count = { val: 0 };
    countSolve(copy, count, limit);
    return count.val;
  }

  function countSolve(board, count, limit) {
    if (count.val >= limit) return;

    var empty = findEmpty(board);
    if (!empty) {
      count.val++;
      return;
    }

    var r = empty.r;
    var c = empty.c;

    for (var num = 1; num <= 9; num++) {
      if (isValidPlacement(board, r, c, num)) {
        board[r][c] = num;
        countSolve(board, count, limit);
        board[r][c] = 0;
        if (count.val >= limit) return;
      }
    }
  }

  // ============================================
  // ゲーム初期化
  // ============================================

  function initGame() {
    // タイマーリセット
    stopTimer();
    timerSeconds = 0;
    updateTimerDisplay();

    // 状態リセット
    gameEnded = false;
    selectedRow = -1;
    selectedCol = -1;
    clearOverlay.classList.remove('active');

    // 盤面生成
    solution = generateSolvedBoard();
    puzzle = generatePuzzle(solution, 35); // 35ヒント（中級程度）

    // ユーザーグリッド・固定セルの初期化
    userGrid = [];
    fixed = [];
    for (var r = 0; r < SIZE; r++) {
      userGrid[r] = [];
      fixed[r] = [];
      for (var c = 0; c < SIZE; c++) {
        if (puzzle[r][c] !== 0) {
          userGrid[r][c] = puzzle[r][c];
          fixed[r][c] = true;
        } else {
          userGrid[r][c] = 0;
          fixed[r][c] = false;
        }
      }
    }

    // ベストタイム表示
    showBestTime();

    // ボード描画
    renderBoard();

    // 数字ボタンの完了状態を更新
    updateNumberButtons();
  }

  // ============================================
  // ボード描画
  // ============================================

  function renderBoard() {
    boardEl.innerHTML = '';

    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        var cell = document.createElement('div');
        cell.className = 'sudoku-cell';
        cell.dataset.row = r;
        cell.dataset.col = c;

        if (fixed[r][c]) {
          cell.classList.add('fixed');
          cell.textContent = userGrid[r][c];
        } else if (userGrid[r][c] !== 0) {
          cell.classList.add('user-input');
          cell.textContent = userGrid[r][c];
        }

        boardEl.appendChild(cell);
      }
    }

    // イベント委譲
    boardEl.removeEventListener('click', handleBoardClick);
    boardEl.addEventListener('click', handleBoardClick);

    updateHighlights();
  }

  // セルDOM要素を取得
  function getCellEl(r, c) {
    return boardEl.querySelector('[data-row="' + r + '"][data-col="' + c + '"]');
  }

  // セル表示を個別に更新
  function updateCellDisplay(r, c) {
    var cellEl = getCellEl(r, c);
    if (!cellEl) return;

    // テキスト更新
    if (userGrid[r][c] !== 0) {
      cellEl.textContent = userGrid[r][c];
    } else {
      cellEl.textContent = '';
    }

    // クラス更新
    cellEl.classList.remove('user-input', 'error');

    if (!fixed[r][c] && userGrid[r][c] !== 0) {
      cellEl.classList.add('user-input');
    }
  }

  // ============================================
  // ハイライト処理
  // ============================================

  function updateHighlights() {
    // 全セルからハイライト関連クラスを除去
    var allCells = boardEl.querySelectorAll('.sudoku-cell');
    for (var i = 0; i < allCells.length; i++) {
      allCells[i].classList.remove('selected', 'highlighted', 'same-number', 'error');
    }

    // エラーハイライト
    markErrors();

    if (selectedRow < 0 || selectedCol < 0) return;

    var selectedVal = userGrid[selectedRow][selectedCol];

    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        var cellEl = getCellEl(r, c);
        if (!cellEl) continue;

        if (r === selectedRow && c === selectedCol) {
          cellEl.classList.add('selected');
        } else if (r === selectedRow || c === selectedCol || isSameBox(r, c, selectedRow, selectedCol)) {
          cellEl.classList.add('highlighted');
        }

        // 同じ数字のハイライト
        if (selectedVal !== 0 && userGrid[r][c] === selectedVal && !(r === selectedRow && c === selectedCol)) {
          cellEl.classList.add('same-number');
        }
      }
    }
  }

  // 同じ3x3ブロックかチェック
  function isSameBox(r1, c1, r2, c2) {
    return Math.floor(r1 / BOX) === Math.floor(r2 / BOX) &&
           Math.floor(c1 / BOX) === Math.floor(c2 / BOX);
  }

  // エラーマーク（重複検出）
  function markErrors() {
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        var val = userGrid[r][c];
        if (val === 0) continue;

        var hasConflict = false;

        // 行チェック
        for (var c2 = 0; c2 < SIZE; c2++) {
          if (c2 !== c && userGrid[r][c2] === val) {
            hasConflict = true;
            break;
          }
        }

        // 列チェック
        if (!hasConflict) {
          for (var r2 = 0; r2 < SIZE; r2++) {
            if (r2 !== r && userGrid[r2][c] === val) {
              hasConflict = true;
              break;
            }
          }
        }

        // ブロックチェック
        if (!hasConflict) {
          var boxRow = Math.floor(r / BOX) * BOX;
          var boxCol = Math.floor(c / BOX) * BOX;
          for (var br = boxRow; br < boxRow + BOX && !hasConflict; br++) {
            for (var bc = boxCol; bc < boxCol + BOX; bc++) {
              if (br !== r || bc !== c) {
                if (userGrid[br][bc] === val) {
                  hasConflict = true;
                  break;
                }
              }
            }
          }
        }

        if (hasConflict) {
          var cellEl = getCellEl(r, c);
          if (cellEl) cellEl.classList.add('error');
        }
      }
    }
  }

  // ============================================
  // 入力処理
  // ============================================

  function handleBoardClick(e) {
    if (gameEnded) return;
    var cellEl = e.target.closest('.sudoku-cell');
    if (!cellEl) return;

    var r = parseInt(cellEl.dataset.row, 10);
    var c = parseInt(cellEl.dataset.col, 10);

    selectedRow = r;
    selectedCol = c;

    // タイマー開始（初回選択時）
    if (!timerInterval) {
      startTimer();
    }

    updateHighlights();
  }

  // 数字入力
  function inputNumber(num) {
    if (gameEnded) return;
    if (selectedRow < 0 || selectedCol < 0) return;
    if (fixed[selectedRow][selectedCol]) return;

    // タイマー開始（初回入力時）
    if (!timerInterval) {
      startTimer();
    }

    userGrid[selectedRow][selectedCol] = num;
    updateCellDisplay(selectedRow, selectedCol);
    updateHighlights();
    updateNumberButtons();

    // クリア判定
    if (num !== 0) {
      checkWin();
    }
  }

  // ============================================
  // 数字ボタンの完了状態
  // ============================================

  function updateNumberButtons() {
    for (var n = 1; n <= 9; n++) {
      var count = 0;
      for (var r = 0; r < SIZE; r++) {
        for (var c = 0; c < SIZE; c++) {
          if (userGrid[r][c] === n) count++;
        }
      }
      var btn = document.querySelector('.num-btn[data-num="' + n + '"]');
      if (btn) {
        if (count >= 9) {
          btn.classList.add('completed');
        } else {
          btn.classList.remove('completed');
        }
      }
    }
  }

  // ============================================
  // 勝利判定
  // ============================================

  function checkWin() {
    // 全セルが埋まっているか
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        if (userGrid[r][c] === 0) return;
      }
    }

    // 全セルが正解かチェック
    for (var r2 = 0; r2 < SIZE; r2++) {
      for (var c2 = 0; c2 < SIZE; c2++) {
        if (userGrid[r2][c2] !== solution[r2][c2]) return;
      }
    }

    // クリア！
    gameEnded = true;
    stopTimer();
    selectedRow = -1;
    selectedCol = -1;

    // クリアアニメーション
    var allCells = boardEl.querySelectorAll('.sudoku-cell');
    for (var i = 0; i < allCells.length; i++) {
      allCells[i].classList.remove('selected', 'highlighted', 'same-number', 'error');
      (function (cell, delay) {
        setTimeout(function () {
          cell.classList.add('celebrate');
        }, delay);
      })(allCells[i], i * 15);
    }

    // ベストタイム更新
    saveBestTime(timerSeconds);
    showBestTime();

    // オーバーレイ表示
    setTimeout(function () {
      clearTimeEl.textContent = formatTime(timerSeconds);
      clearOverlay.classList.add('active');
    }, allCells.length * 15 + 300);
  }

  // ============================================
  // タイマー
  // ============================================

  function startTimer() {
    timerSeconds = 0;
    updateTimerDisplay();
    timerInterval = setInterval(function () {
      timerSeconds++;
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
    timerEl.textContent = formatTime(timerSeconds);
  }

  // ============================================
  // ベストタイム（localStorage）
  // ============================================

  function getBestTime() {
    var val = localStorage.getItem('bestSudoku');
    return val ? parseInt(val, 10) : null;
  }

  function saveBestTime(seconds) {
    var current = getBestTime();
    if (current === null || seconds < current) {
      localStorage.setItem('bestSudoku', seconds.toString());
    }
  }

  function showBestTime() {
    var best = getBestTime();
    if (best !== null) {
      bestTimeEl.textContent = formatTime(best);
    } else {
      bestTimeEl.textContent = '--:--';
    }
  }

  // ============================================
  // ユーティリティ
  // ============================================

  function formatTime(seconds) {
    var m = Math.floor(seconds / 60);
    var s = seconds % 60;
    return padNumber(m, 2) + ':' + padNumber(s, 2);
  }

  function padNumber(num, len) {
    var s = num.toString();
    while (s.length < len) s = '0' + s;
    return s;
  }

  // ============================================
  // イベントリスナー
  // ============================================

  // New Game ボタン
  btnNewGame.addEventListener('click', function () {
    initGame();
  });

  // もう一度遊ぶボタン
  btnPlayAgain.addEventListener('click', function () {
    initGame();
  });

  // 数字ボタン
  for (var i = 0; i < numButtons.length; i++) {
    numButtons[i].addEventListener('click', function () {
      var num = parseInt(this.dataset.num, 10);
      inputNumber(num);
    });
  }

  // キーボード入力
  document.addEventListener('keydown', function (e) {
    if (gameEnded) return;

    var key = e.key;

    // 数字キー 1-9
    if (key >= '1' && key <= '9') {
      e.preventDefault();
      inputNumber(parseInt(key, 10));
      return;
    }

    // 削除キー
    if (key === 'Delete' || key === 'Backspace') {
      e.preventDefault();
      inputNumber(0);
      return;
    }

    // 矢印キーでセル移動
    if (selectedRow >= 0 && selectedCol >= 0) {
      var newRow = selectedRow;
      var newCol = selectedCol;

      if (key === 'ArrowUp' || key === 'w' || key === 'W') {
        newRow = Math.max(0, selectedRow - 1);
      } else if (key === 'ArrowDown' || key === 's' || key === 'S') {
        newRow = Math.min(SIZE - 1, selectedRow + 1);
      } else if (key === 'ArrowLeft' || key === 'a' || key === 'A') {
        newCol = Math.max(0, selectedCol - 1);
      } else if (key === 'ArrowRight' || key === 'd' || key === 'D') {
        newCol = Math.min(SIZE - 1, selectedCol + 1);
      } else {
        return;
      }

      e.preventDefault();
      selectedRow = newRow;
      selectedCol = newCol;
      updateHighlights();
    }
  });

  // ============================================
  // ゲーム開始
  // ============================================

  initGame();

})();
