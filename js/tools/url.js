/* =========================================================
 * 工具：URL 编码 / 解码
 * ---------------------------------------------------------
 * - 组件编码（encodeURIComponent）：编码参数值，& = ? 等结构符也会转义
 * - 整 URL 编码（encodeURI）：保留 URL 结构字符，适合编码完整链接
 * - 表单模式：空格转 %20 或 +（application/x-www-form-urlencoded）
 * - 解码：容错处理，非法 % 序列给出明确报错
 * - 自动识别：输入含 %XX 时建议「解码」，否则建议「编码」
 * 结构说明见 js/tools/timestamp.js 文件头注释。
 * ========================================================= */
(function () {
  'use strict';

  /* 工具图标（内联 SVG，随本文件加载，不依赖公共注册表） */
  var ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';

  /* ---------- 编解码核心 ---------- */

  function encode(text, mode, plus) {
    var out = mode === 'uri' ? encodeURI(text) : encodeURIComponent(text);
    if (plus) out = out.replace(/%20/g, '+'); // 仅表单模式有意义
    return out;
  }

  function decode(text, plus) {
    var s = String(text);
    if (plus) s = s.replace(/\+/g, '%20'); // 表单模式：+ 还原为空格
    // 预检非法 % 序列，给出比原生 "URI malformed" 更友好的提示
    var bad = /%(?![0-9A-Fa-f]{2})/.exec(s);
    if (bad) {
      throw new Error('存在非法的 % 转义序列（% 后需跟两位十六进制字符）');
    }
    // 逐段解码：以最长合法序列为单位切分，遇到仍会抛错的部分则细化定位
    try {
      return decodeURIComponent(s);
    } catch (e) {
      // 典型场景：UTF-8 字节序列被截断（如 %E4%BD 缺一字节）
      throw new Error('解码失败：% 序列不完整或不是有效的 UTF-8 编码');
    }
  }

  /** 输入是否像已编码文本（用于自动识别提示） */
  function looksEncoded(s) {
    return /%[0-9A-Fa-f]{2}/.test(s);
  }

  /* ---------- 注册 ---------- */
  ToolBox.register({
    id: 'url',
    name: 'URL 编解码',
    category: '编码 / 哈希',
    icon: ICON,
    description: 'URL 百分号编码与解码，支持组件 / 整链两种模式与表单空格处理',

    render: function (root) {
      var iconCopy = ToolBox.ui.icon('copy');

      root.innerHTML =
        '<section class="card">' +
          '<div class="card-head">' +
            '<h2 class="card-title">输入</h2>' +
            '<label class="json-opt"><input type="radio" name="url-mode" value="component" checked> 组件编码</label>' +
            '<label class="json-opt"><input type="radio" name="url-mode" value="uri"> 整 URL 编码</label>' +
            '<label class="json-opt"><input type="checkbox" id="url-plus"> 空格转 +</label>' +
          '</div>' +
          '<textarea id="url-input" class="textarea" rows="6" spellcheck="false"' +
            ' placeholder="输入要编码的文本，或粘贴要解码的 URL…"></textarea>' +
          '<div class="field-meta">' +
            '<span id="url-hint">自动识别：输入含 %XX 转义时用「解码」，否则用「编码」</span>' +
            '<span class="json-btns">' +
              '<button class="btn" id="url-encode" type="button">编码 →</button>' +
              '<button class="btn" id="url-decode" type="button">解码 →</button>' +
              '<button class="btn btn-ghost" id="url-swap" type="button" title="把输出作为新的输入">↑ 结果转移到输入</button>' +
              '<button class="btn btn-ghost" id="url-clear" type="button">清空</button>' +
            '</span>' +
          '</div>' +
        '</section>' +

        '<section class="card">' +
          '<div class="card-head"><h2 class="card-title">输出</h2><span class="badge" id="url-mode-badge" hidden></span>' +
            '<span class="card-head-actions"><button class="btn-icon" type="button" id="url-copy" title="复制结果" aria-label="复制结果">' + iconCopy + '</button></span></div>' +
          '<textarea id="url-output" class="textarea" rows="6" spellcheck="false" readonly></textarea>' +
          '<div class="field-meta">' +
            '<span id="url-out-hint"></span>' +
          '</div>' +
        '</section>';

      var $ = function (sel) { return root.querySelector(sel); };
      var input = $('#url-input'), output = $('#url-output');
      var hint = $('#url-hint'), outHint = $('#url-out-hint'), modeBadge = $('#url-mode-badge');
      var plusBox = $('#url-plus');

      function mode() {
        var checked = root.querySelector('input[name="url-mode"]:checked');
        return checked ? checked.value : 'component';
      }

      function note(text, isError) {
        hint.textContent = text;
        hint.style.color = isError ? 'var(--danger)' : '';
      }

      function doEncode() {
        if (!input.value) { note('请先输入内容', true); return; }
        var m = mode();
        output.value = encode(input.value, m, plusBox.checked);
        modeBadge.hidden = false;
        modeBadge.textContent = (m === 'uri' ? 'encodeURI' : 'encodeURIComponent') + (plusBox.checked ? ' · + ' : '');
        outHint.textContent = '已编码' + (plusBox.checked ? '（空格 → +）' : '');
        note('编码完成');
      }

      function doDecode() {
        if (!input.value.trim()) { note('请先输入内容', true); return; }
        try {
          output.value = decode(input.value, plusBox.checked);
          modeBadge.hidden = true;
          outHint.textContent = '已解码';
          note('解码完成');
        } catch (e) {
          note(e.message, true);
        }
      }

      $('#url-encode').addEventListener('click', doEncode);
      $('#url-decode').addEventListener('click', doDecode);
      $('#url-swap').addEventListener('click', function () {
        if (!output.value) { note('暂无输出可转移', true); return; }
        input.value = output.value;
        output.value = '';
        outHint.textContent = '';
        input.dispatchEvent(new Event('input'));
        input.focus();
      });
      $('#url-clear').addEventListener('click', function () {
        input.value = ''; output.value = '';
        outHint.textContent = ''; modeBadge.hidden = true;
        note('自动识别：输入含 %XX 转义时用「解码」，否则用「编码」');
        input.focus();
      });
      $('#url-copy').addEventListener('click', function () {
        if (!output.value) { ToolBox.ui.toast('暂无可复制的内容', 'error'); return; }
        ToolBox.ui.copyText(output.value).then(function (ok) {
          ToolBox.ui.toast(ok ? '已复制到剪贴板' : '复制失败，请手动选择复制', ok ? '' : 'error');
        });
      });

      // 输入即识别，给出操作建议
      input.addEventListener('input', function () {
        var v = input.value.trim();
        if (!v) {
          note('自动识别：输入含 %XX 转义时用「解码」，否则用「编码」');
        } else if (looksEncoded(v)) {
          note('检测到 %XX 转义，建议使用「解码 →」');
        } else {
          note('普通文本，建议使用「编码 →」');
        }
      });
    }
  });
})();
