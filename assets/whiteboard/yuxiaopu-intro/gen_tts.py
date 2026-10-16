# -*- coding: utf-8 -*-
"""鱼小铺功能介绍视频：用 Edge TTS（云希）逐幕生成配音，
并按字幕句切分把词级时间戳归组为句级 cue，输出中间 JSON。"""
import asyncio
import json
import os
import re

import edge_tts

VOICE = "zh-CN-YunxiNeural"
BASE = os.path.dirname(os.path.abspath(__file__))

# 每幕 = (场景文件名, 幕名, 旁白文本)
SCENES = [
    ("scene-01-pain", "痛点开场", (
        "做闲鱼，你一定经历过这样的夜晚：几个小号同时弹出买家消息，"
        "你在一台手机上来回切换；订单来了要手动发卡密，"
        "回复慢一拍，买家就走了。人多、单多、消息多，"
        "靠人力盯，永远盯不过来。其实，这些事都可以交给系统自动完成。"
    )),
    ("scene-02-accounts", "多账号管理", (
        "这是鱼小铺，一个面向闲鱼卖家的自动化管理系统。"
        "用手机扫一下码，就能把账号接入后台；一个页面，就能管理所有小号。"
        "每个账号都可以单独设置策略：谁开自动回复、谁要人工盯着、"
        "谁暂停接单，互不干扰。"
    )),
    ("scene-03-autoship", "自动发货与买家互动", (
        "买家一下单，卡密自动发出，多规格、多数量的商品也能正确匹配；"
        "发货前还有风险拦截，异常订单不会误发。"
        "确认收货之后，系统自动给出好评、自动求小红花、自动发送致谢，"
        "一整条售后流程不需要你动手。"
    )),
    ("scene-04-aireply", "智能回复", (
        "买家来咨询，关键词规则精确命中常见问题；遇到议价，"
        "接入大模型的 AI 会替你讨价还价——你可以设定最低价和议价轮数，"
        "它绝不越线让价。商品参数怎么答、无关话题怎么接，"
        "都有场景化提示词可以配置。"
    )),
    ("scene-05-dashboard", "经营看板", (
        "商品从闲鱼自动同步，素材库统一管理，"
        "还可以定时擦亮、自动上下架。打开经营看板，"
        "成交额、到账、退款、订单、卡密库存一屏掌握，"
        "历史订单也能一次性拉回。从盯着手机一个个回，变成打开网页看数据。"
    )),
    ("scene-06-outro", "架构与收尾", (
        "整个系统跑在单事件循环加 SQLite WAL 架构上，"
        "两核两 G 的小机器就能稳定托管三十个账号。"
        "Docker 一行命令启动，扫码接入第一个账号，剩下的交给鱼小铺。"
        "现在就开始，让你的闲鱼生意自动运转。"
    )),
]

CUE_MAX = 26   # 单条字幕最大字数
CUE_MIN = 8    # 过短则并入相邻条


def split_cues(text):
    """按句末标点切分，过长再按逗号切，过短回并。"""
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
    """把词级时间戳按字幕条文本顺序消费，得到每条 cue 的起止。"""
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
        if acc != target:
            print(f"  [warn] cue 对齐差异: {acc!r} vs {target!r}")
        if start is None:
            start = end = 0.0
        result.append({"text": cue, "start": round(start, 3), "end": round(end, 3)})
    if wi < len(words):
        print(f"  [warn] 剩余未消费词 {len(words) - wi} 个")
    return result


async def main():
    os.makedirs(os.path.join(BASE, "narration"), exist_ok=True)
    manifest = []
    for name, title, text in SCENES:
        print(f"合成 {name} · {title} ...")
        audio, words = await synth(text)
        mp3 = os.path.join(BASE, "narration", f"{name}.mp3")
        with open(mp3, "wb") as f:
            f.write(audio)
        cues = split_cues(text)
        cue_list = map_cues(text, cues, words)
        speech_end = max((w["end"] for w in words), default=0.0)
        manifest.append({
            "name": name, "title": title, "text": text,
            "mp3": f"narration/{name}.mp3",
            "cues": cue_list,
            "speechEndSec": round(speech_end, 3),
        })
        print(f"  -> {len(cue_list)} 条字幕, 语音至 {speech_end:.1f}s, mp3 {len(audio)} bytes")
    with open(os.path.join(BASE, "tts_manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    print("OK -> tts_manifest.json")


if __name__ == "__main__":
    asyncio.run(main())
