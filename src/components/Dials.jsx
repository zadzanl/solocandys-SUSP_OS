const DampingDial=({rebound,bump})=>{
  const[hover,setHover]=useState(null); // 'rebound'|'bump'|null
  const SIZE=120,CX=60,CY=58,R=46;
  const GAP_DEG=60; // gap at bottom
  const START=180+GAP_DEG/2;  // 210° from top-clockwise = lower-left
  const SWEEP=360-GAP_DEG;
  const MIN_Z=10,MAX_Z=115;
  const zetaToAngle=z=>START+((z-MIN_Z)/(MAX_Z-MIN_Z))*SWEEP;
  const polar=(deg,r=R)=>{
    const rad=((deg-90)*Math.PI)/180; // SVG: 0deg = top, clockwise
    return[CX+r*Math.cos(rad),CY+r*Math.sin(rad)];
  };
  const arcPath=(a1,a2,r=R)=>{
    const[x1,y1]=polar(a1,r);
    const[x2,y2]=polar(a2,r);
    const sweep=((a2-a1)+360)%360;
    const large=sweep>180?1:0;
    return`M${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 ${large},1 ${x2.toFixed(2)},${y2.toFixed(2)}`;
  };
  const rebA=zetaToAngle(rebound);
  const bumpA=zetaToAngle(bump);
  const endA=START+SWEEP;
  const [rxSvg,rySvg]=polar(rebA);
  const [bxSvg,bySvg]=polar(bumpA);
  const bumpPct=rebound>0?Math.round((bump/rebound)*100):0;
  const label=hover==='rebound'?`${Math.round(rebound)}%`
             :hover==='bump'   ?`${Math.round(bump)}%`
             :`${bumpPct}%`;
  const labelSub=hover==='rebound'?'REBOUND'
                 :hover==='bump'   ?'BUMP'
                 :'B/R';
  const loA=Math.min(rebA,bumpA), hiA=Math.max(rebA,bumpA);
  const crossed=bump>rebound;
  return(
    <div style={{display:'flex',justifyContent:'center',marginBottom:4}}>
      <svg width={SIZE} height={SIZE} style={{overflow:'visible'}}>
        {/* background track */}
        <path d={arcPath(START,endA)} fill="none" stroke="#1e293b" strokeWidth={4} strokeLinecap="round"/>
        {/* rebound arc: START → rebA, red */}
        <path d={arcPath(START,rebA)} fill="none" stroke="#ef4444" strokeWidth={4} strokeLinecap="round" opacity={0.7}/>
        {/* bump arc: START → bumpA, blue */}
        <path d={arcPath(START,bumpA)} fill="none" stroke="#3b82f6" strokeWidth={4} strokeLinecap="round" opacity={0.7}/>
        {/* fill between thumbs */}
        <path d={arcPath(loA,hiA)} fill="none"
          stroke={crossed?'#f59e0b':'#7c3aed'} strokeWidth={3} strokeLinecap="round" opacity={0.5}/>
        {/* rebound thumb */}
        <circle cx={rxSvg} cy={rySvg} r={5} fill="#ef4444" stroke="#0f172a" strokeWidth={1.5}
          style={{cursor:'default'}}
          onMouseEnter={()=>setHover('rebound')} onMouseLeave={()=>setHover(null)}
          onTouchStart={e=>{e.stopPropagation();setHover(h=>h==='rebound'?null:'rebound');}}/>
        {/* bump thumb */}
        <circle cx={bxSvg} cy={bySvg} r={5} fill="#3b82f6" stroke="#0f172a" strokeWidth={1.5}
          style={{cursor:'default'}}
          onMouseEnter={()=>setHover('bump')} onMouseLeave={()=>setHover(null)}
          onTouchStart={e=>{e.stopPropagation();setHover(h=>h==='bump'?null:'bump');}}/>
        {/* center label */}
        <text x={CX} y={CY-4} textAnchor="middle" fill={crossed?'#f59e0b':'#e2e8f0'}
          fontSize={16} fontFamily="Courier New" fontWeight="700">{label}</text>
        <text x={CX} y={CY+11} textAnchor="middle" fill="#475569"
          fontSize={9} fontFamily="sans-serif" letterSpacing={2}>{labelSub}</text>
      </svg>
    </div>
  );
};

