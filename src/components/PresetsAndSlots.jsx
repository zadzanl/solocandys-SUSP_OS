
const PRESET_SAVES=(()=>{
  const ref=Math.round(cornerMasses(DEF_CH).front);
  return{
    1:{name:'STREET',refCornerMassF:ref,notes:'',
       fe:{...DEF_FE,rideStiffness:1.64,rearHzMode:'multiplier',rearHzMultiplier:1.15,
           reboundZeta:60,bumpRatio:50,dampingBias:8},
       dr:{...DEF_DR,buildType:'street',diffBiasExit:-10,diffBiasEntry:10}},
    2:{name:'TRACK',refCornerMassF:ref,notes:'',
       fe:{...DEF_FE,rideStiffness:2.29,rearHzMode:'multiplier',rearHzMultiplier:1.05,
           reboundZeta:72,bumpRatio:58,dampingBias:12},
       dr:{...DEF_DR,buildType:'track',diffBiasExit:5,diffBiasEntry:0}},
    3:{name:'RALLY',refCornerMassF:ref,notes:'',
       fe:{...DEF_FE,rideStiffness:1.29,rearHzMode:'multiplier',rearHzMultiplier:1.35,
           reboundZeta:65,bumpRatio:45,dampingBias:-12},
       dr:{...DEF_DR,buildType:'street',diffBiasExit:-5,diffBiasEntry:-15}},
    4:{name:'DRIFT',refCornerMassF:ref,notes:'',
       fe:{...DEF_FE,rideStiffness:1.39,rearHzMode:'multiplier',rearHzMultiplier:1.30,
           reboundZeta:63,bumpRatio:46,dampingBias:15},
       dr:{...DEF_DR,buildType:'drift',layout:'RWD',
           diffBiasExit:22,diffBiasEntry:-18,diffRearAccel:65,diffRearDecel:15}},
    5:{name:'MOTORSPT',refCornerMassF:ref,notes:'',
       fe:{...DEF_FE,rideStiffness:2.83,rearHzMode:'multiplier',rearHzMultiplier:0.95,
           reboundZeta:77,bumpRatio:62,dampingBias:18},
       dr:{...DEF_DR,buildType:'track',diffBiasExit:10,diffBiasEntry:-5}},
    6:{name:'X COUNTRY',refCornerMassF:ref,notes:'',
       fe:{...DEF_FE,rideStiffness:0.98,rearHzMode:'multiplier',rearHzMultiplier:1.22,
           reboundZeta:55,bumpRatio:40,dampingBias:0},
       dr:{...DEF_DR,buildType:'street'}},
  };
})();

const useTwoTap=(callback,delay=2000)=>{
  const[pending,setPending]=useState(false);
  const timer=useRef(null);
  useEffect(()=>()=>clearTimeout(timer.current),[]);
  const handle=()=>{
    if(pending){clearTimeout(timer.current);setPending(false);callback();}
    else{setPending(true);timer.current=setTimeout(()=>setPending(false),delay);}
  };
  return[pending,handle];
};

const PresetBtn=({name,onLoad})=>{
  const[pending,handle]=useTwoTap(onLoad);
  return(
    <button className="tbtn"
      style={{fontSize:10,padding:'5px 2px',textAlign:'center',
              ...(pending?{borderColor:'#f59e0b88',color:'#f59e0b'}:{})}}
      onClick={handle}
      title={pending?`Click again to load ${name}`:`Load ${name} preset`}>
      {pending?'SURE?':name}
    </button>
  );
};

const IconBtn=({onClick,color='#94a3b8',activeBorder,activeColor,title,char,active=false,style:xStyle={}})=>
  <button onClick={onClick}
    style={{background:'none',border:`1px solid ${active?activeBorder:'#1e293b'}`,borderRadius:2,
            color:active?activeColor:color,cursor:'pointer',fontSize:10,
            padding:0,lineHeight:'22px',flexShrink:0,transition:'color .12s,border-color .12s',...xStyle}}
    title={title}>{char}</button>;

