// ============================================
// お絵かきクイズ ゲームロジック
// ============================================

(function () {
  'use strict';

  // ============================================
  // 定数
  // ============================================
  var TIME_PER_ROUND = 20;
  var TOTAL_ROUNDS = 10;
  var CHOICES_COUNT = 4;

  // お題リスト（カテゴリ付き）
  var THEMES = [
    // 動物
    { word: 'ねこ', category: '動物' },
    { word: 'いぬ', category: '動物' },
    { word: 'うさぎ', category: '動物' },
    { word: 'ぞう', category: '動物' },
    { word: 'きりん', category: '動物' },
    { word: 'さかな', category: '動物' },
    { word: 'とり', category: '動物' },
    { word: 'へび', category: '動物' },
    { word: 'かめ', category: '動物' },
    { word: 'ライオン', category: '動物' },
    { word: 'ペンギン', category: '動物' },
    { word: 'くま', category: '動物' },
    { word: 'カエル', category: '動物' },
    { word: 'ちょうちょ', category: '動物' },
    // 食べ物
    { word: 'りんご', category: '食べ物' },
    { word: 'バナナ', category: '食べ物' },
    { word: 'ケーキ', category: '食べ物' },
    { word: 'ピザ', category: '食べ物' },
    { word: 'おにぎり', category: '食べ物' },
    { word: 'アイス', category: '食べ物' },
    { word: 'ハンバーガー', category: '食べ物' },
    { word: 'すし', category: '食べ物' },
    { word: 'ラーメン', category: '食べ物' },
    { word: 'たまご', category: '食べ物' },
    // 乗り物
    { word: 'くるま', category: '乗り物' },
    { word: 'でんしゃ', category: '乗り物' },
    { word: 'ひこうき', category: '乗り物' },
    { word: 'ふね', category: '乗り物' },
    { word: 'じてんしゃ', category: '乗り物' },
    { word: 'ロケット', category: '乗り物' },
    // もの
    { word: 'いえ', category: 'もの' },
    { word: 'き（木）', category: 'もの' },
    { word: 'はな', category: 'もの' },
    { word: 'たいよう', category: 'もの' },
    { word: 'つき', category: 'もの' },
    { word: 'ほし', category: 'もの' },
    { word: 'かさ', category: 'もの' },
    { word: 'めがね', category: 'もの' },
    { word: 'とけい', category: 'もの' },
    { word: 'テレビ', category: 'もの' },
    { word: 'ほん', category: 'もの' },
    { word: 'くつ', category: 'もの' },
    { word: 'ぼうし', category: 'もの' },
    { word: 'かぎ', category: 'もの' },
    { word: 'にじ', category: 'もの' },
    { word: 'やま', category: 'もの' },
    { word: 'うみ', category: 'もの' },
    { word: 'ゆきだるま', category: 'もの' },
    // 人
    { word: 'おとこのこ', category: '人' },
    { word: 'おんなのこ', category: '人' },
    { word: 'おばけ', category: 'もの' },
    { word: 'ロボット', category: 'もの' },
  ];

  // ============================================
  // 状態変数
  // ============================================
  var canvas, ctx, W, H, dpr;
  var running = false;
  var score = 0;
  var bestScore = 0;
  var currentRound = 0;
  var currentTheme = null;
  var timeLeft = 0;
  var timerId = null;
  var phase = 'draw'; // 'draw' | 'answer' | 'result'
  var usedThemes = [];
  var choices = [];
  var answered = false;

  // 描画ツール
  var drawing = false;
  var penColor = '#000000';
  var penSize = 4;
  var tool = 'pen'; // 'pen' | 'eraser'
  var lastX = 0, lastY = 0;

  // 描画用別キャンバス
  var drawCanvas, drawCtx;

  // ============================================
  // DOM参照
  // ============================================
  var elScore = document.getElementById('score');
  var elBest = document.getElementById('best-score');
  var elTimer = document.getElementById('timer');
  var elThemeText = document.getElementById('theme-text');
  var elFinal = document.getElementById('final-score');
  var elBestResult = document.getElementById('best-result');
  var elStartOverlay = document.getElementById('game-start-overlay');
  var elOverOverlay = document.getElementById('game-over-overlay');
  var elBtnStart = document.getElementById('btn-start');
  var elBtnRetry = document.getElementById('btn-retry');
  var elBtnNew = document.getElementById('btn-new-game');
  var elAnswerButtons = document.getElementById('answer-buttons');
  var elBtnPen = document.getElementById('btn-pen');
  var elBtnEraser = document.getElementById('btn-eraser');
  var elBtnClearCanvas = document.getElementById('btn-clear-canvas');

  // ============================================
  // ハイスコア
  // ============================================
  function loadBest() {
    var v = localStorage.getItem('bestDrawingQuiz');
    bestScore = v ? parseInt(v, 10) : 0;
    elBest.textContent = bestScore;
  }

  function saveBest() {
    if (score > bestScore) {
      bestScore = score;
      localStorage.setItem('bestDrawingQuiz', bestScore);
      elBest.textContent = bestScore;
    }
  }

  // ============================================
  // Canvas初期化
  // ============================================
  function initCanvas() {
    canvas = document.getElementById('game-canvas');
    ctx = canvas.getContext('2d');
    dpr = window.devicePixelRatio || 1;
    var rect = canvas.getBoundingClientRect();
    W = rect.width;
    H = rect.height;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    // 描画用キャンバス
    if (!drawCanvas) {
      drawCanvas = document.createElement('canvas');
      drawCtx = drawCanvas.getContext('2d');
    }
    drawCanvas.width = W * dpr;
    drawCanvas.height = H * dpr;
    drawCtx.scale(dpr, dpr);
  }

  // ============================================
  // 描画
  // ============================================
  function clearDrawing() {
    drawCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawCtx.fillStyle = '#fff';
    drawCtx.fillRect(0, 0, W, H);
  }

  function render() {
    ctx.clearRect(0, 0, W, H);
    // 描画キャンバスを表示
    ctx.drawImage(drawCanvas, 0, 0, W * dpr, H * dpr, 0, 0, W, H);
  }

  function drawLine(x1, y1, x2, y2) {
    drawCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawCtx.beginPath();
    drawCtx.moveTo(x1, y1);
    drawCtx.lineTo(x2, y2);
    drawCtx.strokeStyle = tool === 'eraser' ? '#ffffff' : penColor;
    drawCtx.lineWidth = tool === 'eraser' ? penSize * 3 : penSize;
    drawCtx.lineCap = 'round';
    drawCtx.lineJoin = 'round';
    drawCtx.stroke();
    render();
  }

  // ============================================
  // お題選択
  // ============================================
  function pickTheme() {
    var available = THEMES.filter(function (t) {
      return usedThemes.indexOf(t.word) === -1;
    });
    if (available.length === 0) {
      usedThemes = [];
      available = THEMES.slice();
    }
    var idx = Math.floor(Math.random() * available.length);
    currentTheme = available[idx];
    usedThemes.push(currentTheme.word);
  }

  function generateChoices() {
    choices = [currentTheme.word];
    // 同カテゴリから優先して偽選択肢を選ぶ
    var sameCategory = THEMES.filter(function (t) {
      return t.category === currentTheme.category && t.word !== currentTheme.word;
    });
    var others = THEMES.filter(function (t) {
      return t.category !== currentTheme.category;
    });

    // シャッフル
    shuffle(sameCategory);
    shuffle(others);

    // 同カテゴリから2つ、別カテゴリから1つ
    var pool = sameCategory.slice(0, 2).concat(others.slice(0, 1));
    if (pool.length < CHOICES_COUNT - 1) {
      // 足りない場合は追加
      var more = THEMES.filter(function (t) {
        return t.word !== currentTheme.word && choices.indexOf(t.word) === -1;
      });
      shuffle(more);
      while (pool.length < CHOICES_COUNT - 1 && more.length > 0) {
        pool.push(more.shift());
      }
    }

    for (var i = 0; i < pool.length && choices.length < CHOICES_COUNT; i++) {
      choices.push(pool[i].word);
    }

    shuffle(choices);
  }

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  // ============================================
  // 回答フェーズ
  // ============================================
  function showAnswerPhase() {
    phase = 'answer';
    answered = false;
    if (timerId) clearInterval(timerId);

    generateChoices();
    elAnswerButtons.innerHTML = '';
    for (var i = 0; i < choices.length; i++) {
      var btn = document.createElement('button');
      btn.className = 'answer-btn';
      btn.textContent = choices[i];
      btn.setAttribute('data-word', choices[i]);
      (function (b, word) {
        b.addEventListener('click', function () {
          handleAnswer(word, b);
        });
      })(btn, choices[i]);
      elAnswerButtons.appendChild(btn);
    }
    elAnswerButtons.classList.add('active');
    elThemeText.textContent = '何を描いた？';
  }

  function handleAnswer(word, btn) {
    if (answered) return;
    answered = true;

    var btns = elAnswerButtons.querySelectorAll('.answer-btn');
    if (word === currentTheme.word) {
      btn.classList.add('correct');
      var bonus = Math.floor(timeLeft * 10);
      var roundScore = 100 + bonus;
      score += roundScore;
      elScore.textContent = score;
      elThemeText.textContent = '正解！ +' + roundScore;
    } else {
      btn.classList.add('wrong');
      // 正解を表示
      for (var i = 0; i < btns.length; i++) {
        if (btns[i].getAttribute('data-word') === currentTheme.word) {
          btns[i].classList.add('correct');
        }
      }
      elThemeText.textContent = '残念… 正解は「' + currentTheme.word + '」';
    }

    // 次のラウンドへ
    setTimeout(function () {
      elAnswerButtons.classList.remove('active');
      currentRound++;
      if (currentRound >= TOTAL_ROUNDS) {
        gameOver();
      } else {
        startRound();
      }
    }, 1500);
  }

  // ============================================
  // タイマー
  // ============================================
  function startTimer() {
    timeLeft = TIME_PER_ROUND;
    elTimer.textContent = timeLeft;
    if (timerId) clearInterval(timerId);
    timerId = setInterval(function () {
      timeLeft--;
      elTimer.textContent = timeLeft;
      if (timeLeft <= 0) {
        clearInterval(timerId);
        showAnswerPhase();
      }
    }, 1000);
  }

  // ============================================
  // ゲーム制御
  // ============================================
  function startGame() {
    initCanvas();
    score = 0;
    currentRound = 0;
    usedThemes = [];
    elScore.textContent = '0';
    elStartOverlay.classList.remove('active');
    elOverOverlay.classList.remove('active');
    elAnswerButtons.classList.remove('active');
    running = true;
    startRound();
  }

  function startRound() {
    phase = 'draw';
    pickTheme();
    clearDrawing();
    render();
    elThemeText.textContent = '「' + currentTheme.word + '」を描こう！';
    elAnswerButtons.classList.remove('active');
    startTimer();
  }

  function gameOver() {
    running = false;
    if (timerId) clearInterval(timerId);
    saveBest();
    elFinal.textContent = score;
    if (score >= bestScore && score > 0) {
      elBestResult.textContent = '🎉 ハイスコア更新！';
    } else {
      elBestResult.textContent = 'ベスト: ' + bestScore;
    }
    elOverOverlay.classList.add('active');
  }

  // ============================================
  // イベント - 描画
  // ============================================
  function getCanvasPos(e) {
    var rect = canvas.getBoundingClientRect();
    var clientX, clientY;
    if (e.touches) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }

  function onDrawStart(e) {
    if (!running || phase !== 'draw') return;
    e.preventDefault();
    drawing = true;
    var pos = getCanvasPos(e);
    lastX = pos.x;
    lastY = pos.y;
    drawLine(lastX, lastY, lastX + 0.1, lastY + 0.1);
  }

  function onDrawMove(e) {
    if (!drawing || !running || phase !== 'draw') return;
    e.preventDefault();
    var pos = getCanvasPos(e);
    drawLine(lastX, lastY, pos.x, pos.y);
    lastX = pos.x;
    lastY = pos.y;
  }

  function onDrawEnd(e) {
    if (!drawing) return;
    e.preventDefault();
    drawing = false;
  }

  initCanvas();

  canvas.addEventListener('mousedown', onDrawStart);
  canvas.addEventListener('mousemove', onDrawMove);
  canvas.addEventListener('mouseup', onDrawEnd);
  canvas.addEventListener('mouseleave', onDrawEnd);
  canvas.addEventListener('touchstart', onDrawStart);
  canvas.addEventListener('touchmove', onDrawMove);
  canvas.addEventListener('touchend', onDrawEnd);

  // ツール選択
  elBtnPen.addEventListener('click', function () {
    tool = 'pen';
    elBtnPen.classList.add('selected');
    elBtnEraser.classList.remove('selected');
    canvas.style.cursor = 'crosshair';
  });

  elBtnEraser.addEventListener('click', function () {
    tool = 'eraser';
    elBtnEraser.classList.add('selected');
    elBtnPen.classList.remove('selected');
    canvas.style.cursor = 'cell';
  });

  elBtnClearCanvas.addEventListener('click', function () {
    if (running && phase === 'draw') {
      clearDrawing();
      render();
    }
  });

  // カラーパレット
  var colorBtns = document.querySelectorAll('.color-btn');
  for (var i = 0; i < colorBtns.length; i++) {
    (function (btn) {
      btn.addEventListener('click', function () {
        penColor = btn.getAttribute('data-color');
        for (var j = 0; j < colorBtns.length; j++) {
          colorBtns[j].classList.remove('selected');
        }
        btn.classList.add('selected');
        // ペンに切り替え
        tool = 'pen';
        elBtnPen.classList.add('selected');
        elBtnEraser.classList.remove('selected');
      });
    })(colorBtns[i]);
  }

  // ペンサイズ
  var sizeBtns = document.querySelectorAll('.size-btn');
  for (var i = 0; i < sizeBtns.length; i++) {
    (function (btn) {
      btn.addEventListener('click', function () {
        penSize = parseInt(btn.getAttribute('data-size'), 10);
        for (var j = 0; j < sizeBtns.length; j++) {
          sizeBtns[j].classList.remove('selected');
        }
        btn.classList.add('selected');
      });
    })(sizeBtns[i]);
  }

  // キーボードショートカット
  document.addEventListener('keydown', function (e) {
    if (e.code === 'KeyP') {
      tool = 'pen';
      elBtnPen.classList.add('selected');
      elBtnEraser.classList.remove('selected');
    }
    if (e.code === 'KeyE') {
      tool = 'eraser';
      elBtnEraser.classList.add('selected');
      elBtnPen.classList.remove('selected');
    }
    if (e.code === 'Space' && running && phase === 'draw') {
      e.preventDefault();
      showAnswerPhase();
    }
  });

  // リサイズ
  window.addEventListener('resize', function () {
    initCanvas();
    clearDrawing();
    render();
  });

  // ボタン
  elBtnStart.addEventListener('click', startGame);
  elBtnRetry.addEventListener('click', startGame);
  elBtnNew.addEventListener('click', startGame);

  // 初期化
  loadBest();
  initCanvas();
  clearDrawing();
  render();

})();
