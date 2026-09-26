// ===== BỘ GIAO DIỆN CHUNG (nhận diện Kingsmen: teal đậm + cyan, Montserrat/Maven Pro) =====
function Toast({toast}){
  const c = toast.type==='err' ? 'bg-rose-600' : toast.type==='warn' ? 'bg-amber-500' : 'bg-emerald-600';
  return <div className={"fixed bottom-20 sm:bottom-5 left-1/2 -translate-x-1/2 z-50 text-white px-4 py-2.5 rounded-xl shadow-lift text-sm max-w-[90%] font-medium "+c}>{toast.msg}</div>;
}
function Btn({children, onClick, variant='primary', className='', type='button', disabled, title}){
  const v = { primary:'bg-ink text-white hover:bg-ink-soft', brand:'bg-brand text-white hover:bg-brand-dark shadow-brand', ghost:'bg-white border border-line text-ink hover:border-brand hover:text-brand-dark',
    danger:'bg-rose-600 text-white hover:bg-rose-700', ok:'bg-emerald-600 text-white hover:bg-emerald-700', soft:'bg-brand-bg text-brand-dark hover:bg-brand-light/60' }[variant];
  return <button type={type} title={title} disabled={disabled} onClick={onClick} className={"px-3.5 py-2.5 rounded-xl text-sm font-semibold transition active:scale-[.98] disabled:opacity-40 disabled:cursor-not-allowed "+v+" "+className}>{children}</button>;
}
function Field({label, children, hint, required, className=''}){
  return <label className={"block mb-3 "+className}>
    <div className="text-[13px] font-semibold text-ink mb-1.5">{label}{required && <span className="text-rose-500"> *</span>}</div>
    {children}{hint && <div className="text-[11px] text-ink-muted mt-1">{hint}</div>}
  </label>;
}
const inputCls = "w-full px-3.5 py-2.5 rounded-xl border border-line text-sm text-ink placeholder:text-slate-500 focus:outline-none focus:ring-4 focus:ring-brand/15 focus:border-brand bg-white transition disabled:bg-slate-50";
function Input(p){ return <input {...p} className={inputCls+" "+(p.className||'')}/>; }
function PasswordInput({className, ...p}){
  const [hien,setHien]=useState(false);
  return <div className="relative"><input {...p} type={hien?'text':'password'} className={inputCls+" pr-11 "+(className||'')}/>
    <button type="button" tabIndex={-1} onMouseDown={e=>e.preventDefault()} onClick={()=>setHien(v=>!v)} className="absolute right-1 top-1/2 -translate-y-1/2 px-2.5 py-1.5 rounded-lg text-base text-slate-500 hover:text-ink">{hien?'🙈':'👁️'}</button></div>;
}
function Textarea(p){ return <textarea {...p} className={inputCls+" "+(p.className||'')}/>; }
function Select({children, ...p}){ return <select {...p} className={inputCls+" "+(p.className||'')}>{children}</select>; }
function Modal({open, onClose, title, children, wide}){
  if(!open) return null;
  return <div className="fixed inset-0 z-40 bg-ink/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
    <div onClick={e=>e.stopPropagation()} className={"bg-white w-full rounded-t-3xl sm:rounded-2xl shadow-lift max-h-[92vh] overflow-auto "+(wide?'sm:max-w-3xl':'sm:max-w-lg')}>
      <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-line px-4 py-3 flex items-center justify-between z-10">
        <h3 className="font-display font-bold text-ink">{title}</h3>
        <button onClick={onClose} className="w-8 h-8 rounded-lg text-ink-muted hover:bg-slate-100 text-xl leading-none">×</button>
      </div><div className="p-4">{children}</div></div></div>;
}
function Empty({children}){ return <div className="text-center text-ink-muted text-sm py-10">{children}</div>; }
function Tabs({tabs, active, onChange, size, className=''}){
  const sm = size==='sm';
  return <div className={"flex gap-1 bg-slate-100 p-1 rounded-xl overflow-x-auto no-scrollbar "+(sm?'w-fit max-w-full ':'')+className}>
    {tabs.map(t=><button key={t.key} onClick={()=>onChange(t.key)} className={(sm?'px-3 py-1 text-xs ':'px-3 py-1.5 text-sm ')+"rounded-lg font-semibold whitespace-nowrap transition "+(active===t.key?'bg-white shadow-card text-ink':'text-ink-muted hover:text-ink')}>
      {t.label}{t.count!=null && <span className={"ml-1.5 px-1.5 rounded-full "+(sm?'text-[11px] ':'text-xs ')+(active===t.key?'bg-brand text-white':'bg-slate-200 text-ink-muted')}>{t.count}</span>}</button>)}</div>;
}
function Pill({cls='bg-slate-100 text-ink-muted', children, className=''}){ return <span className={"inline-flex items-center rounded-full font-semibold whitespace-nowrap text-[11px] px-1.5 py-0.5 "+cls+" "+className}>{children}</span>; }
function Card({children, className='', pad='p-4', onClick}){ return <div onClick={onClick} className={"bg-white rounded-2xl border border-line shadow-card "+pad+" "+className}>{children}</div>; }
function SectionTitle({children, className=''}){ return <div className={"text-sm font-semibold text-ink "+className}>{children}</div>; }
const CALLOUT = { warn:'rounded-2xl border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-800 leading-relaxed', danger:'rounded-2xl border border-rose-200 bg-rose-50 p-3 text-[11px] text-rose-700 leading-relaxed',
  ok:'rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-[11px] text-emerald-800 leading-relaxed', info:'rounded-2xl border border-brand/30 bg-brand/10 p-3 text-[11px] text-brand-dark leading-relaxed', note:'bg-white rounded-2xl border border-line shadow-card p-3 text-[11px] text-ink-muted leading-relaxed' };