const _dialBase=(SIZE=120,CX=60,CY=58,R=46,GAP_DEG=60)=>{
  const START=180+GAP_DEG/2, SWEEP=360-GAP_DEG;
  const polar=(deg,r=R)=>{const rad=((deg-90)*Math.PI)/180;return[CX+r*Math.cos(rad),CY+r*Math.sin(rad)];};
  const arcPath=(a1,a2,r=R)=>{
    const[x1,y1]=polar(a1,r);const[x2,y2]=polar(a2,r);
    const sweep=((a2-a1)+360)%360;const large=sweep>180?1:0;
    return`M${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 ${large},1 ${x2.toFixed(2)},${y2.toFixed(2)}`;
  };
  return{START,SWEEP,polar,arcPath,CX,CY,R,SIZE};
};

const _BalStrip=({rearFrac,wtRearFrac,BY=108})=>{
  const BX=18,BW=84;
  const splitX=BX+rearFrac*BW;
  const wtX=BX+wtRearFrac*BW;
  return(<>
    <rect x={BX} y={BY} width={BW} height={3} rx={1.5} fill="#0f172a"/>
    <rect x={BX} y={BY} width={(1-rearFrac)*BW} height={3} rx={1.5} fill="#818cf8" opacity={0.45}/>
    <rect x={BX+(1-rearFrac)*BW} y={BY} width={rearFrac*BW} height={3} rx={1.5} fill="#38bdf8" opacity={0.45}/>
    <line x1={wtX} y1={BY-2} x2={wtX} y2={BY+5} stroke="#334155" strokeWidth={1}/>
    <rect x={splitX-1} y={BY-3} width={2} height={9} rx={1} fill="#94a3b8"/>
    <text x={BX-2} y={BY+13} textAnchor="end" fill="#334155" fontSize={8}>F</text>
    <text x={BX+BW+2} y={BY+13} textAnchor="start" fill="#334155" fontSize={8}>R</text>
  </>);
};

const SpringDial=({fHz,rHz,rsSpF,rsSpR,frontBias,clamped})=>{
  const[hover,setHover]=useState(null);
  const{START,SWEEP,polar,arcPath,CX,CY,SIZE}=_dialBase();
  const MIN_HZ=HZ_MIN,MAX_HZ=HZ_MAX;
  const toA=hz=>START+((Math.min(Math.max(hz,MIN_HZ),MAX_HZ)-MIN_HZ)/(MAX_HZ-MIN_HZ))*SWEEP;
  const endA=START+SWEEP;
  const a12=toA(1.5),a18=toA(2.5),a25=toA(3.5);
  const fA=toA(fHz),rA=toA(rHz);
  const[fxS,fyS]=polar(fA);const[rxS,ryS]=polar(rA);
  const spTot=rsSpF+rsSpR;
  const rearSpFrac=spTot>0?rsSpR/spTot:1-(frontBias/100);
  const wtRearFrac=1-frontBias/100;
  const dispVal=hover==='front'?fHz.toFixed(2):hover==='rear'?rHz.toFixed(2)
    :(fHz>0?`×${(rHz/fHz).toFixed(2)}`:'-');
  const dispSub=hover==='front'?'FRONT':hover==='rear'?'REAR':'F/R';
  const centerCol=clamped?'#f59e0b':'#e2e8f0';
  return(
    <div style={{display:'flex',justifyContent:'center',marginBottom:4}}>
      <svg width={SIZE} height={SIZE} style={{overflow:'visible'}}>
        <path d={arcPath(START,endA)} fill="none" stroke="#1e293b" strokeWidth={4} strokeLinecap="round"/>
        <path d={arcPath(START,a12)} fill="none" stroke="#1e3a5f" strokeWidth={4} strokeLinecap="round"/>
        <path d={arcPath(a12,a18)}   fill="none" stroke="#14532d" strokeWidth={4} strokeLinecap="round"/>
        <path d={arcPath(a18,a25)}   fill="none" stroke="#713f12" strokeWidth={4} strokeLinecap="round"/>
        <path d={arcPath(a25,endA)}  fill="none" stroke="#7f1d1d" strokeWidth={4} strokeLinecap="round"/>
        <circle cx={fxS} cy={fyS} r={5} fill="#818cf8" stroke="#0f172a" strokeWidth={1.5} style={{cursor:'default'}}
          onMouseEnter={()=>setHover('front')} onMouseLeave={()=>setHover(null)}
          onTouchStart={e=>{e.stopPropagation();setHover(h=>h==='front'?null:'front');}}/>
        <circle cx={rxS} cy={ryS} r={5} fill="#38bdf8" stroke="#0f172a" strokeWidth={1.5} style={{cursor:'default'}}
          onMouseEnter={()=>setHover('rear')} onMouseLeave={()=>setHover(null)}
          onTouchStart={e=>{e.stopPropagation();setHover(h=>h==='rear'?null:'rear');}}/>
        <text x={CX} y={CY-4} textAnchor="middle" fill={centerCol}
          fontSize={15} fontFamily="Courier New" fontWeight="700">{dispVal}</text>
        <text x={CX} y={CY+11} textAnchor="middle" fill="#475569"
          fontSize={9} fontFamily="sans-serif" letterSpacing={2}>{dispSub}</text>
        <_BalStrip rearFrac={rearSpFrac} wtRearFrac={wtRearFrac}/>
      </svg>
    </div>
  );
};

