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
function GanNhanNhanh({ dong, setDong, dongs }) {
  const { goi, notify, refresh } = useApp();
  const [hang, setHang] = useState([]); const [tt, setTt] = useState(null); const [dangTai, setDangTai] = useState(false);
  const [buoc2, setBuoc2] = useState(null); const [phien, setPhien] = useState({ gan: 0, trung: 0 }); const daXem = useRef(new Set()); const dangGui = useRef(false); const batDau = useRef(Date.now()); const [them, setThem] = useState(false);
  const [moTa, setMoTa] = useState(''); const [buocMoi, setBuocMoi] = useState(''); const [themQT, setThemQT] = useState(true); const [laDai, setLaDai] = useState(false); const [tach, setTach] = useState(null);
  const tai = async (reset) => { setDangTai(true); const r = await goi('/nhan-hinh/hang?n=30' + (them ? '&them=1' : '') + '&dong=' + encodeURIComponent(dong) + '&bo=' + encodeURIComponent(reset ? '' : [...daXem.current].slice(-300).join(','))); setDangTai(false);
    if (!r.ok) return notify(r.msg, 'err'); setTt(r); setHang(h => { const moi = (r.hang || []).filter(x => !daXem.current.has(x.k) && !(reset ? [] : h).some(y => y.k === x.k)); return reset ? moi : [...h, ...moi]; }); };
  useEffect(() => { daXem.current = new Set(); setHang([]); tai(true); }, [dong, them]);
  const x = hang[0];
  useEffect(() => { batDau.current = Date.now(); setMoTa(''); setBuocMoi(''); setTach(null); setLaDai(false); setBuoc2(null); }, [x && x.k]);   // thẻ mới: xoá phần gõ dở
  const qua = () => { if (x) daXem.current.add(x.k); setHang(h => { const c = h.slice(1); if (c.length < 5 && !dangTai) setTimeout(() => tai(false), 0); return c; }); };
  const gui = async (body) => { if (!x || dangGui.current) return; dangGui.current = true;
    const duong = (x.nguon === 'THANH_PHAM' ? '/kho-thanh-pham/' : '/tai-san/') + x.id + '/doan/' + x.i;
    const r = await goi(duong, { method: 'POST', body: { ...body, mo_ta: body.mo_ta || moTa.trim() || undefined, ngau_nhien: !!x.ngau_nhien, giay: Math.round((Date.now() - batDau.current) / 1000), nhe: true } }); dangGui.current = false;
    if (!r.ok) return notify(r.msg, 'err');
    if (r.them_vao) notify(r.them_vao.loi || ('Đã thêm "' + r.them_vao.gia_tri + '" vào ' + (r.them_vao.cot === 'quy_trinh' ? 'quy trình' : 'bài test') + ' của ' + r.them_vao.dong));
    if (!body.khong_ro) setPhien(p => ({ gan: p.gan + 1, trung: p.trung + (r.dung ? 1 : 0) }));
    qua(); };
  // Thi công / Bài test luôn mở danh sách chọn (có ô gõ bước mới kể cả khi dòng chưa khai quy trình)
  const chonNhom = (k) => { if (k === 'THI_CONG' || k === 'THU_NGHIEM') setBuoc2({ nhom: k, ds: (k === 'THI_CONG' ? x.quy_trinh : x.bai_test_ds) || [] }); else gui({ nhom: k }); };
  const theoBuoc = (b, moi) => gui(buoc2.nhom === 'THI_CONG' ? { nhom: 'THI_CONG', buoc: b, them_buoc: moi && themQT } : { nhom: 'THU_NGHIEM', bai_test: b, them_buoc: moi && themQT });
  const dongY = () => { if (!x) return; gui({ nhom: x.nhom, buoc: x.buoc, bai_test: x.bai_test }); };
  const moTach = () => setTach([0, 1, 2].map(() => ({ nhom: x.nhom, buoc: x.buoc || null, bai_test: x.bai_test || null, mo_ta: '' })));
  const luuTach = () => { const p = tach.map(v => ({ ...v, buoc: v.buoc && v.buoc.trim() || null, bai_test: v.bai_test && v.bai_test.trim() || null, mo_ta: (v.mo_ta || '').trim() || null }));
    const coMoi = p.some(v => (v.buoc && !(x.quy_trinh || []).includes(v.buoc)) || (v.bai_test && !(x.bai_test_ds || []).includes(v.bai_test))); gui({ phan: p, them_buoc: coMoi && themQT }); };
  useEffect(() => { const f = (e) => { if (!x || tach || /INPUT|TEXTAREA|SELECT/.test((e.target || {}).tagName || '')) return; const n = parseInt(e.key, 10);
      if (buoc2) { if (e.key === 'Backspace' || e.key === 'Escape') { setBuoc2(null); e.preventDefault(); } else if (n >= 1 && n <= buoc2.ds.length) theoBuoc(buoc2.ds[n - 1]); else if (e.key === 'Enter') gui({ nhom: buoc2.nhom }); return; }
      if (n >= 1 && n <= 8) chonNhom(NHOM_HINH[n - 1].k); else if (e.key === 'Enter') { e.preventDefault(); dongY(); } else if (e.key === '0') gui({ khong_ro: true }); else if (e.key === 'ArrowRight') qua(); };
    window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f); });
  const nhanTxt = (o) => tenNhom(o.nhom) + (o.buoc ? ' · ' + o.buoc : '') + (o.bai_test ? ' · ' + o.bai_test : '');

  return <Card pad="p-3">
    <div className="flex items-center gap-2 flex-wrap mb-2"><SectionTitle>Khung hình này nói gì</SectionTitle>
      <Select className="!py-1 !px-2 text-xs !w-44" value={dong} onChange={e => setDong(e.target.value)}><option value="">mọi dòng sản phẩm</option>{dongs.map(v => <option key={v} value={v}>{v}</option>)}</Select>
      {tt && <span className="text-[11px] text-ink-muted">còn {tt.con_lai} đoạn chưa gán ({tt.can_xac_nhan} máy chưa chắc) · đã gán {tt.da_gan}/{tt.tong_doan}{tt.khong_anh ? ' · ' + tt.khong_anh + ' đoạn chưa có ảnh' : ''}</span>}
      <span className="ml-auto text-[11px] text-ink-muted">phiên này: {phien.gan} nhãn · máy đúng {phanTram(phien.trung, phien.gan)}</span>
      <Btn variant="ghost" className="!py-1 !px-2 text-[11px]" onClick={() => { refresh(); tai(true); }}>Tải lại</Btn></div>
    {!x && tt && tt.het_tran ? <div className="text-center py-8 text-sm text-ink-muted">Đã đủ {tt.tran_phut} phút hôm nay ({tt.phut_hom_nay} phút), máy không dồn thêm thẻ. <Btn variant="ghost" className="ml-2 !py-1 !px-2 text-[11px]" onClick={() => setThem(true)}>Làm thêm</Btn></div> : !x ? <Empty>{dangTai ? 'Đang lấy đoạn…' : 'Không còn đoạn nào cần gán. Máy đọc thêm footage/video thành phẩm thì đoạn mới sẽ hiện ở đây.'}</Empty> :
      <div className="grid lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-3">
        <div>
          {tach ? <div className="grid grid-cols-3 gap-2">{tach.map((v, k) => <div key={k} className="space-y-1"><KhungCat url={x.khung_url} k={k} /><div className="text-[10px] text-ink-muted text-center">khung {k + 1}</div><ChonNhan v={v} x={x} onChange={nv => setTach(tach.map((o, j) => j === k ? nv : o))} /></div>)}</div>
            : <div className="rounded-xl overflow-hidden bg-slate-900 aspect-video flex items-center justify-center">
              {x.khung_url ? <img key={x.k} src={x.khung_url} alt={x.mo_ta || 'khung hình'} className="max-h-full max-w-full object-contain" onLoad={e => setLaDai(e.target.naturalWidth / Math.max(1, e.target.naturalHeight) > 2.2)} /> : x.media_url ? <video key={x.k} src={x.media_url + '#t=' + x.tu + ',' + x.den} controls muted autoPlay className="max-h-full max-w-full" /> : <span className="text-slate-400 text-xs">không có ảnh</span>}
            </div>}
          <div className="text-[11px] text-ink-muted mt-1">{x.khung_url && x.nguon === 'FOOTAGE' && x.media_url ? <a className="underline mr-2" href={x.media_url + '#t=' + x.tu} target="_blank" rel="noreferrer">mở clip</a> : null}{x.link ? <a className="underline mr-2" href={x.link} target="_blank" rel="noreferrer">mở bài đăng</a> : null}
            {x.nguon === 'THANH_PHAM' ? 'Video thành phẩm' : 'Footage'} · <b className="text-ink">{x.ten}</b> · giây {x.tu}–{x.den}{x.dong ? ' · ' + x.dong : ''}{x.ngau_nhien ? ' · mẫu ngẫu nhiên' : ''}</div>
          {laDai && !tach && <Btn variant="soft" className="!py-1.5 !px-3 text-xs mt-2" onClick={moTach}>✂ Ba khung khác nội dung? Gán từng khung</Btn>}
          {tach && <div className="flex gap-2 mt-2 flex-wrap items-center"><Btn variant="brand" className="!py-1.5 !px-3 text-xs" onClick={luuTach}>Lưu 3 khung</Btn><Btn variant="ghost" className="!py-1.5 !px-3 text-xs" onClick={() => setTach(null)}>Huỷ, gán cả đoạn</Btn>{x.dong && <label className="text-[11px] text-ink-muted flex items-center gap-1"><input type="checkbox" checked={themQT} onChange={e => setThemQT(e.target.checked)} />bước mới thêm vào quy trình {x.dong}</label>}</div>}
        </div>
        {!tach && <div className="space-y-2 text-xs">
          <div className="rounded-xl border border-line p-2"><div className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold">Thầy gán là · {x.ly_do_hoi === 'KIEM' ? 'mẫu kiểm ngẫu nhiên để đo thầy đúng bao nhiêu' : 'thầy tự báo chưa chắc'}</div>
            <div className="text-sm font-semibold text-ink">{nhanTxt(x)}</div>
            <div className="text-ink-muted">{x.mo_ta}{x.hanh_dong ? ' — ' + x.hanh_dong : ''}</div>
            {(x.thay || x.mo) && <div className="mt-1 grid gap-0.5 text-[11px]">{x.thay && <div><span className="text-ink-muted">Thầy Claude:</span> <b>{nhanTxt(x.thay)}</b> <span className="text-ink-muted">chắc {x.thay.chac ?? '—'}{x.thay.ly_do ? ' — ' + x.thay.ly_do : ''}</span></div>}{x.mo && <div><span className="text-ink-muted">Mô hình mở:</span> <b>{nhanTxt(x.mo)}</b></div>}{x.thay && x.mo && <div className={x.thay.nhom === x.mo.nhom ? 'text-emerald-700' : 'text-rose-700'}>{x.thay.nhom === x.mo.nhom ? 'Mô hình mở cùng nhóm với thầy' : 'Mô hình mở khác thầy (học trò còn sai, chỉ để đo)'}</div>}</div>}
            <Input className="!py-1 !px-2 text-[11px] w-full mt-1" placeholder="Mô tả đúng hơn (tuỳ chọn), vd: gạt Finex bằng bay răng vàng" value={moTa} onChange={e => setMoTa(e.target.value)} />
            <Btn variant="ok" className="!py-1 !px-2 text-[11px] mt-1" onClick={dongY}>Enter · Đúng rồi</Btn></div>
          {!buoc2 ? <div><div className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold mb-1">Hay thật ra là</div>
            <div className="grid grid-cols-2 gap-1">{NHOM_HINH.map((n, i) => <button key={n.k} onClick={() => chonNhom(n.k)} className={'text-left rounded-lg border px-2 py-1 hover:bg-slate-50 ' + (x.nhom === n.k ? 'border-ink' : 'border-line')}>
              <span className="inline-block w-5 text-center rounded bg-slate-100 font-mono mr-1">{i + 1}</span><span className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: n.mau }} /><b>{n.ten}</b><div className="text-[10px] text-ink-muted pl-6">{n.mo}</div></button>)}</div></div>
            : <div><div className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold mb-1">{buoc2.nhom === 'THI_CONG' ? 'Bước thi công nào' : 'Bài test nào'} · Esc quay lại</div>
              <div className="grid gap-1">{buoc2.ds.map((b, i) => <button key={b} onClick={() => theoBuoc(b)} className={'text-left rounded-lg border px-2 py-1 hover:bg-slate-50 ' + (x.buoc === b || x.bai_test === b ? 'border-ink' : 'border-line')}><span className="inline-block w-5 text-center rounded bg-slate-100 font-mono mr-1">{i + 1}</span>{b}</button>)}
                <div className="rounded-lg border border-dashed border-line p-1.5 space-y-1"><div className="flex gap-1"><Input className="!py-1 !px-2 text-[11px] flex-1" placeholder={buoc2.nhom === 'THI_CONG' ? '＋ bước khác, vd: khò nhiệt phá bọt khí' : '＋ bài test khác'} value={buocMoi} onChange={e => setBuocMoi(e.target.value)} /><Btn variant="brand" className="!py-1 !px-2 text-[11px]" disabled={!buocMoi.trim()} onClick={() => theoBuoc(buocMoi.trim(), true)}>Lưu</Btn></div>
                  {x.dong && <label className="text-[10px] text-ink-muted flex items-center gap-1"><input type="checkbox" checked={themQT} onChange={e => setThemQT(e.target.checked)} />thêm vào {buoc2.nhom === 'THI_CONG' ? 'quy trình chuẩn' : 'danh sách bài test'} của {x.dong}</label>}</div>
                <button onClick={() => gui({ nhom: buoc2.nhom })} className="text-left rounded-lg border border-line px-2 py-1 hover:bg-slate-50 text-ink-muted">Enter · không rõ {buoc2.nhom === 'THI_CONG' ? 'bước nào' : 'bài test nào'}</button></div></div>}
          <div className="flex gap-1 flex-wrap"><Btn variant="ghost" className="!py-1 !px-2 text-[11px]" onClick={() => gui({ khong_ro: true })}>0 · Hình không rõ</Btn><Btn variant="ghost" className="!py-1 !px-2 text-[11px]" onClick={qua}>→ Bỏ qua</Btn></div>
        </div>}
      </div>}
  </Card>;
}
