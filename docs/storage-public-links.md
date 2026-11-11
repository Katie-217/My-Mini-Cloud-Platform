# Hướng dẫn kiểm thử và sử dụng liên kết chia sẻ file MinIO trực tiếp

Tài liệu này hướng dẫn chi tiết cách thức hoạt động, cấu hình và quy trình kiểm thử tính năng **chia sẻ file bằng URL public trực tiếp từ MinIO** trong MyMiniCloud.

---

## 1. Nguyên lý hoạt động và phân quyền

### 1.1. Cấu hình Bucket Policy trên MinIO
MinIO lưu trữ dữ liệu trong 2 bucket:
- `profile-pics`: Ảnh đại diện sinh viên (PNG, JPEG).
- `documents`: Tài liệu học tập (PDF).

Hệ thống thiết lập **Bucket Policy** chỉ cấp quyền đọc nặc danh (`s3:GetObject`) tại tiền tố (prefix) công khai:
- `arn:aws:s3:::profile-pics/public/*`
- `arn:aws:s3:::documents/public/*`

**Bảo mật:**
- Anonymous **KHÔNG** có quyền liệt kê bucket (`s3:ListBucket`), không có quyền tải lên (`s3:PutObject`) và không có quyền xóa (`s3:DeleteObject`).
- Tất cả các file nằm ngoài thư mục `public/*` đều là **Private** (truy cập nặc danh trả về mã lỗi `403 Forbidden`).
- Không sử dụng presigned URL (không có chữ ký `X-Amz-Signature` hay tham số thời hạn `X-Amz-Expires`).

### 1.2. Cơ chế Shadow Copy (Bản sao công khai)
- Khi người dùng upload tệp: File gốc được lưu tại `{bucket}/{key}`. File mặc định ở trạng thái riêng tư.
- Khi người dùng bấm **"Công khai"**: Backend sao chép file từ `{bucket}/{key}` sang `{bucket}/public/{key}` và trả về URL trực tiếp dạng `http://localhost:9000/{bucket}/public/{key}`.
- Khi người dùng bấm **"Bỏ công khai"**: Backend xóa bản sao `{bucket}/public/{key}`. Object gốc `{bucket}/{key}` vẫn giữ nguyên vẹn.
- API danh sách tài liệu (`GET /api/files`) tự động phân loại và loại bỏ tiền tố `public/` khỏi danh sách trả về để không hiển thị trùng lặp dòng.

> [!NOTE]
> Địa chỉ `http://localhost:9000` là endpoint MinIO truy cập trực tiếp trên máy host chạy Docker. Trên môi trường phân tán hoặc production có tên miền riêng, endpoint này được điều chỉnh qua biến môi trường `MINIO_PUBLIC_URL`.

`MINIO_PUBLIC_URL` có trong `.env.example` và được Compose truyền vào backend.
Sau khi đổi giá trị, tạo lại service app để nạp cấu hình mới. Endpoint chỉ nhận
HTTP/HTTPS, không chứa credential/path/query. `localhost` không phải URL truy cập
từ máy khác qua Internet.

---

## 2. Quy trình demo và kiểm thử từng bước

### Bước 1: Tải lên tài liệu PDF
1. Truy cập ứng dụng Quản lý sinh viên tại: `http://localhost/app/` (hoặc mở từ Portal).
2. Chuyển sang tab **"Tài liệu"**.
3. Kéo thả hoặc nhấn chọn một tệp PDF bất kỳ (dung lượng < 10 MB).
4. Nhấn **"Tải lên tài liệu"**.
5. Quan sát danh sách: Tệp mới xuất hiện với trạng thái **"Riêng tư"**. Nút thao tác gồm: **"Tải về"** và **"Công khai"**.

### Bước 2: Kiểm tra truy cập khi chưa công khai (HTTP 403)
1. Thử truy cập trực tiếp MinIO bằng URL:
   ```text
   http://localhost:9000/documents/<key-cua-file>
   ```
2. Kết quả mong đợi: MinIO từ chối truy cập và trả về mã HTTP `403 Forbidden` (`AccessDenied`).

### Bước 3: Công khai tài liệu
1. Trong bảng tài liệu tại tab **"Tài liệu"**, nhấn nút **"Công khai"** tại dòng tài liệu vừa tải lên.
2. Hệ thống hiển thị thông báo thành công. Trạng thái tài liệu chuyển sang huy hiệu màu xanh lá **"Công khai"**.
3. Cột thao tác hiển thị thêm: **"Mở file"**, **"Sao chép"**, và **"Bỏ công khai"**.

