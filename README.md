# 绿茵今日

一个轻量、无构建的足球赛事个人主页。当前数据架构为：

- Netlify Scheduled Function 定时从 API-Football 同步世界杯赛事
- Supabase `world_cup_matches` 缓存世界杯赛程
- 前端优先读取世界杯缓存，不直接请求 API-Football
- 所有可控展示文案尽量中文化，中文名来自 `data/football-cn-aliases.json`

项目不再抓取中国体彩、Sporttery 或其他网页数据源。

## 数据架构

当前数据流：

1. `netlify/functions/sync-world-cup-matches.js` 调用 API-Football `fixtures?league=1&season=2026`
2. 同步结果经 `src/lib/matches/providers/worldCupProvider.js` 中文化并写入 Supabase `world_cup_matches`
3. `netlify/functions/world-cup-matches.js` 从 Supabase 读取世界杯缓存
4. `main.js` 通过 `src/lib/matches/getTodayMatches.js` 优先读取 `/.netlify/functions/world-cup-matches`
5. 如果世界杯缓存不可用，前端回退到现有 `/api/matches-today`，再不行则展示 mock 数据

## 核心文件

- `src/lib/matches/worldCupConfig.js`：世界杯 league、season、timezone 配置
- `src/lib/matches/providers/worldCupProvider.js`：API-Football 世界杯 provider 和 Supabase row adapter
- `netlify/functions/sync-world-cup-matches.js`：定时同步世界杯赛事
- `netlify/functions/world-cup-matches.js`：前端读取世界杯赛事
- `data/football-cn-aliases.json`：球队、联赛、状态中文映射
- `supabase/schema.sql`：`matches` 与 `world_cup_matches` 表结构
- `src/lib/matches/getTodayMatches.js`：前端统一读取入口
- `main.js` / `styles.css`：首页渲染与样式

## 环境变量

复制 `.env.example` 并按需填写：

```bash
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_ANON_KEY=
FOOTBALL_API_KEY=
API_FOOTBALL_KEY=
FOOTBALL_API_BASE_URL=https://v3.football.api-sports.io
API_FOOTBALL_WORLD_CUP_LEAGUE_ID=1
API_FOOTBALL_WORLD_CUP_SEASON=2026
API_FOOTBALL_TIMEZONE=Asia/Shanghai
```

说明：

- `SUPABASE_SERVICE_ROLE_KEY` 只在 Netlify Function 服务端使用
- `API_FOOTBALL_KEY` 是推荐变量名；代码也兼容旧的 `FOOTBALL_API_KEY`
- 默认世界杯 league id 是 `1`，season 是 `2026`
- 前端不会暴露任何 API key

## Supabase

在 Supabase SQL Editor 执行：

[supabase/schema.sql](/Users/fuyan/Documents/个人网站/supabase/schema.sql)

该 SQL 会创建：

- `matches`：保留现有通用赛事缓存
- `world_cup_matches`：世界杯赛事缓存
- `idx_world_cup_matches_kickoff_time`
- `idx_world_cup_matches_status`

## Netlify

`netlify.toml` 已配置：

- Functions 目录：`netlify/functions`
- `/api/matches-today` -> `/.netlify/functions/matches-today`
- `/api/world-cup-matches` -> `/.netlify/functions/world-cup-matches`

世界杯同步函数：

```text
/.netlify/functions/sync-world-cup-matches
```

世界杯读取函数：

```text
/.netlify/functions/world-cup-matches
```

定时同步 cron 为 `0 */6 * * *`，即每 6 小时同步一次，控制 API-Football 免费额度消耗。

## 本地运行

```bash
npm install
npm run build
npm run dev
```

静态预览地址：

```text
http://127.0.0.1:4173/
```

只用 `python3 -m http.server 4173` 预览时，本地没有 Netlify Functions，前端会自动回退到备用赛事数据或 mock 数据。

## 手动测试

构建检查：

```bash
npm run build
node scripts/build-check.mjs
```

手动触发线上同步：

```text
https://football-matchday-homepage.netlify.app/.netlify/functions/sync-world-cup-matches
```

查看线上世界杯缓存：

```text
https://football-matchday-homepage.netlify.app/.netlify/functions/world-cup-matches
```

## 中文映射

中文映射在：

[data/football-cn-aliases.json](/Users/fuyan/Documents/个人网站/data/football-cn-aliases.json)

规则：

- 有中文映射时显示中文
- 没有中文映射时显示 API-Football 原名
- 缺少映射不会导致页面报错

## 兜底行为

- API-Football 同步失败：不会清空 Supabase 旧缓存
- 世界杯读取失败或缓存为空：前端回退 `/api/matches-today`
- 所有接口失败：前端展示 mock 数据，不白屏

## 上传二维码

把二维码原图放到 `assets/qr.PNG`。如果图片不存在，首页会显示“二维码待上传”的占位。

页面会优先加载轻量展示图 `assets/qr-display.png`，点击保存时仍使用原图 `assets/qr.PNG`。上传或替换二维码后，可以手动生成展示图：

```bash
node scripts/prepare-qr-assets.mjs
```
