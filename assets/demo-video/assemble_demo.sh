#!/bin/bash
# 鱼小铺产品演示视频：拼接配音（按时间轴 adelay+amix）→ 封装字幕 → 输出最终 MP4
set -e
cd "D:\qye\workspace_2026\custome-project\xianyu-super-butler\assets\demo-video"

echo "== 1/2 按时间轴拼接 11 段配音 =="
INPUTS=""
FILTER=""
MIX=""
for i in $(seq 0 10); do
  INPUTS="$INPUTS -i narration-demo/seg-$(printf %02d $((i+1))).mp3"
  # 音频起点 = 段起点 + 0.5s，由 demo_timeline.json 计算并硬编码于此（毫秒）
done
# 各段 audioStart（毫秒）：0.5/12.26/25.01/36.0/48.16/59.49/71.16/81.43/92.91/106.23/115.52
ffmpeg -y -loglevel error \
  -i narration-demo/seg-01.mp3 -i narration-demo/seg-02.mp3 -i narration-demo/seg-03.mp3 \
  -i narration-demo/seg-04.mp3 -i narration-demo/seg-05.mp3 -i narration-demo/seg-06.mp3 \
  -i narration-demo/seg-07.mp3 -i narration-demo/seg-08.mp3 -i narration-demo/seg-09.mp3 \
  -i narration-demo/seg-10.mp3 -i narration-demo/seg-11.mp3 \
  -filter_complex "\
[0:a]adelay=500:all=1[a0];[1:a]adelay=12260:all=1[a1];[2:a]adelay=25010:all=1[a2];\
[3:a]adelay=35960:all=1[a3];[4:a]adelay=48160:all=1[a4];[5:a]adelay=59490:all=1[a5];\
[6:a]adelay=71160:all=1[a6];[7:a]adelay=81430:all=1[a7];[8:a]adelay=92910:all=1[a8];\
[9:a]adelay=106230:all=1[a9];[10:a]adelay=115520:all=1[a10];\
[a0][a1][a2][a3][a4][a5][a6][a7][a8][a9][a10]amix=inputs=11:normalize=0,dynaudnorm=f=250:g=15[mout]" \
  -map "[mout]" -c:a aac -b:a 192k narration-demo-full.m4a

echo "== 2/2 封装视频+配音+字幕 =="
ffmpeg -y -loglevel error \
  -i demo-video-raw.mp4 -i narration-demo-full.m4a -i yuxiaopu-demo.srt \
  -map 0:v:0 -map 1:a:0 -map 2:s:0 \
  -c:v copy -c:a copy -c:s mov_text \
  -metadata:s:s:0 language=chi -metadata title="鱼小铺功能介绍 · 产品演示" \
  "D:\qye\workspace_2026\custome-project\xianyu-super-butler\鱼小铺功能介绍-产品演示.mp4"

echo "== 完成 =="
ffprobe -v error -show_entries format=duration,size -of default=noprint_wrappers=1 \
  "D:\qye\workspace_2026\custome-project\xianyu-super-butler\鱼小铺功能介绍-产品演示.mp4"
