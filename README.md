# 绿茵今日

一个轻量、无构建的足球赛事个人主页。当前版本已经改造成“服务端定时同步 + Supabase 缓存 + 前端稳定回退”的结构：前端只读取我们自己的统一 JSON，不再直接依赖第三方网页爬取。

## 数据架构

当前数据流分为三层：

1. 前端：`main.js` 通过 `src/lib/matches/getTodayMatches.js` 优先读取体彩接口
2. 体彩服务端：`netlify/functions/lottery-matches-today.js` 从 Supabase 的 `lottery_matches` 表读取中文竞彩足球缓存
3. 通用服务端：`netlify/functions/matches-today.js` 继续保留现有 API-Football / mock 回退链路
4. 同步层：`netlify/functions/sync-lottery-matches.js` 同步中国体育彩票口径的中文赛事，并写入 Supabase

首页会优先读取 `/.netlify/functions/lottery-matches-today`。如果体彩缓存为空或接口不可用，再回退到现有 `/api/matches-today`，页面仍然可正常打开。

## 赛事数据目录

和赛事稳定化相关的核心目录：

- `src/lib/matches/types.js`：统一 Match 数据模型
- `src/lib/matches/matchAdapter.js`：第三方 / 旧格式到统一模型的 adapter
- `src/lib/matches/matchLotteryWithApiFootball.js`：体彩赛事与 API-Football 的补充匹配 adapter
- `src/lib/matches/mockMatches.js`：演示数据
- `src/lib/matches/providers/chinaLotteryProvider.js`：中国体育彩票竞彩足球 provider
- `src/lib/matches/providers/apiFootballProvider.js`：真实 API provider
- `src/lib/matches/providers/sportteryProvider.js`：中国体育彩票赛事 provider
- `src/lib/matches/providers/localChineseProvider.js`：本地中文赛事缓存 provider
- `src/lib/matches/providers/mockProvider.js`：mock provider
- `src/lib/matches/getTodayMatches.js`：前端统一数据入口
- `src/lib/matches/server.js`：Netlify Functions 共享服务逻辑
- `src/lib/supabase.js`：Supabase client 工具
- `netlify/functions/lottery-matches-today.js`：前端优先读取的体彩赛事接口
- `netlify/functions/sync-lottery-matches.js`：体彩赛事同步函数
- `netlify/functions/matches-today.js`：今日赛事接口
- `netlify/functions/sync-matches.js`：定时同步函数
- `supabase/schema.sql`：缓存表结构

## 环境变量

复制 `.env.example` 并按需填写：

```bash
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_ANON_KEY=
FOOTBALL_API_KEY=
API_FOOTBALL_KEY=
FOOTBALL_API_BASE_URL=https://v3.football.api-sports.io
MATCH_PROVIDER=
```

说明：

- `SUPABASE_SERVICE_ROLE_KEY` 仅后端函数使用，前端不会暴露
- `SUPABASE_ANON_KEY` 预留给未来前端直连 Supabase 的场景，当前不是必需
- 默认不使用 API-Football 全量赛事；只有显式设置 `MATCH_PROVIDER=api-football` 时才会使用 API-Football
- 中国体育彩票接口不可用时，系统优先展示本地中文赛事缓存
- `API_FOOTBALL_KEY` 按新 provider 约定预留；当前代码仍兼容旧变量 `FOOTBALL_API_KEY`

## 配置 Supabase

1. 在 Supabase 新建项目
2. 打开 SQL Editor
3. 执行 [schema.sql](/Users/fuyan/Documents/个人网站/supabase/schema.sql)
4. 在 Netlify 或本地环境里配置 `SUPABASE_URL` 和 `SUPABASE_SERVICE_ROLE_KEY`

表结构会创建：

- `matches` 主表
- `lottery_matches` 中国体育彩票竞彩足球缓存表
- `match_date` 索引
- `kickoff_time` 索引

## 配置 Netlify

1. 将站点连接到 Netlify
2. 在 Site configuration -> Environment variables 中配置环境变量
3. 确认 Netlify 会安装 `package.json` 中的依赖：
   - `@supabase/supabase-js`
   - `@netlify/functions`
