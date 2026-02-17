// ============================================
// 三目並べ（Tic-Tac-Toe）ゲーム
// ============================================

(function () {
  'use strict';

  // 定数
  var EMPTY = '';
  var PLAYER = 'O'; // ○（プレイヤー）
  var AI = 'X';     // ×（コンピュータ）

  // 勝利パターン（8通り）
  var WIN_PATTERNS = [
    [0, 1, 2], // 横1行目
    [3, 4, 5], // 横2行目
    [6, 7, 8], // 横3行目
    [0, 3, 6], // 縦1列目
    [1, 4, 7], // 縦2列目
    [2, 5, 8], // 縦3列目
    [0, 4, 8], // 斜め（左上→右下）
    [2, 4, 6]  // 斜め（右上→左下）
  ];

  // ゲーム状態
  var board = [];
  var gameOver = false;
  var isProcessing = false;
  var currentTurn = PLAYER; // プレイヤーが先手
  var winStreak = 0;

  // 統計
  var stats = { wins: 0, losses: 0, draws: 0 };

  // DOM要素
  var boardEl = document.getElementById('board');
  var cells = boardEl.querySelectorAll('.cell');
  var statusTextEl = document.getElementById('status-text');
  var scoreWinsEl = document.getElementById('score-wins');
  var scoreLossesEl = document.getElementById('score-losses');
  var scoreDrawsEl = document.getElementById('score-draws');
  var gameOverOverlay = document.getElementById('game-over-overlay');
  var resultTitleEl = document.getElementById('result-title');
  var resultMessageEl = document.getElementById('result-message');
  var btnRetry = document.getElementById('btn-retry');
  var btnNewGame = document.getElementById('btn-new-game');
  var boardWrapper = document.querySelector('.board-wrapper');

  // ============================================
  // 統計の読み込み・保存
  // ============================================
  function loadStats() {
    try {
      var saved = localStorage.getItem('tictactoeStats');
      if (saved) {
        stats = JSON.parse(saved);
      }
    } catch (e) {
      stats = { wins: 0, losses: 0, draws: 0 };
    }
    updateScoreDisplay();
  }

  function saveStats() {
    try {
      localStorage.setItem('tictactoeStats', JSON.stringify(stats));
    } catch (e) {
      // localStorage使用不可時は何もしない
    }
  }

  function loadBestScore() {
    try {
      var best = localStorage.getItem('bestTicTacToe');
      return best ? parseInt(best, 10) : 0;
    } catch (e) {
      return 0;
    }
  }

  function saveBestScore(streak) {
    try {
      var current = loadBestScore();
      if (streak > current) {
        localStorage.setItem('bestTicTacToe', String(streak));
      }
    } catch (e) {
      // localStorage使用不可時は何もしない
    }
  }

  // ============================================
  // スコア表示の更新
  // ============================================
  function updateScoreDisplay() {
    scoreWinsEl.textContent = stats.wins;
    scoreLossesEl.textContent = stats.losses;
    scoreDrawsEl.textContent = stats.draws;
  }

  // ============================================
  // ステータステキストの更新
  // ============================================
  function updateStatus(text) {
    statusTextEl.textContent = text;
  }

  // ============================================
  // 盤面の初期化
  // ============================================
  function initBoard() {
    board = [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY];
    currentTurn = PLAYER;
    gameOver = false;
    isProcessing = false;
    gameOverOverlay.classList.remove('active');
    boardWrapper.classList.remove('thinking');
    renderBoard();
    updateStatus('あなたのターン（○）');
  }

  // ============================================
  // 盤面の描画
  // ============================================
  function renderBoard() {
    for (var i = 0; i < 9; i++) {
      var cell = cells[i];
      // クラスをリセット
      cell.className = 'cell';
      cell.innerHTML = '';

      if (board[i] === PLAYER) {
        cell.classList.add('mark-o', 'taken');
        var mark = document.createElement('span');
        mark.className = 'mark';
        mark.textContent = '○';
        cell.appendChild(mark);
      } else if (board[i] === AI) {
        cell.classList.add('mark-x', 'taken');
        var mark = document.createElement('span');
        mark.className = 'mark';
        mark.textContent = '×';
        cell.appendChild(mark);
      }
    }
  }

  // ============================================
  // マスに配置（アニメーション付き）
  // ============================================
  function placeMark(index, mark) {
    board[index] = mark;

    var cell = cells[index];
    cell.className = 'cell taken placed';
    if (mark === PLAYER) {
      cell.classList.add('mark-o');
    } else {
      cell.classList.add('mark-x');
    }
    cell.innerHTML = '';
    var markEl = document.createElement('span');
    markEl.className = 'mark';
    markEl.textContent = mark === PLAYER ? '○' : '×';
    cell.appendChild(markEl);
  }

  // ============================================
  // 勝利判定
  // ============================================
  function checkWinner(b) {
    for (var i = 0; i < WIN_PATTERNS.length; i++) {
      var p = WIN_PATTERNS[i];
      if (b[p[0]] !== EMPTY && b[p[0]] === b[p[1]] && b[p[1]] === b[p[2]]) {
        return { winner: b[p[0]], pattern: p };
      }
    }
    return null;
  }

  // ============================================
  // 引き分け判定
  // ============================================
  function isDraw(b) {
    for (var i = 0; i < 9; i++) {
      if (b[i] === EMPTY) return false;
    }
    return true;
  }

  // ============================================
  // 勝利ラインのハイライト
  // ============================================
  function highlightWinLine(pattern) {
    for (var i = 0; i < pattern.length; i++) {
      cells[pattern[i]].classList.add('win-cell');
    }
  }

  // ============================================
  // ミニマックスアルゴリズム（AI）
  // ============================================
  function minimax(b, depth, isMaximizing) {
    var result = checkWinner(b);

    // 終了条件
    if (result) {
      if (result.winner === AI) return 10 - depth;
      if (result.winner === PLAYER) return depth - 10;
    }
    if (isDraw(b)) return 0;

    if (isMaximizing) {
      // AIのターン（最大化）
      var bestScore = -Infinity;
      for (var i = 0; i < 9; i++) {
        if (b[i] === EMPTY) {
          b[i] = AI;
          var score = minimax(b, depth + 1, false);
          b[i] = EMPTY;
          if (score > bestScore) {
            bestScore = score;
          }
        }
      }
      return bestScore;
    } else {
      // プレイヤーのターン（最小化）
      var bestScore = Infinity;
      for (var i = 0; i < 9; i++) {
        if (b[i] === EMPTY) {
          b[i] = PLAYER;
          var score = minimax(b, depth + 1, true);
          b[i] = EMPTY;
          if (score < bestScore) {
            bestScore = score;
          }
        }
      }
      return bestScore;
    }
  }

  // ============================================
  // AIの最善手を求める
  // ============================================
  function getBestMove() {
    var bestScore = -Infinity;
    var bestMoves = [];

    for (var i = 0; i < 9; i++) {
      if (board[i] === EMPTY) {
        board[i] = AI;
        var score = minimax(board, 0, false);
        board[i] = EMPTY;

        if (score > bestScore) {
          bestScore = score;
          bestMoves = [i];
        } else if (score === bestScore) {
          bestMoves.push(i);
        }
      }
    }

    // 同スコアの手からランダムに選ぶ（同じ展開ばかりにならないように）
    return bestMoves[Math.floor(Math.random() * bestMoves.length)];
  }

  // ============================================
  // ゲーム終了処理
  // ============================================
  function endGame(winner, pattern) {
    gameOver = true;

    if (winner === PLAYER) {
      highlightWinLine(pattern);
      stats.wins++;
      winStreak++;
      saveBestScore(winStreak);
      updateStatus('あなたの勝ち！');
      resultTitleEl.textContent = 'あなたの勝ち！';
      resultMessageEl.textContent = 'おめでとうございます！';
    } else if (winner === AI) {
      highlightWinLine(pattern);
      stats.losses++;
      winStreak = 0;
      updateStatus('CPUの勝ち...');
      resultTitleEl.textContent = 'CPUの勝ち...';
      resultMessageEl.textContent = 'もう一度チャレンジしよう！';
    } else {
      // 引き分け
      stats.draws++;
      winStreak = 0;
      updateStatus('引き分け！');
      resultTitleEl.textContent = '引き分け！';
      resultMessageEl.textContent = 'いい勝負でした！';
    }

    saveStats();
    updateScoreDisplay();

    // 少し遅延してからオーバーレイ表示
    setTimeout(function () {
      gameOverOverlay.classList.add('active');
    }, 800);
  }

  // ============================================
  // セルクリック処理
  // ============================================
  function onCellClick(e) {
    if (gameOver || isProcessing) return;
    if (currentTurn !== PLAYER) return;

    var cell = e.currentTarget;
    var index = parseInt(cell.dataset.index, 10);

    // 既に置かれている場所はスキップ
    if (board[index] !== EMPTY) return;

    // プレイヤーの手を配置
    placeMark(index, PLAYER);

    // 勝利判定
    var result = checkWinner(board);
    if (result) {
      endGame(result.winner, result.pattern);
      return;
    }

    // 引き分け判定
    if (isDraw(board)) {
      endGame(null, null);
      return;
    }

    // AIのターンへ
    currentTurn = AI;
    isProcessing = true;
    updateStatus('CPUのターン（×）');
    boardWrapper.classList.add('thinking');

    // 少し遅延してAIの手を打つ（自然な感じ）
    var delay = 300 + Math.floor(Math.random() * 400);
    setTimeout(function () {
      boardWrapper.classList.remove('thinking');

      var move = getBestMove();
      if (move !== undefined) {
        placeMark(move, AI);

        // 勝利判定
        var aiResult = checkWinner(board);
        if (aiResult) {
          isProcessing = false;
          endGame(aiResult.winner, aiResult.pattern);
          return;
        }

        // 引き分け判定
        if (isDraw(board)) {
          isProcessing = false;
          endGame(null, null);
          return;
        }
      }

      // プレイヤーのターンへ戻す
      currentTurn = PLAYER;
      isProcessing = false;
      updateStatus('あなたのターン（○）');
    }, delay);
  }

  // ============================================
  // ゲーム開始
  // ============================================
  function startGame() {
    initBoard();
  }

  // ============================================
  // イベント設定
  // ============================================

  // 各セルにクリックイベント
  for (var i = 0; i < cells.length; i++) {
    cells[i].addEventListener('click', onCellClick);
  }

  // New Game ボタン
  btnNewGame.addEventListener('click', function () {
    startGame();
  });

  // もう一度遊ぶボタン
  btnRetry.addEventListener('click', function () {
    startGame();
  });

  // ============================================
  // 初期化
  // ============================================
  loadStats();
  startGame();

})();
