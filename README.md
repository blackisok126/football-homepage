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

默认会依次尝试这两个公开来源：

- `https://jc.titan007.com/index.aspx`
- `https://jc.zhcw.com/index.php?act=zqjsq_hhgg`

抓取地址也可以通过环境变量配置，多个地址用英文逗号分隔：

```bash
MATCH_SOURCE_URL="https://example.com/a,https://example.com/b" node scripts/fetch-matches.mjs
```

如果抓取失败，脚本会保留已有的 `data/matches.json`，避免首页变成空数据。

## 上传二维码

把二维码图片放到 `assets/qr.png`。如果图片不存在，首页会显示“二维码待上传”的占位。
