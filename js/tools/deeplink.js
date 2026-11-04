/* =========================================================
 * 工具：Deep Link 测试
 * ---------------------------------------------------------
 * - 解析：scheme、类型（Web 链接 / 常用协议 / 自定义 scheme /
 *   intent）、host、path、参数表（原始 + 解码值）、fragment
 * - 测试打开：可点击的测试链接（用户手势最可靠）与「尝试打开」
 *   按钮，2 秒后按页面可见性给出反馈（进入后台 ≈ 已拉起应用）
 * - Android：自定义 scheme 自动生成 intent:// 模板（参数映射为
 *   S. extras，package 为占位符需自行填写）
 * - 安全：javascript: / data: / vbscript: 等危险协议禁止打开
 * 结构说明见 js/tools/timestamp.js 文件头注释。
 * ========================================================= */
(function () {
  'use strict';

  /* 工具图标（内联 SVG，随本文件加载，不依赖公共注册表） */
  var ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/><path d="M9 21h6"/></svg>';

  /* 危险协议：禁止以任何形式打开（测试工具不接受 XSS 载体） */
  var DANGEROUS = { 'javascript': 1, 'data': 1, 'vbscript': 1 };
  /* 常用标准协议（非自定义 scheme，无需 intent 转换） */
  var COMMON = {
    'http': 'Web 链接（Universal Link）', 'https': 'Web 链接（Universal Link）',
    'mailto': '邮件协议', 'tel': '电话协议', 'sms': '短信协议',
    'ftp': '文件传输协议', 'file': '本地文件协议',
    'intent': 'Android Intent 链接'
  };

  /**
   * 解析 deeplink。返回：
   * {ok, scheme, kind, desc, host, path, params:[{k, v, raw}], fragment, safe, href, originUrl}
   * 或 {ok:false, err}
   */
  function parseDeeplink(url) {
    var s = String(url).trim();
    if (!s) return { ok: false, err: '请输入链接' };
    /* 自动补全：无 scheme 时按 Web 链接处理 */
    if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(s)) s = 'https://' + s;
    var u;
    try { u = new URL(s); } catch (e) {
      return { ok: false, err: '链接格式无效，无法解析' };
    }
    var scheme = u.protocol.slice(0, -1).toLowerCase();
    var kind, desc;
    if (DANGEROUS[scheme]) {
      kind = 'danger';
      desc = '危险协议（' + scheme + ':）';
    } else if (scheme === 'intent') {
      kind = 'intent';
      desc = COMMON.intent;
    } else if (COMMON[scheme]) {
      kind = scheme === 'http' || scheme === 'https' ? 'web' : 'common';
      desc = COMMON[scheme];
    } else {
      kind = 'custom';
      desc = '自定义 scheme';
    }
    /* URL 对 mailto:/tel: 的 host 为空，正文在 pathname */
    var host = u.host || '';
    var path = u.pathname || '';
    var params = [];
    u.searchParams.forEach(function (v, k) {
      params.push({ k: k, v: v, raw: v });
    });
    return {
      ok: true, scheme: scheme, kind: kind, desc: desc,
      host: host, path: path, params: params,
      fragment: u.hash || '', safe: kind !== 'danger',
      href: u.href, originUrl: s
    };
  }

  /** 自定义 scheme → Android intent:// 模板（参数映射为 S. extras） */
  function toIntent(p) {
    var body = (p.host || '') + (p.path || '');
    var segs = ['scheme=' + p.scheme];
    p.params.forEach(function (q) {
      segs.push('S.' + q.k + '=' + encodeURIComponent(q.v).replace(/%20/g, '%20'));
    });
    segs.push('package=应用包名（需修改）');
    return 'intent://' + body + '#Intent;' + segs.join(';') + ';end';
  }

  /* ---------- 注册与渲染 ---------- */
  ToolBox.register({
    id: 'deeplink',
    name: 'Deep Link 测试',
    category: '编码 / 哈希',
    icon: ICON,
    description: '解析 Deep Link 结构并测试能否拉起应用，生成 Android intent 模板',

    render: function (root) {
      var esc = ToolBox.ui.escape;
      var iconCopy = ToolBox.ui.icon('copy');

      var EXAMPLES = [
        ['支付宝', 'alipays://platformapi/startapp?appId=20000067'],
        ['微信', 'weixin://dl/business/?t=abc123'],
        ['淘宝', 'taobao://item.taobao.com/item.htm?id=123'],
        ['邮件', 'mailto:test@example.com?subject=你好'],
        ['电话', 'tel:10086'],
        ['短信', 'sms:10086?body=你好'],
        ['intent', 'intent://scan/#Intent;scheme=zxing;package=com.google.zxing.client.android;end'],
        ['Web 链接', 'https://example.com/path?x=1']
      ];

      root.innerHTML =
        '<section class="card">' +
          '<div class="field">' +
            '<label class="label" for="dl-input">Deep Link</label>' +
            '<input id="dl-input" class="input" type="text" spellcheck="false" autocomplete="off"' +
              ' placeholder="如 weixin://dl/business/?t=abc 或 https://example.com/path">' +
          '</div>' +
          '<div class="chips" id="dl-examples">' +
            EXAMPLES.map(function (t) {
              return '<button type="button" class="chip" data-url="' + esc(t[1]) + '">' + esc(t[0]) + '</button>';
            }).join('') +
          '</div>' +
          '<div class="hint error" id="dl-err" hidden></div>' +
          '<div id="dl-parse"></div>' +
        '</section>' +

        '<section class="card" id="dl-testcard" hidden>' +
          '<div class="card-head"><h2 class="card-title">测试打开</h2>' +
            '<span class="badge" id="dl-platform"></span>' +
          '</div>' +
          '<div class="hint" id="dl-plat-note"></div>' +
          '<div class="hint error" id="dl-danger" hidden></div>' +
          '<div class="dl-actions">' +
            '<a class="btn dl-open-btn" id="dl-open" href="#">点击测试打开</a>' +
            '<button class="btn btn-ghost" type="button" id="dl-try">程序尝试</button>' +
          '</div>' +
          '<div class="hint">点击「测试打开」由浏览器发起导航（最可靠）；「程序尝试」后 2 秒内页面进入后台即视为已拉起应用</div>' +
          '<div class="results" id="dl-log"></div>' +
          '<div id="dl-intent-wrap" hidden>' +
            '<div class="cron-subtitle">Android intent:// 模板</div>' +
            '<div class="cron-out">' +
              '<span class="cron-out-expr" id="dl-intent"></span>' +
              '<button class="btn-icon" type="button" data-copy="#dl-intent" title="复制 intent 模板" aria-label="复制 intent 模板">' + iconCopy + '</button>' +
            '</div>' +
            '<div class="hint">package 为占位符，请改为目标应用包名；参数已映射为 S. 字符串 extras</div>' +
          '</div>' +
        '</section>';

      var input = root.querySelector('#dl-input');
      var errEl = root.querySelector('#dl-err');
      var parseEl = root.querySelector('#dl-parse');
      var testCard = root.querySelector('#dl-testcard');
      var platformEl = root.querySelector('#dl-platform');
      var platNoteEl = root.querySelector('#dl-plat-note');
      var dangerEl = root.querySelector('#dl-danger');
      var openLink = root.querySelector('#dl-open');
      var tryBtn = root.querySelector('#dl-try');
      var logEl = root.querySelector('#dl-log');
      var intentWrap = root.querySelector('#dl-intent-wrap');
      var intentEl = root.querySelector('#dl-intent');

      /* 平台检测：deeplink 在移动端才有意义，PC 上给出提示 */
      var isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
      platformEl.textContent = isMobile ? '移动端环境' : 'PC 环境';
      platNoteEl.textContent = isMobile
        ? '当前为移动端浏览器，自定义 scheme 有机会直接拉起应用'
        : '当前为 PC 浏览器：mailto / tel 等常用协议可拉起已注册的桌面应用；大多数自定义 scheme 仅在手机上有效，建议扫码或用手机访问本页测试';

      var parsed = null;
      var logCount = 0;

      function row(label, value, note, copyable) {
        return '<div class="result-row">' +
          '<span class="result-label">' + esc(label) + '</span>' +
          '<span class="result-value">' + (copyable ? value : esc(value)) + '</span>' +
          (note ? '<span class="cron-fnote">' + esc(note) + '</span>' : '') +
        '</div>';
      }

      function addLog(text, type) {
        logCount++;
        if (logCount > 6) logEl.removeChild(logEl.firstChild); // 只保留最近 6 条
        var time = new Date();
        var ts = ('0' + time.getHours()).slice(-2) + ':' + ('0' + time.getMinutes()).slice(-2) + ':' + ('0' + time.getSeconds()).slice(-2);
        var item = document.createElement('div');
        item.className = 'result-row';
        item.innerHTML =
          '<span class="result-label">' + ts + '</span>' +
          '<span class="result-value" style="' + (type === 'ok' ? 'color:var(--accent)' : type === 'bad' ? 'color:var(--danger)' : '') + '">' + esc(text) + '</span>';
        logEl.appendChild(item);
      }

      /** 打开尝试后的可见性检测：进入后台 ≈ 拉起成功 */
      function watchResult(label) {
        addLog(label + '已发起，等待结果…');
        var t0 = Date.now();
        setTimeout(function () {
          var hidden = document.visibilityState === 'hidden' || document.hidden;
          if (hidden) {
            addLog(label + '：页面已进入后台，大概率成功拉起应用', 'ok');
          } else {
            var el = Date.now() - t0;
            addLog(label + '：' + el + 'ms 后页面仍在前台，当前环境可能未注册该 scheme', 'bad');
          }
        }, 2000);
      }

      function doParse() {
        errEl.hidden = true;
        parseEl.innerHTML = '';
        testCard.hidden = true;
        parsed = null;
        var p = parseDeeplink(input.value);
        if (!p.ok) {
          if (input.value.trim()) { errEl.hidden = false; errEl.textContent = p.err; }
          return;
        }
        parsed = p;
        var html = '';
        html += row('协议', p.scheme + ':', p.desc);
        html += p.host ? row('Host', p.host) : '';
        html += p.path && p.path !== '/' ? row('路径', p.path) : '';
        p.params.forEach(function (q) {
          var note = q.v !== q.k && decodeURIComponent(q.v) !== q.v ? '原始值：' + q.v : '';
          html += row('参数 ' + q.k, q.v, note);
        });
        html += p.fragment ? row('Fragment', p.fragment) : '';
        if (!p.host && !p.path && !p.params.length && !p.fragment) {
          html += row('内容', p.originUrl, '该协议不带 host/path 结构');
        }
        parseEl.innerHTML = '<div class="results">' + html + '</div>';

        testCard.hidden = false;
        dangerEl.hidden = p.safe;
        openLink.hidden = !p.safe;
        tryBtn.disabled = !p.safe;
        if (p.safe) {
          openLink.href = p.href;
          openLink.textContent = '点击测试打开 ' + (p.scheme === 'http' || p.scheme === 'https' ? '（将在本页跳转）' : '');
        } else {
          dangerEl.textContent = '危险协议（' + p.scheme + ':）已拦截，不允许打开';
        }
        /* 自定义 scheme → 展示 intent 模板；intent 本身与 Web 链接不转换 */
        var showIntent = p.kind === 'custom';
        intentWrap.hidden = !showIntent;
        if (showIntent) intentEl.textContent = toIntent(p);
      }

      input.addEventListener('input', doParse);

      root.querySelector('#dl-examples').addEventListener('click', function (e) {
        var chip = e.target.closest('.chip');
        if (!chip) return;
        input.value = chip.dataset.url;
        doParse();
        ToolBox.ui.toast('已填入：' + chip.textContent);
      });

      openLink.addEventListener('click', function () {
        if (!parsed || !parsed.safe) return;
        /* Web 链接会在本页跳转离开，正常放行；自定义 scheme 留在页面等检测结果 */
        if (parsed.kind !== 'web') {
          watchResult('点击测试');
        }
      });

      tryBtn.addEventListener('click', function () {
        if (!parsed || !parsed.safe) return;
        addLog('程序尝试：location.href = ' + parsed.href.slice(0, 60) + (parsed.href.length > 60 ? '…' : ''));
        window.location.href = parsed.href;
        watchResult('程序尝试');
      });
    }
  });
})();
