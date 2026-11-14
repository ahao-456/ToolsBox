/* =========================================================
 * 工具：JSON 对比
 * ---------------------------------------------------------
 * - 双侧 JSON 输入，展平为「路径 → 值」后逐项对比
 * - 四种状态直观展示：修改（旧值 → 新值）/ 新增（绿）/
 *   删除（红）/ 相同（灰，默认折叠）
 * - 可选「数组忽略元素顺序」：按内容排序后再比，
 *   适合集合语义的 JSON
 * - 解析错误指明是哪一侧；统计徽章 + 状态分组筛选
 * 结构说明见 js/tools/timestamp.js 文件头注释。
 * ========================================================= */
(function () {
  'use strict';

  /* 工具图标（内联 SVG，随本文件加载，不依赖公共注册表） */
  var ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3H6a2 2 0 0 0-2 2v4c0 1.1-.9 2-2 2 1.1 0 2 .9 2 2v4a2 2 0 0 0 2 2h3"/><path d="M15 3h3a2 2 0 0 1 2 2v4c0 1.1.9 2 2 2-1.1 0-2 .9-2 2v4a2 2 0 0 1-2 2h-3"/><path d="M8 12h8"/></svg>';

  /* ---------- 展平与对比核心 ---------- */

  /** 递归排序：数组按内容排序（可选开启），对象键按字典序 */
  function sortDeep(v) {
    if (Array.isArray(v)) {
      var arr = v.map(sortDeep);
      arr.sort(function (a, b) {
        var sa = JSON.stringify(a), sb = JSON.stringify(b);
        return sa < sb ? -1 : sa > sb ? 1 : 0;
      });
      return arr;
    }
    if (v && typeof v === 'object') {
      var o = {};
      Object.keys(v).sort().forEach(function (k) { o[k] = sortDeep(v[k]); });
      return o;
    }
    return v;
  }

  /**
   * 展平为 { 路径: 序列化值 }。
   * 对象 / 非空数组递归展开；空对象 / 空数组 / null / 原始值作为叶子。
   */
  function flatten(v, path, out) {
    if (v === null) { out[path] = 'null'; return; }
    if (Array.isArray(v)) {
      if (!v.length) { out[path] = '[]'; return; }
      v.forEach(function (item, i) { flatten(item, path + '[' + i + ']', out); });
      return;
    }
    if (typeof v === 'object') {
      var keys = Object.keys(v);
      if (!keys.length) { out[path] = '{}'; return; }
      keys.forEach(function (k) { flatten(v[k], path ? path + '.' + k : k, out); });
      return;
    }
    out[path] = JSON.stringify(v);
  }

  var ROOT = '(root)';

  /**
   * 对比两份已解析的 JSON。opts: { ignoreArrayOrder }
   * 返回 { rows:[{path,status:'mod|add|del|same',a,b}], stats }
   */
  function diffJson(a, b, opts) {
    var ignoreOrder = opts && opts.ignoreArrayOrder;
    if (ignoreOrder) { a = sortDeep(a); b = sortDeep(b); }
    var fa = {}, fb = {};
    flatten(a, '', fa);
    flatten(b, '', fb);

    var paths = Object.keys(fa).concat(Object.keys(fb).filter(function (p) {
      return !(p in fa);
    }));
    paths.sort();

    var rows = [];
    var stats = { mod: 0, add: 0, del: 0, same: 0 };
    paths.forEach(function (p) {
      var inA = p in fa, inB = p in fb;
      var disp = p === '' ? ROOT : p;
      if (inA && inB) {
        if (fa[p] === fb[p]) { rows.push({ path: disp, status: 'same', a: fa[p], b: fb[p] }); stats.same++; }
        else { rows.push({ path: disp, status: 'mod', a: fa[p], b: fb[p] }); stats.mod++; }
      } else if (inA) {
        rows.push({ path: disp, status: 'del', a: fa[p], b: null }); stats.del++;
      } else {
        rows.push({ path: disp, status: 'add', a: null, b: fb[p] }); stats.add++;
      }
    });
    return { rows: rows, stats: stats };
  }

  /* ---------- 注册与渲染 ---------- */
  ToolBox.register({
    id: 'json-diff',
    name: 'JSON 对比',
    category: '编码 / 哈希',
    icon: ICON,
    description: '对比两份 JSON 的差异，按路径逐项展示修改 / 新增 / 删除，支持数组忽略顺序',

    render: function (root) {
      var esc = ToolBox.ui.escape;

      var DEMO_A = '{"name":"ToolsBox","version":1,"tags":["tool","dev"],"author":{"name":"xxx","city":"上海"},"active":true}';
      var DEMO_B = '{"name":"ToolsBox","version":2,"tags":["dev","tool"],"author":{"name":"xxx","country":"中国"},"active":true,"stars":42}';

      root.innerHTML =
        '<section class="card">' +
          '<div class="jd-inputs">' +
            '<div class="jd-col"><label class="label" for="jd-a">JSON A（基准）</label>' +
              '<textarea id="jd-a" class="textarea" rows="9" spellcheck="false" placeholder=\'{"a":1, "b":"x"}\'></textarea>' +
            '</div>' +
            '<div class="jd-col"><label class="label" for="jd-b">JSON B（对比）</label>' +
              '<textarea id="jd-b" class="textarea" rows="9" spellcheck="false" placeholder=\'{"a":2, "c":true}\'></textarea>' +
            '</div>' +
          '</div>' +
          '<div class="rep-opts">' +
            '<label class="rep-opt"><input type="checkbox" id="jd-order">数组忽略元素顺序</label>' +
            '<span class="json-btns" style="margin-left:auto">' +
              '<button class="btn" type="button" id="jd-run">对比差异 →</button>' +
              '<button class="btn btn-ghost" type="button" id="jd-demo">填入示例</button>' +
              '<button class="btn btn-ghost" type="button" id="jd-clear">清空</button>' +
            '</span>' +
          '</div>' +
          '<div class="hint error" id="jd-err" hidden></div>' +
          '<div class="hint">对象键顺序无关，天然支持；数组默认按下标对比，勾选后按内容排序对比</div>' +
        '</section>' +

        '<section class="card" id="jd-result-card" hidden>' +
          '<div class="card-head"><h2 class="card-title">差异结果</h2><span class="badge" id="jd-stats"></span></div>' +
          '<div class="chips" id="jd-chips">' +
            '<button type="button" class="chip active" data-f="diff">仅差异</button>' +
            '<button type="button" class="chip" data-f="all">全部</button>' +
            '<button type="button" class="chip" data-f="mod">修改</button>' +
            '<button type="button" class="chip" data-f="add">新增</button>' +
            '<button type="button" class="chip" data-f="del">删除</button>' +
            '<button type="button" class="chip" data-f="same">相同</button>' +
          '</div>' +
          '<div id="jd-list"></div>' +
        '</section>';

      var taA = root.querySelector('#jd-a');
      var taB = root.querySelector('#jd-b');
      var orderEl = root.querySelector('#jd-order');
      var errEl = root.querySelector('#jd-err');
      var resultCard = root.querySelector('#jd-result-card');
      var statsEl = root.querySelector('#jd-stats');
      var chipsEl = root.querySelector('#jd-chips');
      var listEl = root.querySelector('#jd-list');
      var filter = 'diff';
      var lastRows = null;

      var STATUS = {
        mod: ['修改', 'jd-badge-mod'],
        add: ['新增', 'jd-badge-add'],
        del: ['删除', 'jd-badge-del'],
        same: ['相同', 'jd-badge-same']
      };

      function renderList() {
        var rows = lastRows.filter(function (r) {
          if (filter === 'diff') return r.status !== 'same';
          if (filter === 'all') return true;
          return r.status === filter;
        });
        if (!rows.length) {
          listEl.innerHTML = '<div class="cur-empty">当前筛选下没有条目</div>';
          return;
        }
        listEl.innerHTML = rows.map(function (r) {
          var st = STATUS[r.status];
          var vals;
          if (r.status === 'mod') {
            vals = '<span class="jd-old">' + esc(r.a) + '</span><span class="jd-arrow">→</span><span class="jd-new">' + esc(r.b) + '</span>';
          } else if (r.status === 'del') {
            vals = '<span class="jd-old">' + esc(r.a) + '</span><span class="jd-miss">B 中不存在</span>';
          } else if (r.status === 'add') {
            vals = '<span class="jd-miss">A 中不存在</span><span class="jd-new">' + esc(r.b) + '</span>';
          } else {
            vals = '<span class="jd-eq">' + esc(r.a) + '</span>';
          }
          return '<div class="jd-row">' +
            '<span class="jd-badge ' + st[1] + '">' + st[0] + '</span>' +
            '<span class="jd-path">' + esc(r.path) + '</span>' +
            '<span class="jd-vals">' + vals + '</span>' +
          '</div>';
        }).join('');
      }

      function run() {
        errEl.hidden = true;
        resultCard.hidden = true;
        lastRows = null;
        var a, b;
        if (!taA.value.trim() || !taB.value.trim()) {
          errEl.hidden = false;
          errEl.textContent = '请在两侧各输入一份 JSON';
          return;
        }
        try { a = JSON.parse(taA.value); } catch (e) {
          errEl.hidden = false;
          errEl.textContent = 'JSON A 解析失败：' + e.message;
          return;
        }
        try { b = JSON.parse(taB.value); } catch (e) {
          errEl.hidden = false;
          errEl.textContent = 'JSON B 解析失败：' + e.message;
          return;
        }
        var r = diffJson(a, b, { ignoreArrayOrder: orderEl.checked });
        lastRows = r.rows;
        var s = r.stats;
        statsEl.textContent = '差异 ' + (s.mod + s.add + s.del) + ' 处（修改 ' + s.mod + ' · 新增 ' + s.add + ' · 删除 ' + s.del + '）· 相同 ' + s.same + ' 项';
        filter = 'diff';
        chipsEl.querySelectorAll('.chip').forEach(function (c) {
          c.classList.toggle('active', c.dataset.f === 'diff');
        });
        resultCard.hidden = false;
        renderList();
        resultCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }

      root.querySelector('#jd-run').addEventListener('click', run);
      root.querySelector('#jd-demo').addEventListener('click', function () {
        taA.value = DEMO_A;
        taB.value = DEMO_B;
        run();
      });
      root.querySelector('#jd-clear').addEventListener('click', function () {
        taA.value = '';
        taB.value = '';
        errEl.hidden = true;
        resultCard.hidden = true;
        taA.focus();
      });

      chipsEl.addEventListener('click', function (e) {
        var chip = e.target.closest('.chip');
        if (!chip) return;
        filter = chip.dataset.f;
        chipsEl.querySelectorAll('.chip').forEach(function (c) {
          c.classList.toggle('active', c === chip);
        });
        renderList();
      });
    }
  });
})();
