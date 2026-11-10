# Hợp đồng API dùng chung cho Codex và Gemini

Phiên bản 1 — 10/11/2026. Frontend chỉ gọi cùng origin, không hardcode hostname container.
Nginx strip `/api/` khi chuyển đến Flask; backend có route không prefix.
Ví dụ `/api/students-db` trên trình duyệt → `/students-db` trên Flask.

## Sinh viên

| Method / URL trình duyệt | Response thành công |
| --- | --- |
| GET `/api/hello` | `{ "message": "Hello from App Server!", "service": "application-backend-server" }` |
| GET `/api/student` | Mảng đúng 5 mẫu JSON có `id`, `name`, `major`, `gpa` |
| GET `/student` hoặc `/student/` | Alias của API JSON, không phải trang Student Management |
| GET `/api/students-db?q=...` | Mảng sinh viên từ SQL Server; `q` tùy chọn tìm mã/tên |
| GET `/api/students-db/1` | Một object sinh viên, 404 nếu không có |
| POST `/api/students-db` | 201, object vừa tạo |
| PUT `/api/students-db/1` | 200, object sau sửa |
| DELETE `/api/students-db/1` | 200, `{ "message": "Student deleted", "id": 1 }` |

Body POST/PUT JSON (PUT gửi đủ các trường bắt buộc):

```json
{"student_id":"SV004","fullname":"Nguyễn Minh An","dob":"2004-05-12","major":"Điện toán đám mây","gpa":3.5,"avatar_key":null}
```

Response sinh viên:

```json
{"id":4,"student_id":"SV004","fullname":"Nguyễn Minh An","dob":"2004-05-12","major":"Điện toán đám mây","gpa":3.5,"avatar_key":null,"created_at":"2026-11-10T10:00:00"}
```

- `student_id`: bắt buộc, 1–10 ký tự chữ/số/`_`/`-`; duy nhất.
- `fullname`: bắt buộc, tối đa 100 ký tự; `major`: bắt buộc, tối đa 50 ký tự.
- `dob`: ngày hợp lệ `YYYY-MM-DD`, không nằm trong tương lai.
- `gpa`: số 0–4; mặc định 0 nếu bỏ qua. `avatar_key`: string/null.
- Lỗi JSON thống nhất `{ "error": "Thông báo dễ hiểu" }`, status 400/401/404/409/413/415/503.
- CRUD công khai cho demo local; không coi đây là phân quyền production.
- Dữ liệu overview/tổng ngành/sinh viên mới tính từ API thật. Frontend dùng
  `textContent` hoặc escaping khi đưa dữ liệu API lên DOM, không chèn HTML từ tên người dùng.

## Health và trạng thái

- GET `/api/health`: `{ "status":"healthy", "service":"application-backend-server", "database":"healthy" }`;
  HTTP 503 nếu database không truy vấn được. Không lộ connection string.
- GET `/api/status`: cấu trúc dưới đây. Mỗi service được probe thật, không dựa vào dữ liệu giao diện.

```json
{"checked_at":"2026-11-10T10:00:00+00:00","overall":"healthy","groups_total":9,"services_reachable":12,"services_checked":12,"container_runtime_count":null,"services":[{"id":"web1","name":"Web Server 1","group":"Web Server","service":"web-frontend-server1","technology":"Nginx","status":"healthy","detail":"HTTP probe thành công","url":"/blog/"}]}
```

Ví dụ chỉ mô tả schema; không dùng các con số trên làm số liệu mẫu khi render.
`status`: `healthy` / `unhealthy` / `unknown`. Tên/nhóm/URL/technology là metadata,
còn status và số reachable phải từ probe. `container_runtime_count=null` hiển thị
Unknown/“Chưa đọc runtime”; không đổi thành số container đang chạy.

Mỗi object `services[]` có thêm `latency_ms` (duration đo thật từ backend tới
service), `checked_at` (ISO UTC) và `network: "cloud-net"`. Dùng các trường
này cho response time và last checked trên card, không tự tạo số mili giây.

GET `/api/metrics-summary` trả số liệu Prometheus/Node Exporter cho Portal:

```json
{"status":"unavailable","checked_at":"2026-11-10T10:00:00+00:00","source":"Prometheus / Node Exporter","scope":{"cpu":"Linux VM","memory":"Linux kernel","network":"Node Exporter namespace"},"cpu_percent":null,"memory_used_bytes":null,"memory_total_bytes":null,"memory_percent":null,"network_rx_bytes_per_second":null,"network_tx_bytes_per_second":null}
```

Đủ sample thật: HTTP 200, `status=healthy`, các field số có giá trị.
Thiếu metric/nguồn chưa sẵn sàng: HTTP 503, field thiếu null; không đổi null
thành 0. Giá trị 0 thật vẫn hiển thị. Ghi đúng phạm vi đo, refresh khoảng
10–15 giây và tránh request chồng nhau.

## Keycloak / OIDC

- GET `/api/auth/config` trả `{ "issuer", "client_id", "authorization_endpoint", "token_endpoint", "end_session_endpoint" }`.
- Client `flask-app`, public, Authorization Code + PKCE S256.
- Redirect URI: `window.location.origin + '/app/'`. Dùng state ngẫu nhiên và kiểm
  tra state khi callback. Không đưa client secret vào frontend.
- GET `/api/secure` với `Authorization: Bearer <access_token>` trả
  `{ "message":"Secure resource OK", "preferred_username":"sv01", "subject":"..." }`.
  Thiếu/sai/hết hạn token → 401. Token chỉ được coi hợp lệ sau backend xác minh.
- Cho phép frontend lưu state/verifier trong `sessionStorage` khi redirect,
  access token giữ trong memory hoặc session của tab, không ghi token vào console/HTML/URL.

## File Storage

| Method / URL | Yêu cầu và kết quả |
| --- | --- |
| GET `/api/files?bucket=documents` | `{ "bucket":"documents", "files":[{"key":"...","size":123,"last_modified":"...","download_url":"/api/files/documents/..."}] }` |
| POST `/api/files` | multipart `file` và `bucket`; 201 `{ "bucket", "key", "download_url" }` |
| GET `/api/files/documents/<key>` | Binary file với Content-Disposition; 404 nếu thiếu |

Bucket chỉ nhận `profile-pics` (PNG/JPEG) và `documents` (PDF), tối đa 10 MiB.
Backend kiểm tra định dạng thực tế và tạo key an toàn; không tự gửi Content-Type
khi frontend dùng `FormData`. Bucket MinIO private; download đi qua backend.
API file công khai trong demo local giống CRUD; tài liệu phải nêu giới hạn.

## URL giao diện quản trị local

- Keycloak: `/auth/`.
- MinIO Console: `${location.protocol}//${location.hostname}:9001`.
- Grafana: `${location.protocol}//${location.hostname}:3000`.
- Prometheus: `${location.protocol}//${location.hostname}:9090/targets`.
- Không nhúng thông tin đăng nhập vào source. Nếu chưa kết nối được API,
  hiển thị chưa kết nối/Unknown và thông báo lỗi, không trả fallback dữ liệu giả.
