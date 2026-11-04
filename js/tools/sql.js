/* =========================================================
 * 工具：SQL 格式化
 * ---------------------------------------------------------
 * - 轻量词法格式化：关键字换行对齐（SELECT / FROM / WHERE /
 *   JOIN / GROUP BY / ORDER BY …）、SELECT 列表逗号换行、
 *   AND / OR 条件续行缩进、括号内按层级缩进
 * - 保留字符串 / 注释原样；关键字可大写 / 保持原样；缩进 2/4 空格
 * - BETWEEN…AND 不误拆；多语句按分号分段空行
 * - 常用语句速查：14 条模板，一键填入格式化或复制
 * 结构说明见 js/tools/timestamp.js 文件头注释。
 * ========================================================= */
(function () {
  'use strict';

  /* 工具图标（内联 SVG，随本文件加载，不依赖公共注册表） */
  var ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"/></svg>';

  /* ---------- 词法与分析表 ---------- */

  /* 行注释 | 块注释 | 单引号串 | 双引号/反引号标识符 | 数字 | 单词 | 空白 | 多字符运算符 | 其他 */
  var RE = /(--[^\n]*)|(\/\*[\s\S]*?\*\/)|('(?:[^']|'')*')|("(?:[^"]|"")*"|`[^`]*`)|(\d+(?:\.\d+)?)|([A-Za-z_][A-Za-z0-9_$]*)|(\s+)|(>=|<=|<>|!=|\|\||:=|::|->|=>)|(.)/g;

  function mkSet(s) {
    var o = {};
    s.split(' ').forEach(function (k) { if (k) o[k] = 1; });
    return o;
  }

  /* 需要大写化的关键字与常见函数名 */
  var KWS = mkSet('SELECT FROM WHERE GROUP BY HAVING ORDER LIMIT OFFSET INSERT INTO UPDATE DELETE SET VALUES CREATE TABLE ALTER DROP TRUNCATE ADD COLUMN RENAME UNION ALL INTERSECT EXCEPT WITH ON USING AND OR NOT NULL IS IN LIKE BETWEEN EXISTS DISTINCT AS CASE WHEN THEN ELSE END ASC DESC PRIMARY KEY FOREIGN REFERENCES DEFAULT UNIQUE CONSTRAINT INDEX VIEW CHECK IF CASCADE BEGIN COMMIT ROLLBACK RETURNING MERGE JOIN INNER FULL OUTER CROSS NATURAL STRAIGHT_JOIN OVER PARTITION ROWS RANGE UNBOUNDED PRECEDING FOLLOWING CURRENT ROW COUNT SUM AVG MIN MAX COALESCE IFNULL NULLIF ROUND FLOOR CEIL ABS CONCAT SUBSTRING SUBSTR LENGTH UPPER LOWER TRIM LTRIM RTRIM REPLACE NOW CURDATE CURTIME CURRENT_DATE CURRENT_TIME CURRENT_TIMESTAMP DATE_FORMAT DATEDIFF TIMESTAMPDIFF ROW_NUMBER RANK DENSE_RANK NTILE LAG LEAD FIRST_VALUE LAST_VALUE CAST CONVERT EXTRACT GROUP_CONCAT STRING_AGG ARRAY_AGG LEFT RIGHT INSTR LOCATE MOD POWER SQRT TRUE FALSE AUTO_INCREMENT SERIAL VARCHAR CHAR TINYINT SMALLINT INT INTEGER BIGINT MEDIUMINT DECIMAL NUMERIC FLOAT DOUBLE REAL DATE DATETIME TIMESTAMP TIME YEAR');
  /* 函数名与类型名：其后紧跟的 ( 不加空格（COUNT(*)、VARCHAR(50) 而非 COUNT (*)） */
  var FUNCS = mkSet('COUNT SUM AVG MIN MAX COALESCE IFNULL NULLIF ROUND FLOOR CEIL ABS CONCAT SUBSTRING SUBSTR LENGTH UPPER LOWER TRIM LTRIM RTRIM REPLACE NOW CURDATE CURRENT_DATE CURRENT_TIMESTAMP DATE_FORMAT DATEDIFF TIMESTAMPDIFF ROW_NUMBER RANK DENSE_RANK NTILE LAG LEAD FIRST_VALUE LAST_VALUE CAST CONVERT EXTRACT GROUP_CONCAT STRING_AGG ARRAY_AGG LEFT RIGHT INSTR LOCATE MOD POWER SQRT VARCHAR CHAR TINYINT SMALLINT INT INTEGER BIGINT MEDIUMINT DECIMAL NUMERIC FLOAT DOUBLE REAL DATE DATETIME TIMESTAMP TIME YEAR');
  /* 顶格换行的子句起始词 */
  var NEWLINE = mkSet('SELECT FROM WHERE GROUP HAVING ORDER LIMIT OFFSET INSERT UPDATE DELETE SET VALUES UNION INTERSECT EXCEPT WITH ON CREATE ALTER DROP TRUNCATE RETURNING MERGE BEGIN');
  /* JOIN 修饰词（用于识别「LEFT JOIN」这类组合，避免 RIGHT( 函数误判） */
  var JOIN_MOD = mkSet('LEFT RIGHT INNER OUTER FULL CROSS NATURAL');

  /**
   * SQL 格式化。opts: {upper:bool, indent:2|4}
   * 返回 {text, lines, statements}
   */
  function formatSql(sql, opts) {
    var upper = !opts || opts.upper !== false;
    var ind = (opts && opts.indent) || 2;
    var toks = [];
    RE.lastIndex = 0;
    var m;
    while ((m = RE.exec(sql)) !== null) {
      if (m[7]) continue; // 空白
      if (m[1]) toks.push({ t: 'lc', raw: m[1] });
      else if (m[2]) toks.push({ t: 'bc', raw: m[2] });
      else if (m[3]) toks.push({ t: 'str', raw: m[3] });
      else if (m[4]) toks.push({ t: 'str', raw: m[4] });
      else if (m[5]) toks.push({ t: 'num', raw: m[5] });
      else if (m[6]) toks.push({ t: 'word', raw: m[6] });
      else toks.push({ t: 'sym', raw: m[8] || m[9] });
    }
    if (!toks.length) return { text: '', lines: 0, statements: 0 };

    var lines = [], cur = '';
    var depth = 0, extra = 0, lineDepth = 0, last = null;
    var joinChain = false; /* LEFT … JOIN 组合中：后续修饰词与 JOIN 本身不再换行 */
    var statements = 1;
    /* 括号栈：{block:1|0, ld:开括号所在行缩进}。
       block=1 为「块型括号」（CREATE TABLE x (、OVER (）：内容换行缩进、
       内部逗号换行、闭括号对齐开括号行；其余括号全部紧凑。 */
    var listStack = [];

    /** 块内续行的目标缩进层级：开括号行 + 1 级 */
    function blockExtra() {
      var top = listStack.length ? listStack[listStack.length - 1] : null;
      return top && top.block ? top.ld + 1 - depth : 0;
    }

    function flush() {
      var s = cur.trim();
      if (s) lines.push(new Array(lineDepth * ind + 1).join(' ') + s);
      cur = '';
    }

    /* 当前 token 前是否不加空格：逗号/右括号/点，或上一个 token 是 ( 或函数名后的 ( */
    function noSpace(tok) {
      if (cur === '') return false;
      var r = tok.raw;
      if (r === ',' || r === ')' || r === '.' || r === ';') return true;
      if (last) {
        if (last.raw === '(' || last.raw === '.') return true;
        if (r === '(' && last.t === 'word' && FUNCS[last.raw.toUpperCase()]) return true;
      }
      return false;
    }

    function push(tok) {
      var r = tok.raw;
      if (tok.t === 'word' && upper && KWS[r.toUpperCase()]) r = r.toUpperCase();
      if (cur === '') { lineDepth = depth + extra; cur = r; }
      else cur += (noSpace(tok) ? '' : ' ') + r;
      last = tok;
    }

    /* LEFT/RIGHT… 后面是否跟着 JOIN（是则作为 JOIN 子句起始换行） */
    function isJoinStart(i) {
      var w = toks[i].raw.toUpperCase();
      if (w === 'JOIN') return true;
      if (!JOIN_MOD[w]) return false;
      var j = i + 1;
      while (j < toks.length && toks[j].t === 'word' && JOIN_MOD[toks[j].raw.toUpperCase()]) j++;
      return j < toks.length && toks[j].t === 'word' && toks[j].raw.toUpperCase() === 'JOIN';
    }

    /* AND 是否属于 BETWEEN x AND y（向前扫描，遇到子句词/逗号即否定） */
    function betweenAnd(i) {
      for (var j = i - 1; j >= 0 && i - j <= 12; j--) {
        var tk = toks[j];
        if (tk.t === 'word') {
          var w = tk.raw.toUpperCase();
          if (w === 'BETWEEN') return true;
          if (w === 'SELECT' || w === 'WHERE' || w === 'ON' || w === 'HAVING' ||
              w === 'WHEN' || w === 'THEN' || w === 'ELSE' || w === 'CASE') return false;
        } else if (tk.t === 'sym' && (tk.raw === ',' || tk.raw === '(' || tk.raw === ';')) {
          return false;
        }
      }
      return false;
    }

    for (var i = 0; i < toks.length; i++) {
      var tk = toks[i];
      if (tk.t === 'word') {
        var w = tk.raw.toUpperCase();
        if (joinChain) {
          /* LEFT/FULL … JOIN 链中间：JOIN 与剩余修饰词接续当前行 */
          if (w === 'JOIN' || JOIN_MOD[w]) {
            push(tk);
            joinChain = w !== 'JOIN';
            continue;
          }
          joinChain = false;
        }
        if (NEWLINE[w] || isJoinStart(i)) {
          /* 开括号后紧跟子句词（IN (SELECT、AS (SELECT）：连排不换行 */
          if (cur.slice(-1) === '(') { push(tk); continue; }
          flush(); extra = blockExtra(); push(tk);
          joinChain = JOIN_MOD[w] === 1 && w !== 'JOIN'; /* 修饰词开头才进入链状态 */
          continue;
        }
        if ((w === 'AND' || w === 'OR') && !betweenAnd(i)) {
          flush(); extra = 1; push(tk); continue;
        }
        push(tk); continue;
      }
      if (tk.t === 'sym') {
        if (tk.raw === ',') {
          push(tk);
          /* 逗号换行：顶层（SELECT 列表 / SET / VALUES 元组）或块型括号内（建表列定义） */
          var top = listStack.length ? listStack[listStack.length - 1] : null;
          if (depth === 0) { flush(); extra = 1; }
          else if (top && top.block) { flush(); extra = blockExtra(); }
          continue;
        }
        if (tk.raw === ';') {
          push(tk); extra = 0; flush();
          var rest = false;
          for (var k = i + 1; k < toks.length; k++) {
            if (toks[k].t !== 'lc' && toks[k].t !== 'bc') { rest = true; break; }
          }
          if (rest) { lines.push(''); statements++; } /* 多语句之间空一行 */
          continue;
        }
        if (tk.raw === '(') {
          /* 块型括号判定：OVER (、CREATE TABLE x ( —— 内部为多元素结构需展开；
             函数 / IN / VALUES / 普通标识符后的括号一律紧凑（含 INSERT INTO t (cols)） */
          var isBlock = false;
          if (last && last.t === 'word') {
            var pw = last.raw.toUpperCase();
            if (pw === 'OVER') isBlock = true;
            else if (pw !== 'IN' && pw !== 'VALUES' && !FUNCS[pw]) {
              var prev = toks[i - 2];
              if (prev && prev.t === 'word' && prev.raw.toUpperCase() === 'TABLE') isBlock = true;
            }
          }
          push(tk); depth++;
          listStack.push({ block: isBlock ? 1 : 0, ld: lineDepth });
          if (isBlock) { flush(); extra = blockExtra(); } /* 开括号后立即换行，内容缩进一级 */
          continue;
        }
        if (tk.raw === ')') {
          var st = listStack.length ? listStack[listStack.length - 1] : null;
          if (st && st.block) {
            flush();
            if (depth > 0) depth--;
            listStack.pop();
            extra = st.ld - depth; /* 闭括号对齐到开括号所在行 */
            push(tk);
            extra = 0;
          } else {
            push(tk);
            if (depth > 0) { depth--; listStack.pop(); }
          }
          continue;
        }
      }
      push(tk);
    }
    flush();

    var nonBlank = lines.filter(function (l) { return l.trim(); }).length;
    return { text: lines.join('\n'), lines: nonBlank, statements: statements };
  }

  /* ---------- 常用语句速查 ---------- */
  var SNIPPETS = [
    ['全表查询', "SELECT * FROM table_name;"],
    ['条件查询 + 排序分页', "SELECT id, name, age FROM users WHERE age > 18 AND status = 'active' ORDER BY created_at DESC LIMIT 10;"],
    ['插入数据', "INSERT INTO users (id, name, age, email) VALUES (1, '张三', 25, 'zs@example.com');"],
    ['批量插入', "INSERT INTO users (id, name) VALUES (1, '张三'), (2, '李四'), (3, '王五');"],
    ['更新数据', "UPDATE users SET name = '李四', age = 26 WHERE id = 1;"],
    ['删除数据', "DELETE FROM users WHERE id = 1;"],
    ['左连接查询', "SELECT u.id, u.name, o.order_no FROM users u LEFT JOIN orders o ON u.id = o.user_id;"],
    ['分组统计', "SELECT dept_id, COUNT(*) AS emp_count, AVG(salary) AS avg_salary FROM employees GROUP BY dept_id HAVING COUNT(*) > 5 ORDER BY avg_salary DESC;"],
    ['子查询 IN', "SELECT * FROM users WHERE id IN (SELECT user_id FROM orders WHERE amount > 100);"],
    ['EXISTS 关联查询', "SELECT u.* FROM users u WHERE EXISTS (SELECT 1 FROM orders o WHERE o.user_id = u.id);"],
    ['建表语句', "CREATE TABLE users (id BIGINT PRIMARY KEY AUTO_INCREMENT, name VARCHAR(50) NOT NULL, age INT DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);"],
    ['分页查询', "SELECT * FROM users ORDER BY id LIMIT 20 OFFSET 40;"],
    ['CASE WHEN 分组', "SELECT name, CASE WHEN age < 18 THEN '未成年' WHEN age < 60 THEN '成年' ELSE '老年' END AS age_group FROM users;"],
    ['窗口函数排名', "SELECT name, dept_id, salary, ROW_NUMBER() OVER (PARTITION BY dept_id ORDER BY salary DESC) AS rn FROM employees;"]
  ];

  /* ---------- 注册与渲染 ---------- */
  ToolBox.register({
    id: 'sql',
    name: 'SQL 格式化',
    category: '数据库工具',
    icon: ICON,
    description: 'SQL 语句美化排版，附常用语句模板速查，一键填入或复制',

    render: function (root) {
      var esc = ToolBox.ui.escape;
      var iconCopy = ToolBox.ui.icon('copy');
      var iconIn = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 10 4 15l5 5"/><path d="M20 4v7a4 4 0 0 1-4 4H4"/></svg>';

      root.innerHTML =
        '<section class="card">' +
          '<div class="field">' +
            '<label class="label" for="sql-input">SQL 输入</label>' +
            '<textarea id="sql-input" class="textarea" rows="8" spellcheck="false"' +
              ' placeholder="粘贴需要格式化的 SQL，或从下方模板填入"></textarea>' +
          '</div>' +
          '<div class="rep-opts">' +
            '<label class="rep-opt"><input type="checkbox" id="sql-upper" checked>关键字大写</label>' +
            '<label class="rep-opt">缩进 <select id="sql-ind" class="select sql-ind">' +
              '<option value="2" selected>2 空格</option><option value="4">4 空格</option></select></label>' +
            '<span class="json-btns" style="margin-left:auto">' +
              '<button class="btn" type="button" id="sql-format">格式化 →</button>' +
              '<button class="btn btn-ghost" type="button" id="sql-clear">清空</button>' +
            '</span>' +
          '</div>' +
          '<div class="hint">常见方言均可（MySQL / PostgreSQL / SQLite 等）；BETWEEN…AND、括号与字符串内容不会被破坏</div>' +
        '</section>' +

        '<section class="card">' +
          '<div class="card-head"><h2 class="card-title">格式化结果</h2><span class="badge" id="sql-badge" hidden></span>' +
            '<span class="card-head-actions"><button class="btn-icon" type="button" data-copy="#sql-output" title="复制结果" aria-label="复制结果">' + iconCopy + '</button></span>' +
          '</div>' +
          '<textarea id="sql-output" class="textarea" rows="10" spellcheck="false" readonly></textarea>' +
        '</section>' +

        '<section class="card">' +
          '<div class="card-head"><h2 class="card-title">常用语句</h2></div>' +
          '<div class="hint">点填入按钮放入上方编辑并格式化；点复制按钮直接复制原文</div>' +
          '<div class="results">' +
            SNIPPETS.map(function (s, i) {
              return '<div class="result-row">' +
                '<span class="result-label">' + esc(s[0]) + '</span>' +
                '<span class="result-value sql-snip-value" id="sql-snip-' + i + '">' + esc(s[1]) + '</span>' +
                '<button class="btn-icon" type="button" data-snip="' + i + '" title="填入并格式化" aria-label="填入并格式化">' + iconIn + '</button>' +
                '<button class="btn-icon" type="button" data-copy="#sql-snip-' + i + '" title="复制语句" aria-label="复制语句">' + iconCopy + '</button>' +
              '</div>';
            }).join('') +
          '</div>' +
        '</section>';

      var input = root.querySelector('#sql-input');
      var upperEl = root.querySelector('#sql-upper');
      var indEl = root.querySelector('#sql-ind');
      var output = root.querySelector('#sql-output');
      var badge = root.querySelector('#sql-badge');

      function doFormat() {
        var sql = input.value;
        if (!sql.trim()) { ToolBox.ui.toast('请先输入 SQL', 'error'); return; }
        var r;
        try {
          r = formatSql(sql, {
            upper: upperEl.checked,
            indent: parseInt(indEl.value, 10) || 2
          });
        } catch (e) {
          ToolBox.ui.toast('格式化失败：' + e.message, 'error');
          return;
        }
        output.value = r.text;
        badge.hidden = false;
        badge.textContent = r.statements + ' 条语句 · ' + r.lines + ' 行';
      }

      root.querySelector('#sql-format').addEventListener('click', doFormat);
      root.querySelector('#sql-clear').addEventListener('click', function () {
        input.value = '';
        output.value = '';
        badge.hidden = true;
        input.focus();
      });

      root.querySelector('.results').addEventListener('click', function (e) {
        var btn = e.target.closest('[data-snip]');
        if (!btn) return;
        input.value = SNIPPETS[parseInt(btn.dataset.snip, 10)][1];
        doFormat();
        ToolBox.ui.toast('已填入并格式化');
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }
  });
})();
