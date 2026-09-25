// ADR-018: hộp việc gom vào Kho mẫu (Duyệt tuần tự). Ở đây còn: việc cần quyết (Tổng quan) và chọn thầy (Bộ nhãn).
function ViecCanQuyet({ a, setTab, soDeXuat }) {
  const { me, goi, notify } = useApp(); const duoc = laGat(me); const [ly, setLy] = useState({}); const [busy, setBusy] = useState(false);
  const pbs = (a.phien_ban || []).filter(p => p.trang_thai === 'CHO_DUYET'); const kn = (a.ky_nang || []).filter(k => k.trang_thai === 'MOI'); const dt = (a.dinh_tuyen || []).filter(x => x.de_nghi);
  const quyet = async (p, q) => { if (q === 'tu-choi' && !(ly[p.id] || '').trim()) return notify('Từ chối phải ghi lý do', 'err'); setBusy(true); const r = await goi('/ai/phien-ban/' + p.id + '/' + q, { method: 'POST', body: { ly_do: ly[p.id] || '' } }); setBusy(false); if (r.ok) notify(q === 'duyet' ? 'Đã bật phiên bản' : 'Đã từ chối'); else notify(r.msg, 'err'); };
  const batKN = async (k) => { setBusy(true); const r = await goi('/lop-hoc/bat', { method: 'POST', body: { tinh_nang: k.tinh_nang_chinh, phien_ban_id: k.ban_moi ? k.ban_moi.id : undefined } }); setBusy(false); if (r.ok) notify('Đã bật máy nhà cho ' + k.ten); else notify(r.msg, 'err'); };
  const soQuyet = pbs.length + kn.length + dt.length + (soDeXuat > 0 ? 1 : 0);
  return <Card pad="p-3" className="!rounded-[14px] !shadow-none"><div className="flex items-center gap-2 mb-1"><span className="font-bold text-sm">Việc cần quyết</span><span className="text-[11px] text-ink-muted">{soQuyet ? soQuyet + ' việc' : 'không có việc nào'}</span></div>
      {!soQuyet ? <div className="text-xs text-ink-muted">Máy chưa có bản mới hay đề nghị nào cần duyệt.</div> : <div className="divide-y divide-line text-xs">
        {soDeXuat > 0 && <div className="py-2 flex items-center gap-2 flex-wrap"><Pill cls="bg-[#FFF9E8] text-[#8A6410]">bộ nhãn</Pill><b className="text-ink">{soDeXuat} nhãn đề xuất chờ duyệt</b><Btn variant="ghost" className="ml-auto !py-1 !px-2 text-[11px]" onClick={() => setTab('bonhan')}>Mở Bộ nhãn</Btn></div>}
        {kn.map(k => <div key={'k' + k.id} className="py-2 flex items-center gap-2 flex-wrap"><Pill cls="bg-emerald-100 text-emerald-800">kỹ năng có bản mới</Pill><b className="text-ink">{k.icon} {k.ten}</b><span className="text-ink-muted">khớp người {k.ban_moi.diem}/100 (cách cũ {k.ban_moi.diem_truoc}) trên {k.ban_moi.n_kiem} mẫu kiểm</span>
          {duoc && <div className="ml-auto flex gap-1"><Btn variant="brand" className="!py-1 !px-2 text-[11px]" onClick={() => batKN(k)} disabled={busy}>Bật bản mới</Btn><Btn variant="ghost" className="!py-1 !px-2 text-[11px]" onClick={() => setTab('mohinh')}>Xem thử</Btn></div>}</div>)}
        {pbs.map(p => <div key={p.id} className="py-2 flex items-center gap-2 flex-wrap"><Pill cls="bg-amber-100 text-amber-800">phiên bản chờ duyệt</Pill><b className="text-ink">{p.tinh_nang} · {p.phien_ban}</b><span className="text-ink-muted">khớp người {p.danh_gia.diem}/100 trên {p.danh_gia.n_kiem} mẫu kiểm (cách cũ {p.danh_gia.diem_truoc}){p.pham_vi && p.pham_vi !== 'chung' ? ' · bản riêng ' + TEN_PV(p.pham_vi) : ''}</span>
          {duoc && <div className="ml-auto flex gap-1 items-center"><Input className="!py-1 !px-2 text-[11px] !w-40" placeholder="lý do (khi từ chối)" value={ly[p.id] || ''} onChange={e => setLy({ ...ly, [p.id]: e.target.value })} /><Btn variant="ok" className="!py-1 !px-2 text-[11px]" onClick={() => quyet(p, 'duyet')} disabled={busy}>✓ Bật</Btn><Btn variant="ghost" className="!py-1 !px-2 text-[11px]" onClick={() => quyet(p, 'tu-choi')} disabled={busy}>✗ Từ chối</Btn></div>}</div>)}
        {dt.map(x => <div key={'d' + x.tinh_nang} className="py-2 flex items-center gap-2 flex-wrap"><Pill cls="bg-sky-100 text-sky-800">máy đề nghị</Pill><b className="text-ink">{x.ten}</b><span className="text-ink-muted">đề nghị chuyển sang {x.de_nghi}</span><Btn variant="ghost" className="ml-auto !py-1 !px-2 text-[11px]" onClick={() => setTab('mohinh')}>Xem ở Mô hình</Btn></div>)}
      </div>}
    </Card>;
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
