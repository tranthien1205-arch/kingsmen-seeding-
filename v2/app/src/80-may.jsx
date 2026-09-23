// ===== MÀN 5 — MÁY: bộ quyền 12 bước · nhật ký agent · chi phí AI · cấu hình · người dùng · nhập danh mục =====
function May(){
  const { db, me } = useApp();
  const [tab,setTab]=useState('buoc');
  const tabs=[{key:'buoc',label:'Bước: người hay AI'},{key:'tram',label:'🖥 Trạm máy văn phòng'},{key:'nhatky',label:'Nhật ký máy',count:(db.agent_run||[]).length},{key:'chiphi',label:'Chi phí AI'},{key:'cauhinh',label:'Cấu hình'},...(['ADMIN','TRUONG_MKT'].includes(me.vai_tro)?[{key:'nguoi',label:'Người dùng',count:(db.users||[]).length}]:[]),...(me.vai_tro==='ADMIN'?[{key:'nhap',label:'Nhập danh mục'},{key:'mophong',label:'🧪 Mô phỏng'}]:[])];
  return <div className="space-y-4">
    <PageHeader title="🤖 Máy" sub={'Giai đoạn 1: người làm, máy học. '+(db.san_sang.ai?'● Bộ não Anthropic sẵn sàng':'○ Chưa cắm ANTHROPIC_API_KEY (secret Worker)')+' · '+(db.san_sang.youtube?'● YouTube':'○ YouTube key')+' · '+(db.san_sang.n8n?'● n8n':'○ n8n')}/>
    <Tabs size="sm" active={tab} onChange={setTab} tabs={tabs}/>
    {tab==='buoc' && <BangBuoc/>}
    {tab==='tram' && <TramTab/>}
    {tab==='nhatky' && <NhatKyMay/>}
    {tab==='chiphi' && <ChiPhiAI/>}
    {tab==='cauhinh' && <CauHinhMay/>}
    {tab==='nguoi' && <NguoiDung/>}
    {tab==='nhap' && <NhapDanhMuc/>}
    {tab==='mophong' && <MoPhongTab/>}
  </div>;
}
function MoPhongTab(){
  const { db, goi, notify } = useApp(); const [busy,setBusy]=useState(false);
  const nap=async()=>{ setBusy(true); const r=await goi('/mo-phong/nap',{method:'POST'}); setBusy(false); if(r.ok) notify('Đã nạp mô phỏng — đi xem 5 màn'); else notify(r.msg,'err'); };
  const xoa=async()=>{ if(!confirm('Xoá toàn bộ dữ liệu mô phỏng?')) return; setBusy(true); const r=await goi('/mo-phong/xoa',{method:'POST'}); setBusy(false); if(r.ok) notify('Đã xoá mô phỏng'); else notify(r.msg,'err'); };
  return <Card><SectionTitle className="mb-1">🧪 Mô phỏng để duyệt thiết kế</SectionTitle>
    <div className="text-[11px] text-ink-muted mb-3 leading-relaxed">Nạp danh mục mẫu (4 pillar, 4 framework, 4 sản phẩm, claim cấm, 3 kênh), mẫu học giả cho B1/B4/B5/B9 (để thấy điểm sẵn sàng và luật gạt), vài lượt máy chạy, 3 việc được giao; đồng thời mở màn mô phỏng của Kế hoạch (đợt 2), Dòng chảy (đợt 3), Kết quả & Báo cáo (đợt 4) với số liệu giả. Dữ liệu mô phỏng có tiền tố riêng, xoá sạch được một nút.</div>
    <div className="flex gap-2">{!db.mo_phong ? <Btn variant="brand" onClick={nap} disabled={busy}>{busy?'Đang nạp…':'Nạp dữ liệu mô phỏng'}</Btn> : <Btn variant="danger" onClick={xoa} disabled={busy}>Xoá dữ liệu mô phỏng</Btn>}</div>
    {db.mo_phong && <div className={CALLOUT.warn+' mt-3'}>Đang ở chế độ mô phỏng. Các thao tác trong màn mô phỏng chỉ báo "sẽ làm ở đợt N", không ghi gì.</div>}</Card>;
}
function BangBuoc(){
  const { db, me, goi, notify } = useApp(); const cfg=(db.module_config||{}).may||{}; const duoc=laGat(me);
  const nguong=Number(cfg.nguong_san_sang)||80, minMau=Number(cfg.min_mau)||30;
  const gat=async(b, patch)=>{ const r=await goi('/buoc/'+b.ma,{method:'PATCH',body:patch}); if(r.ok) notify('Đã cập nhật '+b.ma); else notify(r.msg,'err'); };
  const MUCS=['NGUOI','AI_GOI_Y','AI_TU_LAM'];
  const [mo,setMo]=useState(null); const [mau,setMau]=useState({});
  const xemMau=async(ma)=>{ if(mo===ma){ setMo(null); return; } setMo(ma); if(!mau[ma]){ const r=await goi('/buoc/'+ma+'/mau'); if(r.ok) setMau(o=>({...o,[ma]:r})); } };
  const NHOM={B1:1,B5:1,B9:1,B11:1,B4:2,B2:2,B3:2,B6:2,B7:2,B12:2,B10:0,B8:0};
  const soDeNghi=(db.buoc||[]).filter(b=>b.de_nghi).length;
  return <div className="space-y-3">
    <Callout tone="info">Mỗi bước có một <b>người thực hiện</b>: Người làm · AI gợi ý (máy soạn, người bấm) · AI tự làm. Gạt lên "AI tự làm" chỉ mở khi máy đạt <b>{nguong}/100</b> điểm sẵn sàng trên <b>≥ {minMau} mẫu</b> — điểm do máy tự chấm từ mẫu học, người không sửa được. Máy chỉ <b>đề nghị</b> gạt lên/hạ xuống (giao việc cho Trưởng MKT), không tự gạt. Thứ tự nên gạt: nhóm ① B1 · B5 · B9 · B11 trước, nhóm ② B4 · B2 · B3 · B6 · B7 sau. 4 cổng G1–G4 luôn là người.{!duoc && <> <b>Bạn chỉ xem</b> — Admin/Trưởng MKT mới gạt được.</>}</Callout>
    {soDeNghi>0 && <Callout tone="warn">🤖 Máy đang đề nghị {soDeNghi} thay đổi — xem cột "Máy đề nghị".</Callout>}
    <Card pad=""><div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="text-left text-ink-muted border-b border-line"><th className="px-3 py-2">Bước</th><th className="px-3 py-2">Người thực hiện</th><th className="px-3 py-2">Vai trò nhận việc</th><th className="px-3 py-2">Máy học</th><th className="px-3 py-2 w-44">Sẵn sàng</th><th className="px-3 py-2">Máy đề nghị</th><th className="px-3 py-2">Đổi gần nhất</th></tr></thead>
      <tbody>{(db.buoc||[]).flatMap(b=>{ const duSS=Number(b.san_sang)>=nguong && Number(b.so_mau)>=minMau; const kem=(db.agents||[]).filter(a=>a.buoc===b.ma).map(a=>a.ma);
        const rows=[<tr key={b.ma} className="border-b border-line/60 align-top">
          <td className="px-3 py-2"><div className="font-semibold text-ink">{b.ma} · {b.ten} {NHOM[b.ma]?<Pill className="!text-[9px]">nhóm {NHOM[b.ma]===1?'①':'②'}</Pill>:null}</div><div className="text-[10px] text-ink-muted">{b.tang}{b.cong?(' · cổng '+b.cong):''} · tối đa {MUC_LABEL[b.muc_toi_da]}{kem.length?(' · tay máy: '+kem.join(', ')):(b.muc_toi_da!=='NGUOI'?' · chưa có tay máy':'')}</div><div className="text-[10px] text-slate-400 mt-0.5">học: {b.hoc_gi} · <LinkBtn onClick={()=>xemMau(b.ma)}>{mo===b.ma?'ẩn mẫu':'xem mẫu học'}</LinkBtn></div></td>
          <td className="px-3 py-2"><div className="flex gap-1 flex-wrap">{MUCS.map(m=>{ const qua=MUCS.indexOf(m)>MUCS.indexOf(b.muc_toi_da); const khoa=m==='AI_TU_LAM'&&!duSS; const chon=b.nguoi_thuc_hien===m;
            return <button key={m} disabled={!duoc||qua||(khoa&&!chon)} title={qua?'Bước này không lên tới mức này':khoa?('Cần '+nguong+'/100 và ≥'+minMau+' mẫu'):''} onClick={()=>!chon&&gat(b,{nguoi_thuc_hien:m})}
              className={"px-2 py-1 rounded-lg text-[11px] font-semibold border transition disabled:opacity-30 "+(chon?(MUC_CLS[m]+' border-transparent'):'bg-white border-line text-ink-muted hover:border-brand')}>{MUC_LABEL[m]}</button>; })}</div></td>
          <td className="px-3 py-2"><Select className="!py-1 !px-2 text-[11px] !w-auto" value={b.vai_tro_nguoi} disabled={!duoc} onChange={e=>gat(b,{vai_tro_nguoi:e.target.value})}>{Object.keys(ROLE_LABEL).map(r=><option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</Select></td>
          <td className="px-3 py-2"><Toggle on={b.hoc} disabled={!duoc} onChange={v=>gat(b,{hoc:v})}/></td>
          <td className="px-3 py-2"><div className="flex items-center gap-2"><div className="flex-1"><Thanh pct={b.san_sang} cls={duSS?'bg-emerald-500':'bg-brand'}/></div><span className="tabular-nums text-ink w-10 text-right">{b.san_sang}</span></div><div className="text-[10px] text-ink-muted mt-0.5">{b.so_mau} mẫu · {cfg.ngay_gan||14} ngày gần: {b.san_sang_gan||0}/100 ({b.so_mau_gan||0} mẫu){duSS?' · đủ để gạt AI tự làm':''}</div></td>
          <td className="px-3 py-2 text-[10px]">{b.de_nghi?<div><Pill cls={b.de_nghi==='LEN'?'bg-emerald-100 text-emerald-800':'bg-rose-100 text-rose-700'}>{b.de_nghi==='LEN'?'⬆ gạt lên':'⬇ hạ xuống'}</Pill><div className="text-ink-muted mt-0.5 max-w-[200px]">{b.de_nghi_ly_do}</div>{duoc&&<LinkBtn onClick={()=>gat(b,{nguoi_thuc_hien:b.de_nghi==='LEN'?MUCS[MUCS.indexOf(b.nguoi_thuc_hien)+1]:MUCS[Math.max(0,MUCS.indexOf(b.nguoi_thuc_hien)-1)]})}>Gạt theo đề nghị</LinkBtn>}</div>:<span className="text-slate-400">—</span>}</td>
          <td className="px-3 py-2 text-[10px] text-ink-muted">{b.doi_boi?<>{b.doi_boi}<br/>{fmtDate(b.doi_at)}</>:'—'}</td>
        </tr>];
        if(mo===b.ma){ const d=mau[b.ma]; rows.push(<tr key={b.ma+'-mau'} className="bg-slate-50"><td colSpan="7" className="px-3 py-2 text-[11px]">{!d?<span className="text-ink-muted">đang tải…</span>:<div className="grid md:grid-cols-2 gap-3">
          <div><div className="font-semibold text-ink mb-1">Mẫu học gần đây ({d.mau.length})</div>{d.mau.length===0?<div className="text-ink-muted">Chưa có mẫu — máy học khi người làm bước này (học BẬT).</div>:d.mau.slice(0,8).map(x=><div key={x.id} className="py-1 border-t border-line flex gap-2"><span className={"font-display font-extrabold w-8 "+(x.giong>=0.8?'text-emerald-600':x.giong>=0.5?'text-amber-600':'text-rose-500')}>{Math.round((x.giong||0)*100)}</span><div className="min-w-0 flex-1"><div className="text-ink-muted">{x.ngay} · {x.ghi_chu||''}</div><div className="truncate"><b>Máy:</b> {JSON.stringify(x.dau_ra_may).slice(0,110)}</div><div className="truncate"><b>Người:</b> {JSON.stringify(x.dau_ra_nguoi).slice(0,110)}</div></div></div>)}</div>
          <div><div className="font-semibold text-ink mb-1">Lịch sử gạt</div>{d.lich_su.length===0?<div className="text-ink-muted">Chưa gạt lần nào.</div>:d.lich_su.map((l,i)=><div key={i} className="py-1 border-t border-line text-ink-muted">{fmtDate(l.at)} · {l.by_name}: {l.detail}</div>)}</div></div>}</td></tr>); }
        return rows; })}</tbody></table></div></Card>
  </div>;
}
// ADR-004 — Trạm máy văn phòng (masfico-tram): ghép bằng mã HUB1, nhịp tim, phiên, lệnh, lô dữ liệu, chạy thử agent content_os
function TramTab(){
  const { db, me, goi, notify } = useApp(); const t=db.tram||{}; const tt=t.trang_thai; const [ma,setMa]=useState(''); const [busy,setBusy]=useState(false);
  const taoKhoa=async()=>{ if(!confirm('Tạo khoá mới? Khoá cũ (nếu có) hết hiệu lực — Trạm phải dán mã ghép mới.')) return; setBusy(true); const r=await goi('/tram/khoa',{method:'POST'}); setBusy(false); if(r.ok){ setMa(r.ma_ghep); notify('Đã tạo khoá — dán mã ghép vào trang Trạm'); } else notify(r.msg,'err'); };
  const lenh=async(viec)=>{ setBusy(true); const r=await goi('/tram/lenh',{method:'POST',body:{viec:'chay_agent', tham_so:{id:'content_os', viec}}}); setBusy(false); if(r.ok) notify(r.trung?'Lệnh này đang chờ Trạm lấy rồi':'Đã xếp lệnh — Trạm lấy trong ~20 giây'); else notify(r.msg,'err'); };
  const phien=tt&&tt.phien?Object.entries(tt.phien):[];
  return <div className="space-y-3">
    <Callout tone="info"><b>Trạm</b> là máy văn phòng luôn bật (masfico-tram) giữ phiên đăng nhập TikTok/Facebook/Zalo thật. Content OS ghép theo hợp đồng hub1: Trạm tự hỏi lệnh 20 giây/lần, đẩy dữ liệu về, báo nhịp tim 2 phút/lần. Content OS giao cho Trạm: <b>đăng bài</b> nền tảng không có API (kênh chọn cách đăng "Qua Trạm"), <b>đo lường</b> bằng trình duyệt đã đăng nhập, <b>dựng video</b> bằng ffmpeg, và nhận <b>tin đối thủ</b> máy quét về làm ý tưởng.</Callout>
    <div className="grid lg:grid-cols-2 gap-3">
      <Card><SectionTitle className="mb-1">Trạng thái</SectionTitle>
        {!tt ? <div className="text-sm text-ink-muted">Chưa nhận nhịp tim nào từ Trạm.{!t.co_khoa&&' Tạo khoá rồi dán mã ghép vào trang Trạm.'}</div>
        : <div className="text-sm"><div className={tt.song?'text-emerald-700 font-semibold':'text-rose-700 font-semibold'}>{tt.song?'🟢 đang chạy':'🔴 im '+tt.im_phut+' phút'} trên máy <b>{tt.may}</b> · Trạm v{tt.ban}{tt.dung_nha===false&&<span className="text-rose-600"> · ⚠ không đúng nhà</span>}</div><div className="text-[11px] text-ink-muted">nhịp tim gần nhất {fmtDate(tt.nhan_luc)} · giờ máy {tt.gio_may}</div>
          {phien.length>0&&<div className="mt-2 space-y-0.5">{phien.map(([id,p])=><div key={id} className="text-[11px] flex gap-2"><span className={p.co_phien?'text-emerald-600':'text-slate-400'}>{p.co_phien?'●':'○'}</span><span className="font-semibold text-ink">{p.ten||id}</span><span className="text-ink-muted">{p.tt} · {p.msg}</span></div>)}</div>}</div>}
        <div className="mt-3 flex gap-2 flex-wrap items-center">{me.vai_tro==='ADMIN'&&<Btn variant="brand" onClick={taoKhoa} disabled={busy}>{t.co_khoa?'🔑 Tạo khoá mới':'🔑 Tạo khoá & mã ghép'}</Btn>}<span className="text-[11px] text-ink-muted">{t.co_khoa?'đã có khoá':'chưa có khoá'} · {t.bat?'đang bật':'đang tắt'}</span></div>
        {ma&&<div className="mt-2"><div className="text-[11px] text-ink-muted mb-1">Mã ghép (hiện một lần — dán vào trang Trạm › Cài đặt › Ứng dụng ghép):</div><Textarea rows="3" readOnly value={ma} onFocus={e=>e.target.select()} className="text-[11px] font-mono"/><LinkBtn onClick={()=>{ navigator.clipboard&&navigator.clipboard.writeText(ma); notify('Đã copy'); }}>📋 Copy mã ghép</LinkBtn></div>}
      </Card>
      <Card><SectionTitle className="mb-1">Sai Trạm chạy agent content_os</SectionTitle><div className="text-[11px] text-ink-muted mb-2">Chỉ chạy được khi Trạm đã cài agent content_os (xem v2/tram/README-GHEP.md) và đang có nhịp tim.</div>
        <div className="flex gap-2 flex-wrap">{laStaff(me)&&<><Btn variant="ghost" onClick={()=>lenh('dang')} disabled={busy||!(tt&&tt.song)}>🚀 Đăng bài chờ Trạm</Btn><Btn variant="ghost" onClick={()=>lenh('do_luong')} disabled={busy||!(tt&&tt.song)}>📡 Đo lường</Btn><Btn variant="ghost" onClick={()=>lenh('dung_video')} disabled={busy||!(tt&&tt.song)}>🎬 Dựng video</Btn></>}</div>
        {(t.lenh||[]).length>0&&<div className="mt-3 text-[11px]"><div className="font-semibold text-ink-muted mb-0.5">Lệnh gần đây</div>{(t.lenh||[]).slice(0,8).map(l=><div key={l.id} className="py-0.5 border-t border-line flex gap-2"><Pill cls={l.trang_thai==='XONG'?'bg-emerald-100 text-emerald-800':l.trang_thai==='HONG'?'bg-rose-100 text-rose-700':l.trang_thai==='DA_GUI'?'bg-sky-100 text-sky-800':'bg-slate-100 text-ink'}>{l.trang_thai}</Pill><span className="text-ink">{l.viec} {l.tham_so.id?(l.tham_so.id+'/'+l.tham_so.viec):''}</span><span className="text-ink-muted min-w-0 flex-1 truncate">{l.ket_qua||''}</span><span className="text-slate-400 shrink-0">{fmtDate(l.created_at)}</span></div>)}</div>}
      </Card>
    </div>
    <MayGhepCard/>
    {(t.lo||[]).length>0&&<Card pad="p-3"><SectionTitle className="mb-1">Lô dữ liệu Trạm đẩy về</SectionTitle>{(t.lo||[]).map(l=><div key={l.id} className="text-[11px] py-0.5 border-t border-line flex gap-2"><span className="text-slate-400 shrink-0">{fmtDate(l.created_at)}</span><span className="font-semibold text-ink">{l.bang}</span><span className="text-ink-muted">{l.so_dong} dòng · +{l.xu_ly.moi||0} mới · {l.xu_ly.cap_nhat||0} cập nhật{(l.xu_ly.loi||[]).length?(' · lỗi: '+l.xu_ly.loi.join('; ')):''}</span></div>)}</Card>}
  </div>;
}
// ADR-008 — máy dựng ghép theo tài khoản + kho nhạc nền dùng chung
function MayGhepCard(){
  const { db, me, goi, notify } = useApp(); const ds=db.may_ghep||[]; const nhac=(db.tai_san||[]).filter(t=>t.loai==='NHAC'); const fileRef=useRef(null); const [busy,setBusy]=useState(false); const cfg=(db.module_config||{}).dung_video||{};
  const go=async(m)=>{ if(!confirm('Gỡ máy "'+m.ten+'" của '+m.chu_ten+'?')) return; const r=await goi('/may-ghep/'+m.id,{method:'DELETE'}); if(r.ok) notify('Đã gỡ'); else notify(r.msg,'err'); };
  const upload=async(file)=>{ if(!file) return; setBusy(true); try{ const tok=localStorage.getItem('kingsmen_os_token'); const r=await fetch('/api/tai-san/upload?type='+encodeURIComponent(file.type||'audio/mpeg'),{method:'POST',headers:{Authorization:'Bearer '+tok,'Content-Type':file.type||'audio/mpeg'},body:file}); const j=await r.json(); if(!r.ok) throw new Error(j.error||'Lỗi tải lên'); const mo=prompt('Mô tả nhạc (để máy chọn theo kịch bản, VD: nhẹ nhàng, công trình, năng động):','')||''; const x=await goi('/tai-san',{method:'POST',body:{ten:file.name, mo_ta:mo, media_url:j.media_url, media_type:'AUDIO', loai:'NHAC'}}); if(x.ok) notify('Đã thêm nhạc nền'); else notify(x.msg,'err'); }catch(e){ notify(e.message,'err'); } setBusy(false); };
  const xoa=async(t)=>{ if(!confirm('Xoá nhạc "'+t.ten+'"?')) return; const r=await goi('/tai-san/'+t.id,{method:'DELETE'}); if(r.ok) notify('Đã xoá'); else notify(r.msg,'err'); };
  return <div className="grid lg:grid-cols-2 gap-3">
    <Card pad="p-3"><SectionTitle className="mb-1">🖥 Máy dựng đã ghép ({ds.filter(m=>m.song).length}/{ds.length} đang bật)</SectionTitle><div className="text-[11px] text-ink-muted mb-2">Mỗi người ghép máy của mình ở Hồ sơ › Máy dựng. Mã dựng tải từ app mỗi lần chạy. Giọng đọc: {db.san_sang.tts?('Google '+(cfg.tts_giong||'')):'chưa cắm GOOGLE_TTS_KEY (wrangler secret put GOOGLE_TTS_KEY)'}.</div>
      {ds.length===0?<div className="text-xs text-ink-muted">Chưa có máy nào.</div>:<div className="space-y-1">{ds.map(m=><div key={m.id} className="flex items-center gap-2 text-xs"><span>{m.song?'🟢':'⚪'}</span><span className="font-semibold text-ink">{m.ten}</span><span className="text-ink-muted">{m.chu_ten} · {m.song?('đang bật'+(m.than.ffmpeg===false?' · ⚠ chưa ffmpeg':'')+(m.than.dang_lam?(' · '+m.than.dang_lam):'')):(m.nhan_luc?('im từ '+fmtDate(m.nhan_luc)):'chưa nối')}{m.ban?(' · v'+m.ban):''}</span>{(me.vai_tro==='ADMIN'||m.chu_user_id===me.id)&&<LinkBtn tone="danger" className="ml-auto" onClick={()=>go(m)}>Gỡ</LinkBtn>}</div>)}</div>}</Card>
    <Card pad="p-3"><div className="flex items-center justify-between gap-2"><SectionTitle>🎵 Kho nhạc nền ({nhac.length})</SectionTitle>{laStaff(me)&&<><input ref={fileRef} type="file" accept="audio/*" className="hidden" onChange={e=>upload(e.target.files[0])}/><Btn variant="ghost" className="!py-1 !px-2 text-[11px]" onClick={()=>fileRef.current.click()} disabled={busy||!db.san_sang.media}>⬆ Thêm nhạc</Btn></>}</div><div className="text-[11px] text-ink-muted mb-2">Nhạc MKT đã có quyền dùng. Máy dựng chọn bài có mô tả khớp kịch bản, trộn nhỏ dưới giọng đọc (−{cfg.nhac_giam_db||18} dB).</div>
      {nhac.length===0?<div className="text-xs text-ink-muted">Chưa có nhạc — bản nháp sẽ không có nhạc nền.</div>:<div className="space-y-1">{nhac.map(t=><div key={t.id} className="flex items-center gap-2 text-xs"><span>🎵</span><span className="font-semibold text-ink truncate">{t.ten}</span><span className="text-ink-muted truncate">{t.mo_ta}</span><a className="text-brand-dark underline ml-auto shrink-0" href={t.media_url} target="_blank" rel="noreferrer">nghe</a>{laStaff(me)&&<LinkBtn tone="danger" onClick={()=>xoa(t)}>xoá</LinkBtn>}</div>)}</div>}</Card>
  </div>;
}
function NhatKyMay(){
  const { db, me, goi, notify } = useApp(); const [busy,setBusy]=useState(false); const [kq,setKq]=useState(null);
  const chayThu=async()=>{ setBusy(true); const r=await goi('/may/chay-thu',{method:'POST',body:{}}); setBusy(false); setKq(r.kq||null); if(r.ok) notify('Đã chạy thử'); else notify(r.msg,'err'); };
  return <div className="space-y-3">
    <Card pad="p-3"><div className="flex items-center justify-between gap-2 flex-wrap"><div><SectionTitle>Agent đang đăng ký ({(db.agents||[]).length})</SectionTitle><div className="text-[11px] text-ink-muted">{(db.agents||[]).map(a=>a.ma+' ('+a.loai+(a.buoc?(' · '+a.buoc):'')+')').join(' · ')}. Chạy thật lúc {((db.module_config||{}).may||{}).gio_chay}h mỗi ngày; "chạy thử" ghi nhãn riêng, không chiếm lượt của ngày.</div></div>
      {laGat(me) && <Btn variant="brand" onClick={chayThu} disabled={busy}>{busy?'Đang chạy…':'▶ Chạy thử tất cả'}</Btn>}</div>
      {kq && <div className="mt-2 text-[11px] space-y-0.5">{kq.map((k,i)=><div key={i} className="text-ink-soft">· <b>{k.agent}</b>: {k.tom_tat||k.bo_qua||(k.ok?'xong':'lỗi')}</div>)}</div>}</Card>
    <Card pad="">{(db.agent_run||[]).length===0 ? <Empty>Máy chưa chạy lượt nào.</Empty> : <div className="divide-y divide-line">{(db.agent_run||[]).map(r=><div key={r.id} className="px-3 py-2 flex gap-2 text-[12px] items-start">
      <span className={r.ok?'text-emerald-600':'text-rose-600'}>{r.ok?'✓':'✗'}</span><span className="text-slate-400 shrink-0 w-24">{fmtDate(r.at)}</span><span className="font-semibold text-ink shrink-0">{r.agent}</span>{r.thu&&<Pill>thử</Pill>}{r.bo_qua_ly_do&&<Pill cls="bg-amber-100 text-amber-800">bỏ qua</Pill>}
      <span className="text-ink-muted min-w-0 flex-1">{r.tom_tat}{(r.doc||r.ghi)?<span className="text-slate-400"> · đọc {r.doc} · ghi {r.ghi}</span>:null}{r.usd?<span className="text-slate-400"> · {r.usd.toFixed(4)} USD</span>:null}</span></div>)}</div>}</Card>
  </div>;
}
function ChiPhiAI(){
  const { db } = useApp(); const t=db.ai_thang||{}; const cfg=(db.module_config||{}).ai||{};
  const vnd=(t.usd||0)*(t.ty_gia_vnd||26000);
  return <div className="grid sm:grid-cols-3 gap-2">
    <Card pad="p-3"><div className="text-[11px] text-ink-muted">Tháng {t.thang}</div><div className="font-display text-xl font-extrabold text-ink">{(t.usd||0).toFixed(2)} USD</div><div className="text-[11px] text-ink-muted">≈ {fmtSo(Math.round(vnd))} đ · {fmtSo(t.so_lan)} lượt gọi</div></Card>
    <Card pad="p-3"><div className="text-[11px] text-ink-muted">Ngân sách tháng</div><div className="font-display text-xl font-extrabold text-ink">{cfg.ngan_sach_thang_usd?cfg.ngan_sach_thang_usd+' USD':'không giới hạn'}</div>{t.pct!=null && <><Thanh pct={t.pct} cls={t.pct>=100?'bg-rose-500':t.pct>=(cfg.canh_bao_pct||80)?'bg-amber-500':'bg-brand'}/><div className="text-[11px] text-ink-muted mt-1">{t.pct.toFixed(0)}% · học được dùng tối đa {cfg.ngan_sach_hoc_pct}%</div></>}</Card>
    <Card pad="p-3"><div className="text-[11px] text-ink-muted">Token</div><div className="font-display text-xl font-extrabold text-ink">{fmtSo(t.tokens_vao)} <span className="text-xs font-normal text-ink-muted">vào</span></div><div className="text-[11px] text-ink-muted">{fmtSo(t.tokens_ra)} ra</div></Card>
    <div className="sm:col-span-3"><Callout tone="note">Vượt ngân sách → máy dừng khâu tốn tiền (soạn nháp, bản nháp bóng, sinh ảnh); khâu rẻ (đo, chấm điểm) vẫn chạy. Giá theo model đặt trong Cấu hình › ai.</Callout></div>
  </div>;
}
function CauHinhMay(){
  const { db, me, goi, notify } = useApp(); const duoc=laGat(me); const mc=db.module_config||{};
  const [may,setMay]=useState({...mc.may}); const [ai,setAi]=useState({ngan_sach_thang_usd:mc.ai.ngan_sach_thang_usd, ngan_sach_hoc_pct:mc.ai.ngan_sach_hoc_pct, canh_bao_pct:mc.ai.canh_bao_pct, chan_khi_vuot:mc.ai.chan_khi_vuot, ty_gia_vnd:mc.ai.ty_gia_vnd});
  const [trend,setTrend]=useState({tu_khoa:(mc.trend.tu_khoa_nganh||[]).join('\n'), chong_trung_ngay:mc.trend.chong_trung_ngay, nguong_tu_duyet:mc.trend.nguong_tu_duyet}); const [kh,setKh]=useState({...mc.ke_hoach}); const [nd,setNd]=useState({...mc.noi_dung}); const [dv,setDv]=useState({...(mc.dung_video||{})});
  const luu=async(key,val)=>{ const body={cau_hinh:Object.fromEntries(Object.entries(val).map(([k,v])=>[k, typeof (mc[key]||{})[k]==='number'?Number(v):typeof (mc[key]||{})[k]==='boolean'?!!v:v]))}; const r=await goi('/cau-hinh/'+key,{method:'PUT',body}); if(r.ok) notify('Đã lưu — áp dụng ngay'); else notify(r.msg,'err'); };
  const luuTrend=async()=>{ const r=await goi('/cau-hinh/trend',{method:'PUT',body:{cau_hinh:{tu_khoa_nganh:trend.tu_khoa.split('\n').map(s=>s.trim()).filter(Boolean).slice(0,100), chong_trung_ngay:Number(trend.chong_trung_ngay)||30, nguong_tu_duyet:Number(trend.nguong_tu_duyet)||70}}}); if(r.ok) notify('Đã lưu'); else notify(r.msg,'err'); };
  const SoF=({o,set,k,l,h})=><Field label={l} hint={h}><Input type="number" value={o[k]??''} disabled={!duoc} onChange={e=>set({...o,[k]:e.target.value})}/></Field>;
  return <div className="grid lg:grid-cols-2 gap-3">
    <Card><SectionTitle className="mb-2">Trend & ý tưởng (B1)</SectionTitle>
      <Field label="Từ khoá ngành — mỗi dòng một từ" hint="Máy chỉ nhận trend khớp ít nhất 1 từ. ĐỂ TRỐNG = nhận tất cả (dễ ngập rác)."><Textarea rows="4" value={trend.tu_khoa} disabled={!duoc} onChange={e=>setTrend({...trend,tu_khoa:e.target.value})} placeholder={'keo ron\nron gạch\nốp lát\nchống thấm\nhoàn thiện nhà'}/></Field>
      <SoF o={trend} set={setTrend} k="nguong_tu_duyet" l="Điểm máy ≥ bao nhiêu thì tự duyệt (khi B1 ở AI tự làm)"/>
      <SoF o={trend} set={setTrend} k="chong_trung_ngay" l="Chống trùng trong bao nhiêu ngày"/>
      {duoc && <Btn variant="brand" onClick={luuTrend}>💾 Lưu</Btn>}</Card>
    <Card><SectionTitle className="mb-2">Nội dung (B4 · B5)</SectionTitle>
      <SoF o={nd} set={setNd} k="soan_nhap_toi_da_ngay" l="Máy soạn tối đa bao nhiêu bài/ngày (khi B4 ở mức AI)"/>
      <SoF o={nd} set={setNd} k="hoc_toi_da_ngay" l="Bản nháp bóng tối đa/ngày (chế độ học B4)" h="Tốn AI theo ngân sách học"/>
      <SoF o={nd} set={setNd} k="diem_tham_dinh" l="Điểm máy chấm ≥ bao nhiêu là 'máy nghĩ nên duyệt'" h="Chỉ để học & xếp thứ tự. Máy không bao giờ tự duyệt G3."/>
      {duoc && <Btn variant="brand" onClick={()=>luu('noi_dung',nd)}>💾 Lưu</Btn>}</Card>
    <Card><SectionTitle className="mb-2">Kế hoạch tháng (B2)</SectionTitle>
      <SoF o={kh} set={setKh} k="tong_bai_mac_dinh" l="Tổng bài mặc định khi chưa có tháng trước"/>
      <SoF o={kh} set={setKh} k="ngay_de_xuat" l="Máy lập đề xuất tháng sau vào ngày (1–28)" h="Chỉ khi B2 ở mức AI gợi ý. Người vẫn chốt (G2)."/>
      {duoc && <Btn variant="brand" onClick={()=>luu('ke_hoach',kh)}>💾 Lưu</Btn>}</Card>
    <Card><SectionTitle className="mb-2">Máy</SectionTitle>
      <SoF o={may} set={setMay} k="nguong_san_sang" l="Ngưỡng sẵn sàng để gạt AI tự làm (0–100)" h="Thiện chốt 80"/>
      <SoF o={may} set={setMay} k="min_mau" l="Số mẫu tối thiểu" h="Thiện chốt 30"/>
      <SoF o={may} set={setMay} k="gio_chay" l="Giờ máy chạy hằng ngày (giờ VN, 0–23)"/>
      <SoF o={may} set={setMay} k="nguong_ha" l="Điểm gần đây dưới bao nhiêu thì máy đề nghị HẠ mức" h="Chỉ với bước đang ở mức AI"/>
      <SoF o={may} set={setMay} k="ngay_gan" l="'Gần đây' = bao nhiêu ngày"/>
      <SoF o={may} set={setMay} k="mau_ha" l="Cần ít nhất bao nhiêu mẫu gần đây mới xét hạ"/>
      {duoc && <Btn variant="brand" onClick={()=>luu('may',may)}>💾 Lưu</Btn>}</Card>
    <Card><SectionTitle className="mb-2">Video nháp máy dựng (B8 · ADR-008)</SectionTitle>
      <Field label="Giọng đọc Google TTS" hint="vi-VN-Neural2-D (nam) · vi-VN-Neural2-A (nữ) · vi-VN-Wavenet-B…"><Input value={dv.tts_giong||''} disabled={!duoc} onChange={e=>setDv({...dv,tts_giong:e.target.value})}/></Field>
      <SoF o={dv} set={setDv} k="tts_toc_do" l="Tốc độ đọc (0.5–2)"/>
      <SoF o={dv} set={setDv} k="nhac_giam_db" l="Nhạc nền giảm bao nhiêu dB dưới giọng"/>
      <SoF o={dv} set={setDv} k="canh_toi_da" l="Số cảnh tối đa"/>
      <SoF o={dv} set={setDv} k="giay_toi_da" l="Thời lượng tối đa (giây)"/>
      <SoF o={dv} set={setDv} k="tts_usd_1m_ky_tu" l="Giá TTS (USD / 1 triệu ký tự)" h="Neural2: 16 · Standard: 4 — tính vào ngân sách AI"/>
      {duoc && <Btn variant="brand" onClick={()=>luu('dung_video',dv)}>💾 Lưu</Btn>}</Card>
    <Card><SectionTitle className="mb-2">Chi phí AI</SectionTitle>
      <SoF o={ai} set={setAi} k="ngan_sach_thang_usd" l="Ngân sách tháng (USD)" h="0 = không giới hạn"/>
      <SoF o={ai} set={setAi} k="ngan_sach_hoc_pct" l="Phần dành cho chế độ học (%)"/>
      <SoF o={ai} set={setAi} k="canh_bao_pct" l="Cảnh báo khi đạt (%)"/>
      <label className="flex items-center gap-2 text-sm mb-3"><Toggle on={!!ai.chan_khi_vuot} disabled={!duoc} onChange={v=>setAi({...ai,chan_khi_vuot:v})}/> Chặn bộ não khi vượt 100%</label>
      <SoF o={ai} set={setAi} k="ty_gia_vnd" l="Tỷ giá quy đổi (đ/USD)"/>
      {duoc && <Btn variant="brand" onClick={()=>luu('ai',ai)}>💾 Lưu</Btn>}</Card>
  </div>;
}
function NguoiDung(){
  const { db, me, goi, notify } = useApp(); const [edit,setEdit]=useState(null);
  return <Card pad=""><div className="px-3 py-2 border-b border-line flex items-center justify-between"><SectionTitle>Người dùng</SectionTitle><Btn variant="brand" className="!py-1.5 text-xs" onClick={()=>setEdit({vai_tro:'MARKETING',active:true})}>＋ Tạo tài khoản</Btn></div>
    <div className="divide-y divide-line">{(db.users||[]).map(u=><div key={u.id} className={"px-3 py-2 flex items-center gap-3 text-sm "+(u.active?'':'opacity-50')}><div className="w-8 h-8 rounded-full bg-brand-bg text-brand-dark grid place-items-center font-bold">{(u.ho_ten||'?').slice(0,1)}</div>
      <div className="min-w-0 flex-1"><div className="font-semibold text-ink">{u.ho_ten} {u.id===me.id&&<Pill>bạn</Pill>} {u.doi_mat_khau&&<Pill cls="bg-amber-100 text-amber-800">chưa đổi mật khẩu</Pill>}</div><div className="text-[11px] text-ink-muted">{u.email} · {ROLE_LABEL[u.vai_tro]}{u.active?'':' · đã khoá'}</div></div>
      <LinkBtn onClick={()=>setEdit(u)}>Sửa</LinkBtn></div>)}</div>
    {edit && <NguoiDungForm init={edit} onClose={()=>setEdit(null)}/>}</Card>;
}
function NguoiDungForm({init,onClose}){
  const { me, goi, notify } = useApp(); const [f,setF]=useState({ho_ten:init.ho_ten||'', email:init.email||'', password:'', vai_tro:init.vai_tro||'MARKETING', active:init.active!==false}); const [busy,setBusy]=useState(false);
  const luu=async()=>{ setBusy(true); const body=init.id?{ho_ten:f.ho_ten, vai_tro:f.vai_tro, active:f.active, ...(f.password?{password:f.password}:{})}:{...f}; const r=await goi(init.id?('/users/'+init.id):'/users',{method:init.id?'PATCH':'POST',body}); setBusy(false); if(r.ok){ notify('Đã lưu'); onClose(); } else notify(r.msg,'err'); };
  return <Modal open onClose={onClose} title={init.id?'Sửa tài khoản':'Tạo tài khoản'}>
    <Field label="Họ tên" required><Input value={f.ho_ten} onChange={e=>setF({...f,ho_ten:e.target.value})}/></Field>
    <Field label="Email" required><Input type="email" value={f.email} disabled={!!init.id} onChange={e=>setF({...f,email:e.target.value})}/></Field>
    <Field label={init.id?'Đặt lại mật khẩu (để trống nếu không)':'Mật khẩu tạm'} hint="Người dùng sẽ bị bắt đổi ở lần đăng nhập đầu" required={!init.id}><PasswordInput value={f.password} onChange={e=>setF({...f,password:e.target.value})}/></Field>
    <Field label="Vai trò"><Select value={f.vai_tro} onChange={e=>setF({...f,vai_tro:e.target.value})}>{Object.keys(ROLE_LABEL).filter(r=>r!=='ADMIN'||me.vai_tro==='ADMIN').map(r=><option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</Select></Field>
    {init.id && init.id!==me.id && <label className="flex items-center gap-2 text-sm mb-3"><Toggle on={f.active} onChange={v=>setF({...f,active:v})}/> Đang hoạt động</label>}
    <div className="flex justify-end gap-2"><Btn variant="ghost" onClick={onClose}>Huỷ</Btn><Btn variant="brand" onClick={luu} disabled={busy||!f.ho_ten||!f.email||(!init.id&&!f.password)}>Lưu</Btn></div>
  </Modal>;
}
function NhapDanhMuc(){
  const { goi, notify } = useApp(); const [text,setText]=useState(''); const [kq,setKq]=useState(null); const [busy,setBusy]=useState(false);
  const nhap=async()=>{ let o; try{ o=JSON.parse(text); }catch(e){ return notify('JSON không hợp lệ','err'); } setBusy(true); const r=await goi('/nhap/danh-muc',{method:'POST',body:o}); setBusy(false); if(r.ok){ setKq(r.dem); notify('Đã nhập'); } else notify(r.msg,'err'); };
  return <Card><SectionTitle className="mb-1">Nhập danh mục gốc một lần</SectionTitle>
    <div className="text-[11px] text-ink-muted mb-2 leading-relaxed">Dán JSON dạng <code>{'{"pillars":[…],"frameworks":[…],"san_pham":[…],"claim_cam":[…],"kenh":[…]}'}</code>. Lấy từ app cũ bằng lệnh <code>node scripts/xuat-danh-muc-cu.mjs</code> (xem README). Trùng mã/tên thì cập nhật, không nhân đôi. Không nhập nội dung, kịch bản, kết quả cũ (quyết định bỏ dữ liệu cũ).</div>
    <Textarea rows="8" value={text} onChange={e=>setText(e.target.value)} placeholder='{"san_pham":[{"ma":"G7000","ten":"Kingsmen G7000","thong_so":[{"k":"Phạm vi","v":"Ngoài trời"}]}]}'/>
    <div className="flex justify-end mt-2"><Btn variant="brand" onClick={nhap} disabled={busy||!text.trim()}>Nhập</Btn></div>
    {kq && <div className="mt-2 text-[11px] text-ink-soft">{Object.entries(kq).map(([b,d])=><span key={b} className="mr-3">{b}: +{d.them} · sửa {d.sua}</span>)}</div>}</Card>;
}
