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

function NhanHinh({ a }) {
  const d = a.do_chinh_xac_hinh || {}; const dongs = a.dong_san_pham || [];
  const [dong, setDong] = useState('');
  return <div className="space-y-3">
    <Callout tone="info"><b>Vì sao có màn này.</b> Mọi phần thông minh phía sau (chọn đoạn theo lời thoại, ghép, chấm thẩm mỹ) đứng trên một câu hỏi: <b>khung hình này đang nói về gì</b>. Máy chỉ được tin khi đã đo trên nhãn người. Khi học, <b>Claude làm thầy</b> đọc từng đoạn cùng lúc với mô hình mở. Hai bên khớp nhau thì thành nhãn dạy mô hình mở. Bất đồng hoặc thầy không chắc thì đoạn vào đây cho anh/chị quyết. Mỗi phím là một nhãn vàng: vừa đo thầy và mô hình mở đúng bao nhiêu, vừa làm ví dụ cho lần đọc sau. Chưa đủ khoảng 200 nhãn và chưa đạt 80% trên mẫu ngẫu nhiên thì chưa dùng nhãn máy để huấn luyện.</Callout>
    <BangDoHinh d={d} />
    <GanNhanNhanh dong={dong} setDong={setDong} dongs={dongs} />
  </div>;
}

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
function ChonNhan({ v, onChange, x }) {   // chọn nhóm + bước/bài test (có ô gõ bước mới) cho một khung
  const ds = v.nhom === 'THI_CONG' ? (x.quy_trinh || []) : v.nhom === 'THU_NGHIEM' ? (x.bai_test_ds || []) : null; const cot = v.nhom === 'THI_CONG' ? 'buoc' : 'bai_test';
  return <div className="space-y-1">
    <Select className="!py-1 !px-1.5 text-[11px] w-full" value={v.nhom} onChange={e => onChange({ nhom: e.target.value, buoc: null, bai_test: null, mo_ta: v.mo_ta })}>{NHOM_HINH.map(n => <option key={n.k} value={n.k}>{n.ten}</option>)}</Select>
    {ds && <><Select className="!py-1 !px-1.5 text-[11px] w-full" value={ds.includes(v[cot]) ? v[cot] : (v[cot] ? '__moi' : '')} onChange={e => onChange({ ...v, [cot]: e.target.value === '__moi' ? (v[cot] && !ds.includes(v[cot]) ? v[cot] : ' ') : e.target.value || null })}><option value="">{cot === 'buoc' ? '(không rõ bước)' : '(không rõ bài test)'}</option>{ds.map(b => <option key={b} value={b}>{b}</option>)}<option value="__moi">＋ {cot === 'buoc' ? 'bước' : 'bài test'} khác…</option></Select>
      {v[cot] && !ds.includes(v[cot]) && <Input className="!py-1 !px-1.5 text-[11px] w-full" placeholder={cot === 'buoc' ? 'tên bước mới' : 'tên bài test mới'} value={v[cot].trim()} onChange={e => onChange({ ...v, [cot]: e.target.value || ' ' })} />}</>}
    <Input className="!py-1 !px-1.5 text-[11px] w-full" placeholder="mô tả đúng (tuỳ chọn)" value={v.mo_ta || ''} onChange={e => onChange({ ...v, mo_ta: e.target.value })} />
  </div>;
}
// ===== GÁN NHÃN — bản PC (25/09, chủ: "tối ưu ui dạy trên pc sao cho trực quan và thao tác người kiểm tra xử lý dễ dàng nhanh chóng") =====
// Ba cột vừa một màn: hàng thẻ (đã làm · tiếp theo) | ảnh lớn + dải thời gian cả video | bảng quyết định.
// Làm là sang thẻ ngay (lưu nền, lỗi thì thẻ quay lại hàng); ảnh thẻ kế tải sẵn; bàn phím đủ cho mọi thao tác; ← quay lại sửa thẻ vừa làm.
function DaiVideo({ tl, dai, tu, den }) {
  if (!Array.isArray(tl) || !tl.length) return null; const het = dai || Math.max(...tl.map(y => y[1])) || 1;
  return <div className="mt-2"><div className="relative h-4 rounded bg-slate-100 overflow-hidden" role="img" aria-label="dải thời gian cả video theo nhóm cảnh">
    {tl.map((y, j) => { const n = NHOM_HINH.find(z => z.k === y[2]); const dang = Math.abs(y[0] - tu) < 0.01 && Math.abs(y[1] - den) < 0.01;
      return <div key={j} title={y[0] + '–' + y[1] + 's · ' + tenNhom(y[2]) + (y[3] ? ' · người đã kiểm' : '')} className="absolute top-0 bottom-0" style={{ left: (y[0] / het * 100) + '%', width: Math.max(0.6, (y[1] - y[0]) / het * 100) + '%', background: n ? n.mau : '#94a3b8', opacity: dang ? 1 : 0.45, outline: dang ? '2px solid #0f172a' : 'none', outlineOffset: '-2px' }}>{y[3] ? <span className="absolute right-0.5 top-0 text-[8px] text-white">✓</span> : null}</div>; })}
  </div><div className="flex justify-between text-[10px] text-ink-muted mt-0.5"><span>0s</span><span>đang xem: giây {tu}–{den} (viền đậm)</span><span>{Math.round(het)}s</span></div></div>;
}
function GanNhanNhanh({ dong, setDong, dongs }) {
  const { goi, notify, refresh } = useApp();
  const [hang, setHang] = useState([]); const [tt, setTt] = useState(null); const [dangTai, setDangTai] = useState(false); const [them, setThem] = useState(false);
  const [daLam, setDaLam] = useState([]); const [sua, setSua] = useState(null);
  const [buoc2, setBuoc2] = useState(null); const [moTa, setMoTa] = useState(''); const [buocMoi, setBuocMoi] = useState(''); const [themQT, setThemQT] = useState(true); const [laDai, setLaDai] = useState(false); const [tach, setTach] = useState(null); const [phim, setPhim] = useState(false);
  const daXem = useRef(new Set()); const batDau = useRef(Date.now()); const moTaRef = useRef(null); const dangTaiRef = useRef(false);
  const tai = async (reset) => { if (dangTaiRef.current) return; dangTaiRef.current = true; setDangTai(true);
    const r = await goi('/nhan-hinh/hang?n=30' + (them ? '&them=1' : '') + '&dong=' + encodeURIComponent(dong) + '&bo=' + encodeURIComponent(reset ? '' : [...daXem.current].slice(-300).join(',')));
    dangTaiRef.current = false; setDangTai(false); if (!r.ok) return notify(r.msg, 'err'); setTt(r);
    setHang(h => { const moi = (r.hang || []).filter(y => !daXem.current.has(y.k) && !(reset ? [] : h).some(z => z.k === y.k)); return reset ? moi : [...h, ...moi]; }); };
  useEffect(() => { daXem.current = new Set(); setHang([]); setDaLam([]); setSua(null); tai(true); }, [dong, them]);
  const x = sua != null && daLam[sua] ? daLam[sua].x : hang[0];
  useEffect(() => { batDau.current = Date.now(); setMoTa(sua != null && daLam[sua] ? (daLam[sua].body.mo_ta || '') : ''); setBuocMoi(''); setTach(null); setLaDai(false); setBuoc2(null); }, [x && x.k, sua]);
  useEffect(() => { hang.slice(1, 6).forEach(y => { if (y.khung_url) { const im = new Image(); im.src = y.khung_url; } }); }, [hang]);   // tải sẵn ảnh thẻ kế
  const duongCua = (y) => (y.nguon === 'THANH_PHAM' ? '/kho-thanh-pham/' : '/tai-san/') + y.id + '/doan/' + y.i;
  const nhanTxt = (o) => o ? tenNhom(o.nhom) + (o.buoc ? ' · ' + o.buoc : '') + (o.bai_test ? ' · ' + o.bai_test : '') : '—';
  const gocThay = (y) => y.thay || { nhom: y.nhom, buoc: y.buoc, bai_test: y.bai_test };
  // lưu lạc quan: sang thẻ kế ngay, lỗi thì trả thẻ về hàng
  const gui = (body0) => { if (!x) return; const y = x; const laSua = sua != null;
    const body = { ...body0, mo_ta: body0.mo_ta || moTa.trim() || undefined, ngau_nhien: !!y.ngau_nhien, giay: Math.round((Date.now() - batDau.current) / 1000), nhe: true };
    if (laSua) { setDaLam(d => d.map(z => z.x.k === y.k ? { ...z, body, dang: true } : z)); setSua(null); }
    else { daXem.current.add(y.k); setDaLam(d => [...d, { x: y, body, dang: true }]); setHang(h => { const c = h.slice(1); if (c.length < 5) setTimeout(() => tai(false), 0); return c; }); }
    goi(duongCua(y), { method: 'POST', body }).then(r => {
      if (!r.ok) { notify('Chưa lưu được (' + r.msg + ') — thẻ quay lại hàng', 'err'); setDaLam(d => d.filter(z => z.x.k !== y.k)); if (!laSua) { daXem.current.delete(y.k); setHang(h => [y, ...h]); } return; }
      if (r.them_vao) notify(r.them_vao.loi || ('Đã thêm "' + r.them_vao.gia_tri + '" vào ' + (r.them_vao.cot === 'quy_trinh' ? 'quy trình' : 'bài test') + ' ' + r.them_vao.dong));
      setDaLam(d => d.map(z => z.x.k === y.k ? { ...z, dang: false, dung: r.dung } : z)); }); };
  const qua = () => { if (!x) return; if (sua != null) { setSua(null); return; } daXem.current.add(x.k); setHang(h => { const c = h.slice(1); if (c.length < 5) setTimeout(() => tai(false), 0); return c; }); };
  const quayLai = () => { if (!daLam.length) return; setSua(sua == null ? daLam.length - 1 : Math.max(0, sua - 1)); };
  const dongY = () => { const g = gocThay(x); gui({ nhom: g.nhom, buoc: g.buoc, bai_test: g.bai_test }); };
  const chonNhom = (k) => { if (k === 'THI_CONG' || k === 'THU_NGHIEM') setBuoc2({ nhom: k, ds: (k === 'THI_CONG' ? x.quy_trinh : x.bai_test_ds) || [] }); else gui({ nhom: k }); };
  const theoBuoc = (b, moi) => gui(buoc2.nhom === 'THI_CONG' ? { nhom: 'THI_CONG', buoc: b, them_buoc: moi && themQT } : { nhom: 'THU_NGHIEM', bai_test: b, them_buoc: moi && themQT });
  const moTach = () => { const g = gocThay(x); setTach([0, 1, 2].map(() => ({ nhom: g.nhom, buoc: g.buoc || null, bai_test: g.bai_test || null, mo_ta: '' }))); };
  const luuTach = () => { const p = tach.map(v => ({ ...v, buoc: v.buoc && v.buoc.trim() || null, bai_test: v.bai_test && v.bai_test.trim() || null, mo_ta: (v.mo_ta || '').trim() || null }));
    const coMoi = p.some(v => (v.buoc && !(x.quy_trinh || []).includes(v.buoc)) || (v.bai_test && !(x.bai_test_ds || []).includes(v.bai_test))); gui({ phan: p, them_buoc: coMoi && themQT }); };
  useEffect(() => { const f = (e) => { const tag = (e.target || {}).tagName || '';
      if (/INPUT|TEXTAREA|SELECT/.test(tag)) { if (e.key === 'Escape') e.target.blur(); if (e.key === 'Enter' && e.target === moTaRef.current) { e.preventDefault(); e.target.blur(); dongY(); } return; }
      if (e.key === '?') { setPhim(p => !p); return; } if (phim) { if (e.key === 'Escape') setPhim(false); return; }
      if (!x || tach) { if (e.key === 'Escape') setTach(null); return; } const n = parseInt(e.key, 10);
      if (buoc2) { if (e.key === 'Escape' || e.key === 'Backspace') { e.preventDefault(); setBuoc2(null); } else if (n >= 1 && n <= buoc2.ds.length) theoBuoc(buoc2.ds[n - 1]); else if (e.key === 'Enter') { e.preventDefault(); gui({ nhom: buoc2.nhom }); } return; }
      if (e.key === 'Enter') { e.preventDefault(); dongY(); } else if (n >= 1 && n <= 8) chonNhom(NHOM_HINH[n - 1].k); else if (e.key === '0') gui({ khong_ro: true });
      else if (e.key === 'ArrowRight') { e.preventDefault(); qua(); } else if (e.key === 'ArrowLeft') { e.preventDefault(); quayLai(); }
      else if ((e.key === 't' || e.key === 'T') && laDai) moTach(); else if (e.key === 'm' || e.key === 'M') { e.preventDefault(); moTaRef.current && moTaRef.current.focus(); } };
    window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f); });
  const soGan = daLam.filter(z => !z.body.khong_ro).length, soDung = daLam.filter(z => z.dung && !z.body.khong_ro).length;
  const phut = tt ? (tt.phut_hom_nay || 0) : 0, tran = tt ? (tt.tran_phut || 0) : 0; const g = x ? gocThay(x) : null;
  const Anh = ({ y, cls }) => y && y.khung_url ? <img src={y.khung_url} alt="" className={cls} loading="lazy" /> : <div className={cls + ' bg-slate-200'} />;
  return <Card pad="p-0" className="overflow-hidden">
    <div className="flex items-center gap-3 flex-wrap px-3 py-2 border-b border-line bg-slate-50">
      <SectionTitle>Khung hình này nói gì</SectionTitle>
      <Select className="!py-1 !px-2 text-xs !w-40" value={dong} onChange={e => setDong(e.target.value)}><option value="">mọi dòng</option>{dongs.map(v => <option key={v} value={v}>{v}</option>)}</Select>
      <div className="flex items-center gap-2 text-[11px] text-ink-muted"><span>phiên này <b className="text-ink">{soGan}</b> thẻ · thầy đúng <b className="text-ink">{phanTram(soDung, soGan)}</b></span>
        <span className="hidden sm:inline">· hôm nay {phut}/{tran || '∞'} phút</span>{tran ? <span className="hidden sm:block w-24 h-1.5 rounded bg-slate-200 overflow-hidden"><span className="block h-full bg-teal-600" style={{ width: Math.min(100, phut / tran * 100) + '%' }} /></span> : null}
        <span>· còn {tt ? tt.con_lai : '…'} thẻ</span></div>
      <div className="ml-auto flex gap-1"><Btn variant="ghost" className="!py-1 !px-2 text-[11px]" onClick={() => setPhim(true)}>? Phím tắt</Btn><Btn variant="ghost" className="!py-1 !px-2 text-[11px]" onClick={() => { refresh(); tai(true); }}>Tải lại</Btn></div>
    </div>
    {!x && tt && tt.het_tran ? <div className="text-center py-10 text-sm text-ink-muted">Đã đủ {tt.tran_phut} phút hôm nay ({tt.phut_hom_nay} phút), máy không dồn thêm thẻ. <Btn variant="ghost" className="ml-2 !py-1 !px-2 text-[11px]" onClick={() => setThem(true)}>Làm thêm</Btn></div>
      : !x ? <Empty>{dangTai ? 'Đang lấy thẻ…' : 'Không còn thẻ nào cần người. Thầy chốt các đoạn còn lại; thẻ mới hiện khi thầy chưa chắc hoặc đến lượt kiểm ngẫu nhiên.'}</Empty>
      : <div className="grid lg:grid-cols-[176px_minmax(0,1fr)_360px]">
        {/* cột 1: hàng thẻ */}
        <div className="hidden lg:flex flex-col gap-1 border-r border-line p-2 max-h-[calc(100vh-220px)] overflow-y-auto text-[11px]">
          {daLam.length > 0 && <div className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold">Đã làm · ← quay lại</div>}
          {daLam.slice(-8).map((z, j0) => { const j = daLam.length - Math.min(8, daLam.length) + j0; return <button key={z.x.k} onClick={() => setSua(j)} className={'flex gap-1.5 items-center text-left rounded-lg p-1 hover:bg-slate-50 ' + (sua === j ? 'ring-1 ring-ink' : '')}>
            <Anh y={z.x} cls="w-12 h-8 rounded object-cover flex-none" /><span className="min-w-0 flex-1 truncate">{z.body.khong_ro ? 'không rõ' : z.body.phan ? 'từng khung' : tenNhom(z.body.nhom)}</span><span className={z.dang ? 'text-ink-muted' : z.dung ? 'text-emerald-600' : 'text-rose-600'}>{z.dang ? '…' : z.body.khong_ro ? '·' : z.dung ? '✓' : '✎'}</span></button>; })}
          <div className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold mt-1">Tiếp theo</div>
          {hang.slice(sua == null ? 0 : 0, 10).map((y, j) => <div key={y.k} className={'flex gap-1.5 items-center rounded-lg p-1 ' + (sua == null && j === 0 ? 'bg-teal-50 ring-1 ring-teal-600' : '')}>
            <Anh y={y} cls="w-12 h-8 rounded object-cover flex-none" /><span className="min-w-0 flex-1 truncate">{tenNhom((y.thay || y).nhom)}</span><span className={'text-[9px] ' + (y.ngau_nhien ? 'text-sky-700' : 'text-rose-700')}>{y.ngau_nhien ? 'kiểm' : 'chưa chắc'}</span></div>)}
        </div>
        {/* cột 2: ảnh + dải thời gian */}
        <div className="p-3 min-w-0">
          {sua != null && <div className="mb-2 text-[11px] rounded-lg bg-amber-50 text-amber-800 px-2 py-1">Đang sửa lại thẻ đã làm. Lưu để thay nhãn cũ; → để về thẻ đang chờ.</div>}
          {tach ? <div className="grid grid-cols-3 gap-2">{tach.map((v, k) => <div key={k} className="space-y-1"><div className="rounded-lg bg-slate-900 aspect-video w-full" style={{ backgroundImage: 'url(' + x.khung_url + ')', backgroundSize: '300% 100%', backgroundPosition: (k * 50) + '% 0' }} /><div className="text-[10px] text-ink-muted text-center">khung {k + 1}</div><ChonNhan v={v} x={x} onChange={nv => setTach(tach.map((o, j) => j === k ? nv : o))} /></div>)}
            <div className="col-span-3 flex gap-2 flex-wrap items-center"><Btn variant="brand" className="!py-1.5 !px-3 text-xs" onClick={luuTach}>Lưu 3 khung</Btn><Btn variant="ghost" className="!py-1.5 !px-3 text-xs" onClick={() => setTach(null)}>Esc · Huỷ</Btn>{x.dong && <label className="text-[11px] text-ink-muted flex items-center gap-1"><input type="checkbox" checked={themQT} onChange={e => setThemQT(e.target.checked)} />bước mới thêm vào quy trình {x.dong}</label>}</div></div>
            : <div className="rounded-xl overflow-hidden bg-slate-900 flex items-center justify-center" style={{ minHeight: 220 }}>
              {x.khung_url ? <img key={x.k} src={x.khung_url} alt={x.mo_ta || 'khung hình'} className="w-full max-h-[48vh] object-contain" onLoad={e => setLaDai(e.target.naturalWidth / Math.max(1, e.target.naturalHeight) > 2.2)} /> : x.media_url ? <video key={x.k} src={x.media_url + '#t=' + x.tu + ',' + x.den} controls muted autoPlay className="w-full max-h-[48vh]" /> : <span className="text-slate-400 text-xs">không có ảnh</span>}</div>}
          {!tach && laDai && <div className="grid grid-cols-3 text-center text-[10px] text-ink-muted mt-0.5"><span>khung 1</span><span>khung 2 · cách 0,5 giây</span><span>khung 3</span></div>}
          <DaiVideo tl={x.tl_video} dai={x.dai_video} tu={x.tu} den={x.den} />
          <div className="text-[11px] text-ink-muted mt-1">{x.nguon === 'THANH_PHAM' ? 'Video thành phẩm' : 'Footage'} · <b className="text-ink">{x.ten}</b> · giây {x.tu}–{x.den}{x.dong ? ' · ' + x.dong : ''}{x.link ? <> · <a className="underline" href={x.link} target="_blank" rel="noreferrer">mở bài đăng</a></> : null}{x.media_url ? <> · <a className="underline" href={x.media_url + '#t=' + x.tu} target="_blank" rel="noreferrer">mở clip</a></> : null}</div>
        </div>
        {/* cột 3: quyết định */}
        <div className="border-t lg:border-t-0 lg:border-l border-line p-3 space-y-2 text-xs">
          <div className={'rounded-lg px-2 py-1 text-[11px] ' + (x.ngau_nhien ? 'bg-sky-50 text-sky-800' : 'bg-rose-50 text-rose-700')}>{x.ngau_nhien ? 'Mẫu kiểm ngẫu nhiên — thầy đã chốt, anh/chị xem để đo thầy đúng bao nhiêu' : 'Thầy tự báo chưa chắc' + (x.thay && x.thay.chac != null ? ' (chắc ' + x.thay.chac + ')' : '')}</div>
          <div><div className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold">Thầy gán</div><div className="text-base font-bold text-ink leading-snug">{nhanTxt(g)}</div>
            {x.thay && x.thay.ly_do && <div className="text-ink-muted">vì {x.thay.ly_do}</div>}<div className="text-ink-muted">{x.mo_ta}</div>
            {x.mo && <div className="text-[10px] text-ink-muted mt-0.5">mô hình mở (học trò): {nhanTxt(x.mo)}</div>}</div>
          <button onClick={dongY} className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 text-sm">✓ Đúng <span className="font-mono text-[11px] bg-white/20 rounded px-1 ml-1">Enter</span></button>
          <input ref={moTaRef} className={inputCls+" !py-1.5 !px-2 text-[11px] w-full"} placeholder="M · mô tả đúng hơn (tuỳ chọn), Enter để lưu" value={moTa} onChange={e => setMoTa(e.target.value)} />
          {!buoc2 ? <div><div className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold mb-1">Sai? Chọn nhóm đúng</div>
            <div className="grid grid-cols-2 gap-1">{NHOM_HINH.map((n, i) => <button key={n.k} onClick={() => chonNhom(n.k)} className={'text-left rounded-lg border px-2 py-1.5 hover:bg-slate-50 flex items-center gap-1 ' + (g.nhom === n.k ? 'border-ink' : 'border-line')}>
              <span className="w-5 text-center rounded bg-slate-100 font-mono">{i + 1}</span><span className="inline-block w-2 h-2 rounded-full" style={{ background: n.mau }} /><b className="truncate">{n.ten}</b></button>)}</div></div>
            : <div><div className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold mb-1">{buoc2.nhom === 'THI_CONG' ? 'Bước thi công nào' : 'Bài test nào'} · Enter nếu không rõ · Esc quay lại</div>
              <div className="grid gap-1 max-h-56 overflow-y-auto">{buoc2.ds.map((b, i) => <button key={b} onClick={() => theoBuoc(b)} className={'text-left rounded-lg border px-2 py-1 hover:bg-slate-50 ' + (g.buoc === b || g.bai_test === b ? 'border-ink' : 'border-line')}><span className="inline-block w-5 text-center rounded bg-slate-100 font-mono mr-1">{i + 1}</span>{b}</button>)}</div>
              <div className="flex gap-1 mt-1"><Input className="!py-1 !px-2 text-[11px] flex-1 min-w-0" placeholder={buoc2.nhom === 'THI_CONG' ? '＋ bước khác' : '＋ bài test khác'} value={buocMoi} onChange={e => setBuocMoi(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && buocMoi.trim()) { e.preventDefault(); theoBuoc(buocMoi.trim(), true); } }} /><Btn variant="brand" className="!py-1 !px-2 text-[11px]" disabled={!buocMoi.trim()} onClick={() => theoBuoc(buocMoi.trim(), true)}>Lưu</Btn></div>
              {x.dong && <label className="text-[10px] text-ink-muted flex items-center gap-1 mt-1"><input type="checkbox" checked={themQT} onChange={e => setThemQT(e.target.checked)} />thêm vào {buoc2.nhom === 'THI_CONG' ? 'quy trình chuẩn' : 'danh sách bài test'} của {x.dong}</label>}</div>}
          <div className="grid grid-cols-2 gap-1">
            {laDai && !tach ? <Btn variant="ghost" className="!py-1 !px-2 text-[11px] col-span-2" onClick={moTach}>✂ T · Ba khung khác nội dung</Btn> : null}
            <Btn variant="ghost" className="!py-1 !px-2 text-[11px]" onClick={() => gui({ khong_ro: true })}>0 · Không rõ</Btn>
            <Btn variant="ghost" className="!py-1 !px-2 text-[11px]" onClick={qua}>→ Bỏ qua</Btn>
            <Btn variant="ghost" className="!py-1 !px-2 text-[11px] col-span-2" disabled={!daLam.length} onClick={quayLai}>← Quay lại thẻ vừa làm</Btn>
          </div>
        </div>
      </div>}
    {phim && <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" onClick={() => setPhim(false)}><div className="bg-white rounded-2xl p-4 max-w-sm w-full text-sm space-y-1" onClick={e => e.stopPropagation()}>
      <div className="font-bold mb-1">Phím tắt</div>
      {[['Enter', 'thầy đúng, sang thẻ kế'], ['1–8', 'chọn nhóm cảnh đúng'], ['1–9', 'chọn bước / bài test (sau khi chọn Thi công / Bài test)'], ['Esc', 'quay ra / huỷ'], ['M', 'ghi mô tả đúng hơn (Enter để lưu)'], ['T', 'gán từng khung khi dải 3 khung khác nội dung'], ['0', 'hình không rõ'], ['→', 'bỏ qua'], ['←', 'quay lại sửa thẻ vừa làm'], ['?', 'bật / tắt bảng này']].map(([k, v]) => <div key={k} className="flex gap-2"><span className="font-mono text-xs bg-slate-100 rounded px-1.5 min-w-[44px] text-center">{k}</span><span>{v}</span></div>)}
      <Btn variant="ghost" className="!py-1 !px-3 text-xs mt-2" onClick={() => setPhim(false)}>Đóng</Btn></div></div>}
  </Card>;
}
