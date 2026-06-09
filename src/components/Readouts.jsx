const Readout=({label,value,unit,warn=false,decimals=1,ctx=null,primary=false})=>(
  <div className="ro" style={primary?{borderColor:'#e2e8f022'}:{}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:1}}>
      <div className="rl">{label}</div>
      {ctx&&<span style={{fontSize:10,color:ctx[1],letterSpacing:1,
                          background:ctx[1]+'18',border:`1px solid ${ctx[1]}44`,
                          borderRadius:2,padding:'1px 4px',lineHeight:1.4}}>
        {ctx[0]}
      </span>}
    </div>
    <div style={{display:'flex',alignItems:'baseline',gap:3}}>
      <span className={primary?'rv-lg':'rv'} style={{color:warn?'#f59e0b':'#e2e8f0'}}>
        {typeof value==='number'?value.toFixed(decimals):value}
      </span>
      {unit&&<span className="ru" style={{marginTop:0}}>{unit}</span>}
    </div>
  </div>
);

const Stat=({label,value,unit,decimals=2})=>(
  <div className="sr">
    <span className="sl">{label}</span>
    <span className="sv">{typeof value==='number'?value.toFixed(decimals):value}
      <span className="su">{unit}</span></span>
  </div>
);

const Card=({title,accent=false,hint=null,children})=>(
  <div className="card" style={accent?{borderColor:'#e2e8f011'}:{}}>
    <div className="ch" style={accent?{borderBottomColor:'#e2e8f011',background:'#0a0f1a'}:{}}>
      <span>{title}</span>
      {hint&&<Hint text={hint}/>}
    </div>
    <div className="cb">{children}</div>
  </div>
);

const BiasSeg=({label,val,hint,primary,total})=>{
  // positive = oversteer (red/right), negative = understeer (blue/left)
  const c=val>0.5?'#ef4444':val<-0.5?'#3b82f6':'#cbd5e1';
  const scale=15;
  const pct=Math.min(50,Math.abs(val)/scale*50);
  const barStyle=val>=0?{left:'50%',width:`${pct}%`}:{right:'50%',width:`${pct}%`};
  const pctOfTotal=total&&Math.abs(total)>0.5?Math.round(Math.abs(val)/Math.abs(total)*100):null;
  return(
    <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:3,
                 ...(primary?{background:'#0a0f1a',borderLeft:'2px solid '+(val>0?'#ef444466':'#3b82f666'),
                               borderRadius:2,padding:'3px 0 3px 4px',margin:'0 -2px 3px -4px'}:{})}}>
      <div style={{width:80,display:'flex',alignItems:'center',gap:2,flexShrink:0}}>
        <span style={{fontSize:10,color:primary?'#cbd5e1':'#94a3b8',letterSpacing:1,lineHeight:1.2,
                       whiteSpace:'nowrap',fontWeight:primary?700:400}}>{label}</span>
        <Hint text={hint}/>
      </div>
      <div style={{flex:1,position:'relative',height:8,background:'#0f172a',borderRadius:2}}>
        <div style={{position:'absolute',left:'50%',top:0,bottom:0,width:1,background:'#1e293b'}}/>
        {Math.abs(val)>0.5&&<div style={{position:'absolute',top:1,bottom:1,borderRadius:1,
          background:c+(primary?'ee':'99'),...barStyle}}/>}
      </div>
      <span style={{fontFamily:'Courier New',fontSize:11,color:c,width:34,textAlign:'right',flexShrink:0,
                     fontWeight:primary?700:400}}>
        {val>=0?'+':''}{val.toFixed(1)}
      </span>
      <span style={{fontSize:10,color:pctOfTotal>40?c:'#475569',width:28,textAlign:'right',flexShrink:0}}>
        {pctOfTotal!=null?`${pctOfTotal}%`:''}
      </span>
    </div>
  );
};
