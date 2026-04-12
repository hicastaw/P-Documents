# P-Documents (Smart Document & Learning Platform)

Nền tảng quản lý, chia sẻ tài liệu và hỗ trợ học tập thông minh. Hệ thống cung cấp các luồng xử lý văn bản (bóc tách PDF), chat hỏi đáp trực tiếp trên tài liệu dựa trên phân đoạn văn bản và hệ thống trắc nghiệm thi đấu (Quiz Leaderboard) chạy theo thời gian thực.

👉 **[Xem Tài liệu Đặc tả Kiến trúc Chi tiết (DOCUMENTATION.md)](./DOCUMENTATION.md)**

## 🌟 Các Tính Năng Nổi Bật (Features)
- 📂 **Quản Lý Tài Liệu (Document Management):** Upload/Download PDF siêu nhanh nhờ luồng truyền tải dữ liệu trực tiếp tới MinIO Object Storage, giải phóng giới hạn bộ nhớ cho Backend API.
- 🧱 **Chống Trùng Lặp (Deduplication):** Tự động phát hiện và ngăn cản tải lên các file giống nhau hoàn toàn thông qua mã băm SHA-256 nội dung. 
- 🤖 **Chatbot Tương Tác Tài Liệu (Hỗ trợ RAG):** Hệ thống Worker Node.js chạy nền bóc tách (extract) chữ và chia nhỏ (chunking) từ tệp máy đọc để hỗ trợ truy xuất ngữ cảnh cho chat bot thông minh.
- ⚡ **Thi Trắc Nghiệm Mạng (Real-time Quiz):** Tổ chức thi trắc nghiệm, tự chấm điểm, ghi nhận kỷ lục và đẩy vị trí xếp hạng trực tiếp qua Socket.io tới mọi máy tính đang mở.
- 🔐 **Bảo Mật Tối Đa:** Sử dụng JWT (Access/Refresh Token) để chia phiên, mã hoá Hash mật khẩu User và dùng Cache In-memory làm Blacklist để vô hiệu hóa Token Logout ngay lập tức.

## 🛠️ Công Nghệ Sử Dụng (Tech Stack)
Hệ thống áp dụng mô hình phân tách độc lập (Microservices), 100% môi trường container hóa bởi Docker giúp triển khai đồng bộ ở bất kì máy ảo nào.

- **Frontend:** Next.js, TailwindCSS
- **Backend API:** Node.js, Express, TypeScript, Socket.io
- **Background Worker:** Node.js, AMQP, thao tác tệp `pdf-parse`
- **Cơ Sở Dữ Liệu SQL:** PostgreSQL 16
- **In-memory Cache (Lưu cấu hình / Broadcast socket):** Redis 7
- **Object Storage (Kho file tĩnh):** MinIO (Amazon S3 Compatible standard)
- **Message Broker (Túi điều phối tác vụ rảnh):** RabbitMQ 3
- **Gateway (Điều hướng cổng):** Nginx (Reverse Proxy tối ưu Streaming)

## 📋 Yêu Cầu Cài Đặt (Prerequisites)
Bạn không cần cài rườm rà Node.js, CSDL hay Redis lên máy chủ trần. Thư viện hệ điều hành duy nhất bạn cần là:
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Lưu ý phải bật, hoặc có plugin `docker compose`).

---

## 🚀 Hướng Dẫn Chạy Cục Bộ (Getting Started)

Dự án đã được thiết lập Auto-migration (`infra/postgres/init` tự tạo schema DB, Nginx tự thiết lập mạng). Chỉ cần 1 dòng lệnh để khởi chạy toàn trạm:

### 1. Kích hoạt Server
Di chuyển vào thư mục gốc của dự án, mở Terminal / CMD và kích chạy lệnh:

```bash
docker compose up -d --build
```
*(**Giải thích cờ:** `-d` giúp chạy ngầm nền không bị treo ngắt terminal, `--build` để đóng gói update lại các bộ mã nguồn mới nhất thành Docker Images).*

### 2. Kiểm Trực Logs
Gõ lệnh này để nhìn xuyên thấu công việc Backend và Worker có đang báo lỗi hay đang "tiêu hoá" file PDF chuẩn chưa:
```bash
docker compose logs -f api worker
```

