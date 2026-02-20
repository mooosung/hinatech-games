// ============================================
// タワーディフェンス ゲームロジック
// ============================================

(function () {
  'use strict';

  // ============================================
  // マップ定義 (0=空, 1=道, 2=スタート, 3=ゴール)
  // ============================================
  var MAP_COLS = 12;
  var MAP_ROWS = 9;
  var MAP = [
    [0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 0, 0, 1, 1, 1, 1, 1, 0, 0],
    [0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0],
    [0, 0, 1, 1, 1, 1, 0, 0, 0, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0],
    [0, 0, 1, 1, 1, 1, 1, 0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0, 0, 1, 1, 1, 1, 0, 0],
    [0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0]
  ];

  var PATH = [
    {r:0,c:2},{r:1,c:2},{r:2,c:2},{r:3,c:2},{r:3,c:3},{r:3,c:4},{r:3,c:5},
    {r:2,c:5},{r:1,c:5},{r:1,c:6},{r:1,c:7},{r:1,c:8},{r:1,c:9},
    {r:2,c:9},{r:3,c:9},{r:4,c:9},{r:5,c:9},{r:6,c:9},{r:7,c:9},
    {r:7,c:8},{r:7,c:7},{r:7,c:6},{r:6,c:6},{r:5,c:6},{r:5,c:5},{r:5,c:4},{r:5,c:3},{r:5,c:2},
    {r:6,c:2},{r:7,c:2},{r:8,c:2}
  ];

  // ============================================
  // タワー定義（6種類）
  // ============================================
  var TOWER_TYPES = {
    normal: { cost: 20, range: 2.2, damage: 1,   fireRate: 50,  color: '#3498DB', bulletColor: '#85C1E9', name: 'ノーマル', splash: 0, slow: 0 },
    fast:   { cost: 35, range: 1.8, damage: 0.6,  fireRate: 18,  color: '#2ECC71', bulletColor: '#ABEBC6', name: 'はやい',   splash: 0, slow: 0 },
    strong: { cost: 50, range: 2.5, damage: 3.5,  fireRate: 90,  color: '#E74C3C', bulletColor: '#F5B7B1', name: 'つよい',   splash: 0, slow: 0 },
    slow:   { cost: 30, range: 2.0, damage: 0.3,  fireRate: 40,  color: '#9B59B6', bulletColor: '#D2B4DE', name: 'スロウ',   splash: 0, slow: 0.5 },
    splash: { cost: 60, range: 2.0, damage: 1.5,  fireRate: 70,  color: '#F39C12', bulletColor: '#F9E79F', name: 'ばくはつ', splash: 1.2, slow: 0 },
    sniper: { cost: 75, range: 4.0, damage: 8,    fireRate: 140, color: '#1ABC9C', bulletColor: '#A3E4D7', name: 'スナイパー', splash: 0, slow: 0 }
  };

  // ============================================
  // ゲーム定数
  // ============================================
  var INITIAL_GOLD = 100;
  var INITIAL_LIVES = 10;
  var GOLD_PER_KILL_BASE = 5;
  var ENEMY_BASE_HP = 3;
  var ENEMY_BASE_SPEED = 0.015;
  var ENEMIES_PER_WAVE_BASE = 6;
  var SPAWN_DELAY = 30;

  // ============================================
  // 状態変数
  // ============================================
  var canvas, ctx;
  var canvasW, canvasH, cellW, cellH;
  var towers = [];
  var enemies = [];
  var bullets = [];
  var particles = [];
  var gold, lives, wave, score;
  var bestScore = parseInt(localStorage.getItem('bestTowerDefense') || '0', 10);
  var gameRunning = false;
  var gameOverFlag = false;
  var animFrameId = null;
  var selectedTower = 'normal';
  var waveInProgress = false;
  var enemiesToSpawn = 0;
  var spawnTimer = 0;
  var waveDelay = 0;
  var frameCount = 0;
  var gameSpeed = 1;

  // ============================================
  // DOM要素
  // ============================================
  var scoreEl = document.getElementById('score');
  var bestScoreEl = document.getElementById('best-score');
  var waveEl = document.getElementById('wave');
  var livesEl = document.getElementById('lives');
  var goldEl = document.getElementById('gold');
  var gameOverOverlay = document.getElementById('game-over-overlay');
  var gameStartOverlay = document.getElementById('game-start-overlay');
  var finalScoreEl = document.getElementById('final-score');
  var bestResultEl = document.getElementById('best-result');

  canvas = document.getElementById('game-canvas');
  ctx = canvas.getContext('2d');

  // ============================================
  // キャンバス
  // ============================================
  function resizeCanvas() {
    var wrapper = canvas.parentElement;
    var rect = wrapper.getBoundingClientRect();
    var dpr = window.devicePixelRatio || 1;

    canvasW = rect.width;
    canvasH = rect.height;
    cellW = canvasW / MAP_COLS;
    cellH = canvasH / MAP_ROWS;

    canvas.width = canvasW * dpr;
    canvas.height = canvasH * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // ============================================
  // ユーティリティ
  // ============================================
  function cellCenter(r, c) {
    return { x: (c + 0.5) * cellW, y: (r + 0.5) * cellH };
  }

  function dist(x1, y1, x2, y2) {
    var dx = x1 - x2;
    var dy = y1 - y2;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function findTowerAt(r, c) {
    for (var i = 0; i < towers.length; i++) {
      if (towers[i].r === r && towers[i].c === c) return i;
    }
    return -1;
  }

  // ============================================
  // 敵の生成
  // ============================================
  function createEnemy() {
    var hp = ENEMY_BASE_HP + wave * 1.5;
    var speed = ENEMY_BASE_SPEED + wave * 0.001;
    var start = cellCenter(PATH[0].r, PATH[0].c);

    var isBoss = (wave % 5 === 0) && enemiesToSpawn === 1;
    if (isBoss) {
      hp *= 5;
      speed *= 0.6;
    }

    return {
      x: start.x,
      y: start.y,
      pathIndex: 0,
      hp: hp,
      maxHp: hp,
      speed: speed,
      baseSpeed: speed,
      radius: isBoss ? Math.min(cellW, cellH) * 0.4 : Math.min(cellW, cellH) * 0.25,
      isBoss: isBoss,
      color: isBoss ? '#8E44AD' : '#E67E22',
      slowTimer: 0
    };
  }

  // ============================================
  // タワー設置・撤去
  // ============================================
  function placeTower(r, c) {
    if (r < 0 || r >= MAP_ROWS || c < 0 || c >= MAP_COLS) return;

    // 撤去モード
    if (selectedTower === 'sell') {
      var idx = findTowerAt(r, c);
      if (idx !== -1) {
        var refund = Math.floor(TOWER_TYPES[towers[idx].type].cost / 2);
        gold += refund;
        goldEl.textContent = gold;
        towers.splice(idx, 1);
      }
      return;
    }

    if (MAP[r][c] !== 0) return;
    if (findTowerAt(r, c) !== -1) return;

    var type = TOWER_TYPES[selectedTower];
    if (gold < type.cost) return;

    gold -= type.cost;
    goldEl.textContent = gold;

    var pos = cellCenter(r, c);
    towers.push({
      r: r,
      c: c,
      x: pos.x,
      y: pos.y,
      type: selectedTower,
      range: type.range * cellW,
      damage: type.damage,
      fireRate: type.fireRate,
      color: type.color,
      bulletColor: type.bulletColor,
      splash: type.splash,
      slow: type.slow,
      cooldown: 0,
      angle: 0
    });
  }

  // ============================================
  // 更新
  // ============================================
  function update() {
    if (!gameRunning || gameOverFlag) return;

    frameCount++;

    // ウェーブ間の待ち
    if (waveDelay > 0) {
      waveDelay--;
      if (waveDelay === 0) {
        startWave();
      }
      updateParticles();
      return;
    }

    // 敵のスポーン
    if (enemiesToSpawn > 0) {
      spawnTimer--;
      if (spawnTimer <= 0) {
        enemies.push(createEnemy());
        enemiesToSpawn--;
        spawnTimer = SPAWN_DELAY;
      }
    }

    // 敵の移動
    for (var i = enemies.length - 1; i >= 0; i--) {
      var e = enemies[i];

      // スロウタイマー
      if (e.slowTimer > 0) {
        e.slowTimer--;
        if (e.slowTimer <= 0) {
          e.speed = e.baseSpeed;
        }
      }

      if (e.pathIndex >= PATH.length - 1) {
        lives--;
        livesEl.textContent = lives;
        enemies.splice(i, 1);
        if (lives <= 0) {
          gameOver();
          return;
        }
        continue;
      }

      var target = cellCenter(PATH[e.pathIndex + 1].r, PATH[e.pathIndex + 1].c);
      var dx = target.x - e.x;
      var dy = target.y - e.y;
      var d = Math.sqrt(dx * dx + dy * dy);

      if (d < 2) {
        e.pathIndex++;
        e.x = target.x;
        e.y = target.y;
      } else {
        var moveSpeed = e.speed * cellW;
        e.x += (dx / d) * moveSpeed;
        e.y += (dy / d) * moveSpeed;
      }
    }

    // タワーの攻撃
    for (var t = 0; t < towers.length; t++) {
      var tower = towers[t];
      tower.cooldown--;

      var bestTarget = null;
      var bestProgress = -1;
      for (var ei = 0; ei < enemies.length; ei++) {
        var en = enemies[ei];
        var d = dist(tower.x, tower.y, en.x, en.y);
        if (d <= tower.range && en.pathIndex > bestProgress) {
          bestProgress = en.pathIndex;
          bestTarget = en;
        }
      }

      if (bestTarget) {
        tower.angle = Math.atan2(bestTarget.y - tower.y, bestTarget.x - tower.x);

        if (tower.cooldown <= 0) {
          tower.cooldown = tower.fireRate;
          bullets.push({
            x: tower.x,
            y: tower.y,
            tx: bestTarget.x,
            ty: bestTarget.y,
            target: bestTarget,
            damage: tower.damage,
            splash: tower.splash * cellW,
            slow: tower.slow,
            speed: 5,
            color: tower.bulletColor
          });
        }
      }
    }

    // 弾の移動
    for (var bi = bullets.length - 1; bi >= 0; bi--) {
      var b = bullets[bi];
      var tx = b.target ? b.target.x : b.tx;
      var ty = b.target ? b.target.y : b.ty;
      var dx = tx - b.x;
      var dy = ty - b.y;
      var d = Math.sqrt(dx * dx + dy * dy);

      if (d < 5) {
        if (b.target && b.target.hp > 0) {
          hitEnemy(b.target, b);

          // スプラッシュダメージ
          if (b.splash > 0) {
            for (var si = enemies.length - 1; si >= 0; si--) {
              if (enemies[si] === b.target) continue;
              if (dist(b.target.x, b.target.y, enemies[si].x, enemies[si].y) < b.splash) {
                hitEnemy(enemies[si], { damage: b.damage * 0.5, slow: b.slow, color: b.color, splash: 0 });
              }
            }
            // スプラッシュエフェクト
            for (var sp = 0; sp < 12; sp++) {
              var angle = (sp / 12) * Math.PI * 2;
              particles.push({
                x: b.target.x, y: b.target.y,
                vx: Math.cos(angle) * 3,
                vy: Math.sin(angle) * 3,
                life: 15,
                color: '#F39C12'
              });
            }
          }
        }
        bullets.splice(bi, 1);
      } else {
        b.x += (dx / d) * b.speed;
        b.y += (dy / d) * b.speed;
      }
    }

    updateParticles();

    // ウェーブ完了チェック
    if (waveInProgress && enemiesToSpawn === 0 && enemies.length === 0) {
      waveInProgress = false;
      wave++;
      waveEl.textContent = wave;
      waveDelay = 90;
    }
  }

  function hitEnemy(enemy, bullet) {
    enemy.hp -= bullet.damage;

    // スロウ適用
    if (bullet.slow > 0) {
      enemy.speed = enemy.baseSpeed * (1 - bullet.slow);
      enemy.slowTimer = 90;
    }

    // ヒットパーティクル
    for (var pi = 0; pi < 3; pi++) {
      particles.push({
        x: enemy.x, y: enemy.y,
        vx: (Math.random() - 0.5) * 3,
        vy: (Math.random() - 0.5) * 3,
        life: 15,
        color: bullet.color
      });
    }

    if (enemy.hp <= 0) {
      var killGold = GOLD_PER_KILL_BASE + Math.floor(wave * 0.5);
      if (enemy.isBoss) killGold *= 3;
      gold += killGold;
      goldEl.textContent = gold;
      var killScore = enemy.isBoss ? 50 + wave * 5 : 10 + wave;
      score += killScore;
      updateScore();

      for (var pi2 = 0; pi2 < 8; pi2++) {
        particles.push({
          x: enemy.x, y: enemy.y,
          vx: (Math.random() - 0.5) * 5,
          vy: (Math.random() - 0.5) * 5,
          life: 25,
          color: enemy.color
        });
      }

      var idx = enemies.indexOf(enemy);
      if (idx !== -1) enemies.splice(idx, 1);
    }
  }

  function updateParticles() {
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function startWave() {
    waveInProgress = true;
    enemiesToSpawn = ENEMIES_PER_WAVE_BASE + Math.floor(wave * 1.5);
    spawnTimer = 0;
  }

  // ============================================
  // 描画
  // ============================================
  function draw() {
    ctx.clearRect(0, 0, canvasW, canvasH);

    drawMap();
    drawTowers();
    drawEnemies();
    drawBullets();
    drawParticles();

    if (waveDelay > 0 && gameRunning) {
      ctx.save();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold ' + (cellH * 0.6) + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.globalAlpha = 0.6;
      ctx.fillText('WAVE ' + wave, canvasW / 2, canvasH / 2);
      ctx.restore();
    }

    // 早送り表示
    if (gameSpeed > 1 && gameRunning) {
      ctx.save();
      ctx.fillStyle = '#F1C40F';
      ctx.font = 'bold ' + (cellH * 0.35) + 'px sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.globalAlpha = 0.5;
      ctx.fillText('x' + gameSpeed, canvasW - 6, 4);
      ctx.restore();
    }
  }

  function drawMap() {
    for (var r = 0; r < MAP_ROWS; r++) {
      for (var c = 0; c < MAP_COLS; c++) {
        var x = c * cellW;
        var y = r * cellH;
        var tile = MAP[r][c];

        if (tile === 0) {
          ctx.fillStyle = '#2d5a27';
          ctx.fillRect(x, y, cellW, cellH);
          ctx.fillStyle = 'rgba(0,0,0,0.08)';
          if ((r + c) % 2 === 0) ctx.fillRect(x, y, cellW, cellH);
        } else if (tile === 1) {
          ctx.fillStyle = '#c4a45a';
          ctx.fillRect(x, y, cellW, cellH);
          ctx.fillStyle = 'rgba(0,0,0,0.05)';
          if ((r + c) % 2 === 0) ctx.fillRect(x, y, cellW, cellH);
        } else if (tile === 2) {
          ctx.fillStyle = '#3498DB';
          ctx.fillRect(x, y, cellW, cellH);
          ctx.fillStyle = '#fff';
          ctx.font = 'bold ' + (cellH * 0.35) + 'px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('START', x + cellW / 2, y + cellH / 2);
        } else if (tile === 3) {
          ctx.fillStyle = '#E74C3C';
          ctx.fillRect(x, y, cellW, cellH);
          ctx.fillStyle = '#fff';
          ctx.font = 'bold ' + (cellH * 0.35) + 'px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('GOAL', x + cellW / 2, y + cellH / 2);
        }

        ctx.strokeStyle = 'rgba(0,0,0,0.15)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x, y, cellW, cellH);
      }
    }

    // 撤去モード中はタワーに×マークを表示
    if (selectedTower === 'sell') {
      for (var i = 0; i < towers.length; i++) {
        var t = towers[i];
        ctx.save();
        ctx.fillStyle = 'rgba(231, 76, 60, 0.3)';
        ctx.fillRect(t.x - cellW / 2, t.y - cellH / 2, cellW, cellH);
        ctx.strokeStyle = '#E74C3C';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.7;
        var s = Math.min(cellW, cellH) * 0.2;
        ctx.beginPath();
        ctx.moveTo(t.x - s, t.y - s);
        ctx.lineTo(t.x + s, t.y + s);
        ctx.moveTo(t.x + s, t.y - s);
        ctx.lineTo(t.x - s, t.y + s);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  function drawTowers() {
    for (var i = 0; i < towers.length; i++) {
      var t = towers[i];

      // 台座
      ctx.fillStyle = '#555';
      ctx.fillRect(t.x - cellW * 0.35, t.y - cellH * 0.35, cellW * 0.7, cellH * 0.7);

      // タワー本体
      ctx.fillStyle = t.color;
      ctx.beginPath();
      ctx.arc(t.x, t.y, Math.min(cellW, cellH) * 0.28, 0, Math.PI * 2);
      ctx.fill();

      // 砲身
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.rotate(t.angle);
      ctx.fillStyle = '#333';
      var barrelLen = t.type === 'sniper' ? 0.45 : 0.35;
      ctx.fillRect(0, -2, Math.min(cellW, cellH) * barrelLen, 4);
      ctx.restore();

      // レンジ
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.range, 0, Math.PI * 2);
      ctx.strokeStyle = t.color;
      ctx.globalAlpha = 0.08;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  function drawEnemies() {
    for (var i = 0; i < enemies.length; i++) {
      var e = enemies[i];

      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
      ctx.fillStyle = e.color;
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // スロウ中の表示
      if (e.slowTimer > 0) {
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius + 2, 0, Math.PI * 2);
        ctx.strokeStyle = '#9B59B6';
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.6;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      if (e.isBoss) {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold ' + (e.radius * 0.8) + 'px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('B', e.x, e.y);
      }

      // HPバー
      var barW = e.radius * 2;
      var barH = 3;
      var barX = e.x - barW / 2;
      var barY = e.y - e.radius - 6;
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(barX, barY, barW, barH);
      var hpRatio = Math.max(0, e.hp / e.maxHp);
      ctx.fillStyle = hpRatio > 0.5 ? '#2ECC71' : hpRatio > 0.25 ? '#F1C40F' : '#E74C3C';
      ctx.fillRect(barX, barY, barW * hpRatio, barH);
    }
  }

  function drawBullets() {
    for (var i = 0; i < bullets.length; i++) {
      var b = bullets[i];
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.splash > 0 ? 4 : 3, 0, Math.PI * 2);
      ctx.fillStyle = b.color;
      ctx.fill();
    }
  }

  function drawParticles() {
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life / 25;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  // ============================================
  // スコア
  // ============================================
  function updateScore() {
    scoreEl.textContent = score;
    if (score > bestScore) {
      bestScore = score;
      bestScoreEl.textContent = bestScore;
      localStorage.setItem('bestTowerDefense', bestScore.toString());
    }
  }

  // ============================================
  // ゲーム開始
  // ============================================
  function startGame() {
    resizeCanvas();
    towers = [];
    enemies = [];
    bullets = [];
    particles = [];
    gold = INITIAL_GOLD;
    lives = INITIAL_LIVES;
    wave = 1;
    score = 0;
    gameOverFlag = false;
    waveInProgress = false;
    enemiesToSpawn = 0;
    frameCount = 0;
    gameSpeed = 1;

    scoreEl.textContent = score;
    goldEl.textContent = gold;
    livesEl.textContent = lives;
    waveEl.textContent = wave;

    // 速度ボタンリセット
    var speedBtns = document.querySelectorAll('.speed-btn');
    for (var i = 0; i < speedBtns.length; i++) {
      speedBtns[i].classList.remove('selected');
    }
    document.getElementById('btn-speed-1').classList.add('selected');

    gameOverOverlay.classList.remove('active');
    gameStartOverlay.classList.remove('active');

    gameRunning = true;
    waveDelay = 60;

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
  // ゲームループ（早送り対応）
  // ============================================
  function gameLoop() {
    for (var s = 0; s < gameSpeed; s++) {
      update();
      if (!gameRunning || gameOverFlag) break;
    }
    draw();
    if (gameRunning && !gameOverFlag) {
      animFrameId = requestAnimationFrame(gameLoop);
    }
  }

  // ============================================
  // 入力処理
  // ============================================
  function handleClick(px, py) {
    if (!gameRunning) return;
    var c = Math.floor(px / cellW);
    var r = Math.floor(py / cellH);
    placeTower(r, c);
  }

  canvas.addEventListener('click', function (e) {
    var rect = canvas.getBoundingClientRect();
    handleClick(e.clientX - rect.left, e.clientY - rect.top);
  });

  canvas.addEventListener('touchstart', function (e) {
    e.preventDefault();
    if (!gameRunning) return;
    var rect = canvas.getBoundingClientRect();
    handleClick(e.touches[0].clientX - rect.left, e.touches[0].clientY - rect.top);
  }, { passive: false });

  // タワー選択ボタン
  var towerBtns = document.querySelectorAll('.tower-btn');
  for (var i = 0; i < towerBtns.length; i++) {
    towerBtns[i].addEventListener('click', function () {
      for (var j = 0; j < towerBtns.length; j++) {
        towerBtns[j].classList.remove('selected');
      }
      this.classList.add('selected');
      selectedTower = this.getAttribute('data-tower');
    });
  }

  // 速度ボタン
  var speedBtns = document.querySelectorAll('.speed-btn');
  for (var si = 0; si < speedBtns.length; si++) {
    speedBtns[si].addEventListener('click', function () {
      for (var j = 0; j < speedBtns.length; j++) {
        speedBtns[j].classList.remove('selected');
      }
      this.classList.add('selected');
      gameSpeed = parseInt(this.getAttribute('data-speed'), 10);
    });
  }

  document.getElementById('btn-new-game').addEventListener('click', function () { startGame(); });
  document.getElementById('btn-retry').addEventListener('click', function () { startGame(); });
  document.getElementById('btn-start').addEventListener('click', function () { startGame(); });

  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      resizeCanvas();
      for (var i = 0; i < towers.length; i++) {
        var pos = cellCenter(towers[i].r, towers[i].c);
        towers[i].x = pos.x;
        towers[i].y = pos.y;
        towers[i].range = TOWER_TYPES[towers[i].type].range * cellW;
      }
      if (!gameRunning) draw();
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
