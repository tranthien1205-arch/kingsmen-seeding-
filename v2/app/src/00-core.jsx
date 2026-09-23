// ===== LÕI: hằng số, AppProvider (gọi API thật, không có chế độ demo trong mã giao diện) =====
const { useState, useEffect, useMemo, useRef, useContext, createContext } = React;
const ROLES = { MARKETING:'MARKETING', SALES:'SALES', ADMIN:'ADMIN', KY_THUAT:'KY_THUAT', TRUONG_MKT:'TRUONG_MKT', GIAM_DOC:'GIAM_DOC' };
const ROLE_LABEL = { MARKETING:'Marketing', SALES:'Sales', ADMIN:'Admin', KY_THUAT:'Kỹ thuật', TRUONG_MKT:'Trưởng MKT', GIAM_DOC:'Giám đốc' };
const MUC_LABEL = { NGUOI:'Người làm', AI_GOI_Y:'AI gợi ý', AI_TU_LAM:'AI tự làm' };
const MUC_CLS = { NGUOI:'bg-slate-100 text-ink', AI_GOI_Y:'bg-amber-100 text-amber-800', AI_TU_LAM:'bg-emerald-100 text-emerald-800' };
const laStaff = me => me && ['MARKETING','TRUONG_MKT','ADMIN'].includes(me.vai_tro);
const laXemMkt = me => me && (laStaff(me) || me.vai_tro==='GIAM_DOC');
const laGat = me => me && ['ADMIN','TRUONG_MKT'].includes(me.vai_tro);
const todayYMD = () => new Date(Date.now()+7*36e5).toISOString().slice(0,10);
const fmtDate = iso => { if(!iso) return '—'; const d=new Date(iso); return isNaN(d)?String(iso):d.toLocaleString('vi-VN',{hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit'}); };
const fmtSo = n => Number(n||0).toLocaleString('vi-VN');

const AppCtx = createContext(null);
const useApp = () => useContext(AppCtx);
const TOKEN_KEY = 'kingsmen_os_token';

function AppProvider({children}){
  const [db, setDb] = useState(null);
  const [token, setToken] = useState(()=>{ try{ return localStorage.getItem(TOKEN_KEY)||null; }catch(e){ return null; } });
  const [loading, setLoading] = useState(()=>!!token);
  const [toast, setToast] = useState(null);
  const notify = (msg, type='ok') => { setToast({msg,type}); setTimeout(()=>setToast(null), 3000); };

  const call = async (path, {method='GET', body, tok}={}) => {
    const r = await fetch('/api'+path, { method, headers:{ 'Content-Type':'application/json', ...((tok||token)?{Authorization:'Bearer '+(tok||token)}:{}) }, body: body?JSON.stringify(body):undefined });
    const j = await r.json().catch(()=>({}));
    if(r.status===401 && path!=='/login'){ try{ localStorage.removeItem(TOKEN_KEY); }catch(e){} setToken(null); setDb(null); throw new Error(j.error||'Hết phiên — đăng nhập lại'); }
    if(!r.ok) throw new Error(j.error||('Lỗi '+r.status));
    return j;
  };
  useEffect(()=>{ if(!token){ setLoading(false); return; } setLoading(true);
    call('/bootstrap').then(r=>setDb(r.db)).catch(()=>{}).finally(()=>setLoading(false)); },[token]);

  // goi(): mọi thao tác đi qua đây — server trả {db} thì thay toàn bộ (một nguồn sự thật)
  const goi = async (path, opts={}) => { try{ const r=await call(path, opts); if(r&&r.db) setDb(r.db); return {ok:true, ...r}; }catch(e){ return {ok:false, msg:e.message}; } };
  const api = {
    db, me: db?db.me:null, loading, notify, goi, setDb,
    login: async (email,password)=>{ try{ const r=await call('/login',{method:'POST',body:{email,password}}); try{ localStorage.setItem(TOKEN_KEY,r.token); }catch(e){} setDb(r.db); setToken(r.token); return {ok:true}; }catch(e){ return {ok:false,msg:e.message}; } },
    logout: async ()=>{ try{ await call('/logout',{method:'POST'}); }catch(e){} try{ localStorage.removeItem(TOKEN_KEY); }catch(e){} setToken(null); setDb(null); },
    refresh: ()=>call('/bootstrap').then(r=>setDb(r.db)).catch(()=>{}),
  };
  return <AppCtx.Provider value={api}>{children}{toast && <Toast toast={toast}/>}</AppCtx.Provider>;
}
