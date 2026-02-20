// ============================================
// リズムゲーム ゲームロジック
// ============================================

(function () {
  'use strict';

  // ============================================
  // 定数
  // ============================================
  var LANE_COUNT = 4;
  var JUDGE_Y_RATIO = 0.82;
  var NOTE_SPEED = 3;
  var PERFECT_RANGE = 20;
  var GREAT_RANGE = 40;
  var GOOD_RANGE = 65;
  var MISS_RANGE = 90;

  var SCORE_PERFECT = 300;
  var SCORE_GREAT = 200;
  var SCORE_GOOD = 100;

  var LANE_COLORS = ['#E74C3C', '#3498DB', '#2ECC71', '#F1C40F'];
  var LANE_KEYS = ['KeyD', 'KeyF', 'KeyJ', 'KeyK'];

  // BPMと譜面
  var BPM = 130;
  var BEAT_MS = 60000 / BPM;

  // ============================================
  // 状態変数
  // ============================================
  var canvas, ctx, W, H, dpr;
  var running = false;
  var score = 0;
  var bestScore = 0;
  var combo = 0;
  var maxCombo = 0;
  var notes = [];
  var effects = [];
  var judgeTexts = [];
  var startTime = 0;
  var songDuration = 0;
  var noteIndex = 0;
  var chart = [];
  var animId = null;
  var laneFlash = [0, 0, 0, 0];
  var counts = { perfect: 0, great: 0, good: 0, miss: 0 };

  // ============================================
  // DOM参照
  // ============================================
  var elScore = document.getElementById('score');
  var elBest = document.getElementById('best-score');
  var elCombo = document.getElementById('combo');
  var elJudge = document.getElementById('judge');
  var elFinal = document.getElementById('final-score');
  var elBestResult = document.getElementById('best-result');
  var elResultDetail = document.getElementById('result-detail');
  var elStartOverlay = document.getElementById('game-start-overlay');
  var elOverOverlay = document.getElementById('game-over-overlay');
  var elBtnStart = document.getElementById('btn-start');
  var elBtnRetry = document.getElementById('btn-retry');
  var elBtnNew = document.getElementById('btn-new-game');

  // ============================================
  // 譜面生成（自動生成）
  // ============================================
  function generateChart() {
    chart = [];
    var totalBeats = 128;
    songDuration = totalBeats * BEAT_MS + 3000;

    // パターンベースで譜面を生成
    var patterns = [
      // 基本パターン
      [[0], [], [2], []],
      [[1], [], [3], []],
      [[0], [1], [2], [3]],
      [[], [1], [], [3]],
      [[0], [], [], [2]],
      // 同時押し
      [[0, 2], [], [1, 3], []],
      [[0, 1], [], [2, 3], []],
      // 階段
      [[0], [1], [2], [3]],
      [[3], [2], [1], [0]],
      // 連打
      [[0], [0], [2], [2]],
      [[1], [1], [3], [3]],
      // 休符入り
      [[], [1], [], [2]],
      [[3], [], [0], []],
    ];

    var beat = 0;
    // イントロ（4拍休み）
    beat = 4;

    while (beat < totalBeats - 4) {
      var difficulty = Math.min(beat / totalBeats, 1);
      var pat;

      // 難易度に応じてパターン選択
      if (difficulty < 0.3) {
        pat = patterns[Math.floor(Math.random() * 5)];
      } else if (difficulty < 0.6) {
        pat = patterns[Math.floor(Math.random() * 9)];
      } else {
        pat = patterns[Math.floor(Math.random() * patterns.length)];
      }

      for (var i = 0; i < pat.length; i++) {
        var lanes = pat[i];
        if (lanes.length > 0) {
          for (var j = 0; j < lanes.length; j++) {
            chart.push({
              time: beat * BEAT_MS,
              lane: lanes[j]
            });
          }
        }
        beat += 1;
      }
    }

    // 時間順にソート
    chart.sort(function (a, b) { return a.time - b.time; });
  }

  // ============================================
  // ハイスコア
  // ============================================
  function loadBest() {
    var v = localStorage.getItem('bestRhythm');
    bestScore = v ? parseInt(v, 10) : 0;
    elBest.textContent = bestScore;
  }

  function saveBest() {
    if (score > bestScore) {
      bestScore = score;
      localStorage.setItem('bestRhythm', bestScore);
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
  }

  // ============================================
  // 判定
  // ============================================
  function hitLane(lane) {
    if (!running) return;

    laneFlash[lane] = 1;
    var judgeY = H * JUDGE_Y_RATIO;
    var now = performance.now() - startTime;

    // 最も近いノーツを探す
    var closest = null;
    var closestDist = Infinity;
    for (var i = 0; i < notes.length; i++) {
      var n = notes[i];
      if (n.lane !== lane || n.hit) continue;
      var dist = Math.abs(n.y - judgeY);
      if (dist < closestDist) {
        closestDist = dist;
        closest = n;
      }
    }

    if (!closest) return;

    var dist = closestDist;
    var judgeText = '';
    var judgeColor = '';
    var points = 0;

    if (dist <= PERFECT_RANGE) {
      judgeText = 'PERFECT';
      judgeColor = '#F1C40F';
      points = SCORE_PERFECT;
      counts.perfect++;
    } else if (dist <= GREAT_RANGE) {
      judgeText = 'GREAT';
      judgeColor = '#2ECC71';
      points = SCORE_GREAT;
      counts.great++;
    } else if (dist <= GOOD_RANGE) {
      judgeText = 'GOOD';
      judgeColor = '#3498DB';
      points = SCORE_GOOD;
      counts.good++;
    } else if (dist <= MISS_RANGE) {
      judgeText = 'MISS';
      judgeColor = '#E74C3C';
      points = 0;
      combo = 0;
      counts.miss++;
    } else {
      return;
    }

    if (points > 0) {
      combo++;
      if (combo > maxCombo) maxCombo = combo;
      // コンボボーナス
      points += Math.floor(combo * 5);
    }

    score += points;
    elScore.textContent = score;
    elCombo.textContent = combo;
    elJudge.textContent = judgeText;
    elJudge.style.color = judgeColor;

    closest.hit = true;

    // エフェクト
    var lw = W / LANE_COUNT;
    var nx = lane * lw + lw / 2;
    spawnHitEffect(nx, judgeY, judgeColor);

    // 判定テキスト表示
    judgeTexts.push({
      text: judgeText,
      color: judgeColor,
      x: W / 2,
      y: judgeY - 30,
      life: 1
    });
  }

  // ============================================
  // エフェクト
  // ============================================
  function spawnHitEffect(x, y, color) {
    for (var i = 0; i < 8; i++) {
      var angle = (Math.PI * 2 / 8) * i;
      effects.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * 3,
        vy: Math.sin(angle) * 3,
        life: 1,
        color: color,
        r: 3
      });
    }
  }

  // ============================================
  // 描画
  // ============================================
  function draw() {
    ctx.clearRect(0, 0, W, H);

    var lw = W / LANE_COUNT;
    var judgeY = H * JUDGE_Y_RATIO;

    // 背景
    var grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#0d001a');
    grad.addColorStop(1, '#1a0a2e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // レーン線
    for (var i = 1; i < LANE_COUNT; i++) {
      ctx.beginPath();
      ctx.moveTo(i * lw, 0);
      ctx.lineTo(i * lw, H);
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // 判定ライン
    ctx.beginPath();
    ctx.moveTo(0, judgeY);
    ctx.lineTo(W, judgeY);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 判定ラインのグロー
    ctx.beginPath();
    ctx.moveTo(0, judgeY);
    ctx.lineTo(W, judgeY);
    ctx.strokeStyle = 'rgba(187,134,252,0.3)';
    ctx.lineWidth = 6;
    ctx.stroke();

    // レーンフラッシュ
    for (var i = 0; i < LANE_COUNT; i++) {
      if (laneFlash[i] > 0) {
        ctx.fillStyle = 'rgba(' + hexToRgb(LANE_COLORS[i]) + ',' + (laneFlash[i] * 0.15) + ')';
        ctx.fillRect(i * lw, 0, lw, H);
        laneFlash[i] *= 0.88;
        if (laneFlash[i] < 0.01) laneFlash[i] = 0;
      }
    }

    // ノーツ描画
    var noteH = 14;
    var noteW = lw * 0.7;
    for (var i = 0; i < notes.length; i++) {
      var n = notes[i];
      if (n.hit) continue;
      if (n.y < -noteH || n.y > H + noteH) continue;

      var nx = n.lane * lw + lw / 2;
      ctx.save();

      // ノーツの影
      ctx.beginPath();
      ctx.roundRect(nx - noteW / 2 + 2, n.y - noteH / 2 + 2, noteW, noteH, 4);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fill();

      // ノーツ本体
      ctx.beginPath();
      ctx.roundRect(nx - noteW / 2, n.y - noteH / 2, noteW, noteH, 4);
      var nGrad = ctx.createLinearGradient(0, n.y - noteH / 2, 0, n.y + noteH / 2);
      var c = LANE_COLORS[n.lane];
      nGrad.addColorStop(0, lighten(c, 30));
      nGrad.addColorStop(1, c);
      ctx.fillStyle = nGrad;
      ctx.fill();

      // ハイライト
      ctx.beginPath();
      ctx.roundRect(nx - noteW / 2 + 2, n.y - noteH / 2 + 1, noteW - 4, noteH / 3, 2);
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fill();

      ctx.restore();
    }

    // エフェクト
    for (var i = effects.length - 1; i >= 0; i--) {
      var e = effects[i];
      e.x += e.vx;
      e.y += e.vy;
      e.life -= 0.04;
      if (e.life <= 0) {
        effects.splice(i, 1);
        continue;
      }
      ctx.globalAlpha = e.life;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r * e.life, 0, Math.PI * 2);
      ctx.fillStyle = e.color;
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 判定テキスト
    ctx.textAlign = 'center';
    for (var i = judgeTexts.length - 1; i >= 0; i--) {
      var jt = judgeTexts[i];
      jt.y -= 1;
      jt.life -= 0.025;
      if (jt.life <= 0) {
        judgeTexts.splice(i, 1);
        continue;
      }
      ctx.globalAlpha = jt.life;
      ctx.font = 'bold 18px sans-serif';
      ctx.fillStyle = jt.color;
      ctx.fillText(jt.text, jt.x, jt.y);

      // コンボ表示
      if (combo > 1) {
        ctx.font = 'bold 14px sans-serif';
        ctx.fillStyle = '#fff';
        ctx.fillText(combo + ' COMBO', jt.x, jt.y + 20);
      }
    }
    ctx.globalAlpha = 1;

    // プログレスバー
    if (running) {
      var elapsed = performance.now() - startTime;
      var progress = Math.min(elapsed / songDuration, 1);
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(0, 0, W, 3);
      ctx.fillStyle = '#bb86fc';
      ctx.fillRect(0, 0, W * progress, 3);
    }

    // ビートパルス（BPMに合わせて背景が脈動）
    if (running) {
      var elapsed = performance.now() - startTime;
      var beatPhase = (elapsed % BEAT_MS) / BEAT_MS;
      var pulse = Math.max(0, 1 - beatPhase * 3);
      if (pulse > 0) {
        ctx.fillStyle = 'rgba(187,134,252,' + (pulse * 0.05) + ')';
        ctx.fillRect(0, 0, W, H);
      }
    }
  }

  // ============================================
  // ユーティリティ
  // ============================================
  function hexToRgb(hex) {
    var r = parseInt(hex.slice(1, 3), 16);
    var g = parseInt(hex.slice(3, 5), 16);
    var b = parseInt(hex.slice(5, 7), 16);
    return r + ',' + g + ',' + b;
  }

  function lighten(hex, amount) {
    var r = Math.min(255, parseInt(hex.slice(1, 3), 16) + amount);
    var g = Math.min(255, parseInt(hex.slice(3, 5), 16) + amount);
    var b = Math.min(255, parseInt(hex.slice(5, 7), 16) + amount);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  // ============================================
  // ゲームループ
  // ============================================
  function update() {
    var now = performance.now() - startTime;
    var judgeY = H * JUDGE_Y_RATIO;

    // 新しいノーツを画面に出す
    while (noteIndex < chart.length) {
      var c = chart[noteIndex];
      var travelTime = judgeY / NOTE_SPEED / 60 * 1000;
      if (c.time - travelTime > now) break;

      notes.push({
        lane: c.lane,
        targetTime: c.time,
        y: -20,
        hit: false
      });
      noteIndex++;
    }

    // ノーツ移動
    for (var i = notes.length - 1; i >= 0; i--) {
      var n = notes[i];
      if (n.hit) {
        notes.splice(i, 1);
        continue;
      }
      var timeDiff = now - n.targetTime;
      n.y = judgeY + timeDiff * NOTE_SPEED * 60 / 1000;

      // ミス判定（判定ラインを大きく超えた）
      if (n.y > judgeY + MISS_RANGE) {
        counts.miss++;
        combo = 0;
        elCombo.textContent = combo;
        elJudge.textContent = 'MISS';
        elJudge.style.color = '#E74C3C';
        judgeTexts.push({
          text: 'MISS',
          color: '#E74C3C',
          x: W / 2,
          y: judgeY - 30,
          life: 1
        });
        notes.splice(i, 1);
      }
    }

    // 曲終了チェック
    if (now > songDuration && notes.length === 0) {
      gameOver();
    }
  }

  function gameLoop() {
    if (!running) return;
    update();
    draw();
    animId = requestAnimationFrame(gameLoop);
  }

  // ============================================
  // ゲーム制御
  // ============================================
  function startGame() {
    initCanvas();
    score = 0;
    combo = 0;
    maxCombo = 0;
    noteIndex = 0;
    notes = [];
    effects = [];
    judgeTexts = [];
    laneFlash = [0, 0, 0, 0];
    counts = { perfect: 0, great: 0, good: 0, miss: 0 };
    elScore.textContent = '0';
    elCombo.textContent = '0';
    elJudge.textContent = '-';
    elJudge.style.color = '#fff';

    generateChart();
    startTime = performance.now();
    running = true;
    elStartOverlay.classList.remove('active');
    elOverOverlay.classList.remove('active');
    if (animId) cancelAnimationFrame(animId);
    gameLoop();
  }

  function gameOver() {
    running = false;
    saveBest();
    elFinal.textContent = score;
    elResultDetail.innerHTML =
      'PERFECT: ' + counts.perfect + '<br>' +
      'GREAT: ' + counts.great + '<br>' +
      'GOOD: ' + counts.good + '<br>' +
      'MISS: ' + counts.miss + '<br>' +
      'MAX COMBO: ' + maxCombo;

    if (score >= bestScore && score > 0) {
      elBestResult.textContent = '🎉 ハイスコア更新！';
    } else {
      elBestResult.textContent = 'ベスト: ' + bestScore;
    }
    elOverOverlay.classList.add('active');
  }

  // ============================================
  // イベント
  // ============================================
  document.addEventListener('keydown', function (e) {
    var idx = LANE_KEYS.indexOf(e.code);
    if (idx !== -1) {
      e.preventDefault();
      hitLane(idx);
    }
  });

  // レーンボタン
  var laneBtns = document.querySelectorAll('.lane-btn');
  for (var i = 0; i < laneBtns.length; i++) {
    (function (btn) {
      var lane = parseInt(btn.getAttribute('data-lane'), 10);
      btn.addEventListener('touchstart', function (e) {
        e.preventDefault();
        btn.classList.add('pressed');
        hitLane(lane);
      });
      btn.addEventListener('touchend', function (e) {
        e.preventDefault();
        btn.classList.remove('pressed');
      });
      btn.addEventListener('mousedown', function (e) {
        e.preventDefault();
        btn.classList.add('pressed');
        hitLane(lane);
      });
      btn.addEventListener('mouseup', function () {
        btn.classList.remove('pressed');
      });
      btn.addEventListener('mouseleave', function () {
        btn.classList.remove('pressed');
      });
    })(laneBtns[i]);
  }

  // リサイズ
  window.addEventListener('resize', function () {
    initCanvas();
  });

  // ボタン
  elBtnStart.addEventListener('click', startGame);
  elBtnRetry.addEventListener('click', startGame);
  elBtnNew.addEventListener('click', startGame);

  // 初期化
  loadBest();
  initCanvas();

  // 初期描画
  (function () {
    var grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#0d001a');
    grad.addColorStop(1, '#1a0a2e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  })();

})();
