# Kịch bản báo cáo P-Documents (trước thầy hướng dẫn TTCS)

Hình thức: thuyết trình + demo trực tiếp trên hệ thống thật. Đối tượng: chỉ thầy hướng dẫn (đã theo sát đồ án từ đầu, nên không cần giải thích lại context cơ bản — tập trung vào phần đã thay đổi/nâng cấp so với lần báo cáo trước).

## 0. Phân bổ thời gian (tổng ~15 phút nội dung, còn lại dành cho hỏi đáp)

| Phần | Nội dung | Thời gian |
| :---- | :---- | :---- |
| 1 | Mở đầu, nhắc lại đề tài và 2 định hướng thầy đã góp ý | 1,5 phút |
| 2 | Tổng quan kiến trúc & công nghệ | 2 phút |
| 3 | Demo trực tiếp các chức năng chính | 7 phút |
| 4 | Đào sâu phần kỹ thuật nâng cao (đáp ứng góp ý thầy) | 3 phút |
| 5 | Kết quả, hạn chế, hướng phát triển | 1,5 phút |

Chuẩn bị trước buổi demo: chạy `docker compose up -d --build` từ trước, đảm bảo đã có sẵn vài tài liệu mẫu đã xử lý xong (`chunk_status = completed`) để không phải chờ worker xử lý PDF trực tiếp trên sân khấu.

---

## Phần 1 — Mở đầu (1,5 phút)

**Lời nói:**

> "Dạ em chào thầy. Em xin báo cáo tiến độ đồ án P-Documents — nền tảng quản lý, chia sẻ tài liệu và hỗ trợ học tập thông minh.
>
> Ở buổi trước, thầy có góp ý hai điều: thứ nhất là hướng tiếp cận ban đầu còn đơn giản, cần nghiên cứu thêm bài toán cho hệ thống quy mô lớn; thứ hai là cần xây dựng cơ chế tìm kiếm thông minh dựa trên metadata để kết quả trả về nhanh và phù hợp hơn. Hôm nay em xin trình bày những gì nhóm đã làm để đáp ứng đúng hai định hướng đó, và demo trực tiếp trên hệ thống đang chạy."

---

## Phần 2 — Tổng quan kiến trúc & công nghệ (2 phút)

**Nội dung slide:** sơ đồ kiến trúc (Nginx → Client/API → Postgres+pgvector/Redis/MinIO/RabbitMQ → Worker), liệt kê 3 app độc lập (`server`, `worker`, `client`).

**Lời nói:**

> "Hệ thống gồm 3 ứng dụng triển khai độc lập: API server, Worker xử lý PDF nền, và Client Next.js, kết nối với nhau qua Postgres (kèm pgvector), Redis, RabbitMQ, MinIO — tất cả đứng sau Nginx. Đây chính là phần nền tảng để nhóm giải quyết bài toán quy mô lớn mà thầy gợi ý, em sẽ demo cụ thể ở phần sau."

---

## Phần 3 — Demo trực tiếp (~7 phút)

### 3.1. Đăng nhập (10 giây, lướt nhanh)
Đăng nhập sẵn 1 tài khoản sinh viên trước, không demo lại luồng JWT chi tiết (thầy đã xem ở buổi trước).

### 3.2. Tải lên + Tìm kiếm tài liệu (2 phút) — trọng tâm "tìm kiếm thông minh"
1. Vào trang Tài liệu, gõ từ khóa **không dấu** vào ô tìm kiếm, ví dụ `giai tich 1` (không gõ dấu).
2. Bấm Tìm kiếm → hệ thống vẫn trả về đúng "Giáo trình Giải tích 1" dù gõ không dấu.
   - **Lời nói:** "Đây là kết quả của full-text search có hỗ trợ tiếng Việt không dấu mà em sẽ giải thích kỹ thuật ở phần sau."
3. Bấm tìm lại đúng từ khóa đó lần 2 → chỉ ra phản hồi nhanh hơn rõ rệt (do trúng cache Redis 30 giây) — nếu API có log/response field `cache: "hit"`, mở DevTools Network tab cho thầy thấy.
4. Mở 1 tài liệu, bấm "Hỏi đáp AI", hỏi 1 câu liên quan nội dung (ví dụ: *"Định lý giá trị trung bình là gì?"*).
   - Hệ thống trả lời kèm trích dẫn nguồn (trang X) — nhấn mạnh đây là RAG, không phải AI trả lời chung do đã có cơ chế tìm đoạn nội dung liên quan trước khi hỏi LLM.

