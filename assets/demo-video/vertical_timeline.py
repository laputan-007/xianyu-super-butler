# -*- coding: utf-8 -*-
"""抖音竖屏版时间轴：测配音时长 → 计算各段起止（0.4s 交叉转场）→
vertical_timeline.json + yuxiaopu-douyin.srt。用 skill .venv 运行。"""
import json
import os

import av

BASE = os.path.dirname(os.path.abspath(__file__))
TRANS = 0.4
TAIL = 1.1
HOLD = 0.5


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
    with open(os.path.join(BASE, "vertical_manifest.json"), encoding="utf-8") as f:
        manifest = json.load(f)

    timeline = []
    start = 0.0
    for seg in manifest:
        dur = mp3_duration(os.path.join(BASE, seg["mp3"])) + TAIL
        timeline.append({
            "segId": seg["segId"], "type": seg["type"], "chapter": seg["chapter"],
            "lines": seg.get("lines"), "shot": seg.get("shot"),
            "start": round(start, 3), "dur": round(dur, 3),
            "audioStart": round(start + HOLD, 3), "cues": seg["cues"],
        })
        start += dur - TRANS
    total = start + TRANS

    idx = 1
    lines_out = []
    for seg in timeline:
        off = seg["audioStart"]
        for cue in seg["cues"]:
            s, e = off + cue["start"], off + cue["end"] + 0.18
            lines_out += [str(idx), f"{fmt(s)} --> {fmt(e)}", cue["text"], ""]
            idx += 1
    with open(os.path.join(BASE, "yuxiaopu-douyin.srt"), "w", encoding="utf-8") as f:
        f.write("\n".join(lines_out))

    with open(os.path.join(BASE, "vertical_timeline.json"), "w", encoding="utf-8") as f:
        json.dump({"total": round(total, 3), "trans": TRANS, "segments": timeline},
                  f, ensure_ascii=False, indent=2)

    print(f"总时长 {total:.1f}s, {idx - 1} 条字幕, {len(timeline)} 段")
    for seg in timeline:
        print(f"  {seg['segId']:<8} {seg['chapter']:<6} start={seg['start']:7.2f} dur={seg['dur']:5.2f}")


if __name__ == "__main__":
    main()
