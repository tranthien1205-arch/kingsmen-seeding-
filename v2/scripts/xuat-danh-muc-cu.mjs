// Xuất danh mục gốc từ app cũ → danh-muc.json (để dán vào Máy › Nhập danh mục của app mới).
//   node scripts/xuat-danh-muc-cu.mjs <URL app cũ> <email>   (hỏi mật khẩu qua bàn phím, không ghi ra đâu)
import fs from 'node:fs'; import readline from 'node:readline/promises';
const [base, email] = process.argv.slice(2);
if (!base || !email) { console.error('Dùng: node scripts/xuat-danh-muc-cu.mjs <URL app cũ> <email>'); process.exit(1); }
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const password = await rl.question('Mật khẩu app cũ: '); rl.close();
const r = await fetch(base.replace(/\/$/, '') + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
const j = await r.json(); if (!r.ok) { console.error('Đăng nhập lỗi:', j.error); process.exit(1); }
const db = j.db;
const out = {
  pillars: (db.pillars || []).map(p => ({ ten: p.ten, mo_ta: p.mo_ta || '', ty_trong: p.ty_trong || 0, active: p.active !== false })),
  frameworks: (db.frameworks || []).map(f => ({ ten: f.ten, mo_ta: f.mo_ta || f.cau_truc || '', active: f.active !== false })),
  san_pham: (db.san_pham || []).map(s => ({ ma: s.ma || '', ten: s.ten, dong: s.dong || '', mo_ta: s.mo_ta || '', thong_so: Array.isArray(s.thong_so) ? s.thong_so : [], tieu_chuan: s.tieu_chuan || '', bao_hanh: s.bao_hanh || '', huong_dan: s.huong_dan || '' })),
  claim_cam: (db.claims || db.claim_cam || []).map(c => ({ cum_tu: c.cum_tu, muc_do: c.muc_do || 'CANH_BAO', ly_do: c.ly_do || '' })),
  kenh: (db.kenh || []).map(k => ({ ten: k.ten, loai: k.loai || 'FANPAGE', api_ma: k.api_ma || '', api_object_id: k.api_object_id || '', cach_dang: k.tu_dong_dang ? (k.cach_dang || 'API') : 'TAY' })),
};
fs.writeFileSync('danh-muc.json', JSON.stringify(out, null, 2));
console.log('✓ danh-muc.json:', Object.entries(out).map(([k, v]) => k + '=' + v.length).join(' · '));
