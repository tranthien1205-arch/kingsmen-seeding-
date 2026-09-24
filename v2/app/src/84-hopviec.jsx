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
function HopViec({ dongs }) {
  const [loai, setLoai] = useState('hinh'); const [dong, setDong] = useState('');
  return <div className="space-y-2">
    <Tabs size="sm" active={loai} onChange={setLoai} tabs={[{ key: 'hinh', label: 'K1 · Nhãn hình' }, { key: 'source', label: 'K2 · Source' }, { key: 'loi', label: 'K4 · Câu lời' }]} />
    {loai === 'hinh' && <GanNhanNhanh dong={dong} setDong={setDong} dongs={dongs} />}{loai === 'source' && <TheSource />}{loai === 'loi' && <TheLoi />}
  </div>;
}
