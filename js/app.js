/* =========================================================
 * ToolBox 应用核心（框架）
 * ---------------------------------------------------------
 * 职责：工具注册中心、hash 路由、侧边栏导航、明暗主题切换、
 *       以及供所有工具复用的通用 UI 助手（toast / 复制 / 图标）。
 *
 * 【如何新增一个工具】（见 index.html 底部的 script 引用区）
 *   1. 新建 js/tools/your-tool.js，调用 ToolBox.register({...})；
 *   2. 在 index.html 底部加一行 <script src="js/tools/your-tool.js" defer></script>。
 *   导航分组、首页卡片、路由 #/your-tool 均自动生成。
 *
 * 工具对象格式：
 *   {
 *     id: 'timestamp',           // 唯一 ID，路由为 #/timestamp
 *     name: '时间戳转换',          // 显示名
 *     category: '时间工具',        // 侧边栏按此字段分组
 *     description: '一句话描述',   // 首页卡片与工具页副标题
 *     icon: ToolBox.ui.icon('clock'),  // 公共图标，也可传自定义 <svg>
 *     render(body) {              // 渲染进 .tool-body 容器
 *       body.innerHTML = `...`;
 *       return function cleanup() { /* 离开页面时自动调用 *\/ };
 *     }
 *   }
 *
 * 通用约定（保持所有工具 UI 统一）：
 *   - 复制按钮：给目标元素一个 id，按钮写 data-copy="#该id"，
 *     全局代理自动完成复制 + toast 反馈，工具内无需写复制逻辑。
 *   - 样式类：.card / .card-head / .results / .result-row /
 *     .btn / .btn-ghost / .input / .textarea / .hint / .badge
 * ========================================================= */
