const CheckerModal=({onClose,lim,metricUnits})=>{
  const[ckSpr,setCkSpr]=useState({f:400,r:300});
  const[ckDmp,setCkDmp]=useState({rebF:5,rebR:5,bumpF:3,bumpR:3});
  const[ckW,setCkW]=useState(3200);
  const[ckB,setCkB]=useState(52);
  const pS=k=>v=>setCkSpr(p=>({...p,[k]:v}));
  const pD=k=>v=>setCkDmp(p=>({...p,[k]:v}));
  const masses=useMemo(()=>{const kg=ckW/KG_TO_LB;
    return{front:(kg*(ckB/100))/2,rear:(kg*(1-ckB/100))/2};},[ckW,ckB]);
  const ck=useMemo(()=>computeCheck(ckSpr,ckDmp,masses),[ckSpr,ckDmp,masses]);
  return(
    <div style={{position:'fixed',inset:0,background:'#000c',zIndex:999,
                 display:'flex',alignItems:'center',justifyContent:'center'}}
          onClick={onClose}>
      <div style={{background:'#020617',border:'1px solid #1e293b',borderRadius:2,
                    width:660,maxWidth:'calc(100vw - 20px)',maxHeight:'88vh',overflow:'auto'}}
            onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',
                     padding:'8px 14px',borderBottom:'1px solid #1e293b'}}>
          <span style={{fontSize:12,color:'#9ca3af',letterSpacing:2}}>TUNE CHECK</span>
          <button onClick={onClose} style={{background:'none',border:'none',color:'#94a3b8',
                                           cursor:'pointer',fontSize:17,lineHeight:1}}>✕</button>
        </div>
        <div style={{padding:14}}>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:10,marginBottom:10}}>
            <Card title="VEHICLE MASS">
              <Field label="Weight"
                value={metricUnits?ckW/KG_TO_LB:ckW}
                onChange={metricUnits?v=>setCkW(v*KG_TO_LB):setCkW}
                min={metricUnits?45:100} max={metricUnits?8165:18000} step={1}
                unit={metricUnits?'kg':'lb'} logScale={true} logMid={metricUnits?2722:6000}/>
              <Field label="Front Bias" value={ckB} onChange={setCkB} min={30} max={70} step={1} unit="%"/>
              <Stat label="Corner mass front" value={masses.front} unit="kg"/>
              <Stat label="Corner mass rear" value={masses.rear} unit="kg"/>
            </Card>
            <Card title="SPRING INPUTS">
              <Field label="Spring Rate Front"
                value={metricUnits?ckSpr.f*NMM_PER_LBIN:ckSpr.f}
                onChange={metricUnits?v=>pS('f')(v/NMM_PER_LBIN):pS('f')}
                min={metricUnits?88:50} max={metricUnits?4380:2500} step={1}
                unit={metricUnits?'N/mm':'lb/in'}/>
              <Field label="Spring Rate Rear"
                value={metricUnits?ckSpr.r*NMM_PER_LBIN:ckSpr.r}
                onChange={metricUnits?v=>pS('r')(v/NMM_PER_LBIN):pS('r')}
                min={metricUnits?88:50} max={metricUnits?4380:2500} step={1}
                unit={metricUnits?'N/mm':'lb/in'}/>
            </Card>
            <Card title="DAMPING INPUTS">
              <Field label="Rebound Front" value={ckDmp.rebF} onChange={pD('rebF')} min={1} max={lim.damping} step={0.1} unit={`/ ${lim.damping}`}/>
              <Field label="Rebound Rear" value={ckDmp.rebR} onChange={pD('rebR')} min={1} max={lim.damping} step={0.1} unit={`/ ${lim.damping}`}/>
              <Field label="Bump Front" value={ckDmp.bumpF} onChange={pD('bumpF')} min={1} max={lim.damping} step={0.1} unit={`/ ${lim.damping}`}/>
              <Field label="Bump Rear" value={ckDmp.bumpR} onChange={pD('bumpR')} min={1} max={lim.damping} step={0.1} unit={`/ ${lim.damping}`}/>
            </Card>
            <Card title="DECODED TUNE" accent>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4,marginBottom:6}}>
                <Readout label="Hz FRONT" value={ck.hF} unit="Hz"/>
                <Readout label="Hz REAR" value={ck.hR} unit="Hz"/>
              </div>
              <Stat label="Rebound ratio front" value={ck.zRebF} unit="%" decimals={1}/>
              <Stat label="Rebound ratio rear"  value={ck.zRebR} unit="%" decimals={1}/>
              <Stat label="Bump ratio front"    value={ck.zBmpF} unit="%" decimals={1}/>
              <Stat label="Bump ratio rear"     value={ck.zBmpR} unit="%" decimals={1}/>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};
