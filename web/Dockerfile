FROM nginx:1.28-alpine
COPY conf.default /etc/nginx/conf.d/default.conf
COPY html/ /usr/share/nginx/html/
COPY frontend-pending.html /usr/share/nginx/frontend-pending.html
# API/health vẫn chạy, URL giao diện trả 503 trung thực cho tới khi ghép Gemini.
RUN if [ ! -s /usr/share/nginx/html/index.html ]; then touch /usr/share/nginx/frontend-pending; fi
EXPOSE 80
