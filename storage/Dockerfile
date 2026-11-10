# Registry upstream trả access denied ở lần triển khai này; build tag nguồn gốc.
FROM golang:1.24-alpine AS build
RUN apk add --no-cache ca-certificates git
WORKDIR /src
ADD https://codeload.github.com/minio/minio/tar.gz/refs/tags/RELEASE.2025-04-22T22-12-26Z /tmp/minio.tar.gz
RUN tar -xzf /tmp/minio.tar.gz --strip-components=1 -C /src \
    && CGO_ENABLED=0 go build -trimpath -o /minio .
FROM alpine:3.21
RUN apk add --no-cache ca-certificates curl && adduser -D -u 10001 cloud \
    && mkdir -p /data && chown cloud:cloud /data
COPY --from=build /minio /usr/local/bin/minio
USER cloud
EXPOSE 9000 9001
ENTRYPOINT ["minio"]
CMD ["server", "/data", "--console-address", ":9001"]
