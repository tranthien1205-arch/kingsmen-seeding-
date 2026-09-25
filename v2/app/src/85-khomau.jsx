// ===== KHO MẪU + DÒNG SẢN PHẨM (25/09) =====
// Chủ: "kho mẫu thầy và mô hình mở chấm pass cũng cần lưu để tôi kiểm tra cập nhật, sắp xếp thật logic và khoa học" ·
// "định nghĩa các dòng đang bị sai thì tuỳ chỉnh thế nào ở đâu". Nguồn sự thật vẫn là dòng thời gian / mẫu học — kho chỉ là góc nhìn đọc ra + sửa.
const TT_MAU = {
  VANG: { ten: 'Người đã gán', mo: 'nhãn vàng — chuẩn để chấm máy', cls: 'bg-amber-100 text-amber-900' },
  BAC: { ten: 'Thầy + mở khớp', mo: 'nhãn bạc — dùng để dạy mô hình mở', cls: 'bg-slate-200 text-slate-800' },
  LECH: { ten: 'Bất đồng', mo: 'thầy và mô hình mở khác nhau — chờ người', cls: 'bg-rose-100 text-rose-700' },
  THAY: { ten: 'Chỉ thầy', mo: 'thầy đã đọc, mô hình mở chưa', cls: 'bg-sky-100 text-sky-800' },
  MO: { ten: 'Chỉ mô hình mở', mo: 'chưa có thầy đọc (bản cũ)', cls: 'bg-teal-100 text-teal-800' },
  KHONG_RO: { ten: 'Hình không rõ', mo: 'người báo không gán được', cls: 'bg-slate-100 text-slate-500' },
  NGHE_SAI: { ten: 'Nghe sai', mo: 'thầy báo máy chép lời sai', cls: 'bg-slate-100 text-slate-500' },
  CHO_THAY: { ten: 'Chờ thầy', mo: 'câu chưa có thầy đọc', cls: 'bg-slate-100 text-slate-600' },
  LUAT: { ten: 'Chỉ luật máy', mo: 'đo nét/rung/sáng, người chưa quyết', cls: 'bg-teal-100 text-teal-800' },
};
const nhanNgan = (o) => o ? tenNhom(o.nhom) + (o.buoc ? ' · ' + o.buoc : '') + (o.bai_test ? ' · ' + o.bai_test : '') : '—';

