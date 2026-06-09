const Field=({label,value,onChange,min,max,step=0.01,unit='',hint=null,logScale=false,logMid=null,locked=false,onToggleLock=null})=>{
  const mid=logMid??Math.sqrt(min*max);
  const valToT=v=>{
    if(!logScale)return(v-min)/(max-min);
    if(v<=mid)return 0.5*Math.log(Math.max(v,min)/min)/Math.log(mid/min);
    return 0.5+0.5*Math.log(v/mid)/Math.log(max/mid);
  };
  const tToVal=t=>{
    if(!logScale)return min+(max-min)*t;
    if(t<=0.5)return min*Math.pow(mid/min,t*2);
    return mid*Math.pow(max/mid,(t-0.5)*2);
  };
  const t=Math.max(0,Math.min(1,valToT(value)));
  const pct=t*100;
  const clamp=v=>Math.max(min,Math.min(max,v));
  const wheelStep=logScale?Math.max(1,Math.round(value*0.005)):step;
  const [draft,setDraft]=useState(null);
  const focused=draft!==null;
  const commit=()=>{
    if(draft===null)return;
    const v=parseFloat(draft);
    onChange(isNaN(v)?value:clamp(v));
    setDraft(null);
  };
  const numRef=useRef(null), sliRef=useRef(null);
  const valRef=useRef(value);
  const draftRef=useRef(draft);
  const onChangeRef=useRef(onChange); useLayoutEffect(()=>{onChangeRef.current=onChange;},[onChange]);
  useLayoutEffect(()=>{valRef.current=value;},[value]);
  useLayoutEffect(()=>{draftRef.current=draft;},[draft]);
  useEffect(()=>{
    const onWheel=e=>{
      if(locked)return;
      const focused=document.activeElement===numRef.current||document.activeElement===sliRef.current;
      if(!focused)return;
      e.preventDefault();
      e.stopPropagation();
      const base=draftRef.current!==null&&!isNaN(parseFloat(draftRef.current))
        ? parseFloat(draftRef.current) : valRef.current;
      const dir=e.deltaY<0?1:-1;
      const dynStep=logScale?(base<6000?1:Math.max(1,Math.round((base-6000)/600))):step;
      const next=clamp(base+dir*dynStep);
      const snapped=logScale?Math.round(next):Math.round(next/step)*step;
      onChangeRef.current(parseFloat(snapped.toFixed(6)));
      if(draftRef.current!==null)setDraft(null);
    };
    const n=numRef.current, s=sliRef.current;
    n&&n.addEventListener('wheel',onWheel,{passive:false});
    s&&s.addEventListener('wheel',onWheel,{passive:false});
    return()=>{
      n&&n.removeEventListener('wheel',onWheel);
      s&&s.removeEventListener('wheel',onWheel);
    };
  },[min,max,step,logScale,locked]);
  return(
    <div style={{marginBottom:10}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:3}}>
        <span style={{fontSize:12,color:'#9ca3af',minWidth:0,overflow:'hidden',
                      textOverflow:'ellipsis',whiteSpace:'nowrap',marginRight:6,
                      display:'flex',alignItems:'center',gap:4}}>
          {onToggleLock && (
            <span 
              onClick={onToggleLock}
              style={{
                cursor:'pointer',
                marginRight:4,
                userSelect:'none',
                fontSize:12
              }}
              title={locked ? "Locked to Telemetry" : "Unlocked (Manual Edit)"}
            >
              {locked ? '🔒' : '🔓'}
            </span>
          )}
          <span>{label}</span>{hint&&<Hint text={hint}/>}
        </span>
        <div style={{display:'flex',alignItems:'center',gap:3,flexShrink:0}}>
          <input ref={numRef} type="number" className="num" min={min} max={max} step={logScale?1:step}
            value={focused?draft:value}
            onFocus={()=>!locked&&setDraft(String(value))}
            onChange={e=>!locked&&setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={e=>{if(e.key==='Enter')e.target.blur();}}
            readOnly={locked}
            style={locked ? {opacity:0.7} : undefined}/>
          {unit&&<span style={{fontSize:10,color:'#94a3b8',fontFamily:'Courier New',
                               whiteSpace:'nowrap'}}>{unit}</span>}
        </div>
      </div>
      <input ref={sliRef} type="range" className="sli" min={0} max={1} step={0.0001}
        value={logScale?t:undefined}
        {...(!logScale&&{min,max,step,value})}
        disabled={locked}
        style={{background:`linear-gradient(to right,#e2e8f0 ${pct}%,#1e293b ${pct}%)`, opacity: locked ? 0.7 : 1, cursor: locked ? 'not-allowed' : 'pointer'}}
        onChange={e=>{
          if(locked)return;
          onChange(logScale
            ?Math.round(clamp(tToVal(parseFloat(e.target.value))))
            :parseFloat(e.target.value));
        }}/>
    </div>
  );
};
