# -*- coding: utf-8 -*-
"""测量各段配音时长，计算产品演示视频的时间轴（含 0.5s 交叉转场），
产出 demo_timeline.json 与 yuxiaopu-demo.srt。用 skill .venv 运行。"""
import json
import os

import av

BASE = os.path.dirname(os.path.abspath(__file__))
TRANS = 0.5       # 段间交叉转场时长
TAIL = 1.2        # 每段语音后的停留
HOLD = 0.5        # 段内语音前留白（音频起点 = 段起点 + HOLD）


def fmt(t):
    ms = int(round(t * 1000))
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def mp3_duration(path):
    with av.open(path) as c:
        a = c.streams.audio[0]
        if a.duration is not None:
            return float(a.duration * a.time_base)
        total = 0
        for frame in c.decode(a):
            total += frame.samples
        return total / float(a.rate)


def main():
    with open(os.path.join(BASE, "demo_manifest.json"), encoding="utf-8") as f:
        manifest = json.load(f)

    timeline = []
    start = 0.0
    for seg in manifest:
        dur = mp3_duration(os.path.join(BASE, seg["mp3"])) + TAIL
        timeline.append({
            "segId": seg["segId"], "shot": seg["shot"], "title": seg["title"],
            "start": round(start, 3), "dur": round(dur, 3),
            "audioStart": round(start + HOLD, 3),
            "cues": seg["cues"],
        })
        start += dur - TRANS
    total = start + TRANS

    # SRT：cue 时间 + 段音频起点
    idx = 1
    lines = []
    for seg in timeline:
        off = seg["audioStart"]
        for cue in seg["cues"]:
            s, e = off + cue["start"], off + cue["end"] + 0.15
            lines += [str(idx), f"{fmt(s)} --> {fmt(e)}", cue["text"], ""]
            idx += 1
    with open(os.path.join(BASE, "yuxiaopu-demo.srt"), "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    with open(os.path.join(BASE, "demo_timeline.json"), "w", encoding="utf-8") as f:
        json.dump({"total": round(total, 3), "trans": TRANS, "segments": timeline},
                  f, ensure_ascii=False, indent=2)

    print(f"总时长 {total:.1f}s, {idx - 1} 条字幕")
    for seg in timeline:
        print(f"  {seg['segId']} {seg['title']:<6} start={seg['start']:7.2f}  dur={seg['dur']:5.2f}")


if __name__ == "__main__":
    main()
