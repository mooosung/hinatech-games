// ============================================
// おさかなサバイバル ゲームロジック
// ============================================

(function () {
  'use strict';

  // ============================================
  // 定数
  // ============================================
  var INITIAL_PLAYER_RADIUS = 12;
  var PLAYER_SPEED = 3.5;
  var NPC_MIN_RADIUS = 5;
  var NPC_MAX_RADIUS = 40;
  var INITIAL_NPC_COUNT = 30;
  var MAX_NPC_COUNT = 50;
  var SPAWN_INTERVAL = 1500;
  var NPC_SPEED_MIN = 0.3;
  var NPC_SPEED_MAX = 1.8;
  var ABSORB_GROWTH = 0.4;
  var PLAYER_LERP = 0.08;
  var BUBBLE_COUNT = 15;

  // ズーム/カメラ定数
  var ZOOM_THRESHOLD_RATIO = 0.03;
  var ZOOM_MIN = 0.15;
  var ZOOM_LERP = 0.03;
  var OCEAN_FLOOR_RATIO = 0.15;

  // 魚のカラーパレット
  var FISH_COLORS = [
    '#E74C3C', '#E67E22', '#F1C40F', '#2ECC71',
    '#1ABC9C', '#9B59B6', '#E91E63',
    '#FF5722', '#8BC34A', '#FF9800'
  ];

  // ============================================
  // 状態変数
  // ============================================
  var canvas, ctx;
  var canvasW, canvasH;
  var player;
  var npcs = [];
  var bubbles = [];
  var score = 0;
  var bestScore = parseInt(localStorage.getItem('bestAbsorb') || '0', 10);
  var gameRunning = false;
  var gameOverFlag = false;
  var animFrameId = null;
  var lastSpawnTime = 0;
  var targetX, targetY;
  var mouseActive = false;
  var frameCount = 0;
  var floatingTexts = [];

  // ズーム/カメラ状態
  var zoom = 1.0;
  var targetZoom = 1.0;
  var cameraX = 0, cameraY = 0;
  var oceanFloorY = 0;
  var oceanFloorDecos = [];
  var seaweeds = [];

  // ============================================
  // DOM要素
  // ============================================
  var scoreEl = document.getElementById('score');
  var bestScoreEl = document.getElementById('best-score');
  var gameOverOverlay = document.getElementById('game-over-overlay');
  var gameStartOverlay = document.getElementById('game-start-overlay');
  var finalScoreEl = document.getElementById('final-score');
  var bestResultEl = document.getElementById('best-result');

  canvas = document.getElementById('game-canvas');
  ctx = canvas.getContext('2d');

  // ============================================
  // キャンバスの初期化
  // ============================================
  function resizeCanvas() {
    var wrapper = canvas.parentElement;
    var rect = wrapper.getBoundingClientRect();
    var dpr = window.devicePixelRatio || 1;

    canvasW = rect.width;
    canvasH = rect.height;

    canvas.width = canvasW * dpr;
    canvas.height = canvasH * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    oceanFloorY = canvasH * OCEAN_FLOOR_RATIO;
  }

  // ============================================
  // ユーティリティ
  // ============================================
  function rand(min, max) {
    return Math.random() * (max - min) + min;
  }

  function dist(x1, y1, x2, y2) {
    var dx = x1 - x2;
    var dy = y1 - y2;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function screenToWorld(sx, sy) {
    return {
      x: (sx - canvasW / 2) / zoom + cameraX,
      y: (sy - canvasH / 2) / zoom + cameraY
    };
  }

  // ============================================
  // 泡の生成（ワールド空間）
  // ============================================
  function createBubble() {
    var halfViewW = canvasW / (2 * zoom);
    var halfViewH = canvasH / (2 * zoom);
    return {
      x: cameraX + rand(-halfViewW, halfViewW),
      y: cameraY + halfViewH + rand(0, 20),
      radius: rand(2, 6),
      speed: rand(0.2, 0.8),
      wobble: rand(0, Math.PI * 2),
      wobbleSpeed: rand(0.01, 0.03)
    };
  }

  function initBubbles() {
    bubbles = [];
    var halfViewH = canvasH / (2 * zoom);
    for (var i = 0; i < BUBBLE_COUNT; i++) {
      var b = createBubble();
      b.y = cameraY + rand(-halfViewH, halfViewH);
      bubbles.push(b);
    }
  }

  // ============================================
  // 水草の初期化（ワールド空間）
  // ============================================
  function initSeaweed() {
    seaweeds = [];
    var maxHalfW = canvasW / (2 * ZOOM_MIN);
    var count = 30;
    for (var i = 0; i < count; i++) {
      seaweeds.push({
        x: rand(-maxHalfW, maxHalfW),
        baseY: oceanFloorY + rand(-10, 10),
        h: 40 + (i % 3) * 25,
        phase: rand(0, Math.PI * 2)
      });
    }
  }

  // ============================================
  // 海底装飾の初期化（ワールド空間）
  // ============================================
  function initOceanFloor() {
    oceanFloorDecos = [];
    var maxHalfW = canvasW / (2 * ZOOM_MIN);
    var nearDepth = canvasH * 0.6;
    var farDepth = canvasH / ZOOM_MIN;

    // 岩（半分は近くに、半分は遠くに配置）
    for (var i = 0; i < 25; i++) {
      var depth = i < 15
        ? rand(5, nearDepth)
        : rand(nearDepth, farDepth * 0.5);
      oceanFloorDecos.push({
        type: 'rock',
        x: rand(-maxHalfW, maxHalfW),
        y: oceanFloorY + depth,
        w: rand(30, 80),
        h: rand(20, 55),
        color: ['#3d4f5f', '#4a5568', '#2d3748', '#5a6577'][i % 4],
        seed: rand(0, 100)
      });
    }

    // サンゴ（多くを近くに配置）
    for (var i = 0; i < 12; i++) {
      var depth = i < 8
        ? rand(0, nearDepth)
        : rand(nearDepth, farDepth * 0.4);
      oceanFloorDecos.push({
        type: 'coral',
        x: rand(-maxHalfW, maxHalfW),
        y: oceanFloorY + depth,
        h: rand(35, 70),
        color: ['#e84393', '#fd79a8', '#e17055', '#fab1a0', '#ff7675'][i % 5],
        branches: Math.floor(rand(2, 5))
      });
    }

    // 貝殻（多くを近くに配置）
    for (var i = 0; i < 15; i++) {
      var depth = i < 10
        ? rand(5, nearDepth)
        : rand(nearDepth, farDepth * 0.3);
      oceanFloorDecos.push({
        type: 'shell',
        x: rand(-maxHalfW, maxHalfW),
        y: oceanFloorY + depth,
        size: rand(8, 18),
        color: ['#ffeaa7', '#dfe6e9', '#fab1a0'][i % 3],
        rotation: rand(0, Math.PI * 2)
      });
    }
  }

  // ============================================
  // NPC（魚）生成
  // ============================================
  function createFish(radius, x, y) {
    var angle = rand(0, Math.PI * 2);
    var sizeFactor = Math.max(0.4, 1 - (radius - NPC_MIN_RADIUS) / 200);
    var speed = rand(NPC_SPEED_MIN, NPC_SPEED_MAX) * sizeFactor;

    return {
      x: x,
      y: y,
      radius: radius,
      score: Math.ceil(radius),
      color: FISH_COLORS[Math.floor(Math.random() * FISH_COLORS.length)],
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      changeTimer: rand(60, 180),
      tailPhase: rand(0, Math.PI * 2)
    };
  }

  function createNPC() {
    var radius = rand(NPC_MIN_RADIUS, NPC_MAX_RADIUS);

    if (player) {
      var maxR = Math.max(NPC_MAX_RADIUS, player.radius * 3);
      var r = Math.random();
      if (r < 0.50) {
        // 小さい餌
        radius = rand(NPC_MIN_RADIUS, Math.max(player.radius * 0.7, NPC_MIN_RADIUS + 1));
      } else if (r < 0.70) {
        // 同程度
        radius = rand(player.radius * 0.7, player.radius * 1.0);
      } else if (r < 0.88) {
        // やや強い
        radius = rand(player.radius * 1.1, player.radius * 1.8);
      } else {
        // かなり強い
        radius = rand(player.radius * 1.8, player.radius * 3.0);
      }
      radius = Math.max(NPC_MIN_RADIUS, Math.min(radius, maxR));
    }

    // ビューポート端からスポーン（ワールド座標）
    var halfViewW = canvasW / (2 * zoom);
    var halfViewH = canvasH / (2 * zoom);
    var edge = Math.floor(Math.random() * 4);
    var x, y;
    if (edge === 0) {
      x = cameraX + rand(-halfViewW, halfViewW);
      y = cameraY - halfViewH - radius * 3;
    } else if (edge === 1) {
      x = cameraX + rand(-halfViewW, halfViewW);
      y = cameraY + halfViewH + radius * 3;
    } else if (edge === 2) {
      x = cameraX - halfViewW - radius * 3;
      y = cameraY + rand(-halfViewH, halfViewH);
    } else {
      x = cameraX + halfViewW + radius * 3;
      y = cameraY + rand(-halfViewH, halfViewH);
    }

    var fish = createFish(radius, x, y);
    // プレイヤーに向かう方向
    var angle = Math.atan2(player.y - y + rand(-100, 100), player.x - x + rand(-100, 100));
    var sizeFactor = Math.max(0.4, 1 - (radius - NPC_MIN_RADIUS) / 200);
    var speed = rand(NPC_SPEED_MIN, NPC_SPEED_MAX) * sizeFactor;
    fish.vx = Math.cos(angle) * speed;
    fish.vy = Math.sin(angle) * speed;
    return fish;
  }

  function createInitialNPC() {
    var radius = rand(NPC_MIN_RADIUS, NPC_MAX_RADIUS);
    var r = Math.random();
    if (r < 0.65) {
      radius = rand(NPC_MIN_RADIUS, INITIAL_PLAYER_RADIUS * 0.9);
    } else if (r < 0.85) {
      radius = rand(INITIAL_PLAYER_RADIUS * 0.7, INITIAL_PLAYER_RADIUS * 1.3);
    } else {
      radius = rand(INITIAL_PLAYER_RADIUS * 1.2, INITIAL_PLAYER_RADIUS * 2.5);
    }
    radius = Math.max(NPC_MIN_RADIUS, Math.min(radius, NPC_MAX_RADIUS));

    // 初期ビューポート内に配置（プレイヤーは0,0）
    var halfW = canvasW / 2;
    var halfH = canvasH / 2;
    var x = rand(-halfW + radius + 10, halfW - radius - 10);
    var y = rand(-halfH + radius + 10, halfH - radius - 10);

    if (dist(x, y, 0, 0) < INITIAL_PLAYER_RADIUS + radius + 30) {
      x = rand(-halfW + radius + 10, halfW - radius - 10);
      y = rand(-halfH + radius + 10, halfH - radius - 10);
    }

    return createFish(radius, x, y);
  }

  // ============================================
  // プレイヤー初期化
  // ============================================
  function initPlayer() {
    player = {
      x: 0,
      y: 0,
      radius: INITIAL_PLAYER_RADIUS,
      score: Math.ceil(INITIAL_PLAYER_RADIUS),
      color: '#3498DB',
      vx: 0,
      vy: 0,
      tailPhase: 0
    };
    targetX = 0;
    targetY = 0;
  }

  // ============================================
  // 更新
  // ============================================
  function update() {
    if (!gameRunning || gameOverFlag) return;

    frameCount++;

    // プレイヤー移動
    if (mouseActive) {
      var dx = targetX - player.x;
      var dy = targetY - player.y;
      var d = Math.sqrt(dx * dx + dy * dy);

      if (d > 1) {
        var speedScale = Math.max(1, 1 / Math.sqrt(zoom));
        var speed = Math.min(
          (PLAYER_SPEED + player.radius * 0.02) * speedScale,
          d * PLAYER_LERP + PLAYER_SPEED * 0.5 * speedScale
        );
        player.vx = (dx / d) * speed;
        player.vy = (dy / d) * speed;
        player.x += player.vx;
        player.y += player.vy;
      } else {
        player.vx = 0;
        player.vy = 0;
      }
    }

    player.tailPhase += 0.15;

    // ズーム計算（平方根で緩やかにズームアウト→成長が見える）
    var thresholdRadius = Math.min(canvasW, canvasH) * ZOOM_THRESHOLD_RATIO;
    if (player.radius > thresholdRadius) {
      targetZoom = Math.sqrt(thresholdRadius / player.radius);
    } else {
      targetZoom = 1.0;
    }
    targetZoom = Math.max(ZOOM_MIN, targetZoom);
    zoom += (targetZoom - zoom) * ZOOM_LERP;

    // カメラはプレイヤー追従
    cameraX = player.x;
    cameraY = player.y;

    // ビューポート情報（カリング用）
    var halfViewW = canvasW / (2 * zoom);
    var halfViewH = canvasH / (2 * zoom);
    var cullDist = Math.max(halfViewW, halfViewH) * 3;

    // NPC更新
    for (var i = npcs.length - 1; i >= 0; i--) {
      var npc = npcs[i];

      npc.tailPhase += 0.12;
      npc.changeTimer--;
      if (npc.changeTimer <= 0) {
        // プレイヤー方向にバイアスをかけた方向転換
        var toPlayerAngle = Math.atan2(player.y - npc.y, player.x - npc.x);
        var randomAngle = rand(0, Math.PI * 2);
        var angle = Math.random() < 0.4
          ? toPlayerAngle + rand(-0.5, 0.5)
          : randomAngle;
        var sizeFactor = Math.max(0.4, 1 - (npc.radius - NPC_MIN_RADIUS) / 200);
        var npcSpeed = rand(NPC_SPEED_MIN, NPC_SPEED_MAX) * sizeFactor;
        npc.vx = Math.cos(angle) * npcSpeed;
        npc.vy = Math.sin(angle) * npcSpeed;
        npc.changeTimer = rand(60, 180);
      }

      npc.x += npc.vx;
      npc.y += npc.vy;

      // ビューポートから離れすぎたNPCを除去
      if (dist(npc.x, npc.y, player.x, player.y) > cullDist) {
        npcs.splice(i, 1);
        continue;
      }

      // プレイヤーとの衝突判定
      var dd = dist(player.x, player.y, npc.x, npc.y);
      var touchDist = player.radius + npc.radius;

      if (dd < touchDist * 0.7) {
        if (player.score > npc.score) {
          score += npc.score;
          player.score += npc.score;
          floatingTexts.push({
            x: npc.x, y: npc.y,
            text: '+' + npc.score,
            life: 1
          });
          player.radius += npc.radius * ABSORB_GROWTH / player.radius * 5;
          npcs.splice(i, 1);
          updateScore();
        } else {
          gameOver();
          return;
        }
      }
    }

    // フローティングテキスト更新
    var ftSpeed = 1.2 / zoom;
    for (var fi = floatingTexts.length - 1; fi >= 0; fi--) {
      var ft = floatingTexts[fi];
      ft.y -= ftSpeed;
      ft.life -= 0.025;
      if (ft.life <= 0) floatingTexts.splice(fi, 1);
    }

    // 泡の更新（ワールド空間）
    for (var j = 0; j < bubbles.length; j++) {
      var b = bubbles[j];
      b.y -= b.speed;
      b.wobble += b.wobbleSpeed;
      b.x += Math.sin(b.wobble) * 0.3;
      if (b.y < cameraY - halfViewH - 10 ||
          b.x < cameraX - halfViewW - 20 ||
          b.x > cameraX + halfViewW + 20) {
        b.x = cameraX + rand(-halfViewW, halfViewW);
        b.y = cameraY + halfViewH + rand(0, 20);
        b.radius = rand(2, 6);
        b.speed = rand(0.2, 0.8);
      }
    }

    // NPC定期生成（ズームに応じてスケーリング）
    var now = Date.now();
    var dynamicMaxNPC = Math.floor(MAX_NPC_COUNT / Math.max(zoom, 0.3));
    var dynamicSpawnInterval = SPAWN_INTERVAL * Math.max(zoom, 0.5);
    if (now - lastSpawnTime > dynamicSpawnInterval && npcs.length < dynamicMaxNPC) {
      npcs.push(createNPC());
      lastSpawnTime = now;
    }
  }

  // ============================================
  // 描画
  // ============================================
  function draw() {
    // 背景グラデーション（スクリーン空間）
    var grad = ctx.createLinearGradient(0, 0, 0, canvasH);
    grad.addColorStop(0, '#1a6b8a');
    grad.addColorStop(0.5, '#145a73');
    grad.addColorStop(1, '#0d3d52');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvasW, canvasH);

    // 水面の波紋（スクリーン空間）
    drawWaterSurface();

    // カメラ変換開始
    ctx.save();
    ctx.translate(canvasW / 2, canvasH / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-cameraX, -cameraY);

    // 海底（ワールド空間）
    drawOceanFloor();

    // 水草（ワールド空間）
    drawSeaweed();

    // 泡（ワールド空間）
    drawBubbles();

    // NPC描画（小さい順）
    var sorted = npcs.slice().sort(function (a, b) { return a.radius - b.radius; });
    for (var i = 0; i < sorted.length; i++) {
      drawFish(sorted[i], false);
    }

    // プレイヤー描画
    if (player) {
      drawFish(player, true);
    }

    // フローティングテキスト描画（ワールド空間、フォントはズーム補正）
    for (var fi = 0; fi < floatingTexts.length; fi++) {
      var ft = floatingTexts[fi];
      ctx.save();
      ctx.globalAlpha = ft.life;
      var fontSize = 16 / zoom;
      ctx.font = 'bold ' + fontSize + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FFD700';
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 3 / zoom;
      ctx.strokeText(ft.text, ft.x, ft.y);
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }

    // カメラ変換終了
    ctx.restore();
  }

  function drawWaterSurface() {
    ctx.save();
    ctx.globalAlpha = 0.08;
    for (var i = 0; i < 5; i++) {
      var yy = 10 + i * 8;
      ctx.beginPath();
      ctx.moveTo(0, yy);
      for (var x = 0; x < canvasW; x += 20) {
        var wave = Math.sin((x + frameCount * 0.5 + i * 30) * 0.03) * 4;
        ctx.lineTo(x, yy + wave);
      }
      ctx.lineTo(canvasW, yy);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawBubbles() {
    ctx.save();
    for (var i = 0; i < bubbles.length; i++) {
      var b = bubbles[i];
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(b.x - b.radius * 0.3, b.y - b.radius * 0.3, b.radius * 0.25, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fill();
    }
    ctx.restore();
  }

  function drawSeaweed() {
    ctx.save();
    ctx.globalAlpha = 0.25;
    var halfViewW = canvasW / (2 * zoom);
    for (var i = 0; i < seaweeds.length; i++) {
      var sw = seaweeds[i];
      // ビューポートカリング
      if (sw.x < cameraX - halfViewW - 50 || sw.x > cameraX + halfViewW + 50) continue;
      var baseX = sw.x;
      var baseY = sw.baseY;
      var h = sw.h;
      ctx.beginPath();
      ctx.moveTo(baseX, baseY);
      var sway = Math.sin(frameCount * 0.02 + sw.phase) * 8;
      ctx.quadraticCurveTo(baseX + sway, baseY - h * 0.5, baseX + sway * 1.2, baseY - h);
      ctx.strokeStyle = '#2ECC71';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawOceanFloor() {
    var halfViewW = canvasW / (2 * zoom);
    var halfViewH = canvasH / (2 * zoom);
    var viewLeft = cameraX - halfViewW;
    var viewRight = cameraX + halfViewW;
    var viewTop = cameraY - halfViewH;
    var viewBottom = cameraY + halfViewH;

    // 海底が見える場合のみ描画
    if (viewBottom < oceanFloorY - 20) return;

    // 砂地グラデーション
    ctx.save();
    var sandTop = oceanFloorY;
    var sandBottom = viewBottom + 100;
    var sandGrad = ctx.createLinearGradient(0, sandTop, 0, sandTop + 200);
    sandGrad.addColorStop(0, 'rgba(194, 178, 128, 0.25)');
    sandGrad.addColorStop(0.3, 'rgba(194, 178, 128, 0.4)');
    sandGrad.addColorStop(1, 'rgba(139, 119, 74, 0.5)');
    ctx.fillStyle = sandGrad;
    ctx.fillRect(viewLeft, sandTop, viewRight - viewLeft, sandBottom - sandTop);

    // 砂の波紋
    ctx.globalAlpha = 0.08;
    ctx.strokeStyle = '#c2b280';
    ctx.lineWidth = 1;
    for (var ri = 0; ri < 8; ri++) {
      var rippleY = oceanFloorY + 20 + ri * 30;
      if (rippleY < viewTop || rippleY > viewBottom) continue;
      ctx.beginPath();
      for (var rx = viewLeft; rx < viewRight; rx += 15) {
        var ry = rippleY + Math.sin((rx + frameCount * 0.2 + ri * 50) * 0.02) * 5;
        if (rx === viewLeft) ctx.moveTo(rx, ry);
        else ctx.lineTo(rx, ry);
      }
      ctx.stroke();
    }
    ctx.restore();

    // 装飾の描画（ビューポートカリング）
    for (var i = 0; i < oceanFloorDecos.length; i++) {
      var deco = oceanFloorDecos[i];
      if (deco.x < viewLeft - 80 || deco.x > viewRight + 80) continue;
      if (deco.y < viewTop - 80 || deco.y > viewBottom + 80) continue;

      if (deco.type === 'rock') {
        drawRock(deco);
      } else if (deco.type === 'coral') {
        drawCoral(deco);
      } else if (deco.type === 'shell') {
        drawShell(deco);
      }
    }
  }

  function drawRock(rock) {
    ctx.save();
    ctx.translate(rock.x, rock.y);
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = rock.color;
    ctx.beginPath();
    var w = rock.w;
    var h = rock.h;
    var s = rock.seed;
    // 不規則な丸い岩
    ctx.moveTo(-w * 0.4, 0);
    ctx.quadraticCurveTo(-w * 0.5, -h * (0.6 + Math.sin(s) * 0.2), -w * 0.1, -h);
    ctx.quadraticCurveTo(w * (0.1 + Math.cos(s) * 0.1), -h * (1.1 + Math.sin(s * 2) * 0.1), w * 0.4, -h * 0.5);
    ctx.quadraticCurveTo(w * 0.5, -h * 0.1, w * 0.3, 0);
    ctx.closePath();
    ctx.fill();
    // ハイライト
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(-w * 0.1, -h * 0.6, w * 0.15, h * 0.2, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawCoral(coral) {
    ctx.save();
    ctx.translate(coral.x, coral.y);
    ctx.globalAlpha = 0.45;
    ctx.strokeStyle = coral.color;
    ctx.fillStyle = coral.color;
    ctx.lineCap = 'round';
    ctx.lineWidth = 4;
    for (var b = 0; b < coral.branches; b++) {
      var branchAngle = -Math.PI / 2 + (b - (coral.branches - 1) / 2) * 0.5;
      var branchH = coral.h * (0.6 + b * 0.15);
      var tipX = Math.cos(branchAngle) * branchH * 0.3;
      var tipY = Math.sin(branchAngle) * branchH;
      var sway = Math.sin(frameCount * 0.015 + coral.x * 0.1 + b) * 5;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(tipX * 0.5 + sway, tipY * 0.5, tipX + sway, tipY);
      ctx.stroke();
      // ポリプ（先端の丸）
      ctx.beginPath();
      ctx.arc(tipX + sway, tipY, 4, 0, Math.PI * 2);
      ctx.globalAlpha = 0.35;
      ctx.fill();
      ctx.globalAlpha = 0.35;
    }
    ctx.restore();
  }

  function drawShell(shell) {
    ctx.save();
    ctx.translate(shell.x, shell.y);
    ctx.rotate(shell.rotation);
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = shell.color;
    ctx.strokeStyle = shell.color;
    ctx.lineWidth = 1.5;
    // 巻貝の螺旋
    var s = shell.size;
    ctx.beginPath();
    for (var t = 0; t < Math.PI * 3; t += 0.2) {
      var r = s * (1 - t / (Math.PI * 3)) * 0.8;
      var sx = Math.cos(t) * r;
      var sy = Math.sin(t) * r;
      if (t === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.stroke();
    // 中心の丸
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawFish(fish, isPlayer) {
    ctx.save();

    var r = fish.radius;
    var facing = (fish.vx >= 0) ? 1 : -1;
    var tailSwing = Math.sin(fish.tailPhase) * 0.3;

    ctx.translate(fish.x, fish.y);
    ctx.scale(facing, 1);

    ctx.globalAlpha = isPlayer ? 0.92 : 0.78;

    // 魚体（楕円）
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.4, r * 0.85, 0, 0, Math.PI * 2);
    ctx.fillStyle = fish.color;
    ctx.fill();

    // 光沢
    ctx.beginPath();
    ctx.ellipse(-r * 0.2, -r * 0.25, r * 0.6, r * 0.3, -0.2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fill();

    // 尾びれ
    ctx.beginPath();
    var tailX = -r * 1.3;
    var tailTip = tailSwing * r * 0.8;
    ctx.moveTo(tailX, 0);
    ctx.lineTo(tailX - r * 0.7, -r * 0.6 + tailTip);
    ctx.lineTo(tailX - r * 0.1, 0);
    ctx.lineTo(tailX - r * 0.7, r * 0.6 + tailTip);
    ctx.closePath();
    ctx.fillStyle = fish.color;
    ctx.fill();

    // 背びれ
    ctx.beginPath();
    ctx.moveTo(r * 0.2, -r * 0.8);
    ctx.quadraticCurveTo(-r * 0.1, -r * 1.1, -r * 0.5, -r * 0.75);
    ctx.lineTo(-r * 0.1, -r * 0.6);
    ctx.closePath();
    ctx.fillStyle = fish.color;
    ctx.globalAlpha = isPlayer ? 0.7 : 0.5;
    ctx.fill();

    ctx.globalAlpha = isPlayer ? 0.92 : 0.78;

    // 目
    var eyeX = r * 0.6;
    var eyeY = -r * 0.15;
    var eyeR = Math.max(2, r * 0.2);
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, eyeR, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.globalAlpha = 1;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(eyeX + eyeR * 0.25, eyeY, eyeR * 0.55, 0, Math.PI * 2);
    ctx.fillStyle = '#111';
    ctx.fill();

    // プレイヤーの縁取り
    if (isPlayer) {
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 1.4, r * 0.85, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = Math.max(2, 2 / zoom);
      ctx.stroke();
    }

    // サイズ数字（反転を打ち消してから描画）
    ctx.scale(facing, 1);
    var sizeNum = fish.score;
    var fontSize = Math.max(7, r * 0.45);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold ' + fontSize + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = 0.75;
    ctx.fillText(sizeNum, 0, r * 0.2);

    ctx.restore();
  }

  // ============================================
  // スコア
  // ============================================
  function updateScore() {
    scoreEl.textContent = score;
    if (score > bestScore) {
      bestScore = score;
      bestScoreEl.textContent = bestScore;
      localStorage.setItem('bestAbsorb', bestScore.toString());
    }
  }

  // ============================================
  // ゲーム開始
  // ============================================
  function startGame() {
    resizeCanvas();

    // ズーム/カメラ初期化
    zoom = 1.0;
    targetZoom = 1.0;
    cameraX = 0;
    cameraY = 0;

    initPlayer();
    npcs = [];
    score = 0;
    gameOverFlag = false;
    mouseActive = false;
    frameCount = 0;
    floatingTexts = [];
    lastSpawnTime = Date.now();

    initBubbles();
    initSeaweed();
    initOceanFloor();

    for (var i = 0; i < INITIAL_NPC_COUNT; i++) {
      npcs.push(createInitialNPC());
    }

    updateScore();
    gameOverOverlay.classList.remove('active');
    gameStartOverlay.classList.remove('active');

    gameRunning = true;
    if (animFrameId) cancelAnimationFrame(animFrameId);
    gameLoop();
  }

  // ============================================
  // ゲームオーバー
  // ============================================
  function gameOver() {
    gameRunning = false;
    gameOverFlag = true;

    if (animFrameId) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }

    finalScoreEl.textContent = score;
    if (score >= bestScore && score > 0) {
      bestResultEl.textContent = 'ハイスコア更新！';
    } else {
      bestResultEl.textContent = 'ベスト: ' + bestScore;
    }

    setTimeout(function () {
      gameOverOverlay.classList.add('active');
    }, 300);
  }

  // ============================================
  // ゲームループ
  // ============================================
  function gameLoop() {
    update();
    draw();
    if (gameRunning && !gameOverFlag) {
      animFrameId = requestAnimationFrame(gameLoop);
    }
  }

  // ============================================
  // イベントリスナー
  // ============================================
  canvas.addEventListener('mousemove', function (e) {
    if (!gameRunning) return;
    var rect = canvas.getBoundingClientRect();
    var screenX = e.clientX - rect.left;
    var screenY = e.clientY - rect.top;
    var world = screenToWorld(screenX, screenY);
    targetX = world.x;
    targetY = world.y;
    mouseActive = true;
  });

  canvas.addEventListener('touchstart', function (e) {
    e.preventDefault();
    if (!gameRunning) return;
    var rect = canvas.getBoundingClientRect();
    var screenX = e.touches[0].clientX - rect.left;
    var screenY = e.touches[0].clientY - rect.top;
    var world = screenToWorld(screenX, screenY);
    targetX = world.x;
    targetY = world.y;
    mouseActive = true;
  }, { passive: false });

  canvas.addEventListener('touchmove', function (e) {
    e.preventDefault();
    if (!gameRunning) return;
    var rect = canvas.getBoundingClientRect();
    var screenX = e.touches[0].clientX - rect.left;
    var screenY = e.touches[0].clientY - rect.top;
    var world = screenToWorld(screenX, screenY);
    targetX = world.x;
    targetY = world.y;
  }, { passive: false });

  canvas.addEventListener('touchend', function (e) {
    e.preventDefault();
  }, { passive: false });

  document.getElementById('btn-new-game').addEventListener('click', function () {
    startGame();
  });

  document.getElementById('btn-retry').addEventListener('click', function () {
    startGame();
  });

  document.getElementById('btn-start').addEventListener('click', function () {
    startGame();
  });

  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      resizeCanvas();
      initSeaweed();
      initOceanFloor();
      initBubbles();

      if (!gameRunning) {
        draw();
      }
    }, 100);
  });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden && gameRunning) {
      if (animFrameId) {
        cancelAnimationFrame(animFrameId);
        animFrameId = null;
      }
      gameRunning = false;
    }
  });

  // ============================================
  // 初期化
  // ============================================
  bestScoreEl.textContent = bestScore;
  resizeCanvas();
  initBubbles();
  initSeaweed();
  initOceanFloor();
  draw();
})();
