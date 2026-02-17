// ============================================
// サイモンゲーム ロジック
// ============================================

(function () {
  'use strict';

  // 色の定義
  var COLORS = ['green', 'red', 'yellow', 'blue'];

  // タイミング設定（ミリ秒）
  var FLASH_DURATION = 400;     // ボタンが光る時間
  var FLASH_GAP = 150;          // ボタン間の間隔
  var ROUND_DELAY = 600;        // ラウンド開始前の待ち時間
  var PLAYER_FLASH = 200;       // プレイヤータップ時の光る時間
  var ERROR_DELAY = 1200;       // エラー後の待ち時間

  // ゲーム状態
  var sequence = [];            // コンピュータの色シーケンス
  var playerIndex = 0;          // プレイヤーが現在入力中の位置
  var score = 0;                // 現在のスコア
  var bestScore = 0;            // ベストスコア
  var isShowingSequence = false;// シーケンス再生中フラグ
  var isPlayerTurn = false;     // プレイヤーの番フラグ
  var isGameActive = false;     // ゲーム進行中フラグ

  // DOM要素
  var scoreEl = document.getElementById('score');
  var bestScoreEl = document.getElementById('best-score');
  var statusTextEl = document.getElementById('status-text');
  var simonBoard = document.getElementById('simon-board');
  var startOverlay = document.getElementById('game-start-overlay');
  var gameOverOverlay = document.getElementById('game-over-overlay');
  var finalScoreEl = document.getElementById('final-score');
  var bestResultEl = document.getElementById('best-result');

  // サイモンボタン
  var simonBtns = {};
  COLORS.forEach(function (color) {
    simonBtns[color] = document.getElementById('btn-' + color);
  });

  // ============================================
  // localStorage管理
  // ============================================

  function loadBestScore() {
    var saved = localStorage.getItem('bestSimon');
    if (saved !== null) {
      bestScore = parseInt(saved, 10) || 0;
    }
    bestScoreEl.textContent = bestScore;
  }

  function saveBestScore() {
    if (score > bestScore) {
      bestScore = score;
      localStorage.setItem('bestSimon', String(bestScore));
      bestScoreEl.textContent = bestScore;
      return true; // 新記録
    }
    return false;
  }

  // ============================================
  // ボタンのフラッシュ（光り）制御
  // ============================================

  function flashButton(color, duration) {
    var btn = simonBtns[color];
    btn.classList.add('active');
    setTimeout(function () {
      btn.classList.remove('active');
    }, duration);
  }

  // ============================================
  // シーケンスの再生
  // ============================================

  function playSequence() {
    isShowingSequence = true;
    isPlayerTurn = false;
    statusTextEl.textContent = '\u898B\u3066\u899A\u3048\u3088\u3046\uFF01'; // 見て覚えよう！

    // ボタンを無効化
    disableButtons();

    var i = 0;
    var intervalId = setInterval(function () {
      if (i >= sequence.length) {
        clearInterval(intervalId);
        // シーケンス再生完了 → プレイヤーの番
        setTimeout(function () {
          startPlayerTurn();
        }, FLASH_GAP + 200);
        return;
      }

      flashButton(sequence[i], FLASH_DURATION);
      i++;
    }, FLASH_DURATION + FLASH_GAP);
  }

  // ============================================
  // プレイヤーの番
  // ============================================

  function startPlayerTurn() {
    isShowingSequence = false;
    isPlayerTurn = true;
    playerIndex = 0;
    statusTextEl.textContent = '\u3042\u306A\u305F\u306E\u756A\uFF01'; // あなたの番！

    // ボタンを有効化
    enableButtons();
  }

  // ============================================
  // ボタンの有効/無効
  // ============================================

  function enableButtons() {
    COLORS.forEach(function (color) {
      simonBtns[color].disabled = false;
    });
  }

  function disableButtons() {
    COLORS.forEach(function (color) {
      simonBtns[color].disabled = true;
    });
  }

  // ============================================
  // プレイヤーの入力処理
  // ============================================

  function handlePlayerInput(color) {
    if (!isPlayerTurn || isShowingSequence) return;

    // タップのフラッシュ
    flashButton(color, PLAYER_FLASH);

    var expected = sequence[playerIndex];

    if (color === expected) {
      // 正解
      playerIndex++;

      if (playerIndex >= sequence.length) {
        // シーケンス全て正解！ → 次のラウンド
        isPlayerTurn = false;
        disableButtons();

        score = sequence.length;
        scoreEl.textContent = score;
        statusTextEl.textContent = '\u6B63\u89E3\uFF01'; // 正解！

        // 次のラウンドへ
        setTimeout(function () {
          nextRound();
        }, ROUND_DELAY);
      }
    } else {
      // 間違い → ゲームオーバー
      handleGameOver();
    }
  }

  // ============================================
  // 次のラウンド
  // ============================================

  function nextRound() {
    // 新しい色をシーケンスに追加
    var randomColor = COLORS[Math.floor(Math.random() * COLORS.length)];
    sequence.push(randomColor);

    // シーケンス再生
    playSequence();
  }

  // ============================================
  // ゲームオーバー
  // ============================================

  function handleGameOver() {
    isPlayerTurn = false;
    isGameActive = false;
    disableButtons();

    statusTextEl.textContent = '\u6B8B\u5FF5\uFF01'; // 残念！

    // エラーフラッシュ
    simonBoard.classList.add('error-flash');

    setTimeout(function () {
      simonBoard.classList.remove('error-flash');

      // ベストスコア更新チェック
      var isNewBest = saveBestScore();

      // 結果表示
      finalScoreEl.textContent = score;

      if (isNewBest) {
        bestResultEl.textContent = '\uD83C\uDF89 \u65B0\u8A18\u9332\uFF01'; // 新記録！
      } else {
        bestResultEl.textContent = '\u30D9\u30B9\u30C8: ' + bestScore; // ベスト:
      }

      // オーバーレイ表示
      gameOverOverlay.classList.add('active');
    }, ERROR_DELAY);
  }

  // ============================================
  // ゲーム初期化
  // ============================================

  function initGame() {
    // 状態リセット
    sequence = [];
    playerIndex = 0;
    score = 0;
    isShowingSequence = false;
    isPlayerTurn = false;
    isGameActive = true;

    scoreEl.textContent = '0';
    statusTextEl.textContent = '\u6E96\u5099\u4E2D\u2026'; // 準備中…

    // オーバーレイを閉じる
    startOverlay.classList.remove('active');
    gameOverOverlay.classList.remove('active');

    // ボタンの状態リセット
    disableButtons();
    COLORS.forEach(function (color) {
      simonBtns[color].classList.remove('active');
    });

    // ベストスコア読み込み
    loadBestScore();

    // 最初のラウンド開始（少し待ってから）
    setTimeout(function () {
      nextRound();
    }, ROUND_DELAY);
  }

  // ============================================
  // イベントリスナー
  // ============================================

  // サイモンボタンのクリック
  COLORS.forEach(function (color) {
    simonBtns[color].addEventListener('click', function () {
      handlePlayerInput(color);
    });
  });

  // スタートボタン
  document.getElementById('btn-start').addEventListener('click', initGame);

  // もう一度遊ぶボタン
  document.getElementById('btn-retry').addEventListener('click', initGame);

  // New Gameボタン
  document.getElementById('btn-new-game').addEventListener('click', function () {
    // ゲーム中ならリセット
    if (isGameActive) {
      // シーケンス再生中のタイマーを止めるためにリセット
      isShowingSequence = false;
      isPlayerTurn = false;
      isGameActive = false;
      disableButtons();
    }
    initGame();
  });

  // ============================================
  // 初期表示
  // ============================================

  loadBestScore();

})();
