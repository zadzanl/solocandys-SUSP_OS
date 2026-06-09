const Toggle=({label,value,onChange,options,locked=false,onToggleLock=null})=>(
  <div style={{marginBottom:9}}>
    {(label || onToggleLock) && (
      <span style={{fontSize:12,color:'#9ca3af',display:'flex',alignItems:'center',gap:4,marginBottom:3}}>
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
        {label && <span>{label}</span>}
      </span>
    )}
    <div style={{display:'flex',gap:3,opacity: locked ? 0.7 : 1}}>
      {options.map(o=><button key={o.value} className={`tog${value===o.value?' on':''}`}
        disabled={locked}
        style={locked ? {cursor:'not-allowed'} : undefined}
        onClick={()=>!locked&&onChange(o.value)}>{o.label}</button>)}
    </div>
  </div>
);
