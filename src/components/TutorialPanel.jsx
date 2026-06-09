const TUTORIALS={
  beginner:[
    {title:'Welcome to SUSP.OS',
     focus:null,sidebar:'close',spotlight:'hamburger',
     body:'This app calculates exact Forza suspension values from your car\'s stats and a handling target. A few inputs are all you need — the physics engine solves springs, damping, and anti-roll bars automatically. Tap the ☰ button to open the input sidebar. This guide covers the basics — INT and PRO each have their own guide that picks up where this leaves off.'},
    {title:'Getting Around',
     focus:null,
     body:'The ☰ button opens and closes the input sidebar — the right panel shows live results and updates as you type. BEG / INT / PRO control how many inputs are visible. IMP / MET switches units. HZ / MS switches between Forza Horizon and Motorsport. ↩ undoes the last change. ? reopens this guide at any time.'},
    {title:'Start From a Preset',
     focus:['presets'],
     body:'Tap one of the six preset buttons to load a baseline tune. STREET, TRACK, RALLY, DRIFT, MOTORSPT, and X COUNTRY each set a different balance target, stiffness level, and damping character. Pick the closest to your build, then adjust from there.'},
    {title:'Layout & Build Type',
     focus:['layout-build'],
     body:'Select your drive layout (FWD / RWD / AWD) and build style. Layout affects how differential lock contributes to handling balance. Build type shifts the recommended mech balance range and diff recommendations toward street, track, or drift behaviour.'},
    {title:'Weight & Front Bias',
     focus:['weight'],
     body:'Enter your car\'s total weight and front weight bias from Forza\'s car stat screen — use the selection screen, not the tuning menu. These two numbers drive almost every calculation in the app.'},
    {title:'Ride Stiffness',
     focus:['ride-stiffness'],
     body:'Controls overall suspension stiffness. SOFT is comfortable on rough surfaces. ROAD is a balanced starting point. FIRM is responsive sport. RACE is a stiff competition setup. The badge updates as you move the slider.'},
    {title:'Spring / ARB Mix',
     focus:['rear-stiffness'],
     body:'Controls how the balance correction is split between anti-roll bars and rear spring stiffness. ARBs (left) = bars do all the work, springs stay symmetric. SPRINGS (right) = rear spring stiffness carries more correction. BALANCED (centre) splits evenly — a good default.'},
    {title:'Balance (Rear Hz)',
     focus:['balance'],
     body:'Controls the rear suspension stiffness relative to front — the rear frequency multiplier. Centre (1.0×) is a neutral starting point, matching rear to front. Push toward OVERSTEER (lower, softer rear, 0.5×–0.8×) for more rotation and rear-end freedom. Push toward UNDERSTEER (higher, stiffer rear, 1.2×–2.0×) for more stable corner entry. Combined with Spring / ARB Mix, this tunes your overall balance.'},
    {title:'Character',
     focus:['character'],
     body:'Controls damping feel — how quickly the suspension settles after a bump or weight transfer. STABLE means more damped: planted and predictable. AGILE means lighter damping: livelier and more reactive to inputs. Start at centre for most builds.'},
    {title:'Handling Balance Bar',
     focus:['balance-bar'],sidebar:'close',
     body:'The Handling Balance bar is pinned at the bottom of the results panel. It shows your total oversteer or understeer tendency as a number and a bar. The bar is colour-zoned — the centre band is neutral, the mild zone is typical for intentional OS/US bias, and the outer zone is aggressive. Tap to expand a full breakdown of every contributor.'},
    {title:'Reading the Results',
     focus:['output'],
     body:'The right panel shows exact values to enter in Forza\'s tuning menu: Springs, Dampers, Anti-Roll Bars, and Alignment. Amber values mean you\'re near a game limit — soften your inputs slightly if that happens.'},
  ],
  intermediate:[
    {title:'Welcome — Intermediate Mode',
     focus:null,
     body:'Intermediate mode unlocks the full input surface on top of what you learned in Beginner. Everything is the same — just more controls. Sections in the sidebar are collapsible. This guide only covers what\'s new.'},
    {title:'Tyre Sizes',
     focus:['chassis'],
     body:'The CHASSIS section now includes tyre sizes. Enter front and rear in Forza format (e.g. 265/35R18). Tyre width sets grip capacity at the limit — wider = more grip on that axle. This feeds the CHASSIS BAL. readout (natural mechanical balance) and GRIP BIAS (at-limit handling tendency) below the inputs.'},
    {title:'Build Type & Balance Target',
     focus:['build'],
     body:'The BUILD section contains three key controls. Build type (STREET/TRACK/DRIFT) sets your intended use — it determines the recommended balance range, diff AUTO behaviour, alignment presets, and brake AUTO recommendations. Mech Balance Target (0.40–0.90) is your primary tuning intent — the roll-stiffness rear fraction you want. The BALANCE GUIDE bar shows your car\'s natural balance, the recommended range for your build type, and where your target sits. Set build type first, then choose a balance target within the recommended range.'},
    {title:'ARB Balance Modes',
     focus:['arb'],
     body:'Three modes solve the ARB/spring to hit your balance target. WEIGHT uses weight distribution as the baseline, then optionally shifts with Bias. MECH solves the ARB split alone to hit the target exactly (rear Hz modes MULTIPLIER or FLAT RIDE remain independent). CO-SOLVE adjusts both rear spring Hz and ARB split together — most flexible when you control ride stiffness and Hz mode explicitly.'},
    {title:'Ride Ref & Rear Hz',
     focus:['feel'],
     body:'RIDE REF. sets which axle anchors the stiffness slider — FRONT, SHARED, or REAR. The other axle is derived by the Rear Hz mode: FLAT RIDE (from wheelbase and target speed), MULTIPLIER (fixed ratio), MECH (solved from the balance target), or INDEPENDENT (set directly). In CO-SOLVE mode the rear Hz is solved automatically.'},
    {title:'Dampers',
     focus:['damping'],
     body:'Rebound ζ at 70% is the critically damped point — the sweet spot between bouncy and sluggish. Bump Ratio sets compression as a fraction of rebound. Damping Bias splits front and rear rebound independently: positive = more front rebound (resists turn-in weight transfer, mild understeer). The DAMP row in the Handling Balance bar shows this contribution.'},
    {title:'Drivetrain Sliders',
     focus:['drivetrain'],
     body:'Corner Exit controls on-throttle differential aggression. Corner Entry controls trail-braking rotation. AWD adds a Power Split slider (front/rear torque bias) and a Front Exit Push (how aggressively the front axle supplements on exit). All DIFF rows in the Handling Balance bar update live.'},
    {title:'Save Slots',
     focus:['presets'],
     body:'The PRESETS section now shows the full six save slots. Use ↺ to overwrite a slot with your current tune (two-tap to confirm), ✎ to rename it, and ⓘ to add notes. FE / FE+DR at the bottom of the toolbar controls whether loading a slot brings in feel only or feel and drivetrain together. SHARE generates a code — paste into IMPORT on any device.'},
  ],
  pro:[
    {title:'Welcome — Pro Mode',
     focus:null,
     body:'Pro mode adds the full physics surface on top of Intermediate: chassis geometry (wheelbase, track widths, CG height), a complete Alignment section, the Brakes section, and manual differential control. This guide only covers what\'s new.'},
    {title:'Chassis Geometry',
     focus:['chassis'],
     body:'Wheelbase, track widths, and CG height now drive the physics directly. The REACH panel shows what track width changes would shift your natural balance toward the target. Defaults suit most sports cars — enter exact values if you have them.'},
    {title:'Weight Transfer Strips',
     focus:['chassis'],
     body:'XFER F/R shows lateral load transfer per axle per g of cornering. OUT/IN show outer and inner wheel loads at 1g. Wider track and lower CG both reduce transfer. These inform ARB aggressiveness and how much camber the outer tyre needs under load.'},
    {title:'Build Type & Balance Target',
     focus:['build'],
     body:'The BUILD section is where you set your tuning intent. Build type (STREET/TRACK/DRIFT) determines the recommended balance range — the Mech Balance Target recommendations shift based on your layout and build. Mech Balance Target (0.40–0.90) is the roll-stiffness rear fraction you want to achieve. It drives everything: ARB split, spring stiffness, alignment recommendations, even differential bias if Match Chassis is on. The BALANCE GUIDE shows your natural balance, the range suited to your build, and how far from natural your target is. Set these first, then choose your solving mode (WEIGHT/MECH/CO-SOLVE) and fine-tune.'},
    {title:'ARB Solving Modes',
     focus:['arb'],
     body:'Three modes solve springs and ARBs toward your Mech Balance Target. WEIGHT uses weight distribution as the baseline, optionally shifted by ARB Bias. MECH solves the ARB split exactly to hit the target, leaving rear Hz independent. CO-SOLVE adjusts both rear spring Hz and ARB split together — use this when you control ride stiffness and Hz mode explicitly and want springs and ARBs to work together. Spring Share (in CO-SOLVE) controls how much of the correction comes from each.'},
    {title:'Alignment',
     focus:['alignment'],
     body:'AUTO derives camber, toe, and caster from build type, layout, CG height, and roll angle. Switch to MANUAL to seed from the auto values and override each axis independently. Negative front toe (toe-out) sharpens turn-in on RWD; positive rear toe stabilises the rear. Alignment affects the STABLE/AGILE breakdown.'},
    {title:'Brakes',
     focus:['brakes'],
     body:'AUTO recommends brake balance from front weight bias and build type. MANUAL lets you set bias (45–70% front) and pressure (50–200%) directly. Brake balance deviation from 50% appears as the BRAKES row in the Handling Balance bar — rear-biased brakes add oversteer on entry.'},
    {title:'Manual Differential',
     focus:['drivetrain'],
     body:'MANUAL diff exposes individual accel and decel lock percentages per axle. AWD adds separate front/rear locks plus center power split. Match Chassis (AUTO mode only) biases the diff toward your Mech Balance Target so the differential reinforces the balance set elsewhere.'},
    {title:'Tune Check',
     focus:null,
     body:'The CHECK button in the output panel opens a reverse calculator. Enter existing in-game spring and damper values to read back their natural frequency and damping ratios — useful for analysing a shared tune or verifying a manual setup.'},
    {title:'Handling Balance Expanded',
     focus:['balance-bar'],
     body:'Expand the Handling Balance bar (on phones, tap it then CONTRIBUTIONS) for the full per-contributor breakdown. Contributors are grouped into MECHANICAL (springs, ARBs) and DYNAMIC (diff, brakes, damping), each row showing its OS/US value and percentage of the total. An actionable tip at the top names the dominant contributor with a concrete fix, a RESPONSE breakdown rates transient character, and the MECH BALANCE strip marks your natural, current, and target roll-stiffness balance.'},
  ],
  balance:[
    {title:'Handling Balance',
     focus:null,
     body:'This breakdown shows how every tuning force combines into a single US/OS total. Positive (+) means oversteer tendency, negative (−) means understeer tendency. Each row is one contributor. Zero is a perfectly neutral baseline — but many drivers intentionally run +10 to +25 OS for rotation and feel. The colour zones on the bar show what\'s neutral, mild, or aggressive.'},
    {title:'Reading Each Row',
     focus:null,
     body:'Contributors are split into two groups. MECHANICAL (springs and ARBs) are your primary intentional forces — controlled by stiffness and balance settings. DYNAMIC (diff, brakes, damping) are phase and behaviour contributors. Each row shows its value and percentage of the total so you can see at a glance which is dominant. On the compact bar, each contributor appears as a colour-coded segment stacking outward from neutral.'},
    {title:'Using the Correction Tip',
     focus:null,
     body:'The tip appears at the top of the expanded panel — above the contributor rows — and names the dominant contributor with a concrete adjustment suggestion. For large imbalances, correct with the Balance slider or Mech Balance Target first. For small residual bias, fine-tune with alignment toe or damping bias.'},
    {title:'Response Bar',
     focus:null,
     body:'The RESPONSE bar rates transient character — how quickly and freely the car reacts to steering inputs. PLANTED (left) means settled and damped: predictable but slow to change direction. REACTIVE (right) means quick to respond: sharp turn-in but can feel nervous. Driven by spring frequency (50%), damping ratio (20%), front toe (15%), caster (10%), and rear/front Hz ratio (5%). Independent of the US/OS balance — a car can be neutral and still feel very planted or very reactive.'},
    {title:'Balance Guide',
     focus:null,
     body:'The BALANCE GUIDE in the ARB section uses your chassis\'s natural balance as Δ=0. The RANGE band is car-specific — it computes how much OS correction (Δ from natural) suits this layout and build, then pins it to your actual natural balance. A staggered rear-engine car and a front-heavy FE car can use the same Δ target but end up at very different absolute values. TARGET Δ shows how much you\'re pushing from natural. Use this alongside the verdict bar to connect static balance intent to dynamic handling character.'},
  ],
};

