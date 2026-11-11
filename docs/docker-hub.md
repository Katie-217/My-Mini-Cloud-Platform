# Hướng Dẫn Phát Hành Image Custom Lên Docker Hub

Tài liệu này hướng dẫn quy trình build, tag, push và kiểm thử hai Docker custom image của dự án **MyMiniCloud**:
1. **`<namespace>/mycloud-web:<version>`**: Nginx 1.28 Alpine phục vụ toàn bộ giao diện tĩnh (Portal Control, Tech Blog 3 bài, Student Management App UI) trên kiến trúc `linux/amd64`.
2. **`<namespace>/mycloud-app:<version>`**: Python 3.12 Slim Flask REST API Backend chạy qua Gunicorn, tích hợp ODBC Driver 18 cho SQL Server 2022, Keycloak OIDC JWT RS256 và MinIO S3 SDK.

---

## 1. Điều Kiện Chuẩn Bị

1. **Tài khoản Docker Hub**: Đã đăng ký tài khoản tại [hub.docker.com](https://hub.docker.com). Namespace chính là Docker Hub Username của bạn (ví dụ: `myusername`).
2. **Đăng nhập trên máy Host**:
   Mở PowerShell hoặc Command Prompt trên máy host và chạy lệnh đăng nhập tương tác:
   ```powershell
   docker login
   ```
   *Nhập username và password/Personal Access Token khi được hỏi. Tuyệt đối không lưu mật khẩu vào mã nguồn, file cấu hình, chat hoặc nhật ký.*
3. **Kiểm tra trạng thái đăng nhập**:
   ```powershell
   docker info
   ```

---

## 2. Thực Thi Phát Hành Bằng Script Tự Động

Dự án cung cấp sẵn script tự động hóa toàn bộ các bước tại `scripts/publish-docker-hub.ps1`:
- Tự động build chuẩn target `linux/amd64`.
- Tag hai image theo namespace và version được chỉ định.
- Push cả hai image lên Docker Hub.
- Kiểm tra manifest SHA256 digest và kiến trúc.
- Pull lại image từ registry để xác minh tính sẵn sàng.
- Khởi chạy container tạm thời để thực hiện Smoke Test (kiểm tra Web trả HTTP 200 và App import đầy đủ thư viện Python).

### Lệnh chạy đẩy đủ (Build + Tag + Push + Verify):

```powershell
powershell -ExecutionPolicy Bypass -File scripts/publish-docker-hub.ps1 -Namespace <your_dockerhub_user> -Version 1.0.0
```

*(Thay `<your_dockerhub_user>` bằng username Docker Hub của bạn).*

### Lệnh chạy kiểm tra trước tại local (không push):

```powershell
powershell -ExecutionPolicy Bypass -File scripts/publish-docker-hub.ps1 -Namespace <your_dockerhub_user> -Version 1.0.0 -SkipPush
```

---

## 3. Các Lệnh Thủ Công Chi Tiết (Nghiệm Thu Từng Bước)

Nếu muốn thực hiện từng lệnh bằng tay:

```powershell
# 1. Build local cho linux/amd64
docker build --platform linux/amd64 -t <namespace>/mycloud-web:1.0.0 -f web/Dockerfile web
docker build --platform linux/amd64 -t <namespace>/mycloud-app:1.0.0 -f app/Dockerfile app

# 2. Push lên Docker Hub
docker push <namespace>/mycloud-web:1.0.0
docker push <namespace>/mycloud-app:1.0.0

# 3. Kiểm tra Manifest và SHA256 Digest
docker manifest inspect <namespace>/mycloud-web:1.0.0
docker manifest inspect <namespace>/mycloud-app:1.0.0

# 4. Pull lại từ Docker Hub để xác thực
docker pull <namespace>/mycloud-web:1.0.0
docker pull <namespace>/mycloud-app:1.0.0
```

---

## 4. Kiểm Thử Độc Lập (Smoke Test)

Sau khi pull, có thể kiểm thử nhanh tính toàn vẹn của image:

1. **Web Frontend Smoke Test**:
   ```powershell
   docker run -d --name smoke-web -p 18080:80 <namespace>/mycloud-web:1.0.0
   curl http://localhost:18080/
   docker rm -f smoke-web
   ```
   *Kỳ vọng*: Trả về mã HTTP 200 với nội dung MyMiniCloud Portal Control.

2. **Backend App Smoke Test**:
   ```powershell
   docker run --rm <namespace>/mycloud-app:1.0.0 python -c "import flask, pyodbc, jwt, minio, dns, gunicorn; print('IMPORTS_OK')"
   ```
   *Kỳ vọng*: In ra `IMPORTS_OK` mà không gặp lỗi thiếu thư viện hay driver.

---

## 5. Danh Sách Image Đã Phát Hành Thực Tế

Dưới đây là thông tin phát hành chính thức của hai custom image trên Docker Hub:

| Image Repository | Tag | Kiến trúc | Image Digest (Index) | Kết Quả Nghiệm Thu |
| :--- | :---: | :---: | :--- | :---: |
| [katie217/mycloud-web](https://hub.docker.com/r/katie217/mycloud-web) | `1.0.0` | `linux/amd64` | `sha256:4e097e8237955ea77c3d96ae64c5aa8258cd862153b99642cbcad4f72a5f92b0` | **PASS (Push + Pull + Smoke Test)** |
| [katie217/mycloud-app](https://hub.docker.com/r/katie217/mycloud-app) | `1.0.0` | `linux/amd64` | `sha256:3b3270f9da843e338f214485c6b697d47bfef8c87a122b178320cbc556416456` | **PASS (Push + Pull + Smoke Test)** |

Lệnh pull trực tiếp:
```powershell
docker pull katie217/mycloud-web:1.0.0
docker pull katie217/mycloud-app:1.0.0
```

---

## 6. Lưu Ý Về Môi Trường & Bảo Mật

- **Môi trường Compose local**: File `docker-compose.yml` hiện tại vẫn giữ cấu hình `build: ./web` và `build: ./app` để phục vụ phát triển và kiểm thử local ổn định. Chỉ chuyển sang image Docker Hub khi triển khai lên môi trường độc lập (như AWS EC2).
- **Không chứa dữ liệu nhạy cảm**: Cả hai Dockerfile đều sử dụng `.dockerignore` để loại trừ hoàn toàn `.env`, credentials, runtime logs, git history và test artifacts khỏi image phát hành.
- **MinIO Storage**: Dịch vụ MinIO S3 giữ nguyên cấu hình hiện tại và không bị ảnh hưởng bởi quá trình phát hành 2 custom image này.
