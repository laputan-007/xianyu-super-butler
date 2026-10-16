# -*- coding: utf-8 -*-
"""用 PyAV 量测每幕 mp3 真实时长，把 tts_manifest.json 组装成全局 SRT，
并输出每幕时间区间（sceneMap）供白板流程使用。用 skill .venv 解释器运行。"""
import json
import os

import av

BASE = os.path.dirname(os.path.abspath(__file__))
GAP_S = 0.0     # 幕与幕之间：成片为硬切拼接，无间隔（停留已含在幕长内）
HOLD_S = 0.6     # 每幕末尾完整画面停留（≥0.5s 要求）


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
        # 解码兜底：数完所有帧
        total = 0
        for frame in c.decode(a):
            total += frame.samples
        return total / float(a.rate)


def main():
    with open(os.path.join(BASE, "tts_manifest.json"), encoding="utf-8") as f:
        manifest = json.load(f)

    index = 1
    srt_lines = []
    scene_map = []
    offset = 0.0
    for scene in manifest:
        mp3_path = os.path.join(BASE, scene["mp3"])
        dur = mp3_duration(mp3_path)
        scene_len = max(dur + 0.3, scene["speechEndSec"] + HOLD_S)
        cues = scene["cues"]
        for i, cue in enumerate(cues):
            start = offset + cue["start"]
            end = offset + cue["end"] + 0.15
            nxt = offset + cues[i + 1]["start"] if i + 1 < len(cues) else offset + scene_len
            end = min(end, nxt - 0.02, offset + scene_len)
            srt_lines += [str(index), f"{fmt(start)} --> {fmt(end)}", cue["text"], ""]
            index += 1
        scene_map.append({
            "name": scene["name"], "title": scene["title"],
            "startSec": round(offset, 3),
            "endSec": round(offset + scene_len, 3),
            "durationSec": round(scene_len, 3),
            "mp3Sec": round(dur, 3),
        })
        offset += scene_len + GAP_S

    with open(os.path.join(BASE, "yuxiaopu-intro.srt"), "w", encoding="utf-8") as f:
        f.write("\n".join(srt_lines))
    with open(os.path.join(BASE, "scene_map.json"), "w", encoding="utf-8") as f:
        json.dump(scene_map, f, ensure_ascii=False, indent=2)

    total = offset - GAP_S
    print(f"SRT: {index - 1} 条字幕, 总时长 {total:.1f}s")
    for s in scene_map:
        print(f"  {s['name']} ({s['title']}): {s['durationSec']:.1f}s  "
              f"[{s['startSec']:.1f} -> {s['endSec']:.1f}]  mp3={s['mp3Sec']:.1f}s")


if __name__ == "__main__":
    main()
