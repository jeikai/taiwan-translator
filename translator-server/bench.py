"""Measure latency and eyeball quality: python bench.py https://DOMAIN API_KEY"""

import json
import statistics
import sys
import time
import urllib.request

SAMPLES = [
    ("zh-TW", "vi", "你好，請問捷運站怎麼走？"),
    ("zh-TW", "vi", "這個多少錢？可以算便宜一點嗎？"),
    ("zh-TW", "vi", "我肚子很痛，附近有診所嗎？"),
    ("zh-TW", "vi", "請問這班公車有到台北車站嗎？"),
    ("zh-TW", "vi", "我要一杯珍珠奶茶，半糖少冰。"),
    ("zh-TW", "en", "不好意思，我聽不懂，可以再說一次嗎？"),
    ("zh-TW", "en", "我們明天早上九點在公司門口見面。"),
    ("vi", "zh-TW", "Tôi muốn đổi tiền Việt sang Đài tệ."),
    ("vi", "zh-TW", "Cho tôi hỏi nhà vệ sinh ở đâu?"),
    ("vi", "zh-TW", "Tôi bị dị ứng với hải sản."),
    ("en", "zh-TW", "Where can I buy a SIM card?"),
    ("en", "zh-TW", "Could you call a taxi for me, please?"),
]


def call(base: str, key: str, source: str, target: str, text: str) -> tuple[str, float]:
    req = urllib.request.Request(
        base.rstrip("/") + "/translate",
        data=json.dumps({"text": text, "source": source, "target": target}).encode(),
        headers={"Content-Type": "application/json", "X-API-Key": key},
    )
    t = time.perf_counter()
    with urllib.request.urlopen(req, timeout=60) as r:
        body = json.load(r)
    return body["translation"], (time.perf_counter() - t) * 1000


def main() -> None:
    base, key = sys.argv[1], sys.argv[2]
    times = []
    for source, target, text in SAMPLES:
        out, ms = call(base, key, source, target, text + " ")  # trailing space avoids the cache on reruns
        times.append(ms)
        print(f"{ms:7.0f} ms  {source}->{target}  {text}\n            {out}")
    print(f"\nmedian {statistics.median(times):.0f} ms, max {max(times):.0f} ms over {len(times)} sentences")


if __name__ == "__main__":
    main()