(function () {
  'use strict';

  /* ---------- 公共图标（24x24 线性风格） ---------- */
  var svg = function (inner) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + inner + '</svg>';
  };

  var ICONS = {
    grid: svg('<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>'),
    sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>'),
    moon: svg('<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>'),
    copy: svg('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'),
    arrow: svg('<path d="M5 12h14M12 5l7 7-7 7"/>'),
    clock: svg('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>'),
    hash: svg('<line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/>'),
    user: svg('<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'),
    braces: svg('<path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5c0 1.1.9 2 2 2h1"/><path d="M16 21h1a2 2 0 0 0 2-2v-5c0-1.1.9-2 2-2a2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1"/>'),
    binary: svg('<path d="M6 4v8a2 2 0 1 0 4 0V6a2 2 0 1 0-4 0"/><path d="M14 6a2 2 0 1 1 4 0v10"/><path d="M14 16a2 2 0 1 0 4 0"/><path d="M4 20h16"/>'),
    globe: svg('<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>'),
    link: svg('<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>')
  };

  /* ---------- 状态 ---------- */
  var registry = [];        // 已注册工具
  var activeCleanup = null; // 当前工具页返回的清理函数

  /* ---------- DOM 引用 ---------- */
  var view, navGroups, topbarTitle, themeToggle;

  /* ---------- 工具函数 ---------- */
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { /* ignore */ }
    ta.remove();
    return ok;
  }

  /* ---------- 对外 API：ToolBox ---------- */
  var ToolBox = window.ToolBox = {
    tools: registry,

    /** 注册一个工具，注册后导航与首页立即更新 */
    register: function (tool) {
      if (!tool || !tool.id || !tool.render) {
        return console.warn('[ToolBox] register 失败：缺少 id 或 render 字段');
      }
      if (registry.some(function (t) { return t.id === tool.id; })) {
        return console.warn('[ToolBox] register 失败：工具 id 重复 ->', tool.id);
      }
      registry.push(tool);
      renderNav();
    },

    /** 供工具使用的通用 UI 助手 */
    ui: {
      /** 取公共图标：icon('clock') / icon('copy') …，可传自定义 svg 代替 */
      icon: function (name) { return ICONS[name] || ''; },

      escape: escapeHtml,

      /** 轻提示，type: 'success' | 'error' */
      toast: function (msg, type) {
        var el = document.createElement('div');
        el.className = 'toast ' + (type || 'success');
        el.textContent = msg;
        document.body.appendChild(el);
        requestAnimationFrame(function () { el.classList.add('show'); });
        setTimeout(function () {
          el.classList.remove('show');
          setTimeout(function () { el.remove(); }, 250);
        }, 1800);
      },

      /** 复制文本到剪贴板，返回 Promise<boolean> */
      copyText: function (text) {
        if (navigator.clipboard && window.isSecureContext) {
          return navigator.clipboard.writeText(text).then(
            function () { return true; },
            function () { return fallbackCopy(text); }
          );
        }
        return Promise.resolve(fallbackCopy(text));
      }
    }
  };

  /* ---------- 主题 ---------- */
  function applyTheme(theme, persist) {
    document.documentElement.dataset.theme = theme;
    if (persist) { try { localStorage.setItem('toolbox-theme', theme); } catch (e) { /* ignore */ } }
    themeToggle.innerHTML = theme === 'dark' ? ICONS.sun : ICONS.moon;
    themeToggle.title = theme === 'dark' ? '切换到亮色模式' : '切换到暗色模式';
  }

  function initTheme() {
    // 首帧主题已由 index.html 内联脚本设置，这里同步图标并绑定切换
    applyTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark', false);
    themeToggle.addEventListener('click', function () {
      var next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      applyTheme(next, true);
    });
  }

  /* ---------- 侧边导航 ---------- */
  function renderNav() {
    if (!navGroups) return; // DOM 未就绪时由 init() 统一渲染
    var groups = [];
    var index = {};
    registry.forEach(function (t) {
      var cat = t.category || '其他工具';
      if (index[cat] === undefined) {
        index[cat] = groups.length;
        groups.push({ name: cat, list: [] });
      }
      groups[index[cat]].list.push(t);
    });
    navGroups.innerHTML = groups.map(function (g) {
      return '<div class="nav-group">' +
        '<div class="nav-group-title">' + escapeHtml(g.name) + '</div>' +
        g.list.map(function (t) {
          return '<a class="nav-item" data-id="' + escapeHtml(t.id) + '" href="#/' + encodeURIComponent(t.id) + '">' +
            '<span class="nav-item-icon">' + t.icon + '</span>' +
            '<span>' + escapeHtml(t.name) + '</span></a>';
        }).join('') +
        '</div>';
    }).join('');
    updateActive(currentRouteId());
  }

  function updateActive(id) {
    document.querySelectorAll('.nav-item').forEach(function (el) {
      el.classList.toggle('active', el.dataset.id === id);
    });
  }

  /* ---------- 路由 ---------- */
  function currentRouteId() {
    var m = location.hash.match(/^#\/([^/?]+)/);
    return m ? decodeURIComponent(m[1]) : 'home';
  }

  function navigate() {
    var id = currentRouteId();
    if (activeCleanup) {
      try { activeCleanup(); } catch (e) { /* ignore */ }
      activeCleanup = null;
    }
    if (id === 'home') renderHome();
    else {
      var tool = null;
      for (var i = 0; i < registry.length; i++) {
        if (registry[i].id === id) { tool = registry[i]; break; }
      }
      if (tool) renderTool(tool); else renderNotFound(id);
    }
    updateActive(id);
    document.body.classList.remove('sidebar-open');
    window.scrollTo(0, 0);
  }

  function renderHome() {
    topbarTitle.textContent = 'ToolsBox';
    document.title = 'ToolsBox';
    var cards = registry.map(function (t) {
      return '<a class="tool-card" href="#/' + encodeURIComponent(t.id) + '">' +
        '<span class="tool-card-icon">' + t.icon + '</span>' +
        '<span class="tool-card-info">' +
          '<span class="tool-card-name">' + escapeHtml(t.name) + '</span>' +
          '<span class="tool-card-desc">' + escapeHtml(t.description || '') + '</span>' +
        '</span>' +
        '<span class="tool-card-arrow">' + ICONS.arrow + '</span>' +
        '</a>';
    }).join('');
    view.innerHTML =
      '<div class="home">' +
        '<div class="home-hero">' +
          '<h1><span class="grad">ToolsBox</span></h1>' +
          '<p>当前 ' + registry.length + ' 个工具</p>' +
        '</div>' +
        '<div class="tool-grid">' + cards + '</div>' +
        '<p class="home-foot">更多工具持续添加中…</p>' +
      '</div>';
  }

  function renderTool(tool) {
    topbarTitle.textContent = tool.name;
    document.title = tool.name + ' · ToolsBox';
    view.innerHTML =
      '<header class="tool-header">' +
        '<div class="tool-header-icon">' + tool.icon + '</div>' +
        '<div><h1>' + escapeHtml(tool.name) + '</h1>' +
        '<p>' + escapeHtml(tool.description || '') + '</p></div>' +
      '</header>' +
      '<div class="tool-body"></div>';
    var body = view.querySelector('.tool-body');
    activeCleanup = tool.render(body) || null; // 支持返回清理函数
  }

  function renderNotFound(id) {
    topbarTitle.textContent = '404';
    document.title = '页面不存在 · ToolsBox';
    view.innerHTML =
      '<div class="notfound card">' +
        '<h2>404</h2>' +
        '<p>未找到工具「' + escapeHtml(id) + '」，可能尚未上线。</p>' +
        '<a class="btn" href="#/">返回首页</a>' +
      '</div>';
  }

  /* ---------- 全局复制代理：data-copy="#目标id" ---------- */
  function initCopy() {
    view.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-copy]');
      if (!btn) return;
      var target = view.querySelector(btn.getAttribute('data-copy'));
      if (!target) return;
      var text = target.textContent.trim();
      if (!text) { ToolBox.ui.toast('暂无可复制的内容', 'error'); return; }
      ToolBox.ui.copyText(text).then(function (ok) {
        if (!ok) return ToolBox.ui.toast('复制失败，请手动选择复制', 'error');
        ToolBox.ui.toast('已复制到剪贴板');
        btn.classList.add('copied');
        setTimeout(function () { btn.classList.remove('copied'); }, 1200);
      });
    });
  }

  /* ---------- 移动端侧栏 ---------- */
  function initSidebar() {
    document.getElementById('menu-toggle').addEventListener('click', function () {
      document.body.classList.toggle('sidebar-open');
    });
    document.getElementById('sidebar-backdrop').addEventListener('click', function () {
      document.body.classList.remove('sidebar-open');
    });
    document.getElementById('nav').addEventListener('click', function (e) {
      if (e.target.closest('.nav-item')) document.body.classList.remove('sidebar-open');
    });
  }

  /* ---------- 启动 ---------- */
  function init() {
    view = document.getElementById('view');
    navGroups = document.getElementById('nav-groups');
    topbarTitle = document.getElementById('topbar-title');
    themeToggle = document.getElementById('theme-toggle');

    initTheme();
    renderNav();
    initCopy();
    initSidebar();
    window.addEventListener('hashchange', navigate);
    navigate(); // 首次渲染（支持刷新/直接分享链接时恢复到对应工具）
  }

  // 注意：本文件以 defer 方式最先加载，执行时 readyState 为 "interactive"，
  // 此时后续 defer 的工具脚本尚未注册，必须等 DOMContentLoaded 再初始化，
  // 否则首页会渲染为 0 个工具。
  if (document.readyState === 'loading' || document.readyState === 'interactive') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
