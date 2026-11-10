# Triển khai và giới hạn đã kiểm thử

## Local Windows — đã kiểm thử

Chạy `scripts/start.ps1`, `scripts/health-check.ps1 -RequireFrontend` như README.
Hạ tầng và ba giao diện đã chạy thật; 27 checks Edge và 41 checks gateway PASS.
Chưa có Git remote nên source hiện nằm trong repo local và các nhánh tính năng.

## Ubuntu EC2 — hướng dẫn, NOT TESTED

Chỉ triển khai sau khi local đạt đầy đủ và người dùng cung cấp môi trường/phạm vi.
Chưa tạo instance, chưa phát sinh tài nguyên AWS bởi Codex. Bản local được test
với Docker cấp khoảng 15,48 GiB RAM; chưa benchmark EC2 ít RAM hơn.
Chọn kiến trúc amd64/x86_64 phù hợp SQL Server, không dùng image ARM thay thế.

1. Chuẩn bị Ubuntu 24.04 LTS amd64 và quyền SSH của bạn. Kiểm tra subnet Docker
   với VPC/VPN/routes trước khi tạo cloud-net; nếu trùng cần đổi IPAM và zone đồng bộ.
2. Cài Docker bằng repository apt theo [hướng dẫn chính thức Ubuntu](https://docs.docker.com/engine/install/ubuntu/).
   Sau khi thêm repository theo tài liệu, trong Bash trên EC2:

```bash
sudo apt-get install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo apt-get install git python3
sudo docker version
sudo docker compose version
```

3. Clone repo do người dùng cung cấp hoặc chuyển source đã kiểm tra. Không copy
   `.env` thật vào Git. Trong thư mục repo trên EC2, chạy `python3 scripts/init-env.py`
   rồi `chmod 600 .env` để giới hạn quyền đọc credential trên Linux.
4. Sửa `.env` bằng editor local trên EC2: credential riêng, `PUBLIC_URL` theo URL
   public dự kiến, realm đúng MSSV. Không dùng password của máy local cho bản public.
5. Build/run bằng `sudo bash scripts/start.sh`; yêu cầu daemon Docker hoạt động.
   Script dùng named volume mới, không lấy volume/secret từ host Windows.
6. Kiểm tra `sudo docker compose -f docker-compose.yml -p mycloud ps -a`, API
   `/api/health`, DNS, metrics, targets, dashboard và dữ liệu persistence trước nghiệm thu.

Chưa chạy các bước này trên EC2, vì vậy mọi kết quả EC2 giữ NOT TESTED.

## Security Group và truy cập quản trị

Security Group kiểm soát traffic vào/ra instance. Cho SSH 22 từ IP quản trị của
bạn; cổng demo 80 chỉ mở cho nguồn cần xem, HTTPS 443 khi đã cấu hình TLS.
Không mở public SQL 1433, MinIO 9000/9001, Prometheus 9090, Grafana 3000, DNS 1053
hoặc exporter. Tham khảo [Security Groups của EC2](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-security-groups.html).

Port quản trị vẫn bind loopback. Từ PowerShell máy bạn có SSH client và private
key được lưu ngoài repo, mở tunnel (đổi key/host theo instance thật):

```powershell
ssh -i "PATH_TO_PRIVATE_KEY" -N -L 11433:127.0.0.1:1433 -L 13000:127.0.0.1:3000 -L 19001:127.0.0.1:9001 ubuntu@EC2_PUBLIC_IP
```

SSMS dùng `127.0.0.1,11433`, Grafana localhost:13000, Console localhost:19001.
Giữ terminal tunnel mở; không đưa private key vào repo. AWS yêu cầu SSH inbound
được cho phép từ IP của bạn; xem [kết nối SSH Linux EC2](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/connect-linux-inst-ssh.html).

## OIDC trên public IP và TLS

Cấu hình Keycloak start-dev, HTTP và trust certificate hiện phục vụ local lab.
Frontend PKCE thường dùng Web Crypto, cần secure context; xem
[tài liệu SubtleCrypto](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto).
Localhost là trường hợp phát triển đặc biệt. Không mặc định login PKCE qua HTTP public IP chạy được.
Trước nghiệm thu auth ngoài localhost, cần domain/HTTPS, cấu hình TLS tại gateway,
issuer/redirect URI/web origins/cookie nhất quán, rồi kiểm thử lại bằng browser.
HTTP public IP có thể dùng để kiểm tra Portal/Blog/API sau khi frontend được ghép;
không dùng điều đó làm bằng chứng auth production đã hoàn thành.

Chưa cấu hình TLS hoặc chạy EC2 trong lần làm local này. Hướng dẫn này là bước
chuẩn bị, không phải báo cáo đã deploy hoặc chứng nhận production-ready.
