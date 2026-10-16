# -*- coding: utf-8 -*-
"""鱼小铺抖音竖屏版：合成痛点钩子(3段)+结尾号召(1段)配音，
与已有 11 段功能讲解合并为 vertical_manifest.json（15 段完整叙事）。"""
import asyncio
import json
import os
import re

import edge_tts

VOICE = "zh-CN-YunxiNeural"
BASE = os.path.dirname(os.path.abspath(__file__))
CUE_MAX = 24
CUE_MIN = 8

# (segId, 类型, 章节, 大字文案行, 旁白)
NEW_SEGMENTS = [
    ("vh1", "card", "需求钩子", [
        ("几个小号同时弹消息", False),
        ("手机来回切", False),
        ("回慢一拍，单就飞了", True),
    ], "做闲鱼，你有没有过这种经历？几个小号同时弹出买家消息，你在手机上来回切换，回复慢一拍，买家就走了。"),
    ("vh2", "card", "需求钩子", [
        ("手动发卡密 · 手动收货", False),
        ("手动求好评", False),
        ("账号一多，全乱套", True),
    ], "订单来了要手动发卡密，收货了要手动评价、手动求小红花；账号一多，光靠人力盯，永远盯不过来。"),
    ("vh3", "card", "需求钩子", [
        ("其实，这些事", False),
        ("都能交给系统自动完成", False),
        ("—— 鱼小铺 ——", True),
    ], "其实，这些事都可以交给一个系统自动完成。它就是鱼小铺，闲鱼卖家的一体化运营工作台。"),
    ("voutro", "outro", "结尾号召", [
        ("鱼小铺 · 让闲鱼生意自动运转", True),
        ("Docker 一行命令部署", False),
        ("点赞收藏 · 教程见主页简介", False),
    ], "鱼小铺，Docker 一行命令就能部署。觉得有用的话，点赞收藏，部署教程在主页简介，现在就让你的闲鱼生意自动运转起来。"),
]


def split_cues(text):
    parts = [p.strip() for p in re.split(r"(?<=[。！？；])", text) if p.strip()]
    out = []
    for p in parts:
        if len(p) <= CUE_MAX:
            out.append(p)
            continue
        cur = ""
        for seg in [s for s in re.split(r"(?<=，)", p) if s]:
            if not cur or len(cur) + len(seg) <= CUE_MAX:
                cur += seg
            else:
                out.append(cur)
                cur = seg
        if cur:
            out.append(cur)
    merged = []
    for cue in out:
        if merged and (len(merged[-1]) + len(cue) <= CUE_MIN + 4 or len(cue) < CUE_MIN):
            merged[-1] += cue
        else:
            merged.append(cue)
    return merged


def norm(s):
    return re.sub(r"[，。；：、！？——…\s]", "", s)


async def synth(text):
    comm = edge_tts.Communicate(text, VOICE, boundary="WordBoundary")
    words = []
    audio = bytearray()
    async for chunk in comm.stream():
        if chunk["type"] == "audio":
            audio.extend(chunk["data"])
        elif chunk["type"] == "WordBoundary":
            words.append({
                "start": chunk["offset"] / 1e7,
                "end": (chunk["offset"] + chunk["duration"]) / 1e7,
                "text": chunk["text"],
            })
    return bytes(audio), words


def map_cues(text, cues, words):
    result = []
    wi = 0
    for cue in cues:
        target = norm(cue)
        acc = ""
        start = end = None
        while wi < len(words) and len(acc) < len(target):
            w = words[wi]
            wn = norm(w["text"])
            if not wn:
                wi += 1
                continue
            if start is None:
                start = w["start"]
            acc += wn
            end = w["end"]
            wi += 1
        if start is None:
            start = end = 0.0
        result.append({"text": cue, "start": round(start, 3), "end": round(end, 3)})
    return result


async def main():
    os.makedirs(os.path.join(BASE, "narration-v"), exist_ok=True)
    new_list = []
    for seg_id, kind, chapter, lines, text in NEW_SEGMENTS:
        print(f"合成 {seg_id} ...")
        audio, words = await synth(text)
        mp3 = os.path.join(BASE, "narration-v", f"{seg_id}.mp3")
        with open(mp3, "wb") as f:
            f.write(audio)
        cues = map_cues(text, split_cues(text), words)
        speech_end = max((w["end"] for w in words), default=0.0)
        new_list.append({
            "segId": seg_id, "type": kind, "chapter": chapter, "lines": lines,
            "text": text, "mp3": f"narration-v/{seg_id}.mp3",
            "cues": cues, "speechEndSec": round(speech_end, 3),
        })
        print(f"  -> {len(cues)} 条字幕, 语音至 {speech_end:.1f}s")

    with open(os.path.join(BASE, "demo_manifest.json"), encoding="utf-8") as f:
        old = json.load(f)
    ui_list = [{
        "segId": s["segId"], "type": "ui", "chapter": s["title"],
        "shot": s["shot"], "text": s["text"], "mp3": s["mp3"],
        "cues": s["cues"], "speechEndSec": s["speechEndSec"],
    } for s in old]

    with open(os.path.join(BASE, "vertical_manifest.json"), "w", encoding="utf-8") as f:
        json.dump(new_list[:3] + ui_list + [new_list[3]], f, ensure_ascii=False, indent=2)
    print("OK -> vertical_manifest.json (15 段)")


if __name__ == "__main__":
    asyncio.run(main())
