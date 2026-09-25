// ADR-017 đợt B — HỘP VIỆC: thẻ K2 (source dùng được không) và K4 (câu lời nói về gì), cùng khuôn hàng thẻ với nhãn hình.

// hàng thẻ dùng chung: tải theo lô, bỏ qua, đo giây mỗi thẻ, trần phút
function useHangThe(duong) {
  const { goi, notify } = useApp(); const [hang, setHang] = useState([]); const [tt, setTt] = useState(null); const [dangTai, setDangTai] = useState(false); const [them, setThem] = useState(false);
  const daXem = useRef(new Set()); const batDau = useRef(Date.now()); const dangGui = useRef(false);
  const tai = async (reset) => { setDangTai(true); const r = await goi(duong + (duong.includes('?') ? '&' : '?') + (them ? 'them=1&' : '') + 'bo=' + encodeURIComponent(reset ? '' : [...daXem.current].slice(-300).join(','))); setDangTai(false);
    if (!r.ok) return notify(r.msg, 'err'); setTt(r); setHang(h => { const moi = (r.hang || []).filter(x => !daXem.current.has(x.k) && !(reset ? [] : h).some(y => y.k === x.k)); return reset ? moi : [...h, ...moi]; }); };
  useEffect(() => { daXem.current = new Set(); setHang([]); tai(true); }, [duong, them]);
  const x = hang[0]; useEffect(() => { batDau.current = Date.now(); }, [x && x.k]);
  const qua = () => { if (x) daXem.current.add(x.k); setHang(h => { const c = h.slice(1); if (c.length < 5) setTimeout(() => tai(false), 0); return c; }); };
  const gui = async (p, body) => { if (!x || dangGui.current) return null; dangGui.current = true; const r = await goi(p, { method: 'POST', body: { ...body, ngau_nhien: !!x.ngau_nhien, giay: Math.round((Date.now() - batDau.current) / 1000) } }); dangGui.current = false; if (!r.ok) { notify(r.msg, 'err'); return null; } qua(); return r; };
  return { x, tt, dangTai, qua, gui, tai, setThem };
}
function HetTran({ tt, setThem }) { return <div className="text-center py-8 text-sm text-ink-muted">Đã đủ {tt.tran_phut} phút hôm nay ({tt.phut_hom_nay} phút), máy không dồn thêm thẻ. <Btn variant="ghost" className="ml-2 !py-1 !px-2 text-[11px]" onClick={() => setThem(true)}>Làm thêm</Btn></div>; }
function useKeys(fn) { useEffect(() => { const f = (e) => { if (/INPUT|TEXTAREA|SELECT/.test((e.target || {}).tagName || '')) return; fn(e); }; window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f); }); }
function Phim({ k, children, onClick, on }) { return <button onClick={onClick} className={'text-left rounded-lg border px-2 py-1 hover:bg-slate-50 ' + (on ? 'border-ink' : 'border-line')}><span className="inline-block min-w-[20px] text-center rounded bg-slate-100 font-mono mr-1 px-1">{k}</span>{children}</button>; }

