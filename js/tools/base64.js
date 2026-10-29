/* =========================================================
 * 工具：Base64 编码 / 解码
 * ---------------------------------------------------------
 * - 编码：任意 Unicode 文本 → Base64（UTF-8 字节序列）
 * - 解码：Base64 → 文本；宽松模式可容忍空白与缺失 padding
 * - URL 安全变体：-_ 替换 +/，供 JWT / Data URL 等场景
 * - 自动识别：粘贴 Base64 后一键取反操作
 * 结构说明见 js/tools/timestamp.js 文件头注释。
 * ========================================================= */
(function () {
  'use strict';

  /* 工具图标（内联 SVG，随本文件加载，不依赖公共注册表） */
  var ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4v8a2 2 0 1 0 4 0V6a2 2 0 1 0-4 0"/><path d="M14 6a2 2 0 1 1 4 0v10"/><path d="M14 16a2 2 0 1 0 4 0"/><path d="M4 20h16"/></svg>';

  /* ---------- 核心：UTF-8 与 Base64 互转（绕开 btoa 的latin1 限制） ---------- */

  function utf8ToBytes(str) {
    var out = [];
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c < 0x80) {
        out.push(c);
      } else if (c < 0x800) {
        out.push(0xC0 | (c >> 6), 0x80 | (c & 63));
      } else if (c >= 0xD800 && c <= 0xDBFF) {
        // 代理对 → 4 字节 UTF-8
        var c2 = str.charCodeAt(++i);
        var cp = 0x10000 + ((c - 0xD800) << 10) + (c2 - 0xDC00);
        out.push(0xF0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
      } else {
        out.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      }
    }
    return out;
  }

  function bytesToUtf8(bytes) {
    var out = '', i = 0;
    while (i < bytes.length) {
      var b = bytes[i++];
      var cp;
      if (b < 0x80) {
        cp = b;
      } else if (b < 0xE0) {
        cp = ((b & 31) << 6) | (bytes[i++] & 63);
      } else if (b < 0xF0) {
        cp = ((b & 15) << 12) | ((bytes[i++] & 63) << 6) | (bytes[i++] & 63);
      } else {
        cp = ((b & 7) << 18) | ((bytes[i++] & 63) << 12) | ((bytes[i++] & 63) << 6) | (bytes[i++] & 63);
        // 转回 UTF-16 代理对
        cp -= 0x10000;
        out += String.fromCharCode(0xD800 + (cp >> 10), 0xDC00 + (cp & 1023));
        continue;
      }
      out += String.fromCharCode(cp);
    }
    return out;
  }

  function encode(text, urlSafe) {
    var bytes = utf8ToBytes(text);
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    var b64 = btoa(bin);
    if (urlSafe) b64 = b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return b64;
  }

  function decode(b64, urlSafe) {
    var s = String(b64).replace(/\s+/g, '');          // 容忍换行/空格
    if (urlSafe) s = s.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';                    // 补齐 padding
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(s)) {
      throw new Error('包含非 Base64 字符（合法字符：A-Z a-z 0-9 + / =）');
    }
    var bin = atob(s);
    var bytes = new Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytesToUtf8(bytes);
  }

  /** 是否像 Base64（用于自动识别提示） */
  function looksBase64(s) {
    var t = s.replace(/\s+/g, '');
    return t.length >= 8 && t.length % 4 === 0 && /^[A-Za-z0-9+/\-_]+={0,2}$/.test(t);
  }

  ToolBox.register({
    id: 'base64',
    name: 'Base64 编解码',
    category: '编码 / 哈希',
    icon: ICON,
    description: '文本与 Base64 互转，支持中文、URL 安全变体与宽松解码',

    render: function (root) {
      var iconCopy = ToolBox.ui.icon('copy');

      root.innerHTML =
        '<section class="card">' +
          '<div class="card-head">' +
            '<h2 class="card-title">输入</h2>' +
            '<label class="json-opt"><input type="checkbox" id="b64-urlsafe"> URL 安全（-_ 替换 +/）</label>' +
          '</div>' +
          '<textarea id="b64-input" class="textarea" rows="6" spellcheck="false"' +
            ' placeholder="输入要编码的文本，或粘贴要解码的 Base64…"></textarea>' +
          '<div class="field-meta">' +
            '<span id="b64-hint">自动识别：输入 Base64 时用「解码」，否则用「编码」</span>' +
            '<span class="json-btns">' +
              '<button class="btn" id="b64-encode" type="button">编码 →</button>' +
              '<button class="btn" id="b64-decode" type="button">解码 →</button>' +
              '<button class="btn btn-ghost" id="b64-swap" type="button" title="把输出作为新的输入">↑ 结果转移到输入</button>' +
              '<button class="btn btn-ghost" id="b64-clear" type="button">清空</button>' +
            '</span>' +
          '</div>' +
        '</section>' +

        '<section class="card">' +
          '<div class="card-head"><h2 class="card-title">输出</h2>' +
            '<span class="card-head-actions"><button class="btn-icon" type="button" id="b64-copy" title="复制结果" aria-label="复制结果">' + iconCopy + '</button></span></div>' +
          '<textarea id="b64-output" class="textarea" rows="6" spellcheck="false" readonly></textarea>' +
          '<div class="field-meta">' +
            '<span id="b64-out-hint"></span>' +
          '</div>' +
        '</section>';

      var $ = function (sel) { return root.querySelector(sel); };
      var input = $('#b64-input'), output = $('#b64-output');
      var hint = $('#b64-hint'), outHint = $('#b64-out-hint');
      var urlSafeBox = $('#b64-urlsafe');

      function note(text, isError) {
        hint.textContent = text;
        hint.style.color = isError ? 'var(--danger)' : '';
      }

      function doEncode() {
        if (!input.value) { note('请先输入内容', true); return; }
        try {
          output.value = encode(input.value, urlSafeBox.checked);
          outHint.textContent = '已编码' + (urlSafeBox.checked ? '（URL 安全变体）' : '');
          note('编码完成');
        } catch (e) {
          note('编码失败：' + e.message, true);
        }
      }

      function doDecode() {
        if (!input.value.trim()) { note('请先输入内容', true); return; }
        try {
          output.value = decode(input.value, urlSafeBox.checked);
          outHint.textContent = '已解码为 UTF-8 文本';
          note('解码完成');
        } catch (e) {
          note(e.message, true);
        }
      }

      $('#b64-encode').addEventListener('click', doEncode);
      $('#b64-decode').addEventListener('click', doDecode);
      $('#b64-swap').addEventListener('click', function () {
        if (!output.value) { note('暂无输出可转移', true); return; }
        input.value = output.value;
        output.value = '';
        outHint.textContent = '';
        input.dispatchEvent(new Event('input'));
        input.focus();
      });
      $('#b64-clear').addEventListener('click', function () {
        input.value = ''; output.value = '';
        outHint.textContent = '';
        note('自动识别：输入 Base64 时用「解码」，否则用「编码」');
        input.focus();
      });
      $('#b64-copy').addEventListener('click', function () {
        if (!output.value) { ToolBox.ui.toast('暂无可复制的内容', 'error'); return; }
        ToolBox.ui.copyText(output.value).then(function (ok) {
          ToolBox.ui.toast(ok ? '已复制到剪贴板' : '复制失败，请手动选择复制', ok ? '' : 'error');
        });
      });

      // 输入即识别，给出操作建议
      input.addEventListener('input', function () {
        var v = input.value.trim();
        if (!v) {
          note('自动识别：输入 Base64 时用「解码」，否则用「编码」');
        } else if (looksBase64(v)) {
          note('看起来是 Base64，建议使用「解码 →」');
        } else {
          note('普通文本，建议使用「编码 →」');
        }
      });
    }
  });
})();
