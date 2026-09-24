// ===== KHUNG 5 MÀN (bản vẽ §5). Sidebar desktop · thanh dưới điện thoại =====
const MAN = [
  { key:'viec',      ten:'Việc của tôi',          ngan:'Việc',      icon:'✅', ai:()=>true },
  { key:'chienluoc', ten:'Chiến lược & Kế hoạch', ngan:'Chiến lược',icon:'🎯', ai:laXemMkt },
  { key:'dongchay',  ten:'Dòng chảy nội dung',    ngan:'Nội dung',  icon:'🔁', ai:laXemMkt },
  { key:'ketqua',    ten:'Kết quả & Báo cáo',     ngan:'Kết quả',   icon:'📈', ai:laXemMkt },
  { key:'seeding',   ten:'Seeding hội nhóm',      ngan:'Seeding',   icon:'📣', ai:laXemMkt },
  { key:'daymay',    ten:'Dạy máy',               ngan:'Dạy máy',   icon:'🎓', ai:laXemMkt },
  { key:'may',       ten:'Máy',                   ngan:'Máy',       icon:'🤖', ai:laXemMkt },
];
function Shell(){
  const { me, logout, db } = useApp();
  const mans = MAN.filter(m=>m.ai(me));
  const [page,setPage]=useState(mans[0].key);
  useEffect(()=>{ window.__go=setPage; return ()=>{ if(window.__go===setPage) delete window.__go; }; },[]);
  const [hoSo,setHoSo]=useState(false);
  const soViec=(db.cong_viec||[]).length;
  const render=()=>{ switch(page){
    case 'viec': return <ViecCuaToi go={setPage}/>;
    case 'chienluoc': return <ChienLuocKeHoach/>;
    case 'dongchay': return <DongChayNoiDung/>;
    case 'ketqua': return <KetQuaBaoCao/>;
    case 'seeding': return <SeedingHoiNhom/>;
    case 'daymay': return <DayMay go={setPage}/>;
    case 'may': return <May/>;
    default: return <Empty>Chưa có màn này</Empty>; } };
  const NavBtn=({m, doc})=><button onClick={()=>setPage(m.key)} className={(doc?'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm ':'flex-1 flex flex-col items-center py-1.5 text-[10px] ')+"font-semibold transition "+(page===m.key?(doc?'bg-brand text-white shadow-brand':'text-brand'):(doc?'text-white/70 hover:bg-white/10 hover:text-white':'text-ink-muted'))}>
    <span className={doc?'text-base':'text-lg leading-none'}>{m.icon}</span><span className={doc?'flex-1 text-left':''}>{doc?m.ten:m.ngan}</span>
    {m.key==='viec'&&soViec>0 && <span className={"rounded-full px-1.5 text-[10px] "+(page===m.key&&doc?'bg-white text-brand':'bg-rose-500 text-white')}>{soViec}</span>}</button>;
  return <div className="min-h-screen sm:flex">
    <aside className="hidden sm:flex sm:flex-col w-60 shrink-0 bg-ink text-white p-4 sticky top-0 h-screen">
      <div className="flex items-center gap-2 mb-6"><div className="w-9 h-9 rounded-xl bg-brand grid place-items-center font-display font-black">K</div><div><div className="font-display font-extrabold leading-tight">Kingsmen</div><div className="text-[10px] text-white/60">Content OS · đợt {db.dot}</div></div></div>
      <nav className="space-y-1 flex-1">{mans.map(m=><NavBtn key={m.key} m={m} doc/>)}</nav>
      <button onClick={()=>setHoSo(true)} className="flex items-center gap-2 p-2 rounded-xl hover:bg-white/10 text-left"><div className="w-8 h-8 rounded-full bg-brand-light/30 grid place-items-center text-sm font-bold">{(me.ho_ten||'?').slice(0,1)}</div><div className="min-w-0"><div className="text-sm font-semibold truncate">{me.ho_ten}</div><div className="text-[10px] text-white/60">{ROLE_LABEL[me.vai_tro]||me.vai_tro}</div></div></button>
    </aside>
    <div className="flex-1 min-w-0">
      <header className="sm:hidden sticky top-0 z-30 bg-ink text-white px-4 py-3 flex items-center justify-between"><div className="font-display font-extrabold">Kingsmen Content OS</div><button onClick={()=>setHoSo(true)} className="w-8 h-8 rounded-full bg-brand-light/30 grid place-items-center text-sm font-bold">{(me.ho_ten||'?').slice(0,1)}</button></header>
      <main className="p-4 sm:p-6 pb-24 sm:pb-6 max-w-6xl mx-auto space-y-3">{db.mo_phong && <MoPhongBanner/>}<ManAnToan key={page}>{render()}</ManAnToan></main>
      <nav className="sm:hidden fixed bottom-0 inset-x-0 bg-white border-t border-line flex px-1 pb-[env(safe-area-inset-bottom)] z-30">{mans.map(m=><NavBtn key={m.key} m={m}/>)}</nav>
    </div>
    <HoSoModal open={hoSo} onClose={()=>setHoSo(false)} onLogout={logout}/>
  </div>;
}
function HoSoModal({open,onClose,onLogout}){
  const { me, db, goi, notify } = useApp(); const [ten,setTen]=useState(me.ho_ten); const [pw,setPw]=useState(''); const [ma,setMa]=useState(''); const [busy,setBusy]=useState(false);
  useEffect(()=>{ setTen(me.ho_ten); },[me.ho_ten]);
  const luu=async()=>{ const r=await goi('/me',{method:'PATCH',body:{ho_ten:ten, ...(pw?{password:pw}:{})}}); if(r.ok){ notify('Đã lưu'); setPw(''); onClose(); } else notify(r.msg,'err'); };
  const mayCuaToi=(db.may_ghep||[]).filter(m=>m.chu_user_id===me.id);
  const ghep=async()=>{ const t=prompt('Tên máy (VD: Laptop Ngọc):', 'Máy của '+me.ho_ten); if(t===null) return; setBusy(true); const r=await goi('/may-ghep',{method:'POST',body:{ten:t}}); setBusy(false); if(r.ok){ setMa(r.ma_ghep); notify('Đã tạo mã ghép — dán vào máy con'); } else notify(r.msg,'err'); };
  const go=async(m)=>{ if(!confirm('Gỡ máy "'+m.ten+'"? Khoá hết hiệu lực, lệnh đang chờ bị huỷ.')) return; const r=await goi('/may-ghep/'+m.id,{method:'DELETE'}); if(r.ok) notify('Đã gỡ'); else notify(r.msg,'err'); };
  return <Modal open={open} onClose={onClose} title="Hồ sơ của tôi">
    <Field label="Tên hiển thị"><Input value={ten} onChange={e=>setTen(e.target.value)}/></Field>
    <Field label="Mật khẩu mới" hint="để trống nếu không đổi"><PasswordInput value={pw} onChange={e=>setPw(e.target.value)}/></Field>
    <div className="text-[11px] text-ink-muted mb-3">{me.email} · {ROLE_LABEL[me.vai_tro]}</div>
    {laStaff(me)&&<div className="rounded-xl border border-line p-3 mb-3">
      <div className="flex items-center justify-between gap-2"><div><div className="text-sm font-semibold text-ink">🖥 Máy dựng của tôi</div><div className="text-[11px] text-ink-muted">Máy tính của bạn dựng video nháp cho thẻ video đã duyệt. Mã dựng tải từ app, máy chỉ cần Node + ffmpeg.</div></div><Btn variant="soft" className="!py-1 !px-2 text-[11px]" onClick={ghep} disabled={busy}>＋ Kết nối máy này</Btn></div>
      {mayCuaToi.length>0&&<div className="mt-2 space-y-1">{mayCuaToi.map(m=><div key={m.id} className="flex items-center gap-2 text-xs"><span className={m.song?'text-emerald-600':'text-slate-400'}>{m.song?'🟢':'⚪'}</span><span className="font-semibold text-ink">{m.ten}</span><span className="text-ink-muted">{m.song?('đang bật · '+(m.than.may||'')+(m.than.ffmpeg===false?' · ⚠ chưa có ffmpeg':'')+(m.than.dang_lam?(' · đang: '+m.than.dang_lam):'')):(m.nhan_luc?('im từ '+fmtDate(m.nhan_luc)):'chưa nối lần nào')}</span><LinkBtn tone="danger" className="ml-auto" onClick={()=>go(m)}>Gỡ</LinkBtn></div>)}</div>}
      {ma&&<div className="mt-2"><div className="text-[11px] text-ink-muted mb-1">Mã ghép (hiện một lần). Trên máy: tải <a className="underline" href="/tools/may-dung/may-dung.mjs" download>may-dung.mjs</a> · <a className="underline" href="/tools/may-dung/BAT-DAU.bat" download>BAT-DAU.bat</a> · <a className="underline" href="/tools/may-dung/README.md" target="_blank" rel="noreferrer">hướng dẫn</a> vào một thư mục, chạy BAT-DAU.bat rồi dán mã:</div><Textarea rows="3" readOnly value={ma} onFocus={e=>e.target.select()} className="text-[11px] font-mono"/><LinkBtn onClick={()=>{ navigator.clipboard&&navigator.clipboard.writeText(ma); notify('Đã copy'); }}>📋 Copy mã ghép</LinkBtn></div>}
    </div>}
    <div className="flex gap-2 justify-between"><Btn variant="ghost" onClick={onLogout}>Đăng xuất</Btn><Btn variant="brand" onClick={luu}>Lưu</Btn></div>
  </Modal>;
}
