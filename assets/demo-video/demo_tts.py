# -*- coding: utf-8 -*-
"""鱼小铺产品演示视频：11 段操作向讲解配音（云希），输出
narration-demo/seg-XX.mp3 + demo_manifest.json（句级 cue + 词级时间戳）。"""
import asyncio
import json
import os
import re

import edge_tts

VOICE = "zh-CN-YunxiNeural"
BASE = os.path.dirname(os.path.abspath(__file__))
CUE_MAX = 24
CUE_MIN = 8

SEGMENTS = [
    ("seg-01", "11-login.png", "进入后台", (
        "欢迎来到鱼小铺，一款闲鱼卖家的一体化运营工作台。"
        "打开后台地址，输入管理员账号和密码，就能进入管理界面。"
    )),
    ("seg-02", "01-overview.png", "数据概览", (
        "首先是数据概览。营收、到账、订单和卡密库存一屏掌握；"
        "顶部切换统计时间范围，成交趋势和商品销量帮你定位爆款。"
    )),
    ("seg-03", "02-accounts.png", "账号管理", (
        "账号管理页面，点击右上角扫码添加账号，用闲鱼 App 扫码即可接入；"
        "每个账号可以单独暂停监听、独立配置策略。"
    )),
    ("seg-04", "03-products.png", "商品与发货", (
        "商品与发货页。点击同步商品，商品会从闲鱼自动拉取；"
        "再点配置自动发货，绑定卡密后买家付款即自动发出。"
    )),
    ("seg-05", "04-cards.png", "卡密库存", (
        "卡密库存页。点击添加卡密，支持批量导入和分组管理，随时启停；"
        "发货规则可以直接选择这些数据源。"
    )),
    ("seg-06", "05-orders.png", "订单管理", (
        "订单管理页。一键刷新订单，历史订单也能批量拉回；"
        "系统自动判定状态，异常订单有保护，也支持手动发货。"
    )),
    ("seg-07", "06-messages.png", "消息中心", (
        "消息中心汇集所有买家会话。选中会话即可直接回复，"
        "支持表情面板和在线图片直发。"
    )),
    ("seg-08", "07-autoreply.png", "自动回复", (
        "自动回复页。点击添加关键词，为每个账号配置命中规则和默认回复；"
        "买家咨询秒回，夜间也不掉线。"
    )),
    ("seg-09", "08-aireply.png", "AI 回复", (
        "AI 回复页。接入任意兼容 OpenAI 协议的大模型，保存配置即可启用；"
        "场景化提示词教它回答商品问题，还能设最低价自动议价。"
    )),
    ("seg-10", "09-settings.png", "系统设置", (
        "系统设置页。管理员账号、公告发布、数据备份集中在这里，"
        "普通电脑就能部署运行。"
    )),
    ("seg-11", "10-theme-blue.png", "主题与部署", (
        "最后，顶栏一键切换七种主题色。Docker 一行命令启动，"
        "扫码接入第一个账号——现在就开始，让闲鱼生意自动运转。"
    )),
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
        if acc != target:
            print(f"  [warn] cue 对齐差异: {acc!r} vs {target!r}")
        if start is None:
            start = end = 0.0
        result.append({"text": cue, "start": round(start, 3), "end": round(end, 3)})
    return result


async def main():
    os.makedirs(os.path.join(BASE, "narration-demo"), exist_ok=True)
    manifest = []
    for seg_id, shot, title, text in SEGMENTS:
        print(f"合成 {seg_id} · {title} ...")
        audio, words = await synth(text)
        mp3 = os.path.join(BASE, "narration-demo", f"{seg_id}.mp3")
        with open(mp3, "wb") as f:
            f.write(audio)
        cues = map_cues(text, split_cues(text), words)
        speech_end = max((w["end"] for w in words), default=0.0)
        manifest.append({
            "segId": seg_id, "shot": shot, "title": title, "text": text,
            "mp3": f"narration-demo/{seg_id}.mp3",
            "cues": cues,
            "speechEndSec": round(speech_end, 3),
        })
        print(f"  -> {len(cues)} 条字幕, 语音至 {speech_end:.1f}s")
    with open(os.path.join(BASE, "demo_manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    print("OK -> demo_manifest.json")


if __name__ == "__main__":
    asyncio.run(main())
