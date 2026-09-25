// ADR-016 — NHÃN VÀNG cho mô hình nhìn: bảng đo độ chính xác + màn gán nhãn nhanh bằng phím.
// Chủ 24/09: "cần thiết kế kiến trúc để mô hình nhận diện chính xác khung hình đang nói về gì … đây là cơ sở cho mọi sự phát triển thông minh hơn".
// Đo thật 24/09: mô hình tự khai "chắc 1,0" cả khi sai → không tin số tự khai; phải đo trên nhãn người. Hàng đợi đưa đoạn máy chưa chắc trước,
// cứ 4 đoạn xen 1 đoạn ngẫu nhiên máy "chắc" — riêng nhóm ngẫu nhiên này mới là con số chính xác thật (không lệch về chỗ khó).
const NHOM_HINH = [
  { k: 'BOI_CANH', ten: 'Bối cảnh', mo: 'công trình, không gian, ngôi nhà', mau: '#64748b' },
  { k: 'VAN_DE', ten: 'Vấn đề', mo: 'hư hỏng, mốc, nứt, thấm', mau: '#b91c1c' },
  { k: 'GIAI_PHAP', ten: 'Giải pháp', mo: 'sản phẩm, bao bì, giới thiệu', mau: '#0c7b6f' },
  { k: 'THI_CONG', ten: 'Thi công', mo: 'đang làm một bước', mau: '#b45309' },
  { k: 'THU_NGHIEM', ten: 'Bài test', mo: 'đổ nước, chà, cào, so sánh', mau: '#7c3aed' },
  { k: 'HOAN_THIEN', ten: 'Hoàn thiện', mo: 'kết quả, trước–sau', mau: '#15803d' },
  { k: 'NGUOI_NOI', ten: 'Người nói', mo: 'nói trước máy', mau: '#0369a1' },
  { k: 'KHAC', ten: 'Khác', mo: 'không thuộc nhóm nào', mau: '#94a3b8' },
];
const tenNhom = k => (NHOM_HINH.find(n => n.k === k) || { ten: k || '—' }).ten;
const phanTram = (a, b) => b ? Math.round(a / b * 100) + '%' : '—';

