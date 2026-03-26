# P-Documents

Nền tảng quản lý/chia sẻ tài liệu và hỗ trợ học tập thông minh.

## Kiến trúc (Local)
- **Entry point**: Nginx `:8080`
  - `/` → Next.js (`client`)
  - `/api/*` → Express (`api`)
  - `/socket.io/*` → Socket.io (`api`)
- **Dịch vụ**: Postgres, Redis, MinIO, RabbitMQ, Worker

## Yêu cầu
- Docker Desktop (có `docker compose`)

## Chạy local (1 lệnh)
Từ thư mục repo:

```bash
docker compose up -d --build
```

Xem trạng thái:

```bash
docker compose ps
```

Tắt toàn bộ:

```bash
docker compose down
```

## URL dịch vụ
- **Web (Next.js qua Nginx)**: `http://localhost:8080`
- **API health**: `http://localhost:8080/api/healthz`
- **MinIO API (upload/download bằng presigned URL)**: `http://localhost:9000`
- **MinIO Console**: `http://localhost:9001`
- **RabbitMQ Management**: `http://localhost:15672` (mặc định `guest`/`guest`)
- **Postgres**: `localhost:5432`
- **Redis**: `localhost:6379`

## Cấu trúc thư mục
- `client/`: Next.js + Tailwind (UI)
- `server/`: Express + TypeScript (API + Socket.io)
- `worker/`: Node worker (RabbitMQ consumer + xử lý hậu kiểm)
- `nginx/`: cấu hình reverse proxy entrypoint
- `infra/`: init SQL + proxy cấu hình phụ trợ

## Biến môi trường
- File ví dụ: `.env.example`
- File chạy local: `.env`

## Quick start (flow demo)
1) Mở `http://localhost:8080/login` để Register/Login (token lưu vào localStorage).
2) Mở `http://localhost:8080/documents` để upload PDF (presigned PUT lên MinIO) và xem danh sách.
3) Worker sẽ tự xử lý message `document_uploaded` và cập nhật `documents.status` (vd `approved`) + lưu `doc_chunks` (nếu bóc tách được).
4) Mở `http://localhost:8080/chat` để hỏi theo `documentId` (MVP retrieval từ `doc_chunks`).
5) Mở `http://localhost:8080/quiz` để xem realtime event `leaderboard:update` khi submit quiz.

## Ghi chú
- Presigned URL của MinIO được expose qua `minio_proxy` ở `localhost:9000` để tránh lỗi chữ ký (signature) khi upload từ browser.