### 3. Tắt nguồn Hệ sinh thái
Để dừng an toàn 100% toàn bộ dịch vụ (Dữ liệu DB và File tải lên sẽ **không bị mất** nhờ Mount Volumes):
```bash
docker compose down
```

---

## 🔗 Bảng Các Cổng Giao Tiếp (Local URLs & Ports)

Ngay khi lệnh Docker khởi chạy báo "Healthy", hãy truy cập các đường dẫn sau (qua trình duyệt/Postman):

| App / Dịch vụ | Đường dẫn nội bộ để thử nghiệm | Mục đích của dịch vụ |
|---|---|---|
| **Web Frontend** | [http://localhost:8888](http://localhost:8888) | Giao diện NextJS (Chui qua cổng điều hướng của cổng Nginx trung tâm). |
| **Backend Health** | [http://localhost:8888/api/healthz](http://localhost:8888/api/healthz) | API test kiểm tra nhịp thở trạng thái Express Server. |
| **PostgreSQL DB** | `localhost:5433` | Kết nối qua TablePlus/DBeaver (Tài khoản: `pdocs` / MK: `pdocs_dev_password`). |
| **Redis Cache** | `localhost:6379` | Quản trị/Xóa Session bộ nhớ Cache, điểm Trust Score. |
| **RabbitMQ UI** | [http://localhost:15672](http://localhost:15672) | Bảng điều kiển luồng Message Queue (Tài khoản: `guest`/`guest`). |
| **MinIO Console** | [http://localhost:9001](http://localhost:9001) | Dashboard quản lý file thư mục AWS S3 (Tài khoản: `minioadmin`/`minioadmin`). |
| **MinIO Proxy** | `http://localhost:9000` | Nginx nội bộ dùng Bypass Upload (bạn không nên truy cập tay vào đây). |

*(Cổng 8080 theo thiết kế cũ đã được rời hoàn toàn sang Cổng **8888** mới để tránh xung đột cổng ở một số hệ điều hành mặc định).*

---

## 📂 Tổ Chức Thư Mục (Folder Structure)

Kiến trúc cây phát triển tuân thủ hướng đi trực quan:
```text
📦 P-Documents
 ┣ 📂 client/          # Giao diện người dùng Next.js UI + CSS Components
 ┣ 📂 server/          # Cỗ máy Backend (Chứa route Auth, Quiz, Socket, Document...)
 ┣ 📂 worker/          # Công nhân Consumer chuyên bóc mẻ text PDF & update Postgres
 ┣ 📂 nginx/           # Cấu hình cho Nginx Reverse Proxy (Luân chuyển mạng lưới)
 ┣ 📂 infra/           # Nơi chứa kịch bản Init PostgreSQL Table và Nginx Proxy cho MinIO 
 ┣ 📜 .env.example     # Khai báo cấu trúc các biến Biến Môi Trường (Keys, DB pass, JWT Secret)
 ┗ 🐋 docker-compose.yml # Bản thiết kế chi phối vùng liên kết mạng Docker
```

## 🚶 Trải Nghiệm Demo Luồng Cơ Bản (MVP Live Flow)
Để xác nhận tính trơn tru của dự án, bạn có thể thực hiện kiểm thử UAT:
1. Truy cập `http://localhost:8888/login` -> Đăng ký mới. Đăng nhập ngay sau đó. (Hệ thống cấp phát Token JWT LocalStorage).
2. Chuyển hướng tab **Tài Liệu** -> Chạm vào upload gửi 01 tệp PDF nào đó.
3. Kênh máy chủ `api` trả lời upload ngay lập tức, trong khi `worker` đang xử lý ngầm nền (Tự check logs worker trong Terminal lấy Text).
4. Mở tab **Chat** -> Nhập ID bài học đó và hỏi thử những dòng chữ trong sách vừa gửi.
5. Chuyển tới **Quiz** -> Chọn 1 bài thi làm qua và ấn Submit. Chứng kiến điểm đẩy rank Top Leaderboard realtime.

---

> 📝 **Lưu ý:** Nền tảng là mô hình MVP căn bản để hỗ trợ kiến trúc phân ban chuẩn. Một số module nâng cao như `Trust Score`, hay Hệ thống Embedding Models AI tạo Vector DB cho Chat RAG hoàn chỉnh có sự nâng dỡ cho phiên bản sau này.
