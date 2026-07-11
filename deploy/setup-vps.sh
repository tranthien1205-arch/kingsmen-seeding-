#!/usr/bin/env bash
# =====================================================================
#  Dựng demo public Kingsmen Seeding trên VPS Ubuntu (Oracle/GCP/AWS...)
#  Cách dùng trên VPS:
#    1) Copy file seeding-app.html lên VPS (scp / nano dán nội dung)
#    2) chmod +x setup-vps.sh && sudo ./setup-vps.sh
#  Xong: mở http://<IP-public-cua-VPS>/
# =====================================================================
set -e

APP_FILE="${1:-seeding-app.html}"

if [ ! -f "$APP_FILE" ]; then
  echo "Khong thay $APP_FILE. Hay copy file len cung thu muc roi chay lai."
  exit 1
fi

echo ">> Cai nginx..."
sudo apt-get update -y
sudo apt-get install -y nginx

echo ">> Trien khai app..."
sudo cp "$APP_FILE" /var/www/html/index.html
sudo cp "$APP_FILE" /var/www/html/seeding-app.html

echo ">> Mo tuong lua (neu dung ufw)..."
if command -v ufw >/dev/null 2>&1; then
  sudo ufw allow 80/tcp || true
fi

sudo systemctl enable nginx
sudo systemctl restart nginx

IP=$(curl -s ifconfig.me || echo "<IP-VPS>")
echo ""
echo "==================================================="
echo "  DEMO DA CHAY: http://$IP/"
echo "==================================================="
echo "  LUU Y (Oracle Cloud): con phai mo port 80 trong"
echo "  Security List / VCN cua Oracle nua thi may khac"
echo "  moi truy cap duoc."
