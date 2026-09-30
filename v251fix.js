// Market Radar V2.5.1 hotfix: preserve good local history when an incremental provider call has no new bar.
// Also surface the real provider error per asset instead of reporting cached assets as 'sin datos'.
const marketV251 = market;
market = async function(a){
  const cached = cachedRows(a);
  if(state.workerUrl){
    try {
      return {history: await yahoo(a), source:'Yahoo'};
    } catch(e) {
      console.warn('Yahoo', a[0], e);
      // An up-to-date market often has no newer daily candle yet. Existing history is still valid.
      if(cached.length >= 220) return {history: cached, source:'Local (Yahoo sin vela nueva)'};
      if(state.eodKey){
        try { return {history: await eod(a), source:'EODHD'}; }
        catch(e2){ throw Error(`Yahoo: ${e.message}; EODHD: ${e2.message}`); }
      }
      throw e;
    }
  }
  return marketV251(a);
};

const refreshV251Base = refresh;
refresh = async function(){
  if(!state.workerUrl&&!state.eodKey) return alert('Configura el Worker o EODHD en Ajustes.');
  const b=$('#refresh'); if(b){b.disabled=true;b.textContent='Actualizando…'}
  const errors=[];
  try{
    // Load historical macro when V2.5 is active. Failure must not break market-price refresh.
    if(typeof fredHistory==='function' && state.fredKey){
      try{
        const ids=['VIXCLS','BAMLH0A0HYM2','T10Y2Y','NFCI'];
        const all=await Promise.all(ids.map(fredHistory));
        state.macroHistory=state.macroHistory||{};
        ids.forEach((id,i)=>state.macroHistory[id]=all[i]);
        if(typeof macroAt==='function'){
          const last=id=>state.macroHistory[id]?.at(-1)?.v??null;
          state.macro={vix:last('VIXCLS'),hy:last('BAMLH0A0HYM2'),curve:last('T10Y2Y'),nfci:last('NFCI'),score:Math.round(macroAt(iso(Date.now())))};
        }
      }catch(e){ console.warn('Macro history',e); errors.push(`Macro: ${e.message}`); }
    }
    let ok=0;
    for(const a of ASSETS){
      try{
        const {history,source}=await market(a);
        const t=calc(history);
        if(!t) throw Error(`histórico insuficiente (${history.length} sesiones)`);
        state.data[key(a)]={...t,score:opportunity(t,state.macro?.score??50),updated:Date.now(),history,source};
        ok++; save();
      }catch(e){ errors.push(`${a[0]}: ${e.message}`); }
    }
    state.lastUpdate=Date.now(); save(); render();
    if(errors.length) alert(`Actualizados ${ok}/10.\n\n${errors.join('\n')}`);
  } finally {
    const rb=$('#refresh'); if(rb){rb.disabled=false;rb.textContent='Actualizar'}
  }
};

// Make the deployed build unmistakable even on dashboard.
const dashboardV251Base = dashboard;
dashboard = function(){ return dashboardV251Base().replace('V2.4','V2.5.1'); };
render();
