# Tag và push image custom — chưa thực hiện

Hiện chưa push Docker Hub. Không suy ra tài khoản hoặc quyền namespace từ image
cache/Git username. Git remote sẽ do người dùng cung cấp riêng.

Sau khi có username/repository Docker Hub và đăng nhập trên máy, chạy PowerShell
tại `D:\Cuối kì computing`:

```powershell
docker login
docker tag mycloud-app:1.0.0 YOUR_DOCKERHUB_USER/mycloud-app:1.0.0
docker push YOUR_DOCKERHUB_USER/mycloud-app:1.0.0
docker manifest inspect YOUR_DOCKERHUB_USER/mycloud-app:1.0.0
```

Thay namespace mẫu bằng tài khoản được cấp quyền thật. Login tương tác; không
đưa password/access token vào command line, source, chat, log hoặc ảnh báo cáo.
Chỉ đánh dấu PASS khi push và kiểm tra manifest/pull thành công, ghi digest.

App là image custom đã chạy CRUD thật. Web image đang chờ ghép frontend nên
chưa nên công bố như phiên bản giao diện hoàn chỉnh. MinIO là build upstream
source có giải thích riêng; khi phân phối cần giữ giấy phép nguồn tương ứng.
