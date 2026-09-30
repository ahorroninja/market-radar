// Market Radar backup tools — isolated from investment/backtest logic.
(function(){
  function download(name,obj){const blob=new Blob([JSON.stringify(obj,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
  const stamp=()=>new Date().toISOString().slice(0,10);
  window.mrExportFull=function(){const raw=localStorage.getItem('mr_state');if(!raw)return alert('No hay datos de Market Radar para exportar.');download(`market-radar-backup-${stamp()}.json`,{format:'market-radar-backup',version:1,exportedAt:new Date().toISOString(),state:JSON.parse(raw)})};
  window.mrExportBacktest=function(){const raw=localStorage.getItem('mr_state');if(!raw)return alert('No hay datos de Market Radar para exportar.');const clean=JSON.parse(raw);['fredKey','eodKey','eodhdKey','apiKey','workerKey'].forEach(k=>delete clean[k]);download(`market-radar-backtest-${stamp()}.json`,{format:'market-radar-backtest',version:1,exportedAt:new Date().toISOString(),state:clean})};
  window.mrImportBackup=function(file){if(!file)return;const r=new FileReader();r.onload=()=>{try{const j=JSON.parse(r.result),s=j&&j.state?j.state:j;if(!s||typeof s!=='object'||Array.isArray(s))throw Error('Formato no válido');if(!confirm('Esto sustituirá la configuración y datos locales de Market Radar en este dispositivo. ¿Continuar?'))return;localStorage.setItem('mr_state',JSON.stringify(s));location.reload()}catch(e){alert('No se pudo importar: '+e.message)}};r.readAsText(file)};
  function addButtons(){
    if(document.getElementById('mrBackupTools'))return;
    // The app keeps the current view in the global state. Only inject on Settings.
    if(typeof state!=='undefined' && state.view!=='settings')return;
    const root=document.getElementById('app');if(!root)return;
    // Extra guard for startup before state exists: Settings contains the existing Save button.
    const saveBtn=[...root.querySelectorAll('button')].find(b=>/^guardar$/i.test((b.textContent||'').trim()));if(!saveBtn)return;
    const box=document.createElement('section');box.id='mrBackupTools';box.className='card';box.style.marginTop='16px';
    box.innerHTML=`<h3>Backup y transferencia</h3><p class="muted">Copia históricos y configuración entre dispositivos. La exportación para backtest elimina las API keys.</p><div style="display:grid;gap:10px"><button type="button" class="btn" id="mrFullBackup">Exportar backup completo</button><button type="button" class="btn" id="mrBacktestExport">Exportar para backtest (sin claves)</button><label class="btn" style="text-align:center;cursor:pointer">Importar backup<input id="mrBackupImport" type="file" accept="application/json,.json" style="display:none"></label></div>`;
    saveBtn.parentElement.insertAdjacentElement('afterend',box);
    document.getElementById('mrFullBackup').onclick=window.mrExportFull;document.getElementById('mrBacktestExport').onclick=window.mrExportBacktest;document.getElementById('mrBackupImport').onchange=e=>window.mrImportBackup(e.target.files[0]);
  }
  const obs=new MutationObserver(addButtons);obs.observe(document.getElementById('app')||document.body,{childList:true,subtree:true});setTimeout(addButtons,0);
})();
