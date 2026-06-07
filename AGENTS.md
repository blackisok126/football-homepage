# AGENTS.md

## 项目概览

这是一个轻量静态足球赛事个人主页，主要展示今日热门足球赛事、赛事编号、开赛时间、让球与胜平负赔率，并预留二维码区域用于交流引导。

项目不依赖前端框架或构建工具，核心文件如下：

- `index.html`：页面结构与内容文案。
- `styles.css`：全部页面样式和响应式布局。
- `main.js`：读取 `data/matches.json` 并渲染赛事卡片、二维码占位等交互。
- `data/matches.json`：前端读取的赛事数据文件。
- `scripts/fetch-matches.mjs`：Node.js 赛事抓取脚本。
- `.github/workflows/update-matches.yml`：GitHub Actions 定时更新赛事数据。
- `assets/qr.png`：用户后续上传的二维码图片路径，当前只保留 `assets/.gitkeep`。

## 开发原则

- 保持项目为无构建静态站，除非用户明确要求，不要引入 Vite、React、Vue、打包器或包管理依赖。
- 页面应能通过 `python3 -m http.server 4173` 直接预览。
- 不要把抓取逻辑放到前端运行；前端只读取 `data/matches.json`。
- 不要删除二维码缺失占位逻辑。`assets/qr.png` 不存在时，页面应显示“二维码待上传”。
- 不要在页面上显示完整数据源 URL，除非用户明确要求。单场赛事的“查看来源”链接可以保留。
- 修改 UI 后要检查移动端宽度，避免文字、卡片、赔率标签横向溢出。

## 赛事数据约定

`data/matches.json` 的顶层结构：

```json
{
  "date": "2026-06-07",
  "timezone": "Asia/Shanghai",
  "source": "https://jc.zhcw.com/index.php?act=zqjsq_hhgg",
  "updatedAt": "2026-06-07T08:36:00.000Z",
  "matches": []
}
```

单场赛事字段：

```json
{
  "matchNo": "周日201",
  "competition": "国际赛",
  "kickoffTime": "2026-06-07T18:45:00.000Z",
  "homeTeam": "克罗地亚",
  "awayTeam": "斯洛文尼",
  "status": "未开始",
  "handicap": "-1",
  "odds": {
    "win": "1.26",
    "draw": "4.45",
    "lose": "9.00"
  },
  "handicapOdds": {
    "win": "2.05",
    "draw": "3.08",
    "lose": "3.15"
  },
  "sourceUrl": "https://jc.zhcw.com/index.php?act=zqjsq_hhgg"
}
```

时间存储为 ISO 字符串，前端按 `Asia/Shanghai` 显示。赛事卡片当前展示普通胜平负赔率，不展示让球胜平负赔率；`handicapOdds` 先作为数据储备。

## 抓取脚本

默认抓取顺序在 `scripts/fetch-matches.mjs` 的 `DEFAULT_SOURCE_URLS` 中维护：

1. `https://jc.zhcw.com/index.php?act=zqjsq_hhgg`
2. `https://jc.titan007.com/index.aspx`

中彩网来源提供结构化 JSON 和赔率字段，应作为优先来源。titan007 来源作为备份，当前可提供赛事编号、开赛时间、球队和让球值，但普通胜平负赔率可能缺失。

运行抓取：

```bash
node scripts/fetch-matches.mjs
```

覆盖来源：

```bash
MATCH_SOURCE_URL="https://example.com/a,https://example.com/b" node scripts/fetch-matches.mjs
```

抓取失败时，脚本应保留已有 `data/matches.json`，避免前端变为空数据。

## 验证清单

常用检查：

```bash
node --check main.js
node --check scripts/fetch-matches.mjs
node scripts/fetch-matches.mjs
python3 -m http.server 4173
```

浏览器验证重点：

- 首页能显示赛事数量和赛事卡片。
- 赛事卡片包含编号、完整开赛日期时间、让球和胜平负赔率。
- 二维码图片不存在时显示占位，不出现破图白块。
- 页面不显示“数据来源：...”提示块。
- 手机宽度没有横向滚动或文字重叠。

## 文案与样式约定

- 首页定位是“赛事分享的个人网站”，首屏文案应引导访问者扫描二维码交流。
- 二维码区域标题使用“二维码”，不要改回“个人二维码”。
- 视觉风格保持体育媒体风：深色背景、高对比信息卡片、绿色/金色强调。
- 卡片和按钮圆角保持克制，避免大面积营销式装饰。
