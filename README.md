# 绿茵今日

一个轻量足球赛事个人主页。首页展示今日热门足球赛事、个人简介和二维码占位，适合直接部署到 GitHub Pages、Netlify 或 Vercel。

## 本地预览

```bash
python3 -m http.server 4173
```

然后访问 `http://127.0.0.1:4173/`。

## 更新赛事数据

赛事数据位于 `data/matches.json`。可以手动编辑，也可以运行抓取脚本：

```bash
node scripts/fetch-matches.mjs
```

默认会依次尝试这些公开来源：

- `https://www.lottery.gov.cn/jc/zqszsc/`
- `https://www.sporttery.cn/jc/zqszsc/index.html`
- `https://jc.titan007.com/index.aspx`

抓取地址也可以通过环境变量配置，多个地址用英文逗号分隔：

```bash
MATCH_SOURCE_URL="https://example.com/a,https://example.com/b" node scripts/fetch-matches.mjs
```

如果抓取失败，脚本会保留已有的 `data/matches.json`，避免首页变成空数据。

如果全部网络来源都失败，也可以把网页截图保存为 `data/matches-screenshot.png`。脚本会在最后尝试用 OCR 识别截图文字并更新赛事；OCR 也失败时才继续保留旧数据。

## 上传二维码

把二维码原图放到 `assets/qr.PNG`。如果图片不存在，首页会显示“二维码待上传”的占位。

页面会优先加载轻量展示图 `assets/qr-display.png`，点击保存时仍使用原图 `assets/qr.PNG`。上传或替换二维码后，可以手动生成展示图：

```bash
node scripts/prepare-qr-assets.mjs
```

仓库推送 `assets/qr.PNG` 后，GitHub Actions 也会自动生成并提交新的 `assets/qr-display.png`。