// K2 — đoạn footage này dùng được không, nếu không thì vì sao
const LY_SOURCE = [['2', 'mờ'], ['3', 'rung'], ['4', 'tối'], ['5', 'cháy sáng'], ['6', 'che khuất'], ['7', 'bố cục xấu']];
function Vach({ ten, v, lo, hi, tot }) {
  return <div className="flex items-center gap-2"><span className="w-10 text-ink-muted">{ten}</span>
    <div className="relative flex-1 h-2 rounded bg-slate-100"><div className={'absolute inset-y-0 left-0 rounded ' + (tot ? 'bg-teal-600' : 'bg-rose-500')} style={{ width: Math.min(100, v * 100) + '%' }} />
      {lo != null && <div className="absolute -top-1 -bottom-1 w-px bg-ink" style={{ left: lo * 100 + '%' }} />}{hi != null && <div className="absolute -top-1 -bottom-1 w-px bg-ink" style={{ left: hi * 100 + '%' }} />}</div>
    <span className="w-10 text-right tabular-nums">{v}</span></div>;
}
function TheSource() {
  const { x, tt, dangTai, qua, gui, setThem } = useHangThe('/source/hang'); const [dem, setDem] = useState({ n: 0, khop: 0 });
  const quyet = async (dung, ly) => { if (!x) return; const r = await gui('/tai-san/' + x.id + '/doan/' + x.i + '/source', { dung, ly_do: ly || [] }); if (r) setDem(d => ({ n: d.n + 1, khop: d.khop + (r.dung ? 1 : 0) })); };
  useKeys((e) => { if (!x) return; if (e.key === 'Enter') { e.preventDefault(); quyet(x.may.dung, x.may.ly_do); } else if (e.key === '1') quyet(true); else if (e.key === 'ArrowRight') qua(); else { const l = LY_SOURCE.find(([k]) => k === e.key); if (l) quyet(false, [l[1]]); } });
  const ng = (tt && tt.nguong) || {};
  return <Card pad="p-3">
    <div className="flex items-center gap-2 flex-wrap mb-2"><SectionTitle>K2 · Đoạn này dùng được không</SectionTitle>
      {tt && <span className="text-[11px] text-ink-muted">còn {tt.con_lai} đoạn · đoạn gần ngưỡng hiện trước{tt.hoc ? ' · ngưỡng máy học khớp người ' + tt.hoc.khop_pct + '% (ngưỡng cũ ' + tt.hoc.khop_cu_pct + '%)' : ' · máy học ngưỡng khi đủ 30 lần quyết'}</span>}
      <span className="ml-auto text-[11px] text-ink-muted">phiên này {dem.n} · máy khớp {phanTram(dem.khop, dem.n)}</span></div>
    {!x && tt && tt.het_tran ? <HetTran tt={tt} setThem={setThem} /> : !x ? <Empty>{dangTai ? 'Đang lấy đoạn…' : 'Không còn đoạn footage nào cần quyết.'}</Empty> :
      <div className="grid lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-3">
        <div><div className="rounded-xl overflow-hidden bg-slate-900 aspect-video flex items-center justify-center">{x.media_url ? <video key={x.k} src={x.media_url + '#t=' + x.tu + ',' + x.den} controls muted autoPlay className="max-h-full max-w-full" poster={x.khung_url || undefined} /> : x.khung_url ? <img src={x.khung_url} alt="" className="max-h-full max-w-full" /> : null}</div>
          <div className="text-[11px] text-ink-muted mt-1">{x.ten} · giây {x.tu}–{x.den}{x.dong ? ' · ' + x.dong : ''}{x.ngau_nhien ? ' · mẫu ngẫu nhiên' : ''}{x.mo_ta ? ' · ' + x.mo_ta : ''}</div></div>
        <div className="space-y-2 text-xs">
          <div className="rounded-xl border border-line p-2 space-y-1"><div className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold">Số đo · vạch đen là ngưỡng</div>
            <Vach ten="Nét" v={x.so_do.net} lo={ng.net} tot={x.so_do.net >= ng.net} />
            <Vach ten="Rung" v={x.so_do.dong} lo={ng.dong} tot={x.so_do.dong <= ng.dong} />
            <Vach ten="Sáng" v={x.so_do.sang} lo={ng.sang0} hi={ng.sang1} tot={x.so_do.sang >= ng.sang0 && x.so_do.sang <= ng.sang1} />
            <div className="pt-1">Máy nói: <b className={x.may.dung ? 'text-emerald-700' : 'text-rose-700'}>{x.may.dung ? 'dùng được' : 'loại · ' + x.may.ly_do.join(', ')}</b></div>
            <Btn variant="ok" className="!py-1 !px-2 text-[11px]" onClick={() => quyet(x.may.dung, x.may.ly_do)}>Enter · Máy nói đúng</Btn></div>
          <div className="grid grid-cols-2 gap-1"><Phim k="1" onClick={() => quyet(true)}><b>Dùng được</b></Phim>{LY_SOURCE.map(([k, l]) => <Phim key={k} k={k} onClick={() => quyet(false, [l])}>Loại · {l}</Phim>)}</div>
          <Btn variant="ghost" className="!py-1 !px-2 text-[11px]" onClick={qua}>→ Bỏ qua</Btn>
        </div></div>}
  </Card>;
}

