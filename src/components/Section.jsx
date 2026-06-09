const Sec=({title,open,onToggle,onReset,children})=>{
  const[pending,setPending]=useState(false);
  const timer=useRef(null);
  const handleReset=e=>{
    e.stopPropagation();
    if(pending){clearTimeout(timer.current);setPending(false);onReset();}
    else{setPending(true);timer.current=setTimeout(()=>setPending(false),2000);}
  };
  useEffect(()=>()=>clearTimeout(timer.current),[]);
  return(
    <div style={{borderBottom:'1px solid #0f172a'}}>
      <button className={`stog${open?' stog-open':''}`} onClick={onToggle}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <div style={{width:2,height:10,borderRadius:1,flexShrink:0,
                       background:open?'#e2e8f0':'#1e293b',transition:'background .12s'}}/>
          <span>{title}</span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:6}}>
          {onReset&&<span
            onClick={handleReset}
            title={pending?'Click again to confirm':'Reset to defaults'}
            style={{fontSize:10,color:pending?'#f59e0b':'#94a3b8',padding:'1px 5px',borderRadius:2,
                    border:`1px solid ${pending?'#f59e0b44':'#1e293b'}`,lineHeight:1.4,cursor:'pointer',
                    transition:'color .12s,border-color .12s',userSelect:'none'}}>
            {pending?'SURE?':'RESET'}
          </span>}
          <span style={{fontSize:11,color:open?'#e2e8f0':'#94a3b8',transition:'color .12s'}}>
            {open?'▲':'▼'}
          </span>
        </div>
      </button>
      {open&&<div style={{padding:'8px 12px 10px'}}>{children}</div>}
    </div>
  );
};