const ArbDial=({arbF,arbR,arbLimit,rsAbF,rsAbR,frontBias})=>{
  const[hover,setHover]=useState(null);
  const{START,SWEEP,polar,arcPath,CX,CY,SIZE}=_dialBase();
  const toA=v=>START+(Math.min(Math.max(v,0),arbLimit)/arbLimit)*SWEEP;
  const endA=START+SWEEP;
  const a50=toA(arbLimit*0.50),a75=toA(arbLimit*0.75),a90=toA(arbLimit*0.90);
  const fA=toA(arbF),rA=toA(arbR);
  const[fxS,fyS]=polar(fA);const[rxS,ryS]=polar(rA);
  const abTot=rsAbF+rsAbR;
  const rearAbFrac=abTot>0?rsAbR/abTot:1-(frontBias/100);
  const wtRearFrac=1-frontBias/100;
  const rearPct=Math.round(rearAbFrac*100);
  const dispVal=hover==='front'?arbF.toFixed(1):hover==='rear'?arbR.toFixed(1):`${rearPct}%`;
  const dispSub=hover==='front'?`/ ${arbLimit} F`:hover==='rear'?`/ ${arbLimit} R`:'R SPLIT';
  const warnF=arbF>arbLimit*0.88,warnR=arbR>arbLimit*0.88;
  const centerCol=warnF||warnR?'#f59e0b':'#e2e8f0';
  return(
    <div style={{display:'flex',justifyContent:'center',marginBottom:4}}>
      <svg width={SIZE} height={SIZE} style={{overflow:'visible'}}>
        <path d={arcPath(START,endA)} fill="none" stroke="#1e293b" strokeWidth={4} strokeLinecap="round"/>
        <path d={arcPath(START,a50)} fill="none" stroke="#1e3a5f" strokeWidth={4} strokeLinecap="round"/>
        <path d={arcPath(a50,a75)}   fill="none" stroke="#713f12" strokeWidth={4} strokeLinecap="round"/>
        <path d={arcPath(a75,a90)}   fill="none" stroke="#7c2d12" strokeWidth={4} strokeLinecap="round"/>
        <path d={arcPath(a90,endA)}  fill="none" stroke="#7f1d1d" strokeWidth={4} strokeLinecap="round"/>
        <circle cx={fxS} cy={fyS} r={5} fill={warnF?'#f59e0b':'#818cf8'} stroke="#0f172a" strokeWidth={1.5} style={{cursor:'default'}}
          onMouseEnter={()=>setHover('front')} onMouseLeave={()=>setHover(null)}
          onTouchStart={e=>{e.stopPropagation();setHover(h=>h==='front'?null:'front');}}/>
        <circle cx={rxS} cy={ryS} r={5} fill={warnR?'#f59e0b':'#38bdf8'} stroke="#0f172a" strokeWidth={1.5} style={{cursor:'default'}}
          onMouseEnter={()=>setHover('rear')} onMouseLeave={()=>setHover(null)}
          onTouchStart={e=>{e.stopPropagation();setHover(h=>h==='rear'?null:'rear');}}/>
        <text x={CX} y={CY-4} textAnchor="middle" fill={centerCol}
          fontSize={15} fontFamily="Courier New" fontWeight="700">{dispVal}</text>
        <text x={CX} y={CY+11} textAnchor="middle" fill="#475569"
          fontSize={9} fontFamily="sans-serif" letterSpacing={2}>{dispSub}</text>
        <_BalStrip rearFrac={rearAbFrac} wtRearFrac={wtRearFrac}/>
      </svg>
    </div>
  );
};

