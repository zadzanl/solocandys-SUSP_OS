
const mergeDefaults=(initial,parsed)=>
  (initial&&typeof initial==='object'&&!Array.isArray(initial)
    &&parsed&&typeof parsed==='object'&&!Array.isArray(parsed))
    ?{...initial,...parsed}:parsed;
const usePersist=(key,initial)=>{
  const[val,setVal]=useState(()=>{
    try{const s=localStorage.getItem(key);
      return s?mergeDefaults(initial,JSON.parse(s)):initial;}
    catch(e){return initial;} // private browsing or parse error — use defaults
  });
  const set=v=>{
    const next=typeof v==='function'?v(val):v;
    setVal(next);
    try{localStorage.setItem(key,JSON.stringify(next));}catch{}
  };
  return[val,set];
};

const DEF_AL={alignManual:false,
              camberF:-2.3,camberR:-1.8,toeF:-0.1,toeR:0.1,caster:5.5};
const BRAKE_BIAS_SCALE=0.20;

const CAR_DATABASE = {
  "2351": { name: "1965 Lotus Cortina", weight: 1699, frontBias: 51, layout: "RWD" },
  "1234": { name: "2019 Porsche 911 GT3 RS", weight: 3150, frontBias: 40, layout: "RWD" },
  "5678": { name: "2020 Chevrolet Corvette Stingray", weight: 3647, frontBias: 40, layout: "RWD" },
  "1066": { name: "2021 Ford Bronco", weight: 4500, frontBias: 52, layout: "AWD" }
};

const getMedian = (arr) => {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};


class ErrorBoundary extends React.Component{
  constructor(p){super(p);this.state={err:null};}
  static getDerivedStateFromError(e){return{err:e};}
  render(){
    if(this.state.err)return(
      <div style={{padding:24,color:'#ef4444',fontFamily:'Courier New',fontSize:12,background:'#020617',minHeight:'100vh'}}>
        <div style={{marginBottom:8,color:'#e2e8f0',fontSize:14}}>SUSP.OS — Failed to load</div>
        <div style={{marginBottom:16,color:'#94a3b8'}}>An error occurred. Try reloading the page.</div>
        <div style={{background:'#0f172a',padding:12,borderRadius:4,border:'1px solid #1e293b',
                     whiteSpace:'pre-wrap',wordBreak:'break-all',lineHeight:1.6}}>
          {this.state.err.toString()}
        </div>
        <button onClick={()=>window.location.reload()}
          style={{marginTop:16,padding:'8px 16px',background:'#0f172a',border:'1px solid #1e293b',
                  color:'#e2e8f0',borderRadius:4,cursor:'pointer',fontFamily:'Courier New',fontSize:12}}>
          RELOAD
        </button>
      </div>
    );
    return this.props.children;
  }
}

