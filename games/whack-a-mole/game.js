// ============================================
// もぐらたたき ロジック
// ============================================

(function () {
  'use strict';

  // ============================================
  // 定数
  // ============================================
  var GAME_DURATION = 30;            // ゲーム時間（秒）
  var SCORE_PER_HIT = 10;            // 1回のヒットで得られるスコア
  var INITIAL_MOLE_INTERVAL = 1200;  // もぐらの出現間隔（ミリ秒）初期値
  var MIN_MOLE_INTERVAL = 500;       // もぐらの出現間隔（ミリ秒）最小値
  var INITIAL_MOLE_DURATION = 1000;  // もぐらが穴にいる時間（ミリ秒）初期値
  var MIN_MOLE_DURATION = 450;       // もぐらが穴にいる時間（ミリ秒）最小値
  var HOLE_COUNT = 9;                // 穴の数（3x3）

  // ============================================
  // 状態変数
  // ============================================
  var score = 0;
  var bestScore = parseInt(localStorage.getItem('bestWhackAMole') || '0', 10);
  var timeLeft = GAME_DURATION;
  var gameRunning = false;
  var gameTimerInterval = null;      // 1秒ごとのカウントダウン用
  var moleSpawnTimer = null;         // もぐら出現スケジュール用
  var activeMoles = {};              // 現在出ているもぐらの管理 { index: timerId }
  var lastMoleIndex = -1;            // 直前に出たもぐらの穴番号（連続同じ穴を避ける）

  // ============================================
  // DOM要素
  // ============================================
  var scoreEl = document.getElementById('score');
  var bestScoreEl = document.getElementById('best-score');
  var timerEl = document.getElementById('timer');
  var timerBox = timerEl.parentElement;
  var gameOverOverlay = document.getElementById('game-over-overlay');
  var gameStartOverlay = document.getElementById('game-start-overlay');
  var finalScoreEl = document.getElementById('final-score');
  var bestResultEl = document.getElementById('best-result');
  var moles = document.querySelectorAll('.mole');
  var holes = document.querySelectorAll('.mole-hole');

  // ============================================
  // スコア更新
  // ============================================
  function updateScore() {
    scoreEl.textContent = score;
    if (score > bestScore) {
      bestScore = score;
      localStorage.setItem('bestWhackAMole', bestScore.toString());
    }
    bestScoreEl.textContent = bestScore;
  }

  // ============================================
  // タイマー表示更新
  // ============================================
  function updateTimerDisplay() {
    timerEl.textContent = timeLeft;

    // 残り時間に応じたスタイル変更
    timerBox.classList.remove('warning', 'danger');
    if (timeLeft <= 5) {
      timerBox.classList.add('danger');
    } else if (timeLeft <= 10) {
      timerBox.classList.add('warning');
    }
  }

  // ============================================
  // 難易度に応じた出現間隔を計算
  // ============================================
  function getMoleInterval() {
    // 残り時間が少ないほど間隔が短くなる
    var elapsed = GAME_DURATION - timeLeft;
    var progress = elapsed / GAME_DURATION; // 0 ~ 1
    var interval = INITIAL_MOLE_INTERVAL - (INITIAL_MOLE_INTERVAL - MIN_MOLE_INTERVAL) * progress;
    return Math.max(interval, MIN_MOLE_INTERVAL);
  }

  // ============================================
  // 難易度に応じたもぐら表示時間を計算
  // ============================================
  function getMoleDuration() {
    var elapsed = GAME_DURATION - timeLeft;
    var progress = elapsed / GAME_DURATION;
    var duration = INITIAL_MOLE_DURATION - (INITIAL_MOLE_DURATION - MIN_MOLE_DURATION) * progress;
    return Math.max(duration, MIN_MOLE_DURATION);
  }

  // ============================================
  // ランダムな穴を選ぶ（前回と同じ穴を避ける）
  // ============================================
  function getRandomHoleIndex() {
    var available = [];
    for (var i = 0; i < HOLE_COUNT; i++) {
      // 既にもぐらが出ている穴と、直前の穴を除外
      if (!activeMoles[i] && i !== lastMoleIndex) {
        available.push(i);
      }
    }

    // 全て使用中なら何もしない
    if (available.length === 0) return -1;

    return available[Math.floor(Math.random() * available.length)];
  }

  // ============================================
  // もぐらを出す
  // ============================================
  function showMole(index) {
    if (index < 0 || index >= HOLE_COUNT) return;
    if (activeMoles[index]) return; // 既に出ている

    var mole = moles[index];
    mole.classList.remove('whacked');
    mole.classList.add('active');
    lastMoleIndex = index;

    // 一定時間後にもぐらを引っ込める
    var duration = getMoleDuration();
    activeMoles[index] = setTimeout(function () {
      hideMole(index);
    }, duration);
  }

  // ============================================
  // もぐらを引っ込める
  // ============================================
  function hideMole(index) {
    if (activeMoles[index]) {
      clearTimeout(activeMoles[index]);
      delete activeMoles[index];
    }

    var mole = moles[index];
    mole.classList.remove('active');
    mole.classList.remove('whacked');
  }

  // ============================================
  // すべてのもぐらを引っ込める
  // ============================================
  function hideAllMoles() {
    for (var i = 0; i < HOLE_COUNT; i++) {
      hideMole(i);
    }
    activeMoles = {};
  }

  // ============================================
  // もぐらの出現スケジュール
  // ============================================
  function scheduleMole() {
    if (!gameRunning) return;

    var index = getRandomHoleIndex();
    if (index >= 0) {
      showMole(index);
    }

    // 次のもぐらをスケジュール
    var interval = getMoleInterval();
    moleSpawnTimer = setTimeout(scheduleMole, interval);
  }

  // ============================================
  // もぐらをたたく処理
  // ============================================
  function whackMole(index) {
    if (!gameRunning) return;
    if (!activeMoles[index]) return; // もぐらが出ていない

    var mole = moles[index];

    // 既にたたかれたもぐらは無視
    if (mole.classList.contains('whacked')) return;

    // たたくエフェクト
    mole.classList.add('whacked');

    // スコア加算
    score += SCORE_PER_HIT;
    updateScore();

    // 少し遅延してから引っ込める
    clearTimeout(activeMoles[index]);
    activeMoles[index] = setTimeout(function () {
      hideMole(index);
    }, 300);
  }

  // ============================================
  // カウントダウンタイマー
  // ============================================
  function startCountdown() {
    gameTimerInterval = setInterval(function () {
      timeLeft--;
      updateTimerDisplay();

      if (timeLeft <= 0) {
        gameOver();
      }
    }, 1000);
  }

  // ============================================
  // ゲームオーバー処理
  // ============================================
  function gameOver() {
    gameRunning = false;

    // タイマー停止
    if (gameTimerInterval) {
      clearInterval(gameTimerInterval);
      gameTimerInterval = null;
    }

    // もぐら出現停止
    if (moleSpawnTimer) {
      clearTimeout(moleSpawnTimer);
      moleSpawnTimer = null;
    }

    // すべてのもぐらを引っ込める
    hideAllMoles();

    // 結果を表示
    finalScoreEl.textContent = score;

    if (score >= bestScore && score > 0) {
      bestResultEl.textContent = 'ハイスコア更新！';
    } else {
      bestResultEl.textContent = 'ベスト: ' + bestScore;
    }

    // 少し遅延させてオーバーレイを表示
    setTimeout(function () {
      gameOverOverlay.classList.add('active');
    }, 400);
  }

  // ============================================
  // ゲーム開始・リスタート
  // ============================================
  function startGame() {
    // タイマーをクリア
    if (gameTimerInterval) {
      clearInterval(gameTimerInterval);
      gameTimerInterval = null;
    }
    if (moleSpawnTimer) {
      clearTimeout(moleSpawnTimer);
      moleSpawnTimer = null;
    }

    // すべてのもぐらを引っ込める
    hideAllMoles();

    // 状態をリセット
    score = 0;
    timeLeft = GAME_DURATION;
    lastMoleIndex = -1;
    updateScore();
    updateTimerDisplay();

    // タイマーの警告スタイルをリセット
    timerBox.classList.remove('warning', 'danger');

    // オーバーレイを非表示
    gameOverOverlay.classList.remove('active');
    gameStartOverlay.classList.remove('active');

    // ゲーム開始
    gameRunning = true;

    // カウントダウン開始
    startCountdown();

    // 最初のもぐらを少し遅延して出す
    moleSpawnTimer = setTimeout(scheduleMole, 500);
  }

  // ============================================
  // クリック・タップイベント
  // ============================================
  // もぐら（穴）のクリックイベント
  for (var i = 0; i < holes.length; i++) {
    (function (index) {
      holes[index].addEventListener('click', function (e) {
        e.preventDefault();
        whackMole(index);
      });

      // タッチ操作の応答性向上
      holes[index].addEventListener('touchstart', function (e) {
        e.preventDefault();
        whackMole(index);
      }, { passive: false });
    })(i);
  }

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
  // ページ離脱時にゲームを停止
  // ============================================
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && gameRunning) {
      // ページが非表示になったらゲームを一時停止
      gameRunning = false;

      if (gameTimerInterval) {
        clearInterval(gameTimerInterval);
        gameTimerInterval = null;
      }
      if (moleSpawnTimer) {
        clearTimeout(moleSpawnTimer);
        moleSpawnTimer = null;
      }

      hideAllMoles();

      // ゲームオーバーとして処理
      gameOver();
    }
  });

  // ============================================
  // 初期化
  // ============================================
  bestScoreEl.textContent = bestScore;
  updateTimerDisplay();
})();
