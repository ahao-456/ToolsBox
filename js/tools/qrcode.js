/* =========================================================
 * 工具：二维码生成
 * ---------------------------------------------------------
 * - 标准 QR 编码（ISO/IEC 18004）：字节模式 + UTF-8，中文/Emoji 均可
 * - 版本 1-40 自动选择，L / M / Q / H 四档纠错等级
 * - 内置 Reed-Solomon 纠错与 8 种掩码评估（结构参考 MIT qrcodegen）
 * - Canvas 实时预览，支持复制图片与下载 PNG
 * 结构说明见 js/tools/timestamp.js 文件头注释。
 * ========================================================= */
(function () {
  'use strict';

  /* 工具图标（内联 SVG，随本文件加载，不依赖公共注册表） */
  var ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h4v4h-4z"/><path d="M20.5 14v.01M14 20.5v.01M20.5 20.5v.01"/></svg>';

  /* ---------- QR 核心算法 ---------- */

  /* 每块纠错码字数（行序 L/M/Q/H，索引 = 版本号，0 弃用） */
  var ECC_PER_BLOCK = [
    [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
    [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30]
  ];
  /* 纠错分块数 */
  var EC_BLOCKS = [
    [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
    [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
    [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
    [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81]
  ];
  var ECL_INDEX = { L: 0, M: 1, Q: 2, H: 3 };
  var ECL_FORMAT = { L: 1, M: 0, Q: 3, H: 2 }; // 格式信息中的等级位

  /** GF(256) 乘法（本原多项式 0x11D） */
  function gfMul(x, y) {
    var z = 0;
    for (var i = 7; i >= 0; i--) {
      z = (z << 1) ^ ((z >>> 7) * 0x11D);
      z ^= ((y >>> i) & 1) * x;
    }
    return z & 0xFF;
  }

  /** RS 生成多项式系数（首一，省略最高次项），degree = 每块纠错码字数 */
  function rsDivisor(degree) {
    var result = [];
    for (var i = 0; i < degree - 1; i++) result.push(0);
    result.push(1);
    var root = 1;
    for (var d = 0; d < degree; d++) {
      for (var j = 0; j < result.length; j++) {
        result[j] = gfMul(result[j], root);
        if (j + 1 < result.length) result[j] ^= result[j + 1];
      }
      root = gfMul(root, 2);
    }
    return result;
  }

  /** 计算纠错码字（余项） */
  function rsRemainder(data, divisor) {
    var result = [];
    for (var i = 0; i < divisor.length; i++) result.push(0);
    for (var d = 0; d < data.length; d++) {
      var factor = data[d] ^ result.shift();
      result.push(0);
      for (var j = 0; j < divisor.length; j++) result[j] ^= gfMul(divisor[j], factor);
    }
    return result;
  }

  /** 版本 ver 的原始模块总数（不含留白区） */
  function numRawDataModules(ver) {
    var result = (16 * ver + 128) * ver + 64;
    if (ver >= 2) {
      var numAlign = Math.floor(ver / 7) + 2;
      result -= (25 * numAlign - 10) * numAlign - 55;
      if (ver >= 7) result -= 36;
    }
    return result;
  }

  /** 版本 ver + 纠错等级的数据码字容量 */
  function numDataCodewords(ver, eclIdx) {
    return Math.floor(numRawDataModules(ver) / 8) -
      ECC_PER_BLOCK[eclIdx][ver] * EC_BLOCKS[eclIdx][ver];
  }

  /** 校正图形中心坐标序列 */
  function alignmentPositions(ver) {
    if (ver === 1) return [];
    var numAlign = Math.floor(ver / 7) + 2;
    var step = (ver === 32) ? 26 :
      Math.ceil((ver * 4 + 4) / (numAlign * 2 - 2)) * 2;
    var result = [6];
    for (var pos = ver * 4 + 10; result.length < numAlign; pos -= step) {
      result.splice(1, 0, pos);
    }
    return result;
  }

  /** 字符串 → UTF-8 字节数组（含代理对处理） */
  function utf8Bytes(str) {
    var out = [];
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) {
        out.push(0xC0 | (c >> 6), 0x80 | (c & 0x3F));
      } else if (c >= 0xD800 && c <= 0xDBFF && i + 1 < str.length &&
                 (str.charCodeAt(i + 1) & 0xFC00) === 0xDC00) {
        var cp = 0x10000 + ((c - 0xD800) << 10) + (str.charCodeAt(i + 1) - 0xDC00);
        out.push(0xF0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3F),
                 0x80 | ((cp >> 6) & 0x3F), 0x80 | (cp & 0x3F));
        i++;
      } else if (c >= 0xD800 && c <= 0xDFFF) {
        out.push(0xEF, 0xBF, 0xBD); // 孤立代理 → U+FFFD
      } else {
        out.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 0x3F), 0x80 | (c & 0x3F));
      }
    }
    return out;
  }

  function bitAt(x, i) { return (x >>> i) & 1; }

  /**
   * 生成二维码矩阵。
   * 返回 {ok:true, version, size, modules, byteLen, mask} 或 {ok:false, err}
   */
  function makeQr(text, level) {
    var eclIdx = ECL_INDEX[level];
    if (eclIdx === undefined) return { ok: false, err: '未知纠错等级' };
    var bytes = utf8Bytes(text);
    if (!bytes.length) return { ok: false, err: '内容为空' };

    /* -- 版本选择 -- */
    var version = 0, dataCap = 0, headerBits = 0;
    for (var v = 1; v <= 40; v++) {
      headerBits = 4 + (v <= 9 ? 8 : 16); // 模式指示 + 字符计数长度（字节模式）
      dataCap = numDataCodewords(v, eclIdx);
      if (headerBits + bytes.length * 8 <= dataCap * 8) { version = v; break; }
    }
    if (!version) {
      var maxCap = Math.floor((numDataCodewords(40, eclIdx) * 8 - (4 + 16)) / 8);
      return { ok: false, err: '内容过长：' + level + ' 等级最大支持约 ' + maxCap + ' 字节（UTF-8）' };
    }

    /* -- 位流构建 -- */
    var bb = [];
    function appendBits(val, len) {
      for (var i = len - 1; i >= 0; i--) bb.push((val >>> i) & 1);
    }
    appendBits(4, 4);                              // 字节模式
    appendBits(bytes.length, version <= 9 ? 8 : 16);
    for (var b = 0; b < bytes.length; b++) appendBits(bytes[b], 8);
    var capBits = dataCap * 8;
    for (var t = 0; t < 4 && bb.length < capBits; t++) bb.push(0); // 终止符
    while (bb.length % 8 !== 0) bb.push(0);
    var pad = 0xEC;
    while (bb.length < capBits) { appendBits(pad, 8); pad = pad === 0xEC ? 0x11 : 0xEC; }

    var data = [];
    for (var i = 0; i < bb.length; i += 8) {
      var cw = 0;
      for (var j = 0; j < 8; j++) cw = (cw << 1) | bb[i + j];
      data.push(cw);
    }

    /* -- 分块 + 纠错 + 交织 -- */
    var numBlocks = EC_BLOCKS[eclIdx][version];
    var blockEccLen = ECC_PER_BLOCK[eclIdx][version];
    var rawCw = Math.floor(numRawDataModules(version) / 8);
    var numShort = numBlocks - rawCw % numBlocks;
    var shortLen = Math.floor(rawCw / numBlocks);
    var divisor = rsDivisor(blockEccLen);
    var blocks = [];
    for (var bi = 0, k = 0; bi < numBlocks; bi++) {
      var dl = shortLen - blockEccLen + (bi < numShort ? 0 : 1);
      var dat = data.slice(k, k + dl);
      k += dl;
      blocks.push({ dat: dat, ecc: rsRemainder(dat, divisor) });
    }
    var codewords = [];
    for (var di = 0; di < shortLen - blockEccLen + 1; di++) {
      for (var bj = 0; bj < numBlocks; bj++) {
        if (di < blocks[bj].dat.length) codewords.push(blocks[bj].dat[di]);
      }
    }
    for (var ei = 0; ei < blockEccLen; ei++) {
      for (var bj2 = 0; bj2 < numBlocks; bj2++) codewords.push(blocks[bj2].ecc[ei]);
    }

    /* -- 矩阵绘制 -- */
    var size = version * 4 + 17;
    var modules = [], isFunc = [];
    for (var y = 0; y < size; y++) {
      modules.push([]);
      isFunc.push([]);
      for (var x = 0; x < size; x++) { modules[y].push(false); isFunc[y].push(false); }
    }
    function setFn(x, y, dark) { modules[y][x] = dark; isFunc[y][x] = true; }

    function drawFinder(cx, cy) { // 7x7 定位图形 + 分隔带
      for (var dy = -4; dy <= 4; dy++) {
        for (var dx = -4; dx <= 4; dx++) {
          var dist = Math.max(Math.abs(dx), Math.abs(dy));
          var fx = cx + dx, fy = cy + dy;
          if (fx >= 0 && fx < size && fy >= 0 && fy < size) {
            setFn(fx, fy, dist !== 2 && dist !== 4);
          }
        }
      }
    }
    drawFinder(3, 3);
    drawFinder(size - 4, 3);
    drawFinder(3, size - 4);

    for (var tm = 8; tm < size - 8; tm++) { // 时序图形
      setFn(tm, 6, tm % 2 === 0);
      setFn(6, tm, tm % 2 === 0);
    }

    var ap = alignmentPositions(version); // 校正图形
    for (var ai = 0; ai < ap.length; ai++) {
      for (var aj = 0; aj < ap.length; aj++) {
        var isCorner = (ai === 0 && aj === 0) ||
                       (ai === 0 && aj === ap.length - 1) ||
                       (ai === ap.length - 1 && aj === 0);
        if (isCorner) continue;
        for (var dy2 = -2; dy2 <= 2; dy2++) {
          for (var dx2 = -2; dx2 <= 2; dx2++) {
            setFn(ap[ai] + dx2, ap[aj] + dy2,
                  Math.max(Math.abs(dx2), Math.abs(dy2)) !== 1);
          }
        }
      }
    }

    function drawFormat(mask) { // 格式信息（含 BCH 纠错，两份冗余）
      var data15 = (ECL_FORMAT[level] << 3) | mask;
      var rem = data15;
      for (var i2 = 0; i2 < 10; i2++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      var bits = ((data15 << 10) | rem) ^ 0x5412;
      for (var i3 = 0; i3 <= 5; i3++) setFn(8, i3, bitAt(bits, i3) === 1);
      setFn(8, 7, bitAt(bits, 6) === 1);
      setFn(8, 8, bitAt(bits, 7) === 1);
      setFn(7, 8, bitAt(bits, 8) === 1);
      for (var i4 = 9; i4 < 15; i4++) setFn(14 - i4, 8, bitAt(bits, i4) === 1);
      for (var i5 = 0; i5 < 8; i5++) setFn(size - 1 - i5, 8, bitAt(bits, i5) === 1);
      for (var i6 = 8; i6 < 15; i6++) setFn(8, size - 15 + i6, bitAt(bits, i6) === 1);
      setFn(8, size - 8, true); // 固定暗模块（列 8，第二份格式信息上方）
    }
    drawFormat(0); // 占位，选定掩码后重绘

    if (version >= 7) { // 版本信息（v7 起才有）
      var vrem = version;
      for (var vi = 0; vi < 12; vi++) vrem = (vrem << 1) ^ ((vrem >>> 11) * 0x1F25);
      var vbits = (version << 12) | vrem;
      for (var vi2 = 0; vi2 < 18; vi2++) {
        var vb = bitAt(vbits, vi2) === 1;
        var ax = size - 11 + (vi2 % 3);
        var ay = Math.floor(vi2 / 3);
        setFn(ax, ay, vb);
        setFn(ay, ax, vb);
      }
    }

    var wi = 0; // 码字蛇形布局
    for (var right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (var vert = 0; vert < size; vert++) {
        for (var jj = 0; jj < 2; jj++) {
          var x2 = right - jj;
          var upward = ((right + 1) & 2) === 0;
          var y2 = upward ? size - 1 - vert : vert;
          if (!isFunc[y2][x2] && wi < codewords.length * 8) {
            modules[y2][x2] = bitAt(codewords[wi >>> 3], 7 - (wi & 7)) === 1;
            wi++;
          }
        }
      }
    }

    function applyMask(msk) {
      for (var my = 0; my < size; my++) {
        for (var mx = 0; mx < size; mx++) {
          if (isFunc[my][mx]) continue;
          var invert;
          switch (msk) {
            case 0: invert = (mx + my) % 2 === 0; break;
            case 1: invert = my % 2 === 0; break;
            case 2: invert = mx % 3 === 0; break;
            case 3: invert = (mx + my) % 3 === 0; break;
            case 4: invert = (Math.floor(mx / 3) + Math.floor(my / 2)) % 2 === 0; break;
            case 5: invert = ((mx * my) % 2) + ((mx * my) % 3) === 0; break;
            case 6: invert = (((mx * my) % 2) + ((mx * my) % 3)) % 2 === 0; break;
            default: invert = (((mx + my) % 2) + ((mx * my) % 3)) % 2 === 0; break;
          }
          if (invert) modules[my][mx] = !modules[my][mx];
        }
      }
    }

    function penalty() { // 掩码评估罚分
      var pen = 0, r, c;
      for (r = 0; r < size; r++) { // 行连续同色
        var rc = false, rn = 0;
        for (c = 0; c < size; c++) {
          if (modules[r][c] === rc) {
            rn++;
            if (rn === 5) pen += 3; else if (rn > 5) pen++;
          } else { rc = modules[r][c]; rn = 1; }
        }
      }
      for (c = 0; c < size; c++) { // 列连续同色
        var rc2 = false, rn2 = 0;
        for (r = 0; r < size; r++) {
          if (modules[r][c] === rc2) {
            rn2++;
            if (rn2 === 5) pen += 3; else if (rn2 > 5) pen++;
          } else { rc2 = modules[r][c]; rn2 = 1; }
        }
      }
      for (r = 0; r < size - 1; r++) { // 2x2 同色块
        for (c = 0; c < size - 1; c++) {
          if (modules[r][c] === modules[r][c + 1] &&
              modules[r][c] === modules[r + 1][c] &&
              modules[r][c] === modules[r + 1][c + 1]) pen += 3;
        }
      }
      var patA = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0]; // 类定位图形 1:1:3:1:1
      var patB = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
      for (r = 0; r < size; r++) {
        for (c = 0; c + 10 < size; c++) {
          var okA = true, okB = true;
          for (var p1 = 0; p1 < 11; p1++) {
            if (modules[r][c + p1] !== (patA[p1] === 1)) okA = false;
            if (modules[r][c + p1] !== (patB[p1] === 1)) okB = false;
          }
          if (okA) pen += 40;
          if (okB) pen += 40;
        }
      }
      for (c = 0; c < size; c++) {
        for (r = 0; r + 10 < size; r++) {
          var okA2 = true, okB2 = true;
          for (var p2 = 0; p2 < 11; p2++) {
            if (modules[r + p2][c] !== (patA[p2] === 1)) okA2 = false;
            if (modules[r + p2][c] !== (patB[p2] === 1)) okB2 = false;
          }
          if (okA2) pen += 40;
          if (okB2) pen += 40;
        }
      }
      var dark = 0; // 明暗均衡
      for (r = 0; r < size; r++) for (c = 0; c < size; c++) if (modules[r][c]) dark++;
      var total = size * size;
      pen += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
      return pen;
    }

    var bestMask = 0, bestPen = Infinity;
    for (var m = 0; m < 8; m++) {
      applyMask(m);
      var p = penalty();
      if (p < bestPen) { bestPen = p; bestMask = m; }
      applyMask(m); // 撤销
    }
    applyMask(bestMask);
    drawFormat(bestMask);

    return { ok: true, version: version, size: size, modules: modules,
             byteLen: bytes.length, mask: bestMask };
  }

  /* ---------- 注册与渲染 ---------- */
  ToolBox.register({
    id: 'qrcode',
    name: '二维码生成',
    category: '编码 / 哈希',
    icon: ICON,
    description: '文本 / 链接即时生成标准二维码，支持纠错等级与尺寸调节，可复制或下载 PNG',

    render: function (root) {
      root.innerHTML =
        '<section class="card">' +
          '<div class="field">' +
            '<label class="label" for="qr-text">内容</label>' +
            '<textarea id="qr-text" class="textarea" rows="4" spellcheck="false"' +
              ' placeholder="输入文本或链接，如 https://example.com"></textarea>' +
          '</div>' +
          '<div class="qr-opts">' +
            '<div class="qr-opt"><label class="label" for="qr-ecl">纠错等级</label>' +
              '<select id="qr-ecl" class="select">' +
                '<option value="L">低（约 7%）</option>' +
                '<option value="M" selected>中（约 15%）</option>' +
                '<option value="Q">高（约 25%）</option>' +
                '<option value="H">最高（约 30%）</option>' +
              '</select></div>' +
            '<div class="qr-opt"><label class="label" for="qr-size">显示尺寸</label>' +
              '<select id="qr-size" class="select">' +
                '<option value="240">240 px</option>' +
                '<option value="320" selected>320 px</option>' +
                '<option value="480">480 px</option>' +
                '<option value="640">640 px</option>' +
              '</select></div>' +
            '<div class="qr-opt"><label class="label" for="qr-margin">留白边距</label>' +
              '<select id="qr-margin" class="select">' +
                '<option value="1">1 模块</option>' +
                '<option value="2">2 模块</option>' +
                '<option value="3">3 模块</option>' +
                '<option value="4" selected>4 模块（标准）</option>' +
              '</select></div>' +
          '</div>' +
          '<div class="hint error" id="qr-err" hidden></div>' +
          '<div class="qr-preview" id="qr-preview">' +
            '<canvas id="qr-canvas" hidden></canvas>' +
            '<span class="qr-empty" id="qr-empty">在上方输入内容，二维码将实时生成</span>' +
          '</div>' +
          '<div class="field-meta">' +
            '<span id="qr-meta"></span>' +
            '<span class="btn-row">' +
              '<button class="btn" type="button" id="qr-copy">复制图片</button>' +
              '<button class="btn btn-ghost" type="button" id="qr-dl">下载 PNG</button>' +
            '</span>' +
          '</div>' +
        '</section>';

      var ta = root.querySelector('#qr-text');
      var eclSel = root.querySelector('#qr-ecl');
      var sizeSel = root.querySelector('#qr-size');
      var marginSel = root.querySelector('#qr-margin');
      var errEl = root.querySelector('#qr-err');
      var canvas = root.querySelector('#qr-canvas');
      var emptyEl = root.querySelector('#qr-empty');
      var metaEl = root.querySelector('#qr-meta');
      var copyBtn = root.querySelector('#qr-copy');
      var dlBtn = root.querySelector('#qr-dl');
      var ctx = canvas.getContext('2d');
      var lastOk = null;

      function regenerate() {
        var text = ta.value;
        if (!text) {
          errEl.hidden = true; canvas.hidden = true; emptyEl.hidden = false;
          metaEl.textContent = ''; lastOk = null; return;
        }
        var res = makeQr(text, eclSel.value);
        if (!res.ok) {
          errEl.hidden = false; errEl.textContent = res.err;
          canvas.hidden = true; emptyEl.hidden = true;
          metaEl.textContent = ''; lastOk = null; return;
        }
        errEl.hidden = true;
        lastOk = res;
        var border = parseInt(marginSel.value, 10);
        var dispPx = parseInt(sizeSel.value, 10);
        var n = res.size + border * 2;
        var scale = Math.max(2, Math.ceil(dispPx / n)); // 整数倍缩放保证清晰
        canvas.width = canvas.height = n * scale;
        canvas.style.width = Math.min(dispPx, n * scale) + 'px';
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#000000';
        for (var y = 0; y < res.size; y++) {
          for (var x = 0; x < res.size; x++) {
            if (res.modules[y][x]) {
              ctx.fillRect((x + border) * scale, (y + border) * scale, scale, scale);
            }
          }
        }
        canvas.hidden = false; emptyEl.hidden = true;
        metaEl.textContent = '版本 ' + res.version + ' · ' + res.size + '×' + res.size +
          ' 模块 · ' + res.byteLen + ' 字节 · 纠错 ' + eclSel.value +
          ' · 输出 ' + canvas.width + 'px';
      }

      function withPng(fn) {
        if (!lastOk) { ToolBox.ui.toast('请先生成二维码', 'error'); return; }
        canvas.toBlob(fn, 'image/png');
      }

      copyBtn.addEventListener('click', function () {
        withPng(function (blob) {
          if (!blob) { ToolBox.ui.toast('生成图片失败', 'error'); return; }
          if (navigator.clipboard && window.ClipboardItem) {
            navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]).then(
              function () { ToolBox.ui.toast('已复制二维码图片'); },
              function () { ToolBox.ui.toast('复制失败，请使用下载', 'error'); }
            );
          } else {
            ToolBox.ui.toast('当前浏览器不支持复制图片，请使用下载', 'error');
          }
        });
      });

      dlBtn.addEventListener('click', function () {
        withPng(function (blob) {
          if (!blob) { ToolBox.ui.toast('生成图片失败', 'error'); return; }
          var a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = 'qrcode.png';
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
          ToolBox.ui.toast('已下载 qrcode.png');
        });
      });

      ta.addEventListener('input', regenerate);
      eclSel.addEventListener('change', regenerate);
      sizeSel.addEventListener('change', regenerate);
      marginSel.addEventListener('change', regenerate);
      regenerate();
    }
  });
})();
