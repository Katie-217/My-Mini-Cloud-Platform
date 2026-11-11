# Phát hành và kiểm tra image Docker Hub

Hai image custom đã được phát hành và được Codex kiểm tra lại ngày 11/11/2026:

| Repository | Tag | Kiến trúc | Digest của OCI index |
| --- | --- | --- | --- |
| [katie217/mycloud-web](https://hub.docker.com/r/katie217/mycloud-web) | `1.0.0` | `linux/amd64` | `sha256:4e097e8237955ea77c3d96ae64c5aa8258cd862153b99642cbcad4f72a5f92b0` |
| [katie217/mycloud-app](https://hub.docker.com/r/katie217/mycloud-app) | `1.0.0` | `linux/amd64` | `sha256:3b3270f9da843e338f214485c6b697d47bfef8c87a122b178320cbc556416456` |

Web phục vụ Portal, Blog ba bài và Student App. Backend chạy Flask/Gunicorn,
ODBC Driver 18, SQL Server, Keycloak và MinIO. Compose mặc định vẫn dùng image
local/build để phát triển; kiểm tra Docker Hub không thay container đang chạy.

## 1. Điều kiện và tài khoản

- Docker Desktop Linux containers, Docker CLI và Buildx hoạt động.
- Dùng namespace Docker Hub được người dùng cung cấp và có quyền push.
- Khi phát hành bản mới, source phải đã commit và worktree sạch.
- Chạy `docker login` tương tác trên máy. Giữ password/token trong trình quản lý
  credential của Docker; không đưa vào Git, tham số lệnh, chat hoặc ảnh minh chứng.
- `docker info` chỉ kiểm tra daemon, không chứng minh đã đăng nhập hoặc có quyền push.
  Registry và kết quả `docker push` mới xác nhận quyền cho repository tương ứng.

## 2. Kiểm tra lại bản đã phát hành

Tại thư mục dự án, chạy PowerShell:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/publish-docker-hub.ps1 -Namespace katie217 -Version 1.0.0 -VerifyOnly
```

`-VerifyOnly` đọc digest từ registry, pull bằng digest bất biến, kiểm tra
`linux/amd64` và chạy smoke test. Không build hoặc push lại tag hiện có.
Script tạo container có label `mycloud`, dùng cổng loopback ngẫu nhiên và chỉ
dọn container vừa tạo sau khi xác minh label. Không chiếm cố định port 18080.

Kết quả mong đợi:

- Sáu route Web trả HTML HTTP 200: Portal, Blog, Student App và ba bài viết.
- Backend import được thư viện và nhận diện ODBC Driver 18.
- Gunicorn khởi chạy thật: `/hello` trả JSON đúng, `/student` trả năm mẫu.
- Hai digest và kiến trúc được ghi vào `.runtime/docker-hub-release.json`.
- Không còn container smoke test sau khi kết thúc.

Smoke test này chưa truy vấn SQL, xác thực JWT hoặc upload file. Kiểm thử tích
hợp dùng cấu hình runtime và các dependency thật, xem mục 5; không suy import
thư viện thành API/database đã PASS.

## 3. Phát hành bản mới

Chọn một version chưa tồn tại. Ví dụ dưới chỉ dùng `1.0.1` nếu tag đó còn trống:

```powershell
docker login
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/publish-docker-hub.ps1 -Namespace YOUR_NAMESPACE -Version 1.0.1
```

Script kiểm tra cả hai tag trước khi build/push. Nếu tag đã tồn tại, script dừng
để giữ bản phát hành cũ. Lỗi xác thực, mạng hoặc registry không được coi là tag
còn trống. Không ghi đè `1.0.0`; thay đổi MinIO/UI sau đó dùng version mới.

Build chỉ gắn tag namespace được yêu cầu, không thay tag local `mycloud-web:1.0.0`
hay `mycloud-app:1.0.0` đang dùng cho phát triển. Bản build mới có OCI labels
`org.opencontainers.image.revision` và `org.opencontainers.image.source` để truy
nguồn Git. Sau push, script lấy digest từ registry, pull đúng digest và kiểm tra
image đó. Nếu bước build/push/manifest/pull/kiến trúc/smoke test lỗi, script dừng.

Kiểm tra build local, chưa phát hành:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/publish-docker-hub.ps1 -Namespace YOUR_NAMESPACE -Version local-check -SkipPush
```

`-SkipPush` không xác minh registry và phải ghi Docker Hub là NOT TESTED.
`-SkipSmokeTest` bỏ chạy container và phải ghi smoke test là NOT TESTED.
Không kết hợp `-SkipPush` với `-VerifyOnly`.

## 4. Pull theo digest để tái hiện bản đã kiểm tra

```powershell
docker pull --platform linux/amd64 katie217/mycloud-web@sha256:4e097e8237955ea77c3d96ae64c5aa8258cd862153b99642cbcad4f72a5f92b0
docker pull --platform linux/amd64 katie217/mycloud-app@sha256:3b3270f9da843e338f214485c6b697d47bfef8c87a122b178320cbc556416456
```

Digest trên là index chứa manifest `linux/amd64` và bản attestation. Descriptor
`unknown/unknown` của attestation không phải một bản ứng dụng ARM hoặc lỗi image.
Không dùng image ID của container để thay thế digest registry trong báo cáo.

## 5. Kết quả nghiệm thu

| Hạng mục | Kết quả thực thi |
| --- | --- |
| Repository và quyền đọc public | PASS: lấy token pull ẩn danh, đọc manifest qua registry |
| Nội dung manifest và digest | PASS: SHA256 của response đúng hai digest đã ghi |
| Pull bất biến và kiến trúc | PASS: pull `repository@sha256:...`, `linux/amd64` |
| Web từ image đã pull | PASS: sáu route HTML, 20 file frontend khớp source sau chuẩn hóa CRLF/LF |
| App từ image đã pull | PASS: Gunicorn, JSON hello/student, thư viện và ODBC18 |
| SQL của image Docker Hub | PASS: container app tạm kết nối database thật; 23 kiểm tra backend/CRUD |
| OIDC/MinIO của image Docker Hub | PASS: 24 kiểm tra JWT/PKCE, upload/list/download/avatar/PDF/private bucket |
| Source backend | PASS: chín file Python/data/dependency khớp source sau chuẩn hóa CRLF/LF |
| Secret trong source/config | PASS: quét credential local trong Git/image config; thư mục app/web không có .env/Git/runtime |
| Dọn kiểm thử | PASS: chỉ xóa container và fixture do test tạo; ID container cũ giữ nguyên |
| Push lặp trong lượt Codex | NOT TESTED: Codex xác minh bản Gemini đã push, không push lại/ghi đè tag |

Lượt kiểm tra tích hợp tạo container từ digest Docker Hub, nối `cloud-net`,
truyền đúng biến runtime của service app từ file env tạm trong `.runtime`, sau
đó dọn file env/container. Không bake credential vào image. `test-auth-storage.py`
hỗ trợ `TEST_API_BASE` để kiểm tra đúng container tạm; không vô tình gọi app cũ.
Log/JSON của lượt Codex nằm trong runtime worktree review và không đưa vào Git.

Image `1.0.0` chưa gắn OCI revision label; kiểm tra nguồn đợt này dựa trên nội
dung file so với source tại bản bàn giao `15b60ca` (code ứng dụng kế thừa PR #1).
Các lần phát hành tiếp theo dùng script mới sẽ gắn revision vào image.

Docker Hub đã có image đọc được public và kiểm thử thật, đáp ứng đầu ra publish
ít nhất một image custom. AWS EC2 và minh chứng URL object public MinIO vẫn là
những bước riêng, chưa được nghiệm thu bởi công việc Docker Hub này.
