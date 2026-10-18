import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendDir = resolve(fileURLToPath(new URL('..', import.meta.url)));
// 输出目录跟 vite.config.ts 的 VITE_OUT_DIR 保持一致：网页版部署落到仓库
// static/；exe 打包（build_client.py）传 VITE_OUT_DIR 指到 packaging/
// static-dist/ 暂存目录，不碰网页版正在使用的 static/。
const outDir = process.env.VITE_OUT_DIR
  ? resolve(process.env.VITE_OUT_DIR)
  : resolve(frontendDir, '..', 'static');
const targets = [
  resolve(outDir, 'assets'),
  resolve(outDir, 'index.html'),
];

for (const target of targets) {
  const relativeTarget = target.slice(outDir.length + 1);
  if (!relativeTarget || relativeTarget.startsWith('..')) {
    throw new Error(`Refusing to clean outside output directory: ${target}`);
  }
  await rm(target, { recursive: true, force: true });
}

console.log(`Removed previous frontend build output from ${outDir}.`);
