# -*- coding: utf-8 -*-
"""校验每幕线稿：①各元素区域内墨迹覆盖 ②区域外无孤儿墨迹 ③时序串行且收尾留白。
用 skill .venv（Pillow+numpy）运行。"""
import sys

import numpy as np
from PIL import Image

import elements_spec as es

BASE = es.__file__.rsplit("\\", 1)[0]
BG = np.array([245, 235, 215])


def ink_mask(img):
    a = np.asarray(img.convert("RGB"), dtype=np.int16)
    return a.sum(axis=2) < (BG.sum() - 45)   # 明显深于纸底视为墨迹


def main():
    problems = 0
    for scene in es.SPEC:
        img = Image.open(f"{BASE}\\{scene['name']}.png")
        w, h = img.size
        mask = ink_mask(img)
        total_ink = int(mask.sum())
        covered = np.zeros_like(mask)
        print(f"\n{scene['name']} ({scene['title']})  {w}x{h}  总墨迹 {total_ink}px")

        # ① 每个元素区域内的墨迹量
        for el in scene["elements"]:
            x, y, rw, rh = el["region"]
            sub = mask[y:y + rh, x:x + rw]
            n = int(sub.sum())
            density = n / (rw * rh)
            covered[y:y + rh, x:x + rw] |= sub
            flag = "OK " if n > 800 else "LOW"
            print(f"  [{flag}] {el['id']:<14} region=({x},{y},{rw},{rh})  ink={n:>6}  密度={density:.3f}")
            if n < 800:
                problems += 1

        # ② 区域外孤儿墨迹（聚类小噪声忽略，报告>50px 的连通块数与总量）
        orphan = mask & ~covered
        orphan_px = int(orphan.sum())
        if orphan_px > 50:
            print(f"  [ORPHAN] 区域外墨迹 {orphan_px}px")
            ys, xs = np.where(orphan)
            if len(ys):
                print(f"    范围 x {xs.min()}-{xs.max()}, y {ys.min()}-{ys.max()}")
            problems += 1

        # ③ 时序检查
        els = sorted(scene["elements"], key=lambda e: e["startMs"])
        prev_end = 0
        for el in els:
            if el["startMs"] < prev_end:
                print(f"  [TIME] {el['id']} startMs={el['startMs']} 早于上一元素结束 {prev_end}")
                problems += 1
            prev_end = el["startMs"] + el["durationMs"]
        hold = scene["sceneDurationMs"] - prev_end
        if hold < 500:
            print(f"  [TIME] 收尾停留仅 {hold}ms (<500)")
            problems += 1
        else:
            print(f"  收尾停留 {hold}ms, 末元素结束于 {prev_end}ms / {scene['sceneDurationMs']}ms")

    print(f"\n{'='*50}\n问题总数: {problems}")
    return 0 if problems == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
