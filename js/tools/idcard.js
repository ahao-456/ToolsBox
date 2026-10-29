/* =========================================================
 * 工具：身份证年龄计算
 * ---------------------------------------------------------
 * 解析 18 位（GB 11643-1999，含校验位）与 15 位旧式身份证号：
 *   - 出生日期、周岁（精确到天）、虚岁
 *   - 性别（顺序码末位：奇男偶女）
 *   - 生肖、星座、下一个生日倒计时
 * 结构说明见 js/tools/timestamp.js 文件头注释。
 * ========================================================= */
(function () {
  'use strict';

  /* ---------- 常量 ---------- */
  // 校验位加权因子（GB 11643-1999）
  var WEIGHTS = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
  // (Σ ai×wi) mod 11 → 校验字符
  var CHECK_MAP = '10X98765432';
  // 生肖：以 1900 年（鼠）为基准
  var ZODIAC = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];
  // 星座分界：[名称, 结束月, 结含日]，未命中则属摩羯座（12.22 ~ 12.31 / 1.1 ~ 1.19）
  var CONSTELLATIONS = [
    ['摩羯座', 1, 19], ['水瓶座', 2, 18], ['双鱼座', 3, 20], ['白羊座', 4, 19],
    ['金牛座', 5, 20], ['双子座', 6, 21], ['巨蟹座', 7, 22], ['狮子座', 8, 22],
    ['处女座', 9, 22], ['天秤座', 10, 23], ['天蝎座', 11, 22], ['射手座', 12, 21]
  ];

  /* ---------- 工具函数 ---------- */
  function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }

  function pad(n) { return String(n).padStart(2, '0'); }
  function fmtDate(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }

  /** 解析身份证号，成功返回 { birth, gender, is18 }，失败返回 { err } */
  function parseId(raw) {
    var s = String(raw).replace(/\s+/g, '');
    var is18 = /^\d{17}[\dXx]$/.test(s);
    var is15 = /^\d{15}$/.test(s);
    if (!is18 && !is15) return { err: '格式无效：请输入 15 或 18 位身份证号（18 位可含校验位 X）' };

    var y, m, d, genderDigit;
    if (is18) {
      // 校验位验证（ISO 7064 MOD 11-2）
      var sum = 0;
      for (var i = 0; i < 17; i++) sum += Number(s.charAt(i)) * WEIGHTS[i];
      if (CHECK_MAP.charAt(sum % 11) !== s.charAt(17).toUpperCase()) {
        return { err: '校验位不匹配：请检查号码是否输入正确' };
      }
      y = Number(s.substring(6, 10));
      m = Number(s.substring(10, 12));
      d = Number(s.substring(12, 14));
      genderDigit = Number(s.charAt(16));
    } else {
      // 15 位旧式号码：出生年份为两位，默认 19xx
      y = 1900 + Number(s.substring(6, 8));
      m = Number(s.substring(8, 10));
      d = Number(s.substring(10, 12));
      genderDigit = Number(s.charAt(14));
    }

    if (m < 1 || m > 12 || d < 1 || d > 31) return { err: '出生日期无效' };
    var birth = new Date(y, m - 1, d);
    if (birth.getFullYear() !== y || birth.getMonth() !== m - 1 || birth.getDate() !== d) {
      return { err: '出生日期无效' };
    }
    var now = new Date();
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (birth.getTime() > today.getTime()) return { err: '出生日期晚于今天，请检查号码' };

    return { birth: birth, gender: genderDigit % 2 === 1 ? '男' : '女', is18: is18 };
  }

  /** 精确周岁：{ 岁, 月, 天 } */
  function exactAge(birth, now) {
    var y = now.getFullYear() - birth.getFullYear();
    var m = now.getMonth() - birth.getMonth();
    var d = now.getDate() - birth.getDate();
    if (d < 0) {
      m--;
      d += daysInMonth(now.getFullYear(), now.getMonth() - 1);
    }
    if (m < 0) { y--; m += 12; }
    return { y: y, m: m, d: d };
  }

  /** 下一个生日：{ isToday, days }（2 月 29 日出生在平年自动顺延到 3 月 1 日） */
  function nextBirthday(birth, now) {
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var nb = new Date(today.getFullYear(), birth.getMonth(), birth.getDate());
    var isToday = nb.getTime() === today.getTime();
    if (!isToday && nb.getTime() < today.getTime()) {
      nb = new Date(today.getFullYear() + 1, birth.getMonth(), birth.getDate());
    }
    var days = Math.round((nb.getTime() - today.getTime()) / 86400000);
    return { isToday: isToday, days: isToday ? 0 : days };
  }

  function zodiacOf(birth) { return ZODIAC[(birth.getFullYear() - 4) % 12]; }

  /** 归属地：前 6 位行政区划代码 → 省市县名，逐级回退 */
  function regionOf(s) {
    var R = window.IDCARD_REGIONS;
    if (!R) return '数据未加载';
    var p = R.P[s.substring(0, 2)];
    if (!p) return '未知地区（代码 ' + s.substring(0, 6) + '）';
    var c = R.C[s.substring(0, 4)];
    var a = R.A[s.substring(0, 6)];
    var SKIP = { '市辖区': 1, '县': 1, '省直辖县级行政区划': 1, '自治区直辖县级行政区划': 1 };
    var parts = [p];
    if (c && !SKIP[c] && c !== p) parts.push(c);
    if (a && a !== c) parts.push(a);
    return parts.join(' ');
  }

  function constellationOf(birth) {
    var m = birth.getMonth() + 1, d = birth.getDate();
    for (var i = 0; i < CONSTELLATIONS.length; i++) {
      var c = CONSTELLATIONS[i];
      if (m < c[1] || (m === c[1] && d <= c[2])) return c[0];
    }
    return '摩羯座'; // 12.22 ~ 12.31
  }

  /* ---------- 注册 ---------- */
  ToolBox.register({
    id: 'idcard',
    name: '身份证年龄计算',
    category: '生活工具',
    icon: ToolBox.ui.icon('user'),
    description: '解析身份证号，计算年龄、出生日期、归属地、性别、生肖与星座',

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
          '<div class="card-head"><h2 class="card-title">输入身份证号</h2><span class="badge">输入即算</span></div>' +
          '<div class="field">' +
            '<div class="input-group">' +
              '<input id="id-input" class="input" type="text" autocomplete="off" spellcheck="false"' +
                ' placeholder="输入 15 或 18 位身份证号，如 11010519491231002X">' +
              '<button id="id-demo" class="btn btn-ghost" type="button">填入示例</button>' +
            '</div>' +
            '<div class="hint" id="id-hint">支持 18 位（含校验位 X，自动验证合法性）与 15 位旧式号码</div>' +
          '</div>' +
        '</section>' +

        '<section class="card">' +
          '<div class="card-head"><h2 class="card-title">解析结果</h2></div>' +
          '<div class="results" id="id-results" hidden>' +
            resultRow('归属地', 'id-region') +
            resultRow('出生日期', 'id-birth') +
            resultRow('年龄', 'id-age') +
            resultRow('性别', 'id-gender') +
            resultRow('生肖', 'id-zodiac') +
            resultRow('星座', 'id-constellation') +
            resultRow('下一个生日', 'id-nextbd') +
          '</div>' +
          '<div class="hint">年龄按公历满年满月满日计算；生肖按公历年份推算（严格以农历春节为界）；归属地按现行行政区划解析，早期号码可能对应已调整的地区。</div>' +
        '</section>';

      var $ = function (sel) { return root.querySelector(sel); };
      var input = $('#id-input'), hint = $('#id-hint'), results = $('#id-results');
      var DEFAULT_HINT = '支持 18 位（含校验位 X，自动验证合法性）与 15 位旧式号码';

      function update() {
        if (!input.value.trim()) {
          results.hidden = true;
          hint.className = 'hint';
          hint.textContent = DEFAULT_HINT;
          return;
        }
        var r = parseId(input.value);
        if (r.err) {
          results.hidden = true;
          hint.className = 'hint error';
          hint.textContent = r.err;
          return;
        }
        hint.className = 'hint';
        hint.textContent = r.is18 ? '18 位号码，校验位验证通过' : '15 位旧式号码，出生年份按 19xx 解析';

        var now = new Date();
        var age = exactAge(r.birth, now);
        var nb = nextBirthday(r.birth, now);

        $('#id-region').textContent = regionOf(input.value.replace(/\s+/g, ''));
        $('#id-birth').textContent = fmtDate(r.birth);
        $('#id-age').textContent = age.y + ' 岁 ' + age.m + ' 个月 ' + age.d + ' 天';
        $('#id-gender').textContent = r.gender;
        $('#id-zodiac').textContent = zodiacOf(r.birth);
        $('#id-constellation').textContent = constellationOf(r.birth);
        $('#id-nextbd').textContent = nb.isToday ? '就是今天' : '还有 ' + nb.days + ' 天';
        results.hidden = false;
      }

      input.addEventListener('input', update);
      $('#id-demo').addEventListener('click', function () {
        input.value = '11010519491231002X'; // GB 11643-1999 标准示例号码
        update();
      });
    }
  });
})();