4. `netlify.toml` 已配置：
   - `netlify/functions` 作为函数目录
   - `/api/matches-today` 重写到对应 Function
   - `/api/lottery-matches-today` 重写到体彩赛事 Function

## 本地运行

安装依赖后可运行：

```bash
npm install
npm run build
npm run dev
```

然后访问 `http://127.0.0.1:4173/`。

说明：

- 使用 `python3 -m http.server 4173` 预览时，因为本地没有 Netlify Function，前端会自动回退到 mock 数据
- 若需要完整调试 Netlify Functions，建议使用 Netlify CLI 在本地启动 Functions

## 测试 mock 数据

以下场景都会稳定显示中文缓存或演示赛事：

1. 中国体育彩票接口不可用
2. 未配置 `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`
3. `/api/matches-today` 本地不可用
4. 中文缓存和真实 provider 都不可用

首页会显示提示：

`当前为演示数据，接入正式数据源后自动更新。`

## 接入真实 API

当前默认使用中国体育彩票口径赛事。项目也保留 `API-Football` provider，后续可以平滑扩展为：

- API-Football
- Sportmonks
- football-data.org

接入方式：

1. 配置 `FOOTBALL_API_KEY`
2. 设置 `MATCH_PROVIDER=api-football`
3. 如有需要，修改 `FOOTBALL_API_BASE_URL`
4. 在 `src/lib/matches/providers/` 新增 provider
5. 在 `src/lib/matches/matchAdapter.js` 中补充新数据源映射

## 触发同步函数

`sync-lottery-matches` 已配置为 UTC `0 0-15 * * *`，对应北京时间 08:00-23:00 每小时同步一次。这个频率较克制，避免过高频率请求体彩官网。

可选的触发方式：

1. 等待 Netlify Scheduled Function 自动运行
2. 手动访问 `/.netlify/functions/sync-lottery-matches`
3. 使用 Netlify Functions 调试命令手动触发 `sync-lottery-matches`

同步逻辑行为：

- 默认：优先请求中国体育彩票竞彩足球赛事
- 中国体育彩票接口不可用：前端继续读取 Supabase 最近缓存；若体彩缓存为空，再回退现有 `/api/matches-today`
- 显式设置 `MATCH_PROVIDER=api-football` 且有 `FOOTBALL_API_KEY`：旧通用赛事同步可请求 API-Football
- 有 Supabase：体彩同步 upsert 写入 `lottery_matches`
- 没有 Supabase：跳过写库，但仍返回稳定 JSON

## 旧抓取脚本

仓库仍保留 `scripts/fetch-matches.mjs` 作为历史抓取脚本，但前端已不再依赖它。后续如果接入新的正规数据源，可以继续沿用 `matchAdapter` 和 provider 结构，不必把抓取逻辑塞回页面。

## 上传二维码

把二维码原图放到 `assets/qr.PNG`。如果图片不存在，首页会显示“二维码待上传”的占位。

页面会优先加载轻量展示图 `assets/qr-display.png`，点击保存时仍使用原图 `assets/qr.PNG`。上传或替换二维码后，可以手动生成展示图：

```bash
node scripts/prepare-qr-assets.mjs
```

## 常见问题

### 没有 API Key 时为什么显示 mock 数据？

因为 `sync-matches` 和前端统一入口都内置了 mock provider，目的是保证站点在未接入正式数据源时也能稳定展示。

### Supabase 没配置时为什么仍然能运行？

`matches-today` 会检测环境变量；如果没有配置 Supabase，直接返回演示数据，而不是抛出空白错误页。

### 数据更新时间从哪里来？

- 体彩缓存模式：来自 Supabase 中 `lottery_matches.updated_at`
- 通用缓存模式：来自 Supabase 中 `matches.updated_at`
- mock 模式：来自当前 mock 生成时间
- API 同步模式：来自同步函数写入缓存时的时间

### 如何更换数据源？

在 `src/lib/matches/providers/` 新增 provider 文件，并在 `matchAdapter` 中把新源字段映射到统一 Match 结构即可。
