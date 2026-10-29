/* =========================================================
 * 工具：时间戳转换（可作为新工具的参考模板）
 * ---------------------------------------------------------
 * 结构说明：
 *   - IIFE 内先定义该工具私有的辅助函数，最后调用 ToolBox.register
 *   - render(body) 里写入 HTML 并绑定事件，返回清理函数（可选）
 *   - 复制按钮无需写逻辑：给值元素一个 id，按钮加 data-copy="#该id"
 * ========================================================= */
(function () {
  'use strict';

  var pad = function (n) { return String(n).padStart(2, '0'); };

  function fmtLocal(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
      ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }
  function fmtLocalInput(d) { return fmtLocal(d).replace(' ', 'T'); }

  function relTime(d) {
    var diff = (Date.now() - d.getTime()) / 1000;
    var a = Math.abs(diff);
    var suf = diff >= 0 ? '前' : '后';
    if (a < 10) return '刚刚';
    if (a < 60) return Math.floor(a) + ' 秒' + suf;
    if (a < 3600) return Math.floor(a / 60) + ' 分钟' + suf;
    if (a < 86400) return Math.floor(a / 3600) + ' 小时' + suf;
    if (a < 2592000) return Math.floor(a / 86400) + ' 天' + suf;
    return '约 ' + Math.floor(a / 2592000) + ' 个月' + suf;
  }

  /** 解析时间戳字符串：10 位按秒、13 位按毫秒，其他位数按数值大小自动识别 */
  function parseTimestamp(raw) {
    var s = String(raw).trim();
    if (!/^\d{1,13}$/.test(s)) return null;
    var n = Number(s);
    var ms, unit, auto;
    if (s.length === 13)      { ms = n; unit = '毫秒'; auto = false; }
    else if (s.length === 10) { ms = n * 1000; unit = '秒'; auto = false; }
    else {
      var asMs = n > 1e12;
      ms = asMs ? n : n * 1000;
      unit = asMs ? '毫秒' : '秒';
      auto = true;
    }
    var d = new Date(ms);
    if (isNaN(d.getTime())) return null;
    return { d: d, unit: unit, auto: auto };
  }

  ToolBox.register({
    id: 'timestamp',
    name: '时间戳转换',
    category: '时间工具',
    icon: ToolBox.ui.icon('clock'),
    description: 'Unix 时间戳与日期时间双向转换，支持秒 / 毫秒自动识别、实时时钟与多格式输出',

    render: function (root) {
      var iconCopy = ToolBox.ui.icon('copy');
      var resultRow = function (label, id, title) {
        return '<div class="result-row">' +
          '<span class="result-label">' + label + '</span>' +
          '<span class="result-value" id="' + id + '"></span>' +
          '<button class="btn-icon" type="button" data-copy="#' + id + '" title="' + (title || '复制') + '" aria-label="复制">' + iconCopy + '</button>' +
          '</div>';
      };

      root.innerHTML =
        '<section class="card">' +
          '<div class="card-head"><h2 class="card-title">当前时间</h2><span class="badge live">实时</span></div>' +
          '<div class="clock-time" id="now-datetime">--</div>' +
          '<div class="results">' +
            resultRow('Unix 秒', 'now-sec', '复制秒级时间戳') +
            resultRow('Unix 毫秒', 'now-ms', '复制毫秒级时间戳') +
          '</div>' +
          '<div class="hint" id="tz-hint"></div>' +
        '</section>' +

        '<section class="card">' +
          '<div class="card-head"><h2 class="card-title">时间戳 → 日期时间</h2></div>' +
          '<div class="field">' +
            '<div class="input-group">' +
              '<input id="ts-input" class="input" type="text" inputmode="numeric" autocomplete="off" spellcheck="false"' +
                ' placeholder="输入 Unix 时间戳，如 1760000000 或 1760000000000">' +
              '<button id="ts-now" class="btn btn-ghost" type="button">当前时间戳</button>' +
            '</div>' +
            '<div class="hint" id="ts-hint">支持 10 位（秒）/ 13 位（毫秒），其他位数按数值自动识别</div>' +
          '</div>' +
          '<div class="results" id="ts-results" hidden>' +
            resultRow('本地时间', 'ts-local') +
            resultRow('ISO 8601', 'ts-iso') +
            resultRow('UTC', 'ts-utc') +
            resultRow('相对时间', 'ts-rel') +
          '</div>' +
        '</section>' +

        '<section class="card">' +
          '<div class="card-head"><h2 class="card-title">日期时间 → 时间戳</h2></div>' +
          '<div class="field">' +
            '<div class="input-group">' +
              '<input id="dt-input" class="input" type="datetime-local" step="1" aria-label="选择本地日期时间">' +
              '<button id="dt-now" class="btn btn-ghost" type="button">使用当前时间</button>' +
            '</div>' +
            '<div class="hint">选择或输入本地时间，精确到秒</div>' +
          '</div>' +
          '<div class="results" id="dt-results" hidden>' +
            resultRow('Unix 秒', 'dt-sec') +
            resultRow('Unix 毫秒', 'dt-ms') +
          '</div>' +
        '</section>';

      var $ = function (sel) { return root.querySelector(sel); };

      /* -- 时区提示 -- */
      var offMin = -new Date().getTimezoneOffset();
      var offSign = offMin >= 0 ? '+' : '-';
      var absMin = Math.abs(offMin);
      var offStr = 'UTC' + offSign + Math.floor(absMin / 60) + (absMin % 60 ? ':' + pad(absMin % 60) : '');
      var tzName = '时区未知';
      try { tzName = Intl.DateTimeFormat().resolvedOptions().timeZone || tzName; } catch (e) { /* ignore */ }
      $('#tz-hint').textContent = '时区：' + tzName + '（' + offStr + '） · 每秒刷新';

      /* -- 实时时钟 -- */
      function tick() {
        var now = new Date();
        $('#now-datetime').textContent = fmtLocal(now);
        $('#now-sec').textContent = String(Math.floor(now.getTime() / 1000));
        $('#now-ms').textContent = String(now.getTime());
      }
      tick();
      var timer = setInterval(tick, 1000);

      /* -- 时间戳 → 日期 -- */
      var tsInput = $('#ts-input'), tsHint = $('#ts-hint'), tsResults = $('#ts-results');
      function convertTs() {
        var raw = tsInput.value.trim();
        if (!raw) {
          tsResults.hidden = true;
          tsHint.className = 'hint';
          tsHint.textContent = '支持 10 位（秒）/ 13 位（毫秒），其他位数按数值自动识别';
          return;
        }
        var parsed = parseTimestamp(raw);
        if (!parsed) {
          tsResults.hidden = true;
          tsHint.className = 'hint error';
          tsHint.textContent = '格式无效：请输入 1~13 位纯数字时间戳';
          return;
        }
        tsHint.className = 'hint';
        tsHint.textContent = parsed.auto
          ? '已按数值自动识别为' + parsed.unit + '级时间戳'
          : '已识别为' + parsed.unit + '级时间戳';
        $('#ts-local').textContent = fmtLocal(parsed.d);
        $('#ts-iso').textContent = parsed.d.toISOString();
        $('#ts-utc').textContent = parsed.d.toUTCString();
        $('#ts-rel').textContent = relTime(parsed.d);
        tsResults.hidden = false;
      }
      tsInput.addEventListener('input', convertTs);
      $('#ts-now').addEventListener('click', function () {
        tsInput.value = String(Math.floor(Date.now() / 1000));
        convertTs();
      });

      /* -- 日期 → 时间戳 -- */
      var dtInput = $('#dt-input'), dtResults = $('#dt-results');
      function convertDt() {
        if (!dtInput.value) { dtResults.hidden = true; return; }
        var d = new Date(dtInput.value);
        if (isNaN(d.getTime())) { dtResults.hidden = true; return; }
        $('#dt-sec').textContent = String(Math.floor(d.getTime() / 1000));
        $('#dt-ms').textContent = String(d.getTime());
        dtResults.hidden = false;
      }
      dtInput.addEventListener('input', convertDt);
      $('#dt-now').addEventListener('click', function () {
        dtInput.value = fmtLocalInput(new Date());
        convertDt();
      });

      /* 离开页面时清理定时器 */
      return function cleanup() { clearInterval(timer); };
    }
  });
})();
