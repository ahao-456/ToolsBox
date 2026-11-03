/* =========================================================
 * 工具：Unicode 编码转换
 * ---------------------------------------------------------
 * - 文本 → Unicode：中文等非 ASCII 转义（中 → \u4e2d），
 *   或全部字符转义（A → \u0041）；格式可选 \uXXXX / \u{XXXXX}
 * - Unicode → 文本：识别 \uXXXX、\u{XXXXX}、&#xHHHH;、&#DDDD;
 * - 支持代理对（Emoji）、大小写十六进制、输入即时转换
 * - 输出可复制（标题行右侧）、可一键「交换并反向」链式处理
 * 结构说明见 js/tools/timestamp.js 文件头注释。
 * ========================================================= */
(function () {
  'use strict';

  /* 工具图标（内联 SVG，随本文件加载，不依赖公共注册表） */
  var ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/></svg>';

  /* 4 位十六进制，不足补零 */
  function hex4(n, upper) {
    var s = n.toString(16);
    while (s.length < 4) s = '0' + s;
    return upper ? s.toUpperCase() : s;
  }

  /**
   * 文本 → \uXXXX 转义。
   * scope: 'smart' 仅非 ASCII（abc 保留）/ 'all' 全部字符
   * form : 'u4' \uXXXX（代理对输出两个连续转义）/ 'brace' \u{XXXXX}
   */
  function escapeUnicode(str, scope, form, upper) {
    var out = '', count = 0, i = 0, len = str.length;
    while (i < len) {
      var hi = str.charCodeAt(i);
      /* 完整代理对 → 按一个码点计 */
      if (hi >= 0xD800 && hi <= 0xDBFF && i + 1 < len) {
        var lo = str.charCodeAt(i + 1);
        if (lo >= 0xDC00 && lo <= 0xDFFF) {
          if (form === 'u4') {
            out += '\\u' + hex4(hi, upper) + '\\u' + hex4(lo, upper);
          } else {
            var cp = 0x10000 + ((hi - 0xD800) << 10) + (lo - 0xDC00);
            var h = cp.toString(16);
            out += '\\u{' + (upper ? h.toUpperCase() : h) + '}';
          }
          count++;
          i += 2;
          continue;
        }
      }
      if (scope === 'smart' && hi < 0x80) {
        out += str.charAt(i); /* ASCII 原样保留 */
      } else if (form === 'u4') {
        out += '\\u' + hex4(hi, upper);
        count++;
      } else {
        var h2 = hi.toString(16);
        out += '\\u{' + (upper ? h2.toUpperCase() : h2) + '}';
        count++;
      }
      i++;
    }
    return { text: out, count: count };
  }

  /* 反转义识别：\u{...}、\uXXXX、&#xHHHH;、&#DDDD; */
  var RE_UNI = /\\u\{([0-9A-Fa-f]{1,6})\}|\\u([0-9A-Fa-f]{4})|&#x([0-9A-Fa-f]{1,6});|&#(\d{1,7});/g;

  /**
   * \uXXXX → 文本。未匹配的字符原样透传；
   * 超出 Unicode 范围（> 0x10FFFF）的序列原样保留并计入 bad。
   */
  function unescapeUnicode(str) {
    var count = 0, bad = 0;
    var text = str.replace(RE_UNI, function (m, brace, u4, hx, dec) {
      var cp = brace !== undefined ? parseInt(brace, 16)
             : u4 !== undefined ? parseInt(u4, 16)
             : hx !== undefined ? parseInt(hx, 16)
             : parseInt(dec, 10);
      if (!(cp >= 0 && cp <= 0x10FFFF)) { bad++; return m; }
      count++;
      /* \uXXXX 的代理段码元相邻输出后自动配对（UTF-16 编码本质） */
      return String.fromCodePoint(cp);
    });
    return { text: text, count: count, bad: bad };
  }

  /* ---------- 注册与渲染 ---------- */
  ToolBox.register({
    id: 'unicode',
    name: 'Unicode 转换',
    category: '编码 / 哈希',
    icon: ICON,
    description: '中文 / ASCII 与 \\uXXXX 转义互转，支持 \\u{XXXXX} 与 HTML 实体形式',

    render: function (root) {
      var iconCopy = ToolBox.ui.icon('copy');

      root.innerHTML =
        '<section class="card">' +
          '<div class="chips" id="uni-dirs">' +
            '<button type="button" class="chip active" data-dir="escape">文本 → Unicode</button>' +
            '<button type="button" class="chip" data-dir="unescape">Unicode → 文本</button>' +
          '</div>' +
          '<div class="rep-opts" id="uni-opts">' +
            '<label class="rep-opt"><input type="radio" name="uni-scope" value="smart" checked>仅中文等非 ASCII</label>' +
            '<label class="rep-opt"><input type="radio" name="uni-scope" value="all">全部字符（A → \\u0041）</label>' +
            '<span class="uni-sep"></span>' +
            '<label class="rep-opt"><input type="radio" name="uni-form" value="u4" checked>\\uXXXX</label>' +
            '<label class="rep-opt"><input type="radio" name="uni-form" value="brace">\\u{XXXXX}</label>' +
            '<span class="uni-sep"></span>' +
            '<label class="rep-opt"><input type="checkbox" id="uni-upper">大写十六进制</label>' +
          '</div>' +
          '<div class="field">' +
            '<textarea id="uni-input" class="textarea" rows="6" spellcheck="false" placeholder="输入文本，或粘贴 \\uXXXX 转义序列（方向自动对应左侧模式）"></textarea>' +
          '</div>' +
          '<div class="hint" id="uni-hint"></div>' +
          '<div class="hint error" id="uni-bad" hidden></div>' +
          '<div class="card-head"><h2 class="card-title">输出</h2><span class="badge" id="uni-badge" hidden></span>' +
            '<span class="card-head-actions">' +
              '<button class="btn-icon" type="button" data-copy="#uni-output" title="复制结果" aria-label="复制结果">' + iconCopy + '</button>' +
            '</span>' +
          '</div>' +
          '<textarea id="uni-output" class="textarea" rows="6" spellcheck="false" readonly></textarea>' +
          '<div class="field-meta">' +
            '<span id="uni-stat"></span>' +
            '<button class="btn btn-ghost rep-mini" type="button" id="uni-swap">交换并反向</button>' +
          '</div>' +
        '</section>';

      var dirsEl = root.querySelector('#uni-dirs');
      var optsEl = root.querySelector('#uni-opts');
      var input = root.querySelector('#uni-input');
      var hintEl = root.querySelector('#uni-hint');
      var badEl = root.querySelector('#uni-bad');
      var badge = root.querySelector('#uni-badge');
      var output = root.querySelector('#uni-output');
      var statEl = root.querySelector('#uni-stat');
      var swapBtn = root.querySelector('#uni-swap');

      var HINT = {
        escape: '中文等非 ASCII 字符转为 \\uXXXX 转义，abc 等原样保留；选「全部字符」则 A 也会转为 \\u0041',
        unescape: '识别 \\uXXXX、\\u{XXXXX}、&#xXXXX;、&#XXXX; 四种形式，未转义的字符原样保留'
      };
      var dir = 'escape';

      function convert() {
        var text = input.value;
        badEl.hidden = true;
        if (!text) {
          output.value = '';
          badge.hidden = true;
          statEl.textContent = '';
          return;
        }
        if (dir === 'escape') {
          var scope = root.querySelector('input[name="uni-scope"]:checked').value;
          var form = root.querySelector('input[name="uni-form"]:checked').value;
          var upper = root.querySelector('#uni-upper').checked;
          var r = escapeUnicode(text, scope, form, upper);
          output.value = r.text;
          badge.hidden = false;
          badge.textContent = '已转义 ' + r.count + ' 字符';
          statEl.textContent = '输入 ' + text.length + ' 字符 · 输出 ' + r.text.length + ' 字符';
        } else {
          var u = unescapeUnicode(text);
          output.value = u.text;
          badge.hidden = false;
          badge.textContent = '已还原 ' + u.count + ' 处';
          statEl.textContent = '输入 ' + text.length + ' 字符 · 输出 ' + u.text.length + ' 字符';
          if (u.bad) {
            badEl.hidden = false;
            badEl.textContent = u.bad + ' 处超出 Unicode 范围的序列已原样保留';
          }
        }
      }

      function setDir(next) {
        dir = next;
        dirsEl.querySelectorAll('.chip').forEach(function (c) {
          c.classList.toggle('active', c.dataset.dir === next);
        });
        optsEl.hidden = dir !== 'escape';
        hintEl.textContent = HINT[dir];
        convert();
      }

      dirsEl.addEventListener('click', function (e) {
        var chip = e.target.closest('.chip');
        if (chip && chip.dataset.dir !== dir) setDir(chip.dataset.dir);
      });

      optsEl.addEventListener('change', convert);
      input.addEventListener('input', convert);

      swapBtn.addEventListener('click', function () {
        if (!output.value) { ToolBox.ui.toast('暂无可交换的输出', 'error'); return; }
        input.value = output.value;
        setDir(dir === 'escape' ? 'unescape' : 'escape');
        ToolBox.ui.toast('已交换并切换方向');
      });

      setDir('escape');
    }
  });
})();
