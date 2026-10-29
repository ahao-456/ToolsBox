/* =========================================================
 * 工具：JSON 格式化 / 压缩 / 校验
 * ---------------------------------------------------------
 * - 格式化：美化缩进（可调缩进宽度）、压缩：去除空白
 * - 转义 / 去转义：JSON 字符串字面量与源文本互转
 * - 排序键：可选按 key 字母序重排（保持原有顺序为默认）
 * - 错误定位：解析失败时给出行列位置提示
 * - 统计：节点数 / 深度 / 大小
 * 结构说明见 js/tools/timestamp.js 文件头注释。
 * ========================================================= */
(function () {
  'use strict';

  /** 递归统计节点数与最大深度 */
  function stats(node) {
    var count = 0, depth = 0;
    (function walk(v, d) {
      count++;
      if (d > depth) depth = d;
      if (Array.isArray(v)) v.forEach(function (x) { walk(x, d + 1); });
      else if (v && typeof v === 'object') Object.keys(v).forEach(function (k) { walk(v[k], d + 1); });
    })(node, 1);
    return { count: count, depth: depth };
  }

  /** 按 key 字母序重排（数组顺序保持不变，仅对象键排序） */
  function sortKeys(v) {
    if (Array.isArray(v)) return v.map(sortKeys);
    if (v && typeof v === 'object') {
      var o = {};
      Object.keys(v).sort().forEach(function (k) { o[k] = sortKeys(v[k]); });
      return o;
    }
    return v;
  }

  /** 解析错误信息 → 行/列定位（兼容新旧 V8 与 Firefox 报错格式） */
  function locateError(text, msg) {
    msg = msg || 'JSON 解析失败';
    var pos = -1;

    // 旧版 V8 / Node："... at position 123"
    var mOld = /position (\d+)/i.exec(msg);
    if (mOld) pos = Number(mOld[1]);

    // Firefox：直接给出行列 "at line 2, column 3"
    if (pos < 0) {
      var mFF = /line (\d+),? column (\d+)/i.exec(msg);
      if (mFF) return '第 ' + mFF[1] + ' 行 第 ' + mFF[2] + ' 列附近出错';
    }

    // 新版 V8（Chrome 98+）："Unexpected token 'X', "<摘录>" is not valid JSON"
    // 摘录是报错位置附近的源码片段（包引号，长输入时用 ... 截断），
    // 在源文本中找到该片段后，再用 token 在窗口内反向搜索即可精确定位
    if (pos < 0) {
      var mTok = /^Unexpected token '(.+?)', /.exec(msg);
      var tail = msg.lastIndexOf(' is not valid JSON');
      if (mTok && tail > 0) {
        var start = mTok[0].length, end = tail;
        if (msg.charAt(start) === '"') start++;        // 去掉摘录左侧包装引号
        if (msg.charAt(end - 1) === '"') end--;        // 去掉摘录右侧包装引号
        var excerpt = msg.slice(start, end);
        if (excerpt.slice(0, 3) === '...') excerpt = excerpt.slice(3); // V8 截断标记
        if (excerpt.slice(-3) === '...') excerpt = excerpt.slice(0, -3);
        var idx = text.indexOf(excerpt);
        if (idx >= 0) {
          var winEnd = idx + Math.max(0, excerpt.length - 1);
          var tok = mTok[1], tp = -1;
          for (var i = Math.min(winEnd, text.length - 1); i >= idx; i--) {
            if (text.substr(i, tok.length) === tok) { tp = i; break; }
          }
          pos = tp >= 0 ? tp : winEnd;
        }
      } else if (/Unexpected end of JSON input/.test(msg)) {
        pos = text.replace(/\s+$/, '').length; // 末尾截断：指向最后一个非空白字符
      }
    }

    if (pos < 0 || pos > text.length) return msg; // 无法定位时给原始报错
    var before = text.slice(0, pos);
    var line = before.split('\n').length;
    var col = pos - before.lastIndexOf('\n');
    var around = text.slice(Math.max(0, pos - 12), Math.min(text.length, pos + 12)).replace(/\n/g, '\\n');
    return '第 ' + line + ' 行 第 ' + col + ' 列附近出错：…' + around + '…';
  }

  /** 字节数（UTF-8）人性化显示 */
  function fmtSize(n) {
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1024 / 1024).toFixed(2) + ' MB';
  }

  ToolBox.register({
    id: 'json',
    name: 'JSON 格式化',
    category: '编码 / 哈希',
    icon: ToolBox.ui.icon('braces'),
    description: 'JSON 美化、压缩、转义与校验，支持错误行列定位与键排序',

    render: function (root) {
      var iconCopy = ToolBox.ui.icon('copy');

      root.innerHTML =
        '<section class="card">' +
          '<div class="card-head">' +
            '<h2 class="card-title">输入 JSON</h2>' +
            '<label class="json-opt"><input type="checkbox" id="json-sort"> 键排序</label>' +
            '<label class="json-opt">缩进' +
              '<select id="json-indent" class="select">' +
                '<option value="2" selected>2 空格</option>' +
                '<option value="4">4 空格</option>' +
                '<option value="tab">Tab</option>' +
              '</select>' +
            '</label>' +
          '</div>' +
          '<textarea id="json-input" class="textarea" rows="10" spellcheck="false"' +
            ' placeholder=\'粘贴 JSON 文本，或需要转义 / 去转义的字符串…\'></textarea>' +
          '<div class="field-meta">' +
            '<span id="json-status">等待输入</span>' +
            '<span class="json-btns">' +
              '<button class="btn btn-ghost" id="json-format" type="button">格式化</button>' +
              '<button class="btn btn-ghost" id="json-minify" type="button">压缩</button>' +
              '<button class="btn btn-ghost" id="json-escape" type="button">转义</button>' +
              '<button class="btn btn-ghost" id="json-unescape" type="button">去转义</button>' +
              '<button class="btn btn-ghost" id="json-clear" type="button">清空</button>' +
            '</span>' +
          '</div>' +
        '</section>' +

        '<section class="card">' +
          '<div class="card-head"><h2 class="card-title">输出</h2><span class="badge" id="json-stats" hidden></span></div>' +
          '<textarea id="json-output" class="textarea" rows="10" spellcheck="false" readonly></textarea>' +
          '<div class="field-meta">' +
            '<span id="json-out-hint"></span>' +
            '<span><button class="btn-icon" type="button" id="json-copy" title="复制结果" aria-label="复制结果">' + iconCopy + '</button></span>' +
          '</div>' +
        '</section>';

      var $ = function (sel) { return root.querySelector(sel); };
      var input = $('#json-input'), output = $('#json-output');
      var status = $('#json-status'), statsBadge = $('#json-stats'), outHint = $('#json-out-hint');
      var sortBox = $('#json-sort'), indentSel = $('#json-indent');

      function indentOf() {
        var v = indentSel.value;
        return v === 'tab' ? '\t' : Number(v);
      }

      function setStatus(text, isError) {
        status.textContent = text;
        status.style.color = isError ? 'var(--danger)' : '';
      }

      /** 校验输入是否为合法 JSON，合法则返回解析结果 */
      function tryParse() {
        var raw = input.value;
        if (!raw.trim()) { setStatus('等待输入'); return null; }
        try {
          var v = JSON.parse(raw);
          setStatus('JSON 合法');
          return v;
        } catch (e) {
          setStatus(locateError(raw, e.message), true);
          return null;
        }
      }

      function emit(text, note) {
        output.value = text;
        outHint.textContent = note || '';
      }

      function transform(mode) {
        var raw = input.value;
        if (!raw.trim()) { setStatus('请先输入内容', true); return; }

        if (mode === 'escape') {
          emit(JSON.stringify(raw), '已转为 JSON 字符串字面量（含外层引号）');
          setStatus('转义完成');
          return;
        }
        if (mode === 'unescape') {
          try {
            var s = JSON.parse(raw);
            if (typeof s !== 'string') { setStatus('内容是合法 JSON 但不是字符串，无需去转义', true); return; }
            emit(s, '已还原为原始文本');
            setStatus('去转义完成');
          } catch (e) {
            setStatus('去转义失败：输入需是 JSON 字符串字面量（带引号）', true);
          }
          return;
        }

        var v = tryParse();
        if (v === null) return;
        if (sortBox.checked) v = sortKeys(v);

        if (mode === 'format') {
          emit(JSON.stringify(v, null, indentOf()), '格式化完成');
        } else {
          emit(JSON.stringify(v), '压缩完成');
        }
        var st = stats(v);
        var bytes = new TextEncoder().encode(output.value).length;
        statsBadge.hidden = false;
        statsBadge.textContent = st.count + ' 节点 · 深度 ' + st.depth + ' · ' + fmtSize(bytes);
      }

      $('#json-format').addEventListener('click', function () { transform('format'); });
      $('#json-minify').addEventListener('click', function () { transform('minify'); });
      $('#json-escape').addEventListener('click', function () { transform('escape'); });
      $('#json-unescape').addEventListener('click', function () { transform('unescape'); });
      $('#json-clear').addEventListener('click', function () {
        input.value = ''; output.value = '';
        statsBadge.hidden = true; outHint.textContent = '';
        setStatus('等待输入');
        input.focus();
      });
      $('#json-copy').addEventListener('click', function () {
        if (!output.value) { ToolBox.ui.toast('暂无可复制的内容', 'error'); return; }
        ToolBox.ui.copyText(output.value).then(function (ok) {
          ToolBox.ui.toast(ok ? '已复制到剪贴板' : '复制失败，请手动选择复制', ok ? '' : 'error');
        });
      });
      // 输入即校验（不自动改写输出，避免干扰用户编辑）
      input.addEventListener('input', function () {
        statsBadge.hidden = true;
        tryParse();
      });
    }
  });
})();
