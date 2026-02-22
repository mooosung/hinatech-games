// ============================================
// フルーツマージ ゲームロジック
// ============================================

(function () {
  'use strict';

  // ============================================
  // Matter.js ショートカット
  // ============================================
  var Engine = Matter.Engine;
  var World = Matter.World;
  var Bodies = Matter.Bodies;
  var Body = Matter.Body;
  var Events = Matter.Events;
  var Composite = Matter.Composite;

  // ============================================
  // フルーツ定義
  // ============================================
  var FRUITS = [
    { name: 'さくらんぼ', radius: 12, color: '#E74040', highlight: '#FF6B6B', shadow: '#B82E2E', score: 1 },
    { name: 'いちご',     radius: 17, color: '#FF4757', highlight: '#FF7979', shadow: '#C0392B', score: 3 },
    { name: 'ぶどう',     radius: 24, color: '#8E44AD', highlight: '#BB6BD9', shadow: '#6C3483', score: 6 },
    { name: 'デコポン',   radius: 30, color: '#FF8C00', highlight: '#FFB347', shadow: '#CC7000', score: 10 },
    { name: 'かき',       radius: 36, color: '#E8740C', highlight: '#F5A623', shadow: '#B85C09', score: 15 },
    { name: 'りんご',     radius: 42, color: '#E74C3C', highlight: '#FF7675', shadow: '#A93226', score: 21 },
    { name: 'なし',       radius: 48, color: '#C8D946', highlight: '#E2F060', shadow: '#9FB037', score: 28 },
    { name: 'もも',       radius: 56, color: '#FFB6C1', highlight: '#FFD4DB', shadow: '#E8939E', score: 36 },
    { name: 'パイナップル', radius: 64, color: '#F4D03F', highlight: '#F9E784', shadow: '#D4AC0D', score: 45 },
    { name: 'メロン',     radius: 74, color: '#27AE60', highlight: '#58D68D', shadow: '#1E8449', score: 55 },
    { name: 'すいか',     radius: 84, color: '#2ECC71', highlight: '#58D68D', shadow: '#1A9C4E', score: 66 }
  ];

  var MAX_DROP_INDEX = 4; // さくらんぼ〜かき
  var DEAD_LINE_Y = 80;   // デッドラインのY座標（キャンバス座標）
  var WALL_THICKNESS = 20;
  var DROP_COOLDOWN = 500; // ドロップ後のクールダウン(ms)
  var GAMEOVER_GRACE = 2000; // デッドライン超え猶予(ms)

  // ============================================
  // 状態変数
  // ============================================
  var canvas, ctx, nextCanvas, nextCtx;
  var canvasW, canvasH;
  var engine, world;
  var score = 0;
  var bestScore = parseInt(localStorage.getItem('bestSuika') || '0', 10);
  var gameRunning = false;
  var gameOverFlag = false;
  var animFrameId = null;

  var currentFruitIndex = 0;
  var nextFruitIndex = 0;
  var dropX = 0;
  var canDrop = true;
  var lastDropTime = 0;

  var fruits = []; // { body, fruitIndex, merging }
  var particles = [];
  var mergeFlashes = [];
  var deadLineTimer = 0;
  var mouseActive = false;
  var scaleFactor = 1;

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
  nextCanvas = document.getElementById('next-canvas');
  nextCtx = nextCanvas.getContext('2d');

  // ============================================
  // キャンバス初期化
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

    // スケール計算（基準幅375pxに対する比率）
    scaleFactor = canvasW / 375;
  }

  // ============================================
  // フルーツの半径（スケール適用）
  // ============================================
  function fruitRadius(index) {
    return FRUITS[index].radius * scaleFactor;
  }

  // ============================================
  // ランダムフルーツインデックス
  // ============================================
  function randomFruitIndex() {
    return Math.floor(Math.random() * (MAX_DROP_INDEX + 1));
  }

  // ============================================
  // パーティクル
  // ============================================
  function spawnParticles(x, y, color, count) {
    for (var i = 0; i < count; i++) {
      var angle = Math.random() * Math.PI * 2;
      var speed = 1 + Math.random() * 3;
      particles.push({
        x: x, y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1,
        radius: 2 + Math.random() * 3,
        color: color,
        life: 1
      });
    }
  }

  // ============================================
  // フルーツのボディ作成
  // ============================================
  function createFruitBody(index, x, y, isStatic) {
    var r = fruitRadius(index);
    var body = Bodies.circle(x, y, r, {
      restitution: 0.2,
      friction: 0.5,
      frictionStatic: 0.8,
      density: 0.002,
      isStatic: !!isStatic,
      collisionFilter: { group: 0, category: 0x0001, mask: 0x0001 },
      label: 'fruit'
    });
    body.fruitIndex = index;
    body.merging = false;
    body.dropTime = Date.now();
    return body;
  }

  function addFruit(index, x, y) {
    var body = createFruitBody(index, x, y, false);
    World.add(world, body);
    fruits.push(body);
    return body;
  }

  // ============================================
  // マージ処理
  // ============================================
  function handleCollision(event) {
    if (!gameRunning || gameOverFlag) return;

    var pairs = event.pairs;
    for (var i = 0; i < pairs.length; i++) {
      var pair = pairs[i];
      var bodyA = pair.bodyA;
      var bodyB = pair.bodyB;

      if (bodyA.label !== 'fruit' || bodyB.label !== 'fruit') continue;
      if (bodyA.merging || bodyB.merging) continue;
      if (bodyA.fruitIndex === undefined || bodyB.fruitIndex === undefined) continue;
      if (bodyA.fruitIndex !== bodyB.fruitIndex) continue;

      var fruitIdx = bodyA.fruitIndex;

      // マーク
      bodyA.merging = true;
      bodyB.merging = true;

      var midX = (bodyA.position.x + bodyB.position.x) / 2;
      var midY = (bodyA.position.y + bodyB.position.y) / 2;

      // エフェクト
      var color = FRUITS[fruitIdx].highlight;
      spawnParticles(midX, midY, color, 10);
      mergeFlashes.push({ x: midX, y: midY, radius: fruitRadius(fruitIdx), life: 1 });

      // スコア加算
      if (fruitIdx < FRUITS.length - 1) {
        score += FRUITS[fruitIdx + 1].score;
      } else {
        score += 100; // すいか×すいか ボーナス
      }
      updateScore();

      // ボディ除去＆新フルーツ生成（遅延）
      (function (bA, bB, idx, mx, my) {
        setTimeout(function () {
          // 除去
          var idxA = fruits.indexOf(bA);
          if (idxA >= 0) fruits.splice(idxA, 1);
          var idxB = fruits.indexOf(bB);
          if (idxB >= 0) fruits.splice(idxB, 1);
          World.remove(world, bA);
          World.remove(world, bB);

          // 次のフルーツ生成（すいか同士は消えるだけ）
          if (idx < FRUITS.length - 1) {
            addFruit(idx + 1, mx, my);
          }
        }, 50);
      })(bodyA, bodyB, fruitIdx, midX, midY);
    }
  }

  // ============================================
  // ドロップ
  // ============================================
  function dropFruit() {
    if (!canDrop || !gameRunning || gameOverFlag) return;

    var r = fruitRadius(currentFruitIndex);
    var x = Math.max(WALL_THICKNESS + r, Math.min(canvasW - WALL_THICKNESS - r, dropX));
    var body = addFruit(currentFruitIndex, x, DEAD_LINE_Y - 10);

    canDrop = false;
    lastDropTime = Date.now();

    currentFruitIndex = nextFruitIndex;
    nextFruitIndex = randomFruitIndex();
    drawNextFruit();

    setTimeout(function () {
      if (gameRunning && !gameOverFlag) canDrop = true;
    }, DROP_COOLDOWN);
  }

  // ============================================
  // ネクスト表示
  // ============================================
  function drawNextFruit() {
    var dpr = window.devicePixelRatio || 1;
    nextCanvas.width = 50 * dpr;
    nextCanvas.height = 50 * dpr;
    nextCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    nextCtx.clearRect(0, 0, 50, 50);

    var info = FRUITS[nextFruitIndex];
    var displayR = Math.min(18, info.radius * 0.9);
    drawFruitShape(nextCtx, 25, 25, displayR, nextFruitIndex);
  }

  // ============================================
  // スコア更新
  // ============================================
  function updateScore() {
    scoreEl.textContent = score;
    if (score > bestScore) {
      bestScore = score;
      bestScoreEl.textContent = bestScore;
      localStorage.setItem('bestSuika', bestScore.toString());
    }
  }

  // ============================================
  // ゲームオーバー判定
  // ============================================
  function checkGameOver() {
    var now = Date.now();
    var overLine = false;

    for (var i = 0; i < fruits.length; i++) {
      var body = fruits[i];
      if (body.merging) continue;
      // ドロップ直後は猶予
      if (now - body.dropTime < 1500) continue;

      var r = fruitRadius(body.fruitIndex);
      if (body.position.y - r < DEAD_LINE_Y * scaleFactor) {
        overLine = true;
        break;
      }
    }

    if (overLine) {
      if (deadLineTimer === 0) {
        deadLineTimer = now;
      } else if (now - deadLineTimer > GAMEOVER_GRACE) {
        gameOver();
      }
    } else {
      deadLineTimer = 0;
    }
  }

  // ============================================
  // ゲーム開始
  // ============================================
  function startGame() {
    resizeCanvas();

    // エンジン初期化
    if (engine) Engine.clear(engine);
    engine = Engine.create({ gravity: { x: 0, y: 1.5 } });
    world = engine.world;

    // 壁（左・右・底）
    var wallOpts = { isStatic: true, friction: 0.3, restitution: 0.1, label: 'wall' };
    var bottom = Bodies.rectangle(canvasW / 2, canvasH + WALL_THICKNESS / 2, canvasW, WALL_THICKNESS, wallOpts);
    var left = Bodies.rectangle(-WALL_THICKNESS / 2, canvasH / 2, WALL_THICKNESS, canvasH * 2, wallOpts);
    var right = Bodies.rectangle(canvasW + WALL_THICKNESS / 2, canvasH / 2, WALL_THICKNESS, canvasH * 2, wallOpts);
    World.add(world, [bottom, left, right]);

    // 衝突イベント
    Events.on(engine, 'collisionStart', handleCollision);

    // 状態リセット
    fruits = [];
    particles = [];
    mergeFlashes = [];
    score = 0;
    gameOverFlag = false;
    canDrop = true;
    deadLineTimer = 0;
    mouseActive = false;
    dropX = canvasW / 2;

    currentFruitIndex = randomFruitIndex();
    nextFruitIndex = randomFruitIndex();
    drawNextFruit();
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
    canDrop = false;

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
  // 更新
  // ============================================
  function update() {
    if (!gameRunning || gameOverFlag) return;

    Engine.update(engine, 1000 / 60);

    // パーティクル更新
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.05;
      p.life -= 0.03;
      if (p.life <= 0) particles.splice(i, 1);
    }

    // マージフラッシュ更新
    for (var j = mergeFlashes.length - 1; j >= 0; j--) {
      mergeFlashes[j].life -= 0.06;
      if (mergeFlashes[j].life <= 0) mergeFlashes.splice(j, 1);
    }

    checkGameOver();
  }

  // ============================================
  // フルーツ描画関数（個別の見た目）
  // ============================================
  function drawFruitShape(c, x, y, r, index) {
    var info = FRUITS[index];

    c.save();
    c.translate(x, y);

    switch (index) {
      case 0: drawCherry(c, r, info); break;
      case 1: drawStrawberry(c, r, info); break;
      case 2: drawGrape(c, r, info); break;
      case 3: drawDekopon(c, r, info); break;
      case 4: drawPersimmon(c, r, info); break;
      case 5: drawApple(c, r, info); break;
      case 6: drawPear(c, r, info); break;
      case 7: drawPeach(c, r, info); break;
      case 8: drawPineapple(c, r, info); break;
      case 9: drawMelon(c, r, info); break;
      case 10: drawWatermelon(c, r, info); break;
    }

    c.restore();
  }

  // --- さくらんぼ ---
  function drawCherry(c, r, info) {
    // 茎
    c.beginPath();
    c.moveTo(-r * 0.2, -r * 0.5);
    c.quadraticCurveTo(0, -r * 1.4, r * 0.5, -r * 1.2);
    c.strokeStyle = '#5D4E37';
    c.lineWidth = Math.max(1.5, r * 0.1);
    c.stroke();

    c.beginPath();
    c.moveTo(r * 0.2, -r * 0.5);
    c.quadraticCurveTo(r * 0.3, -r * 1.3, r * 0.5, -r * 1.2);
    c.stroke();

    // 葉
    c.beginPath();
    c.ellipse(r * 0.5, -r * 1.15, r * 0.4, r * 0.2, 0.3, 0, Math.PI * 2);
    c.fillStyle = '#4CAF50';
    c.fill();

    // 左の実
    drawFruitBall(c, -r * 0.35, 0, r * 0.7, info);
    // 右の実
    drawFruitBall(c, r * 0.35, 0, r * 0.7, info);
  }

  // --- いちご ---
  function drawStrawberry(c, r, info) {
    // 本体（逆三角）
    c.beginPath();
    c.moveTo(0, r * 0.9);
    c.quadraticCurveTo(-r * 1.1, r * 0.1, -r * 0.6, -r * 0.6);
    c.quadraticCurveTo(0, -r * 1.0, r * 0.6, -r * 0.6);
    c.quadraticCurveTo(r * 1.1, r * 0.1, 0, r * 0.9);
    c.closePath();
    var grad = c.createRadialGradient(-r * 0.2, -r * 0.1, 0, 0, 0, r);
    grad.addColorStop(0, info.highlight);
    grad.addColorStop(0.7, info.color);
    grad.addColorStop(1, info.shadow);
    c.fillStyle = grad;
    c.fill();

    // 種
    c.fillStyle = '#F4D03F';
    var seeds = [
      [-r * 0.25, -r * 0.2], [r * 0.2, -r * 0.15],
      [-r * 0.35, r * 0.15], [r * 0.3, r * 0.2],
      [-r * 0.15, r * 0.45], [r * 0.1, r * 0.5],
      [0, r * 0.05]
    ];
    for (var i = 0; i < seeds.length; i++) {
      c.beginPath();
      c.ellipse(seeds[i][0], seeds[i][1], r * 0.06, r * 0.04, 0.3, 0, Math.PI * 2);
      c.fill();
    }

    // ヘタ
    c.fillStyle = '#4CAF50';
    for (var a = 0; a < 5; a++) {
      c.save();
      c.rotate(a * Math.PI * 2 / 5 - Math.PI / 2);
      c.beginPath();
      c.ellipse(0, -r * 0.7, r * 0.25, r * 0.1, 0, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }

    // ハイライト
    c.beginPath();
    c.ellipse(-r * 0.2, -r * 0.35, r * 0.2, r * 0.12, -0.3, 0, Math.PI * 2);
    c.fillStyle = 'rgba(255,255,255,0.25)';
    c.fill();
  }

  // --- ぶどう ---
  function drawGrape(c, r, info) {
    var gr = r * 0.35;
    var positions = [
      [0, -r * 0.45],
      [-gr * 0.9, -r * 0.1], [gr * 0.9, -r * 0.1],
      [-gr * 0.45, r * 0.3], [gr * 0.45, r * 0.3],
      [0, r * 0.55]
    ];

    // 茎
    c.beginPath();
    c.moveTo(0, -r * 0.45);
    c.lineTo(0, -r * 0.9);
    c.strokeStyle = '#5D4E37';
    c.lineWidth = Math.max(1.5, r * 0.08);
    c.stroke();

    // 葉
    c.beginPath();
    c.ellipse(r * 0.15, -r * 0.85, r * 0.3, r * 0.15, 0.2, 0, Math.PI * 2);
    c.fillStyle = '#4CAF50';
    c.fill();

    // 粒
    for (var i = positions.length - 1; i >= 0; i--) {
      drawFruitBall(c, positions[i][0], positions[i][1], gr, info);
    }
  }

  // --- デコポン ---
  function drawDekopon(c, r, info) {
    // 本体
    drawFruitBall(c, 0, r * 0.05, r * 0.95, info);

    // 上のでっぱり
    c.beginPath();
    c.arc(0, -r * 0.7, r * 0.3, 0, Math.PI * 2);
    var grad = c.createRadialGradient(-r * 0.05, -r * 0.75, 0, 0, -r * 0.7, r * 0.3);
    grad.addColorStop(0, '#FFB347');
    grad.addColorStop(1, info.color);
    c.fillStyle = grad;
    c.fill();

    // テクスチャ（つぶつぶ）
    c.globalAlpha = 0.08;
    for (var i = 0; i < 20; i++) {
      var ax = (Math.random() - 0.5) * r * 1.6;
      var ay = (Math.random() - 0.5) * r * 1.6;
      if (ax * ax + ay * ay < r * r * 0.8) {
        c.beginPath();
        c.arc(ax, ay + r * 0.05, r * 0.03, 0, Math.PI * 2);
        c.fillStyle = '#fff';
        c.fill();
      }
    }
    c.globalAlpha = 1;

    // 葉
    c.beginPath();
    c.ellipse(r * 0.1, -r * 0.9, r * 0.2, r * 0.08, 0.4, 0, Math.PI * 2);
    c.fillStyle = '#4CAF50';
    c.fill();
  }

  // --- 柿 ---
  function drawPersimmon(c, r, info) {
    // 本体（少し横長）
    c.beginPath();
    c.ellipse(0, 0, r * 1.05, r * 0.9, 0, 0, Math.PI * 2);
    var grad = c.createRadialGradient(-r * 0.2, -r * 0.2, 0, 0, 0, r);
    grad.addColorStop(0, info.highlight);
    grad.addColorStop(0.6, info.color);
    grad.addColorStop(1, info.shadow);
    c.fillStyle = grad;
    c.fill();

    // 縦の筋
    c.globalAlpha = 0.1;
    c.beginPath();
    c.moveTo(0, -r * 0.85);
    c.quadraticCurveTo(r * 0.1, 0, 0, r * 0.85);
    c.strokeStyle = info.shadow;
    c.lineWidth = r * 0.08;
    c.stroke();
    c.globalAlpha = 1;

    // ヘタ（4枚の星型の葉）
    c.fillStyle = '#E67E22';
    for (var a = 0; a < 4; a++) {
      c.save();
      c.rotate(a * Math.PI / 2);
      c.beginPath();
      c.ellipse(0, -r * 0.75, r * 0.22, r * 0.08, 0, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }

    // ハイライト
    c.beginPath();
    c.ellipse(-r * 0.25, -r * 0.3, r * 0.25, r * 0.12, -0.3, 0, Math.PI * 2);
    c.fillStyle = 'rgba(255,255,255,0.2)';
    c.fill();
  }

  // --- りんご ---
  function drawApple(c, r, info) {
    // 本体
    c.beginPath();
    c.moveTo(0, -r * 0.8);
    c.quadraticCurveTo(-r * 1.15, -r * 0.5, -r * 0.9, r * 0.3);
    c.quadraticCurveTo(-r * 0.4, r * 1.05, 0, r * 0.9);
    c.quadraticCurveTo(r * 0.4, r * 1.05, r * 0.9, r * 0.3);
    c.quadraticCurveTo(r * 1.15, -r * 0.5, 0, -r * 0.8);
    c.closePath();
    var grad = c.createRadialGradient(-r * 0.2, -r * 0.1, 0, 0, 0, r);
    grad.addColorStop(0, info.highlight);
    grad.addColorStop(0.5, info.color);
    grad.addColorStop(1, info.shadow);
    c.fillStyle = grad;
    c.fill();

    // 茎
    c.beginPath();
    c.moveTo(0, -r * 0.8);
    c.lineTo(r * 0.05, -r * 1.1);
    c.strokeStyle = '#5D4E37';
    c.lineWidth = Math.max(1.5, r * 0.07);
    c.stroke();

    // 葉
    c.beginPath();
    c.ellipse(r * 0.2, -r * 0.95, r * 0.25, r * 0.1, 0.5, 0, Math.PI * 2);
    c.fillStyle = '#4CAF50';
    c.fill();

    // ハイライト
    c.beginPath();
    c.ellipse(-r * 0.25, -r * 0.3, r * 0.22, r * 0.13, -0.3, 0, Math.PI * 2);
    c.fillStyle = 'rgba(255,255,255,0.25)';
    c.fill();
  }

  // --- 梨 ---
  function drawPear(c, r, info) {
    // 洋梨形状
    c.beginPath();
    c.moveTo(0, -r * 0.85);
    c.quadraticCurveTo(-r * 0.5, -r * 0.7, -r * 0.45, -r * 0.3);
    c.quadraticCurveTo(-r * 1.1, r * 0.2, -r * 0.7, r * 0.7);
    c.quadraticCurveTo(0, r * 1.1, r * 0.7, r * 0.7);
    c.quadraticCurveTo(r * 1.1, r * 0.2, r * 0.45, -r * 0.3);
    c.quadraticCurveTo(r * 0.5, -r * 0.7, 0, -r * 0.85);
    c.closePath();
    var grad = c.createRadialGradient(-r * 0.15, -r * 0.1, 0, 0, r * 0.1, r);
    grad.addColorStop(0, info.highlight);
    grad.addColorStop(0.5, info.color);
    grad.addColorStop(1, info.shadow);
    c.fillStyle = grad;
    c.fill();

    // 斑点
    c.globalAlpha = 0.12;
    c.fillStyle = info.shadow;
    for (var i = 0; i < 12; i++) {
      var px = (Math.random() - 0.5) * r * 1.2;
      var py = (Math.random() - 0.3) * r * 1.4;
      c.beginPath();
      c.arc(px, py, r * 0.03, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;

    // 茎
    c.beginPath();
    c.moveTo(0, -r * 0.85);
    c.lineTo(r * 0.05, -r * 1.1);
    c.strokeStyle = '#5D4E37';
    c.lineWidth = Math.max(1.5, r * 0.07);
    c.stroke();

    // ハイライト
    c.beginPath();
    c.ellipse(-r * 0.15, -r * 0.4, r * 0.2, r * 0.1, -0.3, 0, Math.PI * 2);
    c.fillStyle = 'rgba(255,255,255,0.22)';
    c.fill();
  }

  // --- もも ---
  function drawPeach(c, r, info) {
    // 桃型（ハートっぽい上部のくぼみ）
    c.beginPath();
    c.moveTo(0, -r * 0.65);
    c.quadraticCurveTo(-r * 0.5, -r * 1.05, -r * 0.9, -r * 0.4);
    c.quadraticCurveTo(-r * 1.1, r * 0.3, -r * 0.3, r * 0.9);
    c.quadraticCurveTo(0, r * 1.05, r * 0.3, r * 0.9);
    c.quadraticCurveTo(r * 1.1, r * 0.3, r * 0.9, -r * 0.4);
    c.quadraticCurveTo(r * 0.5, -r * 1.05, 0, -r * 0.65);
    c.closePath();
    var grad = c.createRadialGradient(-r * 0.1, -r * 0.1, 0, 0, 0, r);
    grad.addColorStop(0, '#FFE4E9');
    grad.addColorStop(0.4, info.color);
    grad.addColorStop(0.8, '#FF8FA3');
    grad.addColorStop(1, info.shadow);
    c.fillStyle = grad;
    c.fill();

    // 溝
    c.beginPath();
    c.moveTo(0, -r * 0.65);
    c.quadraticCurveTo(r * 0.05, 0, 0, r * 0.9);
    c.strokeStyle = 'rgba(200,100,120,0.15)';
    c.lineWidth = r * 0.06;
    c.stroke();

    // 葉
    c.beginPath();
    c.ellipse(r * 0.25, -r * 0.8, r * 0.3, r * 0.1, 0.5, 0, Math.PI * 2);
    c.fillStyle = '#4CAF50';
    c.fill();

    // ハイライト
    c.beginPath();
    c.ellipse(-r * 0.25, -r * 0.25, r * 0.22, r * 0.14, -0.3, 0, Math.PI * 2);
    c.fillStyle = 'rgba(255,255,255,0.3)';
    c.fill();
  }

  // --- パイナップル ---
  function drawPineapple(c, r, info) {
    // 本体（楕円）
    c.beginPath();
    c.ellipse(0, r * 0.1, r * 0.75, r * 0.85, 0, 0, Math.PI * 2);
    var grad = c.createRadialGradient(-r * 0.15, -r * 0.1, 0, 0, r * 0.1, r * 0.85);
    grad.addColorStop(0, info.highlight);
    grad.addColorStop(0.5, info.color);
    grad.addColorStop(1, '#C49922');
    c.fillStyle = grad;
    c.fill();

    // ダイヤモンドパターン
    c.globalAlpha = 0.15;
    c.strokeStyle = '#8B6914';
    c.lineWidth = Math.max(0.5, r * 0.02);
    for (var dy = -r * 0.6; dy < r * 0.8; dy += r * 0.25) {
      c.beginPath();
      c.moveTo(-r * 0.7, dy);
      c.lineTo(r * 0.7, dy);
      c.stroke();
    }
    for (var d = -1; d <= 1; d += 2) {
      for (var dx = -r * 0.6; dx < r * 0.8; dx += r * 0.25) {
        c.beginPath();
        c.moveTo(dx, -r * 0.7);
        c.lineTo(dx + d * r * 0.5, r * 0.9);
        c.stroke();
      }
    }
    c.globalAlpha = 1;

    // 葉（冠）
    var leaves = [-0.4, -0.2, 0, 0.2, 0.4];
    for (var i = 0; i < leaves.length; i++) {
      c.save();
      c.rotate(leaves[i]);
      c.beginPath();
      c.moveTo(0, -r * 0.7);
      c.quadraticCurveTo(r * 0.1, -r * 1.3, 0, -r * 1.4);
      c.quadraticCurveTo(-r * 0.1, -r * 1.3, 0, -r * 0.7);
      c.fillStyle = i % 2 === 0 ? '#4CAF50' : '#388E3C';
      c.fill();
      c.restore();
    }
  }

  // --- メロン ---
  function drawMelon(c, r, info) {
    // 本体
    drawFruitBall(c, 0, 0, r, info);

    // 網目パターン
    c.globalAlpha = 0.12;
    c.strokeStyle = '#1B7A3D';
    c.lineWidth = Math.max(0.8, r * 0.02);
    for (var a = 0; a < 6; a++) {
      c.save();
      c.rotate(a * Math.PI / 6);
      c.beginPath();
      c.moveTo(0, -r * 0.9);
      c.quadraticCurveTo(r * 0.15, 0, 0, r * 0.9);
      c.stroke();
      c.restore();
    }
    // 横の線
    for (var hy = -r * 0.6; hy <= r * 0.6; hy += r * 0.3) {
      var hw = Math.sqrt(r * r - hy * hy) * 0.9;
      c.beginPath();
      c.moveTo(-hw, hy);
      c.quadraticCurveTo(0, hy + r * 0.05, hw, hy);
      c.stroke();
    }
    c.globalAlpha = 1;

    // ヘタ
    c.beginPath();
    c.moveTo(-r * 0.08, -r * 0.9);
    c.lineTo(0, -r * 1.1);
    c.lineTo(r * 0.08, -r * 0.9);
    c.fillStyle = '#5D4E37';
    c.fill();
  }

  // --- すいか ---
  function drawWatermelon(c, r, info) {
    // 本体
    c.beginPath();
    c.arc(0, 0, r, 0, Math.PI * 2);
    var grad = c.createRadialGradient(-r * 0.2, -r * 0.2, 0, 0, 0, r);
    grad.addColorStop(0, '#58D68D');
    grad.addColorStop(0.5, '#2ECC71');
    grad.addColorStop(1, '#1A9C4E');
    c.fillStyle = grad;
    c.fill();

    // 縞模様
    c.globalAlpha = 0.2;
    c.strokeStyle = '#145A32';
    c.lineWidth = Math.max(2, r * 0.06);
    for (var s = 0; s < 8; s++) {
      c.save();
      c.rotate(s * Math.PI / 4);
      c.beginPath();
      c.moveTo(0, -r * 0.95);
      c.quadraticCurveTo(r * 0.15, 0, 0, r * 0.95);
      c.stroke();
      c.restore();
    }
    c.globalAlpha = 1;

    // ハイライト
    c.beginPath();
    c.ellipse(-r * 0.3, -r * 0.3, r * 0.3, r * 0.15, -0.4, 0, Math.PI * 2);
    c.fillStyle = 'rgba(255,255,255,0.18)';
    c.fill();

    // ヘタ
    c.beginPath();
    c.ellipse(0, -r * 0.92, r * 0.12, r * 0.06, 0, 0, Math.PI * 2);
    c.fillStyle = '#5D4E37';
    c.fill();
  }

  // --- 汎用ボール（さくらんぼの実、ぶどうの粒、メロン本体） ---
  function drawFruitBall(c, x, y, r, info) {
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    var grad = c.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
    grad.addColorStop(0, info.highlight);
    grad.addColorStop(0.6, info.color);
    grad.addColorStop(1, info.shadow);
    c.fillStyle = grad;
    c.fill();

    // ハイライト
    c.beginPath();
    c.ellipse(x - r * 0.25, y - r * 0.3, r * 0.25, r * 0.15, -0.3, 0, Math.PI * 2);
    c.fillStyle = 'rgba(255,255,255,0.25)';
    c.fill();
  }

  // ============================================
  // メイン描画
  // ============================================
  function draw() {
    // 背景
    var bgGrad = ctx.createLinearGradient(0, 0, 0, canvasH);
    bgGrad.addColorStop(0, '#FDF6E3');
    bgGrad.addColorStop(1, '#F5E6C8');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, canvasW, canvasH);

    // デッドライン
    var dlY = DEAD_LINE_Y * scaleFactor;
    ctx.save();
    ctx.setLineDash([8, 6]);
    var lineAlpha = 0.3;
    if (deadLineTimer > 0) {
      // 点滅
      lineAlpha = 0.3 + Math.sin(Date.now() * 0.01) * 0.3;
    }
    ctx.globalAlpha = lineAlpha;
    ctx.beginPath();
    ctx.moveTo(0, dlY);
    ctx.lineTo(canvasW, dlY);
    ctx.strokeStyle = '#E74C3C';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    ctx.restore();

    // 壁の見た目
    ctx.fillStyle = '#D2B48C';
    ctx.fillRect(0, 0, 3, canvasH);
    ctx.fillRect(canvasW - 3, 0, 3, canvasH);
    ctx.fillRect(0, canvasH - 3, canvasW, 3);

    // マージフラッシュ
    for (var f = 0; f < mergeFlashes.length; f++) {
      var flash = mergeFlashes[f];
      ctx.save();
      ctx.globalAlpha = flash.life * 0.5;
      ctx.beginPath();
      ctx.arc(flash.x, flash.y, flash.radius * (2 - flash.life), 0, Math.PI * 2);
      ctx.fillStyle = '#FFF';
      ctx.fill();
      ctx.restore();
    }

    // フルーツ描画
    for (var i = 0; i < fruits.length; i++) {
      var body = fruits[i];
      if (body.merging) continue;
      var r = fruitRadius(body.fruitIndex);

      ctx.save();
      ctx.translate(body.position.x, body.position.y);
      ctx.rotate(body.angle);
      drawFruitShape(ctx, 0, 0, r, body.fruitIndex);
      ctx.restore();
    }

    // パーティクル
    for (var p = 0; p < particles.length; p++) {
      var pt = particles[p];
      ctx.save();
      ctx.globalAlpha = pt.life;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.radius, 0, Math.PI * 2);
      ctx.fillStyle = pt.color;
      ctx.fill();
      ctx.restore();
    }

    // ドロップガイド
    if (gameRunning && !gameOverFlag && canDrop) {
      var curR = fruitRadius(currentFruitIndex);
      var guideX = Math.max(WALL_THICKNESS + curR, Math.min(canvasW - WALL_THICKNESS - curR, dropX));

      // ガイドライン
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.globalAlpha = 0.2;
      ctx.beginPath();
      ctx.moveTo(guideX, dlY);
      ctx.lineTo(guideX, canvasH);
      ctx.strokeStyle = '#999';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // プレビューフルーツ
      ctx.save();
      ctx.globalAlpha = 0.7;
      drawFruitShape(ctx, guideX, dlY - curR - 5, curR, currentFruitIndex);
      ctx.restore();
    }
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
    dropX = e.clientX - rect.left;
    mouseActive = true;
  });

  canvas.addEventListener('click', function (e) {
    if (!gameRunning) return;
    var rect = canvas.getBoundingClientRect();
    dropX = e.clientX - rect.left;
    dropFruit();
  });

  canvas.addEventListener('touchstart', function (e) {
    e.preventDefault();
    if (!gameRunning) return;
    var rect = canvas.getBoundingClientRect();
    dropX = e.touches[0].clientX - rect.left;
    mouseActive = true;
  }, { passive: false });

  canvas.addEventListener('touchmove', function (e) {
    e.preventDefault();
    if (!gameRunning) return;
    var rect = canvas.getBoundingClientRect();
    dropX = e.touches[0].clientX - rect.left;
  }, { passive: false });

  canvas.addEventListener('touchend', function (e) {
    e.preventDefault();
    if (!gameRunning) return;
    dropFruit();
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
      if (!gameRunning) {
        resizeCanvas();
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
  draw();
})();
