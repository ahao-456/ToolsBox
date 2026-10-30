/* =========================================================
 * 工具：货币符号速查
 * ---------------------------------------------------------
 * - 覆盖全球 200 个国家 / 地区的货币名称、ISO 代码与常用符号
 * - 按大洲分组展示，支持按国家 / 货币名 / 代码 / 符号搜索
 * - 点击条目复制货币符号，点击右侧代码复制 ISO 代码
 * - 纯前端静态数据，搜索即时过滤
 * 结构说明见 js/tools/timestamp.js 文件头注释。
 * ========================================================= */
(function () {
  'use strict';

  /* 工具图标（内联 SVG，随本文件加载，不依赖公共注册表） */
  var ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/></svg>';

  /* ---------- 静态数据：[国家/地区, 货币名称, ISO 代码, 常用符号] ---------- */
  var DATA = {
    '亚洲': [
      ['中国', '人民币', 'CNY', '￥'],
      ['中国香港', '港元', 'HKD', 'HK$'],
      ['中国澳门', '澳门元', 'MOP', 'MOP$'],
      ['中国台湾', '新台币', 'TWD', 'NT$'],
      ['日本', '日元', 'JPY', '¥'],
      ['韩国', '韩元', 'KRW', '₩'],
      ['朝鲜', '朝鲜元', 'KPW', '₩'],
      ['蒙古', '图格里克', 'MNT', '₮'],
      ['越南', '越南盾', 'VND', '₫'],
      ['老挝', '基普', 'LAK', '₭'],
      ['柬埔寨', '瑞尔', 'KHR', '៛'],
      ['缅甸', '缅元', 'MMK', 'K'],
      ['泰国', '泰铢', 'THB', '฿'],
      ['马来西亚', '林吉特', 'MYR', 'RM'],
      ['新加坡', '新加坡元', 'SGD', 'S$'],
      ['文莱', '文莱元', 'BND', 'B$'],
      ['印度尼西亚', '印尼盾', 'IDR', 'Rp'],
      ['菲律宾', '比索', 'PHP', '₱'],
      ['东帝汶', '美元', 'USD', '$'],
      ['印度', '卢比', 'INR', '₹'],
      ['巴基斯坦', '卢比', 'PKR', '₨'],
      ['孟加拉国', '塔卡', 'BDT', '৳'],
      ['斯里兰卡', '卢比', 'LKR', 'Rs'],
      ['尼泊尔', '卢比', 'NPR', '₨'],
      ['不丹', '努扎姆', 'BTN', 'Nu.'],
      ['马尔代夫', '拉菲亚', 'MVR', 'Rf'],
      ['阿富汗', '阿富汗尼', 'AFN', '؋'],
      ['哈萨克斯坦', '坚戈', 'KZT', '₸'],
      ['乌兹别克斯坦', '苏姆', 'UZS', 'soʻm'],
      ['吉尔吉斯斯坦', '索姆', 'KGS', 'сом'],
      ['塔吉克斯坦', '索莫尼', 'TJS', 'SM'],
      ['土库曼斯坦', '马纳特', 'TMT', 'm'],
      ['阿塞拜疆', '马纳特', 'AZN', '₼'],
      ['亚美尼亚', '德拉姆', 'AMD', '֏'],
      ['格鲁吉亚', '拉里', 'GEL', '₾'],
      ['土耳其', '里拉', 'TRY', '₺'],
      ['塞浦路斯', '欧元', 'EUR', '€'],
      ['以色列', '新谢克尔', 'ILS', '₪'],
      ['伊朗', '里亚尔', 'IRR', '﷼'],
      ['伊拉克', '第纳尔', 'IQD', 'ع.د'],
      ['沙特阿拉伯', '里亚尔', 'SAR', '﷼'],
      ['也门', '里亚尔', 'YER', '﷼'],
      ['阿曼', '里亚尔', 'OMR', '﷼'],
      ['阿联酋', '迪拉姆', 'AED', 'د.إ'],
      ['卡塔尔', '里亚尔', 'QAR', '﷼'],
      ['巴林', '第纳尔', 'BHD', 'BD'],
      ['科威特', '第纳尔', 'KWD', 'KD'],
      ['约旦', '第纳尔', 'JOD', 'JD'],
      ['黎巴嫩', '镑', 'LBP', 'ل.ل'],
      ['叙利亚', '镑', 'SYP', '£S']
    ],
    '欧洲': [
      ['奥地利', '欧元', 'EUR', '€'],
      ['比利时', '欧元', 'EUR', '€'],
      ['克罗地亚', '欧元', 'EUR', '€'],
      ['爱沙尼亚', '欧元', 'EUR', '€'],
      ['芬兰', '欧元', 'EUR', '€'],
      ['法国', '欧元', 'EUR', '€'],
      ['德国', '欧元', 'EUR', '€'],
      ['希腊', '欧元', 'EUR', '€'],
      ['爱尔兰', '欧元', 'EUR', '€'],
      ['意大利', '欧元', 'EUR', '€'],
      ['拉脱维亚', '欧元', 'EUR', '€'],
      ['立陶宛', '欧元', 'EUR', '€'],
      ['卢森堡', '欧元', 'EUR', '€'],
      ['马耳他', '欧元', 'EUR', '€'],
      ['荷兰', '欧元', 'EUR', '€'],
      ['葡萄牙', '欧元', 'EUR', '€'],
      ['斯洛伐克', '欧元', 'EUR', '€'],
      ['斯洛文尼亚', '欧元', 'EUR', '€'],
      ['西班牙', '欧元', 'EUR', '€'],
      ['摩纳哥', '欧元', 'EUR', '€'],
      ['圣马力诺', '欧元', 'EUR', '€'],
      ['梵蒂冈', '欧元', 'EUR', '€'],
      ['安道尔', '欧元', 'EUR', '€'],
      ['黑山', '欧元', 'EUR', '€'],
      ['科索沃', '欧元', 'EUR', '€'],
      ['英国', '英镑', 'GBP', '£'],
      ['瑞士', '瑞士法郎', 'CHF', 'Fr.'],
      ['列支敦士登', '瑞士法郎', 'CHF', 'Fr.'],
      ['挪威', '挪威克朗', 'NOK', 'kr'],
      ['瑞典', '瑞典克朗', 'SEK', 'kr'],
      ['丹麦', '丹麦克朗', 'DKK', 'kr'],
      ['冰岛', '冰岛克朗', 'ISK', 'kr'],
      ['波兰', '兹罗提', 'PLN', 'zł'],
      ['捷克', '捷克克朗', 'CZK', 'Kč'],
      ['匈牙利', '福林', 'HUF', 'Ft'],
      ['罗马尼亚', '列伊', 'RON', 'lei'],
      ['保加利亚', '列弗', 'BGN', 'лв'],
      ['塞尔维亚', '第纳尔', 'RSD', 'дин.'],
      ['北马其顿', '第纳尔', 'MKD', 'ден'],
      ['阿尔巴尼亚', '列克', 'ALL', 'L'],
      ['波黑', '马克', 'BAM', 'KM'],
      ['乌克兰', '格里夫纳', 'UAH', '₴'],
      ['白俄罗斯', '卢布', 'BYN', 'Br'],
      ['摩尔多瓦', '列伊', 'MDL', 'L'],
      ['俄罗斯', '卢布', 'RUB', '₽']
    ],
    '美洲': [
      ['美国', '美元', 'USD', '$'],
      ['加拿大', '加元', 'CAD', 'C$'],
      ['墨西哥', '比索', 'MXN', '$'],
      ['伯利兹', '伯利兹元', 'BZD', 'BZ$'],
      ['危地马拉', '格查尔', 'GTQ', 'Q'],
      ['萨尔瓦多', '美元', 'USD', '$'],
      ['洪都拉斯', '伦皮拉', 'HNL', 'L'],
      ['尼加拉瓜', '科多巴', 'NIO', 'C$'],
      ['哥斯达黎加', '科朗', 'CRC', '₡'],
      ['巴拿马', '巴波亚', 'PAB', 'B/.'],
      ['古巴', '古巴比索', 'CUP', '$'],
      ['牙买加', '牙买加元', 'JMD', 'J$'],
      ['海地', '古德', 'HTG', 'G'],
      ['多米尼加', '比索', 'DOP', 'RD$'],
      ['巴哈马', '巴哈马元', 'BSD', 'B$'],
      ['开曼群岛', '开曼元', 'KYD', 'CI$'],
      ['巴巴多斯', '巴巴多斯元', 'BBD', 'Bds$'],
      ['安提瓜和巴布达', '东加勒比元', 'XCD', 'EC$'],
      ['圣基茨和尼维斯', '东加勒比元', 'XCD', 'EC$'],
      ['圣卢西亚', '东加勒比元', 'XCD', 'EC$'],
      ['圣文森特和格林纳丁斯', '东加勒比元', 'XCD', 'EC$'],
      ['格林纳达', '东加勒比元', 'XCD', 'EC$'],
      ['多米尼克', '东加勒比元', 'XCD', 'EC$'],
      ['特立尼达和多巴哥', '特立尼达和多巴哥元', 'TTD', 'TT$'],
      ['圭亚那', '圭亚那元', 'GYD', 'G$'],
      ['苏里南', '苏里南元', 'SRD', '$'],
      ['哥伦比亚', '比索', 'COP', '$'],
      ['委内瑞拉', '玻利瓦尔', 'VES', 'Bs.'],
      ['厄瓜多尔', '美元', 'USD', '$'],
      ['秘鲁', '索尔', 'PEN', 'S/'],
      ['玻利维亚', '玻利维亚诺', 'BOB', 'Bs'],
      ['巴西', '雷亚尔', 'BRL', 'R$'],
      ['巴拉圭', '瓜拉尼', 'PYG', '₲'],
      ['乌拉圭', '比索', 'UYU', '$U'],
      ['阿根廷', '比索', 'ARS', '$'],
      ['智利', '比索', 'CLP', '$']
    ],
    '非洲': [
      ['埃及', '埃及镑', 'EGP', 'E£'],
      ['利比亚', '第纳尔', 'LYD', 'ل.د'],
      ['突尼斯', '第纳尔', 'TND', 'د.ت'],
      ['阿尔及利亚', '第纳尔', 'DZD', 'د.ج'],
      ['摩洛哥', '迪拉姆', 'MAD', 'د.م.'],
      ['毛里塔尼亚', '乌吉亚', 'MRU', 'UM'],
      ['塞内加尔', '西非法郎', 'XOF', 'CFA'],
      ['马里', '西非法郎', 'XOF', 'CFA'],
      ['布基纳法索', '西非法郎', 'XOF', 'CFA'],
      ['科特迪瓦', '西非法郎', 'XOF', 'CFA'],
      ['几内亚比绍', '西非法郎', 'XOF', 'CFA'],
      ['多哥', '西非法郎', 'XOF', 'CFA'],
      ['贝宁', '西非法郎', 'XOF', 'CFA'],
      ['尼日尔', '西非法郎', 'XOF', 'CFA'],
      ['尼日利亚', '奈拉', 'NGN', '₦'],
      ['加纳', '塞地', 'GHS', 'GH₵'],
      ['几内亚', '几内亚法郎', 'GNF', 'FG'],
      ['塞拉利昂', '利昂', 'SLE', 'Le'],
      ['利比里亚', '利比里亚元', 'LRD', 'L$'],
      ['冈比亚', '达拉西', 'GMD', 'D'],
      ['佛得角', '埃斯库多', 'CVE', '$'],
      ['圣多美和普林西比', '多布拉', 'STN', 'Db'],
      ['喀麦隆', '中非法郎', 'XAF', 'FCFA'],
      ['加蓬', '中非法郎', 'XAF', 'FCFA'],
      ['乍得', '中非法郎', 'XAF', 'FCFA'],
      ['中非共和国', '中非法郎', 'XAF', 'FCFA'],
      ['刚果（布）', '中非法郎', 'XAF', 'FCFA'],
      ['赤道几内亚', '中非法郎', 'XAF', 'FCFA'],
      ['刚果（金）', '刚果法郎', 'CDF', 'FC'],
      ['安哥拉', '宽扎', 'AOA', 'Kz'],
      ['赞比亚', '克瓦查', 'ZMW', 'K'],
      ['津巴布韦', '津巴布韦元', 'ZWG', 'ZiG'],
      ['马拉维', '克瓦查', 'MWK', 'MK'],
      ['莫桑比克', '梅蒂卡尔', 'MZN', 'MT'],
      ['马达加斯加', '阿里亚里', 'MGA', 'Ar'],
      ['毛里求斯', '卢比', 'MUR', '₨'],
      ['科摩罗', '法郎', 'KMF', 'CF'],
      ['塞舌尔', '卢比', 'SCR', '₨'],
      ['南非', '兰特', 'ZAR', 'R'],
      ['纳米比亚', '纳米比亚元', 'NAD', 'N$'],
      ['博茨瓦纳', '普拉', 'BWP', 'P'],
      ['莱索托', '洛蒂', 'LSL', 'L'],
      ['斯威士兰', '里兰吉尼', 'SZL', 'E'],
      ['埃塞俄比亚', '比尔', 'ETB', 'Br'],
      ['厄立特里亚', '纳克法', 'ERN', 'Nfk'],
      ['吉布提', '法郎', 'DJF', 'Fdj'],
      ['索马里', '先令', 'SOS', 'Sh'],
      ['肯尼亚', '先令', 'KES', 'KSh'],
      ['坦桑尼亚', '先令', 'TZS', 'TSh'],
      ['乌干达', '先令', 'UGX', 'USh'],
      ['卢旺达', '法郎', 'RWF', 'FRw'],
      ['布隆迪', '法郎', 'BIF', 'FBu'],
      ['苏丹', '苏丹镑', 'SDG', 'ج.س'],
      ['南苏丹', '南苏丹镑', 'SSP', '£']
    ],
    '大洋洲': [
      ['澳大利亚', '澳元', 'AUD', 'A$'],
      ['新西兰', '新西兰元', 'NZD', 'NZ$'],
      ['斐济', '斐济元', 'FJD', 'FJ$'],
      ['巴布亚新几内亚', '基那', 'PGK', 'K'],
      ['所罗门群岛', '所罗门群岛元', 'SBD', 'SI$'],
      ['瓦努阿图', '瓦图', 'VUV', 'VT'],
      ['萨摩亚', '塔拉', 'WST', 'WS$'],
      ['汤加', '潘加', 'TOP', 'T$'],
      ['图瓦卢', '澳元', 'AUD', 'A$'],
      ['基里巴斯', '澳元', 'AUD', 'A$'],
      ['瑙鲁', '澳元', 'AUD', 'A$'],
      ['帕劳', '美元', 'USD', '$'],
      ['密克罗尼西亚联邦', '美元', 'USD', '$'],
      ['马绍尔群岛', '美元', 'USD', '$'],
      ['法属波利尼西亚', '太平洋法郎', 'XPF', '₣'],
      ['新喀里多尼亚', '太平洋法郎', 'XPF', '₣']
    ]
  };

  /* 扁平化索引（保持大洲顺序） */
  var FLAT = [];
  Object.keys(DATA).forEach(function (region) {
    DATA[region].forEach(function (e) {
      FLAT.push({ region: region, country: e[0], name: e[1], code: e[2], sym: e[3] });
    });
  });

  ToolBox.register({
    id: 'currency',
    name: '货币符号',
    category: '生活工具',
    icon: ICON,
    description: '全球国家 / 地区货币符号速查（￥ $ € £ …），支持搜索，点击复制',

    render: function (root) {
      var esc = ToolBox.ui.escape;
      var regions = Object.keys(DATA);
      var total = FLAT.length;
      var activeRegion = '全部';

      var row = function (e) {
        return '<button type="button" class="cur-row" data-sym="' + esc(e.sym) + '" title="点击复制 ' + esc(e.sym) + '">' +
          '<span class="cur-symbol">' + esc(e.sym) + '</span>' +
          '<span class="cur-info">' +
            '<span class="cur-country">' + esc(e.country) + '</span>' +
            '<span class="cur-name">' + esc(e.name) + '</span>' +
          '</span>' +
          '<span class="cur-code" data-code="' + esc(e.code) + '" title="点击复制代码 ' + esc(e.code) + '">' + esc(e.code) + '</span>' +
        '</button>';
      };

      root.innerHTML =
        '<section class="card">' +
          '<input id="cur-search" class="input" type="search" autocomplete="off" autocapitalize="off" spellcheck="false"' +
            ' placeholder="搜索：国家 / 货币名 / 代码 / 符号，如：日本、CNY、￥">' +
          '<div class="chips" id="cur-chips">' +
            '<button type="button" class="chip active" data-region="全部">全部</button>' +
            regions.map(function (r) {
              return '<button type="button" class="chip" data-region="' + esc(r) + '">' + esc(r) + '</button>';
            }).join('') +
          '</div>' +
          '<div class="hint">收录 ' + total + ' 个国家 / 地区 · 点击条目复制符号，点击右侧代码复制 ISO 代码</div>' +
        '</section>' +

        '<section class="card">' +
          '<div class="card-head"><h2 class="card-title">货币列表</h2><span class="badge" id="cur-count"></span></div>' +
          '<div id="cur-list"></div>' +
        '</section>';

      var search = root.querySelector('#cur-search');
      var chipsEl = root.querySelector('#cur-chips');
      var list = root.querySelector('#cur-list');
      var count = root.querySelector('#cur-count');

      function apply() {
        var q = search.value.trim().toLowerCase();
        var shown = FLAT.filter(function (e) {
          if (activeRegion !== '全部' && e.region !== activeRegion) return false;
          if (!q) return true;
          return e.country.toLowerCase().indexOf(q) !== -1 ||
                 e.name.toLowerCase().indexOf(q) !== -1 ||
                 e.code.toLowerCase().indexOf(q) !== -1 ||
                 e.sym.toLowerCase().indexOf(q) !== -1;
        });

        count.textContent = shown.length + ' / ' + total + ' 项';

        if (!shown.length) {
          list.innerHTML = '<div class="cur-empty">未找到匹配的货币，换个关键词试试</div>';
          return;
        }
        var html = '', lastRegion = null;
        shown.forEach(function (e) {
          if (e.region !== lastRegion) {
            if (lastRegion !== null) html += '</div></div>';
            html += '<div class="cur-group"><div class="cur-group-title">' + esc(e.region) + '</div><div class="cur-list">';
            lastRegion = e.region;
          }
          html += row(e);
        });
        html += '</div></div>';
        list.innerHTML = html;
      }

      function copy(text) {
        ToolBox.ui.copyText(text).then(function (ok) {
          ToolBox.ui.toast(ok ? '已复制：' + text : '复制失败，请手动复制', ok ? 'success' : 'error');
        });
      }

      search.addEventListener('input', apply);

      chipsEl.addEventListener('click', function (e) {
        var chip = e.target.closest('.chip');
        if (!chip) return;
        activeRegion = chip.dataset.region;
        chipsEl.querySelectorAll('.chip').forEach(function (c) {
          c.classList.toggle('active', c === chip);
        });
        apply();
      });

      list.addEventListener('click', function (e) {
        var codeEl = e.target.closest('.cur-code');
        if (codeEl) { copy(codeEl.dataset.code); return; }
        var rowEl = e.target.closest('.cur-row');
        if (rowEl) copy(rowEl.dataset.sym);
      });

      apply();
    }
  });
})();
