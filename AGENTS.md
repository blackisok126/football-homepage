# AGENTS.md

## 项目概览

这是一个轻量无构建静态足球赛事个人主页，用于展示世界杯赛事、开赛时间、倒计时、比赛状态、比分，并提供二维码区域引导访客扫码交流。

项目不依赖前端框架或打包器，核心文件如下：

- `index.html`：页面结构、主要文案、二维码弹窗结构。
- `styles.css`：全部视觉样式、信息层级和响应式布局。
- `main.js`：通过统一数据入口读取赛事 payload，渲染赛事卡片、状态、倒计时、二维码加载与保存交互。
- `src/lib/matches/getTodayMatches.js`：前端统一数据入口，优先读取世界杯缓存。
- `src/lib/matches/providers/worldCupProvider.js`：API-Football 世界杯 provider、中文映射和 Supabase row adapter。
- `netlify/functions/world-cup-matches.js`：从 Supabase 读取世界杯赛事缓存。
- `netlify/functions/sync-world-cup-matches.js`：定时从 API-Football 同步世界杯赛事并写入 Supabase。
- `data/football-cn-aliases.json`：联赛、球队、状态中文映射。
- `supabase/schema.sql`：Supabase 表结构。
- `scripts/prepare-qr-assets.mjs`：根据二维码原图生成轻量展示图。
- `assets/qr.PNG`：二维码原图，用于保存到相册或下载。
- `assets/qr-display.png`：页面优先加载的轻量二维码展示图。
- `assets/qr-pitch-texture.png`、`assets/hero-neon-banner.png`、`assets/stadium-night-bg.png`：页面视觉素材。

## 开发原则

- 保持项目为无构建静态站，除非用户明确要求，不要引入 Vite、React、Vue 或打包器。
- 页面应能通过 `python3 -m http.server 4173` 直接预览；本地没有 Netlify Functions 时，前端必须回退到备用数据或 mock 数据。
- 不要在前端请求 API-Football，不要在前端爬取中国体彩、Sporttery 或其他网站。
- 赛事数据应通过 `src/lib/matches/getTodayMatches.js` 统一读取。
- API key、Supabase service role key 只能在 Netlify Function 服务端使用，不要写进前端或提交到代码。
- 不要删除二维码缺失占位逻辑。二维码图片不可用时，页面应显示“二维码待上传”。
- 二维码展示应优先加载 `assets/qr-display.png`，保存/分享时仍使用 `assets/qr.PNG`。
- `assets/qr-display.png` 不可用时，前端应回退加载 `assets/qr.PNG`，避免页面直接空白。
- 修改 UI 后要检查移动端宽度，避免文字、卡片、赔率标签、二维码弹窗横向溢出。
- 当前设计是体育媒体风：深色背景、高对比信息卡片、绿色/金色强调，卡片和按钮圆角保持克制。

## 赛事数据约定

前端优先读取：

```text
/.netlify/functions/world-cup-matches
```

如果世界杯缓存不可用，再回退：

```text
/api/matches-today
```

仍失败时展示 mock 数据，页面不能白屏。

世界杯前端赛事字段示例：

```json
{
  "id": "api_football:worldcup:2026:123456",
  "matchDate": "2026-06-11",
  "kickoffTime": "2026-06-11T19:00:00+08:00",
  "league": "世界杯",
  "homeTeam": "阿根廷",
  "awayTeam": "法国",
  "status": "not_started",
  "statusCn": "未开始",
  "homeScore": null,
  "awayScore": null,
  "round": "Group A - 1",
  "source": "api_football",
  "sourceStatus": "cache",
  "updatedAt": "2026-06-08T00:00:00.000Z"
}
```

状态归一为：

- `not_started`：未开始
- `live`：进行中
- `finished`：已结束
- `postponed`：已延期
- `unknown`：待确认

中文队名、联赛名、状态优先使用 `data/football-cn-aliases.json`。缺少中文映射时显示 API-Football 原名，不影响页面渲染。

## 数据同步

世界杯同步函数：

```text
/.netlify/functions/sync-world-cup-matches
```

该函数使用 API-Football `fixtures` 接口，默认读取：

- league id：`1`
- season：`2026`
- timezone：`Asia/Shanghai`

同步结果写入 Supabase `world_cup_matches`，按 `match_key` upsert。API-Football 同步失败时不要清空旧缓存。

需要的环境变量：

```bash
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
API_FOOTBALL_KEY=
FOOTBALL_API_BASE_URL=https://v3.football.api-sports.io
API_FOOTBALL_WORLD_CUP_LEAGUE_ID=1
API_FOOTBALL_WORLD_CUP_SEASON=2026
API_FOOTBALL_TIMEZONE=Asia/Shanghai
```

`FOOTBALL_API_KEY` 作为旧变量名仍兼容，但推荐使用 `API_FOOTBALL_KEY`。

## 二维码更新流程

二维码原图路径固定为：

```text
assets/qr.PNG
```

页面展示图路径固定为：

```text
assets/qr-display.png
```

更新二维码时，只需要替换 `assets/qr.PNG`。然后运行：

```bash
node scripts/prepare-qr-assets.mjs
```

该脚本会使用本机可用图片工具生成 `assets/qr-display.png`：

- macOS 优先使用 `sips`。
- Linux / GitHub Actions 使用 ImageMagick 的 `magick` 或 `convert`。

推送 `assets/qr.PNG` 后，`.github/workflows/prepare-qr-assets.yml` 会自动生成并提交新的 `assets/qr-display.png`。

## 验证清单

常用检查：

```bash
npm run build
node scripts/build-check.mjs
node scripts/prepare-qr-assets.mjs
python3 -m http.server 4173
```

浏览器验证重点：

- 首页能显示赛事数量和赛事卡片。
- 赛事卡片包含完整开赛日期时间、倒计时、状态、球队和比分/VS。
- 数据源优先显示世界杯缓存相关提示。
- 比赛状态只显示为“未开始 / 进行中 / 已结束 / 已延期 / 待确认”。
- 二维码图片不存在时显示占位，不出现破图白块。
- 二维码弹窗标题“二维码”居中。
- 二维码按钮文案为“保存到相册”。
- 手机宽度没有横向滚动或文字重叠。

## 文案与样式约定

- 首页定位是“赛事分享的个人网站”，首屏文案应引导访问者扫描二维码交流。
- 二维码区域标题使用“二维码”，不要改回“个人二维码”。
- 二维码说明文案保持简洁，当前为“扫码交流赛程、看法和观赛提醒。”
- 赛事列表标题使用“今日热门赛事”。
- 赛事卡片应保持信息优先：开赛时间、状态、开赛日期、倒计时、球队、比分。
- 视觉风格保持体育媒体风：深色背景、高对比信息卡片、绿色/金色强调。
- 卡片和按钮圆角保持克制，避免大面积营销式装饰。
