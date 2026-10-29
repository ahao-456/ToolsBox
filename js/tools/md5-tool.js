/* =========================================================
 * 工具：MD5 计算器
 * ---------------------------------------------------------
 * 算法实现在 js/md5.js（全局函数 MD5），本文件只负责界面。
 * ========================================================= */
(function () {
  'use strict';

  /* 工具图标（内联 SVG，随本文件加载，不依赖公共注册表） */
  var ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>';

  ToolBox.register({
    id: 'md5',
    name: 'MD5 计算器',
    category: '编码 / 哈希',
    icon: ICON,
    description: '计算文本的 MD5 哈希值，支持 32 位小写 / 大写与 16 位截取格式，输入即时计算',

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
          '<div class="card-head"><h2 class="card-title">输入文本</h2><span class="badge">输入即算</span></div>' +
          '<textarea id="md5-input" class="textarea" rows="6" spellcheck="false"' +
            ' placeholder="输入或粘贴任意文本，MD5 结果将实时计算…"></textarea>' +
          '<div class="field-meta">' +
            '<span id="md5-count">0 个字符</span>' +
          '</div>' +
        '</section>' +

        '<section class="card">' +
          '<div class="card-head"><h2 class="card-title">计算结果</h2></div>' +
          '<div class="results">' +
            resultRow('32 位小写', 'md5-32', '复制 32 位小写') +
            resultRow('32 位大写', 'md5-32-upper', '复制 32 位大写') +
            resultRow('16 位截取', 'md5-16', '复制 16 位（中间 16 位截取）') +
          '</div>' +
          '<div class="hint">MD5 为不可逆散列，仅适用于数据校验、去重等场景，请勿用于密码存储等安全用途。</div>' +
        '</section>';

      var input = root.querySelector('#md5-input');
      var out32 = root.querySelector('#md5-32');
      var out32Upper = root.querySelector('#md5-32-upper');
      var out16 = root.querySelector('#md5-16');
      var count = root.querySelector('#md5-count');

      function update() {
        var v = input.value;
        var h = MD5(v);
        out32.textContent = h;
        out32Upper.textContent = h.toUpperCase();
        out16.textContent = h.substring(8, 24); // 惯用的“16 位 MD5”为取中间 16 位
        count.textContent = v.length + ' 个字符';
      }
      input.addEventListener('input', update);
      update();
    }
  });
})();
