# Phiên dịch tiếng Đài

Web phiên dịch hội thoại tiếng Đài (Mandarin Đài Loan, chữ phồn thể) ⇄ tiếng Việt ⇄ tiếng Anh theo thời gian thực, giống app phiên dịch của Samsung. Toàn bộ dùng dịch vụ miễn phí.

- **Web + API:** Next.js 15 trên Vercel (`src/`)
- **Cơ sở dữ liệu:** MongoDB Atlas M0 (tài khoản, lịch sử hội thoại, đếm lượt dịch)
- **Nhận giọng nói và đọc to:** Web Speech API trong trình duyệt (Chrome, Edge, Safari)
- **Model dịch:** NLLB-200 distilled 600M qua CTranslate2, chạy trên máy ảo Oracle Cloud Always Free (`translator-server/`)

## Chạy thử trên máy

```bash
npm install
cp .env.example .env.local
# Không cần MongoDB hay server model khi chạy thử:
echo -e "DATA_STORE=memory\nTRANSLATE_PROVIDER=mock\nAUTH_SECRET=dev-secret-dev-secret" > .env.local
npm run dev
```

Mở http://localhost:3000. Ở chế độ `mock`, bản dịch chỉ là câu gốc kèm mã ngôn ngữ.

## Kiểm thử

```bash
npm run lint        # TypeScript
npm test            # unit + API (Vitest)
npm run build && npm run test:e2e   # giao diện (Playwright, desktop + điện thoại)
cd translator-server && pip install -r requirements-dev.txt && python -m pytest -q tests
```

## Deploy

### 1. Server model (Oracle Cloud)

1. Tạo máy ảo **Ampere A1** (4 OCPU, 24GB RAM), hệ điều hành **Ubuntu 22.04**, tải về SSH key.
2. Trong **Virtual Cloud Network → Security List**, thêm Ingress rule cho TCP cổng **80** và **443** từ `0.0.0.0/0`.
3. Tạo tên miền ở duckdns.org, lấy token.
4. SSH vào máy ảo:

```bash
git clone https://github.com/<you>/<repo>.git && cd <repo>/translator-server
DOMAIN=ten-ban.duckdns.org DUCKDNS_TOKEN=xxxx bash setup.sh
```

Script cài Docker, mở firewall, trỏ DuckDNS về máy, build model (10 đến 20 phút lần đầu), bật HTTPS bằng Caddy, rồi in ra `TRANSLATE_API_URL` và `TRANSLATE_API_KEY`.

### 2. MongoDB Atlas

Tạo cluster M0, tạo database user, mục **Network Access** cho phép `0.0.0.0/0` (Vercel không có IP cố định), lấy connection string.

### 3. Vercel

Import repo GitHub vào Vercel và đặt các biến môi trường:

| Biến | Giá trị |
| --- | --- |
| `MONGODB_URI` | connection string của Atlas |
| `DATA_STORE` | `mongo` |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `TRANSLATE_PROVIDER` | `remote` |
| `TRANSLATE_API_URL` | in ra từ `setup.sh` |
| `TRANSLATE_API_KEY` | in ra từ `setup.sh` |
