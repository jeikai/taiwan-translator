# ---- Stage 1: download NLLB-200 distilled 600M and convert it to CTranslate2 int8 ----
FROM python:3.11-slim AS convert
ARG MODEL=facebook/nllb-200-distilled-600M
RUN pip install --no-cache-dir torch==2.6.0 --index-url https://download.pytorch.org/whl/cpu \
 && pip install --no-cache-dir ctranslate2==4.6.0 transformers==4.51.3 sentencepiece==0.2.0 protobuf
RUN ct2-transformers-converter --model "$MODEL" --quantization int8 --output_dir /models/nllb \
      --copy_files tokenizer.json tokenizer_config.json special_tokens_map.json sentencepiece.bpe.model

# ---- Stage 2: small runtime image without torch ----
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY --from=convert /models/nllb /models/nllb
COPY app.py bench.py ./
ENV MODEL_DIR=/models/nllb THREADS=4 MAX_CONCURRENT=4
EXPOSE 8000
USER nobody
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