// K4 — câu lời này nói về nhóm cảnh nào (thầy Claude đã đọc trước)
function TheLoi() {
  const { goi, notify } = useApp(); const { x, tt, dangTai, qua, gui, setThem, tai } = useHangThe('/doc-loi/hang');
  const [buoc2, setBuoc2] = useState(null); const [dem, setDem] = useState({ n: 0, khop: 0 }); const [dangDoc, setDangDoc] = useState(false);
  useEffect(() => { setBuoc2(null); }, [x && x.k]);
  const chot = async (body) => { if (!x) return; const r = await gui('/mau/' + x.id + '/doc-loi', body); if (r && !body.nghe_sai) setDem(d => ({ n: d.n + 1, khop: d.khop + (r.dung ? 1 : 0) })); };
  const chonNhom = (k) => { const ds = k === 'THI_CONG' ? x.quy_trinh : k === 'THU_NGHIEM' ? x.bai_test_ds : []; if (ds && ds.length) setBuoc2({ nhom: k, ds }); else chot({ nhom: k }); };
  const theoBuoc = (b) => chot(buoc2.nhom === 'THI_CONG' ? { nhom: 'THI_CONG', buoc: b } : { nhom: 'THU_NGHIEM', bai_test: b });
  const dongY = () => chot(x.thay.nghe_sai ? { nghe_sai: true } : { nhom: x.thay.nhom, buoc: x.thay.buoc, bai_test: x.thay.bai_test });
  useKeys((e) => { if (!x) return; const n = parseInt(e.key, 10);
    if (buoc2) { if (e.key === 'Escape' || e.key === 'Backspace') { e.preventDefault(); setBuoc2(null); } else if (n >= 1 && n <= buoc2.ds.length) theoBuoc(buoc2.ds[n - 1]); else if (e.key === 'Enter') chot({ nhom: buoc2.nhom }); return; }
    if (n >= 1 && n <= 8) chonNhom(NHOM_HINH[n - 1].k); else if (e.key === 'Enter') { e.preventDefault(); dongY(); } else if (e.key === '0') chot({ nghe_sai: true }); else if (e.key === 'ArrowRight') qua(); });
  const docNgay = async () => { setDangDoc(true); const r = await goi('/doc-loi/thay', { method: 'POST', body: { so: 60 } }); setDangDoc(false); if (r.ok) { notify('Thầy đã đọc ' + (r.so || 0) + ' câu' + (r.loi ? ' · ' + r.loi : '')); tai(true); } else notify(r.msg, 'err'); };
  const nhan = (o) => o ? tenNhom(o.nhom) + (o.buoc ? ' · ' + o.buoc : '') + (o.bai_test ? ' · ' + o.bai_test : '') : '—';
  return <Card pad="p-3">
    <div className="flex items-center gap-2 flex-wrap mb-2"><SectionTitle>K4 · Câu này nói về gì</SectionTitle>
      {tt && <span className="text-[11px] text-ink-muted">còn {tt.con_lai} câu cần người · {tt.thay_nghe_sai || 0} câu thầy báo máy nghe sai (không đưa vào hộp, chỉ xen ngẫu nhiên để kiểm) · {tt.cho_thay} câu chờ thầy</span>}
      <Btn variant="ghost" className="!py-1 !px-2 text-[11px]" onClick={docNgay} disabled={dangDoc}>{dangDoc ? 'Thầy đang đọc…' : 'Cho thầy đọc ngay 60 câu'}</Btn>
      <span className="ml-auto text-[11px] text-ink-muted">phiên này {dem.n} · thầy đúng {phanTram(dem.khop, dem.n)}</span></div>
    {!x && tt && tt.het_tran ? <HetTran tt={tt} setThem={setThem} /> : !x ? <Empty>{dangTai ? 'Đang lấy câu…' : 'Chưa có câu nào thầy đã đọc mà cần người xác nhận.'}</Empty> :
      <div className="grid lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-3">
        <div className="space-y-2"><div className="rounded-xl border border-line p-3 text-base text-ink leading-relaxed">“{x.text}”</div>
          {x.khung_url && <img src={x.khung_url} alt="khung hình lúc câu này chạy" className="rounded-xl max-h-48" />}
          <div className="text-[11px] text-ink-muted">{x.ten}{x.dong ? ' · ' + x.dong : ''}{x.ngau_nhien ? ' · mẫu ngẫu nhiên' : ''}{x.link ? <> · <a className="underline" href={x.link} target="_blank" rel="noreferrer">mở bài đăng</a></> : null}</div></div>
        <div className="space-y-2 text-xs">
          <div className="rounded-xl border border-line p-2">
            <div><span className="text-ink-muted">Thầy Claude:</span> <b>{x.thay.nghe_sai ? 'câu nghe sai' : nhan(x.thay)}</b> <span className="text-ink-muted">chắc {x.thay.chac}</span></div>
            <div><span className="text-ink-muted">Hình lúc câu này chạy:</span> <b>{nhan(x.hinh)}</b></div>
            {x.lech && <div className="text-rose-700">Lời và hình khác nhóm: lời có thể nói trước hoặc sau cảnh, hoặc một bên sai.</div>}
            <Btn variant="ok" className="!py-1 !px-2 text-[11px] mt-1" onClick={dongY}>Enter · Thầy đúng</Btn></div>
          {!buoc2 ? <div className="grid grid-cols-2 gap-1">{NHOM_HINH.map((n, i) => <Phim key={n.k} k={i + 1} on={x.thay.nhom === n.k} onClick={() => chonNhom(n.k)}><b>{n.ten}</b></Phim>)}</div>
            : <div><div className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold mb-1">{buoc2.nhom === 'THI_CONG' ? 'Bước nào' : 'Bài test nào'} · Enter nếu không rõ · Esc quay lại</div><div className="grid gap-1">{buoc2.ds.map((b, i) => <Phim key={b} k={i + 1} onClick={() => theoBuoc(b)}>{b}</Phim>)}</div></div>}
          <div className="flex gap-1"><Btn variant="ghost" className="!py-1 !px-2 text-[11px]" onClick={() => chot({ nghe_sai: true })}>0 · Máy nghe sai câu</Btn><Btn variant="ghost" className="!py-1 !px-2 text-[11px]" onClick={qua}>→ Bỏ qua</Btn></div>
        </div></div>}
  </Card>;
}

// hộp việc: ba loại thẻ, chỉ một loại mở một lúc (phím không lẫn nhau)
// hộp việc: ba loại thẻ, chỉ một loại mở một lúc (phím không lẫn nhau); số trên tab = thẻ đang chờ
function HopViec({ dongs, dem }) {
  const d = dem || {}; const [loai, setLoai] = useState(() => (d.k1 || !(d.k2 || d.k4)) ? 'hinh' : d.k4 ? 'loi' : 'source'); const [dong, setDong] = useState('');
  return <div className="space-y-2">
    <Tabs size="sm" active={loai} onChange={setLoai} tabs={[{ key: 'hinh', label: 'Khung hình nói gì', count: d.k1 || null }, { key: 'source', label: 'Footage dùng được không', count: d.k2 || null }, { key: 'loi', label: 'Câu thoại nói gì', count: d.k4 || null }]} />
    {loai === 'hinh' && <GanNhanNhanh dong={dong} setDong={setDong} dongs={dongs} />}{loai === 'source' && <TheSource />}{loai === 'loi' && <TheLoi />}
  </div>;
}

// Tab con "🎓 Dạy máy" trong Bộ não AI (chủ 25/09: "mục dạy máy nên nằm trong bộ não … những gì cần hỏi người thì đẩy qua sub tab này").
// Một chỗ cho MỌI việc máy hỏi người khi học: (1) quyết định — bật phiên bản / kỹ năng mới, đề nghị định tuyến; (2) thẻ gán nhãn.
function DayMay({ a, setTab, dem, taiDem }) {
  const { me, goi, notify } = useApp(); const duoc = laGat(me); const [ly, setLy] = useState({}); const [busy, setBusy] = useState(false);
  const pbs = (a.phien_ban || []).filter(p => p.trang_thai === 'CHO_DUYET'); const kn = (a.ky_nang || []).filter(k => k.trang_thai === 'MOI'); const dt = (a.dinh_tuyen || []).filter(x => x.de_nghi);
  const quyet = async (p, q) => { if (q === 'tu-choi' && !(ly[p.id] || '').trim()) return notify('Từ chối phải ghi lý do', 'err'); setBusy(true); const r = await goi('/ai/phien-ban/' + p.id + '/' + q, { method: 'POST', body: { ly_do: ly[p.id] || '' } }); setBusy(false); if (r.ok) notify(q === 'duyet' ? 'Đã bật phiên bản' : 'Đã từ chối'); else notify(r.msg, 'err'); };
  const batKN = async (k) => { setBusy(true); const r = await goi('/lop-hoc/bat', { method: 'POST', body: { tinh_nang: k.tinh_nang_chinh, phien_ban_id: k.ban_moi ? k.ban_moi.id : undefined } }); setBusy(false); if (r.ok) notify('Đã bật máy nhà cho ' + k.ten); else notify(r.msg, 'err'); };
  const soQuyet = pbs.length + kn.length + dt.length; const d = dem || {};
  const [moRong, setMoRong] = useState(false); const aiCfg = ((useApp().db.module_config || {}).ai) || {};
  return <div className="space-y-2">
    <div className="flex items-center gap-2 flex-wrap text-[11px] rounded-xl border border-line bg-white px-3 py-1.5">
      <span className="text-ink-muted">Thầy:</span><b className="text-ink">{(MO_HINH_THAY.find(y => y.id === (aiCfg.thay_nhin_model || 'claude-opus-5')) || {}).ten || aiCfg.thay_nhin_model}</b><span className="text-ink-muted">· suy nghĩ {({ low: 'thấp', medium: 'vừa', high: 'cao' })[aiCfg.thay_nhin_effort || 'medium']} · trần {aiCfg.ngan_sach_thay_usd ?? 20} USD/tháng</span>
      <span className="text-ink-muted">· thầy chốt nhãn, anh/chị chỉ kiểm thẻ dưới đây</span>
      {soQuyet > 0 && <button onClick={() => setMoRong(true)} className="rounded-full bg-amber-100 text-amber-900 px-2 py-0.5 font-semibold">⚑ {soQuyet} việc cần quyết</button>}
      <button onClick={() => setMoRong(!moRong)} className="ml-auto underline text-ink-muted">{moRong ? 'thu gọn' : 'đổi thầy · việc cần quyết'}</button></div>
    {moRong && <><ChonThay />
    <Card pad="p-3"><div className="flex items-center gap-2 mb-1"><SectionTitle>Máy cần anh/chị quyết</SectionTitle><span className="text-[11px] text-ink-muted">{soQuyet ? soQuyet + ' việc' : 'không có việc nào'}</span></div>
      {!soQuyet ? <div className="text-xs text-ink-muted">Máy chưa có bản mới hay đề nghị nào cần duyệt.</div> : <div className="divide-y divide-line text-xs">
        {kn.map(k => <div key={'k' + k.id} className="py-2 flex items-center gap-2 flex-wrap"><Pill cls="bg-emerald-100 text-emerald-800">kỹ năng có bản mới</Pill><b className="text-ink">{k.icon} {k.ten}</b><span className="text-ink-muted">khớp người {k.ban_moi.diem}/100 (cách cũ {k.ban_moi.diem_truoc}) trên {k.ban_moi.n_kiem} mẫu kiểm</span>
          {duoc && <div className="ml-auto flex gap-1"><Btn variant="brand" className="!py-1 !px-2 text-[11px]" onClick={() => batKN(k)} disabled={busy}>Bật bản mới</Btn><Btn variant="ghost" className="!py-1 !px-2 text-[11px]" onClick={() => setTab('ban')}>Xem thử</Btn></div>}</div>)}
        {pbs.map(p => <div key={p.id} className="py-2 flex items-center gap-2 flex-wrap"><Pill cls="bg-amber-100 text-amber-800">phiên bản chờ duyệt</Pill><b className="text-ink">{p.tinh_nang} · {p.phien_ban}</b><span className="text-ink-muted">khớp người {p.danh_gia.diem}/100 trên {p.danh_gia.n_kiem} mẫu kiểm (cách cũ {p.danh_gia.diem_truoc}){p.pham_vi && p.pham_vi !== 'chung' ? ' · bản riêng ' + TEN_PV(p.pham_vi) : ''}</span>
          {duoc && <div className="ml-auto flex gap-1 items-center"><Input className="!py-1 !px-2 text-[11px] !w-40" placeholder="lý do (khi từ chối)" value={ly[p.id] || ''} onChange={e => setLy({ ...ly, [p.id]: e.target.value })} /><Btn variant="ok" className="!py-1 !px-2 text-[11px]" onClick={() => quyet(p, 'duyet')} disabled={busy}>✓ Bật</Btn><Btn variant="ghost" className="!py-1 !px-2 text-[11px]" onClick={() => quyet(p, 'tu-choi')} disabled={busy}>✗ Từ chối</Btn></div>}</div>)}
        {dt.map(x => <div key={'d' + x.tinh_nang} className="py-2 flex items-center gap-2 flex-wrap"><Pill cls="bg-sky-100 text-sky-800">máy đề nghị</Pill><b className="text-ink">{x.ten}</b><span className="text-ink-muted">đề nghị chuyển sang {x.de_nghi}</span><Btn variant="ghost" className="ml-auto !py-1 !px-2 text-[11px]" onClick={() => setTab('mohinh')}>Xem ở Mô hình</Btn></div>)}
      </div>}
    </Card>
</>}
    <HopViec dongs={a.dong_san_pham || []} dem={d} />
  </div>;
}

// Chọn mô hình thầy (chủ 25/09: "tuỳ chọn mô hình ở đâu trong app") — đầu tab Dạy máy; Admin / Trưởng MKT đổi, ghi cấu hình ai.thay_nhin_model
const MO_HINH_THAY = [
  { id: 'claude-opus-5', ten: 'Claude Opus 5', gia: '5 / 25 USD', ghi: 'khuyên dùng: nhìn kỹ, suy nghĩ trước khi gán' },
  { id: 'claude-fable-5-1', ten: 'Claude Fable 5.1', gia: '10 / 50 USD', ghi: 'mạnh nhất, đắt gấp đôi Opus 5' },
  { id: 'claude-sonnet-5', ten: 'Claude Sonnet 5', gia: '2 / 10 USD', ghi: 'rẻ hơn, kém Opus ở chi tiết' },
  { id: 'claude-sonnet-4-5', ten: 'Claude Sonnet 4.5', gia: '3 / 15 USD', ghi: 'đời cũ (dùng tới 25/09)' },
];
function ChonThay() {
  const { db, me, goi, notify } = useApp(); const ai = (db.module_config || {}).ai || {}; const duoc = laGat(me);
  const [m, setM] = useState(ai.thay_nhin_model || 'claude-opus-5'); const [ef, setEf] = useState(ai.thay_nhin_effort || 'medium'); const [tran, setTran] = useState(String(ai.ngan_sach_thay_usd ?? 20)); const [busy, setBusy] = useState(false);
  const luu = async () => { setBusy(true); const r = await goi('/cau-hinh/ai', { method: 'PUT', body: { cau_hinh: { thay_nhin_model: m, thay_nhin_effort: ef, ngan_sach_thay_usd: Math.max(0, Number(tran) || 0) } } }); setBusy(false); if (r.ok) notify('Đã đổi thầy: ' + (MO_HINH_THAY.find(x => x.id === m) || {}).ten); else notify(r.msg, 'err'); };
  const doi = m !== (ai.thay_nhin_model || 'claude-opus-5') || ef !== (ai.thay_nhin_effort || 'medium') || String(tran) !== String(ai.ngan_sach_thay_usd ?? 20);
  const doiMoi = /^claude-(opus-5|fable-5|sonnet-5)/.test(m);
  return <Card pad="p-3"><div className="flex items-center gap-2 flex-wrap text-xs">
    <SectionTitle>Thầy gán nhãn</SectionTitle>
    <Select className="!py-1 !px-2 text-xs !w-56" value={m} disabled={!duoc} onChange={e => setM(e.target.value)}>{MO_HINH_THAY.map(x => <option key={x.id} value={x.id}>{x.ten} · {x.gia}/1 triệu token</option>)}</Select>
    {doiMoi && <Select className="!py-1 !px-2 text-xs !w-40" value={ef} disabled={!duoc} onChange={e => setEf(e.target.value)} title="mức suy nghĩ: cao hơn thì kỹ hơn nhưng tốn hơn"><option value="low">suy nghĩ: thấp</option><option value="medium">suy nghĩ: vừa</option><option value="high">suy nghĩ: cao</option></Select>}
    <span className="text-ink-muted">trần</span><Input className="!py-1 !px-2 text-xs !w-20" value={tran} disabled={!duoc} onChange={e => setTran(e.target.value)} /><span className="text-ink-muted">USD/tháng</span>
    {duoc && doi && <Btn variant="brand" className="!py-1 !px-3 text-[11px]" onClick={luu} disabled={busy}>Lưu</Btn>}
    <span className="text-[11px] text-ink-muted w-full">{(MO_HINH_THAY.find(x => x.id === m) || {}).ghi}. Thầy đọc từng đoạn hình khi máy học video, xem kèm các nhãn anh/chị đã sửa để làm theo. Hết trần thì máy chỉ dùng mô hình mở, không gọi thầy.{!duoc ? ' Chỉ Admin / Trưởng MKT đổi được.' : ''}</span>
  </div></Card>;
}
