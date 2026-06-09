(function(){
  var preload=document.getElementById('pre-load');
  function showError(msg,detail){
    if(preload){
      preload.style.display='block';
      preload.innerHTML='<div style="color:#e2e8f0;font-size:14px;margin-bottom:8px">SUSP.OS \u2014 Failed to load</div>'
        +'<div style="color:#6b7280;margin-bottom:12px">'+msg+'</div>'
        +'<div style="background:#0f172a;padding:12px;border-radius:4px;color:#ef4444;word-break:break-all;line-height:1.6;font-size:11px">'+(detail||'')+'</div>'
        +'<button onclick="location.reload()" style="margin-top:16px;padding:8px 16px;background:#0f172a;border:1px solid #1e293b;color:#e2e8f0;border-radius:4px;cursor:pointer;font-family:Courier New;font-size:12px">RELOAD</button>';
    }
  }
  try{
    if(typeof Babel==='undefined'){showError('Babel failed to load','Check your internet connection and reload.');return;}
    var src=document.getElementById('app-source').textContent;
    var compiled;
    try{
      compiled=Babel.transform(src,{
        presets:['env','react'],
        plugins:['transform-optional-chaining','transform-nullish-coalescing-operator','transform-logical-assignment-operators'],
        filename:'susp-os.jsx'
      }).code;
    }catch(e){
      showError('Babel compilation failed',e.message||String(e));
      return;
    }
    // Use indirect eval so errors are catchable on all browsers including iOS WebKit.
    // Direct script injection loses the error context on WebKit.
    try{
      (0,eval)(compiled);
    }catch(e){
      showError('Runtime error',e.message||String(e));
    }
  }catch(e){
    showError('Load failed',e.message||String(e));
  }
})();
