// ===== MÀN 2 — CHIẾN LƯỢC & KẾ HOẠCH (ADR-002): G1 chốt chiến lược · danh mục gốc · kế hoạch tháng (G2) · tuần & mục · ý tưởng/trend (B1) =====
const MUC_TIEU_LABEL = { BRAND:'Brand', BAN_HANG:'Bán hàng' };
const MUC_TIEU_CLS = { BRAND:'bg-sky-100 text-sky-800', BAN_HANG:'bg-orange-100 text-orange-800' };
const DINH_DANG_ICON = { VIDEO:'🎬 Video ngắn', POST:'📝 Bài post', ANH:'🖼️ Ảnh / banner', CAROUSEL:'🎠 Carousel' };
function ChienLuocKeHoach(){
  const { me, db } = useApp();
  const [tab,setTab]=useState('hoso');
  const chiXem=!laStaff(me);
  const ytMoi=(db.y_tuong||[]).filter(y=>y.trang_thai==='MOI').length;
  const tabs=[{key:'hoso',label:'🧭 Hồ sơ định vị'},{key:'chienluoc',label:'Tóm tắt & chốt (G1)'},{key:'thongdiep',label:'Thông điệp seeding',count:((db.seeding||{}).thong_diep||[]).filter(t=>t.active).length||null},{key:'kehoach',label:'Kế hoạch tháng'},{key:'tuan',label:'Tuần & mục'},{key:'ytuong',label:'Ý tưởng & trend',count:ytMoi||null},{key:'pillars',label:'Pillar'},{key:'frameworks',label:'Framework'},{key:'san_pham',label:'Sản phẩm'},{key:'claim_cam',label:'Claim cấm'},{key:'kenh',label:'Kênh'}];
  return <div className="space-y-4">
    <PageHeader title="🎯 Chiến lược & Kế hoạch" sub="Hồ sơ định vị là la bàn cho mọi gốc content · G1 chốt chiến lược · G2 chốt kế hoạch tháng. Danh mục gốc ở đây là dữ kiện thật duy nhất máy được dùng."/>
    <Tabs size="sm" active={tab} onChange={setTab} tabs={tabs}/>
    {tab==='hoso' && <HoSoDinhVi chiXem={chiXem}/>}
    {tab==='chienluoc' && <ChienLuocForm chiXem={chiXem}/>}
    {tab==='thongdiep' && <ThongDiepSeeding chiXem={chiXem}/>}
    {tab==='kehoach' && <KeHoachThang chiXem={chiXem}/>}
    {tab==='tuan' && <TuanVaMuc chiXem={chiXem}/>}
    {tab==='ytuong' && <YTuong chiXem={chiXem}/>}
    {['pillars','frameworks','san_pham','claim_cam','kenh'].includes(tab) && <DanhMuc bang={tab} chiXem={chiXem}/>}
  </div>;
}
function ChienLuocForm({chiXem}){
  const { db, me, goi, notify } = useApp(); const cl=db.chien_luoc||{};
  const [f,setF]=useState({dinh_vi:cl.dinh_vi||'', tong_giong:cl.tong_giong||'', doi_tuong:cl.doi_tuong||''});
  useEffect(()=>{ setF({dinh_vi:cl.dinh_vi||'', tong_giong:cl.tong_giong||'', doi_tuong:cl.doi_tuong||''}); },[cl.updated_at]);
  const [busy,setBusy]=useState(false); const [ghiChu,setGhiChu]=useState('');
  const luu=async()=>{ setBusy(true); const r=await goi('/chien-luoc',{method:'PUT',body:f}); setBusy(false); if(r.ok) notify('Đã lưu chiến lược'); else notify(r.msg,'err'); };
  const chot=async()=>{ if(!confirm('Chốt chiến lược thành phiên bản '+((cl.phien_ban||0)+1)+'? Máy sẽ dùng bản này để đề xuất kế hoạch.')) return; setBusy(true); const r=await goi('/chien-luoc/chot',{method:'POST',body:{ghi_chu:ghiChu}}); setBusy(false); if(r.ok){ notify('Đã chốt chiến lược (G1)'); setGhiChu(''); } else notify(r.msg,'err'); };
  const duocChot=laGat(me)||me.vai_tro==='GIAM_DOC';
  const daSua=cl.updated_at && cl.chot_at && cl.updated_at>cl.chot_at;
  const tongPillar=(db.pillars||[]).filter(p=>p.active).reduce((s,p)=>s+Number(p.ty_trong||0),0);
  return <div className="grid lg:grid-cols-[2fr_1fr] gap-3">
    <Card>
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap"><SectionTitle>Định vị & chiến lược</SectionTitle><Pill cls={cl.phien_ban>0&&!daSua?'bg-emerald-100 text-emerald-800':'bg-amber-100 text-amber-800'}>{cl.phien_ban>0?('phiên bản '+cl.phien_ban+' · '+cl.chot_boi+' · '+fmtDate(cl.chot_at)+(daSua?' · đã sửa sau khi chốt':'')):'chưa chốt (G1)'}</Pill></div>
      <Callout tone="info" className="mb-3">Trợ lý viết bài dùng <b>🧭 Hồ sơ định vị</b> theo từng dòng (lõi, ý đồ triển khai, xu hướng). Các ô dưới là tóm tắt chung — dùng khi bài chưa rõ dòng, và là bản được chốt ở G1.</Callout>
      <Field label="Định vị thương hiệu (tóm tắt chung)" hint="Kingsmen là gì, khác gì, hứa gì — máy dùng khi bài chưa rõ dòng sản phẩm."><Textarea rows="4" value={f.dinh_vi} onChange={e=>setF({...f,dinh_vi:e.target.value})} disabled={chiXem}/></Field>
      <Field label="Tông giọng"><Textarea rows="2" value={f.tong_giong} onChange={e=>setF({...f,tong_giong:e.target.value})} disabled={chiXem} placeholder="VD: chuyên gia, chắc chắn, không hô hào…"/></Field>
      <Field label="Đối tượng"><Textarea rows="2" value={f.doi_tuong} onChange={e=>setF({...f,doi_tuong:e.target.value})} disabled={chiXem} placeholder="VD: nhà thầu, thợ ốp lát, chủ nhà đang hoàn thiện…"/></Field>
      <div className="flex gap-2 flex-wrap items-end">{!chiXem && <Btn variant="ghost" onClick={luu} disabled={busy}>💾 Lưu nháp</Btn>}
        {duocChot && <><Input className="!w-56" placeholder="ghi chú phiên bản (tuỳ chọn)" value={ghiChu} onChange={e=>setGhiChu(e.target.value)}/><Btn variant="brand" onClick={chot} disabled={busy||!cl.dinh_vi}>✅ Chốt chiến lược (G1)</Btn></>}</div>
    </Card>
    <div className="space-y-3">
      <Card pad="p-3"><SectionTitle className="mb-2">Trụ cột nội dung</SectionTitle>
        {(db.pillars||[]).filter(p=>p.active).map(p=><div key={p.id} className="mb-2"><div className="flex justify-between text-xs"><span className="text-ink font-semibold">{p.ten} <Pill cls={MUC_TIEU_CLS[p.muc_tieu]||''}>{MUC_TIEU_LABEL[p.muc_tieu]||'Brand'}</Pill></span><span className="text-ink-muted">{p.ty_trong}%</span></div><Thanh pct={p.ty_trong}/></div>)}
        <div className={"text-[11px] mt-2 "+(tongPillar===100?'text-emerald-700':'text-amber-700')}>Tổng {tongPillar}% {tongPillar!==100 && '— nên bằng 100%'}</div></Card>
      {(db.chien_luoc_phien_ban||[]).length>0 && <Card pad="p-3"><SectionTitle className="mb-1">Lịch sử chốt</SectionTitle>{(db.chien_luoc_phien_ban||[]).map(v=><div key={v.id} className="text-[11px] text-ink-muted py-1 border-t border-line">v{v.phien_ban} · {v.chot_boi} · {fmtDate(v.chot_at)}{v.ghi_chu?(' · '+v.ghi_chu):''} · {(v.pillars||[]).map(p=>p.ten+' '+p.ty_trong+'%').join(', ')}</div>)}</Card>}
    </div>
  </div>;
}
// ----- Kế hoạch tháng: máy đề xuất (kèm lý do) ↔ người sửa ↔ Trưởng MKT chốt (G2) -----
function KeHoachThang({chiXem}){
  const { db, me, goi, notify } = useApp();
  const [thang,setThang]=useState(db.hang_so.thang_nay); const kh=(db.ke_hoach_thang||[]).find(k=>k.thang===thang)||null;
  const rong={tong_bai:0,theo_pillar:{},theo_dinh_dang:{},theo_kenh:{},theo_muc_tieu:{},ket_qua:{}};
  const [f,setF]=useState(()=>({chi_tieu:kh?JSON.parse(JSON.stringify(kh.chi_tieu)):rong, dinh_huong:(kh&&kh.dinh_huong)||''}));
  useEffect(()=>{ setF({chi_tieu:kh?JSON.parse(JSON.stringify(kh.chi_tieu)):rong, dinh_huong:(kh&&kh.dinh_huong)||''}); },[thang,(kh&&kh.updated_at)||'']);
  const [busy,setBusy]=useState(false); const [tongMuon,setTongMuon]=useState('');
  const pillars=(db.pillars||[]).filter(p=>p.active); const kenhs=(db.kenh||[]).filter(k=>k.active);
  const muc=(db.muc_noi_dung||[]).filter(m=>m.thang===thang);
  const dem=f=>{ const r={}; muc.forEach(m=>{ const k=f(m); if(k) r[k]=(r[k]||0)+1; }); return r; };
  const tt={ pillar:dem(m=>m.pillar_id), dd:dem(m=>m.dinh_dang), kenh:dem(m=>m.kenh_id), mt:dem(m=>m.muc_tieu) };
  const daChot=kh&&kh.trang_thai==='CHOT'; const khoa=chiXem||(daChot&&!laGat(me));
  const set=(nhom,k,v)=>setF(x=>({...x, chi_tieu:{...x.chi_tieu, [nhom]:{...(x.chi_tieu[nhom]||{}), [k]:Math.max(0,Number(v)||0)}}}));
  const deXuat=async()=>{ setBusy(true); const r=await goi('/ke-hoach/'+thang+'/de-xuat',{method:'POST',body:{tong_bai:Number(tongMuon)||0}}); setBusy(false); if(r.ok) notify('Máy đã đề xuất '+r.de_xuat.chi_tieu.tong_bai+' bài — xem lý do từng nhóm, sửa rồi lưu/chốt'); else notify(r.msg,'err'); };
  const luu=async()=>{ setBusy(true); const r=await goi('/ke-hoach/'+thang,{method:'PUT',body:f}); setBusy(false); if(r.ok) notify('Đã lưu kế hoạch '+thang); else notify(r.msg,'err'); };
  const chot=async()=>{ if(!confirm('Chốt kế hoạch tháng '+thang+' (G2)? Sau khi chốt, máy (nếu B3 ở mức AI) sẽ chia tuần và tạo mục còn thiếu.')) return; setBusy(true); const r1=await goi('/ke-hoach/'+thang,{method:'PUT',body:f}); if(!r1.ok){ setBusy(false); return notify(r1.msg,'err'); } const r=await goi('/ke-hoach/'+thang+'/chot',{method:'POST'}); setBusy(false); if(r.ok) notify('Đã chốt (G2)'+(r.tao!=null?(' · máy tạo '+r.tao+' mục'):' · đã giao việc chia tuần')); else notify(r.msg,'err'); };
  const Khoi=({tieu,nhom,keys,ten,thucTe,lyDo})=><Card pad="p-3"><div className="flex justify-between items-start gap-2 mb-2"><SectionTitle>{tieu}</SectionTitle>{lyDo&&<span className="text-[11px] text-ink-muted text-right max-w-[60%]" title={lyDo}>🤖 {lyDo}</span>}</div>
    <div className="space-y-1.5">{keys.map(k=><div key={k} className="grid grid-cols-[minmax(0,1fr)_64px_minmax(0,1fr)] gap-2 items-center"><span className="text-xs text-ink truncate">{ten(k)}</span><Input type="number" min="0" className="!py-1 !px-2 text-xs" value={(f.chi_tieu[nhom]||{})[k]||0} onChange={e=>set(nhom,k,e.target.value)} disabled={khoa}/>
      <div className="flex items-center gap-1"><div className="flex-1"><Thanh pct={((f.chi_tieu[nhom]||{})[k]||0)?(thucTe[k]||0)/((f.chi_tieu[nhom]||{})[k]||1)*100:0} cls={(thucTe[k]||0)>=((f.chi_tieu[nhom]||{})[k]||0)&&((f.chi_tieu[nhom]||{})[k]||0)?'bg-emerald-500':'bg-brand'}/></div><span className="text-[11px] text-ink-muted w-10 text-right">{thucTe[k]||0}/{(f.chi_tieu[nhom]||{})[k]||0}</span></div></div>)}</div></Card>;
  const kq=f.chi_tieu.ket_qua||{}; const setKq=(k,v)=>setF(x=>({...x, chi_tieu:{...x.chi_tieu, ket_qua:{...(x.chi_tieu.ket_qua||{}), [k]:Math.max(0,Number(v)||0)}}}));
  const tongPillar=Object.values(f.chi_tieu.theo_pillar||{}).reduce((s,v)=>s+(Number(v)||0),0);
  return <div className="space-y-3">
    <Card><div className="flex items-center justify-between gap-2 flex-wrap">
      <div className="flex items-center gap-2"><Input type="month" className="!w-40 !py-1.5" value={thang} onChange={e=>setThang(e.target.value)}/>
        {kh ? <Pill cls={daChot?'bg-emerald-100 text-emerald-800':'bg-amber-100 text-amber-800'}>{daChot?('ĐÃ CHỐT · '+kh.chot_boi+' · '+fmtDate(kh.chot_at)):('ĐỀ XUẤT · '+(kh.nguon==='DE_XUAT'?'máy lập':'người lập')+' · '+kh.updated_by_name)}</Pill> : <Pill>chưa lập</Pill>}</div>
      {!khoa && <div className="flex items-center gap-2 flex-wrap"><Input type="number" min="1" className="!w-28 !py-1.5 text-xs" placeholder="tổng bài (tự tính)" value={tongMuon} onChange={e=>setTongMuon(e.target.value)}/><Btn variant="ghost" onClick={deXuat} disabled={busy}>✨ Máy đề xuất</Btn><Btn variant="ghost" onClick={luu} disabled={busy}>💾 Lưu</Btn>{laGat(me)&&!daChot&&<Btn variant="brand" onClick={chot} disabled={busy||!kh}>✅ Chốt (G2)</Btn>}</div>}</div>
      <div className="grid sm:grid-cols-3 gap-2 mt-3">
        <div className="rounded-xl bg-slate-50 p-2"><div className="text-[11px] text-ink-muted">Chỉ tiêu tổng {kh&&kh.ly_do&&kh.ly_do.tong_bai&&<span title={kh.ly_do.tong_bai}>🤖</span>}</div><div className="flex items-center gap-2"><Input type="number" min="0" className="!py-1 text-sm font-bold !w-24" value={f.chi_tieu.tong_bai||0} onChange={e=>setF(x=>({...x,chi_tieu:{...x.chi_tieu,tong_bai:Math.max(0,Number(e.target.value)||0)}}))} disabled={khoa}/><span className="text-[11px] text-ink-muted">bài · thực tế {muc.length} mục{tongPillar!==(Number(f.chi_tieu.tong_bai)||0)&&<span className="text-amber-700"> · pillar cộng {tongPillar} (lệch)</span>}</span></div></div>
        <div className="rounded-xl bg-slate-50 p-2 sm:col-span-2"><div className="text-[11px] text-ink-muted">Định hướng tháng</div><Textarea rows="2" className="!py-1 text-xs" value={f.dinh_huong} onChange={e=>setF({...f,dinh_huong:e.target.value})} disabled={khoa} placeholder="VD: đẩy G7000 mùa mưa, 2 video review KOC…"/></div></div>
    </Card>
    <div className="grid lg:grid-cols-2 xl:grid-cols-4 gap-3">
      <Khoi tieu="Theo pillar" nhom="theo_pillar" keys={pillars.map(p=>p.id)} ten={id=>{ const p=pillars.find(x=>x.id===id); return p?(p.ten+' · '+(p.ty_trong||0)+'%'):id; }} thucTe={tt.pillar} lyDo={kh&&kh.ly_do&&kh.ly_do.theo_pillar}/>
      <Khoi tieu="Theo mục tiêu" nhom="theo_muc_tieu" keys={['BRAND','BAN_HANG']} ten={k=>MUC_TIEU_LABEL[k]} thucTe={tt.mt} lyDo={kh&&kh.ly_do&&kh.ly_do.theo_muc_tieu}/>
      <Khoi tieu="Theo định dạng" nhom="theo_dinh_dang" keys={db.hang_so.dinh_dang} ten={k=>DINH_DANG_ICON[k]} thucTe={tt.dd} lyDo={kh&&kh.ly_do&&kh.ly_do.theo_dinh_dang}/>
      <Khoi tieu="Theo kênh" nhom="theo_kenh" keys={kenhs.map(k=>k.id)} ten={id=>{ const k=kenhs.find(x=>x.id===id); return k?k.ten:id; }} thucTe={tt.kenh} lyDo={kh&&kh.ly_do&&kh.ly_do.theo_kenh}/>
    </div>
    <Card pad="p-3"><div className="flex justify-between items-start gap-2 mb-2"><SectionTitle>KPI kết quả mong muốn của tháng</SectionTitle><span className="text-[11px] text-ink-muted">Brand đo tiếp cận / xem / chia sẻ / tương tác · Bán hàng đo đơn. {kh&&kh.ly_do&&kh.ly_do.ket_qua&&<span title={kh.ly_do.ket_qua}>🤖 {kh.ly_do.ket_qua}</span>}</span></div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">{[['tiep_can','Tiếp cận'],['luot_xem','Lượt xem'],['chia_se','Chia sẻ'],['tuong_tac','Tương tác'],['so_don','Số đơn']].map(([k,l])=><Field key={k} label={l} className="!mb-0"><Input type="number" min="0" className="!py-1 text-xs" value={kq[k]||0} onChange={e=>setKq(k,e.target.value)} disabled={khoa}/></Field>)}</div></Card>
    <Card pad="p-3"><div className="flex justify-between items-start gap-2 mb-2"><SectionTitle>Seeding hội nhóm (ADR-007)</SectionTitle><span className="text-[11px] text-ink-muted">Máy soạn gói ĐỊNH KỲ mỗi tuần theo chỉ tiêu này, chọn thông điệp ít được nói nhất trong bản đồ. 0 = mặc định cấu hình Máy.</span></div><Field label="Số bài seeding mỗi tuần" className="!mb-0"><Input type="number" min="0" max="30" className="!py-1 text-xs !w-28" value={f.chi_tieu.seeding_tuan||0} onChange={e=>setF(x=>({...x,chi_tieu:{...x.chi_tieu,seeding_tuan:Math.max(0,Number(e.target.value)||0)}}))} disabled={khoa}/></Field></Card>
    <Callout tone="note">Chỉ tiêu chảy xuống tuần: mỗi tuần = chỉ tiêu tháng ÷ số tuần (làm tròn lên). Bản chốt được so với bản máy đề xuất để chấm điểm sẵn sàng bước B2 — càng ít phải sửa, máy càng sớm được tự lập kế hoạch.</Callout>
  </div>;
}
// ----- Tuần & mục nội dung -----
function TuanVaMuc({chiXem}){
  const { db, goi, notify } = useApp();
  const [thang,setThang]=useState(db.hang_so.thang_nay); const [thieu,setThieu]=useState(null); const [edit,setEdit]=useState(null); const [busy,setBusy]=useState(false);
  const kh=(db.ke_hoach_thang||[]).find(k=>k.thang===thang)||null; const muc=(db.muc_noi_dung||[]).filter(m=>m.thang===thang);
  useEffect(()=>{ let s=true; goi('/ke-hoach/'+thang).then(r=>{ if(s) setThieu(r.ok?r.thieu:null); }); return ()=>{ s=false; }; },[thang, muc.length, (kh&&kh.updated_at)||'']);
  const soTuan=(thieu&&thieu.so_tuan)||4; const tuanCua=m=>m.tuan!=null?Number(m.tuan):(m.ngay_dang?tuanCuaNgayFE(m.ngay_dang):null);
  const taoMuc=async()=>{ setBusy(true); const r=await goi('/ke-hoach/'+thang+'/tao-muc',{method:'POST'}); setBusy(false); if(r.ok) notify('Máy tạo '+r.tao+' mục còn thiếu — người đặt tiêu đề & sản phẩm'); else notify(r.msg,'err'); };
  const doiTuan=async(m,t)=>{ const r=await goi('/muc/'+m.id,{method:'PATCH',body:{tuan:t}}); if(!r.ok) notify(r.msg,'err'); };
  const pTen=id=>((db.pillars||[]).find(p=>p.id===id)||{}).ten||'—'; const kTen=id=>((db.kenh||[]).find(k=>k.id===id)||{}).ten||'—';
  const The=({m})=><div className="bg-white rounded-lg border border-line p-2"><div className="flex items-start gap-1"><div className="text-[11px] font-semibold text-ink min-w-0 flex-1 cursor-pointer hover:text-brand" onClick={()=>!chiXem&&setEdit(m)}>{DINH_DANG_ICON[m.dinh_dang]?DINH_DANG_ICON[m.dinh_dang].split(' ')[0]:'📄'} {m.tieu_de}</div>{m.tao_boi==='AGENT'&&<span title="máy tạo">🤖</span>}</div>
    <div className="text-[11px] text-ink-muted mt-0.5">{pTen(m.pillar_id)} · {kTen(m.kenh_id)} · <Pill cls={MUC_TIEU_CLS[m.muc_tieu]}>{MUC_TIEU_LABEL[m.muc_tieu]}</Pill> · {m.giai_doan}</div>
    {m.y_do?<div className="mt-1"><YDoChip id={m.y_do} boi={m.y_do_boi}/></div>:<div className="mt-1 text-[10.5px] text-amber-700">🧭 chưa có ý đồ</div>}
    {!chiXem && <select value={String(tuanCua(m)||'')} onChange={e=>doiTuan(m,Number(e.target.value))} className="mt-1 text-[11px] border border-line rounded px-1 py-0.5 bg-white w-full"><option value="">— tuần —</option>{Array.from({length:soTuan},(_,i)=>i+1).map(x=><option key={x} value={x}>Tuần {x}</option>)}</select>}</div>;
  const chuaTuan=muc.filter(m=>!tuanCua(m));
  return <div className="space-y-3">
    <div className="flex items-center justify-between gap-2 flex-wrap"><div className="flex items-center gap-2"><Input type="month" className="!w-40 !py-1.5" value={thang} onChange={e=>setThang(e.target.value)}/><span className="text-xs text-ink-muted">{muc.length} mục{kh?(' · kế hoạch '+(kh.trang_thai==='CHOT'?'đã chốt':'chưa chốt')):' · chưa có kế hoạch tháng'}</span></div>
      {!chiXem && <div className="flex gap-2"><Btn variant="ghost" onClick={taoMuc} disabled={busy||!kh}>🤖 Máy tạo mục còn thiếu</Btn><Btn variant="brand" onClick={()=>setEdit({thang})}>＋ Thêm mục</Btn></div>}</div>
    <div className="flex gap-2 overflow-x-auto pb-2 snap-x">{Array.from({length:soTuan},(_,i)=>i+1).map(t=>{ const col=muc.filter(m=>tuanCua(m)===t); const th=thieu&&thieu.tuan.find(x=>x.tuan===t);
      return <div key={t} className="bg-slate-50 rounded-xl p-2 w-[76vw] max-w-[240px] sm:w-auto sm:flex-1 sm:min-w-0 shrink-0 snap-start"><div className="text-[11px] font-bold text-ink-muted mb-1 flex justify-between"><span>Tuần {t}</span><span className={th&&col.length<th.chi_tieu?'text-amber-700':'text-slate-500'}>{col.length}{th?('/'+th.chi_tieu):''}</span></div>
        {th&&th.thieu.length>0&&<div className="text-[11px] text-amber-700 mb-1.5">thiếu: {th.thieu.map(x=>(x.loai==='dinh_dang'?(DINH_DANG_ICON[x.ten]||x.ten).split(' ').slice(1).join(' '):x.ten)+' '+x.thieu).join(' · ')}</div>}
        {th&&th.thieu.length===0&&col.length>=th.chi_tieu&&<div className="text-[11px] text-emerald-700 mb-1.5">✓ đủ chỉ tiêu tuần</div>}
        <div className="space-y-1.5">{col.map(m=><The key={m.id} m={m}/>)}</div></div>; })}</div>
    {chuaTuan.length>0 && <Card pad=""><div className="px-3 py-2 bg-amber-50 border-b border-amber-200 text-sm font-semibold text-amber-700 rounded-t-2xl">⏳ Chưa xếp tuần ({chuaTuan.length})</div><div className="p-2 grid sm:grid-cols-2 lg:grid-cols-4 gap-2">{chuaTuan.map(m=><The key={m.id} m={m}/>)}</div></Card>}
    {edit && <MucForm init={edit} onClose={()=>setEdit(null)}/>}
  </div>;
}
function tuanCuaNgayFE(ymd){ if(!/^\d{4}-\d{2}-\d{2}$/.test(ymd||'')) return null; const d=new Date(ymd+'T00:00:00Z'); const lech=(new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),1)).getUTCDay()+6)%7; return Math.min(6, Math.floor((d.getUTCDate()-1+lech)/7)+1); }
function MucForm({init,onClose}){
  const { db, goi, notify } = useApp(); const [f,setF]=useState({thang:init.thang||db.hang_so.thang_nay, tuan:init.tuan==null?'':init.tuan, ngay_dang:init.ngay_dang||'', tieu_de:init.tieu_de||'', muc_tieu:init.muc_tieu||'BRAND', pillar_id:init.pillar_id||'', framework_id:init.framework_id||'', san_pham_id:init.san_pham_id||'', kenh_id:init.kenh_id||'', dinh_dang:init.dinh_dang||'', ghi_chu:init.ghi_chu||'', y_do:init.y_do||'', dong:init.dong||''}); const [busy,setBusy]=useState(false);
  const set=(k,v)=>setF(o=>({...o,[k]:v}));
  useEffect(()=>{ if(f.pillar_id&&!f.y_do){ const p=(db.pillars||[]).find(x=>x.id===f.pillar_id); if(p&&p.muc_tieu&&!init.id) set('muc_tieu',p.muc_tieu); } },[f.pillar_id]);
  // ADR-021: ý đồ triển khai — chọn ý đồ thì mục mới nhận dòng, pillar, mục tiêu, định dạng gợi ý (người đổi tự do); để trống thì máy gắn khi đủ tín hiệu
  const yds=(db.y_do||[]).filter(y=>!f.dong||!y.dong||y.dong===f.dong); const yd=(db.y_do||[]).find(y=>y.id===f.y_do)||null; const nhomYD={}; yds.forEach(y=>{ (nhomYD[y.dong||'Mọi dòng']=nhomYD[y.dong||'Mọi dòng']||[]).push(y); });
  const chonYD=id=>{ const y=(db.y_do||[]).find(x=>x.id===id); setF(o=>({...o, y_do:id, dong:y&&y.dong?y.dong:o.dong, ...(y&&!init.id?{ pillar_id:o.pillar_id||pillarTheoTen(db,y.pillar), muc_tieu:y.muc_tieu||o.muc_tieu, dinh_dang:o.dinh_dang||((y.dinh_dang||[])[0]||'') }:{}) })); };
  const luu=async()=>{ setBusy(true); const body={...f, tuan:f.tuan===''?'':Number(f.tuan), y_do:f.y_do||null, dong:f.dong||null}; let r=await goi(init.id?('/muc/'+init.id):'/muc',{method:init.id?'PATCH':'POST',body});
    if(r.ok&&init.id&&(f.dong||'')!==(init.dong||'')) r=await goi('/muc/'+init.id+'/dong',{method:'POST',body:{dong:f.dong||null}});
    if(r.ok&&init.id&&(f.y_do||'')!==(init.y_do||'')) r=await goi('/muc/'+init.id+'/y-do',{method:'POST',body:{y_do:f.y_do||null}});
    setBusy(false); if(r.ok){ notify('Đã lưu'); onClose(); } else notify(r.msg,'err'); };
  const xoa=async()=>{ if(!confirm('Xoá mục này?')) return; const r=await goi('/muc/'+init.id,{method:'DELETE'}); if(r.ok){ notify('Đã xoá'); onClose(); } else notify(r.msg,'err'); };
  const Sel=({k,l,ds,ten})=><Field label={l}><Select value={f[k]} onChange={e=>set(k,e.target.value)}><option value="">— chọn —</option>{ds.map(x=><option key={x.id||x} value={x.id||x}>{ten?ten(x):x.ten}</option>)}</Select></Field>;
  return <Modal open onClose={onClose} title={init.id?'Sửa mục nội dung':'Thêm mục nội dung'} wide>
    {init.tao_boi==='AGENT' && <div className={CALLOUT.info+' mb-3'}>🤖 Mục do máy tạo vì thiếu so với kế hoạch. Bạn sửa gì, máy học nấy (bước B3).{init.ghi_chu?(' '+init.ghi_chu):''}</div>}
    <div className="grid sm:grid-cols-2 gap-x-3">
      <Field label="Tiêu đề" required className="sm:col-span-2"><Input value={f.tieu_de} onChange={e=>set('tieu_de',e.target.value)}/></Field>
      <Field label="🧭 Ý đồ triển khai" className="sm:col-span-2" hint={yd?'':'Để trống: máy tự gắn khi đủ tín hiệu (dòng, pillar, tiêu đề) — người chọn thì chắc hơn'}><Select value={f.y_do} onChange={e=>chonYD(e.target.value)}><option value="">— máy chọn nếu đủ tín hiệu —</option>{Object.entries(nhomYD).map(([dg,ds])=><optgroup key={dg} label={dg}>{ds.map(y=><option key={y.id} value={y.id}>{y.ten}</option>)}</optgroup>)}</Select></Field>
      {yd&&<div className="sm:col-span-2 -mt-1 mb-3 rounded-xl bg-brand-bg/70 border border-brand/25 p-2.5 text-[12px]"><div className="text-ink leading-snug"><b>Thông điệp lõi:</b> {yd.thong_diep}</div>{(yd.goi_y||[]).length>0&&<div className="flex flex-wrap gap-1 mt-1.5">{yd.goi_y.map(g=><button type="button" key={g} onClick={()=>set('tieu_de',g)} className="rounded-lg bg-white border border-line px-2 py-0.5 text-left hover:border-brand">💡 {g}</button>)}</div>}<div className="text-[11px] text-ink-muted mt-1.5">Giữ thông điệp lõi — góc kể, câu mở, trend là tự do.</div></div>}
      <Field label="Dòng sản phẩm"><Select value={f.dong} onChange={e=>{ const v=e.target.value; setF(o=>({...o, dong:v, y_do:(yd&&yd.dong&&v&&yd.dong!==v)?'':o.y_do})); }}><option value="">— chưa rõ —</option>{(db.dong_chuan||[]).map(x=><option key={x} value={x}>{x}</option>)}</Select></Field>
      <Sel k="pillar_id" l="Pillar" ds={(db.pillars||[]).filter(p=>p.active)}/>
      <Field label="Mục tiêu"><Select value={f.muc_tieu} onChange={e=>set('muc_tieu',e.target.value)}><option value="BRAND">Brand (đo tiếp cận, xem, chia sẻ)</option><option value="BAN_HANG">Bán hàng (đo đơn, doanh thu)</option></Select></Field>
      <Field label="Định dạng"><Select value={f.dinh_dang} onChange={e=>set('dinh_dang',e.target.value)}><option value="">— chưa quy định —</option>{db.hang_so.dinh_dang.map(d=><option key={d} value={d}>{DINH_DANG_ICON[d]}</option>)}</Select></Field>
      <Sel k="kenh_id" l="Kênh" ds={(db.kenh||[]).filter(k=>k.active)}/>
      <Sel k="framework_id" l="Framework" ds={(db.frameworks||[]).filter(x=>x.active)}/>
      <Sel k="san_pham_id" l="Sản phẩm" ds={(db.san_pham||[]).filter(x=>x.active&&(!f.dong||!x.dong||x.dong===f.dong))} ten={s=>(s.ma?s.ma+' · ':'')+s.ten}/>
      <Field label="Tháng"><Input type="month" value={f.thang} onChange={e=>set('thang',e.target.value)}/></Field>
      <Field label="Ngày đăng dự kiến" hint={f.ngay_dang?('→ tuần '+(tuanCuaNgayFE(f.ngay_dang)||'?')):''}><Input type="date" value={f.ngay_dang} onChange={e=>set('ngay_dang',e.target.value)}/></Field>
      <Field label="Tuần (đặt tay)" hint="để trống = theo ngày đăng"><Select value={String(f.tuan)} onChange={e=>set('tuan',e.target.value)}><option value="">— theo ngày đăng —</option>{[1,2,3,4,5,6].map(t=><option key={t} value={t}>Tuần {t}</option>)}</Select></Field>
      <Field label="Ghi chú / brief" className="sm:col-span-2"><Textarea rows="2" value={f.ghi_chu} onChange={e=>set('ghi_chu',e.target.value)}/></Field>
    </div>
    <div className="flex justify-between gap-2">{init.id&&init.giai_doan==='Y_TUONG'?<LinkBtn tone="danger" onClick={xoa}>Xoá</LinkBtn>:<span/>}<div className="flex gap-2"><Btn variant="ghost" onClick={onClose}>Huỷ</Btn><Btn variant="brand" onClick={luu} disabled={busy||!f.tieu_de.trim()}>Lưu</Btn></div></div>
  </Modal>;
}
// ----- Ý tưởng & trend (B1): máy gom + chấm, người quyết (máy học) -----
function YTuong({chiXem}){
  const { db, me, goi, notify } = useApp(); const [loc,setLoc]=useState('MOI'); const [them,setThem]=useState(false); const [busy,setBusy]=useState(false); const [lyDo,setLyDo]=useState({});
  const ds=(db.y_tuong||[]).filter(y=>loc==='TAT_CA'||y.trang_thai===loc); const b1=(db.buoc||[]).find(b=>b.ma==='B1')||{}; const cfgT=(db.module_config||{}).trend||{};
  const quyet=async(y,q)=>{ const r=await goi('/y-tuong/'+y.id+'/quyet',{method:'POST',body:{quyet:q, ly_do:lyDo[y.id]||''}}); if(r.ok) notify(q==='DUYET'?('Đã duyệt'+(r.muc_id?' → tạo mục kế hoạch':'')):'Đã bỏ'); else notify(r.msg,'err'); };
  const gomThu=async()=>{ setBusy(true); const r=await goi('/may/chay-thu',{method:'POST',body:{agent:'GOM_TREND'}}); setBusy(false); if(r.ok) notify((r.kq[0]||{}).tom_tat||'Xong'); else notify(r.msg,'err'); };
  const pTen=id=>((db.pillars||[]).find(p=>p.id===id)||{}).ten;
  return <div className="space-y-3">
    <Card pad="p-3"><div className="flex items-center justify-between gap-2 flex-wrap"><div><SectionTitle>Máy gom trend mỗi sáng (B1 · {MUC_LABEL[b1.nguoi_thuc_hien]||'Người làm'})</SectionTitle><div className="text-[11px] text-ink-muted">Nguồn: Google Trends VN{db.san_sang.youtube?' · YouTube VN':' · (YouTube: chưa cắm key)'} · từ khoá ngành: {(cfgT.tu_khoa_nganh||[]).length?(cfgT.tu_khoa_nganh||[]).join(', '):'chưa đặt (nhận tất cả — dễ ngập)'} · {db.san_sang.ai?'AI chấm sẵn':'chưa có AI chấm (ANTHROPIC_API_KEY)'} · tự duyệt khi AI tự làm & điểm ≥ {cfgT.nguong_tu_duyet}</div></div>
      <div className="flex gap-2">{laGat(me)&&<Btn variant="ghost" onClick={gomThu} disabled={busy}>{busy?'Đang gom…':'▶ Gom thử ngay'}</Btn>}{!chiXem&&<Btn variant="brand" onClick={()=>setThem(true)}>＋ Ý tưởng của tôi</Btn>}</div></div></Card>
    <Tabs size="sm" active={loc} onChange={setLoc} tabs={[{key:'MOI',label:'Chờ chấm',count:(db.y_tuong||[]).filter(y=>y.trang_thai==='MOI').length},{key:'DUYET',label:'Đã duyệt'},{key:'BO',label:'Đã bỏ'},{key:'TAT_CA',label:'Tất cả'}]}/>
    {ds.length===0 ? <Empty>Không có ý tưởng nào ở mục này.</Empty> : <Card pad="">{ds.map(y=><div key={y.id} className="px-3 py-2 border-b border-line/60 flex items-start gap-3 text-xs flex-wrap">
      <div className={"font-display font-extrabold w-9 text-center shrink-0 "+(y.diem_may==null?'text-slate-500':y.diem_may>=(cfgT.nguong_tu_duyet||70)?'text-emerald-600':y.diem_may>=40?'text-amber-600':'text-rose-500')} title="điểm máy chấm">{y.diem_may==null?'—':y.diem_may}</div>
      <div className="min-w-0 flex-1"><div className="font-semibold text-ink">{y.ten} {y.rui_ro&&<Pill cls="bg-rose-100 text-rose-700">rủi ro claim</Pill>} {y.muc_id&&<Pill cls="bg-emerald-100 text-emerald-800">đã thành mục</Pill>}</div>
        <div className="text-[11px] text-ink-muted">{y.nguon} · {y.ngay}{y.pillar_id?(' · '+pTen(y.pillar_id)):''}{y.dinh_dang?(' · '+y.dinh_dang):''} · <Pill cls={MUC_TIEU_CLS[y.muc_tieu]}>{MUC_TIEU_LABEL[y.muc_tieu]||'Brand'}</Pill>{y.link&&<> · <a className="text-brand-dark hover:underline" href={y.link} target="_blank" rel="noreferrer">link</a></>}</div>
        {y.ly_do_may&&<div className="text-[11px] text-ink-soft mt-0.5">🤖 {y.ly_do_may}</div>}{y.mo_ta&&<div className="text-[11px] text-ink-muted mt-0.5 line-clamp-2">{y.mo_ta}</div>}
        {y.trang_thai!=='MOI'&&<div className="text-[11px] text-ink-muted mt-0.5">{y.trang_thai==='DUYET'?'✓ duyệt':'✗ bỏ'} · {y.quyet_boi} · {fmtDate(y.quyet_at)}{y.ly_do_nguoi?(' · '+y.ly_do_nguoi):''}</div>}</div>
      {y.trang_thai==='MOI'&&!chiXem&&<div className="flex flex-col gap-1 shrink-0 w-full sm:w-40"><Input className="!py-1 !px-2 text-[11px]" placeholder="lý do (máy học)" value={lyDo[y.id]||''} onChange={e=>setLyDo({...lyDo,[y.id]:e.target.value})}/><div className="flex gap-1"><Btn variant="ok" className="!py-1 !px-2 text-[11px] flex-1" onClick={()=>quyet(y,'DUYET')}>Duyệt → mục</Btn><Btn variant="ghost" className="!py-1 !px-2 text-[11px]" onClick={()=>quyet(y,'BO')}>Bỏ</Btn></div></div>}
    </div>)}</Card>}
    {them && <YTuongForm onClose={()=>setThem(false)}/>}
  </div>;
}
function YTuongForm({onClose}){
  const { db, goi, notify } = useApp(); const [f,setF]=useState({ten:'',mo_ta:'',link:'',pillar_id:'',dinh_dang:'',muc_tieu:'BRAND'}); const [busy,setBusy]=useState(false);
  const luu=async()=>{ setBusy(true); const r=await goi('/y-tuong',{method:'POST',body:f}); setBusy(false); if(r.ok){ notify('Đã thêm ý tưởng'+(db.san_sang.ai?' — máy đã chấm':'')); onClose(); } else notify(r.msg,'err'); };
  return <Modal open onClose={onClose} title="Ý tưởng của tôi">
    <Field label="Tên ý tưởng" required><Input value={f.ten} onChange={e=>setF({...f,ten:e.target.value})}/></Field>
    <Field label="Mô tả"><Textarea rows="3" value={f.mo_ta} onChange={e=>setF({...f,mo_ta:e.target.value})}/></Field>
    <Field label="Link tham khảo"><Input value={f.link} onChange={e=>setF({...f,link:e.target.value})}/></Field>
    <div className="grid grid-cols-3 gap-2"><Field label="Pillar"><Select value={f.pillar_id} onChange={e=>setF({...f,pillar_id:e.target.value})}><option value="">—</option>{(db.pillars||[]).filter(p=>p.active).map(p=><option key={p.id} value={p.id}>{p.ten}</option>)}</Select></Field>
      <Field label="Định dạng"><Select value={f.dinh_dang} onChange={e=>setF({...f,dinh_dang:e.target.value})}><option value="">—</option>{db.hang_so.dinh_dang.map(d=><option key={d} value={d}>{d}</option>)}</Select></Field>
      <Field label="Mục tiêu"><Select value={f.muc_tieu} onChange={e=>setF({...f,muc_tieu:e.target.value})}><option value="BRAND">Brand</option><option value="BAN_HANG">Bán hàng</option></Select></Field></div>
    <div className="flex justify-end gap-2"><Btn variant="ghost" onClick={onClose}>Huỷ</Btn><Btn variant="brand" onClick={luu} disabled={busy||!f.ten.trim()}>Lưu</Btn></div></Modal>;
}
// ----- Danh mục gốc — một bảng dùng chung, khác nhau ở cột & form -----
const DM_META = {
  pillars:    { ten:'Pillar (trụ cột)', cot:[['ten','Tên'],['ty_trong','Tỷ trọng %'],['muc_tieu','Mục tiêu'],['mo_ta','Mô tả']], form:[['ten','Tên','text'],['ty_trong','Tỷ trọng (%)','number'],['muc_tieu','Mục tiêu (KPI đo)','muctieu'],['thu_tu','Thứ tự','number'],['mo_ta','Mô tả','textarea']] },
  frameworks: { ten:'Framework (nhóm kịch bản)', cot:[['ten','Tên'],['pillar_id','Pillar'],['mo_ta','Mô tả']], form:[['ten','Tên','text'],['pillar_id','Pillar','pillar'],['mo_ta','Mô tả / cấu trúc','textarea']] },
  san_pham:   { ten:'Sản phẩm & thông số thật', cot:[['ma','Mã'],['ten','Tên'],['dong','Dòng'],['thong_so','Thông số']], form:[['ma','Mã','text'],['ten','Tên','text'],['dong','Dòng','text'],['thong_so','Thông số (mỗi dòng: tên: giá trị)','thongso'],['tieu_chuan','Tiêu chuẩn','text'],['bao_hanh','Bảo hành (cam kết chính thức)','text'],['huong_dan','Hướng dẫn dùng','textarea'],['quy_trinh','Quy trình thi công chuẩn (mỗi dòng một bước, theo đúng thứ tự — máy dùng để đọc footage và kiểm video đúng kỹ thuật)','textarea'],['bai_test','Bài test / chứng minh (mỗi dòng một bài, ví dụ: Đổ nước lên bề mặt · Cào dao · Chà bàn chải — máy nhận ra cảnh test theo danh sách này)','textarea'],['mo_ta','Mô tả','textarea']] },
  claim_cam:  { ten:'Claim cấm', cot:[['cum_tu','Cụm từ'],['muc_do','Mức'],['ly_do','Lý do']], form:[['cum_tu','Cụm từ','text'],['muc_do','Mức độ','mucdo'],['ly_do','Lý do','textarea']] },
  kenh:       { ten:'Kênh', cot:[['ten','Tên'],['loai','Loại'],['api_ma','Mã API'],['co_token','Token']], form:[['ten','Tên','text'],['loai','Loại (FANPAGE / YOUTUBE / TIKTOK / ZALO / WEBSITE)','text'],['api_ma','Mã API (secret TOKEN_<mã>)','text'],['api_object_id','ID đối tượng (Page ID…)','text'],['cach_dang','Cách đăng','cachdang']] },
};
function DanhMuc({bang, chiXem}){
  const { db, goi, notify } = useApp(); const meta=DM_META[bang]; const rows=db[bang]||[];
  const [edit,setEdit]=useState(null); const [anTat,setAnTat]=useState(true);
  const ds=rows.filter(r=>!anTat || r.active!==false);
  const hien=(r,k)=>{ if(k==='thong_so') return (r.thong_so||[]).map(x=>x.k+': '+x.v).join(' · ').slice(0,80); if(k==='pillar_id') return ((db.pillars||[]).find(p=>p.id===r.pillar_id)||{}).ten||'—'; if(k==='co_token') return r.co_token?'● có':'○ chưa'; if(k==='muc_do') return r.muc_do==='CHAN'?'CHẶN':'cảnh báo'; if(k==='muc_tieu') return MUC_TIEU_LABEL[r.muc_tieu]||'Brand'; return r[k]==null?'':String(r[k]); };
  const xoa=async(r)=>{ if(!confirm((bang==='claim_cam'?'Xoá':'Tắt')+' "'+(r.ten||r.cum_tu)+'"?')) return; const x=await goi('/danh-muc/'+bang+'/'+r.id,{method:'DELETE'}); if(x.ok) notify('Đã '+(bang==='claim_cam'?'xoá':'tắt')); else notify(x.msg,'err'); };
  return <Card pad="">
    <div className="px-3 py-2 border-b border-line flex items-center justify-between gap-2 flex-wrap"><SectionTitle>{meta.ten} <span className="text-ink-muted font-normal">({ds.length})</span></SectionTitle>
      <div className="flex gap-2 items-center">{bang!=='claim_cam' && <label className="text-[11px] text-ink-muted flex items-center gap-1"><input type="checkbox" checked={anTat} onChange={e=>setAnTat(e.target.checked)}/> ẩn đã tắt</label>}{!chiXem && <Btn variant="brand" className="!py-1.5 text-xs" onClick={()=>setEdit({})}>＋ Thêm</Btn>}</div></div>
    {ds.length===0 ? <Empty>Chưa có. {bang==='san_pham'&&'Máy chỉ được nói những thông số ghi ở đây.'}</Empty>
    : <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="text-left text-ink-muted border-b border-line">{meta.cot.map(([k,l])=><th key={k} className="px-3 py-2 font-semibold">{l}</th>)}<th/></tr></thead>
      <tbody>{ds.map(r=><tr key={r.id} className={"border-b border-line/60 "+(r.active===false?'opacity-50':'')}>{meta.cot.map(([k])=><td key={k} className="px-3 py-2 text-ink max-w-[260px] truncate">{hien(r,k)}</td>)}
        <td className="px-3 py-2 text-right whitespace-nowrap">{!chiXem && <><LinkBtn onClick={()=>setEdit(r)}>Sửa</LinkBtn> <LinkBtn tone="danger" onClick={()=>xoa(r)}>{bang==='claim_cam'?'Xoá':(r.active===false?'':'Tắt')}</LinkBtn></>}</td></tr>)}</tbody></table></div>}
    {edit && <DanhMucForm bang={bang} init={edit} onClose={()=>setEdit(null)}/>}
  </Card>;
}
function DanhMucForm({bang, init, onClose}){
  const { db, goi, notify } = useApp(); const meta=DM_META[bang];
  const [f,setF]=useState(()=>{ const o={...init}; if(bang==='san_pham') o.thong_so_text=(init.thong_so||[]).map(x=>x.k+': '+x.v).join('\n'); if(o.active===undefined) o.active=true; return o; });
  const [busy,setBusy]=useState(false);
  const luu=async()=>{ const body={...f}; delete body.id; delete body.co_token; delete body.created_at;
    if(bang==='san_pham'){ body.thong_so=String(f.thong_so_text||'').split('\n').map(l=>l.trim()).filter(Boolean).map(l=>{ const i=l.indexOf(':'); return i>0?{k:l.slice(0,i).trim(), v:l.slice(i+1).trim()}:{k:l, v:''}; }); delete body.thong_so_text; }
    setBusy(true); const r=await goi('/danh-muc/'+bang+(init.id?('/'+init.id):''),{method:init.id?'PATCH':'POST',body}); setBusy(false); if(r.ok){ notify('Đã lưu'); onClose(); } else notify(r.msg,'err'); };
  const O=({k,l,t})=>{ const v=f[k]==null?'':f[k]; const set=x=>setF(o=>({...o,[k]:x}));
    if(t==='textarea') return <Field label={l}><Textarea rows="3" value={v} onChange={e=>set(e.target.value)}/></Field>;
    if(t==='number') return <Field label={l}><Input type="number" value={v} onChange={e=>set(e.target.value)}/></Field>;
    if(t==='thongso') return <Field label={l} hint="VD: Phạm vi sử dụng: Trong nhà và ngoài trời"><Textarea rows="5" value={f.thong_so_text||''} onChange={e=>setF(o=>({...o,thong_so_text:e.target.value}))}/></Field>;
    if(t==='pillar') return <Field label={l}><Select value={v} onChange={e=>set(e.target.value)}><option value="">— chọn —</option>{(db.pillars||[]).map(p=><option key={p.id} value={p.id}>{p.ten}</option>)}</Select></Field>;
    if(t==='muctieu') return <Field label={l} hint="Brand: đo tiếp cận, lượt xem, chia sẻ, tương tác. Bán hàng: đo đơn, doanh thu (3 mức tin cậy)."><Select value={v||'BRAND'} onChange={e=>set(e.target.value)}><option value="BRAND">Brand</option><option value="BAN_HANG">Bán hàng</option></Select></Field>;
    if(t==='mucdo') return <Field label={l} hint="CHẶN: không cho lưu nội dung có cụm này. Cảnh báo: chỉ nhắc."><Select value={v||'CANH_BAO'} onChange={e=>set(e.target.value)}><option value="CHAN">CHẶN</option><option value="CANH_BAO">Cảnh báo</option></Select></Field>;
    if(t==='cachdang') return <Field label={l}><Select value={v||'TAY'} onChange={e=>set(e.target.value)}><option value="TAY">Đăng tay (máy giao việc)</option><option value="API">API nền tảng (cần TOKEN_)</option><option value="N8N">Qua n8n</option><option value="TRAM">Qua Trạm máy văn phòng (trình duyệt đã đăng nhập)</option></Select></Field>;
    return <Field label={l}><Input value={v} onChange={e=>set(e.target.value)}/></Field>; };
  return <Modal open onClose={onClose} title={(init.id?'Sửa ':'Thêm ')+meta.ten}>
    {meta.form.map(([k,l,t])=><O key={k} k={k} l={l} t={t}/>)}
    {init.id && bang!=='claim_cam' && <label className="flex items-center gap-2 text-sm mb-3"><Toggle on={f.active!==false} onChange={v=>setF(o=>({...o,active:v}))}/> Đang dùng</label>}
    <div className="flex justify-end gap-2"><Btn variant="ghost" onClick={onClose}>Huỷ</Btn><Btn variant="brand" onClick={luu} disabled={busy}>Lưu</Btn></div>
  </Modal>;
}
// ----- Bản đồ thông điệp seeding (ADR-007 · bản vẽ §11 tầng 2): thuộc chiến lược, máy dùng để soạn biến thể -----
function ThongDiepSeeding({chiXem}){
  const { db, goi, notify } = useApp(); const ds=((db.seeding||{}).thong_diep||[]); const pillars=(db.pillars||[]).filter(p=>p.active);
  const [edit,setEdit]=useState(null); const [busy,setBusy]=useState(false);
  const luu=async()=>{ setBusy(true); const r=await goi('/seeding/thong-diep'+(edit.id?('/'+edit.id):''),{method:edit.id?'PATCH':'POST',body:{...edit, du_kien:(edit.du_kien_text||'').split('\n').map(x=>x.trim()).filter(Boolean)}}); setBusy(false); if(r.ok){ notify('Đã lưu thông điệp'); setEdit(null); } else notify(r.msg,'err'); };
  const deXuat=async()=>{ if(!confirm('Máy đọc định vị + pillar + thông số sản phẩm thật để đề xuất 5–8 thông điệp. Tiếp tục?')) return; setBusy(true); const r=await goi('/seeding/thong-diep',{method:'POST',body:{de_xuat_ai:true}}); setBusy(false); if(r.ok) notify('Máy thêm '+r.them+' thông điệp — sửa lại cho đúng cách thợ nói'); else notify(r.msg,'err'); };
  const tat=async(t)=>{ if(!confirm('Tắt thông điệp "'+t.ten+'"?')) return; const r=await goi('/seeding/thong-diep/'+t.id,{method:'DELETE'}); if(r.ok) notify('Đã tắt'); else notify(r.msg,'err'); };
  return <div className="space-y-3">
    <div className="flex items-center justify-between gap-2 flex-wrap"><div><SectionTitle>Bản đồ thông điệp ({ds.filter(t=>t.active).length} đang dùng)</SectionTitle><div className="text-[11px] text-ink-muted">Mỗi thông điệp = một ý định vị được nói bằng ngôn ngữ thợ, kèm dữ kiện thật được phép dùng và điều không được nói. Máy soạn biến thể seeding chỉ từ đây.</div></div>
      {!chiXem&&<div className="flex gap-2"><Btn variant="ghost" className="!py-1.5 text-xs" onClick={deXuat} disabled={busy||!db.san_sang.ai} title={db.san_sang.ai?'':'Cần ANTHROPIC_API_KEY'}>✨ Máy đề xuất từ chiến lược</Btn><Btn variant="brand" className="!py-1.5 text-xs" onClick={()=>setEdit({active:true, du_kien_text:''})}>＋ Thêm thông điệp</Btn></div>}</div>
    {ds.length===0?<Empty>Chưa có thông điệp — máy chưa soạn được gói seeding. Thêm tay hoặc để máy đề xuất từ chiến lược.</Empty>:<div className="grid md:grid-cols-2 gap-2">{ds.map(t=><Card key={t.id} pad="p-3" className={t.active?'':'opacity-50'}>
      <div className="flex items-start justify-between gap-2"><div className="font-semibold text-ink text-sm">{t.ten}</div><div className="flex gap-2 shrink-0">{t.pillar_id&&<Pill>{(pillars.find(p=>p.id===t.pillar_id)||{}).ten||t.pillar_id}</Pill>}<Pill cls={t.tao_boi==='AGENT'?'bg-brand-bg text-brand-dark':'bg-slate-100 text-ink-muted'}>{t.tao_boi==='AGENT'?'🤖 máy đề xuất':'người'}</Pill></div></div>
      <div className="text-xs text-ink-soft mt-1">{t.y_chinh}</div>
      {(t.du_kien||[]).length>0&&<div className="text-[11px] text-ink-muted mt-1">📌 Dữ kiện: {t.du_kien.join(' · ')}</div>}
      {t.cach_noi_tho&&<div className="text-[11px] text-ink-muted mt-0.5">🗣 Thợ hay nói: {t.cach_noi_tho}</div>}
      {t.khong_noi&&<div className="text-[11px] text-rose-700 mt-0.5">🚫 Không nói: {t.khong_noi}</div>}
      {!chiXem&&<div className="flex gap-3 mt-2"><LinkBtn onClick={()=>setEdit({...t, du_kien_text:(t.du_kien||[]).join('\n')})}>Sửa</LinkBtn>{t.active&&<LinkBtn tone="danger" onClick={()=>tat(t)}>Tắt</LinkBtn>}</div>}
    </Card>)}</div>}
    {edit&&<Modal open onClose={()=>setEdit(null)} title={edit.id?'Sửa thông điệp':'Thêm thông điệp seeding'}>
      <Field label="Tên thông điệp" required><Input value={edit.ten||''} onChange={e=>setEdit({...edit,ten:e.target.value})} placeholder="VD: Ron không ố sau mùa mưa"/></Field>
      <Field label="Ý chính (1–2 câu)"><Textarea rows="2" value={edit.y_chinh||''} onChange={e=>setEdit({...edit,y_chinh:e.target.value})}/></Field>
      <Field label="Dữ kiện được dùng — mỗi dòng một dữ kiện" hint="chỉ lấy từ thông số / bảo hành / tiêu chuẩn thật của sản phẩm"><Textarea rows="3" value={edit.du_kien_text||''} onChange={e=>setEdit({...edit,du_kien_text:e.target.value})}/></Field>
      <div className="grid grid-cols-2 gap-2"><Field label="Thợ hay nói thế nào"><Input value={edit.cach_noi_tho||''} onChange={e=>setEdit({...edit,cach_noi_tho:e.target.value})} placeholder="ron sạch, không mốc đen…"/></Field><Field label="Không được nói"><Input value={edit.khong_noi||''} onChange={e=>setEdit({...edit,khong_noi:e.target.value})} placeholder="giá, 'tuyệt đối', tên đối thủ…"/></Field></div>
      <div className="grid grid-cols-2 gap-2"><Field label="Pillar"><Select value={edit.pillar_id||''} onChange={e=>setEdit({...edit,pillar_id:e.target.value||null})}><option value="">—</option>{pillars.map(p=><option key={p.id} value={p.id}>{p.ten}</option>)}</Select></Field><Field label="Thứ tự ưu tiên" hint="số nhỏ = ưu tiên"><Input type="number" value={edit.thu_tu??0} onChange={e=>setEdit({...edit,thu_tu:e.target.value})}/></Field></div>
      {edit.id&&<label className="flex items-center gap-2 text-sm mb-3"><Toggle on={edit.active!==false} onChange={v=>setEdit({...edit,active:v})}/> Đang dùng</label>}
      <div className="flex justify-end gap-2"><Btn variant="ghost" onClick={()=>setEdit(null)}>Huỷ</Btn><Btn variant="brand" onClick={luu} disabled={busy||!(edit.ten||'').trim()}>Lưu</Btn></div></Modal>}
  </div>;
}
