# AGENTS.md

## 项目概览

这是一个轻量无构建静态足球赛事个人主页，用于展示今日热门足球赛事、赛事编号、开赛时间、倒计时、比赛状态、让球与胜平负赔率，并提供二维码区域引导访客扫码交流。

项目不依赖前端框架、打包器或包管理依赖。核心文件如下：

- `index.html`：页面结构、主要文案、二维码弹窗结构。
- `styles.css`：全部视觉样式、信息层级和响应式布局。
- `main.js`：读取 `data/matches.json`，渲染赛事卡片、状态、倒计时、二维码加载与保存交互。
- `data/matches.json`：前端读取的赛事数据文件。
- `scripts/fetch-matches.mjs`：Node.js 赛事抓取脚本。
- `scripts/prepare-qr-assets.mjs`：根据二维码原图生成轻量展示图。
- `.github/workflows/update-matches.yml`：GitHub Actions 每小时更新赛事数据。
- `.github/workflows/prepare-qr-assets.yml`：上传或替换二维码原图后自动生成展示图。
- `assets/qr.PNG`：二维码原图，用于保存到相册或下载。
- `assets/qr-display.png`：页面优先加载的轻量二维码展示图。
- `assets/qr-pitch-texture.png`、`assets/hero-neon-banner.png`、`assets/stadium-night-bg.png`：页面视觉素材。

## 开发原则

- 保持项目为无构建静态站，除非用户明确要求，不要引入 Vite、React、Vue、打包器或包管理依赖。
- 页面应能通过 `python3 -m http.server 4173` 直接预览。
- 不要把抓取逻辑放到前端运行；前端只读取 `data/matches.json`。
- 不要删除二维码缺失占位逻辑。二维码图片不可用时，页面应显示“二维码待上传”。
- 二维码展示应优先加载 `assets/qr-display.png`，保存/分享时仍使用 `assets/qr.PNG`。
- `assets/qr-display.png` 不可用时，前端应回退加载 `assets/qr.PNG`，避免页面直接空白。
- 不要在页面上显示完整数据源 URL，除非用户明确要求。单场赛事的“查看来源”链接可以保留。
- 修改 UI 后要检查移动端宽度，避免文字、卡片、赔率标签、二维码弹窗横向溢出。
- 当前设计是体育媒体风：深色背景、高对比信息卡片、绿色/金色强调，卡片和按钮圆角保持克制。

## 赛事数据约定

`data/matches.json` 的顶层结构：

```json
{
  "date": "2026-06-07",
  "timezone": "Asia/Shanghai",
  "source": "https://www.lottery.gov.cn/jc/zqszsc/",
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
  "sourceUrl": "https://www.sporttery.cn/jc/zqdz/index.html?showType=2&mid=123456"
}
```

时间存储为 ISO 字符串，前端按 `Asia/Shanghai` 显示。赛事卡片展示普通胜平负赔率；如果普通胜平负赔率缺失，可回退展示让球胜平负赔率。

前端会根据 `kickoffTime` 和抓取到的 `status` 归一显示三类状态：

- `未开始`
- `进行中`
- `已结束`

倒计时由前端根据当前时间计算，并每分钟刷新。默认比赛持续时间按 2 小时估算，用于从“进行中”切换到“已结束”。

## 抓取脚本

默认抓取顺序在 `scripts/fetch-matches.mjs` 的 `DEFAULT_SOURCE_URLS` 中维护：

1. `https://www.lottery.gov.cn/jc/zqszsc/`
2. `https://www.sporttery.cn/jc/zqszsc/index.html`
3. `https://jc.titan007.com/index.aspx`

`lottery.gov.cn` / `sporttery.cn` 是官方竞彩足球赛程页面，脚本会通过官方前端使用的 `webapi.sporttery.cn` 赛程接口解析数据。该接口在部分自动化环境可能返回防护页；脚本应继续尝试后续来源，并在全部失败时保留已有 `data/matches.json`。titan007 来源作为备份，当前可提供赛事编号、开赛时间、球队和让球值，但普通胜平负赔率可能缺失。

如果全部网络来源都失败，脚本支持可选 OCR 兜底：把网页截图保存为 `data/matches-screenshot.png`，脚本会调用 `tesseract` 识别截图文字并尝试解析赛事。OCR 只作为最后兜底，解析不到赛事时必须保留已有 `data/matches.json`。

运行抓取：

```bash
node scripts/fetch-matches.mjs
```

覆盖来源：

```bash
MATCH_SOURCE_URL="https://example.com/a,https://example.com/b" node scripts/fetch-matches.mjs
```

抓取失败时，脚本应保留已有 `data/matches.json`，避免前端变为空数据。

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
node --check main.js
node --check scripts/fetch-matches.mjs
node --check scripts/prepare-qr-assets.mjs
node scripts/prepare-qr-assets.mjs
python3 -m http.server 4173
```

抓取检查：

```bash
node scripts/fetch-matches.mjs
```

OCR 兜底检查：

```bash
MATCH_OCR_IMAGE="data/matches-screenshot.png" node scripts/fetch-matches.mjs
```

浏览器验证重点：

- 首页能显示赛事数量和赛事卡片。
- 赛事卡片包含编号、完整开赛日期时间、倒计时、状态、让球和胜平负赔率。
- 左侧时间提示使用“开赛时间”。
- 比赛状态只显示为“未开始 / 进行中 / 已结束”。
- 二维码图片不存在时显示占位，不出现破图白块。
- 二维码弹窗标题“二维码”居中。
- 二维码按钮文案为“保存到相册”。
- 页面不显示“数据来源：...”提示块。
- 手机宽度没有横向滚动或文字重叠。

## 文案与样式约定

- 首页定位是“赛事分享的个人网站”，首屏文案应引导访问者扫描二维码交流。
- 二维码区域标题使用“二维码”，不要改回“个人二维码”。
- 二维码说明文案保持简洁，当前为“扫码交流赛程、看法和观赛提醒。”
- 赛事列表标题使用“今日热门赛事”。
- 不要恢复赛事列表标题右侧的“更新于 ...”显示。
- 赛事卡片应保持信息优先：开赛时间、状态、编号、开赛日期、倒计时、球队、赔率、查看来源。
- 视觉风格保持体育媒体风：深色背景、高对比信息卡片、绿色/金色强调。
- 卡片和按钮圆角保持克制，避免大面积营销式装饰。
