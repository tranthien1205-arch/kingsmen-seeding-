# Deploy DEMO PUBLIC — Kingsmen Seeding

App là **1 file tĩnh** (`seeding-app.html`), dữ liệu lưu trên máy người xem (localStorage).
→ Rất hợp làm **demo public**: ai vào cũng có bản riêng để bấm thử, không đụng nhau.

Dưới đây xếp từ **nhanh & nhẹ nhất** → **nặng nhất**. Chọn 1.

---

## ⭐ Cách 1 — Netlify Drop (khuyến nghị cho demo, ~2 phút, KHÔNG cần server)
1. Mở https://app.netlify.com/drop
2. Kéo-thả file `seeding-app.html` vào trang.
3. Có ngay link public HTTPS: `https://<ten>.netlify.app` — chạy được cả trên điện thoại.
4. (Tuỳ chọn) đăng nhập để giữ link vĩnh viễn & đổi tên site.

## Cách 2 — Cloudflare Pages / GitHub Pages / Vercel (vĩnh viễn, chuyên nghiệp)
- Đưa file lên 1 repo GitHub → kết nối Cloudflare Pages hoặc Vercel → auto-deploy, HTTPS sẵn.
- Phù hợp khi muốn link ổn định lâu dài, tự cập nhật khi sửa file.

## Cách 3 — VPS miễn phí thật (Oracle Cloud Always Free)
Chỉ nên chọn nếu bạn muốn **tự chủ máy chủ** hoặc sau này gắn thêm backend.

**Bước làm:**
1. Tạo tài khoản https://www.oracle.com/cloud/free/ (cần thẻ để xác minh, **không bị trừ tiền** ở gói Always Free).
2. Tạo **Instance** (VM.Standard.E2.1.Micro hoặc Ampere ARM) — Ubuntu 22.04. Lưu **public IP** + file khoá SSH.
3. Mở port 80: **Networking → VCN → Security List → Ingress Rules** → thêm rule cho `0.0.0.0/0` TCP **80**.
4. SSH vào VPS, đưa file `seeding-app.html` lên (scp hoặc `nano seeding-app.html` rồi dán nội dung).
5. Chạy:
   ```bash
   chmod +x setup-vps.sh
   sudo ./setup-vps.sh
   ```
6. Mở `http://<public-ip>/`.

**Hoặc bằng Docker** (nếu VPS đã có Docker):
```bash
docker build -t seeding-demo -f deploy/Dockerfile .
docker run -d --restart unless-stopped -p 80:80 --name seeding seeding-demo
```

> Muốn HTTPS + tên miền đẹp: trỏ 1 domain về IP rồi chạy `certbot --nginx`.

---

## So sánh nhanh
| Tiêu chí | Netlify Drop | Cloudflare/Vercel | VPS Oracle |
|---|---|---|---|
| Thời gian | ~2 phút | ~10 phút | ~30–45 phút |
| Cần thẻ tín dụng | Không | Không | **Có** (xác minh) |
| HTTPS | Sẵn | Sẵn | Tự cấu hình |
| Tự quản máy chủ | Không | Không | **Có** |
| Hợp cho demo tĩnh | ⭐⭐⭐ | ⭐⭐⭐ | ⭐ |

**Gợi ý:** demo public thì **Netlify Drop hoặc Cloudflare Pages** là hợp lý nhất.
VPS chỉ đáng khi bạn định biến nó thành server thật (gắn Supabase/backend sau).
