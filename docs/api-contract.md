# Hợp đồng API MyMiniCloud

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

Mỗi service có `probe_type` (`http`, `sql`, `dns`), `probe_label` và `probe_target`.
Nhật ký dùng nhãn và đích từ backend: Database là `SQL Query` trên `dbo.students`,
Bind9 là `DNS Query (A)`, app là `HTTP GET + SQL`, Keycloak là
`OIDC Discovery (HTTP)` và hai exporter là `HTTP Metrics`. Đây là probe phục vụ
Portal; Docker healthcheck có thể dùng endpoint riêng để kiểm tra process.

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

## File Storage & Public Object Links

| Method / URL | Yêu cầu và kết quả |
| --- | --- |
| GET `/api/files?bucket=documents` | `{ "bucket":"documents", "files":[{"key":"...","size":123,"last_modified":"...","download_url":"/api/files/documents/...","is_public":true,"public_url":"http://localhost:9000/documents/public/..."}] }` |
| POST `/api/files` | multipart `file` và `bucket`; 201 `{ "bucket", "key", "download_url", "is_public": false, "public_url": null }` |
| GET `/api/files/<bucket>/<key>` | Binary file với Content-Disposition (qua backend); 404 nếu thiếu |
| POST `/api/files/share` | JSON `{ "bucket": "...", "key": "..." }`; 200 `{ "bucket", "key", "is_public": true, "public_url": "http://localhost:9000/<bucket>/public/<key>" }` |
| POST `/api/files/unshare` | JSON/Query `bucket` và `key`; 200 `{ "bucket", "key", "is_public": false, "public_url": null }` |
| DELETE `/api/files/share` | JSON/Query `bucket` và `key`; 200 `{ "bucket", "key", "is_public": false, "public_url": null }` |
| GET `/api/files/status` | Query `bucket` và `key`; 200 `{ "bucket", "key", "is_public": bool, "public_url": str \| null }` |

Bucket chỉ nhận `profile-pics` (PNG/JPEG) và `documents` (PDF), tối đa 10 MiB.
Backend kiểm tra định dạng thực tế và tạo key an toàn; không tự gửi Content-Type
khi frontend dùng `FormData`.

### Cơ chế chia sẻ trực tiếp từ MinIO (Public Object Links)
- MinIO cấu hình Bucket Policy cấp quyền anonymous `s3:GetObject` duy nhất tại
  prefix `profile-pics/public/*` và `documents/public/*`. Toàn bộ thao tác khác
  (ListBucket, PutObject, DeleteObject) của anonymous đều bị 403 Forbidden.
- Object gốc luôn được giữ nguyên tại `{bucket}/{key}`.
- Khi người dùng chọn "Công khai", backend sao chép object sang `{bucket}/public/{key}`
  (thao tác idempotent, không tạo file trùng). Trả về URL trực tiếp không hết hạn,
  không chứa chữ ký (`X-Amz-Signature`). Mở qua trình duyệt ẩn danh không cần xác thực.
- URL công khai sử dụng endpoint cấu hình qua `MINIO_PUBLIC_URL` (mặc định `http://localhost:9000`),
  không trả hostname nội bộ Docker `object-storage-server`.
- Khi người dùng chọn "Bỏ công khai", backend xóa bản sao `{bucket}/public/{key}`;
  object gốc `{bucket}/{key}` vẫn tồn tại và tải bình thường qua backend API.
- Danh sách tài liệu (`GET /api/files`) tự động lọc bỏ prefix `public/`, không tạo dòng trùng lặp.
- API chi tiết sinh viên (`GET /api/students-db/<id>`) trả thêm `avatar_is_public` và `avatar_public_url`.
- Nếu chưa kiểm tra được MinIO, chi tiết sinh viên trả `avatar_is_public=null`
  và `avatar_sharing_error`; UI hiển thị “Chưa xác định”. Không suy lỗi storage thành private.
- Body chia sẻ phải là JSON object. Khi MinIO từ chối xóa bản sao hoặc đọc trạng
  thái, API trả 503; không trả thành công giả. Public copy có `Cache-Control: no-store`
  để các lần mở lại hỏi server sau khi bỏ công khai. File đã tải về trước đó vẫn
  thuộc người nhận; thao tác bỏ công khai chặn các lần truy cập mới qua link.
- API CRUD/file/share đang công khai trong bản demo local. Quyền S3 anonymous bị
  giới hạn không có nghĩa Flask API đã có phân quyền production.

## URL giao diện quản trị local

- Keycloak: `/auth/`.
- MinIO Console: `${location.protocol}//${location.hostname}:9001`.
- Grafana: `${location.protocol}//${location.hostname}:3000`.
- Prometheus: `${location.protocol}//${location.hostname}:9090/targets`.
- Không nhúng thông tin đăng nhập vào source. Nếu chưa kết nối được API,
  hiển thị chưa kết nối/Unknown và thông báo lỗi, không trả fallback dữ liệu giả.
