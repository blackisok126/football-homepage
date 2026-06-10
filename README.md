# 绿茵今日

一个轻量、无构建的足球赛事个人主页。当前数据方案已收缩为一条稳定链路：

```text
聚合数据 2026 美加墨世界杯 API
↓
Netlify Function 后端同步
↓
Supabase world_cup_matches 缓存
↓
homepage-matches / world-cup-matches endpoint
↓
首页只展示世界杯赛事
```

项目不再抓取网页，也不再接入 API-Football、football-data.org、TheSportsDB 或国际友谊赛数据。

## 核心文件

- `src/lib/matches/providers/juheProvider.js`：聚合数据世界杯 provider、字段适配和 Supabase row adapter
- `netlify/functions/sync-juhe-world-cup-matches.js`：定时同步聚合数据世界杯赛事
- `netlify/functions/homepage-matches.js`：首页统一赛事入口，只读 `world_cup_matches` 中 `source = 'juhe_worldcup'` 的赛事
- `netlify/functions/world-cup-matches.js`：世界杯赛事读取接口
- `supabase/schema.sql`：Supabase 表结构和兼容字段
- `src/lib/matches/getTodayMatches.js`：前端统一读取入口
- `main.js` / `styles.css`：首页渲染和样式

## 环境变量

Netlify 需要配置：

```bash
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
JUHE_API_KEY=
JUHE_WORLD_CUP_API_URL=
JUHE_SYNC_COOLDOWN_MINUTES=40
```

可保留但前端不会暴露：

```bash
SUPABASE_ANON_KEY=
```

说明：

- `JUHE_API_KEY` 只在 Netlify Function 服务端使用。
- `JUHE_WORLD_CUP_API_URL` 填聚合数据提供的 2026 美加墨世界杯接口地址。
- 默认 API key 参数名为聚合数据常见的 `key`。
- 聚合数据免费额度为每天 50 次，`JUHE_SYNC_COOLDOWN_MINUTES=40` 会让同步函数在 40 分钟内已有缓存时自动跳过。
- 定时任务每 40 分钟运行一次，自动请求最多约 36 次/天，保留约 14 次给手动强制刷新或异常重试。

## Supabase

在 Supabase SQL Editor 执行：

[supabase/schema.sql](/Users/fuyan/Documents/个人网站/supabase/schema.sql)

核心缓存表仍使用 `world_cup_matches`。本次收缩后关键字段为：

- `source`
- `source_match_id`
- `match_time`
- `cn_league_name`
- `cn_home_name`
- `cn_away_name`
- `home_score`
- `away_score`
- `status`
- `round_name`
- `venue`
- `priority`
- `last_synced_at`
- `raw_data`

`source` 当前只使用：

```text
juhe_worldcup
```

如果库里曾经写入过测试数据，可以安全清理非 Juhe 世界杯来源：

```sql
delete from world_cup_matches
where source is distinct from 'juhe_worldcup';
```

如果你不想删除历史数据，也可以只让代码层忽略它们；当前首页只读取 `source = 'juhe_worldcup'`。

## Netlify

`netlify.toml` 保持原部署方式。关键函数：

手动同步聚合数据世界杯：

```text
/.netlify/functions/sync-juhe-world-cup-matches
```

如果确实需要立刻刷新，可手动强制同步：

```text
/.netlify/functions/sync-juhe-world-cup-matches?force=1
```

首页读取：

```text
/.netlify/functions/homepage-matches
```

世界杯赛事读取：

```text
/.netlify/functions/world-cup-matches
```

旧函数状态：

- `sync-world-cup-matches`：已停用 API-Football 同步
- `sync-friendly-matches`：已停用国际友谊赛同步
- `friendly-matches`：已停用国际友谊赛读取
- `search-football-leagues`：已停用 API-Football league 搜索

## 本地测试

构建检查：

```bash
npm run build
node scripts/build-check.mjs
```

静态预览：

```bash
python3 -m http.server 4173
```

打开：

```text
http://127.0.0.1:4173/
```

本地静态预览没有 Netlify Functions 时，页面会显示世界杯赛程等待更新，不会混入其他赛事。

## 线上验证

1. 在 Netlify 配置 `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`、`JUHE_API_KEY`、`JUHE_WORLD_CUP_API_URL`。
2. 在 Supabase 执行 `supabase/schema.sql`。
3. 触发同步：

```text
https://football-matchday-homepage.netlify.app/.netlify/functions/sync-juhe-world-cup-matches
```

为了节省免费次数，普通同步在 40 分钟冷却期内会跳过。首次接入或确认要刷新时可用：

```text
https://football-matchday-homepage.netlify.app/.netlify/functions/sync-juhe-world-cup-matches?force=1
```

4. 查看首页接口：

```text
https://football-matchday-homepage.netlify.app/.netlify/functions/homepage-matches
```

5. 首页应只出现 `source = juhe_worldcup` 的 2026 美加墨世界杯赛事。

## 兜底行为

- 聚合数据暂未返回赛事：首页显示“2026 美加墨世界杯赛程等待更新。”
- Supabase 暂无缓存：首页不展示其他赛事。
- 旧 API-Football、国际友谊赛和多 API fallback 都不会参与首页展示。

## 上传二维码

二维码原图路径：

```text
assets/qr.PNG
```

页面优先加载轻量展示图：

```text
assets/qr-display.png
```

更新二维码后可运行：

```bash
node scripts/prepare-qr-assets.mjs
```
