const FeelSlider=({label,value,onChange,min,max,step=1,leftLabel,rightLabel,readout=null,centered=false,locked=false,hint=null,markers=null})=>{
  const pct=((value-min)/(max-min))*100;
  const cPct=((0-min)/(max-min))*100;
  let bg;
  if(centered){
    if(value===0){
      bg=`linear-gradient(to right,#0f172a 49%,#334155 49%,#334155 51%,#0f172a 51%)`;
    } else if(value>0){
      bg=`linear-gradient(to right,#0f172a ${cPct}%,#e2e8f0 ${cPct}%,#e2e8f0 ${pct}%,#0f172a ${pct}%)`;
    } else {
      bg=`linear-gradient(to right,#0f172a ${pct}%,#e2e8f0 ${pct}%,#e2e8f0 ${cPct}%,#0f172a ${cPct}%)`;
    }
  } else {
    bg=`linear-gradient(to right,#e2e8f0 ${pct}%,#1e293b ${pct}%)`;
  }
  const wrapRef=useRef(null);
  const valRef=useRef(value);
  useLayoutEffect(()=>{valRef.current=value;},[value]);
  const lockRef=useRef(locked); lockRef.current=locked;
  const onChangeRef=useRef(onChange); useLayoutEffect(()=>{onChangeRef.current=onChange;},[onChange]);
  useEffect(()=>{
    const onWheel=e=>{
      if(document.activeElement!==wrapRef.current&&!wrapRef.current?.contains(document.activeElement))return;
      e.preventDefault();
      e.stopPropagation();
      if(lockRef.current)return;
      const dir=e.deltaY<0?1:-1;
      const next=Math.max(min,Math.min(max,valRef.current+dir*step));
      const snapped=Math.round(next/step)*step;
      onChangeRef.current(parseFloat(snapped.toFixed(6)));
    };
    const w=wrapRef.current;
    w&&w.addEventListener('wheel',onWheel,{passive:false});
    return()=>{w&&w.removeEventListener('wheel',onWheel);};
  },[min,max,step]);
  return(
    <div ref={wrapRef} style={{marginBottom:markers&&markers.some(m=>m.label)?18:10,opacity:locked?0.38:1,transition:'opacity .15s'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:3}}>
        <span style={{fontSize:12,color:'#9ca3af',minWidth:0,overflow:'hidden',
                      textOverflow:'ellipsis',whiteSpace:'nowrap',marginRight:6}}>{label}{hint&&<Hint text={hint}/>}</span>
        <div style={{display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
          {locked&&<span style={{fontSize:10,color:'#94a3b8',letterSpacing:1}}>MANUAL</span>}
          {readout&&(typeof readout==='string'
            ?<span style={{fontSize:11,color:'#9ca3af',fontFamily:'Courier New'}}>{readout}</span>
            :readout)}
        </div>
      </div>
      <div style={{position:'relative'}}>
        <input type="range" className="sli" min={min} max={max} step={step} value={value}
          style={{background:bg,cursor:locked?'not-allowed':'pointer',pointerEvents:locked?'none':'auto'}}
          onChange={e=>!locked&&onChange(parseFloat(e.target.value))}/>
        {centered&&<div style={{
          position:'absolute',left:'50%',top:'50%',
          transform:'translate(-50%,-50%)',
          width:2,height:10,background:value===0?'#e2e8f0':'#334155',
          borderRadius:1,pointerEvents:'none',transition:'background .15s'}}/>}
        {markers&&markers.map(m=>{
          const pct=(m.value-min)/(max-min);
          const left=`calc(${pct*100}% + ${(0.5-pct)*14}px)`;
          const active=value>=m.value;
          return(
            <div key={m.value} style={{position:'absolute',left,top:'50%',
                transform:'translate(-50%,-50%)',pointerEvents:'none',
                display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
              <div style={{width:1.5,height:8,borderRadius:1,
                           background:active?m.color:'#1e293b',
                           transition:'background .15s'}}/>
              {m.label&&<span style={{fontSize:10,color:active?m.color:'#94a3b8',
                                      letterSpacing:0.5,whiteSpace:'nowrap',
                                      transition:'color .15s',marginTop:2}}>
                {m.label}
              </span>}
            </div>
          );
        })}
      </div>
      <div style={{display:'flex',justifyContent:'space-between',marginTop:4}}>
        <span style={{fontSize:10,color:'#94a3b8',letterSpacing:1}}>{leftLabel}</span>
        <span style={{fontSize:10,color:'#94a3b8',letterSpacing:1}}>{rightLabel}</span>
      </div>
    </div>
  );
};
