// ===== MÀN 5 — MÁY: bộ quyền 12 bước · nhật ký agent · chi phí AI · cấu hình · người dùng · nhập danh mục =====
function May(){
  const { db, me } = useApp();
  const [tab,setTab]=useState('buoc');
  const aiN=db.ai_nao||{}; const tabs=[{key:'buoc',label:'Bước: người hay AI'},{key:'ai',label:'🧠 Bộ não AI',count:((aiN.dinh_tuyen||[]).filter(d=>d.de_nghi).length+(aiN.phien_ban||[]).filter(x=>x.trang_thai==='CHO_DUYET').length)||null},{key:'tram',label:'🖥 Trạm máy văn phòng'},{key:'nhatky',label:'Nhật ký máy',count:(db.agent_run||[]).length},{key:'chiphi',label:'Chi phí AI'},{key:'cauhinh',label:'Cấu hình'},...(['ADMIN','TRUONG_MKT'].includes(me.vai_tro)?[{key:'nguoi',label:'Người dùng',count:(db.users||[]).length}]:[]),...(me.vai_tro==='ADMIN'?[{key:'nhap',label:'Nhập danh mục'},{key:'mophong',label:'🧪 Mô phỏng'}]:[])];
  return <div className="space-y-4">
    <PageHeader title="🤖 Máy" sub={'Giai đoạn 1: người làm, máy học. '+(db.san_sang.ai?'● Bộ não Anthropic sẵn sàng':'○ Chưa cắm ANTHROPIC_API_KEY (secret Worker)')+' · '+(db.san_sang.youtube?'● YouTube':'○ YouTube key')+' · '+(db.san_sang.n8n?'● n8n':'○ n8n')}/>
    <Tabs size="sm" active={tab} onChange={setTab} tabs={tabs}/>
    {tab==='buoc' && <BangBuoc/>}
    {tab==='ai' && <BoNaoAI/>}
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
          {phien.length>0&&<div className="mt-2 space-y-0.5">{phien.map(([id,p])=><div key={id} className="text-[11px] flex gap-2"><span className={p.co_phien?'text-emerald-600':'text-slate-400'}>{p.co_phien?'●':'○'}</span><span className="font-semibold text-ink">{p.ten||id}</span><span className="text-ink-muted">{p.tt} · {p.msg}{p.dung_den&&p.dung_den>new Date().toISOString()&&<span className="text-rose-700"> · ⏸ Trạm dừng tới {fmtDate(p.dung_den)}</span>}{p.dang_dung_boi&&<span className="text-amber-700"> · đang được {p.dang_dung_boi} dùng</span>}</span></div>)}</div>}
          {(tt.nhan_vien||[]).length>0&&<div className="mt-3"><div className="text-[11px] font-semibold text-ink mb-1">Nhân viên máy trên Trạm làm cho Content OS (ADR-T01)</div><div className="space-y-1">{tt.nhan_vien.map(n=><div key={n.nv} className="text-[11px] border-t border-line pt-1"><span className="font-semibold text-ink">{n.ten}</span>{n.tam_nghi&&<span className="text-rose-700"> · tạm nghỉ</span>}<span className="text-ink-muted"> · {(n.viec||[]).length} nhiệm vụ</span><div className="text-ink-muted">{n.khong_tk?'không cần tài khoản':((n.cap||[]).length?n.cap.map(c=><span key={c.tk} className="inline-block mr-1"><code>{c.tk}</code>[{(c.vai||[]).join('+')}{c.tran&&c.tran.bai_ngay!=null?(' ≤'+c.tran.bai_ngay+' bài/ngày'):''}]{c.ban?<span className="text-amber-700"> đang {c.ban} dùng</span>:''}</span>):'chưa cấp tài khoản nào — cấp ở Trạm › Agent')}</div></div>)}</div><div className="text-[10px] text-ink-muted mt-1">Cấp quyền tài khoản cho nhân viên máy chỉ đặt được trên Trạm; Content OS chỉ xem và đề nghị.</div></div>}</div>}
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
// ===== ADR-009 — BỘ NÃO AI: mô hình · định tuyến (API → BÓNG → MỞ) · huấn luyện · chi phí theo mô hình =====
const LOAI_MH={NGON_NGU:'Ngôn ngữ',NHIN:'Nhìn',NGHE:'Nghe',TTS:'Giọng đọc',ANH:'Ảnh'}; const MUC_AI={API:['API / quy tắc','bg-slate-100 text-ink'],BONG:['BÓNG (mở chạy song song)','bg-amber-100 text-amber-800'],MO:['MỞ (mô hình mở tự làm)','bg-emerald-100 text-emerald-800']};
function BoNaoAI(){
  const { db } = useApp(); const [tab,setTab]=useState('dinhtuyen'); const a=db.ai_nao||{};
  return <div className="space-y-3">
    <Callout tone="info"><b>Bộ não AI</b> = danh mục mô hình (API trả tiền + mô hình mở chạy trên máy ghép) và <b>định tuyến</b> theo từng tính năng. Mỗi tính năng đi ba mức như bộ quyền bước: <b>API</b> (thầy) → <b>BÓNG</b> (mô hình mở chạy song song, chỉ để chấm) → <b>MỞ</b> (mô hình mở tự làm, API dự phòng). Máy chấm điểm và đề nghị; Trưởng MKT/Admin gạt. Kho mẫu = mọi lượt gọi + phán quyết của người; đầu nhìn (chọn cảnh) huấn luyện từ mẫu người chấm trên máy ghép, người duyệt phiên bản mới bật.</Callout>
    <Tabs size="sm" active={tab} onChange={setTab} tabs={[{key:'dinhtuyen',label:'Định tuyến',count:(a.dinh_tuyen||[]).filter(d=>d.de_nghi).length||null},{key:'mohinh',label:'Mô hình',count:(a.mo_hinh||[]).length||null},{key:'khoa',label:'🔑 Khoá API',count:(db.khoa_api||[]).filter(t=>!t.co).length||null},{key:'hoc',label:'Huấn luyện',count:(a.phien_ban||[]).filter(x=>x.trang_thai==='CHO_DUYET').length||null},{key:'chiphi',label:'Chi phí theo mô hình'}]}/>
    {tab==='dinhtuyen'&&<DinhTuyenAI a={a}/>}{tab==='mohinh'&&<MoHinhAI a={a}/>}{tab==='hoc'&&<HuanLuyenAI a={a}/>}{tab==='chiphi'&&<ChiPhiMoHinh a={a}/>}{tab==='khoa'&&<KhoaAPI/>}
  </div>;
}
// Khoá API dán ngay trên app (chủ 24/09) — Admin; thử với nhà cung cấp trước khi lưu; không bao giờ hiện lại giá trị
function KhoaAPI(){
  const { db, me, goi, notify } = useApp(); const ds=db.khoa_api||[]; const [gt,setGt]=useState({}); const [busy,setBusy]=useState('');
  if(me.vai_tro!=='ADMIN') return <Callout tone="note">Chỉ Admin cắm khoá API. Nhờ Admin vào Máy › Bộ não AI › Khoá API.</Callout>;
  const luu=async(t,vanLuu)=>{ const v=(gt[t.ten]||'').trim(); if(!v){ notify('Dán khoá vào ô trước','err'); return; } setBusy(t.ten); const r=await goi('/khoa-api/'+t.ten,{method:'PUT',body:{gia_tri:v, van_luu:!!vanLuu}}); setBusy('');
    if(r.ok){ setGt({...gt,[t.ten]:''}); notify('Đã cắm '+t.ten+(r.thu?(r.thu.ok?' · thử được: '+(r.thu.ghi||''):''):'')); }
    else if(/Vẫn lưu/.test(r.msg||'')){ if(confirm(r.msg+'\n\nVẫn lưu khoá này?')) luu(t,true); else notify(r.msg,'err'); }
    else notify(r.msg,'err'); };
  const go=async(t)=>{ if(!confirm('Gỡ '+t.ten+' khỏi app?')) return; setBusy(t.ten); const r=await goi('/khoa-api/'+t.ten,{method:'DELETE'}); setBusy(''); if(r.ok) notify('Đã gỡ '+t.ten); else notify(r.msg,'err'); };
  const soCo=ds.filter(t=>t.co).length;
  return <div className="space-y-3">
    <Callout tone="info"><b>Dán khoá ở đây, không cần máy có wrangler.</b> Khoá lưu mã hoá trên máy chủ app và không bao giờ hiện lại, chỉ hiện 4 ký tự cuối. App <b>thử khoá với nhà cung cấp trước khi lưu</b>. Khoá đã cắm bằng <code>wrangler secret</code> (file dan-khoa.bat) vẫn được ưu tiên và không sửa được ở đây. Lấy khoá: Claude tại console.anthropic.com › API Keys · Google TTS / Gemini / YouTube tại console.cloud.google.com (bật API tương ứng rồi tạo API key) · OpenAI tại platform.openai.com.</Callout>
    <Card pad=""><div className="px-3 py-2 border-b border-line text-xs text-ink-muted">{soCo}/{ds.length} khoá đã có · Hai khoá cần nhất: <b>ANTHROPIC_API_KEY</b> (bộ não) và <b>GOOGLE_TTS_KEY</b> (giọng đọc)</div>
      <div className="overflow-x-auto"><table className="w-full text-xs min-w-[720px]"><thead><tr className="text-[10px] uppercase tracking-wide text-ink-muted"><th className="text-left px-3 py-2">Khoá</th><th className="text-left px-3 py-2">Dùng cho</th><th className="text-left px-3 py-2">Trạng thái</th><th className="text-left px-3 py-2">Dán khoá mới</th><th></th></tr></thead>
        <tbody className="divide-y divide-line">{ds.map(t=><tr key={t.ten} className={t.co?'':'bg-amber-50/40'}>
          <td className="px-3 py-2 font-mono text-[11px] text-ink">{t.ten}</td>
          <td className="px-3 py-2 text-ink-muted">{t.dung_cho}</td>
          <td className="px-3 py-2">{t.co?<span className="text-emerald-700">● đã có{t.duoi?(" …"+t.duoi):""}<div className="text-[10px] text-ink-muted">{t.nguon==='wrangler'?'cắm bằng wrangler (Cloudflare)':('dán trên app'+(t.boi?(' · '+t.boi):'')+(t.luc?(' · '+fmtDate(t.luc)):''))}</div></span>:<span className="text-rose-700">○ chưa có</span>}</td>
          <td className="px-3 py-2">{t.nguon==='wrangler'?<span className="text-[11px] text-ink-muted">gỡ ở Cloudflare rồi mới dán được ở đây</span>:<Input type="password" autoComplete="new-password" className="!py-1 text-[11px] !w-64" placeholder={t.co?'dán khoá mới để thay':'dán khoá…'} value={gt[t.ten]||''} onChange={e=>setGt({...gt,[t.ten]:e.target.value})} disabled={busy===t.ten}/>}</td>
          <td className="px-3 py-2 whitespace-nowrap">{t.nguon!=='wrangler'&&<><Btn variant="brand" className="!py-1 !px-2 text-[11px]" onClick={()=>luu(t)} disabled={busy===t.ten||!(gt[t.ten]||'').trim()}>{busy===t.ten?'Đang thử…':(t.thu_duoc?'Thử & lưu':'Lưu')}</Btn>{t.co&&t.nguon==='app'&&<Btn variant="ghost" className="!py-1 !px-2 text-[11px] ml-1" onClick={()=>go(t)} disabled={busy===t.ten}>Gỡ</Btn>}</>}</td>
        </tr>)}</tbody></table></div></Card>
    <div className="text-[11px] text-ink-muted">Cắm xong là dùng ngay, không cần deploy lại. Token đăng bài kênh (TOKEN_…) hiện ở đây khi kênh có mã API ở Chiến lược › Kênh.</div>
  </div>;
}
function DinhTuyenAI({a}){
  const { me, goi, notify } = useApp(); const duoc=laGat(me); const [busy,setBusy]=useState(false); const mh=a.mo_hinh||[];
  const luu=async(d,body)=>{ setBusy(true); const r=await goi('/ai/dinh-tuyen/'+d.tinh_nang,{method:'PATCH',body}); setBusy(false); if(r.ok) notify('Đã lưu định tuyến '+d.ten); else notify(r.msg,'err'); };
  const Sel=({d,k,cach})=><Select className="!py-1 text-[11px] !w-44" value={d[k]||''} disabled={!duoc||busy} onChange={e=>luu(d,{[k]:e.target.value||null})}><option value="">{cach==='API'?(d.loai==='NHIN'?'— quy tắc từ khoá —':'— không —'):'— chưa gán —'}</option>{mh.filter(m=>m.loai===d.loai&&m.cach_goi===cach).map(m=><option key={m.id} value={m.id}>{m.ten}{m.cach_goi==='API'&&m.co_khoa===false?' (thiếu khoá)':''}{m.phien_ban?(' · '+m.phien_ban):''}</option>)}</Select>;
  return <Card pad=""><table className="w-full text-xs"><thead><tr className="text-left text-ink-muted border-b border-line"><th className="px-3 py-2">Tính năng</th><th className="px-3 py-2">Chính (API)</th><th className="px-3 py-2">Dự phòng</th><th className="px-3 py-2">Mô hình mở</th><th className="px-3 py-2">Mức</th><th className="px-3 py-2">Điểm mở / mẫu</th><th className="px-3 py-2">Máy đề nghị</th></tr></thead><tbody>
    {(a.dinh_tuyen||[]).map(d=><tr key={d.tinh_nang} className="border-b border-line/60 align-top"><td className="px-3 py-2"><div className="font-semibold text-ink">{d.ten}</div><div className="text-[10px] text-ink-muted">{LOAI_MH[d.loai]} · {d.tinh_nang} · ngưỡng {d.nguong}/100, ≥ {d.min_mau} mẫu</div></td>
      <td className="px-3 py-2"><Sel d={d} k="mo_hinh_chinh" cach="API"/></td><td className="px-3 py-2">{d.loai==='NHIN'?<span className="text-ink-muted">—</span>:<Sel d={d} k="mo_hinh_du_phong" cach="API"/>}</td><td className="px-3 py-2"><Sel d={d} k="mo_hinh_mo" cach="MAY_GHEP"/></td>
      <td className="px-3 py-2"><div className="flex gap-1">{['API','BONG','MO'].map(m=><button key={m} disabled={!duoc||busy} onClick={()=>m!==d.muc&&luu(d,{muc:m})} title={MUC_AI[m][0]} className={"px-2 py-0.5 rounded-lg text-[10px] font-semibold border "+(d.muc===m?MUC_AI[m][1]+' border-transparent':'bg-white text-ink-muted border-line hover:bg-slate-50')}>{m==='API'?(d.loai==='NHIN'?'Quy tắc':'API'):m==='BONG'?'Bóng':'Mở'}</button>)}</div>{d.loai==='NGON_NGU'&&!(a.mo_ho_tro||[]).includes(d.tinh_nang)&&<div className="text-[10px] text-ink-muted mt-0.5">chỉ tới BÓNG</div>}</td>
      <td className="px-3 py-2"><div className="font-semibold text-ink">{d.diem}/100</div><div className="text-[10px] text-ink-muted">{d.so_mau} mẫu</div></td>
      <td className="px-3 py-2 text-[11px]">{d.de_nghi?<span className={d.de_nghi==='LEN'?'text-emerald-700':'text-rose-700'}>{d.de_nghi==='LEN'?'⬆ nâng':'⬇ hạ'} — {d.de_nghi_ly_do}</span>:<span className="text-ink-muted">—</span>}</td></tr>)}</tbody></table>
    <div className="px-3 py-2 text-[11px] text-ink-muted border-t border-line">Gạt <b>MỞ</b> cần: mô hình mở có phiên bản đã duyệt (nhìn) + điểm ≥ ngưỡng + đủ mẫu. Máy không bao giờ tự gạt.</div></Card>;
}
function MoHinhAI({a}){
  const { me, goi, notify, db } = useApp(); const admin=me.vai_tro==='ADMIN'; const [busy,setBusy]=useState(false); const [kq,setKq]=useState({}); const [them,setThem]=useState(null);
  const thu=async(m)=>{ setBusy(true); const r=await goi('/ai/mo-hinh/'+m.id+'/thu',{method:'POST'}); setBusy(false); setKq({...kq,[m.id]:r}); if(!r.ok) notify(r.msg||r.loi,'err'); };
  const bat=async(m,tt)=>{ const r=await goi('/ai/mo-hinh/'+m.id,{method:'PATCH',body:{trang_thai:tt}}); if(r.ok) notify('Đã '+(tt==='BAT'?'bật':'tắt')+' '+m.ten); else notify(r.msg,'err'); };
  const luuThem=async()=>{ setBusy(true); const r=await goi('/ai/mo-hinh',{method:'POST',body:them}); setBusy(false); if(r.ok){ notify('Đã thêm mô hình'); setThem(null); } else notify(r.msg,'err'); };
  return <div className="space-y-3">
    <div className="flex items-center justify-between"><div className="text-[11px] text-ink-muted">Khoá API đặt ở Worker (wrangler secret put ANTHROPIC_API_KEY / GEMINI_API_KEY / OPENAI_API_KEY / GOOGLE_TTS_KEY) — app không lưu khoá. Mô hình mở chạy trên máy ghép có kha_nang mo_hinh (cài Ollama hoặc npm install trong thư mục máy con).</div>{admin&&<Btn variant="brand" className="!py-1.5 text-xs shrink-0" onClick={()=>setThem({loai:'NGON_NGU',cach_goi:'API',nha_cung_cap:'anthropic',don_vi:'1M_token'})}>＋ Thêm mô hình</Btn>}</div>
    <Card pad=""><table className="w-full text-xs"><thead><tr className="text-left text-ink-muted border-b border-line"><th className="px-3 py-2">Mô hình</th><th className="px-3 py-2">Loại · cách gọi</th><th className="px-3 py-2">model_id</th><th className="px-3 py-2">Giá (USD/{'{'}đơn vị{'}'})</th><th className="px-3 py-2">Sẵn sàng</th><th className="px-3 py-2">Phiên bản / điểm</th><th/></tr></thead><tbody>
      {(a.mo_hinh||[]).map(m=><tr key={m.id} className={"border-b border-line/60 "+(m.trang_thai==='TAT'?'opacity-50':'')}><td className="px-3 py-2"><div className="font-semibold text-ink">{m.ten}</div><div className="text-[10px] text-ink-muted">{m.id} · {m.nha_cung_cap}{m.ghi_chu?(' · '+m.ghi_chu):''}</div></td><td className="px-3 py-2">{LOAI_MH[m.loai]} · {m.cach_goi==='API'?'API':'máy ghép'}</td><td className="px-3 py-2 font-mono text-[10px]">{m.model_id}</td><td className="px-3 py-2">{m.cach_goi==='API'?(m.gia_vao+' / '+m.gia_ra+' '+m.don_vi):'0 (máy mình)'}</td>
        <td className="px-3 py-2">{m.cach_goi==='API'?(m.co_khoa?<span className="text-emerald-700">● có khoá</span>:<span className="text-rose-700" title={m.ten_khoa}>○ thiếu {m.ten_khoa||'khoá'}</span>):(db.may_ghep||[]).some(x=>x.song&&(x.kha_nang||[]).includes('mo_hinh'))?<span className="text-emerald-700">● máy ghép bật</span>:<span className="text-ink-muted">○ chưa có máy</span>}</td>
        <td className="px-3 py-2 text-[11px]">{m.phien_ban?(m.phien_ban+' · '+m.diem+'/100 · '+m.so_mau+' mẫu'):(m.cach_goi==='MAY_GHEP'?'chưa huấn luyện':'—')}</td>
        <td className="px-3 py-2 text-right whitespace-nowrap">{laGat(me)&&m.cach_goi==='API'&&m.loai==='NGON_NGU'&&<LinkBtn onClick={()=>thu(m)} disabled={busy}>thử</LinkBtn>}{admin&&<> · <LinkBtn onClick={()=>bat(m,m.trang_thai==='BAT'?'TAT':'BAT')}>{m.trang_thai==='BAT'?'tắt':'bật'}</LinkBtn></>}{kq[m.id]&&<div className={"text-[10px] "+(kq[m.id].ok?'text-emerald-700':'text-rose-700')}>{kq[m.id].ok?('✓ '+kq[m.id].ms+'ms · '+(kq[m.id].text||'').slice(0,60)):('✗ '+(kq[m.id].loi||kq[m.id].msg))}</div>}</td></tr>)}</tbody></table></Card>
    {them&&<Modal open onClose={()=>setThem(null)} title="Thêm mô hình">
      <div className="grid grid-cols-2 gap-2"><Field label="id (chữ thường, gạch nối)" required><Input value={them.id||''} onChange={e=>setThem({...them,id:e.target.value})} placeholder="gemini-2-5-pro"/></Field><Field label="Tên" required><Input value={them.ten||''} onChange={e=>setThem({...them,ten:e.target.value})}/></Field></div>
      <div className="grid grid-cols-3 gap-2"><Field label="Nhà cung cấp"><Select value={them.nha_cung_cap} onChange={e=>setThem({...them,nha_cung_cap:e.target.value})}>{['anthropic','google','openai','openai_tuong_thich','ollama','huggingface','piper'].map(x=><option key={x} value={x}>{x==='openai_tuong_thich'?'OpenAI tương thích (Groq / DeepInfra / vLLM…)':x}</option>)}</Select></Field><Field label="Loại"><Select value={them.loai} onChange={e=>setThem({...them,loai:e.target.value})}>{Object.entries(LOAI_MH).map(([k,v])=><option key={k} value={k}>{v}</option>)}</Select></Field><Field label="Cách gọi"><Select value={them.cach_goi} onChange={e=>setThem({...them,cach_goi:e.target.value})}><option value="API">API</option><option value="MAY_GHEP">Máy ghép (mở)</option></Select></Field></div>
      <Field label="model_id" required><Input value={them.model_id||''} onChange={e=>setThem({...them,model_id:e.target.value})} placeholder="tên model ở nhà cung cấp / Ollama / HuggingFace"/></Field>
      {them.nha_cung_cap==='openai_tuong_thich'&&<div className="grid grid-cols-2 gap-2"><Field label="base_url (điểm cuối chuẩn OpenAI)"><Input value={them.base_url||''} onChange={e=>setThem({...them,base_url:e.target.value})} placeholder="https://api.groq.com/openai/v1"/></Field><Field label="Tên biến khoá ở Worker" hint="wrangler secret put <tên>"><Input value={them.khoa_env||''} onChange={e=>setThem({...them,khoa_env:e.target.value.toUpperCase()})} placeholder="GROQ_API_KEY"/></Field></div>}
      <div className="grid grid-cols-3 gap-2"><Field label="Giá vào"><Input type="number" value={them.gia_vao||0} onChange={e=>setThem({...them,gia_vao:e.target.value})}/></Field><Field label="Giá ra"><Input type="number" value={them.gia_ra||0} onChange={e=>setThem({...them,gia_ra:e.target.value})}/></Field><Field label="Đơn vị"><Select value={them.don_vi} onChange={e=>setThem({...them,don_vi:e.target.value})}><option value="1M_token">USD / 1M token</option><option value="1M_ky_tu">USD / 1M ký tự</option></Select></Field></div>
      <Field label="Ghi chú"><Input value={them.ghi_chu||''} onChange={e=>setThem({...them,ghi_chu:e.target.value})}/></Field>
      <div className="flex justify-end gap-2"><Btn variant="ghost" onClick={()=>setThem(null)}>Huỷ</Btn><Btn variant="brand" onClick={luuThem} disabled={busy||!them.id||!them.ten||!them.model_id}>Thêm</Btn></div></Modal>}
  </div>;
}
function HuanLuyenAI({a}){
  const { me, goi, notify, db } = useApp(); const duoc=laGat(me); const [busy,setBusy]=useState(false); const [ly,setLy]=useState({});
  const mayHoc=(db.may_ghep||[]).filter(m=>m.song&&(m.kha_nang||[]).includes('huan_luyen'));
  const hoc=async(tn)=>{ setBusy(true); const r=await goi('/ai/huan-luyen',{method:'POST',body:{tinh_nang:tn}}); setBusy(false); if(r.ok) notify(r.trung?'Lệnh huấn luyện đang chờ máy':('Đã giao máy huấn luyện với '+r.so_mau+' mẫu')); else notify(r.msg,'err'); };
  const quyet=async(p,q)=>{ setBusy(true); const r=await goi('/ai/phien-ban/'+p.id+'/'+q,{method:'POST',body:{ly_do:ly[p.id]||''}}); setBusy(false); if(r.ok) notify(q==='duyet'?'Đã bật phiên bản mới':'Đã từ chối'); else notify(r.msg,'err'); };
  const tk=a.mau_thong_ke||[];
  return <div className="space-y-3">
    <div className="grid lg:grid-cols-2 gap-3">
      <Card pad="p-3"><SectionTitle className="mb-1">Kho mẫu</SectionTitle><div className="text-[11px] text-ink-muted mb-2">Mỗi lượt AI làm = một mẫu; phán quyết người (duyệt/sửa/trả, chấm cảnh) gắn vào. ~20% giữ làm tập KIỂM để đánh giá mô hình mở.</div>
        {tk.length===0?<div className="text-xs text-ink-muted">Chưa có mẫu.</div>:<table className="w-full text-xs"><thead><tr className="text-left text-ink-muted"><th className="px-2 py-1">Tính năng</th><th className="px-2 py-1">Mẫu</th><th className="px-2 py-1">Người chấm</th><th className="px-2 py-1">Có bóng</th><th className="px-2 py-1">Kiểm</th></tr></thead><tbody>{tk.map(t=><tr key={t.tinh_nang} className="border-t border-line/60"><td className="px-2 py-1 font-semibold text-ink">{t.tinh_nang}</td><td className="px-2 py-1">{t.tong}</td><td className="px-2 py-1">{t.da_cham}</td><td className="px-2 py-1">{t.co_bong}</td><td className="px-2 py-1">{t.kiem}</td></tr>)}</tbody></table>}
        <div className="text-[11px] text-ink-muted mt-2">Chấm cảnh: mở thẻ video đã dựng › Sản xuất › ✓/✗ từng cảnh máy chọn.</div></Card>
      <Card pad="p-3"><SectionTitle className="mb-1">🎓 Huấn luyện đầu nhìn</SectionTitle><div className="text-[11px] text-ink-muted mb-2">Học "footage nào khớp gợi ý hình" từ mẫu người chấm (CLIP + đầu logistic, chạy CPU được; GPU thuê khi mẫu nhiều). Máy huấn luyện đang bật: {mayHoc.length?mayHoc.map(m=>m.ten).join(', '):'không — bật máy con đã npm install'}.</div>
        {duoc&&<div className="flex gap-2 flex-wrap">{(a.dinh_tuyen||[]).filter(d=>d.loai==='NHIN').map(d=><Btn key={d.tinh_nang} variant="brand" className="!py-1.5 text-xs" onClick={()=>hoc(d.tinh_nang)} disabled={busy}>🎓 Huấn luyện {d.ten}</Btn>)}</div>}
        <div className="mt-3 text-[11px] text-ink-muted"><b>Ngôn ngữ mở (LoRA, ADR-009c):</b> trên máy con chạy <code>node may-dung.mjs xuat-tap-mau soan_nhap_agent</code> → đưa file .train.jsonl + <a className="underline" href="/tools/may-dung/huan-luyen-ngon-ngu.py" download>huan-luyen-ngon-ngu.py</a> lên GPU thuê → GGUF → <code>ollama create kingsmen-qwen:v1</code> → <code>node may-dung.mjs phien-ban kingsmen-qwen:v1</code> → phiên bản hiện ở bảng dưới để duyệt. Tính năng ngôn ngữ được gạt MỞ: {(a.mo_ho_tro||[]).join(', ')}.</div>
        {(a.ai_viec||[]).length>0&&<div className="mt-2 text-[11px]"><div className="font-semibold text-ink-muted">Việc mô hình mở gần đây</div>{a.ai_viec.slice(0,8).map(v=><div key={v.id} className="flex gap-2 items-center py-0.5 border-t border-line/60"><Pill cls={v.trang_thai==='XONG'?'bg-emerald-100 text-emerald-800':['HONG','HET_HAN'].includes(v.trang_thai)?'bg-rose-100 text-rose-700':'bg-sky-100 text-sky-800'}>{v.trang_thai}</Pill><span className="text-ink">{v.tinh_nang}</span><span className="text-ink-muted truncate">{v.loi||(v.ms?(Math.round(v.ms/1000)+'s'):'')}</span><span className="text-slate-400 shrink-0">{fmtDate(v.created_at)}</span></div>)}</div>}
        {(a.lenh_hoc||[]).length>0&&<div className="mt-2 text-[11px] space-y-0.5">{a.lenh_hoc.map(l=><div key={l.id} className="flex gap-2 items-center"><Pill cls={l.trang_thai==='XONG'?'bg-emerald-100 text-emerald-800':l.trang_thai==='HONG'?'bg-rose-100 text-rose-700':'bg-slate-100 text-ink'}>{l.trang_thai}</Pill><span className="text-ink">{l.viec} {l.tham_so.tinh_nang||''}</span><span className="text-ink-muted truncate">{l.ket_qua||''}</span><span className="text-slate-400 shrink-0">{fmtDate(l.created_at)}</span></div>)}</div>}</Card>
    </div>
    <KhoThanhPham a={a} duoc={duoc}/>
    <Card pad=""><div className="px-3 py-2 border-b border-line"><SectionTitle>Phiên bản mô hình (người duyệt mới bật — G4)</SectionTitle></div>
      {(a.phien_ban||[]).length===0?<Empty>Chưa có phiên bản nào.</Empty>:<div className="divide-y divide-line">{a.phien_ban.map(p=><div key={p.id} className="px-3 py-2 text-xs flex items-center gap-2 flex-wrap"><Pill cls={p.trang_thai==='DUYET'?'bg-emerald-100 text-emerald-800':p.trang_thai==='TU_CHOI'?'bg-rose-100 text-rose-700':'bg-amber-100 text-amber-800'}>{p.trang_thai==='CHO_DUYET'?'chờ duyệt':p.trang_thai==='DUYET'?'đang dùng':'từ chối'}</Pill><span className="font-semibold text-ink">{p.mo_hinh_id} · {p.phien_ban}</span><span className="text-ink-muted">{p.tinh_nang} · khớp người <b>{p.danh_gia.diem}</b>/100 trên {p.danh_gia.n_kiem} cảnh kiểm (quy tắc {p.danh_gia.diem_truoc}) · học {p.danh_gia.n_hoc} · {p.may} · {fmtDate(p.created_at)}{p.duyet_boi?(' · '+p.duyet_boi+(p.ly_do?(': '+p.ly_do):'')):''}</span>
        {duoc&&p.trang_thai==='CHO_DUYET'&&<div className="ml-auto flex gap-1 items-center"><Input className="!py-1 !px-2 text-[11px] !w-40" placeholder="lý do (khi từ chối)" value={ly[p.id]||''} onChange={e=>setLy({...ly,[p.id]:e.target.value})}/><Btn variant="ok" className="!py-1 !px-2 text-[11px]" onClick={()=>quyet(p,'duyet')} disabled={busy}>✓ Bật</Btn><Btn variant="ghost" className="!py-1 !px-2 text-[11px]" onClick={()=>{ if(!(ly[p.id]||'').trim()) return notify('Từ chối phải ghi lý do','err'); quyet(p,'tu-choi'); }} disabled={busy}>✗</Btn></div>}</div>)}</div>}</Card>
  </div>;
}
// ADR-010d — KHO VIDEO THÀNH PHẨM: video đã dựng tay (Drive / thư mục máy dựng / kênh TikTok) → máy dựng cắt shot, nghe lời, dò clip gốc
// → mẫu học ghép (độ dài shot, chuyển cỡ cảnh), chọn cảnh, chọn đoạn. Lượt xem TikTok = trọng số mẫu (so trung vị cùng kênh).
function KhoThanhPham({a, duoc}){
  const { goi, notify, db } = useApp(); const [link,setLink]=useState(''); const [toiDa,setToiDa]=useState(20); const [busy,setBusy]=useState(false);
  const kho=a.kho_thanh_pham||[]; const cho=a.tai_tiktok_cho||[]; const tramSong=!!((db.tram||{}).trang_thai||{}).song;
  const laTikTok=/tiktok\.com\/@|^@[A-Za-z0-9_.]{2,}$/.test(link.trim()); const laDrive=/drive\.google\.com\/drive\/(u\/\d+\/)?folders\//.test(link); const laLocal=/^[A-Za-z]:[\\/]|^\//.test(link.trim());
  const nap=async()=>{ if(!link.trim()) return; setBusy(true); const r=await goi('/kho-thanh-pham/nap',{method:'POST',body:{link:link.trim(), toi_da:toiDa, nguon:laTikTok?'TIKTOK':undefined}}); setBusy(false); if(!r.ok) return notify(r.msg,'err'); setLink(''); notify(laTikTok?('Đã xin Trạm tải kênh '+r.kenh+' — xong Trạm tự giao máy dựng học'):(r.trung?'Máy dựng đã có lệnh này':'Đã giao máy dựng cắt shot & học')); };
  const nguonTen={DRIVE:'Drive',LOCAL:'Máy dựng',TIKTOK:'TikTok',REELS:'Reels',KALODATA:'Kalodata'};
  return <Card pad="p-3"><SectionTitle className="mb-1">🎞 Kho video thành phẩm (máy học cách cắt & ghép từ video đã làm tay)</SectionTitle>
    <div className="text-[11px] text-ink-muted mb-2">Dán <b>link thư mục Drive</b> (video thành phẩm; thư mục con tên <code>goc</code>/<code>source</code> chứa clip gốc để máy học cả <i>chọn đoạn</i>), hoặc <b>đường dẫn thư mục trên máy dựng</b> (vd <code>D:\\Video da dung</code>), hoặc <b>kênh TikTok</b> (<code>@tenkenh</code> — Trạm tải video kèm lượt xem; video nhiều xem hơn trung vị kênh được học nặng hơn).</div>
    {duoc&&<div className="flex gap-2 flex-wrap items-center"><Input className="!py-1.5 text-xs flex-1 min-w-[220px]" placeholder="link thư mục Drive · D:\\thu-muc · @kenhtiktok" value={link} onChange={e=>setLink(e.target.value)}/><span className="text-[11px] text-ink-muted">tối đa</span><Input type="number" min="1" max="60" className="!py-1.5 text-xs !w-16" value={toiDa} onChange={e=>setToiDa(+e.target.value||20)}/>
      <Btn variant="brand" className="!py-1.5 text-xs" onClick={nap} disabled={busy||!(laTikTok||laDrive||laLocal)} title={laTikTok&&!tramSong?'Trạm văn phòng đang im — TikTok tải qua Trạm':''}>{laTikTok?'📥 Xin Trạm tải kênh':'📥 Nạp & học'}</Btn>
      {link&&!(laTikTok||laDrive||laLocal)&&<span className="text-[11px] text-amber-700">chưa nhận ra: cần link thư mục Drive, đường dẫn D:\\… hoặc @kenh</span>}</div>}
    {cho.length>0&&<div className="mt-2 text-[11px]"><span className="font-semibold text-ink-muted">Trạm đang chờ tải:</span> {cho.map(c=><Pill key={c.kenh} cls="bg-sky-100 text-sky-800 ml-1">{c.kenh} · {c.toi_da} video{tramSong?'':' · Trạm im'}</Pill>)}</div>}
    {kho.length===0?<div className="text-xs text-ink-muted mt-2">Chưa có video thành phẩm nào trong kho.</div>:<div className="mt-2 overflow-x-auto"><table className="w-full text-xs min-w-[520px]"><thead><tr className="text-left text-ink-muted"><th className="px-2 py-1">Video</th><th className="px-2 py-1">Nguồn</th><th className="px-2 py-1 text-right">Dài</th><th className="px-2 py-1 text-right">Shot</th><th className="px-2 py-1 text-right">Nhịp</th><th className="px-2 py-1 text-right">Khớp gốc</th><th className="px-2 py-1 text-right">Lượt xem</th><th className="px-2 py-1 text-right">Doanh thu</th><th className="px-2 py-1">Ngày</th></tr></thead>
      <tbody>{kho.map(t=><tr key={t.id} className="border-t border-line/60"><td className="px-2 py-1 font-semibold text-ink truncate max-w-[200px]" title={t.thu_muc}>{t.link?<a className="underline" href={t.link} target="_blank" rel="noreferrer">{t.ten}</a>:t.ten}</td><td className="px-2 py-1">{nguonTen[t.nguon]||t.nguon}{t.kenh?' · '+t.kenh:''}</td><td className="px-2 py-1 text-right tabular-nums">{t.dai}s</td><td className="px-2 py-1 text-right tabular-nums">{t.so_shot}</td><td className="px-2 py-1 text-right tabular-nums">{t.nhip}s</td><td className="px-2 py-1 text-right tabular-nums">{t.co_goc||0}</td><td className="px-2 py-1 text-right tabular-nums">{t.luot_xem==null?<span className="text-slate-400">—</span>:t.luot_xem.toLocaleString('vi-VN')}</td><td className="px-2 py-1 text-right tabular-nums">{t.doanh_thu==null?<span className="text-slate-400">—</span>:('$'+Math.round(t.doanh_thu).toLocaleString('en-US'))}</td><td className="px-2 py-1 text-ink-muted" title={t.kich_ban||''}>{t.ngay_dang||fmtDate(t.created_at)}{t.kich_ban&&<span className="ml-1" title={t.kich_ban}>🗣</span>}</td></tr>)}</tbody></table></div>}
    <div className="text-[11px] text-ink-muted mt-2">Kho: {kho.length} video · {kho.reduce((x,t)=>x+(t.so_shot||0),0)} shot · {kho.filter(t=>t.luot_xem!=null).length} có lượt xem · {kho.filter(t=>t.doanh_thu!=null).length} có doanh thu · {kho.filter(t=>t.kich_ban).length} có lời thoại (🗣 = kịch bản mẫu cho AI viết & huấn luyện ngôn ngữ). Đủ mẫu thì bấm 🎓 Huấn luyện <i>Ghép shot</i> / <i>Chọn đoạn</i> ở thẻ trên.</div>
    <Kalodata a={a} duoc={duoc} tramSong={tramSong}/>
  </Card>;
}
// ADR-011 — KALODATA: ngành hàng → Trạm (hồ sơ kalodata) quét bảng video bán chạy theo doanh thu → tải video bằng tiktok_cn → máy dựng học ghép + lời thoại = kịch bản bán tốt
function Kalodata({a, duoc, tramSong}){
  const { goi, notify } = useApp(); const kd=a.kalodata||{}; const [nganh,setNganh]=useState((kd.nganh||[]).join(', ')); const [topN,setTopN]=useState(kd.top_n||10); const [tuDong,setTuDong]=useState(kd.tu_dong!==false); const [busy,setBusy]=useState(false);
  useEffect(()=>{ setNganh((kd.nganh||[]).join(', ')); setTopN(kd.top_n||10); setTuDong(kd.tu_dong!==false); },[JSON.stringify(kd.nganh),kd.top_n,kd.tu_dong]);
  const luu=async()=>{ setBusy(true); const r=await goi('/kalodata',{method:'PUT',body:{nganh, top_n:topN, tu_dong:tuDong}}); setBusy(false); if(r.ok) notify('Đã lưu cấu hình Kalodata'); else notify(r.msg,'err'); };
  const quet=async()=>{ setBusy(true); const r=await goi('/kalodata/quet',{method:'POST'}); setBusy(false); if(r.ok) notify(r.trung?'Trạm đã có lệnh quét':'Đã xin Trạm quét Kalodata — video tìm được sẽ tự tải và học'); else notify(r.msg,'err'); };
  const kq=kd.ket_qua_cuoi;
  return <div className="mt-3 rounded-xl border border-line p-2">
    <div className="font-semibold text-ink text-xs">📈 Kalodata — video TikTok Shop bán chạy theo ngành (Trạm cần tài khoản Kalodata đã đăng nhập: Trạm › Tài khoản › Kalodata)</div>
    <div className="text-[11px] text-ink-muted mt-0.5">Mỗi tuần (hoặc bấm Quét ngay) Trạm mở Kalodata › Video, lọc từng ngành hàng, lấy top N theo doanh thu → tải video → máy dựng cắt shot và nghe lời. Doanh thu thay lượt xem làm trọng số; lời thoại thành kịch bản tham chiếu cho AI viết và tập huấn luyện ngôn ngữ mở.</div>
    {duoc&&<div className="flex gap-2 flex-wrap items-center mt-2"><Input className="!py-1.5 text-xs flex-1 min-w-[220px]" placeholder="ngành hàng, cách nhau dấu phẩy — vd: Keo, Vật liệu xây dựng, Chất tẩy rửa" value={nganh} onChange={e=>setNganh(e.target.value)}/><span className="text-[11px] text-ink-muted">top</span><Input type="number" min="3" max="50" className="!py-1.5 text-xs !w-16" value={topN} onChange={e=>setTopN(+e.target.value||10)}/>
      <label className="text-[11px] text-ink-muted flex items-center gap-1"><input type="checkbox" checked={tuDong} onChange={e=>setTuDong(e.target.checked)}/> tự quét hằng tuần</label>
      <Btn variant="soft" className="!py-1.5 text-xs" onClick={luu} disabled={busy}>Lưu</Btn><Btn variant="brand" className="!py-1.5 text-xs" onClick={quet} disabled={busy||!(kd.nganh||[]).length} title={!tramSong?'Trạm văn phòng đang im':''}>📈 Quét ngay</Btn></div>}
    <div className="text-[11px] text-ink-muted mt-1">{(kd.nganh||[]).length?('Ngành: '+kd.nganh.join(' · ')+' · top '+(kd.top_n||10)):'Chưa đặt ngành hàng.'}{kd.lan_cuoi?(' · quét lần cuối '+fmtDate(kd.lan_cuoi)):''}{kq?(' · lần cuối: '+kq.nganh+' → '+kq.so+' video'+(kq.loi?(' · lỗi: '+kq.loi):'')):''}{kd.quet_ngay?' · đang chờ Trạm quét':''}</div>
  </div>;
}
function ChiPhiMoHinh({a}){
  const ds=a.chi_phi||[]; const tong=ds.reduce((s,x)=>s+(x.usd||0),0); const tk=a.tiet_kiem||{usd:0,luot:0,chi_tiet:[]};
  return <div className="space-y-3"><div className="grid sm:grid-cols-3 gap-2"><Card pad="p-3"><div className="text-[11px] text-ink-muted">Đã trả (API)</div><div className="font-display text-xl font-extrabold text-ink">{tong.toFixed(2)} USD</div></Card><Card pad="p-3"><div className="text-[11px] text-ink-muted">Mô hình mở làm thay (MỞ)</div><div className="font-display text-xl font-extrabold text-emerald-700">−{tk.usd.toFixed(2)} USD</div><div className="text-[11px] text-ink-muted">{tk.luot} lượt · tính theo giá mô hình chính của từng tính năng</div></Card><Card pad="p-3"><div className="text-[11px] text-ink-muted">Theo tính năng</div><div className="text-[11px]">{(tk.chi_tiet||[]).map(x=><div key={x.tinh_nang}>{x.tinh_nang}: {x.luot} lượt ≈ {x.usd_tuong_duong} USD</div>)}{!(tk.chi_tiet||[]).length&&<span className="text-ink-muted">chưa có tính năng nào ở mức MỞ</span>}</div></Card></div>
  <Card pad=""><div className="px-3 py-2 border-b border-line"><SectionTitle>Chi phí tháng này theo mô hình — {tong.toFixed(2)} USD</SectionTitle></div>
    {ds.length===0?<Empty>Chưa có lượt gọi nào tháng này.</Empty>:<table className="w-full text-xs"><thead><tr className="text-left text-ink-muted"><th className="px-3 py-1">Mô hình</th><th className="px-3 py-1">Nhà cung cấp</th><th className="px-3 py-1">Lượt</th><th className="px-3 py-1">Token vào / ra</th><th className="px-3 py-1">USD</th></tr></thead><tbody>{ds.map((x,i)=><tr key={i} className="border-t border-line/60"><td className="px-3 py-1 font-semibold text-ink">{x.mo_hinh}</td><td className="px-3 py-1">{x.provider}</td><td className="px-3 py-1">{x.so_lan}</td><td className="px-3 py-1">{fmtSo(x.vao)} / {fmtSo(x.ra)}</td><td className="px-3 py-1">{(x.usd||0).toFixed(3)}{x.provider==='may_ghep'&&<span className="text-emerald-700"> (mở, 0 đ)</span>}</td></tr>)}</tbody></table>}
    <div className="px-3 py-2 text-[11px] text-ink-muted border-t border-line">Lượt "may_ghep" là mô hình mở chạy bóng hoặc tự làm — không tốn tiền. Khi một tính năng gạt MỞ, chi phí API của nó về 0.</div></Card></div>;
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
  const [trend,setTrend]=useState({tu_khoa:(mc.trend.tu_khoa_nganh||[]).join('\n'), chong_trung_ngay:mc.trend.chong_trung_ngay, nguong_tu_duyet:mc.trend.nguong_tu_duyet}); const [kh,setKh]=useState({...mc.ke_hoach}); const [nd,setNd]=useState({...mc.noi_dung}); const [dv,setDv]=useState({...(mc.dung_video||{})}); const [sd,setSd]=useState({...(mc.seeding||{})});
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
    <Card><SectionTitle className="mb-2">Seeding hội nhóm (B13–B17)</SectionTitle>
      <SoF o={sd} set={setSd} k="binh_luan_moi_bai" l="Bình luận dẫn dắt mỗi bài (tài khoản khác)" h="0 = tắt"/>
      <SoF o={sd} set={setSd} k="binh_luan_tre_min" l="Bình luận sau đăng ít nhất (phút)"/>
      <SoF o={sd} set={setSd} k="binh_luan_tre_max" l="Bình luận sau đăng nhiều nhất (phút)"/>
      <SoF o={sd} set={setSd} k="nuoi_moi_ngay" l="Lượt nuôi mỗi tài khoản mỗi ngày" h="0 = tắt"/>
      <SoF o={sd} set={setSd} k="nuoi_phut" l="Mỗi lượt nuôi xem bao nhiêu phút"/>
      <SoF o={sd} set={setSd} k="nuoi_tim" l="Thả bao nhiêu tim mỗi lượt"/>
      <SoF o={sd} set={setSd} k="go_bai_ha_nhip" l="Nhóm bị gỡ bao nhiêu bài/30 ngày thì máy tự hạ nhịp"/>
      <SoF o={sd} set={setSd} k="checkpoint_ha_nhip" l="Tài khoản gặp checkpoint bao nhiêu lần/30 ngày thì tự hạ nhịp"/>
      <label className="flex items-center gap-2 text-sm mb-3"><Toggle on={sd.nhip_tu_chinh!==false} disabled={!duoc} onChange={v=>setSd({...sd,nhip_tu_chinh:v})}/> Máy tự hạ nhịp khi có dấu hiệu xấu (tăng luôn qua G4)</label>
      {duoc && <Btn variant="brand" onClick={()=>luu('seeding',{binh_luan_moi_bai:sd.binh_luan_moi_bai, binh_luan_tre_min:sd.binh_luan_tre_min, binh_luan_tre_max:sd.binh_luan_tre_max, nuoi_moi_ngay:sd.nuoi_moi_ngay, nuoi_phut:sd.nuoi_phut, nuoi_tim:sd.nuoi_tim, go_bai_ha_nhip:sd.go_bai_ha_nhip, checkpoint_ha_nhip:sd.checkpoint_ha_nhip, nhip_tu_chinh:sd.nhip_tu_chinh!==false})}>💾 Lưu</Btn>}</Card>
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
