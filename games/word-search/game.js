// ============================================
// 単語探し（ワードサーチ）ゲームロジック
// ============================================

(function () {
  'use strict';

  // グリッドサイズ
  var GRID_SIZE = 10;

  // 単語プール（約20語）
  var WORD_POOL = [
    'GAME', 'CODE', 'HTML', 'JAVA', 'PYTHON',
    'REACT', 'MOUSE', 'CLICK', 'PIXEL', 'DEBUG',
    'ARRAY', 'CLASS', 'STYLE', 'LINUX', 'INPUT',
    'STACK', 'QUERY', 'SWIFT', 'LOGIC', 'PARSE'
  ];

  // ゲームごとに選ぶ単語数
  var WORDS_PER_GAME_MIN = 6;
  var WORDS_PER_GAME_MAX = 8;

  // ゲーム状態
  var grid = [];           // 10x10の2次元配列
  var placedWords = [];    // 配置済みの単語リスト
  var foundWords = [];     // 見つけた単語リスト
  var timerInterval = null;
  var elapsedSeconds = 0;
  var gameStarted = false;
  var gameFinished = false;

  // ドラッグ選択の状態
  var isDragging = false;
  var dragStartCell = null;  // {row, col}
  var dragEndCell = null;    // {row, col}
  var selectedCells = [];    // [{row, col}, ...]

  // DOM要素
  var letterGrid = document.getElementById('letter-grid');
  var wordListItems = document.getElementById('word-list-items');
  var timerEl = document.getElementById('timer');
  var bestTimeEl = document.getElementById('best-time');
  var completeOverlay = document.getElementById('game-complete-overlay');
  var finalTimeEl = document.getElementById('final-time');
  var bestTextEl = document.getElementById('best-text');

  // ============================================
  // ユーティリティ
  // ============================================

  // 配列をシャッフル（Fisher-Yates）
  function shuffle(array) {
    var arr = array.slice();
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var temp = arr[i];
      arr[i] = arr[j];
      arr[j] = temp;
    }
    return arr;
  }

  // 秒数をm:ss形式にフォーマット
  function formatTime(seconds) {
    var m = Math.floor(seconds / 60);
    var s = seconds % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  // ランダムな大文字アルファベット
  function randomLetter() {
    return String.fromCharCode(65 + Math.floor(Math.random() * 26));
  }

  // ============================================
  // localStorage（ベストタイム）
  // ============================================

  function getBestTime() {
    var val = localStorage.getItem('bestWordSearch');
    if (val !== null) {
      var parsed = parseInt(val, 10);
      if (!isNaN(parsed)) return parsed;
    }
    return null;
  }

  function saveBestTime(seconds) {
    var current = getBestTime();
    if (current === null || seconds < current) {
      localStorage.setItem('bestWordSearch', String(seconds));
      return true;
    }
    return false;
  }

  function updateBestDisplay() {
    var best = getBestTime();
    if (best !== null) {
      bestTimeEl.textContent = formatTime(best);
    } else {
      bestTimeEl.textContent = '-';
    }
  }

  // ============================================
  // タイマー
  // ============================================

  function startTimer() {
    if (timerInterval) return;
    timerInterval = setInterval(function () {
      elapsedSeconds++;
      timerEl.textContent = formatTime(elapsedSeconds);
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
    timerEl.textContent = '0:00';
  }

  // ============================================
  // グリッド生成・単語配置
  // ============================================

  // 空のグリッドを生成
  function createEmptyGrid() {
    var g = [];
    for (var r = 0; r < GRID_SIZE; r++) {
      var row = [];
      for (var c = 0; c < GRID_SIZE; c++) {
        row.push('');
      }
      g.push(row);
    }
    return g;
  }

  // 単語がグリッドに配置できるかチェック
  // direction: 'horizontal' or 'vertical'
  function canPlaceWord(g, word, row, col, direction) {
    var len = word.length;

    if (direction === 'horizontal') {
      if (col + len > GRID_SIZE) return false;
      for (var i = 0; i < len; i++) {
        var existing = g[row][col + i];
        if (existing !== '' && existing !== word[i]) return false;
      }
    } else {
      if (row + len > GRID_SIZE) return false;
      for (var i = 0; i < len; i++) {
        var existing = g[row + i][col];
        if (existing !== '' && existing !== word[i]) return false;
      }
    }
    return true;
  }

  // 単語をグリッドに配置
  function placeWord(g, word, row, col, direction) {
    var cells = [];
    if (direction === 'horizontal') {
      for (var i = 0; i < word.length; i++) {
        g[row][col + i] = word[i];
        cells.push({ row: row, col: col + i });
      }
    } else {
      for (var i = 0; i < word.length; i++) {
        g[row + i][col] = word[i];
        cells.push({ row: row + i, col: col });
      }
    }
    return cells;
  }

  // グリッドに単語群を配置（ランダムに試行）
  function generateGrid() {
    var maxAttempts = 100;

    for (var attempt = 0; attempt < maxAttempts; attempt++) {
      var g = createEmptyGrid();
      var shuffled = shuffle(WORD_POOL);
      var wordCount = WORDS_PER_GAME_MIN + Math.floor(Math.random() * (WORDS_PER_GAME_MAX - WORDS_PER_GAME_MIN + 1));
      var candidates = shuffled.slice(0, Math.min(wordCount + 4, shuffled.length)); // 少し多めに試す
      var placed = [];

      for (var w = 0; w < candidates.length; w++) {
        if (placed.length >= wordCount) break;

        var word = candidates[w];
        var directions = shuffle(['horizontal', 'vertical']);
        var wordPlaced = false;

        for (var d = 0; d < directions.length; d++) {
          if (wordPlaced) break;
          var dir = directions[d];

          // ランダムな位置を試す
          var positions = [];
          for (var r = 0; r < GRID_SIZE; r++) {
            for (var c = 0; c < GRID_SIZE; c++) {
              positions.push({ row: r, col: c });
            }
          }
          positions = shuffle(positions);

          for (var p = 0; p < positions.length; p++) {
            if (canPlaceWord(g, word, positions[p].row, positions[p].col, dir)) {
              var cells = placeWord(g, word, positions[p].row, positions[p].col, dir);
              placed.push({
                word: word,
                cells: cells,
                direction: dir,
                startRow: positions[p].row,
                startCol: positions[p].col
              });
              wordPlaced = true;
              break;
            }
          }
        }
      }

      if (placed.length >= WORDS_PER_GAME_MIN) {
        // 空セルをランダムな文字で埋める
        for (var r = 0; r < GRID_SIZE; r++) {
          for (var c = 0; c < GRID_SIZE; c++) {
            if (g[r][c] === '') {
              g[r][c] = randomLetter();
            }
          }
        }
        return { grid: g, words: placed };
      }
    }

    // フォールバック（ほぼ起こらないが安全のため）
    var g = createEmptyGrid();
    for (var r = 0; r < GRID_SIZE; r++) {
      for (var c = 0; c < GRID_SIZE; c++) {
        g[r][c] = randomLetter();
      }
    }
    return { grid: g, words: [] };
  }

  // ============================================
  // 描画
  // ============================================

  function renderBoard() {
    var result = generateGrid();
    grid = result.grid;
    placedWords = result.words;
    foundWords = [];

    // レターグリッドを生成
    letterGrid.innerHTML = '';
    for (var r = 0; r < GRID_SIZE; r++) {
      for (var c = 0; c < GRID_SIZE; c++) {
        var cell = document.createElement('div');
        cell.className = 'letter-cell';
        cell.textContent = grid[r][c];
        cell.setAttribute('data-row', r);
        cell.setAttribute('data-col', c);
        letterGrid.appendChild(cell);
      }
    }

    // 単語リストを生成
    wordListItems.innerHTML = '';
    // アルファベット順にソート
    var sortedWords = placedWords.slice().sort(function (a, b) {
      return a.word.localeCompare(b.word);
    });
    for (var i = 0; i < sortedWords.length; i++) {
      var item = document.createElement('span');
      item.className = 'word-item';
      item.setAttribute('data-word', sortedWords[i].word);
      item.innerHTML = '<span class="word-check">\u2713</span>' + sortedWords[i].word;
      wordListItems.appendChild(item);
    }
  }

  // ============================================
  // セル選択ロジック
  // ============================================

  // 2つのセルの間に有効な直線があるか（水平か垂直のみ）
  function getLineCells(startCell, endCell) {
    if (!startCell || !endCell) return [];

    var r1 = startCell.row;
    var c1 = startCell.col;
    var r2 = endCell.row;
    var c2 = endCell.col;

    var cells = [];

    if (r1 === r2) {
      // 水平
      var minC = Math.min(c1, c2);
      var maxC = Math.max(c1, c2);
      for (var c = minC; c <= maxC; c++) {
        cells.push({ row: r1, col: c });
      }
    } else if (c1 === c2) {
      // 垂直
      var minR = Math.min(r1, r2);
      var maxR = Math.max(r1, r2);
      for (var r = minR; r <= maxR; r++) {
        cells.push({ row: r, col: c1 });
      }
    }
    // 斜めなどは空配列を返す

    return cells;
  }

  // 選択されたセルのハイライトを更新
  function updateSelectionHighlight() {
    // すべてのselecting/invalidクラスを除去
    var allCells = letterGrid.querySelectorAll('.letter-cell');
    for (var i = 0; i < allCells.length; i++) {
      allCells[i].classList.remove('selecting');
      allCells[i].classList.remove('invalid');
    }

    if (selectedCells.length === 0) return;

    // 選択されたセルをハイライト
    for (var i = 0; i < selectedCells.length; i++) {
      var sc = selectedCells[i];
      var cellEl = getCellElement(sc.row, sc.col);
      if (cellEl && !cellEl.classList.contains('found')) {
        cellEl.classList.add('selecting');
      }
    }
  }

  // 特定のセルのDOM要素を取得
  function getCellElement(row, col) {
    return letterGrid.querySelector('[data-row="' + row + '"][data-col="' + col + '"]');
  }

  // 選択範囲からテキストを取得
  function getSelectedText(cells) {
    var text = '';
    for (var i = 0; i < cells.length; i++) {
      text += grid[cells[i].row][cells[i].col];
    }
    return text;
  }

  // 選択が有効な単語かチェック
  function checkSelection(cells) {
    if (cells.length < 2) return null;

    var selectedText = getSelectedText(cells);

    for (var i = 0; i < placedWords.length; i++) {
      var pw = placedWords[i];
      if (foundWords.indexOf(pw.word) !== -1) continue;

      if (selectedText === pw.word) {
        // セルの位置も一致するかチェック
        if (cellsMatch(cells, pw.cells)) {
          return pw;
        }
      }
    }

    return null;
  }

  // セル配列が一致するか
  function cellsMatch(cells1, cells2) {
    if (cells1.length !== cells2.length) return false;
    for (var i = 0; i < cells1.length; i++) {
      if (cells1[i].row !== cells2[i].row || cells1[i].col !== cells2[i].col) {
        return false;
      }
    }
    return true;
  }

  // 単語を見つけた処理
  function markWordFound(wordData) {
    foundWords.push(wordData.word);

    // セルにfoundクラスを追加
    for (var i = 0; i < wordData.cells.length; i++) {
      var cellEl = getCellElement(wordData.cells[i].row, wordData.cells[i].col);
      if (cellEl) {
        cellEl.classList.remove('selecting');
        cellEl.classList.add('found');
        cellEl.classList.add('just-found');
        // アニメーション後にjust-foundを除去
        (function (el) {
          setTimeout(function () {
            el.classList.remove('just-found');
          }, 500);
        })(cellEl);
      }
    }

    // 単語リストの更新
    var wordItem = wordListItems.querySelector('[data-word="' + wordData.word + '"]');
    if (wordItem) {
      wordItem.classList.add('found');
    }

    // 全単語発見チェック
    if (foundWords.length === placedWords.length) {
      setTimeout(function () {
        handleGameComplete();
      }, 600);
    }
  }

  // ============================================
  // イベントハンドラ（マウス & タッチ）
  // ============================================

  function getCellFromEvent(e) {
    var target;
    if (e.touches && e.touches.length > 0) {
      var touch = e.touches[0];
      target = document.elementFromPoint(touch.clientX, touch.clientY);
    } else {
      target = e.target;
    }

    if (!target || !target.classList || !target.classList.contains('letter-cell')) {
      return null;
    }

    return {
      row: parseInt(target.getAttribute('data-row'), 10),
      col: parseInt(target.getAttribute('data-col'), 10)
    };
  }

  function onPointerDown(e) {
    if (gameFinished) return;
    e.preventDefault();

    var cell = getCellFromEvent(e);
    if (!cell) return;

    // タイマー開始
    if (!gameStarted) {
      gameStarted = true;
      startTimer();
    }

    isDragging = true;
    dragStartCell = cell;
    dragEndCell = cell;
    selectedCells = [cell];
    updateSelectionHighlight();
  }

  function onPointerMove(e) {
    if (!isDragging || gameFinished) return;
    e.preventDefault();

    var cell = getCellFromEvent(e);
    if (!cell) return;

    // 同じセルなら何もしない
    if (dragEndCell && cell.row === dragEndCell.row && cell.col === dragEndCell.col) return;

    dragEndCell = cell;
    selectedCells = getLineCells(dragStartCell, dragEndCell);

    if (selectedCells.length === 0) {
      // 斜めなど無効な方向 - 開始セルのみ表示
      selectedCells = [dragStartCell];
    }

    updateSelectionHighlight();
  }

  function onPointerUp(e) {
    if (!isDragging || gameFinished) return;
    e.preventDefault();

    isDragging = false;

    // 選択が有効な単語かチェック
    if (selectedCells.length >= 2) {
      var wordData = checkSelection(selectedCells);
      if (wordData) {
        markWordFound(wordData);
      } else {
        // 無効な選択 - フラッシュ
        flashInvalid(selectedCells);
      }
    }

    // 選択をクリア
    selectedCells = [];
    dragStartCell = null;
    dragEndCell = null;
    updateSelectionHighlight();
  }

  // 無効な選択時の一瞬のフラッシュ
  function flashInvalid(cells) {
    for (var i = 0; i < cells.length; i++) {
      var cellEl = getCellElement(cells[i].row, cells[i].col);
      if (cellEl && !cellEl.classList.contains('found')) {
        cellEl.classList.remove('selecting');
        cellEl.classList.add('invalid');
      }
    }
    setTimeout(function () {
      var allCells = letterGrid.querySelectorAll('.letter-cell.invalid');
      for (var i = 0; i < allCells.length; i++) {
        allCells[i].classList.remove('invalid');
      }
    }, 300);
  }

  // イベントリスナーの登録
  function attachGridEvents() {
    // マウスイベント
    letterGrid.addEventListener('mousedown', onPointerDown);
    letterGrid.addEventListener('mousemove', onPointerMove);
    document.addEventListener('mouseup', onPointerUp);

    // タッチイベント
    letterGrid.addEventListener('touchstart', onPointerDown, { passive: false });
    letterGrid.addEventListener('touchmove', onPointerMove, { passive: false });
    document.addEventListener('touchend', onPointerUp);
  }

  // ============================================
  // ゲームクリア
  // ============================================

  function handleGameComplete() {
    stopTimer();
    gameFinished = true;

    var isNewBest = saveBestTime(elapsedSeconds);

    finalTimeEl.textContent = formatTime(elapsedSeconds);

    if (isNewBest) {
      bestTextEl.textContent = '\uD83C\uDF89 \u65B0\u8A18\u9332\uFF01';
    } else {
      var best = getBestTime();
      if (best !== null) {
        bestTextEl.textContent = '\u30D9\u30B9\u30C8: ' + formatTime(best);
      } else {
        bestTextEl.textContent = '';
      }
    }

    updateBestDisplay();
    completeOverlay.classList.add('active');
  }

  // ============================================
  // ゲーム初期化
  // ============================================

  function initGame() {
    // 状態のリセット
    gameStarted = false;
    gameFinished = false;
    isDragging = false;
    dragStartCell = null;
    dragEndCell = null;
    selectedCells = [];

    resetTimer();
    completeOverlay.classList.remove('active');
    updateBestDisplay();

    // ボード生成
    renderBoard();
  }

  // ============================================
  // イベントリスナー
  // ============================================

  // New Gameボタン
  document.getElementById('btn-new-game').addEventListener('click', initGame);

  // もう一度遊ぶボタン
  document.getElementById('btn-play-again').addEventListener('click', initGame);

  // グリッドイベント
  attachGridEvents();

  // ============================================
  // ゲーム開始
  // ============================================

  initGame();

})();
