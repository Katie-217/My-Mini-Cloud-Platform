/**
 * MyMiniCloud - Personal Engineering Blog JavaScript
 * Quản lý chuyển tab giao diện (Home / Articles) và bộ lọc chuyên mục
 */

(function () {
  'use strict';

  function switchBlogTab(tabId) {
    // Đồng bộ nút nav trên header và các nút tab khác
    document.querySelectorAll('[data-tab]').forEach(btn => {
      if (btn.getAttribute('data-tab') === tabId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    document.querySelectorAll('.blog-tab-pane').forEach(pane => {
      if (pane.id === `tab-${tabId}`) {
        pane.classList.add('active');
      } else {
        pane.classList.remove('active');
      }
    });

    // Cập nhật URL hash nhẹ nhàng mà không nhảy trang
    if (history.replaceState) {
      history.replaceState(null, '', tabId === 'home' ? '/blog/' : `/blog/#${tabId}`);
    }
  }

  function filterBlogArticles(category) {
    document.querySelectorAll('.blog-filter-btn').forEach(btn => {
      if (btn.getAttribute('data-filter') === category) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    const cards = document.querySelectorAll('.personal-blog-card');
    cards.forEach(card => {
      const cardCat = card.getAttribute('data-category');
      if (category === 'all' || cardCat === category) {
        card.style.display = 'flex';
      } else {
        card.style.display = 'none';
      }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    // 1. Chuyển tab trên Header (Home, Articles)
    document.querySelectorAll('[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        switchBlogTab(tab);
      });
    });

    // 2. Nút chuyển nhanh trong trang (Quick Action hoặc CTA)
    document.querySelectorAll('[data-switch-tab]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const tab = btn.getAttribute('data-switch-tab');
        switchBlogTab(tab);
      });
    });

    // 3. Bộ lọc chuyên mục trong tab Articles
    document.querySelectorAll('.blog-filter-btn[data-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        const cat = btn.getAttribute('data-filter');
        filterBlogArticles(cat);
      });
    });

    // 4. Kiểm tra URL hash khi mở trang (#articles)
    const hash = window.location.hash.replace('#', '');
    if (hash === 'articles') {
      switchBlogTab('articles');
    }
  });
})();
