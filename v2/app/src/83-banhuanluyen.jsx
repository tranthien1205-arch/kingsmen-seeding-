// ADR-017 — BÀN HUẤN LUYỆN: sáu làn × dòng sản phẩm (chặng tính từ dữ liệu thật ở /ban-huan-luyen), nguồn lực, hộp việc của người.
const TEN_CHANG = ['', '1 · Gom', '2 · Thầy gán', '3 · Người', '4 · Đo', '5 · Bóng', '6 · Bật'];
const MAU_CHANG = ['', 'bg-slate-100 text-slate-600', 'bg-sky-100 text-sky-800', 'bg-amber-100 text-amber-800', 'bg-teal-100 text-teal-800', 'bg-emerald-100 text-emerald-800', 'bg-emerald-600 text-white'];
const TEN_SO_DO = { cau: 'câu có lời', luat_khop_pct: '% ngưỡng hiện tại khớp người', ngau_nhien_khop_pct: '% khớp · mẫu ngẫu nhiên', hoc_khop_pct: '% ngưỡng máy học khớp', nghe_sai_pct: '% câu nghe sai (người)', thay_nghe_sai_pct: '% câu nghe sai (thầy)', doan: 'đoạn đã đọc', thay: 'thầy đã đọc', bat_dong_pct: '% thầy khác mô hình mở', vang: 'nhãn vàng', dung_ngau_nhien_pct: '% đúng · mẫu ngẫu nhiên', thay_pct: '% thầy đúng', mo_pct: '% mô hình mở đúng', cau_co_loi: 'câu có lời', video_da_air: 'video đã air' };
const TEN_TG = { tai: 'Tải', cat: 'Cắt shot', nghe: 'Nghe lời', anh_shot: 'Ảnh + dò gốc', nhin: 'Đọc hình (qwen)', thay: 'Thầy Claude' };

function OBan({ x, onClick, chon }) {
  if (!x) return <span className="text-[10px] text-ink-muted px-1.5">theo chung</span>;
  const vien = 'text-left w-full rounded-lg px-1.5 py-1 hover:bg-slate-50 ' + (chon ? 'ring-1 ring-ink' : '');
  if (x.cho) return <button onClick={onClick} className={vien}><Pill cls="bg-rose-100 text-rose-700">{x.thieu}</Pill>{x.ghi_chu && <div className="text-[10px] text-ink-muted mt-0.5">{x.ghi_chu}</div>}</button>;
  if (x.chua_lam) return <button onClick={onClick} className={vien}><Pill>{x.thieu}</Pill><div className="text-[10px] text-ink-muted mt-0.5">{Object.entries(x.so_do || {}).map(([k, v]) => (TEN_SO_DO[k] || k) + ': ' + v).join(' · ')}</div></button>;
  return <button onClick={onClick} className={vien}><div className="space-y-0.5"><Pill cls={MAU_CHANG[x.chang]}>{TEN_CHANG[x.chang]}</Pill><div className="text-[10px] text-ink-muted leading-tight">{x.thieu}</div>{x.tien_do != null && <div className="h-1 rounded bg-slate-100 overflow-hidden"><div className="h-full bg-teal-600" style={{ width: Math.min(100, x.tien_do) + '%' }} /></div>}</div></button>;
}

