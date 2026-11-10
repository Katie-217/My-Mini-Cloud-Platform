# Ngoại lệ image MinIO khi triển khai local

Ngày kiểm tra: 10/11/2026.

## Lỗi thực tế

- `docker pull minio/minio:RELEASE.2025-04-22T22-12-26Z`: pull access denied.
- `docker pull quay.io/minio/minio:RELEASE.2025-04-22T22-12-26Z`: 401 UNAUTHORIZED.

Không yêu cầu người dùng cung cấp mật khẩu cho registry chỉ để thử đi thử lại.
Không thay công nghệ MinIO và không dùng lại image custom của dự án trước.

## Phương án đã thực hiện

`storage/Dockerfile` build từ archive tag chính thức
`RELEASE.2025-04-22T22-12-26Z` trên repository `minio/minio` bằng Go 1.24.
Image local là `mycloud-minio:source-2025-04-22`. Không chỉnh sửa mã nguồn MinIO.
Runtime dùng user không phải root, có quyền ghi volume `/data`, ca-certificates
và curl cho healthcheck. Image phải có source build vì upstream pull không thành
công; đây là ngoại lệ có giải thích với nguyên tắc ưu tiên image có sẵn.

Tag được chọn cho Console phù hợp demo. Đây là phiên bản lab cũ, không phải
tuyên bố đây là phiên bản production hiện hành. Khi build binary trực tiếp, chuỗi
version hiển thị có thể là development build; nguồn build được chốt bằng URL tag
trong Dockerfile, không dựa vào tên image cache cũ.

## Đã kiểm chứng

- Build thành công, MinIO healthcheck healthy.
- Console `http://localhost:9001/`: trả HTTP 200, HTML thật.
- Hai bucket private `profile-pics`, `documents` được tạo bởi init job.
- Upload/stat/list/download PNG và PDF giữ nguyên byte qua Flask.
- Anonymous GET vào bucket/object trả 403.
- Chưa thao tác GUI Console trong browser và chưa kiểm thử restart MinIO giữ
  object ở giai đoạn này; không đánh dấu những mục đó PASS.

Nguồn: [MinIO release/tag chính thức](https://github.com/minio/minio/releases/tag/RELEASE.2025-04-22T22-12-26Z),
[hướng dẫn Docker của MinIO](https://github.com/minio/minio/blob/master/docs/docker/README.md).
