// ===== MÀN 4 — KẾT QUẢ & BÁO CÁO (đợt 4, ADR-004). Có mô phỏng để duyệt thiết kế =====
function KetQuaBaoCao(){
  const { db, notify } = useApp(); const bao=mpBao(notify,4); const mp=db.mo_phong; const k=MP.ket_qua;
  const muc=[['Trực tiếp','Sàn trả đúng mã của bài → quy đơn chắc chắn', mp?fmtSo(k.truc_tiep.dt)+' đ':'—', mp?k.truc_tiep.don+' đơn':''],['Gián tiếp','Có liên hệ nhưng không chắc 100%', mp?fmtSo(k.gian_tiep.dt)+' đ':'—', mp?k.gian_tiep.don+' đơn':''],['Không quy đơn','Chỉ số từ API kênh — không suy ra doanh thu', mp?fmtSo(k.kqd.xem)+' xem':'—', mp?(fmtSo(k.kqd.tt)+' tương tác · '+fmtSo(k.kqd.click)+' click'):'']];
  return <div className="space-y-4">
    <PageHeader title="📈 Kết quả & Báo cáo" sub="Ba mức tin cậy tách bạch (không cộng dồn) · báo cáo máy viết · đề xuất cải tiến (G4) · bài học." right={mp && <Btn variant="ghost" onClick={bao}>⬆ Import đối soát sàn</Btn>}/>
    <div className="grid sm:grid-cols-3 gap-2">{muc.map(([t,m,v,s])=><Card key={t} pad="p-3"><div className="text-sm font-semibold text-ink">{t}</div><div className="text-[11px] text-ink-muted mt-1">{m}</div><div className={"font-display text-xl font-extrabold mt-2 "+(mp?'text-ink':'text-slate-300')}>{v}</div><div className="text-[11px] text-ink-muted">{s}</div></Card>)}</div>
    {mp ? <>
      <Card><div className="flex items-center justify-between gap-2 flex-wrap"><SectionTitle>📄 Báo cáo tuần — máy viết · {MP.bao_cao.ky}</SectionTitle><Pill cls="bg-emerald-100 text-emerald-800">đã gửi: {MP.bao_cao.gui}</Pill></div>
        <div className="text-sm text-ink mt-2 leading-relaxed">{MP.bao_cao.nhan_dinh}</div>
        <div className="text-[11px] font-semibold text-ink-muted mt-3 mb-1">3 việc cần làm (máy đề nghị)</div><ul className="text-xs text-ink space-y-1">{MP.bao_cao.viec.map((v,i)=><li key={i}>• {v}</li>)}</ul></Card>
      <div><SectionTitle className="mb-2">💡 Đề xuất cải tiến — cổng G4 (máy đề xuất có bằng chứng, người duyệt → máy tự áp)</SectionTitle>
        <div className="grid lg:grid-cols-3 gap-2">{MP.de_xuat.map((d,i)=><Card key={i} pad="p-3"><Pill>{d.loai}</Pill><div className="text-sm font-semibold text-ink mt-1">{d.ten}</div><div className="text-[11px] text-ink-muted mt-1">Bằng chứng: {d.bang_chung}</div><div className="flex gap-1 mt-2"><Btn variant="ok" className="!py-1 !px-2 text-[11px]" onClick={bao}>Duyệt & áp dụng</Btn><Btn variant="ghost" className="!py-1 !px-2 text-[11px]" onClick={bao}>Bỏ</Btn></div></Card>)}</div></div>
    </> : <Callout tone="note"><b>Đợt 4 (ADR-004):</b> agent đo lường Graph/YouTube + n8n ingest (mỗi ngày một dòng phần tăng), đối soát sàn, báo cáo thứ Hai gửi app + Zalo + mail qua n8n, đề xuất cải tiến có bằng chứng ≥ min_mau chờ G4 duyệt. Admin bật <b>Máy › Mô phỏng</b> để xem trước.</Callout>}
  </div>;
}
