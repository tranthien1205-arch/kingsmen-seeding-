// ===== MÀN 3 — DÒNG CHẢY NỘI DUNG (đợt 3, ADR-003). Đợt 1: khung 6 giai đoạn; có mô phỏng để duyệt thiết kế =====
const GIAI_DOAN = [['Y_TUONG','Ý tưởng'],['SOAN','Soạn'],['CHO_DUYET','Chờ duyệt (G3)'],['SAN_XUAT','Sản xuất'],['DA_DANG','Đã đăng'],['DA_DO','Đã đo']];
function DongChayNoiDung(){
  const { db, notify } = useApp(); const buoc=db.buoc||[]; const bao=mpBao(notify,3);
  const cua=ma=>buoc.find(b=>b.ma===ma)||{};
  const cot=[ {gd:GIAI_DOAN[0], b:['B1','B3']}, {gd:GIAI_DOAN[1], b:['B4']}, {gd:GIAI_DOAN[2], b:['B5']}, {gd:GIAI_DOAN[3], b:['B6','B7','B8']}, {gd:GIAI_DOAN[4], b:['B9']}, {gd:GIAI_DOAN[5], b:['B10']} ];
  const [mo,setMo]=useState(null);
  const the=db.mo_phong?MP.the:[];
  return <div className="space-y-4">
    <PageHeader title="🔁 Dòng chảy nội dung" sub="Một kanban tự chạy qua 6 giai đoạn. Mỗi thẻ mở đúng việc: soạn, duyệt (G3), dựng, đăng." right={db.mo_phong && <><Btn variant="ghost" onClick={bao}>🎬 Lọc / Dựng video</Btn><Btn variant="brand" onClick={bao}>＋ Ý tưởng ngoài kế hoạch</Btn></>}/>
    {db.mo_phong && <Card pad="p-3"><SectionTitle className="mb-1">🛂 Hàng đợi duyệt — cổng G3 (máy chấm sẵn, người quyết)</SectionTitle>{MP.duyet.map((d,i)=><div key={i} className="flex items-center gap-3 py-1.5 border-t border-line text-xs"><div className="min-w-0 flex-1"><div className="font-semibold text-ink">{d.ten}</div><div className="text-[10px] text-ink-muted">Máy: {d.ai} · gửi bởi {d.nguoi} · chờ {d.cho}</div></div><Btn variant="ok" className="!py-1 !px-2 text-[11px]" onClick={bao}>Duyệt</Btn><Btn variant="ghost" className="!py-1 !px-2 text-[11px]" onClick={bao}>Trả lại</Btn></div>)}</Card>}
    <div className="flex gap-2 overflow-x-auto pb-2 snap-x">{cot.map(c=>{ const ds=the.filter(t=>t.gd===c.gd[0]); return <div key={c.gd[0]} className="bg-slate-50 rounded-xl p-2 w-[70vw] max-w-[230px] sm:w-auto sm:flex-1 shrink-0 snap-start">
      <div className="text-[11px] font-bold text-ink-muted mb-2 flex justify-between"><span>{c.gd[1]}</span><span>{ds.length}</span></div>
      <div className="flex flex-wrap gap-1 mb-2">{c.b.map(ma=>{ const x=cua(ma); return <Pill key={ma} cls={MUC_CLS[x.nguoi_thuc_hien]||''} className="!text-[9px]">{ma} {MUC_LABEL[x.nguoi_thuc_hien]||''}</Pill>; })}</div>
      {ds.map(t=><div key={t.id} onClick={()=>setMo(t)} className="bg-white rounded-lg border border-line p-2 mb-1.5 cursor-pointer hover:border-brand"><div className="text-[11px] font-semibold text-ink">{t.dd} {t.ten}</div><div className="text-[10px] text-ink-muted mt-0.5">{t.pillar} · đăng {t.ngay}</div><div className="text-[10px] text-brand-dark mt-0.5">🤖 {t.ai}</div></div>)}
      {ds.length===0 && <div className="text-[10px] text-slate-400">0 thẻ</div>}</div>; })}</div>
    {!db.mo_phong && <Callout tone="note"><b>Đợt 3 (ADR-003):</b> mục nội dung từ kế hoạch chảy vào đây; Studio 4 định dạng mở dạng popup; hàng đợi duyệt người gửi ≠ người duyệt; Lọc/Dựng video popup; đăng tự động qua API/n8n. Đồng thời bật <b>chế độ học</b>: mỗi bài người soạn có một bản nháp bóng do máy viết ngầm để chấm điểm sẵn sàng B4/B5. Admin bật <b>Máy › Mô phỏng</b> để xem trước màn này với dữ liệu giả.</Callout>}
    {mo && <Modal open onClose={()=>setMo(null)} title={mo.dd+' '+mo.ten} wide>
      <div className="grid sm:grid-cols-[1fr_220px] gap-3">
        <div><div className="text-[11px] text-ink-muted mb-2">Pillar {mo.pillar} · giai đoạn {(GIAI_DOAN.find(g=>g[0]===mo.gd)||[])[1]} · 🤖 {mo.ai}</div>
          <div className="rounded-xl border border-line p-3 text-sm text-ink space-y-2"><div><b>Hook:</b> Sau một mùa mưa, ron gạch nhà bạn có đang ngả vàng?</div><div><b>Cảnh 1 (cận):</b> Ron gạch ố vàng ở nhà vệ sinh — [điền footage]</div><div><b>Cảnh 2 (trung):</b> So sánh mẫu G7000 sau 2 năm ngoài trời (thông số: 30 năm bền màu — theo hồ sơ sản phẩm)</div><div><b>CTA:</b> Inbox để nhận bảng màu.</div></div>
          <div className="text-[10px] text-ink-muted mt-2">Vì sao máy viết vậy: pillar Problems · framework "Vấn đề → nguyên nhân → giải pháp" · dùng bài học "video cận cảnh vết ố kéo 2× xem".</div></div>
        <div className="space-y-2"><Btn variant="brand" className="w-full" onClick={bao}>✍️ Mở Studio</Btn><Btn variant="ghost" className="w-full" onClick={bao}>📤 Gửi duyệt</Btn><Btn variant="ghost" className="w-full" onClick={bao}>🎬 Dựng video</Btn><Btn variant="ghost" className="w-full" onClick={bao}>🗓️ Đổi ngày đăng</Btn><div className="text-[10px] text-ink-muted">Lịch sử: máy tạo từ trend 03/10 · Ngọc sửa hook 05/10 · máy chấm 86/100 06/10</div></div>
      </div></Modal>}
  </div>;
}