// ────────────────────────────────────────────────────────────────────────────
function App(){
  const[ch,setCh]=usePersist('suspos_ch_v8',DEF_CH);
  const[fe,setFe]=usePersist('suspos_fe_v8',DEF_FE);
  const[dr,setDr]=usePersist('suspos_dr_v8',DEF_DR);
  const[al,setAl]=usePersist('suspos_al_v2',DEF_AL);
  const[br,setBr]=usePersist('suspos_br_v1',DEF_BR);
  const[metricUnits,setMetricUnits]=usePersist('suspos_units_v1',false);
  const[saves,setSaves]=usePersist('suspos_saves_v9',PRESET_SAVES);
  const[uiMode,setUiMode]=usePersist('suspos_uimode_v1','beginner');
  const[uiZoom,setUiZoom]=usePersist('suspos_zoom_v1',1.1);
  const[fieldSources,setFieldSources]=usePersist('suspos_sources_v1',{}); // {field: {source,confidence,appliedAt}}

  // Startup restored mapping
  useEffect(() => {
    setFieldSources(prev => {
      let changed = false;
      const next = { ...prev };
      Object.keys(next).forEach(k => {
        const entry = next[k];
        if (entry && ['parsed', 'lookup', 'estimated'].includes(entry.source)) {
          next[k] = { ...entry, source: 'restored' };
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, []);

  // ── Telemetry state model ──────────────────────────────────────────────────
  // Bridge: transport connection status
  const[bridgeStatus,setBridgeStatus]=useState('disconnected'); // disconnected|connecting|connected
  // Packet: UDP data availability (separate from bridge)
  const[packetStatus,setPacketStatus]=useState('idle'); // idle|waiting|receiving|stale
  const[telemetryUrl,setTelemetryUrl]=useState('http://localhost:5601/telemetry');
  const[lastPacket,setLastPacket]=useState(null);       // most recent parsed packet
  const lastPacketRef=useRef(null);
  useLayoutEffect(()=>{lastPacketRef.current=lastPacket;},[lastPacket]);
  // Packet diagnostics
  const[packetDiag,setPacketDiag]=useState({count:0,lastAt:null,format:null,warning:null,staleCount:0,rate:0,packetLength:null});
  const packetTimestampsRef = useRef([]);
  // Capture state
  const[captureStatus,setCaptureStatus]=useState('inactive'); // inactive|active|complete|insufficient|cancelled
  const[captureSamples,setCaptureSamples]=useState([]);       // weight estimation samples
  const[capturePeakHp,setCapturePeakHp]=useState(0);
  const[capturePeakTorque,setCapturePeakTorque]=useState(0);
  const[captureCarOrdinal,setCaptureCarOrdinal]=useState(null);
  const[captureMaxRpm,setCaptureMaxRpm]=useState(0);
  const[capturePeakSpeed,setCapturePeakSpeed]=useState(0);
  const[selectedCandidates,setSelectedCandidates]=useState({});
  // Refs for capture state (avoids stale closures in setTimeout)
  const capturePeakHpRef=useRef(0);
  const capturePeakTorqueRef=useRef(0);
  const captureMaxRpmRef=useRef(0);
  const captureCarOrdinalRef=useRef(null);
  const capturePeakSpeedRef=useRef(0);
  useLayoutEffect(()=>{capturePeakHpRef.current=capturePeakHp;},[capturePeakHp]);
  useLayoutEffect(()=>{capturePeakTorqueRef.current=capturePeakTorque;},[capturePeakTorque]);
  useLayoutEffect(()=>{captureMaxRpmRef.current=captureMaxRpm;},[captureMaxRpm]);
  useLayoutEffect(()=>{captureCarOrdinalRef.current=captureCarOrdinal;},[captureCarOrdinal]);
  useLayoutEffect(()=>{capturePeakSpeedRef.current=capturePeakSpeed;},[capturePeakSpeed]);
  // Snapshot state
  const[pendingSnapshot,setPendingSnapshot]=useState(null);   // {candidates, capturedAt, carOrdinal}
  const pendingSnapshotRef=useRef(null);
  useLayoutEffect(()=>{pendingSnapshotRef.current=pendingSnapshot;},[pendingSnapshot]);
  const[appliedSnapshot,setAppliedSnapshot]=useState(null);   // {values, sources, appliedAt}
  const appliedSnapshotRef=useRef(null);
  useLayoutEffect(()=>{appliedSnapshotRef.current=appliedSnapshot;},[appliedSnapshot]);

  // Initialize selectedCandidates when pendingSnapshot changes
  useEffect(() => {
    if (pendingSnapshot) {
      const initial = {};
      pendingSnapshot.candidates.forEach(c => {
        initial[c.field] = c.value != null && c.source !== 'unavailable';
      });
      setSelectedCandidates(initial);
    } else {
      setSelectedCandidates({});
    }
  }, [pendingSnapshot]);
  // Refs for capture timing
  const captureTimerRef=useRef(null);
  const staleTimerRef=useRef(null);
  const captureSamplesRef=useRef(captureSamples);
  useLayoutEffect(()=>{captureSamplesRef.current=captureSamples;},[captureSamples]);
  const captureStatusRef=useRef(captureStatus);
  useLayoutEffect(()=>{captureStatusRef.current=captureStatus;},[captureStatus]);

  const handleTelemetryToggle = () => {
    if (bridgeStatus === 'disconnected') {
      setBridgeStatus('connecting');
      setPacketStatus('idle');
      setCaptureStatus('inactive');
      setPendingSnapshot(null);
    } else {
      setBridgeStatus('disconnected');
      setPacketStatus('idle');
      setCaptureStatus('inactive');
      setLastPacket(null);
      setPendingSnapshot(null);
      setPacketDiag({count:0,lastAt:null,format:null,warning:null,staleCount:0,rate:0,packetLength:null});
      packetTimestampsRef.current = [];
    }
  };

  // ── Helpers ────────────────────────────────────────────────────────────────
  const STALE_TIMEOUT=4000;       // ms without a packet before marking stale
  const CAPTURE_DURATION=8000;    // ms capture window
  const CAPTURE_MIN_SAMPLES=8;    // minimum weight samples for confident estimate

  const stopCapture=(reason)=>{
    if(captureTimerRef.current){clearTimeout(captureTimerRef.current);captureTimerRef.current=null;}
    if(staleTimerRef.current){clearTimeout(staleTimerRef.current);staleTimerRef.current=null;}
    const status=captureStatusRef.current;
    if(status!=='active')return;
    if(reason==='cancelled'){
      setCaptureStatus('cancelled');
      setCaptureSamples([]);
      setCapturePeakHp(0);
      setCapturePeakTorque(0);
      setCaptureMaxRpm(0);
      setCapturePeakSpeed(0);
      setPendingSnapshot(null);
      return;
    }
    const samples=captureSamplesRef.current;
    // Generate pending snapshot from captured samples
    const medianWeight=samples.length>=CAPTURE_MIN_SAMPLES?getMedian(samples):null;
    const pkt=lastPacketRef.current;
    const candidates=buildSnapshotCandidates(pkt,medianWeight,samples.length,
      capturePeakHpRef.current,capturePeakTorqueRef.current,captureMaxRpmRef.current,captureCarOrdinalRef.current,capturePeakSpeedRef.current);
    if(candidates.length>0){
      setCaptureStatus('complete');
      setPendingSnapshot({candidates,capturedAt:Date.now(),carOrdinal:captureCarOrdinalRef.current});
    }else{
      setCaptureStatus('insufficient');
    }
  };

  const buildSnapshotCandidates=(pkt,medianWeight,sampleCount,peakHp,peakTorque,maxRpm,carOrdinal,peakSpeed)=>{
    if(!pkt)return[];
    const candidates=[];
    const dbCar=carOrdinal!=null?CAR_DATABASE[String(carOrdinal)]:null;
    // Car name (lookup)
    if(dbCar){
      candidates.push({field:'carName',value:dbCar.name,source:'lookup',confidence:'medium',explanation:'Matched by CarOrdinal in local database.'});
    }else if(carOrdinal!=null){
      candidates.push({field:'carName',value:`Car #${carOrdinal}`,source:'parsed',confidence:'low',explanation:'CarOrdinal not found in local database.'});
    }
    // Layout (parsed or lookup)
    const layouts=['FWD','RWD','AWD'];
    const parsedLayout=layouts[pkt.DrivetrainType]||null;
    if(dbCar&&dbCar.layout){
      candidates.push({field:'layout',value:dbCar.layout,source:'lookup',confidence:'medium',explanation:'Layout from database lookup.'});
    }else if(parsedLayout){
      candidates.push({field:'layout',value:parsedLayout,source:'parsed',confidence:'medium',explanation:'Layout parsed from telemetry DrivetrainType.'});
    }else{
      candidates.push({field:'layout',value:null,source:'unavailable',confidence:'unknown',explanation:'Layout not available — enter manually.'});
    }
    // Weight (estimated or lookup)
    if(medianWeight!=null&&sampleCount>=CAPTURE_MIN_SAMPLES){
      const conf=sampleCount>=30?'medium':'low';
      candidates.push({field:'weight',value:Math.round(medianWeight),source:'estimated',confidence:conf,explanation:`Median of ${sampleCount} samples during capture window.`});
    }else if(dbCar&&dbCar.weight){
      candidates.push({field:'weight',value:dbCar.weight,source:'lookup',confidence:'low',explanation:'Stock weight from database — may differ from upgraded weight.'});
    }else{
      candidates.push({field:'weight',value:null,source:'unavailable',confidence:'unknown',explanation:'Insufficient samples for estimate. Enter manually.'});
    }
    // Front bias (lookup only — not directly in telemetry)
    if(dbCar&&dbCar.frontBias!=null){
      candidates.push({field:'frontBias',value:dbCar.frontBias,source:'lookup',confidence:'low',explanation:'Stock front bias from database — may differ from upgraded.'});
    }else{
      candidates.push({field:'frontBias',value:null,source:'unavailable',confidence:'unknown',explanation:'Front bias not available from telemetry. Enter manually.'});
    }
    // Max RPM (parsed)
    if(pkt.EngineMaxRpm>0){
      candidates.push({field:'maxRpm',value:Math.round(pkt.EngineMaxRpm),source:'parsed',confidence:'high',explanation:'Direct from telemetry EngineMaxRpm field.'});
    }else{
      candidates.push({field:'maxRpm',value:null,source:'unavailable',confidence:'unknown',explanation:'Max RPM not available.'});
    }
    // Peak power (parsed)
    if(peakHp>0){
      candidates.push({field:'peakPower',value:Math.round(peakHp),source:'parsed',confidence:'high',explanation:'Peak horsepower observed during capture.'});
    }
    // Peak torque (parsed)
    if(peakTorque>0){
      candidates.push({field:'peakTorque',value:Math.round(peakTorque),source:'parsed',confidence:'high',explanation:'Peak torque observed during capture.'});
    }
    // Peak speed (parsed)
    if(peakSpeed>0){
      const speedVal = metricUnits ? (peakSpeed / KMH_PER_MPH) : (peakSpeed / MPH_TO_MS);
      candidates.push({field:'peakSpeed',value:Math.round(speedVal),source:'parsed',confidence:'high',explanation:`Peak speed observed during capture, converted to ${metricUnits?'km/h':'mph'}.`});
    }
    // Mark unavailable direct fields
    candidates.push({field:'springRate',value:null,source:'unavailable',confidence:'unknown',explanation:'Spring rates not provided by Data Out.'});
    candidates.push({field:'damping',value:null,source:'unavailable',confidence:'unknown',explanation:'Damping settings not provided by Data Out.'});
    candidates.push({field:'arb',value:null,source:'unavailable',confidence:'unknown',explanation:'ARB settings not provided by Data Out.'});
    candidates.push({field:'brakeBalance',value:null,source:'unavailable',confidence:'unknown',explanation:'Brake balance not provided by Data Out.'});
    candidates.push({field:'diffSettings',value:null,source:'unavailable',confidence:'unknown',explanation:'Differential settings not provided by Data Out.'});
    return candidates;
  };

  const applySnapshot=(selectedFields)=>{
    const snap=pendingSnapshot;
    if(!snap)return;
    const sources={};
    const candMap={};
    snap.candidates.forEach(c=>{candMap[c.field]=c;});
    // Apply each selected field once
    selectedFields.forEach(field=>{
      const c=candMap[field];
      if(!c||c.value==null)return;
      switch(field){
        case 'weight':setCh(p=>({...p,weight:c.value}));sources.weight=c;break;
        case 'frontBias':setCh(p=>({...p,frontBias:c.value}));sources.frontBias=c;break;
        case 'layout':setDr(p=>({...p,layout:c.value}));sources.layout=c;break;
        case 'maxRpm':case 'peakPower':case 'peakTorque':case 'carName':case 'peakSpeed':
          // Informational only — stored in applied snapshot metadata
          sources[field]=c;break;
      }
    });
    setAppliedSnapshot({values:selectedFields.reduce((a,f)=>{a[f]=candMap[f]?.value;return a;},{}),
                        sources,appliedAt:Date.now()});
    // Persist source metadata
    const persistSources={};
    Object.entries(sources).forEach(([k,c])=>{persistSources[k]={source:c.source,confidence:c.confidence,appliedAt:Date.now()};});
    setFieldSources(p=>({...p,...persistSources}));
    setPendingSnapshot(null);
    setCaptureStatus('inactive');
    setCaptureSamples([]);
    setCapturePeakHp(0);
    setCapturePeakTorque(0);
    setCapturePeakSpeed(0);
  };

  const cancelSnapshot=()=>{
    setPendingSnapshot(null);
    setCaptureStatus('inactive');
    setCaptureSamples([]);
    setCapturePeakHp(0);
    setCapturePeakTorque(0);
    setCapturePeakSpeed(0);
  };

  const startRecapture=()=>{
    setCaptureStatus('active');
    setCaptureSamples([]);
    setCapturePeakHp(0);
    setCapturePeakTorque(0);
    setCaptureMaxRpm(0);
    setCapturePeakSpeed(0);
    setCaptureCarOrdinal(lastPacketRef.current?.CarOrdinal??null);
    setPendingSnapshot(null);
    if(captureTimerRef.current)clearTimeout(captureTimerRef.current);
    captureTimerRef.current=setTimeout(()=>stopCapture('timeout'),CAPTURE_DURATION);
  };

  // SSE Connection + Capture logic
  useEffect(() => {
    if (bridgeStatus !== 'connecting' && bridgeStatus !== 'connected') return;
    // If already connected and re-running due to URL change, skip re-creation
    // (the EventSource handles reconnection internally)

    let es;
    try {
      es = new EventSource(telemetryUrl);
      
      es.onopen = () => {
        setBridgeStatus('connected');
        setPacketStatus('waiting');
        setPacketDiag(p=>({...p,count:0,lastAt:null,format:null,warning:null,staleCount:0,rate:0,packetLength:null}));
        packetTimestampsRef.current = [];
      };

      es.onerror = () => {
        setBridgeStatus('disconnected');
        setPacketStatus('idle');
        if(es)es.close();
      };

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const now=Date.now();
          setLastPacket(data);

          // Calculate packet rate over a rolling window of the last 20 packet timestamps
          packetTimestampsRef.current.push(now);
          if (packetTimestampsRef.current.length > 20) {
            packetTimestampsRef.current.shift();
          }
          let hz = 0;
          if (packetTimestampsRef.current.length > 1) {
            const duration = (packetTimestampsRef.current[packetTimestampsRef.current.length - 1] - packetTimestampsRef.current[0]) / 1000;
            if (duration > 0) {
              hz = (packetTimestampsRef.current.length - 1) / duration;
            }
          }

          setPacketDiag(p=>({...p,
            count:p.count+1,
            lastAt:now,
            format:data.parserLabel||null,
            warning:data.parserWarning||null,
            staleCount:0,
            rate:hz,
            packetLength:data.packetLength||null
          }));
          setPacketStatus('receiving');
          // Reset stale timer
          if(staleTimerRef.current)clearTimeout(staleTimerRef.current);
          staleTimerRef.current=setTimeout(()=>{
            setPacketStatus('stale');
            setPacketDiag(p=>({...p,staleCount:(p.staleCount||0)+1}));
          },STALE_TIMEOUT);

          // Packet diagnostics only — NO continuous calculator mutation
          if(!data.packetSupported)return; // Skip unsupported packets

          // Capture logic
          if(data.IsRaceOn){
            const capStat=captureStatusRef.current;
            // Auto-start first-drive capture if no snapshot exists
            if(capStat==='inactive'&&!pendingSnapshotRef.current&&!appliedSnapshotRef.current){
              setCaptureStatus('active');
              setCaptureSamples([]);
              setCapturePeakHp(0);
              setCapturePeakTorque(0);
              setCaptureMaxRpm(0);
              setCapturePeakSpeed(0);
              setCaptureCarOrdinal(data.CarOrdinal??null);
              if(captureTimerRef.current)clearTimeout(captureTimerRef.current);
              captureTimerRef.current=setTimeout(()=>stopCapture('timeout'),CAPTURE_DURATION);
            }
            // Collect data during active capture
            if(capStat==='active'){
              const horsepower=data.Power/745.7;
              const torqueFtLbs=data.Torque*0.73756;
              if(!isNaN(horsepower))setCapturePeakHp(p=>Math.max(p,horsepower));
              if(!isNaN(torqueFtLbs))setCapturePeakTorque(p=>Math.max(p,torqueFtLbs));
              if(data.EngineMaxRpm>0)setCaptureMaxRpm(p=>Math.max(p,data.EngineMaxRpm));
              if(data.CarOrdinal!=null&&captureCarOrdinalRef.current==null)setCaptureCarOrdinal(data.CarOrdinal);
              if(data.Speed!=null&&!isNaN(data.Speed))setCapturePeakSpeed(p=>Math.max(p,data.Speed));
              // Weight estimation samples
              const speedMS=data.Speed;
              const accelZ=data.AccelerationZ;
              const powerW=data.Power;
              if(data.Accel>204&&data.Brake===0&&speedMS>10&&accelZ>0.5&&powerW>0){
                const massKg=powerW/(speedMS*accelZ);
                const weightLbs=massKg*KG_TO_LB;
                setCaptureSamples(p=>{
                  const n=[...p,weightLbs];
                  if(n.length>80)n.shift();
                  if(n.length===80){
                    setTimeout(()=>stopCapture('sample_target'),0);
                  }
                  return n;
                });
              }
            }
          }
        } catch (err) {
          console.error("Failed to parse telemetry message", err);
        }
      };
    } catch (e) {
      console.error("EventSource initialization failed", e);
      setBridgeStatus('disconnected');
    }

    return () => {
      if(es)es.close();
      if(captureTimerRef.current)clearTimeout(captureTimerRef.current);
      if(staleTimerRef.current)clearTimeout(staleTimerRef.current);
    };
  }, [bridgeStatus, telemetryUrl]); // eslint-disable-line
  const bumpZoom=d=>setUiZoom(z=>parseFloat(Math.max(0.7,Math.min(1.6,z+d)).toFixed(2)));
  const[tutSeen,setTutSeen]=usePersist('suspos_tutorial_seen_v1',{beginner:false,intermediate:false,pro:false});
  const[balTutSeen,setBalTutSeen]=usePersist('suspos_baltut_seen_v1',false);
  const[balTutOpen,setBalTutOpen]=useState(false);
  const[balTutStep,setBalTutStep]=useState(0);
  const openBalTut=()=>{setBalTutStep(0);setBalTutOpen(true);};
  const closeBalTut=()=>setBalTutOpen(false);
  const[onboardSeen,setOnboardSeen]=usePersist('suspos_onboard_v1',true);
  const[showComplexity,setShowComplexity]=useState(false);
  const closeOnboard=()=>{setOnboardSeen(true);setShowComplexity(false);};
  const[tutMode,setTutMode]=useState(null);
  const[tutStep,setTutStep]=useState(0);
  const openTut=mode=>{
    setTutMode(mode);setTutStep(0);
    // Step 0 sidebar is driven by its own metadata; default to open for all other guides
    const step0=TUTORIALS[mode]?.[0];
    if(!step0?.sidebar)setSidebarOpen(true);
  };
  const closeTut=()=>setTutMode(null);
  // Called only when user clicks DONE on the last step of the beginner guide
  const closeTutDone=()=>{if(tutMode==='beginner'||tutMode==='intermediate')setShowComplexity(true);closeTut();};
  // Gating: INT requires BEG completion, PRO requires INT completion
  const canAccessMode=m=>{
    if(m==='beginner')return true;
    if(m==='intermediate')return tutSeen.beginner;
    if(m==='pro')return tutSeen.intermediate;
    return false;
  };
  const tryAccessMode=m=>{
    if(canAccessMode(m)){
      setUiMode(m);
    }else{
      // Prerequisites not met: open the first missing tutorial
      const needed=m==='intermediate'?'beginner':'intermediate';
      openTut(needed);
    }
  };
  const tutFocus=tutMode?(TUTORIALS[tutMode]?.[tutStep]?.focus??null):null;
  const dim=(...zones)=>{
    if(!tutMode)return{};
    if(!tutFocus||!zones.some(z=>tutFocus.includes(z)))
      return{opacity:0.12,pointerEvents:'none',transition:'opacity 0.3s ease'};
    return{transition:'opacity 0.3s ease'};
  };
  useEffect(()=>{
    if(!tutSeen[uiMode]){
      setTutSeen(p=>({...p,[uiMode]:true}));
      openTut(uiMode);
    }
  },[uiMode]); // eslint-disable-line
  useEffect(()=>{
    if(!tutMode)return;
    setOpen(p=>({...p,presetsOpen:!!(tutFocus?.includes('presets'))}));
    const stepMeta=TUTORIALS[tutMode]?.[tutStep];
    if(stepMeta?.sidebar==='close')setSidebarOpen(false);
    else if(stepMeta?.sidebar==='open')setSidebarOpen(true);
  },[tutMode,tutStep]); // eslint-disable-line
  const[loadMode,setLoadMode]=useState('all'); // 'all'=feel+drivetrain, 'fe'=feel only
  const[open,setOpen]=useState({telemetryOpen:false,chassis:true,build:true,ride:true,dampers:true,arb:true,alignment:true,drivetrain:true,brakes:true,balanceExpanded:false,presetsOpen:false});
  const[showChecker,setShowChecker]=useState(false);
  const[showResetModal,setShowResetModal]=useState(false);
  const[resetConfirmText,setResetConfirmText]=useState('');
  const[resetOpts,setResetOpts]=useState({tune:false,tutorials:false});
  const[hzDraft,setHzDraft]=useState(null);     // transient: direct front Hz entry
  const[rearHzDraft,setRearHzDraft]=useState(null); // transient: direct rear Hz entry (independent mode)
  const[sidebarOpen,setSidebarOpen]=useState(true);
  const[isMobile,setIsMobile]=useState(false);
  const[isPhone,setIsPhone]=useState(()=>window.innerWidth<480);
  // Phone footer collapses to a one-line summary by default; tap to reveal the full bars.
  // Initialised once from the launch width so resizes/address-bar jiggle don't reset it.
  const[footerOpen,setFooterOpen]=useState(()=>window.innerWidth>=480);
  const[windowWidth,setWindowWidth]=useState(window.innerWidth);
  useEffect(()=>{
    const preload=document.getElementById('pre-load');
    if(preload)preload.style.display='none';
    const check=()=>{
      const w=window.innerWidth;
      const mobile=w<768;
      setIsMobile(mobile);
      setIsPhone(w<480);
      setWindowWidth(w);
      setSidebarOpen(!mobile);
    };
    check();
    window.addEventListener('resize',check);
    return()=>window.removeEventListener('resize',check);
  },[]);
  // Auto-scale chassis geometry with weight in BEG/INT modes
  useEffect(()=>{
    if(uiMode==='pro')return;
    const r=ch.weight/DEF_CH.weight; // weight ratio vs default 3200 lb
    const r5=v=>Math.round(v/0.005)*0.005; // round to nearest 5 mm
    setCh(p=>({...p,
      wheelbase: r5(DEF_CH.wheelbase * Math.pow(r,0.20)),
      trackF:    r5(DEF_CH.trackF    * Math.pow(r,0.15)),
      trackR:    r5(DEF_CH.trackR    * Math.pow(r,0.15)),
      cgHeight:  r5(DEF_CH.cgHeight  * Math.pow(r,0.25)),
    }));
  },[ch.weight,uiMode]); // eslint-disable-line
  // Enter CO-SOLVE mode automatically in beginner mode
  useEffect(()=>{
    if(uiMode!=='beginner')return;
    setFe(p=>({...p,
      arbBalMode:'coSolve',
      arbBalTarget:Math.max(0.50,Math.min(0.80,0.65-(p.arbBias??0)*0.003)),
    }));
  },[uiMode]); // eslint-disable-line

  // sidebar grows with the display: 300px baseline, up to 440px at very wide screens.
  const sidebarWidth=isMobile?300:Math.min(440,Math.max(300,Math.floor(windowWidth*0.25)));

  const pCh=k=>v=>{
    setCh(p=>({...p,[k]:v}));
    if (k === 'weight' || k === 'frontBias') {
      setFieldSources(p => ({
        ...p,
        [k]: { source: 'manual', confidence: 'high', appliedAt: Date.now() }
      }));
    }
  };
  const pFe=k=>v=>setFe(p=>({...p,[k]:v}));
  const pDr=k=>v=>{
    setDr(p=>({...p,[k]:v}));
    if (k === 'layout') {
      setFieldSources(p => ({
        ...p,
        [k]: { source: 'manual', confidence: 'high', appliedAt: Date.now() }
      }));
    }
  };
  const pAl=k=>v=>setAl(p=>({...p,[k]:v}));
  const pBr=k=>v=>setBr(p=>({...p,[k]:v}));
  const tog=k=>()=>setOpen(p=>({...p,[k]:!p[k]}));

  // ─── Undo history ───────────────────────────────────────────────────────────
  const historyRef=useRef([]);
  const snapTimerRef=useRef(null);
  const undoingRef=useRef(false);
  const[histLen,setHistLen]=useState(0);
  useEffect(()=>{
    if(undoingRef.current){undoingRef.current=false;return;}
    clearTimeout(snapTimerRef.current);
    snapTimerRef.current=setTimeout(()=>{
      const snap={ch,fe,dr,al,br};
      const hist=historyRef.current;
      if(hist.length>0&&JSON.stringify(hist[hist.length-1])===JSON.stringify(snap))return;
      hist.push(snap);
      if(hist.length>50)hist.shift();
      setHistLen(hist.length);
    },600);
    return()=>clearTimeout(snapTimerRef.current);
  },[ch,fe,dr,al,br]); // eslint-disable-line
  const undo=()=>{
    const hist=historyRef.current;
    if(hist.length<2)return;
    hist.pop();
    const prev=hist[hist.length-1];
    undoingRef.current=true;
    setHistLen(hist.length);
    setCh(prev.ch);setFe(prev.fe);setDr(prev.dr);setAl(prev.al);setBr(prev.br);
  };
  const canUndo=histLen>=2;

  const cm=useMemo(()=>cornerMasses(ch),[ch]);
  const dispMass=kg=>metricUnits?`${Math.round(kg)} kg`:`${Math.round(kg/KG_TO_LB)} lb`;
  const physics=useMemo(()=>feelToPhysics(ch,fe),[ch,fe]);
  const tune=useMemo(()=>computeTune(ch,physics,fe.gameMode),[ch,physics,fe.gameMode]);
  const autoAlign=useMemo(()=>computeAlignment(ch,tune,dr.layout,dr.buildType),[ch,tune,dr.layout,dr.buildType]);
  const align=al.alignManual
    ?{recCamberF:al.camberF,recCamberR:al.camberR,
      recToeF:al.toeF,recToeR:al.toeR,recCaster:al.caster}
    :autoAlign;
  const diff=useMemo(()=>computeDiff(ch,fe,dr),[ch,fe,dr]);
  const recBrakeBias=Math.round(Math.max(45,Math.min(65,
    ch.frontBias+(dr.buildType==='drift'?-8:dr.buildType==='track'?-3:0))));
  const brakeBias=br.brakeManual?(br.brakeBias??DEF_BR.brakeBias):recBrakeBias;
  const brakePressure=br.brakeManual?(br.brakePressure??DEF_BR.brakePressure):100;
  // positive = oversteer, negative = understeer
  const bBrakeEntry=-(brakeBias-50)*BRAKE_BIAS_SCALE; // high front bias → understeer (−)
  const bDampBias=-(fe.dampingBias??0)*0.08; // more front damping → understeer (−)
  const bTotFull=tune.bTot+diff.bDiffAccel+diff.bDiffDecel+bBrakeEntry+bDampBias;
  const lim=GAME_LIMITS[fe.gameMode];
  const responseFactors=(()=>{
    // Agility = transient response character: how quickly and freely the car responds to steering inputs.
    // ARBs and weight bias are excluded — they govern roll moment distribution (Handling Balance bar),
    // not response speed. Research (Milliken, OptimumG) confirms ARBs are a balance tool, not agility.
    const hzNorm=Math.min(1,Math.max(0,(physics.frontHz-HZ_MIN)/(HZ_MAX-HZ_MIN)));
    const dampNorm=Math.min(1,Math.max(0,(physics.reboundZeta-10)/105));
    // Toe range is -0.20° (toe-out, reactive) to +0.20° (toe-in, planted).
    // Old formula used a much wider range and only ever hit 0.20–0.47 of 0–1.
    const TOE_MIN=-0.20,TOE_MAX=0.20;
    const toeNorm=Math.min(1,Math.max(0,(TOE_MAX-(align.recToeF??-0.1))/(TOE_MAX-TOE_MIN)));
    const casterNorm=Math.min(1,Math.max(0,(7.5-(align.recCaster??5.5))/3.5));
    const rearFrontRatio=physics.frontHz>0?physics.rearHz/physics.frontHz:1;
    const rearHzNorm=Math.min(1,Math.max(0,(rearFrontRatio-0.7)/1.1));
    const score=hzNorm*0.50+(1-dampNorm)*0.20+toeNorm*0.15+casterNorm*0.10+rearHzNorm*0.05;
    return{score,hzNorm,dampNorm,toeNorm,casterNorm,rearHzNorm};
  })();

  // Full chassis geometry analysis — equal Hz, no ARBs
  const chassisAnalysis=(()=>{
    const twF=parseTyre(ch.tyreF)?.width??265,twR=parseTyre(ch.tyreR)?.width??265;
    // Natural balance = pure roll-stiffness rear fraction at equal springs, no ARBs.
    // This matches Forza's scale (arbBalTarget is also an rsBalance on this scale).
    const natBal=cm.rear*ch.trackR*ch.trackR/(cm.front*ch.trackF*ch.trackF+cm.rear*ch.trackR*ch.trackR);
    // Stability index: track width × tire width normalised to typical values
    const avgTrack=(ch.trackF+ch.trackR)/2;   // metres
    const avgTire=(twF+twR)/2;                 // mm
    const stabIdx=Math.sqrt((avgTrack/1.6)*(avgTire/265));
    // Recommendation target: co-solve/mech target when active, else neutral 0.50
    const hasMechTarget=fe.arbBalMode==='coSolve'||fe.arbBalMode==='mech';
    const targetBal=hasMechTarget?Math.max(0.40,Math.min(0.90,fe.arbBalTarget??0.55)):0.50;
    // REACH: find track-width changes that bring natural rsBalance toward target.
    // Tyre width affects grip capacity (shown via CHASSIS BAL physical display) but NOT
    // roll-stiffness fraction, so REACH shows track-only recommendations.
    const rsBalOf=o=>{const c={...ch,...o};const mc=cornerMasses(c);
      return mc.rear*c.trackR*c.trackR/(mc.front*c.trackF*c.trackF+mc.rear*c.trackR*c.trackR);};
    const scan=f=>{let best=f.lo,err=Infinity;
      for(let i=0;i<=80;i++){const v=f.lo+(f.hi-f.lo)*i/80;const e=Math.abs(f.bal(v)-targetBal);if(e<err){err=e;best=v;}}return best;};
    const r5=v=>Math.round(v/5)*5;
    const trackF_rec=r5(Math.max(800,Math.min(2200,scan({lo:0.8,hi:2.2,bal:t=>rsBalOf({trackF:t})})*1000)));
    const trackR_rec=r5(Math.max(800,Math.min(2200,scan({lo:0.8,hi:2.2,bal:t=>rsBalOf({trackR:t})})*1000)));
    const trackF_curr=Math.round(ch.trackF*1000),trackR_curr=Math.round(ch.trackR*1000);
    const dTrackF=trackF_rec-trackF_curr,dTrackR=trackR_rec-trackR_curr;
    // Feasibility: track ± 65mm
    const trackFfeas=Math.abs(dTrackF)<=65;
    const trackRfeas=Math.abs(dTrackR)<=65;
    const gap=Math.abs(natBal-targetBal);
    return{natBal,stabIdx,targetBal,hasMechTarget,
           trackF_rec,trackR_rec,dTrackF,dTrackR,trackFfeas,trackRfeas,gap};
  })();
  const natMechBalance=chassisAnalysis.natBal;

  const handleSlot=i=>{
    const s=saves[i];
    if(s){
      let adjustedFe={...DEF_FE,...s.fe};
      if(s.refCornerMassF){
        const scale=Math.sqrt(s.refCornerMassF/cm.front);
        const scaledHz=Math.max(HZ_MIN,Math.min(HZ_MAX,rsToHz(s.fe.rideStiffness)*scale));
        adjustedFe.rideStiffness=hzToRs(scaledHz);
      }
      if(uiMode==='beginner'){
        // Ensure rearHzMode is 'multiplier' for beginner simplicity
        if(!adjustedFe.rearHzMode||adjustedFe.rearHzMode==='independent')adjustedFe.rearHzMode='multiplier';
      }
      setFe(adjustedFe);
      if(loadMode!=='fe') setDr({...DEF_DR,...s.dr});
    }
    else{
      const hz=physics.frontHz.toFixed(2);
      const build=(dr.buildType??'track').toUpperCase();
      setSaves(p=>({...p,[i]:{fe,dr,
        name:`${build} ${hz}`,
        refCornerMassF:Math.round(cm.front),
        notes:''}}));
    }
  };
  const loadPreset=i=>{
    const s=PRESET_SAVES[i];if(!s)return;
    let adjustedFe={...DEF_FE,...s.fe};
    if(s.refCornerMassF){
      const scale=Math.sqrt(s.refCornerMassF/cm.front);
      const scaledHz=Math.max(HZ_MIN,Math.min(HZ_MAX,rsToHz(s.fe.rideStiffness)*scale));
      adjustedFe.rideStiffness=hzToRs(scaledHz);
    }
    if(uiMode==='beginner'){
      adjustedFe.arbBalMode='coSolve';
      adjustedFe.arbBalTarget=Math.max(0.50,Math.min(0.80,0.65-(adjustedFe.arbBias??0)*0.003));
    }
    setFe(adjustedFe);
    if(loadMode!=='fe')setDr({...DEF_DR,...s.dr});
  };
  const clearSlot=i=>setSaves(p=>{const n={...p};delete n[i];return n;});
  const renameSlot=(i,name)=>setSaves(p=>({...p,[i]:{...p[i],name}}));
  const notesSlot=(i,notes)=>setSaves(p=>({...p,[i]:{...p[i],notes}}));
  const overwriteSlot=i=>setSaves(p=>({...p,[i]:{...p[i],fe,dr,refCornerMassF:Math.round(cm.front)}}));
  const resetSlot=i=>setSaves(p=>({...p,[i]:PRESET_SAVES[i]}));
  const performGlobalReset=()=>{
    if(resetOpts.tune){
      setCh({...DEF_CH});
      setFe({...DEF_FE});
      setDr({...DEF_DR});
      setAl({...DEF_AL});
      setBr({...DEF_BR});
    }
    if(resetOpts.tutorials)setTutSeen({beginner:false,intermediate:false,pro:false});
    setShowResetModal(false);
    setResetConfirmText('');
    setResetOpts({tune:false,tutorials:false});
  };

  // Phones render at natural 1.0× (zoom controls are hidden there); desktop keeps the saved preference.
  const effZoom=isPhone?1:uiZoom;
  return(
    <div style={{display:'flex',flexDirection:'column',height:`calc(100dvh / ${effZoom})`,minHeight:'-webkit-fill-available',overflow:'hidden',zoom:effZoom}}>
      {showChecker&&<CheckerModal onClose={()=>setShowChecker(false)} lim={lim} metricUnits={metricUnits}/>}
      {showResetModal&&(
        <div style={{position:'fixed',inset:0,background:'#000000cc',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16}}
             onClick={()=>{setShowResetModal(false);setResetConfirmText('');setResetOpts({tune:false,tutorials:false});}}>
          <div onClick={e=>e.stopPropagation()}
               style={{background:'#0a0f1a',border:'1px solid #1e293b',borderRadius:6,padding:20,maxWidth:420,width:'100%'}}>
            <div style={{fontSize:13,letterSpacing:1,color:'#fca5a5',marginBottom:12}}>RESET OPTIONS</div>
            <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:14,fontSize:12}}>
              {[['tune','Tune (chassis, feel, drivetrain, alignment, brakes)'],
                ['tutorials','Tutorials (mark all unseen)']
              ].map(([key,label])=>(
                <label key={key} style={{display:'flex',alignItems:'center',gap:8,color:'#cbd5e1',cursor:'pointer'}}>
                  <input type="checkbox" checked={resetOpts[key]}
                    onChange={e=>setResetOpts(p=>({...p,[key]:e.target.checked}))}
                    style={{cursor:'pointer',width:16,height:16}}/>
                  {label}
                </label>
              ))}
            </div>
            <div style={{fontSize:11,color:'#94a3b8',marginBottom:6}}>
              Type <span style={{color:'#fca5a5',fontWeight:'bold'}}>RESET</span> to confirm:
            </div>
            <input type="text" value={resetConfirmText}
              onChange={e=>setResetConfirmText(e.target.value)}
              onKeyDown={e=>{if(e.key==='Escape'){setShowResetModal(false);setResetConfirmText('');}else if(e.key==='Enter'&&resetConfirmText==='RESET'){performGlobalReset();}}}
              autoFocus
              style={{width:'100%',background:'#020617',border:'1px solid #1e293b',color:'#e2e8f0',padding:'6px 8px',fontSize:13,fontFamily:'monospace',marginBottom:14,borderRadius:3,boxSizing:'border-box'}}/>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button className="tbtn" onClick={()=>{setShowResetModal(false);setResetConfirmText('');setResetOpts({tune:false,tutorials:false});}}>CANCEL</button>
              <button className="tbtn" disabled={resetConfirmText!=='RESET'} onClick={performGlobalReset}
                style={{color:resetConfirmText==='RESET'?'#fca5a5':'#94a3b8',borderColor:resetConfirmText==='RESET'?'#7f1d1d':'#1e293b'}}>
                RESET
              </button>
            </div>
          </div>
        </div>
      )}
      {tutMode&&(()=>{
        const stepMeta=TUTORIALS[tutMode]?.[tutStep];
        if(stepMeta?.spotlight==='hamburger'){
          // find ☰ button position for spotlight ring
          const ham=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='☰');
          const r=ham?ham.getBoundingClientRect():null;
          const cx=r?Math.round(r.left+r.width/2):28;
          const cy=r?Math.round(r.top+r.height/2):21;
          const PAD=14;
          return ReactDOM.createPortal(
            <div style={{position:'fixed',inset:0,zIndex:690,pointerEvents:'none'}}>
              {/* dark overlay — SVG with cutout circle via mask */}
              <svg width="100%" height="100%" style={{position:'absolute',inset:0}}>
                <defs>
                  <mask id="spotlight-mask">
                    <rect width="100%" height="100%" fill="white"/>
                    <circle cx={cx} cy={cy} r={Math.max(r?r.width:24,24)/2+PAD} fill="black"/>
                  </mask>
                </defs>
                <rect width="100%" height="100%" fill="#000" opacity="0.62" mask="url(#spotlight-mask)"/>
                {/* highlight ring */}
                <circle cx={cx} cy={cy} r={Math.max(r?r.width:24,24)/2+PAD}
                  fill="none" stroke="#6366f1" strokeWidth="2" opacity="0.9"/>
              </svg>
            </div>,
            document.body
          );
        }
        return null;
      })()}
      {tutMode&&<TutorialPanel mode={tutMode} step={tutStep}
        onNext={()=>setTutStep(s=>Math.min(s+1,(TUTORIALS[tutMode]?.length??1)-1))}
        onPrev={()=>setTutStep(s=>Math.max(s-1,0))}
        onClose={closeTut}
        onDone={closeTutDone}/>}
      {balTutOpen&&<TutorialPanel mode='balance' step={balTutStep}
        onNext={()=>setBalTutStep(s=>Math.min(s+1,(TUTORIALS.balance?.length??1)-1))}
        onPrev={()=>setBalTutStep(s=>Math.max(s-1,0))}
        onClose={closeBalTut}/>}

      {/* ONBOARDING POPUP */}
      {(!onboardSeen||showComplexity)&&(
        <div onClick={closeOnboard}
          style={{position:'fixed',inset:0,zIndex:800,background:'rgba(0,0,0,0.72)'}}>
          <div onClick={e=>e.stopPropagation()}
            style={{position:'absolute',top:50,right:14,width:258,
                    background:'#0f172a',border:'1px solid #334155',borderRadius:4,
                    padding:'16px 16px 14px',boxShadow:'0 8px 40px #000d'}}>
            {/* arrow pointing up toward header buttons */}
            <div style={{position:'absolute',top:-8,right:14,width:0,height:0,
                         borderLeft:'8px solid transparent',borderRight:'8px solid transparent',
                         borderBottom:'8px solid #334155'}}/>
            <div style={{position:'absolute',top:-6,right:15,width:0,height:0,
                         borderLeft:'7px solid transparent',borderRight:'7px solid transparent',
                         borderBottom:'7px solid #0f172a'}}/>
            <div style={{fontSize:10,color:'#94a3b8',letterSpacing:2,marginBottom:10}}>COMPLEXITY LEVEL</div>
            {/* preview of the header buttons */}
            <div style={{display:'flex',gap:4,alignItems:'center',marginBottom:12}}>
              {[['BEG',true],['INT',false],['PRO',false]].map(([lbl,active])=>(
                <span key={lbl} style={{padding:'3px 9px',border:`1px solid ${active?'#e2e8f0':'#1e293b'}`,
                  borderRadius:2,fontSize:11,color:active?'#e2e8f0':'#94a3b8',fontFamily:'Courier New'}}>{lbl}</span>
              ))}
              <div style={{width:1,height:14,background:'#1e293b',margin:'0 3px'}}/>
              <span style={{padding:'3px 8px',border:'1px solid #1e293b',borderRadius:2,
                fontSize:11,color:'#94a3b8',fontFamily:'Courier New'}}>?</span>
            </div>
            <div style={{fontSize:11,color:'#94a3b8',lineHeight:1.7,marginBottom:14}}>
              Choose how much of the app to show. <span style={{color:'#e2e8f0'}}>BEG</span> is the best starting point — fewer controls, guided outputs.
              Press <span style={{color:'#e2e8f0',fontFamily:'Courier New'}}>?</span> at any time to open a step-by-step tutorial.
            </div>
            <button onClick={closeOnboard}
              style={{width:'100%',padding:'7px 0',background:'#1e293b',border:'1px solid #334155',
                      borderRadius:2,color:'#e2e8f0',fontSize:11,letterSpacing:1.5,
                      cursor:'pointer',fontFamily:'Courier New'}}>GOT IT</button>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div style={{flexShrink:0,borderBottom:'1px solid #0f172a',background:'#020617',
                   paddingTop:'env(safe-area-inset-top,0px)'}}>
        {/* Row 1 — brand + utility */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',
                     padding:'0 14px',height:42}}>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <button onClick={()=>setSidebarOpen(p=>!p)}
              style={{background:'none',border:'1px solid #1e293b',borderRadius:2,
                      color:sidebarOpen?'#e2e8f0':'#94a3b8',cursor:'pointer',
                      padding:isMobile?'7px 10px':'3px 7px',fontSize:13,lineHeight:1,
                      transition:'color .12s,border-color .12s',
                      borderColor:sidebarOpen?'#e2e8f033':'#1e293b'}}>
              {sidebarOpen?'✕':'☰'}
            </button>
            <div style={{fontWeight:700,fontSize:isMobile?12:15,color:'#e2e8f0',
                         letterSpacing:isMobile?2:4}}>
              SUSP<span style={{color:'#94a3b8'}}>.</span>OS
            </div>
          </div>
          <div style={{display:'flex',gap:3,alignItems:'center'}}>
            {!isMobile&&<>
              <button className={`tbtn${!metricUnits?' on':''}`}
                onClick={()=>setMetricUnits(false)} style={{fontSize:11}}>IMP</button>
              <button className={`tbtn${metricUnits?' on':''}`}
                onClick={()=>setMetricUnits(true)} style={{fontSize:11}}>MET</button>
              <div style={{width:1,height:16,background:'#1e293b',margin:'0 4px'}}/>
              {['horizon','motorsport'].map(m=>(
                <button key={m} className={`tbtn${fe.gameMode===m?' on':''}`}
                  onClick={()=>pFe('gameMode')(m)} style={{fontSize:11}}>
                  {m.toUpperCase()}
                </button>
              ))}
              <div style={{width:1,height:16,background:'#1e293b',margin:'0 4px'}}/>
              {[['beginner','BEG'],['intermediate','INT'],['pro','PRO']].map(([mode,label])=>(
                <button key={mode} className={`tbtn${uiMode===mode?' on':''}`}
                  onClick={()=>tryAccessMode(mode)} style={{fontSize:11}}>{label}</button>
              ))}
              <div style={{width:1,height:16,background:'#1e293b',margin:'0 4px'}}/>
            </>}
            <button className="tbtn undo-btn" style={{fontSize:11}}
              onClick={undo} disabled={!canUndo}
              title={canUndo?'Undo last change':'Nothing to undo'}>↩</button>
            <button className="tbtn" style={{fontSize:11}}
              onClick={()=>openTut(uiMode)}>?</button>
            {!isPhone&&<>
            <div style={{width:1,height:16,background:'#1e293b',margin:'0 4px'}}/>
            <button className="tbtn" style={{fontSize:11}} title="Zoom out"
              onClick={()=>bumpZoom(-0.1)} disabled={uiZoom<=0.7}>−</button>
            <span style={{fontSize:10,color:uiZoom===1?'#475569':'#94a3b8',
                          fontFamily:'Courier New',minWidth:28,textAlign:'center',
                          letterSpacing:0,userSelect:'none'}}>
              {Math.round(uiZoom*100)}%
            </span>
            <button className="tbtn" style={{fontSize:11}} title="Zoom in"
              onClick={()=>bumpZoom(0.1)} disabled={uiZoom>=1.6}>+</button>
            </>}
          </div>
        </div>
        {/* Row 2 — mobile only: complexity selector */}
        {isMobile&&(
          <div style={{display:'flex',gap:4,padding:'0 14px 8px'}}>
            {[['beginner','BEG'],['intermediate','INT'],['pro','PRO']].map(([mode,label])=>(
              <button key={mode} className={`tbtn${uiMode===mode?' on':''}`}
                onClick={()=>tryAccessMode(mode)}
                style={{flex:1,fontSize:11,padding:'7px 0',textAlign:'center'}}>
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* BODY */}
      <div style={{display:'flex',flex:1,overflow:'hidden',position:'relative'}}>

        {/* BACKDROP — mobile only, closes sidebar on tap */}
        {sidebarOpen&&isMobile&&
          <div onClick={()=>setSidebarOpen(false)}
               style={{position:'absolute',inset:0,background:'#00000088',zIndex:150}}/>}

        {/* SIDEBAR */}
        <div className="sidebar-scroll" style={{WebkitOverflowScrolling:'touch',overscrollBehavior:'contain',
          width:sidebarWidth,flexShrink:0,overflowY:'auto',transition:'width .2s ease',
          borderRight:'1px solid #0f172a',background:'#020617',
          ...(isMobile?{
            position:'absolute',top:0,left:0,bottom:0,zIndex:200,
            transform:sidebarOpen?'translateX(0)':'translateX(-100%)',
            transition:'transform .2s ease',
            boxShadow:sidebarOpen?'4px 0 24px #000000cc':'none',
          }:{
            display:sidebarOpen?'block':'none',
          })
        }}>

          {/* MOBILE-ONLY: unit + game mode controls (moved from header) */}
          {isMobile&&(
            <div style={{display:'flex',gap:4,alignItems:'center',padding:'8px 12px',
                         borderBottom:'1px solid #0f172a',flexShrink:0}}>
              <button className={`tbtn${!metricUnits?' on':''}`}
                onClick={()=>setMetricUnits(false)} style={{fontSize:11}}>IMP</button>
              <button className={`tbtn${metricUnits?' on':''}`}
                onClick={()=>setMetricUnits(true)} style={{fontSize:11}}>MET</button>
              <div style={{width:1,height:14,background:'#1e293b',margin:'0 2px'}}/>
              {['horizon','motorsport'].map(m=>(
                <button key={m} className={`tbtn${fe.gameMode===m?' on':''}`}
                  onClick={()=>pFe('gameMode')(m)} style={{fontSize:11}}>
                  {m==='horizon'?'HZ':'MS'}
                </button>
              ))}
            </div>
          )}

          {/* TELEMETRY panel — capture workflow */}
          <div id="zone-telemetry">
            <Sec title="TELEMETRY" open={open.telemetryOpen} onToggle={tog('telemetryOpen')}>
              {/* Bridge connection */}
              <div style={{marginBottom:8}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
                  <span style={{fontSize:12,color:'#9ca3af'}}>Bridge</span>
                  <div style={{display:'flex',alignItems:'center',gap:6}}>
                    <span style={{width:8,height:8,borderRadius:'50%',background:bridgeStatus==='connected'?'#22c55e':bridgeStatus==='connecting'?'#eab308':'#ef4444'}}/>
                    <span style={{fontSize:10,color:'#9ca3af',textTransform:'uppercase'}}>{bridgeStatus}</span>
                  </div>
                </div>
                <div style={{display:'flex',gap:6}}>
                  <input type="text" value={telemetryUrl}
                    onChange={e=>setTelemetryUrl(e.target.value)}
                    disabled={bridgeStatus!=='disconnected'}
                    style={{flex:1,background:'#0a0f1a',border:'1px solid #1e293b',borderRadius:2,
                      color:'#e2e8f0',fontFamily:'Courier New',fontSize:12,padding:'4px 6px',outline:'none'}}/>
                  <button className={`tog${bridgeStatus!=='disconnected'?' on':''}`}
                    onClick={handleTelemetryToggle}
                    style={{padding:'4px 10px',fontSize:11,width:90}}>
                    {bridgeStatus==='disconnected'?'CONNECT':'DISCONNECT'}
                  </button>
                </div>
              </div>

              {/* Packet status */}
              {bridgeStatus==='connected'&&<div style={{marginBottom:8,padding:'5px 8px',background:'#0a0f1a',borderRadius:2,border:'1px solid #1e293b'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:2}}>
                  <span style={{fontSize:10,color:'#94a3b8',letterSpacing:1}}>PACKETS</span>
                  <span style={{fontSize:10,color:packetStatus==='receiving'?'#22c55e':packetStatus==='stale'?'#eab308':'#94a3b8',textTransform:'uppercase'}}>{packetStatus}</span>
                </div>
                {packetDiag.format&&<div style={{fontSize:10,color:'#9ca3af'}}>Format: {packetDiag.format}</div>}
                {packetDiag.count>0&&<div style={{fontSize:10,color:'#9ca3af'}}>Count: {packetDiag.count} · Last: {packetDiag.lastAt?((Date.now()-packetDiag.lastAt)/1000).toFixed(1)+'s ago':'—'}</div>}
                {packetDiag.count>0&&<div style={{fontSize:10,color:'#9ca3af'}}>Rate: {packetDiag.rate!=null?packetDiag.rate.toFixed(1)+' Hz':'—'} · Length: {packetDiag.packetLength!=null?packetDiag.packetLength+' B':'—'}</div>}
                {packetDiag.warning&&<div style={{fontSize:10,color:'#f59e0b',marginTop:2}}>⚠ {packetDiag.warning}</div>}
                {packetStatus==='stale'&&<div style={{fontSize:10,color:'#eab308',marginTop:2}}>Packets stopped — Forza may be in menus or not driving.</div>}
                {packetStatus==='waiting'&&<div style={{fontSize:10,color:'#94a3b8',marginTop:2}}>Waiting for driving data — Forza Data Out only streams while driving.</div>}
              </div>}

              {/* Capture status */}
              {bridgeStatus==='connected'&&<div style={{marginBottom:8,padding:'5px 8px',background:'#0a0f1a',borderRadius:2,border:'1px solid #1e293b'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span style={{fontSize:10,color:'#94a3b8',letterSpacing:1}}>CAPTURE</span>
                  <span style={{fontSize:10,color:captureStatus==='active'?'#22c55e':captureStatus==='complete'?'#6366f1':captureStatus==='insufficient'?'#f59e0b':captureStatus==='cancelled'?'#94a3b8':'#94a3b8',textTransform:'uppercase'}}>{captureStatus}</span>
                </div>
                {captureStatus==='active'&&<div style={{fontSize:10,color:'#94a3b8',marginTop:2}}>
                  Sampling… {captureSamples.length} weight samples
                  {captureCarOrdinal!=null&&<span> · Car #{captureCarOrdinal}</span>}
                </div>}
                {captureStatus==='complete'&&<div style={{fontSize:10,color:'#6366f1',marginTop:2}}>Snapshot ready for review below.</div>}
                {captureStatus==='insufficient'&&<div style={{fontSize:10,color:'#f59e0b',marginTop:2}}>Insufficient data. Try driving or recapture.</div>}
                {(captureStatus==='complete'||captureStatus==='insufficient'||captureStatus==='inactive'||captureStatus==='cancelled')&&appliedSnapshot&&(
                  <div style={{fontSize:10,color:'#22c55e',marginTop:2}}>Snapshot applied — inputs locked.</div>
                )}
                {(captureStatus==='complete'||captureStatus==='insufficient'||captureStatus==='cancelled'||(captureStatus==='inactive'&&!appliedSnapshot))&&bridgeStatus==='connected'&&(
                  <button className="tbtn" style={{marginTop:6,fontSize:10,padding:'4px 8px',width:'100%'}}
                    onClick={startRecapture}>
                    {captureStatus==='complete'||captureStatus==='insufficient'||captureStatus==='cancelled'?'↻ RECAPTURE':'▶ CAPTURE'}
                  </button>
                )}
                {captureStatus==='active'&&(
                  <button className="tbtn" style={{marginTop:6,fontSize:10,padding:'4px 8px',width:'100%',color:'#f59e0b'}}
                    onClick={()=>stopCapture('cancelled')}>✕ CANCEL CAPTURE</button>
                )}
              </div>}

              {/* Snapshot review */}
              {pendingSnapshot&&(
                <div style={{marginBottom:8,padding:'8px',background:'#0a0f1a',borderRadius:2,border:'1px solid #6366f155'}}>
                  <div style={{fontSize:10,color:'#6366f1',letterSpacing:2,marginBottom:6}}>REVIEW SNAPSHOT</div>
                  {pendingSnapshot.candidates.map(c=>{
                    const isSelected = !!selectedCandidates[c.field];
                    const isDisabled = c.value == null || c.source === 'unavailable';
                    const srcColor={parsed:'#22c55e',lookup:'#60a5fa',estimated:'#eab308',manual:'#94a3b8',restored:'#818cf8',unavailable:'#475569'}[c.source]||'#94a3b8';
                    const confColor={high:'#22c55e',medium:'#eab308',low:'#f97316',unknown:'#475569'}[c.confidence]||'#94a3b8';
                    return(
                      <div key={c.field} style={{
                        display:'flex',
                        justifyContent:'space-between',
                        alignItems:'flex-start',
                        padding:'3px 0',
                        borderBottom:'1px solid #0f172a',
                        fontSize:10,
                        opacity: isSelected ? 1 : 0.4,
                        transition: 'opacity 0.15s'
                      }}>
                        {!isDisabled && (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={e => {
                              setSelectedCandidates(p => ({...p, [c.field]: e.target.checked}));
                            }}
                            style={{marginRight:6, marginTop:2, cursor:'pointer'}}
                          />
                        )}
                        <div style={{flex:1}}>
                          <div style={{color:'#9ca3af'}}>{c.field}</div>
                          {c.value!=null?<div style={{fontSize:12,color:'#e2e8f0',fontWeight:700,fontFamily:'Courier New',marginTop:1}}>{String(c.value)}</div>:<div style={{color:'#475569',fontStyle:'italic'}}>unavailable</div>}
                          <div style={{fontSize:9,color:'#475569',marginTop:1}}>{c.explanation}</div>
                        </div>
                        <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:2,flexShrink:0}}>
                          <span style={{fontSize:8,letterSpacing:0.5,padding:'1px 3px',borderRadius:2,background:srcColor+'18',color:srcColor,border:`1px solid ${srcColor}33`}}>{c.source.toUpperCase()}</span>
                          <span style={{fontSize:8,letterSpacing:0.5,padding:'1px 3px',borderRadius:2,background:confColor+'18',color:confColor,border:`1px solid ${confColor}33`}}>{c.confidence.toUpperCase()}</span>
                        </div>
                      </div>
                    );
                  })}
                  <div style={{display:'flex',gap:4,marginTop:8}}>
                    <button className="tbtn on" style={{flex:1,fontSize:10,padding:'5px 8px'}}
                      onClick={()=>applySnapshot(Object.keys(selectedCandidates).filter(k=>selectedCandidates[k]))}>
                      APPLY SELECTED
                    </button>
                    <button className="tbtn" style={{flex:1,fontSize:10,padding:'5px 8px'}}
                      onClick={cancelSnapshot}>
                      KEEP CURRENT
                    </button>
                  </div>
                </div>
              )}

              {/* Applied snapshot summary */}
              {appliedSnapshot&&!pendingSnapshot&&(
                <div style={{marginBottom:8,padding:'5px 8px',background:'#0a0f1a',borderRadius:2,border:'1px solid #22c55e33'}}>
                  <div style={{fontSize:10,color:'#22c55e',letterSpacing:2,marginBottom:3}}>APPLIED</div>
                  {Object.entries(appliedSnapshot.values).map(([k,v])=>(
                    <div key={k} style={{fontSize:10,display:'flex',justifyContent:'space-between',color:'#9ca3af'}}>
                      <span>{k}</span>
                      <span style={{color:'#e2e8f0',fontFamily:'Courier New'}}>{v!=null?String(v):'—'}</span>
                    </div>
                  ))}
                  {appliedSnapshot.appliedAt&&<div style={{fontSize:9,color:'#475569',marginTop:3}}>
                    {new Date(appliedSnapshot.appliedAt).toLocaleTimeString()}
                  </div>}
                </div>
              )}

              {/* Live diagnostics (always visible when connected, does NOT mutate inputs) */}
              {bridgeStatus==='connected'&&lastPacket&&lastPacket.packetSupported&&(
                <div style={{marginTop:6,display:'flex',flexDirection:'column',gap:3}}>
                  <div style={{fontSize:10,color:'#475569',letterSpacing:1}}>DIAGNOSTICS</div>
                  <div style={{display:'flex',flexWrap:'wrap',gap:'2px 12px',fontSize:10,color:'#9ca3af'}}>
                    <span>RPM {lastPacket.CurrentEngineRpm!=null?Math.round(lastPacket.CurrentEngineRpm):'—'}</span>
                    <span>SPD {lastPacket.Speed!=null?(metricUnits?Math.round(lastPacket.Speed/KMH_PER_MPH):Math.round(lastPacket.Speed/MPH_TO_MS)):'—'}{metricUnits?'km/h':'mph'}</span>
                    <span>PWR {lastPacket.Power!=null?Math.round(lastPacket.Power/745.7):'—'}hp</span>
                    <span>CAR #{lastPacket.CarOrdinal!=null?lastPacket.CarOrdinal:'—'}</span>
                  </div>
                </div>
              )}
            </Sec>
          </div>

          {/* BEGINNER panel */}
          {uiMode==='beginner'&&(()=>{
            const stAgVal=Math.max(-50,Math.min(50,Math.round((70-(fe.reboundZeta??70))*2)));
            const[hzCat,hzCol]=hzCtx(physics.frontHz);
            return(
              <div style={{padding:'14px 12px 20px'}}>
                {/* START FROM presets */}
                <div id="zone-presets" style={dim('presets')}>
                <div style={{fontSize:10,color:'#94a3b8',letterSpacing:2,marginBottom:8}}>START FROM</div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:3,marginBottom:18}}>
                  {[1,2,3,4,5,6].map(i=>(
                    <PresetBtn key={i} name={PRESET_SAVES[i].name} onLoad={()=>loadPreset(i)}/>
                  ))}
                </div>
                </div>

                <div id="zone-layout-build" style={dim('layout-build')}>
                <div style={{fontSize:10,color:'#94a3b8',letterSpacing:2,marginBottom:14}}>CHASSIS</div>
                <Toggle label="Layout" value={dr.layout} onChange={pDr('layout')}
                  options={[{value:'FWD',label:'FWD'},{value:'RWD',label:'RWD'},{value:'AWD',label:'AWD'}]}/>
                </div>
                <div id="zone-build-type" style={dim('build-type')}>
                <Toggle label="Build" value={dr.buildType??'track'} onChange={pDr('buildType')}
                  options={[{value:'street',label:'STREET'},{value:'track',label:'TRACK'},{value:'drift',label:'DRIFT'}]}/>
                </div>
                <div id="zone-weight" style={dim('weight')}>
                <Field label="Weight"
                  value={metricUnits?ch.weight/KG_TO_LB:ch.weight}
                  onChange={metricUnits?v=>pCh('weight')(v*KG_TO_LB):pCh('weight')}
                  min={metricUnits?45:100} max={metricUnits?8165:18000} step={1}
                  unit={metricUnits?'kg':'lb'} logScale={true} logMid={metricUnits?2722:6000}
                  hint="Total vehicle weight. Find this on the car's stat page in Forza."/>
                <Field label="Front Weight Bias" value={ch.frontBias} onChange={pCh('frontBias')}
                  min={30} max={70} step={1} unit="%"
                  hint="Percentage of total weight on the front axle. Shown on the car selection screen. 50% = perfect balance."/>
                {(fieldSources.weight||fieldSources.frontBias)&&<div style={{display:'flex',gap:6,marginBottom:8,marginTop:-4}}>
                  {fieldSources.weight&&<span style={{fontSize:9,color:'#22c55e',background:'#22c55e15',border:'1px solid #22c55e33',borderRadius:2,padding:'1px 5px'}}>wt:{fieldSources.weight.source}</span>}
                  {fieldSources.frontBias&&<span style={{fontSize:9,color:'#60a5fa',background:'#60a5fa15',border:'1px solid #60a5fa33',borderRadius:2,padding:'1px 5px'}}>bias:{fieldSources.frontBias.source}</span>}
                </div>}
                </div>

                <div id="zone-ride-stiffness" style={dim('ride-stiffness')}>
                <div style={{fontSize:10,color:'#94a3b8',letterSpacing:2,margin:'16px 0 14px'}}>FEEL</div>
                <FeelSlider label="Ride Stiffness" value={physics.frontHz}
                  onChange={v=>pFe('rideStiffness')(hzToRs(v))}
                  min={HZ_MIN} max={HZ_MAX} step={0.01}
                  leftLabel="SOFT" rightLabel="STIFF"
                  readout={<span style={{display:'flex',alignItems:'center',gap:5}}>
                    <span style={{fontSize:11,color:hzCol,fontFamily:'Courier New',fontWeight:700,letterSpacing:1}}>{hzCat}</span>
                    <span style={{fontSize:10,color:'#94a3b8',fontFamily:'Courier New'}}>{physics.frontHz.toFixed(2)} Hz</span>
                  </span>}
                  hint="How stiff the suspension feels. SOFT = comfortable street ride. ROAD = balanced. FIRM = responsive sport. RACE = stiff competition setup."/>
                </div>
                <div id="zone-rear-stiffness" style={dim('rear-stiffness')}>
                <FeelSlider label="Spring / ARB Mix" value={fe.springShare??50}
                  onChange={v=>pFe('springShare')(Math.round(v))}
                  min={0} max={100} step={1}
                  leftLabel="ARBs" rightLabel="SPRINGS"
                  centered={true}
                  readout={`SPR ${fe.springShare??50}% / ARB ${100-(fe.springShare??50)}%`}
                  hint="Controls how the balance correction is split between anti-roll bars and rear spring stiffness. ARBs (left) = bars do the work, springs stay symmetric. SPRINGS (right) = rear spring stiffness is adjusted more, bars stay near neutral. BALANCED (centre) splits the correction evenly between both."/>
                </div>
                <div id="zone-balance" style={dim('balance')}>
                <FeelSlider label="Balance" value={(fe.rearHzMultiplier??1.2-1)*50}
                  onChange={v=>setFe(p=>({...p,
                    rearHzMultiplier:Math.max(0.70,Math.min(1.70,1.2+v*0.01))}))}
                  min={-50} max={50} step={1}
                  leftLabel="OVERSTEER" rightLabel="UNDERSTEER"
                  centered={true}
                  readout={`×${(fe.rearHzMultiplier??1.2).toFixed(2)}`}
                  hint="Controls the rear spring stiffness relative to front (multiplier). Left (softer rear) = oversteer bias, more rotation. Right (stiffer rear) = understeer bias, more stability. Start at centre for most builds."/>
                </div>
                <div id="zone-character" style={dim('character')}>
                <FeelSlider label="Character" value={stAgVal}
                  onChange={v=>setFe(p=>({...p,
                    reboundZeta:Math.max(10,Math.min(115,70-v*0.5)),
                    bumpRatio:Math.max(10,Math.min(100,Math.round(56+v*0.22)))
                  }))}
                  min={-50} max={50} step={1}
                  leftLabel="STABLE" rightLabel="AGILE"
                  centered={true}
                  readout={stAgVal===0?'NEUTRAL':stAgVal>0?'AGILE':'STABLE'}
                  hint="Controls damping character. Stable (left) = higher damping, settles quickly, more predictable. Agile (right) = lighter damping, more lively and responsive, quicker direction changes. Start at centre."/>
                </div>
              </div>
            );
          })()}

          {/* collapse / expand all — hidden in beginner mode */}
          {uiMode!=='beginner'&&<div style={{display:'flex',justifyContent:'flex-end',gap:3,
                       padding:'5px 12px 4px',borderBottom:'1px solid #0f172a'}}>
            <span style={{fontSize:10,color:'#94a3b8',letterSpacing:1,alignSelf:'center',marginRight:4}}>SECTIONS</span>
            <button className="tbtn" style={{fontSize:10,padding:'2px 7px'}}
              onClick={()=>setOpen(p=>Object.fromEntries(Object.keys(p).map(k=>[k,false])))}>−</button>
            <button className="tbtn" style={{fontSize:10,padding:'2px 7px'}}
              onClick={()=>setOpen(p=>Object.fromEntries(Object.keys(p).map(k=>[k,true])))}>+</button>
          </div>}

          {uiMode!=='beginner'&&<>
          <div id="zone-chassis" style={dim('chassis')}><Sec title="CHASSIS" open={open.chassis} onToggle={tog('chassis')}
            onReset={()=>setCh({...DEF_CH})}>
            <Field label="Weight"
              value={metricUnits?ch.weight/KG_TO_LB:ch.weight}
              onChange={metricUnits?v=>pCh('weight')(v*KG_TO_LB):pCh('weight')}
              min={metricUnits?45:100} max={metricUnits?8165:18000} step={1}
              unit={metricUnits?'kg':'lb'} logScale={true} logMid={metricUnits?2722:6000}
              hint={metricUnits
                ?"Total vehicle weight in kg. Find this on the car's stat page in Forza. Affects spring rates, damper forces, and ARB stiffness directly."
                :"Total vehicle weight in pounds. Find this on the car's stat page in Forza. Affects spring rates, damper forces, and ARB stiffness directly."}/>
            <Field label="Front Weight Bias" value={ch.frontBias} onChange={pCh('frontBias')} min={30} max={70} step={1} unit="%"
              hint="Percentage of total weight on the front axle. Shown on the car selection screen. 50% = perfect balance. Most front-engined cars are 52–58% front."/>
            {/* Source provenance badges */}
            {(fieldSources.weight||fieldSources.frontBias)&&<div style={{display:'flex',gap:6,marginBottom:8,marginTop:-6}}>
              {fieldSources.weight&&<span style={{fontSize:9,color:'#22c55e',background:'#22c55e15',border:'1px solid #22c55e33',borderRadius:2,padding:'1px 5px'}}>wt:{fieldSources.weight.source}</span>}
              {fieldSources.frontBias&&<span style={{fontSize:9,color:'#60a5fa',background:'#60a5fa15',border:'1px solid #60a5fa33',borderRadius:2,padding:'1px 5px'}}>bias:{fieldSources.frontBias.source}</span>}
            </div>}
            {uiMode==='pro'&&<div style={{display:'flex',alignItems:'center',gap:6,
                         padding:'4px 8px',background:'#0a0f1a',borderRadius:2,
                         border:'1px solid #1e293b',marginBottom:10,marginTop:-4}}>
              <span style={{fontSize:10,color:'#94a3b8',letterSpacing:1}}>F CORNER</span>
              <span style={{fontFamily:'Courier New',fontSize:11,color:'#9ca3af'}}>{dispMass(cm.front)}</span>
              <div style={{flex:1,height:1,background:'#1e293b'}}/>
              <span style={{fontSize:10,color:'#94a3b8',letterSpacing:1}}>R CORNER</span>
              <span style={{fontFamily:'Courier New',fontSize:11,color:'#9ca3af'}}>{dispMass(cm.rear)}</span>
            </div>}
            {uiMode==='pro'&&(()=>{
              // Axle lateral load transfer at 1g = M_axle·h/track. cm is corner (½-axle)
              // mass, so use 2·cm = full axle mass. OUT/IN below add/subtract this.
              const xferF=2*cm.front*ch.cgHeight/ch.trackF;
              const xferR=2*cm.rear*ch.cgHeight/ch.trackR;
              return(<>
                <div style={{display:'flex',alignItems:'center',gap:6,
                             padding:'4px 8px',background:'#0a0f1a',borderRadius:2,
                             border:'1px solid #1e293b',marginBottom:4,marginTop:-6}}>
                  <span style={{fontSize:10,color:'#94a3b8',letterSpacing:1}}>XFER F</span>
                  <span style={{fontFamily:'Courier New',fontSize:11,color:'#9ca3af'}}>{dispMass(xferF)}/g</span>
                  <div style={{flex:1,height:1,background:'#1e293b'}}/>
                  <span style={{fontSize:10,color:'#94a3b8',letterSpacing:1}}>XFER R</span>
                  <span style={{fontFamily:'Courier New',fontSize:11,color:'#9ca3af'}}>{dispMass(xferR)}/g</span>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:6,
                             padding:'4px 8px',background:'#0a0f1a',borderRadius:2,
                             border:'1px solid #1e293b',marginBottom:4}}>
                  <span style={{fontSize:10,color:'#94a3b8',letterSpacing:1}}>OUT F</span>
                  <span style={{fontFamily:'Courier New',fontSize:11,color:'#9ca3af'}}>{dispMass(cm.front+xferF)}</span>
                  <div style={{flex:1,height:1,background:'#1e293b'}}/>
                  <span style={{fontSize:10,color:'#94a3b8',letterSpacing:1}}>OUT R</span>
                  <span style={{fontFamily:'Courier New',fontSize:11,color:'#9ca3af'}}>{dispMass(cm.rear+xferR)}</span>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:6,
                             padding:'4px 8px',background:'#0a0f1a',borderRadius:2,
                             border:'1px solid #1e293b',marginBottom:10}}>
                  <span style={{fontSize:10,color:'#94a3b8',letterSpacing:1}}>IN F</span>
                  <span style={{fontFamily:'Courier New',fontSize:11,color:'#9ca3af'}}>{dispMass(Math.max(0,cm.front-xferF))}</span>
                  <div style={{flex:1,height:1,background:'#1e293b'}}/>
                  <span style={{fontSize:10,color:'#94a3b8',letterSpacing:1}}>IN R</span>
                  <span style={{fontFamily:'Courier New',fontSize:11,color:'#9ca3af'}}>{dispMass(Math.max(0,cm.rear-xferR))}</span>
                </div>
              </>);
            })()}
            {(()=>{
              const tyreInput=(key,label)=>{
                const val=ch[key]??DEF_CH[key];
                const parsed=parseTyre(val);
                return(
                  <div style={{flex:1}}>
                    <div style={{fontSize:10,color:'#94a3b8',letterSpacing:1,marginBottom:4}}>{label}</div>
                    <input type="text" value={val}
                      onChange={e=>pCh(key)(e.target.value)}
                      placeholder="265/30R19"
                      style={{width:'100%',boxSizing:'border-box',background:'#020617',
                              border:`1px solid ${parsed?'#1e293b':'#7f1d1d'}`,borderRadius:2,
                              color:'#e2e8f0',fontFamily:'Courier New',fontSize:12,
                              padding:'4px 6px',outline:'none'}}/>
                    <div style={{fontSize:10,color:'#94a3b8',marginTop:3,fontFamily:'Courier New'}}>
                      {parsed?`Ø ${parsed.diameter.toFixed(0)} mm · r ${parsed.radius.toFixed(1)} mm`:'invalid format'}
                    </div>
                  </div>
                );
              };
              const{natBal:nm,stabIdx,targetBal,hasMechTarget,
                    trackF_rec,trackR_rec,dTrackF,dTrackR,trackFfeas,trackRfeas,gap}=chassisAnalysis;
              const nmDelta=nm-0.5;
              const nmCol=Math.abs(nmDelta)<0.03?'#9ca3af':nmDelta>0?'#ef4444':'#3b82f6';
              const nmLabel=Math.abs(nmDelta)<0.03?'NEUTRAL':nmDelta>0?'OS':'US';
              const[stabLabel,stabCol]=stabIdx<0.85?['AGILE','#f59e0b']
                :stabIdx<0.97?['BALANCED','#9ca3af']
                :stabIdx<1.10?['STABLE','#60a5fa']
                :['PLANTED','#3b82f6'];
              const showRec=gap>0.015;
              const dimCol='#94a3b8';
              const box={background:'#0a0f1a',border:'1px solid #1e293b',borderRadius:2,
                         padding:'4px 7px',display:'flex',justifyContent:'space-between',
                         alignItems:'center'};
              const fmtD=d=>(d>=0?'+':'')+Math.round(d);
              return(<>
                <div style={{display:'flex',alignItems:'center',gap:4,marginBottom:4}}>
                  <span style={{fontSize:10,color:'#94a3b8',letterSpacing:2}}>TYRE SIZE</span>
                  <Hint text="Enter tyre sizes in Forza format (e.g. 265/35R18). Width (first number, in mm) sets each axle's grip capacity at the limit — wider = more grip on that end. This affects the GRIP BIAS readout (physical handling at limit) but not the roll stiffness balance directly. Aspect ratio and rim diameter determine rolling radius."/>
                </div>
                <div style={{display:'flex',gap:8,marginBottom:4}}>
                  {tyreInput('tyreF','FRONT')}
                  {tyreInput('tyreR','REAR')}
                </div>
                {/* Dual metric bar */}
                <div style={{display:'flex',gap:3,marginBottom:showRec?3:8}}>
                  <div style={{flex:1,...box,flexDirection:'column',alignItems:'stretch',gap:2}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline'}}>
                      <span style={{fontSize:10,color:'#94a3b8',letterSpacing:1}}>CHASSIS BAL.</span>
                      <span style={{display:'flex',alignItems:'baseline',gap:3}}>
                        <span style={{fontFamily:'Courier New',fontWeight:700,color:nmCol,fontSize:11}}>{nm.toFixed(2)}</span>
                        <span style={{fontSize:10,color:nmCol,letterSpacing:1}}>{nmLabel}</span>
                      </span>
                    </div>
                    {(()=>{
                      const gp=balanceFromRsBal(ch,nm);
                      const gpd=Math.abs(gp-0.5);
                      const gpc=gpd<0.04?'#4b5563':gp<0.5?'#3b82f6':'#ef4444';
                      const gpl=gpd<0.04?'NEUTRAL':gp<0.5?'US':'OS';
                      return <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',borderTop:'1px solid #0f172a',paddingTop:2,marginTop:1}}>
                        <span style={{fontSize:9,color:'#4b5563',letterSpacing:0.5}}>GRIP BIAS</span>
                        <span style={{display:'flex',alignItems:'baseline',gap:2}}>
                          <span style={{fontFamily:'Courier New',fontSize:10,color:gpc}}>{gp.toFixed(2)}</span>
                          <span style={{fontSize:9,color:gpc}}>{gpl}</span>
                        </span>
                      </div>;
                    })()}
                  </div>
                  <div style={{flex:1,...box}}>
                    <span style={{fontSize:10,color:'#94a3b8',letterSpacing:1}}>STABILITY</span>
                    <span style={{fontFamily:'Courier New',fontSize:11,fontWeight:700,color:stabCol}}>{stabLabel}</span>
                  </div>
                </div>
                {/* Recommendation panel */}
                {showRec&&<div style={{background:'#0a0f1a',border:'1px solid #1e293b',
                  borderRadius:2,padding:'6px 7px',marginBottom:8}}>
                  <div style={{fontSize:10,color:'#94a3b8',letterSpacing:2,marginBottom:5}}>
                    REACH {targetBal.toFixed(2)}{hasMechTarget?' · ARB TARGET':' · NEUTRAL'}
                  </div>
                  {/* Tyre row removed — tyre width affects grip capacity (see GRIP BIAS), not roll stiffness fraction */}
                  {/* Track row */}
                  <div style={{display:'flex',alignItems:'baseline',gap:4,marginBottom:3}}>
                    <span style={{fontSize:10,color:'#94a3b8',letterSpacing:1,width:38,flexShrink:0}}>TRACK</span>
                    <span style={{flex:1,display:'flex',gap:8,fontFamily:'Courier New',fontSize:10}}>
                      <span style={{color:trackFfeas?'#e2e8f0':dimCol}}>
                        F {fmtD(dTrackF)}mm
                        {!trackFfeas&&<span style={{fontSize:10,color:dimCol}}> ✗</span>}
                      </span>
                      <span style={{color:trackRfeas?'#e2e8f0':dimCol}}>
                        R {fmtD(dTrackR)}mm
                        {!trackRfeas&&<span style={{fontSize:10,color:dimCol}}> ✗</span>}
                      </span>
                    </span>
                  </div>
                  {/* Guidance note */}
                  <div style={{fontSize:10,color:'#94a3b8',lineHeight:1.4,marginTop:2}}>
                    {(() => {
                      const allFeasible=[trackFfeas,trackRfeas].some(Boolean);
                      if(!allFeasible) return 'Gap too large for track geometry alone — rely on ARBs.';
                      const needOS=targetBal>nm;
                      return needOS
                        ?'Wider rear track or narrower front track increases rear roll stiffness share toward target.'
                        :'Wider front track or narrower rear track increases front roll stiffness share toward target.';
                    })()}
                  </div>
                </div>}
              </>);
            })()}
            {uiMode==='pro'&&<>
            <Field label="Wheelbase" value={Math.round(ch.wheelbase*1000)} onChange={v=>pCh('wheelbase')(v/1000)} min={400} max={4000} step={5} unit="mm"
              hint="Distance between front and rear axles in millimetres. Used by the flat-ride formula to match rear spring frequency to your target speed. Typical cars: 2400–2900 mm."/>
            <Field label="Track Width Front" value={Math.round(ch.trackF*1000)} onChange={v=>pCh('trackF')(v/1000)} min={1000} max={2600} step={5} unit="mm"
              hint="Distance between left and right wheels at the front. Typical: 1400–1800 mm. Wider = more roll resistance."/>
            <Field label="Track Width Rear" value={Math.round(ch.trackR*1000)} onChange={v=>pCh('trackR')(v/1000)} min={1000} max={2600} step={5} unit="mm"
              hint="Distance between left and right wheels at the rear. Typical: 1400–1800 mm. Often slightly wider than front."/>
            <Field label="CG Height" value={Math.round(ch.cgHeight*1000)} onChange={v=>pCh('cgHeight')(v/1000)} min={200} max={900} step={5} unit="mm"
              hint="Estimated height of the centre of gravity above ground. Forza doesn't expose this — use 400–460 mm for sports cars, 480–550 mm for sedans, 580–700 mm for SUVs. Affects roll moment and ARB stiffness."/>
            </> }
          </Sec></div>

          <div id="zone-build" style={dim('build')}><Sec title="BUILD & BALANCE TARGET" open={open.build} onToggle={tog('build')}
            onReset={()=>setFe(p=>({...p,arbBalTarget:DEF_FE.arbBalTarget}))}>
            <Toggle label="Build Type" value={dr.buildType??'track'} onChange={pDr('buildType')}
              options={[{value:'street',label:'STREET'},{value:'track',label:'TRACK'},{value:'drift',label:'DRIFT'}]}
              hint="Determines your intended use. Shifts ARB and differential recommendations, brake balance AUTO, and the recommended Mech Balance Target range."/>
            <Field label="Mech Balance Target" value={fe.arbBalTarget??0.65} onChange={pFe('arbBalTarget')}
              min={0.40} max={0.90} step={0.01}
              hint="Roll stiffness rear share — matches what Forza shows as Mech Balance. 0.50 = balanced roll resistance. Higher = more rear bar stiffness (oversteer tendency). Lower = more front (understeer tendency). MECH and CO-SOLVE modes solve springs and ARBs to hit this target. FH6 surfaces this value in-game so you can verify it directly; on older titles the solver still hits the same target — you just won't see it reflected in the tuning menu. CHASSIS BAL. below shows the same scale at your car's natural stiffness."/>
            {(()=>{
              const _layout=dr.layout??'RWD';
              const _build=dr.buildType??'track';
              const _deltaMap={
                FWD:{street:[0.06,0.17],track:[0.11,0.24],drift:[0.18,0.32]},
                RWD:{street:[0.05,0.16],track:[0.10,0.21],drift:[0.18,0.32]},
                AWD:{street:[0.03,0.12],track:[0.07,0.18],drift:[0.14,0.26]},
              };
              const[_dlo,_dhi]=((_deltaMap[_layout]??_deltaMap.RWD)[_build])??[0.10,0.21];
              const _lo=Math.max(0.40,Math.min(0.87,natMechBalance+_dlo));
              const _hi=Math.max(_lo+0.03,Math.min(0.90,natMechBalance+_dhi));
              const _MIN=0.40,_RNG=0.50;
              const _pct=v=>Math.max(0,Math.min(100,(v-_MIN)/_RNG*100));
              const _cur=fe.arbBalTarget??0.65;
              const _inRange=_cur>=_lo&&_cur<=_hi;
              const _tc=_inRange?'#4ade80':_cur>_hi?'#f97316':'#60a5fa';
              return(
                <div style={{background:'#060c17',border:'1px solid #1e293b',borderRadius:2,
                             padding:'8px 10px',marginBottom:0,marginTop:8}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                    <span style={{display:'flex',alignItems:'center',gap:4}}>
                      <span style={{fontSize:10,color:'#94a3b8',letterSpacing:1}}>BALANCE GUIDE</span>
                      <Hint text="NATURAL is your Δ=0 baseline — where the chassis sits from geometry and weight alone, with no spring or ARB correction. The RANGE adapts to your specific car: it shows how much oversteer bias (Δ from natural) is appropriate for this layout and build. A staggered or rear-heavy car may have a different natural balance, so its range band sits at a different absolute position — the Δ values below it stay the same. TARGET shows how far you're deliberately pushing away from natural."/>
                    </span>
                    <span style={{fontSize:10,color:'#94a3b8'}}>{_layout} · {_build.toUpperCase()}</span>
                  </div>
                  {(()=>{
                    return(
                    <div style={{position:'relative',height:16,marginBottom:2}}>
                      <div style={{position:'absolute',top:6,left:0,right:0,height:4,background:'#0f172a',borderRadius:2}}/>
                      <div style={{position:'absolute',top:6,left:`${_pct(_lo)}%`,width:`${_pct(_hi)-_pct(_lo)}%`,height:4,background:'#14532d',borderRadius:1}}/>
                      <div style={{position:'absolute',top:3,left:`${_pct(natMechBalance)}%`,transform:'translateX(-50%)',width:2,height:10,background:'#334155',borderRadius:1}}/>
                      <div style={{position:'absolute',top:1,left:`${_pct(_cur)}%`,transform:'translateX(-50%)',
                                   width:0,height:0,borderLeft:'5px solid transparent',borderRight:'5px solid transparent',borderTop:`7px solid ${_tc}`}}/>
                    </div>);
                  })()}
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:'#94a3b8',marginBottom:6}}>
                    <span>0.40</span>
                    <span style={{color:'#475569',letterSpacing:0.5}}>NAT {natMechBalance.toFixed(2)}</span>
                    <span>0.90</span>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr auto',gap:'3px 0'}}>
                    <span style={{fontSize:10,color:'#94a3b8',display:'flex',alignItems:'center',gap:4}}>
                      <span style={{display:'inline-block',width:2,height:8,background:'#334155',borderRadius:1,flexShrink:0}}/> NATURAL
                    </span>
                    <span style={{textAlign:'right',fontFamily:'Courier New',fontSize:10,color:'#cbd5e1'}}>{natMechBalance.toFixed(2)}</span>
                    <span style={{fontSize:10,color:'#94a3b8',display:'flex',alignItems:'center',gap:4}}>
                      <span style={{display:'inline-block',width:10,height:3,background:'#14532d',borderRadius:1,flexShrink:0}}/> RANGE
                    </span>
                    <span style={{textAlign:'right',display:'flex',flexDirection:'column',alignItems:'flex-end',gap:1}}>
                      <span style={{fontFamily:'Courier New',fontSize:10,color:'#16a34a'}}>{_lo.toFixed(2)} – {_hi.toFixed(2)}</span>
                      <span style={{fontFamily:'Courier New',fontSize:9,color:'#374151',letterSpacing:0.3}}>Δ+{_dlo.toFixed(2)} → +{_dhi.toFixed(2)}</span>
                    </span>
                    <span style={{fontSize:10,color:'#94a3b8',display:'flex',alignItems:'center',gap:4}}>
                      <span style={{display:'inline-block',width:0,height:0,borderLeft:'4px solid transparent',borderRight:'4px solid transparent',borderTop:`6px solid ${_tc}`,flexShrink:0}}/> TARGET
                    </span>
                    {(()=>{
                      const _d=_cur-natMechBalance;
                      const _dabs=Math.abs(_d);
                      const _dstr=(_d>=0?'+':'')+_d.toFixed(2);
                      const _ddir=_dabs<0.015?'≈nat':_d>0?'OS':'US';
                      const _dcol=_dabs<0.015?'#94a3b8':_d>0?'#60a5fa':'#f59e0b';
                      return(
                        <span style={{textAlign:'right',display:'flex',flexDirection:'column',alignItems:'flex-end',gap:1}}>
                          <span style={{fontFamily:'Courier New',fontSize:10,color:_tc}}>
                            {_cur.toFixed(2)}{_inRange?' ✓':_cur>_hi?' ↑':' ↓'}
                          </span>
                          <span style={{fontFamily:'Courier New',fontSize:9,color:_dcol,letterSpacing:0.3}}>
                            Δ{_dstr} {_ddir}
                          </span>
                        </span>
                      );
                    })()}
                  </div>
                </div>
              );
            })()}
          </Sec></div>

          <div id="zone-arb" style={dim('arb')}><Sec title="ANTI-ROLL BARS" open={open.arb} onToggle={tog('arb')}
            onReset={()=>setFe(p=>({...p,
              arbBias:DEF_FE.arbBias,
              arbMode:DEF_FE.arbMode,
              arbBalMode:DEF_FE.arbBalMode,
              springShare:DEF_FE.springShare,
              arbTargetRollMan:DEF_FE.arbTargetRollMan,
              arbShareMan:DEF_FE.arbShareMan,
              arbFloor:DEF_FE.arbFloor,
              arbCeil:DEF_FE.arbCeil}))}>
            <ArbDial arbF={tune.arbF} arbR={tune.arbR} arbLimit={lim.arb}
              rsAbF={tune.rsAbF} rsAbR={tune.rsAbR} frontBias={ch.frontBias}/>
            {(fe.arbBalMode??'weight')==='weight'&&
              <FeelSlider label="ARB Bias" value={fe.arbBias}
                onChange={pFe('arbBias')} min={-50} max={50} leftLabel="FRONT HEAVY" rightLabel="REAR HEAVY"
                centered={true}
                hint="Shifts the front/rear ARB stiffness split from the neutral weight-distribution default. FRONT HEAVY adds more front bar stiffness (more understeer). REAR HEAVY adds more rear bar stiffness (more oversteer). Neutral (centre) matches the car's weight balance."
                readout={`F ${Math.round((1-(physics.arbBalance/100))*100)}% / R ${Math.round(physics.arbBalance/100*100)}%`}/>
            }
            {uiMode!=='beginner'&&<ArbRangeSlider
              floor={fe.arbFloor??6} ceil={fe.arbCeil??lim.arb}
              onFloor={pFe('arbFloor')} onCeil={pFe('arbCeil')}
              max={lim.arb}/>}
            <div style={{display:'flex',alignItems:'center',gap:6,
                         padding:'5px 8px',background:'#0a0f1a',borderRadius:2,
                         border:'1px solid #1e293b',marginBottom:6,marginTop:-6}}>
              <span style={{fontSize:10,color:'#94a3b8',letterSpacing:1}}>ROLL</span>
              <span style={{fontFamily:'Courier New',fontSize:13,fontWeight:700,
                            color:tune.rollClamped?'#f59e0b':'#e2e8f0'}}>{tune.rollDeg.toFixed(1)}</span>
              <span style={{fontSize:10,color:'#94a3b8'}}>°</span>
              <svg width="100%" height="24" viewBox="0 0 100 24" style={{flex:1,overflow:'visible',margin:'0 4px'}}>
                <line x1="5" y1="20" x2="95" y2="20" stroke="#1e293b" strokeWidth="2" strokeLinecap="round"/>
                {(fe.arbMode??'auto')==='roll'&&(
                  <g transform={`rotate(${-Math.min(tune.rollTarget*4,25)} 50 20)`}>
                    <line x1="15" y1="14" x2="85" y2="14" stroke="#3b82f6" strokeWidth="1.5"
                      strokeDasharray="3 2" opacity="0.4" strokeLinecap="round"/>
                  </g>
                )}
                <g transform={`rotate(${-Math.min(tune.rollDeg*4,25)} 50 20)`}
                   style={{transition:'transform 0.15s ease-out'}}>
                  <line x1="20" y1="14" x2="80" y2="14"
                    stroke={tune.rollClamped?'#f59e0b':'#e2e8f0'} strokeWidth="1.5" strokeLinecap="round"/>
                  <rect x="15" y="10" width="5" height="8" rx="1.5" fill="#0f172a"
                    stroke={tune.rollClamped?'#f59e0b':'#cbd5e1'} strokeWidth="1.5"/>
                  <rect x="80" y="10" width="5" height="8" rx="1.5" fill="#0f172a"
                    stroke={tune.rollClamped?'#f59e0b':'#cbd5e1'} strokeWidth="1.5"/>
                </g>
              </svg>
              <span style={{fontSize:10,color:'#94a3b8',letterSpacing:1}}>ARB SHARE</span>
              <span style={{fontFamily:'Courier New',fontSize:13,fontWeight:700,color:'#e2e8f0'}}>{Math.round(tune.arbShare)}</span>
              <span style={{fontSize:10,color:'#94a3b8'}}>%</span>
            </div>
            {/* roll stiffness split bar */}
            <div style={{display:'flex',height:3,borderRadius:2,overflow:'hidden',marginBottom:2}}>
              <div style={{flex:Math.max(0,100-tune.arbShare),background:'#3b82f6',opacity:0.55,transition:'flex .2s'}}/>
              <div style={{flex:Math.max(0,tune.arbShare),background:'#f59e0b',opacity:0.75,transition:'flex .2s'}}/>
            </div>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:'#94a3b8',marginBottom:10}}>
              <span>SPRINGS {Math.round(100-tune.arbShare)}%</span>
              <span>ARBs {Math.round(tune.arbShare)}%</span>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:10}}>
              <span style={{fontSize:12,color:'#94a3b8'}}>Stiffness Mode</span>
              <Hint text="AUTO derives ARB stiffness from the car's natural roll tendency — heavier, taller, softer cars get more ARB contribution. ROLL ° targets a specific body roll angle. SHARE % directly sets ARBs as a fraction of total roll stiffness."/>
              <div style={{display:'flex',gap:3,marginLeft:'auto'}}>
                <button className={`tog${(fe.arbMode??'auto')==='auto'?' on':''}`}
                  onClick={()=>pFe('arbMode')('auto')}>AUTO</button>
                <button className={`tog${(fe.arbMode??'auto')==='roll'?' on':''}`}
                  onClick={()=>setFe(p=>({...p,arbMode:'roll',
                    arbTargetRollMan:Math.round(physics.arbTargetRoll*10)/10}))}>ROLL °</button>
                <button className={`tog${(fe.arbMode??'auto')==='share'?' on':''}`}
                  onClick={()=>setFe(p=>({...p,arbMode:'share',
                    arbShareMan:Math.round(tune.arbShare)}))}>SHARE %</button>
              </div>
            </div>
            {(fe.arbMode??'auto')==='roll'&&
              <Field label="Target Roll Angle" value={fe.arbTargetRollMan} onChange={pFe('arbTargetRollMan')}
                min={0.3} max={5.0} step={0.1} unit="° @ 1g"
                hint="Body roll the anti-roll bars are solved to allow. Low (≈0.5–1°) = stiff bars, flat cornering. High (≈3–5°) = soft bars that let the suspension articulate over terrain."/>}
            {(fe.arbMode??'auto')==='share'&&
              <Field label="ARB Share" value={fe.arbShareMan??15} onChange={pFe('arbShareMan')}
                min={0} max={80} step={1} unit="%"
                hint="Fraction of total roll stiffness supplied by ARBs. 0% = springs handle all roll resistance. 20–30% is typical sport. Higher = stiffer bars relative to springs, more abrupt load transfer."/>}
            <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:10,marginTop:4}}>
              <span style={{fontSize:12,color:'#94a3b8'}}>Balance Mode</span>
              <Hint text="WEIGHT splits front/rear ARB from the car's weight distribution, adjusted by the ARB Bias slider. MECH solves the ARB split to hit a target mech balance value. CO-SOLVE adjusts both rear spring stiffness and ARB split together — Spring Share controls how much each contributes. MAN lets you set front/rear ARB clicks directly for calibration testing."/>
              <div style={{display:'flex',gap:3,marginLeft:'auto'}}>
                <button className={`tog${(fe.arbBalMode??'weight')==='weight'?' on':''}`}
                  onClick={()=>pFe('arbBalMode')('weight')}>WEIGHT</button>
                <button className={`tog${(fe.arbBalMode??'weight')==='mech'?' on':''}`}
                  onClick={()=>pFe('arbBalMode')('mech')}>MECH</button>
                <button className={`tog${(fe.arbBalMode??'weight')==='coSolve'?' on':''}`}
                  onClick={()=>pFe('arbBalMode')('coSolve')}>CO-SOLVE</button>
                <button className={`tog${(fe.arbBalMode??'weight')==='man'?' on':''}`}
                  onClick={()=>{
                    // Capture current tune values BEFORE switching to MAN mode
                    const arbF=Math.round(tune.arbF*10)/10;
                    const arbR=Math.round(tune.arbR*10)/10;
                    setFe(p=>({...p,arbBalMode:'man',arbManF:arbF,arbManR:arbR}));
                  }}>MAN</button>
              </div>
            </div>
            {(fe.arbBalMode??'weight')==='mech'&&<>
              <div style={{display:'flex',alignItems:'center',gap:8,
                           padding:'6px 10px',background:'#0a0f1a',borderRadius:2,
                           border:'1px solid #1e293b',marginBottom:10}}>
                <span style={{fontSize:10,color:'#94a3b8',letterSpacing:1}}>ARB SPLIT</span>
                <span style={{fontFamily:'Courier New',fontSize:13,fontWeight:700,color:'#e2e8f0'}}>
                  F {tune.balArbSplit!=null?100-tune.balArbSplit:'—'}% / R {tune.balArbSplit??'—'}%
                </span>
              </div>
            </>}
            {(fe.arbBalMode??'weight')==='coSolve'&&<>
              <div style={{display:'flex',gap:8,marginBottom:10}}>
                <div style={{flex:1,display:'flex',alignItems:'center',gap:8,
                             padding:'6px 10px',background:'#0a0f1a',borderRadius:2,
                             border:'1px solid #1e293b'}}>
                  <span style={{fontSize:10,color:'#94a3b8',letterSpacing:1}}>ARB SPLIT</span>
                  <span style={{fontFamily:'Courier New',fontSize:13,fontWeight:700,color:'#e2e8f0'}}>
                    F {tune.balArbSplit!=null?100-tune.balArbSplit:'—'}% / R {tune.balArbSplit??'—'}%
                  </span>
                </div>
                <div style={{flex:1,display:'flex',alignItems:'center',gap:8,
                             padding:'6px 10px',background:'#0a0f1a',borderRadius:2,
                             border:'1px solid #1e293b'}}>
                  <span style={{fontSize:10,color:'#94a3b8',letterSpacing:1}}>SOLVED REAR Hz</span>
                  <span style={{fontFamily:'Courier New',fontSize:13,fontWeight:700,color:'#e2e8f0'}}>
                    {tune.rHz!=null?tune.rHz.toFixed(2):'—'} Hz
                  </span>
                </div>
              </div>
              <FeelSlider label="SPRING SHARE" value={fe.springShare??50} onChange={pFe('springShare')}
                min={0} max={100} leftLabel="ARB ONLY" rightLabel="SPRING ONLY"
                markers={[{value:50,color:'#94a3b8',label:'50/50'}]}
                readout={`SPR ${fe.springShare??50}% / ARB ${100-(fe.springShare??50)}%`}
                hint="How much of the mechanical balance correction comes from rear spring stiffness vs ARB split. 0% = ARB handles all correction (rear Hz equals front Hz). 100% = springs handle all correction (ARB split near neutral). 50% = equal contribution from both."/>
            </>}
            {(fe.arbBalMode??'weight')==='man'&&<>
              <div style={{display:'flex',gap:6,marginBottom:10}}>
                <Field label="ARB F" value={fe.arbManF??20} onChange={pFe('arbManF')} min={1} max={65} step={0.1} hint="Front ARB clicks (manual)"/>
                <Field label="ARB R" value={fe.arbManR??20} onChange={pFe('arbManR')} min={1} max={65} step={0.1} hint="Rear ARB clicks (manual)"/>
              </div>
            </>}
          </Sec></div>

          <div id="zone-feel" style={dim('ride','feel')}><Sec title="RIDE" open={open.ride} onToggle={tog('ride')}
            onReset={()=>setFe(p=>({...p,
              rideStiffness:DEF_FE.rideStiffness,
              targetSpeed:DEF_FE.targetSpeed,
              rearHzMode:DEF_FE.rearHzMode,
              rearHzMan:DEF_FE.rearHzMan,
              rearHzMult:DEF_FE.rearHzMult,
              rideRef:DEF_FE.rideRef}))}>
            <SpringDial fHz={tune.fHz} rHz={tune.rHz}
              rsSpF={tune.rsSpF} rsSpR={tune.rsSpR}
              frontBias={ch.frontBias} clamped={physics.rearHzClamped}/>
            <div style={dim('feel')}>
            {(()=>{
              const isCoSolve=(fe.arbBalMode??'weight')==='coSolve';
              const rRef=physics.rideRef??'front'; // 'front', 'rear', or 'shared'
              // Use tune.fHz/tune.rHz (not physics values) so CO-SOLVE effectiveRHz is reflected.
              // physics.rearHz is the pre-CO-SOLVE flatRide value; tune.rHz is the actual solved Hz.
              const avgHz=(tune.fHz+tune.rHz)/2;
              const primaryHz=rRef==='rear'?tune.rHz:rRef==='shared'?avgHz:tune.fHz;
              const secLabel=rRef==='rear'?'front':'rear';
              const secHz=rRef==='rear'?tune.fHz:tune.rHz;
              return(<>
                {/* Ride reference toggle — always visible, works in CO-SOLVE via Hz inversion */}
                <div style={{display:'flex',alignItems:'center',gap:4,marginBottom:4}}>
                  <span style={{flex:1,fontSize:10,color:'#94a3b8',letterSpacing:1}}>RIDE REF.<Hint text="Which axle the stiffness slider controls. FRONT: slider sets front Hz, rear is derived. REAR: slider sets rear Hz, front is derived. SHARED: slider sets the average of both axles, the mode below sets the front/rear ratio. Switching never changes the actual front or rear frequencies — it just moves which axle the slider follows. Works in CO-SOLVE too."/></span>
                  <button className={`tog${rRef==='front'?' on':''}`}
                    onClick={()=>setFe(p=>({...p,
                      rideRef:'front',
                      rideStiffness:hzToRs(physics.frontHz),
                      ...(p.rearHzMode==='independent'?{rearHzMan:Math.round(physics.rearHz*100)/100}:{})}))}>FRONT</button>
                  <button className={`tog${rRef==='shared'?' on':''}`}
                    onClick={()=>setFe(p=>({...p,
                      rideRef:'shared',
                      rideStiffness:hzToRs((tune.fHz+tune.rHz)/2),
                      ...(p.rearHzMode==='independent'?{rearHzMode:'flatRide'}:{})}))}>SHARED</button>
                  <button className={`tog${rRef==='rear'?' on':''}`}
                    onClick={()=>setFe(p=>({...p,
                      rideRef:'rear',
                      rideStiffness:hzToRs(tune.rHz),
                      ...(p.rearHzMode==='independent'?{rearHzMan:Math.round(tune.fHz*100)/100}:{})}))}>REAR</button>
                </div>
                <FeelSlider
                  label={rRef==='rear'?'Rear Stiffness':rRef==='shared'?'Avg Stiffness':'Ride Stiffness'}
                  value={primaryHz}
                  onChange={v=>pFe('rideStiffness')(hzToRs(v))}
                  min={HZ_MIN} max={HZ_MAX} step={0.01} leftLabel={HZ_MIN.toFixed(2)} rightLabel={HZ_MAX.toFixed(2)}
                  readout={<span style={{display:'flex',alignItems:'center',gap:3}}>
                    <input type="number" className="num"
                      style={{width:44,fontSize:11,fontWeight:700,color:'#94a3b8',
                              background:'transparent',fontFamily:'Courier New',
                              borderRadius:2,textAlign:'right',padding:'0 2px',
                              border:hzDraft!==null?'1px solid #334155':'1px solid transparent'}}
                      min={HZ_MIN} max={HZ_MAX} step={0.01}
                      value={hzDraft??primaryHz.toFixed(2)}
                      onFocus={()=>setHzDraft(primaryHz.toFixed(2))}
                      onChange={e=>setHzDraft(e.target.value)}
                      onBlur={()=>{
                        const v=parseFloat(hzDraft);
                        if(!isNaN(v)) pFe('rideStiffness')(hzToRs(v));
                        setHzDraft(null);
                      }}
                      onKeyDown={e=>{if(e.key==='Enter')e.target.blur();}}/>
                    <span style={{fontSize:11,color:'#94a3b8',fontFamily:'Courier New'}}>Hz</span>
                  </span>}
                  hint={rRef==='rear'
                    ?'Rear spring frequency — the fixed reference. The mode below derives front Hz from it. Click the Hz value to type directly. Typical range: 1.0–1.8 Hz for street, 1.8–2.6 Hz for track.'
                    :rRef==='shared'
                    ?'Average of front and rear spring frequency. Moving the slider scales both axles together while the mode below holds the front/rear ratio. Click the Hz value to type directly.'
                    :'Front spring frequency — the fixed reference. The mode below derives rear Hz from it. Click the Hz value to type directly. Typical range: 1.0–1.8 Hz for street, 1.8–2.6 Hz for track.'}/>
              </>);
            })()}
            {/* secondary Hz mode toggle — hidden in CO-SOLVE (rear Hz solved automatically) */}
            {(fe.arbBalMode??'weight')!=='coSolve'&&(()=>{
              const isShared=(physics.rideRef??'front')==='shared';
              return<>
                <div style={{display:'flex',alignItems:'center',marginBottom:3,marginTop:-2}}>
                  <span style={{fontSize:10,color:'#94a3b8',letterSpacing:1,flex:1}}>Hz MODE<Hint text="How the secondary axle frequency is derived. FLAT RIDE: rear Hz is set from the target speed's suspension timing — the mathematically ideal pitch-cancelling ratio. MULTIPLIER: rear Hz is a fixed ratio of front Hz. MECH: ratio derived from the car's weight distribution, track widths, and tyre widths. INDEPENDENT: rear Hz is set manually, completely free. Hidden in CO-SOLVE — rear Hz is solved automatically."/></span>
                </div>
                <div style={{display:'grid',gridTemplateColumns:isShared?'1fr 1fr 1fr':'1fr 1fr',gap:3,marginBottom:10}}>
                  <button className={`tog${(fe.rearHzMode??'flatRide')==='flatRide'?' on':''}`}
                    onClick={()=>setFe(p=>({...p,rearHzMode:'flatRide'}))}>FLAT RIDE</button>
                  <button className={`tog${(fe.rearHzMode??'flatRide')==='multiplier'?' on':''}`}
                    onClick={()=>setFe(p=>({...p,rearHzMode:'multiplier',
                      rearHzMult:Math.round(physics.rearHz/physics.frontHz*100)/100}))}>MULTIPLIER</button>
                  <button className={`tog${(fe.rearHzMode??'flatRide')==='mech'?' on':''}`}
                    onClick={()=>setFe(p=>({...p,rearHzMode:'mech'}))}>MECH</button>
                  {!isShared&&<button className={`tog${(fe.rearHzMode??'flatRide')==='independent'?' on':''}`}
                    onClick={()=>setFe(p=>({...p,rearHzMode:'independent',
                      rearHzMan:Math.round((physics.rideRef==='rear'?physics.frontHz:physics.rearHz)*100)/100}))}>INDEPENDENT</button>}
                </div>
              </>;
            })()}
            {(fe.arbBalMode??'weight')!=='coSolve'&&(()=>{
              const rRef=physics.rideRef??'front';
              const isShared=rRef==='shared';
              const secLabel=rRef==='rear'?'front':'rear';
              const secHz=rRef==='rear'?physics.frontHz:physics.rearHz;
              const sharedReadout=`F ${physics.frontHz.toFixed(2)} · R ${physics.rearHz.toFixed(2)} Hz${physics.rearHzClamped?' ⚠':''}`;
              return(fe.rearHzMode??'flatRide')==='flatRide'
              ? <FeelSlider label="Target Speed" value={240-fe.targetSpeed}
                  onChange={v=>pFe('targetSpeed')(240-v)} min={40} max={180} step={5}
                  leftLabel="OFF" rightLabel="CITY"
                  readout={fe.targetSpeed>=200
                    ? isShared?`FLAT RIDE OFF · ${physics.frontHz.toFixed(2)} Hz both`:`FLAT RIDE OFF · ${secHz.toFixed(2)} Hz ${secLabel}`
                    : isShared
                      ? (metricUnits?`${Math.round(fe.targetSpeed*KMH_PER_MPH)} km/h · `:`${fe.targetSpeed} mph · `)+sharedReadout
                      : metricUnits
                        ? `${Math.round(fe.targetSpeed*KMH_PER_MPH)} km/h · ${secHz.toFixed(2)} Hz ${secLabel}${physics.rearHzClamped?' ⚠':''}`
                        : `${fe.targetSpeed} mph · ${secHz.toFixed(2)} Hz ${secLabel}${physics.rearHzClamped?' ⚠':''}`}
                  hint={isShared
                    ?"Scales both axles together using flat-ride timing. The average Hz is held by the Avg Stiffness slider above; this speed sets how the average is split between front and rear."
                    :rRef==='rear'
                    ?"Solves front Hz so rear and front wheels hit the road's bumps in phase at your chosen speed. Right (CITY) = lower target speed, softer front. Left (OFF) = disabled, front Hz matches rear adjusted for mass only."
                    :"The speed at which front and rear wheels hit bumps in phase (flat ride). Right (CITY) = lower target speed, stiffer rear. Left (OFF) = flat-ride correction disabled — rear Hz matches front Hz adjusted for mass only, useful for very high-speed circuits."}/>
            : (fe.rearHzMode??'flatRide')==='multiplier'
              ? <FeelSlider
                  label={isShared?'F/R Ratio':rRef==='rear'?'Front Multiplier':'Rear Multiplier'}
                  value={fe.rearHzMult??1.20}
                  onChange={pFe('rearHzMult')} min={0.50} max={3.00} step={0.01}
                  leftLabel="×0.50" rightLabel="×3.00"
                  markers={[{value:1.00,color:'#94a3b8',label:'MATCH'}]}
                  readout={isShared
                    ?`×${(fe.rearHzMult??1.20).toFixed(2)} · ${sharedReadout}`
                    :rRef==='rear'
                    ?`÷${(fe.rearHzMult??1.20).toFixed(2)} → ${secHz.toFixed(2)} Hz front`
                    :`×${(fe.rearHzMult??1.20).toFixed(2)} → ${secHz.toFixed(2)} Hz rear`}
                  hint={isShared
                    ?"Rear-to-front Hz ratio. The average is held by the Avg Stiffness slider — changing the ratio shifts stiffness between axles without moving the average."
                    :rRef==='rear'
                    ?"Front Hz as a fraction of rear Hz. ÷1.20 = front is 83% of rear stiffness. Useful when you want the front consistently softer."
                    :"Rear Hz as a multiple of front Hz. ×1.00 = matched. ×1.20 is a typical starting point for most builds."}/>
            : (fe.rearHzMode??'flatRide')==='mech'
              ? <div style={{background:'#0a0f1a',border:'1px solid #1e293b',borderRadius:2,
                             padding:'6px 10px',marginBottom:6}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                    <span style={{fontSize:10,color:'#94a3b8',letterSpacing:1}}>
                      {isShared?'SOLVED SPLIT':'SOLVED '+secLabel.toUpperCase()+' Hz'}
                    </span>
                    {isShared
                      ?<><span style={{fontFamily:'Courier New',fontSize:13,fontWeight:700,color:physics.rearHzClamped?'#f59e0b':'#e2e8f0'}}>F {physics.frontHz.toFixed(2)}</span>
                        <span style={{fontSize:10,color:'#94a3b8'}}>Hz</span>
                        <span style={{fontFamily:'Courier New',fontSize:13,fontWeight:700,color:physics.rearHzClamped?'#f59e0b':'#e2e8f0'}}>R {physics.rearHz.toFixed(2)}</span>
                        <span style={{fontSize:10,color:'#94a3b8'}}>Hz</span></>
                      :<><span style={{fontFamily:'Courier New',fontSize:14,fontWeight:700,
                                    color:physics.rearHzClamped?'#f59e0b':'#e2e8f0'}}>
                          {secHz.toFixed(2)}
                        </span>
                        <span style={{fontSize:10,color:'#94a3b8'}}>Hz</span></>}
                    {physics.rearHzClamped&&<span style={{fontSize:10,color:'#f59e0b',letterSpacing:1}}>CLAMPED</span>}
                    <span style={{flex:1}}/>
                    <span style={{fontFamily:'Courier New',fontSize:11,color:'#94a3b8'}}>
                      ×{(physics.rearHz/physics.frontHz).toFixed(2)}
                    </span>
                  </div>
                  <div style={{fontSize:10,color:'#94a3b8',lineHeight:1.4}}>
                    {isShared?'Both springs solved from average to reach':'Rear spring stiffness solved to reach'} mech balance target{' '}
                    <span style={{color:'#9ca3af',fontFamily:'Courier New'}}>{(fe.arbBalTarget??0.65).toFixed(2)}</span>.
                    {' '}{isShared?'Avg Stiffness slider shifts both together.':'Set target in ARB section above.'}
                  </div>
                </div>
              : <FeelSlider
                  label={rRef==='rear'?'Front Hz':'Rear Hz'}
                  value={fe.rearHzMan??secHz}
                  onChange={pFe('rearHzMan')} min={HZ_MIN} max={HZ_MAX} step={0.01}
                  leftLabel={HZ_MIN.toFixed(2)} rightLabel={HZ_MAX.toFixed(2)}
                  readout={<span style={{display:'flex',alignItems:'center',gap:3}}>
                    <input type="number" className="num"
                      style={{width:44,fontSize:11,fontWeight:700,color:'#94a3b8',
                              background:'transparent',fontFamily:'Courier New',
                              borderRadius:2,textAlign:'right',padding:'0 2px',
                              border:rearHzDraft!==null?'1px solid #334155':'1px solid transparent'}}
                      min={HZ_MIN} max={HZ_MAX} step={0.01}
                      value={rearHzDraft??secHz.toFixed(2)}
                      onFocus={()=>setRearHzDraft(secHz.toFixed(2))}
                      onChange={e=>setRearHzDraft(e.target.value)}
                      onBlur={()=>{
                        const v=parseFloat(rearHzDraft);
                        if(!isNaN(v)) pFe('rearHzMan')(Math.max(HZ_MIN,Math.min(HZ_MAX,v)));
                        setRearHzDraft(null);
                      }}
                      onKeyDown={e=>{if(e.key==='Enter')e.target.blur();}}/>
                    <span style={{fontSize:11,color:'#94a3b8',fontFamily:'Courier New'}}>Hz</span>
                  </span>}
                  hint={rRef==='rear'
                    ?"Front spring frequency set independently. Full decoupling — set rear via Ride Stiffness above, set front here."
                    :"Rear spring frequency set independently from flat-ride. Allows full decoupling of front and rear stiffness. Front Hz is still set by Ride Stiffness above."}/>;
            })()}
            <div style={{display:'flex',alignItems:'center',gap:6,
                         padding:'5px 8px',background:'#0a0f1a',borderRadius:2,
                         border:'1px solid #1e293b',marginBottom:10,marginTop:-6}}>
              <span style={{fontSize:10,color:'#94a3b8',letterSpacing:1}}>FRONT</span>
              <span style={{fontFamily:'Courier New',fontSize:13,fontWeight:700,color:'#e2e8f0'}}>{physics.frontHz.toFixed(2)}</span>
              <span style={{fontSize:10,color:'#94a3b8'}}>Hz</span>
              <div style={{flex:1,height:1,background:'#1e293b'}}/>
              <span style={{fontSize:10,color:'#94a3b8',letterSpacing:0.5,fontFamily:'Courier New'}}>
                {`×${(tune.rHz/physics.frontHz).toFixed(2)}`}
              </span>
              <div style={{flex:1,height:1,background:'#1e293b'}}/>
              <span style={{fontSize:10,color:'#94a3b8',letterSpacing:1}}>REAR</span>
              <span style={{fontFamily:'Courier New',fontSize:13,fontWeight:700,color:'#e2e8f0'}}>{tune.rHz.toFixed(2)}</span>
              <span style={{fontSize:10,color:'#94a3b8'}}>Hz</span>
            </div>
            {/* spring rate strip */}
            <div style={{display:'flex',alignItems:'center',gap:6,
                         padding:'4px 8px',background:'#0a0f1a',borderRadius:2,
                         border:'1px solid #1e293b',marginBottom:8,marginTop:-4}}>
              <span style={{fontSize:10,color:'#94a3b8',letterSpacing:1}}>SPR F</span>
              <span style={{fontFamily:'Courier New',fontSize:11,color:'#9ca3af'}}>
                {metricUnits
                  ?`${(tune.springF*NMM_PER_LBIN).toFixed(1)} N/mm`
                  :`${Math.round(tune.springF)} lb/in`}
              </span>
              <div style={{flex:1,height:1,background:'#1e293b'}}/>
              <span style={{fontSize:10,color:'#94a3b8',letterSpacing:1}}>SPR R</span>
              <span style={{fontFamily:'Courier New',fontSize:11,color:'#9ca3af'}}>
                {metricUnits
                  ?`${(tune.springR*NMM_PER_LBIN).toFixed(1)} N/mm`
                  :`${Math.round(tune.springR)} lb/in`}
              </span>
            </div>
            </div>
          </Sec></div>

          <div id="zone-damping" style={dim('damping')}><Sec title="DAMPERS" open={open.dampers} onToggle={tog('dampers')}
            onReset={()=>setFe(p=>({...p,
              dampingMode:DEF_FE.dampingMode,
              dampingBias:DEF_FE.dampingBias,
              reboundZeta:DEF_FE.reboundZeta,
              bumpRatio:DEF_FE.bumpRatio,
              bumpZeta:DEF_FE.bumpZeta}))}>
            <div style={{display:'flex',justifyContent:'center',marginBottom:4}}>
              <DampingDial rebound={fe.reboundZeta??70} bump={physics.bumpZeta}/>
            </div>
            {/* damping mode toggle */}
            <div style={{display:'flex',gap:3,marginBottom:10}}>
              <button className={`tog${(fe.dampingMode??'ratio')==='ratio'?' on':''}`}
                onClick={()=>setFe(p=>({...p,dampingMode:'ratio'}))}>BUMP RATIO</button>
              <button className={`tog${(fe.dampingMode??'ratio')==='independent'?' on':''}`}
                onClick={()=>setFe(p=>({...p,dampingMode:'independent',
                  bumpZeta:Math.round(physics.bumpZeta)}))}>INDEPENDENT</button>
            </div>
            <FeelSlider label="Rebound ζ" value={fe.reboundZeta??70}
              onChange={pFe('reboundZeta')} min={10} max={115} step={1}
              leftLabel="10%" rightLabel="115%"
              hint="Damping ratio for the rebound (extension) stroke — how quickly the suspension returns after compression. 55–70% is typical. Above 70% (Butterworth) the car feels planted but stiff. Above 100% (overdamped) the suspension moves sluggishly."
              markers={[
                {value:70, color:'#f59e0b',label:'BWORTH'},
                {value:100,color:'#ef4444',label:'OVER'},
              ]}
              readout={(()=>{
                const z=fe.reboundZeta??70;
                if(z>100)return`${z}% ⚠ OVERDAMPED`;
                if(z>70) return`${z}% · BUTTERWORTH`;
                return`${z}%`;
              })()}/>
            {(fe.dampingMode??'ratio')==='ratio'
              ? <FeelSlider label="Bump Ratio" value={fe.bumpRatio??56}
                  onChange={pFe('bumpRatio')} min={10} max={100} step={1}
                  leftLabel="10%" rightLabel="100%"
                  hint="Bump damping as a percentage of rebound. Lower = softer over sharp hits, more compliant on rough roads. Higher = more consistent feel between bump and rebound strokes. 40–65% is the typical range for most builds. Readout shows ratio / resulting bump ζ."
                  markers={[{value:65,color:'#f59e0b',label:'FIRM'}]}
                  readout={(()=>{
                    const ratio=Math.min(100,fe.bumpRatio??56);
                    const bz=Math.max(10,Math.min((fe.reboundZeta??70),(fe.reboundZeta??70)*ratio/100));
                    const zLabel=bz>100?`${Math.round(bz)}% ⚠ OVERDAMPED`:
                                 bz>70 ?`${Math.round(bz)}% · BUTTERWORTH`:
                                         `${Math.round(bz)}%`;
                    return`${ratio}% / ${zLabel}`;
                  })()}/>
              : <FeelSlider label="Bump ζ" value={fe.bumpZeta??39}
                  onChange={pFe('bumpZeta')} min={10} max={115} step={1}
                  leftLabel="10%" rightLabel="115%"
                  hint="Bump damping ratio set independently from rebound. Useful when you want precise control — e.g. soft bump for road compliance with firm rebound for body control. Keep below rebound for normal handling."
                  readout={(()=>{
                    const z=fe.bumpZeta??39;
                    const r=fe.reboundZeta??70;
                    const cross=z>r?' ⚠ CROSSED':'';
                    if(z>100)return`${z}% ⚠ OVERDAMPED${cross}`;
                    if(z>70) return`${z}% · BUTTERWORTH${cross}`;
                    return`${z}%${cross}`;
                  })()}/>}
            <FeelSlider label="Damping Bias" value={-(fe.dampingBias??0)}
              onChange={v=>pFe('dampingBias')(-v)} min={-50} max={50} step={1}
              leftLabel="FRONT" rightLabel="REAR"
              centered={true}
              readout={(()=>{const tot=physics.zetaF+physics.zetaR;const fP=tot>0?Math.round(physics.zetaF/tot*100):50;return`F ${fP} | ${100-fP} R`;})()}
              hint="Biases damping toward one axle by softening the opposite side. The biased axle stays at the base ζ; the other drops up to 25% at ±50. Front bias: rear gets softer — more rotation tendency, looser rear feel. Rear bias: front gets softer — more entry compliance, easier direction changes."/>
            {(()=>{
              const biased=(fe.dampingBias??0)!==0;
              const worst=Math.max(tune.settle,tune.settleR);
              const[cat,col]=worst<0.25?['STIFF','#ef4444']:worst<0.50?['SPORT','#f59e0b']:
                             worst<0.80?['ROAD','#9ca3af']:worst<1.20?['SOFT','#60a5fa']:['FLOAT','#818cf8'];
              const lbl=t=><span style={{fontSize:10,color:'#94a3b8',letterSpacing:1,width:44,flexShrink:0}}>{t}</span>;
              const val=v=><span style={{fontFamily:'Courier New',fontSize:11,color:'#9ca3af'}}>{v}</span>;
              return(
                <div style={{padding:'5px 8px',background:'#0a0f1a',borderRadius:2,
                             border:'1px solid #1e293b',marginBottom:4,marginTop:-6}}>
                  {biased&&(
                    <div style={{display:'flex',marginBottom:3}}>
                      <span style={{width:44,flexShrink:0}}/>
                      <span style={{flex:1,fontSize:10,color:'#94a3b8',letterSpacing:1}}>FRONT</span>
                      <span style={{fontSize:10,color:'#94a3b8',letterSpacing:1}}>REAR</span>
                    </div>
                  )}
                  <div style={{display:'flex',alignItems:'center',marginBottom:biased?2:0}}>
                    {lbl('REB')}
                    {biased?<>{val(`${Math.round(physics.zetaF)}%`)}<div style={{flex:1}}/>{val(`${Math.round(physics.zetaR)}%`)}</>
                           :<>{val(`${Math.round(physics.reboundZeta)}%`)}<div style={{flex:1,height:1,background:'#1e293b',margin:'0 6px'}}/><span style={{fontSize:10,color:'#94a3b8',letterSpacing:1,marginRight:6}}>BUMP</span>{val(`${Math.round(physics.bumpZeta)}%`)}</>}
                  </div>
                  {biased&&(
                    <div style={{display:'flex',alignItems:'center',marginBottom:2}}>
                      {lbl('BUMP')}
                      {val(`${Math.round(physics.bumpZetaF)}%`)}<div style={{flex:1}}/>{val(`${Math.round(physics.bumpZetaR)}%`)}
                    </div>
                  )}
                  <div style={{display:'flex',alignItems:'center',marginTop:biased?0:-2}}>
                    {lbl('SETTLE')}
                    {biased?<>{val(`${tune.settle.toFixed(2)}s`)}<div style={{flex:1}}/>{val(`${tune.settleR.toFixed(2)}s`)}</>
                           :<>{val(`${tune.settle.toFixed(2)}s`)}</>}
                    <span style={{fontSize:10,color:col,letterSpacing:1,marginLeft:biased?4:6}}>{cat}</span>
                  </div>
                </div>
              );
            })()}
          </Sec></div>

          {uiMode==='pro'&&<div id="zone-alignment" style={dim('alignment')}><Sec title="ALIGNMENT" open={open.alignment} onToggle={tog('alignment')}
            onReset={()=>setAl({...DEF_AL})}>
            <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:10}}>
              <span style={{fontSize:12,color:'#94a3b8'}}>Alignment Mode</span>
              <Hint text="AUTO derives camber, toe, and caster from build type, layout, CG height, and roll angle. MANUAL lets you enter specific values — seeds from the current AUTO recommendation when switching."/>
              <div style={{display:'flex',gap:3,marginLeft:'auto'}}>
                <button className={`tog${!al.alignManual?' on':''}`}
                  onClick={()=>setAl(p=>({...p,alignManual:false}))}>AUTO</button>
                {uiMode==='pro'&&<button className={`tog${al.alignManual?' on':''}`}
                  onClick={()=>setAl(p=>({...p,alignManual:true,
                    camberF:autoAlign.recCamberF,camberR:autoAlign.recCamberR,
                    toeF:autoAlign.recToeF,toeR:autoAlign.recToeR,
                    caster:autoAlign.recCaster}))}>MANUAL</button>}
              </div>
            </div>
            {al.alignManual&&<>
              <Field label="Camber Front" value={al.camberF} onChange={pAl('camberF')}
                min={-4.0} max={0.0} step={0.1} unit="°"
                hint="Static front camber. Negative camber tilts the top of the tyre inward. Compensates for camber gain during body roll — outer tyre stays flat through corners."/>
              <Field label="Camber Rear" value={al.camberR} onChange={pAl('camberR')}
                min={-3.5} max={0.0} step={0.1} unit="°"
                hint="Static rear camber. Rear typically needs less than front since body roll is shared more evenly and rear suspension often has lower camber gain."/>
              <Field label="Toe Front" value={al.toeF} onChange={pAl('toeF')}
                min={-0.2} max={0.2} step={0.1} unit="°"
                hint="Front toe angle. Negative = toe-out (improves turn-in, can cause instability). Positive = toe-in (more stable, slower turn-in). FWD typically toe-in, RWD typically slight toe-out."/>
              <Field label="Toe Rear" value={al.toeR} onChange={pAl('toeR')}
                min={0.0} max={0.3} step={0.1} unit="°"
                hint="Rear toe angle. Positive = toe-in (increases stability, reduces rotation). Near zero for drift/rotation, higher for stability builds."/>
              <Field label="Caster" value={al.caster} onChange={pAl('caster')}
                min={4.0} max={7.5} step={0.1} unit="°"
                hint="Steering axis tilt. Higher caster improves straight-line stability and adds camber gain through steering input. Lower caster reduces steering effort (useful for FWD). 5.0–6.5° is typical."/>
            </>}
          </Sec></div>}

          <div id="zone-drivetrain" style={dim('drivetrain')}><Sec title="DRIVETRAIN" open={open.drivetrain} onToggle={tog('drivetrain')}
            onReset={()=>setDr(p=>({...p,
              diffManual:DEF_DR.diffManual,
              diffComplement:DEF_DR.diffComplement,
              diffBiasExit:DEF_DR.diffBiasExit,
              diffBiasEntry:DEF_DR.diffBiasEntry,
              diffFrontExitBias:DEF_DR.diffFrontExitBias,
              diffAccel:DEF_DR.diffAccel,
              diffDecel:DEF_DR.diffDecel,
              diffFrontAccel:DEF_DR.diffFrontAccel,
              diffFrontDecel:DEF_DR.diffFrontDecel,
              diffRearAccel:DEF_DR.diffRearAccel,
              diffRearDecel:DEF_DR.diffRearDecel,
              diffCenter:DEF_DR.diffCenter}))}>
            <Toggle label="Layout" value={dr.layout} onChange={pDr('layout')}
              options={[{value:'FWD',label:'FWD'},{value:'RWD',label:'RWD'},{value:'AWD',label:'AWD'}]}/>
            {fieldSources.layout&&<div style={{marginBottom:8,marginTop:-4}}>
              <span style={{fontSize:9,color:'#94a3b8',background:'#94a3b815',border:'1px solid #94a3b833',borderRadius:2,padding:'1px 5px'}}>layout:{fieldSources.layout.source}</span>
            </div>}
            {uiMode==='pro'&&<div style={{display:'flex',alignItems:'center',gap:6,marginTop:8,marginBottom:10,flexWrap:'wrap'}}>
              <span style={{fontSize:12,color:'#94a3b8'}}>Differential Mode</span>
              <Hint text="AUTO derives lock values from layout, build type, weight bias, and the intent sliders. MANUAL exposes all individual lock percentages directly."/>
              <div style={{display:'flex',gap:3,marginLeft:'auto'}}>
                <button className={`tog${!dr.diffManual?' on':''}`}
                  onClick={()=>pDr('diffManual')(false)}>AUTO</button>
                <button className={`tog${dr.diffManual?' on':''}`}
                  onClick={()=>{
                    const d=diff;
                    setDr(p=>({...p,diffManual:true,
                      ...(d.layout==='AWD'
                        ?{diffFrontAccel:d.frontAccel,diffFrontDecel:d.frontDecel,
                          diffRearAccel:d.rearAccel,diffRearDecel:d.rearDecel,
                          diffCenter:d.center}
                        :{diffAccel:d.accel,diffDecel:d.decel})}));
                  }}>MANUAL</button>
              </div>
              {!dr.diffManual&&<div style={{display:'flex',alignItems:'center',gap:6,width:'100%',marginTop:4}}>
                <button className={`tog${dr.diffComplement?' on':''}`}
                  onClick={()=>pDr('diffComplement')(!dr.diffComplement)}
                  style={{marginLeft:'auto'}}
                  title="Bias the auto-solver to match chassis mech target.">
                  MATCH CHASSIS
                </button>
                <Hint text="When on, the diff auto-solver factors how far your mech balance target lies from the chassis's natural balance. A target tuned for more oversteer biases the diff toward rotation; a target tuned for understeer leans the diff toward stability. Off (default) means the diff ignores chassis target entirely. Has no effect in MANUAL mode."/>
              </div>}
            </div>}
            {!dr.diffManual&&<>
              <FeelSlider
                label="EXIT"
                value={dr.diffBiasExit??0}
                onChange={pDr('diffBiasExit')}
                min={-50} max={50}
                leftLabel={dr.layout==='FWD'?'ROTATION':'GRIP'}
                rightLabel={dr.layout==='FWD'?'PUSH':'ROTATE'}
                centered={true}
                hint={(dr.layout==='FWD'
                  ?'Front diff accel lock. Toward PUSH increases lock — more traction but more understeer on corner exit. Toward ROTATION reduces lock for cleaner pivot and less push.'
                  :dr.layout==='RWD'
                  ?'Rear diff accel lock. Toward ROTATE increases lock — more power oversteer on exit. Toward GRIP reduces lock for cleaner exit traction.'
                  :'Rear diff exit character. Toward ROTATE increases rear accel lock — more oversteer on exit. Toward GRIP reduces rear accel lock for traction.')
                  +(dr.diffComplement?' MATCH CHASSIS is on — this is further biased by your chassis mech target.':'')}
                readout={diff.layout==='AWD'
                  ?`R.Accel ${diff.rearAccel}%`
                  :`Accel ${diff.accel}%`}/>
              {dr.layout==='AWD'&&uiMode!=='beginner'&&
                <FeelSlider
                  label="FRONT EXIT"
                  value={dr.diffFrontExitBias??0}
                  onChange={pDr('diffFrontExitBias')}
                  min={-50} max={50}
                  leftLabel="NEUTRAL"
                  rightLabel="PUSH"
                  centered={true}
                  hint="Front diff accel lock for AWD. Toward PUSH increases front accel lock — more front-axle pull and understeer tendency on exit. Useful for AWD cars with strong rear rotation."
                  readout={`F.Accel ${diff.frontAccel}%`}/>}
              {dr.layout==='AWD'&&uiMode!=='beginner'&&
                <FeelSlider
                  label="POWER SPLIT"
                  value={(dr.diffCenter??65)-50}
                  onChange={v=>pDr('diffCenter')(Math.round(v+50))}
                  min={-30} max={30}
                  leftLabel="FRONT"
                  rightLabel="REAR"
                  centered={true}
                  hint="AWD center torque split. Toward REAR sends more power rearward — increases oversteer tendency and rear diff contribution to handling balance. 60–70% rear is typical for track."
                  readout={`${diff.center??65}% rear`}/>}
              <FeelSlider
                label="ENTRY"
                value={dr.diffBiasEntry??0}
                onChange={pDr('diffBiasEntry')}
                min={-50} max={50}
                leftLabel="LOOSE"
                rightLabel="STABLE"
                centered={true}
                hint={(dr.layout==='FWD'
                  ?'Front diff decel lock. Toward STABLE increases lock — more resistance to rotation on entry (understeer). Toward LOOSE reduces lock for freer corner entry.'
                  :dr.layout==='RWD'
                  ?'Rear diff decel lock. Toward STABLE increases lock — resists lift-off oversteer. Toward LOOSE reduces lock for freer rotation on entry.'
                  :'Rear diff decel lock. Toward STABLE increases lock — resists lift-off oversteer. Toward LOOSE reduces lock for more rear rotation on entry.')
                  +(dr.diffComplement?' MATCH CHASSIS is on — this is further biased (at half strength) by your chassis mech target.':'')}
                readout={diff.layout==='AWD'
                  ?`R.Decel ${diff.rearDecel}%`
                  :`Decel ${diff.decel}%`}/>
            </>}
            {uiMode==='pro'&&dr.diffManual&&(dr.layout==='AWD'?(
              <>
                <Field label="Front Accel" value={dr.diffFrontAccel} onChange={pDr('diffFrontAccel')}
                  min={0} max={100} step={1} unit="%"
                  hint="Front axle lock under power. Higher = more front pull out of corners but risks understeer. 20–35% typical."/>
                <Field label="Front Decel" value={dr.diffFrontDecel} onChange={pDr('diffFrontDecel')}
                  min={0} max={100} step={1} unit="%"
                  hint="Front axle lock off throttle. 0 is strongly recommended — anything above strongly increases understeer on corner entry."/>
                <Field label="Rear Accel" value={dr.diffRearAccel} onChange={pDr('diffRearAccel')}
                  min={0} max={100} step={1} unit="%"
                  hint="Rear axle lock under power. Higher = more oversteer on exit. 40–60% typical."/>
                <Field label="Rear Decel" value={dr.diffRearDecel} onChange={pDr('diffRearDecel')}
                  min={0} max={100} step={1} unit="%"
                  hint="Rear axle lock off throttle. Low values improve corner entry rotation. 0–15% typical."/>
                <Field label="Center Split" value={dr.diffCenter} onChange={pDr('diffCenter')}
                  min={0} max={100} step={1} unit="% rear"
                  hint="Power distribution rear bias. Higher = more oversteer. 60–70% typical for track."/>
              </>
            ):(
              <>
                <Field label="Accel Lock" value={dr.diffAccel} onChange={pDr('diffAccel')}
                  min={0} max={100} step={1} unit="%"
                  hint={dr.layout==='RWD'
                    ?"RWD rear accel lock. Higher = more exit oversteer. 25–45% typical."
                    :"FWD front accel lock. Higher = more understeer on exit. 15–25% typical."}/>
                <Field label="Decel Lock" value={dr.diffDecel} onChange={pDr('diffDecel')}
                  min={0} max={100} step={1} unit="%"
                  hint={dr.layout==='RWD'
                    ?"RWD rear decel lock. Lower = better corner entry rotation, less lift-off oversteer. 0–20% typical."
                    :"FWD front decel lock. Lower = less understeer on entry. 0–10% typical."}/>
              </>
            ))}
          </Sec></div>

          {uiMode==='pro'&&<div id="zone-brakes" style={dim('brakes')}><Sec title="BRAKES" open={open.brakes} onToggle={tog('brakes')}
            onReset={()=>setBr({...DEF_BR})}>
            <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:10}}>
              <span style={{fontSize:12,color:'#94a3b8'}}>Brake Mode</span>
              <Hint text="AUTO derives a recommended brake balance from your front weight bias and build type. MANUAL lets you set specific values."/>
              <div style={{display:'flex',gap:3,marginLeft:'auto'}}>
                <button className={`tog${!br.brakeManual?' on':''}`}
                  onClick={()=>setBr(p=>({...p,brakeManual:false}))}>AUTO</button>
                {uiMode==='pro'&&<button className={`tog${br.brakeManual?' on':''}`}
                  onClick={()=>setBr(p=>({...p,brakeManual:true,
                    brakeBias:recBrakeBias,brakePressure:100}))}>MANUAL</button>}
              </div>
            </div>
            {br.brakeManual&&<>
              <Field label="Brake Balance" value={br.brakeBias??DEF_BR.brakeBias}
                onChange={pBr('brakeBias')} min={45} max={70} step={1} unit="% front"
                hint="Front brake bias. Higher front bias = stronger front braking, more resistance to corner entry rotation (understeer). Lower = more rear braking, more rotation tendency (oversteer). Start at your front weight distribution and adjust by feel."/>
              <Field label="Brake Pressure" value={br.brakePressure??DEF_BR.brakePressure}
                onChange={pBr('brakePressure')} min={50} max={200} step={5} unit="%"
                hint="Overall brake force multiplier. 100% is the default. Increase if the car doesn't slow down fast enough; decrease if the wheels lock under light braking. Tune this to match your tyre grip level."/>
            </>}
          </Sec></div>}
          </>}
        </div>

        {/* OUTPUT PANEL */}
        <div style={{flex:1,display:'flex',flexDirection:'column',background:'#020617',minHeight:0}}>

          {/* cards — scrollable */}
          <div id="zone-output" style={{flex:1,overflowY:'auto',WebkitOverflowScrolling:'touch',overscrollBehavior:'contain',padding:'8px 10px 6px',minHeight:0,...dim('output')}}>

          {/* 1 — ALIGNMENT */}
          <Card title={`ALIGNMENT${al.alignManual?' · MANUAL':''}`}
            hint={dr.layout==='FWD'
              ?`${al.alignManual?'Manual values.':'Recommended starting point.'} Camber targets ${({street:'-1.0°',track:'-1.5°',drift:'-2.5°'})[dr.buildType??'track']} dynamic. FWD front camber reduced for traction. Toe-in front and rear for stability.`
              :dr.layout==='RWD'
              ?`${al.alignManual?'Manual values.':'Recommended starting point.'} Camber targets ${({street:'-1.0°',track:'-1.5°',drift:'-2.5°'})[dr.buildType??'track']} dynamic at ${tune.rollDeg.toFixed(1)}° roll. Front toe-out for turn-in, rear toe-in for stability.`
              :`${al.alignManual?'Manual values.':'Recommended starting point.'} Camber targets ${({street:'-1.0°',track:'-1.5°',drift:'-2.5°'})[dr.buildType??'track']} dynamic at ${tune.rollDeg.toFixed(1)}° roll. Front toe-out for turn-in, rear toe-in scaled to center bias.`}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4,marginBottom:4}}>
              <Readout label="CAMBER F" value={align.recCamberF} unit="°" decimals={1} primary/>
              <Readout label="CAMBER R" value={align.recCamberR} unit="°" decimals={1} primary/>
              <Readout label="TOE F"    value={align.recToeF}    unit="°" decimals={1} primary/>
              <Readout label="TOE R"    value={align.recToeR}    unit="°" decimals={1} primary/>
            </div>
            <Readout label="CASTER" value={align.recCaster} unit="°" decimals={1} primary/>
          </Card>

          {/* 2+3 — ANTI-ROLL BARS + SPRINGS side by side (stacked on phones) */}
          <div style={{display:'grid',gridTemplateColumns:isPhone?'1fr':'1fr 1fr',gap:6,marginBottom:6}}>
          <Card title="ANTI-ROLL BARS" accent
            hint="Click values to enter in Forza's ARB tuning menu. Roll angle and ARB share are shown in the ANTI-ROLL BARS section of inputs. Amber warn when above 88% of the game limit.">
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4}}>
              <Readout label="FRONT" value={tune.arbF} warn={tune.arbF>lim.arb*0.88}
                unit={`/ ${lim.arb}`} ctx={arbCtx(tune.arbF,lim.arb)} primary/>
              <Readout label="REAR" value={tune.arbR} warn={tune.arbR>lim.arb*0.88}
                unit={`/ ${lim.arb}`} ctx={arbCtx(tune.arbR,lim.arb)} primary/>
            </div>
            {tune.rollClamped&&<div style={{fontSize:11,color:'#f59e0b',lineHeight:1.6,
                 marginTop:8,padding:'6px 8px',background:'#020617',borderRadius:2,
                 border:'1px solid #f5a62333'}}>
              Target {tune.rollTarget.toFixed(1)}° couldn't be reached within the 1–{lim.arb} range —
              achieved {tune.rollDeg.toFixed(1)}°. {tune.rollDeg>tune.rollTarget
                ?'Bars are maxed; stiffer springs would reduce roll further.'
                :'Springs alone already exceed the target; softer springs would allow the bars more authority.'}
            </div>}
            {tune.mechBalClamped&&<div style={{fontSize:11,color:'#f97316',lineHeight:1.6,
                 marginTop:8,padding:'6px 8px',background:'#020617',borderRadius:2,
                 border:'1px solid #f9731633'}}>
              Mech balance target ({(fe.arbBalTarget??0.65).toFixed(2)}) couldn't be reached —
              achieved {tune.mechBalance.toFixed(2)}.{(fe.arbMode??'auto')==='share'
                ?' ARB Share % limits the total ARB budget — increase Spring Share so CO-SOLVE contributes more spring correction, or raise ARB Share % to give the bars more range.'
                :' ARB floor/ceiling limits prevented the required front/rear split. Widen the ARB range or reduce the balance target.'}
            </div>}
          </Card>

          <Card title="SPRINGS" accent
            hint="Spring rates in lb/in to enter in Forza. The badge shows the frequency category — SOFT/ROAD/FIRM/RACE. Hz values are shown in the FEEL section of inputs.">
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4}}>
              <Readout label="FRONT"
                value={metricUnits?tune.springF*NMM_PER_LBIN:tune.springF}
                unit={metricUnits?'N/mm':'lb/in'} decimals={metricUnits?1:0}
                ctx={hzCtx(tune.fHz)} primary/>
              <Readout label="REAR"
                value={metricUnits?tune.springR*NMM_PER_LBIN:tune.springR}
                unit={metricUnits?'N/mm':'lb/in'} decimals={metricUnits?1:0}
                ctx={hzCtx(tune.rHz)} primary/>
            </div>
            {physics.rearHzClamped&&<div style={{fontSize:11,color:'#f59e0b',lineHeight:1.6,
                 marginTop:8,padding:'6px 8px',background:'#020617',borderRadius:2,
                 border:'1px solid #f5a62333'}}>
              Rear Hz capped at 1.6× front ({tune.rHz.toFixed(2)} Hz). Raise Target Speed or increase Ride Stiffness to bring the natural ratio within range.
            </div>}
          </Card>
          </div>

          {/* 4 — DAMPERS */}
          <Card title="DAMPERS" accent
            hint="Rebound (REB) and bump (BUMP) click values for front and rear dampers. Enter in Forza's damping tuning menu. Amber warn when above 88% of the game limit. F/R balance is preserved — if either end exceeds the limit, both are scaled proportionally so the ratio is maintained.">
            <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr 1fr':'1fr 1fr 1fr 1fr',gap:4}}>
              <Readout label="REB F"  value={tune.rebF}  warn={tune.rebF>lim.damping*0.88}  unit={`/ ${lim.damping}`} primary/>
              <Readout label="REB R"  value={tune.rebR}  warn={tune.rebR>lim.damping*0.88}  unit={`/ ${lim.damping}`} primary/>
              <Readout label="BUMP F" value={tune.bumpF} warn={tune.bumpF>lim.damping*0.88} unit={`/ ${lim.damping}`} primary/>
              <Readout label="BUMP R" value={tune.bumpR} warn={tune.bumpR>lim.damping*0.88} unit={`/ ${lim.damping}`} primary/>
            </div>
            {tune.dampingClamped&&<div style={{fontSize:11,color:'#f59e0b',lineHeight:1.6,
                 marginTop:8,padding:'6px 8px',background:'#020617',borderRadius:2,
                 border:'1px solid #f5a62333'}}>
              F/R balance preserved — damper values scaled proportionally to fit within 1–{lim.damping}.
              Reduce Rebound ζ or Bump Ratio to achieve target damping character.
            </div>}
          </Card>

          {/* 5 — BRAKES */}
          <Card title={`BRAKES${br.brakeManual?' · MANUAL':''}`}
            hint="Brake balance and pressure starting point. Balance affects corner entry — higher front bias increases understeer tendency, lower increases rotation. Fine-tune in 1% steps by feel.">
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4}}>
              <Readout label="BALANCE" value={brakeBias} unit="% F"                ctx={brakeBias>55?['FRONT','#3b82f6']:brakeBias<50?['REAR','#ef4444']:['NEUTRAL','#cbd5e1']}/>
              <Readout label="PRESSURE" value={brakePressure} unit="%" decimals={0}/>
            </div>
          </Card>

          {/* 6 — DIFFERENTIAL */}
          <Card title="DIFFERENTIAL"
            hint={diff.layout==='FWD'
              ?'Starting point — fine-tune by feel in 1% steps. Accel lock controls exit traction and understeer. Decel near zero improves corner entry rotation.'
              :diff.layout==='RWD'
              ?'Starting point — fine-tune by feel in 1% steps. Accel lock aids exit rotation. Decel low for better corner entry; raise for stability under lift-off.'
              :`Starting point — fine-tune by feel in 1% steps. Front decel at 0 minimises entry understeer. Rear decel low for rotation. Center ${diff.center}% rear.`}>
            {diff.layout==='AWD'?(
              <>
                <div style={{fontSize:10,color:'#94a3b8',letterSpacing:2,marginBottom:3}}>FRONT AXLE</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4,marginBottom:6}}>
                  <Readout label="ACCEL" value={diff.frontAccel} unit="%" decimals={0} ctx={diffCtx(diff.frontAccel)}/>
                  <Readout label="DECEL" value={diff.frontDecel} unit="%" decimals={0} ctx={diffCtx(diff.frontDecel)}/>
                </div>
                <div style={{fontSize:10,color:'#94a3b8',letterSpacing:2,marginBottom:3}}>REAR AXLE</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4,marginBottom:6}}>
                  <Readout label="ACCEL" value={diff.rearAccel} unit="%" decimals={0} ctx={diffCtx(diff.rearAccel)}/>
                  <Readout label="DECEL" value={diff.rearDecel} unit="%" decimals={0} ctx={diffCtx(diff.rearDecel)}/>
                </div>
                <div style={{fontSize:10,color:'#94a3b8',letterSpacing:2,marginBottom:3}}>CENTER</div>
                <Readout label="SPLIT" value={diff.center} unit="% rear" decimals={0} ctx={diffCtx(diff.center)}/>
              </>
            ):(
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4}}>
                <Readout label="ACCEL LOCK" value={diff.accel} unit="%" decimals={0} ctx={diffCtx(diff.accel)}/>
                <Readout label="DECEL LOCK" value={diff.decel} unit="%" decimals={0} ctx={diffCtx(diff.decel)}/>
              </div>
            )}
            {/* diff handling summary strip */}
            {(()=>{
              const fmtBias=(v,label)=>{
                const abs=Math.abs(v).toFixed(1);
                const neutral=Math.abs(v)<=0.05;
                const col=neutral?'#94a3b8':v>0?'#ef4444':'#3b82f6'; // positive=OS
                const arrow=neutral?'±':v>0?'→OS':'→US';
                return(
                  <div style={{display:'flex',alignItems:'baseline',gap:4}}>
                    <span style={{fontSize:10,color:'#94a3b8',letterSpacing:1}}>{label}</span>
                    <span style={{fontFamily:'Courier New',fontSize:12,fontWeight:700,color:col}}>
                      {arrow} {neutral?'0.0':abs}
                    </span>
                  </div>
                );
              };
              const sep=<div style={{height:1,flex:1,background:'#1e293b',margin:'0 8px'}}/>;
              const strip=(a,al,b,bl)=>(
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',
                             marginTop:6,padding:'5px 8px',background:'#0f172a',borderRadius:2,
                             border:'1px solid #1e293b'}}>
                  {fmtBias(a,al)}{sep}{fmtBias(b,bl)}
                </div>
              );
              return diff.layout==='AWD'?(
                <>
                  {strip(diff.bDiffFront,'F.AXLE',diff.bDiffRear,'R.AXLE')}
                </>
              ):strip(diff.bDiffAccel,'ACCEL BIAS',diff.bDiffDecel,'DECEL BIAS');
            })()}
          </Card>

          </div>{/* end cards */}

          {/* AT-A-GLANCE STRIP — collapsible */}
          {/* TOOLBAR — saves, check, share, import */}
          <div style={{flexShrink:0,borderTop:'1px solid #0f172a',background:'#020617',...dim('presets')}}>
            {/* presets header — collapsible */}
            <div className="collapsible-hdr"
                 onClick={()=>setOpen(p=>({...p,presetsOpen:!p.presetsOpen}))}
                 style={{display:'flex',alignItems:'center',justifyContent:'space-between',
                         padding:'10px 12px',cursor:'pointer',userSelect:'none'}}>
              <span style={{fontSize:10,color:'#94a3b8',letterSpacing:2}}>PRESETS</span>
              <span style={{fontSize:11,color:'#94a3b8'}}>{open.presetsOpen?'▲':'▼'}</span>
            </div>
            {/* 3×2 slot grid (2 cols, 3 rows) */}
            {open.presetsOpen&&<div style={{padding:'0 12px 8px'}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4,marginBottom:6}}>
                {[1,2,3,4,5,6].map(i=>(
                  <SaveSlot key={i} i={i} s={saves[i]}
                    onLoad={()=>handleSlot(i)}
                    onSave={()=>handleSlot(i)}
                    onClear={()=>clearSlot(i)}
                    onRename={renameSlot}
                    onNotes={notesSlot}
                    onSaveOver={()=>overwriteSlot(i)}
                    onResetDefault={()=>resetSlot(i)}/>
                ))}
              </div>
            </div>}
            {/* action row — always visible */}
            <div style={{display:'flex',gap:3,alignItems:'center',flexWrap:'wrap',padding:'0 12px 6px'}}>
              <button className={`tbtn${loadMode==='fe'?' on':''}`} style={{fontSize:10,letterSpacing:0.5}}
                onClick={()=>setLoadMode(m=>m==='all'?'fe':'all')}
                title={loadMode==='all'
                  ?'Loading feel + drivetrain. Click to load feel only (keeps your current drivetrain).'
                  :'Loading feel only. Click to restore full feel + drivetrain loading.'}>
                {loadMode==='all'?'FE+DR':'FE'}
              </button>
              <div style={{flex:1}}/>
              <button className="tbtn" onClick={()=>setShowResetModal(true)} style={{fontSize:11,color:'#fca5a5'}}
                title="Reset entire app to defaults: tune, zoom, mode, tutorials, units (saves preserved)">RESET</button>
              <button className="tbtn" onClick={()=>setShowChecker(true)} style={{fontSize:11}}>CHECK</button>
              <button className="tbtn" style={{fontSize:11}} onClick={()=>{
                try{
                  const payload=encodeTune(ch,fe,dr,br);
                  if(navigator.clipboard&&navigator.clipboard.writeText){
                    navigator.clipboard.writeText(payload).then(()=>{
                      alert('Tune code copied to clipboard. Share it with anyone running SUSP OS.');
                    }).catch(()=>prompt('Copy this tune code:',payload));
                  } else {
                    prompt('Copy this tune code:',payload);
                  }
                }catch(e){console.error('Share failed',e);}
              }}>SHARE</button>
              <button className="tbtn" style={{fontSize:11}} onClick={()=>{
                const raw=prompt('Paste a tune code:');
                if(!raw)return;
                const code=raw.replace(/\s/g,'');
                try{
                  const{ch:ic,fe:ife,dr:idr,br:ibr}=sanitizeTune(decodeTune(code));
                  setCh({...DEF_CH,...ic});
                  setFe({...DEF_FE,...ife});
                  setDr({...DEF_DR,...idr});
                  setBr({...DEF_BR,...ibr});
                }catch(e){
                  console.error('Import failed:',e,code);
                  alert('Invalid tune code: '+e.message+'\n\nMake sure you pasted the full string.');
                }
              }}>IMPORT</button>
            </div>
          </div>

          {/* PINNED — HANDLING BALANCE */}
          <div id="zone-balance-bar" style={{flexShrink:0,borderTop:'1px solid #1e293b',background:'#020617',
                                             paddingBottom:'env(safe-area-inset-bottom,0px)',...dim('balance-bar')}}>
            {/* compact header row — tap to expand */}
            <div className="collapsible-hdr"
                 onClick={()=>{
                   if(isPhone){
                     // On phones the tap reveals/hides the full bar stack (the summary line stays).
                     const next=!footerOpen;
                     setFooterOpen(next);
                     if(next){ if(!balTutSeen){setBalTutSeen(true);openBalTut();} }
                     else { setOpen(p=>({...p,balanceExpanded:false})); } // collapsing also hides the detail panel
                   } else {
                     setOpen(p=>{
                       const next=!p.balanceExpanded;
                       if(next&&!balTutSeen){setBalTutSeen(true);openBalTut();}
                       return{...p,balanceExpanded:next};
                     });
                   }
                 }}
                 style={{padding:isPhone?'10px 8px':'10px 14px',cursor:'pointer'}}>
              <div style={{display:'flex',alignItems:'center',gap:isPhone?5:8,marginBottom:5,flexWrap:'wrap'}}>
                <span style={{fontSize:10,color:'#94a3b8',letterSpacing:2}}>HANDLING BALANCE</span>
                <Hint text="Combined steady-state handling tendency from all tuning inputs. Positive (+) = oversteer tendency, negative (−) = understeer. Zero is weight-matched neutral — neither end saturates grip first. Tap to expand for contributor breakdown and actionable tip."/>
                <span style={{fontSize:10,color:'#94a3b8',letterSpacing:1}}>·</span>
                <span style={{fontFamily:'Courier New',fontSize:13,fontWeight:700,
                              color:Math.abs(bTotFull)<3?'#e2e8f0':bTotFull>0?'#ef4444':'#3b82f6'}}>
                  {`${bTotFull>=0?'+':''}${bTotFull.toFixed(1)}`}
                </span>
                <span style={{fontSize:11,letterSpacing:2,
                              color:Math.abs(bTotFull)<3?'#e2e8f0':bTotFull>0?'#ef4444':'#3b82f6'}}>
                  {Math.abs(bTotFull)<3?'NEUTRAL':bTotFull>0?'OVERSTEER':'UNDERSTEER'}
                </span>
                <span style={{flex:1}}/>
                {tune.mechBalance!=null&&<span style={{display:'flex',alignItems:'center',gap:4,fontSize:10,color:'#475569',letterSpacing:1,fontFamily:'Courier New'}}>
                  <span>MECH {tune.mechBalance.toFixed(2)}
                  {(()=>{const _d=tune.mechBalance-natMechBalance;const _a=Math.abs(_d);
                    if(_a<0.01)return null;
                    return <span style={{color:_d>0?'#60a5fa':'#f59e0b'}}>{(_d>=0?'+':'')+_d.toFixed(2)}</span>;
                  })()}</span>
                  <Hint text="Mech Balance is the rear fraction of total roll stiffness (0 = all front, 1 = all rear, 0.5 = even split). This matches Forza's in-game mech balance display. The delta shows how far your setup has shifted from the car's natural balance — blue means more rear-biased than natural, amber means more front-biased."/>
                </span>}
                <span style={{fontSize:10,color:'#94a3b8'}}>
                  {(isPhone?footerOpen:open.balanceExpanded)?'▲':'▼'}
                </span>
              </div>
              {/* Bar stack — always shown on desktop; on phones it collapses behind the summary line. */}
              {(!isPhone||footerOpen)&&<>
              {/* compact stacked balance bar — each contributor rendered as a segment from centre */}
              {(()=>{
                const cl=v=>Math.max(-50,Math.min(50,v));
                const allSegs=[
                  {key:'sp', val:tune.bSp??0,   col:'#60a5fa'},  // springs — blue family
                  {key:'ab', val:tune.bAb??0,   col:'#818cf8'},  // ARBs — indigo
                  {key:'df', val:(diff.bDiffAccel??0)+(diff.bDiffDecel??0), col:'#f59e0b'}, // diff — amber
                  {key:'br', val:bBrakeEntry,   col:'#34d399'},  // brakes — green
                  {key:'dm', val:bDampBias,      col:'#a78bfa'},  // damping — violet
                ].filter(s=>Math.abs(s.val)>0.3);
                // Build segments left→right; each stacks outward from the previous
                // Negative segs grow leftward from centre, positive grow rightward
                let posOffset=0, negOffset=0;
                return(
                  <div style={{position:'relative',height:16,background:'#0a0f1a',border:'1px solid #1e293b',
                               borderRadius:2,overflow:'hidden'}}>
                    {/* zone shading */}
                    <div style={{position:'absolute',left:'5%', width:'20%',top:0,bottom:0,background:'#3b82f614'}}/>
                    <div style={{position:'absolute',left:'25%',width:'20%',top:0,bottom:0,background:'#3b82f608'}}/>
                    <div style={{position:'absolute',left:'55%',width:'20%',top:0,bottom:0,background:'#ef444408'}}/>
                    <div style={{position:'absolute',left:'75%',width:'15%',top:0,bottom:0,background:'#f9731614'}}/>
                    <div style={{position:'absolute',left:'90%',width:'10%',top:0,bottom:0,background:'#ef444422'}}/>
                    <div style={{position:'absolute',left:'50%',top:0,bottom:0,width:1,background:'#334155'}}/>
                    {allSegs.map(({key,val,col})=>{
                      const p=cl(val);
                      if(p>=0){
                        const seg={position:'absolute',top:2,bottom:2,borderRadius:1,
                          left:`${50+posOffset}%`,width:`${p}%`,
                          background:col+'bb'};
                        posOffset+=p;
                        return <div key={key} style={seg}/>;
                      } else {
                        const seg={position:'absolute',top:2,bottom:2,borderRadius:1,
                          right:`${50+negOffset}%`,width:`${-p}%`,
                          background:col+'bb'};
                        negOffset+=(-p);
                        return <div key={key} style={seg}/>;
                      }
                    })}
                    <div style={{position:'absolute',left:5,top:'50%',transform:'translateY(-50%)',
                                 fontSize:10,color:'#3b82f6',letterSpacing:1,fontWeight:700}}>US</div>
                    <div style={{position:'absolute',right:5,top:'50%',transform:'translateY(-50%)',
                                 fontSize:10,color:'#ef4444',letterSpacing:1,fontWeight:700}}>OS</div>
                  </div>
                );
              })()}
              {/* stacked bar legend — immediately below the bar it describes */}
              <div style={{display:'flex',gap:8,marginTop:3,paddingLeft:2,alignItems:'center',flexWrap:'wrap'}}>
                {[
                  {key:'sp',col:'#60a5fa',label:'SPR',  val:tune.bSp??0},
                  {key:'ab',col:'#818cf8',label:'ARB',  val:tune.bAb??0},
                  {key:'df',col:'#f59e0b',label:'DIFF', val:(diff.bDiffAccel??0)+(diff.bDiffDecel??0)},
                  {key:'br',col:'#34d399',label:'BRK',  val:bBrakeEntry},
                  {key:'dm',col:'#a78bfa',label:'DAMP', val:bDampBias},
                ].filter(s=>Math.abs(s.val)>0.3).map(({key,col,label})=>(
                  <span key={key} style={{display:'flex',alignItems:'center',gap:3,fontSize:10,color:'#94a3b8'}}>
                    <span style={{display:'inline-block',width:8,height:4,borderRadius:1,background:col+'bb',flexShrink:0}}/>
                    {label}
                  </span>
                ))}
                <Hint text="Stacked bar shows each contributor as a coloured segment: SPR (springs), ARB (anti-roll bars), DIFF (differential), BRK (brakes), DAMP (damping bias). Segments stack outward from neutral — the bar's total reach is the combined handling balance."/>
              </div>
              {/* mech balance reference strip: NAT · CURRENT · TARGET on 0–1 scale */}
              {tune.mechBalance!=null&&(()=>{
                const cur=tune.mechBalance;
                const nat=natMechBalance;
                const tgt=fe.arbBalTarget??MECH_BALANCE_TARGET;
                const pct=v=>`${Math.max(0,Math.min(100,v*100)).toFixed(1)}%`;
                const showTgt=(physics.arbBalMode==='mech'||physics.arbBalMode==='coSolve');
                const _d=cur-nat;
                return(
                  <div style={{marginTop:8}}>
                    {/* label row: section header + inline NAT/CUR/TGT values */}
                    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:3}}>
                      <span style={{fontSize:10,color:'#475569',letterSpacing:2}}>MECH BALANCE</span>
                      <Hint text="Roll stiffness rear fraction on the 0–1 scale. NAT is the car's natural balance with equal spring rates and no ARBs. CUR is where your current setup lands. TGT (shown in MECH/CO-SOLVE modes) is the balance you are targeting. The band between NAT and CUR shows how much correction your setup applies."/>
                      <span style={{fontSize:10,color:'#475569',letterSpacing:1}}>·</span>
                      <span style={{fontSize:10,color:'#475569',fontFamily:'Courier New'}}>
                        NAT <span style={{color:'#94a3b8'}}>{nat.toFixed(2)}</span>
                      </span>
                      <span style={{fontSize:10,color:'#334155'}}>→</span>
                      <span style={{fontSize:10,color:'#475569',fontFamily:'Courier New'}}>
                        CUR <span style={{color:'#e2e8f0'}}>{cur.toFixed(2)}</span>
                        {Math.abs(_d)>=0.01&&<span style={{color:_d>0?'#60a5fa':'#f59e0b',marginLeft:2}}>
                          {(_d>=0?'+':'')+_d.toFixed(2)}
                        </span>}
                      </span>
                      {showTgt&&<>
                        <span style={{fontSize:10,color:'#334155'}}>→</span>
                        <span style={{fontSize:10,color:'#60a5fa88',fontFamily:'Courier New'}}>
                          TGT <span style={{color:'#60a5fa'}}>{tgt.toFixed(2)}</span>
                        </span>
                      </>}
                    </div>
                    <div style={{position:'relative',height:8,background:'#0a0f1a',
                                 border:'1px solid #1e293b',borderRadius:2}}>
                      {/* filled band from NAT to CURRENT */}
                      {(()=>{
                        const lo=Math.min(nat,cur),hi=Math.max(nat,cur);
                        return lo<hi&&<div style={{position:'absolute',top:1,bottom:1,
                          left:pct(lo),width:pct(hi-lo),background:'#1e293b',borderRadius:1}}/>;
                      })()}
                      {/* NAT tick */}
                      <div style={{position:'absolute',top:0,bottom:0,left:pct(nat),width:1,
                                   background:'#475569',transform:'translateX(-50%)'}}/>
                      {/* TARGET tick — only shown in MECH/CO-SOLVE */}
                      {showTgt&&<div style={{position:'absolute',top:0,bottom:0,left:pct(tgt),width:2,
                                            background:'#60a5fa99',transform:'translateX(-50%)',borderRadius:1}}/>}
                      {/* CURRENT position */}
                      <div style={{position:'absolute',top:0,bottom:0,left:pct(cur),width:2,
                                   background:'#e2e8f0cc',transform:'translateX(-50%)',borderRadius:1}}/>
                      <span style={{position:'absolute',left:3,top:'50%',transform:'translateY(-50%)',
                                    fontSize:8,color:'#1e293b',letterSpacing:1}}>F</span>
                      <span style={{position:'absolute',right:3,top:'50%',transform:'translateY(-50%)',
                                    fontSize:8,color:'#1e293b',letterSpacing:1}}>R</span>
                    </div>
                  </div>
                );
              })()}
              {/* response bar */}
              {(()=>{
                const{score}=responseFactors;
                const p=Math.max(-50,Math.min(50,(score-0.5)*100));
                const aLabel=Math.abs(p)<15?'BALANCED':p>0?'REACTIVE':'PLANTED';
                const aCol=Math.abs(p)<15?'#475569':p>0?'#f59e0b':'#22c55e';
                const fs=p>=0?{left:'50%',width:`${p}%`}:{left:`${50+p}%`,width:`${-p}%`};
                return(<>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginTop:8,marginBottom:3}}>
                    <span style={{fontSize:10,color:'#475569',letterSpacing:2}}>RESPONSE</span>
                    <Hint text="Transient response character — how quickly and freely the car reacts to steering inputs. PLANTED (left) means settled and damped: the car resists sudden direction changes but feels stable and predictable. REACTIVE (right) means quick to respond: the car turns in immediately but can feel nervous. Driven by spring frequency (50%), damping ratio (20%), toe (15%), caster (10%), and rear/front Hz ratio (5%). Independent of handling balance — a car can be neutral and still feel very planted or very reactive."/>
                    <span style={{fontSize:10,color:'#475569',letterSpacing:1}}>·</span>
                    <span style={{fontFamily:'Courier New',fontSize:11,fontWeight:700,color:aCol}}>
                      {`${p>=0?'+':''}${Math.round(p)}`}
                    </span>
                    <span style={{fontSize:10,letterSpacing:2,color:aCol}}>{aLabel}</span>
                  </div>
                  <div style={{position:'relative',height:14,background:'#0a0f1a',border:'1px solid #1e293b',
                               borderRadius:2,overflow:'hidden'}}>
                    {/* zone shading: planted | balanced | responsive | twitchy */}
                    <div style={{position:'absolute',left:'0%',  width:'20%',top:0,bottom:0,background:'#22c55e14'}}/>
                    <div style={{position:'absolute',left:'20%', width:'30%',top:0,bottom:0,background:'#22c55e08'}}/>
                    <div style={{position:'absolute',left:'55%', width:'25%',top:0,bottom:0,background:'#f59e0b08'}}/>
                    <div style={{position:'absolute',left:'80%', width:'20%',top:0,bottom:0,background:'#f59e0b18'}}/>
                    <div style={{position:'absolute',left:'50%',top:0,bottom:0,width:1,background:'#1e293b'}}/>
                    {p!==0&&<div style={{position:'absolute',top:2,bottom:2,borderRadius:1,
                                        background:p>0?'#f59e0b55':'#22c55e55',...fs}}/>}
                    <div style={{position:'absolute',left:5,top:'50%',transform:'translateY(-50%)',
                                 fontSize:10,color:'#22c55e',letterSpacing:1,fontWeight:700}}>PLANTED</div>
                    <div style={{position:'absolute',right:5,top:'50%',transform:'translateY(-50%)',
                                 fontSize:10,color:'#f59e0b',letterSpacing:1,fontWeight:700}}>REACTIVE</div>
                  </div>
                </>);
              })()}
              {/* phones: reach the full contributor breakdown + actionable tip (desktop taps the header for this) */}
              {isPhone&&<div style={{display:'flex',justifyContent:'center',marginTop:8}}>
                <button onClick={e=>{e.stopPropagation();setOpen(p=>({...p,balanceExpanded:!p.balanceExpanded}));}}
                  style={{background:'none',border:'1px solid #1e293b',borderRadius:2,color:'#94a3b8',
                          fontFamily:'Courier New',fontSize:10,padding:'5px 14px',cursor:'pointer',letterSpacing:1}}>
                  {open.balanceExpanded?'HIDE CONTRIBUTIONS ▲':'CONTRIBUTIONS ▼'}
                </button>
              </div>}
              </>}
            </div>
            {/* expanded full verdict */}
            {open.balanceExpanded&&
              <div style={{padding:'0 14px 12px',borderTop:'1px solid #0f172a'}}>
                <div style={{display:'flex',justifyContent:'flex-end',gap:4,padding:'6px 0 4px'}}>
                  {(()=>{
                    const bs={background:'none',border:'1px solid #1e293b',borderRadius:2,
                      fontFamily:'Courier New',fontSize:10,padding:'3px 8px',cursor:'pointer',letterSpacing:1};
                    return(<>
                      <button style={{...bs,color:'#94a3b8'}} onClick={e=>{e.stopPropagation();openBalTut();}}>? GUIDE</button>
                      {isPhone&&<button style={{...bs,color:'#94a3b8'}} onClick={e=>{e.stopPropagation();setOpen(p=>({...p,balanceExpanded:false}));}}>✕ CLOSE</button>}
                    </>);
                  })()}
                </div>
                {/* phones: cap the contributor breakdown height; scroll vertically only (never horizontally) */}
                <div style={isPhone?{maxHeight:'42vh',overflowY:'auto',overflowX:'hidden',overscrollBehavior:'contain',WebkitOverflowScrolling:'touch'}:undefined}>
                <HandlingVerdict total={bTotFull} bSp={tune.bSp} bAb={tune.bAb}
                  bDiffAccel={diff.bDiffAccel} bDiffDecel={diff.bDiffDecel}
                  bDiffFront={diff.bDiffFront} bDiffRear={diff.bDiffRear}
                  diffLayout={diff.layout}
                  bBrakeEntry={bBrakeEntry} bDampBias={bDampBias}
                  mechBalance={null} uiMode={uiMode}/>
                {/* RESPONSE factor breakdown */}
                {(()=>{
                  const{score,hzNorm,dampNorm,toeNorm,casterNorm,rearHzNorm}=responseFactors;
                  const segs=[
                    {label:'SPRINGS',norm:hzNorm,        weight:0.50,hint:'Higher ride frequency = faster natural response. Primary driver of transient response character.'},
                    {label:'DAMPING',norm:1-dampNorm,    weight:0.20,hint:'Lower rebound damping = less resistance to roll initiation = more agile. Higher damping = more planted.'},
                    {label:'TOE F',  norm:toeNorm,       weight:0.15,hint:'Front toe-out sharpens turn-in response (agile). Toe-in adds straight-line stability.'},
                    {label:'CASTER', norm:casterNorm,    weight:0.10,hint:'Lower caster reduces self-centering force, allowing quicker steering response.'},
                    {label:'R/F Hz', norm:rearHzNorm,    weight:0.05,hint:'Stiffer rear relative to front promotes rotation tendency (agile).'},
                  ].map(s=>({...s,
                    // weighted deviation from neutral: positive = pushing agile, negative = pushing stable
                    deviation:(s.norm-0.5)*s.weight,
                    // absolute contribution to total score
                    contribution:s.norm*s.weight,
                  }));
                  const sorted=[...segs].sort((a,b)=>Math.abs(b.deviation)-Math.abs(a.deviation));
                  const dom=sorted[0];
                  const domBig=Math.abs(dom.deviation)>0.05;
                  const agileP=Math.round((score-0.5)*100);
                  const aCol=Math.abs(agileP)<15?'#94a3b8':agileP>0?'#f59e0b':'#22c55e';
                  const tips={
                    SPRINGS: agileP>0?'Soften spring stiffness (lower Hz) for a more planted feel.':'Stiffen springs to improve transient response speed.',
                    DAMPING: agileP>0?'Increase rebound damping to settle weight transfer more firmly.':'Reduce rebound damping to free up initial roll response.',
                    'TOE F':  agileP>0?'Add front toe-in to improve straight-line stability.':'Reduce front toe-in to sharpen turn-in response.',
                    CASTER:  agileP>0?'Increase caster for stronger self-centering and stability.':'Reduce caster for lighter, quicker steering response.',
                    'R/F Hz': agileP>0?'Soften the rear relative to front to reduce rotation tendency.':'Stiffen the rear relative to front to promote rotation.',
                  };
                  const tip=Math.abs(agileP)<15
                    ?'Transient response is balanced.'+(domBig?' '+dom.label+' is the primary character driver.':'')
                    :domBig?(tips[dom.label]||'Adjust the dominant factor.'):'Setup is near balanced.';
                  return(
                    <div style={{marginTop:10,paddingTop:8,borderTop:'1px solid #0f172a'}}>
                      <div style={{fontSize:11,color:'#94a3b8',lineHeight:1.6,padding:'6px 8px',marginBottom:8,
                                   background:'#020617',borderRadius:2,border:'1px solid #0f172a'}}>{tip}</div>
                      {sorted.map(({label,deviation,contribution,hint,weight})=>{
                        // bar: deviation scaled so ±0.25 (max spring deviation) = ±50%
                        const barPct=Math.min(50,Math.abs(deviation)/0.25*50);
                        const barStyle=deviation>=0?{left:'50%',width:`${barPct}%`}:{right:'50%',width:`${barPct}%`};
                        const c=deviation>0.02?'#f59e0b':deviation<-0.02?'#22c55e':'#cbd5e1';
                        const pctOfTotal=score>0.01?Math.round(contribution/score*100):null;
                        const isDom=label===dom.label&&domBig;
                        return(
                          <div key={label} style={{display:'flex',alignItems:'center',gap:6,marginBottom:3,
                                   ...(isDom?{background:'#0a0f1a',
                                     borderLeft:'2px solid '+(deviation>0?'#f59e0b66':'#22c55e66'),
                                     borderRadius:2,padding:'3px 0 3px 4px',margin:'0 -2px 3px -4px'}:{})}}>
                            <div style={{width:80,display:'flex',alignItems:'center',gap:2,flexShrink:0}}>
                              <span style={{fontSize:10,color:isDom?'#cbd5e1':'#94a3b8',letterSpacing:1,
                                             whiteSpace:'nowrap',fontWeight:isDom?700:400}}>{label}</span>
                              <Hint text={hint}/>
                            </div>
                            <div style={{flex:1,position:'relative',height:8,background:'#0f172a',borderRadius:2}}>
                              <div style={{position:'absolute',left:'50%',top:0,bottom:0,width:1,background:'#1e293b'}}/>
                              {barPct>1&&<div style={{position:'absolute',top:1,bottom:1,borderRadius:1,
                                background:c+(isDom?'ee':'99'),...barStyle}}/>}
                            </div>
                            <span style={{fontFamily:'Courier New',fontSize:11,color:c,width:34,
                                           textAlign:'right',flexShrink:0,fontWeight:isDom?700:400}}>
                              {deviation>=0?'+':''}{(deviation*100).toFixed(1)}
                            </span>
                            <span style={{fontSize:10,color:pctOfTotal>40?c:'#475569',width:28,textAlign:'right',flexShrink:0}}>
                              {pctOfTotal!=null?`${pctOfTotal}%`:''}
                            </span>
                          </div>
                        );
                      })}
                      <div style={{fontSize:10,color:'#475569',lineHeight:1.5,marginTop:4}}>
                        Transient response factors. Higher Hz and lower damping shift toward reactive.
                      </div>
                    </div>
                  );
                })()}
                </div>
              </div>}
          </div>

        </div>{/* end output panel */}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary><App/></ErrorBoundary>
);
