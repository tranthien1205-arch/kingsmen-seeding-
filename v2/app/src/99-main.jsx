// ===== GỐC =====
function App(){
  const { me, loading, db } = useApp();
  if(loading) return <div className="min-h-screen grid place-items-center text-ink-muted text-sm">Đang tải…</div>;
  if(!me || !db) return <Login/>;
  if(me.doi_mat_khau) return <DoiMatKhauLanDau/>;
  return <Shell/>;
}
ReactDOM.createRoot(document.getElementById('root')).render(<AppProvider><App/></AppProvider>);
