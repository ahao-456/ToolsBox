/* =========================================================
 * ToolsBox-Agent —— 工具库 AI 操作控制台（悬浮球）
 * ---------------------------------------------------------
 * - 右下角悬浮球：始终置顶、可拖动，点击展开/收起控制台
 * - 内置模型：通过 page-agent 官方测试代理调用 qwen3.8-flash，
 *   使用官方系统提示词与动作协议，真实驱动页面操作，无需配置 Key
 * - 自定义接口：在控制台「设置」里填写 OpenAI 兼容的
 *   API 地址 / 模型 / Key（原有逻辑保持不变）
 *
 * 对外接口：window.PageAgent.open() / close() / toggle() / send(text)
 * ========================================================= */
(function () {
  'use strict';

  if (!window.ToolBox) return;

  var CFG_KEY = 'toolbox-page-agent-config';
  var POS_KEY = 'toolbox-page-agent-pos';
  var MAX_HISTORY = 16;

  /* page-agent 官方免费测试代理（仅用于页面自动化演示，无 SLA） */
  var BUILTIN = {
    baseUrl: 'https://page-ag-testing-ohftxirgbn.cn-shanghai.fcapp.run',
    model: 'qwen3.8-flash',
    apiKey: 'NA'
  };
  var BUILTIN_MAX_STEPS = 8;

  /* 与 @page-agent/core 相同的 AgentOutput 宏工具结构 */
  var BUILTIN_TOOL = {
    type: 'function',
    function: {
      name: 'AgentOutput',
      description: 'You MUST call this tool every step!',
      parameters: {
        type: 'object',
        properties: {
          evaluation_previous_goal: { type: 'string' },
          memory: { type: 'string' },
          next_goal: { type: 'string' },
          action: {
            type: 'object',
            properties: {
              done: {
                type: 'object',
                properties: { text: { type: 'string' }, success: { type: 'boolean' } },
                required: ['text']
              },
              click_element_by_index: {
                type: 'object',
                properties: { index: { type: 'integer' } },
                required: ['index']
              },
              input_text: {
                type: 'object',
                properties: { index: { type: 'integer' }, text: { type: 'string' } },
                required: ['index', 'text']
              },
              select_dropdown_option: {
                type: 'object',
                properties: { index: { type: 'integer' }, text: { type: 'string' } },
                required: ['index', 'text']
              },
              scroll: {
                type: 'object',
                properties: {
                  down: { type: 'boolean' },
                  num_pages: { type: 'number' },
                  pixels: { type: 'integer' },
                  index: { type: 'integer' }
                }
              },
              scroll_horizontally: {
                type: 'object',
                properties: { right: { type: 'boolean' }, pixels: { type: 'integer' }, index: { type: 'integer' } }
              },
              wait: {
                type: 'object',
                properties: { seconds: { type: 'number' } }
              }
            }
          }
        },
        required: ['action']
      }
    }
  };

  var ICON = {
    spark: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z"/><path d="M19 15l.7 2.1 2.1.7-2.1.7L19 20.6l-.7-2.1-2.1-.7 2.1-.7L19 15z"/></svg>',
    close: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    gear: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    send: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 3L10.5 13.5"/><path d="M21 3l-6.5 18-4-8-8-4L21 3z"/></svg>',
    spinner: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.22-8.56"/></svg>'
  };

  var TEMPLATE =
    '<button class="pa-fab" id="pa-fab" type="button" aria-label="打开 ToolsBox-Agent" title="ToolsBox-Agent（可拖动）" draggable="false">' +
      '<span class="pa-fab-icon" id="pa-fab-icon">' + ICON.spark + '</span>' +
      '<span class="pa-fab-status" id="pa-fab-status" hidden><i></i>操作中</span>' +
    '</button>' +
    '<section class="pa-panel" id="pa-panel" role="dialog" aria-label="ToolsBox-Agent 控制台" hidden>' +
      '<header class="pa-head">' +
        '<span class="pa-orb" aria-hidden="true">' + ICON.spark + '</span>' +
        '<div class="pa-head-info">' +
          '<span class="pa-title">ToolsBox-Agent</span>' +
          '<span class="pa-status" id="pa-status">内置模型 · qwen3.8-flash</span>' +
        '</div>' +
        '<div class="pa-head-actions">' +
          '<button class="pa-icon-btn" id="pa-settings-btn" type="button" title="模型设置" aria-label="模型设置">' + ICON.gear + '</button>' +
          '<button class="pa-icon-btn" id="pa-close" type="button" title="关闭" aria-label="关闭控制台">' + ICON.close + '</button>' +
        '</div>' +
      '</header>' +
      '<div class="pa-body" id="pa-body">' +
        '<div class="pa-msgs" id="pa-msgs" aria-live="polite"></div>' +
        '<div class="pa-chips" id="pa-chips"></div>' +
      '</div>' +
      '<div class="pa-compose" id="pa-compose">' +
        '<textarea class="pa-input" id="pa-input" rows="1" spellcheck="false" placeholder="试试：打开 JSON 格式化"></textarea>' +
        '<button class="pa-send" id="pa-send" type="button" aria-label="发送">' + ICON.send + '</button>' +
      '</div>' +
      '<div class="pa-settings" id="pa-settings" hidden>' +
        '<h3>模型设置</h3>' +
        '<p class="hint">默认使用 ToolsBox-Agent 内置测试代理（qwen3.8-flash），无需配置 Key；也可以切换到自己的 OpenAI 兼容接口。</p>' +
        '<div class="pa-mode" id="pa-mode" role="group" aria-label="模型模式">' +
          '<button class="pa-mode-btn" type="button" data-mode="builtin">内置模型</button>' +
          '<button class="pa-mode-btn" type="button" data-mode="api">自定义接口</button>' +
        '</div>' +
        '<p class="pa-mode-desc" id="pa-mode-desc"></p>' +
        '<div id="pa-api-fields">' +
          '<div class="field">' +
            '<label class="label" for="pa-base">API 地址</label>' +
            '<input class="input" id="pa-base" type="text" autocomplete="off" spellcheck="false" placeholder="https://api.openai.com/v1">' +
          '</div>' +
          '<div class="field">' +
            '<label class="label" for="pa-model">模型</label>' +
            '<input class="input" id="pa-model" type="text" autocomplete="off" spellcheck="false" placeholder="gpt-4o-mini / deepseek-chat">' +
          '</div>' +
          '<div class="field">' +
            '<label class="label" for="pa-key">API Key</label>' +
            '<input class="input" id="pa-key" type="password" autocomplete="off" spellcheck="false" placeholder="sk-...">' +
          '</div>' +
          '<p class="hint">Key 只保存在当前浏览器的 localStorage，请求由浏览器直接发往上面的接口地址。</p>' +
        '</div>' +
        '<p class="pa-settings-msg" id="pa-settings-msg"></p>' +
        '<div class="pa-settings-actions">' +
          '<button class="btn" id="pa-save" type="button">保存</button>' +
          '<button class="btn btn-ghost" id="pa-clear" type="button">清除</button>' +
          '<button class="btn btn-ghost" id="pa-back" type="button">返回对话</button>' +
        '</div>' +
      '</div>' +
    '</section>';

  var QUICK = ['打开 JSON 格式化', '列出所有工具', '当前工具能做什么', '你是什么模型', '切换暗色主题'];

  var state = {
    open: false,
    settings: false,
    busy: false,
    cfg: loadCfg(),
    history: [],
    pos: loadPos(),
    drag: null
  };

  var suppressClick = false;
  var suppressTimer = null;
  var el = {};
  var actionTrace = [];       // 内置模型展示用的“执行步骤”记录
  var settingsMode = 'builtin'; // 设置面板里待保存的模式

  /* ---------------------------------------------------------
   * 存储
   * ------------------------------------------------------- */
  function loadCfg() {
    try {
      var c = JSON.parse(localStorage.getItem(CFG_KEY) || '{}') || {};
      var baseUrl = String(c.baseUrl || '');
      var model = String(c.model || '');
      var key = String(c.key || '');
      // 旧配置中的 demo 模式自动升级为内置模型；没有 mode 但 API 三项齐全时按自定义接口处理
      var mode = c.mode === 'api' ? 'api' : 'builtin';
      if (!c.mode && baseUrl && model && key) mode = 'api';
      return { mode: mode, baseUrl: baseUrl, model: model, key: key };
    } catch (e) {
      return { mode: 'builtin', baseUrl: '', model: '', key: '' };
    }
  }

  function loadPos() {
    try {
      var p = JSON.parse(localStorage.getItem(POS_KEY) || 'null');
      if (p && typeof p.x === 'number' && typeof p.y === 'number') return { x: p.x, y: p.y };
    } catch (e) { /* ignore */ }
    return null;
  }

  function savePos() {
    try { localStorage.setItem(POS_KEY, JSON.stringify(state.pos)); } catch (e) { /* ignore */ }
  }

  function aiEnabled() {
    var c = state.cfg;
    return c.mode === 'api' && !!(c.baseUrl && c.model && c.key);
  }

  function trace(label, detail) {
    actionTrace.push({ label: label, detail: detail || '' });
  }

  /* ---------------------------------------------------------
   * 通用小工具
   * ------------------------------------------------------- */
  function norm(s) {
    return String(s == null ? '' : s).toLowerCase().replace(/\s+/g, '');
  }

  function isMobile() {
    return !!(window.matchMedia && window.matchMedia('(max-width: 640px)').matches);
  }

  function isVisible(node) {
    return !!(node && node.getClientRects && node.getClientRects().length);
  }

  function viewRoot() {
    return document.getElementById('view');
  }

  function allTools() {
    return (ToolBox.tools || []).slice();
  }

  function currentRouteId() {
    var m = location.hash.match(/^#\/([^/?]+)/);
    return m ? decodeURIComponent(m[1]) : 'home';
  }

  function currentTool() {
    var id = currentRouteId();
    var tools = allTools();
    for (var i = 0; i < tools.length; i++) {
      if (tools[i].id === id) return tools[i];
    }
    return null;
  }

  /* ---------------------------------------------------------
   * 页面操作
   * ------------------------------------------------------- */
  function findTool(query) {
    var q = norm(query).replace(/(工具|页面|吧|一下)/g, '');
    if (!q) return null;
    var tools = allTools();
    var best = null, bestScore = 0;
    tools.forEach(function (t) {
      var name = norm(t.name), id = norm(t.id), desc = norm(t.description);
      var score = 0;
      if (name === q || id === q) score = 100;
      else if (name.indexOf(q) >= 0 || q.indexOf(name) >= 0) score = 82;
      else if (id.indexOf(q) >= 0) score = 70;
      else if (desc.indexOf(q) >= 0) score = 48;
      else {
        var hit = 0;
        for (var i = 0; i < q.length; i++) if (name.indexOf(q[i]) >= 0) hit++;
        if (hit / q.length >= 0.6) score = 30 + hit;
      }
      if (score > bestScore) { bestScore = score; best = t; }
    });
    return bestScore >= 30 ? best : null;
  }

  function searchTools(query) {
    var q = norm(query);
    if (!q) return [];
    return allTools().filter(function (t) {
      return norm(t.name + t.id + t.description).indexOf(q) >= 0;
    });
  }

  function openTool(tool) {
    if (!tool) return false;
    trace('打开工具', tool.name);
    var target = '#/' + encodeURIComponent(tool.id);
    if (location.hash === target) return true;
    location.hash = target;
    return true;
  }

  function setTheme(theme) {
    theme = theme === 'light' ? 'light' : 'dark';
    trace('切换主题', theme === 'dark' ? '暗色' : '亮色');
    if (ToolBox.ui && typeof ToolBox.ui.setTheme === 'function') ToolBox.ui.setTheme(theme);
    else document.documentElement.dataset.theme = theme;
  }

  function listToolsText() {
    var tools = allTools();
    trace('读取工具列表', tools.length + ' 个工具');
    if (!tools.length) return '工具库里还没有注册工具。';
    var groups = {}, order = [];
    tools.forEach(function (t) {
      var cat = t.category || '其他工具';
      if (!groups[cat]) { groups[cat] = []; order.push(cat); }
      groups[cat].push(t.name);
    });
    return '当前共有 ' + tools.length + ' 个工具：\n' +
      order.map(function (cat) { return '· ' + cat + '：' + groups[cat].join('、'); }).join('\n') +
      '\n\n说「打开 时间戳转换」即可跳转。';
  }

  function collectFields() {
    var root = viewRoot();
    var out = [];
    if (!root) return out;

    function push(ctl, label) {
      if (!ctl || out.some(function (f) { return f.el === ctl; })) return;
      var name = label || ctl.getAttribute('aria-label') || ctl.getAttribute('title') || '';
      out.push({ el: ctl, name: name, hint: ctl.getAttribute('placeholder') || '', id: ctl.id || '' });
    }

    root.querySelectorAll('.field').forEach(function (group) {
      var ctl = group.querySelector('input, textarea, select');
      var label = group.querySelector('.label');
      push(ctl, label ? label.textContent : '');
    });
    root.querySelectorAll('input, textarea, select').forEach(function (ctl) {
      push(ctl, '');
    });
    return out;
  }

  function fieldScore(field, query) {
    var q = norm(query);
    if (!q) return 0;
    var hay = norm(field.name) + '|' + norm(field.hint) + '|' + norm(field.id);
    var score = 0;
    if (hay.indexOf(q) >= 0) score = 100 - Math.min(q.length, 40);
    else {
      var parts = [norm(field.name), norm(field.hint), norm(field.id)];
      for (var i = 0; i < parts.length; i++) {
        if (parts[i] && (parts[i].indexOf(q) >= 0 || q.indexOf(parts[i]) >= 0)) { score = 70; break; }
      }
      if (!score) {
        var hit = 0;
        for (var j = 0; j < q.length; j++) if (hay.indexOf(q[j]) >= 0) hit++;
        if (hit / q.length >= 0.5) score = hit * 8;
      }
    }
    if (!score) return 0;
    // 优先文本域 / 文本输入框，避免把内容误写进下拉框
    var tag = field.el.tagName;
    if (tag === 'TEXTAREA') return score + 12;
    if (tag === 'SELECT') return score - 20;
    return score + 8;
  }

  /** 主输入控件：优先 textarea，其次文本类 input */
  function primaryField(candidates) {
    for (var i = 0; i < candidates.length; i++) {
      if (candidates[i].el.tagName === 'TEXTAREA') return candidates[i];
    }
    for (var j = 0; j < candidates.length; j++) {
      var ctl = candidates[j].el;
      if (ctl.tagName === 'INPUT' && /^(text|search|url|email|tel|password|number|date|time|datetime-local)$/.test(ctl.type)) {
        return candidates[j];
      }
    }
    return null;
  }

  function fillField(query, value) {
    var candidates = collectFields().filter(function (f) {
      var ctl = f.el;
      return isVisible(ctl) && !ctl.readOnly && ctl.disabled !== true &&
        ctl.type !== 'checkbox' && ctl.type !== 'radio' && ctl.type !== 'file';
    });
    if (!candidates.length) return { ok: false, error: '当前页面没有可填写的输入框' };

    var generic = /^(输入|输入框|框|文本框|文本域|文本|内容|值|input|textarea|field)$/.test(norm(query));
    var picked = null, bestScore = 0;

    if (generic) {
      picked = primaryField(candidates);
    } else {
      candidates.forEach(function (f) {
        var s = fieldScore(f, query);
        if (s > bestScore) { bestScore = s; picked = f; }
      });
    }
    if (!picked) {
      if (candidates.length === 1) picked = candidates[0];
      else if (generic) picked = candidates[0];
      else return { ok: false, error: '没有找到匹配「' + query + '」的输入框' };
    }

    var ctl = picked.el;
    var text = String(value == null ? '' : value);
    if (ctl.tagName === 'SELECT') {
      var matched = null;
      for (var i = 0; i < ctl.options.length; i++) {
        if (ctl.options[i].value === text || ctl.options[i].text === text) { matched = ctl.options[i]; break; }
      }
      if (!matched) return { ok: false, error: '下拉框「' + (picked.name || picked.id) + '」中没有选项「' + text + '」' };
      ctl.value = matched.value;
    } else {
      ctl.focus();
      ctl.value = text;
    }
    ctl.dispatchEvent(new Event('input', { bubbles: true }));
    ctl.dispatchEvent(new Event('change', { bubbles: true }));
    var fieldName = picked.name || picked.hint || picked.id || '输入框';
    trace('填写输入框', fieldName);
    return { ok: true, field: fieldName, value: ctl.value };
  }

  function clickByText(query) {
    var root = viewRoot();
    if (!root) return { ok: false, error: '页面尚未就绪' };
    var q = norm(query);
    if (!q) return { ok: false, error: '请说明要点击的文字' };

    var nodes = root.querySelectorAll('button, a, [role="button"], .chip, .hs-row, .cur-row');
    var best = null, bestScore = 0;
    Array.prototype.forEach.call(nodes, function (node) {
      if (node.disabled || !isVisible(node)) return;
      var text = norm(node.textContent);
      if (!text) return;
      var score = 0;
      if (text === q) score = 100;
      else if (text.indexOf(q) >= 0) score = 80;
      else if (q.indexOf(text) >= 0) score = 60;
      if (score > bestScore) { bestScore = score; best = node; }
    });

    if (!best) return { ok: false, error: '没有找到文字为「' + query + '」的按钮或链接' };
    var label = (best.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40);
    trace('点击元素', label);
    best.click();
    return { ok: true, clicked: label };
  }

  function copyResults() {
    var root = viewRoot();
    if (!root) return '页面尚未就绪。';
    var lines = [];
    root.querySelectorAll('.result-row').forEach(function (row) {
      var label = row.querySelector('.result-label');
      var value = row.querySelector('.result-value');
      var v = value ? (value.textContent || '').trim() : '';
      if (v) lines.push((label ? label.textContent.trim() + '：' : '') + v);
    });
    if (!lines.length) {
      var out = root.querySelector('.cron-out-expr, .clock-time');
      if (out && out.textContent.trim()) lines.push(out.textContent.trim());
    }
    if (!lines.length) return '当前页面暂无可复制的结果。';
    var text = lines.join('\n');
    trace('复制结果', lines.length + ' 条');
    ToolBox.ui.copyText(text).then(function (ok) {
      ToolBox.ui.toast(ok ? '已复制当前结果' : '复制失败，请手动选择');
    });
    return '已复制 ' + lines.length + ' 条结果到剪贴板。';
  }

  function clearFields() {
    var n = 0;
    collectFields().forEach(function (f) {
      var ctl = f.el;
      if (ctl.type === 'checkbox' || ctl.type === 'radio') return;
      if (ctl.value) {
        ctl.value = '';
        ctl.dispatchEvent(new Event('input', { bubbles: true }));
        ctl.dispatchEvent(new Event('change', { bubbles: true }));
        n++;
      }
    });
    if (n) trace('清空输入框', n + ' 个');
    return n ? '已清空 ' + n + ' 个输入框。' : '当前没有需要清空的输入框。';
  }

  function getPageState() {
    var tool = currentTool();
    var root = viewRoot();
    var out = {
      page: tool ? tool.name : '首页',
      toolId: tool ? tool.id : null,
      description: tool ? (tool.description || '') : '工具库首页',
      fields: [],
      buttons: [],
      results: []
    };
    if (!root) return out;

    var seen = {};
    collectFields().forEach(function (f) {
      if (!isVisible(f.el)) return;
      var label = (f.name || f.hint || f.id || '输入框').replace(/\s+/g, ' ').trim();
      var key = 'f:' + label;
      if (seen[key]) return;
      seen[key] = 1;
      out.fields.push({
        label: label,
        placeholder: f.hint,
        type: (f.el.tagName === 'TEXTAREA') ? 'textarea' : (f.el.type || 'text'),
        value: String(f.el.value || '').slice(0, 120)
      });
    });

    root.querySelectorAll('button, a.btn, .chip, .hs-row, .cur-row').forEach(function (node) {
      if (!isVisible(node)) return;
      var text = (node.textContent || '').replace(/\s+/g, ' ').trim();
      if (!text) return;
      var key = 'b:' + text;
      if (seen[key]) return;
      seen[key] = 1;
      if (out.buttons.length < 24) out.buttons.push(text.slice(0, 40));
    });

    root.querySelectorAll('.result-row').forEach(function (row) {
      var label = row.querySelector('.result-label');
      var value = row.querySelector('.result-value');
      var v = value ? (value.textContent || '').trim() : '';
      if (v) out.results.push({ label: label ? label.textContent.trim() : '', value: v.slice(0, 200) });
    });

    return out;
  }

  function pageIntro() {
    var st = getPageState();
    trace('读取页面结构', st.page);
    if (!st.toolId) {
      return '当前是首页，共有 ' + allTools().length + ' 个工具。可以说「打开 时间戳转换」或「列出所有工具」。';
    }
    var lines = ['当前工具：「' + st.page + '」。' + st.description];
    if (st.fields.length) {
      lines.push('可填写：' + st.fields.slice(0, 6).map(function (f) { return f.label; }).join('、'));
    }
    if (st.buttons.length) {
      lines.push('可点击：' + st.buttons.slice(0, 8).join('、'));
    }
    var firstField = st.fields[0] ? st.fields[0].label : '输入框';
    var firstBtn = st.buttons[0] || '按钮';
    lines.push('示例：在「' + firstField + '」填入内容，然后点击「' + firstBtn + '」。');
    return lines.join('\n');
  }

  /* ---------------------------------------------------------
   * 本地指令引擎
   * ------------------------------------------------------- */
  function searchReply(query) {
    var hits = searchTools(query);
    trace('搜索工具', query);
    if (!hits.length) return '没有找到与「' + query + '」相关的工具。';
    return '找到 ' + hits.length + ' 个相关工具：\n' +
      hits.slice(0, 8).map(function (t) { return '· ' + t.name; }).join('\n') +
      '\n可以说「打开 ' + hits[0].name + '」。';
  }

  function runLocal(input) {
    var raw = String(input || '').trim();
    var lower = raw.toLowerCase();
    if (!raw) return '请输入指令。';

    /* 本地指令模式（内置模型不可用时的兜底） */
    if (/(你是谁|你是什么|什么模型|介绍一下你|自我介绍|用的什么模型)/.test(lower)) {
      return '我是 ToolsBox-Agent。当前内置模型暂时不可用，正在使用本地指令模式，仍然可以操作工具库。\n可以点右上角齿轮切换到「自定义接口」，或者稍后重试内置模型。';
    }
    if (/^(你好|您好|嗨|hi|hello|hey)[!！。.\s]*$/i.test(raw)) {
      return '你好，我是 ToolsBox-Agent 的本地指令模式。可以直接让我操作工具库，比如「打开 JSON 格式化」。';
    }
    if (/^(谢谢|谢啦|感谢|thanks|thank you)/.test(lower)) {
      return '不客气。想继续操作的话，可以说「打开 JSON 格式化」或「当前工具能做什么」。';
    }

    /* 主题 */
    if (/(主题|模式|theme|mode|切换|换肤)/.test(lower) && /(暗|深|黑|夜间|night|dark)/.test(lower)) {
      setTheme('dark');
      return '已切换到暗色主题。';
    }
    if (/(主题|模式|theme|mode|切换|换肤)/.test(lower) && /(亮|浅|白|白天|light|day)/.test(lower)) {
      setTheme('light');
      return '已切换到亮色主题。';
    }

    /* 列表 */
    if (/(工具列表|所有工具|全部工具|有哪些工具|有什么工具|列出.*工具|list\s+tools)/.test(lower)) {
      return listToolsText();
    }

    /* 帮助 / 页面介绍 */
    if (/^(帮助|help|你能做什么|你会什么|怎么用)$/.test(lower) ||
        /(当前|这个|本页|此页).{0,4}(工具|页面).{0,4}(能|可以|做什么|介绍|怎么用|干什么)/.test(lower)) {
      return pageIntro();
    }

    /* 复制 / 清空 */
    if (/^(复制|复制结果|copy)/.test(lower)) return copyResults();
    if (/^(清空|重置|reset|clear)/.test(lower)) return clearFields();

    /* 搜索 */
    var sm = raw.match(/^(?:请)?(?:帮我)?(?:搜索|查找|找一下|找)\s*[「『“"']?(.+?)[」』”"']?$/);
    if (sm) return searchReply(sm[1]);

    /* 填写：在 X 输入 Y */
    var fm = raw.match(/(?:在|往|给)\s*[「『“"']?(.+?)[」』”"']?\s*(?:里|中|框|输入框中?)?\s*(?:输入|填入|填写|填上|填)\s*[「『“"']?(.+?)[」』”"']?$/);
    if (fm) {
      var r1 = fillField(fm[1], fm[2]);
      return r1.ok ? '已在「' + r1.field + '」填入：' + r1.value : '没有找到匹配「' + fm[1] + '」的输入框。可以说「当前工具能做什么」先看看页面。';
    }

    /* 填写：输入 Y 到 X */
    var fm2 = raw.match(/^(?:请)?(?:帮我)?(?:输入|填入|填写|填)\s*[「『“"']?(.+?)[」』”"']?\s*(?:到|进|至)\s*[「『“"']?(.+?)[」』”"']?$/);
    if (fm2) {
      var r2 = fillField(fm2[2], fm2[1]);
      return r2.ok ? '已在「' + r2.field + '」填入：' + r2.value : '没有找到匹配「' + fm2[2] + '」的输入框。';
    }

    /* 填写：把 Y 填到 X */
    var fm3 = raw.match(/^(?:请)?(?:帮我)?(?:把|将)\s*[「『“"']?(.+?)[」』”"']?\s*(?:填|输入|放)(?:到|进|入)\s*[「『“"']?(.+?)[」』”"']?$/);
    if (fm3) {
      var r3 = fillField(fm3[2], fm3[1]);
      return r3.ok ? '已在「' + r3.field + '」填入：' + r3.value : '没有找到匹配「' + fm3[2] + '」的输入框。';
    }

    /* 填写：直接输入 Y（自动选主输入框） */
    var fm4 = raw.match(/^(?:请)?(?:帮我)?(?:输入|填入|填写|填)\s*[「『“"']?(.+?)[」』”"']?$/);
    if (fm4) {
      var r4 = fillField('输入框', fm4[1]);
      return r4.ok ? '已在「' + r4.field + '」填入：' + r4.value : r4.error + '。';
    }

    /* 点击 */
    var cm = raw.match(/^(?:请)?(?:帮我)?(?:点击|点一下|按下|点|click)\s*[「『“"']?(.+?)[」』”"']?$/i);
    if (cm) {
      var cr = clickByText(cm[1]);
      return cr.ok ? '已点击「' + cr.clicked + '」。' : cr.error + '。';
    }

    /* 打开工具 */
    var om = raw.match(/^(?:请)?(?:帮我)?(?:打开|进入|跳转到?|前往|切换到|去)\s*[「『“"']?(.+?)[」』”"']?\s*(?:工具|页面)?$/);
    if (om) {
      var q = om[1].replace(/(工具|页面|吧|一下)$/g, '').trim();
      var tool = findTool(q);
      if (tool) {
        openTool(tool);
        return '已打开「' + tool.name + '」。' + (tool.description ? tool.description + '。' : '');
      }
      var hits = searchTools(q);
      if (hits.length) {
        return '没有精确匹配「' + q + '」，你是不是想找：\n' +
          hits.slice(0, 5).map(function (t) { return '· ' + t.name; }).join('\n') +
          '\n说「打开 工具名」即可。';
      }
      return '没有找到与「' + q + '」相关的工具。说「列出所有工具」看看都有什么。';
    }

    /* 直接输入工具名 */
    var bare = findTool(raw);
    if (bare) {
      openTool(bare);
      return '已打开「' + bare.name + '」。';
    }

    return '本地指令模式暂时没理解「' + raw + '」。\n可以试试：\n' +
      '· 打开 JSON 格式化\n' +
      '· 在当前工具输入框填入内容\n' +
      '· 点击「格式化」\n' +
      '· 切换暗色主题\n' +
      '· 列出所有工具';
  }

  /* ---------------------------------------------------------
   * AI（OpenAI 兼容接口 + 工具调用）
   * ------------------------------------------------------- */
  var FUNCTIONS = [
    { type: 'function', function: { name: 'list_tools', description: '列出工具库中的全部工具及分类', parameters: { type: 'object', properties: {}, required: [] } } },
    { type: 'function', function: { name: 'open_tool', description: '根据工具名称或 id 打开对应工具页面', parameters: { type: 'object', properties: { tool: { type: 'string', description: '工具名称或 id，例如“JSON 格式化”或“json”' } }, required: ['tool'] } } },
    { type: 'function', function: { name: 'set_theme', description: '切换页面主题', parameters: { type: 'object', properties: { theme: { type: 'string', enum: ['dark', 'light'], description: 'dark 或 light' } }, required: ['theme'] } } },
    { type: 'function', function: { name: 'get_page_state', description: '读取当前工具页面的输入框、按钮和结果，用于确认页面结构与下一步操作', parameters: { type: 'object', properties: {}, required: [] } } },
    { type: 'function', function: { name: 'fill_field', description: '在当前页面的输入框或文本域中填入内容，会触发页面自带的实时计算', parameters: { type: 'object', properties: { field: { type: 'string', description: '输入框的标签、占位符或 id 的一部分' }, value: { type: 'string', description: '要填入的完整内容' } }, required: ['field', 'value'] } } },
    { type: 'function', function: { name: 'click_element', description: '点击当前页面上文本匹配的按钮、链接或选项', parameters: { type: 'object', properties: { text: { type: 'string', description: '按钮或链接上的可见文字' } }, required: ['text'] } } }
  ];

  function systemPrompt() {
    var tool = currentTool();
    var catalog = allTools().map(function (t) { return t.id + '=' + t.name; }).join('；');
    return '你是 ToolsBox 的页面助手 ToolsBox-Agent，显示在页面右下角的悬浮球控制台里。\n' +
      '你可以调用工具直接操作当前网页，而不是只给建议。\n' +
      '工具库清单（id=名称）：' + catalog + '\n' +
      (tool ? '当前页面：' + tool.name + '（' + tool.id + '）——' + tool.description + '\n' : '当前页面：首页\n') +
      '规则：\n' +
      '1. 需要操作页面时优先调用提供的函数；不确定页面结构时先调用 get_page_state。\n' +
      '2. 不要编造不存在的工具或页面元素。\n' +
      '3. 操作完成后用简体中文简短说明结果，不要输出 HTML。\n' +
      '4. 与工具库无关的问题可以简短回答，但要把话题引回工具库能做的事。';
  }

  function endpoint(base) {
    var url = String(base || '').trim().replace(/\/+$/, '');
    if (!url) return '';
    return /\/chat\/completions$/i.test(url) ? url : url + '/chat/completions';
  }

  function executeAction(name, args) {
    try {
      switch (name) {
        case 'list_tools':
          return { ok: true, text: listToolsText() };
        case 'open_tool': {
          var tool = findTool(args.tool || args.name || args.query || '');
          if (!tool) return { ok: false, error: '未找到该工具' };
          openTool(tool);
          return { ok: true, opened: tool.name, id: tool.id };
        }
        case 'set_theme': {
          var theme = args.theme === 'light' ? 'light' : 'dark';
          setTheme(theme);
          return { ok: true, theme: theme };
        }
        case 'get_page_state':
          return getPageState();
        case 'fill_field': {
          var field = args.field || args.label || args.query || '';
          return fillField(field, args.value == null ? '' : args.value);
        }
        case 'click_element':
          return clickByText(args.text || args.label || '');
        default:
          return { ok: false, error: '未知操作：' + name };
      }
    } catch (e) {
      return { ok: false, error: e.message || String(e) };
    }
  }

  function requestCompletion(messages) {
    var cfg = state.cfg;
    var controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var timer = setTimeout(function () { if (controller) controller.abort(); }, 60000);
    var init = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + cfg.key
      },
      body: JSON.stringify({
        model: cfg.model,
        messages: messages,
        tools: FUNCTIONS,
        tool_choice: 'auto',
        temperature: 0.2
      })
    };
    if (controller) init.signal = controller.signal;

    return fetch(endpoint(cfg.baseUrl), init).then(function (res) {
      return res.text().then(function (text) {
        clearTimeout(timer);
        var data = null;
        try { data = JSON.parse(text); } catch (e) { /* ignore */ }
        if (!res.ok) {
          var detail = (data && data.error && (data.error.message || data.error.code)) || text.slice(0, 200) || ('HTTP ' + res.status);
          throw new Error('HTTP ' + res.status + ' · ' + detail);
        }
        if (!data) throw new Error('接口返回内容不是 JSON');
        return data;
      });
    }, function (err) {
      clearTimeout(timer);
      if (err && err.name === 'AbortError') throw new Error('请求超时（60 秒）');
      throw new Error('网络请求失败，请检查 API 地址、Key 与接口的跨域设置');
    });
  }

  function execCalls(calls, messages) {
    var chain = Promise.resolve();
    calls.forEach(function (call) {
      chain = chain.then(function () {
        var name = call.function && call.function.name;
        var args = {};
        try { args = JSON.parse((call.function && call.function.arguments) || '{}'); } catch (e) { /* ignore */ }
        var result = executeAction(name, args);
        messages.push({ role: 'tool', tool_call_id: call.id || name, content: JSON.stringify(result) });
        if (name === 'open_tool' && result && result.ok) {
          // 等 hashchange 触发、新工具渲染完成后再执行后续动作
          return new Promise(function (resolve) { setTimeout(resolve, 150); });
        }
      });
    });
    return chain;
  }

  function step(messages, depth) {
    if (depth > 5) return Promise.resolve('操作步骤过多，已暂停。');
    return requestCompletion(messages).then(function (data) {
      var msg = data.choices && data.choices[0] && data.choices[0].message;
      if (!msg) throw new Error('接口未返回有效消息');
      var calls = msg.tool_calls || [];
      if (!calls.length) return msg.content || '（AI 没有返回文本内容）';
      messages.push({ role: 'assistant', content: msg.content || null, tool_calls: calls });
      return execCalls(calls, messages).then(function () {
        return step(messages, depth + 1);
      });
    });
  }

  function callLLM() {
    var messages = [{ role: 'system', content: systemPrompt() }].concat(
      state.history.slice(-MAX_HISTORY).map(function (m) {
        return { role: m.role, content: m.content };
      })
    );
    return step(messages, 0);
  }

  /* ---------------------------------------------------------
   * 内置模型：page-agent 官方测试代理（qwen3.8-flash）
   * -------------------------------------------------------
   * 该代理要求：
   *   1. Authorization: Bearer NA
   *   2. 浏览器自动携带 Origin（需通过 http/https 打开页面）
   *   3. system 消息必须与官方默认提示词完全一致
   *      → 提示词单独放在 js/page-agent-prompt.js，请勿改动
   *   4. temperature 固定 1
   * 模型按 AgentOutput 宏工具返回动作，这里负责执行并回填状态。
   * ------------------------------------------------------- */
  function wait(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function describeElement(node) {
    var tag = node.tagName.toLowerCase();
    var label = '';
    if (tag === 'input' || tag === 'textarea' || tag === 'select') {
      label = node.getAttribute('aria-label') || node.getAttribute('placeholder') || node.value || '';
    } else {
      label = node.getAttribute('aria-label') || node.textContent || '';
    }
    label = String(label).replace(/\s+/g, ' ').trim().slice(0, 90);
    return '<' + tag + '>' + label + '</' + tag + '>';
  }

  function collectInteractive() {
    var nodes = document.querySelectorAll('a, button, input, textarea, select, [role="button"], .chip, .hs-row, .cur-row');
    var out = [];
    Array.prototype.forEach.call(nodes, function (node) {
      if (node.closest('#pa-panel') || node.closest('#pa-fab') || node.closest('.toast')) return;
      if (node.disabled) return;
      if (node.tagName === 'INPUT' && node.type === 'hidden') return;
      if (!isVisible(node)) return;
      out.push(node);
    });
    return out;
  }

  function buildBrowserState() {
    var nodes = collectInteractive();
    var lines = nodes.map(function (node, i) {
      return '[' + i + ']' + describeElement(node);
    });
    var view = document.getElementById('view');
    var text = view ? (view.innerText || '') : '';
    text = text.replace(/\n{3,}/g, '\n\n').trim().slice(0, 2500);
    return {
      nodes: nodes,
      text: 'Current URL: ' + location.href + '\n' +
        'Interactive Elements:\n' + (lines.length ? lines.join('\n') : '(none)') +
        (text ? '\n\nVisible Text:\n' + text : '')
    };
  }

  function buildBuiltinPrompt(task, step, history, browserState) {
    var historyText = history.map(function (item, i) {
      return '<step_' + (i + 1) + '>\n' +
        'Evaluation of Previous Step: ' + (item.evaluation || 'N/A') + '\n' +
        'Memory: ' + (item.memory || 'N/A') + '\n' +
        'Next Goal: ' + (item.nextGoal || 'N/A') + '\n' +
        'Action Results: ' + item.action + '\n' +
        'Result: ' + item.result + '\n' +
        '</step_' + (i + 1) + '>';
    }).join('\n\n');

    return '<agent_state>\n' +
      '<user_request>\n' + task + '\n</user_request>\n' +
      '<step_info>\nStep ' + (step + 1) + ' of ' + BUILTIN_MAX_STEPS + ' max possible steps\n' +
      'Current time: ' + new Date().toLocaleString() + '\n</step_info>\n' +
      '</agent_state>\n\n' +
      '<agent_history>\n' + historyText + '\n</agent_history>\n\n' +
      '<browser_state>\n' + browserState.text + '\n</browser_state>';
  }

  function requestBuiltin(userPrompt) {
    var systemPromptText = window.PAGE_AGENT_SYSTEM_PROMPT || '';
    if (!systemPromptText) {
      return Promise.reject(new Error('缺少官方系统提示词，请确认 js/page-agent-prompt.js 已加载'));
    }
    var controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var timer = setTimeout(function () { if (controller) controller.abort(); }, 60000);
    var init = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + BUILTIN.apiKey
        // Origin 由浏览器自动添加，不能也不需要在 fetch 里手动设置
      },
      body: JSON.stringify({
        model: BUILTIN.model,
        messages: [
          { role: 'system', content: systemPromptText },
          { role: 'user', content: userPrompt }
        ],
        temperature: 1,
        tools: [BUILTIN_TOOL],
        tool_choice: { type: 'function', function: { name: 'AgentOutput' } }
      })
    };
    if (controller) init.signal = controller.signal;

    return fetch(BUILTIN.baseUrl + '/chat/completions', init).then(function (res) {
      return res.text().then(function (text) {
        clearTimeout(timer);
        var data = null;
        try { data = JSON.parse(text); } catch (e) { /* ignore */ }
        if (!res.ok) {
          var detail = (data && data.error && (data.error.message || data.error.code)) || text.slice(0, 240) || ('HTTP ' + res.status);
          throw new Error('HTTP ' + res.status + ' · ' + detail);
        }
        if (!data) throw new Error('接口返回内容不是 JSON');
        return data;
      });
    }, function (err) {
      clearTimeout(timer);
      if (err && err.name === 'AbortError') throw new Error('请求超时（60 秒）');
      throw new Error('网络请求失败，测试代理可能已下线或当前页面不是 http/https 环境');
    });
  }

  /** 从可能带重复键/尾部残片的文本中提取第一个完整的 action 对象 */
  function extractActionFromText(text) {
    var keyIndex = text.indexOf('"action"');
    if (keyIndex < 0) return null;
    var start = text.indexOf('{', keyIndex + 8);
    if (start < 0) return null;
    var depth = 0;
    var inString = false;
    var escaped = false;
    for (var i = start; i < text.length; i++) {
      var ch = text.charAt(i);
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === '\\') escaped = true;
        else if (ch === '"') inString = false;
      } else if (ch === '"') {
        inString = true;
      } else if (ch === '{') {
        depth++;
      } else if (ch === '}') {
        depth--;
        if (depth === 0) {
          try { return { action: JSON.parse(text.slice(start, i + 1)) }; } catch (e) { return null; }
        }
      }
    }
    return null;
  }

  function parseAgentOutput(message) {
    var raw = '';
    if (message && message.tool_calls && message.tool_calls.length) {
      var call = message.tool_calls[0];
      raw = call.function && call.function.arguments;
    } else if (message && message.content) {
      raw = message.content;
    }
    if (!raw) return null;

    // 部分兼容实现会把 arguments 直接返回成对象
    if (typeof raw === 'object') {
      if (raw.action) return raw;
      if (typeof raw.message === 'string') raw = raw.message;
      else return null;
    }
    // 多模态 content 数组：拼出 text 部分
    if (Array.isArray(raw)) {
      raw = raw.map(function (part) {
        return typeof part === 'string' ? part : (part && part.text) || '';
      }).join('');
    }
    if (typeof raw !== 'string' || !raw.trim()) return null;

    var text = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    var start = text.indexOf('{');
    var end = text.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    text = text.slice(start, end + 1);
    try {
      return JSON.parse(text);
    } catch (e) {
      // 容错 1：去掉对象/数组末尾多余的逗号
      try { return JSON.parse(text.replace(/,\s*([}\]])/g, '$1')); } catch (e2) { /* ignore */ }
      // 容错 2：代理偶尔会重复 action 并追加 </parameter> 等残片，只取第一个完整 action 对象
      return extractActionFromText(text);
    }
  }

  function responseSnippet(message) {
    try {
      if (message && message.tool_calls && message.tool_calls[0]) {
        return JSON.stringify(message.tool_calls[0]).slice(0, 400);
      }
      return String((message && message.content) || '无内容').slice(0, 400);
    } catch (e) {
      return '无法读取响应内容';
    }
  }

  function builtinActionLabel(name, input, nodes) {
    switch (name) {
      case 'done':
        return '生成最终回复';
      case 'click_element_by_index': {
        var node = nodes[Number(input.index)];
        return '点击 ' + (node ? describeElement(node) : '[' + input.index + ']');
      }
      case 'input_text':
        return '填写输入框';
      case 'select_dropdown_option':
        return '选择下拉项 ' + String(input.text || '').slice(0, 20);
      case 'scroll':
        return '滚动页面';
      case 'scroll_horizontally':
        return '横向滚动';
      case 'wait':
        return '等待页面';
      default:
        return name;
    }
  }

  function executeBuiltinAction(name, input, nodes) {
    input = input || {};
    switch (name) {
      case 'done':
        trace('完成任务', input.success === false ? '未完成' : '成功');
        return Promise.resolve('Task completed');

      case 'click_element_by_index': {
        var index = Number(input.index);
        var node = nodes[index];
        if (!node) return Promise.resolve('❌ Element [' + index + '] not found');
        var desc = describeElement(node);
        trace('点击元素', '[' + index + '] ' + desc);
        try { node.scrollIntoView({ block: 'center' }); } catch (e) { /* ignore */ }
        return wait(80).then(function () {
          try { node.click(); } catch (e) { return '❌ Click failed: ' + e.message; }
          return wait(350).then(function () { return '✅ Clicked [' + index + '] ' + desc; });
        });
      }

      case 'input_text': {
        var index2 = Number(input.index);
        var node2 = nodes[index2];
        if (!node2) return Promise.resolve('❌ Element [' + index2 + '] not found');
        var value = String(input.text == null ? '' : input.text);
        trace('填写输入框', '[' + index2 + '] ' + value.slice(0, 30));
        try { node2.scrollIntoView({ block: 'center' }); } catch (e) { /* ignore */ }

        if (node2.tagName === 'SELECT') {
          var matched = null;
          for (var i = 0; i < node2.options.length; i++) {
            if (node2.options[i].text.trim() === value || node2.options[i].value === value) { matched = node2.options[i]; break; }
          }
          if (!matched) return Promise.resolve('❌ Option "' + value + '" not found');
          node2.value = matched.value;
        } else {
          node2.focus();
          node2.value = value;
        }
        node2.dispatchEvent(new Event('input', { bubbles: true }));
        node2.dispatchEvent(new Event('change', { bubbles: true }));
        try { node2.blur(); } catch (e) { /* ignore */ }
        return wait(150).then(function () { return '✅ Input [' + index2 + '] = ' + value.slice(0, 60); });
      }

      case 'select_dropdown_option': {
        var index3 = Number(input.index);
        var node3 = nodes[index3];
        if (!node3 || node3.tagName !== 'SELECT') return Promise.resolve('❌ Select [' + index3 + '] not found');
        var wanted = String(input.text || '').trim();
        var option = null;
        for (var j = 0; j < node3.options.length; j++) {
          var text = node3.options[j].text.trim();
          if (text === wanted || text.indexOf(wanted) >= 0) { option = node3.options[j]; break; }
        }
        if (!option) return Promise.resolve('❌ Option "' + wanted + '" not found');
        trace('选择选项', wanted.slice(0, 30));
        node3.value = option.value;
        node3.dispatchEvent(new Event('input', { bubbles: true }));
        node3.dispatchEvent(new Event('change', { bubbles: true }));
        return wait(150).then(function () { return '✅ Selected "' + option.text.trim() + '"'; });
      }

      case 'scroll':
      case 'scroll_horizontally': {
        var horizontal = name === 'scroll_horizontally';
        var positive = horizontal ? input.right !== false : input.down !== false;
        var pixels = Number(input.pixels);
        var pages = Number(input.num_pages);
        if (!isFinite(pixels) || pixels <= 0) {
          if (!isFinite(pages) || pages <= 0) pages = 0.1;
          pixels = pages * (horizontal ? window.innerWidth : window.innerHeight) * 0.9;
        }
        var target = nodes[Number(input.index)];
        trace(horizontal ? '横向滚动' : '滚动页面', Math.round(pixels) + 'px');
        if (target && target !== document.body) {
          if (horizontal) target.scrollLeft += positive ? pixels : -pixels;
          else target.scrollTop += positive ? pixels : -pixels;
        } else {
          window.scrollBy({
            top: horizontal ? 0 : (positive ? pixels : -pixels),
            left: horizontal ? (positive ? pixels : -pixels) : 0,
            behavior: 'smooth'
          });
        }
        return wait(320).then(function () { return '✅ Scrolled ' + Math.round(pixels) + 'px'; });
      }

      case 'wait': {
        var seconds = Math.max(1, Math.min(3, Number(input.seconds) || 1));
        trace('等待页面', seconds + ' 秒');
        return wait(seconds * 1000).then(function () { return '✅ Waited ' + seconds + 's'; });
      }

      default:
        return Promise.resolve('❌ Unsupported action: ' + name);
    }
  }

  function formatUsage(usage) {
    if (!usage || !usage.total_tokens) return '';
    return BUILTIN.model + ' · tokens ' + usage.total_tokens +
      '（prompt ' + (usage.prompt_tokens || 0) + ' / completion ' + (usage.completion_tokens || 0) + '）';
  }

  function callBuiltin(task, onProgress) {
    var history = [];
    var usage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

    function addUsage(u) {
      if (!u) return;
      ['prompt_tokens', 'completion_tokens', 'total_tokens'].forEach(function (key) {
        if (typeof u[key] === 'number') usage[key] += u[key];
      });
    }

    function loop(step) {
      if (step >= BUILTIN_MAX_STEPS) {
        return Promise.resolve({
          reply: '已达到最大步骤数（' + BUILTIN_MAX_STEPS + '），任务可能还没有完成。可以继续告诉我下一步。',
          usage: usage
        });
      }
      onProgress(step, '正在思考…');
      var browserState = buildBrowserState();
      var userPrompt = buildBuiltinPrompt(task, step, history, browserState);

      return requestBuiltin(userPrompt).then(function (data) {
        addUsage(data.usage);
        var message = data.choices && data.choices[0] && data.choices[0].message;
        if (!message) throw new Error('接口未返回有效消息');
        var output = parseAgentOutput(message);
        if (!output) throw new Error('模型没有返回可解析的动作：' + responseSnippet(message));
        var action = output.action || {};

        // 兼容嵌套 function call 格式：{"type":"function","function":{name,arguments}}
        if (action.type === 'function' && action.function) {
          var fn = action.function;
          var fnArgs = fn.arguments;
          if (typeof fnArgs === 'string') {
            try { fnArgs = JSON.parse(fnArgs); } catch (e) { /* ignore */ }
          }
          action = {};
          action[fn.name] = fnArgs;
        }

        var name = Object.keys(action)[0];
        if (!name) throw new Error('模型没有返回 action');
        name = String(name).trim();
        var input = action[name] || {};
        if (typeof input === 'string') {
          try { input = JSON.parse(input); } catch (e) { input = {}; }
        }
        onProgress(step, builtinActionLabel(name, input, browserState.nodes));

        return executeBuiltinAction(name, input, browserState.nodes).then(function (result) {
          history.push({
            evaluation: output.evaluation_previous_goal || '',
            memory: output.memory || '',
            nextGoal: output.next_goal || '',
            action: name + ' ' + JSON.stringify(input).slice(0, 300),
            result: result
          });
          if (name === 'done') {
            return { reply: input.text || '任务已完成。', usage: usage };
          }
          return loop(step + 1);
        });
      });
    }

    return loop(0);
  }

  function runBuiltin(task, pending, done, fail) {
    actionTrace = [];
    callBuiltin(task, function (step, label) {
      var text = pending.querySelector('.pa-pending-text');
      if (text) text.textContent = '第 ' + (step + 1) + ' 步 · ' + label;
      scrollMsgs();
    }).then(function (result) {
      pending.remove();
      addAgentMsg(result.reply, {
        tag: 'QWEN',
        title: '执行步骤',
        usage: formatUsage(result.usage)
      }, function () { done(result.reply, true); });
    }, function (err) {
      // 代理下线 / 403 / 网络异常时，退回本地指令，保证悬浮球仍可操作页面
      pending.remove();
      var fallback;
      try { fallback = runLocal(task); } catch (e) { fail(err); return; }
      done('内置模型暂时不可用（' + ((err && err.message) || err) + '）。\n可以点右上角齿轮切换到「自定义接口」，或稍后重试。\n已使用本地指令处理：\n' + fallback, false);
    });
  }

  /* ---------------------------------------------------------
   * 控制台 UI
   * ------------------------------------------------------- */
  function addMsg(role, text, type) {
    var node = document.createElement('div');
    node.className = 'pa-msg ' + role + (type ? ' ' + type : '');
    node.textContent = text;
    el.msgs.appendChild(node);
    scrollMsgs();
    return node;
  }

  function addPending(label) {
    var node = document.createElement('div');
    node.className = 'pa-msg bot';
    node.innerHTML = '<span class="pa-pending"><i></i><i></i><i></i></span>' +
      (label ? '<span class="pa-pending-text">' + ToolBox.ui.escape(label) + '</span>' : '');
    el.msgs.appendChild(node);
    scrollMsgs();
    return node;
  }

  /** 内置模型的回复：展示执行步骤与 token 用量，再逐字流式输出 */
  function addAgentMsg(reply, options, onDone) {
    options = options || {};
    var node = document.createElement('div');
    node.className = 'pa-msg bot pa-agent-msg';

    if (actionTrace.length) {
      var traceNode = document.createElement('div');
      traceNode.className = 'pa-trace';
      traceNode.innerHTML = '<div class="pa-trace-title"><span class="pa-agent-tag">' +
        ToolBox.ui.escape(options.tag || 'AGENT') + '</span>' +
        ToolBox.ui.escape(options.title || '执行步骤') + '</div>' +
        actionTrace.map(function (item) {
          return '<div class="pa-trace-row"><span class="pa-trace-dot"></span>' +
            '<span class="pa-trace-label">' + ToolBox.ui.escape(item.label) + '</span>' +
            (item.detail ? '<span class="pa-trace-detail">' + ToolBox.ui.escape(item.detail) + '</span>' : '') +
            '</div>';
        }).join('');
      node.appendChild(traceNode);
    }

    var textNode = document.createElement('div');
    textNode.className = 'pa-stream streaming';
    node.appendChild(textNode);

    if (options.usage) {
      var usageNode = document.createElement('div');
      usageNode.className = 'pa-usage';
      usageNode.textContent = options.usage;
      node.appendChild(usageNode);
    }

    el.msgs.appendChild(node);
    scrollMsgs();

    var chars = String(reply).split('');
    var total = chars.length;
    var chunk = Math.max(1, Math.ceil(total / 48));
    var shown = 0;
    (function tick() {
      shown = Math.min(total, shown + chunk);
      textNode.textContent = chars.slice(0, shown).join('');
      scrollMsgs();
      if (shown >= total) {
        textNode.classList.remove('streaming');
        onDone();
      } else {
        setTimeout(tick, 22);
      }
    })();
  }

  function scrollMsgs() {
    if (el.msgs) el.msgs.scrollTop = el.msgs.scrollHeight;
  }

  function setBusy(busy) {
    state.busy = busy;
    el.send.disabled = busy;
    el.fab.classList.toggle('busy', busy);
    updateFabVisual();
  }

  /** 同步悬浮球状态：执行中且面板关闭时显示旋转图标与“操作中”提示 */
  function updateFabVisual() {
    if (!el.fab) return;
    var operating = state.busy && !state.open;

    el.fab.classList.toggle('operating', operating);
    if (el.fabIcon) {
      el.fabIcon.innerHTML = operating ? ICON.spinner : (state.open ? ICON.close : ICON.spark);
    }
    if (el.fabStatus) {
      el.fabStatus.hidden = !operating;
      el.fabStatus.classList.toggle('below', !!(state.pos && state.pos.y < 48));
    }

    var label = operating
      ? 'ToolsBox-Agent 正在操作页面，点击查看进度'
      : (state.open ? '关闭 ToolsBox-Agent' : '打开 ToolsBox-Agent');
    el.fab.setAttribute('aria-label', label);
    el.fab.title = operating
      ? label
      : (state.open ? '关闭 ToolsBox-Agent' : 'ToolsBox-Agent（可拖动）');
  }

  function updateStatus() {
    var on = aiEnabled();
    el.status.textContent = on ? 'AI · ' + state.cfg.model : '内置模型 · ' + BUILTIN.model;
    el.status.classList.toggle('ai', on);
    el.status.classList.toggle('builtin', !on);
    el.input.placeholder = on
      ? '向 AI 描述要执行的操作…'
      : '试试：打开 JSON 格式化';
  }

  function renderChips() {
    el.chips.innerHTML = QUICK.map(function (text) {
      return '<button class="pa-chip" type="button">' + text + '</button>';
    }).join('');
  }

  function fillSettings() {
    el.baseUrl.value = state.cfg.baseUrl;
    el.model.value = state.cfg.model;
    el.key.value = state.cfg.key;
    settingsMode = aiEnabled() ? 'api' : 'builtin';
    updateModeUI();
    settingsMsg('', false);
  }

  function updateModeUI() {
    Array.prototype.forEach.call(el.mode.querySelectorAll('.pa-mode-btn'), function (btn) {
      var active = btn.getAttribute('data-mode') === settingsMode;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    el.apiFields.hidden = settingsMode !== 'api';
    el.modeDesc.textContent = settingsMode === 'api'
      ? '请求由浏览器直接发往你的接口地址，需要同时填写 API 地址、模型和 Key。'
      : '内置模型 qwen3.8-flash：通过 ToolsBox-Agent 内置测试代理执行真实页面操作，无需 Key；公共代理无 SLA，需要 http/https 环境，请勿输入敏感数据。';
  }

  function settingsMsg(text, isError) {
    el.settingsMsg.textContent = text;
    el.settingsMsg.className = 'pa-settings-msg' + (isError ? ' error' : '');
  }

  function setSettings(on) {
    state.settings = on;
    el.settings.hidden = !on;
    el.body.hidden = on;
    el.compose.hidden = on;
    el.settingsBtn.classList.toggle('active', on);
    if (on) fillSettings();
  }

  function send(text) {
    text = String(text || '').trim();
    if (!text || state.busy) return;

    el.input.value = '';
    el.input.style.height = 'auto';
    el.input.style.overflowY = 'hidden';
    addMsg('user', text);
    state.history.push({ role: 'user', content: text });

    var pending = addPending(aiEnabled() ? '' : '正在调用 ' + BUILTIN.model + '…');
    setBusy(true);

    function done(reply, shown) {
      pending.remove();
      reply = String(reply == null ? '' : reply).trim() || '（没有返回内容）';
      if (!shown) addMsg('bot', reply);
      state.history.push({ role: 'assistant', content: reply });
      setBusy(false);
    }

    function fail(err) {
      pending.remove();
      addMsg('bot', (aiEnabled() ? 'AI 请求失败：' : '内置模型出错：') + ((err && err.message) || err), 'error');
      setBusy(false);
    }

    if (aiEnabled()) callLLM().then(done, fail);
    else runBuiltin(text, pending, done, fail);
  }

  /* ---------- 悬浮球位置与拖动 ---------- */
  function fabSize() {
    return el.fab.offsetWidth || 56;
  }

  function applyFab(x, y) {
    var size = fabSize();
    var maxX = Math.max(8, window.innerWidth - size - 8);
    var maxY = Math.max(8, window.innerHeight - size - 8);
    state.pos = {
      x: Math.round(Math.min(Math.max(8, x), maxX)),
      y: Math.round(Math.min(Math.max(8, y), maxY))
    };
    el.fab.style.left = state.pos.x + 'px';
    el.fab.style.top = state.pos.y + 'px';
    if (el.fabStatus) el.fabStatus.classList.toggle('below', state.pos.y < 48);
  }

  function positionPanel() {
    if (!state.open) return;
    if (isMobile()) {
      el.panel.style.left = '';
      el.panel.style.top = '';
      el.panel.style.width = '';
      el.panel.style.height = '';
      return;
    }
    var w = Math.min(380, window.innerWidth - 24);
    var h = Math.min(560, window.innerHeight - 96);
    var rect = el.fab.getBoundingClientRect();
    var left = rect.left + rect.width / 2 - w / 2;
    left = Math.max(12, Math.min(left, window.innerWidth - w - 12));
    var top = rect.top - h - 12;
    if (top < 12) top = Math.max(12, Math.min(rect.bottom + 12, window.innerHeight - h - 12));

    el.panel.style.width = w + 'px';
    el.panel.style.height = h + 'px';
    el.panel.style.left = Math.round(left) + 'px';
    el.panel.style.top = Math.round(top) + 'px';
  }

  function setOpen(open) {
    state.open = open;
    el.panel.hidden = !open;
    el.fab.classList.toggle('open', open);
    updateFabVisual();
    if (open) {
      positionPanel();
      scrollMsgs();
      if (!isMobile()) setTimeout(function () { el.input.focus(); }, 60);
    } else {
      setSettings(false);
    }
  }

  function bindFab() {
    el.fab.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;

      // 新一次交互开始：清掉上一次拖拽留下的 click 抑制
      suppressClick = false;
      if (suppressTimer) { clearTimeout(suppressTimer); suppressTimer = null; }

      state.drag = { sx: e.clientX, sy: e.clientY, ox: state.pos.x, oy: state.pos.y, moved: false };
      try { el.fab.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      // 注意：这里不能 preventDefault，否则部分移动端浏览器不会派发后续 click
    });

    el.fab.addEventListener('pointermove', function (e) {
      var d = state.drag;
      if (!d) return;
      var dx = e.clientX - d.sx;
      var dy = e.clientY - d.sy;

      if (!d.moved) {
        // 用欧氏距离并放宽阈值，避免手指轻微抖动被判定为拖拽
        if (Math.sqrt(dx * dx + dy * dy) < 10) return;
        d.moved = true;
        el.fab.classList.add('dragging');
      }

      applyFab(d.ox + dx, d.oy + dy);
      if (state.open) positionPanel();
      if (e.cancelable) e.preventDefault();
    });

    function suppressNextClick() {
      suppressClick = true;
      if (suppressTimer) clearTimeout(suppressTimer);
      // 移动端 click 可能延迟，窗口留足；下一次 pointerdown 也会主动清除
      suppressTimer = setTimeout(function () {
        suppressClick = false;
        suppressTimer = null;
      }, 500);
    }

    function endDrag(e) {
      var d = state.drag;
      if (!d) return;
      state.drag = null;
      el.fab.classList.remove('dragging');
      try { el.fab.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }

      if (d.moved) {
        savePos();
        suppressNextClick();
      }
      // 单击不在这里 toggle：统一交给 click 事件，避免 pointerup + click 触发两次
    }

    el.fab.addEventListener('pointerup', endDrag);
    el.fab.addEventListener('pointercancel', function (e) {
      if (!state.drag) return;
      state.drag = null;
      el.fab.classList.remove('dragging');
      try { el.fab.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      applyFab(state.pos.x, state.pos.y);
      suppressNextClick();
    });

    // 单击（含键盘 Enter / Space）统一在这里切换面板
    el.fab.addEventListener('click', function () {
      if (suppressClick) {
        suppressClick = false;
        if (suppressTimer) { clearTimeout(suppressTimer); suppressTimer = null; }
        return;
      }
      setOpen(!state.open);
    });
  }

  function bindPanel() {
    document.getElementById('pa-close').addEventListener('click', function () { setOpen(false); });
    el.settingsBtn.addEventListener('click', function () { setSettings(!state.settings); });
    document.getElementById('pa-back').addEventListener('click', function () { setSettings(false); });

    el.send.addEventListener('click', function () { send(el.input.value); });

    el.input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        if (e.isComposing || e.keyCode === 229) return; // 中文输入法组词中
        e.preventDefault();
        send(el.input.value);
      }
    });
    el.input.addEventListener('input', function () {
      el.input.style.height = 'auto';
      var contentHeight = el.input.scrollHeight;
      el.input.style.height = Math.min(contentHeight, 96) + 'px';
      el.input.style.overflowY = contentHeight > 96 ? 'auto' : 'hidden';
    });

    el.chips.addEventListener('click', function (e) {
      var chip = e.target.closest('.pa-chip');
      if (chip) send(chip.textContent);
    });

    el.mode.addEventListener('click', function (e) {
      var btn = e.target.closest('.pa-mode-btn');
      if (!btn) return;
      settingsMode = btn.getAttribute('data-mode') === 'api' ? 'api' : 'builtin';
      updateModeUI();
      settingsMsg('', false);
    });

    document.getElementById('pa-save').addEventListener('click', function () {
      var base = el.baseUrl.value.trim();
      var model = el.model.value.trim();
      var key = el.key.value.trim();
      if (settingsMode === 'api' && !(base && model && key)) {
        settingsMsg('接入自定义接口需要同时填写 API 地址、模型和 API Key。', true);
        return;
      }
      state.cfg = { mode: settingsMode, baseUrl: base, model: model, key: key };
      try { localStorage.setItem(CFG_KEY, JSON.stringify(state.cfg)); } catch (e) { /* ignore */ }
      updateStatus();
      settingsMsg(settingsMode === 'api' ? '已保存，真实 AI 接口已启用。' : '已切换到内置模型。', false);
      addMsg('bot', settingsMode === 'api'
        ? 'AI 配置已保存，之后的消息会由「' + model + '」处理。'
        : '已切换到内置模型 ' + BUILTIN.model + '（ToolsBox-Agent 内置测试代理），无需 Key 即可操作页面。');
    });

    document.getElementById('pa-clear').addEventListener('click', function () {
      el.baseUrl.value = '';
      el.model.value = '';
      el.key.value = '';
      settingsMode = 'builtin';
      state.cfg = { mode: 'builtin', baseUrl: '', model: '', key: '' };
      try { localStorage.removeItem(CFG_KEY); } catch (e) { /* ignore */ }
      updateModeUI();
      updateStatus();
      settingsMsg('已清除本机保存的配置，恢复内置模型。', false);
    });
  }

  function onResize() {
    applyFab(state.pos.x, state.pos.y);
    if (state.open) positionPanel();
  }

  /* ---------------------------------------------------------
   * 启动
   * ------------------------------------------------------- */
  function init() {
    if (document.getElementById('pa-fab')) return;
    document.body.insertAdjacentHTML('beforeend', TEMPLATE);

    el.fab = document.getElementById('pa-fab');
    el.fabIcon = document.getElementById('pa-fab-icon');
    el.fabStatus = document.getElementById('pa-fab-status');
    el.panel = document.getElementById('pa-panel');
    el.status = document.getElementById('pa-status');
    el.body = document.getElementById('pa-body');
    el.msgs = document.getElementById('pa-msgs');
    el.chips = document.getElementById('pa-chips');
    el.compose = document.getElementById('pa-compose');
    el.input = document.getElementById('pa-input');
    el.send = document.getElementById('pa-send');
    el.settings = document.getElementById('pa-settings');
    el.settingsBtn = document.getElementById('pa-settings-btn');
    el.settingsMsg = document.getElementById('pa-settings-msg');
    el.mode = document.getElementById('pa-mode');
    el.modeDesc = document.getElementById('pa-mode-desc');
    el.apiFields = document.getElementById('pa-api-fields');
    el.baseUrl = document.getElementById('pa-base');
    el.model = document.getElementById('pa-model');
    el.key = document.getElementById('pa-key');

    bindFab();
    bindPanel();
    renderChips();
    updateStatus();

    if (!state.pos) {
      var size = fabSize();
      state.pos = { x: window.innerWidth - size - 22, y: window.innerHeight - size - 22 };
    }
    applyFab(state.pos.x, state.pos.y);
    updateFabVisual();

    addMsg('bot', aiEnabled()
      ? '我是 ToolsBox-Agent，已连接「' + state.cfg.model + '」。\n可以直接帮你操作工具库：打开工具、填参数、点按钮、切主题。'
      : '我是 ToolsBox-Agent，内置模型 ' + BUILTIN.model + ' 已就绪。\n可以直接帮你操作工具库：打开工具、填参数、点按钮、切主题。\n也可以在右上角齿轮里切换到自定义接口。');

    window.addEventListener('resize', onResize);
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (state.settings) setSettings(false);
      else if (state.open) setOpen(false);
    });

    window.PageAgent = {
      open: function () { setOpen(true); },
      close: function () { setOpen(false); },
      toggle: function () { setOpen(!state.open); },
      send: send
    };
  }

  if (document.readyState === 'complete') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
