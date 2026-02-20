// ============================================
// 倉庫番 ゲームロジック
// ============================================

(function () {
  'use strict';

  // ============================================
  // 定数
  // ============================================
  // マップタイル
  var EMPTY = 0;
  var WALL = 1;
  var GOAL = 2;
  var BOX = 3;
  var BOX_ON_GOAL = 4;
  var PLAYER = 5;
  var PLAYER_ON_GOAL = 6;

  // 方向
  var DIR = {
    up: { dx: 0, dy: -1 },
    down: { dx: 0, dy: 1 },
    left: { dx: -1, dy: 0 },
    right: { dx: 1, dy: 0 }
  };

  // ============================================
  // ステージデータ（標準的な倉庫番パズル）
  // ============================================
  var LEVELS = [
    // Level 1 (簡単)
    [
      '  ###  ',
      '  #.#  ',
      '  # #  ',
      '###$###',
      '#. @ .#',
      '###$###',
      '  # #  ',
      '  #.#  ',
      '  ###  '
    ],
    // Level 2
    [
      '######',
      '#    #',
      '# #$ #',
      '# $@.#',
      '#  ..#',
      '# $$ #',
      '#    #',
      '######'
    ],
    // Level 3
    [
      '  ####',
      '###  #',
      '#    #',
      '# #. #',
      '# $$ #',
      '#.@.##',
      '#  ##',
      '####'
    ],
    // Level 4
    [
      ' #####',
      '##   #',
      '#  $ #',
      '# $$.#',
      '##.@.#',
      ' ##  #',
      '  ####'
    ],
    // Level 5
    [
      '########',
      '#      #',
      '# .**$ #',
      '# .  $ #',
      '# .  $ #',
      '#   @  #',
      '########'
    ],
    // Level 6
    [
      '  ####',
      '  #  ###',
      '  #$$  #',
      '###  $ #',
      '#. .@###',
      '# .  #',
      '######'
    ],
    // Level 7
    [
      '#######',
      '#  .  #',
      '#  $  #',
      '# .$. #',
      '##$@$##',
      ' # . #',
      ' #   #',
      ' #####'
    ],
    // Level 8
    [
      ' #####',
      '## . ##',
      '# .$.@#',
      '# .$. #',
      '#  $  #',
      '##   ##',
      ' #####'
    ],
    // Level 9
    [
      '  #####',
      '###   #',
      '#  $$ #',
      '# # $.##',
      '# @....#',
      '##$$$  #',
      ' #    ##',
      ' ######'
    ],
    // Level 10
    [
      '   ####',
      '####  #',
      '#  $  #',
      '# $#$ #',
      '#. .@.#',
      '# $#$ #',
      '#  $  #',
      '####  #',
      '   ####'
    ],
    // Level 11
    [
      '########',
      '# .    #',
      '# $$$  #',
      '##.@.###',
      '# $$$  #',
      '# .    #',
      '########'
    ],
    // Level 12
    [
      '  ######',
      '  #    #',
      '### $  #',
      '# . $###',
      '# .$$  #',
      '# .  @ #',
      '########'
    ],
    // Level 13
    [
      '#####  ',
      '#   ###',
      '# $$  #',
      '##. . #',
      ' #$ $@#',
      ' #. .##',
      ' #  ##',
      ' ####'
    ],
    // Level 14
    [
      ' ######',
      '##    #',
      '#  ## #',
      '# $.. #',
      '#  ##$#',
      '## $  #',
      ' # @..#',
      ' # $$ #',
      ' #    #',
      ' ######'
    ],
    // Level 15
    [
      '########',
      '#  ... #',
      '# $$$$ #',
      '## @ ###',
      '# $$$$ #',
      '#  ... #',
      '########'
    ],
    // Level 16
    [
      ' #######',
      ' #     #',
      '## #$# #',
      '#  . . #',
      '# #$#$##',
      '#  . @#',
      '####  #',
      '   ####'
    ],
    // Level 17
    [
      '  #####',
      '### . #',
      '#  $$.#',
      '#  @$ #',
      '### .##',
      '  # $#',
      '  #. #',
      '  ####'
    ],
    // Level 18
    [
      '#######',
      '#  .  #',
      '#  #  #',
      '# $$$ #',
      '##.@.##',
      '# $$$ #',
      '#  #  #',
      '#  .  #',
      '#######'
    ],
    // Level 19
    [
      '   ####',
      '  ##  #',
      ' ## $ #',
      '## $  #',
      '#  $###',
      '#  @ #',
      '#  ###',
      '##...#',
      ' #   #',
      ' #####'
    ],
    // Level 20
    [
      '########',
      '#.  .  #',
      '# $$ $ #',
      '##  @  #',
      '# $$ $ #',
      '#.  .  #',
      '########'
    ]
  ];

  // ============================================
  // 状態変数
  // ============================================
  var canvas, ctx, W, H, dpr;
  var running = false;
  var currentLevel = 0;
  var clearedLevels = 0;
  var moves = 0;
  var map = [];
  var mapW = 0, mapH = 0;
  var playerX = 0, playerY = 0;
  var history = [];
  var cellSize = 0;
  var offsetX = 0, offsetY = 0;
  var animId = null;
  var playerDir = 'down';

  // スワイプ用
  var swipeStartX = 0, swipeStartY = 0;

  // ============================================
  // DOM参照
  // ============================================
  var elScore = document.getElementById('score');
  var elBest = document.getElementById('best-score');
  var elMoves = document.getElementById('moves');
  var elFinal = document.getElementById('final-score');
  var elBestResult = document.getElementById('best-result');
  var elStartOverlay = document.getElementById('game-start-overlay');
  var elOverOverlay = document.getElementById('game-over-overlay');
  var elBtnStart = document.getElementById('btn-start');
  var elBtnRetry = document.getElementById('btn-retry');
  var elBtnNew = document.getElementById('btn-new-game');
  var elBtnUndo = document.getElementById('btn-undo');
  var elBtnRestart = document.getElementById('btn-restart');

  // ============================================
  // セーブ/ロード
  // ============================================
  function loadProgress() {
    var v = localStorage.getItem('bestSokoban');
    clearedLevels = v ? parseInt(v, 10) : 0;
    elBest.textContent = clearedLevels;

    var lv = localStorage.getItem('sokobanLevel');
    currentLevel = lv ? parseInt(lv, 10) : 0;
    if (currentLevel >= LEVELS.length) currentLevel = 0;
  }

  function saveProgress() {
    if (currentLevel + 1 > clearedLevels) {
      clearedLevels = currentLevel + 1;
      localStorage.setItem('bestSokoban', clearedLevels);
      elBest.textContent = clearedLevels;
    }
    localStorage.setItem('sokobanLevel', currentLevel);
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
  // マップ読み込み
  // ============================================
  function loadLevel(idx) {
    var data = LEVELS[idx];
    mapH = data.length;
    mapW = 0;
    for (var i = 0; i < data.length; i++) {
      if (data[i].length > mapW) mapW = data[i].length;
    }

    map = [];
    for (var y = 0; y < mapH; y++) {
      map[y] = [];
      for (var x = 0; x < mapW; x++) {
        var ch = data[y][x] || ' ';
        switch (ch) {
          case '#': map[y][x] = WALL; break;
          case '.': map[y][x] = GOAL; break;
          case '$': map[y][x] = BOX; break;
          case '*': map[y][x] = BOX_ON_GOAL; break;
          case '@': map[y][x] = EMPTY; playerX = x; playerY = y; break;
          case '+': map[y][x] = GOAL; playerX = x; playerY = y; break;
          default: map[y][x] = EMPTY; break;
        }
      }
    }

    // セルサイズ計算
    var margin = 10;
    cellSize = Math.floor(Math.min((W - margin * 2) / mapW, (H - margin * 2) / mapH));
    offsetX = Math.floor((W - mapW * cellSize) / 2);
    offsetY = Math.floor((H - mapH * cellSize) / 2);
  }

  // ============================================
  // 移動
  // ============================================
  function move(dir) {
    if (!running) return;
    var d = DIR[dir];
    if (!d) return;

    playerDir = dir;
    var nx = playerX + d.dx;
    var ny = playerY + d.dy;

    if (nx < 0 || nx >= mapW || ny < 0 || ny >= mapH) return;
    var target = map[ny][nx];

    // 壁チェック
    if (target === WALL) return;

    // 箱の処理
    if (target === BOX || target === BOX_ON_GOAL) {
      var bx = nx + d.dx;
      var by = ny + d.dy;
      if (bx < 0 || bx >= mapW || by < 0 || by >= mapH) return;
      var behind = map[by][bx];
      if (behind === WALL || behind === BOX || behind === BOX_ON_GOAL) return;

      // 履歴保存
      history.push({
        px: playerX, py: playerY,
        bfx: nx, bfy: ny, bft: target,
        btx: bx, bty: by, btt: behind
      });

      // 箱を移動
      map[by][bx] = (behind === GOAL) ? BOX_ON_GOAL : BOX;
      map[ny][nx] = (target === BOX_ON_GOAL) ? GOAL : EMPTY;
    } else {
      // 履歴保存（箱なし）
      history.push({
        px: playerX, py: playerY,
        bfx: -1, bfy: -1, bft: -1,
        btx: -1, bty: -1, btt: -1
      });
    }

    playerX = nx;
    playerY = ny;
    moves++;
    elMoves.textContent = moves;

    draw();
    checkClear();
  }

  function undo() {
    if (!running || history.length === 0) return;
    var h = history.pop();

    // 箱を戻す
    if (h.bfx >= 0) {
      map[h.bfy][h.bfx] = h.bft;
      map[h.bty][h.btx] = h.btt;
    }

    playerX = h.px;
    playerY = h.py;
    moves--;
    elMoves.textContent = moves;
    draw();
  }

  function restartLevel() {
    if (!running) return;
    history = [];
    moves = 0;
    elMoves.textContent = 0;
    loadLevel(currentLevel);
    draw();
  }

  // ============================================
  // クリア判定
  // ============================================
  function checkClear() {
    for (var y = 0; y < mapH; y++) {
      for (var x = 0; x < mapW; x++) {
        if (map[y][x] === BOX) return; // ゴールに乗っていない箱がある
      }
    }
    // クリア！
    running = false;
    saveProgress();
    elFinal.textContent = moves;

    if (currentLevel + 1 >= LEVELS.length) {
      elBestResult.textContent = '全ステージクリア！おめでとう！';
      elBtnRetry.textContent = 'もう一度最初から';
    } else {
      elBestResult.textContent = 'ステージ ' + (currentLevel + 1) + ' クリア！';
      elBtnRetry.textContent = '次のステージへ';
    }
    elOverOverlay.classList.add('active');
  }

  // ============================================
  // 描画
  // ============================================
  function draw() {
    ctx.clearRect(0, 0, W, H);

    // 背景
    ctx.fillStyle = '#2b1810';
    ctx.fillRect(0, 0, W, H);

    var cs = cellSize;

    for (var y = 0; y < mapH; y++) {
      for (var x = 0; x < mapW; x++) {
        var px = offsetX + x * cs;
        var py = offsetY + y * cs;
        var tile = map[y][x];

        // 床
        if (tile !== WALL) {
          ctx.fillStyle = '#4a3728';
          ctx.fillRect(px, py, cs, cs);
          // 床の模様
          ctx.strokeStyle = 'rgba(255,255,255,0.05)';
          ctx.strokeRect(px, py, cs, cs);
        }

        switch (tile) {
          case WALL:
            drawWall(px, py, cs);
            break;
          case GOAL:
            drawGoal(px, py, cs);
            break;
          case BOX:
            drawBox(px, py, cs, false);
            break;
          case BOX_ON_GOAL:
            drawGoal(px, py, cs);
            drawBox(px, py, cs, true);
            break;
        }
      }
    }

    // プレイヤー描画
    drawPlayer(offsetX + playerX * cs, offsetY + playerY * cs, cs);
  }

  function drawWall(x, y, s) {
    ctx.fillStyle = '#6b4226';
    ctx.fillRect(x, y, s, s);
    // レンガ模様
    ctx.strokeStyle = '#5a3520';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, s, s);
    ctx.beginPath();
    ctx.moveTo(x, y + s / 2);
    ctx.lineTo(x + s, y + s / 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + s / 2, y);
    ctx.lineTo(x + s / 2, y + s / 2);
    ctx.stroke();
    // ハイライト
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(x, y, s, 2);
    ctx.fillRect(x, y, 2, s);
  }

  function drawGoal(x, y, s) {
    var cx = x + s / 2;
    var cy = y + s / 2;
    var r = s * 0.2;
    ctx.strokeStyle = '#c4a45a';
    ctx.lineWidth = 2;
    // ×印
    ctx.beginPath();
    ctx.moveTo(cx - r, cy - r);
    ctx.lineTo(cx + r, cy + r);
    ctx.moveTo(cx + r, cy - r);
    ctx.lineTo(cx - r, cy + r);
    ctx.stroke();
    // ダイアモンド
    ctx.beginPath();
    ctx.moveTo(cx, cy - r * 1.2);
    ctx.lineTo(cx + r * 1.2, cy);
    ctx.lineTo(cx, cy + r * 1.2);
    ctx.lineTo(cx - r * 1.2, cy);
    ctx.closePath();
    ctx.strokeStyle = 'rgba(196,164,90,0.4)';
    ctx.stroke();
  }

  function drawBox(x, y, s, onGoal) {
    var margin = s * 0.1;
    var bx = x + margin;
    var by = y + margin;
    var bs = s - margin * 2;

    ctx.save();
    // 影
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.roundRect(bx + 2, by + 2, bs, bs, 4);
    ctx.fill();

    // 箱本体
    ctx.beginPath();
    ctx.roundRect(bx, by, bs, bs, 4);
    ctx.fillStyle = onGoal ? '#27ae60' : '#d4a44a';
    ctx.fill();

    // 上面のハイライト
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(bx + 2, by + 1, bs - 4, bs * 0.2);

    // 十字の模様
    ctx.strokeStyle = onGoal ? 'rgba(255,255,255,0.3)' : 'rgba(139,69,19,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bx + bs / 2, by + 4);
    ctx.lineTo(bx + bs / 2, by + bs - 4);
    ctx.moveTo(bx + 4, by + bs / 2);
    ctx.lineTo(bx + bs - 4, by + bs / 2);
    ctx.stroke();

    ctx.restore();
  }

  function drawPlayer(x, y, s) {
    var cx = x + s / 2;
    var cy = y + s / 2;
    var r = s * 0.35;

    ctx.save();

    // 体
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = '#3498DB';
    ctx.fill();

    // ハイライト
    ctx.beginPath();
    ctx.arc(cx - r * 0.2, cy - r * 0.2, r * 0.7, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fill();

    // 目
    var eyeOff = r * 0.25;
    var eyeSize = r * 0.18;
    var eyeDx = 0, eyeDy = 0;
    if (playerDir === 'left') eyeDx = -2;
    if (playerDir === 'right') eyeDx = 2;
    if (playerDir === 'up') eyeDy = -2;
    if (playerDir === 'down') eyeDy = 2;

    // 左目
    ctx.beginPath();
    ctx.arc(cx - eyeOff + eyeDx, cy - r * 0.1 + eyeDy, eyeSize, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx - eyeOff + eyeDx * 0.8, cy - r * 0.1 + eyeDy * 0.8, eyeSize * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = '#1a1a2e';
    ctx.fill();

    // 右目
    ctx.beginPath();
    ctx.arc(cx + eyeOff + eyeDx, cy - r * 0.1 + eyeDy, eyeSize, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + eyeOff + eyeDx * 0.8, cy - r * 0.1 + eyeDy * 0.8, eyeSize * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = '#1a1a2e';
    ctx.fill();

    // 口
    ctx.beginPath();
    ctx.arc(cx, cy + r * 0.25, r * 0.15, 0, Math.PI);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();
  }

  // ============================================
  // ゲーム制御
  // ============================================
  function startGame() {
    initCanvas();
    moves = 0;
    history = [];
    elMoves.textContent = '0';
    elScore.textContent = currentLevel + 1;
    loadLevel(currentLevel);
    running = true;
    elStartOverlay.classList.remove('active');
    elOverOverlay.classList.remove('active');
    draw();
  }

  function nextLevel() {
    currentLevel++;
    if (currentLevel >= LEVELS.length) currentLevel = 0;
    localStorage.setItem('sokobanLevel', currentLevel);
    startGame();
  }

  // ============================================
  // イベント
  // ============================================
  document.addEventListener('keydown', function (e) {
    switch (e.code) {
      case 'ArrowUp': case 'KeyW': e.preventDefault(); move('up'); break;
      case 'ArrowDown': case 'KeyS': e.preventDefault(); move('down'); break;
      case 'ArrowLeft': case 'KeyA': e.preventDefault(); move('left'); break;
      case 'ArrowRight': case 'KeyD': e.preventDefault(); move('right'); break;
      case 'KeyZ': e.preventDefault(); undo(); break;
      case 'KeyR': e.preventDefault(); restartLevel(); break;
    }
  });

  // Dパッド
  var dpadBtns = document.querySelectorAll('.dpad-btn');
  for (var i = 0; i < dpadBtns.length; i++) {
    (function (btn) {
      var dir = btn.getAttribute('data-dir');
      btn.addEventListener('touchstart', function (e) {
        e.preventDefault();
        move(dir);
      });
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        move(dir);
      });
    })(dpadBtns[i]);
  }

  // スワイプ
  initCanvas();

  canvas.addEventListener('touchstart', function (e) {
    e.preventDefault();
    var t = e.touches[0];
    swipeStartX = t.clientX;
    swipeStartY = t.clientY;
  });

  canvas.addEventListener('touchend', function (e) {
    e.preventDefault();
    var t = e.changedTouches[0];
    var dx = t.clientX - swipeStartX;
    var dy = t.clientY - swipeStartY;
    var absDx = Math.abs(dx);
    var absDy = Math.abs(dy);

    if (Math.max(absDx, absDy) < 20) return;

    if (absDx > absDy) {
      move(dx > 0 ? 'right' : 'left');
    } else {
      move(dy > 0 ? 'down' : 'up');
    }
  });

  // ボタン
  elBtnUndo.addEventListener('click', undo);
  elBtnRestart.addEventListener('click', restartLevel);
  elBtnStart.addEventListener('click', startGame);
  elBtnRetry.addEventListener('click', nextLevel);
  elBtnNew.addEventListener('click', function () {
    currentLevel = 0;
    localStorage.setItem('sokobanLevel', 0);
    startGame();
  });

  // リサイズ
  window.addEventListener('resize', function () {
    initCanvas();
    if (running) {
      loadLevel(currentLevel);
      // プレイヤー位置とマップを復元するためリスタートしない
      // cellSize/offsetだけ再計算
      var margin = 10;
      cellSize = Math.floor(Math.min((W - margin * 2) / mapW, (H - margin * 2) / mapH));
      offsetX = Math.floor((W - mapW * cellSize) / 2);
      offsetY = Math.floor((H - mapH * cellSize) / 2);
    }
    draw();
  });

  // 初期化
  loadProgress();
  initCanvas();

  // 初期描画
  (function () {
    ctx.fillStyle = '#2b1810';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(196,164,90,0.3)';
    ctx.textAlign = 'center';
    ctx.font = '24px sans-serif';
    ctx.fillText('📦', W / 2, H / 2);
  })();

})();