const ArbRangeSlider=({floor,ceil,onFloor,onCeil,min=1,max=65})=>{
  const trackRef=useRef(null);
  const floorRef=useRef(floor); floorRef.current=floor;
  const ceilRef=useRef(ceil);   ceilRef.current=ceil;
  const pct=v=>((v-min)/(max-min))*100;
  const fromPct=p=>Math.round(min+(max-min)*(p/100));
  const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));

  const startDrag=useCallback((e,thumb)=>{
    e.preventDefault();
    const track=trackRef.current;
    if(!track)return;
    const move=ev=>{
      const client=ev.touches?ev.touches[0].clientX:ev.clientX;
      const{left,width}=track.getBoundingClientRect();
      const raw=clamp(((client-left)/width)*100,0,100);
      const val=fromPct(raw);
      if(thumb==="floor") onFloor(clamp(val,min,ceilRef.current-1));
      else                onCeil (clamp(val,floorRef.current+1,max));
    };
    const up=()=>{
      window.removeEventListener("mousemove",move);window.removeEventListener("mouseup",up);
      window.removeEventListener("touchmove",move);window.removeEventListener("touchend",up);
    };
    window.addEventListener("mousemove",move);window.addEventListener("mouseup",up);
    window.addEventListener("touchmove",move,{passive:false});window.addEventListener("touchend",up);
  },[min,max,onFloor,onCeil]);

  const onWheelFloor=useCallback(e=>{
    e.preventDefault();e.stopPropagation();
    onFloor(clamp(floorRef.current+(e.deltaY<0?1:-1),min,ceilRef.current-1));
  },[min,onFloor]);
  const onWheelCeil=useCallback(e=>{
    e.preventDefault();e.stopPropagation();
    onCeil(clamp(ceilRef.current+(e.deltaY<0?1:-1),floorRef.current+1,max));
  },[max,onCeil]);

  const floorThumbRef=useRef(null);
  const ceilThumbRef=useRef(null);
  useEffect(()=>{
    const f=floorThumbRef.current,c=ceilThumbRef.current;
    f&&f.addEventListener("wheel",onWheelFloor,{passive:false});
    c&&c.addEventListener("wheel",onWheelCeil, {passive:false});
    return()=>{
      f&&f.removeEventListener("wheel",onWheelFloor);
      c&&c.removeEventListener("wheel",onWheelCeil);
    };
  },[onWheelFloor,onWheelCeil]);

  const fPct=pct(floor),cPct=pct(ceil);
  const thumbStyle={position:"absolute",top:"50%",transform:"translate(-50%,-50%)",
    width:14,height:14,borderRadius:"50%",background:"#e2e8f0",
    cursor:"grab",boxSizing:"border-box",zIndex:2,boxShadow:"0 0 0 2px #02061799",touchAction:"none"};
  return(
    <div style={{marginBottom:12}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:4}}>
        <span style={{fontSize:12,color:"#9ca3af"}}>ARB Range</span>
          <Hint text="Sets the minimum and maximum ARB click values the solver is allowed to use. Left thumb = floor (minimum clicks at high ride stiffness, preserves balance authority). Right thumb = ceiling (maximum clicks at soft ride stiffness, prevents bars from dominating). Both sides scale proportionally to preserve the front/rear balance ratio."/>
        <span style={{fontSize:11,color:"#9ca3af",fontFamily:"Courier New"}}>
          {floor}–{ceil} clicks
        </span>
      </div>
      <div ref={trackRef} style={{position:"relative",height:22,display:"flex",alignItems:"center",
                                  cursor:"default",userSelect:"none",touchAction:"none"}}>
        <div style={{position:"absolute",left:0,right:0,height:3,borderRadius:1.5,background:"#1e293b"}}/>
        <div style={{position:"absolute",left:`${fPct}%`,width:`${cPct-fPct}%`,height:3,
                     borderRadius:1.5,background:"#e2e8f0"}}/>
        <div ref={floorThumbRef} style={{...thumbStyle,left:`${fPct}%`}}
          onMouseDown={e=>startDrag(e,"floor")}
          onTouchStart={e=>startDrag(e,"floor")}/>
        <div ref={ceilThumbRef} style={{...thumbStyle,left:`${cPct}%`}}
          onMouseDown={e=>startDrag(e,"ceil")}
          onTouchStart={e=>startDrag(e,"ceil")}/>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
        <span style={{fontSize:10,color:"#374151",letterSpacing:1}}>1 SOFT</span>
        <span style={{fontSize:10,color:"#374151",letterSpacing:1}}>{max} STIFF</span>
      </div>
    </div>
  );
};
