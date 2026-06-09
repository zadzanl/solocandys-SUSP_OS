const Hint=({text})=>{
  const[pos,setPos]=useState(null);
  const ref=useRef(null);
  const isTouch=useRef(false);

  const calcPos=()=>{
    if(!ref.current)return null;
    const r=ref.current.getBoundingClientRect();
    const PAD=8,GAP=6;
    const TW=Math.min(260,window.innerWidth-PAD*2);
    const TH=240; // generous estimate — ensures correct above/below decision for long tooltips
    // Prefer below; fall back to above. Clamp both so tooltip never leaves viewport.
    const showBelow=r.bottom+GAP+TH<=window.innerHeight;
    const top=Math.max(PAD,showBelow?r.bottom+GAP:r.top-TH-GAP);
    // Centre on icon, then clamp to viewport edges
    const iconCx=(r.left+r.right)/2;
    const left=Math.max(PAD,Math.min(iconCx-TW/2,window.innerWidth-TW-PAD));
    return{top,left,width:TW};
  };

  const onMouseEnter=()=>{ if(!isTouch.current) setPos(calcPos()); };
  const onMouseLeave=()=>{ if(!isTouch.current) setPos(null); };

  const onClick=e=>{
    isTouch.current=true; // mark as touch device once we see a click from touch
    e.stopPropagation();
    setPos(p=>p?null:calcPos());
  };

  useEffect(()=>{
    if(!pos)return;
    const dismiss=()=>setPos(null);
    const t=setTimeout(()=>document.addEventListener('click',dismiss,{once:true}),10);
    return()=>{clearTimeout(t);document.removeEventListener('click',dismiss);};
  },[pos]);

  return(
    <span ref={ref} style={{display:'inline-block',cursor:'help',WebkitTapHighlightColor:'transparent'}}
          onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}
          onTouchStart={()=>{isTouch.current=true;}}
          onClick={onClick}>
      <span style={{fontSize:10,color:'#94a3b8'}}>ⓘ</span>
      {pos&&ReactDOM.createPortal(
        <div style={{position:'fixed',top:pos.top,left:pos.left,zIndex:1000,width:pos.width??220,
                     background:'#0f172a',border:'1px solid #e2e8f011',borderRadius:2,
                     padding:'7px 9px',fontSize:11,color:'#94a3b8',lineHeight:1.6,
                     pointerEvents:'none',boxShadow:'0 4px 16px #00000088'}}>
          {text}
        </div>,
        document.body
      )}
    </span>
  );
};
