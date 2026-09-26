// ===== ADR-018 — KHO MẪU · BỘ NHÃN · TỔNG QUAN (đúng bản mô phỏng docs/he-nhan-mo-phong.html) =====
// Thầy chốt nhãn; người chỉ xem mẫu "Kiểm ngẫu nhiên" và "Thầy chưa chắc". Mọi nhãn đọc / ghi qua bảng mau_doan (một nguồn), có version chống đè.
const TT18 = {
  KIEM: { ten: 'Kiểm ngẫu nhiên', cls: 'bg-[#E3EEFA] text-[#1F5FA8]' },
  KHONG_CHAC: { ten: 'Thầy chưa chắc', cls: 'bg-[#FBE4E1] text-[#A3372B]' },
  THAY_CHOT: { ten: 'Thầy chốt', cls: 'bg-[#E7ECEF] text-[#3B4B55]' },
  VANG: { ten: 'Người đã kiểm', cls: 'bg-[#FDF3D6] text-[#8A6410]' },
  MO: { ten: 'Chỉ mô hình mở', cls: 'bg-[#DDF2EE] text-[#0C6B5E]' },
  KHONG_RO: { ten: 'Hình không rõ', cls: 'bg-[#EEF1F2] text-[#607580]' },
  NGHE_SAI: { ten: 'Nghe sai', cls: 'bg-[#EEF1F2] text-[#607580]' },
  LUAT: { ten: 'Chỉ luật máy', cls: 'bg-[#DDF2EE] text-[#0C6B5E]' },
  CHO_THAY: { ten: 'Chờ thầy', cls: 'bg-[#EEF1F2] text-[#607580]' },
};
const TRUONG18 = [
  { k: 'nhom', ten: 'Nhóm cảnh', nhom: 'Nội dung', kieu: 'CO_DINH' }, { k: 'buoc', ten: 'Bước thi công', nhom: 'Nội dung', kieu: 'QUY_TRINH', khi: 'THI_CONG' },
  { k: 'bai_test', ten: 'Bài test', nhom: 'Nội dung', kieu: 'QUY_TRINH', khi: 'THU_NGHIEM' }, { k: 'hanh_dong', ten: 'Hành động', nhom: 'Nội dung', kieu: 'MO_RONG', nhieu: 1 },
  { k: 'vat_lieu', ten: 'Sản phẩm / vật liệu', nhom: 'Nội dung', kieu: 'MO_RONG', nhieu: 1, theo_dong: 1 }, { k: 'dung_cu', ten: 'Dụng cụ', nhom: 'Nội dung', kieu: 'MO_RONG', nhieu: 1 },
  { k: 'vi_tri', ten: 'Vị trí', nhom: 'Nội dung', kieu: 'MO_RONG' }, { k: 'nguoi', ten: 'Người trong khung', nhom: 'Nội dung', kieu: 'CO_DINH' },
  { k: 'co_canh', ten: 'Cỡ cảnh', nhom: 'Hình', kieu: 'CO_DINH' }, { k: 'goc_may', ten: 'Góc máy', nhom: 'Hình', kieu: 'CO_DINH' }, { k: 'chuyen_dong', ten: 'Chuyển động máy', nhom: 'Hình', kieu: 'CO_DINH' },
  { k: 'tham_my', ten: 'Thẩm mỹ hoàn thiện', nhom: 'Chất lượng', kieu: 'SO', khi: 'HOAN_THIEN' }, { k: 'dung_cho', ten: 'Dùng cho', nhom: 'Dùng cho', kieu: 'CO_DINH' }, { k: 'mo_ta', ten: 'Mô tả', nhom: 'Dùng cho', kieu: 'CHU' },
];
const KIEU18 = (t) => t.kieu === 'CO_DINH' ? 'cố định' : t.kieu === 'QUY_TRINH' ? 'mở rộng · theo dòng' : t.kieu === 'SO' ? '0–10' : t.kieu === 'CHU' ? 'chữ tự do' : 'mở rộng' + (t.theo_dong ? ' · theo dòng' : '');
const NGUON18 = { HE_THONG: 'hệ thống', THAY: 'thầy đề xuất', NGUOI: 'người', QUY_TRINH: 'quy trình sản phẩm' };
const nhan18 = (o) => !o ? '—' : tenNhom(o.nhom) + (o.buoc ? ' · ' + o.buoc : '') + (o.bai_test ? ' · ' + o.bai_test : '');
const khop18 = (a, b) => a && b && a.nhom === b.nhom && (a.buoc || null) === (b.buoc || null) && (a.bai_test || null) === (b.bai_test || null);
const sachNhan18 = (o) => { const v = { ...(o || {}) }; ['chac', 'ly_do', 'model', 'ai', 'luc', 'phan', 'khong_ro', 'nghe_sai', 'hinh', 'khop_hinh', 'ngau_nhien', 'text_goc'].forEach((k) => delete v[k]); return v; };
const giong18 = (a, b) => JSON.stringify(a == null || (Array.isArray(a) && !a.length) ? null : a) === JSON.stringify(b == null || (Array.isArray(b) && !b.length) ? null : b);

// bộ nhãn dùng chung (một lần tải, làm mới sau khi sửa)
let __bn18 = null; const __bnNghe = new Set();
function useBoNhan() {
  const { goi } = useApp(); const [bn, setBn] = useState(__bn18);
  const tai = async () => { const r = await goi('/bo-nhan'); if (r.ok) { __bn18 = r; __bnNghe.forEach((f) => f(r)); } return r; };
  useEffect(() => { __bnNghe.add(setBn); if (!__bn18) tai(); return () => { __bnNghe.delete(setBn); }; }, []);
  return { bn, tai, dat: (r) => { __bn18 = r; __bnNghe.forEach((f) => f(r)); } };
}
function giaTri18(bn, f, dong) { if (f === 'nhom') return NHOM_HINH.map((n) => n.k); if (!bn) return [];
  return bn.gia_tri.filter((x) => x.truong === f && x.trang_thai === 'DUNG' && (!dong || !x.dong || x.dong === dong)).map((x) => x.ma || x.ten).filter((v, i, a) => a.indexOf(v) === i); }
function tenGt18(bn, f, v) { if (f === 'nhom') return tenNhom(v); if (f === 'co_canh' && bn) { const x = bn.gia_tri.find((y) => y.truong === 'co_canh' && y.ma === v); if (x) return x.ten; } return String(v); }
function HienGt({ bn, f, v }) {
  if (v == null || v === '' || (Array.isArray(v) && !v.length)) return <span className="text-ink-muted">—</span>;
  if (f === 'mo_ta' || f === 'tham_my' || f === 'nhom') return <>{f === 'nhom' ? tenNhom(v) : String(v)}</>;
  const co = giaTri18(bn, f, null); const ds = Array.isArray(v) ? v : [v];
  return <>{ds.map((x, i) => <React.Fragment key={i}>{i ? ', ' : ''}{bn && !co.includes(x) ? <span className="border border-dashed border-[#E3B23C] bg-[#FFF9E8] rounded-md px-1 text-[11px]" title="chưa có trong bộ nhãn — đề xuất">{tenGt18(bn, f, x)} · đề xuất</span> : tenGt18(bn, f, x)}</React.Fragment>)}</>;
}
function useRong(px) { const [r, setR] = useState(() => typeof window !== 'undefined' && window.innerWidth >= px); useEffect(() => { const f = () => setR(window.innerWidth >= px); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f); }, []); return r; }
const Kbd = ({ children }) => <span className="font-mono bg-black/10 rounded px-1 mr-1 text-[11px]">{children}</span>;
const CHAM18 = { KIEM: 'bg-[#1F5FA8]', KHONG_CHAC: 'bg-[#A3372B]', THAY_CHOT: 'bg-[#9AA9B2]', VANG: 'bg-[#C9A84C]', MO: 'bg-[#0C6B5E]', LUAT: 'bg-[#0C6B5E]', KHONG_RO: 'bg-[#B8C4CA]', NGHE_SAI: 'bg-[#B8C4CA]', CHO_THAY: 'bg-[#B8C4CA]' };
const nutCls = 'border border-line bg-white rounded-[10px] px-3 py-1.5 font-semibold text-xs disabled:opacity-40 disabled:cursor-not-allowed';

