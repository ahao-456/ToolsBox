/* =========================================================
 * 工具：HTTP 状态码速查表
 * ---------------------------------------------------------
 * - 收录 73 个状态码：RFC 9110 等标准码 + 常见非官方码
 *   （Nginx 499、Cloudflare 52x、Twitter 420 等，带徽章标注）
 * - 按 1xx-5xx 分组筛选 + 关键词搜索（码数 / 英文名 / 中文描述）
 * - 五档颜色区分，点击条目复制状态码
 * 结构说明见 js/tools/timestamp.js 文件头注释。
 * ========================================================= */
(function () {
  'use strict';

  /* 工具图标（内联 SVG，随本文件加载，不依赖公共注册表） */
  var ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>';

  /* ---------- 状态码数据：[码, 英文名, 中文说明, 分组(1-5 / 0=非官方)] ---------- */
  var CODES = [
    [100, 'Continue', '客户端应继续发送请求的剩余部分，用于大请求体发送前的前置确认', 1],
    [101, 'Switching Protocols', '服务器同意切换协议，通过 Upgrade 头协商（如升级到 WebSocket）', 1],
    [102, 'Processing', '服务器已收到请求但尚未处理完成，用于防止客户端超时（WebDAV）', 1],
    [103, 'Early Hints', '在最终响应前先返回部分响应头，帮助客户端预加载资源', 1],

    [200, 'OK', '请求成功，响应体返回所请求的资源', 2],
    [201, 'Created', '请求成功且服务器创建了新资源，常用于 POST 创建场景', 2],
    [202, 'Accepted', '请求已接受但尚未处理完成，适用于异步任务', 2],
    [203, 'Non-Authoritative Information', '返回来自本地代理或第三方的非权威信息', 2],
    [204, 'No Content', '请求成功但响应不含内容，常用于 DELETE / PUT 操作', 2],
    [205, 'Reset Content', '请求成功，要求客户端重置文档视图（如表单清空）', 2],
    [206, 'Partial Content', '服务器成功处理了部分 GET 请求，用于断点续传（Range）', 2],
    [207, 'Multi-Status', '一次操作涉及多个资源的复合状态响应（WebDAV）', 2],
    [208, 'Already Reported', 'DAV 集合中的资源已在前面列出，避免重复传输（WebDAV）', 2],
    [226, 'IM Used', '服务器对资源执行了实例操作，返回的是差量结果（Delta 编码）', 2],

    [300, 'Multiple Choices', '资源存在多种表示形式，供客户端自行选择', 3],
    [301, 'Moved Permanently', '资源已永久移动到新 URI，搜索引擎与书签会随之更新', 3],
    [302, 'Found', '资源临时移动到其他 URI；历史原因语义模糊，规范建议改用 303/307', 3],
    [303, 'See Other', '请求的处理结果需用 GET 访问另一个 URI 获取', 3],
    [304, 'Not Modified', '资源未发生变化，客户端可继续使用本地缓存', 3],
    [305, 'Use Proxy', '请求必须通过代理访问（已废弃）', 3],
    [306, 'Switch Proxy', '不再使用，仅作为历史记录保留', 3],
    [307, 'Temporary Redirect', '临时重定向，且禁止改变请求方法（POST 保持 POST）', 3],
    [308, 'Permanent Redirect', '永久重定向，且禁止改变请求方法', 3],

    [400, 'Bad Request', '请求存在语法错误，服务器无法理解', 4],
    [401, 'Unauthorized', '未认证，需登录或携带凭证（响应应含 WWW-Authenticate 头）', 4],
    [402, 'Payment Required', '需要付款，保留作将来使用', 4],
    [403, 'Forbidden', '服务器理解请求但拒绝执行，通常是权限不足', 4],
    [404, 'Not Found', '服务器找不到请求的资源，最常见的客户端错误', 4],
    [405, 'Method Not Allowed', '请求方法不被目标资源支持，响应 Allow 头列出可用方法', 4],
    [406, 'Not Acceptable', '资源无法满足客户端 Accept 头的内容协商要求', 4],
    [407, 'Proxy Authentication Required', '需要先通过代理服务器完成认证', 4],
    [408, 'Request Timeout', '客户端在服务器等待期限内未发送请求，超时', 4],
    [409, 'Conflict', '请求与服务器当前状态冲突，如并发编辑同一资源', 4],
    [410, 'Gone', '资源已永久删除且无新地址，与 404 的区别在于明确表示不复存在', 4],
    [411, 'Length Required', '服务器要求请求必须携带 Content-Length 头', 4],
    [412, 'Precondition Failed', '前置条件校验失败（If-Match / If-None-Match 不通过）', 4],
    [413, 'Payload Too Large', '请求体超过服务器允许处理的大小', 4],
    [414, 'URI Too Long', '请求的 URI 超过服务器愿意解析的长度', 4],
    [415, 'Unsupported Media Type', '请求的媒体格式（Content-Type）服务器不支持', 4],
    [416, 'Range Not Satisfiable', 'Range 请求的范围超出资源的实际大小', 4],
    [417, 'Expectation Failed', 'Expect 请求头中的期望无法满足', 4],
    [418, "I'm a teapot", '愚人节彩蛋：拒绝用茶壶煮咖啡（HTCPCP）', 4],
    [421, 'Misdirected Request', '请求被发送到无法生成响应的服务器（Host / SNI 不匹配）', 4],
    [422, 'Unprocessable Content', '请求格式正确但语义错误无法处理，常用于表单校验失败', 4],
    [423, 'Locked', '资源被锁定，暂时无法访问（WebDAV）', 4],
    [424, 'Failed Dependency', '因先前请求失败导致本次请求无法完成（WebDAV）', 4],
    [425, 'Too Early', '服务器不愿承担重放风险，拒绝处理过早的请求', 4],
    [426, 'Upgrade Required', '客户端必须切换协议才能完成请求（如升级到 TLS）', 4],
    [428, 'Precondition Required', '服务器要求请求携带前置条件，防止丢失更新', 4],
    [429, 'Too Many Requests', '单位时间内请求过多被限流，Retry-After 头给出等待时间', 4],
    [431, 'Request Header Fields Too Large', '请求头字段总大小超过服务器限制', 4],
    [451, 'Unavailable For Legal Reasons', '因法律原因拒绝访问，如地区内容封锁', 4],

    [420, 'Enhance Your Calm', '请求频率过高，请放缓后再试（Twitter 非官方）', 0],
    [440, 'Login Time-out', '登录会话已过期超时（Microsoft IIS 非官方）', 0],
    [499, 'Client Closed Request', '客户端在服务器返回响应前主动断开连接（Nginx 非官方）', 0],

    [500, 'Internal Server Error', '服务器内部错误，最常见的服务端异常', 5],
    [501, 'Not Implemented', '服务器不支持该请求方法，无法处理', 5],
    [502, 'Bad Gateway', '网关或代理从上游服务器收到无效响应', 5],
    [503, 'Service Unavailable', '服务暂不可用，通常因过载或维护，可携带 Retry-After', 5],
    [504, 'Gateway Timeout', '网关或代理等待上游服务器响应超时', 5],
    [505, 'HTTP Version Not Supported', '服务器不支持请求使用的 HTTP 协议版本', 5],
    [506, 'Variant Also Negotiates', '透明内容协商配置错误导致循环协商', 5],
    [507, 'Insufficient Storage', '服务器存储空间不足，无法完成请求（WebDAV）', 5],
    [508, 'Loop Detected', '处理请求时检测到无限循环（WebDAV）', 5],
    [510, 'Not Extended', '请求需要扩展支持但缺少必要的扩展声明头', 5],
    [511, 'Network Authentication Required', '需先完成网络认证，如公共 Wi-Fi 登录门户', 5],

    [520, 'Web Server Returned an Unknown Error', '源站返回未知错误（Cloudflare 非官方）', 0],
    [521, 'Web Server Is Down', '源站拒绝连接，服务器可能已关机（Cloudflare 非官方）', 0],
    [522, 'Connection Timed Out', '与源站建立 TCP 连接超时（Cloudflare 非官方）', 0],
    [523, 'Origin Is Unreachable', '源站不可达（Cloudflare 非官方）', 0],
    [524, 'A Timeout Occurred', '与源站已建立连接但 HTTP 响应超时（Cloudflare 非官方）', 0],
    [525, 'SSL Handshake Failed', '与源站的 SSL 握手失败（Cloudflare 非官方）', 0],
    [526, 'Invalid SSL Certificate', '源站的 SSL 证书无效或配置错误（Cloudflare 非官方）', 0]
  ];

  var GROUPS = [
    ['0', '非官方'],
    ['1', '信息 1xx'],
    ['2', '成功 2xx'],
    ['3', '重定向 3xx'],
    ['4', '客户端错误 4xx'],
    ['5', '服务器错误 5xx']
  ];

  /* ---------- 注册与渲染 ---------- */
  ToolBox.register({
    id: 'http-status',
    name: 'HTTP 状态码',
    category: '编码 / 哈希',
    icon: ICON,
    description: '常用 HTTP 状态码速查（1xx-5xx 与非官方码），支持分组筛选与搜索',

    render: function (root) {
      var esc = ToolBox.ui.escape;

      root.innerHTML =
        '<section class="card">' +
          '<input id="hs-search" class="input" type="search" autocomplete="off" autocapitalize="off" spellcheck="false"' +
            ' placeholder="搜索：状态码 / 名称 / 描述，如 404、Too Many、限流">' +
          '<div class="chips" id="hs-chips">' +
            '<button type="button" class="chip active" data-group="all">全部</button>' +
            GROUPS.map(function (g) {
              return '<button type="button" class="chip" data-group="' + g[0] + '">' + esc(g[1]) + '</button>';
            }).join('') +
          '</div>' +
          '<div class="hint">收录 ' + CODES.length + ' 个状态码 · 点击条目复制状态码；灰色为非官方码（Nginx / Cloudflare 等）</div>' +
        '</section>' +

        '<section class="card">' +
          '<div class="card-head"><h2 class="card-title">状态码列表</h2><span class="badge" id="hs-count"></span></div>' +
          '<div id="hs-list"></div>' +
        '</section>';

      var search = root.querySelector('#hs-search');
      var chipsEl = root.querySelector('#hs-chips');
      var list = root.querySelector('#hs-list');
      var count = root.querySelector('#hs-count');
      var activeGroup = 'all';

      function row(e) {
        return '<button type="button" class="hs-row" data-code="' + e[0] + '" title="点击复制 ' + e[0] + '">' +
          '<span class="hs-code hs-g' + e[3] + '">' + e[0] + '</span>' +
          '<span class="hs-info">' +
            '<span class="hs-name">' + esc(e[1]) +
              (e[3] === 0 ? ' <span class="hs-off">非官方</span>' : '') +
            '</span>' +
            '<span class="hs-desc">' + esc(e[2]) + '</span>' +
          '</span>' +
        '</button>';
      }

      function apply() {
        var q = search.value.trim().toLowerCase();
        var shown = CODES.filter(function (e) {
          if (activeGroup !== 'all' && String(e[3]) !== activeGroup) return false;
          if (!q) return true;
          return String(e[0]).indexOf(q) !== -1 ||
                 e[1].toLowerCase().indexOf(q) !== -1 ||
                 e[2].toLowerCase().indexOf(q) !== -1;
        });

        count.textContent = shown.length + ' / ' + CODES.length;

        if (!shown.length) {
          list.innerHTML = '<div class="cur-empty">未找到匹配的状态码，换个关键词试试</div>';
          return;
        }
        list.innerHTML = shown.map(row).join('');
      }

      function copy(code) {
        ToolBox.ui.copyText(String(code)).then(function (ok) {
          ToolBox.ui.toast(ok ? '已复制：' + code : '复制失败，请手动复制', ok ? '' : 'error');
        });
      }

      search.addEventListener('input', apply);

      chipsEl.addEventListener('click', function (e) {
        var chip = e.target.closest('.chip');
        if (!chip) return;
        activeGroup = chip.dataset.group;
        chipsEl.querySelectorAll('.chip').forEach(function (c) {
          c.classList.toggle('active', c === chip);
        });
        apply();
      });

      list.addEventListener('click', function (e) {
        var rowEl = e.target.closest('.hs-row');
        if (rowEl) copy(rowEl.dataset.code);
      });

      apply();
    }
  });
})();
