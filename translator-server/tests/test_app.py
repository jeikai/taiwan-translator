import os

os.environ["APP_AUTOLOAD"] = "0"
os.environ["API_KEY"] = "test-key-test-key-123"

from fastapi.testclient import TestClient  # noqa: E402

import app as server  # noqa: E402


class Recorder(server.FakeBackend):
    def __init__(self):
        self.calls = []

    def translate_batch(self, sentences, source, target):
        self.calls.append(sentences)
        if target == "zh-TW":
            return ["这是简体"] * len(sentences)  # simplified output gets converted
        return super().translate_batch(sentences, source, target)


def client(backend=None):
    backend = backend or Recorder()
    return TestClient(server.create_app(backend)), backend


H = {"X-API-Key": "test-key-test-key-123"}


def test_health_is_public():
    c, _ = client()
    assert c.get("/health").json() == {"status": "ok"}


def test_requires_api_key():
    c, _ = client()
    assert c.post("/translate", json={"text": "hi", "source": "en", "target": "vi"}).status_code == 401
    bad = {"X-API-Key": "nope"}
    assert c.post("/translate", json={"text": "hi", "source": "en", "target": "vi"}, headers=bad).status_code == 401


def test_translates_and_caches():
    c, b = client()
    r = c.post("/translate", json={"text": "你好。謝謝！", "source": "zh-TW", "target": "vi"}, headers=H)
    assert r.status_code == 200
    assert r.json()["translation"] == "[vi] 你好。 [vi] 謝謝！"
    assert b.calls == [["你好。", "謝謝！"]]
    again = c.post("/translate", json={"text": "你好。謝謝！", "source": "zh-TW", "target": "vi"}, headers=H).json()
    assert again["cached"] is True and len(b.calls) == 1


def test_chinese_output_is_taiwan_traditional():
    c, _ = client()
    r = c.post("/translate", json={"text": "Xin chào", "source": "vi", "target": "zh-TW"}, headers=H)
    assert r.json()["translation"] == "這是簡體"


def test_validation():
    c, _ = client()
    assert c.post("/translate", json={"text": "hi", "source": "en", "target": "en"}, headers=H).status_code == 400
    assert c.post("/translate", json={"text": "hi", "source": "ja", "target": "en"}, headers=H).status_code == 422
    assert c.post("/translate", json={"text": "  ", "source": "vi", "target": "en"}, headers=H).status_code == 422
    assert c.post("/translate", json={"text": "a" * 1001, "source": "vi", "target": "en"}, headers=H).status_code == 422


def test_refuses_to_start_without_key(monkeypatch):
    monkeypatch.setenv("API_KEY", "")
    try:
        server.create_app(server.FakeBackend())
    except RuntimeError:
        return
    raise AssertionError("expected RuntimeError")
