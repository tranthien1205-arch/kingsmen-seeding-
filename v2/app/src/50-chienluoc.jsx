// ===== MÀN 2 — CHIẾN LƯỢC & KẾ HOẠCH. Đợt 1: chiến lược cơ bản + danh mục gốc. Kế hoạch tháng/tuần/trend: đợt 2 =====
function ChienLuocKeHoach(){
  const { me, db } = useApp();
  const [tab,setTab]=useState('chienluoc');
  const chiXem=!laStaff(me);
  const tabs=[{key:'chienluoc',label:'Định vị & chiến lược'},{key:'pillars',label:'Pillar'},{key:'frameworks',label:'Framework'},{key:'san_pham',label:'Sản phẩm'},{key:'claim_cam',label:'Claim cấm'},{key:'kenh',label:'Kênh'},{key:'kehoach',label:'Kế hoạch tháng · tuần'}];
  return <div className="space-y-4">
    <PageHeader title="🎯 Chiến lược & Kế hoạch" sub="Cổng G1 (chốt chiến lược) và G2 (chốt kế hoạch tháng). Danh mục gốc ở đây là dữ kiện thật duy nhất máy được dùng."/>
    <Tabs size="sm" active={tab} onChange={setTab} tabs={tabs}/>
    {tab==='chienluoc' && <ChienLuocForm chiXem={chiXem}/>}
    {tab==='pillars' && <DanhMuc bang="pillars" chiXem={chiXem}/>}
    {tab==='frameworks' && <DanhMuc bang="frameworks" chiXem={chiXem}/>}
    {tab==='san_pham' && <DanhMuc bang="san_pham" chiXem={chiXem}/>}
    {tab==='claim_cam' && <DanhMuc bang="claim_cam" chiXem={chiXem}/>}
    {tab==='kenh' && <DanhMuc bang="kenh" chiXem={chiXem}/>}
    {tab==='kehoach' && db.mo_phong && <KeHoachMoPhong/>}
    {tab==='kehoach' && !db.mo_phong && <Callout tone="note"><b>Đợt 2 (ADR-002):</b> kế hoạch tháng máy đề xuất ngày 25 từ chiến lược + kết quả tháng trước + trend đã duyệt → Trưởng MKT sửa & <b>Chốt</b> (G2) → máy chia tuần, tạo mục nội dung. Trend & ý tưởng máy gom cũng nằm ở tab này.</Callout>}
  </div>;
}
function ChienLuocForm({chiXem}){
  const { db, goi, notify } = useApp(); const cl=db.chien_luoc||{};
  const [f,setF]=useState({dinh_vi:cl.dinh_vi||'', tong_giong:cl.tong_giong||'', doi_tuong:cl.doi_tuong||''});
  useEffect(()=>{ setF({dinh_vi:cl.dinh_vi||'', tong_giong:cl.tong_giong||'', doi_tuong:cl.doi_tuong||''}); },[cl.updated_at]);
  const [busy,setBusy]=useState(false);
  const luu=async()=>{ setBusy(true); const r=await goi('/chien-luoc',{method:'PUT',body:f}); setBusy(false); if(r.ok) notify('Đã lưu chiến lược'); else notify(r.msg,'err'); };
  const tongPillar=(db.pillars||[]).filter(p=>p.active).reduce((s,p)=>s+Number(p.ty_trong||0),0);
  return <div className="grid lg:grid-cols-[2fr_1fr] gap-3">
    <Card>
      <div className="flex items-center justify-between mb-3"><SectionTitle>Định vị & chiến lược</SectionTitle><Pill cls={cl.phien_ban>0?'bg-emerald-100 text-emerald-800':'bg-amber-100 text-amber-800'}>{cl.phien_ban>0?('phiên bản '+cl.phien_ban+' · chốt '+fmtDate(cl.chot_at)):'chưa chốt (G1 mở ở đợt 2)'}</Pill></div>
      <Field label="Định vị thương hiệu" hint="Kingsmen là gì, khác gì, hứa gì. Máy dùng nguyên văn để giữ nhất quán."><Textarea rows="4" value={f.dinh_vi} onChange={e=>setF({...f,dinh_vi:e.target.value})} disabled={chiXem}/></Field>
      <Field label="Tông giọng"><Textarea rows="2" value={f.tong_giong} onChange={e=>setF({...f,tong_giong:e.target.value})} disabled={chiXem} placeholder="VD: chuyên gia, chắc chắn, không hô hào…"/></Field>
      <Field label="Đối tượng"><Textarea rows="2" value={f.doi_tuong} onChange={e=>setF({...f,doi_tuong:e.target.value})} disabled={chiXem} placeholder="VD: nhà thầu, thợ ốp lát, chủ nhà đang hoàn thiện…"/></Field>
      {!chiXem && <Btn variant="brand" onClick={luu} disabled={busy}>{busy?'Đang lưu…':'💾 Lưu'}</Btn>}
    </Card>
    <Card pad="p-3"><SectionTitle className="mb-2">Trụ cột nội dung</SectionTitle>
      {(db.pillars||[]).filter(p=>p.active).map(p=><div key={p.id} className="mb-2"><div className="flex justify-between text-xs"><span className="text-ink font-semibold">{p.ten}</span><span className="text-ink-muted">{p.ty_trong}%</span></div><Thanh pct={p.ty_trong}/></div>)}
      <div className={"text-[11px] mt-2 "+(tongPillar===100?'text-emerald-700':'text-amber-700')}>Tổng {tongPillar}% {tongPillar!==100 && '— nên bằng 100%'}</div>
    </Card>
  </div>;
}
// Mô phỏng màn Kế hoạch (đợt 2): Tháng (máy đề xuất ↔ người chốt G2) · Tuần (còn thiếu) · Trend & ý tưởng
function KeHoachMoPhong(){
  const { notify } = useApp(); const bao=mpBao(notify,2); const k=MP.ke_hoach;
  const Khoi=({tieu,rows})=><Card pad="p-3"><SectionTitle className="mb-2">{tieu}</SectionTitle>{rows.map(([ten,ct,co])=><div key={ten} className="mb-1.5"><div className="flex justify-between text-xs"><span className="text-ink">{ten}</span><span className={co<ct?'text-amber-700':'text-emerald-700'}>{co}/{ct}</span></div><Thanh pct={ct?co/ct*100:0} cls={co>=ct?'bg-emerald-500':'bg-brand'}/></div>)}</Card>;
  return <div className="space-y-3">
    <Card><div className="flex items-center justify-between gap-2 flex-wrap"><div><SectionTitle>Kế hoạch tháng {MP.thang} <Pill cls="bg-amber-100 text-amber-800">CHỜ CHỐT (G2)</Pill></SectionTitle><div className="text-[11px] text-ink-muted">{k.nguon}</div></div>
      <div className="flex gap-2"><Btn variant="ghost" onClick={bao}>✨ Máy đề xuất lại</Btn><Btn variant="brand" onClick={bao}>✅ Chốt kế hoạch tháng</Btn></div></div>
      <div className="grid sm:grid-cols-3 gap-2 mt-3"><div className="rounded-xl bg-slate-50 p-2"><div className="text-[11px] text-ink-muted">Chỉ tiêu tổng</div><div className="font-display text-xl font-extrabold text-ink">{k.tong} bài</div></div><div className="rounded-xl bg-slate-50 p-2 sm:col-span-2"><div className="text-[11px] text-ink-muted">Định hướng (máy viết từ chiến lược + kết quả tháng 9, người sửa được)</div><div className="text-xs text-ink mt-1">{k.dinh_huong}</div></div></div></Card>
    <div className="grid lg:grid-cols-3 gap-3"><Khoi tieu="Theo pillar" rows={k.pillar}/><Khoi tieu="Theo định dạng" rows={k.dinh_dang}/><Khoi tieu="Theo kênh" rows={k.kenh}/></div>
    <SectionTitle>Tuần — máy chia, người sửa khi cần</SectionTitle>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">{MP.tuan.map(t=><Card key={t.t} pad="p-3"><div className="flex justify-between text-xs font-bold text-ink-muted"><span>Tuần {t.t}</span><span className={t.co<t.ct?'text-amber-700':'text-emerald-700'}>{t.co}/{t.ct}</span></div>{t.thieu.length?<div className="text-[10px] text-amber-700 mt-1">thiếu: {t.thieu.join(' · ')}</div>:<div className="text-[10px] text-emerald-700 mt-1">✓ đủ</div>}<LinkBtn className="mt-1" onClick={bao}>+ máy tạo mục còn thiếu</LinkBtn></Card>)}</div>
    <SectionTitle>Trend & ý tưởng máy gom (B1 — người chấm, máy học)</SectionTitle>
    <Card pad="">{MP.y_tuong.map((y,i)=><div key={i} className="px-3 py-2 border-b border-line/60 flex items-center gap-3 text-xs"><span className={"font-display font-extrabold w-8 text-center "+(y.diem>=70?'text-emerald-600':y.diem>=40?'text-amber-600':'text-rose-500')}>{y.diem}</span><div className="min-w-0 flex-1"><div className="font-semibold text-ink">{y.ten}</div><div className="text-[10px] text-ink-muted">{y.nguon} · pillar {y.pillar} · {y.tt}</div></div>{/CHỜ/.test(y.tt)&&<div className="flex gap-1"><Btn variant="ok" className="!py-1 !px-2 text-[11px]" onClick={bao}>Duyệt</Btn><Btn variant="ghost" className="!py-1 !px-2 text-[11px]" onClick={bao}>Bỏ</Btn></div>}</div>)}</Card>
  </div>;
}
// Danh mục gốc — một bảng dùng chung, khác nhau ở cột & form
const DM_META = {
  pillars:    { ten:'Pillar (trụ cột)', cot:[['ten','Tên'],['ty_trong','Tỷ trọng %'],['mo_ta','Mô tả']], form:[['ten','Tên','text'],['ty_trong','Tỷ trọng (%)','number'],['thu_tu','Thứ tự','number'],['mo_ta','Mô tả','textarea']] },
  frameworks: { ten:'Framework (nhóm kịch bản)', cot:[['ten','Tên'],['pillar_id','Pillar'],['mo_ta','Mô tả']], form:[['ten','Tên','text'],['pillar_id','Pillar','pillar'],['mo_ta','Mô tả / cấu trúc','textarea']] },
  san_pham:   { ten:'Sản phẩm & thông số thật', cot:[['ma','Mã'],['ten','Tên'],['dong','Dòng'],['thong_so','Thông số']], form:[['ma','Mã','text'],['ten','Tên','text'],['dong','Dòng','text'],['thong_so','Thông số (mỗi dòng: tên: giá trị)','thongso'],['tieu_chuan','Tiêu chuẩn','text'],['bao_hanh','Bảo hành (cam kết chính thức)','text'],['huong_dan','Hướng dẫn dùng','textarea'],['mo_ta','Mô tả','textarea']] },
  claim_cam:  { ten:'Claim cấm', cot:[['cum_tu','Cụm từ'],['muc_do','Mức'],['ly_do','Lý do']], form:[['cum_tu','Cụm từ','text'],['muc_do','Mức độ','mucdo'],['ly_do','Lý do','textarea']] },
  kenh:       { ten:'Kênh', cot:[['ten','Tên'],['loai','Loại'],['api_ma','Mã API'],['co_token','Token']], form:[['ten','Tên','text'],['loai','Loại (FANPAGE / YOUTUBE / TIKTOK / ZALO / WEBSITE)','text'],['api_ma','Mã API (secret TOKEN_<mã>)','text'],['api_object_id','ID đối tượng (Page ID…)','text'],['cach_dang','Cách đăng','cachdang']] },
};
function DanhMuc({bang, chiXem}){
  const { db, goi, notify } = useApp(); const meta=DM_META[bang]; const rows=db[bang]||[];
  const [edit,setEdit]=useState(null); const [anTat,setAnTat]=useState(true);
  const ds=rows.filter(r=>!anTat || r.active!==false);
  const hien=(r,k)=>{ if(k==='thong_so') return (r.thong_so||[]).map(x=>x.k+': '+x.v).join(' · ').slice(0,80); if(k==='pillar_id') return ((db.pillars||[]).find(p=>p.id===r.pillar_id)||{}).ten||'—'; if(k==='co_token') return r.co_token?'● có':'○ chưa'; if(k==='muc_do') return r.muc_do==='CHAN'?'CHẶN':'cảnh báo'; return r[k]==null?'':String(r[k]); };
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
    if(t==='mucdo') return <Field label={l} hint="CHẶN: không cho lưu nội dung có cụm này. Cảnh báo: chỉ nhắc."><Select value={v||'CANH_BAO'} onChange={e=>set(e.target.value)}><option value="CHAN">CHẶN</option><option value="CANH_BAO">Cảnh báo</option></Select></Field>;
    if(t==='cachdang') return <Field label={l}><Select value={v||'TAY'} onChange={e=>set(e.target.value)}><option value="TAY">Đăng tay (máy giao việc)</option><option value="API">API nền tảng (cần TOKEN_)</option><option value="N8N">Qua n8n</option></Select></Field>;
    return <Field label={l}><Input value={v} onChange={e=>set(e.target.value)}/></Field>; };
  return <Modal open onClose={onClose} title={(init.id?'Sửa ':'Thêm ')+meta.ten}>
    {meta.form.map(([k,l,t])=><O key={k} k={k} l={l} t={t}/>)}
    {init.id && bang!=='claim_cam' && <label className="flex items-center gap-2 text-sm mb-3"><Toggle on={f.active!==false} onChange={v=>setF(o=>({...o,active:v}))}/> Đang dùng</label>}
    <div className="flex justify-end gap-2"><Btn variant="ghost" onClick={onClose}>Huỷ</Btn><Btn variant="brand" onClick={luu} disabled={busy}>Lưu</Btn></div>
  </Modal>;
}
