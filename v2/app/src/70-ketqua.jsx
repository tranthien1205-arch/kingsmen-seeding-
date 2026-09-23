// ===== MÀN 4 — KẾT QUẢ & BÁO CÁO (ADR-005): 3 mức tin cậy · KPI brand/bán hàng · nhập/đối soát · báo cáo máy viết · đề xuất G4 =====
const MUC_KQ_CLS = { TRUC_TIEP:'bg-emerald-100 text-emerald-800', GIAN_TIEP:'bg-amber-100 text-amber-800', KHONG_QUY_DON:'bg-sky-100 text-sky-800' };
function KetQuaBaoCao(){
  const { db, me } = useApp(); const mp=db.mo_phong; const [tab,setTab]=useState('ketqua');
  const dxCho=(db.de_xuat||[]).filter(d=>d.trang_thai==='CHO').length;
  return <div className="space-y-4">
    <PageHeader title="📈 Kết quả & Báo cáo" sub="Ba mức tin cậy tách bạch, không cộng dồn · brand đo tiếp cận/xem/chia sẻ, bán hàng đo đơn · máy viết báo cáo, người quyết đề xuất (G4)."/>
    <Tabs size="sm" active={tab} onChange={setTab} tabs={[{key:'ketqua',label:'Kết quả'},{key:'baocao',label:'Báo cáo',count:(db.bao_cao||[]).filter(b=>b.trang_thai==='NHAP').length||null},{key:'dexuat',label:'Đề xuất cải tiến (G4)',count:dxCho||null}]}/>
    {tab==='ketqua' && <KetQuaTab/>}{tab==='baocao' && <BaoCaoTab/>}{tab==='dexuat' && <DeXuatTab/>}
  </div>;
}
function KetQuaTab(){
  const { db, me, goi, notify } = useApp(); const chiXem=!laStaff(me); const [thang,setThang]=useState(db.hang_so.thang_nay); const [form,setForm]=useState(null); const [doiSoat,setDoiSoat]=useState(false); const [busy,setBusy]=useState(false);
  const KQ=(db.ket_qua||[]).filter(k=>(k.ky||'').startsWith(thang)); const sum=(arr,f)=>arr.reduce((s,x)=>s+(Number(x[f])||0),0); const muc=m=>KQ.filter(k=>k.muc_tin_cay===m);
  const mucCua=id=>(db.muc_noi_dung||[]).find(m=>m.id===id)||{}; const bdCua=id=>(db.bai_dang||[]).find(b=>b.id===id)||{};
  const brand=KQ.filter(k=>k.muc_tin_cay==='KHONG_QUY_DON'&&mucCua(k.muc_id).muc_tieu==='BRAND'), banHang=KQ.filter(k=>k.muc_tin_cay==='KHONG_QUY_DON'&&mucCua(k.muc_id).muc_tieu==='BAN_HANG');
  const doThu=async()=>{ setBusy(true); const r=await goi('/may/chay-thu',{method:'POST',body:{agent:'DO_LUONG'}}); setBusy(false); if(r.ok) notify((r.kq[0]||{}).tom_tat||(r.kq[0]||{}).bo_qua||'Xong'); else notify(r.msg,'err'); };
  const theoBai={}; KQ.forEach(k=>{ theoBai[k.bai_dang_id]=theoBai[k.bai_dang_id]||{k, xem:0, tc:0, tt:0, cs:0, don:0, dt:0, nguon:new Set()}; const t=theoBai[k.bai_dang_id]; t.xem+=k.luot_xem||0; t.tc+=k.tiep_can||0; t.tt+=k.tuong_tac||0; t.cs+=k.chia_se||0; t.don+=k.so_don||0; t.dt+=k.doanh_thu||0; t.nguon.add(k.nguon); });
  const hang=Object.entries(theoBai).sort((a,b)=>b[1].xem-a[1].xem);
  return <div className="space-y-3">
    <div className="flex items-center justify-between gap-2 flex-wrap"><div className="flex items-center gap-2"><Input type="month" className="!w-40 !py-1.5" value={thang} onChange={e=>setThang(e.target.value)}/><span className="text-xs text-ink-muted">{KQ.length} bản ghi · {hang.length} bài</span></div>
      {!chiXem&&<div className="flex gap-2 flex-wrap"><Btn variant="ghost" onClick={doThu} disabled={busy}>📡 Đo ngay (API + Trạm)</Btn><Btn variant="ghost" onClick={()=>setDoiSoat(true)}>⬆ Import đối soát sàn</Btn><Btn variant="brand" onClick={()=>setForm({})}>＋ Nhập kết quả</Btn></div>}</div>
    <Callout tone="warn"><b>3 mức tin cậy không cộng dồn.</b> Trực tiếp = sàn trả đúng mã của bài (quy đơn chắc) · Gián tiếp = có liên hệ nhưng không chắc · Không quy đơn = số hiển thị/tương tác từ API kênh, Trạm hoặc nhập tay — không suy ra doanh thu.</Callout>
    <div className="grid sm:grid-cols-3 gap-2">
      {['TRUC_TIEP','GIAN_TIEP'].map(m=><Card key={m} pad="p-3"><Pill cls={MUC_KQ_CLS[m]}>{db.muc_tin_cay[m]}</Pill><div className="font-display text-xl font-extrabold text-ink mt-2">{fmtSo(sum(muc(m),'doanh_thu'))} đ</div><div className="text-[11px] text-ink-muted">{fmtSo(sum(muc(m),'so_don'))} đơn · {muc(m).length} bản ghi</div></Card>)}
      <Card pad="p-3"><Pill cls={MUC_KQ_CLS.KHONG_QUY_DON}>Không quy đơn</Pill><div className="font-display text-xl font-extrabold text-ink mt-2">{fmtSo(sum(muc('KHONG_QUY_DON'),'luot_xem'))} <span className="text-xs font-normal text-ink-muted">lượt xem</span></div><div className="text-[11px] text-ink-muted">{fmtSo(sum(muc('KHONG_QUY_DON'),'tiep_can'))} tiếp cận · {fmtSo(sum(muc('KHONG_QUY_DON'),'tuong_tac'))} tương tác · {fmtSo(sum(muc('KHONG_QUY_DON'),'chia_se'))} chia sẻ</div></Card>
    </div>
    <div className="grid sm:grid-cols-2 gap-2">
      <Card pad="p-3"><SectionTitle className="mb-1"><Pill cls={MUC_TIEU_CLS.BRAND}>Brand</Pill> nội dung xây dựng thương hiệu</SectionTitle><div className="grid grid-cols-4 gap-1 text-center">{[['tiep_can','Tiếp cận'],['luot_xem','Xem'],['chia_se','Chia sẻ'],['tuong_tac','Tương tác']].map(([f,l])=><div key={f}><div className="font-display font-extrabold text-ink">{fmtSo(sum(brand,f))}</div><div className="text-[10px] text-ink-muted">{l}</div></div>)}</div></Card>
      <Card pad="p-3"><SectionTitle className="mb-1"><Pill cls={MUC_TIEU_CLS.BAN_HANG}>Bán hàng</Pill> nội dung dẫn tới đơn</SectionTitle><div className="grid grid-cols-4 gap-1 text-center">{[['luot_xem','Xem'],['click','Click']].map(([f,l])=><div key={f}><div className="font-display font-extrabold text-ink">{fmtSo(sum(banHang,f))}</div><div className="text-[10px] text-ink-muted">{l}</div></div>)}<div><div className="font-display font-extrabold text-emerald-700">{fmtSo(sum(muc('TRUC_TIEP'),'so_don'))}</div><div className="text-[10px] text-ink-muted">đơn trực tiếp</div></div><div><div className="font-display font-extrabold text-amber-700">{fmtSo(sum(muc('GIAN_TIEP'),'so_don'))}</div><div className="text-[10px] text-ink-muted">đơn gián tiếp</div></div></div></Card>
    </div>
    <Card pad="">{hang.length===0?<Empty>Chưa có kết quả trong tháng này. Bài đã đăng có link sẽ được máy đo mỗi ngày (Graph/YouTube) hoặc Trạm đo (TikTok/Facebook không token).</Empty>
      :<div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="text-left text-ink-muted border-b border-line"><th className="px-3 py-2">Bài</th><th className="px-3 py-2">Mục tiêu</th><th className="px-3 py-2 text-right">Tiếp cận</th><th className="px-3 py-2 text-right">Xem</th><th className="px-3 py-2 text-right">Tương tác</th><th className="px-3 py-2 text-right">Chia sẻ</th><th className="px-3 py-2 text-right">Đơn</th><th className="px-3 py-2 text-right">Doanh thu</th><th className="px-3 py-2">Nguồn</th></tr></thead>
        <tbody>{hang.map(([id,t])=>{ const bd=bdCua(id); const m=mucCua(t.k.muc_id); return <tr key={id} className="border-b border-line/60"><td className="px-3 py-2 text-ink max-w-[260px]"><div className="truncate">{m.tieu_de||(bd.noi_dung_dang||'').slice(0,50)||id}</div>{bd.link&&<a className="text-[10px] text-brand-dark hover:underline" href={bd.link} target="_blank" rel="noreferrer">link</a>}</td><td className="px-3 py-2"><Pill cls={MUC_TIEU_CLS[m.muc_tieu]}>{MUC_TIEU_LABEL[m.muc_tieu]||'—'}</Pill></td><td className="px-3 py-2 text-right tabular-nums">{fmtSo(t.tc)}</td><td className="px-3 py-2 text-right tabular-nums">{fmtSo(t.xem)}</td><td className="px-3 py-2 text-right tabular-nums">{fmtSo(t.tt)}</td><td className="px-3 py-2 text-right tabular-nums">{fmtSo(t.cs)}</td><td className="px-3 py-2 text-right tabular-nums">{t.don||'—'}</td><td className="px-3 py-2 text-right tabular-nums">{t.dt?fmtSo(t.dt)+' đ':'—'}</td><td className="px-3 py-2 text-[10px] text-ink-muted">{[...t.nguon].join(', ')}</td></tr>; })}</tbody></table></div>}</Card>
    {form && <KetQuaForm onClose={()=>setForm(null)}/>}{doiSoat && <DoiSoatModal onClose={()=>setDoiSoat(false)}/>}
  </div>;
}
function KetQuaForm({onClose}){
  const { db, goi, notify } = useApp(); const [f,setF]=useState({bai_dang_id:'', muc_tin_cay:'TRUC_TIEP', nguon:'NHAP_TAY', ky:todayYMD(), doanh_thu:'', so_don:'', tiep_can:'', luot_xem:'', tuong_tac:'', chia_se:'', ghi_chu:''}); const [busy,setBusy]=useState(false);
  const bai=(db.bai_dang||[]).filter(b=>b.trang_thai==='DA_DANG'); const mucCua=id=>(db.muc_noi_dung||[]).find(m=>m.id===id)||{};
  const luu=async()=>{ setBusy(true); const r=await goi('/ket-qua',{method:'POST',body:f}); setBusy(false); if(r.ok){ notify('Đã ghi kết quả'); onClose(); } else notify(r.msg,'err'); };
  const kqd=f.muc_tin_cay==='KHONG_QUY_DON';
  return <Modal open onClose={onClose} title="Nhập kết quả">
    <Field label="Bài đăng" required><Select value={f.bai_dang_id} onChange={e=>setF({...f,bai_dang_id:e.target.value})}><option value="">— chọn —</option>{bai.map(b=><option key={b.id} value={b.id}>{(mucCua(b.muc_id).tieu_de||b.noi_dung_dang||'').slice(0,60)} · {fmtDate(b.posted_at)}</option>)}</Select></Field>
    <div className="grid grid-cols-2 gap-2"><Field label="Mức tin cậy"><Select value={f.muc_tin_cay} onChange={e=>setF({...f,muc_tin_cay:e.target.value})}>{Object.entries(db.muc_tin_cay).map(([k,v])=><option key={k} value={k}>{v}</option>)}</Select></Field><Field label="Nguồn"><Select value={f.nguon} onChange={e=>setF({...f,nguon:e.target.value})}><option value="NHAP_TAY">Nhập tay</option><option value="SAN">Sàn (đối soát)</option><option value="NGOAI">Agent ngoài</option></Select></Field></div>
    <Field label="Kỳ / ngày"><Input type="date" value={f.ky} onChange={e=>setF({...f,ky:e.target.value})}/></Field>
    {kqd ? <div className="grid grid-cols-2 gap-2">{[['tiep_can','Tiếp cận'],['luot_xem','Lượt xem'],['tuong_tac','Tương tác'],['chia_se','Chia sẻ']].map(([k,l])=><Field key={k} label={l}><Input type="number" min="0" value={f[k]} onChange={e=>setF({...f,[k]:e.target.value})}/></Field>)}</div>
      : <div className="grid grid-cols-2 gap-2"><Field label="Số đơn"><Input type="number" min="0" value={f.so_don} onChange={e=>setF({...f,so_don:e.target.value})}/></Field><Field label="Doanh thu (đ)"><Input type="number" min="0" value={f.doanh_thu} onChange={e=>setF({...f,doanh_thu:e.target.value})}/></Field></div>}
    <Field label="Ghi chú"><Input value={f.ghi_chu} onChange={e=>setF({...f,ghi_chu:e.target.value})}/></Field>
    <Callout tone="note">{kqd?'Mức Không quy đơn chỉ ghi chỉ số hiển thị/tương tác — không được gắn doanh thu.':'Trực tiếp: sàn trả đúng mã của bài. Gián tiếp: voucher dùng chung, khách nói "xem video", v.v.'}</Callout>
    <div className="flex justify-end gap-2 mt-3"><Btn variant="ghost" onClick={onClose}>Huỷ</Btn><Btn variant="brand" onClick={luu} disabled={busy||!f.bai_dang_id}>Lưu</Btn></div></Modal>;
}
function DoiSoatModal({onClose}){
  const { goi, notify } = useApp(); const [text,setText]=useState(''); const [muc,setMuc]=useState('TRUC_TIEP'); const [kq,setKq]=useState(null); const [busy,setBusy]=useState(false);
  const nhap=async()=>{ const dong=text.split('\n').map(l=>l.trim()).filter(Boolean).map(l=>{ const c=l.split(/[\t,;]/).map(x=>x.trim()); return {ma_theo_doi:/^https?:/.test(c[0])?'':c[0], link:/^https?:/.test(c[0])?c[0]:'', ky:c[1]||'', so_don:c[2]||0, doanh_thu:c[3]||0}; }); if(!dong.length) return notify('Chưa có dòng nào','err');
    setBusy(true); const r=await goi('/ket-qua/doi-soat',{method:'POST',body:{dong, muc_tin_cay:muc, nguon:'SAN'}}); setBusy(false); if(r.ok){ setKq(r); notify('Khớp '+r.khop+' · không khớp '+r.khong_khop.length); } else notify(r.msg,'err'); };
  return <Modal open onClose={onClose} title="Import đối soát sàn" wide>
    <div className="text-[11px] text-ink-muted mb-2">Mỗi dòng: <code>mã theo dõi hoặc link đã đăng ; kỳ ; số đơn ; doanh thu</code> (ngăn bằng tab, dấu phẩy hoặc chấm phẩy). Mã theo dõi đặt trên bài đăng (voucher/UTM). Khớp mã → mức Trực tiếp; không khớp thì liệt kê để gán tay.</div>
    <Field label="Mức tin cậy cho lô này"><Select value={muc} onChange={e=>setMuc(e.target.value)}><option value="TRUC_TIEP">Trực tiếp (sàn trả đúng mã)</option><option value="GIAN_TIEP">Gián tiếp</option></Select></Field>
    <Textarea rows="8" value={text} onChange={e=>setText(e.target.value)} placeholder={'KM-G7000-T10\t2026-10\t7\t18500000\nhttps://www.tiktok.com/@k/video/1\t2026-10\t2\t4600000'}/>
    <div className="flex justify-end mt-2"><Btn variant="brand" onClick={nhap} disabled={busy||!text.trim()}>Nhập</Btn></div>
    {kq&&kq.khong_khop.length>0&&<div className={CALLOUT.warn+' mt-2'}>Không khớp {kq.khong_khop.length} dòng: {kq.khong_khop.slice(0,5).map(x=>x.ma_theo_doi||x.link).join(' · ')} — đặt mã theo dõi cho bài rồi nhập lại, hoặc nhập tay từng bài.</div>}
  </Modal>;
}
function BaoCaoTab(){
  const { db, me, goi, notify } = useApp(); const [busy,setBusy]=useState(false); const [sua,setSua]=useState(null); const b11=(db.buoc||[]).find(b=>b.ma==='B11')||{};
  const tao=async(loai)=>{ setBusy(true); const r=await goi('/bao-cao',{method:'POST',body:{loai}}); setBusy(false); if(r.ok) notify(r.tom_tat); else notify(r.msg||r.bo_qua,'err'); };
  const gui=async(b)=>{ if(!confirm('Gửi báo cáo '+b.ky+' (app'+(db.san_sang.n8n?' + Zalo/mail qua n8n':'')+')?')) return; setBusy(true); const r=await goi('/bao-cao/'+b.id+'/gui',{method:'POST'}); setBusy(false); if(r.ok) notify('Đã gửi: '+r.tom_tat); else notify(r.msg,'err'); };
  const luuSua=async()=>{ setBusy(true); const r=await goi('/bao-cao/'+sua.id,{method:'PATCH',body:{nhan_dinh:sua.nhan_dinh, viec_can_lam:sua.viec_can_lam.split('\n').map(x=>x.trim()).filter(Boolean)}}); setBusy(false); if(r.ok){ notify('Đã lưu'); setSua(null); } else notify(r.msg,'err'); };
  return <div className="space-y-3">
    <Card pad="p-3"><div className="flex items-center justify-between gap-2 flex-wrap"><div><SectionTitle>Máy viết báo cáo (B11 · {MUC_LABEL[b11.nguoi_thuc_hien]||'Người làm'})</SectionTitle><div className="text-[11px] text-ink-muted">Thứ Hai: báo cáo tuần · ngày 1: báo cáo tháng. Số liệu luôn do máy tổng hợp; nhận định bằng AI khi B11 ở mức AI và có key (không thì theo luật). Gửi: trong app{db.san_sang.n8n?' + Zalo/mail qua n8n':' (chưa cắm n8n cho Zalo/mail)'}.</div></div>
      {laStaff(me)&&<div className="flex gap-2"><Btn variant="ghost" onClick={()=>tao('TUAN')} disabled={busy}>📄 Tạo báo cáo tuần trước</Btn><Btn variant="ghost" onClick={()=>tao('THANG')} disabled={busy}>📄 Tháng trước</Btn></div>}</div></Card>
    {(db.bao_cao||[]).length===0?<Empty>Chưa có báo cáo nào.</Empty>:(db.bao_cao||[]).map(b=>{ const sl=b.so_lieu||{}; const kq=(sl.ba_muc||{}).KHONG_QUY_DON||{}; return <Card key={b.id}>
      <div className="flex items-center justify-between gap-2 flex-wrap"><SectionTitle>📄 Báo cáo {b.loai==='THANG'?'tháng':'tuần'} {b.ky} <span className="text-ink-muted font-normal text-[11px]">({String(b.tu).slice(0,10)} → {String(b.den).slice(0,10)}) · {b.tao_boi}</span></SectionTitle><Pill cls={b.trang_thai==='DA_GUI'?'bg-emerald-100 text-emerald-800':'bg-amber-100 text-amber-800'}>{b.trang_thai==='DA_GUI'?('đã gửi: '+(b.gui_qua||[]).join(' + ')+' · '+b.gui_boi):'nháp — chờ gửi'}</Pill></div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 my-2 text-center">{[['Bài đăng',sl.bai_dang],['Tiếp cận',kq.tiep_can],['Lượt xem',kq.luot_xem],['Chia sẻ',kq.chia_se],['Đơn trực tiếp',((sl.ba_muc||{}).TRUC_TIEP||{}).so_don]].map(([l,v])=><div key={l} className="rounded-xl bg-slate-50 p-2"><div className="font-display font-extrabold text-ink">{fmtSo(v||0)}</div><div className="text-[10px] text-ink-muted">{l}</div></div>)}</div>
      {sua&&sua.id===b.id ? <div className="space-y-2"><Textarea rows="5" value={sua.nhan_dinh} onChange={e=>setSua({...sua,nhan_dinh:e.target.value})}/><Textarea rows="3" value={sua.viec_can_lam} onChange={e=>setSua({...sua,viec_can_lam:e.target.value})} placeholder="mỗi dòng một việc"/><div className="flex gap-2 justify-end"><Btn variant="ghost" onClick={()=>setSua(null)}>Huỷ</Btn><Btn variant="brand" onClick={luuSua} disabled={busy}>Lưu</Btn></div></div>
      : <><div className="text-sm text-ink leading-relaxed whitespace-pre-wrap">{b.nhan_dinh}</div>{(b.viec_can_lam||[]).length>0&&<ul className="text-xs text-ink mt-2 space-y-0.5">{b.viec_can_lam.map((v,i)=><li key={i}>• {v}</li>)}</ul>}
        {b.trang_thai!=='DA_GUI'&&laStaff(me)&&<div className="flex gap-2 justify-end mt-2"><Btn variant="ghost" onClick={()=>setSua({id:b.id, nhan_dinh:b.nhan_dinh, viec_can_lam:(b.viec_can_lam||[]).join('\n')})}>✏️ Sửa nhận định</Btn>{laGat(me)&&<Btn variant="brand" onClick={()=>gui(b)} disabled={busy}>📤 Gửi</Btn>}</div>}</>}
    </Card>; })}
  </div>;
}
function DeXuatTab(){
  const { db, me, goi, notify } = useApp(); const [ly,setLy]=useState({}); const [busy,setBusy]=useState(false); const duoc=laGat(me)||me.vai_tro==='GIAM_DOC'; const cfg=(db.module_config||{}).hoc||{};
  const quyet=async(d,q)=>{ if(q==='BO'&&!(ly[d.id]||'').trim()) return notify('Ghi lý do bỏ — máy học từ đây','err'); if(q==='DUYET'&&!confirm('Duyệt "'+d.tieu_de+'"? Máy sẽ áp dụng ngay.')) return; setBusy(true); const r=await goi('/de-xuat/'+d.id+'/quyet',{method:'POST',body:{quyet:q, ly_do:ly[d.id]||''}}); setBusy(false); if(r.ok) notify(q==='DUYET'?('Đã áp dụng: '+((r.ap_dung||{}).ghi_chu||'')):'Đã bỏ'); else notify(r.msg,'err'); };
  const chayThu=async()=>{ setBusy(true); const r=await goi('/may/chay-thu',{method:'POST',body:{agent:'HOC_DE_XUAT'}}); setBusy(false); if(r.ok) notify((r.kq[0]||{}).tom_tat||(r.kq[0]||{}).bo_qua||'Xong'); else notify(r.msg,'err'); };
  const ds=db.de_xuat||[]; const pTen=id=>((db.pillars||[]).find(p=>p.id===id)||{}).ten||id;
  return <div className="space-y-3">
    <Callout tone="info"><b>Cổng G4.</b> Máy so kết quả 90 ngày theo pillar / định dạng / khung giờ; chỉ đề xuất khi mỗi nhóm có ≥ {cfg.min_mau} bài và lệch ≥ {cfg.lech_toi_thieu_pct}% so trung bình (không có số thì không đề xuất). Duyệt = máy áp dụng ngay (đổi tỷ trọng pillar → chiến lược cần chốt lại G1; định dạng/giờ → vào gợi ý cho kế hoạch & lịch đăng). Bỏ phải ghi lý do — mẫu học B12.{laGat(me)&&<> <LinkBtn onClick={chayThu}>▶ Máy rút đề xuất ngay</LinkBtn></>}</Callout>
    {ds.length===0?<Empty>Chưa có đề xuất nào. Máy rút đề xuất ngày 2 hằng tháng (sau báo cáo tháng) khi B12 ở mức AI gợi ý.</Empty>:<div className="grid lg:grid-cols-2 gap-2">{ds.map(d=><Card key={d.id} pad="p-3">
      <div className="flex items-center gap-2 flex-wrap"><Pill>{d.loai}</Pill><Pill cls={d.trang_thai==='DUYET'?'bg-emerald-100 text-emerald-800':d.trang_thai==='BO'?'bg-slate-100 text-ink-muted':'bg-amber-100 text-amber-800'}>{d.trang_thai==='CHO'?'chờ G4':d.trang_thai==='DUYET'?'đã áp dụng':'đã bỏ'}</Pill><span className="text-[10px] text-ink-muted">kỳ {d.ky}</span></div>
      <div className="text-sm font-semibold text-ink mt-1">{d.tieu_de}</div><div className="text-[11px] text-ink-soft mt-0.5">{d.ly_do}</div>
      <div className="text-[10px] text-ink-muted mt-1">Bằng chứng: {Object.entries(d.bang_chung||{}).map(([k,v])=>k+': '+(typeof v==='object'?Object.entries(v).map(([a,b])=>a+'='+b).join(' '):v)).join(' · ')}</div>
      {d.trang_thai==='CHO'&&duoc&&<div className="mt-2 flex gap-1 items-center flex-wrap"><Input className="!py-1 !px-2 text-[11px] !w-48" placeholder="lý do (bắt buộc khi bỏ)" value={ly[d.id]||''} onChange={e=>setLy({...ly,[d.id]:e.target.value})}/><Btn variant="ok" className="!py-1 !px-2 text-[11px]" onClick={()=>quyet(d,'DUYET')} disabled={busy}>✅ Duyệt & áp dụng</Btn><Btn variant="ghost" className="!py-1 !px-2 text-[11px]" onClick={()=>quyet(d,'BO')} disabled={busy}>Bỏ</Btn></div>}
      {d.trang_thai!=='CHO'&&<div className="text-[10px] text-ink-muted mt-1">{d.quyet_boi} · {fmtDate(d.quyet_at)}{d.ly_do_nguoi?(' · '+d.ly_do_nguoi):''}{d.ap_dung&&d.ap_dung.ghi_chu?(' · '+d.ap_dung.ghi_chu):''}</div>}
    </Card>)}</div>}
  </div>;
}
