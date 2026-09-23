// ===== MÀN 1 — VIỆC CỦA TÔI: 4 cổng · việc được giao · máy hôm nay · bắt đầu =====
function ViecCuaToi({go}){
  const { db, me, goi, notify } = useApp();
  const cv=db.cong_viec||[]; const hn=todayYMD();
  const runsHomNay=(db.agent_run||[]).filter(r=>r.ngay===hn);
  const buoc=db.buoc||[]; const soAI=buoc.filter(b=>b.nguoi_thuc_hien!=='NGUOI').length;
  const cl=db.chien_luoc||{};
  // 4 cổng — đợt 1 mới có G1 (chiến lược); G2–G4 mở ở đợt 2–4
  const thangNay=db.hang_so.thang_nay; const khNay=(db.ke_hoach_thang||[]).find(k=>k.thang===thangNay); const ytMoi=(db.y_tuong||[]).filter(y=>y.trang_thai==='MOI').length;
  const daSuaCL=cl.updated_at&&cl.chot_at&&cl.updated_at>cl.chot_at;
  const cong=[
    { ma:'G1', ten:'Chốt định vị & chiến lược', tt: cl.phien_ban>0?('Phiên bản '+cl.phien_ban+(daSuaCL?' · đã sửa, chưa chốt lại':'')):(cl.dinh_vi?'Đã soạn, chưa chốt':'Chưa soạn'), page:'chienluoc', ok:cl.phien_ban>0&&!daSuaCL },
    { ma:'G2', ten:'Chốt kế hoạch tháng', tt: khNay?(khNay.trang_thai==='CHOT'?('Tháng '+thangNay+' đã chốt'):('Tháng '+thangNay+' — '+(khNay.nguon==='DE_XUAT'?'máy đề xuất':'đang soạn')+', CHỜ CHỐT')):('Tháng '+thangNay+' chưa lập'+(ytMoi?(' · '+ytMoi+' ý tưởng chờ chấm'):'')), page:'chienluoc', ok:khNay?khNay.trang_thai==='CHOT':false },
    { ma:'G3', ten:'Duyệt nội dung trước đăng', tt:(()=>{ const cho=(db.duyet||[]).filter(d=>d.trang_thai==='CHO'); const qua=cho.filter(d=>Date.now()-Date.parse(d.created_at)>24*36e5).length; const toi=cho.filter(d=>laGat(me)&&d.nguoi_gui_id!==me.id).length; return cho.length?(cho.length+' bài chờ duyệt'+(toi?(' · '+toi+' tới lượt bạn'):'')+(qua?(' · '+qua+' quá 24h'):'')):'Không có bài chờ'; })(), page:'dongchay', ok:(db.duyet||[]).filter(d=>d.trang_thai==='CHO').length===0 },
    { ma:'G4', ten:'Duyệt đề xuất cải tiến', tt:(()=>{ const n=(db.de_xuat||[]).filter(d=>d.trang_thai==='CHO').length; const bc=(db.bao_cao||[]).filter(b=>b.trang_thai==='NHAP').length; return (n?(n+' đề xuất chờ duyệt'):'Không có đề xuất chờ')+(bc?(' · '+bc+' báo cáo chờ gửi'):''); })(), page:'ketqua', ok:(db.de_xuat||[]).filter(d=>d.trang_thai==='CHO').length===0 },
  ];
  const xong=async(id,kq)=>{ const r=await goi('/cong-viec/'+id+'/'+kq,{method:'POST'}); if(r.ok) notify(kq==='xong'?'Đã xong':'Đã bỏ'); else notify(r.msg,'err'); };
  const thieuDanhMuc=laXemMkt(me) && ((db.san_pham||[]).length===0 || (db.pillars||[]).length===0 || (db.kenh||[]).length===0);
  return <div className="space-y-4">
    <PageHeader title={'Chào '+me.ho_ten} sub={'Hôm nay '+hn+' · '+(laXemMkt(me)?(soAI+'/'+buoc.length+' bước đang giao cho AI'):'')}/>
    {thieuDanhMuc && <Callout tone="warn"><b>Bắt đầu đợt 1:</b> nhập danh mục gốc để máy có dữ kiện thật — sản phẩm & thông số, claim cấm, pillar, framework, kênh. Vào <LinkBtn onClick={()=>go('chienluoc')}>Chiến lược & Kế hoạch</LinkBtn> để nhập tay, hoặc <LinkBtn onClick={()=>go('may')}>Máy › Nhập danh mục</LinkBtn> để nhập một lần từ app cũ.</Callout>}
    {laXemMkt(me) && <div>
      <SectionTitle className="mb-2">4 cổng của con người</SectionTitle>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">{cong.map(c=><Card key={c.ma} pad="p-3" className="cursor-pointer hover:border-brand" onClick={()=>go(c.page)}>
        <div className="flex items-center gap-2"><Pill cls={c.ok===true?'bg-emerald-100 text-emerald-800':c.ok===false?'bg-amber-100 text-amber-800':'bg-slate-100 text-ink-muted'}>{c.ma}</Pill><span className="text-sm font-semibold text-ink">{c.ten}</span></div>
        <div className="text-[11px] text-ink-muted mt-1">{c.tt}</div></Card>)}</div>
    </div>}
    <div>
      <SectionTitle className="mb-2">Việc được giao ({cv.length})</SectionTitle>
      {cv.length===0 ? <Card pad="p-3"><div className="text-sm text-ink-muted">Không có việc nào đang mở. Máy sẽ giao việc (dựng video, đăng tay, cắm lại token…) từ đợt 2 trở đi; người cũng giao được ở màn Máy.</div></Card>
      : <div className="space-y-2">{cv.map(v=><Card key={v.id} pad="p-3"><div className="flex items-start gap-3">
          <div className="min-w-0 flex-1"><div className="text-sm font-semibold text-ink">{v.tieu_de}</div>
            <div className="text-[11px] text-ink-muted mt-0.5">{v.loai} · giao cho {v.giao_cho_vai_tro?ROLE_LABEL[v.giao_cho_vai_tro]:'cá nhân'} · bởi {v.tao_boi}{v.han?(' · hạn '+v.han):''}{v.han&&v.han<hn&&<span className="text-rose-600 font-semibold"> · quá hạn</span>}</div>
            {v.ly_do && <div className="text-[11px] text-ink-soft mt-1">{v.ly_do}</div>}</div>
          <div className="flex gap-1 shrink-0"><Btn variant="ok" className="!py-1.5 !px-2.5 text-xs" onClick={()=>xong(v.id,'xong')}>Xong</Btn><Btn variant="ghost" className="!py-1.5 !px-2.5 text-xs" onClick={()=>xong(v.id,'bo')}>Bỏ</Btn></div>
        </div></Card>)}</div>}
    </div>
    {laXemMkt(me) && <div>
      <SectionTitle className="mb-2">Máy hôm nay</SectionTitle>
      <Card pad="p-3">{runsHomNay.length===0 ? <div className="text-sm text-ink-muted">Máy chưa chạy lượt nào hôm nay (giờ chạy: {((db.module_config||{}).may||{}).gio_chay}h). Xem <LinkBtn onClick={()=>go('may')}>màn Máy</LinkBtn>.</div>
        : <div className="divide-y divide-line">{runsHomNay.slice(0,6).map(r=><div key={r.id} className="py-1.5 flex gap-2 text-[12px]"><span>{r.ok?'✓':'✗'}</span><span className="text-slate-400 shrink-0">{String(r.at).slice(11,16)}</span><span className="font-semibold text-ink shrink-0">{r.agent}</span><span className="text-ink-muted min-w-0 flex-1 truncate">{r.tom_tat}</span>{r.thu&&<Pill>thử</Pill>}</div>)}</div>}</Card>
    </div>}
  </div>;
}
