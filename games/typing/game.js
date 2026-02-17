// ============================================
// タイピングゲーム ロジック
// ============================================

(function () {
  'use strict';

  // ワードリスト（難易度別）
  var WORDS = {
    easy: [
      'cat', 'dog', 'sun', 'run', 'code', 'html', 'css', 'web',
      'app', 'fun', 'box', 'map', 'key', 'log', 'red', 'blue',
      'big', 'top', 'set', 'get', 'new', 'old', 'add', 'end',
      'bug', 'fix', 'tag', 'div', 'yes', 'net'
    ],
    normal: [
      'function', 'variable', 'array', 'loop', 'string', 'boolean',
      'javascript', 'python', 'object', 'class', 'method', 'return',
      'console', 'element', 'button', 'input', 'number', 'style',
      'event', 'click', 'value', 'index', 'length', 'const',
      'import', 'export', 'promise', 'async', 'render', 'server'
    ],
    hard: [
      'hello world', 'for loop', 'if else', 'game over', 'web browser',
      'open source', 'data type', 'text file', 'source code', 'dark mode',
      'high score', 'bug report', 'code review', 'pull request', 'try catch',
      'dom element', 'event handler', 'arrow function', 'type script', 'next level'
    ]
  };

  // ゲーム設定
  var GAME_DURATION = 60; // 秒

  // ゲーム状態
  var difficulty = 'easy';
  var isPlaying = false;
  var timeRemaining = GAME_DURATION;
  var timerInterval = null;
  var currentWord = '';
  var wordsCompleted = 0;
  var totalCharsTyped = 0;
  var correctCharsTyped = 0;
  var wordList = [];
  var wordIndex = 0;

  // DOM要素
  var wordDisplay = document.getElementById('word-display');
  var typingInput = document.getElementById('typing-input');
  var scoreEl = document.getElementById('score');
  var timerEl = document.getElementById('timer');
  var accuracyEl = document.getElementById('accuracy');
  var bestScoreEl = document.getElementById('best-score');
  var btnStart = document.getElementById('btn-start');
  var btnRestart = document.getElementById('btn-restart');
  var resultOverlay = document.getElementById('result-overlay');
  var resultScore = document.getElementById('result-score');
  var resultAccuracy = document.getElementById('result-accuracy');
  var resultWpm = document.getElementById('result-wpm');
  var resultWords = document.getElementById('result-words');
  var resultChars = document.getElementById('result-chars');
  var resultStars = document.getElementById('result-stars');
  var resultBest = document.getElementById('result-best');
  var difficultyBtns = document.querySelectorAll('.difficulty-btn');

  // localStorage キー
  function bestScoreKey() {
    return 'typingBest_' + difficulty;
  }

  // ベストスコアを取得
  function getBestScore() {
    return parseInt(localStorage.getItem(bestScoreKey()) || '0', 10);
  }

  // ベストスコアを保存
  function setBestScore(score) {
    localStorage.setItem(bestScoreKey(), score.toString());
  }

  // ワードリストをシャッフル（Fisher-Yates）
  function shuffleArray(arr) {
    var shuffled = arr.slice();
    for (var i = shuffled.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var temp = shuffled[i];
      shuffled[i] = shuffled[j];
      shuffled[j] = temp;
    }
    return shuffled;
  }

  // ワードリストを準備（シャッフルして繰り返す）
  function prepareWordList() {
    wordList = shuffleArray(WORDS[difficulty]);
    wordIndex = 0;
  }

  // 次のワードを取得
  function getNextWord() {
    if (wordIndex >= wordList.length) {
      // リストを使い切ったら再シャッフル
      wordList = shuffleArray(WORDS[difficulty]);
      wordIndex = 0;
    }
    return wordList[wordIndex++];
  }

  // ワード表示を更新（文字ごとのハイライト付き）
  function updateWordDisplay(inputText) {
    var html = '';
    for (var i = 0; i < currentWord.length; i++) {
      var char = currentWord[i];
      // スペースは表示用に変換
      var displayChar = char === ' ' ? '&nbsp;' : escapeHtml(char);

      if (i < inputText.length) {
        if (inputText[i] === char) {
          html += '<span class="char-correct">' + displayChar + '</span>';
        } else {
          html += '<span class="char-wrong">' + displayChar + '</span>';
        }
      } else if (i === inputText.length) {
        // カーソル位置
        html += '<span class="char-cursor char-remaining">' + displayChar + '</span>';
      } else {
        html += '<span class="char-remaining">' + displayChar + '</span>';
      }
    }
    wordDisplay.innerHTML = html;
  }

  // HTML特殊文字のエスケープ
  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  // 新しいワードを設定
  function setNewWord() {
    currentWord = getNextWord();
    typingInput.value = '';
    updateWordDisplay('');

    // 完了アニメーション
    wordDisplay.classList.add('word-completed');
    setTimeout(function () {
      wordDisplay.classList.remove('word-completed');
    }, 300);
  }

  // スコア計算（ワード完了数 × 難易度ボーナス）
  function calculateScore() {
    var difficultyMultiplier = { easy: 1, normal: 2, hard: 3 };
    return wordsCompleted * 10 * difficultyMultiplier[difficulty];
  }

  // 正確さの計算
  function calculateAccuracy() {
    if (totalCharsTyped === 0) return 100;
    return Math.round((correctCharsTyped / totalCharsTyped) * 100);
  }

  // WPMの計算（Words Per Minute）
  function calculateWPM() {
    var elapsedSeconds = GAME_DURATION - timeRemaining;
    if (elapsedSeconds === 0) return 0;
    // 標準的なWPM計算: (正しい文字数 / 5) / 経過分
    var elapsedMinutes = elapsedSeconds / 60;
    return Math.round((correctCharsTyped / 5) / elapsedMinutes);
  }

  // 星評価の計算（1〜5）
  function calculateStars() {
    var score = calculateScore();
    var thresholds = {
      easy:   [50, 100, 150, 200],
      normal: [100, 200, 300, 400],
      hard:   [150, 300, 450, 600]
    };
    var t = thresholds[difficulty];
    if (score >= t[3]) return 5;
    if (score >= t[2]) return 4;
    if (score >= t[1]) return 3;
    if (score >= t[0]) return 2;
    return 1;
  }

  // 表示を更新
  function updateDisplay() {
    var score = calculateScore();
    scoreEl.textContent = score;
    timerEl.textContent = timeRemaining;
    accuracyEl.textContent = calculateAccuracy() + '%';
    bestScoreEl.textContent = getBestScore();

    // タイマー警告（残り10秒以下）
    var timerBox = timerEl.parentElement;
    if (isPlaying && timeRemaining <= 10) {
      timerBox.classList.add('timer-warning');
    } else {
      timerBox.classList.remove('timer-warning');
    }
  }

  // 入力フィールドの見た目をリセット
  function resetInputStyle() {
    typingInput.classList.remove('input-correct', 'input-error');
  }

  // タイマー開始
  function startTimer() {
    timerInterval = setInterval(function () {
      timeRemaining--;
      updateDisplay();

      if (timeRemaining <= 0) {
        endGame();
      }
    }, 1000);
  }

  // ゲーム開始
  function startGame() {
    // 状態リセット
    isPlaying = true;
    timeRemaining = GAME_DURATION;
    wordsCompleted = 0;
    totalCharsTyped = 0;
    correctCharsTyped = 0;

    // UI更新
    resultOverlay.classList.remove('active');
    btnStart.textContent = 'プレイ中...';
    btnStart.disabled = true;
    typingInput.disabled = false;
    typingInput.value = '';
    resetInputStyle();

    // 難易度ボタンを無効化
    difficultyBtns.forEach(function (btn) {
      btn.disabled = true;
    });

    // ワードリスト準備
    prepareWordList();
    setNewWord();
    updateDisplay();

    // 入力フィールドにフォーカス
    typingInput.focus();

    // タイマー開始
    startTimer();
  }

  // ゲーム終了
  function endGame() {
    isPlaying = false;
    clearInterval(timerInterval);
    timerInterval = null;

    // 入力無効化
    typingInput.disabled = true;
    resetInputStyle();

    // 難易度ボタンを有効化
    difficultyBtns.forEach(function (btn) {
      btn.disabled = false;
    });

    // スタートボタンを復帰
    btnStart.textContent = 'スタート';
    btnStart.disabled = false;

    // 最終スコア計算
    var finalScore = calculateScore();
    var finalAccuracy = calculateAccuracy();
    var finalWPM = calculateWPM();
    var stars = calculateStars();

    // ベストスコア判定
    var isNewBest = false;
    if (finalScore > getBestScore()) {
      setBestScore(finalScore);
      isNewBest = true;
    }

    // 結果表示の更新
    resultScore.textContent = finalScore;
    resultAccuracy.textContent = finalAccuracy + '%';
    resultWpm.textContent = finalWPM;
    resultWords.textContent = wordsCompleted;
    resultChars.textContent = correctCharsTyped;

    // 星表示
    var starsHtml = '';
    for (var i = 0; i < 5; i++) {
      if (i < stars) {
        starsHtml += '<span class="star-filled">\u2605</span>';
      } else {
        starsHtml += '<span class="star-empty">\u2605</span>';
      }
    }
    resultStars.innerHTML = starsHtml;

    // ベストスコア表示
    if (isNewBest && finalScore > 0) {
      resultBest.style.display = 'block';
    } else {
      resultBest.style.display = 'none';
    }

    // 表示更新
    updateDisplay();

    // 結果オーバーレイ表示
    resultOverlay.classList.add('active');
  }

  // 入力イベント処理
  typingInput.addEventListener('input', function () {
    if (!isPlaying) return;

    var inputText = typingInput.value;

    // 入力文字数カウント（今回の入力分を追加）
    // inputイベントは1文字ずつ発火するので、最後の1文字をカウント
    if (inputText.length > 0) {
      totalCharsTyped++;
      var lastIndex = inputText.length - 1;
      if (lastIndex < currentWord.length && inputText[lastIndex] === currentWord[lastIndex]) {
        correctCharsTyped++;
      }
    }

    // 表示更新
    updateWordDisplay(inputText);
    updateDisplay();

    // 入力フィールドのスタイル
    resetInputStyle();
    var hasError = false;
    for (var i = 0; i < inputText.length; i++) {
      if (i >= currentWord.length || inputText[i] !== currentWord[i]) {
        hasError = true;
        break;
      }
    }
    if (hasError) {
      typingInput.classList.add('input-error');
    } else if (inputText.length > 0) {
      typingInput.classList.add('input-correct');
    }

    // ワード完了判定
    if (inputText === currentWord) {
      wordsCompleted++;
      updateDisplay();
      resetInputStyle();

      // 少し待ってから次のワードへ（完了の実感を与える）
      setTimeout(function () {
        if (isPlaying) {
          setNewWord();
          typingInput.focus();
        }
      }, 100);
    }
  });

  // 入力フィールドでペーストを防止
  typingInput.addEventListener('paste', function (e) {
    e.preventDefault();
  });

  // 難易度選択
  difficultyBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (isPlaying) return; // プレイ中は変更不可

      // アクティブ切り替え
      difficultyBtns.forEach(function (b) {
        b.classList.remove('active');
      });
      btn.classList.add('active');

      difficulty = btn.getAttribute('data-difficulty');

      // ベストスコア表示を更新
      updateDisplay();

      // ワード表示をリセット
      wordDisplay.innerHTML = '<span class="word-placeholder">スタートボタンを押してね！</span>';
      typingInput.value = '';
    });
  });

  // スタートボタン
  btnStart.addEventListener('click', function () {
    if (!isPlaying) {
      startGame();
    }
  });

  // リスタートボタン（結果画面）
  btnRestart.addEventListener('click', function () {
    resultOverlay.classList.remove('active');
    startGame();
  });

  // 結果オーバーレイの外側クリックで閉じる
  resultOverlay.addEventListener('click', function (e) {
    if (e.target === resultOverlay) {
      resultOverlay.classList.remove('active');
    }
  });

  // キーボードショートカット: Enterで開始/再開
  document.addEventListener('keydown', function (e) {
    // Enterキーでスタート（ゲーム中以外、結果画面が表示されていない場合）
    if (e.key === 'Enter' && !isPlaying && !resultOverlay.classList.contains('active')) {
      e.preventDefault();
      startGame();
    }
    // Escapeキーで結果画面を閉じる
    if (e.key === 'Escape' && resultOverlay.classList.contains('active')) {
      resultOverlay.classList.remove('active');
    }
  });

  // 初期表示
  updateDisplay();

})();
