# -*- coding: utf-8 -*-
"""抖音竖屏版最终封装：按 vertical_timeline.json 生成 adelay+amix 滤镜
拼接 15 段配音 → 与视频/字幕轨封装。字幕已烧录画面，SRT 文件单独提供。"""
import json
import os
import subprocess

BASE = os.path.dirname(os.path.abspath(__file__))
ROOT = r"D:\qye\workspace_2026\custome-project\xianyu-super-butler"
OUT = os.path.join(ROOT, "鱼小铺功能介绍-抖音竖屏.mp4")


def main():
    with open(os.path.join(BASE, "vertical_timeline.json"), encoding="utf-8") as f:
        tl = json.load(f)

    inputs, filters, labels = [], [], []
    for i, seg in enumerate(tl["segments"]):
        mp3 = f"narration-v/{seg['segId']}.mp3" if seg["segId"].startswith("v") \
            else f"narration-demo/{seg['segId']}.mp3"
        inputs += ["-i", os.path.join(BASE, mp3)]
        delay = int(round(seg["audioStart"] * 1000))
        filters.append(f"[{i}:a]adelay={delay}:all=1[a{i}]")
        labels.append(f"[a{i}]")
    filters.append("".join(labels) + f"amix=inputs={len(labels)}:normalize=0[mout]")

    audio_path = os.path.join(BASE, "narration-vertical-full.m4a")
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", *inputs,
         "-filter_complex", ";".join(filters), "-map", "[mout]",
         "-c:a", "aac", "-b:a", "192k", audio_path],
        check=True, cwd=BASE)
    print("配音拼接完成")

    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error",
         "-i", os.path.join(BASE, "douyin-vertical-raw.mp4"),
         "-i", audio_path,
         "-map", "0:v:0", "-map", "1:a:0",
         "-c:v", "copy", "-c:a", "copy",
         "-metadata", "title=鱼小铺功能介绍（抖音版）",
         OUT],
        check=True, cwd=BASE)
    print(f"OK -> {OUT}")

    probe = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration,size",
         "-of", "default=noprint_wrappers=1", OUT],
        capture_output=True, text=True, check=True)
    print(probe.stdout)


if __name__ == "__main__":
    main()
