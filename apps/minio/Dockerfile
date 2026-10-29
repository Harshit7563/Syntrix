FROM alpine:3.20
RUN apk add --no-cache ca-certificates curl \
  && curl -fsSL https://dl.min.io/server/minio/release/linux-amd64/minio -o /usr/local/bin/minio \
  && chmod +x /usr/local/bin/minio \
  && mkdir -p /data
ENV MINIO_ROOT_USER=minioadmin
ENV MINIO_ROOT_PASSWORD=minioadmin_dev_pw
EXPOSE 9000 9001
CMD ["minio", "server", "/data", "--console-address", ":9001"]