function Callout({tone='info', children, className=''}){ return <div className={CALLOUT[tone]+' '+className}>{children}</div>; }
function LinkBtn({tone='edit', onClick, children, className='', title, disabled}){
  const c={ edit:'text-xs font-medium text-brand-dark hover:underline', danger:'text-xs font-medium text-rose-600 hover:underline', back:'text-sm text-ink-muted hover:text-ink hover:underline' }[tone];
  return <button type="button" title={title} disabled={disabled} onClick={onClick} className={c+' disabled:opacity-40 '+className}>{children}</button>;
}
function PageHeader({title, right, sub, className=''}){
  return <div className={className}><div className="flex items-center justify-between flex-wrap gap-2">
    <h2 className="font-display text-lg font-bold text-ink">{title}</h2>{right && <div className="flex gap-2 flex-wrap items-center">{right}</div>}</div>
    {sub && <div className="text-xs text-ink-muted mt-1">{sub}</div>}</div>;
}
function Toggle({on, onChange, disabled}){
  return <button type="button" disabled={disabled} onClick={()=>onChange(!on)} className={"w-11 h-6 rounded-full transition relative disabled:opacity-40 "+(on?'bg-brand':'bg-slate-300')}>
    <span className={"absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all "+(on?'left-[22px]':'left-0.5')}></span></button>;
}
function Thanh({pct, cls}){ return <div className="h-2 rounded-full bg-slate-100 overflow-hidden"><div className={"h-full "+(cls||'bg-brand')} style={{width:Math.max(0,Math.min(100,pct||0))+'%'}}/></div>; }
// Lưới lỗi: một màn hỏng không được kéo sập cả app
class ManAnToan extends React.Component{
  constructor(p){ super(p); this.state={loi:null}; }
  static getDerivedStateFromError(e){ return {loi:e}; }
  componentDidCatch(e){ console.error(e); }
  render(){ if(this.state.loi) return <div className="p-4"><Callout tone="danger"><b>Màn này gặp lỗi:</b> {String(this.state.loi.message||this.state.loi)} <button onClick={()=>this.setState({loi:null})} className="underline ml-2">Thử lại</button></Callout></div>; return this.props.children; }
}
