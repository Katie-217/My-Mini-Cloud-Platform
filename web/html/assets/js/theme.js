/**
 * MyMiniCloud — chế độ sáng/tối dùng chung cho Portal, Student App và Blog.
 * Nạp trong <head> (không defer) để áp theme trước khi trang hiển thị, tránh nháy trắng.
 * Lựa chọn lưu trong localStorage (cùng origin nên 3 trang dùng chung); lần đầu theo cài đặt hệ điều hành.
 */
(function () {
  'use strict';

  var KEY = 'mycloud-theme';
  var root = document.documentElement;

  function stored() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }

  function preferred() {
    var saved = stored();
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function apply(theme) {
    root.setAttribute('data-theme', theme);
    root.style.colorScheme = theme;
    var btn = document.getElementById('theme-toggle-btn');
    if (btn) {
      var dark = theme === 'dark';
      btn.setAttribute('aria-pressed', String(dark));
      btn.setAttribute('aria-label', dark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối');
      btn.title = btn.getAttribute('aria-label');
      btn.innerHTML = dark ? SUN : MOON;
    }
  }

  var SUN = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"></path></svg>';
  var MOON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';

  apply(preferred());

  function toggle() {
    var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem(KEY, next); } catch (e) { /* trình duyệt chặn storage: vẫn đổi trong phiên */ }
    apply(next);
  }

  // Đổi theo hệ điều hành khi người dùng chưa tự chọn
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    var onChange = function () { if (!stored()) apply(preferred()); };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (document.getElementById('theme-toggle-btn')) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'theme-toggle-btn';
    btn.className = 'theme-toggle-btn';
    btn.addEventListener('click', toggle);

    // Vị trí nút: Portal (cạnh nút Làm mới), Student App (topbar phải), Blog (cuối thanh điều hướng)
    var refresh = document.getElementById('btn-refresh-portal-status');
    var appRight = document.querySelector('.app-topbar-right');
    var blogNav = document.querySelector('.blog-nav-inner');
    if (refresh && refresh.parentElement) {
      refresh.parentElement.insertBefore(btn, refresh);
    } else if (appRight) {
      appRight.insertBefore(btn, appRight.firstChild);
    } else if (blogNav) {
      blogNav.appendChild(btn);
    } else {
      btn.classList.add('theme-toggle-floating');
      document.body.appendChild(btn);
    }
    apply(root.getAttribute('data-theme') || preferred());
  });
})();
