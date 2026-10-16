#!/bin/bash
# 鱼小铺功能介绍视频：合并 6 幕白板成片 → 拼接配音 → 封装软字幕 → 输出最终 MP4
set -e
cd "D:\qye\workspace_2026\custome-project\xianyu-super-butler\assets\whiteboard\yuxiaopu-intro"
ENV_PY="C:\Users\32894\.agents\skills\srt-whiteboard-animation\.venv\Scripts\python.exe"
SKILL="C:\Users\32894\.agents\skills\srt-whiteboard-animation"

echo "== 1/3 合并 6 幕 =="
"$ENV_PY" "$SKILL\scripts\merge_scenes.py" \
  --inputs scene-01-pain-whiteboard.mp4 scene-02-accounts-whiteboard.mp4 \
           scene-03-autoship-whiteboard.mp4 scene-04-aireply-whiteboard.mp4 \
           scene-05-dashboard-whiteboard.mp4 scene-06-outro-whiteboard.mp4 \
  --output yuxiaopu-intro-merged.mp4

echo "== 2/3 拼接配音（每幕末尾补 0.3s 停顿）=="
ffmpeg -y -loglevel error \
  -i narration/scene-01-pain.mp3 -i narration/scene-02-accounts.mp3 \
  -i narration/scene-03-autoship.mp3 -i narration/scene-04-aireply.mp3 \
  -i narration/scene-05-dashboard.mp3 -i narration/scene-06-outro.mp3 \
  -filter_complex "[0:a]apad=pad_dur=0.3[a0];[1:a]apad=pad_dur=0.3[a1];[2:a]apad=pad_dur=0.3[a2];[3:a]apad=pad_dur=0.3[a3];[4:a]apad=pad_dur=0.3[a4];[5:a]apad=pad_dur=0.3[a5];[a0][a1][a2][a3][a4][a5]concat=n=6:v=0:a=1[out]" \
  -map "[out]" -c:a aac -b:a 192k narration-full.m4a

echo "== 3/3 封装视频+配音+字幕 =="
ffmpeg -y -loglevel error \
  -i yuxiaopu-intro-merged.mp4 -i narration-full.m4a -i yuxiaopu-intro.srt \
  -map 0:v:0 -map 1:a:0 -map 2:s:0 \
  -c:v copy -c:a copy -c:s mov_text \
  -metadata:s:s:0 language=chi -metadata title="鱼小铺功能介绍" \
  "D:\qye\workspace_2026\custome-project\xianyu-super-butler\鱼小铺功能介绍.mp4"

echo "== 完成 =="
ffprobe -v error -show_entries format=duration,size -of default=noprint_wrappers=1 \
  "D:\qye\workspace_2026\custome-project\xianyu-super-butler\鱼小铺功能介绍.mp4"
