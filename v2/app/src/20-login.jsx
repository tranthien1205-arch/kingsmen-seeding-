// ===== ĐĂNG NHẬP (Admin/Trưởng MKT cấp tài khoản — không tự đăng ký) =====
function Login(){
  const { login } = useApp();
  const [email,setEmail]=useState(''); const [pw,setPw]=useState(''); const [err,setErr]=useState(''); const [busy,setBusy]=useState(false);
  const doLogin=async()=>{ setErr(''); setBusy(true); const r=await login(email,pw); setBusy(false); if(!r.ok) setErr(r.msg); };
  return <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-ink via-ink-soft to-brand-dark">
    <div className="w-full max-w-sm bg-white rounded-3xl shadow-lift p-6">
      <div className="flex items-center gap-3 mb-5"><div className="w-11 h-11 rounded-2xl bg-brand text-white grid place-items-center font-display font-black text-lg">K</div>
        <div><div className="font-display font-extrabold text-ink leading-tight">Kingsmen Content OS</div><div className="text-[11px] text-ink-muted">Phòng marketing tự vận hành</div></div></div>
      <form onSubmit={e=>{e.preventDefault(); doLogin();}}>
        <Field label="Email"><Input type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} placeholder="ten@kingsmen.vn"/></Field>
        <Field label="Mật khẩu"><PasswordInput autoComplete="current-password" value={pw} onChange={e=>setPw(e.target.value)}/></Field>
        {err && <div className={CALLOUT.danger+' mb-3'}>{err}</div>}
        <Btn type="submit" variant="brand" className="w-full" disabled={busy||!email||!pw}>{busy?'Đang vào…':'Đăng nhập'}</Btn>
      </form>
      <div className="text-[11px] text-ink-muted mt-4 leading-relaxed">Chưa có tài khoản? Nhờ Admin hoặc Trưởng MKT tạo trong màn <b>Máy › Người dùng</b>.</div>
    </div></div>;
}
// Bắt đổi mật khẩu lần đầu (tài khoản do người khác cấp)
function DoiMatKhauLanDau(){
  const { goi, notify } = useApp(); const [pw,setPw]=useState(''); const [pw2,setPw2]=useState(''); const [busy,setBusy]=useState(false);
  const luu=async()=>{ if(pw.length<6) return notify('Mật khẩu tối thiểu 6 ký tự','err'); if(pw!==pw2) return notify('Hai lần gõ không khớp','err'); setBusy(true); const r=await goi('/me',{method:'PATCH',body:{password:pw}}); setBusy(false); if(r.ok) notify('Đã đổi mật khẩu'); else notify(r.msg,'err'); };
  return <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50"><div className="w-full max-w-sm bg-white rounded-3xl shadow-lift p-6">
    <div className="font-display font-bold text-ink mb-1">Đặt mật khẩu của bạn</div><div className="text-[11px] text-ink-muted mb-4">Tài khoản này được cấp sẵn mật khẩu tạm. Đổi ngay để chỉ mình bạn biết.</div>
    <Field label="Mật khẩu mới"><PasswordInput value={pw} onChange={e=>setPw(e.target.value)}/></Field>
    <Field label="Gõ lại"><PasswordInput value={pw2} onChange={e=>setPw2(e.target.value)}/></Field>
    <Btn variant="brand" className="w-full" onClick={luu} disabled={busy}>Lưu</Btn></div></div>;
}