const SaveSlot=({i,s,onLoad,onSave,onClear,onRename,onNotes,onSaveOver,onResetDefault})=>{
  const[editing,setEditing]=useState(false);
  const[draft,setDraft]=useState('');
  const[pendingLoad,handleLoad]=useTwoTap(onLoad);
  const[pendingClear,handleClear]=useTwoTap(onClear);
  const[pendingOver,handleOver]=useTwoTap(onSaveOver);
  const[pendingReset,handleReset]=useTwoTap(onResetDefault);
  const inputRef=useRef(null);

  const startEdit=e=>{
    e.stopPropagation();
    setDraft(s.name);
    setEditing(true);
    setTimeout(()=>{inputRef.current?.select();},10);
  };
  const commit=()=>{
    const name=draft.trim().slice(0,12)||s.name;
    onRename(i,name);
    setEditing(false);
  };

  const btnRow={display:'flex',gap:2,width:'100%'};
  const iconStyle={flex:1,lineHeight:'20px',textAlign:'center'};

  if(!s) return(
    <button className="tbtn" style={{fontSize:11,color:'#94a3b8',borderStyle:'dashed',width:'100%',padding:'10px 8px'}}
      onClick={onSave} title={`Save current tune to slot ${i}`}>
      + {i}
    </button>
  );

  const notesTip=s.notes?` — ${s.notes}`:'';
  return(
    <div style={{display:'flex',flexDirection:'column',gap:2,width:'100%'}}>
      {editing
        ? <input ref={inputRef} autoFocus
            value={draft} onChange={e=>setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={e=>{if(e.key==='Enter')commit();if(e.key==='Escape'){setEditing(false);}}}
            style={{width:'100%',background:'#0a0f1a',border:'1px solid #e2e8f033',borderRadius:2,
                    color:'#e2e8f0',fontFamily:'Courier New',fontSize:11,padding:'7px 8px',
                    outline:'none',textTransform:'uppercase',boxSizing:'border-box'}}/>
        : <button className="tbtn saved"
            style={{fontSize:11,width:'100%',padding:'9px 8px',overflow:'hidden',
                    textOverflow:'ellipsis',whiteSpace:'nowrap',
                    ...(pendingLoad?{borderColor:'#f59e0b88',color:'#f59e0b'}:{})}}
            onClick={handleLoad} title={pendingLoad?`Click again to load ${s.name}`:`${s.name}${notesTip}`}>
            {pendingLoad?'SURE?':s.name.slice(0,12).toUpperCase()}
          </button>}
      <div style={btnRow}>
        <IconBtn onClick={startEdit} title="Rename" char="✎" style={iconStyle}/>
        <IconBtn
          onClick={()=>{const n=prompt('Notes (shown on hover):',s.notes??'');if(n!==null)onNotes(i,n.slice(0,80));}}
          color={s.notes?'#60a5fa':'#94a3b8'} activeBorder="#60a5fa44" activeColor="#60a5fa"
          title={s.notes||'Add notes'} char="ⓘ" active={!!s.notes} style={iconStyle}/>
        <IconBtn onClick={handleOver} activeBorder="#34d39944" activeColor="#34d399"
          title={pendingOver?'Click again to overwrite with current tune':'Overwrite with current tune'}
          char="↺" active={pendingOver} style={iconStyle}/>
        <IconBtn onClick={handleReset} activeBorder="#818cf844" activeColor="#818cf8"
          title={pendingReset?'Click again to restore default preset':'Reset to default preset'}
          char="↩" active={pendingReset} style={iconStyle}/>
        <IconBtn onClick={handleClear} activeBorder="#f59e0b44" activeColor="#f59e0b"
          title={pendingClear?'Click again to clear':'Clear slot'}
          char={pendingClear?'✓':'✕'} active={pendingClear} style={iconStyle}/>
      </div>
    </div>
  );
};
