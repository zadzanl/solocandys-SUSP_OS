const HandlingVerdict=({total,bSp,bAb,bDiffAccel,bDiffDecel,bDiffFront,bDiffRear,diffLayout,bBrakeEntry,bDampBias,mechBalance,gripBalance,uiMode})=>{
  const abs=Math.abs(total);
  // positive = oversteer, negative = understeer
  const label=abs<3?'NEUTRAL':total>0?'OVERSTEER':'UNDERSTEER';
  const col=abs<3?'#e2e8f0':total>0?'#ef4444':'#3b82f6';
  const isAWD=diffLayout==='AWD';
  const contributors=[
    {name:'springs',val:bSp??0},{name:'ARB',val:bAb??0},
    ...(isAWD
      ?[{name:'diff front',val:bDiffFront??0},{name:'diff rear',val:bDiffRear??0}]
      :[{name:'diff exit',val:bDiffAccel??0},{name:'diff entry',val:bDiffDecel??0}]),
    {name:'brakes',val:bBrakeEntry??0},{name:'damping',val:bDampBias??0}
  ];
  // Sort by magnitude so dominant driver appears first
  const sorted=[...contributors].sort((a,b)=>Math.abs(b.val)-Math.abs(a.val));
  const dom=sorted[0];
  const domBig=Math.abs(dom.val)>2;
  // Actionable tip per dominant contributor
  const domTips={
    springs:   total>0?'Reduce the Mech Balance Target or use CO-SOLVE to balance spring stiffness.':'Raise the Mech Balance Target — springs are biased toward the front.',
    ARB:       total>0?'Reduce the Mech Balance Target or shift ARB Bias toward front-heavy.':'Raise the Mech Balance Target or shift ARB Bias toward rear-heavy.',
    'diff exit':  total>0?'Reduce rear exit lock in the Differential section.':'Increase rear exit lock to add rotation under power.',
    'diff entry': total>0?'Reduce rear entry lock in the Differential section.':'Reduce front entry lock.',
    'diff front': total>0?'Reduce front accel lock in the AWD Differential section.':'Raise front accel lock.',
    'diff rear':  total>0?'Reduce rear accel lock in the AWD Differential section.':'Raise rear accel lock.',
    ...(uiMode==='pro'?{brakes:total>0?'Add more front brake bias to reduce entry rotation.':'Reduce front brake bias to add entry rotation.'}:{}),
    damping:   total>0?'Increase front rebound (Damping Bias toward positive) to resist forward weight transfer.':'Reduce front rebound bias.',
  };
  const tip=abs<3
    ? 'Setup is well balanced.'+(domBig?' Keep an eye on '+dom.name.toUpperCase()+' if the car feels inconsistent.':'')
    : (domBig?(domTips[dom.name]||'Adjust the dominant contributor.'):'Adjust Balance Target or ARB Bias.');
  const hints={
    springs:'Spring roll-stiffness bias vs weight distribution. + = oversteer (rear springs relatively stiffer). − = understeer (front springs relatively stiffer).',
    ARB:'ARB roll-stiffness bias vs weight distribution. + = oversteer (rear ARBs relatively stiffer). − = understeer (front ARBs relatively stiffer).',
    'diff front':'AWD front diff net contribution (accel+decel). Front lock pushes understeer (−). Center split and front weight fraction are factored in.',
    'diff rear':'AWD rear diff net contribution (accel+decel). Rear lock pushes oversteer (+). Center split and rear weight fraction are factored in.',
    'diff exit':diffLayout==='FWD'?'Front accel lock on-throttle exit. Higher lock = more understeer (−).':'Rear accel lock on-throttle exit. Higher lock = more oversteer (+).',
    'diff entry':diffLayout==='FWD'?'Front decel lock off-throttle entry. Higher lock = more entry understeer (−).':'Rear decel lock off-throttle entry. Higher lock = more oversteer on entry (+).',
    brakes:'Brake-balance contribution to entry. High front bias = understeer on entry (−). Low front bias (rear-biased) = oversteer tendency (+). Based on deviation from 50% neutral.',
    damping:'Damping bias contribution. More front rebound damping resists weight transfer off the front, producing understeer tendency (−). More rear damping does the opposite (+).',
  };
  const labelMap={'diff front':'DIFF F','diff rear':'DIFF R','diff exit':'DIFF EXIT','diff entry':'DIFF ENTRY','brakes':'BRAKES','damping':'DAMP'};
  const mechGroup=contributors.filter(c=>c.name==='springs'||c.name==='ARB')
    .sort((a,b)=>Math.abs(b.val)-Math.abs(a.val));
  const dynGroup=contributors.filter(c=>c.name!=='springs'&&c.name!=='ARB')
    .sort((a,b)=>Math.abs(b.val)-Math.abs(a.val));
  const GroupSection=({title,items})=>items.length===0?null:(
    <div style={{marginBottom:6}}>
      <div style={{fontSize:9,color:'#475569',letterSpacing:2,marginBottom:3,paddingBottom:2,
                   borderBottom:'1px solid #0f172a'}}>{title}</div>
      {items.map(({name,val})=>{
        const isDom=name===dom.name&&domBig;
        return <BiasSeg key={name} label={labelMap[name]??(name.toUpperCase())} val={val}
          hint={hints[name]??''} primary={isDom} total={total}/>;
      })}
    </div>
  );
  return(
    <div>
      {mechBalance!=null&&
        <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',
                     marginBottom:10,padding:'6px 10px',background:'#020617',
                     border:'1px solid #1e293b',borderRadius:2}}>
          <span style={{fontSize:10,color:'#94a3b8',letterSpacing:2}}>MECH BALANCE</span>
          <div style={{display:'flex',alignItems:'baseline',gap:6}}>
            <span style={{fontFamily:'Courier New',fontSize:16,fontWeight:700,color:'#e2e8f0',lineHeight:1}}>
              {mechBalance.toFixed(2)}
            </span>
            <span style={{fontSize:10,color:'#94a3b8',letterSpacing:1}}>0=FRONT · 1=REAR</span>
          </div>
        </div>}
      {/* tip first — most actionable info at the top */}
      <div style={{fontSize:11,color:'#94a3b8',lineHeight:1.6,padding:'6px 8px',marginBottom:8,
                   background:'#020617',borderRadius:2,border:'1px solid #0f172a'}}>{tip}</div>
      {/* contributors grouped: MECHANICAL (intentional setup) vs DYNAMIC (phase/behaviour) */}
      <GroupSection title="MECHANICAL" items={mechGroup}/>
      <GroupSection title="DYNAMIC" items={dynGroup}/>
      {/* grip balance context — physical at-limit tendency from LLT model */}
      {gripBalance!=null&&Math.abs(gripBalance-0.5)>0.03&&<div style={{
          fontSize:10,color:'#4b5563',lineHeight:1.5,marginBottom:6,
          padding:'4px 8px',borderLeft:'2px solid #1e293b'}}>
        GRIP BIAS {gripBalance.toFixed(2)} — physical handling at limit
        {gripBalance<0.45?' (understeer-prone chassis — more suspension correction needed for neutral limit balance)':
         gripBalance>0.55?' (oversteer-prone chassis — less correction needed to achieve rotation)':''}
      </div>}
      <div style={{fontSize:10,color:'#475569',lineHeight:1.5,marginTop:4}}>
        Roll-stiffness and differential contributions. Alignment also affects balance.
      </div>
    </div>
  );
};