// thầy hết trần / đang đọc bù — báo thẳng trên màn (25/09: hết trần 20 USD làm 556 đoạn không có nhãn thầy mà không ai biết)
function BaoThay({ bu: bu0, onDoi }) {
  const { me, goi, notify } = useApp(); const [bu, setBu] = useState(bu0 || null); const [busy, setBusy] = useState(false);
  useEffect(() => { if (bu0) setBu(bu0); else goi('/thay/bu').then((r) => { if (r.ok) setBu(r); }); }, [bu0]);
  if (!bu || (!bu.het_tran && !bu.cho && !bu.thieu_anh)) return null;
  const docNgay = async () => { setBusy(true); const r = await goi('/thay/doc-bu', { method: 'POST', body: { so: 12 } }); setBusy(false); if (r.ok) { setBu(r.bu); notify(r.het_tran ? 'Dừng: ' + r.het_tran : 'Thầy đã đọc bù ' + r.so + ' đoạn'); onDoi && onDoi(); } else notify(r.msg, 'err'); };
  return <div className={'rounded-xl px-3 py-2 text-xs flex items-center gap-2 flex-wrap ' + (bu.het_tran ? 'bg-[#FBE4E1] text-[#A3372B]' : 'bg-[#E3EEFA] text-[#1F5FA8]')}>
    {bu.het_tran ? <span><b>Thầy đã hết trần tháng này</b> ({String(bu.usd).replace('.', ',')} / {bu.tran} USD): video học mới chỉ có nhãn mô hình mở, {bu.cho} đoạn đang chờ thầy đọc bù. Nâng trần ở <b>Bộ nhãn › Thầy gán nhãn</b> để thầy đọc tiếp.</span>
      : <span><b>Thầy đang đọc bù</b> {bu.cho} đoạn còn trống hoặc thiếu nhãn chi tiết (tự chạy 16 đoạn mỗi 15 phút) · đã tiêu {String(bu.usd).replace('.', ',')} / {bu.tran} USD tháng này</span>}
    {bu.thieu_anh > 0 && <span className="text-ink-muted">· {bu.thieu_anh} đoạn cũ chưa có ảnh — máy Q2 đang cắt bù</span>}
    {!bu.het_tran && bu.cho > 0 && laGat(me) && <button className={nutCls + ' ml-auto !py-0.5'} disabled={busy} onClick={docNgay}>{busy ? 'Thầy đang đọc…' : 'Đọc bù ngay 12 đoạn'}</button>}</div>;
}
// ===================== KHO MẪU =====================
function KhoMau18({ onDoi }) {
  const { goi, notify } = useApp(); const { bn } = useBoNhan(); const rong = useRong(900);
  const [loc, setLoc] = useState({}); const [moLoc, setMoLoc] = useState(false); const soLoc = Object.values(loc).filter((v) => v !== '' && v != null && v !== false).length;
  const [kn, setKn] = useState('K1'); const [tt, setTt] = useState('CAN'); const [dong, setDong] = useState(''); const [q, setQ] = useState(''); const [trang, setTrang] = useState(1);
  const [kq, setKq] = useState(null); const [chon, setChon] = useState(null); const [tuanTu, setTuanTu] = useState(false); const [tick, setTick] = useState(() => new Set()); const [busy, setBusy] = useState(false);
  const lucChon = useRef(Date.now()); const lanTai = useRef(0);
  const tai = async (giu) => { const lan = ++lanTai.current; const r = await goi('/kho-mau?kn=' + kn + '&tt=' + tt + '&dong=' + encodeURIComponent(dong) + '&q=' + encodeURIComponent(q) + '&trang=' + trang + '&n=40' + Object.entries(loc).filter(([, v]) => v !== '' && v != null && v !== false).map(([k, v]) => '&' + k + '=' + encodeURIComponent(v === true ? '1' : v)).join(''));
    if (lan !== lanTai.current) return; if (!r.ok) return notify(r.msg, 'err'); setKq(r); setChon((c) => (giu && c && r.hang.some((x) => x.id === c)) ? c : (giu && c ? c : (rong && r.hang[0] ? r.hang[0].id : null))); };
  useEffect(() => { setKq(null); setChon(null); tai(false); }, [kn, tt, dong, trang, JSON.stringify(loc)]);
  useEffect(() => { lucChon.current = Date.now(); }, [chon]);
  const ds = (kq && kq.hang) || []; const m = ds.find((x) => x.id === chon) || null; const vt = ds.findIndex((x) => x.id === chon);
  useEffect(() => { ds.slice(vt + 1, vt + 6).forEach((x) => { if (x.khung_url) { const im = new Image(); im.src = x.khung_url; } }); }, [chon, kq]);
  const ke = (b = 1) => { const n = ds[vt + b]; if (n) setChon(n.id); else notify(b > 0 ? 'Hết mẫu trong bộ lọc' : 'Đang ở mẫu đầu', 'warn'); };
  // lưu một mẫu → thay dòng bằng bản máy chủ trả về; mẫu không còn khớp bộ lọc thì rời danh sách; duyệt tuần tự thì sang mẫu kế
  const sauLuu = (row, loiRow) => { const r0 = row || loiRow; if (!r0) return; const conKhop = !tt || (tt === 'CAN' ? (kn === 'K2' ? r0.tt_source === 'LUAT' : ['KIEM', 'KHONG_CHAC'].includes(r0.tt)) : (kn === 'K2' ? r0.tt_source : r0.tt) === tt);
    const k2 = kn === 'K2' ? { ...r0, tt: r0.tt_source } : r0; const next = ds[vt + 1] || ds[vt - 1];
    setKq((o) => o && { ...o, hang: conKhop ? o.hang.map((x) => x.id === r0.id ? { ...x, ...k2 } : x) : o.hang.filter((x) => x.id !== r0.id) });
    if (!conKhop || tuanTu) setChon(next ? next.id : null); onDoi && onDoi(); tai(true); };
  const guiLuu = async (duong, body, bao) => { if (busy) return; setBusy(true); const giay = Math.min(120, Math.round((Date.now() - lucChon.current) / 1000));
    const r = await goi(duong, { method: 'POST', body: { ...body, version: m.version, giay } }); setBusy(false);
    if (r.ok) { notify(bao); sauLuu(r.row); }
    else if (r.status === 409 && r.data && r.data.row) { notify('Mẫu vừa được người khác sửa — đã nạp bản mới, xem lại rồi lưu', 'warn'); setKq((o) => o && { ...o, hang: o.hang.map((x) => x.id === m.id ? { ...x, ...r.data.row } : x) }); }
    else notify(r.msg, 'err'); };
  const id = m ? encodeURIComponent(m.id) : '';
  const luuHinh = (nhan, bao) => guiLuu('/mau-doan/' + id, { nhan }, bao || 'Đã lưu nhãn người');
  const dungHet = () => { if (!m) return; if (kn === 'K2') return; if (!m.thay) return notify('Mẫu chưa có nhãn thầy', 'err');
    if (kn === 'K4') guiLuu('/mau-doan/' + id + '/loi', { nhom: m.thay.nhom, buoc: m.thay.buoc || null, bai_test: m.thay.bai_test || null }, 'Đã chốt theo thầy'); else luuHinh(sachNhan18(m.thay), 'Đã chốt theo thầy · nhãn vàng'); };
  const khongRo = () => { if (!m) return; if (kn === 'K4') guiLuu('/mau-doan/' + id + '/loi', { nghe_sai: true }, 'Đã đánh dấu nghe sai'); else if (kn === 'K1') guiLuu('/mau-doan/' + id, { khong_ro: true }, 'Đã đánh dấu hình không rõ — không thành mẫu dạy'); };
  const [nhomPhim, setNhomPhim] = useState(null);
  useEffect(() => { const f = (e) => { if (/INPUT|SELECT|TEXTAREA/.test((e.target && e.target.tagName) || '') || e.ctrlKey || e.metaKey || e.altKey || !m) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); ke(1); } else if (e.key === 'ArrowLeft') { e.preventDefault(); ke(-1); }
      else if (e.key === 'Enter' && kn !== 'K2') { e.preventDefault(); dungHet(); } else if (e.key === '0') { e.preventDefault(); khongRo(); }
      else if (/^[1-8]$/.test(e.key) && kn === 'K1') setNhomPhim({ id: m.id, nhom: NHOM_HINH[+e.key - 1].k, t: Date.now() }); };
    window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f); });
  const datDong = async (ids, dongMoi) => { setBusy(true); const r = await goi('/mau-doan/dat-dong', { method: 'POST', body: { ids, dong: dongMoi } }); setBusy(false); if (r.ok) { notify('Đã gán dòng “' + dongMoi + '” cho ' + r.so_video + ' video · ' + r.so_mau + ' mẫu'); setTick(new Set()); onDoi && onDoi(); tai(true); } else notify(r.msg, 'err'); };
  const hangLoat = async (body, bao) => { setBusy(true); const r = await goi('/mau-doan/hang-loat', { method: 'POST', body: { ids: [...tick], ...body } }); setBusy(false); if (r.ok) { notify(bao(r.so) + (r.bo ? ' · ' + r.bo + ' mẫu bỏ qua (vừa có người sửa)' : '')); setTick(new Set()); onDoi && onDoi(); tai(true); } else notify(r.msg, 'err'); };
  const dem = (kq && kq.dem) || {}; const tong = (kq && kq.tong) || 0;
  const chiTiet = m ? (kn === 'K2' ? <ChiTietK2 key={m.id} m={m} nguong={kq && kq.nguong} busy={busy} guiLuu={(b, bao) => guiLuu('/mau-doan/' + id + '/source', b, bao)} ke={ke} />
    : kn === 'K4' ? <ChiTietK4 key={m.id} m={m} bn={bn} dongs={(kq && kq.dongs) || []} onDong={(d) => datDong([m.id], d)} busy={busy} guiLuu={(b, bao) => guiLuu('/mau-doan/' + id + '/loi', b, bao)} dungHet={dungHet} khongRo={khongRo} ke={ke} />
    : <ChiTietK1 key={m.id} m={m} bn={bn} dongs={(kq && kq.dongs) || []} onDong={(d) => datDong([m.id], d)} busy={busy} luu={luuHinh} guiTach={(phan) => guiLuu('/mau-doan/' + id, { phan }, 'Đã lưu ' + phan.length + ' khung · ' + phan.length + ' nhãn vàng')} dungHet={dungHet} khongRo={khongRo} ke={ke} nhomPhim={nhomPhim && nhomPhim.id === m.id ? nhomPhim : null} />) : null;
  const dongMau = (x) => { const t = x.tt; const tieuDe = kn === 'K4' ? '“' + (x.text || '') + '”' : kn === 'K2' ? x.ten : ((x.nguoi && x.nguoi.mo_ta) || (x.thay && x.thay.mo_ta) || (x.mo && x.mo.mo_ta) || x.mo_ta || '—');
    return <div key={x.id}>
      <div onClick={() => setChon(chon === x.id && !rong ? null : x.id)} title={x.ten + ' · đoạn ' + ((x.i || 0) + 1) + ' · giây ' + x.tu + '–' + x.den + (x.dong ? ' · ' + x.dong : '') + ' · ' + ((TT18[t] || {}).ten || '')} className={'grid grid-cols-[16px_56px_minmax(0,1fr)_10px] gap-2 items-center px-2 py-2 min-h-[54px] border-t border-[#EEF3F4] first:border-t-0 cursor-pointer ' + (chon === x.id ? 'bg-[#EEF7F8] shadow-[inset_3px_0_0_#0E7C8C]' : 'hover:bg-[#F7FAFB]')}>
        <input type="checkbox" checked={tick.has(x.id)} onClick={(e) => e.stopPropagation()} onChange={(e) => { const s = new Set(tick); e.target.checked ? s.add(x.id) : s.delete(x.id); setTick(s); }} disabled={kn !== 'K1'} />
        <div className="rounded-md aspect-video bg-slate-700 overflow-hidden">{x.khung_url ? <img src={x.khung_url} alt="" loading="lazy" className="w-full h-full object-cover" /> : null}</div>
        <div className="min-w-0 text-[13px] leading-[1.3] text-ink break-words" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{tieuDe}</div>
        <span className={'w-2.5 h-2.5 rounded-full ' + (CHAM18[t] || 'bg-slate-300')} /></div>
      {!rong && chon === x.id && <div className="p-2 bg-[#F5FAFB]">{chiTiet}</div>}
    </div>; };
  return <Card pad="p-3" className="flex flex-col gap-3 !rounded-[14px] !shadow-none">
    <div className="flex items-center gap-2 flex-wrap"><span className="font-bold text-sm text-ink">Kho mẫu</span><span className="text-xs text-ink-muted">chỗ làm việc của người: thầy và mô hình mở gán, anh/chị cân chỉnh</span>
      <label className="ml-auto flex items-center gap-1.5 text-xs cursor-pointer"><input type="checkbox" checked={tuanTu} onChange={(e) => { setTuanTu(e.target.checked); if (e.target.checked && tt !== 'CAN') setTt('CAN'); }} /> Duyệt tuần tự</label></div>
    {kn === 'K1' && <BaoThay onDoi={() => tai(true)} />}
    <Tabs size="sm" active={kn} onChange={(k) => { setKn(k); setTt('CAN'); setTick(new Set()); setTrang(1); }} tabs={[{ key: 'K1', label: 'Khung hình' }, { key: 'K4', label: 'Câu thoại' }, { key: 'K2', label: 'Footage chất lượng' }]} />
    <div className="flex items-center gap-2 flex-wrap">
      <button onClick={() => { setTt('CAN'); setTrang(1); }} className={'rounded-full border px-2.5 py-0.5 text-xs font-bold ' + (tt === 'CAN' ? 'border-ink' : 'border-line bg-white')}>⚑ Cần người · {kq ? kq.can : '…'}</button>
      <button onClick={() => { setTt(''); setTrang(1); }} className={'rounded-full border px-2.5 py-0.5 text-xs ' + (!tt ? 'border-ink font-bold' : 'border-line bg-white')}>Tất cả · {kq ? tong : '…'}</button>
      {Object.keys(TT18).filter((k) => dem[k]).map((k) => <button key={k} onClick={() => { setTt(k); setTrang(1); }} className={'rounded-full border px-2.5 py-0.5 text-xs bg-white ' + (tt === k ? 'border-ink font-bold' : 'border-line')}><Pill cls={TT18[k].cls} className="!text-[11px]">{TT18[k].ten}</Pill> {dem[k]}</button>)}
      <input className="ml-auto border border-line rounded-lg px-2 py-1 text-xs w-44 min-w-0" placeholder="tìm mô tả, câu, nhãn…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { setTrang(1); tai(false); } }} />
      <select className="border border-line rounded-lg px-2 py-1 text-xs bg-white min-w-0" value={dong} onChange={(e) => { setDong(e.target.value); setTrang(1); }}><option value="">mọi dòng</option>{((kq && kq.dongs) || []).map((d) => { const ct = ((kq && kq.dong_ct) || []).find((x) => x.dong === d); return <option key={d} value={d}>{d}{ct && ct.mo_ta ? ' — ' + ct.mo_ta.split(' · ')[0] : ''}</option>; })}</select>
      <button className={nutCls + (soLoc ? ' !border-ink' : '')} onClick={() => setMoLoc(!moLoc)}>⚙ Lọc thêm{soLoc ? ' · ' + soLoc : ''}</button></div>
    {(moLoc || soLoc > 0) && <BoLocSau loc={loc} setLoc={(o) => { setLoc(o); setTrang(1); }} bn={bn} kq={kq} dong={dong} kn={kn} mo={moLoc} />}
    {tuanTu && <div className="rounded-[14px] border border-line bg-[#F5FAFB] p-3 text-xs">Đang duyệt tuần tự <b>{vt + 1}/{ds.length}</b> mẫu {tt === 'CAN' ? '“Cần người”' : tt ? '“' + ((TT18[tt] || {}).ten || tt) + '”' : ''}. Phím: <kbd className="font-mono text-[11px] border border-line border-b-2 rounded px-1 bg-white">Enter</kbd> đúng hết theo thầy · <kbd className="font-mono text-[11px] border border-line border-b-2 rounded px-1 bg-white">1</kbd>–<kbd className="font-mono text-[11px] border border-line border-b-2 rounded px-1 bg-white">8</kbd> đổi nhóm cảnh · <kbd className="font-mono text-[11px] border border-line border-b-2 rounded px-1 bg-white">0</kbd> không rõ · <kbd className="font-mono text-[11px] border border-line border-b-2 rounded px-1 bg-white">→</kbd> mẫu kế · <kbd className="font-mono text-[11px] border border-line border-b-2 rounded px-1 bg-white">←</kbd> mẫu trước.</div>}
    <div className="grid gap-3 items-start min-[900px]:grid-cols-[320px_minmax(0,1fr)]">
      <div className="min-w-0">
        <div className="border border-line rounded-xl overflow-hidden bg-white">{!kq ? <div className="p-4 text-ink-muted text-sm">Đang tải…</div> : ds.length ? ds.map(dongMau) : <div className="p-4 text-ink-muted text-sm">{tt === 'CAN' ? 'Không còn mẫu nào cần người — thầy đã chốt hết.' : 'Không có mẫu nào.'}</div>}</div>
        {kq && kq.so_trang > 1 && <div className="flex gap-1 justify-end mt-2 items-center text-[11px] text-ink-muted">trang {kq.trang}/{kq.so_trang}<button className={nutCls} disabled={trang <= 1} onClick={() => setTrang(trang - 1)}>← Trước</button><button className={nutCls} disabled={trang >= kq.so_trang} onClick={() => setTrang(trang + 1)}>Sau →</button></div>}
        {tick.size > 0 && <ThanhHangLoat bn={bn} dongs={((kq && kq.dongs) || []).filter((d) => d !== '(chưa có)')} n={tick.size} busy={busy} onThay={() => hangLoat({ lay_thay: true }, (n) => 'Đã chấp nhận nhãn thầy cho ' + n + ' mẫu')} onDat={(f, v) => f === 'dong' ? datDong([...tick], v) : hangLoat({ truong: f, gia_tri: v }, (n) => 'Đã đặt ' + (TRUONG18.find((x) => x.k === f) || {}).ten + ' = ' + v + ' cho ' + n + ' mẫu')} onBo={() => setTick(new Set())} />}
      </div>
      {rong && <div className="min-w-0">{chiTiet || <Card pad="p-3" className="!shadow-none text-ink-muted text-sm">Bấm một mẫu để xem và sửa.</Card>}</div>}
    </div>
  </Card>;
}
function ThanhHangLoat({ bn, dongs, n, busy, onThay, onDat, onBo }) {
  const [f, setF] = useState('dong'); const gt = f === 'dong' ? (dongs || []) : giaTri18(bn, f, null); const [v, setV] = useState(''); useEffect(() => { setV(gt[0] || ''); }, [f, bn]);
  return <div className="sticky bottom-0 bg-[#0F2A33] text-white rounded-xl px-2.5 py-2 flex gap-2 items-center flex-wrap mt-2 text-xs z-10">
    <b>{n} mẫu đã chọn</b><button className={nutCls + ' text-ink'} disabled={busy} onClick={onThay}>Chấp nhận nhãn thầy cho cả {n}</button><span className="text-[11px]">hoặc đặt</span>
    <select className="border border-line rounded-lg px-2 py-1 bg-white text-ink min-w-0" value={f} onChange={(e) => setF(e.target.value)}><option value="dong">Dòng sản phẩm (cả video)</option>{TRUONG18.filter((x) => !['mo_ta', 'tham_my', 'nhom'].includes(x.k)).map((x) => <option key={x.k} value={x.k}>{x.ten}</option>)}</select><span>=</span>
    <select className="border border-line rounded-lg px-2 py-1 bg-white text-ink min-w-0 max-w-[160px]" value={v} onChange={(e) => setV(e.target.value)}>{gt.map((x) => <option key={x} value={x}>{tenGt18(bn, f, x)}</option>)}</select>
    <button className={nutCls + ' !bg-[#0E7C8C] !border-[#0E7C8C] text-white'} disabled={busy || !v} onClick={() => onDat(f, v)}>Áp dụng</button><button className={nutCls + ' text-ink'} onClick={onBo}>Bỏ chọn</button></div>;
}
// phát đúng đoạn [tu, den] của video (bản xem 360p của video đã đăng / footage gốc) ngay trong khung mẫu; tới cuối đoạn thì dừng, bấm phát lại từ đầu đoạn
function XemDoan({ url, tu, den, poster, tuPhat, cao }) {
  const v = useRef(null); const [loi, setLoi] = useState(false); const tu0 = Math.max(0, (+tu || 0) - 0.3), den0 = (+den || 0) + 0.3;
  useEffect(() => { const e = v.current; if (!e) return; const bat = () => { try { e.currentTime = tu0; } catch (x) {} if (tuPhat) e.play().catch(() => {}); }; if (e.readyState >= 1) bat(); else e.addEventListener('loadedmetadata', bat, { once: true }); }, [url, tu]);
  return <div className={'rounded-xl overflow-hidden bg-black ' + (cao || 'aspect-video')}>{loi ? <div className="h-full flex items-center justify-center text-white/70 text-xs p-3 text-center">Không phát được video này</div>
    : <video ref={v} src={url} poster={poster || undefined} controls playsInline preload="metadata" className="w-full h-full object-contain" onError={() => setLoi(true)}
      onPlay={(e) => { if (e.target.currentTime >= den0 - 0.05 || e.target.currentTime < tu0 - 0.5) e.target.currentTime = tu0; }} onTimeUpdate={(e) => { if (e.target.currentTime >= den0 && !e.target.paused) e.target.pause(); }} />}</div>;
}
// dòng nằm ở video: đổi một lần là mọi đoạn / câu của video đổi theo (61% đoạn chưa có dòng — 26/09)
function DongVideo({ m, dongs, onDong, busy }) {
  const [d, setD] = useState(m.dong || ''); useEffect(() => { setD(m.dong || ''); }, [m.id, m.dong]); const ds = (dongs || []).filter((x) => x !== '(chưa có)');
  return <div className={'flex items-center gap-2 flex-wrap text-xs rounded-lg px-2 py-1.5 ' + (m.dong ? 'bg-[#F5F8F9]' : 'bg-[#FFF9E8]')}><span className={m.dong ? 'text-ink-muted' : 'text-[#8A6410] font-semibold'}>{m.dong ? 'Dòng của video:' : 'Video chưa có dòng — thầy không biết dùng quy trình nào:'}</span>
    <select className="border border-line rounded-lg px-2 py-0.5 text-xs bg-white min-w-0" value={d} onChange={(e) => setD(e.target.value)}><option value="">— chọn dòng —</option>{ds.map((x) => <option key={x} value={x}>{x}</option>)}</select>
    {d && d !== (m.dong || '') && <button className={nutCls + ' !py-0.5 !bg-[#0E7C8C] !border-[#0E7C8C] text-white'} disabled={busy} onClick={() => onDong(d)}>Gán cho cả video</button>}</div>;
}
// lọc sâu: nhóm cảnh, bước, một trường = giá trị, thiếu trường, nguồn, video, độ chắc của thầy, học trò lệch thầy
function BoLocSau({ loc, setLoc, bn, kq, dong, kn, mo }) {
  const dat = (k, v) => setLoc({ ...loc, [k]: v }); const cls = 'border border-line rounded-lg px-2 py-1 text-xs bg-white min-w-0 max-w-[200px]';
  const buocDs = [...new Set(((bn && bn.gia_tri) || []).filter((x) => x.truong === 'buoc' && (!dong || dong === '(chưa có)' || x.dong === dong)).map((x) => x.ten))];
  const TRL = TRUONG18.filter((x) => !['nhom', 'buoc', 'mo_ta', 'tham_my'].includes(x.k));
  const nhan = { nhom: (v) => 'nhóm: ' + tenNhom(v), buoc: (v) => 'bước: ' + v, f: () => null, v: () => (TRUONG18.find((x) => x.k === loc.f) || {}).ten + ' = ' + tenGt18(bn, loc.f, loc.v), thieu: (v) => 'thiếu ' + ((TRUONG18.find((x) => x.k === v) || {}).ten || v).toLowerCase(), nguon: (v) => v === 'FOOTAGE' ? 'footage' : 'video đã đăng', video: (v) => 'video: ' + (((kq && kq.videos) || []).find((x) => x.id === v) || { ten: v }).ten, chac_duoi: (v) => 'thầy chắc < ' + v, lech: () => 'học trò lệch thầy' };
  const chip = Object.entries(loc).filter(([k, v]) => v !== '' && v != null && v !== false && nhan[k] && nhan[k](v));
  return <div className="flex flex-col gap-2">
    {mo && <div className="rounded-xl border border-line bg-[#F7FAFB] p-2 flex gap-2 flex-wrap items-center text-xs">
      {kn !== 'K2' && <select className={cls} value={loc.nhom || ''} onChange={(e) => dat('nhom', e.target.value)}><option value="">nhóm cảnh: tất cả</option>{NHOM_HINH.map((n) => <option key={n.k} value={n.k}>{n.ten}</option>)}</select>}
      {kn !== 'K2' && <select className={cls} value={loc.buoc || ''} onChange={(e) => dat('buoc', e.target.value)}><option value="">bước: tất cả</option><option value="(trống)">(chưa có bước)</option>{buocDs.map((b) => <option key={b} value={b}>{b}</option>)}</select>}
      {kn === 'K1' && <><select className={cls} value={loc.f || ''} onChange={(e) => setLoc({ ...loc, f: e.target.value, v: '' })}><option value="">trường…</option>{TRL.map((t) => <option key={t.k} value={t.k}>{t.ten}</option>)}</select>
        {loc.f && <select className={cls} value={loc.v || ''} onChange={(e) => dat('v', e.target.value)}><option value="">= giá trị…</option>{giaTri18(bn, loc.f, dong && dong !== '(chưa có)' ? dong : null).map((x) => <option key={x} value={x}>{tenGt18(bn, loc.f, x)}</option>)}</select>}
        <select className={cls} value={loc.thieu || ''} onChange={(e) => dat('thieu', e.target.value)}><option value="">thiếu trường…</option>{TRUONG18.filter((x) => !['nhom', 'mo_ta'].includes(x.k)).map((t) => <option key={t.k} value={t.k}>thiếu {t.ten.toLowerCase()}</option>)}</select></>}
      {kn === 'K1' && <select className={cls} value={loc.nguon || ''} onChange={(e) => dat('nguon', e.target.value)}><option value="">nguồn: tất cả</option><option value="THANH_PHAM">video đã đăng</option><option value="FOOTAGE">footage</option></select>}
      <select className={cls} value={loc.video || ''} onChange={(e) => dat('video', e.target.value)}><option value="">video: tất cả</option>{((kq && kq.videos) || []).map((v) => <option key={v.id} value={v.id}>{(v.ten || v.id).slice(0, 40)} · {v.n}{v.dong ? '' : ' · chưa có dòng'}</option>)}</select>
      {kn !== 'K2' && <select className={cls} value={loc.chac_duoi || ''} onChange={(e) => dat('chac_duoi', e.target.value)}><option value="">thầy chắc: mọi mức</option>{['0.5', '0.7', '0.9'].map((x) => <option key={x} value={x}>thầy chắc dưới {x.replace('.', ',')}</option>)}</select>}
      {kn === 'K1' && <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={!!loc.lech} onChange={(e) => dat('lech', e.target.checked)} /> học trò lệch thầy</label>}
    </div>}
    {chip.length > 0 && <div className="flex gap-1.5 flex-wrap items-center text-xs"><span className="text-ink-muted">Đang lọc:</span>{chip.map(([k, v]) => <button key={k} onClick={() => setLoc(k === 'f' || k === 'v' ? { ...loc, f: '', v: '' } : { ...loc, [k]: '' })} className="rounded-full bg-[#E0F2F4] text-[#0E7C8C] px-2 py-0.5 font-semibold">{nhan[k](v)} ×</button>)}<button className="underline text-ink-muted" onClick={() => setLoc({})}>xoá lọc</button></div>}
  </div>;
}
function AnhDoan({ url, lon, onDai }) {
  return <div className={'rounded-xl overflow-hidden bg-slate-800 ' + (lon ? 'aspect-[16/5.5]' : 'aspect-video')}>{url ? <img src={url} alt="" className="w-full h-full object-contain" onLoad={(e) => onDai && onDai(e.target.naturalWidth / Math.max(1, e.target.naturalHeight) > 2.4)} /> : <div className="h-full flex items-center justify-center text-white/60 text-xs">chưa có ảnh đoạn</div>}</div>;
}
function LyDoHoi({ m }) {
  if (m.tt === 'KIEM') return <div className="text-xs bg-[#E3EEFA] text-[#1F5FA8] rounded-lg px-2.5 py-1.5">Mẫu <b>kiểm ngẫu nhiên</b>: thầy đã chốt, anh/chị xem để đo thầy đúng bao nhiêu. Đúng thì Enter.</div>;
  if (m.tt === 'KHONG_CHAC') return <div className="text-xs bg-[#FBE4E1] text-[#A3372B] rounded-lg px-2.5 py-1.5"><b>Thầy chưa chắc</b> (chắc {m.thay && m.thay.chac}) sau khi tự xem lại{m.thay && m.thay.ly_do ? ': ' + m.thay.ly_do : ''}</div>;
  if (m.tt === 'THAY_CHOT') return <div className="text-xs text-ink-muted">Thầy đã chốt (chắc {m.thay && m.thay.chac}). Không cần anh/chị xem; chỉ sửa nếu thấy sai.</div>;
  return null;
}
function OSua({ f, v, setV, bn, dong }) {
  const [moi, setMoi] = useState(false); const val = v[f.k]; const cls = 'border border-line rounded-lg px-2 py-1 text-xs bg-white min-w-0';
  if (f.k === 'mo_ta') return <input className={cls + ' w-full'} value={val || ''} onChange={(e) => setV({ ...v, mo_ta: e.target.value })} />;
  if (f.k === 'tham_my') return <select className={cls} value={val == null ? '' : val} onChange={(e) => setV({ ...v, tham_my: e.target.value === '' ? null : +e.target.value })}><option value="">—</option>{[...Array(11).keys()].map((i) => <option key={i} value={i}>{i}</option>)}</select>;
  if (f.k === 'nhom') return <select className={cls} value={val || ''} onChange={(e) => setV({ ...v, nhom: e.target.value })}>{NHOM_HINH.map((n) => <option key={n.k} value={n.k}>{n.ten}</option>)}</select>;
  const ds = giaTri18(bn, f.k, f.k === 'buoc' || f.k === 'bai_test' || f.k === 'vat_lieu' ? dong : null);
  if (f.nhieu) { const cur = Array.isArray(val) ? val : val ? [val] : []; const all = [...new Set([...cur, ...ds])];
    return <div className="flex flex-wrap gap-1 items-center">{all.map((x) => { const on = cur.includes(x); return <button key={x} type="button" onClick={() => setV({ ...v, [f.k]: on ? cur.filter((y) => y !== x) : [...cur, x] })} className={'rounded-full border px-2 py-px text-[11px] ' + (on ? 'border-ink font-bold bg-white' : 'border-line bg-white text-ink-muted')}><HienGt bn={bn} f={f.k} v={x} /></button>; })}
      <input className={cls + ' w-[90px]'} placeholder="＋ khác" onKeyDown={(e) => { const t = e.target.value.trim(); if (e.key === 'Enter' && t) { setV({ ...v, [f.k]: [...new Set([...cur, t])] }); e.target.value = ''; } }} onBlur={(e) => { const t = e.target.value.trim(); if (t) { setV({ ...v, [f.k]: [...new Set([...cur, t])] }); e.target.value = ''; } }} /></div>; }
  return <div><select className={cls + ' max-w-full'} value={val || ''} onChange={(e) => { if (e.target.value === '__moi') return setMoi(true); setV({ ...v, [f.k]: e.target.value || null }); }}><option value="">—</option>{[...new Set([...(val ? [val] : []), ...ds])].map((x) => <option key={x} value={x}>{tenGt18(bn, f.k, x)}</option>)}{f.kieu !== 'CO_DINH' && <option value="__moi">＋ giá trị khác…</option>}</select>
    {moi && <input autoFocus className={cls + ' w-full mt-1'} placeholder="tên nhãn mới rồi Enter" onKeyDown={(e) => { const t = e.target.value.trim(); if (e.key === 'Enter') { if (t) setV({ ...v, [f.k]: t }); setMoi(false); } if (e.key === 'Escape') setMoi(false); }} />}</div>;
}
function ChiTietK1({ m, bn, dongs, onDong, busy, luu, guiTach, dungHet, khongRo, ke, nhomPhim }) {
  const goc = sachNhan18(m.nguoi && !m.nguoi.khong_ro ? m.nguoi : m.thay || m.mo || { nhom: 'KHAC' });
  const [v, setV] = useState(goc); const [dai, setDai] = useState(false); const [tach, setTach] = useState(null); const pc = useRong(640); const [xem, setXem] = useState(false);
  useEffect(() => { if (nhomPhim) setV((o) => ({ ...o, nhom: nhomPhim.nhom })); }, [nhomPhim && nhomPhim.t]);
  const hien = TRUONG18.filter((f) => !f.khi || [v.nhom, m.thay && m.thay.nhom, m.mo && m.mo.nhom].includes(f.khi));
  const th = m.thay || {}; const mo = m.mo || {};
  return <Card pad="p-3" className="flex flex-col gap-3 !rounded-[14px] !shadow-none">
    {tach ? <><div className="grid grid-cols-3 gap-1">{[0, 1, 2].map((k) => <div key={k} className="min-w-0"><KhungCat url={m.khung_url} k={k} />
        <select className="border border-line rounded-lg px-1 py-1 text-xs bg-white w-full mt-1" value={tach[k].nhom} onChange={(e) => setTach(tach.map((y, j) => j === k ? { ...y, nhom: e.target.value } : y))}>{NHOM_HINH.map((n) => <option key={n.k} value={n.k}>{n.ten}</option>)}</select>
        <select className="border border-line rounded-lg px-1 py-1 text-xs bg-white w-full mt-1" value={tach[k].buoc || ''} onChange={(e) => setTach(tach.map((y, j) => j === k ? { ...y, buoc: e.target.value || null } : y))}><option value="">(bước)</option>{giaTri18(bn, 'buoc', m.dong).map((b) => <option key={b} value={b}>{b}</option>)}</select>
        <select className="border border-line rounded-lg px-1 py-1 text-xs bg-white w-full mt-1" value={(tach[k].dung_cu || [])[0] || ''} onChange={(e) => setTach(tach.map((y, j) => j === k ? { ...y, dung_cu: e.target.value ? [e.target.value] : [] } : y))}><option value="">(dụng cụ)</option>{giaTri18(bn, 'dung_cu').map((b) => <option key={b} value={b}>{b}</option>)}</select></div>)}</div>
      <div className="flex gap-2 items-center flex-wrap"><button className={nutCls + ' !bg-[#0E7C8C] !border-[#0E7C8C] text-white'} disabled={busy} onClick={() => guiTach(tach)}>Lưu 3 khung</button><button className={nutCls} onClick={() => setTach(null)}>Huỷ</button><span className="text-[11px] text-ink-muted">nhãn cả đoạn = nhóm/bước nhiều nhất; mỗi khung là một nhãn vàng riêng</span></div></>
      : <>{xem ? <XemDoan url={m.media_url} tu={m.tu} den={m.den} poster={m.khung_url} tuPhat cao="aspect-[16/7]" /> : <AnhDoan url={m.khung_url} lon onDai={setDai} />}
        <div className="flex gap-2 items-center flex-wrap">{m.media_url ? <button className={nutCls + (xem ? '' : ' !bg-[#0E7C8C] !border-[#0E7C8C] text-white')} onClick={() => setXem(!xem)}>{xem ? '🖼 Xem ảnh dải' : '▶ Xem đoạn video (giây ' + m.tu + '–' + m.den + ')'}</button> : <span className="text-[11px] text-ink-muted">chưa có bản xem video — máy Q2 đang tạo</span>}</div>
        {dai && !xem && <div className="flex gap-2 items-center flex-wrap"><button className={nutCls} onClick={() => setTach([0, 1, 2].map(() => ({ nhom: v.nhom, buoc: v.buoc || null, dung_cu: [] })))}>✂ Ba khung khác nội dung? Gán từng khung</button><span className="text-[11px] text-ink-muted">dải 3 khung liên tiếp, cách 0,5 giây</span></div>}</>}
    <LyDoHoi m={m} />
    <DongVideo m={m} dongs={dongs} onDong={onDong} busy={busy} />
    <div className="text-[11px] text-ink-muted">{m.ten}{m.nguon === 'THANH_PHAM' ? ' · video đã đăng' : ' · footage'} · đoạn {(m.i || 0) + 1} · giây {m.tu}–{m.den}{m.dong ? ' · ' + m.dong : ''}{th.ly_do ? <> · <span className="text-[#1F5FA8]">thầy: {th.ly_do} (chắc {th.chac})</span></> : null}{m.link ? <> · <a className="underline" href={m.link} target="_blank" rel="noreferrer">mở bài đăng</a></> : null}</div>
    {!pc ? <div className="flex flex-col divide-y divide-[#EEF3F4] border border-[#EEF3F4] rounded-xl">{hien.map((f) => { const a = mo[f.k], b = th[f.k]; const lech = !giong18(a, b) && (a != null || b != null) && f.k !== 'mo_ta'; const doi = !giong18(v[f.k], b);   /* điện thoại: từng trường xếp dọc, ô sửa rộng hết màn */
        return <div key={f.k} className={'px-2 py-2 text-xs ' + (doi ? 'bg-[#FFFBEA]' : '')}><div className="flex items-center gap-2"><b>{f.ten}</b>{b != null && doi ? <button className={nutCls + ' !px-1.5 !py-0.5 ml-auto'} onClick={() => setV({ ...v, [f.k]: JSON.parse(JSON.stringify(b)) })}>↩ thầy</button> : null}</div>
          <div className={'text-[11px] my-1 rounded px-1 ' + (lech ? 'bg-[#FFF6F4]' : '')}><span className="text-ink-muted">mở: </span><HienGt bn={bn} f={f.k} v={a} /><span className="text-ink-muted"> · thầy: </span><HienGt bn={bn} f={f.k} v={b} /></div><OSua f={f} v={v} setV={setV} bn={bn} dong={m.dong} /></div>; })}</div>
    : <div className="overflow-x-auto"><table className="w-full border-collapse text-xs min-w-[560px]"><thead><tr className="text-left">{['Trường', 'Mô hình mở (học trò)', 'Thầy (chốt)', 'Người (kiểm)', ''].map((h, i) => <th key={i} className="text-[10px] tracking-[.06em] uppercase text-ink-muted bg-[#F5F8F9] px-2 py-1.5 font-bold">{h}</th>)}</tr></thead>
      <tbody>{hien.map((f) => { const a = mo[f.k], b = th[f.k]; const lech = !giong18(a, b) && (a != null || b != null) && f.k !== 'mo_ta'; const doi = !giong18(v[f.k], b);
        return <tr key={f.k}><td className="border-t border-[#EEF3F4] px-2 py-1.5 align-middle"><b>{f.ten}</b><div className="text-[11px] text-ink-muted">{f.nhom}</div></td>
          <td className={'border-t border-[#EEF3F4] px-2 py-1.5 ' + (lech ? 'bg-[#FFF6F4]' : '')}><HienGt bn={bn} f={f.k} v={a} /></td><td className={'border-t border-[#EEF3F4] px-2 py-1.5 ' + (lech ? 'bg-[#FFF6F4]' : '')}><HienGt bn={bn} f={f.k} v={b} /></td>
          <td className={'border-t border-[#EEF3F4] px-2 py-1.5 ' + (doi ? 'bg-[#FFFBEA]' : '')}><OSua f={f} v={v} setV={setV} bn={bn} dong={m.dong} /></td>
          <td className="border-t border-[#EEF3F4] px-2 py-1.5">{b != null && doi ? <button className={nutCls + ' !px-1.5 !py-0.5'} title="lấy giá trị của thầy" onClick={() => setV({ ...v, [f.k]: JSON.parse(JSON.stringify(b)) })}>↩ thầy</button> : null}</td></tr>; })}</tbody></table></div>}
    <div className="flex gap-2 flex-wrap"><button className={nutCls + ' !bg-[#15803D] !border-[#15803D] text-white'} disabled={busy || !m.thay} onClick={dungHet}><Kbd>Enter</Kbd>Đúng hết theo thầy</button>
      <button className={nutCls + ' !bg-[#0E7C8C] !border-[#0E7C8C] text-white'} disabled={busy} onClick={() => luu(v)}>Lưu nhãn người</button><button className={nutCls} disabled={busy} onClick={khongRo}><Kbd>0</Kbd>Hình không rõ</button><button className={nutCls} onClick={() => ke(1)}><Kbd>→</Kbd>Mẫu kế</button></div>
    {m.nguoi && m.nguoi.ai && <div className="text-[11px] text-ink-muted">Người đã chốt: {m.nguoi.ai}{m.nguoi.luc ? ' · ' + fmtDate(m.nguoi.luc) : ''}. Sửa và lưu lại sẽ thay nhãn cũ (máy vẫn so với nhãn gốc của nó).{m.nguoi.phan ? ' Đã gán từng khung: ' + m.nguoi.phan.filter(Boolean).map((p) => 'khung ' + (p.k + 1) + ' ' + nhan18(p)).join(' · ') : ''}</div>}
    <div className="text-[11px] text-ink-muted">Ô vàng = anh/chị đổi khác thầy. Gõ giá trị chưa có trong bộ nhãn thì thành <span className="border border-dashed border-[#E3B23C] bg-[#FFF9E8] rounded-md px-1">đề xuất</span>, chờ duyệt ở tab Bộ nhãn.</div>
  </Card>;
}
function ChiTietK4({ m, bn, dongs, onDong, busy, guiLuu, dungHet, khongRo, ke }) {
  const th = m.thay || {}; const hinh = m.hinh || {}; const goc = m.nguoi && !m.nguoi.nghe_sai ? m.nguoi : th;
  const [v, setV] = useState({ nhom: goc.nhom || hinh.nhom || 'KHAC', buoc: goc.buoc || null, text: m.text || '' }); const [khop, setKhop] = useState(null); const [moi, setMoi] = useState(false);
  const au = useRef(null); const [phat, setPhat] = useState(false); const [tien, setTien] = useState(0); const [xemV, setXemV] = useState(false);
  const cot = useMemo(() => [...Array(48)].map((_, i) => 20 + Math.abs(Math.sin(i * 1.7 + (m.i || 0))) * 80), [m.id]);
  const khopHinh = khop == null ? hinh.nhom === v.nhom : khop; const ds = giaTri18(bn, 'buoc', m.dong);
  const cls = 'border border-line rounded-lg px-2 py-1 text-xs bg-white min-w-0';
  return <Card pad="p-3" className="flex flex-col gap-3 !rounded-[14px] !shadow-none">
    <div className="flex gap-2.5 items-stretch flex-wrap"><div className={(xemV ? 'w-[240px]' : 'w-[130px]') + ' flex-none'}>{xemV ? <XemDoan url={m.media_url} tu={m.tu} den={m.den} poster={m.khung_url} tuPhat /> : <AnhDoan url={m.khung_url} />}<div className="text-[11px] text-ink-muted mt-1">{xemV ? 'đoạn video lúc câu chạy' : 'khung lúc câu chạy'}</div></div>
      <div className="flex-1 min-w-[200px]"><div className="flex items-center gap-1.5 flex-wrap"><button className={nutCls + ' !bg-[#0E7C8C] !border-[#0E7C8C] text-white !px-2.5 !py-1'} disabled={!m.am_url && !m.media_url} onClick={() => { if (!m.am_url) return setXemV(!xemV); const a = au.current; if (!a) return; if (a.paused) { a.play(); } else a.pause(); }}>{phat || xemV ? '⏸' : '▶'} {m.am_url ? 'Nghe đoạn trích' : 'Nghe + xem đoạn'}</button>
        <span className="text-[11px] text-ink-muted">giây {m.tu}–{m.den}{m.am_url || m.media_url ? '' : ' · chưa có bản nghe — máy Q2 đang tạo'}{m.link ? <> · <a className="underline" href={m.link} target="_blank" rel="noreferrer">mở bài đăng</a></> : null}</span></div>
        {m.am_url && <audio ref={au} src={m.am_url} preload="none" onPlay={() => setPhat(true)} onPause={() => setPhat(false)} onEnded={() => { setPhat(false); setTien(0); }} onTimeUpdate={(e) => setTien(e.target.currentTime / Math.max(0.1, e.target.duration || 1))} />}
        <div className="flex items-end gap-[2px] h-[34px] mt-1.5">{cot.map((h, i) => <i key={i} className={'flex-1 rounded-sm ' + (phat && i / 48 < tien ? 'bg-[#0E7C8C]' : 'bg-[#BFD7DC]')} style={{ height: h + '%' }} />)}</div></div></div>
    {m.cau_truoc && <div className="px-2 py-1.5 rounded-lg text-xs text-ink-muted">… {m.cau_truoc}</div>}
    <div className="px-2 py-1.5 rounded-lg bg-[#EEF7F8] border border-[#CFE7EA]"><div className="text-[11px] text-ink-muted">Câu máy chép (sửa được nếu nghe sai chữ)</div><input className={cls + ' w-full !text-sm'} value={v.text} onChange={(e) => setV({ ...v, text: e.target.value })} /></div>
    {m.cau_sau && <div className="px-2 py-1.5 rounded-lg text-xs text-ink-muted">{m.cau_sau} …</div>}
    <LyDoHoi m={m} />
    <DongVideo m={m} dongs={dongs} onDong={onDong} busy={busy} />
    <div className="overflow-x-auto"><table className="w-full border-collapse text-xs min-w-[480px]"><thead><tr className="text-left">{['Trường', 'Hình lúc câu chạy', 'Thầy đọc câu', 'Người (chốt)'].map((h) => <th key={h} className="text-[10px] tracking-[.06em] uppercase text-ink-muted bg-[#F5F8F9] px-2 py-1.5 font-bold">{h}</th>)}</tr></thead><tbody>
      <tr><td className="border-t border-[#EEF3F4] px-2 py-1.5"><b>Câu nói về</b></td><td className={'border-t border-[#EEF3F4] px-2 py-1.5 ' + (hinh.nhom !== th.nhom ? 'bg-[#FFF6F4]' : '')}>{tenNhom(hinh.nhom)}</td><td className={'border-t border-[#EEF3F4] px-2 py-1.5 ' + (hinh.nhom !== th.nhom ? 'bg-[#FFF6F4]' : '')}>{th.nhom ? tenNhom(th.nhom) : '—'}{th.nghe_sai ? ' · thầy báo nghe sai' : ''}</td>
        <td className="border-t border-[#EEF3F4] px-2 py-1.5"><select className={cls} value={v.nhom} onChange={(e) => setV({ ...v, nhom: e.target.value })}>{NHOM_HINH.map((n) => <option key={n.k} value={n.k}>{n.ten}</option>)}</select></td></tr>
      <tr><td className="border-t border-[#EEF3F4] px-2 py-1.5"><b>Bước / bài test</b></td><td className="border-t border-[#EEF3F4] px-2 py-1.5">{hinh.buoc || hinh.bai_test || '—'}</td><td className="border-t border-[#EEF3F4] px-2 py-1.5"><HienGt bn={bn} f="buoc" v={th.buoc || th.bai_test} /></td>
        <td className="border-t border-[#EEF3F4] px-2 py-1.5"><select className={cls + ' max-w-full'} value={v.buoc || ''} onChange={(e) => { if (e.target.value === '__moi') return setMoi(true); setV({ ...v, buoc: e.target.value || null }); }}><option value="">—</option>{[...new Set([...(v.buoc ? [v.buoc] : []), ...ds])].map((x) => <option key={x} value={x}>{x}</option>)}<option value="__moi">＋ giá trị khác…</option></select>
          {moi && <input autoFocus className={cls + ' w-full mt-1'} placeholder="tên bước mới rồi Enter" onKeyDown={(e) => { const t = e.target.value.trim(); if (e.key === 'Enter') { if (t) setV({ ...v, buoc: t }); setMoi(false); } }} />}</td></tr>
      <tr><td className="border-t border-[#EEF3F4] px-2 py-1.5"><b>Lời khớp hình không</b></td><td colSpan={3} className="border-t border-[#EEF3F4] px-2 py-1.5"><label className="text-xs mr-3"><input type="radio" checked={khopHinh} onChange={() => setKhop(true)} /> khớp</label><label className="text-xs"><input type="radio" checked={!khopHinh} onChange={() => setKhop(false)} /> lời nói trước / sau cảnh</label> <span className="text-[11px] text-ink-muted">— dạy máy ghép lời với cảnh</span></td></tr>
    </tbody></table></div>
    <div className="flex gap-2 flex-wrap"><button className={nutCls + ' !bg-[#15803D] !border-[#15803D] text-white'} disabled={busy || !m.thay} onClick={dungHet}><Kbd>Enter</Kbd>Thầy đúng</button>
      <button className={nutCls + ' !bg-[#0E7C8C] !border-[#0E7C8C] text-white'} disabled={busy} onClick={() => guiLuu({ nhom: v.nhom, buoc: v.nhom === 'THU_NGHIEM' ? null : v.buoc, bai_test: v.nhom === 'THU_NGHIEM' ? v.buoc : null, text: v.text, khop_hinh: khopHinh }, 'Đã lưu câu')}>Lưu</button>
      <button className={nutCls} disabled={busy} onClick={khongRo}><Kbd>0</Kbd>Máy nghe sai cả câu</button><button className={nutCls} onClick={() => ke(1)}><Kbd>→</Kbd>Câu kế</button></div>
    <div className="text-[11px] text-ink-muted">Sửa chữ chép sai cũng là dạy: máy gom các lỗi hay gặp (“FnX” → Finex) thành luật sửa thuật ngữ.</div>
  </Card>;
}
function ChiTietK2({ m, nguong, busy, guiLuu, ke }) {
  const [xem, setXem] = useState(false);
  const sd = m.so_do || {}; const ng = { net: 0.55, dong: 0.25, sang0: 0.15, sang1: 0.92, ...(nguong || {}) }; const may = m.may || { dung: true, ly_do: [] }; const nguoi = m.nguoi_source || null;
  const Vach = ({ t, x, lo, hi, tot }) => <div className="flex items-center gap-2 text-xs"><span className="w-11 text-ink-muted">{t}</span><div className="flex-1 h-2 bg-[#EDF2F3] rounded relative"><i className="absolute left-0 top-0 bottom-0 rounded" style={{ width: Math.min(100, (x || 0) * 100) + '%', background: tot ? '#0E7C8C' : '#A3372B' }} /><b className="absolute -top-[3px] -bottom-[3px] w-[2px] bg-ink" style={{ left: lo * 100 + '%' }} />{hi ? <b className="absolute -top-[3px] -bottom-[3px] w-[2px] bg-ink" style={{ left: hi * 100 + '%' }} /> : null}</div><span className="w-10 text-right tabular-nums">{x}</span></div>;
  return <Card pad="p-3" className="flex flex-col gap-3 !rounded-[14px] !shadow-none">{xem ? <XemDoan url={m.media_url} tu={m.tu} den={m.den} poster={m.khung_url} tuPhat cao="aspect-[16/7]" /> : <AnhDoan url={m.khung_url} lon />}
    <div className="flex gap-2 items-center flex-wrap">{m.media_url && <button className={nutCls + (xem ? '' : ' !bg-[#0E7C8C] !border-[#0E7C8C] text-white')} onClick={() => setXem(!xem)}>{xem ? '🖼 Xem ảnh' : '▶ Xem đoạn clip (giây ' + m.tu + '–' + m.den + ')'}</button>}<span className="text-[11px] text-ink-muted">{m.ten}{m.dong ? ' · ' + m.dong : ''}</span></div>
    <div className="flex flex-col gap-1.5"><Vach t="Nét" x={sd.net} lo={ng.net} tot={sd.net >= ng.net} /><Vach t="Rung" x={sd.dong} lo={ng.dong} tot={sd.dong <= ng.dong} /><Vach t="Sáng" x={sd.sang} lo={ng.sang0} hi={ng.sang1} tot={sd.sang >= ng.sang0 && sd.sang <= ng.sang1} /></div>
    <div className="text-xs">Luật máy: <b className={may.dung ? 'text-[#15803D]' : 'text-[#A3372B]'}>{may.dung ? 'dùng được' : 'loại · ' + may.ly_do.join(', ')}</b>{nguoi ? <> · Người: <b>{nguoi.dung ? 'dùng được' : 'loại · ' + (nguoi.ly_do || []).join(', ')}</b></> : null}</div>
    <div className="flex gap-2 flex-wrap"><button className={nutCls + ' !bg-[#15803D] !border-[#15803D] text-white'} disabled={busy} onClick={() => guiLuu({ dung: true, ly_do: [] }, 'Đã quyết: dùng được')}>Dùng được</button>{['mờ', 'rung', 'tối', 'cháy sáng', 'che khuất', 'bố cục xấu'].map((l) => <button key={l} className={nutCls} disabled={busy} onClick={() => guiLuu({ dung: false, ly_do: [l] }, 'Đã quyết: loại · ' + l)}>Loại · {l}</button>)}<button className={nutCls} onClick={() => ke(1)}><Kbd>→</Kbd>Đoạn kế</button></div>
    <div className="text-[11px] text-ink-muted">Vạch đen là ngưỡng hiện tại. Đủ 30 lần quyết, máy dò lại ngưỡng khớp ý người nhất.</div></Card>;
}

