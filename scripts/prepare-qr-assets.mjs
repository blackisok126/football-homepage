import { existsSync, statSync } from "node:fs";
import { basename } from "node:path";
import { spawnSync } from "node:child_process";

const sourcePath = "assets/qr.PNG";
const outputPath = "assets/qr-display.png";
const maxSize = Number.parseInt(process.env.QR_DISPLAY_MAX_SIZE || "640", 10);

if (!existsSync(sourcePath)) {
  console.log(`${sourcePath} 不存在，跳过二维码展示图生成。`);
  process.exit(0);
}

if (!Number.isInteger(maxSize) || maxSize < 320) {
  throw new Error("QR_DISPLAY_MAX_SIZE 必须是不小于 320 的整数。");
}

const converters = [
  {
    command: "sips",
    args: ["-Z", String(maxSize), sourcePath, "--out", outputPath],
  },
  {
    command: "magick",
    args: [sourcePath, "-resize", `${maxSize}x${maxSize}>`, outputPath],
  },
  {
    command: "convert",
    args: [sourcePath, "-resize", `${maxSize}x${maxSize}>`, outputPath],
  },
];

for (const converter of converters) {
  const result = spawnSync(converter.command, converter.args, {
    encoding: "utf8",
    stdio: "pipe",
  });

  if (result.status === 0 && existsSync(outputPath)) {
    const sourceSize = formatFileSize(statSync(sourcePath).size);
    const outputSize = formatFileSize(statSync(outputPath).size);
    console.log(
      `已使用 ${converter.command} 生成 ${basename(outputPath)}：${sourceSize} -> ${outputSize}`,
    );
    process.exit(0);
  }

  if (result.error?.code !== "ENOENT") {
    const details = result.stderr || result.error?.message || "未知错误";
    console.warn(`${converter.command} 生成失败：${details.trim()}`);
  }
}

throw new Error("未找到可用的图片处理工具：需要 sips、magick 或 convert。");

function formatFileSize(bytes) {
  if (bytes < 1024) {
    return `${bytes}B`;
  }

  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)}KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}