### 3.3. Thi trắc nghiệm + Bảng xếp hạng real-time (1,5 phút)
1. Vào "Bài thi trắc nghiệm", chọn 1 đề, làm nhanh vài câu, nộp bài.
2. Mở tab "Bảng xếp hạng" — chỉ ra điểm/thời gian/thứ hạng cập nhật ngay.
3. Nếu có máy/tab thứ 2 đăng nhập tài khoản khác: nộp bài ở tab 2, quay lại tab 1 cho thầy thấy bảng xếp hạng tự cập nhật **không cần tải lại trang** (Socket.io).

### 3.4. Diễn đàn + Thông báo tức thì (1 phút)
1. Tab 1: mở 1 chủ đề diễn đàn, viết bình luận.
2. Tab 2 (tài khoản chủ chủ đề): cho thầy thấy thông báo nhảy lên ngay tức thì không cần refresh.

### 3.5. Admin Dashboard (30 giây)
Đăng nhập admin, mở Dashboard — chỉ số tổng tài khoản/tài liệu/báo cáo vi phạm.

### 3.6. Hạ tầng quy mô lớn — minh chứng trực quan (1,5 phút)
1. Chạy lệnh scale 3 instance API (đã chuẩn bị sẵn terminal):
   ```
   docker compose up -d --build --scale api=3
   ```
2. Chạy loop curl kiểm tra header định danh instance:
   ```
   for i in $(seq 1 10); do curl -s -D - -o /dev/null http://localhost:8888/api/healthz | grep -i x-instance-id; done
   ```
   → cho thầy thấy các giá trị `X-Instance-Id` khác nhau xoay vòng, chứng minh Nginx đang chia tải thật giữa nhiều container, không phải 1 instance giả lập.
3. Mở Grafana (`localhost:3002`) — dashboard "P-Documents Overview": tốc độ request, tỉ lệ cache hit, số tài liệu Worker xử lý thành công/thất bại, số kết nối Postgres — tất cả đang có số liệu thật vì vừa demo các bước trên.

---

## Phần 4 — Đào sâu kỹ thuật nâng cao (~3 phút, đáp ứng trực tiếp 2 góp ý của thầy)

**Lời nói dẫn:** "Phần demo vừa rồi là bề nổi, em xin trình bày kỹ hơn cơ sở kỹ thuật phía sau hai định hướng thầy đã góp ý."

**4.1. Tìm kiếm thông minh — Hybrid Search bằng RRF**
- Trước: cơ chế *waterfall* — ưu tiên tìm vector, chỉ tìm từ khóa khi vector lỗi; nhánh từ khóa dự phòng chỉ so trên tiêu đề/mô tả, "mù" với nội dung tài liệu.
- Nay: chạy đồng thời vector search (pgvector cosine) **và** keyword search có ranking thật (`ts_rank`, tìm trên cả nội dung), hợp nhất bằng **Reciprocal Rank Fusion**: `score(d) = Σ 1/(k+rank_i(d))`, k=60.
- Số liệu đo thật (script tự viết, N=6 tài liệu, K=5):

| Phương pháp | Precision@5 | Recall@5 | MRR |
| :---- | :---- | :---- | :---- |
| Waterfall (cũ) | 0.1667 | 0.8333 | 0.7778 |
| **RRF (mới)** | **0.2000** | **1.0000** | **1.0000** |

> "RRF tìm đúng tài liệu mong muốn trong mọi trường hợp thử (Recall và MRR đạt 1.0), waterfall bỏ lỡ khoảng 17%."

**4.2. Full-text search có index, hỗ trợ tiếng Việt không dấu**
- Trước: `ILIKE` thuần, tính `to_tsvector` ngay lúc truy vấn, không có index — chậm dần khi dữ liệu lớn lên.
- Nay: cấu hình text-search riêng `vi_unaccent` (cho phép gõ không dấu vẫn khớp có dấu) + **GIN index** trên cả tiêu đề và nội dung từng đoạn văn bản — xác nhận bằng `EXPLAIN ANALYZE` thấy `Bitmap Index Scan` thay vì `Seq Scan`.

**4.3. Quy mô lớn — load balancing + cache, đo bằng load test thật**
- Dùng `autocannon` đo throughput 1 instance vs 3 instance:

| Endpoint | 1 instance | 3 instance | Cải thiện |
| :---- | :---- | :---- | :---- |
| /healthz (không chạm CSDL) | 2.259 req/s | 4.894 req/s | ~2,17× |
| Tìm kiếm (bắt buộc chạm CSDL) | 102,6 req/s | 113,4 req/s | ~1,1× |

