# Demo public Kingsmen Seeding — nginx phục vụ file tĩnh
FROM nginx:alpine
# app chính -> trang chủ
COPY seeding-app.html /usr/share/nginx/html/index.html
# giữ luôn đường dẫn gốc để mở /seeding-app.html cũng được
COPY seeding-app.html /usr/share/nginx/html/seeding-app.html
EXPOSE 80
# Build & run:
#   docker build -t seeding-demo -f deploy/Dockerfile .
#   docker run -d --restart unless-stopped -p 80:80 --name seeding seeding-demo
# Truy cập: http://<IP-public-cua-VPS>/
