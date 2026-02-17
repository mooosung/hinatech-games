// ============================================
// リバーシ（オセロ）ゲーム
// ============================================

(function () {
  'use strict';

  // 定数
  var EMPTY = 0;
  var BLACK = 1;
  var WHITE = 2;
  var BOARD_SIZE = 8;

  // 8方向（上、右上、右、右下、下、左下、左、左上）
  var DIRECTIONS = [
    [-1, 0], [-1, 1], [0, 1], [1, 1],
    [1, 0], [1, -1], [0, -1], [-1, -1]
  ];

  // 盤面評価用の重み（Hard CPUで使用）
  var WEIGHT_MAP = [
    [100, -20,  10,   5,   5,  10, -20, 100],
    [-20, -50,  -2,  -2,  -2,  -2, -50, -20],
    [ 10,  -2,   1,   1,   1,   1,  -2,  10],
    [  5,  -2,   1,   0,   0,   1,  -2,   5],
    [  5,  -2,   1,   0,   0,   1,  -2,   5],
    [ 10,  -2,   1,   1,   1,   1,  -2,  10],
    [-20, -50,  -2,  -2,  -2,  -2, -50, -20],
    [100, -20,  10,   5,   5,  10, -20, 100]
  ];

  // ゲーム状態
  var board = [];
  var currentPlayer = BLACK;
  var gameMode = 'cpu-easy'; // 'cpu-easy', 'cpu-hard', 'two-player'
  var gameOver = false;
  var isProcessing = false; // アニメーション中やCPU思考中のクリック防止

  // DOM要素
  var boardEl = document.getElementById('board');
  var scoreBlackEl = document.getElementById('score-black');
  var scoreWhiteEl = document.getElementById('score-white');
  var scoreBlackBox = document.getElementById('score-black-box');
  var scoreWhiteBox = document.getElementById('score-white-box');
  var turnTextEl = document.getElementById('turn-text');
  var gameOverOverlay = document.getElementById('game-over-overlay');
  var resultTitleEl = document.getElementById('result-title');
  var resultMessageEl = document.getElementById('result-message');
  var finalBlackEl = document.getElementById('final-black');
  var finalWhiteEl = document.getElementById('final-white');
  var btnRetry = document.getElementById('btn-retry');
  var btnNewGame = document.getElementById('btn-new-game');
  var modeBtns = document.querySelectorAll('.mode-btn');
  var boardWrapper = document.querySelector('.board-wrapper');

  // ============================================
  // 盤面の初期化
  // ============================================
  function initBoard() {
    board = [];
    for (var r = 0; r < BOARD_SIZE; r++) {
      board[r] = [];
      for (var c = 0; c < BOARD_SIZE; c++) {
        board[r][c] = EMPTY;
      }
    }
    // 初期配置（中央に黒白を2つずつ）
    board[3][3] = WHITE;
    board[3][4] = BLACK;
    board[4][3] = BLACK;
    board[4][4] = WHITE;

    currentPlayer = BLACK;
    gameOver = false;
    isProcessing = false;
    gameOverOverlay.classList.remove('active');
    boardWrapper.classList.remove('thinking');
  }

  // ============================================
  // 盤面の描画
  // ============================================
  function renderBoard() {
    boardEl.innerHTML = '';
    var validMoves = getValidMoves(currentPlayer);

    for (var r = 0; r < BOARD_SIZE; r++) {
      for (var c = 0; c < BOARD_SIZE; c++) {
        var cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.row = r;
        cell.dataset.col = c;

        // 石を置く
        if (board[r][c] !== EMPTY) {
          var stone = document.createElement('div');
          stone.className = 'stone ' + (board[r][c] === BLACK ? 'black' : 'white');
          cell.appendChild(stone);
        }

        // 置ける場所にマーク
        if (!gameOver && !isProcessing && isInList(validMoves, r, c)) {
          cell.classList.add('valid');
        }

        cell.addEventListener('click', onCellClick);
        boardEl.appendChild(cell);
      }
    }

    updateScore();
    updateTurnIndicator();
  }

  // ============================================
  // スコア更新
  // ============================================
  function updateScore() {
    var counts = countStones();
    scoreBlackEl.textContent = counts.black;
    scoreWhiteEl.textContent = counts.white;
  }

  // ============================================
  // ターン表示の更新
  // ============================================
  function updateTurnIndicator() {
    if (gameOver) {
      turnTextEl.textContent = '終了';
      scoreBlackBox.classList.remove('active-player');
      scoreWhiteBox.classList.remove('active-player');
      return;
    }

    if (currentPlayer === BLACK) {
      turnTextEl.textContent = isCpuMode() ? 'あなたのターン' : '黒のターン';
      scoreBlackBox.classList.add('active-player');
      scoreWhiteBox.classList.remove('active-player');
    } else {
      turnTextEl.textContent = isCpuMode() ? 'CPUのターン' : '白のターン';
      scoreBlackBox.classList.remove('active-player');
      scoreWhiteBox.classList.add('active-player');
    }
  }

  // ============================================
  // 石の数をカウント
  // ============================================
  function countStones() {
    var black = 0;
    var white = 0;
    for (var r = 0; r < BOARD_SIZE; r++) {
      for (var c = 0; c < BOARD_SIZE; c++) {
        if (board[r][c] === BLACK) black++;
        if (board[r][c] === WHITE) white++;
      }
    }
    return { black: black, white: white };
  }

  // ============================================
  // 有効な手のリストを取得
  // ============================================
  function getValidMoves(player) {
    var moves = [];
    for (var r = 0; r < BOARD_SIZE; r++) {
      for (var c = 0; c < BOARD_SIZE; c++) {
        if (board[r][c] === EMPTY && getFlippableStones(r, c, player).length > 0) {
          moves.push({ row: r, col: c });
        }
      }
    }
    return moves;
  }

  // ============================================
  // ある位置に石を置いた場合にひっくり返せる石のリストを取得
  // ============================================
  function getFlippableStones(row, col, player) {
    if (board[row][col] !== EMPTY) return [];

    var opponent = player === BLACK ? WHITE : BLACK;
    var allFlippable = [];

    for (var d = 0; d < DIRECTIONS.length; d++) {
      var dr = DIRECTIONS[d][0];
      var dc = DIRECTIONS[d][1];
      var flippable = [];
      var r = row + dr;
      var c = col + dc;

      // 相手の石が続く限り進む
      while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === opponent) {
        flippable.push({ row: r, col: c });
        r += dr;
        c += dc;
      }

      // 最後が自分の石なら挟んでいる
      if (flippable.length > 0 && r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === player) {
        allFlippable = allFlippable.concat(flippable);
      }
    }

    return allFlippable;
  }

  // ============================================
  // 石を置く（アニメーション付き）
  // ============================================
  function placeStone(row, col, player, callback) {
    var flippable = getFlippableStones(row, col, player);
    if (flippable.length === 0) {
      if (callback) callback();
      return false;
    }

    // 石を配置
    board[row][col] = player;

    // 盤面を再描画（置いた石にアニメーション付与）
    renderBoard();

    // 置いた石にアニメーション
    var placedCell = getCellElement(row, col);
    if (placedCell) {
      placedCell.classList.add('last-move');
      var placedStone = placedCell.querySelector('.stone');
      if (placedStone) {
        placedStone.classList.add('placed');
      }
    }

    // 少し遅れてひっくり返すアニメーション
    setTimeout(function () {
      flipStones(flippable, player, function () {
        renderBoard();
        // 最後に置いた場所をハイライト
        var lastCell = getCellElement(row, col);
        if (lastCell) {
          lastCell.classList.add('last-move');
        }
        if (callback) callback();
      });
    }, 150);

    return true;
  }

  // ============================================
  // 石をひっくり返すアニメーション
  // ============================================
  function flipStones(flippable, player, callback) {
    var flipDelay = 50; // 石をずらしてアニメーションさせる
    var maxDelay = 0;

    for (var i = 0; i < flippable.length; i++) {
      (function (index) {
        var delay = index * flipDelay;
        if (delay > maxDelay) maxDelay = delay;

        setTimeout(function () {
          var pos = flippable[index];
          var cellEl = getCellElement(pos.row, pos.col);
          if (!cellEl) return;
          var stoneEl = cellEl.querySelector('.stone');
          if (!stoneEl) return;

          // ひっくり返しアニメーション開始
          stoneEl.classList.add('flipping');

          // アニメーションの半分の時点で色を変更
          setTimeout(function () {
            board[pos.row][pos.col] = player;
            stoneEl.className = 'stone ' + (player === BLACK ? 'black' : 'white') + ' flipping';
          }, 200);
        }, delay);
      })(i);
    }

    // すべてのアニメーション完了後にコールバック
    setTimeout(function () {
      if (callback) callback();
    }, maxDelay + 450);
  }

  // ============================================
  // セル要素の取得
  // ============================================
  function getCellElement(row, col) {
    var index = row * BOARD_SIZE + col;
    return boardEl.children[index] || null;
  }

  // ============================================
  // 有効手リストに含まれるか判定
  // ============================================
  function isInList(moves, row, col) {
    for (var i = 0; i < moves.length; i++) {
      if (moves[i].row === row && moves[i].col === col) return true;
    }
    return false;
  }

  // ============================================
  // セルクリック処理
  // ============================================
  function onCellClick(e) {
    if (gameOver || isProcessing) return;

    var cell = e.currentTarget;
    var row = parseInt(cell.dataset.row, 10);
    var col = parseInt(cell.dataset.col, 10);

    // CPUモードで白のターンならクリック無効
    if (isCpuMode() && currentPlayer === WHITE) return;

    // 置けない場所ならスキップ
    var validMoves = getValidMoves(currentPlayer);
    if (!isInList(validMoves, row, col)) return;

    // 石を置く
    isProcessing = true;
    placeStone(row, col, currentPlayer, function () {
      advanceTurn();
    });
  }

  // ============================================
  // ターンを進める
  // ============================================
  function advanceTurn() {
    // 相手のターンに切替
    currentPlayer = currentPlayer === BLACK ? WHITE : BLACK;

    var currentMoves = getValidMoves(currentPlayer);
    var opponentMoves = getValidMoves(currentPlayer === BLACK ? WHITE : BLACK);

    // 現在のプレイヤーが打てない場合
    if (currentMoves.length === 0) {
      // 相手も打てないなら終了
      if (opponentMoves.length === 0) {
        isProcessing = false;
        endGame();
        return;
      }

      // パス：通知を表示してからターン切替
      showPassNotification(currentPlayer, function () {
        currentPlayer = currentPlayer === BLACK ? WHITE : BLACK;
        isProcessing = false;
        renderBoard();

        // CPUのターンなら自動で打つ
        if (isCpuMode() && currentPlayer === WHITE) {
          cpuMove();
        }
      });
      return;
    }

    isProcessing = false;
    renderBoard();

    // CPUのターンなら自動で打つ
    if (isCpuMode() && currentPlayer === WHITE) {
      cpuMove();
    }
  }

  // ============================================
  // パス通知を表示
  // ============================================
  function showPassNotification(player, callback) {
    var playerName;
    if (isCpuMode()) {
      playerName = player === BLACK ? 'あなた' : 'CPU';
    } else {
      playerName = player === BLACK ? '黒' : '白';
    }

    var notification = document.createElement('div');
    notification.className = 'pass-notification';
    notification.textContent = playerName + ' はパス！';
    boardWrapper.appendChild(notification);

    setTimeout(function () {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
      if (callback) callback();
    }, 1000);
  }

  // ============================================
  // CPUモードか判定
  // ============================================
  function isCpuMode() {
    return gameMode === 'cpu-easy' || gameMode === 'cpu-hard';
  }

  // ============================================
  // CPUの手を打つ
  // ============================================
  function cpuMove() {
    isProcessing = true;
    boardWrapper.classList.add('thinking');
    renderBoard();

    // 少し遅延してから打つ（自然な感じにする）
    var delay = 300 + Math.floor(Math.random() * 300);

    setTimeout(function () {
      boardWrapper.classList.remove('thinking');

      var move;
      if (gameMode === 'cpu-easy') {
        move = cpuMoveEasy();
      } else {
        move = cpuMoveHard();
      }

      if (!move) {
        // 打てる手がない（通常ここには来ないはず）
        isProcessing = false;
        advanceTurn();
        return;
      }

      placeStone(move.row, move.col, WHITE, function () {
        advanceTurn();
      });
    }, delay);
  }

  // ============================================
  // CPU（かんたん）: ランダムに打つ
  // ============================================
  function cpuMoveEasy() {
    var validMoves = getValidMoves(WHITE);
    if (validMoves.length === 0) return null;
    var index = Math.floor(Math.random() * validMoves.length);
    return validMoves[index];
  }

  // ============================================
  // CPU（つよい）: 重み付き評価で打つ
  // ============================================
  function cpuMoveHard() {
    var validMoves = getValidMoves(WHITE);
    if (validMoves.length === 0) return null;

    var bestScore = -Infinity;
    var bestMoves = [];

    for (var i = 0; i < validMoves.length; i++) {
      var move = validMoves[i];
      var flippable = getFlippableStones(move.row, move.col, WHITE);

      // 基本スコア: 位置の重み
      var score = WEIGHT_MAP[move.row][move.col];

      // ひっくり返せる石の数も加味
      score += flippable.length * 2;

      // 角を取れるなら大幅にボーナス
      if (isCorner(move.row, move.col)) {
        score += 50;
      }

      // 相手の角取りを防げるかチェック（シミュレーション）
      var simBoard = simulateMove(board, move.row, move.col, WHITE);
      var opponentMovesAfter = getValidMovesOnBoard(simBoard, BLACK);
      for (var j = 0; j < opponentMovesAfter.length; j++) {
        if (isCorner(opponentMovesAfter[j].row, opponentMovesAfter[j].col)) {
          score -= 30; // 相手に角を取られそうなら減点
        }
      }

      // 少しランダム性を追加（同じ手ばかりにならないように）
      score += Math.random() * 5;

      if (score > bestScore) {
        bestScore = score;
        bestMoves = [move];
      } else if (score === bestScore) {
        bestMoves.push(move);
      }
    }

    // 同スコアの手からランダムに選ぶ
    return bestMoves[Math.floor(Math.random() * bestMoves.length)];
  }

  // ============================================
  // 角かどうか判定
  // ============================================
  function isCorner(row, col) {
    return (row === 0 || row === 7) && (col === 0 || col === 7);
  }

  // ============================================
  // 手を仮に打った盤面を返す（シミュレーション用）
  // ============================================
  function simulateMove(currentBoard, row, col, player) {
    // 盤面をコピー
    var newBoard = [];
    for (var r = 0; r < BOARD_SIZE; r++) {
      newBoard[r] = [];
      for (var c = 0; c < BOARD_SIZE; c++) {
        newBoard[r][c] = currentBoard[r][c];
      }
    }

    // 石を置く
    newBoard[row][col] = player;

    // ひっくり返す
    var opponent = player === BLACK ? WHITE : BLACK;
    for (var d = 0; d < DIRECTIONS.length; d++) {
      var dr = DIRECTIONS[d][0];
      var dc = DIRECTIONS[d][1];
      var flippable = [];
      var cr = row + dr;
      var cc = col + dc;

      while (cr >= 0 && cr < BOARD_SIZE && cc >= 0 && cc < BOARD_SIZE && newBoard[cr][cc] === opponent) {
        flippable.push({ row: cr, col: cc });
        cr += dr;
        cc += dc;
      }

      if (flippable.length > 0 && cr >= 0 && cr < BOARD_SIZE && cc >= 0 && cc < BOARD_SIZE && newBoard[cr][cc] === player) {
        for (var f = 0; f < flippable.length; f++) {
          newBoard[flippable[f].row][flippable[f].col] = player;
        }
      }
    }

    return newBoard;
  }

  // ============================================
  // 指定盤面での有効手リストを取得
  // ============================================
  function getValidMovesOnBoard(targetBoard, player) {
    var moves = [];
    var opponent = player === BLACK ? WHITE : BLACK;

    for (var r = 0; r < BOARD_SIZE; r++) {
      for (var c = 0; c < BOARD_SIZE; c++) {
        if (targetBoard[r][c] !== EMPTY) continue;

        var canFlip = false;
        for (var d = 0; d < DIRECTIONS.length && !canFlip; d++) {
          var dr = DIRECTIONS[d][0];
          var dc = DIRECTIONS[d][1];
          var count = 0;
          var cr = r + dr;
          var cc = c + dc;

          while (cr >= 0 && cr < BOARD_SIZE && cc >= 0 && cc < BOARD_SIZE && targetBoard[cr][cc] === opponent) {
            count++;
            cr += dr;
            cc += dc;
          }

          if (count > 0 && cr >= 0 && cr < BOARD_SIZE && cc >= 0 && cc < BOARD_SIZE && targetBoard[cr][cc] === player) {
            canFlip = true;
          }
        }

        if (canFlip) {
          moves.push({ row: r, col: c });
        }
      }
    }

    return moves;
  }

  // ============================================
  // ゲーム終了
  // ============================================
  function endGame() {
    gameOver = true;
    var counts = countStones();

    finalBlackEl.textContent = counts.black;
    finalWhiteEl.textContent = counts.white;

    if (counts.black > counts.white) {
      if (isCpuMode()) {
        resultTitleEl.textContent = 'あなたの勝ち！';
        resultMessageEl.textContent = 'おめでとうございます！';
      } else {
        resultTitleEl.textContent = '黒の勝ち！';
        resultMessageEl.textContent = '黒プレイヤーの勝利です';
      }
    } else if (counts.white > counts.black) {
      if (isCpuMode()) {
        resultTitleEl.textContent = 'CPUの勝ち...';
        resultMessageEl.textContent = 'もう一度チャレンジしよう！';
      } else {
        resultTitleEl.textContent = '白の勝ち！';
        resultMessageEl.textContent = '白プレイヤーの勝利です';
      }
    } else {
      resultTitleEl.textContent = '引き分け！';
      resultMessageEl.textContent = '同点です。もう一度勝負しよう！';
    }

    renderBoard();
    gameOverOverlay.classList.add('active');
  }

  // ============================================
  // ゲーム開始
  // ============================================
  function startGame() {
    initBoard();
    renderBoard();
  }

  // ============================================
  // イベント設定
  // ============================================

  // New Game ボタン
  btnNewGame.addEventListener('click', function () {
    startGame();
  });

  // もう一度遊ぶボタン
  btnRetry.addEventListener('click', function () {
    startGame();
  });

  // モード切替ボタン
  modeBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      // アクティブ状態を切替
      modeBtns.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');

      // モード設定
      gameMode = btn.dataset.mode;

      // ゲームをリスタート
      startGame();
    });
  });

  // ============================================
  // 初期化
  // ============================================
  startGame();

})();
