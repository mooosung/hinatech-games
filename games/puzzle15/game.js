// ============================================
// 15パズル ゲームロジック
// ============================================

(function () {
  'use strict';

  var SIZE = 4;
  var TOTAL_TILES = SIZE * SIZE; // 16 (including empty)
  var board = []; // 1D array of length 16, value 0 = empty
  var moves = 0;
  var bestScore = null;
  var gameStarted = false;
  var isCleared = false;

  // タイマー
  var timerInterval = null;
  var elapsedSeconds = 0;

  // DOM要素
  var tileContainer = document.getElementById('tile-container');
  var boardContainer = document.getElementById('board-container');
  var movesEl = document.getElementById('moves');
  var bestScoreEl = document.getElementById('best-score');
  var clearOverlay = document.getElementById('game-clear-overlay');
  var finalMovesEl = document.getElementById('final-moves');
  var finalTimeEl = document.getElementById('final-time');
  var bestTextEl = document.getElementById('best-text');

  // タイルサイズの計算用
  var cellSize = 0;
  var gapSize = 0;
  var padSize = 0;

  // ============================================
  // ユーティリティ
  // ============================================

  // ローカルストレージからベストスコア読み込み
  function loadBestScore() {
    var stored = localStorage.getItem('bestPuzzle15');
    if (stored) {
      bestScore = parseInt(stored, 10);
      if (isNaN(bestScore)) bestScore = null;
    }
  }

  // ベストスコア保存
  function saveBestScore(newMoves) {
    if (bestScore === null || newMoves < bestScore) {
      bestScore = newMoves;
      localStorage.setItem('bestPuzzle15', bestScore.toString());
      return true; // 新記録
    }
    return false;
  }

  // ベストスコア表示更新
  function updateBestDisplay() {
    if (bestScore !== null) {
      bestScoreEl.textContent = bestScore;
    } else {
      bestScoreEl.textContent = '-';
    }
  }

  // 秒数をm:ss形式にフォーマット
  function formatTime(seconds) {
    var m = Math.floor(seconds / 60);
    var s = seconds % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  // ============================================
  // タイマー
  // ============================================

  function startTimer() {
    if (timerInterval) return;
    timerInterval = setInterval(function () {
      elapsedSeconds++;
    }, 1000);
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  function resetTimer() {
    stopTimer();
    elapsedSeconds = 0;
  }

  // ============================================
  // サイズ計算
  // ============================================

  function calcSizes() {
    var w = boardContainer.offsetWidth;
    if (w <= 360) {
      gapSize = 6;
      padSize = 6;
    } else if (w <= 500) {
      gapSize = 8;
      padSize = 8;
    } else {
      gapSize = 10;
      padSize = 10;
    }
    cellSize = (w - padSize * 2 - gapSize * (SIZE - 1)) / SIZE;
  }

  // タイルの位置を計算（row, col）
  function tilePos(index) {
    var row = Math.floor(index / SIZE);
    var col = index % SIZE;
    return {
      top: padSize + row * (cellSize + gapSize),
      left: padSize + col * (cellSize + gapSize)
    };
  }

  // タイルのフォントサイズ
  function tileFontSize() {
    if (cellSize > 80) return cellSize * 0.4;
    if (cellSize > 60) return cellSize * 0.38;
    return cellSize * 0.35;
  }

  // ============================================
  // パズルの解法判定（Solvability Check）
  // ============================================

  // 転倒数を計算（0を除外）
  function countInversions(arr) {
    var inversions = 0;
    for (var i = 0; i < arr.length; i++) {
      if (arr[i] === 0) continue;
      for (var j = i + 1; j < arr.length; j++) {
        if (arr[j] === 0) continue;
        if (arr[i] > arr[j]) inversions++;
      }
    }
    return inversions;
  }

  // 4x4パズルの解法判定
  // 空白が下から偶数行目にある場合：転倒数が奇数なら解ける
  // 空白が下から奇数行目にある場合：転倒数が偶数なら解ける
  function isSolvable(arr) {
    var inversions = countInversions(arr);
    var emptyIndex = arr.indexOf(0);
    var emptyRowFromBottom = SIZE - Math.floor(emptyIndex / SIZE);

    if (emptyRowFromBottom % 2 === 0) {
      return inversions % 2 === 1;
    } else {
      return inversions % 2 === 0;
    }
  }

  // ============================================
  // シャッフル（Fisher-Yates）& 解法保証
  // ============================================

  function generateSolvableBoard() {
    // 1〜15 + 0（空白）
    var arr = [];
    for (var i = 1; i < TOTAL_TILES; i++) {
      arr.push(i);
    }
    arr.push(0);

    // Fisher-Yatesシャッフル
    for (var j = arr.length - 1; j > 0; j--) {
      var k = Math.floor(Math.random() * (j + 1));
      var temp = arr[j];
      arr[j] = arr[k];
      arr[k] = temp;
    }

    // 解けない配置の場合、修正する
    if (!isSolvable(arr)) {
      // 0以外の最初の2つの要素を入れ替える
      var first = -1;
      var second = -1;
      for (var m = 0; m < arr.length; m++) {
        if (arr[m] !== 0) {
          if (first === -1) {
            first = m;
          } else {
            second = m;
            break;
          }
        }
      }
      var tmp = arr[first];
      arr[first] = arr[second];
      arr[second] = tmp;
    }

    return arr;
  }

  // ============================================
  // 隣接判定 & 移動
  // ============================================

  // 空白の位置を取得
  function getEmptyIndex() {
    return board.indexOf(0);
  }

  // 指定インデックスが空白に隣接しているか
  function isAdjacentToEmpty(index) {
    var emptyIdx = getEmptyIndex();
    var emptyRow = Math.floor(emptyIdx / SIZE);
    var emptyCol = emptyIdx % SIZE;
    var tileRow = Math.floor(index / SIZE);
    var tileCol = index % SIZE;

    // 上下左右の隣接チェック
    var rowDiff = Math.abs(emptyRow - tileRow);
    var colDiff = Math.abs(emptyCol - tileCol);

    return (rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1);
  }

  // タイルを移動（空白とスワップ）
  function moveTile(index) {
    if (isCleared) return false;
    if (!isAdjacentToEmpty(index)) return false;

    var emptyIdx = getEmptyIndex();

    // スワップ
    board[emptyIdx] = board[index];
    board[index] = 0;

    // タイマー開始（初回移動時）
    if (!gameStarted) {
      gameStarted = true;
      startTimer();
    }

    moves++;
    movesEl.textContent = moves;

    return true;
  }

  // キー入力による移動方向から対象タイルを取得
  function moveByDirection(direction) {
    var emptyIdx = getEmptyIndex();
    var emptyRow = Math.floor(emptyIdx / SIZE);
    var emptyCol = emptyIdx % SIZE;
    var targetRow = emptyRow;
    var targetCol = emptyCol;

    // 矢印キーの方向 = 「タイルが動く方向」
    // 上キー → 空白の下のタイルが上に動く
    switch (direction) {
      case 'up':
        targetRow = emptyRow + 1;
        break;
      case 'down':
        targetRow = emptyRow - 1;
        break;
      case 'left':
        targetCol = emptyCol + 1;
        break;
      case 'right':
        targetCol = emptyCol - 1;
        break;
    }

    // 範囲外チェック
    if (targetRow < 0 || targetRow >= SIZE || targetCol < 0 || targetCol >= SIZE) {
      return -1;
    }

    return targetRow * SIZE + targetCol;
  }

  // ============================================
  // クリア判定
  // ============================================

  function checkWin() {
    for (var i = 0; i < TOTAL_TILES - 1; i++) {
      if (board[i] !== i + 1) return false;
    }
    // 最後のマスは0（空白）
    return board[TOTAL_TILES - 1] === 0;
  }

  // ============================================
  // 描画
  // ============================================

  function render(animated) {
    calcSizes();
    tileContainer.innerHTML = '';

    var emptyIdx = getEmptyIndex();

    for (var i = 0; i < TOTAL_TILES; i++) {
      var value = board[i];
      if (value === 0) continue; // 空白はスキップ

      var pos = tilePos(i);
      var el = document.createElement('div');
      el.className = 'tile tile-' + value;
      el.textContent = value;
      el.setAttribute('data-index', i);

      // movableクラス（隣接タイル）
      if (isAdjacentToEmpty(i) && !isCleared) {
        el.classList.add('movable');
      }

      el.style.width = cellSize + 'px';
      el.style.height = cellSize + 'px';
      el.style.top = pos.top + 'px';
      el.style.left = pos.left + 'px';
      el.style.fontSize = tileFontSize() + 'px';
      el.style.lineHeight = cellSize + 'px';

      if (animated) {
        el.classList.add('tile-new');
      }

      // クリックイベント
      el.addEventListener('click', onTileClick);

      tileContainer.appendChild(el);
    }
  }

  // ============================================
  // タイルクリック処理
  // ============================================

  function onTileClick(e) {
    if (isCleared) return;

    var index = parseInt(e.currentTarget.getAttribute('data-index'), 10);
    if (moveTile(index)) {
      render(false);

      // クリア判定
      if (checkWin()) {
        handleClear();
      }
    }
  }

  // ============================================
  // キーボード操作
  // ============================================

  document.addEventListener('keydown', function (e) {
    if (isCleared) return;

    var keyMap = {
      ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
      w: 'up', s: 'down', a: 'left', d: 'right',
      W: 'up', S: 'down', A: 'left', D: 'right'
    };

    var dir = keyMap[e.key];
    if (dir) {
      e.preventDefault();
      var targetIndex = moveByDirection(dir);
      if (targetIndex >= 0 && moveTile(targetIndex)) {
        render(false);

        // クリア判定
        if (checkWin()) {
          handleClear();
        }
      }
    }
  });

  // ============================================
  // クリア処理
  // ============================================

  function handleClear() {
    isCleared = true;
    stopTimer();

    // お祝いアニメーション
    var tiles = tileContainer.querySelectorAll('.tile');
    for (var i = 0; i < tiles.length; i++) {
      (function (tile, delay) {
        setTimeout(function () {
          tile.classList.add('tile-celebrate');
        }, delay);
      })(tiles[i], i * 50);
    }

    var isNewBest = saveBestScore(moves);
    updateBestDisplay();

    // 結果表示
    finalMovesEl.textContent = moves;
    finalTimeEl.textContent = formatTime(elapsedSeconds);

    if (isNewBest) {
      bestTextEl.textContent = '\uD83C\uDF89 \u65B0\u8A18\u9332\uFF01';
    } else if (bestScore !== null) {
      bestTextEl.textContent = '\u30D9\u30B9\u30C8: ' + bestScore + '\u624B';
    } else {
      bestTextEl.textContent = '';
    }

    // オーバーレイ表示（少し遅延）
    setTimeout(function () {
      clearOverlay.classList.add('active');
    }, 800);
  }

  // ============================================
  // ゲーム初期化
  // ============================================

  function initGame() {
    // 状態のリセット
    moves = 0;
    gameStarted = false;
    isCleared = false;

    movesEl.textContent = '0';
    resetTimer();
    clearOverlay.classList.remove('active');

    // 解ける配置を生成
    board = generateSolvableBoard();

    // ベスト表示更新
    updateBestDisplay();

    // 描画（初期アニメーション付き）
    render(true);
  }

  // ============================================
  // イベントリスナー
  // ============================================

  // New Gameボタン
  document.getElementById('btn-new-game').addEventListener('click', initGame);

  // もう一度遊ぶボタン
  document.getElementById('btn-play-again').addEventListener('click', initGame);

  // ウィンドウリサイズ時に再描画
  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      render(false);
    }, 100);
  });

  // ============================================
  // ゲーム開始
  // ============================================

  loadBestScore();
  updateBestDisplay();
  initGame();

})();
