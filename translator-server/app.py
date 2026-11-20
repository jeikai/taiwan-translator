"""Translation server: Traditional Chinese (Taiwan) <-> Vietnamese <-> English.

Runs NLLB-200 (distilled 600M) through CTranslate2 on CPU. Only the Next.js
backend calls it, authenticated with the X-API-Key header.
"""

from __future__ import annotations

import hmac
import logging
import os
import re
import threading
import time
from collections import OrderedDict
from typing import Literal, Protocol

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field, field_validator

log = logging.getLogger("translator")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

Lang = Literal["zh-TW", "vi", "en"]
NLLB_CODES: dict[str, str] = {"zh-TW": "zho_Hant", "vi": "vie_Latn", "en": "eng_Latn"}
MAX_CHARS = int(os.environ.get("MAX_CHARS", "1000"))
# Split long input into sentences so each piece stays well inside the model's window.
SENTENCE_SPLIT = re.compile(r"(?<=[。！？!?；;.\n])\s*")


class TranslateRequest(BaseModel):
    text: str = Field(min_length=1, max_length=MAX_CHARS)
    source: Lang
    target: Lang

    @field_validator("text")
    @classmethod
    def not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("text is blank")
        return v.strip()


class TranslateResponse(BaseModel):
    translation: str
    ms: int
    cached: bool = False


class Backend(Protocol):
    def translate_batch(self, sentences: list[str], source: str, target: str) -> list[str]: ...


class FakeBackend:
    """Used in tests and for smoke-testing the deployment without the model."""

    def translate_batch(self, sentences: list[str], source: str, target: str) -> list[str]:
        return [f"[{target}] {s}" for s in sentences]


class NllbBackend:
    def __init__(self, model_dir: str, threads: int) -> None:
        import ctranslate2
        import transformers

        self.model = ctranslate2.Translator(
            model_dir,
            device="cpu",
            compute_type=os.environ.get("COMPUTE_TYPE", "int8"),
            inter_threads=max(1, threads // 2),
            intra_threads=2,
        )
        self.tokenizer = transformers.AutoTokenizer.from_pretrained(model_dir)
        self._tok_lock = threading.Lock()

    def translate_batch(self, sentences: list[str], source: str, target: str) -> list[str]:
        src, tgt = NLLB_CODES[source], NLLB_CODES[target]
        with self._tok_lock:  # HF tokenizers keep src_lang as mutable state
            self.tokenizer.src_lang = src
            tokens = [self.tokenizer.convert_ids_to_tokens(self.tokenizer.encode(s)) for s in sentences]
        results = self.model.translate_batch(
            tokens,
            target_prefix=[[tgt]] * len(tokens),
            beam_size=int(os.environ.get("BEAM_SIZE", "2")),
            max_decoding_length=256,
            repetition_penalty=1.1,
        )
        out = []
        for r in results:
            hyp = r.hypotheses[0][1:]  # drop the target language token
            out.append(self.tokenizer.decode(self.tokenizer.convert_tokens_to_ids(hyp), skip_special_tokens=True))
        return out


class ToTaiwanTraditional:
    """Make sure Chinese output is Traditional characters with Taiwan wording."""

    def __init__(self) -> None:
        try:
            from opencc import OpenCC

            self._cc = OpenCC("s2twp")
        except Exception:  # pragma: no cover - optional dependency
            log.warning("OpenCC not available; Chinese output is not normalised")
            self._cc = None

    def __call__(self, text: str) -> str:
        return self._cc.convert(text) if self._cc else text


class LruCache:
    def __init__(self, size: int) -> None:
        self.size = size
        self._d: OrderedDict[tuple[str, str, str], str] = OrderedDict()
        self._lock = threading.Lock()

    def get(self, key: tuple[str, str, str]) -> str | None:
        with self._lock:
            if key in self._d:
                self._d.move_to_end(key)
                return self._d[key]
            return None

    def put(self, key: tuple[str, str, str], value: str) -> None:
        with self._lock:
            self._d[key] = value
            self._d.move_to_end(key)
            while len(self._d) > self.size:
                self._d.popitem(last=False)


def split_sentences(text: str) -> list[str]:
    parts = [p.strip() for p in SENTENCE_SPLIT.split(text)]
    return [p for p in parts if p] or [text]


def join_sentences(parts: list[str], target: str) -> str:
    return ("" if target == "zh-TW" else " ").join(parts)


def create_app(backend: Backend | None = None) -> FastAPI:
    api_key = os.environ.get("API_KEY", "")
    if len(api_key) < 16:
        raise RuntimeError("API_KEY must be set (at least 16 characters)")

    if backend is None:
        if os.environ.get("BACKEND", "nllb") == "fake":
            backend = FakeBackend()
        else:
            backend = NllbBackend(os.environ.get("MODEL_DIR", "/models/nllb"), int(os.environ.get("THREADS", "4")))
    to_tw = ToTaiwanTraditional()
    cache = LruCache(int(os.environ.get("CACHE_SIZE", "5000")))
    # Bound concurrent model calls so a burst queues instead of thrashing the CPU.
    slots = threading.BoundedSemaphore(int(os.environ.get("MAX_CONCURRENT", "4")))

    app = FastAPI(title="Taiwan translator", docs_url=None, redoc_url=None)

    def require_key(x_api_key: str = Header(default="")) -> None:
        if not hmac.compare_digest(x_api_key.encode(), api_key.encode()):
            raise HTTPException(status_code=401, detail="invalid API key")

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.post("/translate", response_model=TranslateResponse, dependencies=[Depends(require_key)])
    def translate(req: TranslateRequest) -> TranslateResponse:
        if req.source == req.target:
            raise HTTPException(status_code=400, detail="source and target must differ")
        key = (req.source, req.target, req.text)
        started = time.perf_counter()
        hit = cache.get(key)
        if hit is not None:
            return TranslateResponse(translation=hit, ms=0, cached=True)
        if not slots.acquire(timeout=10):
            raise HTTPException(status_code=429, detail="server busy")
        try:
            parts = backend.translate_batch(split_sentences(req.text), req.source, req.target)
        finally:
            slots.release()
        out = join_sentences(parts, req.target)
        if req.target == "zh-TW":
            out = to_tw(out)
        cache.put(key, out)
        ms = int((time.perf_counter() - started) * 1000)
        log.info("translate %s->%s chars=%d ms=%d", req.source, req.target, len(req.text), ms)
        return TranslateResponse(translation=out, ms=ms)

    return app


app = create_app() if os.environ.get("APP_AUTOLOAD", "1") == "1" else None
