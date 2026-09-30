// Market Radar backup tools — isolated from investment/backtest logic.
(function(){
  function download(name,obj){
    const blob=new Blob([JSON.stringify(obj,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function stamp(){return new Date().toISOString().slice(0,10)}
  window.mrExportFull=function(){
    const raw=localStorage.getItem('mr_state');
    if(!raw)return alert('No hay datos de Market Radar para exportar.');
    download(`market-radar-backup-${stamp()}.json`,{format:'market-radar-backup',version:1,exportedAt:new Date().toISOString(),state:JSON.parse(raw)});
  };
  window.mrExportBacktest=function(){
    const raw=localStorage.getItem('mr_state');
    if(!raw)return alert('No hay datos de Market Radar para exportar.');
    const s=JSON.parse(raw),clean=JSON.parse(JSON.stringify(s));
    ['fredKey','eodKey','eodhdKey','apiKey','workerKey'].forEach(k=>{if(k in clean)delete clean[k]});
    // Keep worker URL: it is public configuration, not a secret.
    download(`market-radar-backtest-${stamp()}.json`,{format:'market-radar-backtest',version:1,exportedAt:new Date().toISOString(),state:clean});
  };
  window.mrImportBackup=function(file){
    if(!file)return;
    const r=new FileReader();
    r.onload=()=>{try{
      const j=JSON.parse(r.result),s=j&&j.state?j.state:j;
      if(!s||typeof s!=='object'||Array.isArray(s))throw Error('Formato no válido');
      if(!confirm('Esto sustituirá la configuración y datos locales de Market Radar en este dispositivo. ¿Continuar?'))return;
      localStorage.setItem('mr_state',JSON.stringify(s));
      location.reload();
    }catch(e){alert('No se pudo importar: '+e.message)}};
    r.readAsText(file);
  };
  function addButtons(){
    if(document.getElementById('mrBackupTools'))return;
    const settings=document.querySelector('#app');
    if(!settings)return;
    const marker=[...settings.querySelectorAll('h1,h2,h3,.title')].find(x=>/ajustes/i.test(x.textContent||''));
    if(!marker)return;
    const box=document.createElement('section');box.id='mrBackupTools';box.className='card';
    box.innerHTML=`<h3>Backup y transferencia</h3><p class="muted">Exporta tus históricos y configuración para moverlos a otro dispositivo. La exportación para backtest elimina las API keys.</p><div style="display:grid;gap:10px"><button type="button" id="mrFullBackup">Exportar backup completo</button><button type="button" id="mrBacktestExport">Exportar para backtest (sin claves)</button><label class="btn" style="text-align:center;cursor:pointer">Importar backup<input id="mrBackupImport" type="file" accept="application/json,.json" style="display:none"></label></div>`;
    settings.appendChild(box);
    document.getElementById('mrFullBackup').onclick=window.mrExportFull;
    document.getElementById('mrBacktestExport').onclick=window.mrExportBacktest;
    document.getElementById('mrBackupImport').onchange=e=>window.mrImportBackup(e.target.files[0]);
  }
  const obs=new MutationObserver(()=>addButtons());obs.observe(document.documentElement,{childList:true,subtree:true});addButtons();
})();
