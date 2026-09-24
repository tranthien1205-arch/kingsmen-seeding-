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
  assert.match(ga, /tools\/\*\*\/\*\.bat\s+text\s+eol=crlf/);
});

test('may-dung.mjs: log() ghi thêm ra may-dung.log, có xoay vòng 5 MB và bắt lỗi bất ngờ', () => {
  assert.match(MAY, /join\(DIR, "may-dung\.log"\)/);
  assert.match(MAY, /export const log = \(\.\.\.m\) => \{[^}]*ghiLog\(/);
  assert.match(MAY, /statSync\(LOG_FILE\)\.size > 5e6\) renameSync\(LOG_FILE, LOG_FILE \+ "\.1"\)/);
  assert.match(MAY, /process\.on\("uncaughtException"/);
  assert.ok(!/console\.error\(/.test(MAY.replace(/const loi = \(\.\.\.m\) => \{ console\.error\(/, '')), 'lỗi ở luồng chính phải đi qua loi() để vào file');
});

test('cai-hoc-ngon-ngu.ps1: dòng lệnh chỉ dùng ASCII (irm giải mã ISO-8859-1, chạy từ đĩa giải mã cp1252 → dấu tiếng Việt thành nháy cong phá cú pháp)', () => {
  const PS = fs.readFileSync(new URL('../tools/may-dung/cai-hoc-ngon-ngu.ps1', import.meta.url), 'utf8');
  const la = PS.split(/\r?\n/).filter((d) => !/^\s*#/.test(d) && /[^\x00-\x7f]/.test(d));
  assert.deepEqual(la, [], 'dòng lệnh có ký tự ngoài ASCII');
  for (const ban of ['torch==2.11.0', 'unsloth==2026.9.11', 'trl==0.24.0', 'download.pytorch.org/whl/cu128']) assert.ok(PS.includes(ban), 'thiếu ghim ' + ban);
});

test('huan-luyen-ngon-ngu.py: chạy được card 8 GB (trả cache VRAM mỗi lượt con) và tìm GGUF cả ở out/gguf_gguf', () => {
  const PY = fs.readFileSync(new URL('../tools/may-dung/huan-luyen-ngon-ngu.py', import.meta.url), 'utf8');
  assert.match(PY, /def on_substep_end\([^)]*\): torch\.cuda\.empty_cache\(\)/);
  assert.match(PY, /callbacks=\[TraVram\(\)\]/);
  assert.match(PY, /os\.walk\(a\.out\)/);
  assert.match(PY, /--khong-gguf/);
});