function KhoMauAI({ a }) {
  const { goi, notify } = useApp(); const [kn, setKn] = useState('K1'); const [loc, setLoc] = useState({ tt: '', dong: '', nguon: '', q: '' }); const [trang, setTrang] = useState(1);
  const [kq, setKq] = useState(null); const [dang, setDang] = useState(false); const [mo, setMo] = useState(null);
  const tai = async () => { setDang(true); const knGoi = kn; const r = await goi('/kho-mau?kn=' + kn + '&trang=' + trang + '&n=30&tt=' + encodeURIComponent(loc.tt) + '&dong=' + encodeURIComponent(loc.dong) + '&nguon=' + loc.nguon + '&q=' + encodeURIComponent(loc.q)); setDang(false); if (r.ok) { if (r.kn === knGoi) setKq(r); } else notify(r.msg, 'err'); };
  useEffect(() => { tai(); }, [kn, trang, loc.tt, loc.dong, loc.nguon]);
  const doiLoc = (k, v) => { setTrang(1); setMo(null); setLoc({ ...loc, [k]: v }); };
  const ttCua = Object.keys(TT_MAU).filter(k => kq && kq.dem && kq.dem[k]);
  return <Card pad="p-3">
    <div className="flex items-center gap-2 flex-wrap mb-2"><SectionTitle>Kho mẫu</SectionTitle><span className="text-[11px] text-ink-muted">mọi nhãn của mô hình mở, thầy Claude và người · lọc rồi bấm một dòng để xem và sửa</span></div>
    <Tabs size="sm" active={kn} onChange={(k) => { setKq(null); setKn(k); setTrang(1); setMo(null); setLoc({ tt: '', dong: '', nguon: '', q: '' }); }} tabs={[{ key: 'K1', label: 'Khung hình' }, { key: 'K2', label: 'Footage (chất lượng)' }, { key: 'K4', label: 'Câu thoại' }]} />
    {kq && <div className="flex gap-1 flex-wrap my-2">
      <button onClick={() => doiLoc('tt', '')} className={'rounded-full px-2 py-0.5 text-[11px] border ' + (!loc.tt ? 'border-ink font-semibold' : 'border-line')}>Tất cả · {kq.tong}</button>
      {ttCua.map(k => <button key={k} onClick={() => doiLoc('tt', k)} title={TT_MAU[k].mo} className={'rounded-full px-2 py-0.5 text-[11px] border ' + (loc.tt === k ? 'border-ink font-semibold ' : 'border-transparent ') + TT_MAU[k].cls}>{TT_MAU[k].ten} · {kq.dem[k]}</button>)}
    </div>}
    <div className="flex gap-2 flex-wrap items-center mb-2 text-xs">
      <Select className="!py-1 !px-2 text-xs !w-44" value={loc.dong} onChange={e => doiLoc('dong', e.target.value)}><option value="">mọi dòng</option>{((kq && kq.dongs) || []).map(d => <option key={d} value={d}>{d}</option>)}</Select>
      {kn === 'K1' && <Select className="!py-1 !px-2 text-xs !w-40" value={loc.nguon} onChange={e => doiLoc('nguon', e.target.value)}><option value="">footage + thành phẩm</option><option value="FOOTAGE">chỉ footage</option><option value="THANH_PHAM">chỉ video thành phẩm</option></Select>}
      <Input className="!py-1 !px-2 text-xs !w-56" placeholder="tìm tên video, mô tả, câu thoại…" value={loc.q} onChange={e => setLoc({ ...loc, q: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') { setTrang(1); tai(); } }} />
      <Btn variant="ghost" className="!py-1 !px-2 text-[11px]" onClick={() => { setTrang(1); tai(); }}>{dang ? 'Đang lọc…' : 'Lọc'}</Btn>
      {kq && <span className="text-[11px] text-ink-muted ml-auto">{kq.loc} mẫu · trang {kq.trang}/{kq.so_trang}</span>}
    </div>
    {!kq ? <Empty>Đang tải…</Empty> : !kq.hang.length ? <Empty>Không có mẫu nào khớp bộ lọc.</Empty> :
      <div className="divide-y divide-line border border-line rounded-xl overflow-hidden">
        <div className="hidden md:grid grid-cols-[72px_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_110px] gap-2 px-2 py-1 bg-slate-50 text-[10px] uppercase tracking-wider text-ink-muted font-semibold"><span></span><span>Mẫu</span><span>{kn === 'K2' ? 'Số đo' : kn === 'K4' ? 'Hình lúc đó' : 'Mô hình mở'}</span><span>{kn === 'K2' ? 'Luật máy' : 'Thầy Claude'}</span><span>Người</span><span>Trạng thái</span></div>
        {kq.hang.map(x => <div key={x.k}>
          <button onClick={() => setMo(mo === x.k ? null : x.k)} className={'w-full text-left grid grid-cols-[56px_minmax(0,1fr)] md:grid-cols-[72px_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_110px] gap-2 px-2 py-1.5 text-xs hover:bg-slate-50 ' + (mo === x.k ? 'bg-slate-50' : '')}>
            <div className="rounded-md bg-slate-200 overflow-hidden aspect-video">{x.khung_url ? <img src={x.khung_url} alt="" className="w-full h-full object-cover" loading="lazy" /> : null}</div>
            <div className="min-w-0"><div className="text-ink truncate">{kn === 'K4' ? '“' + x.text + '”' : (x.mo_ta || '—')}</div><div className="text-[10px] text-ink-muted truncate">{x.ten}{x.tu != null ? ' · giây ' + x.tu + '–' + x.den : ''}{x.dong ? ' · ' + x.dong : ''}</div>
              <div className="md:hidden text-[10px] mt-0.5"><Pill cls={(TT_MAU[x.tt] || {}).cls}>{(TT_MAU[x.tt] || {}).ten}</Pill> <span className="text-ink-muted">{x.nguoi ? 'người: ' + nhanNgan(x.nguoi) : x.thay ? 'thầy: ' + nhanNgan(x.thay) : x.mo ? 'mở: ' + nhanNgan(x.mo) : ''}</span></div></div>
            <div className="hidden md:block min-w-0 text-[11px]">{kn === 'K2' ? (x.so_do ? <span className="tabular-nums">nét {x.so_do.net} · rung {x.so_do.dong} · sáng {x.so_do.sang}</span> : '—') : kn === 'K4' ? nhanNgan(x.hinh) : nhanNgan(x.mo)}</div>
            <div className="hidden md:block min-w-0 text-[11px]">{kn === 'K2' ? (!x.may ? '—' : x.may.dung ? 'dùng được' : 'loại · ' + x.may.ly_do.join(', ')) : x.thay ? <>{x.thay.nghe_sai ? 'nghe sai' : nhanNgan(x.thay)} <span className="text-ink-muted">· {x.thay.chac ?? ''}</span></> : '—'}</div>
            <div className="hidden md:block min-w-0 text-[11px]">{x.nguoi ? (kn === 'K2' ? (x.nguoi.dung ? 'dùng được' : 'loại · ' + (x.nguoi.ly_do || []).join(', ')) : x.nguoi.nghe_sai ? 'nghe sai' : nhanNgan(x.nguoi)) : '—'}{x.phan ? <span className="text-ink-muted"> · gán từng khung</span> : null}</div>
            <div className="hidden md:block"><Pill cls={(TT_MAU[x.tt] || {}).cls}>{(TT_MAU[x.tt] || {}).ten}</Pill></div>
          </button>
          {mo === x.k && <SuaMau x={x} onXong={() => { setMo(null); tai(); }} />}
        </div>)}
      </div>}
    {kq && kq.so_trang > 1 && <div className="flex gap-1 justify-end mt-2"><Btn variant="ghost" className="!py-1 !px-2 text-[11px]" disabled={trang <= 1} onClick={() => setTrang(trang - 1)}>← Trước</Btn><Btn variant="ghost" className="!py-1 !px-2 text-[11px]" disabled={trang >= kq.so_trang} onClick={() => setTrang(trang + 1)}>Sau →</Btn></div>}
  </Card>;
}

// sửa một mẫu ngay trong kho — dùng đúng các đường ghi nhãn của Dạy máy (một nguồn sự thật)
function SuaMau({ x, onXong }) {
  const { goi, notify } = useApp(); const goc = x.nguoi || x.thay || x.mo || x.hinh || { nhom: 'KHAC' };
  const [v, setV] = useState({ nhom: goc.nhom || 'KHAC', buoc: goc.buoc || null, bai_test: goc.bai_test || null, mo_ta: (x.nguoi && x.nguoi.mo_ta) || '' }); const [busy, setBusy] = useState(false);
  const qd = x.quy_trinh || []; const luu = async (body) => { setBusy(true); const duong = x.kn === 'K4' ? '/mau/' + x.id + '/doc-loi' : x.kn === 'K2' ? '/tai-san/' + x.id + '/doan/' + x.i + '/source' : (x.nguon === 'THANH_PHAM' ? '/kho-thanh-pham/' : '/tai-san/') + x.id + '/doan/' + x.i;
    const r = await goi(duong, { method: 'POST', body: { ...body, nhe: true } }); setBusy(false); if (r.ok) { notify('Đã cập nhật mẫu'); onXong(); } else notify(r.msg, 'err'); };
  return <div className="bg-slate-50 px-3 py-2 text-xs space-y-2">
    <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
      <div>{x.kn === 'K4' ? <div className="text-sm text-ink">“{x.text}”</div> : x.khung_url ? <img src={x.khung_url} alt="" className="rounded-lg max-h-56" /> : null}
        <div className="text-[11px] text-ink-muted mt-1">{x.ten}{x.tu != null ? ' · giây ' + x.tu + '–' + x.den : ''}{x.link ? <> · <a className="underline" href={x.link} target="_blank" rel="noreferrer">mở bài đăng</a></> : null}{x.media_url ? <> · <a className="underline" href={x.media_url + '#t=' + x.tu} target="_blank" rel="noreferrer">mở clip</a></> : null}</div>
        {x.thay && x.thay.ly_do && <div className="text-[11px] text-ink-muted">Thầy giải thích: {x.thay.ly_do}{x.thay.model ? ' (' + x.thay.model + ')' : ''}</div>}
        {x.nguoi && x.nguoi.ai && <div className="text-[11px] text-ink-muted">Người gán: {x.nguoi.ai}{x.nguoi.luc ? ' · ' + fmtDate(x.nguoi.luc) : ''}</div>}
        {x.phan && <div className="text-[11px] text-ink-muted">Từng khung: {x.phan.filter(Boolean).map((p) => 'khung ' + (p.k + 1) + ' ' + nhanNgan(p)).join(' · ')}</div>}</div>
      <div className="space-y-1">
        {x.kn === 'K2' ? <><div className="font-semibold text-ink">Đoạn này dùng được không?</div><div className="flex gap-1 flex-wrap"><Btn variant="ok" className="!py-1 !px-2 text-[11px]" disabled={busy} onClick={() => luu({ dung: true, ly_do: [] })}>Dùng được</Btn>{['mờ', 'rung', 'tối', 'cháy sáng', 'che khuất', 'bố cục xấu'].map(l => <Btn key={l} variant="ghost" className="!py-1 !px-2 text-[11px]" disabled={busy} onClick={() => luu({ dung: false, ly_do: [l] })}>Loại · {l}</Btn>)}</div></>
          : <><div className="font-semibold text-ink">Nhãn đúng</div><ChonNhan v={v} x={{ quy_trinh: qd, bai_test_ds: [] }} onChange={setV} />
            <div className="flex gap-1 flex-wrap"><Btn variant="brand" className="!py-1 !px-3 text-[11px]" disabled={busy} onClick={() => luu({ nhom: v.nhom, buoc: v.buoc && v.buoc.trim() || null, bai_test: v.bai_test && v.bai_test.trim() || null, mo_ta: (v.mo_ta || '').trim() || undefined })}>Lưu nhãn</Btn>
              {x.kn === 'K4' ? <Btn variant="ghost" className="!py-1 !px-2 text-[11px]" disabled={busy} onClick={() => luu({ nghe_sai: true })}>Máy nghe sai câu</Btn> : <Btn variant="ghost" className="!py-1 !px-2 text-[11px]" disabled={busy} onClick={() => luu({ khong_ro: true })}>Hình không rõ</Btn>}</div></>}
      </div>
    </div>
  </div>;
}

// Dòng sản phẩm: dòng đến từ 3 chỗ — Danh mục sản phẩm · luật tên thư mục/kênh khi học video · sửa tay từng video. Đổi tên / gộp một lần là đổi ở cả ba.
function DongSanPham() {
  const { me, goi, notify } = useApp(); const duoc = laGat(me); const [d, setD] = useState(null); const [ten, setTen] = useState({}); const [ax, setAx] = useState([]); const [busy, setBusy] = useState(false);
  const tai = async () => { const r = await goi('/dong-san-pham'); if (r.ok) { setD(r); setAx(r.anh_xa_dong || []); } else notify(r.msg, 'err'); };
  useEffect(() => { tai(); }, []);
  const doiTen = async (tu) => { const sang = (ten[tu] || '').trim(); if (!sang) return notify('Gõ tên mới', 'err'); setBusy(true); const r = await goi('/dong-san-pham/doi-ten', { method: 'POST', body: { tu, sang } }); setBusy(false); if (r.ok) { notify('Đã đổi "' + tu + '" → "' + sang + '"'); setTen({ ...ten, [tu]: '' }); setD(r); setAx(r.anh_xa_dong || []); } else notify(r.msg, 'err'); };
  const luuLuat = async () => { setBusy(true); const r = await goi('/cau-hinh/huan_luyen', { method: 'PUT', body: { cau_hinh: { anh_xa_dong: ax.filter(x => x.chua && x.dong).map(x => ({ chua: x.chua.trim(), dong: x.dong.trim() })) } } }); setBusy(false); if (r.ok) { notify('Đã lưu luật nhận dòng — máy học dùng từ lượt sau'); tai(); } else notify(r.msg, 'err'); };
  if (!d) return <Card pad="p-3"><Empty>Đang tải dòng sản phẩm…</Empty></Card>;
  const danhSach = d.dong.filter(x => x.dong !== '(chưa có)').map(x => x.dong);
  return <Card pad="p-3" className="space-y-3">
    <div><SectionTitle>Dòng sản phẩm</SectionTitle><div className="text-[11px] text-ink-muted">Dòng đến từ ba chỗ: <b>Danh mục sản phẩm</b> (Chiến lược › Danh mục › Sản phẩm, ô Dòng), <b>luật nhận dòng</b> khi máy học video (tên thư mục Drive / kênh chứa chữ gì), và <b>sửa tay từng video</b> ở danh sách video bên dưới. Dòng sai tên thì đổi tên ở bảng này, gõ tên dòng đã có để <b>gộp</b>: đổi một lần là đổi ở sản phẩm, video và kho mẫu.</div></div>
    <div className="overflow-x-auto"><table className="w-full text-xs min-w-[560px]"><thead><tr className="text-left text-ink-muted"><th className="px-2 py-1">Dòng</th><th className="px-2 py-1 text-right">Sản phẩm</th><th className="px-2 py-1 text-right">Video học</th><th className="px-2 py-1 text-right">Footage</th><th className="px-2 py-1 text-right">Mẫu</th><th className="px-2 py-1">Đổi tên / gộp vào</th></tr></thead>
      <tbody>{d.dong.map(x => <tr key={x.dong} className="border-t border-line/60"><td className="px-2 py-1 font-semibold text-ink">{x.dong}</td><td className="px-2 py-1 text-right tabular-nums">{x.san_pham}</td><td className="px-2 py-1 text-right tabular-nums">{x.video}</td><td className="px-2 py-1 text-right tabular-nums">{x.footage}</td><td className="px-2 py-1 text-right tabular-nums">{x.mau}</td>
        <td className="px-2 py-1">{duoc && x.dong !== '(chưa có)' ? <div className="flex gap-1"><Input className="!py-0.5 !px-1.5 text-[11px] !w-36" list="ds-dong-doi" placeholder="tên đúng" value={ten[x.dong] || ''} onChange={e => setTen({ ...ten, [x.dong]: e.target.value })} /><Btn variant="ghost" className="!py-0.5 !px-2 text-[11px]" disabled={busy} onClick={() => doiTen(x.dong)}>Đổi</Btn></div> : x.dong === '(chưa có)' ? <span className="text-[10px] text-ink-muted">gán dòng cho từng video ở danh sách bên dưới</span> : null}</td></tr>)}</tbody></table>
      <datalist id="ds-dong-doi">{danhSach.map(x => <option key={x} value={x} />)}</datalist></div>
    <div><div className="font-semibold text-ink text-xs mb-1">Luật nhận dòng khi học video</div><div className="text-[11px] text-ink-muted mb-1">Tên thư mục hoặc kênh <b>chứa</b> chữ ở cột trái (không phân biệt hoa thường, có dấu hay không) thì video thuộc dòng ở cột phải. Luật trên cùng khớp trước. Không khớp luật nào thì để trống dòng, không đoán.</div>
      <div className="space-y-1">{ax.map((x, i) => <div key={i} className="flex gap-1 items-center max-w-md"><Input className="!py-0.5 !px-1.5 text-[11px] flex-1 min-w-0" value={x.chua} disabled={!duoc} placeholder="chữ trong tên thư mục, vd FINEX" onChange={e => setAx(ax.map((y, j) => j === i ? { ...y, chua: e.target.value } : y))} /><span className="text-ink-muted">→</span><Input className="!py-0.5 !px-1.5 text-[11px] flex-1 min-w-0" list="ds-dong-doi" value={x.dong} disabled={!duoc} placeholder="dòng" onChange={e => setAx(ax.map((y, j) => j === i ? { ...y, dong: e.target.value } : y))} />{duoc && <Btn variant="ghost" className="!py-0.5 !px-1.5 text-[11px]" onClick={() => setAx(ax.filter((_, j) => j !== i))}>✕</Btn>}</div>)}</div>
      {duoc && <div className="flex gap-1 mt-1"><Btn variant="ghost" className="!py-1 !px-2 text-[11px]" onClick={() => setAx([...ax, { chua: '', dong: '' }])}>＋ Thêm luật</Btn><Btn variant="brand" className="!py-1 !px-3 text-[11px]" disabled={busy} onClick={luuLuat}>Lưu luật</Btn></div>}</div>
  </Card>;
}

// ===== các tab con đã gom (25/09, chủ: "hệ thống lại ui của tất cả sub tab bộ não AI có bị chồng chéo thì gom gọn lại") =====
function PhienBanDs({ a }) {
  const pbs = a.phien_ban || [];
  return <Card pad=""><div className="px-3 py-2 border-b border-line flex items-center gap-2"><SectionTitle>Phiên bản mô hình</SectionTitle><span className="text-[11px] text-ink-muted">lịch sử; bản chờ duyệt bật / từ chối ở tab Dạy máy</span></div>
    {!pbs.length ? <Empty>Chưa có phiên bản nào.</Empty> : <div className="divide-y divide-line">{pbs.map(p => <div key={p.id} className="px-3 py-1.5 text-xs flex items-center gap-2 flex-wrap"><Pill cls={p.trang_thai === 'DUYET' ? 'bg-emerald-100 text-emerald-800' : p.trang_thai === 'TU_CHOI' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800'}>{p.trang_thai === 'CHO_DUYET' ? 'chờ duyệt' : p.trang_thai === 'DUYET' ? 'đang dùng' : 'từ chối'}</Pill><b className="text-ink">{p.tinh_nang} · {p.phien_ban}</b>{p.pham_vi && p.pham_vi !== 'chung' && <Pill cls="bg-sky-100 text-sky-800">{TEN_PV(p.pham_vi)}</Pill>}<span className="text-ink-muted">khớp người {p.danh_gia.diem}/100 trên {p.danh_gia.n_kiem} mẫu kiểm (cách cũ {p.danh_gia.diem_truoc}) · {p.may} · {fmtDate(p.created_at)}{p.duyet_boi ? ' · ' + p.duyet_boi + (p.ly_do ? ': ' + p.ly_do : '') : ''}</span></div>)}</div>}
  </Card>;
}
function TongQuanNao({ a, setTab, dem, soQuyet }) {
  const { db, me } = useApp(); const duoc = laGat(me);
  return <div className="space-y-3"><BanHuanLuyen a={a} setTab={setTab} dem={dem} soQuyet={soQuyet} /><KyNang a={a} duoc={duoc} db={db} /><PhienBanDs a={a} /><TienTrinh a={a} db={db} /><NhatKyHoc a={a} /></div>;
}
function KhoNao({ a }) {
  const { me } = useApp(); const duoc = laGat(me); const dongs = a.dong_san_pham || [];
  return <div className="space-y-3"><KhoMauAI a={a} /><DongSanPham /><NapMotO a={a} duoc={duoc} /><KhoMau a={a} duoc={duoc} dongs={dongs} /></div>;
}
function MoHinhNao({ a }) { return <div className="space-y-3"><HuanLuyenAI a={a} phan="mo_hinh" /><MoHinhAI a={a} /><DinhTuyenAI a={a} /></div>; }
function ChiPhiNao({ a }) { return <div className="space-y-3"><ChiPhiMoHinh a={a} /><KhoaAPI /></div>; }