function BangDoHinh({ d }) {
  const nn = d.ngau_nhien || { so: 0 }; const tn = d.theo_nhom || {}; const nguon = d.theo_nguon || {};
  const o = [
    ['Đúng nhóm cảnh · mẫu ngẫu nhiên', phanTram(nn.dung_nhom, nn.so), 'trên ' + (nn.so || 0) + ' đoạn chọn ngẫu nhiên — con số thật', nn.so >= 30 && nn.dung_nhom / nn.so >= 0.8 ? 'text-emerald-700' : 'text-rose-700'],
    ['Đúng nhóm cảnh · tất cả', phanTram(d.dung_nhom, d.so_nhan), 'trên ' + (d.so_nhan || 0) + ' nhãn người (lệch về đoạn khó)', 'text-ink'],
    ['Đúng cả bước / bài test', phanTram(d.dung_chi_tiet, d.so_nhan), 'nhóm đúng và chi tiết đúng', 'text-ink'],
    ['Thầy Claude đúng nhóm', phanTram((d.thay || {}).dung_nhom, (d.thay || {}).so), 'trên ' + ((d.thay || {}).so || 0) + ' nhãn người · mô hình mở: ' + phanTram((d.mo || {}).dung_nhom, (d.mo || {}).so) + ' trên ' + ((d.mo || {}).so || 0), 'text-ink'],
    ['Nhãn vàng đã có', String(d.so_nhan || 0), 'mục tiêu đợt đầu: 200', (d.so_nhan || 0) >= 200 ? 'text-emerald-700' : 'text-amber-700'],
  ];
  return <Card pad="p-3"><SectionTitle className="mb-1">Máy nhìn đúng đến đâu</SectionTitle>
    <div className="text-[11px] text-ink-muted mb-2">Đo trên nhãn người, không dùng số máy tự khai. Footage: {phanTram((nguon.FOOTAGE || {}).dung_nhom, (nguon.FOOTAGE || {}).so)} trên {(nguon.FOOTAGE || {}).so || 0} · Video thành phẩm: {phanTram((nguon.THANH_PHAM || {}).dung_nhom, (nguon.THANH_PHAM || {}).so)} trên {(nguon.THANH_PHAM || {}).so || 0}.</div>
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 mb-3">{o.map(([t, v, g, c]) => <div key={t} className="rounded-xl border border-line p-2"><div className={'text-2xl font-bold tabular-nums ' + c}>{v}</div><div className="text-[11px] font-semibold text-ink">{t}</div><div className="text-[10px] text-ink-muted">{g}</div></div>)}</div>
    {(d.so_nhan || 0) === 0 ? <div className="text-xs text-ink-muted">Chưa có nhãn nào. Bắt đầu ở khung gán nhãn bên dưới.</div> :
      <div className="grid md:grid-cols-3 gap-3 text-xs">
        <div><div className="font-semibold text-ink mb-1">Theo nhóm (nhãn người)</div>
          <table className="w-full"><tbody>{NHOM_HINH.filter(n => tn[n.k]).map(n => <tr key={n.k} className="border-t border-line/60"><td className="py-0.5"><span className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: n.mau }} />{n.ten}</td><td className="text-right tabular-nums text-ink-muted">{tn[n.k].so}</td><td className={'text-right tabular-nums font-semibold ' + (tn[n.k].dung / tn[n.k].so < 0.7 ? 'text-rose-700' : 'text-ink')}>{phanTram(tn[n.k].dung, tn[n.k].so)}</td></tr>)}</tbody></table></div>
        <div><div className="font-semibold text-ink mb-1">Máy hay nhầm</div>
          {(d.nham || []).length ? <table className="w-full"><tbody>{d.nham.map((x, i) => <tr key={i} className="border-t border-line/60"><td className="py-0.5">máy nói <b>{tenNhom(x.may)}</b></td><td>thật là <b>{tenNhom(x.nguoi)}</b></td><td className="text-right tabular-nums">{x.so}</td></tr>)}</tbody></table> : <div className="text-ink-muted">Chưa thấy nhầm.</div>}</div>
        <div><div className="font-semibold text-ink mb-1">Máy tự khai chắc — có đúng không</div>
          <table className="w-full"><tbody>{(d.muc_tin || []).map(x => <tr key={x.ten} className="border-t border-line/60"><td className="py-0.5">tự khai {x.ten}</td><td className="text-right tabular-nums text-ink-muted">{x.so}</td><td className="text-right tabular-nums font-semibold">{phanTram(x.dung_nhom, x.so)}</td></tr>)}</tbody></table>
          <div className="text-[10px] text-ink-muted mt-1">Nếu dòng "≥ 0,9" không cao hơn hẳn các dòng dưới thì số tự khai vô nghĩa, phải hiệu chỉnh.</div></div>
      </div>}
  </Card>;
}


// Ảnh đoạn là DẢI 3 khung liên tiếp (máy đọc hình) — cắt riêng từng khung bằng CSS để người gán từng khung (chủ 25/09: "3 ảnh nhưng 2 nội dung").
function KhungCat({ url, k }) { return <div className="rounded-lg bg-slate-900 aspect-[3/4] w-full" style={{ backgroundImage: 'url(' + url + ')', backgroundSize: '300% 100%', backgroundPosition: (k * 50) + '% 0', backgroundRepeat: 'no-repeat' }} />; }
function DaiVideo({ tl, dai, tu, den }) {
  if (!Array.isArray(tl) || !tl.length) return null; const het = dai || Math.max(...tl.map(y => y[1])) || 1;
  return <div className="mt-2"><div className="relative h-4 rounded bg-slate-100 overflow-hidden" role="img" aria-label="dải thời gian cả video theo nhóm cảnh">
    {tl.map((y, j) => { const n = NHOM_HINH.find(z => z.k === y[2]); const dang = Math.abs(y[0] - tu) < 0.01 && Math.abs(y[1] - den) < 0.01;
      return <div key={j} title={y[0] + '–' + y[1] + 's · ' + tenNhom(y[2]) + (y[3] ? ' · người đã kiểm' : '')} className="absolute top-0 bottom-0" style={{ left: (y[0] / het * 100) + '%', width: Math.max(0.6, (y[1] - y[0]) / het * 100) + '%', background: n ? n.mau : '#94a3b8', opacity: dang ? 1 : 0.45, outline: dang ? '2px solid #0f172a' : 'none', outlineOffset: '-2px' }}>{y[3] ? <span className="absolute right-0.5 top-0 text-[8px] text-white">✓</span> : null}</div>; })}
  </div><div className="flex justify-between text-[10px] text-ink-muted mt-0.5"><span>0s</span><span>đang xem: giây {tu}–{den} (viền đậm)</span><span>{Math.round(het)}s</span></div></div>;
}