// ===================== BỘ NHÃN =====================
function BoNhan18() {
  const { me, goi, notify } = useApp(); const duoc = laGat(me); const { bn, tai, dat } = useBoNhan(); const [f, setF] = useState('dung_cu'); const [busy, setBusy] = useState(false);
  const [timGt, setTimGt] = useState(''); const [chuaDung, setChuaDung] = useState(false);
  const [doi, setDoi] = useState({}); const [them, setThem] = useState(''); const [themDong, setThemDong] = useState('');
  useEffect(() => { tai(); }, []);
  if (!bn) return <Card pad="p-3"><Empty>Đang tải bộ nhãn…</Empty></Card>;
  const TR = (bn.truong || TRUONG18).find((x) => x.k === f) || { ten: 'Dòng sản phẩm' }; const trTen = (k) => ((bn.truong || TRUONG18).find((x) => x.k === k) || {}).ten || k;
  const lam = async (duong, body, bao) => { if (!duoc) return notify('Chỉ Trưởng MKT / Admin', 'err'); setBusy(true); const r = await goi(duong, { method: 'POST', body }); setBusy(false); if (r.ok) { dat(r); notify(bao(r)); } else notify(r.msg, 'err'); };
  const ds = bn.gia_tri.filter((x) => x.truong === f && (!timGt || x.ten.toLowerCase().includes(timGt.toLowerCase())) && (!chuaDung || !x.so_mau)); const dongs = bn.dongs || [];
  const coGt = (k) => bn.gia_tri.some((x) => x.truong === k) || ['buoc', 'bai_test', 'hanh_dong', 'vat_lieu', 'dung_cu', 'vi_tri'].includes(k);
  const th = 'text-[10px] tracking-[.06em] uppercase text-ink-muted bg-[#F5F8F9] px-2 py-1.5 font-bold text-left'; const td = 'border-t border-[#EEF3F4] px-2 py-1.5 align-middle';
  return <div className="flex flex-col gap-3">
    <HangDeXuat bn={bn} busy={busy} lam={lam} trTen={trTen} duoc={duoc} />
    <div className="grid gap-3 min-[760px]:grid-cols-[220px_minmax(0,1fr)]">
      <Card pad="p-1.5" className="!rounded-[14px] !shadow-none min-w-0">{['Nội dung', 'Hình', 'Chất lượng', 'Dùng cho'].filter((n) => (bn.truong || TRUONG18).some((x) => x.nhom === n && coGt(x.k))).map((n) => <div key={n}><div className="text-[11px] text-ink-muted px-2.5 pt-1.5 pb-0.5 uppercase tracking-[.06em]">{n}</div>
        {(bn.truong || TRUONG18).filter((x) => x.nhom === n && coGt(x.k)).map((x) => <div key={x.k} onClick={() => setF(x.k)} className={'flex justify-between gap-2 px-2.5 py-[7px] rounded-[9px] cursor-pointer text-[13px] ' + (f === x.k ? 'bg-[#E0F2F4] font-bold' : 'hover:bg-[#F2F6F7]')}><span>{x.ten}</span><span className="text-[11px] text-ink-muted">{bn.gia_tri.filter((y) => y.truong === x.k && y.trang_thai === 'DUNG').length}</span></div>)}</div>)}
        <div className="text-[11px] text-ink-muted px-2.5 pt-1.5 pb-0.5 uppercase tracking-[.06em]">Phạm vi</div><div onClick={() => setF('__dong')} className={'flex justify-between gap-2 px-2.5 py-[7px] rounded-[9px] cursor-pointer text-[13px] ' + (f === '__dong' ? 'bg-[#E0F2F4] font-bold' : 'hover:bg-[#F2F6F7]')}><span>Dòng sản phẩm</span><span className="text-[11px] text-ink-muted">{dongs.length}</span></div></Card>
      <div className="min-w-0">{f === '__dong' ? <div className="flex flex-col gap-3">{duoc && <Card pad="p-3" className="!rounded-[14px] !shadow-none flex gap-2 items-center flex-wrap"><span className="font-bold text-sm">＋ Thêm dòng sản phẩm</span><input className="border border-line rounded-lg px-2 py-1 text-xs min-w-0 flex-1 max-w-[260px]" placeholder="tên dòng, vd Keo chít mạch" value={them} onChange={(e) => setThem(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && them.trim()) { lam('/bo-nhan', { truong: 'dong', ten: them.trim() }, () => 'Đã thêm dòng “' + them.trim() + '”'); setThem(''); } }} /><button className={nutCls + ' !bg-[#0E7C8C] !border-[#0E7C8C] text-white'} disabled={busy || !them.trim()} onClick={() => { lam('/bo-nhan', { truong: 'dong', ten: them.trim() }, () => 'Đã thêm dòng “' + them.trim() + '”'); setThem(''); }}>Thêm dòng</button><span className="text-[11px] text-ink-muted w-full">Dòng mới dùng ngay cho bước thi công, bài test, vật liệu và bộ lọc. Muốn gắn sản phẩm cụ thể thì thêm ở Chiến lược & Kế hoạch › Danh mục › Sản phẩm (ô Dòng).</span></Card>}<Card pad="p-3" className="!rounded-[14px] !shadow-none"><div className="font-bold text-sm mb-2">Dòng sản phẩm dùng chung cho mọi màn</div><div className="grid gap-2 min-[700px]:grid-cols-3">{(bn.dong_ct || []).map((d) => <div key={d.dong} className="rounded-lg border border-line px-2.5 py-2 text-xs"><b className="text-[13px]">{d.dong}</b><div className="text-ink-muted">{d.mo_ta || 'chưa khai thương hiệu'}</div></div>)}</div></Card><DongSanPham key={(bn.dongs || []).join("|")} /></div> : <Card pad="p-3" className="flex flex-col gap-3 !rounded-[14px] !shadow-none">
        <div className="flex items-center gap-2 flex-wrap"><span className="font-bold text-sm">{TR.ten}</span><Pill cls="bg-[#E7ECEF] text-[#3B4B55]" className="!text-[11px]">{KIEU18(TR)}</Pill><span className="text-xs text-ink-muted">{TR.k === 'buoc' ? 'thứ tự bước theo dòng — lấy từ quy trình sản phẩm; máy dùng để kiểm đảo bước' : TR.k === 'bai_test' ? 'lấy từ bài test của sản phẩm' : ''}</span></div>
        <div className="flex gap-2 items-center flex-wrap text-xs"><input className="border border-line rounded-lg px-2 py-1 text-xs min-w-0 w-44" placeholder="tìm nhãn…" value={timGt} onChange={(e) => setTimGt(e.target.value)} /><label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={chuaDung} onChange={(e) => setChuaDung(e.target.checked)} /> chỉ nhãn chưa mẫu nào dùng</label></div>
        <div className="overflow-x-auto"><table className="w-full border-collapse text-xs min-w-[520px]"><thead><tr><th className={th}>Nhãn</th><th className={th}>Phạm vi</th><th className={th}>Nguồn</th><th className={th + ' !text-right'}>Mẫu dùng</th><th className={th}></th></tr></thead>
          <tbody>{ds.map((v) => <tr key={v.id}><td className={td}>{doi[v.id] != null ? <input autoFocus className="border border-line rounded-lg px-2 py-0.5 text-xs w-40" value={doi[v.id]} onChange={(e) => setDoi({ ...doi, [v.id]: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter' && doi[v.id].trim()) { lam('/bo-nhan/' + v.id + '/doi-ten', { ten: doi[v.id].trim() }, (r) => 'Đã đổi tên — ' + r.mau_chuyen + ' mẫu đổi theo'); setDoi({ ...doi, [v.id]: null }); } if (e.key === 'Escape') setDoi({ ...doi, [v.id]: null }); }} /> : <>{v.thu_tu ? <span className="text-ink-muted tabular-nums">{v.thu_tu}. </span> : null}{v.ten}{v.mo_ta ? <div className="text-[11px] text-ink-muted">nhận biết: {v.mo_ta}</div> : null}</>}</td>
            <td className={td}>{v.dong || 'chung'}</td><td className={td + ' text-[11px] text-ink-muted'}>{NGUON18[v.nguon] || v.nguon}</td><td className={td + ' text-right tabular-nums'}>{v.so_mau}</td>
            <td className={td}>{(TR.kieu === 'MO_RONG' || (TR.kieu === 'QUY_TRINH' && v.nguon !== 'QUY_TRINH')) && duoc ? <button className={nutCls + ' !px-2 !py-0.5'} onClick={() => setDoi({ ...doi, [v.id]: v.ten })}>Đổi tên</button> : TR.kieu === 'QUY_TRINH' ? <span className="text-[11px] text-ink-muted">sửa ở Danh mục sản phẩm</span> : null}</td></tr>)}</tbody></table></div>
        {TR.kieu === 'CO_DINH' || TR.kieu === 'SO' || TR.kieu === 'CHU' ? <div className="text-[11px] text-ink-muted">Trường cố định: hệ thống giữ, không thêm giá trị.</div>
          : duoc && <div className="flex gap-2 items-center flex-wrap"><input className="border border-line rounded-lg px-2 py-1 text-xs min-w-0" placeholder={'＋ nhãn mới cho ' + TR.ten.toLowerCase()} value={them} onChange={(e) => setThem(e.target.value)} />
            {(TR.kieu === 'QUY_TRINH' || TR.theo_dong) && <select className="border border-line rounded-lg px-2 py-1 text-xs bg-white" value={themDong} onChange={(e) => setThemDong(e.target.value)}>{TR.kieu !== 'QUY_TRINH' && <option value="">chung</option>}{TR.kieu === 'QUY_TRINH' && <option value="">chọn dòng…</option>}{dongs.map((d) => <option key={d} value={d}>{d}</option>)}</select>}
            <button className={nutCls + ' !bg-[#0E7C8C] !border-[#0E7C8C] text-white'} disabled={busy || !them.trim()} onClick={() => { lam('/bo-nhan', { truong: f, ten: them.trim(), dong: themDong }, () => 'Đã thêm “' + them.trim() + '”'); setThem(''); }}>Thêm</button></div>}
      </Card>}</div></div>
    <ChonThay />
  </div>;
}

// hàng đề xuất (26/09, chủ: "bộ nhãn đề xuất khó hiểu để duyệt"): mỗi đề xuất nói thành câu, kèm ảnh mẫu đang dùng, gợi ý nhãn có sẵn để gộp, ba nút rõ nghĩa
const TEN_TR_THUONG = { nhom: 'nhóm cảnh', buoc: 'bước thi công', bai_test: 'bài test', hanh_dong: 'hành động', vat_lieu: 'sản phẩm / vật liệu', dung_cu: 'dụng cụ', vi_tri: 'vị trí' };
function HangDeXuat({ bn, busy, lam, trTen, duoc }) {
  const { goi, notify } = useApp(); const { dat } = useBoNhan();
  const [loc, setLoc] = useState(''); const [dong, setDong] = useState(''); const [nguon, setNguon] = useState(''); const [tim, setTim] = useState(''); const [sx, setSx] = useState('mau');
  const [chon, setChon] = useState(() => new Set()); const [n, setN] = useState(30); const [xac, setXac] = useState(null); const [dang, setDang] = useState(false);
  const all = bn.de_xuat; const demTr = {}; all.forEach((x) => { demTr[x.truong] = (demTr[x.truong] || 0) + 1; }); const dongs = [...new Set([...(bn.dongs || []), ...all.map((x) => x.dong).filter(Boolean)])];   /* danh sách dòng đầy đủ (một nguồn) */
  const ds = all.filter((x) => (!loc || x.truong === loc) && (!dong || (dong === '(chung)' ? !x.dong : x.dong === dong)) && (!nguon || x.nguon === nguon) && (!tim || x.ten.toLowerCase().includes(tim.toLowerCase())))
    .sort((a, b) => sx === 'moi' ? String(b.created_at).localeCompare(String(a.created_at)) : sx === 'goi_y' ? (!!b.goi_y - !!a.goi_y) || b.so_mau - a.so_mau : b.so_mau - a.so_mau);
  const hl = async (hanh) => { setDang(true); const r = await goi('/bo-nhan/hang-loat', { method: 'POST', body: { ids: [...chon], hanh } }); setDang(false); setXac(null); if (r.ok) { dat(r); setChon(new Set()); notify((hanh === 'duyet' ? 'Đã thêm ' : 'Đã bỏ ') + r.so + ' nhãn' + (r.loi && r.loi.length ? ' · ' + r.loi.length + ' lỗi: ' + r.loi[0] : '')); } else notify(r.msg, 'err'); };
  const gopGoiY = async () => { const ids = ds.filter((x) => chon.has(x.id) && x.goi_y); setDang(true); let k = 0; for (const v of ids) { const r = await goi('/bo-nhan/' + v.id + '/gop', { method: 'POST', body: { vao: v.goi_y.ten } }); if (r.ok) { k++; dat(r); } } setDang(false); setChon(new Set()); notify('Đã gộp ' + k + ' nhãn vào nhãn gợi ý'); };
  const [moiTen, setMoiTen] = useState({});
  const doiTenDuyet = async (v, ten) => { ten = String(ten || '').trim(); if (!ten) return; const a = await goi('/bo-nhan/' + v.id + '/doi-ten', { method: 'POST', body: { ten } }); if (!a.ok) return notify(a.msg, 'err'); const b = await goi('/bo-nhan/' + v.id + '/duyet', { method: 'POST', body: {} }); if (b.ok) { dat(b); setMoiTen({ ...moiTen, [v.id]: undefined }); notify('Đã tạo nhãn “' + ten + '” — ' + (a.mau_chuyen || 0) + ' mẫu đổi theo'); } else notify(b.msg, 'err'); };
  const tg = (id) => { const s2 = new Set(chon); s2.has(id) ? s2.delete(id) : s2.add(id); setChon(s2); };
  const cls = 'border border-line rounded-lg px-2 py-1 text-xs bg-white min-w-0';
  return <Card pad="p-3" className="flex flex-col gap-3 !rounded-[14px] !shadow-none">
    <div className="flex items-center gap-2 flex-wrap"><span className="font-bold text-sm">Hàng đề xuất</span><span className="text-xs text-ink-muted">{all.length} nhãn chờ anh/chị quyết</span></div>
    <div className="text-xs text-ink-2 bg-[#F5F8F9] rounded-lg px-3 py-2">Thầy (Claude) hoặc người vừa gặp một thứ <b>chưa có tên trong bộ nhãn</b>. Xem ảnh mẫu rồi chọn: <b className="text-[#15803D]">Thêm nhãn mới</b> nếu đúng là thứ mới cần dùng · <b className="text-[#0E7C8C]">Gộp</b> nếu cùng một thứ đã có tên (mọi mẫu đổi theo tên có sẵn) · <b className="text-[#A3372B]">Bỏ</b> nếu không phải thứ thuộc trường này.</div>
    {all.length > 0 && <div className="flex gap-1.5 flex-wrap items-center">
      <button onClick={() => { setLoc(''); setChon(new Set()); }} className={'rounded-full border px-2.5 py-0.5 text-xs ' + (!loc ? 'border-ink font-bold' : 'border-line bg-white')}>Tất cả · {all.length}</button>
      {Object.entries(demTr).sort((a, b) => b[1] - a[1]).map(([k, c]) => <button key={k} onClick={() => { setLoc(k); setChon(new Set()); }} className={'rounded-full border px-2.5 py-0.5 text-xs bg-white ' + (loc === k ? 'border-ink font-bold' : 'border-line')}>{trTen(k)} · {c}</button>)}</div>}
    {all.length > 0 && <div className="flex gap-2 flex-wrap items-center">
      <input className={cls + ' w-44'} placeholder="tìm tên đề xuất…" value={tim} onChange={(e) => setTim(e.target.value)} />
      <select className={cls} value={dong} onChange={(e) => setDong(e.target.value)}><option value="">mọi dòng</option>{dongs.map((d) => <option key={d} value={d}>{d}</option>)}</select>
      <select className={cls} value={nguon} onChange={(e) => setNguon(e.target.value)}><option value="">thầy + người</option><option value="THAY">thầy đề xuất</option><option value="NGUOI">người đề xuất</option></select>
      <select className={cls} value={sx} onChange={(e) => setSx(e.target.value)}><option value="mau">nhiều mẫu dùng nhất</option><option value="goi_y">có gợi ý gộp trước</option><option value="moi">mới nhất</option></select></div>}
    {duoc && ds.length > 0 && <div className="flex gap-2 items-center flex-wrap text-xs"><label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={chon.size > 0 && ds.every((x) => chon.has(x.id))} onChange={(e) => setChon(e.target.checked ? new Set(ds.map((x) => x.id)) : new Set())} /> chọn cả {ds.length} đang lọc</label>
      {chon.size > 0 && (xac ? <><span className="font-semibold">{xac === 'duyet' ? 'Thêm' : 'Bỏ'} {chon.size} nhãn?</span><button className={nutCls + (xac === 'duyet' ? ' !bg-[#15803D] !border-[#15803D] text-white' : ' !bg-[#A3372B] !border-[#A3372B] text-white')} disabled={dang} onClick={() => hl(xac)}>{dang ? 'Đang làm…' : 'Chắc chắn'}</button><button className={nutCls} onClick={() => setXac(null)}>Thôi</button></>
        : <>{ds.some((x) => chon.has(x.id) && x.goi_y) && <button className={nutCls + ' !bg-[#0E7C8C] !border-[#0E7C8C] text-white'} disabled={dang} onClick={gopGoiY}>Gộp theo gợi ý ({ds.filter((x) => chon.has(x.id) && x.goi_y).length})</button>}<button className={nutCls + ' !bg-[#15803D] !border-[#15803D] text-white'} onClick={() => setXac('duyet')}>Thêm {chon.size} thành nhãn mới</button><button className={nutCls} onClick={() => setXac('bo')}>Bỏ {chon.size}</button></>)}</div>}
    {!all.length ? <div className="text-xs text-ink-muted">Không còn đề xuất nào.</div> : <div className="grid gap-2 grid-cols-[minmax(0,1fr)] min-[900px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">{ds.slice(0, n).map((v) => <div key={v.id} className={'min-w-0 rounded-xl border p-2.5 flex flex-col gap-2 text-xs ' + (chon.has(v.id) ? 'border-[#0E7C8C] bg-[#F5FAFB]' : 'border-line bg-white')}>
      <div className="flex items-start gap-2">{duoc && <input type="checkbox" className="mt-0.5" checked={chon.has(v.id)} onChange={() => tg(v.id)} />}<div className="min-w-0"><b>{v.nguon === 'THAY' ? 'Thầy' : 'Người'}</b> thấy một <b>{TEN_TR_THUONG[v.truong] || v.truong}</b> chưa có trong danh sách{v.dong ? <> của dòng <b>{v.dong}</b></> : null}:
        <div className="mt-1 flex items-center gap-2 flex-wrap"><span className="border border-dashed border-[#E3B23C] bg-[#FFF9E8] rounded-md px-1.5 py-0.5 text-[13px] font-semibold">{v.ten}</span><span className="text-ink-muted">dùng ở {v.so_mau} mẫu</span></div></div></div>
      {(v.vi_du || []).length ? <div className="flex gap-1.5 overflow-x-auto">{v.vi_du.map((x) => <div key={x.id} className="w-[120px] flex-none" title={(x.ten || '') + ' · giây ' + x.tu + '–' + x.den}><div className="rounded-md aspect-video bg-slate-700 overflow-hidden">{x.khung_url ? <img src={x.khung_url} alt="" loading="lazy" className="w-full h-full object-cover" /> : null}</div><div className="text-[10px] text-ink-muted leading-tight mt-0.5" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{x.mo_ta || x.ten}</div></div>)}</div> : <div className="text-[11px] text-ink-muted">Chưa có mẫu nào đang dùng tên này.</div>}
      {v.goi_y && <div className="rounded-lg bg-[#E0F2F4] px-2 py-1.5 flex items-center gap-2 flex-wrap"><span>Có vẻ là <b>{v.goi_y.ten}</b> <span className="text-ink-muted">({v.goi_y.ly_do})</span></span>{duoc && <button className={nutCls + ' !py-0.5 !bg-[#0E7C8C] !border-[#0E7C8C] text-white ml-auto'} disabled={busy} onClick={() => lam('/bo-nhan/' + v.id + '/gop', { vao: v.goi_y.ten }, (r) => 'Đã gộp “' + v.ten + '” vào “' + v.goi_y.ten + '” — ' + r.mau_chuyen + ' mẫu đổi theo')}>Gộp vào “{v.goi_y.ten}”</button>}</div>}
      {duoc && <div className="flex gap-1.5 items-center flex-wrap"><button className={nutCls + ' !py-0.5 !bg-[#15803D] !border-[#15803D] text-white'} disabled={busy} onClick={() => lam('/bo-nhan/' + v.id + '/duyet', {}, () => 'Đã thêm “' + v.ten + '” vào danh sách ' + (TEN_TR_THUONG[v.truong] || ''))}>✓ Thêm nhãn mới</button>
        <select className={cls + ' !py-0.5 max-w-[170px]'} value="" disabled={busy} onChange={(e) => { const d = e.target.value; if (d === '__moi') return setMoiTen({ ...moiTen, [v.id]: v.ten }); if (d) lam('/bo-nhan/' + v.id + '/gop', { vao: d }, (r) => 'Đã gộp “' + v.ten + '” vào “' + d + '” — ' + r.mau_chuyen + ' mẫu đổi theo'); }}><option value="">Gộp vào nhãn khác…</option>{giaTri18(bn, v.truong, v.dong).map((x) => <option key={x} value={x}>{tenGt18(bn, v.truong, x)}</option>)}<option value="__moi">＋ Chưa có — tạo tên chuẩn mới…</option></select>
        {moiTen[v.id] != null && <div className="w-full flex gap-1.5 items-center flex-wrap"><input autoFocus className={cls + ' flex-1 min-w-[160px]'} value={moiTen[v.id]} onChange={(e) => setMoiTen({ ...moiTen, [v.id]: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') doiTenDuyet(v, moiTen[v.id]); if (e.key === 'Escape') setMoiTen({ ...moiTen, [v.id]: undefined }); }} placeholder="tên chuẩn muốn dùng" /><button className={nutCls + ' !py-0.5 !bg-[#15803D] !border-[#15803D] text-white'} disabled={busy || !String(moiTen[v.id] || '').trim()} onClick={() => doiTenDuyet(v, moiTen[v.id])}>Tạo nhãn này</button><button className={nutCls + ' !py-0.5'} onClick={() => setMoiTen({ ...moiTen, [v.id]: undefined })}>Huỷ</button><span className="text-[11px] text-ink-muted w-full">Đề xuất đổi thành tên này rồi thêm vào bộ nhãn; mọi mẫu đang dùng tên cũ đổi theo.</span></div>}
        <button className={nutCls + ' !py-0.5 text-[#A3372B]'} disabled={busy} onClick={() => lam('/bo-nhan/' + v.id + '/bo', {}, () => 'Đã bỏ “' + v.ten + '”')}>✗ Không phải {TEN_TR_THUONG[v.truong] || 'nhãn'} — bỏ</button></div>}
    </div>)}</div>}
    {ds.length > n && <button className={nutCls + ' self-start'} onClick={() => setN(n + 30)}>Xem thêm {Math.min(30, ds.length - n)} / còn {ds.length - n}</button>}
  </Card>;
}
// ===================== NGUỒN HỌC (26/09, chủ: "cần có ui quản lý nguồn dữ liệu học") =====================
const LOAI_NGUON = { TIKTOK: ['🎵', 'Kênh TikTok'], REELS: ['📘', 'Reels Facebook'], DRIVE: ['📁', 'Thư mục Drive'], KALODATA: ['📈', 'Kalodata'], LOCAL: ['💻', 'Thư mục máy dựng'], FOOTAGE: ['🎥', 'Footage quay'] };
function NguonHoc({ a }) {
  const { goi, notify, me } = useApp(); const duoc = laGat(me); const [d, setD] = useState(null); const [loai, setLoai] = useState(''); const [mo, setMo] = useState(null); const [busy, setBusy] = useState(false); const [dongChon, setDongChon] = useState({}); const pc = useRong(900);
  const tai = async () => { const r = await goi('/nguon-hoc'); if (r.ok) setD(r); else notify(r.msg, 'err'); }; useEffect(() => { tai(); }, []);
  if (!d) return <Card pad="p-3"><Empty>Đang tải nguồn học…</Empty></Card>;
  const pct = (x, n) => n ? Math.round(x / n * 100) + '%' : '—'; const ds = d.nguon.filter((g) => !loai || g.loai === loai);
  const tong = d.nguon.reduce((a, g) => ({ v: a.v + g.so_video, h: a.h + g.hinh, anh: a.anh + g.anh, th: a.th + g.thay, chua: a.chua + (g.dong['(chưa có)'] || 0) }), { v: 0, h: 0, anh: 0, th: 0, chua: 0 });
  const [xoa, setXoa] = useState(null);
  const loaiNguon = async (g) => { if (xoa !== g.key) { setXoa(g.key); return; } setBusy(true); const r = await goi('/nguon-hoc/loai', { method: 'POST', body: { video_ids: g.video.map((v) => v.id), ten: g.ten } }); setBusy(false); setXoa(null); if (r.ok) { notify('Đã loại ' + r.so + ' video của ' + g.ten + ' khỏi kho học (cả mẫu của chúng)'); tai(); } else notify(r.msg, 'err'); };
  const hocThem = async (g) => { setBusy(true); const r = await goi('/lop-hoc/nap', { method: 'POST', body: g.loai === 'FOOTAGE' ? { nap: g.nap, loai_nap: 'FOOTAGE', dong: g.kho_dong, toi_da: 200 } : { nap: g.nap, toi_da: 30 } }); setBusy(false); if (r.ok) { notify(r.trung ? 'Máy đã có lệnh này rồi' : 'Đã giao máy học thêm video mới của ' + g.ten); tai(); } else notify(r.msg, 'err'); };
  const ganDong = async (g) => { const dong = dongChon[g.key]; if (!dong) return; setBusy(true); const r = await goi('/mau-doan/dat-dong', { method: 'POST', body: { doi_tuong_ids: g.video.map((v) => v.id), dong } }); setBusy(false); if (r.ok) { notify('Đã gán “' + dong + '” cho ' + r.so_video + ' video · ' + r.so_mau + ' mẫu'); setDongChon({ ...dongChon, [g.key]: '' }); tai(); } else notify(r.msg, 'err'); };
  const Dong = ({ g }) => <div className="flex gap-1 flex-wrap">{Object.entries(g.dong).sort((x, y) => y[1] - x[1]).map(([k, n]) => <Pill key={k} cls={k === '(chưa có)' ? 'bg-[#FFF9E8] text-[#8A6410]' : 'bg-[#E0F2F4] text-[#0E7C8C]'} className="!text-[11px]">{k} · {n}</Pill>)}</div>;
  const Nut = ({ g }) => g.dang_hoc ? <Pill cls="bg-sky-100 text-sky-800" className="!text-[11px]">⏳ {g.dang_hoc === 'CHO_TRAM' ? 'đang xếp hàng' : g.dang_hoc === 'CHO' ? 'chờ máy nhận' : 'máy đang học'}</Pill> : <div className="flex gap-1.5 flex-wrap items-center">{g.nap && duoc && (g.loai !== 'FOOTAGE' || g.kho_dong) && <button className={nutCls + ' !py-0.5'} disabled={busy} onClick={() => hocThem(g)} title={'nạp lại: ' + g.nap}>{g.loai === 'FOOTAGE' ? '＋ Nạp thêm footage mới' : '＋ Học thêm video mới'}</button>}
    {g.loai !== 'FOOTAGE' && <><select className="border border-line rounded-lg px-1.5 py-0.5 text-xs bg-white min-w-0" value={dongChon[g.key] || ''} onChange={(e) => setDongChon({ ...dongChon, [g.key]: e.target.value })}><option value="">gán dòng cả nguồn…</option>{d.dongs.map((x) => <option key={x} value={x}>{x}</option>)}</select>{dongChon[g.key] && <button className={nutCls + ' !py-0.5 !bg-[#0E7C8C] !border-[#0E7C8C] text-white'} disabled={busy} onClick={() => ganDong(g)}>Gán cho {g.so_video} video</button>}</>}
    <button className={nutCls + ' !py-0.5'} onClick={() => setMo(mo === g.key ? null : g.key)}>{mo === g.key ? 'Ẩn video' : 'Xem ' + g.so_video + ' video'}</button>
    {duoc && g.loai !== 'FOOTAGE' && g.video.length > 0 && <button className={nutCls + ' !py-0.5 ' + (xoa === g.key ? '!bg-rose-600 !border-rose-600 text-white' : '!text-rose-700')} disabled={busy} onClick={() => loaiNguon(g)} onBlur={() => setTimeout(() => setXoa(null), 300)}>{xoa === g.key ? 'Bấm lần nữa: loại ' + g.video.length + ' video' : 'Loại nguồn'}</button>}</div>;
  const DsVideo = ({ g }) => <div className="rounded-lg bg-[#F7FAFB] p-2 max-h-72 overflow-auto text-xs">{g.video.map((v) => <div key={v.id} className="flex items-center gap-2 py-0.5 border-b border-[#EEF3F4] last:border-0"><span className="flex-1 min-w-0 truncate">{v.ten}</span><span className="text-ink-muted tabular-nums whitespace-nowrap">{v.hinh} đoạn · thầy {v.thay}</span><Pill cls={v.dong ? 'bg-[#E0F2F4] text-[#0E7C8C]' : 'bg-[#FFF9E8] text-[#8A6410]'} className="!text-[10px]">{v.dong || 'chưa có dòng'}</Pill></div>)}</div>;
  const th = 'text-[10px] tracking-[.06em] uppercase text-ink-muted bg-[#F5F8F9] px-2 py-1.5 font-bold text-left'; const td = 'border-t border-[#EEF3F4] px-2 py-2 align-top';
  const trangThaiLenh = (s) => ({ CHO: ['chờ máy', 'bg-slate-100 text-ink'], DA_GUI: ['đang chạy', 'bg-sky-100 text-sky-800'], XONG: ['xong', 'bg-emerald-100 text-emerald-800'], HONG: ['lỗi', 'bg-rose-100 text-rose-700'], HUY: ['huỷ', 'bg-slate-100 text-ink-muted'] })[s] || [s, 'bg-slate-100'];
  return <div className="flex flex-col gap-3">
    <div className="grid grid-cols-2 min-[760px]:grid-cols-5 gap-2">{[[d.nguon.length, 'nguồn đang học'], [tong.v, 'video / clip đã học'], [tong.h, 'đoạn hình trong kho mẫu'], [pct(tong.th, tong.h), 'đoạn đã có nhãn thầy (' + pct(tong.anh, tong.h) + ' có ảnh)'], [tong.chua, 'video chưa có dòng sản phẩm']].map(([x, t], i) => <Card key={i} pad="p-3" className="!rounded-[14px] !shadow-none"><b className={'text-[22px] block tabular-nums ' + (i === 4 && x ? 'text-[#8A6410]' : '')}>{x}</b><span className="text-[11px] text-ink-muted">{t}</span></Card>)}</div>
    <div className={'rounded-xl px-3 py-2 text-xs flex gap-3 flex-wrap ' + (d.may.some((m) => m.song) ? 'bg-[#F5F8F9]' : 'bg-[#FBE4E1] text-[#A3372B]')}><b>Máy học:</b>{d.may.map((m) => <span key={m.ten}>{m.song ? '🟢' : '🔴'} {m.ten} {m.song ? 'đang bật' : '· mất liên lạc từ ' + (m.nhan_luc ? fmtDate(m.nhan_luc) : '—')}</span>)}</div>
    <NapMotO a={a} duoc={duoc} />
    {d.kalodata && <KalodataNguon kd={d.kalodata} duoc={duoc} dongs={d.dongs} onDoi={tai} />}
    <Card pad="p-3" className="flex flex-col gap-3 !rounded-[14px] !shadow-none">
      <div className="flex items-center gap-2 flex-wrap"><span className="font-bold text-sm">Nguồn dữ liệu học</span><span className="text-xs text-ink-muted">mỗi dòng là một kênh / thư mục / ngành máy đã học; gán dòng cho cả nguồn một lần, học thêm video mới bằng một nút</span></div>
      <div className="flex gap-1.5 flex-wrap"><button onClick={() => setLoai('')} className={'rounded-full border px-2.5 py-0.5 text-xs ' + (!loai ? 'border-ink font-bold' : 'border-line bg-white')}>Tất cả · {d.nguon.length}</button>{Object.entries(LOAI_NGUON).map(([k, [ic, t]]) => { const n = d.nguon.filter((g) => g.loai === k).length; return n ? <button key={k} onClick={() => setLoai(k)} className={'rounded-full border px-2.5 py-0.5 text-xs bg-white ' + (loai === k ? 'border-ink font-bold' : 'border-line')}>{ic} {t} · {n}</button> : null; })}</div>
      {pc ? <div className="overflow-x-auto"><table className="w-full border-collapse text-xs min-w-[860px]"><thead><tr><th className={th}>Nguồn</th><th className={th}>Dòng sản phẩm</th><th className={th + ' !text-right'}>Video</th><th className={th + ' !text-right'}>Đoạn hình</th><th className={th}>Ảnh · thầy · người</th><th className={th}>Lời · nghe sai</th><th className={th}>Bản xem</th><th className={th}>Học lần cuối</th></tr></thead>
        <tbody>{ds.map((g) => <React.Fragment key={g.key}><tr><td className={td}><div className="font-semibold text-[13px]">{LOAI_NGUON[g.loai][0]} {g.ten}</div><div className="text-[11px] text-ink-muted">{g.phu}</div><div className="mt-1.5"><Nut g={g} /></div></td><td className={td}><Dong g={g} /></td><td className={td + ' text-right tabular-nums'}>{g.so_video}</td><td className={td + ' text-right tabular-nums'}>{g.hinh}</td>
          <td className={td + ' tabular-nums'}>{pct(g.anh, g.hinh)} · {pct(g.thay, g.hinh)} · {g.nguoi}</td><td className={td + ' tabular-nums'}>{g.loi} · {pct(g.nghe_sai, g.loi)}</td><td className={td + ' tabular-nums'}>{g.loai === 'FOOTAGE' ? 'gốc' : pct(g.ban_xem, g.so_video)}</td><td className={td + ' whitespace-nowrap'}>{g.cuoi ? fmtDate(g.cuoi) : '—'}</td></tr>
          {mo === g.key && <tr><td colSpan={8} className="px-2 pb-2"><DsVideo g={g} /></td></tr>}</React.Fragment>)}</tbody></table></div>
      : <div className="flex flex-col gap-2">{ds.map((g) => <div key={g.key} className="rounded-xl border border-line p-2.5 flex flex-col gap-1.5 text-xs"><div className="font-semibold text-[13px]">{LOAI_NGUON[g.loai][0]} {g.ten}</div><div className="text-[11px] text-ink-muted">{g.phu} · học lần cuối {g.cuoi ? fmtDate(g.cuoi) : '—'}</div><Dong g={g} /><div className="text-ink-muted tabular-nums">{g.so_video} video · {g.hinh} đoạn · ảnh {pct(g.anh, g.hinh)} · thầy {pct(g.thay, g.hinh)} · lời {g.loi} (nghe sai {pct(g.nghe_sai, g.loi)})</div><Nut g={g} />{mo === g.key && <DsVideo g={g} />}</div>)}</div>}
    </Card>
    <Card pad="p-3" className="!rounded-[14px] !shadow-none"><div className="font-bold text-sm mb-2">Việc học gần đây</div><div className="flex flex-col gap-1">{!d.lenh.length && <span className="text-xs text-ink-muted">Chưa giao máy việc học nào.</span>}{d.lenh.map((l) => { const [t, c] = trangThaiLenh(l.trang_thai); const ts = l.tham_so || {}; return <div key={l.id} className="flex gap-2 items-start text-[11px] rounded-lg border border-line/70 px-2 py-1"><Pill cls={c} className="!text-[10px]">{t}</Pill><span className="flex-1 min-w-0">{l.viec === 'hoc_thanh_pham' ? (ts.chi_proxy ? 'Tạo bản xem + ảnh bù' : 'Học video ' + (ts.nguon || '') + (ts.kenh ? ' ' + ts.kenh : '')) : l.viec === 'phan_tich_footage' ? 'Đọc footage' : 'Trạm tải / quét'}{ts.so ? ' · ' + ts.so + ' video' : ''}{l.ket_qua ? <span className="text-ink-muted"> — {String(l.ket_qua).slice(0, 140)}</span> : null}</span><span className="text-ink-muted whitespace-nowrap">{fmtDate(l.created_at)}</span></div>; })}</div></Card>
  </div>;
}
// Kalodata trong Nguồn học: ngành đang theo dõi (thêm / bỏ), tự quét hằng tuần, quét ngay, top N, dòng, mục đích — trước đây nằm ở tab khác
function KalodataNguon({ kd, duoc, dongs, onDoi }) {
  const { goi, notify } = useApp(); const [moi, setMoi] = useState(''); const [busy, setBusy] = useState(false);
  const luu = async (o, tb) => { setBusy(true); const r = await goi('/kalodata', { method: 'PUT', body: { nganh: kd.nganh, top_n: kd.top_n, tu_dong: kd.tu_dong, dong: kd.dong, muc_dich: kd.muc_dich, ...o } }); setBusy(false); if (r.ok) { notify(tb); onDoi(); } else notify(r.msg, 'err'); };
  const quet = async () => { setBusy(true); const r = await goi('/kalodata/quet', { method: 'POST', body: {} }); setBusy(false); if (r.ok) { notify('Đã xin Trạm quét Kalodata ngay'); onDoi(); } else notify(r.msg, 'err'); };
  const kq = kd.ket_qua_cuoi;
  return <Card pad="p-3" className="!rounded-[14px] !shadow-none flex flex-col gap-2 text-xs">
    <div className="flex items-center gap-2 flex-wrap"><span className="font-bold text-sm">📈 Kalodata — video TikTok Shop bán chạy theo ngành</span><span className="text-ink-muted">{kd.lan_cuoi ? 'quét lần cuối ' + fmtDate(kd.lan_cuoi) + (kq ? ' · ' + kq.nganh + ': ' + kq.so + ' video' + (kq.loi ? ' · lỗi ' + kq.loi : '') : '') : 'chưa quét lần nào'}</span></div>
    <div className="flex gap-1.5 flex-wrap items-center">{kd.nganh.map((n) => <span key={n} className="inline-flex items-center gap-1 rounded-full border border-line bg-white px-2 py-0.5">{n}{duoc && <button disabled={busy} className="text-rose-700 font-bold" title="bỏ ngành" onClick={() => luu({ nganh: kd.nganh.filter((x) => x !== n) }, 'Đã bỏ ngành ' + n)}>×</button>}</span>)}{!kd.nganh.length && <span className="text-ink-muted">chưa theo dõi ngành nào</span>}
      {duoc && <><input className="border border-line rounded-full px-2 py-0.5 w-44" placeholder="+ ngành (vd Vật tư xây dựng)" value={moi} onChange={(e) => setMoi(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && moi.trim()) { luu({ nganh: [...kd.nganh.filter((x) => x !== moi.trim()), moi.trim()] }, 'Đã thêm ngành ' + moi.trim()); setMoi(''); } }} /></>}</div>
    {duoc && <div className="flex gap-3 flex-wrap items-center"><label className="flex items-center gap-1"><input type="checkbox" checked={kd.tu_dong} disabled={busy} onChange={(e) => luu({ tu_dong: e.target.checked }, e.target.checked ? 'Bật tự quét hằng tuần' : 'Tắt tự quét')} /> tự quét hằng tuần</label>
      <label className="flex items-center gap-1">top <select className="border border-line rounded px-1 bg-white" value={kd.top_n} disabled={busy} onChange={(e) => luu({ top_n: +e.target.value }, 'Đã đổi top N')}>{[5, 10, 20, 30, 50].map((x) => <option key={x} value={x}>{x}</option>)}</select> video / ngành</label>
      <label className="flex items-center gap-1">dòng <select className="border border-line rounded px-1 bg-white" value={kd.dong || ''} disabled={busy} onChange={(e) => luu({ dong: e.target.value || null }, 'Đã đổi dòng')}><option value="">tự nhận</option>{dongs.map((x) => <option key={x} value={x}>{x}</option>)}</select></label>
      <button className={nutCls + ' !py-0.5'} disabled={busy || !kd.nganh.length} onClick={quet}>Quét ngay</button></div>}
  </Card>;
}
// ===================== TỔNG QUAN =====================
function TongQuan18({ a, setTab }) {
  const { goi } = useApp(); const [d, setD] = useState(null); useEffect(() => { goi('/do-chinh-xac').then((r) => { if (r.ok) setD(r); }); }, []);
  const pctN = (x, n) => n ? Math.round(x / n * 100) : null;
  const Bar = ({ x }) => x == null ? <span className="text-[11px] text-ink-muted">chưa đo</span> : <div className="flex items-center gap-2"><div className="flex-1 max-w-[160px] h-2 bg-[#EDF2F3] rounded relative"><i className="absolute left-0 top-0 bottom-0 rounded" style={{ width: x + '%', background: x >= 80 ? '#15803D' : x >= 65 ? '#B45309' : '#A3372B' }} /></div><span className="w-[34px] text-right tabular-nums text-xs">{x}%</span></div>;
  if (!d) return <Card pad="p-3"><Empty>Đang tính…</Empty></Card>;
  const dm = d.dem || {}; const phaiXem = dm.hinh ? Math.round(dm.k1 / dm.hinh * 100) : 0; const yeu = d.truong_yeu || [];
  const th = 'text-[10px] tracking-[.06em] uppercase text-ink-muted bg-[#F5F8F9] px-2 py-1.5 font-bold text-left'; const td = 'border-t border-[#EEF3F4] px-2 py-1.5 align-middle';
  return <div className="flex flex-col gap-3">
    <BaoThay bu={d.bu} />
    <div className="grid grid-cols-2 min-[760px]:grid-cols-4 gap-2">{[[dm.hinh_thay_chot || 0, 'mẫu hình thầy đã chốt'], [phaiXem + '%', 'mẫu người phải xem (kiểm ngẫu nhiên + thầy chưa chắc: ' + (dm.k1 || 0) + '/' + (dm.hinh || 0) + ')'], [dm.hinh_vang || 0, 'mẫu người đã kiểm'], [d.so_de_xuat || 0, 'nhãn đề xuất chờ duyệt']].map(([x, t], i) => <Card key={i} pad="p-3" className="!rounded-[14px] !shadow-none"><b className="text-[22px] block tabular-nums">{x}</b><span className="text-[11px] text-ink-muted">{t}</span></Card>)}</div>
    <Card pad="p-3" className="flex flex-col gap-3 !rounded-[14px] !shadow-none"><div className="flex items-center gap-2 flex-wrap"><span className="font-bold text-sm">Độ đúng theo từng trường</span><span className="text-xs text-ink-muted">đo trên {d.so_nhan} nhãn người · cổng huấn luyện 80%</span></div>
      <div className="overflow-x-auto"><table className="w-full border-collapse text-xs min-w-[600px]"><thead><tr><th className={th}>Trường</th><th className={th + ' !text-right'}>Mẫu kiểm</th><th className={th}>Thầy đúng</th><th className={th}>Mô hình mở đúng</th><th className={th}>Tỉ lệ kiểm</th><th className={th}>Cổng học trò</th></tr></thead>
        <tbody>{TRUONG18.filter((t) => t.k !== 'mo_ta').map((t) => { const x = (d.theo_truong || {})[t.k] || { so: 0 }; const tp = pctN(x.thay_dung, x.thay_so), mp = pctN(x.mo_dung, x.mo_so);
          return <tr key={t.k}><td className={td}><b>{t.ten}{t.k === 'tham_my' ? ' (±1)' : ''}</b></td><td className={td + ' text-right tabular-nums'}>{x.so}</td><td className={td}><Bar x={tp} /></td><td className={td}><Bar x={mp} /></td>
            <td className={td}>{yeu.includes(t.k) ? <Pill cls={TT18.KHONG_CHAC.cls} className="!text-[11px]">tăng 20%</Pill> : <span className="text-[11px] text-ink-muted">8%</span>}</td>
            <td className={td}>{mp != null && mp >= 80 && x.mo_so >= 30 ? <Pill cls={TT18.MO.cls} className="!text-[11px]">mở huấn luyện</Pill> : x.so < 30 ? <span className="text-[11px] text-ink-muted">cần {30 - x.so} nhãn nữa</span> : <Pill cls="bg-[#FBE4E1] text-[#A3372B]" className="!text-[11px]">mở chưa đạt</Pill>}</td></tr>; })}</tbody></table></div>
      <div className="text-[11px] text-ink-muted">{yeu.length ? <>Đọc bảng: thầy đúng dưới 85% ở <b>{yeu.map((k) => (TRUONG18.find((t) => t.k === k) || {}).ten).join(', ')}</b> → máy tự tăng tỉ lệ kiểm các trường này lên 20%; trường thầy chắc thì chỉ kiểm 8%.</> : 'Trường nào thầy đúng dưới 85% (tính khi có ≥ 20 mẫu kiểm) thì máy tự tăng tỉ lệ kiểm trường đó lên 20%; còn lại kiểm 8%.'}</div></Card>
    <ViecCanQuyet a={a} setTab={setTab} soDeXuat={d.so_de_xuat || 0} />
  </div>;
}
