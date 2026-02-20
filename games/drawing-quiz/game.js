// ============================================
// お絵かきクイズ ゲームロジック (AI判定版)
// TensorFlow.js で手書きイラストをリアルタイム判定
// ============================================

(function () {
  'use strict';

  // ============================================
  // 定数
  // ============================================
  var TIME_PER_ROUND = 30;
  var TOTAL_ROUNDS = 5;
  var PREDICT_INTERVAL = 1200; // ms - AI推論の間隔
  var MODEL_PATH = 'model/tfjs/model.json';
  var LABELS_PATH = 'model/tfjs/labels.json';
  var IMG_SIZE = 28; // Quick Draw 入力サイズ

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
  var predictTimer = null;
  var phase = 'idle'; // 'idle' | 'draw' | 'judging' | 'result'
  var usedThemeIndices = [];
  var hasDrawn = false; // ユーザーが何か描いたか

  // 描画ツール
  var drawing = false;
  var penColor = '#000000';
  var penSize = 4;
  var tool = 'pen';
  var lastX = 0, lastY = 0;

  // 描画用別キャンバス
  var drawCanvas, drawCtx;

  // TF.js モデル
  var model = null;
  var labels = []; // [{en, ja}, ...]
  var modelReady = false;

  // ============================================
  // DOM参照
  // ============================================
  var elScore = document.getElementById('score');
  var elBest = document.getElementById('best-score');
  var elTimer = document.getElementById('timer');
  var elThemeText = document.getElementById('theme-text');
  var elRound = document.getElementById('round-display');
  var elFinal = document.getElementById('final-score');
  var elBestResult = document.getElementById('best-result');
  var elStartOverlay = document.getElementById('game-start-overlay');
  var elOverOverlay = document.getElementById('game-over-overlay');
  var elRoundResult = document.getElementById('round-result-overlay');
  var elResultEmoji = document.getElementById('result-emoji');
  var elResultTitle = document.getElementById('result-title');
  var elResultDetail = document.getElementById('result-detail');
  var elResultScore = document.getElementById('result-score-text');
  var elBtnStart = document.getElementById('btn-start');
  var elBtnRetry = document.getElementById('btn-retry');
  var elBtnNew = document.getElementById('btn-new-game');
  var elBtnDone = document.getElementById('btn-done');
  var elDoneArea = document.getElementById('done-button-area');
  var elBtnPen = document.getElementById('btn-pen');
  var elBtnEraser = document.getElementById('btn-eraser');
  var elBtnClearCanvas = document.getElementById('btn-clear-canvas');
  var elModelStatus = document.getElementById('model-status');
  var elAiPanel = document.getElementById('ai-live-panel');
  var elAiGuess = document.getElementById('ai-guess-text');
  var elAiConfFill = document.getElementById('ai-confidence-fill');
  var elAiConfText = document.getElementById('ai-confidence-text');
  var elHudTimer = document.querySelector('.hud-timer');

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
  // モデル読み込み
  // ============================================
  async function loadModel() {
    try {
      elModelStatus.textContent = 'AIモデル読み込み中...';
      elModelStatus.className = 'model-status';

      // ラベル読み込み
      var res = await fetch(LABELS_PATH);
      if (!res.ok) throw new Error('labels.json not found');
      labels = await res.json();

      // TF.js モデル読み込み
      model = await tf.loadLayersModel(MODEL_PATH);
      modelReady = true;

      elModelStatus.textContent = 'AI準備完了！ (' + labels.length + 'カテゴリ認識)';
      elBtnStart.textContent = 'ゲームスタート';
      elBtnStart.disabled = false;

      console.log('Model loaded. Categories:', labels.length);
    } catch (e) {
      console.error('Model load error:', e);
      elModelStatus.textContent = 'モデル読み込みエラー: ' + e.message;
      elModelStatus.className = 'model-status error';
      elBtnStart.textContent = 'モデルが見つかりません';
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
  // Canvas → フラットテンソル変換 (MLP入力: [1, 784])
  // ============================================
  var tmpCanvas = document.createElement('canvas');
  tmpCanvas.width = IMG_SIZE;
  tmpCanvas.height = IMG_SIZE;
  var tmpCtx = tmpCanvas.getContext('2d');

  function canvasToTensor() {
    // 描画キャンバスを 28x28 に縮小
    tmpCtx.fillStyle = '#fff';
    tmpCtx.fillRect(0, 0, IMG_SIZE, IMG_SIZE);
    tmpCtx.drawImage(drawCanvas, 0, 0, drawCanvas.width, drawCanvas.height, 0, 0, IMG_SIZE, IMG_SIZE);

    var imgData = tmpCtx.getImageData(0, 0, IMG_SIZE, IMG_SIZE);
    var pixels = imgData.data;

    // グレースケール化＆反転 (白=0, 黒=1 → Quick Draw形式)
    var input = new Float32Array(IMG_SIZE * IMG_SIZE);
    for (var i = 0; i < IMG_SIZE * IMG_SIZE; i++) {
      var r = pixels[i * 4];
      var g = pixels[i * 4 + 1];
      var b = pixels[i * 4 + 2];
      var gray = (r + g + b) / 3;
      input[i] = (255 - gray) / 255.0;
    }

    // MLP入力: フラットな [1, 784] テンソル
    return tf.tensor2d(input, [1, IMG_SIZE * IMG_SIZE]);
  }

  // ============================================
  // AI推論
  // ============================================
  function predict() {
    if (!modelReady || !model) return null;

    var tensor = canvasToTensor();
    var prediction = model.predict(tensor);
    var probs = prediction.dataSync();
    tensor.dispose();
    prediction.dispose();

    // Top結果を取得
    var results = [];
    for (var i = 0; i < probs.length; i++) {
      results.push({ index: i, prob: probs[i] });
    }
    results.sort(function (a, b) { return b.prob - a.prob; });

    return results;
  }

  // ============================================
  // AIライブ表示更新
  // ============================================
  function updateAiDisplay(results) {
    if (!results || results.length === 0) return;

    var top = results[0];
    var topLabel = labels[top.index];
    var confidence = Math.round(top.prob * 100);

    elAiGuess.textContent = topLabel.ja + '？';

    // 正解中かチェック
    if (currentTheme && topLabel.ja === currentTheme.ja) {
      elAiGuess.classList.add('correct');
    } else {
      elAiGuess.classList.remove('correct');
    }

    // 信頼度バー
    elAiConfFill.style.width = confidence + '%';
    elAiConfFill.className = 'ai-confidence-fill';
    if (confidence >= 60) {
      elAiConfFill.classList.add('high');
    } else if (confidence >= 30) {
      elAiConfFill.classList.add('mid');
    } else {
      elAiConfFill.classList.add('low');
    }

    // Top3表示
    var top3 = results.slice(0, 3).map(function (r) {
      return labels[r.index].ja + ' ' + Math.round(r.prob * 100) + '%';
    });
    elAiConfText.textContent = top3.join(' / ');
  }

  function startPredictLoop() {
    stopPredictLoop();
    predictTimer = setInterval(function () {
      if (phase === 'draw' && hasDrawn) {
        var results = predict();
        updateAiDisplay(results);
      }
    }, PREDICT_INTERVAL);
  }

  function stopPredictLoop() {
    if (predictTimer) {
      clearInterval(predictTimer);
      predictTimer = null;
    }
  }

  // ============================================
  // お題選択
  // ============================================
  function pickTheme() {
    var available = [];
    for (var i = 0; i < labels.length; i++) {
      if (usedThemeIndices.indexOf(i) === -1) {
        available.push(i);
      }
    }
    if (available.length === 0) {
      usedThemeIndices = [];
      available = labels.map(function (_, i) { return i; });
    }
    var idx = available[Math.floor(Math.random() * available.length)];
    usedThemeIndices.push(idx);
    currentTheme = labels[idx];
    currentTheme._index = idx;
  }

  // ============================================
  // 判定＆スコアリング
  // ============================================
  function judgeDrawing() {
    phase = 'judging';
    stopPredictLoop();
    if (timerId) { clearInterval(timerId); timerId = null; }
    elDoneArea.classList.remove('active');

    var results = predict();
    if (!results) {
      showRoundResult(false, 0, 'AI判定エラー', null);
      return;
    }

    // 最終推論表示を更新
    updateAiDisplay(results);

    var top = results[0];
    var topLabel = labels[top.index];
    var confidence = top.prob;

    // 正解判定: Top1 に正解がある or Top3 にある
    var rank = -1;
    for (var i = 0; i < Math.min(results.length, 5); i++) {
      if (results[i].index === currentTheme._index) {
        rank = i;
        break;
      }
    }

    var roundScore = 0;
    var isCorrect = false;
    var message = '';

    if (rank === 0) {
      // Top1正解
      isCorrect = true;
      var baseScore = Math.round(confidence * 200);
      var timeBonus = Math.round(timeLeft * 5);
      roundScore = baseScore + timeBonus;
      message = 'AIの自信度 ' + Math.round(confidence * 100) + '% + 時間ボーナス ' + timeBonus;
    } else if (rank >= 1 && rank <= 2) {
      // Top3に入った（部分点）
      var partialScore = Math.round(results[rank].prob * 80);
      roundScore = partialScore;
      message = 'AIの予想: ' + topLabel.ja + '\nでも' + (rank + 1) + '番目に「' + currentTheme.ja + '」が入ってたよ！';
    } else {
      // 不正解
      message = 'AIは「' + topLabel.ja + '」だと思ったみたい';
    }

    showRoundResult(isCorrect, roundScore, message, rank);
  }

  function showRoundResult(isCorrect, roundScore, message, rank) {
    phase = 'result';
    score += roundScore;
    elScore.textContent = score;

    if (isCorrect) {
      elResultEmoji.textContent = '🎉';
      elResultTitle.textContent = 'AIが正解！';
      elResultTitle.style.color = '#2ECC71';
    } else if (rank !== null && rank >= 1 && rank <= 2) {
      elResultEmoji.textContent = '🤔';
      elResultTitle.textContent = 'おしい！';
      elResultTitle.style.color = '#F1C40F';
    } else {
      elResultEmoji.textContent = '😅';
      elResultTitle.textContent = 'ざんねん…';
      elResultTitle.style.color = '#E74C3C';
    }

    elResultDetail.textContent = message;
    elResultScore.textContent = roundScore > 0 ? '+' + roundScore + 'pt' : '';

    elRoundResult.classList.add('active');

    // 次のラウンドへ自動遷移
    setTimeout(function () {
      elRoundResult.classList.remove('active');
      currentRound++;
      if (currentRound >= TOTAL_ROUNDS) {
        gameOver();
      } else {
        startRound();
      }
    }, 2500);
  }

  // ============================================
  // タイマー
  // ============================================
  function startTimer() {
    timeLeft = TIME_PER_ROUND;
    elTimer.textContent = timeLeft;
    elHudTimer.classList.remove('warning');
    if (timerId) clearInterval(timerId);
    timerId = setInterval(function () {
      timeLeft--;
      elTimer.textContent = timeLeft;
      if (timeLeft <= 5) {
        elHudTimer.classList.add('warning');
      }
      if (timeLeft <= 0) {
        clearInterval(timerId);
        timerId = null;
        judgeDrawing();
      }
    }, 1000);
  }

  // ============================================
  // ゲーム制御
  // ============================================
  function startGame() {
    if (!modelReady) return;
    initCanvas();
    score = 0;
    currentRound = 0;
    usedThemeIndices = [];
    elScore.textContent = '0';
    elStartOverlay.classList.remove('active');
    elOverOverlay.classList.remove('active');
    elRoundResult.classList.remove('active');
    running = true;
    startRound();
  }

  function startRound() {
    phase = 'draw';
    hasDrawn = false;
    pickTheme();
    clearDrawing();
    render();
    elThemeText.textContent = '「' + currentTheme.ja + '」を描こう！';
    elRound.textContent = (currentRound + 1) + '/' + TOTAL_ROUNDS;
    elDoneArea.classList.add('active');
    elAiPanel.classList.add('active');
    elAiGuess.textContent = '描き始めてね';
    elAiGuess.classList.remove('correct');
    elAiConfFill.style.width = '0%';
    elAiConfFill.className = 'ai-confidence-fill';
    elAiConfText.textContent = '';
    startTimer();
    startPredictLoop();
  }

  function gameOver() {
    running = false;
    phase = 'idle';
    stopPredictLoop();
    if (timerId) { clearInterval(timerId); timerId = null; }
    elDoneArea.classList.remove('active');
    elAiPanel.classList.remove('active');
    saveBest();
    elFinal.textContent = score;
    if (score >= bestScore && score > 0) {
      elBestResult.textContent = 'ハイスコア更新！';
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
    hasDrawn = true;
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

  // ============================================
  // 初期化
  // ============================================
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
      hasDrawn = false;
      elAiGuess.textContent = '描き始めてね';
      elAiGuess.classList.remove('correct');
      elAiConfFill.style.width = '0%';
      elAiConfText.textContent = '';
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
      judgeDrawing();
    }
  });

  // できた！ボタン
  elBtnDone.addEventListener('click', function () {
    if (running && phase === 'draw') {
      judgeDrawing();
    }
  });

  // リサイズ
  window.addEventListener('resize', function () {
    if (phase !== 'draw') {
      initCanvas();
      clearDrawing();
      render();
    }
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

  // モデル読み込み開始
  loadModel();

})();
