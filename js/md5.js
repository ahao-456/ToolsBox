/* =========================================================
 * MD5 算法库（RFC 1321 纯 JS 实现，无任何第三方依赖）
 * ---------------------------------------------------------
 * - 浏览器：全局函数 MD5(text) → 32 位小写十六进制字符串
 * - Node  ：const md5 = require('./md5.js'); md5(text)（便于单元测试）
 * - 输入支持任意 Unicode 文本，按 UTF-8 编码后计算
 * - MD5 为不可逆散列，仅适用于校验/去重，勿用于安全场景
 * ========================================================= */
(function (root, factory) {
  if (typeof module === 'object' && typeof module.exports === 'object') module.exports = factory();
  else root.MD5 = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // 每一步的加法常量：T[i] = floor(4294967296 * |sin(i)|)，共 64 个（RFC 1321）
  var K = [
    0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee, 0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501,
    0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be, 0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821,
    0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa, 0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
    0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed, 0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a,
    0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c, 0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70,
    0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05, 0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
    0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039, 0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1,
    0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1, 0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391
  ];

  // 每一步的循环左移位数
  var S = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5,  9, 14, 20, 5,  9, 14, 20, 5,  9, 14, 20, 5,  9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21
  ];

  // 每一步取的消息字下标（四轮各 16 步）
  var IDX = [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
    1, 6, 11, 0, 5, 10, 15, 4, 9, 14, 3, 8, 13, 2, 7, 12,
    5, 8, 11, 14, 1, 4, 7, 10, 13, 0, 3, 6, 9, 12, 15, 2,
    0, 7, 14, 5, 12, 3, 10, 1, 8, 15, 6, 13, 4, 11, 2, 9
  ];

  // 将 JS 字符串按 UTF-8 编码为字节数组
  function utf8Bytes(str) {
    var out = [], i = 0, c, c2, cp;
    while (i < str.length) {
      c = str.charCodeAt(i++);
      if (c < 0x80) {
        out.push(c);
      } else if (c < 0x800) {
        out.push(0xC0 | (c >> 6), 0x80 | (c & 63));
      } else if (c >= 0xD800 && c <= 0xDBFF) {
        c2 = str.charCodeAt(i++);
        if (c2 >= 0xDC00 && c2 <= 0xDFFF) {
          cp = 0x10000 + ((c - 0xD800) << 10) + (c2 - 0xDC00);
          out.push(0xF0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
        } else { // 无效代理项，替换为 U+FFFD；c2 留给下一轮处理
          out.push(0xEF, 0xBF, 0xBD);
          i--;
        }
      } else {
        out.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      }
    }
    return out;
  }

  // 32 位字 → 小端序 8 个十六进制字符
  function hexLE(w) {
    var s = '', i;
    for (i = 0; i < 4; i++) s += ((w >>> (i * 8)) & 0xff).toString(16).padStart(2, '0');
    return s;
  }

  /** 计算 MD5，返回 32 位小写十六进制字符串 */
  function md5(input) {
    var bytes = utf8Bytes(String(input));
    var bitLen = bytes.length * 8;

    // 填充：0x80 + 0x00* + 8 字节小端位长度，使总长 ≡ 56 (mod 64)
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    var lo = bitLen >>> 0;                              // 低 32 位
    var hi = Math.floor(bitLen / 4294967296) >>> 0;     // 高 32 位
    bytes.push(lo & 0xff, (lo >>> 8) & 0xff, (lo >>> 16) & 0xff, (lo >>> 24) & 0xff,
               hi & 0xff, (hi >>> 8) & 0xff, (hi >>> 16) & 0xff, (hi >>> 24) & 0xff);

    var a = 0x67452301, b = 0xefcdab89, c = 0x98badcfe, d = 0x10325476;
    var M = new Array(16);

    for (var off = 0; off < bytes.length; off += 64) {
      var j, i;
      for (i = 0; i < 16; i++) {
        j = off + i * 4;
        M[i] = (bytes[j] | (bytes[j + 1] << 8) | (bytes[j + 2] << 16) | (bytes[j + 3] << 24)) | 0;
      }

      var A = a, B = b, C = c, D = d;
      for (i = 0; i < 64; i++) {
        var f;
        if (i < 16)      f = (B & C) | (~B & D);        // F
        else if (i < 32) f = (D & B) | (~D & C);        // G
        else if (i < 48) f = B ^ C ^ D;                 // H
        else             f = C ^ (B | ~D);              // I
        var tmp = D; D = C; C = B;
        var sum = (A + f + K[i] + M[IDX[i]]) | 0;
        B = (B + ((sum << S[i]) | (sum >>> (32 - S[i])))) | 0;
        A = tmp;
      }

      a = (a + A) | 0; b = (b + B) | 0; c = (c + C) | 0; d = (d + D) | 0;
    }

    return hexLE(a) + hexLE(b) + hexLE(c) + hexLE(d);
  }

  return md5;
});
