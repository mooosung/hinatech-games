// ============================================
// ひなテックGames - 共通スクリプト
// ============================================

(function () {
  'use strict';

  // ページのベースパスを取得（data-base属性から）
  var script = document.querySelector('script[data-base]');
  var basePath = script ? script.getAttribute('data-base') : '';

  // 共通パーツを読み込んでプレースホルダーに挿入
  function loadComponent(id, file) {
    var el = document.getElementById(id);
    if (!el) return;

    fetch(basePath + file)
      .then(function (res) {
        if (!res.ok) throw new Error('Failed to load ' + file);
        return res.text();
      })
      .then(function (html) {
        // {BASE}プレースホルダーを実際のベースパスに置換
        html = html.replace(/\{BASE\}/g, basePath);
        el.innerHTML = html;

        // ヘッダー読み込み後にハンバーガーメニューを初期化
        if (id === 'header') {
          initMobileMenu();
        }
      })
      .catch(function (err) {
        console.error(err);
      });
  }

  // ハンバーガーメニューの制御
  function initMobileMenu() {
    var toggle = document.querySelector('.menu-toggle');
    var nav = document.querySelector('.header-nav');
    if (!toggle || !nav) return;

    toggle.addEventListener('click', function () {
      nav.classList.toggle('open');
      var isOpen = nav.classList.contains('open');
      toggle.setAttribute('aria-label', isOpen ? 'メニューを閉じる' : 'メニューを開く');
    });

    // ナビリンクをクリックしたらメニューを閉じる
    nav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        nav.classList.remove('open');
      });
    });
  }

  // シンタックスハイライト（Prism.js）をチュートリアルページで有効化
  function initSyntaxHighlight() {
    var codeBlocks = document.querySelectorAll('.code-block code');
    if (codeBlocks.length === 0) return;

    // <code> タグに言語クラスを付与
    codeBlocks.forEach(function (el) {
      if (!el.className.match(/language-/)) {
        el.classList.add('language-javascript');
      }
    });

    // Prism.js の CSS を読み込み
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdn.jsdelivr.net/npm/prismjs@1.29.0/themes/prism-tomorrow.min.css';
    document.head.appendChild(link);

    // Prism.js の JS を読み込み → ハイライト実行
    var s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/prismjs@1.29.0/prism.min.js';
    s.onload = function () {
      if (window.Prism) Prism.highlightAll();
    };
    document.head.appendChild(s);
  }

  // 読み込み実行
  loadComponent('header', 'components/header.html');
  loadComponent('footer', 'components/footer.html');
  initSyntaxHighlight();
})();
