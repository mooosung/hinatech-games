// ============================================
// 2048 ゲームロジック
// ============================================

(function () {
  'use strict';

  var SIZE = 4;
  var grid = [];
  var score = 0;
  var bestScore = parseInt(localStorage.getItem('best2048') || '0', 10);
  var gameOver = false;
  var won = false;
  var keepPlaying = false;

  // DOM要素
  var tileContainer = document.getElementById('tile-container');
  var boardContainer = document.getElementById('board-container');
  var scoreEl = document.getElementById('score');
  var bestScoreEl = document.getElementById('best-score');
  var gameOverOverlay = document.getElementById('game-over-overlay');
  var gameWinOverlay = document.getElementById('game-win-overlay');
  var finalScoreEl = document.getElementById('final-score');
  var winScoreEl = document.getElementById('win-score');

  // タイルサイズの計算用
  var cellSize = 0;
  var gapSize = 0;
  var padSize = 0;

  // サイズ計算
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

  // タイルの位置を計算
  function tilePos(row, col) {
    return {
      top: padSize + row * (cellSize + gapSize),
      left: padSize + col * (cellSize + gapSize)
    };
  }

  // タイルのフォントサイズ
  function tileFontSize(value) {
    if (value < 100) return cellSize * 0.45;
    if (value < 1000) return cellSize * 0.35;
    if (value < 10000) return cellSize * 0.28;
    return cellSize * 0.22;
  }

  // 初期化
  function init() {
    grid = [];
    for (var r = 0; r < SIZE; r++) {
      grid[r] = [];
      for (var c = 0; c < SIZE; c++) {
        grid[r][c] = 0;
      }
    }
    score = 0;
    gameOver = false;
    won = false;
    keepPlaying = false;
    updateScore();
    gameOverOverlay.classList.remove('active');
    gameWinOverlay.classList.remove('active');

    addRandomTile();
    addRandomTile();
    render();
  }

  // 空きセルを取得
  function emptyCells() {
    var cells = [];
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        if (grid[r][c] === 0) cells.push({ r: r, c: c });
      }
    }
    return cells;
  }

  // ランダムにタイルを追加
  function addRandomTile() {
    var empty = emptyCells();
    if (empty.length === 0) return null;
    var cell = empty[Math.floor(Math.random() * empty.length)];
    var value = Math.random() < 0.9 ? 2 : 4;
    grid[cell.r][cell.c] = value;
    return { r: cell.r, c: cell.c, value: value };
  }

  // スコア更新
  function updateScore() {
    scoreEl.textContent = score;
    if (score > bestScore) {
      bestScore = score;
      localStorage.setItem('best2048', bestScore.toString());
    }
    bestScoreEl.textContent = bestScore;
  }

  // 描画
  function render(newTile, mergedPositions) {
    calcSizes();
    tileContainer.innerHTML = '';

    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        var value = grid[r][c];
        if (value === 0) continue;

        var pos = tilePos(r, c);
        var el = document.createElement('div');
        var cls = value <= 2048 ? 'tile-' + value : 'tile-super';
        el.className = 'tile ' + cls;
        el.textContent = value;
        el.style.width = cellSize + 'px';
        el.style.height = cellSize + 'px';
        el.style.top = pos.top + 'px';
        el.style.left = pos.left + 'px';
        el.style.fontSize = tileFontSize(value) + 'px';
        el.style.lineHeight = cellSize + 'px';

        // 新しいタイルのアニメーション
        if (newTile && newTile.r === r && newTile.c === c) {
          el.classList.add('tile-new');
        }

        // 合体タイルのアニメーション
        if (mergedPositions) {
          for (var m = 0; m < mergedPositions.length; m++) {
            if (mergedPositions[m].r === r && mergedPositions[m].c === c) {
              el.classList.add('tile-merged');
              break;
            }
          }
        }

        tileContainer.appendChild(el);
      }
    }
  }

  // 1行をスライド処理（左方向に統一）
  function slideRow(row) {
    // ゼロを除去
    var filtered = row.filter(function (v) { return v !== 0; });
    var merged = [];
    var mergedFlags = [];
    var scoreGain = 0;

    for (var i = 0; i < filtered.length; i++) {
      if (i + 1 < filtered.length && filtered[i] === filtered[i + 1]) {
        var newVal = filtered[i] * 2;
        merged.push(newVal);
        mergedFlags.push(true);
        scoreGain += newVal;
        i++; // 次をスキップ
      } else {
        merged.push(filtered[i]);
        mergedFlags.push(false);
      }
    }

    // ゼロで埋める
    while (merged.length < SIZE) {
      merged.push(0);
      mergedFlags.push(false);
    }

    return { row: merged, mergedFlags: mergedFlags, scoreGain: scoreGain };
  }

  // グリッドを回転（方向を左に統一するため）
  function rotateGrid(g, times) {
    var result = g;
    for (var t = 0; t < times; t++) {
      var newGrid = [];
      for (var r = 0; r < SIZE; r++) {
        newGrid[r] = [];
        for (var c = 0; c < SIZE; c++) {
          newGrid[r][c] = result[c][SIZE - 1 - r];
        }
      }
      result = newGrid;
    }
    return result;
  }

  // 逆回転のマッピング（座標の変換）
  function unrotatePos(r, c, times) {
    var row = r, col = c;
    for (var t = 0; t < (4 - times) % 4; t++) {
      var tmp = row;
      row = col;
      col = SIZE - 1 - tmp;
    }
    return { r: row, c: col };
  }

  // 移動処理
  function move(direction) {
    if (gameOver) return false;

    // 方向に応じた回転回数（左を基準）
    var rotations = { left: 0, up: 1, right: 2, down: 3 };
    var rot = rotations[direction];

    // グリッドを回転して左方向に統一
    var rotated = rotateGrid(grid, rot);
    var moved = false;
    var mergedPositions = [];
    var totalScore = 0;

    for (var r = 0; r < SIZE; r++) {
      var result = slideRow(rotated[r]);
      // 行が変化したかチェック
      for (var c = 0; c < SIZE; c++) {
        if (rotated[r][c] !== result.row[c]) {
          moved = true;
        }
        // 合体した位置を記録
        if (result.mergedFlags[c]) {
          var original = unrotatePos(r, c, rot);
          mergedPositions.push(original);
        }
      }
      rotated[r] = result.row;
      totalScore += result.scoreGain;
    }

    if (!moved) return false;

    // 回転を戻す
    grid = rotateGrid(rotated, (4 - rot) % 4);
    score += totalScore;
    updateScore();

    // 新しいタイルを追加
    var newTile = addRandomTile();
    render(newTile, mergedPositions);

    // 勝利判定
    if (!won && !keepPlaying) {
      for (var r2 = 0; r2 < SIZE; r2++) {
        for (var c2 = 0; c2 < SIZE; c2++) {
          if (grid[r2][c2] === 2048) {
            won = true;
            winScoreEl.textContent = score;
            gameWinOverlay.classList.add('active');
            return true;
          }
        }
      }
    }

    // ゲームオーバー判定
    if (!canMove()) {
      gameOver = true;
      finalScoreEl.textContent = score;
      gameOverOverlay.classList.add('active');
    }

    return true;
  }

  // 移動可能か判定
  function canMove() {
    // 空きセルがあれば移動可能
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        if (grid[r][c] === 0) return true;
      }
    }
    // 隣接する同じ数字があれば移動可能
    for (var r2 = 0; r2 < SIZE; r2++) {
      for (var c2 = 0; c2 < SIZE; c2++) {
        var val = grid[r2][c2];
        if (c2 + 1 < SIZE && grid[r2][c2 + 1] === val) return true;
        if (r2 + 1 < SIZE && grid[r2 + 1][c2] === val) return true;
      }
    }
    return false;
  }

  // キーボード入力
  document.addEventListener('keydown', function (e) {
    var keyMap = {
      ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
      a: 'left', d: 'right', w: 'up', s: 'down',
      A: 'left', D: 'right', W: 'up', S: 'down'
    };
    var dir = keyMap[e.key];
    if (dir) {
      e.preventDefault();
      move(dir);
    }
  });

  // タッチ操作（スワイプ）
  var touchStartX = 0;
  var touchStartY = 0;
  var touchStartTime = 0;

  boardContainer.addEventListener('touchstart', function (e) {
    if (e.touches.length === 1) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchStartTime = Date.now();
    }
  }, { passive: true });

  boardContainer.addEventListener('touchmove', function (e) {
    e.preventDefault();
  }, { passive: false });

  boardContainer.addEventListener('touchend', function (e) {
    if (e.changedTouches.length === 0) return;

    var dx = e.changedTouches[0].clientX - touchStartX;
    var dy = e.changedTouches[0].clientY - touchStartY;
    var dt = Date.now() - touchStartTime;

    // 最小スワイプ距離と最大時間
    var minDist = 30;
    var maxTime = 500;

    if (dt > maxTime) return;
    if (Math.abs(dx) < minDist && Math.abs(dy) < minDist) return;

    var dir;
    if (Math.abs(dx) > Math.abs(dy)) {
      dir = dx > 0 ? 'right' : 'left';
    } else {
      dir = dy > 0 ? 'down' : 'up';
    }

    move(dir);
  }, { passive: true });

  // ボタンイベント
  document.getElementById('btn-new-game').addEventListener('click', init);
  document.getElementById('btn-retry').addEventListener('click', init);
  document.getElementById('btn-new-after-win').addEventListener('click', init);
  document.getElementById('btn-continue').addEventListener('click', function () {
    keepPlaying = true;
    gameWinOverlay.classList.remove('active');
  });

  // ウィンドウリサイズ時に再描画
  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      render();
    }, 100);
  });

  // ゲーム開始
  bestScoreEl.textContent = bestScore;
  init();
})();