const TutorialPanel=({mode,step,onNext,onPrev,onClose,onDone})=>{
  const steps=TUTORIALS[mode]??[];
  const total=steps.length;
  const t=steps[step];
  const focusKey=mode==='balance'?'balance-bar':(t?.focus?.[0]??null);
  const CARD_W=264;
  // pos: {top,left?,right?,arrowDir,arrowOff} or null = centred
  const[pos,setPos]=useState(null);

  useEffect(()=>{
    const el=focusKey?document.getElementById('zone-'+focusKey):null;
    // Scroll sidebar so element is visible — use direct scrollTop rather than
    // scrollIntoView which can target the wrong scroll container on mobile
    if(el){
      const sidebar=document.querySelector('.sidebar-scroll');
      if(sidebar){
        const sr=sidebar.getBoundingClientRect();
        const er=el.getBoundingClientRect();
        if(er.top<sr.top+40||er.bottom>sr.bottom-40){
          const relTop=er.top-sr.top+sidebar.scrollTop;
          sidebar.scrollTo({top:Math.max(0,relTop-80),behavior:'smooth'});
        }
      }
    }
    const measure=()=>{
      if(!el){setPos(null);return;}
      const r=el.getBoundingClientRect();
      // Hidden element (sidebar collapsed on desktop) → centre card
      if(r.width===0&&r.height===0){setPos(null);return;}
      const vw=window.innerWidth;
      // Use the *visible* viewport height (excludes the iOS address bar/toolbar) so the
      // card never extends below what the user can actually see — otherwise the lower
      // steps and the NEXT/PREV buttons fall off-screen with no way to scroll to them.
      const vh=(window.visualViewport&&window.visualViewport.height)||window.innerHeight;
      const midY=(r.top+r.bottom)/2;
      const midX=(r.left+r.right)/2;
      if(midX<vw/2){
        // LEFT panel: float card just past the sidebar's right edge
        const sidebar=document.querySelector('.sidebar-scroll');
        const sbRight=sidebar?sidebar.getBoundingClientRect().right:r.right;
        const left=Math.min(sbRight+10,vw-CARD_W-8);
        // Anchor higher when the target sits near the bottom so the card keeps usable height.
        const top=Math.max(8,Math.min(vh-260,midY-80));
        const maxH=Math.max(140,vh-top-16);
        const arrowOff=Math.max(16,Math.min(maxH-16,midY-top));
        setPos({top,left,arrowDir:'left',arrowOff,maxH});
      } else {
        // RIGHT panel (output, balance-bar): float card entirely above the element
        // Fit the card into the space above r.top so it never overlaps the target.
        const GAP=10; // gap between card bottom and element top
        const availH=r.top-8-GAP;  // px available above the element
        const maxH=Math.max(140,Math.min(availH,vh-24));
        const top=Math.max(8,r.top-maxH-GAP);
        const left=Math.max(8,Math.min(vw-CARD_W-8,midX-CARD_W/2));
        const arrowOff=Math.max(12,Math.min(CARD_W-24,midX-left));
        setPos({top,left,arrowDir:'down',arrowOff,maxH});
      }
    };
    // Slight delay lets scrollIntoView settle before we measure
    const tid=setTimeout(measure,120);
    window.addEventListener('resize',measure);
    if(window.visualViewport)window.visualViewport.addEventListener('resize',measure);
    return()=>{clearTimeout(tid);window.removeEventListener('resize',measure);
      if(window.visualViewport)window.visualViewport.removeEventListener('resize',measure);};
  },[focusKey]); // eslint-disable-line

  if(!t)return null;
  const mLabel={beginner:'BEG',intermediate:'INT',pro:'PRO',balance:'BALANCE'}[mode]??mode.toUpperCase();
  const btnStyle={background:'none',border:'1px solid #1e293b',borderRadius:2,color:'#9ca3af',
    fontFamily:'Courier New',fontSize:10,padding:'4px 10px',cursor:'pointer',letterSpacing:1};

  const cardBase={position:'fixed',zIndex:700,width:CARD_W,
    maxHeight:'calc(100dvh - 40px)',display:'flex',flexDirection:'column',
    background:'#0f172a',border:'1px solid #334155',borderRadius:4,
    padding:'16px 16px 14px',boxShadow:'0 8px 40px #000d',fontFamily:'Courier New'};
  const cardStyle=pos
    ?{...cardBase,top:pos.top,...(pos.left!==undefined?{left:pos.left}:{right:pos.right}),
       maxHeight:pos.maxH}
    :{...cardBase,top:'50%',left:'50%',transform:'translate(-50%,-50%)'};

  const arrow=(()=>{
    if(!pos)return null;
    const base={position:'absolute',width:0,height:0};
    if(pos.arrowDir==='left') return(<>
      <div style={{...base,left:-8,top:pos.arrowOff-8,
        borderTop:'8px solid transparent',borderBottom:'8px solid transparent',borderRight:'8px solid #334155'}}/>
      <div style={{...base,left:-6,top:pos.arrowOff-7,
        borderTop:'7px solid transparent',borderBottom:'7px solid transparent',borderRight:'7px solid #0f172a'}}/>
    </>);
    return(<>
      <div style={{...base,bottom:-8,left:pos.arrowOff-8,
        borderLeft:'8px solid transparent',borderRight:'8px solid transparent',borderTop:'8px solid #334155'}}/>
      <div style={{...base,bottom:-6,left:pos.arrowOff-7,
        borderLeft:'7px solid transparent',borderRight:'7px solid transparent',borderTop:'7px solid #0f172a'}}/>
    </>);
  })();

  return(
    <div style={cardStyle}>
      {arrow}
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:6}}>
        <div>
          <span style={{fontSize:10,color:'#94a3b8',letterSpacing:2}}>{mLabel} GUIDE  ·  {step+1} / {total}</span>
          <div style={{fontSize:13,color:'#e2e8f0',fontWeight:700,marginTop:3,letterSpacing:0.5}}>{t.title}</div>
        </div>
        <button onClick={onClose} style={{...btnStyle,padding:'3px 8px',marginTop:2,color:'#94a3b8'}}>✕</button>
      </div>
      {/* progress bar */}
      <div style={{display:'flex',gap:3,marginBottom:10}}>
        {steps.map((_,i)=>(
          <div key={i} style={{height:2,flex:1,borderRadius:1,transition:'background .2s',
            background:i<step?'#334155':i===step?'#6366f1':'#1e293b'}}/>
        ))}
      </div>
      <p style={{fontSize:11,color:'#94a3b8',lineHeight:1.65,margin:'0 0 12px',
                 overflowY:'auto',flex:1,minHeight:0,
                 WebkitOverflowScrolling:'touch',overscrollBehavior:'contain'}}>{t.body}</p>
      <div style={{display:'flex',gap:6,justifyContent:'flex-end'}}>
        {step>0&&<button style={btnStyle} onClick={onPrev}>← PREV</button>}
        {step<total-1
          ?<button style={{...btnStyle,borderColor:'#4f46e5',color:'#818cf8'}} onClick={onNext}>NEXT →</button>
          :<button style={{...btnStyle,borderColor:'#16a34a',color:'#4ade80'}} onClick={onDone??onClose}>DONE ✓</button>}
      </div>
    </div>
  );
};
