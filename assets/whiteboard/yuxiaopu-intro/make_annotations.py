# -*- coding: utf-8 -*-
"""把 elements_spec + tts_manifest 组装成每幕 <图片名>.annotation.json。"""
import json

import elements_spec as es

BASE = es.__file__.rsplit("\\", 1)[0]

with open(f"{BASE}\\tts_manifest.json", encoding="utf-8") as f:
    manifest = json.load(f)


def main():
    for scene, tts in zip(es.SPEC, manifest):
        assert scene["name"] == tts["name"]
        cues = tts["cues"]
        els = sorted(scene["elements"], key=lambda e: e["startMs"])
        elements = []
        for seq, el in enumerate(els, start=1):
            x, y, w, h = el["region"]
            subtitle = "".join(cues[i]["text"] for i in el["cueIdx"])
            elements.append({
                "id": el["id"],
                "label": el["label"],
                "sequence": seq,
                "narrativeRole": el["narrativeRole"],
                "subtitle": subtitle,
                "type": "structure",
                "region": {"x": x, "y": y, "width": w, "height": h},
                "reveal": {
                    "direction": "top_to_bottom",
                    "startMs": el["startMs"],
                    "durationMs": el["durationMs"],
                    "maskPaddingPx": 22,
                    "protectedRegions": [],
                },
                "handPath": {
                    "start": [x + 20, y + 20],
                    "end": [x + w - 20, y + h - 20],
                    "easing": "easeInOut",
                },
            })
        annotation = {
            "sceneId": scene["name"],
            "canvas": {"width": 1920, "height": 1080},
            "storyBasis": scene["storyBasis"],
            "sceneDurationMs": scene["sceneDurationMs"],
            "elements": elements,
        }
        out = f"{BASE}\\{scene['name']}.annotation.json"
        with open(out, "w", encoding="utf-8") as f:
            json.dump(annotation, f, ensure_ascii=False, indent=2)
        print(f"{out}  ({len(elements)} 元素, {scene['sceneDurationMs']}ms)")


if __name__ == "__main__":
    main()