> "Tầng ứng dụng scale gần đúng tỉ lệ số instance; nhưng khi phải chạm Postgres — vẫn một instance duy nhất — mức cải thiện rất nhỏ vì CSDL là nút nghẽn chung. Đây cũng là lý do cache Redis có giá trị thực tế: query lặp lại trúng cache thì không chạm CSDL nữa, Load Balancer và Cache bổ trợ cho nhau."
- Nhóm xác định rõ đây là giới hạn đã biết (Postgres/Redis/RabbitMQ/MinIO vẫn single-instance), không đặt mục tiêu giải quyết triệt để trong phạm vi đồ án.

**4.4. Độ tin cậy & quan sát hệ thống**
- Worker: retry có exponential backoff (2s/4s/8s, tối đa 3 lần) + Dead Letter Queue khi xử lý PDF lỗi liên tục — không mất message.
- Giám sát: API/Worker tự expose metrics (`prom-client`), Postgres/Redis/RabbitMQ qua exporter chính thức, Prometheus scrape 10s/lần, Grafana hiển thị trực quan.
- Chủ động không làm centralized logging / distributed tracing ở giai đoạn này — quy mô dưới 10 service, `docker compose logs` đủ dùng; lan truyền trace qua RabbitMQ là bài toán khó, không tương xứng lợi ích ở quy mô hiện tại.

---

## Phần 5 — Kết quả, hạn chế, hướng phát triển (1,5 phút)

**Kết quả:** ứng dụng web hoàn chỉnh, chạy ổn định qua Docker Compose, đủ 5 module (Auth, Tài liệu, Quiz/Leaderboard, Chatbot AI, Diễn đàn) + Admin, có minh chứng định lượng cho phần tìm kiếm và khả năng mở rộng.

**Hạn chế tự nhận biết (chủ động nói trước để thầy thấy nhóm hiểu rõ giới hạn, không bị hỏi dồn):**
- Đánh giá retrieval dùng weak-supervision (tiêu đề tài liệu làm câu hỏi proxy), không phải bộ nhãn tay chuẩn — chỉ đủ để so sánh tương đối.
- Postgres/Redis/RabbitMQ/MinIO vẫn single-instance — chưa giải quyết single point of failure ở tầng dữ liệu.
- Khi scale API/Worker > 1 replica, Prometheus chỉ scrape được 1 IP do Docker DNS resolve tại thời điểm đó — đủ cho demo tổng quan, chưa phải breakdown theo từng replica.
- Không có centralized logging / tracing — quyết định có chủ đích, không phải thiếu sót bị bỏ quên.

**Hướng phát triển tiếp:** scale CSDL (read replica/partition), gán nhãn tay một phần dữ liệu để đánh giá retrieval chính xác hơn, tracing nếu hệ thống lớn hơn.

> "Em xin hết phần trình bày, rất mong nhận được góp ý của thầy."

---

## Phụ lục — Q&A dự kiến

| Thầy có thể hỏi | Hướng trả lời |
| :---- | :---- |
| "RRF có thật sự cần thiết không, hay phức tạp hóa không cần thiết?" | Nêu đúng điểm yếu cụ thể của waterfall cũ (nhánh dự phòng mù với nội dung) + số liệu Recall/MRR tăng từ demo. |
| "Sao biết load balancing có tác dụng, không phải chỉ cấu hình suông?" | Chỉ lại bảng autocannon + giải thích vì sao endpoint chạm DB cải thiện ít hơn (Postgres là bottleneck) — cho thấy hiểu bản chất, không chỉ chạy theo số liệu đẹp. |
| "Đánh giá retrieval bằng tiêu đề tài liệu có đáng tin không?" | Chủ động nhận đây là weak supervision, không phải ground truth thật, chỉ dùng so sánh tương đối giữa 2 phương pháp trên cùng bộ dữ liệu. |
| "Vì sao không làm distributed tracing/logging tập trung?" | Quy mô hệ thống dưới 10 service, lan truyền trace qua RabbitMQ phức tạp, rủi ro cao hơn lợi ích ở quy mô đồ án — quyết định có chủ đích. |
| "Nếu Postgres chết thì sao?" | Thừa nhận là single point of failure hiện tại, nằm trong phần hạn chế đã tự nhận biết, hướng phát triển là thêm replica/HA. |
