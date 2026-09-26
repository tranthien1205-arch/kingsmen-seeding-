// ===== ADR-021 — 🧭 HỒ SƠ ĐỊNH VỊ (tab đầu của Chiến lược & Kế hoạch) =====
// Chủ 26/09: "cốt lõi và định hướng chứ không cứng nhắc… luôn cập nhật xu hướng và cái mới… linh hoạt cho đội ngũ sáng tạo". Ba lớp:
// LÕI giữ vững (Trưởng MKT / Admin sửa) · Ý ĐỒ gợi ý hướng đi cho gốc content (cách kể tự do) · XU HƯỚNG cả đội thêm hằng tuần, tự hết hạn.
const LOAI_XH={ TREND:['🔥','Trend / chủ đề nóng'], DINH_DANG:['🎬','Định dạng mới'], INSIGHT:['💡','Insight khách hàng'], CAU_HAY:['✍️','Câu chữ hay'], KHAC:['📌','Khác'] };
const UU_TIEN_YD={ 1:['Ưu tiên','bg-rose-100 text-rose-800'], 2:['Vừa','bg-amber-100 text-amber-800'], 3:['Để sau','bg-slate-100 text-ink-muted'] };
const pillarTheoTen=(db,ten)=>{ const t=String(ten||'').trim().toLowerCase(); const p=t&&(db.pillars||[]).find(x=>x.active&&String(x.ten).trim().toLowerCase()===t); return p?p.id:''; };
function NutChep({text, nho}){ const { notify } = useApp();
  const chep=async e=>{ e.stopPropagation(); try{ await navigator.clipboard.writeText(text); notify('Đã chép'); }catch(err){ notify('Máy không cho chép — giữ tay lên chữ để chọn','warn'); } };
  return <button type="button" onClick={chep} title="Chép câu này" aria-label="Chép" className={"shrink-0 rounded-lg border border-line bg-white text-ink-muted hover:text-brand-dark hover:border-brand "+(nho?'px-1.5 py-0.5 text-[11px]':'px-2 py-1 text-xs')}>⧉</button>; }
// khối gập được: đầu khối bấm để mở / gập; nút phụ (phai) không làm gập
function KhoiHS({icon, tieu, phu, mo:mo0=true, phai, children}){ const [mo,setMo]=useState(mo0);
  return <Card pad="p-0" className="overflow-hidden">
    <div role="button" tabIndex={0} aria-expanded={mo} onClick={()=>setMo(!mo)} onKeyDown={e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); setMo(!mo); } }} className="flex items-center gap-2.5 px-4 py-3 cursor-pointer select-none hover:bg-slate-50/70">
      <span className="text-lg leading-none">{icon}</span>
      <div className="min-w-0 flex-1"><div className="font-display font-bold text-ink text-[15px] leading-tight">{tieu}</div>{phu&&<div className="text-[11.5px] text-ink-muted mt-0.5 leading-snug">{phu}</div>}</div>
      {phai&&<div onClick={e=>e.stopPropagation()} className="shrink-0">{phai}</div>}
      <span className="text-ink-muted text-[10px] w-4 text-center">{mo?'▲':'▼'}</span></div>
    {mo&&<div className="px-4 pb-4 pt-3 border-t border-line">{children}</div>}</Card>; }
