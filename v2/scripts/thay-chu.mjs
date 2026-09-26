// ADR-019 — CÔNG CỤ AI THAY CHỦ: phiên Claude giao việc vận hành cho app qua hàng lệnh chính thức (module_config.lenh_thay_chu),
// không tự viết SQL / JS riêng mỗi lần. App chỉ chạy lệnh khi chủ đã bật "Chế độ AI thay chủ" (Máy › Bước: người hay AI); cron 15 phút chạy qua đúng
// đường của app, nhật ký tên "AI thay chủ". Không có lệnh duyệt: bài đạt ngưỡng do luật chủ bật tự duyệt.
//   node scripts/thay-chu.mjs xem                                     cấu hình, lệnh đang chờ, 5 lần chạy gần nhất
//   node scripts/thay-chu.mjs chay_agent SOAN_NHAP                    chạy một trợ lý (mã trong AGENTS của worker)
//   node scripts/thay-chu.mjs dung nd_xxx                             giao dựng video cho bài VIDEO đã duyệt
//   node scripts/thay-chu.mjs gui_duyet nd_xxx                        gửi duyệt bài nháp / bị trả lại
//   node scripts/thay-chu.mjs tra_lai dy_xxx "lý do"                  trả lại bài đang chờ duyệt (bắt buộc lý do)
import { spawnSync } from "node:child_process"; import { writeFileSync, rmSync } from "node:fs"; import { join } from "node:path"; import { tmpdir } from "node:os"; import { fileURLToPath } from "node:url";
const DB = "kingsmen-content-os-db"; const LOAI = ["chay_agent", "dung", "gui_duyet", "tra_lai"];
// wrangler qua npx: ĐỌC bằng --command (trả về hàng; câu đọc chỉ dùng nháy đơn nên bọc nháy kép an toàn), GHI bằng --file (JSON có nháy kép)
const GOC = fileURLToPath(new URL("..", import.meta.url));
const chay = (thamSo) => { const r = spawnSync("npx", ["wrangler", "d1", "execute", DB, "--remote", "--json", ...thamSo], { encoding: "utf8", shell: true, cwd: GOC, maxBuffer: 64 * 1024 * 1024 });
  const s = String(r.stdout || ""); const i = s.indexOf("["); if (i < 0) throw new Error("D1 lỗi: " + (r.stderr || s).slice(0, 400)); return JSON.parse(s.slice(i)); };
const d1 = (sql) => { if (/"/.test(sql)) throw new Error("câu đọc không được có nháy kép"); return chay(["--command", '"' + sql + '"']); };
const d1Ghi = (sql) => { const f = join(tmpdir(), "thay-chu-" + process.pid + ".sql"); writeFileSync(f, sql); try { return chay(["--file", '"' + f + '"']); } finally { rmSync(f, { force: true }); } };
const doc = (id) => { const x = d1(`SELECT cau_hinh FROM module_config WHERE id='${id}'`)[0].results[0]; try { return x ? JSON.parse(x.cau_hinh) : null; } catch { return null; } };
const sqlChuoi = (s) => "'" + String(s).replace(/'/g, "''") + "'";
const [lenh, a, b] = process.argv.slice(2);
if (!lenh || lenh === "xem") {
  const c = doc("thay_chu") || {}; const h = (doc("lenh_thay_chu") || {}).lenh || []; const k = ((doc("lenh_thay_chu_kq") || {}).lan || []).slice(0, 5);
  console.log("Chế độ AI thay chủ:", c.bat ? "BẬT" : "TẮT (chủ bật ở Máy › Bước: người hay AI)", "· tự duyệt G3:", c.g3_tu_duyet !== false, "· ngưỡng:", c.diem_toi_thieu || 90, "· nhận lệnh:", c.lenh !== false);
  console.log("Lệnh đang chờ (" + h.length + "):", JSON.stringify(h));
  for (const l of k) console.log(l.luc, "·", l.kq.map((x) => x.join(": ")).join(" | "));
  process.exit(0);
}
if (!LOAI.includes(lenh)) { console.error("Lệnh không cho phép. Chỉ: " + LOAI.join(", ")); process.exit(2); }
const moi = lenh === "chay_agent" ? { loai: lenh, agent: a } : lenh === "tra_lai" ? { loai: lenh, duyet_id: a, ly_do: b } : { loai: lenh, noi_dung_id: a };
if (!a || (lenh === "tra_lai" && !b)) { console.error("Thiếu tham số — xem đầu file"); process.exit(2); }
const ds = ((doc("lenh_thay_chu") || {}).lenh || []); ds.push({ ...moi, luc: new Date().toISOString(), boi: "Claude" });
d1Ghi(`INSERT INTO module_config (id,cau_hinh,updated_at,updated_by_name) VALUES ('lenh_thay_chu',${sqlChuoi(JSON.stringify({ lenh: ds }))},${sqlChuoi(new Date().toISOString())},'Claude') ON CONFLICT(id) DO UPDATE SET cau_hinh=excluded.cau_hinh, updated_at=excluded.updated_at, updated_by_name=excluded.updated_by_name`);
console.log("Đã xếp lệnh:", JSON.stringify(moi), "· hàng chờ", ds.length, "· app chạy ở lượt cron kế tiếp (≤ 15 phút) nếu chế độ đang bật");
