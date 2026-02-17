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

  // 読み込み実行
  loadComponent('header', 'components/header.html');
  loadComponent('footer', 'components/footer.html');
})();