const NhanNho=({children})=><div className="text-[10.5px] font-bold text-brand-dark tracking-[.1em] uppercase mb-1">{children}</div>;
// chip ý đồ trên thẻ mục (kanban, tuần & mục)
function YDoChip({id, boi}){ const { db } = useApp(); const y=(db.y_do||[]).find(x=>x.id===id);
  return <span title={y?y.thong_diep:'Ý đồ này đang tắt trong hồ sơ'} className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold bg-brand-bg text-brand-dark border border-brand/25 max-w-full"><span>🧭</span><span className="truncate">{y?y.ten:'ý đồ đã tắt'}</span>{boi==='MAY'&&<span title="máy gắn — đổi tự do">🤖</span>}</span>; }
// chọn ý đồ ngay trong popup mục (mọi định dạng)
function YDoMuc({muc, chiXem}){ const { db, goi, notify } = useApp(); const [busy,setBusy]=useState(false);
  const yds=(db.y_do||[]).filter(y=>!y.dong||!muc.dong||y.dong===muc.dong); const y=(db.y_do||[]).find(x=>x.id===muc.y_do);
  const nhom={}; yds.forEach(x=>{ (nhom[x.dong||'Mọi dòng']=nhom[x.dong||'Mọi dòng']||[]).push(x); });
  const doi=async v=>{ setBusy(true); const r=await goi('/muc/'+muc.id+'/y-do',{method:'POST',body:{y_do:v||null}}); setBusy(false); if(r.ok) notify(v?'Đã gắn ý đồ — trợ lý viết theo hướng này':'Đã bỏ ý đồ'); else notify(r.msg,'err'); };
  return <div className="rounded-xl border border-brand/25 bg-brand-bg/60 p-2.5 mb-3 space-y-1.5 text-xs">
    <div className="flex items-center gap-2 flex-wrap"><b className="text-[13px] text-ink">🧭 Ý đồ triển khai</b><span className="text-ink-muted">{y?(muc.y_do_boi==='MAY'?'máy gắn theo dòng / pillar / tiêu đề — đổi tự do':'người chọn'):'chưa có — chọn để trợ lý viết đúng hướng chiến lược'}</span></div>
    {y&&<div className="text-[12.5px] text-ink leading-snug"><b>{y.ten}</b> — {y.thong_diep}</div>}
    <select aria-label="Ý đồ triển khai" disabled={chiXem||busy} value={muc.y_do||''} onChange={e=>doi(e.target.value)} className="w-full border border-line rounded-lg px-2 py-1.5 bg-white text-[12.5px]">
      <option value="">— chưa có ý đồ —</option>{Object.entries(nhom).map(([dg,ds])=><optgroup key={dg} label={dg}>{ds.map(x=><option key={x.id} value={x.id}>{x.ten}</option>)}</optgroup>)}</select></div>; }
function HoSoDinhVi({chiXem}){
  const { me, db, goi, notify } = useApp();
  const [d,setD]=useState(null); const [loi,setLoi]=useState(null); const [busy,setBusy]=useState(false);
  const [dong,setDong]=useState(()=>{ try{ return localStorage.getItem('ho_so_dong')||''; }catch(e){ return ''; } });
  const [suaYD,setSuaYD]=useState(null); const [taoMuc,setTaoMuc]=useState(null); const [hienTat,setHienTat]=useState(false);
  const tai=async()=>{ const r=await goi('/ho-so-dinh-vi'); if(r.ok){ setD(r); setLoi(null); } else setLoi(r.msg); };
  useEffect(()=>{ tai(); },[(db.muc_noi_dung||[]).length, (db.claim_cam||[]).length]);
  useEffect(()=>{ try{ if(dong) localStorage.setItem('ho_so_dong',dong); }catch(e){} },[dong]);
  if(loi) return <Callout tone="danger">Không tải được hồ sơ định vị: {loi} · <LinkBtn onClick={tai}>Thử lại</LinkBtn></Callout>;
  if(!d) return <div className="space-y-3"><div className="h-32 rounded-2xl bg-slate-100 animate-pulse"/><div className="h-48 rounded-2xl bg-slate-100 animate-pulse"/></div>;
  const hs=d.ho_so||{}; const th=hs.thuong_hieu||{}; const gat=laGat(me)&&!chiXem; const staff=laStaff(me)&&!chiXem;
  const dongs=hs.dong||[]; const chon=dong==='__TH'?'__TH':(dongs.some(x=>x.dong===dong)?dong:((dongs[0]||{}).dong||'__TH')); const hd=chon==='__TH'?null:dongs.find(x=>x.dong===chon);
  const spMa=ma=>(db.san_pham||[]).find(s=>s.ma===ma);
  const ydDong=(hs.y_do||[]).filter(y=>(chon==='__TH'||!y.dong||y.dong===chon)&&(hienTat||y.active!==false)).sort((a,b)=>((a.dong?0:1)-(b.dong?0:1))||(Number(a.uu_tien||2)-Number(b.uu_tien||2)));
  const bat=ydDong.filter(y=>y.active!==false); const soCo=bat.filter(y=>(d.phu[y.id]||{}).thang_nay>0).length;
  const moTao=(y,g)=>setTaoMuc({ thang:db.hang_so.thang_nay, tieu_de:g||'', dinh_dang:(y.dinh_dang||[])[0]||'', muc_tieu:y.muc_tieu||'BRAND', pillar_id:pillarTheoTen(db,y.pillar), y_do:y.id, dong:y.dong||'' });
  const chay=async(duong,tb)=>{ setBusy(true); const r=await goi(duong,{method:'POST',body:{}}); setBusy(false); if(r.ok){ setD(r); notify(tb(r)); } else notify(r.msg,'err'); };
  const soChan=(db.claim_cam||[]).filter(c=>c.active&&c.muc_do==='CHAN').length, soCB=(db.claim_cam||[]).filter(c=>c.active&&c.muc_do!=='CHAN').length;
  return <div className="space-y-3">
    {/* thương hiệu mẹ */}
    <div className="rounded-2xl bg-ink text-white px-4 py-4 sm:px-5 sm:py-5 shadow-card">
      <div className="text-[10.5px] uppercase tracking-[.16em] text-brand-light font-semibold">Hồ sơ định vị · {d.luu?('sửa '+fmtDate(d.cap_nhat)+' · '+(d.boi||'')):'bản gốc từ tài liệu 26/09'}</div>
      <div className="font-display text-[19px] sm:text-[24px] font-bold leading-tight mt-1.5">{th.tagline||'Kingsmen'}</div>
      {th.la_ai&&<p className="text-[13.5px] text-white/80 leading-relaxed mt-1.5 max-w-[70ch]">{th.la_ai}</p>}
      <div className="flex flex-wrap gap-1.5 mt-3">{(th.gia_tri||[]).map(g=><span key={g} className="px-2.5 py-0.5 rounded-full bg-white/10 border border-white/15 text-[12px] font-semibold">{g}</span>)}{th.cuoc_choi&&<span className="px-2.5 py-0.5 rounded-full bg-brand text-white text-[12px] font-semibold">{th.cuoc_choi}</span>}</div>
    </div>
    {/* ba lớp */}
    <div className="grid grid-cols-3 gap-2">{[['🏛','Lõi','giữ vững: lời hứa, sự thật, quy tắc claim'],['🧭','Ý đồ','gợi ý hướng đi — cách kể tự do'],['🌱','Xu hướng','cả đội cập nhật, tự hết hạn']].map(([i,t,m])=><div key={t} className="rounded-xl bg-white border border-line px-2.5 py-2"><div className="text-[13px] font-bold text-ink">{i} {t}</div><div className="text-[11px] text-ink-muted leading-snug mt-0.5">{m}</div></div>)}</div>
    {gat&&d.co_ban_moi&&<Callout tone="info">Có bản hồ sơ mới từ tài liệu (bản {d.ban_goc}). <LinkBtn disabled={busy} onClick={()=>chay('/ho-so-dinh-vi/nap-lai',()=>'Đã nạp bản mới — giữ ý đồ tự thêm và ý đồ đã tắt')}>Nạp bản mới</LinkBtn></Callout>}
    {/* chọn dòng */}
    <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5" role="tablist">{[...dongs.map(x=>[x.dong,x.dong]),['__TH','Thương hiệu mẹ']].map(([k,l])=><button key={k} role="tab" aria-selected={chon===k} onClick={()=>setDong(k)} className={"shrink-0 px-3.5 py-2 rounded-xl text-[13px] font-semibold border transition "+(chon===k?'bg-ink text-white border-ink':'bg-white text-ink border-line hover:border-brand')}>{l}</button>)}</div>
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] items-start">
      <div className="space-y-3 min-w-0">
        {hd ? <DinhViDong hd={hd}/> : <ThuongHieuMe th={th}/>}
        {hd&&(hd.tru_cot||[]).length>0&&<KhoiHS icon="🏛" tieu="Mái nhà thông điệp" phu={hd.tru_cot.length+' trụ · thông điệp, lý do để tin, câu dùng truyền thông'}><div className="space-y-2">{hd.tru_cot.map((t,i)=><TruCot key={t.ten} t={t} i={i}/>)}</div></KhoiHS>}
        {hd&&(hd.dong_con||[]).length>0&&<KhoiHS icon="🧱" tieu={hd.dong_con.length+' dòng – '+hd.dong_con.length+' lợi ích'} phu="Mỗi dòng giữ một lợi ích riêng, không trùng nhau"><div className="space-y-2">{hd.dong_con.map(c=><DongCon key={c.ma} c={c}/>)}</div></KhoiHS>}
        <KhoiHS icon="🧭" tieu="Ý đồ triển khai" phu={'Mỗi gốc content mang một ý đồ — giữ thông điệp lõi, cách kể tự do · tháng '+String(d.thang||'').split('-').reverse().join('/')}
          phai={gat&&<Btn variant="soft" className="!px-2.5 !py-1.5 !text-xs" onClick={()=>setSuaYD({ dong:chon==='__TH'?'':chon, uu_tien:2, muc_tieu:'BRAND', dinh_dang:['VIDEO'], truc:{}, active:true })}>＋ Ý đồ</Btn>}>
          <div className="flex items-center gap-2 flex-wrap mb-3 text-[12.5px]"><span className="text-ink"><b>{soCo}/{bat.length}</b> ý đồ đã có mục tháng này</span>{d.chua_y_do>0&&<Pill cls="bg-amber-100 text-amber-800">{d.chua_y_do} mục tháng này chưa có ý đồ</Pill>}
            {gat&&<label className="ml-auto text-[11.5px] text-ink-muted flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={hienTat} onChange={e=>setHienTat(e.target.checked)}/> hiện ý đồ đã tắt</label>}</div>
          {ydDong.length?<div className="grid gap-2 md:grid-cols-2">{ydDong.map(y=><YDoThe key={y.id} y={y} phu={d.phu[y.id]} gat={gat} staff={staff} onSua={()=>setSuaYD(y)} onTao={g=>moTao(y,g)}/>)}</div>
            :<Empty>Dòng này chưa có ý đồ triển khai{gat?' — bấm “＋ Ý đồ” để thêm':''}.</Empty>}
        </KhoiHS>
      </div>
      <div className="space-y-3 min-w-0">
        <XuHuongKhoi hs={hs} chon={chon} staff={staff} gat={gat}/>
        {hd&&(hd.doi_tuong||[]).length>0&&<KhoiHS icon="👥" tieu="Nói với ai, nói gì" phu={hd.doi_tuong.length+' nhóm khách'} mo={false}><div className="grid gap-2">{hd.doi_tuong.map(x=><div key={x.ten} className="rounded-xl bg-slate-50 border border-line p-2.5"><div className="text-[13px] font-bold text-ink">{x.ten}{x.dong_con&&<span className="text-[11px] font-medium text-ink-muted"> · {x.dong_con}</span>}</div>{x.can&&<div className="text-[12px] text-ink-muted mt-0.5 leading-snug">{x.can}</div>}{x.noi&&<div className="text-[12.5px] text-brand-dark font-semibold mt-1.5">“{x.noi}”</div>}</div>)}</div>{hd.ghi_chu_doi_tuong&&<div className="text-[11px] text-ink-muted mt-2">{hd.ghi_chu_doi_tuong}</div>}</KhoiHS>}
        {hd&&(hd.chon_sku||[]).length>0&&<KhoiHS icon="🧪" tieu="Chọn đúng sản phẩm" phu="Nhu cầu → sản phẩm · bảo hành lấy từ danh mục Sản phẩm" mo={false}><div className="divide-y divide-line">{hd.chon_sku.map(c=>{ const s=spMa(c.sku); return <div key={c.sku+c.can} className="py-2 flex items-start gap-3"><span className="shrink-0 min-w-[62px] text-center rounded-lg bg-ink text-white text-[12px] font-bold px-2 py-1">{c.sku}</span><div className="min-w-0 flex-1"><div className="text-[13px] font-semibold text-ink leading-snug">{c.can}</div><div className="text-[11.5px] text-ink-muted leading-snug mt-0.5">{c.vi_sao}{s&&s.bao_hanh?(' · 🛡 '+s.bao_hanh):''}</div></div></div>; })}</div></KhoiHS>}
        {hd&&(hd.rao_can||[]).length>0&&<KhoiHS icon="🚧" tieu="Rào cản → cách gỡ" mo={false}><div className="space-y-2">{hd.rao_can.map(r=><div key={r.rao_can} className="text-[12.5px] leading-snug"><div className="text-ink font-semibold">✕ {r.rao_can}</div><div className="text-emerald-800 mt-0.5">→ {r.cach_go}</div></div>)}</div></KhoiHS>}
        {hd&&hd.chuan_thi_cong&&<KhoiHS icon="🛠" tieu={hd.chuan_thi_cong.ten||'Chuẩn thi công'} mo={false}><ol className="space-y-1.5">{(hd.chuan_thi_cong.buoc||[]).map((b,i)=><li key={i} className="flex gap-2 text-[12.5px] leading-snug"><span className="w-5 h-5 shrink-0 rounded-full bg-brand text-white text-[11px] font-bold grid place-items-center">{i+1}</span><span className="text-ink">{b}</span></li>)}</ol>{(hd.chuan_thi_cong.luu_y||[]).length>0&&<ul className="mt-2 space-y-0.5 text-[11.5px] text-ink-muted">{hd.chuan_thi_cong.luu_y.map(x=><li key={x}>· {x}</li>)}</ul>}</KhoiHS>}
        {hd&&hd.bao_hanh&&<KhoiHS icon="🛡" tieu="Bảo hành" phu={hd.bao_hanh.tom_tat} mo={false}><div className="space-y-2 text-[12.5px] leading-relaxed"><div><NhanNho>Xác định lỗi</NhanNho><div className="text-ink">{hd.bao_hanh.xac_dinh_loi}</div></div><div><NhanNho>Không bảo hành</NhanNho><ul className="space-y-0.5 text-ink-soft">{(hd.bao_hanh.khong_bao_hanh||[]).map(x=><li key={x}>· {x}</li>)}</ul></div><div><NhanNho>Quy trình</NhanNho><div className="text-ink">{hd.bao_hanh.quy_trinh}</div></div></div></KhoiHS>}
        {hd&&(hd.lo_trinh||[]).length>0&&<KhoiHS icon="🗺" tieu="Lộ trình ra mắt" phu={hd.chien_dich||''} mo={false}><ol className="space-y-2">{hd.lo_trinh.map((l,i)=><li key={l.buoc} className="flex gap-2 text-[12.5px] leading-snug"><span className="w-5 h-5 shrink-0 rounded-full bg-ink text-white text-[11px] font-bold grid place-items-center">{i+1}</span><div className="min-w-0"><div className="font-semibold text-ink">{l.buoc}</div><div className="text-ink-soft">{l.noi_dung}</div>{l.dieu_kien&&<div className="text-[11.5px] text-amber-800 mt-0.5">◆ {l.dieu_kien}</div>}</div></li>)}</ol></KhoiHS>}
        {hd&&((hd.kenh||[]).length>0||(hd.noi_dung_kenh||[]).length>0)&&<KhoiHS icon="📣" tieu="Kênh" mo={false}><ul className="space-y-1 text-[12.5px] text-ink">{(hd.kenh||[]).map(k=><li key={k}>· {k}</li>)}</ul>{(hd.noi_dung_kenh||[]).length>0&&<div className="mt-2.5 space-y-1.5">{hd.noi_dung_kenh.map(k=><div key={k.kenh} className="rounded-lg bg-slate-50 border border-line px-2.5 py-1.5 text-[12px]"><b className="text-ink">{k.kenh}</b> <span className="text-ink-muted">· {k.muc_tieu}</span><div className="text-ink-soft leading-snug">{k.noi_dung}</div></div>)}</div>}</KhoiHS>}
        <KhoiHS icon="⚖️" tieu="Nói đúng — quy tắc claim" phu={'Cụm cấm đang áp dụng: '+soChan+' chặn · '+soCB+' cảnh báo'} mo={false}>
          {hd&&(hd.quy_tac_claim||[]).length>0&&<div className="space-y-1.5 mb-3">{hd.quy_tac_claim.map(q=><div key={q.tranh} className="text-[12.5px] leading-snug"><span className="text-rose-700 line-through decoration-rose-400">{q.tranh}</span><div className="text-emerald-800 font-medium">→ {q.dung}</div></div>)}</div>}
          {hd&&(hd.tru_cot||[]).filter(t=>t.luu_y).map(t=><div key={t.ten} className="text-[12px] rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-1.5 text-amber-900 mb-1.5">⚠ {t.luu_y}</div>)}
          {hd&&(hd.luu_y_phap_che||[]).length>0&&<div className="mt-2"><NhanNho>Pháp chế</NhanNho><ul className="space-y-0.5 text-[12px] text-ink-soft">{hd.luu_y_phap_che.map(x=><li key={x}>· {x}</li>)}</ul></div>}
          {(d.claim_thieu||[]).length>0&&<div className="mt-3 rounded-xl border border-line p-2.5"><div className="text-[12px] font-semibold text-ink mb-1">Hồ sơ đề xuất thêm {d.claim_thieu.length} cụm cảnh báo vào Claim cấm</div><ul className="space-y-0.5 text-[11.5px] text-ink-muted mb-2">{d.claim_thieu.map(c=><li key={c.cum_tu}><b className="text-ink">“{c.cum_tu}”</b> — {c.ly_do}</li>)}</ul>{gat?<Btn variant="soft" className="!px-2.5 !py-1.5 !text-xs" disabled={busy} onClick={()=>chay('/ho-so-dinh-vi/claim',r=>'Đã thêm '+r.them+' cụm vào Claim cấm')}>＋ Thêm vào Claim cấm</Btn>:<div className="text-[11px] text-ink-muted">Trưởng MKT / Admin bấm thêm.</div>}</div>}
        </KhoiHS>
        {hd&&((hd.loi_the||[]).length>0||hd.doi_thu)&&<KhoiHS icon="♟" tieu="Lợi thế cạnh tranh" phu="Nội bộ — không nêu tên đối thủ trong nội dung" mo={false}><ul className="space-y-1 text-[12.5px] text-ink">{(hd.loi_the||[]).map(x=><li key={x} className="flex gap-1.5"><span className="text-brand">✓</span><span>{x}</span></li>)}</ul>{hd.doi_thu&&<p className="text-[12px] text-ink-muted leading-relaxed mt-2">{hd.doi_thu}</p>}</KhoiHS>}
        {hd&&(hd.can_bo_sung||[]).length>0&&<KhoiHS icon="📝" tieu="Cần bổ sung" phu={hd.can_bo_sung.length+' điểm chờ chốt'} mo={false}><ul className="space-y-1">{hd.can_bo_sung.map(x=><li key={x} className="text-[12.5px] text-amber-900 flex gap-1.5 leading-snug"><span>○</span><span>{x}</span></li>)}</ul></KhoiHS>}
        {(hs.nguon||[]).length>0&&<div className="text-[11px] text-ink-muted px-1 leading-relaxed"><b className="text-ink">Nguồn:</b> {hs.nguon.map(n=>n.ten).join(' · ')}</div>}
      </div>
    </div>
    {suaYD&&<YDoForm init={suaYD} hs={hs} onClose={()=>setSuaYD(null)} onXong={setD}/>}
    {taoMuc&&<MucForm init={taoMuc} onClose={()=>{ setTaoMuc(null); tai(); }}/>}
  </div>;
}
function DinhViDong({hd}){
  return <Card pad="p-0" className="overflow-hidden">
    <div className="px-4 pt-4 pb-3 bg-brand-bg border-b border-line">
      <div className="text-[10.5px] font-semibold uppercase tracking-[.14em] text-brand-dark">{hd.dong}{hd.trang_thai&&<span className="normal-case tracking-normal font-medium text-ink-muted"> · {hd.trang_thai}</span>}</div>
      {hd.cau_dinh_vi?<div className="font-display text-[20px] sm:text-[23px] font-bold text-ink leading-tight mt-1.5 [text-wrap:balance]">“{hd.cau_dinh_vi}”</div>:<div className="text-[13px] text-amber-800 mt-1.5">Chưa có câu định vị — xem “Cần bổ sung”.</div>}
      {hd.loi_hua&&<p className="text-[13.5px] text-ink-soft leading-relaxed mt-2 max-w-[68ch]">{hd.loi_hua}</p>}</div>
    {(hd.dinh_vi_chinh||[]).length>0&&<div className="p-3 grid sm:grid-cols-3 gap-2">{hd.dinh_vi_chinh.map((x,i)=><div key={x} className="rounded-xl bg-slate-50 border border-line px-3 py-2.5"><div className="text-[10.5px] font-bold text-brand-dark tracking-[.1em]">ĐỊNH VỊ {i+1}</div><div className="text-[13px] font-semibold text-ink leading-snug mt-0.5">{x}</div></div>)}</div>}
    {hd.dan_dat&&<div className="px-4 pb-3 text-[12.5px] text-ink-soft leading-relaxed"><b className="text-ink">Cách dẫn dắt · </b>{hd.dan_dat}</div>}
    {(hd.su_that||[]).length>0&&<details className="border-t border-line"><summary className="px-4 py-2.5 text-[12.5px] font-semibold text-ink cursor-pointer">🔎 Sự thật nền tảng ({hd.su_that.length})</summary><div className="px-4 pb-4 space-y-2">{hd.su_that.map(s=><div key={s.loai} className="text-[12.5px] leading-relaxed"><b className="text-ink">{s.loai}: </b><span className="text-ink-soft">{s.noi_dung}</span></div>)}</div></details>}
  </Card>; }
function ThuongHieuMe({th}){
  return <Card pad="p-0" className="overflow-hidden">
    <div className="grid sm:grid-cols-3 border-b border-line">{[['Tầm nhìn 2030',th.tam_nhin],['Sứ mệnh',th.su_menh],['Niềm tin cốt lõi',th.niem_tin]].map(([t,v],i)=><div key={t} className={"p-4 "+(i?'border-t sm:border-t-0 sm:border-l border-line':'')}><NhanNho>{t}</NhanNho><div className="text-[13px] text-ink leading-relaxed">{v}</div></div>)}</div>
    <div className="p-4 space-y-3">
      <div><NhanNho>Cuộc chơi</NhanNho><div className="font-display text-[17px] font-bold text-ink">{th.cuoc_choi}</div></div>
      <div className="grid sm:grid-cols-3 gap-2">{(th.tru_cuoc_choi||[]).map((t,i)=><div key={t.ten} className="rounded-xl bg-slate-50 border border-line p-3"><div className="text-[11px] font-bold text-brand-dark">0{i+1}</div><div className="text-[13px] font-bold text-ink">{t.ten}</div><div className="text-[12px] text-ink-soft leading-snug mt-0.5">{t.noi_dung}</div></div>)}</div>
      <div className="grid sm:grid-cols-2 gap-2 text-[12.5px]"><div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3"><b className="text-emerald-900">Kingsmen LÀ</b><div className="text-emerald-900 mt-0.5">{th.la}</div></div><div className="rounded-xl border border-rose-200 bg-rose-50 p-3"><b className="text-rose-900">Kingsmen KHÔNG phải</b><ul className="text-rose-900 mt-0.5">{(th.khong_la||[]).map(x=><li key={x}>· {x}</li>)}</ul></div></div>
      {th.tinh_than&&<div className="text-[13px] text-ink font-semibold leading-snug">“{th.tinh_than}”</div>}
      {th.tong_giong&&<div className="text-[12.5px] text-ink-soft leading-relaxed"><b className="text-ink">Tông giọng · </b>{th.tong_giong}</div>}
    </div></Card>; }
function TruCot({t,i}){ const [mo,setMo]=useState(i===0);
  return <div className="rounded-xl border border-line">
    <button type="button" onClick={()=>setMo(!mo)} aria-expanded={mo} className="w-full text-left px-3 py-2.5 flex gap-2.5 items-start"><span className="w-6 h-6 shrink-0 rounded-full bg-ink text-white text-[11px] font-bold grid place-items-center mt-0.5">{i+1}</span><div className="min-w-0 flex-1"><div className="text-[13.5px] font-bold text-ink leading-snug">{t.ten}</div><div className="text-[12.5px] text-ink-soft leading-relaxed mt-0.5">{t.thong_diep}</div></div><span className="text-ink-muted text-[10px] mt-1.5">{mo?'▲':'▼'}</span></button>
    {mo&&<div className="px-3 pb-3 sm:pl-11 space-y-2.5 text-[12.5px]">
      {t.y_nghia&&<div className="text-ink-muted leading-relaxed">{t.y_nghia}</div>}
      {(t.rtb||[]).length>0&&<div><NhanNho>Lý do để tin</NhanNho><ul className="space-y-1">{t.rtb.map(x=><li key={x} className="flex gap-1.5 text-ink leading-snug"><span className="text-brand">✓</span><span>{x}</span></li>)}</ul></div>}
      {(t.cau_dung||[]).length>0&&<div><NhanNho>Câu dùng truyền thông</NhanNho><div className="space-y-1">{t.cau_dung.map(x=><div key={x} className="flex items-start gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5"><span className="flex-1 text-ink font-medium leading-snug">{x}</span><NutChep text={x} nho/></div>)}</div></div>}
      {t.luu_y&&<div className="rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-1.5 text-amber-900">⚠ {t.luu_y}</div>}
    </div>}</div>; }
function DongCon({c}){
  return <div className="rounded-xl border border-line p-3 min-w-0 md:grid md:grid-cols-[200px_minmax(0,1fr)] md:gap-4">
    <div className="flex flex-col gap-1.5 mb-2 md:mb-0 min-w-0"><div className="flex items-start justify-between gap-2 md:block"><div className="min-w-0"><div className="text-[14px] font-bold text-ink">{c.ten}</div><div className="text-[11.5px] text-ink-muted">{c.mo_ta}</div></div><Pill cls="bg-ink text-white md:mt-1.5">{c.loi_ich_chinh}</Pill></div>
      <div className="font-display text-[14.5px] font-extrabold text-brand-dark leading-snug">{c.big_idea}</div>{c.trang_thai&&<div className="text-[11px] text-ink-muted leading-snug">⏱ {c.trang_thai}</div>}</div>
    <div className="flex flex-col gap-2 min-w-0"><div className="text-[12.5px] text-ink leading-relaxed">{c.dinh_vi}</div>
      <div className="flex flex-wrap gap-1">{(c.loi_ich||[]).map(x=><span key={x} className="rounded-md bg-brand-bg text-brand-dark text-[11px] font-semibold px-1.5 py-0.5">{x}</span>)}</div>
      {c.ly_do_tin&&<div className="text-[12px]"><b className="text-ink">Lý do tin: </b><span className="text-ink-soft">{c.ly_do_tin}</span></div>}
      {c.bang_chung_can&&<div className="text-[12px] rounded-lg bg-amber-50 border border-amber-200 px-2 py-1 text-amber-900">Cần có trước khi claim: {c.bang_chung_can}</div>}
      {c.cau_chuyen&&<div className="text-[12px] text-ink-soft italic leading-snug">{c.cau_chuyen}</div>}
      {c.doi_tuong&&<div className="text-[11.5px] text-ink-muted leading-snug">👥 {c.doi_tuong}</div>}</div></div>; }
function YDoThe({y, phu, gat, staff, onSua, onTao}){ const [mo,setMo]=useState(false); const p=phu||{}; const tat=y.active===false; const [ut,utc]=UU_TIEN_YD[y.uu_tien]||UU_TIEN_YD[2];
  const truc=Object.entries(TRUC_FE).filter(([k])=>y.truc&&y.truc[k]).map(([k,[,gt]])=>gt[y.truc[k]]).filter(Boolean);
  return <div className={"rounded-xl border p-3 flex flex-col gap-2 min-w-0 "+(tat?'border-dashed border-line bg-slate-50 opacity-75':'border-line bg-white')}>
    <div className="flex items-start gap-2"><div className="min-w-0 flex-1"><div className="text-[14px] font-bold text-ink leading-snug">{y.ten}</div><div className="text-[11px] text-ink-muted mt-0.5 leading-snug">{[y.dong||'Mọi dòng', y.tru_cot].filter(Boolean).join(' · ')}</div></div><Pill cls={tat?'bg-slate-200 text-ink-muted':utc}>{tat?'đã tắt':ut}</Pill></div>
    <div className="text-[12.5px] text-ink-soft leading-relaxed">{y.thong_diep}</div>
    <div className="flex flex-wrap gap-1 text-[11px]">{y.doi_tuong&&<span className="rounded-md bg-slate-100 text-ink px-1.5 py-0.5">👥 {y.doi_tuong}</span>}{(y.dinh_dang||[]).map(dd=><span key={dd} className="rounded-md bg-slate-100 text-ink px-1.5 py-0.5">{DINH_DANG_ICON[dd]||dd}</span>)}{truc.map(t=><span key={t} className="rounded-md bg-brand-bg text-brand-dark px-1.5 py-0.5">{t}</span>)}</div>
    {mo&&<div className="space-y-1.5 text-[12px]">
      {y.bang_chung&&<div><b className="text-ink">Bằng chứng nên có: </b><span className="text-ink-soft">{y.bang_chung}</span></div>}
      {y.pillar&&<div><b className="text-ink">Pillar: </b><span className="text-ink-soft">{y.pillar}</span></div>}
      {(y.sku||[]).length>0&&<div><b className="text-ink">Sản phẩm: </b><span className="text-ink-soft">{y.sku.join(', ')}</span></div>}
      {(y.goi_y||[]).length>0&&<div><div className="font-semibold text-ink mb-1">Đề bài gợi ý{staff&&!tat&&<span className="font-normal text-ink-muted"> — chạm để tạo mục</span>}</div><div className="flex flex-col gap-1">{y.goi_y.map(g=><button type="button" key={g} disabled={!staff||tat} onClick={()=>onTao(g)} className="text-left rounded-lg border border-line px-2.5 py-1.5 enabled:hover:border-brand enabled:hover:bg-brand-bg/60">💡 {g}</button>)}</div></div>}
    </div>}
    {y.luu_y&&<div className="text-[11.5px] rounded-lg bg-amber-50 border border-amber-200 px-2 py-1 text-amber-900 leading-snug">⚠ {y.luu_y}</div>}
    <div className="flex items-center gap-2.5 mt-auto pt-1 flex-wrap">
      <div className="flex-1 min-w-[120px] text-[11.5px]"><span className={p.thang_nay?'text-emerald-700 font-semibold':'text-ink-muted'}>{p.thang_nay?(p.thang_nay+' mục tháng này'):'chưa có mục tháng này'}</span>{p.da_dang>0&&<span className="text-ink-muted"> · {p.da_dang} đã đăng</span>}</div>
      <LinkBtn onClick={()=>setMo(!mo)}>{mo?'Thu gọn':'Chi tiết'}</LinkBtn>{gat&&<LinkBtn onClick={onSua}>Sửa</LinkBtn>}
      {staff&&!tat&&<Btn variant="soft" className="!px-2.5 !py-1 !text-xs" onClick={()=>onTao((y.goi_y||[])[0]||'')}>＋ Tạo mục</Btn>}</div></div>; }
function YDoForm({init, hs, onClose, onXong}){ const { db, goi, notify } = useApp(); const [busy,setBusy]=useState(false);
  const [f,setF]=useState(()=>({ ...init, ten:init.ten||'', dong:init.dong||'', tru_cot:init.tru_cot||'', pillar:init.pillar||'', doi_tuong:init.doi_tuong||'', thong_diep:init.thong_diep||'', bang_chung:init.bang_chung||'', luu_y:init.luu_y||'', sku:(init.sku||[]).join(', '), goi_y:(init.goi_y||[]).join('\n'), tu_khoa:(init.tu_khoa||[]).join(', '), dinh_dang:init.dinh_dang||[], truc:{...(init.truc||{})}, muc_tieu:init.muc_tieu||'BRAND', uu_tien:init.uu_tien||2, active:init.active!==false }));
  const set=(k,v)=>setF(o=>({...o,[k]:v})); const hd=(hs.dong||[]).find(x=>x.dong===f.dong);
  const tach=s=>String(s||'').split(/[,\n]/).map(x=>x.trim()).filter(Boolean);
  const luu=async()=>{ setBusy(true); const r=await goi('/ho-so-dinh-vi/y-do',{method:'POST',body:{...f, id:init.id||undefined, sku:tach(f.sku), tu_khoa:tach(f.tu_khoa)}}); setBusy(false); if(r.ok){ notify(init.id?'Đã lưu ý đồ':'Đã thêm ý đồ'); onXong(r); onClose(); } else notify(r.msg,'err'); };
  return <Modal open onClose={onClose} title={init.id?'Sửa ý đồ triển khai':'Thêm ý đồ triển khai'} wide>
    <Callout tone="info" className="mb-3">Ý đồ là hướng đi cho gốc content, không phải khuôn: giữ thông điệp lõi, còn cách kể thì đội sáng tạo tự do. Trợ lý viết đọc ý đồ của mục để viết đúng hướng.</Callout>
    <div className="grid sm:grid-cols-2 gap-x-3">
      <Field label="Tên ý đồ" required className="sm:col-span-2"><Input value={f.ten} onChange={e=>set('ten',e.target.value)} placeholder="VD: Mùa mưa – ron không thấm"/></Field>
      <Field label="Dòng"><Select value={f.dong} onChange={e=>set('dong',e.target.value)}><option value="">Mọi dòng (thương hiệu mẹ)</option>{(hs.dong||[]).map(x=><option key={x.dong} value={x.dong}>{x.dong}</option>)}</Select></Field>
      <Field label="Trụ thông điệp" hint={hd&&(hd.tru_cot||[]).length?('Của dòng: '+hd.tru_cot.map(t=>t.ten).join(' · ')):''}><Input value={f.tru_cot} onChange={e=>set('tru_cot',e.target.value)}/></Field>
      <Field label="Pillar"><Select value={f.pillar} onChange={e=>set('pillar',e.target.value)}><option value="">— không gắn —</option>{(db.pillars||[]).filter(p=>p.active).map(p=><option key={p.id} value={p.ten}>{p.ten}</option>)}</Select></Field>
      <Field label="Nói với ai"><Input value={f.doi_tuong} onChange={e=>set('doi_tuong',e.target.value)} placeholder="VD: chủ nhà, thợ"/></Field>
      <Field label="Thông điệp lõi" className="sm:col-span-2"><Textarea rows="2" value={f.thong_diep} onChange={e=>set('thong_diep',e.target.value)}/></Field>
      <Field label="Bằng chứng nên có" className="sm:col-span-2"><Input value={f.bang_chung} onChange={e=>set('bang_chung',e.target.value)} placeholder="demo, phép thử, công trình thật…"/></Field>
      <Field label="Định dạng hợp" className="sm:col-span-2"><div className="flex flex-wrap gap-1.5">{db.hang_so.dinh_dang.map(dd=>{ const co=f.dinh_dang.includes(dd); return <button type="button" key={dd} onClick={()=>set('dinh_dang', co?f.dinh_dang.filter(x=>x!==dd):[...f.dinh_dang, dd])} className={"rounded-lg border px-2.5 py-1 text-xs font-semibold "+(co?'bg-ink text-white border-ink':'bg-white text-ink border-line')}>{DINH_DANG_ICON[dd]}</button>; })}</div></Field>
      <Field label="Mục tiêu"><Select value={f.muc_tieu} onChange={e=>set('muc_tieu',e.target.value)}><option value="BRAND">Brand</option><option value="BAN_HANG">Bán hàng</option></Select></Field>
      <Field label="Ưu tiên"><Select value={String(f.uu_tien)} onChange={e=>set('uu_tien',Number(e.target.value))}><option value="1">Ưu tiên</option><option value="2">Vừa</option><option value="3">Để sau</option></Select></Field>
      <Field label="Gợi ý cách kể (không bắt buộc)" className="sm:col-span-2"><div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">{Object.entries(TRUC_FE).map(([k,[ten,gt]])=><label key={k} className="flex flex-col gap-0.5 text-xs"><span className="text-[11px] text-ink-muted">{ten}</span><select className="border border-line rounded-lg px-1.5 py-1 bg-white min-w-0" value={f.truc[k]||''} onChange={e=>set('truc',{...f.truc,[k]:e.target.value})}><option value="">— tự do —</option>{Object.entries(gt).map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></label>)}</div></Field>
      <Field label="Đề bài gợi ý" hint="mỗi dòng một đề bài — máy dùng làm tiêu đề khi tự tạo mục" className="sm:col-span-2"><Textarea rows="3" value={f.goi_y} onChange={e=>set('goi_y',e.target.value)}/></Field>
      <Field label="Sản phẩm liên quan" hint="mã, cách nhau dấu phẩy"><Input value={f.sku} onChange={e=>set('sku',e.target.value)} placeholder="G7000, G9000"/></Field>
      <Field label="Từ khoá để máy nhận ra" hint="máy gắn ý đồ khi tiêu đề mục có các từ này"><Input value={f.tu_khoa} onChange={e=>set('tu_khoa',e.target.value)} placeholder="mùa mưa, thấm"/></Field>
      <Field label="Lưu ý (claim, điều kiện)" className="sm:col-span-2"><Input value={f.luu_y} onChange={e=>set('luu_y',e.target.value)}/></Field>
    </div>
    <div className="flex items-center justify-between gap-2 flex-wrap"><label className="flex items-center gap-2 text-sm text-ink"><Toggle on={f.active} onChange={v=>set('active',v)}/> {f.active?'Đang bật':'Đã tắt — máy không gắn, không hiện ở ô chọn'}</label>
      <div className="flex gap-2"><Btn variant="ghost" onClick={onClose}>Huỷ</Btn><Btn variant="brand" onClick={luu} disabled={busy||!f.ten.trim()}>Lưu</Btn></div></div>
  </Modal>; }
function XuHuongKhoi({hs, chon, staff, gat}){ const { db, me, goi, notify } = useApp(); const [mo,setMo]=useState(false); const [busy,setBusy]=useState(false);
  const [f,setF]=useState({ noi_dung:'', loai:'TREND', dong:'', link:'', han_tuan:8 });
  const ds=(db.xu_huong||[]).filter(x=>chon==='__TH'||!x.dong||x.dong===chon);
  const them=async()=>{ setBusy(true); const r=await goi('/xu-huong',{method:'POST',body:f}); setBusy(false); if(r.ok){ notify('Đã thêm — trợ lý dùng làm cảm hứng khi viết'); setF({ noi_dung:'', loai:f.loai, dong:f.dong, link:'', han_tuan:f.han_tuan }); setMo(false); } else notify(r.msg,'err'); };
  const go=async x=>{ const r=await goi('/xu-huong/'+x.id,{method:'DELETE'}); if(r.ok) notify('Đã gỡ'); else notify(r.msg,'err'); };
  return <KhoiHS icon="🌱" tieu="Xu hướng & cái mới" phu="Cả đội cập nhật · trợ lý lấy làm cảm hứng khi viết (không bắt buộc) · tự hết hạn"
    phai={staff&&<Btn variant="soft" className="!px-2.5 !py-1.5 !text-xs" onClick={()=>{ if(!mo) setF(x=>({...x, dong:chon==='__TH'?'':chon})); setMo(!mo); }}>{mo?'Đóng':'＋ Thêm'}</Btn>}>
    {mo&&<div className="rounded-xl border border-brand/30 bg-brand-bg/50 p-2.5 mb-3 space-y-2">
      <Textarea rows="2" value={f.noi_dung} onChange={e=>setF({...f,noi_dung:e.target.value})} placeholder="VD: Clip ASMR chà nhám lộ hạt đang lên trên TikTok" maxLength={300}/>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
        <Select className="!py-1.5 !text-xs" value={f.loai} onChange={e=>setF({...f,loai:e.target.value})}>{Object.entries(LOAI_XH).map(([k,[i,t]])=><option key={k} value={k}>{i} {t}</option>)}</Select>
        <Select className="!py-1.5 !text-xs" value={f.dong} onChange={e=>setF({...f,dong:e.target.value})}><option value="">Mọi dòng</option>{(hs.dong||[]).map(x=><option key={x.dong} value={x.dong}>{x.dong}</option>)}</Select>
        <Select className="!py-1.5 !text-xs" value={String(f.han_tuan)} onChange={e=>setF({...f,han_tuan:Number(e.target.value)})}>{[2,4,8,12,26].map(t=><option key={t} value={t}>giữ {t} tuần</option>)}</Select>
        <Input className="!py-1.5 !text-xs" value={f.link} onChange={e=>setF({...f,link:e.target.value})} placeholder="link (tuỳ chọn)"/></div>
      <div className="flex justify-end"><Btn variant="brand" className="!px-3 !py-1.5 !text-xs" disabled={busy||f.noi_dung.trim().length<4} onClick={them}>Thêm xu hướng</Btn></div></div>}
    {ds.length?<ul className="space-y-2">{ds.map(x=>{ const [i]=LOAI_XH[x.loai]||LOAI_XH.KHAC; const coGo=staff&&(x.tao_boi_id===me.id||gat); return <li key={x.id} className="flex gap-2 items-start">
      <span className="text-base leading-none mt-0.5">{i}</span><div className="min-w-0 flex-1"><div className="text-[13px] text-ink leading-snug break-words">{x.noi_dung}{x.link&&<> · <a href={x.link} target="_blank" rel="noopener noreferrer" className="text-brand-dark underline">xem</a></>}</div>
      <div className="text-[11px] text-ink-muted">{[x.dong||'mọi dòng', x.tao_boi, 'đến '+String(x.het_han||'').split('-').reverse().slice(0,2).join('/')].join(' · ')}</div></div>
      {coGo&&<LinkBtn tone="danger" onClick={()=>go(x)}>Gỡ</LinkBtn>}</li>; })}</ul>
      :<div className="text-[12.5px] text-ink-muted leading-relaxed">Chưa có xu hướng nào{chon!=='__TH'?(' cho '+chon):''}. Thấy trend, định dạng mới hay câu hay thì thêm vào — trợ lý viết sẽ bắt nhịp theo.</div>}
  </KhoiHS>; }