function BanHuanLuyen({ a, setTab, dem, soQuyet }) {
  const { goi, notify } = useApp(); const [b, setB] = useState(null); const [chon, setChon] = useState(null); const [dongHV, setDongHV] = useState(''); const dongs = a.dong_san_pham || [];
  const tai = async () => { const r = await goi('/ban-huan-luyen'); if (r.ok) setB(r); else notify(r.msg, 'err'); };
  useEffect(() => { tai(); }, []);
  if (!b) return <Card pad="p-3"><Empty>Đang tính bàn huấn luyện…</Empty></Card>;
  const nl = b.nguon_luc || {}; const may = nl.may || []; const tg = nl.thoi_gian_tb; const ng = nl.nguoi || {}; const th = nl.thay || {};
  const chay = b.lan.filter(l => { const c = b.o[l.k].chung; return c && !c.cho && !c.chua_lam; }).length;
  const oChon = chon ? (chon.dong ? (b.o[chon.k].dong || {})[chon.dong] : b.o[chon.k].chung) : null;
  const tongTg = tg ? Object.keys(TEN_TG).reduce((s, k) => s + (tg[k] || 0), 0) || 1 : 1;
  const kpi = [
    [chay + ' / ' + b.lan.length, 'làn đang chạy'],
    [String(ng.doan_chua_gan ?? '—'), 'đoạn hình chưa người gán'],
    [may.map(m => m.ten.replace(/\s*\(.*\)/, '') + (m.song ? (m.dang_lam ? ' bận' : ' rảnh') : ' tắt')).join(' · ') || '—', 'máy · ' + may.reduce((s, m) => s + (m.hang || 0), 0) + ' lệnh chờ'],
    [(th.usd ?? 0) + ' / ' + (th.tran_usd || '∞') + ' USD', 'thầy Claude tháng này · ' + (th.lan || 0) + ' lượt' + (th.bat === false ? ' · ĐANG TẮT' : '')],
  ];
  return <div className="space-y-3">
    <Callout tone="info"><b>Bàn huấn luyện.</b> Sáu kỹ năng máy cần học đi cùng một khuôn sáu chặng: Gom → Thầy gán → Người xác nhận → Đo → Bóng → Bật. Kỹ năng sau mở khi kỹ năng trước tới Bóng. Trong mỗi kỹ năng, dòng sản phẩm đủ dữ liệu đi trước. Ô đỏ nói rõ đang chờ kỹ năng nào. Anh/chị chỉ làm ở hộp việc bên dưới.</Callout>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">{kpi.map(([v, t]) => <div key={t} className="rounded-xl border border-line bg-white p-2"><div className="text-lg font-bold text-ink tabular-nums leading-tight">{v}</div><div className="text-[11px] text-ink-muted">{t}</div></div>)}</div>
    <Card pad="p-3">
      <div className="flex items-center gap-2 mb-1 flex-wrap"><SectionTitle>Làn × dòng sản phẩm</SectionTitle><span className="text-[11px] text-ink-muted">mỗi ô: chặng · còn thiếu gì để qua cổng · bấm để xem số đo</span><Btn variant="ghost" className="ml-auto !py-1 !px-2 text-[11px]" onClick={tai}>Tính lại</Btn></div>
      <div className="overflow-x-auto"><table className="w-full text-xs min-w-[760px]">
        <thead><tr className="text-left text-ink-muted"><th className="px-2 py-1 w-40">Làn</th><th className="px-2 py-1">Chung</th>{b.dongs.map(d => <th key={d} className="px-2 py-1">{d}</th>)}</tr></thead>
        <tbody>{b.lan.map(l => <tr key={l.k} className="border-t border-line/60 align-top">
          <td className="px-2 py-1.5"><b className="text-ink">{l.k} · {l.ten}</b><div className="text-[10px] text-ink-muted">đợt {l.dot}{l.cho ? ' · cần ' + l.cho.join(' + ') : ''}</div></td>
          <td className="px-1 py-1"><OBan x={b.o[l.k].chung} chon={chon && chon.k === l.k && !chon.dong} onClick={() => setChon({ k: l.k })} /></td>
          {b.dongs.map(d => <td key={d} className="px-1 py-1"><OBan x={(b.o[l.k].dong || {})[d]} chon={chon && chon.k === l.k && chon.dong === d} onClick={() => setChon({ k: l.k, dong: d })} /></td>)}
        </tr>)}</tbody></table></div>
      {oChon && <div className="mt-2 rounded-xl border border-line p-2 text-xs">
        <div className="font-semibold text-ink mb-1">{chon.k} · {chon.dong || 'Chung'} {oChon.chang ? <Pill cls={MAU_CHANG[oChon.chang]}>{TEN_CHANG[oChon.chang]}</Pill> : null}</div>
        <div className="text-ink-muted mb-1">Cổng tiếp: {oChon.thieu}</div>
        {oChon.so_do && <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">{Object.entries(TEN_SO_DO).filter(([k]) => k in oChon.so_do).map(([k, t]) => <div key={k} className="rounded-lg bg-slate-50 px-2 py-1"><div className="font-bold tabular-nums text-ink">{oChon.so_do[k] == null ? '—' : oChon.so_do[k] + (/pct/.test(k) ? '%' : '')}</div><div className="text-[10px] text-ink-muted">{t}</div></div>)}</div>}
      </div>}
    </Card>
    <Card pad="p-3"><SectionTitle className="mb-1">Máy học mất thời gian ở đâu</SectionTitle>
      {tg ? <div className="space-y-1 text-xs">{Object.entries(TEN_TG).filter(([k]) => tg[k] != null).map(([k, t]) => <div key={k} className="flex items-center gap-2"><span className="w-32 text-ink-muted">{t}</span><div className="flex-1 h-2 rounded bg-slate-100 overflow-hidden"><div className="h-full bg-teal-600" style={{ width: (tg[k] / tongTg * 100) + '%' }} /></div><span className="w-20 text-right tabular-nums">{tg[k]} giây</span></div>)}
        <div className="text-[10px] text-ink-muted">Trung bình {tg.so_video} video gần nhất. Tải, cắt, nghe chiếm phần lớn thì mới đáng chuyển sang máy Ngoc-Han; đọc hình chiếm phần lớn thì giữ Q2.</div></div>
        : <div className="text-xs text-ink-muted">Chưa có số đo. Máy học ghi thời gian từng chặng từ lượt học tiếp theo.</div>}
    </Card>
    <BangDoHinh d={a.do_chinh_xac_hinh || {}} />
    <Card pad="p-3" className="cursor-pointer hover:border-brand" onClick={() => setTab('daymay')}><div className="flex items-center gap-2 flex-wrap"><span className="text-xl">🎓</span><div className="flex-1 text-xs"><b className="text-ink">Máy đang hỏi anh/chị:</b> {soQuyet || 0} việc cần quyết · {dem ? dem.k1 + dem.k2 + dem.k4 : '…'} thẻ gán nhãn. Hôm nay đã làm {ng.phut_hom_nay ?? 0} / {ng.tran_phut || '∞'} phút.</div><Btn variant="brand" className="!py-1 !px-3 text-[11px]" onClick={(e) => { e.stopPropagation(); setTab('daymay'); }}>Mở Dạy máy →</Btn></div></Card>
  </div>;
}
