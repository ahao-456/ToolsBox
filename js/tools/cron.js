/* =========================================================
 * 工具：Cron 表达式（构建 + 解释）
 * ---------------------------------------------------------
 * - 字段化构建：分钟/小时/日/月/星期 各自选择模式（每/间隔/范围/指定）
 * - 智能解释：任意 5 段标准 Cron → 中文执行规律 + 未来 8 次执行时间预览
 * - 支持 * , - / 与英文缩写（JAN-DEC / SUN-SAT），? 视同 *
 * - 日与星期同时受限时按 POSIX「或」语义计算执行时间
 * - 快捷模板一键回填构建器；构建结果可一键带入解释器验证
 * 结构说明见 js/tools/timestamp.js 文件头注释。
 * ========================================================= */
(function () {
  'use strict';

  /* 工具图标（内联 SVG，随本文件加载，不依赖公共注册表） */
  var ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5"/><path d="M16 2v4M8 2v4M3 10h5"/><circle cx="17" cy="17" r="5"/><path d="M17 15v2h2"/></svg>';

  /* ---------- 常量 ---------- */
  var DOW_TEXT = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  var MONTH_ALIAS = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 };
  var DOW_ALIAS = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 };

  var META = [
    { key: 'minute', label: '分钟', min: 0, max: 59, unit: '分钟', listPh: '0-59，如 0,30' },
    { key: 'hour',   label: '小时', min: 0, max: 23, unit: '小时', listPh: '0-23，如 9,18' },
    { key: 'dom',    label: '日',   min: 1, max: 31, unit: '天',   listPh: '1-31，如 1,15' },
    { key: 'month',  label: '月',   min: 1, max: 12, unit: '个月', listPh: '1-12，如 1,7' },
    { key: 'dow',    label: '星期', min: 0, max: 7,  unit: '天',   listPh: '0-7（0=周日），如 1,3,5' }
  ];

  var TPLATES = [
    ['每分钟', '* * * * *'],
    ['每小时整点', '0 * * * *'],
    ['每天 0:00', '0 0 * * *'],
    ['每天 8:30', '30 8 * * *'],
    ['工作日 9:00', '0 9 * * 1-5'],
    ['每周一 0:00', '0 0 * * 1'],
    ['每月 1 号 0:00', '0 0 1 * *'],
    ['每年 1 月 1 日', '0 0 1 1 *']
  ];

  var pad2 = function (n) { return String(n).padStart(2, '0'); };

  /* ---------- 解析 ---------- */

  function aliasOf(meta) {
    return meta.key === 'month' ? MONTH_ALIAS : (meta.key === 'dow' ? DOW_ALIAS : null);
  }

  /** 单个值解析为数字（支持别名），越界或无法识别时抛错 */
  function resolveVal(tok, meta) {
    if (/^\d+$/.test(tok)) {
      var v = parseInt(tok, 10);
      if (v < meta.min || v > meta.max) {
        throw new Error('「' + tok + '」超出' + meta.label + '字段范围 ' + meta.min + '-' + meta.max);
      }
      return v;
    }
    var alias = aliasOf(meta);
    if (alias && alias[tok] !== undefined) return alias[tok];
    throw new Error('无法识别的值「' + tok + '」（不支持 L / W / # 等扩展字符）');
  }

  /** 解析单个片段：值 / 范围 / 范围步长，返回 {kind, values, ...} */
  function parseSegment(seg, meta) {
    var m;
    if ((m = seg.match(/^([A-Z0-9]+)-([A-Z0-9]+)\/(\d+)$/))) {
      var a = resolveVal(m[1], meta), b = resolveVal(m[2], meta), st = parseInt(m[3], 10);
      if (st < 1) throw new Error('步长至少为 1');
      if (a > b) throw new Error('范围起点不能大于终点');
      var vals = [];
      for (var v = a; v <= b; v += st) vals.push(v);
      return { kind: 'range', from: a, to: b, step: st, values: vals };
    }
    if ((m = seg.match(/^([A-Z0-9]+)-([A-Z0-9]+)$/))) {
      var a2 = resolveVal(m[1], meta), b2 = resolveVal(m[2], meta);
      if (a2 > b2) throw new Error('范围起点不能大于终点');
      var vals2 = [];
      for (var v2 = a2; v2 <= b2; v2++) vals2.push(v2);
      return { kind: 'range', from: a2, to: b2, step: 1, values: vals2 };
    }
    if ((m = seg.match(/^[A-Z0-9]+$/))) {
      var v0 = resolveVal(m[0], meta);
      return { kind: 'value', v: v0, values: [v0] };
    }
    throw new Error('无法识别「' + seg + '」');
  }

  /** 解析一整段字段，返回 {type: every|step|range|value|list, ...}；出错抛异常 */
  function parseField(raw, meta) {
    var s = String(raw).trim();
    if (s === '*' || s === '?') return { type: 'every' };
    s = s.toUpperCase();
    var m;
    if ((m = s.match(/^\*\/(\d+)$/))) {
      var n = parseInt(m[1], 10);
      if (n < 1) throw new Error('步长至少为 1');
      if (n > meta.max - meta.min + 1) throw new Error('步长 ' + n + ' 无意义（超出' + meta.label + '字段范围）');
      return { type: 'step', step: n };
    }
    if (s.indexOf(',') !== -1) {
      var vals = [];
      s.split(',').forEach(function (part) {
        parseSegment(part.trim(), meta).values.forEach(function (v) {
          vals.push(meta.key === 'dow' ? v % 7 : v);
        });
      });
      vals.sort(function (x, y) { return x - y; });
      var uniq = [];
      vals.forEach(function (v) { if (uniq[uniq.length - 1] !== v) uniq.push(v); });
      return { type: 'list', values: uniq };
    }
    var seg = parseSegment(s, meta);
    if (seg.kind === 'value') return { type: 'value', v: meta.key === 'dow' ? seg.v % 7 : seg.v };
    if (seg.step === 1) return { type: 'range', from: seg.from, to: seg.to };
    return { type: 'list', values: seg.values };
  }

  /** 解析完整 5 段表达式，返回 {ok, segs, fields} 或 {ok:false, err} */
  function parseCron(expr) {
    var segs = String(expr).trim().split(/\s+/);
    if (segs.length !== 5) {
      var extra = segs.length === 6 ? '（含秒级的 6 段表达式暂不支持）' : '';
      return { ok: false, err: '标准 Cron 为 5 段（分 时 日 月 周），当前为 ' + segs.length + ' 段' + extra };
    }
    try {
      var fields = META.map(function (meta, i) { return parseField(segs[i], meta); });
      return { ok: true, segs: segs, fields: fields };
    } catch (e) {
      return { ok: false, err: e.message };
    }
  }

  /** 展开字段为具体值集合（dow 的 7 归一化为 0） */
  function fieldValues(p, meta) {
    var isDow = meta.key === 'dow';
    var nor = function (v) { return isDow ? v % 7 : v; };
    var top = isDow ? 6 : meta.max;
    var arr = [], i;
    if (p.type === 'every') {
      for (i = meta.min; i <= top; i++) arr.push(i);
      return arr;
    }
    if (p.type === 'step') {
      for (i = meta.min; i <= top; i += p.step) arr.push(i);
      return arr;
    }
    if (p.type === 'range') {
      for (i = p.from; i <= p.to; i++) arr.push(nor(i));
      return arr;
    }
    if (p.type === 'value') return [nor(p.v)];
    return p.values.map(nor);
  }

  /* ---------- 中文描述 ---------- */

  function numText(v, meta) {
    if (meta.key === 'dow') return DOW_TEXT[v % 7];
    if (meta.key === 'month') return v + ' 月';
    if (meta.key === 'dom') return v + ' 号';
    if (meta.key === 'hour') return v + ' 点';
    return v + ' 分';
  }

  function rangeText(p, meta) {
    if (meta.key === 'hour') return p.from + ' 点到 ' + p.to + ' 点';
    return numText(p.from, meta) + '到' + numText(p.to, meta);
  }

  /** 周值列表 → 周一到周五 / 周六、周日 / 周一、周三 … */
  function dowListText(vals) {
    if (vals.length === 2 && vals[0] === 0 && vals[1] === 6) return '周六、周日';
    var cont = vals.length > 1;
    for (var i = 1; i < vals.length; i++) {
      if (vals[i] !== vals[i - 1] + 1) { cont = false; break; }
    }
    if (cont) return DOW_TEXT[vals[0]] + '到' + DOW_TEXT[vals[vals.length - 1]];
    return vals.map(function (v) { return DOW_TEXT[v]; }).join('、');
  }

  /** 字段拆解表中单字段的说明文本 */
  function fieldPhrase(p, meta) {
    if (p.type === 'every') {
      return { minute: '每分钟', hour: '每小时', dom: '每天', month: '每月', dow: '每周任意日' }[meta.key];
    }
    if (p.type === 'step') {
      var base = meta.key === 'month' ? '每 ' + p.step + ' 个月' : '每 ' + p.step + ' ' + meta.unit;
      if (meta.key === 'dom') base = '从 1 号起每 ' + p.step + ' 天';
      if (meta.key === 'minute') return base;
      var vals = fieldValues(p, meta);
      if (vals.length <= 8) base += '（即 ' + vals.map(function (v) { return numText(v, meta); }).join('、') + '）';
      return base;
    }
    if (p.type === 'range') return rangeText(p, meta);
    if (p.type === 'value') return numText(p.v, meta);
    return p.values.map(function (v) { return numText(v, meta); }).join('、');
  }

  function hourPhrase(p) {
    if (p.type === 'step') return '每 ' + p.step + ' 小时';
    if (p.type === 'range') return rangeText(p, META[1]);
    if (p.type === 'value') return p.v + ' 点';
    if (p.type === 'list') return p.values.map(function (v) { return v + ' 点'; }).join('、');
    return '每小时';
  }

  function minutePhrase(p) {
    if (p.type === 'step') return '每 ' + p.step + ' 分钟';
    if (p.type === 'range') return p.from + ' 到 ' + p.to + ' 分';
    if (p.type === 'value') return p.v + ' 分';
    return p.values.join('、') + ' 分';
  }

  /** 时间部分（分 + 时）描述，如 "09:00"、"每 15 分钟"、"9 点到 17 点的 0 分" */
  function timePhrase(m, h) {
    if (m.type === 'every' && h.type === 'every') return '每分钟';
    if (m.type === 'every') return hourPhrase(h) + '的每分钟';
    if (h.type === 'every') return '每小时的 ' + minutePhrase(m);
    var hVals = fieldValues(h, META[1]);
    var mVals = fieldValues(m, META[0]);
    var count = hVals.length * mVals.length;
    if (m.type === 'value' && count <= 8) {
      return hVals.map(function (hh) { return pad2(hh) + ':' + pad2(m.v); }).join('、');
    }
    if (count <= 6) {
      var ts = [];
      hVals.forEach(function (hh) { mVals.forEach(function (mm) { ts.push(hh * 100 + mm); }); });
      ts.sort(function (a, b) { return a - b; });
      return ts.map(function (t) { return pad2(Math.floor(t / 100)) + ':' + pad2(t % 100); }).join('、');
    }
    return hourPhrase(h) + '的 ' + minutePhrase(m);
  }

  function monthPhrase(p) {
    if (p.type === 'value') return '每年 ' + p.v + ' 月';
    if (p.type === 'list') return '每年 ' + p.values.join('、') + ' 月';
    if (p.type === 'range') return '每年 ' + p.from + ' 月到 ' + p.to + ' 月';
    return '每 ' + p.step + ' 个月';
  }

  function domPhrase(p) {
    if (p.type === 'value') return '每月 ' + p.v + ' 号';
    if (p.type === 'list') return '每月 ' + p.values.join('、') + ' 号';
    if (p.type === 'range') return '每月 ' + p.from + ' 到 ' + p.to + ' 号';
    return '从 1 号起每 ' + p.step + ' 天';
  }

  /** 与月组合时的"日"短描述（不带"每月"前缀） */
  function domShort(p) {
    if (p.type === 'value') return p.v + ' 号';
    if (p.type === 'list') return p.values.join('、') + ' 号';
    if (p.type === 'range') return p.from + ' 到 ' + p.to + ' 号';
    return '从 1 号起每 ' + p.step + ' 天';
  }

  function dowPhrase(p) {
    if (p.type === 'value') return '每' + DOW_TEXT[p.v];
    if (p.type === 'range') return '每' + DOW_TEXT[p.from] + '到' + DOW_TEXT[p.to % 7];
    return '每' + dowListText(fieldValues(p, META[4]));
  }

  /** 日期部分（日 + 月 + 周）描述，如 "每天"、"每月 15 号"、"每周一到周五" */
  function datePhrase(d, mo, w) {
    var dRes = d.type !== 'every', moRes = mo.type !== 'every', wRes = w.type !== 'every';
    if (!dRes && !moRes && !wRes) return '每天';
    var dayTxt = '';
    if (dRes && wRes) dayTxt = domPhrase(d) + '，或 ' + dowPhrase(w);
    else if (dRes) dayTxt = domPhrase(d);
    else if (wRes) dayTxt = dowPhrase(w);

    if (!moRes) return dayTxt;
    if (!dRes && !wRes) return monthPhrase(mo);
    if (dRes && wRes) return monthPhrase(mo) + '的' + dayTxt;
    if (dRes) {
      if (mo.type === 'value' && d.type === 'value') return '每年 ' + mo.v + ' 月 ' + d.v + ' 号';
      return monthPhrase(mo) + '的 ' + domShort(d);
    }
    return monthPhrase(mo) + '的' + dowPhrase(w);
  }

  /** 顶层：完整执行规律句子 */
  function describeCron(fields) {
    var m = fields[0], h = fields[1], d = fields[2], mo = fields[3], w = fields[4];
    var restEvery = h.type === 'every' && d.type === 'every' && mo.type === 'every' && w.type === 'every';
    if (m.type === 'every' && restEvery) return '每分钟执行一次';
    if (m.type === 'step' && restEvery) return '每 ' + m.step + ' 分钟执行一次';
    var tp = timePhrase(m, h);
    var dp = datePhrase(d, mo, w);
    if (dp === '每天') {
      /* “每天”+“每小时”并存时合并为“每小时 XX 分”，避免“每天 每小时的 0 分”冗余 */
      if (h.type === 'every') return '每小时 ' + minutePhrase(m) + ' 执行';
      return '每天 ' + tp + ' 执行';
    }
    return dp + ' ' + tp + ' 执行';
  }

  /* ---------- 未来执行时间计算 ---------- */

  function nextRuns(fields, count, from) {
    var mins = fieldValues(fields[0], META[0]);
    var hours = fieldValues(fields[1], META[1]);
    var days = fieldValues(fields[2], META[2]);
    var months = fieldValues(fields[3], META[3]);
    var dows = fieldValues(fields[4], META[4]);
    var domR = fields[2].type !== 'every';
    var dowR = fields[4].type !== 'every';

    var combos = [];
    hours.forEach(function (hh) {
      mins.forEach(function (mm) { combos.push([hh, mm]); });
    });
    combos.sort(function (a, b) { return (a[0] * 60 + a[1]) - (b[0] * 60 + b[1]); });

    var start = new Date(from);
    start.setSeconds(0, 0);
    start = new Date(start.getTime() + 60000);

    var out = [];
    var day = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    for (var i = 0; i < 400 && out.length < count; i++) {
      if (months.indexOf(day.getMonth() + 1) !== -1) {
        var domOk = days.indexOf(day.getDate()) !== -1;
        var dowOk = dows.indexOf(day.getDay()) !== -1;
        /* 日与星期同时受限时按 POSIX「或」语义，否则只看受限的一侧 */
        var dayOk = domR && dowR ? (domOk || dowOk) : (domR ? domOk : (dowR ? dowOk : true));
        if (dayOk) {
          for (var c = 0; c < combos.length && out.length < count; c++) {
            var t = new Date(day.getFullYear(), day.getMonth(), day.getDate(), combos[c][0], combos[c][1], 0, 0);
            if (t.getTime() >= start.getTime()) out.push(t);
          }
        }
      }
      day.setDate(day.getDate() + 1);
    }
    return out;
  }

  function fmtTime(t) {
    return t.getFullYear() + '-' + pad2(t.getMonth() + 1) + '-' + pad2(t.getDate()) +
      ' ' + pad2(t.getHours()) + ':' + pad2(t.getMinutes()) + ':' + pad2(t.getSeconds());
  }

  function relIn(t) {
    var s = Math.max(0, Math.round((t.getTime() - Date.now()) / 1000));
    if (s < 60) return s + ' 秒后';
    var mi = Math.floor(s / 60);
    if (mi < 60) return mi + ' 分钟后';
    var h = Math.floor(mi / 60);
    if (h < 48) return h + ' 小时 ' + (mi % 60) + ' 分后';
    return Math.floor(h / 24) + ' 天后';
  }

  /* ---------- 注册与渲染 ---------- */
  ToolBox.register({
    id: 'cron',
    name: 'Cron 表达式',
    category: '时间工具',
    icon: ICON,
    description: '可视化构建 Cron 表达式，或输入任意表达式解释执行规律并预览未来执行时间',

    render: function (root) {
      var esc = ToolBox.ui.escape;
      var iconCopy = ToolBox.ui.icon('copy');

      var rowHtml = function (meta) {
        return '<div class="cron-frow">' +
          '<span class="cron-fname">' + meta.label + '</span>' +
          '<select class="select cron-mode" aria-label="' + meta.label + '匹配模式">' +
            '<option value="every">每个</option>' +
            '<option value="step">间隔</option>' +
            '<option value="range">范围</option>' +
            '<option value="list">指定</option>' +
          '</select>' +
          '<span class="cron-fcontrols">' +
            '<span class="cron-everybox">任意值（*）</span>' +
            '<span class="cron-stepbox" hidden>每 <input type="number" class="input cron-step" min="1" step="1" placeholder="N"> ' +
              (meta.key === 'month' ? '个月' : (meta.key === 'dom' ? '天（1 号起）' : meta.unit)) + '</span>' +
            '<span class="cron-rangebox" hidden>' +
              '<input type="number" class="input cron-ra" min="' + meta.min + '" max="' + meta.max + '" placeholder="' + meta.min + '"> — ' +
              '<input type="number" class="input cron-rb" min="' + meta.min + '" max="' + meta.max + '" placeholder="' + meta.max + '">' +
            '</span>' +
            '<span class="cron-listbox" hidden>' +
              '<input type="text" class="input cron-list" spellcheck="false" autocomplete="off" placeholder="' + meta.listPh + '">' +
            '</span>' +
          '</span>' +
        '</div>';
      };

      root.innerHTML =
        '<section class="card">' +
          '<div class="card-head"><h2 class="card-title">构建 Cron 表达式</h2></div>' +
          '<div class="cron-subtitle">快捷模板</div>' +
          '<div class="chips" id="cron-tpl">' +
            TPLATES.map(function (t) {
              return '<button type="button" class="chip" data-expr="' + esc(t[1]) + '">' + esc(t[0]) + '</button>';
            }).join('') +
          '</div>' +
          '<div class="cron-subtitle">字段设置</div>' +
          '<div id="cron-fields">' + META.map(rowHtml).join('') + '</div>' +
          '<div class="hint">星期字段 0 与 7 均表示周日 · 指定值支持英文缩写（如 JAN / MON）</div>' +
          '<div class="hint error" id="cron-build-err" hidden></div>' +
          '<div class="cron-out">' +
            '<span class="cron-out-expr" id="cron-out-expr"></span>' +
            '<button class="btn-icon" type="button" data-copy="#cron-out-expr" title="复制表达式" aria-label="复制表达式">' + iconCopy + '</button>' +
            '<button class="btn" type="button" id="cron-explain-btn">解释此表达式</button>' +
          '</div>' +
          '<div class="cron-live" id="cron-live" hidden>' +
            '<span class="cron-live-tag">实时解析</span>' +
            '<b id="cron-live-desc"></b>' +
            '<span class="cron-live-next" id="cron-live-next"></span>' +
          '</div>' +
        '</section>' +

        '<section class="card">' +
          '<div class="card-head"><h2 class="card-title">解释 Cron 表达式</h2></div>' +
          '<div class="input-group">' +
            '<input id="cron-input" class="input" type="text" spellcheck="false" autocomplete="off"' +
              ' placeholder="如 0 9 * * 1-5、*/15 8-18 * * * 或 30 8 1 * *">' +
            '<button class="btn btn-ghost" type="button" id="cron-to-builder">在构建器中编辑</button>' +
          '</div>' +
          '<div class="hint">支持 * , - / 与英文缩写；日与星期同时指定时按「或」语义；暂不支持秒级与 L / W / # 扩展</div>' +
          '<div id="cron-result"></div>' +
        '</section>';

      var fieldsEl = root.querySelector('#cron-fields');
      var outExpr = root.querySelector('#cron-out-expr');
      var buildErr = root.querySelector('#cron-build-err');
      var liveEl = root.querySelector('#cron-live');
      var liveDesc = root.querySelector('#cron-live-desc');
      var liveNext = root.querySelector('#cron-live-next');
      var input = root.querySelector('#cron-input');
      var result = root.querySelector('#cron-result');
      var rows = Array.prototype.slice.call(fieldsEl.querySelectorAll('.cron-frow'));

      function setRowMode(row, mode) {
        row.querySelector('.cron-mode').value = mode;
        row.querySelector('.cron-everybox').hidden = mode !== 'every';
        row.querySelector('.cron-stepbox').hidden = mode !== 'step';
        row.querySelector('.cron-rangebox').hidden = mode !== 'range';
        row.querySelector('.cron-listbox').hidden = mode !== 'list';
      }

      /** 读取 5 行设置生成表达式；出错时显示提示并返回 undefined */
      function build() {
        var segs = [];
        for (var i = 0; i < rows.length; i++) {
          var meta = META[i], row = rows[i];
          var mode = row.querySelector('.cron-mode').value;
          try {
            if (mode === 'every') { segs.push('*'); continue; }
            if (mode === 'step') {
              var n = parseInt(row.querySelector('.cron-step').value, 10);
              if (!(n >= 1 && n <= meta.max - meta.min + 1)) {
                throw new Error(meta.label + '：步长应为 1-' + (meta.max - meta.min + 1));
              }
              segs.push('*/' + n);
              continue;
            }
            if (mode === 'range') {
              var a = parseInt(row.querySelector('.cron-ra').value, 10);
              var b = parseInt(row.querySelector('.cron-rb').value, 10);
              if (!(a >= meta.min && a <= meta.max)) throw new Error(meta.label + '：起点应为 ' + meta.min + '-' + meta.max);
              if (!(b >= meta.min && b <= meta.max)) throw new Error(meta.label + '：终点应为 ' + meta.min + '-' + meta.max);
              if (a > b) throw new Error(meta.label + '：起点不能大于终点');
              segs.push(a + '-' + b);
              continue;
            }
            var txt = row.querySelector('.cron-list').value.trim();
            if (!txt) throw new Error(meta.label + '：请填写指定值');
            var parts = txt.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
            parts.forEach(function (p) { resolveVal(p.toUpperCase(), meta); });
            segs.push(parts.join(','));
          } catch (e) {
            buildErr.hidden = false;
            buildErr.textContent = e.message;
            outExpr.textContent = '—';
            liveEl.hidden = true;
            return;
          }
        }
        buildErr.hidden = true;
        var expr = segs.join(' ');
        outExpr.textContent = expr;
        updateLive(expr);
        return expr;
      }

      /** 构建实时解析区：执行规律 + 下次执行时间 */
      function updateLive(expr) {
        var parsed = parseCron(expr);
        if (!parsed.ok) { liveEl.hidden = true; return; }
        liveDesc.textContent = describeCron(parsed.fields);
        var next = nextRuns(parsed.fields, 1, Date.now())[0];
        liveNext.textContent = next ? '下次执行 ' + fmtTime(next) : '400 天内无可执行日期';
        liveEl.hidden = false;
      }

      /** 将合法表达式回填到构建器控件 */
      function fillBuilder(expr) {
        var parsed = parseCron(expr);
        if (!parsed.ok) { ToolBox.ui.toast(parsed.err, 'error'); return false; }
        parsed.fields.forEach(function (p, i) {
          var row = rows[i];
          if (p.type === 'every') setRowMode(row, 'every');
          else if (p.type === 'step') {
            setRowMode(row, 'step');
            row.querySelector('.cron-step').value = p.step;
          } else if (p.type === 'range') {
            setRowMode(row, 'range');
            row.querySelector('.cron-ra').value = p.from;
            row.querySelector('.cron-rb').value = p.to;
          } else {
            setRowMode(row, 'list');
            row.querySelector('.cron-list').value = p.type === 'value' ? String(p.v) : p.values.join(',');
          }
        });
        build();
        return true;
      }

      /** 解析输入框表达式并渲染解释结果 */
      function interpret() {
        var expr = input.value.trim();
        if (!expr) {
          result.innerHTML = '<div class="hint" style="margin-top:12px">输入表达式后即时显示执行规律与未来执行时间</div>';
          return;
        }
        var parsed = parseCron(expr);
        if (!parsed.ok) {
          result.innerHTML = '<div class="hint error" style="margin-top:12px">' + esc(parsed.err) + '</div>';
          return;
        }
        var fields = parsed.fields;
        var desc = describeCron(fields);
        var runs = nextRuns(fields, 8, Date.now());

        var breakdown =
          '<div class="cron-subtitle">字段拆解</div>' +
          '<div class="results">' + fields.map(function (p, i) {
            return '<div class="result-row">' +
              '<span class="result-label">' + META[i].label + '</span>' +
              '<span class="result-value">' + esc(parsed.segs[i]) + '</span>' +
              '<span class="cron-fnote">' + esc(fieldPhrase(p, META[i])) + '</span>' +
            '</div>';
          }).join('') + '</div>';

        var runsHtml;
        if (runs.length) {
          runsHtml =
            '<div class="cron-next">' +
              '<span class="cron-fnote">下次执行</span>' +
              '<b id="cron-next-time">' + fmtTime(runs[0]) + '</b>' +
              '<span class="badge live">' + relIn(runs[0]) + '</span>' +
              '<button class="btn-icon" type="button" data-copy="#cron-next-time" title="复制时间" aria-label="复制时间">' + iconCopy + '</button>' +
            '</div>' +
            '<div class="cron-subtitle">未来执行时间</div>' +
            '<div class="results">' + runs.map(function (t, i) {
              return '<div class="result-row">' +
                '<span class="result-label">#' + (i + 1) + '</span>' +
                '<span class="result-value" id="cron-run-' + i + '">' + fmtTime(t) + '</span>' +
                '<span class="cron-fnote">' + relIn(t) + '</span>' +
                '<button class="btn-icon" type="button" data-copy="#cron-run-' + i + '" title="复制时间" aria-label="复制时间">' + iconCopy + '</button>' +
              '</div>';
            }).join('') + '</div>' +
            (runs.length < 8 ? '<div class="hint">400 天内仅找到 ' + runs.length + ' 次执行</div>' : '');
        } else {
          runsHtml = '<div class="hint">该表达式在 400 天内没有可执行的日期（如 2 月 30 日）</div>';
        }

        result.innerHTML =
          '<div class="cron-desc">' + esc(desc) + '</div>' +
          breakdown + runsHtml;
      }

      /* -- 事件 -- */
      fieldsEl.addEventListener('change', function (e) {
        if (e.target.classList.contains('cron-mode')) {
          setRowMode(e.target.closest('.cron-frow'), e.target.value);
        }
        build();
      });
      fieldsEl.addEventListener('input', function () { build(); });

      root.querySelector('#cron-tpl').addEventListener('click', function (e) {
        var chip = e.target.closest('.chip');
        if (!chip) return;
        if (fillBuilder(chip.dataset.expr)) ToolBox.ui.toast('已填入：' + chip.dataset.expr);
      });

      root.querySelector('#cron-explain-btn').addEventListener('click', function () {
        var expr = build();
        if (!expr) { ToolBox.ui.toast('请先修正构建字段的错误', 'error'); return; }
        input.value = expr;
        interpret();
        result.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });

      root.querySelector('#cron-to-builder').addEventListener('click', function () {
        if (fillBuilder(input.value.trim())) {
          root.querySelector('.cron-out').scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });

      input.addEventListener('input', interpret);

      /* -- 初始状态 -- */
      build();
      input.value = '0 9 * * 1-5';
      interpret();
    }
  });
})();
