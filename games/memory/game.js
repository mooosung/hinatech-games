// ============================================
// 神経衰弱（メモリーマッチ）ゲームロジック
// ============================================

(function () {
  'use strict';

  // 絵文字リスト（ペア用）
  var EMOJI_POOL = [
    // 動物
    '\uD83D\uDC36', // 犬
    '\uD83D\uDC31', // 猫
    '\uD83D\uDC2D', // ねずみ
    '\uD83D\uDC39', // ハムスター
    '\uD83D\uDC30', // うさぎ
    '\uD83E\uDD8A', // きつね
    '\uD83D\uDC3B', // くま
    '\uD83D\uDC3C', // パンダ
    '\uD83D\uDC28', // コアラ
    '\uD83E\uDD81', // ライオン
    '\uD83D\uDC2F', // とら
    '\uD83D\uDC37', // ぶた
    // 食べ物
    '\uD83C\uDF4E', // りんご
    '\uD83C\uDF53', // いちご
    '\uD83C\uDF49', // すいか
    '\uD83C\uDF4A', // みかん
    '\uD83C\uDF51', // もも
    '\uD83C\uDF52', // さくらんぼ
    '\uD83C\uDF70', // ケーキ
    '\uD83C\uDF69', // ドーナツ
    '\uD83C\uDF66', // ソフトクリーム
    '\uD83C\uDF6B', // チョコ
    '\uD83C\uDF6D', // キャンディ
    '\uD83C\uDF54'  // ハンバーガー
  ];

  // 難易度設定
  var DIFFICULTY_CONFIG = {
    easy:   { rows: 3, cols: 4, pairs: 6  },
    normal: { rows: 4, cols: 4, pairs: 8  },
    hard:   { rows: 4, cols: 6, pairs: 12 }
  };

  // ゲーム状態
  var currentDifficulty = 'normal';
  var cards = [];
  var flippedCards = [];
  var matchedPairs = 0;
  var totalPairs = 0;
  var moves = 0;
  var timerInterval = null;
  var elapsedSeconds = 0;
  var gameStarted = false;
  var isLocked = false; // 比較中の操作ロック

  // DOM要素
  var cardGrid = document.getElementById('card-grid');
  var movesEl = document.getElementById('moves');
  var timerEl = document.getElementById('timer');
  var bestScoreEl = document.getElementById('best-score');
  var difficultySelect = document.getElementById('difficulty');
  var completeOverlay = document.getElementById('game-complete-overlay');
  var starsEl = document.getElementById('stars');
  var finalMovesEl = document.getElementById('final-moves');
  var finalTimeEl = document.getElementById('final-time');
  var bestTextEl = document.getElementById('best-text');

  // ============================================
  // ユーティリティ
  // ============================================

  // 配列をシャッフル（Fisher-Yates）
  function shuffle(array) {
    var arr = array.slice();
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var temp = arr[i];
      arr[i] = arr[j];
      arr[j] = temp;
    }
    return arr;
  }

  // 秒数をm:ss形式にフォーマット
  function formatTime(seconds) {
    var m = Math.floor(seconds / 60);
    var s = seconds % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  // localStorageキー
  function bestScoreKey(difficulty) {
    return 'memoryBest_' + difficulty;
  }

  // ベストスコアの取得
  function getBestScore(difficulty) {
    var data = localStorage.getItem(bestScoreKey(difficulty));
    if (data) {
      try {
        return JSON.parse(data);
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  // ベストスコアの保存
  function saveBestScore(difficulty, moves, time) {
    var current = getBestScore(difficulty);
    // 手数が少ない方が良い。同じならタイムが短い方が良い
    if (!current || moves < current.moves || (moves === current.moves && time < current.time)) {
      localStorage.setItem(bestScoreKey(difficulty), JSON.stringify({ moves: moves, time: time }));
      return true; // 新記録
    }
    return false;
  }

  // ベストスコアの表示を更新
  function updateBestDisplay() {
    var best = getBestScore(currentDifficulty);
    if (best) {
      bestScoreEl.textContent = best.moves + '手';
    } else {
      bestScoreEl.textContent = '-';
    }
  }

  // ============================================
  // タイマー
  // ============================================

  function startTimer() {
    if (timerInterval) return;
    timerInterval = setInterval(function () {
      elapsedSeconds++;
      timerEl.textContent = formatTime(elapsedSeconds);
    }, 1000);
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  function resetTimer() {
    stopTimer();
    elapsedSeconds = 0;
    timerEl.textContent = '0:00';
  }

  // ============================================
  // 星評価の計算
  // ============================================

  function calculateStars(moves, pairs) {
    // 理想手数 = ペア数（全てを一発で当てた場合）
    // 星3: 手数 <= ペア数 * 1.5
    // 星2: 手数 <= ペア数 * 2.5
    // 星1: それ以上
    var ratio = moves / pairs;
    if (ratio <= 1.5) return 3;
    if (ratio <= 2.5) return 2;
    return 1;
  }

  // ============================================
  // カード生成
  // ============================================

  function createCards() {
    var config = DIFFICULTY_CONFIG[currentDifficulty];
    totalPairs = config.pairs;

    // 絵文字をシャッフルして必要な数だけ取得
    var shuffledEmoji = shuffle(EMOJI_POOL);
    var selectedEmoji = shuffledEmoji.slice(0, totalPairs);

    // ペアを作る（各絵文字を2つずつ）
    var cardValues = [];
    for (var i = 0; i < selectedEmoji.length; i++) {
      cardValues.push(selectedEmoji[i]);
      cardValues.push(selectedEmoji[i]);
    }

    // シャッフル
    cardValues = shuffle(cardValues);

    return cardValues;
  }

  // ============================================
  // 描画
  // ============================================

  function renderBoard() {
    var config = DIFFICULTY_CONFIG[currentDifficulty];
    var cardValues = createCards();

    // グリッドクラスの設定
    cardGrid.className = 'card-grid grid-' + config.rows + 'x' + config.cols;

    // カード要素を生成
    cardGrid.innerHTML = '';
    cards = [];

    for (var i = 0; i < cardValues.length; i++) {
      var cardData = {
        id: i,
        value: cardValues[i],
        isFlipped: false,
        isMatched: false
      };
      cards.push(cardData);

      var cardEl = document.createElement('div');
      cardEl.className = 'card';
      cardEl.setAttribute('data-id', i);

      var inner = document.createElement('div');
      inner.className = 'card-inner';

      var back = document.createElement('div');
      back.className = 'card-back';

      var front = document.createElement('div');
      front.className = 'card-front';
      front.textContent = cardValues[i];

      inner.appendChild(back);
      inner.appendChild(front);
      cardEl.appendChild(inner);

      // クリックイベント
      cardEl.addEventListener('click', onCardClick);

      cardGrid.appendChild(cardEl);
    }
  }

  // ============================================
  // カードクリック処理
  // ============================================

  function onCardClick(e) {
    // ロック中は何もしない
    if (isLocked) return;

    var cardEl = e.currentTarget;
    var id = parseInt(cardEl.getAttribute('data-id'), 10);
    var card = cards[id];

    // 既にめくられている or マッチ済みは無視
    if (card.isFlipped || card.isMatched) return;

    // 同じカードの二重クリック防止
    if (flippedCards.length === 1 && flippedCards[0].id === id) return;

    // 最初のカードをめくった時にタイマー開始
    if (!gameStarted) {
      gameStarted = true;
      startTimer();
    }

    // カードをめくる
    card.isFlipped = true;
    cardEl.classList.add('flipped');
    flippedCards.push(card);

    // 2枚めくった場合
    if (flippedCards.length === 2) {
      moves++;
      movesEl.textContent = moves;

      var card1 = flippedCards[0];
      var card2 = flippedCards[1];

      if (card1.value === card2.value) {
        // ペア成立
        handleMatch(card1, card2);
      } else {
        // ペア不成立
        handleMismatch(card1, card2);
      }
    }
  }

  // ============================================
  // マッチ/ミスマッチ処理
  // ============================================

  function handleMatch(card1, card2) {
    card1.isMatched = true;
    card2.isMatched = true;
    matchedPairs++;

    // マッチのDOM更新
    var el1 = cardGrid.querySelector('[data-id="' + card1.id + '"]');
    var el2 = cardGrid.querySelector('[data-id="' + card2.id + '"]');

    // 少し遅延させてアニメーションを適用
    setTimeout(function () {
      if (el1) el1.classList.add('matched');
      if (el2) el2.classList.add('matched');
    }, 300);

    flippedCards = [];

    // 全ペア完了チェック
    if (matchedPairs === totalPairs) {
      setTimeout(function () {
        handleGameComplete();
      }, 600);
    }
  }

  function handleMismatch(card1, card2) {
    isLocked = true;
    cardGrid.classList.add('locked');

    // 800ms後にカードを裏返す
    setTimeout(function () {
      card1.isFlipped = false;
      card2.isFlipped = false;

      var el1 = cardGrid.querySelector('[data-id="' + card1.id + '"]');
      var el2 = cardGrid.querySelector('[data-id="' + card2.id + '"]');
      if (el1) el1.classList.remove('flipped');
      if (el2) el2.classList.remove('flipped');

      flippedCards = [];
      isLocked = false;
      cardGrid.classList.remove('locked');
    }, 800);
  }

  // ============================================
  // ゲームクリア
  // ============================================

  function handleGameComplete() {
    stopTimer();

    var starCount = calculateStars(moves, totalPairs);
    var isNewBest = saveBestScore(currentDifficulty, moves, elapsedSeconds);

    // 星の表示
    var starsHTML = '';
    for (var i = 0; i < 3; i++) {
      if (i < starCount) {
        starsHTML += '<span class="star filled">\u2B50</span>';
      } else {
        starsHTML += '<span class="star">\u2606</span>';
      }
    }
    starsEl.innerHTML = starsHTML;

    // 結果の表示
    finalMovesEl.textContent = moves;
    finalTimeEl.textContent = formatTime(elapsedSeconds);

    if (isNewBest) {
      bestTextEl.textContent = '\uD83C\uDF89 \u65B0\u8A18\u9332\uFF01';
    } else {
      var best = getBestScore(currentDifficulty);
      if (best) {
        bestTextEl.textContent = '\u30D9\u30B9\u30C8: ' + best.moves + '\u624B / ' + formatTime(best.time);
      } else {
        bestTextEl.textContent = '';
      }
    }

    // ベスト表示の更新
    updateBestDisplay();

    // オーバーレイを表示
    completeOverlay.classList.add('active');
  }

  // ============================================
  // ゲーム初期化
  // ============================================

  function initGame() {
    // 状態のリセット
    flippedCards = [];
    matchedPairs = 0;
    moves = 0;
    gameStarted = false;
    isLocked = false;

    movesEl.textContent = '0';
    resetTimer();
    completeOverlay.classList.remove('active');

    // 難易度の読み取り
    currentDifficulty = difficultySelect.value;
    updateBestDisplay();

    // ボード生成
    renderBoard();
  }

  // ============================================
  // イベントリスナー
  // ============================================

  // New Gameボタン
  document.getElementById('btn-new-game').addEventListener('click', initGame);

  // もう一度遊ぶボタン
  document.getElementById('btn-play-again').addEventListener('click', initGame);

  // 難易度変更
  difficultySelect.addEventListener('change', initGame);

  // ============================================
  // ゲーム開始
  // ============================================

  initGame();

})();
