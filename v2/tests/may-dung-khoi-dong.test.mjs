// Máy con: file khởi động BAT-DAU.bat và nhật ký may-dung.log (sửa 24/09 sau khi cài máy học 3070 Ti).
// Lỗi cũ: khối `if not exist may-dung.json ( ... )` chứa dòng echo có dấu ")" → cmd đóng khối sớm (": was unexpected at this time"),
// và %MA% trong khối bị nở TRƯỚC khi `set /p` đọc mã → mã ghép luôn rỗng. Máy mới không ghép được, máy cũ không vào được vòng chạy.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const BAT = fs.readFileSync(new URL('../tools/may-dung/BAT-DAU.bat', import.meta.url), 'utf8');
const MAY = fs.readFileSync(new URL('../tools/may-dung/may-dung.mjs', import.meta.url), 'utf8');
const lenh = BAT.split(/\r?\n/).filter((d) => d.trim() && !/^\s*rem\b/i.test(d));

test('BAT-DAU: bước ghép không nằm trong khối ( ... ) — set /p và %MA% ở cấp ngoài, nhảy nhãn khi đã ghép', () => {
  assert.ok(!lenh.some((d) => /^\s*if\s+not\s+exist\s+may-dung\.json\s*\(/i.test(d)), 'không được bọc bước ghép trong khối if ( ... )');
  const iNhay = lenh.findIndex((d) => /^\s*if\s+exist\s+may-dung\.json\s+goto\s+lap\s*$/i.test(d));
  const iDoc = lenh.findIndex((d) => /^\s*set\s+\/p\s+MA=/i.test(d));
  const iGhep = lenh.findIndex((d) => /node\s+may-dung\.mjs\s+ghep\s+%MA%/i.test(d));
  const iNhan = lenh.findIndex((d) => /^:lap\s*$/i.test(d));
  assert.ok(iNhay >= 0 && iDoc > iNhay && iGhep > iDoc && iNhan > iGhep, 'thứ tự: if exist → goto lap, set /p, node ghep %MA%, :lap');
});

test('BAT-DAU: dòng hướng dẫn dán mã ghép không có dấu ngoặc (tránh tái phát nếu ai bọc lại vào khối)', () => {
  const d = lenh.find((x) => /^\s*echo\b.*ma ghep/i.test(x));
  assert.ok(d, 'thiếu dòng hướng dẫn dán mã ghép');
  assert.ok(!/[()]/.test(d), 'echo có ngoặc: ' + d);
});

test('BAT-DAU: git giữ xuống dòng CRLF cho file .bat', () => {
  const ga = fs.readFileSync(new URL('../.gitattributes', import.meta.url), 'utf8');
  assert.match(ga, /^tools\/\*\*\/\*\.bat\s+text\s+eol=crlf/m);
  assert.match(ga, /^dist\/tools\/\*\*\/\*\.bat\s+text\s+eol=crlf/m, 'bản build phát cho máy con cũng phải CRLF');
});

test('may-dung.mjs: log() ghi thêm ra may-dung.log, có xoay vòng 5 MB và bắt lỗi bất ngờ', () => {
  assert.match(MAY, /join\(DIR, "may-dung\.log"\)/);
  assert.match(MAY, /export const log = \(\.\.\.m\) => \{[^}]*ghiLog\(/);
  assert.match(MAY, /statSync\(LOG_FILE\)\.size > 5e6\) renameSync\(LOG_FILE, LOG_FILE \+ "\.1"\)/);
  assert.match(MAY, /process\.on\("uncaughtException"/);
  assert.ok(!/console\.error\(/.test(MAY.replace(/const loi = \(\.\.\.m\) => \{ console\.error\(/, '')), 'lỗi ở luồng chính phải đi qua loi() để vào file');
});

test('mọi *.ps1 máy con: dòng lệnh chỉ dùng ASCII (irm giải mã ISO-8859-1, chạy từ đĩa giải mã cp1252 → dấu tiếng Việt thành nháy cong phá cú pháp)', () => {
  const thuMuc = new URL('../tools/may-dung/', import.meta.url);
  const ds = fs.readdirSync(thuMuc).filter((f) => f.endsWith('.ps1'));
  assert.ok(ds.includes('cai-may-hoc.ps1') && ds.includes('cai-hoc-ngon-ngu.ps1'));
  for (const f of ds) {
    const la = fs.readFileSync(new URL(f, thuMuc), 'utf8').split(/\r?\n/).filter((d) => !/^\s*#/.test(d) && /[^\x00-\x7f]/.test(d));
    assert.deepEqual(la, [], f + ': dòng lệnh có ký tự ngoài ASCII');
  }
  const PS = fs.readFileSync(new URL('cai-hoc-ngon-ngu.ps1', thuMuc), 'utf8');
  for (const ban of ['torch==2.11.0', 'unsloth==2026.9.11', 'trl==0.24.0', 'download.pytorch.org/whl/cu128']) assert.ok(PS.includes(ban), 'thiếu ghim ' + ban);
});

test('huan-luyen-ngon-ngu.py: chạy được card 8 GB (trả cache VRAM mỗi lượt con) và tìm GGUF cả ở out/gguf_gguf', () => {
  const PY = fs.readFileSync(new URL('../tools/may-dung/huan-luyen-ngon-ngu.py', import.meta.url), 'utf8');
  assert.match(PY, /def on_substep_end\([^)]*\): torch\.cuda\.empty_cache\(\)/);
  assert.match(PY, /callbacks=\[TraVram\(\)\]/);
  assert.match(PY, /os\.walk\(a\.out\)/);
  assert.match(PY, /--khong-gguf/);
});

test('may-dung.mjs 1.4: nhớ lệnh đang làm (dang-lam.json), khởi động lại thì làm tiếp — tối đa 3 lần, chờ Ollama; log tham số cắt 300 ký tự', () => {
  assert.match(MAY, /const BAN = "1\.[4-9]"/);
  assert.match(MAY, /const DANG_LAM_F = join\(DIR, "dang-lam\.json"\)/);
  assert.match(MAY, /writeFileSync\(DANG_LAM_F,/);
  assert.match(MAY, /rmSync\(DANG_LAM_F, \{ force: true \}\)/);
  assert.match(MAY, /const LAN_TOI_DA = 3/);
  assert.match(MAY, /await nhipTim\(\);[\s\S]{0,400}const nhipTimDinhKy = [^\n]*batNhip\(\);\s*\r?\nawait lamTiepLenhDo\(\);/, '1.5: nhịp tim định kỳ bật trước khi làm tiếp lệnh dở (1.8: ở luồng riêng)');
  assert.match(MAY, /ts\.length > 300 \? ts\.slice\(0, 300\)/);
});

test('khởi động lại hằng ngày: chờ lệnh dở (dang-lam.json) rồi shutdown /r; bộ cài có admin → S4U (chạy cả khi chưa đăng nhập), không admin → Interactive + nhắc', () => {
  const KD = fs.readFileSync(new URL('../tools/may-dung/khoi-dong-lai.ps1', import.meta.url), 'utf8');
  assert.match(KD, /Test-Path \$DANG/); assert.match(KD, /shutdown\.exe \/r/);
  const CAI = fs.readFileSync(new URL('../tools/may-dung/cai-khoi-dong-lai.ps1', import.meta.url), 'utf8');
  assert.match(CAI, /IsInRole\(\[Security\.Principal\.WindowsBuiltInRole\]::Administrator\)/);
  assert.match(CAI, /\$kieu = if \(\$laAdmin\) \{ 'S4U' \} else \{ 'Interactive' \}/);
  assert.match(CAI, /-LogonType \$kieu/);
  assert.match(CAI, /Run as administrator/);
});

test('1.6 chạy nền khi bật máy (26/09): khoá một máy con, CHAY-NEN lặp không dùng timeout, bộ cài S4U không lưu mật khẩu', () => {
  assert.match(MAY, /const BAN = "1\.[6-9]"/);
  assert.match(MAY, /const KHOA_F = join\(DIR, "dang-chay\.json"\)/); assert.match(MAY, /process\.exit\(3\)/); assert.match(MAY, /20 \* 60e3/);
  assert.ok(MAY.indexOf("giuKhoa();") < MAY.indexOf('await goiApp("/hub/ping")'), "giữ khoá trước khi nối app");
  assert.match(BAT, /if errorlevel 3 if not errorlevel 4 goto nen/);
  const NEN = fs.readFileSync(new URL('../tools/may-dung/CHAY-NEN.bat', import.meta.url), 'utf8');
  assert.equal(NEN.split("\n").length, NEN.split("\r\n").length, "CHAY-NEN.bat phải CRLF (cmd đọc nhãn sai với LF)");
  assert.match(NEN, /node may-dung\.mjs --nen/); assert.match(NEN, /if errorlevel 3 if not errorlevel 4 goto cho/);
  assert.ok(!/^\s*timeout\b/im.test(NEN), 'phiên nền không có bàn phím — không dùng timeout');
  assert.ok(NEN.includes("System32\\find.exe"), "find của Windows, không phải find của Git");
  const CAI = fs.readFileSync(new URL('../tools/may-dung/cai-chay-nen.ps1', import.meta.url), 'utf8');
  assert.ok(CAI.includes(String.fromCharCode(67,58,92)+"may-dung") && !/C:may|DIRmay/.test(CAI), "đường dẫn giữ dấu gạch ngược (lỗi 26/09: C:may-dung)"); assert.match(CAI, /MAY_CON_DIR/);
  assert.match(CAI, /-LogonType S4U/); assert.match(CAI, /-AtStartup/); assert.match(CAI, /IsInRole/);
  assert.ok(!/-Password|Get-Credential|ConvertTo-SecureString/i.test(CAI), 'không hỏi / lưu mật khẩu');
  const KDL = fs.readFileSync(new URL('../tools/may-dung/cai-khoi-dong-lai.ps1', import.meta.url), 'utf8'); assert.match(KDL, /chay nen khi bat may/);
});

test('1.7 giữ máy thức khi máy con chạy (26/09: Q2 ngủ đông lúc rảnh) — SetThreadExecutionState, tự thoát theo tiến trình cha', () => {
  assert.match(MAY, /const BAN = "1\.[7-9]"/);
  assert.match(MAY, /SetThreadExecutionState/); assert.match(MAY, /0x80000001/); assert.match(MAY, /Get-Process -Id " \+ process\.pid/);
  assert.match(MAY, /--cho-ngu/); assert.ok(!/powercfg/i.test(MAY), 'không đổi cài đặt nguồn của máy');
});

test('1.8 nhịp tim ở luồng riêng (spawnSync không chặn) + tự cập nhật từ app (kiểm cú pháp, giữ bản cũ, không hạ bản)', async () => {
  assert.match(MAY, /const BAN = "1\.([8-9]|\d\d)"/);
  assert.match(MAY, /import \{ Worker \} from "node:worker_threads"/); assert.match(MAY, /new Worker\(code, \{ eval: true/);
  assert.match(MAY, /setInterval\(nhip, 120000\); setInterval\(khoa, 60000\);/, 'luồng nhịp gửi nhịp tim + làm mới khoá');
  assert.match(MAY, /baoDangLam\(dangLam\)/);
  assert.match(MAY, /"may-dung\.moi\.mjs"/, 'file tạm phải đuôi .mjs để node --check đọc được (lỗi thử 26/09)');
  assert.match(MAY, /\["--check", tam\]/); assert.match(MAY, /f \+ "\.cu"/); assert.match(MAY, /--khong-cap-nhat/);
  assert.match(MAY, /!existsSync\(DANG_LAM_F\)\) await tuCapNhat\(\)/, 'không cập nhật khi còn lệnh dở');
  const m = MAY.match(/const soBan = [^\n]+\n(const moiHon = [^\n]+)/); assert.ok(m); const moiHon = new Function('soBan', m[1].replace('const moiHon = ', 'return ') + ';')((b) => String(b || '0').split('.').map((x) => parseInt(x, 10) || 0));
  assert.equal(moiHon('1.8', '1.7'), true); assert.equal(moiHon('1.10', '1.9'), true); assert.equal(moiHon('1.7', '1.8'), false); assert.equal(moiHon('1.8', '1.8'), false);
});

test('hoc-thanh-pham (26/09): bỏ link TikTok trùng mã video; gửi ảnh đoạn lỗi thì ghi mã HTTP thay vì "0 ảnh đoạn"', () => {
  const HOC = fs.readFileSync(new URL('../tools/may-dung/hoc-thanh-pham.mjs', import.meta.url), 'utf8');
  assert.match(HOC, /if \(!id \|\| daThay\.has\(id\)\) continue; daThay\.add\(id\);/);
  assert.match(HOC, /ghi \+= r\.ok \?/);
  assert.match(HOC, /"ảnh đoạn LỖI app HTTP " \+ r\.status/);
});
