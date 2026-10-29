/* =========================================================
 * 工具：世界时间
 * ---------------------------------------------------------
 * - 预设 18 个常用城市时区，实时刷新（秒级）
 * - 每个时区标注 UTC 偏移（如 UTC+8，随夏令时自动变化）
 * - 显示完整日期时间（年月日时分秒）与本地时差
 * - 复制得到纯「年月日时分秒」文本
 * - 复用 .result-row 组件，自动适配移动端
 * 结构说明见 js/tools/timestamp.js 文件头注释。
 * ========================================================= */
(function () {
  'use strict';

  /* 工具图标（内联 SVG，随本文件加载，不依赖公共注册表） */
  var ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>';

  /* ---------- 预设城市（IANA 时区） ---------- */
  var PRESET = [
    ['北京', 'Asia/Shanghai'],
    ['香港', 'Asia/Hong_Kong'],
    ['台北', 'Asia/Taipei'],
    ['东京', 'Asia/Tokyo'],
    ['首尔', 'Asia/Seoul'],
    ['新加坡', 'Asia/Singapore'],
    ['曼谷', 'Asia/Bangkok'],
    ['悉尼', 'Australia/Sydney'],
    ['奥克兰', 'Pacific/Auckland'],
    ['迪拜', 'Asia/Dubai'],
    ['莫斯科', 'Europe/Moscow'],
    ['伦敦', 'Europe/London'],
    ['巴黎', 'Europe/Paris'],
    ['柏林', 'Europe/Berlin'],
    ['纽约', 'America/New_York'],
    ['芝加哥', 'America/Chicago'],
    ['洛杉矶', 'America/Los_Angeles'],
    ['温哥华', 'America/Vancouver']
  ];

  /* ---------- 时区工具函数 ---------- */

  /** 目标时区相对 UTC 的偏移（ms），失败返回 null */
  function tzOffsetMs(tz, now) {
    try {
      var dtf = new Intl.DateTimeFormat('en-US', {
        timeZone: tz, hour12: false,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
      var m = {};
      dtf.formatToParts(now).forEach(function (p) { m[p.type] = p.value; });
      var h = m.hour === '24' ? 0 : Number(m.hour);
      // 秒级截断，避免毫秒参与比较造成刷新抖动
      return Date.UTC(m.year, m.month - 1, m.day, h, m.minute, m.second)
        - Math.floor(now.getTime() / 1000) * 1000;
    } catch (e) { return null; }
  }

  /** 目标时区的 HH:mm:ss */
  function timeIn(tz, now) {
    try {
      return new Intl.DateTimeFormat('zh-CN', {
        timeZone: tz, hour12: false,
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      }).format(now);
    } catch (e) { return '--:--:--'; }
  }

  /** 目标时区的日期字符串 YYYY-MM-DD（用于跨日判断） */
  function dateStrIn(tz, now) {
    try {
      var dtf = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit'
      });
      return dtf.format(now); // en-CA 输出即 YYYY-MM-DD
    } catch (e) { return ''; }
  }

  /** UTC 偏移标签：UTC+8 / UTC-5 / UTC+5:30 / UTC+0 */
  function utcLabel(offsetMs) {
    var h = offsetMs / 3600000;
    var sign = h >= 0 ? '+' : '-';
    var abs = Math.abs(h);
    var hh = Math.floor(abs);
    var mm = Math.round((abs % 1) * 60);
    var t = sign + hh;
    if (mm) t += ':' + (mm < 10 ? '0' + mm : mm);
    return 'UTC' + t;
  }

  /** 时差文案：相同 / +8h / -5.5h */
  function diffText(offsetMs, localOffsetMs) {
    var d = (offsetMs - localOffsetMs) / 3600000;
    if (Math.abs(d) < 0.01) return '相同';
    var sign = d > 0 ? '+' : '-';
    var abs = Math.abs(d);
    var h = Math.floor(abs);
    var text = h ? h + 'h' : '';
    if (abs % 1) text += (text ? ' ' : '') + Math.round((abs % 1) * 60) + 'm';
    return sign + text;
  }

  /* ---------- 注册 ---------- */
  ToolBox.register({
    id: 'worldclock',
    name: '世界时间',
    category: '时间工具',
    icon: ICON,
    description: '世界各地实时日期时间对照，标注 UTC 偏移与本地时差，可复制完整时间',

    render: function (root) {
      var iconCopy = ToolBox.ui.icon('copy');

      root.innerHTML =
        '<section class="card">' +
          '<div class="card-head"><h2 class="card-title">各地时间</h2><span class="badge live">实时</span></div>' +
          '<div class="results" id="wc-list"></div>' +
          '<div class="hint">UTC+N 为该地相对协调世界时的偏移（随夏令时自动变化）；时差为与本地时间之差；复制按钮得到完整「年月日 时分秒」。</div>' +
        '</section>';

      var list = root.querySelector('#wc-list');

      function rowHtml(city, tz) {
        return '<div class="result-row" data-tz="' + ToolBox.ui.escape(tz) + '">' +
          '<span class="result-label">' + ToolBox.ui.escape(city) +
            ' <span class="result-utc" data-role="utc"></span></span>' +
          '<span class="result-value" data-role="time">--:--:--</span>' +
          '<button class="btn-icon" type="button" data-copy-wc aria-label="复制时间" title="复制时间">' + iconCopy + '</button>' +
          '</div>';
      }

      function renderList() {
        list.innerHTML = PRESET.map(function (p) { return rowHtml(p[0], p[1]); }).join('');
        tick();
      }

      function tick() {
        var now = new Date();
        var localOffsetMs = -now.getTimezoneOffset() * 60000;
        list.querySelectorAll('.result-row').forEach(function (row) {
          var tz = row.dataset.tz;
          var offset = tzOffsetMs(tz, now);
          if (offset === null) {
            row.querySelector('[data-role="time"]').textContent = '时区无效';
            return;
          }
          // 完整日期时间（该时区的年月日时分秒），存入 dataset 供复制使用
          var full = dateStrIn(tz, now) + ' ' + timeIn(tz, now);
          row.dataset.time = full;
          row.querySelector('[data-role="utc"]').textContent = utcLabel(offset);
          row.querySelector('[data-role="time"]').textContent =
            full + ' · ' + diffText(offset, localOffsetMs);
        });
      }

      // 事件代理：复制完整「年月日 时分秒」
      list.addEventListener('click', function (e) {
        var cp = e.target.closest('[data-copy-wc]');
        if (!cp) return;
        var v = cp.closest('.result-row').dataset.time || '';
        if (!v) { ToolBox.ui.toast('暂无可复制的内容', 'error'); return; }
        ToolBox.ui.copyText(v).then(function (ok) {
          ToolBox.ui.toast(ok ? '已复制：' + v : '复制失败，请手动选择复制', ok ? '' : 'error');
        });
      });

      renderList();
      var timer = setInterval(tick, 1000);

      /* 离开页面时清理定时器 */
      return function cleanup() { clearInterval(timer); };
    }
  });
})();
