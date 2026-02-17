// ============================================
// カラーマッチ ロジック
// ============================================

(function () {
  'use strict';

  // ============================================
  // 定数
  // ============================================
  var GAME_DURATION = 30;           // ゲーム時間（秒）
  var CORRECT_POINTS = 10;          // 正解時の得点
  var WRONG_POINTS = -5;            // 不正解時の減点
  var TIMER_INTERVAL = 100;         // タイマー更新間隔（ミリ秒）
  var FEEDBACK_DURATION = 400;      // フィードバック表示時間（ミリ秒）
  var WARNING_TIME = 10;            // 警告表示の残り秒数
  var DANGER_TIME = 5;              // 危険表示の残り秒数

  // 色の定義
  var COLORS = [
    { name: 'あか',   key: 'red',    css: '#E74C3C' },
    { name: 'あお',   key: 'blue',   css: '#3498DB' },
    { name: 'みどり', key: 'green',  css: '#2ECC71' },
    { name: 'きいろ', key: 'yellow', css: '#D4AC0D' }
  ];

  // ============================================
  // 状態変数
  // ============================================
  var score = 0;
  var bestScore = parseInt(localStorage.getItem('bestColorMatch') || '0', 10);
  var correctCount = 0;
  var wrongCount = 0;
  var timeRemaining = GAME_DURATION;  // 残り時間（秒、小数）
  var gameRunning = false;
  var gameOverFlag = false;
  var timerInterval = null;
  var currentTextColor = null;        // 現在表示中の文字の「意味」（colorオブジェクト）
  var currentDisplayColor = null;     // 現在の「表示色」（colorオブジェクト）
  var feedbackTimer = null;
  var inputLocked = false;            // 連打防止

  // ============================================
  // DOM要素
  // ============================================
  var scoreEl = document.getElementById('score');
  var bestScoreEl = document.getElementById('best-score');
  var timerEl = document.getElementById('timer');
  var timerBarEl = document.getElementById('timer-bar');
  var colorWordEl = document.getElementById('color-word');
  var feedbackEl = document.getElementById('feedback');
  var colorButtonsEl = document.getElementById('color-buttons');
  var gameStartOverlay = document.getElementById('game-start-overlay');
  var gameOverOverlay = document.getElementById('game-over-overlay');
  var finalScoreEl = document.getElementById('final-score');
  var finalCorrectEl = document.getElementById('final-correct');
  var finalWrongEl = document.getElementById('final-wrong');
  var bestResultEl = document.getElementById('best-result');

  // 色ボタンを取得
  var colorBtns = colorButtonsEl.querySelectorAll('.color-btn');

  // ============================================
  // ユーティリティ
  // ============================================

  // 配列からランダムな要素を返す（除外要素指定可能）
  function randomFrom(arr, exclude) {
    var filtered = exclude ? arr.filter(function (item) {
      return item.key !== exclude.key;
    }) : arr;
    return filtered[Math.floor(Math.random() * filtered.length)];
  }

  // ============================================
  // スコア更新
  // ============================================
  function updateScore() {
    scoreEl.textContent = score;
    if (score > bestScore) {
      bestScore = score;
      localStorage.setItem('bestColorMatch', bestScore.toString());
    }
    bestScoreEl.textContent = bestScore;
  }

  // ============================================
  // タイマー表示更新
  // ============================================
  function updateTimerDisplay() {
    var seconds = Math.ceil(timeRemaining);
    timerEl.textContent = seconds;

    // タイマーバーの幅を更新
    var percent = (timeRemaining / GAME_DURATION) * 100;
    timerBarEl.style.width = percent + '%';

    // 警告・危険状態のクラス管理
    timerBarEl.classList.remove('warning', 'danger');
    timerEl.classList.remove('warning', 'danger');

    if (timeRemaining <= DANGER_TIME) {
      timerBarEl.classList.add('danger');
      timerEl.classList.add('danger');
    } else if (timeRemaining <= WARNING_TIME) {
      timerBarEl.classList.add('warning');
      timerEl.classList.add('warning');
    }
  }

  // ============================================
  // 新しい問題を生成
  // ============================================
  function generateQuestion() {
    // テキストの意味（色名）をランダムに選択
    currentTextColor = randomFrom(COLORS);

    // 表示色はテキストの意味と異なる色を選択（ストループ効果）
    currentDisplayColor = randomFrom(COLORS, currentTextColor);

    // 色ワードを更新
    colorWordEl.textContent = currentTextColor.name;
    colorWordEl.style.color = currentDisplayColor.css;

    // ポップアニメーション
    colorWordEl.classList.remove('pop');
    // reflow を強制してアニメーションをリセット
    void colorWordEl.offsetWidth;
    colorWordEl.classList.add('pop');
  }

  // ============================================
  // フィードバック表示
  // ============================================
  function showFeedback(isCorrect) {
    // 前のタイマーをクリア
    if (feedbackTimer) {
      clearTimeout(feedbackTimer);
    }

    feedbackEl.textContent = isCorrect ? '+10' : '-5';
    feedbackEl.className = 'feedback show ' + (isCorrect ? 'correct' : 'wrong');

    feedbackTimer = setTimeout(function () {
      feedbackEl.classList.remove('show');
      feedbackTimer = null;
    }, FEEDBACK_DURATION);
  }

  // ============================================
  // ボタンフラッシュアニメーション
  // ============================================
  function flashButton(btn, isCorrect) {
    var cls = isCorrect ? 'flash-correct' : 'flash-wrong';
    btn.classList.remove('flash-correct', 'flash-wrong');
    void btn.offsetWidth;
    btn.classList.add(cls);

    setTimeout(function () {
      btn.classList.remove(cls);
    }, 300);
  }

  // ============================================
  // 回答処理
  // ============================================
  function handleAnswer(selectedColorKey, btn) {
    if (!gameRunning || inputLocked) return;

    // 連打防止
    inputLocked = true;

    var isCorrect = (selectedColorKey === currentTextColor.key);

    if (isCorrect) {
      score += CORRECT_POINTS;
      correctCount++;
    } else {
      score += WRONG_POINTS;
      if (score < 0) score = 0;
      wrongCount++;
    }

    updateScore();
    showFeedback(isCorrect);
    flashButton(btn, isCorrect);

    // 次の問題を生成
    generateQuestion();

    // 短い遅延後にロック解除（連打防止）
    setTimeout(function () {
      inputLocked = false;
    }, 150);
  }

  // ============================================
  // ボタンの有効/無効切り替え
  // ============================================
  function setButtonsEnabled(enabled) {
    for (var i = 0; i < colorBtns.length; i++) {
      colorBtns[i].disabled = !enabled;
    }
  }

  // ============================================
  // ゲームタイマー
  // ============================================
  function startTimer() {
    var lastTime = Date.now();

    timerInterval = setInterval(function () {
      var now = Date.now();
      var delta = (now - lastTime) / 1000;
      lastTime = now;

      timeRemaining -= delta;

      if (timeRemaining <= 0) {
        timeRemaining = 0;
        updateTimerDisplay();
        gameOver();
        return;
      }

      updateTimerDisplay();
    }, TIMER_INTERVAL);
  }

  // ============================================
  // ゲームオーバー処理
  // ============================================
  function gameOver() {
    gameRunning = false;
    gameOverFlag = true;

    // タイマー停止
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }

    // ボタン無効化
    setButtonsEnabled(false);

    // 結果表示
    finalScoreEl.textContent = score;
    finalCorrectEl.textContent = correctCount;
    finalWrongEl.textContent = wrongCount;

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
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    if (feedbackTimer) {
      clearTimeout(feedbackTimer);
      feedbackTimer = null;
    }

    // 状態をリセット
    score = 0;
    correctCount = 0;
    wrongCount = 0;
    timeRemaining = GAME_DURATION;
    gameOverFlag = false;
    inputLocked = false;

    updateScore();
    updateTimerDisplay();

    // フィードバックをリセット
    feedbackEl.className = 'feedback';
    feedbackEl.textContent = '';

    // オーバーレイを非表示
    gameStartOverlay.classList.remove('active');
    gameOverOverlay.classList.remove('active');

    // 最初の問題を生成
    generateQuestion();

    // ボタン有効化
    setButtonsEnabled(true);

    // ゲーム開始
    gameRunning = true;
    startTimer();
  }

  // ============================================
  // イベントリスナー - 色ボタン
  // ============================================
  for (var i = 0; i < colorBtns.length; i++) {
    (function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        var colorKey = btn.getAttribute('data-color');
        handleAnswer(colorKey, btn);
      });
    })(colorBtns[i]);
  }

  // ============================================
  // イベントリスナー - キーボード操作
  // ============================================
  document.addEventListener('keydown', function (e) {
    if (!gameRunning) return;

    // 1-4キーで色を選択
    var keyMap = {
      '1': 0, '2': 1, '3': 2, '4': 3
    };

    var index = keyMap[e.key];
    if (index !== undefined && colorBtns[index]) {
      e.preventDefault();
      var btn = colorBtns[index];
      var colorKey = btn.getAttribute('data-color');
      handleAnswer(colorKey, btn);
    }
  });

  // ============================================
  // イベントリスナー - ボタン
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
  // ページ離脱時にタイマーを一時停止
  // ============================================
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && gameRunning) {
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
      gameRunning = false;
      gameOverFlag = true;
      setButtonsEnabled(false);

      // ゲーム中断としてゲームオーバー扱い
      finalScoreEl.textContent = score;
      finalCorrectEl.textContent = correctCount;
      finalWrongEl.textContent = wrongCount;

      if (score >= bestScore && score > 0) {
        bestResultEl.textContent = 'ハイスコア更新！';
      } else {
        bestResultEl.textContent = 'ベスト: ' + bestScore;
      }

      gameOverOverlay.querySelector('h2').textContent = 'タイムアップ！';
      gameOverOverlay.classList.add('active');
    }
  });

  // ============================================
  // 初期化
  // ============================================
  bestScoreEl.textContent = bestScore;
  setButtonsEnabled(false);

  // 初期表示用に問題を生成（プレビュー）
  generateQuestion();
})();
