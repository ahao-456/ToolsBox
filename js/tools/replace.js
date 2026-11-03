/* =========================================================
 * 工具：文本查找替换
 * ---------------------------------------------------------
 * - 纯文本 / 正则两种查找模式，正则替换串支持 $1 $& 等引用
 * - 可选区分大小写、全字匹配（纯文本模式，正则模式下禁用）
 * - 实时命中计数 + 高亮预览（预览仅前 4000 字符，替换作用于全文）
 * - 全部替换 / 结果复制 / 回写输入（支持链式多次处理）
 * 结构说明见 js/tools/timestamp.js 文件头注释。
 * ========================================================= */
(function () {
  'use strict';

  /* 工具图标（内联 SVG，随本文件加载，不依赖公共注册表） */
  var ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5h9"/><path d="M3 9h7"/><path d="M3 13h9"/><path d="M3 17h5"/><path d="M14 12h7"/><path d="M18 8.5l3.5 3.5-3.5 3.5"/></svg>';

  /* 纯文本查找时需转义的元字符 */
  function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  ToolBox.register({
    id: 'replace',
    name: '文本查找替换',
    category: '文本工具',
    icon: ICON,
    description: '查找文本并批量替换，支持正则表达式、区分大小写、全字匹配与命中高亮预览',

    render: function (root) {
      var esc = ToolBox.ui.escape;
      var iconCopy = ToolBox.ui.icon('copy');

      root.innerHTML =
        '<section class="card">' +
          '<div class="field">' +
            '<label class="label" for="rep-input">原始文本</label>' +
            '<textarea id="rep-input" class="textarea" rows="8" spellcheck="false" placeholder="粘贴或输入需要处理的文本"></textarea>' +
          '</div>' +
          '<div class="rep-find-row">' +
            '<div class="rep-field"><label class="label" for="rep-find">查找</label>' +
              '<input id="rep-find" class="input" type="text" spellcheck="false" autocomplete="off" placeholder="要查找的内容，如 foo">' +
            '</div>' +
            '<div class="rep-field"><label class="label" for="rep-repl">替换为</label>' +
              '<input id="rep-repl" class="input" type="text" spellcheck="false" autocomplete="off" placeholder="替换后的内容，留空即删除匹配">' +
            '</div>' +
          '</div>' +
          '<div class="rep-opts">' +
            '<label class="rep-opt"><input type="checkbox" id="rep-case">区分大小写</label>' +
            '<label class="rep-opt"><input type="checkbox" id="rep-word">全字匹配</label>' +
            '<label class="rep-opt"><input type="checkbox" id="rep-regex">正则表达式</label>' +
          '</div>' +
          '<div class="hint error" id="rep-err" hidden></div>' +
          '<div class="rep-bar">' +
            '<span class="badge" id="rep-count" hidden></span>' +
            '<button class="btn" type="button" id="rep-go">全部替换</button>' +
          '</div>' +
          '<div class="hint" id="rep-phint" hidden></div>' +
          '<div class="rep-preview" id="rep-preview" hidden></div>' +
        '</section>' +

        '<section class="card">' +
          '<div class="card-head"><h2 class="card-title">替换结果</h2><span class="badge" id="rep-done" hidden></span>' +
            '<span class="card-head-actions">' +
              '<button class="btn btn-ghost rep-mini" type="button" id="rep-rewrite">回写输入</button>' +
              '<button class="btn-icon" type="button" data-copy="#rep-output" title="复制结果" aria-label="复制结果">' + iconCopy + '</button>' +
            '</span>' +
          '</div>' +
          '<textarea id="rep-output" class="textarea" rows="8" spellcheck="false" readonly></textarea>' +
          '<div class="hint">替换结果只读；「回写输入」可将结果带回原始文本继续处理</div>' +
        '</section>';

      var ta = root.querySelector('#rep-input');
      var findEl = root.querySelector('#rep-find');
      var replEl = root.querySelector('#rep-repl');
      var caseEl = root.querySelector('#rep-case');
      var wordEl = root.querySelector('#rep-word');
      var regexEl = root.querySelector('#rep-regex');
      var errEl = root.querySelector('#rep-err');
      var countEl = root.querySelector('#rep-count');
      var phintEl = root.querySelector('#rep-phint');
      var previewEl = root.querySelector('#rep-preview');
      var goBtn = root.querySelector('#rep-go');
      var outTa = root.querySelector('#rep-output');
      var doneEl = root.querySelector('#rep-done');
      var rewriteBtn = root.querySelector('#rep-rewrite');

      var PREVIEW_MAX = 4000; // 预览高亮的文本长度上限（统计与替换不受限）
      var MARK_MAX = 500;     // 预览最多高亮的命中数

      /**
       * 构造带 g 标志的查找正则。
       * 返回：null（查找为空）/ {err}（正则语法错误）/ RegExp
       */
      function buildRegex() {
        var find = findEl.value;
        if (!find) return null;
        if (regexEl.checked) {
          try {
            return new RegExp(find, caseEl.checked ? 'g' : 'gi');
          } catch (e) {
            return { err: '正则语法错误：' + e.message };
          }
        }
        var p = escapeRegExp(find);
        /* 全字匹配仅在首尾是 ASCII 词字符时加 \b（\b 对中文等无词边界概念） */
        if (wordEl.checked) {
          if (/^[A-Za-z0-9_]/.test(find)) p = '\\b' + p;
          if (/[A-Za-z0-9_]$/.test(find)) p = p + '\\b';
        }
        return new RegExp(p, caseEl.checked ? 'g' : 'gi');
      }

      /** exec 循环计数（零宽匹配防护），返回命中数 */
      function countMatches(re, text) {
        var n = 0, m;
        re.lastIndex = 0;
        while ((m = re.exec(text)) !== null) {
          n++;
          if (m[0].length === 0) re.lastIndex++; // 零宽匹配手动前进防死循环
          if (n >= 100000) break;
        }
        return n;
      }

      /** 生成高亮预览 HTML（仅 head 段、最多 MARK_MAX 处命中） */
      function buildPreview(re, text) {
        var head = text.length > PREVIEW_MAX ? text.slice(0, PREVIEW_MAX) : text;
        var marks = [], m;
        re.lastIndex = 0;
        while ((m = re.exec(head)) !== null && marks.length < MARK_MAX) {
          marks.push([m.index, m.index + m[0].length]);
          if (m[0].length === 0) re.lastIndex++;
        }
        var html = '', last = 0;
        for (var i = 0; i < marks.length; i++) {
          html += esc(head.slice(last, marks[i][0]));
          html += '<mark class="rep-mark">' + esc(head.slice(marks[i][0], marks[i][1])) + '</mark>';
          last = marks[i][1];
        }
        html += esc(head.slice(last));
        return html;
      }

      /** 查找条件变化时的实时反馈：错误 / 命中数 / 高亮预览 */
      function update() {
        var text = ta.value;
        errEl.hidden = true;
        phintEl.hidden = true;
        if (!findEl.value || !text) {
          countEl.hidden = true;
          previewEl.hidden = true;
          return;
        }
        var re = buildRegex();
        if (re && re.err) {
          errEl.hidden = false;
          errEl.textContent = re.err;
          countEl.hidden = true;
          previewEl.hidden = true;
          return;
        }
        var n = countMatches(re, text);
        countEl.hidden = false;
        countEl.textContent = '命中 ' + n + ' 处';
        if (n === 0) {
          previewEl.hidden = true;
          return;
        }
        previewEl.innerHTML = buildPreview(re, text);
        previewEl.hidden = false;
        if (text.length > PREVIEW_MAX) {
          phintEl.hidden = false;
          phintEl.textContent = '预览仅显示前 ' + PREVIEW_MAX + ' 字符，统计与替换仍作用于全文';
        }
      }

      function doReplace() {
        var text = ta.value;
        if (!text) { ToolBox.ui.toast('请先输入原始文本', 'error'); return; }
        if (!findEl.value) { ToolBox.ui.toast('请输入查找内容', 'error'); return; }
        var re = buildRegex();
        if (re && re.err) { ToolBox.ui.toast(re.err, 'error'); return; }
        var n = countMatches(re, text);
        if (!n) { ToolBox.ui.toast('没有可替换的匹配', 'error'); return; }
        var repl = replEl.value;
        /* 正则模式：替换串按标准语义（$1 $& 等生效）；
           纯文本模式：函数替换保证 $ 按字面量输出 */
        var result = regexEl.checked
          ? text.replace(re, repl)
          : text.replace(re, function () { return repl; });
        outTa.value = result;
        doneEl.hidden = false;
        doneEl.textContent = '已替换 ' + n + ' 处';
        ToolBox.ui.toast('已替换 ' + n + ' 处');
      }

      ta.addEventListener('input', update);
      findEl.addEventListener('input', update);
      caseEl.addEventListener('change', update);
      wordEl.addEventListener('change', update);
      regexEl.addEventListener('change', function () {
        /* 全字匹配依赖 \b 包装，对用户手写正则不可控，正则模式下禁用 */
        wordEl.disabled = regexEl.checked;
        if (regexEl.checked) wordEl.checked = false;
        update();
      });

      goBtn.addEventListener('click', doReplace);

      rewriteBtn.addEventListener('click', function () {
        if (!outTa.value) { ToolBox.ui.toast('暂无替换结果', 'error'); return; }
        ta.value = outTa.value;
        update();
        ToolBox.ui.toast('已将结果回写到原始文本');
      });
    }
  });
})();