### Bước 4: Mở file trong cửa sổ ẩn danh và kiểm tra
1. Nhấn nút **"Sao chép"** để copy link trực tiếp MinIO vào clipboard (ví dụ `http://localhost:9000/documents/public/<key>.pdf`).
2. Mở một **cửa sổ trình duyệt ẩn danh (Incognito Window)** mới hoàn toàn không đăng nhập.
3. Dán link vừa sao chép vào thanh địa chỉ và truy cập.
4. Kết quả mong đợi:
   - Trình duyệt hiển thị / tải đúng file PDF.
   - Mã phản hồi HTTP: `200 OK`.
   - Content-Type: `application/pdf`.
   - URL hoàn toàn sạch, không chứa query parameter chữ ký hay thời hạn (`X-Amz-*`).

### Bước 5: Bỏ công khai tài liệu
1. Quay lại giao diện Student App, nhấn nút **"Bỏ công khai"** tại dòng tài liệu đó.
2. Trạng thái chuyển về **"Riêng tư"**.
3. Quay lại cửa sổ ẩn danh và nhấn F5 (Refresh) link public vừa rồi.
4. Kết quả mong đợi: Trình duyệt nhận mã HTTP `404 Not Found` hoặc `403 Forbidden` do bản sao công khai đã bị xóa.
5. Kiểm tra nút **"Tải về"** trên giao diện: Vẫn tải được file gốc qua API backend bình thường.

Public copy dùng `Cache-Control: no-store`. Bỏ công khai chặn truy cập mới;
không xóa được bản người nhận đã tải về. Nếu thao tác MinIO lỗi, API trả lỗi và
UI giữ trạng thái cũ; trạng thái không xác định của avatar không được ghi là riêng tư.

---

## 3. Công khai ảnh thẻ đại diện (Avatar) sinh viên
1. Trong tab **"Sinh viên"**, nhấn nút **"Chi tiết"** ở bất kỳ sinh viên nào có ảnh đại diện (hoặc tạo mới sinh viên kèm ảnh đại diện).
2. Trong hộp thoại chi tiết, mục **"Chia sẻ Avatar (MinIO)"** hiển thị trạng thái hiện tại (Riêng tư hoặc Công khai).
3. Nhấn **"Công khai avatar"**: Hệ thống tạo bản sao tại `profile-pics/public/<avatar_key>`.
4. Người dùng có thể nhấn **"Mở ảnh"** hoặc **"Sao chép link"** để chia sẻ ảnh trực tiếp từ MinIO mà không làm thay đổi hay mất dữ liệu của sinh viên.
5. Nhấn **"Bỏ công khai"** để thu hồi quyền truy cập công khai bất kỳ lúc nào.

## 4. Chạy kiểm thử và nghiệm thu

Tại thư mục source của bản mới:

```powershell
python scripts/test-public-storage.py
.\.venv\Scripts\python.exe scripts/test-ui-public-links.py
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify.ps1 -Browser
```

- API: 63 checks PASS, gồm PNG/PDF, byte/SHA256, public GET 200, original GET 403,
  anonymous list/put/delete bị chặn, thu hồi link, idempotence, JSON/key sai và
  lỗi MinIO không trả private giả.
- Browser: 20 checks PASS, gồm upload PDF, hai nút sao chép thực sự ghi clipboard,
  context ẩn danh đọc file/hiển thị PNG, bỏ công khai và giữ nguyên avatar/sinh viên,
  viewport mobile sáng/tối và trạng thái lỗi storage.
- Bộ verify đầy đủ: 286 checks PASS và DNS host UDP/TCP; ba UI 200, 12/12 probe.
- Chạy lại storage-init hai lần vẫn giữ nguyên bản sao public và original private.

Mỗi test chỉ dùng record/object UUID do chính lượt chạy tạo và dọn trong finally;
không chọn tài liệu có sẵn của người dùng. Log/ảnh lưu trong `.runtime/public-storage/`,
không commit. Xem hướng dẫn tổng hợp có ảnh tại [screenshot-guide.html](screenshot-guide.html).

Hai image Docker Hub `1.0.0` là bản trước chức năng này. Chưa phát hành image mới
trong lượt nghiệm thu; lần phát hành tiếp theo dùng tag version mới.
