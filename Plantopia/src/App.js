import { useState, useRef, useCallback, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

mapboxgl.accessToken =
  "pk.eyJ1Ijoiamltbm9ycmlzc2ExIiwiYSI6ImNtbWpjbWV4eDE0MmoycHM1MGJ1M3ExZWMifQ.4lkjPkiccTx1X65vn4Rduw";

const SUPABASE_URL = "https://fbsniegdupfhqskmuetl.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZic25pZWdkdXBmaHFza211ZXRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNjY4NDksImV4cCI6MjA4ODY0Mjg0OX0.DYrtDog0ap79JcFBD1dpXnYNeReR4XCVuEhsXTR_oJ0";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const GRID = 16;
const MAX_POTS = 6;
const PROXIMITY_RADIUS = 50;
const POT_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

const PALETTES = {
  "🌿 Forest": ["#2d4a1e","#3d6b2a","#52a63a","#7ec850","#b5e876","#e8f5b0","#8b5e3c","#6b3e26","#f7d080","#fff9e6","#1a2e0f","#4a8f35"],
  "🌸 Blossom": ["#8b1a4a","#c2185b","#e91e8c","#f48fb1","#fce4ec","#7b1fa2","#9c27b0","#ce93d8","#fff0f5","#4a0030","#ff6b9d","#ffcdd2"],
  "🌵 Desert": ["#5d4e37","#8b7355","#c4a882","#e8d5b7","#4caf50","#2e7d32","#ff8f00","#f57f17","#fff8e1","#3e2723","#6d4c41","#a1887f"],
  "🍄 Shroom": ["#b71c1c","#d32f2f","#ef5350","#ff8a80","#fff3e0","#ffffff","#9e9e9e","#616161","#212121","#795548","#a1887f","#d7ccc8"],
  "🌊 Ocean": ["#0d47a1","#1565c0","#1976d2","#42a5f5","#90caf9","#e3f2fd","#00695c","#00897b","#4db6ac","#b2dfdb","#006064","#00acc1"],
};
const TOOLS = [{ id: "draw", icon: "✏️" }, { id: "fill", icon: "🪣" }, { id: "erase", icon: "🧹" }];
const mkGrid = () => Array(GRID).fill(null).map(() => Array(GRID).fill(null));

const METRES_PER_DEG_LAT = 111320;
const haversine = (lat1, lng1, lat2, lng2) => {
  const R = 6371000, dLat = ((lat2-lat1)*Math.PI)/180, dLng = ((lng2-lng1)*Math.PI)/180;
  const a = Math.sin(dLat/2)**2 + Math.cos((lat1*Math.PI)/180)*Math.cos((lat2*Math.PI)/180)*Math.sin(dLng/2)**2;
  return Math.round(R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a)));
};

const PLANT_TEMPLATES = [
  { name: "Sunpetal", color: "#ffd43b", pixels: [[7,7],[7,8],[8,7],[8,8],[5,6],[5,9],[6,5],[6,10],[9,5],[9,10],[10,6],[10,9],[4,7],[4,8],[11,7],[11,8],[7,4],[8,4],[7,11],[8,11],[6,6],[6,9],[9,6],[9,9],[7,6],[7,9],[8,6],[8,9],[6,7],[6,8],[9,7],[9,8]] },
  { name: "Moonvine", color: "#cc5de8", pixels: [[3,7],[3,8],[4,6],[4,9],[5,5],[5,10],[6,6],[6,9],[7,7],[7,8],[8,7],[8,8],[9,6],[9,9],[10,5],[10,10],[11,6],[11,9],[12,7],[12,8],[7,6],[7,9],[8,6],[8,9],[6,7],[6,8],[9,7],[9,8],[5,7],[5,8],[10,7],[10,8]] },
  { name: "Tidecap", color: "#339af0", pixels: [[4,4],[4,5],[4,6],[4,7],[4,8],[4,9],[4,10],[4,11],[5,3],[5,4],[5,11],[5,12],[6,3],[6,12],[7,4],[7,11],[8,6],[8,7],[8,8],[8,9],[9,6],[9,9],[10,7],[10,8],[11,7],[11,8],[12,7],[12,8],[13,7],[13,8],[5,7],[5,8],[6,7],[6,8],[7,7],[7,8]] },
  { name: "Embershrub", color: "#ff6b6b", pixels: [[6,7],[6,8],[7,6],[7,9],[8,5],[8,10],[9,6],[9,9],[10,7],[10,8],[5,7],[5,8],[4,7],[4,8],[3,8],[7,7],[7,8],[8,7],[8,8],[11,6],[11,7],[11,8],[11,9],[12,7],[12,8],[13,7],[13,8],[6,5],[6,4],[7,4],[7,3],[8,3],[8,4]] },
  { name: "Dewsprig", color: "#51cf66", pixels: [[8,7],[8,8],[9,6],[9,9],[10,5],[10,10],[11,6],[11,9],[12,7],[12,8],[7,7],[7,8],[6,7],[6,8],[5,8],[4,8],[3,8],[3,9],[8,6],[8,5],[8,4],[9,4],[10,4],[10,3],[9,7],[9,8],[10,7],[10,8],[11,7],[11,8],[13,7],[13,8],[14,7],[14,8]] },
];
const RARE_TEMPLATES = [
  { name: "Golden Orchid", color: "#f59e0b", pixels: [[7,8],[8,7],[8,9],[9,6],[9,10],[10,5],[10,11],[11,6],[11,10],[12,7],[12,9],[13,8],[6,8],[5,8],[4,8],[4,7],[4,9],[7,6],[7,10],[8,8]] },
  { name: "Void Bloom", color: "#7c3aed", pixels: [[4,8],[5,7],[5,9],[6,6],[6,10],[7,5],[7,11],[8,5],[8,11],[9,6],[9,10],[10,7],[10,9],[11,8],[7,8],[8,8],[9,8],[8,7],[8,9],[6,8],[10,8]] },
  { name: "Starfire Fern", color: "#ec4899", pixels: [[8,8],[7,7],[7,9],[6,6],[6,10],[5,5],[5,11],[9,7],[9,9],[10,6],[10,10],[11,7],[11,9],[12,8],[8,6],[8,10],[7,8],[9,8],[6,8],[10,8]] },
];

function makeTemplateGrid(t) {
  const g = mkGrid();
  const pal = PALETTES[Object.keys(PALETTES)[Math.floor(Math.random()*5)]];
  const c2 = pal[Math.floor(Math.random()*pal.length)];
  t.pixels.forEach(([r,c],i) => { if (r<GRID&&c<GRID) g[r][c]=i%3===0?c2:t.color; });
  return g;
}

function floodFill(grid, r, c, color) {
  const target = grid[r][c];
  if (target===color) return grid;
  const next = grid.map(row=>[...row]);
  const stack = [[r,c]];
  while (stack.length) {
    const [cr,cc] = stack.pop();
    if (cr<0||cr>=GRID||cc<0||cc>=GRID||next[cr][cc]!==target) continue;
    next[cr][cc] = color;
    stack.push([cr+1,cc],[cr-1,cc],[cr,cc+1],[cr,cc-1]);
  }
  return next;
}

function genFriendCode(userId) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let hash = 0;
  for (let i=0; i<userId.length; i++) hash=((hash<<5)-hash+userId.charCodeAt(i))|0;
  let code="", n=Math.abs(hash);
  for (let i=0; i<6; i++) { code+=chars[n%chars.length]; n=Math.floor(n/chars.length)||(n+7919); }
  return code;
}

const T = {
  bg: "repeating-linear-gradient(135deg, #fffbf0, #fffbf0 20px, #f0f7e8 20px, #f0f7e8 40px)",
  bgSolid: "#fffbf0",
  card: "#ffffff", border: "#f0e6d0", accent: "#ff6b6b",
  green: "#51cf66", blue: "#339af0", purple: "#cc5de8", yellow: "#ffd43b",
  text: "#2d2d2d", sub: "#999", shadow: "0 2px 16px rgba(0,0,0,0.08)",
};

const COOLDOWNS = { common: 30*1000, uncommon: 60*60*1000, rare: 24*60*60*1000 };
function getCooldownKey(pinId) { return "plantopia_cd_"+pinId; }
function getCooldownRemaining(pinId) {
  try { const val=localStorage.getItem(getCooldownKey(pinId)); if (!val) return 0; return Math.max(0,parseInt(val)-Date.now()); } catch(e) { return 0; }
}
function setCooldown(pinId, ms) {
  localStorage.setItem(getCooldownKey(pinId), String(Date.now()+ms));
}
function formatCooldown(ms) {
  if (ms<=0) return null;
  const s=Math.floor(ms/1000), m=Math.floor(s/60), h=Math.floor(m/60);
  if (h>=1) return h+"h "+(m%60)+"m";
  if (m>=1) return m+"m "+(s%60)+"s";
  return s+"s";
}

async function fetchLandmarks(lng, lat) {
  const url = "https://api.mapbox.com/geocoding/v5/mapbox.places/"+lng+","+lat+".json?types=poi&limit=10&access_token="+mapboxgl.accessToken;
  try { const res=await fetch(url); const data=await res.json(); return data.features||[]; } catch(e) { return []; }
}

function generateCommonSeeds(lat, lng, count) {
  return Array.from({length:count},(_,i) => {
    const angle=(i/count)*Math.PI*2, dist=0.0002+Math.random()*0.0003;
    const tmpl=PLANT_TEMPLATES[Math.floor(Math.random()*PLANT_TEMPLATES.length)];
    return { id:"common-"+lat.toFixed(4)+"-"+i, name:tmpl.name+" Seed", lat:lat+Math.cos(angle)*dist, lng:lng+Math.sin(angle)*dist, color:tmpl.color, is_random:true, rarity:"common", local:true };
  });
}

function getUnfurlOrder(grid) {
  const p=[];
  for (let r=0;r<GRID;r++) for (let c=0;c<GRID;c++) if (grid[r][c]) p.push({r,c,color:grid[r][c]});
  return p.sort((a,b)=>b.r!==a.r?b.r-a.r:Math.abs(a.c-GRID/2)-Math.abs(b.c-GRID/2));
}

function GrowingPlant({ grid, size, autoPlay }) {
  size=size||40; autoPlay=autoPlay||false;
  const pixels=getUnfurlOrder(grid);
  const [vc,setVc]=useState(autoPlay?0:pixels.length);
  const [growing,setGrowing]=useState(autoPlay);
  const tr=useRef(null);
  useEffect(()=>{
    if (!autoPlay) return;
    let i=0;
    const step=()=>{ i++; setVc(i); if (i<pixels.length) { tr.current=setTimeout(step,Math.max(8,40-i*0.5)); } else { setGrowing(false); } };
    tr.current=setTimeout(step,60);
    return ()=>{ if (tr.current) clearTimeout(tr.current); };
  },[]);
  const sz=size/GRID, vis=new Set(pixels.slice(0,vc).map(p=>p.r+"-"+p.c));
  return (
    <div style={{width:size,height:size,position:"relative",imageRendering:"pixelated"}}>
      {pixels.map(({r,c,color})=>{
        const v=vis.has(r+"-"+c);
        return <div key={r+"-"+c} style={{position:"absolute",left:c*sz,top:r*sz,width:sz,height:sz,background:color,opacity:v?1:0,transform:v?"scale(1)":"scale(0)",transition:v?"opacity 0.12s, transform 0.15s cubic-bezier(0.34,1.56,0.64,1)":"none"}} />;
      })}
      {growing&&<div style={{position:"absolute",inset:0,display:"flex",alignItems:"flex-end",justifyContent:"center",pointerEvents:"none"}}><div style={{fontSize:size*0.3}}>✨</div></div>}
    </div>
  );
}

function PlantingCeremony({ plant, onDone }) {
  const [stage,setStage]=useState("soil");
  useEffect(()=>{
    const t1=setTimeout(()=>setStage("growing"),800);
    const t2=setTimeout(()=>setStage("done"),3200);
    const t3=setTimeout(onDone,4200);
    return ()=>{ clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  },[]);
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{background:"#fff",borderRadius:28,padding:32,display:"flex",flexDirection:"column",alignItems:"center",gap:12,minWidth:220}}>
        <div style={{fontSize:13,fontWeight:700,color:T.sub,textTransform:"uppercase",letterSpacing:"0.1em"}}>
          {stage==="soil"?"Preparing soil…":stage==="growing"?"Growing…":"🎉 Planted!"}
        </div>
        <div style={{width:80,height:80,display:"flex",alignItems:"center",justifyContent:"center"}}>
          {stage==="soil"&&<div style={{fontSize:48}}>🌍</div>}
          {(stage==="growing"||stage==="done")&&<GrowingPlant grid={plant.grid} size={80} autoPlay={stage==="growing"} />}
        </div>
        <div style={{fontWeight:800,fontSize:16,color:T.text}}>{plant.name}</div>
        {stage==="done"&&<div style={{fontSize:12,color:T.sub,textAlign:"center"}}>📍 A cutting planted for the world to see!</div>}
        <div style={{display:"flex",gap:6}}>
          {["soil","growing","done"].map(s=><div key={s} style={{width:6,height:6,borderRadius:"50%",background:stage===s?T.accent:T.border,transition:"background 0.3s"}} />)}
        </div>
      </div>
    </div>
  );
}

function SeedModal({ pin, onCollect, onClose }) {
  const [collected,setCollected]=useState(false);
  const isRare=pin.rarity==="rare";
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:400,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
      <div style={{background:"#fff",borderRadius:"28px 28px 0 0",padding:"28px 24px 40px",width:"100%",maxWidth:430}}>
        {!collected?(
          <>
            <div style={{textAlign:"center",marginBottom:20}}>
              <div style={{fontSize:52,marginBottom:8}}>{isRare?"🌟":"🌰"}</div>
              <div style={{fontWeight:800,fontSize:20,color:T.text}}>{pin.name}</div>
              {isRare&&<div style={{fontSize:12,fontWeight:800,color:"#f59e0b",background:"#fef3c7",borderRadius:20,padding:"3px 12px",display:"inline-block",marginTop:6}}>✨ RARE — found at {pin.landmark_name||"a landmark"}</div>}
              <div style={{fontSize:13,color:T.sub,marginTop:8}}>{isRare?"A rare seed from a special location!":"A wild seed waiting to be grown!"}</div>
            </div>
            <button onClick={()=>setCollected(true)} style={{width:"100%",padding:16,borderRadius:16,border:"none",cursor:"pointer",fontWeight:800,fontSize:16,background:isRare?"linear-gradient(135deg,#f59e0b,#ec4899)":"linear-gradient(135deg,"+T.yellow+","+T.accent+")",color:"#fff"}}>{isRare?"🌟 Collect Rare Seed!":"🌰 Collect Seed!"}</button>
            <button onClick={onClose} style={{width:"100%",padding:12,borderRadius:16,border:"none",cursor:"pointer",fontWeight:600,fontSize:14,background:"none",color:T.sub,marginTop:8}}>Cancel</button>
          </>
        ):(
          <>
            <div style={{textAlign:"center",padding:"12px 0 24px"}}>
              <div style={{fontSize:52,marginBottom:12}}>{isRare?"🌟":"✨"}</div>
              <div style={{fontWeight:800,fontSize:20,color:T.text}}>{isRare?"Rare Seed Collected!":"Seed Collected!"}</div>
              <div style={{fontSize:13,color:T.sub,marginTop:8}}>Added to your inventory!</div>
            </div>
            <button onClick={()=>onCollect(pin)} style={{width:"100%",padding:16,borderRadius:16,border:"none",cursor:"pointer",fontWeight:800,fontSize:16,background:"linear-gradient(135deg,"+T.green+",#20c997)",color:"#fff"}}>🌿 Go to Garden</button>
          </>
        )}
      </div>
    </div>
  );
}

function VisitModal({ pin, onHarvest, onClose, onHeart, isFriend }) {
  const [harvested,setHarvested]=useState(false);
  const [spark,setSpark]=useState(false);
  const [hearted,setHearted]=useState(false);
  const rarity=pin.username?"rare":"common";
  const [cdRemaining,setCdRemaining]=useState(()=>getCooldownRemaining(pin.id));
  const cdRef=useRef(null);
  useEffect(()=>{
    if (cdRemaining<=0) return;
    cdRef.current=setInterval(()=>{ const rem=getCooldownRemaining(pin.id); setCdRemaining(rem); if (rem<=0) clearInterval(cdRef.current); },1000);
    return ()=>{ if (cdRef.current) clearInterval(cdRef.current); };
  },[cdRemaining]);
  const tryHarvest=()=>{
    setSpark(true);
    setTimeout(()=>{
      setSpark(false);
      const success=Math.random()>0.4;
      if (success) { setHarvested("yes"); } else { setCooldown(pin.id, COOLDOWNS[rarity]); setCdRemaining(getCooldownRemaining(pin.id)); setHarvested("no"); }
    },900);
  };
  const cdLabel=formatCooldown(cdRemaining), onCooldown=cdRemaining>0;
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:400,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
      <div style={{background:"#fff",borderRadius:"28px 28px 0 0",padding:"28px 24px 40px",width:"100%",maxWidth:430}}>
        {spark?(
          <div style={{textAlign:"center",padding:"32px 0"}}>
            <div style={{fontSize:56}}>✨</div>
            <div style={{fontWeight:700,color:T.sub,marginTop:12}}>Checking for seeds…</div>
          </div>
        ):harvested==="yes"?(
          <>
            <div style={{textAlign:"center",padding:"8px 0 16px"}}>
              <div style={{fontSize:48,marginBottom:8}}>🌰</div>
              <div style={{fontWeight:800,fontSize:18,color:T.text}}>Cutting Harvested!</div>
              <div style={{fontSize:13,color:T.sub,margin:"8px 0 20px"}}>You got a cutting of <b>{pin.name}</b>!</div>
            </div>
            <button onClick={()=>onHarvest(pin)} style={{width:"100%",padding:14,borderRadius:14,border:"none",cursor:"pointer",fontWeight:800,fontSize:15,background:"linear-gradient(135deg,"+T.green+",#20c997)",color:"#fff"}}>🌿 Go to Garden</button>
          </>
        ):harvested==="no"?(
          <>
            <div style={{textAlign:"center",padding:"8px 0 16px"}}>
              <div style={{fontSize:48,marginBottom:8}}>🍂</div>
              <div style={{fontWeight:800,fontSize:18,color:T.text}}>No seeds this time…</div>
              <div style={{fontSize:13,color:T.sub,margin:"8px 0 12px"}}>This plant needs time to recover.</div>
              <div style={{background:"#fff5f5",borderRadius:14,padding:"10px 16px",display:"inline-flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:18}}>⏱️</span>
                <span style={{fontWeight:700,fontSize:14,color:T.accent}}>Try again in {formatCooldown(getCooldownRemaining(pin.id))}</span>
              </div>
            </div>
            <button onClick={onClose} style={{width:"100%",padding:14,borderRadius:14,border:"none",cursor:"pointer",fontWeight:800,fontSize:15,background:"#f5f5f5",color:T.text,marginTop:8}}>Close</button>
          </>
        ):(
          <>
            <div style={{textAlign:"center",marginBottom:20}}>
              {isFriend&&<div style={{fontSize:11,fontWeight:800,color:T.blue,background:"#e8f4fd",borderRadius:20,padding:"3px 12px",display:"inline-block",marginBottom:8}}>👥 Friend's Plant</div>}
              <div style={{display:"flex",justifyContent:"center",marginBottom:12}}><GrowingPlant grid={pin.grid} size={72} /></div>
              <div style={{fontWeight:800,fontSize:20,color:T.text}}>{pin.name}</div>
              <div style={{fontSize:13,color:T.sub,marginTop:4}}>By <b style={{color:T.text}}>{pin.username}</b> · {pin.distM}m away</div>
              <div style={{fontSize:13,color:T.accent,marginTop:4}}>💚 {pin.hearts||0} hearts</div>
            </div>
            {!pin.harvested&&(onCooldown?(
              <div style={{background:"#fff5f5",borderRadius:14,padding:"12px 16px",marginBottom:8,display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontSize:22}}>⏱️</span>
                <div>
                  <div style={{fontWeight:700,fontSize:13,color:T.accent}}>Harvest on cooldown</div>
                  <div style={{fontSize:12,color:T.sub}}>Try again in <b>{cdLabel}</b></div>
                </div>
              </div>
            ):(
              <button onClick={tryHarvest} style={{width:"100%",padding:14,borderRadius:14,border:"none",cursor:"pointer",fontWeight:800,fontSize:15,marginBottom:8,background:"linear-gradient(135deg,"+T.yellow+","+T.accent+")",color:"#fff"}}>🌰 Try to Harvest Cutting</button>
            ))}
            <button onClick={()=>{ setHearted(true); onHeart(pin); }} disabled={hearted} style={{width:"100%",padding:14,borderRadius:14,border:"none",cursor:"pointer",fontWeight:700,fontSize:15,background:hearted?"#f5f5f5":"linear-gradient(135deg,"+T.blue+","+T.purple+")",color:hearted?T.sub:"#fff",marginBottom:8}}>
              {hearted?"💚 Hearted!":"💚 Leave a Heart"}
            </button>
            <button onClick={onClose} style={{width:"100%",padding:10,borderRadius:14,border:"none",cursor:"pointer",fontWeight:600,fontSize:14,background:"none",color:T.sub}}>Close</button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Pot slot ──────────────────────────────────────────────────────────────────
function PotSlot({ plant, onPlantCutting, onRemove }) {
  const [confirm,setConfirm]=useState(false);
  const [cdRemaining,setCdRemaining]=useState(()=>plant?getCooldownRemaining("pot-cd-"+plant.id):0);
  const cdRef=useRef(null);

  useEffect(()=>{
    if (!plant) return;
    const rem=getCooldownRemaining("pot-cd-"+plant.id);
    setCdRemaining(rem);
    if (rem>0) {
      cdRef.current=setInterval(()=>{
        const r=getCooldownRemaining("pot-cd-"+plant.id);
        setCdRemaining(r);
        if (r<=0) clearInterval(cdRef.current);
      },1000);
    }
    return ()=>{ if (cdRef.current) clearInterval(cdRef.current); };
  },[plant]);

  if (!plant) {
    return (
      <div style={{background:"#f9f6f0",borderRadius:20,padding:14,border:"2px dashed "+T.border,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:160,gap:6}}>
        <div style={{fontSize:28}}>🪴</div>
        <div style={{fontSize:11,color:T.sub,fontWeight:600}}>Empty Pot</div>
      </div>
    );
  }

  const onCooldown=cdRemaining>0;

  return (
    <div style={{background:T.card,borderRadius:20,padding:14,boxShadow:T.shadow,border:"2px solid "+T.border,position:"relative"}}>
      {confirm?(
        <div style={{display:"flex",flexDirection:"column",gap:8,alignItems:"center",padding:"8px 0"}}>
          <div style={{fontSize:13,fontWeight:700,color:T.text,textAlign:"center"}}>Remove this plant?</div>
          <div style={{fontSize:11,color:T.sub,textAlign:"center"}}>It will be gone forever.</div>
          <div style={{display:"flex",gap:6,width:"100%"}}>
            <button onClick={()=>{ onRemove(plant); setConfirm(false); }} style={{flex:1,padding:"8px 0",borderRadius:10,border:"none",cursor:"pointer",fontWeight:700,fontSize:12,background:T.accent,color:"#fff"}}>Remove</button>
            <button onClick={()=>setConfirm(false)} style={{flex:1,padding:"8px 0",borderRadius:10,border:"none",cursor:"pointer",fontWeight:700,fontSize:12,background:"#f5f5f5",color:T.text}}>Cancel</button>
          </div>
        </div>
      ):(
        <>
          <button onClick={()=>setConfirm(true)} style={{position:"absolute",top:8,right:8,width:24,height:24,borderRadius:8,border:"none",background:"#f5f5f5",cursor:"pointer",fontSize:12,display:"flex",alignItems:"center",justifyContent:"center",color:T.sub}}>✕</button>
          <div style={{background:"#f9f9f9",borderRadius:12,padding:8,marginBottom:10,display:"flex",justifyContent:"center",alignItems:"center",minHeight:72}}>
            <GrowingPlant grid={plant.grid} size={64} />
          </div>
          <div style={{fontWeight:800,fontSize:13,color:T.text,marginBottom:2,paddingRight:20}}>{plant.name}</div>
          <div style={{fontSize:10,color:T.sub,marginBottom:8}}>{plant.date}</div>
          {onCooldown?(
            <div style={{background:"#fff5f5",borderRadius:10,padding:"8px 10px",display:"flex",alignItems:"center",gap:6}}>
              <span style={{fontSize:14}}>⏱️</span>
              <div>
                <div style={{fontSize:10,fontWeight:700,color:T.accent}}>Cutting on cooldown</div>
                <div style={{fontSize:10,color:T.sub}}>Ready in {formatCooldown(cdRemaining)}</div>
              </div>
            </div>
          ):(
            <button onClick={()=>onPlantCutting(plant)} style={{width:"100%",padding:"7px",borderRadius:10,border:"none",cursor:"pointer",fontWeight:700,fontSize:12,background:"linear-gradient(135deg,"+T.blue+","+T.purple+")",color:"#fff"}}>🌿 Plant Cutting</button>
          )}
        </>
      )}
    </div>
  );
}

function SeedCard({ seed, onPlant }) {
  const isRare=seed.rarity==="rare";
  return (
    <div style={{background:T.card,borderRadius:20,padding:14,boxShadow:T.shadow,border:"2px solid "+(isRare?"#f59e0b":seed.color+"44")}}>
      <div style={{background:isRare?"#fef9ee":"#f9f9f9",borderRadius:12,padding:8,marginBottom:10,display:"flex",justifyContent:"center",alignItems:"center",minHeight:72}}>
        {seed.grid?<GrowingPlant grid={seed.grid} size={64} />:(
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:36}}>{isRare?"🌟":"🌰"}</div>
            <div style={{fontSize:10,color:T.sub,marginTop:4}}>{isRare?"Rare!":"Mystery"}</div>
          </div>
        )}
      </div>
      <div style={{fontWeight:800,fontSize:13,color:T.text,marginBottom:1}}>{seed.name}</div>
      <div style={{fontSize:10,color:isRare?"#f59e0b":seed.color,fontWeight:700,marginBottom:8}}>{isRare?"✨ Rare":"Common 🌿"}</div>
      <button onClick={()=>onPlant(seed)} style={{width:"100%",padding:"7px",borderRadius:10,border:"none",cursor:"pointer",fontWeight:700,fontSize:12,background:isRare?"linear-gradient(135deg,#f59e0b,#ec4899)":"linear-gradient(135deg,"+T.green+",#20c997)",color:"#fff"}}>🌱 Plant on Map</button>
    </div>
  );
}

function GPSBadge({ gps, accuracy }) {
  const ok=gps&&accuracy<50;
  return (
    <div style={{display:"flex",alignItems:"center",gap:5,fontSize:11,fontWeight:700,color:ok?"#51cf66":gps?"#ffd43b":"#ff6b6b",background:ok?"#f0fff4":gps?"#fffbeb":"#fff5f5",borderRadius:20,padding:"3px 10px",border:"1px solid "+(ok?"#b2f2bb":gps?"#fde68a":"#fecaca")}}>
      <div style={{width:6,height:6,borderRadius:"50%",background:ok?"#51cf66":gps?"#ffd43b":"#ff6b6b",boxShadow:ok?"0 0 6px #51cf66":"none"}} />
      {ok?"GPS ±"+Math.round(accuracy)+"m":gps?"GPS weak…":"No GPS"}
    </div>
  );
}

function UsernameScreen({ onSet }) {
  const [val,setVal]=useState(""), [loading,setLoading]=useState(false), [error,setError]=useState(null);
  const submit=async()=>{
    const username=val.trim().toLowerCase().replace(/[^a-z0-9_]/g,"");
    if (username.length<3) { setError("At least 3 characters!"); return; }
    setLoading(true); setError(null);
    const {data:existing}=await supabase.from("users").select("id").eq("username",username).single();
    if (existing) { setError("Username taken!"); setLoading(false); return; }
    const {data,error:err}=await supabase.from("users").insert({username}).select().single();
    if (err) { setError("Something went wrong."); setLoading(false); return; }
    localStorage.setItem("plantopia_user",JSON.stringify(data));
    onSet(data);
  };
  return (
    <div style={{background:T.bgSolid,minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:32,fontFamily:"'Segoe UI',sans-serif"}}>
      <div style={{fontSize:64,marginBottom:16}}>🌱</div>
      <h1 style={{fontSize:26,fontWeight:900,color:T.text,margin:"0 0 8px"}}>Welcome to Plantopia</h1>
      <p style={{fontSize:14,color:T.sub,margin:"0 0 32px",textAlign:"center"}}>Plant pixel art in the real world.<br />Choose a username to get started.</p>
      <div style={{width:"100%",maxWidth:320}}>
        <input value={val} onChange={e=>setVal(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} placeholder="your_username" maxLength={20}
          style={{width:"100%",boxSizing:"border-box",background:T.card,border:"2px solid "+(error?T.accent:T.border),borderRadius:16,padding:"14px 18px",color:T.text,fontSize:16,outline:"none",boxShadow:T.shadow,marginBottom:8,fontFamily:"monospace"}} />
        {error&&<div style={{fontSize:12,color:T.accent,marginBottom:8}}>⚠️ {error}</div>}
        <div style={{fontSize:11,color:T.sub,marginBottom:16}}>Letters, numbers and underscores only</div>
        <button onClick={submit} disabled={loading||val.trim().length<3}
          style={{width:"100%",padding:16,borderRadius:16,border:"none",cursor:"pointer",fontWeight:800,fontSize:16,background:"linear-gradient(135deg,"+T.green+",#20c997)",color:"#fff",opacity:loading||val.trim().length<3?0.6:1}}>
          {loading?"Setting up…":"Start Planting 🌱"}
        </button>
      </div>
    </div>
  );
}

// ─── Friends screen ────────────────────────────────────────────────────────────
function FriendsScreen({ user, worldPlants, onClose, onHarvest, onHeart }) {
  const [friends,setFriends]=useState([]);
  const [loading,setLoading]=useState(true);
  const [addCode,setAddCode]=useState("");
  const [addError,setAddError]=useState(null);
  const [addLoading,setAddLoading]=useState(false);
  const [selectedFriend,setSelectedFriend]=useState(null);
  const [selectedPlant,setSelectedPlant]=useState(null);
  const myCode=genFriendCode(user.id);

  useEffect(()=>{ loadFriends(); },[]);

  const loadFriends=async()=>{
    setLoading(true);
    const {data}=await supabase.from("friendships").select("friend_id, friend_username").eq("user_id",user.id);
    setFriends(data||[]);
    setLoading(false);
  };

  const addFriend=async()=>{
    const code=addCode.trim().toUpperCase();
    if (code.length!==6) { setAddError("Enter a 6-character friend code"); return; }
    setAddLoading(true); setAddError(null);
    const {data:allUsers}=await supabase.from("users").select("id, username");
    const target=(allUsers||[]).find(u=>genFriendCode(u.id)===code);
    if (!target) { setAddError("No player found with that code!"); setAddLoading(false); return; }
    if (target.id===user.id) { setAddError("That's your own code!"); setAddLoading(false); return; }
    if (friends.find(f=>f.friend_id===target.id)) { setAddError("Already friends!"); setAddLoading(false); return; }
    const {error}=await supabase.from("friendships").insert({user_id:user.id,friend_id:target.id,friend_username:target.username});
    if (error) { setAddError("Couldn't add friend."); setAddLoading(false); return; }
    setAddCode(""); setAddLoading(false); loadFriends();
  };

  const removeFriend=async(friendId)=>{
    await supabase.from("friendships").delete().eq("user_id",user.id).eq("friend_id",friendId);
    setFriends(f=>f.filter(fr=>fr.friend_id!==friendId));
    if (selectedFriend&&selectedFriend.friend_id===friendId) setSelectedFriend(null);
  };

  return (
    <div style={{position:"fixed",inset:0,background:T.bgSolid,zIndex:200,overflowY:"auto",fontFamily:"'Segoe UI',sans-serif"}}>
      <div style={{background:"#fff",padding:"12px 20px",display:"flex",alignItems:"center",gap:12,borderBottom:"1px solid "+T.border,position:"sticky",top:0,zIndex:10}}>
        <button onClick={onClose} style={{width:36,height:36,borderRadius:12,border:"none",background:"#f5f5f5",cursor:"pointer",fontSize:18}}>←</button>
        <div style={{fontWeight:800,fontSize:17,color:T.text}}>Friends 👥</div>
      </div>
      <div style={{padding:16,maxWidth:430,margin:"0 auto"}}>
        <div style={{background:"linear-gradient(135deg,#e8f4fd,#f0e8ff)",borderRadius:20,padding:18,marginBottom:16,border:"2px solid #b3d9f5"}}>
          <div style={{fontWeight:800,fontSize:13,color:T.text,marginBottom:6}}>🔑 My Friend Code</div>
          <div style={{fontFamily:"monospace",fontSize:28,fontWeight:900,letterSpacing:"0.2em",color:T.blue,textAlign:"center",padding:"8px 0"}}>{myCode}</div>
          <div style={{fontSize:11,color:T.sub,textAlign:"center"}}>Share this with friends so they can add you</div>
        </div>
        <div style={{background:T.card,borderRadius:20,padding:16,marginBottom:16,boxShadow:T.shadow}}>
          <div style={{fontWeight:800,fontSize:13,color:T.text,marginBottom:10}}>➕ Add a Friend</div>
          <div style={{display:"flex",gap:8}}>
            <input value={addCode} onChange={e=>setAddCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,""))} maxLength={6} placeholder="ABCD12"
              style={{flex:1,background:"#f9f9f9",border:"2px solid "+(addError?T.accent:T.border),borderRadius:12,padding:"10px 14px",color:T.text,fontSize:16,outline:"none",fontFamily:"monospace",letterSpacing:"0.15em",fontWeight:700}} />
            <button onClick={addFriend} disabled={addLoading||addCode.length!==6}
              style={{padding:"10px 18px",borderRadius:12,border:"none",cursor:"pointer",fontWeight:800,fontSize:14,background:"linear-gradient(135deg,"+T.green+",#20c997)",color:"#fff",opacity:addLoading||addCode.length!==6?0.5:1}}>
              {addLoading?"…":"Add"}
            </button>
          </div>
          {addError&&<div style={{fontSize:12,color:T.accent,marginTop:6}}>⚠️ {addError}</div>}
        </div>
        {loading?(
          <div style={{textAlign:"center",padding:32,color:T.sub}}>Loading…</div>
        ):friends.length===0?(
          <div style={{textAlign:"center",padding:"32px 0",color:T.sub}}>
            <div style={{fontSize:40,marginBottom:8}}>👥</div>
            <div style={{fontSize:13}}>No friends yet!<br />Share your code to get started.</div>
          </div>
        ):(
          <>
            <div style={{fontWeight:700,fontSize:13,color:T.text,marginBottom:10}}>Friends ({friends.length})</div>
            {friends.map(f=>{
              const fPlants=worldPlants.filter(p=>p.username===f.friend_username);
              const fFeatured=fPlants[0];
              const isSelected=selectedFriend&&selectedFriend.friend_id===f.friend_id;
              return (
                <div key={f.friend_id} style={{background:T.card,borderRadius:20,marginBottom:10,boxShadow:T.shadow,border:"2px solid "+(isSelected?T.blue:T.border),overflow:"hidden"}}>
                  <div onClick={()=>setSelectedFriend(isSelected?null:f)} style={{padding:"14px 16px",display:"flex",alignItems:"center",gap:12,cursor:"pointer"}}>
                    <div style={{width:44,height:44,borderRadius:14,background:T.blue+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>🌿</div>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:800,fontSize:15,color:T.text}}>@{f.friend_username}</div>
                      <div style={{fontSize:11,color:T.sub}}>{fPlants.length} plant{fPlants.length!==1?"s":""} in world</div>
                    </div>
                    <div style={{fontSize:14,color:T.sub}}>{isSelected?"▲":"▼"}</div>
                  </div>
                  {isSelected&&(
                    <div style={{padding:"0 16px 16px",borderTop:"1px solid "+T.border}}>
                      {fFeatured?(
                        <>
                          <div style={{fontWeight:700,fontSize:12,color:T.sub,marginTop:12,marginBottom:8}}>⭐ Featured Plant</div>
                          <div style={{background:"#f9f9f9",borderRadius:16,padding:14,display:"flex",gap:12,alignItems:"center",marginBottom:10}}>
                            <GrowingPlant grid={fFeatured.grid} size={56} />
                            <div style={{flex:1}}>
                              <div style={{fontWeight:800,fontSize:14,color:T.text}}>{fFeatured.name}</div>
                              <div style={{fontSize:11,color:T.sub}}>💚 {fFeatured.hearts||0} hearts</div>
                            </div>
                          </div>
                          <button onClick={()=>setSelectedPlant({...fFeatured,distM:0,isFriendPlant:true})}
                            style={{width:"100%",padding:"10px",borderRadius:12,border:"none",cursor:"pointer",fontWeight:700,fontSize:13,background:"linear-gradient(135deg,"+T.yellow+","+T.accent+")",color:"#fff",marginBottom:8}}>
                            🌰 Harvest Cutting
                          </button>
                        </>
                      ):(
                        <div style={{textAlign:"center",padding:"16px 0",color:T.sub,fontSize:13}}>No plants planted yet</div>
                      )}
                      <button onClick={()=>removeFriend(f.friend_id)}
                        style={{width:"100%",padding:"8px",borderRadius:12,border:"none",cursor:"pointer",fontWeight:600,fontSize:12,background:"#fff0f0",color:T.accent}}>
                        Remove Friend
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
      {selectedPlant&&(
        <VisitModal pin={selectedPlant} isFriend={true}
          onHarvest={pin=>{ onHarvest(pin); setSelectedPlant(null); }}
          onClose={()=>setSelectedPlant(null)}
          onHeart={pin=>onHeart(pin)} />
      )}
    </div>
  );
}

// ─── Profile screen ────────────────────────────────────────────────────────────
function ProfileScreen({ user, worldPlants, inventory, pots, featuredPlantId, onSetFeatured, onClose }) {
  const myPlants=worldPlants.filter(p=>p.username===user.username);
  const totalHearts=myPlants.reduce((sum,p)=>sum+(p.hearts||0),0);
  const rareSeeds=inventory.filter(s=>s.rarity==="rare").length;
  const myCode=genFriendCode(user.id);
  const potsUsed=pots.filter(Boolean).length;
  const filledPots=pots.filter(Boolean);

  const BADGES=[
    {icon:"🌱",label:"First Plant",earned:myPlants.length>=1},
    {icon:"🌿",label:"Green Thumb",earned:myPlants.length>=5},
    {icon:"🌳",label:"Botanist",earned:myPlants.length>=10},
    {icon:"💚",label:"Beloved",earned:totalHearts>=5},
    {icon:"🌟",label:"Rare Finder",earned:rareSeeds>=1},
    {icon:"🌰",label:"Seed Collector",earned:inventory.length>=3},
  ];
  const tier=myPlants.length>=10?"🏆 Botanist":myPlants.length>=5?"🥇 Green Thumb":myPlants.length>=1?"🥈 Seedling":"🌱 Newcomer";
  const tierColor=myPlants.length>=10?"#f59e0b":myPlants.length>=5?"#51cf66":myPlants.length>=1?"#339af0":"#999";
  const featured=filledPots.find(p=>p.id===featuredPlantId)||filledPots[0]||null;

  return (
    <div style={{position:"fixed",inset:0,background:T.bgSolid,zIndex:200,overflowY:"auto",fontFamily:"'Segoe UI',sans-serif"}}>
      <div style={{background:"#fff",padding:"12px 20px",display:"flex",alignItems:"center",gap:12,borderBottom:"1px solid "+T.border,position:"sticky",top:0,zIndex:10}}>
        <button onClick={onClose} style={{width:36,height:36,borderRadius:12,border:"none",background:"#f5f5f5",cursor:"pointer",fontSize:18}}>←</button>
        <div style={{fontWeight:800,fontSize:17,color:T.text}}>My Profile</div>
      </div>
      <div style={{padding:16,maxWidth:430,margin:"0 auto"}}>
        {/* Hero */}
        <div style={{background:"linear-gradient(135deg,"+tierColor+"22,"+tierColor+"44)",borderRadius:24,padding:24,marginBottom:16,textAlign:"center",border:"2px solid "+tierColor+"55"}}>
          <div style={{fontSize:64,marginBottom:8}}>🏆</div>
          <div style={{fontWeight:900,fontSize:22,color:T.text}}>@{user.username}</div>
          <div style={{fontSize:14,fontWeight:700,color:tierColor,marginTop:4}}>{tier}</div>
          <div style={{fontFamily:"monospace",fontSize:13,color:T.sub,marginTop:6,fontWeight:600}}>Friend Code: {myCode}</div>
          <div style={{display:"flex",justifyContent:"center",gap:20,marginTop:16}}>
            {[{val:myPlants.length,label:"Planted"},{val:totalHearts,label:"Hearts"},{val:inventory.length,label:"Seeds"},{val:potsUsed+"/"+MAX_POTS,label:"Pots"}].map(({val,label})=>(
              <div key={label} style={{textAlign:"center"}}>
                <div style={{fontWeight:900,fontSize:22,color:T.text}}>{val}</div>
                <div style={{fontSize:11,color:T.sub}}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Featured plant picker */}
        <div style={{background:T.card,borderRadius:20,padding:16,marginBottom:16,boxShadow:T.shadow}}>
          <div style={{fontWeight:800,fontSize:15,color:T.text,marginBottom:4}}>⭐ Featured Plant</div>
          <div style={{fontSize:11,color:T.sub,marginBottom:12}}>Friends can harvest cuttings from your featured plant</div>
          {filledPots.length===0?(
            <div style={{textAlign:"center",padding:"20px 0",color:T.sub}}>
              <div style={{fontSize:32,marginBottom:8}}>🪴</div>
              <div style={{fontSize:13}}>Fill a pot in your garden first!</div>
            </div>
          ):(
            <>
              <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:8,marginBottom:12}}>
                {filledPots.map(p=>(
                  <button key={p.id} onClick={()=>onSetFeatured(p.id)}
                    style={{flexShrink:0,background:featured&&featured.id===p.id?T.accent+"22":"#f9f9f9",borderRadius:12,padding:8,border:"2px solid "+(featured&&featured.id===p.id?T.accent:T.border),cursor:"pointer"}}>
                    <div style={{display:"grid",gridTemplateColumns:"repeat("+GRID+",3px)"}}>
                      {p.grid.map((row,r)=>row.map((col,c)=>(
                        <div key={r+"-"+c} style={{width:3,height:3,background:col||"transparent"}} />
                      )))}
                    </div>
                  </button>
                ))}
              </div>
              {featured&&(
                <div style={{background:"#f9f9f9",borderRadius:16,padding:16,display:"flex",gap:14,alignItems:"center"}}>
                  <GrowingPlant grid={featured.grid} size={72} />
                  <div>
                    <div style={{fontWeight:800,fontSize:16,color:T.text}}>{featured.name}</div>
                    <div style={{fontSize:12,color:T.sub,marginTop:2}}>📍 Your featured plant</div>
                    <div style={{fontSize:11,color:T.sub,marginTop:2}}>{featured.date}</div>
                    <div style={{fontSize:11,color:T.green,fontWeight:700,marginTop:4}}>✅ Friends can harvest this</div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Badges */}
        <div style={{background:T.card,borderRadius:20,padding:16,marginBottom:16,boxShadow:T.shadow}}>
          <div style={{fontWeight:800,fontSize:15,color:T.text,marginBottom:12}}>🎖️ Badges</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
            {BADGES.map(b=>(
              <div key={b.label} style={{background:b.earned?"#f0fff4":"#f9f9f9",borderRadius:14,padding:"12px 8px",textAlign:"center",border:"2px solid "+(b.earned?"#b2f2bb":T.border),opacity:b.earned?1:0.4}}>
                <div style={{fontSize:28,marginBottom:4}}>{b.icon}</div>
                <div style={{fontSize:10,fontWeight:700,color:b.earned?T.green:T.sub}}>{b.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* World plants */}
        {myPlants.length>0&&(
          <div style={{background:T.card,borderRadius:20,padding:16,marginBottom:32,boxShadow:T.shadow}}>
            <div style={{fontWeight:800,fontSize:15,color:T.text,marginBottom:12}}>🌍 My Plants in the World</div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {myPlants.map(p=>(
                <div key={p.id} style={{display:"flex",alignItems:"center",gap:12,background:"#f9f9f9",borderRadius:14,padding:"10px 12px"}}>
                  <GrowingPlant grid={p.grid} size={40} />
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,fontSize:13,color:T.text}}>{p.name}</div>
                    <div style={{fontSize:11,color:T.sub}}>💚 {p.hearts||0} hearts · {new Date(p.created_at).toLocaleDateString()}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Map view ──────────────────────────────────────────────────────────────────
function MapView({ userPos, gpsAccuracy, nearbyPlants, nearbySeeds, localSeeds, placingPlant, onMapClick, onPinClick, gpsLoading }) {
  const mapContainer=useRef(null), map=useRef(null), userMarker=useRef(null), markersRef=useRef({});
  const onMapClickRef=useRef(onMapClick);
  useEffect(()=>{ onMapClickRef.current=onMapClick; },[onMapClick]);

  useEffect(()=>{
    if (map.current||!mapContainer.current) return;
    map.current=new mapboxgl.Map({container:mapContainer.current,style:"mapbox://styles/mapbox/outdoors-v12",zoom:17,center:[0,51],attributionControl:false});
    map.current.addControl(new mapboxgl.AttributionControl({compact:true}));
    map.current.on("click",e=>{ onMapClickRef.current(e.lngLat.lat,e.lngLat.lng); });
    return ()=>{ if (map.current) { map.current.remove(); map.current=null; } };
  },[]);

  useEffect(()=>{
    if (!userPos||!map.current) return;
    const centre=()=>{ map.current.setCenter([userPos.lng,userPos.lat]); map.current.setZoom(17); };
    if (!map.current.isStyleLoaded()) map.current.once("load",centre); else centre();
  },[userPos&&userPos.lat,userPos&&userPos.lng]);

  useEffect(()=>{
    if (!userPos||!map.current) return;
    if (!userMarker.current) {
      const el=document.createElement("div");
      el.style.cssText="width:28px;height:28px;border-radius:50%;background:"+T.accent+";border:3px solid white;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 0 0 6px "+T.accent+"33;";
      el.innerHTML="😊";
      userMarker.current=new mapboxgl.Marker({element:el,anchor:"center"}).setLngLat([userPos.lng,userPos.lat]).addTo(map.current);
    } else { userMarker.current.setLngLat([userPos.lng,userPos.lat]); }
  },[userPos&&userPos.lat,userPos&&userPos.lng]);

  useEffect(()=>{
    if (!map.current) return;
    const canvas=map.current.getCanvas();
    if (canvas) canvas.style.cursor=placingPlant?"crosshair":"";
  },[placingPlant]);

  useEffect(()=>{
    if (!map.current) return;
    const allPins=[...nearbyPlants.map(p=>({...p,pinType:"plant"})),...nearbySeeds.map(s=>({...s,pinType:"dbseed"})),...localSeeds.map(s=>({...s,pinType:"localseed"}))];
    const doRender=()=>{
      const currentIds=new Set(allPins.map(p=>p.id));
      Object.keys(markersRef.current).forEach(id=>{ if (!currentIds.has(id)) { markersRef.current[id].remove(); delete markersRef.current[id]; } });
      allPins.forEach(pin=>{
        if (markersRef.current[pin.id]) return;
        const el=document.createElement("div");
        const isRare=pin.rarity==="rare", isSeed=pin.pinType!=="plant";
        if (isSeed) {
          el.style.cssText="width:"+(isRare?36:28)+"px;height:"+(isRare?36:28)+"px;border-radius:50%;background:"+(isRare?"#f59e0b":pin.color)+";border:3px solid white;display:flex;align-items:center;justify-content:center;font-size:"+(isRare?18:14)+"px;box-shadow:"+(isRare?"0 0 12px #f59e0b88":"0 2px 8px rgba(0,0,0,0.2)")+";cursor:pointer;";
          el.innerHTML=isRare?"🌟":"🌰";
        } else {
          const canvas=document.createElement("canvas"); canvas.width=GRID; canvas.height=GRID;
          const ctx=canvas.getContext("2d");
          if (pin.grid) pin.grid.forEach((row,r)=>row.forEach((col,c)=>{ if (col) { ctx.fillStyle=col; ctx.fillRect(c,r,1,1); } }));
          el.style.cssText="width:36px;height:36px;border-radius:8px;border:2px solid white;overflow:hidden;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.25);image-rendering:pixelated;background:#f9f9f9;";
          canvas.style.cssText="width:100%;height:100%;image-rendering:pixelated;";
          el.appendChild(canvas);
        }
        el.addEventListener("click",e=>{ e.stopPropagation(); onPinClick(pin); });
        const marker=new mapboxgl.Marker({element:el,anchor:"center"}).setLngLat([pin.lng,pin.lat]).addTo(map.current);
        markersRef.current[pin.id]=marker;
      });
    };
    if (!map.current.isStyleLoaded()) map.current.once("load",doRender); else doRender();
  },[nearbyPlants,nearbySeeds,localSeeds]);

  return (
    <div style={{position:"relative",width:"100%",height:340,borderRadius:20,overflow:"hidden",boxShadow:T.shadow,border:"2px solid "+(placingPlant?T.accent:T.border),transition:"border-color 0.3s",marginBottom:14}}>
      <div ref={mapContainer} style={{width:"100%",height:"100%"}} />
      {gpsLoading&&!userPos&&(
        <div style={{position:"absolute",inset:0,background:"rgba(255,255,255,0.85)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8}}>
          <div style={{fontSize:32}}>📡</div>
          <div style={{fontSize:13,fontWeight:700,color:T.sub}}>Getting your location…</div>
        </div>
      )}
      {placingPlant&&(
        <div style={{position:"absolute",top:12,left:"50%",transform:"translateX(-50%)",background:"rgba(255,255,255,0.95)",borderRadius:20,padding:"8px 18px",fontSize:13,fontWeight:700,color:T.accent,boxShadow:T.shadow,whiteSpace:"nowrap",pointerEvents:"none"}}>
          📍 Tap map to plant cutting of "{placingPlant.name}"
        </div>
      )}
      {gpsAccuracy&&userPos&&(
        <div style={{position:"absolute",bottom:10,right:10,background:"rgba(255,255,255,0.9)",borderRadius:10,padding:"3px 8px",fontSize:10,fontWeight:600,color:T.sub}}>
          📍 {PROXIMITY_RADIUS}m radius
        </div>
      )}
    </div>
  );
}

// ─── Main app ──────────────────────────────────────────────────────────────────
export default function App() {
  const [user,setUser]=useState(null);
  const [userLoading,setUserLoading]=useState(true);
  const [tab,setTab]=useState("editor");
  const [menuOpen,setMenuOpen]=useState(false);
  const [showProfile,setShowProfile]=useState(false);
  const [showFriends,setShowFriends]=useState(false);
  const [grid,setGrid]=useState(mkGrid());
  const [history,setHistory]=useState([mkGrid()]);
  const [histIdx,setHistIdx]=useState(0);
  const [color,setColor]=useState("#52a63a");
  const [palette,setPalette]=useState("🌿 Forest");
  const [tool,setTool]=useState("draw");
  const [painting,setPainting]=useState(false);

  const [pots,setPots]=useState(()=>{
    try {
      const s=localStorage.getItem("plantopia_pots");
      if (s) { const arr=JSON.parse(s); return Array(MAX_POTS).fill(null).map((_,i)=>arr[i]||null); }
      const old=localStorage.getItem("plantopia_garden");
      if (old) { const arr=JSON.parse(old); return Array(MAX_POTS).fill(null).map((_,i)=>arr[i]||null); }
    } catch(e) {}
    return Array(MAX_POTS).fill(null);
  });

  // featured plant id — persisted
  const [featuredPlantId,setFeaturedPlantId]=useState(()=>{
    try { return localStorage.getItem("plantopia_featured")||null; } catch(e) { return null; }
  });

  const [plantName,setPlantName]=useState("");
  const [toast,setToast]=useState(null);
  const [worldPlants,setWorldPlants]=useState([]);
  const [worldSeeds,setWorldSeeds]=useState([]);
  const [localSeeds,setLocalSeeds]=useState([]);
  const [selectedPin,setSelectedPin]=useState(null);
  const [ceremony,setCeremony]=useState(null);
  const [seedModal,setSeedModal]=useState(null);
  const [visitModal,setVisitModal]=useState(null);
  const [placingPlant,setPlacingPlant]=useState(null);
  const [inventory,setInventory]=useState(()=>{
    try { const s=localStorage.getItem("plantopia_inventory"); return s?JSON.parse(s):[]; } catch(e) { return []; }
  });
  const [userPos,setUserPos]=useState(null);
  const [gpsAccuracy,setGpsAccuracy]=useState(null);
  const [gpsError,setGpsError]=useState(null);
  const [gpsLoading,setGpsLoading]=useState(false);
  const containerRef=useRef(null);
  const [cs,setCs]=useState(20);
  const watchRef=useRef(null);
  const landmarksLoadedRef=useRef(false);

  useEffect(()=>{ const s=localStorage.getItem("plantopia_user"); if (s) { try { setUser(JSON.parse(s)); } catch(e) {} } setUserLoading(false); },[]);
  useEffect(()=>{ try { localStorage.setItem("plantopia_pots",JSON.stringify(pots)); } catch(e) {} },[pots]);
  useEffect(()=>{ try { localStorage.setItem("plantopia_inventory",JSON.stringify(inventory)); } catch(e) {} },[inventory]);
  useEffect(()=>{ try { if (featuredPlantId) localStorage.setItem("plantopia_featured",featuredPlantId); } catch(e) {} },[featuredPlantId]);

  useEffect(()=>{
    const upd=()=>{ if (containerRef.current) { const w=containerRef.current.offsetWidth-48; setCs(Math.floor(Math.min(w,340)/GRID)); } };
    upd(); window.addEventListener("resize",upd); return ()=>window.removeEventListener("resize",upd);
  },[]);

  useEffect(()=>{
    if (!navigator.geolocation) { setGpsError("Geolocation not supported"); return; }
    setGpsLoading(true);
    watchRef.current=navigator.geolocation.watchPosition(
      pos=>{ const {latitude:lat,longitude:lng,accuracy}=pos.coords; setUserPos({lat,lng}); setGpsAccuracy(accuracy); setGpsLoading(false); setGpsError(null); },
      err=>{ setGpsError(err.code===1?"Location denied.":"Unable to get location."); setGpsLoading(false); },
      {enableHighAccuracy:true,maximumAge:3000,timeout:15000}
    );
    return ()=>{ if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current); };
  },[]);

  useEffect(()=>{
    if (!userPos) return;
    fetchNearby();
    const interval=setInterval(fetchNearby,15000);
    if (!landmarksLoadedRef.current) { landmarksLoadedRef.current=true; loadLandmarkAndCommonSeeds(userPos.lat,userPos.lng); }
    return ()=>clearInterval(interval);
  },[userPos]);

  const fetchNearby=async()=>{
    const {data:plants}=await supabase.from("plants").select("*").order("created_at",{ascending:false});
    if (plants) setWorldPlants(plants);
    const {data:seeds}=await supabase.from("seeds").select("*");
    if (seeds) setWorldSeeds(seeds);
  };

  const loadLandmarkAndCommonSeeds=async(lat,lng)=>{
    const common=generateCommonSeeds(lat,lng,8);
    const landmarks=await fetchLandmarks(lng,lat);
    const rare=landmarks.slice(0,4).map((lm,i)=>{ const tmpl=RARE_TEMPLATES[i%RARE_TEMPLATES.length]; return {id:"rare-"+lm.id,name:tmpl.name+" Seed",lat:lm.center[1],lng:lm.center[0],color:tmpl.color,is_random:true,rarity:"rare",landmark_name:lm.text,local:true}; });
    setLocalSeeds([...common,...rare]);
  };

  const nearbyPlants=userPos?worldPlants.filter(p=>haversine(userPos.lat,userPos.lng,p.lat,p.lng)<=PROXIMITY_RADIUS):[];
  const nearbySeeds=userPos?worldSeeds.filter(s=>haversine(userPos.lat,userPos.lng,s.lat,s.lng)<=PROXIMITY_RADIUS):[];
  const nearbyLocalSeeds=userPos?localSeeds.filter(s=>haversine(userPos.lat,userPos.lng,s.lat,s.lng)<=PROXIMITY_RADIUS):[];
  const allNearby=userPos?[
    ...nearbyPlants.map(p=>({...p,pinType:"plant",distM:haversine(userPos.lat,userPos.lng,p.lat,p.lng)})),
    ...nearbySeeds.map(s=>({...s,pinType:"dbseed",distM:haversine(userPos.lat,userPos.lng,s.lat,s.lng)})),
    ...nearbyLocalSeeds.map(s=>({...s,pinType:"localseed",distM:haversine(userPos.lat,userPos.lng,s.lat,s.lng)})),
  ].sort((a,b)=>a.distM-b.distM):[];

  const showToast=msg=>{ setToast(msg); setTimeout(()=>setToast(null),2500); };
  const pushHistory=useCallback(g=>{ const h=history.slice(0,histIdx+1); h.push(g); setHistory(h); setHistIdx(h.length-1); setGrid(g); },[history,histIdx]);
  const paint=useCallback((r,c)=>{ if (tool==="fill") { pushHistory(floodFill(grid,r,c,color)); return; } const next=grid.map(row=>[...row]); next[r][c]=tool==="erase"?null:color; setGrid(next); },[grid,color,tool,pushHistory]);
  const endStroke=useCallback(()=>{ if (tool!=="fill") pushHistory(grid); setPainting(false); },[grid,tool,pushHistory]);

  const potsUsed=pots.filter(Boolean).length;
  const potsFull=potsUsed>=MAX_POTS;

  const savePlant=()=>{
    if (!grid.some(row=>row.some(c=>c))) { showToast("Draw something first! 🖌️"); return; }
    if (potsFull) { showToast("All pots are full! Remove one first 🪴"); setTab("garden"); return; }
    const name=plantName.trim()||"Plant #"+(potsUsed+1);
    const newPlant={id:"pot-"+Date.now(),name,grid:grid.map(r=>[...r]),date:new Date().toLocaleDateString(),color};
    setPots(p=>{ const idx=p.findIndex(slot=>!slot); if (idx===-1) return p; const n=[...p]; n[idx]=newPlant; return n; });
    setPlantName(""); pushHistory(mkGrid());
    showToast('🌱 "'+name+'" saved to pot!');
    setTimeout(()=>setTab("garden"),1500);
  };

  const removePlantFromPot=plant=>{
    setPots(p=>p.map(slot=>slot&&slot.id===plant.id?null:slot));
    if (featuredPlantId===plant.id) setFeaturedPlantId(null);
    showToast("🌿 Plant removed from pot");
  };

  // Plant a cutting from a pot — pot keeps the original, cutting goes to map
  const plantCuttingFromPot=async(plant)=>{
    const cutting={
      id:"cutting-"+Date.now(),
      name:plant.name+" Cutting",
      grid:plant.grid.map(r=>[...r]),
      color:plant.color,
      isSeed:false,
      fromPotId:plant.id,
    };
    setPlacingPlant(cutting);
    setTab("map");
    showToast('📍 Tap the map to plant a cutting of "'+plant.name+'"!');
  };

  // Plant inventory seed on map
  const placeOnMap=async(plant)=>{
    let resolved={...plant};
    if (plant.isSeed) {
      if (plant.random) {
        const tmpl=PLANT_TEMPLATES[Math.floor(Math.random()*PLANT_TEMPLATES.length)];
        resolved={...plant,name:tmpl.name,grid:makeTemplateGrid(tmpl),color:tmpl.color,isSeed:false};
      } else { resolved={...plant,isSeed:false}; }
      setInventory(s=>s.filter(sd=>sd.id!==plant.id));
      if (plant.dbId) await supabase.from("seeds").delete().eq("id",plant.dbId);
    }
    setPlacingPlant(resolved);
    setTab("map");
    showToast('📍 Tap the map to plant "'+resolved.name+'"!');
  };

  const handleMapClick=async(lat,lng)=>{
    if (!placingPlant||!userPos) return;
    const {data,error}=await supabase.from("plants").insert({user_id:user.id,username:user.username,name:placingPlant.name,lat,lng,grid:placingPlant.grid,color:placingPlant.color}).select().single();
    if (error) { showToast("Couldn't plant — check connection"); return; }
    setWorldPlants(p=>[...p,data]);
    // set cooldown on the source pot if this was a cutting
    if (placingPlant.fromPotId) {
      setCooldown("pot-cd-"+placingPlant.fromPotId, POT_COOLDOWN_MS);
    }
    setCeremony({plant:{...placingPlant}});
    setPlacingPlant(null);
    const sLat=lat+(Math.random()-0.5)*0.0003, sLng=lng+(Math.random()-0.5)*0.0003;
    await supabase.from("seeds").insert({name:placingPlant.name+" Seed",lat:sLat,lng:sLng,color:placingPlant.color,is_random:false,source_plant_id:data.id});
    await fetchNearby();
  };

  const handlePinClick=pin=>{
    setSelectedPin(pin.id);
    if (pin.pinType==="plant") setVisitModal({...pin,distM:userPos?haversine(userPos.lat,userPos.lng,pin.lat,pin.lng):0});
    else setSeedModal(pin);
  };

  const handleSeedCollect=pin=>{
    setInventory(s=>[...s,{id:"inv-"+Date.now(),name:pin.rarity==="rare"?pin.name:pin.is_random?"Mystery Seed":pin.name+" Cutting",color:pin.color,random:!!pin.is_random,rarity:pin.rarity||"common",grid:null,isSeed:true,dbId:pin.local?null:pin.id}]);
    if (pin.local) setLocalSeeds(s=>s.filter(ss=>ss.id!==pin.id));
    else { setWorldSeeds(s=>s.filter(ss=>ss.id!==pin.id)); if (pin.id) supabase.from("seeds").delete().eq("id",pin.id); }
    setSeedModal(null); setTab("garden");
    showToast(pin.rarity==="rare"?"🌟 Rare seed collected!":"🌰 Seed collected!");
  };

  const handleHarvest=pin=>{
    setInventory(s=>[...s,{id:"inv-"+Date.now(),name:pin.name+" Cutting",color:pin.color,random:false,rarity:"common",grid:pin.grid,isSeed:true}]);
    setVisitModal(null); setTab("garden");
    showToast("🌿 "+pin.name+" cutting added to inventory!");
  };

  const handleHeart=async pin=>{
    await supabase.from("plants").update({hearts:(pin.hearts||0)+1}).eq("id",pin.id);
    setWorldPlants(p=>p.map(pp=>pp.id===pin.id?{...pp,hearts:(pp.hearts||0)+1}:pp));
    showToast("💚 Heart left!");
  };

  const NAV=[{id:"editor",icon:"✏️",label:"Editor"},{id:"garden",icon:"🌿",label:"Garden"},{id:"map",icon:"🗺️",label:"Map"}];

  if (userLoading) return <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh",fontSize:40}}>🌱</div>;
  if (!user) return <UsernameScreen onSet={setUser} />;

  return (
    <div style={{background:T.bg,minHeight:"100vh",maxWidth:430,margin:"0 auto",display:"flex",flexDirection:"column",fontFamily:"'Segoe UI',sans-serif",position:"relative",overflow:"hidden"}}>

      {/* Header */}
      <div style={{background:"#fff",padding:"10px 20px 8px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:"1px solid "+T.border,gap:8}}>
        <div style={{fontSize:16,fontWeight:900,color:T.text}}>🌱 <span style={{color:T.green}}>{user.username}</span></div>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          {inventory.length>0&&<span style={{fontSize:12,color:T.yellow,fontWeight:700}}>🌰×{inventory.length}</span>}
          <span style={{fontSize:12,color:potsUsed>=MAX_POTS?T.accent:T.sub,fontWeight:700}}>🪴{potsUsed}/{MAX_POTS}</span>
          <GPSBadge gps={!!userPos} accuracy={gpsAccuracy} />
          <button onClick={()=>setMenuOpen(o=>!o)} style={{width:36,height:36,borderRadius:12,border:"none",background:"#f5f5f5",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:4,padding:8,boxShadow:T.shadow}}>
            {[0,1,2].map(i=><div key={i} style={{width:16,height:2,borderRadius:2,background:T.text,transition:"all 0.2s",transform:menuOpen&&i===0?"rotate(45deg) translate(3px,3px)":menuOpen&&i===1?"scaleX(0)":menuOpen&&i===2?"rotate(-45deg) translate(3px,-3px)":"none"}} />)}
          </button>
        </div>
      </div>

      {/* Burger menu */}
      {menuOpen&&(
        <div style={{position:"fixed",inset:0,zIndex:300}} onClick={()=>setMenuOpen(false)}>
          <div style={{position:"absolute",top:56,right:12,background:"#fff",borderRadius:20,boxShadow:"0 8px 32px rgba(0,0,0,0.15)",border:"1px solid "+T.border,minWidth:200,overflow:"hidden"}} onClick={e=>e.stopPropagation()}>
            {[
              {icon:"🏆",label:"My Profile",action:()=>{ setShowProfile(true); setMenuOpen(false); }},
              {icon:"👥",label:"Friends",action:()=>{ setShowFriends(true); setMenuOpen(false); }},
              {icon:"🌍",label:"Leaderboard",action:()=>{ showToast("Coming soon! 🌱"); setMenuOpen(false); }},
              {icon:"⚙️",label:"Settings",action:()=>{ showToast("Coming soon! 🌱"); setMenuOpen(false); }},
              {icon:"🚪",label:"Change Username",action:()=>{ localStorage.removeItem("plantopia_user"); setUser(null); setMenuOpen(false); }},
            ].map(item=>(
              <button key={item.label} onClick={item.action} style={{width:"100%",padding:"14px 20px",border:"none",background:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:12,fontSize:14,fontWeight:600,color:T.text,borderBottom:"1px solid "+T.border}}>
                <span style={{fontSize:20}}>{item.icon}</span>{item.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {showProfile&&<ProfileScreen user={user} worldPlants={worldPlants} inventory={inventory} pots={pots} featuredPlantId={featuredPlantId} onSetFeatured={setFeaturedPlantId} onClose={()=>setShowProfile(false)} />}
      {showFriends&&<FriendsScreen user={user} worldPlants={worldPlants} onClose={()=>setShowFriends(false)} onHarvest={handleHarvest} onHeart={handleHeart} />}

      <div ref={containerRef} style={{flex:1,overflowY:"auto",paddingBottom:80}}>

        {/* ── Editor ── */}
        {tab==="editor"&&(
          <div style={{padding:"16px 16px 0"}}>
            <div style={{fontWeight:800,fontSize:18,color:T.text,marginBottom:2}}>Plant Editor ✏️</div>
            <div style={{fontSize:12,color:T.sub,marginBottom:6}}>Design your pixel plant to grow in a pot</div>
            {potsFull&&(
              <div style={{background:"#fff5f5",border:"1px solid #fecaca",borderRadius:14,padding:"10px 14px",marginBottom:10,display:"flex",alignItems:"center",gap:8,fontSize:12,color:"#dc2626",fontWeight:600}}>
                <span>🪴</span> All {MAX_POTS} pots are full — go to Garden to free up a spot.
              </div>
            )}
            <div style={{display:"flex",gap:8,marginBottom:12,alignItems:"center"}}>
              {TOOLS.map(t=>(
                <button key={t.id} onClick={()=>setTool(t.id)} style={{width:44,height:44,borderRadius:14,border:"none",fontSize:20,cursor:"pointer",background:tool===t.id?T.accent:"#f5f5f5",boxShadow:tool===t.id?"0 4px 12px "+T.accent+"55":T.shadow,transform:tool===t.id?"scale(1.1)":"scale(1)",transition:"all 0.15s"}}>{t.icon}</button>
              ))}
              <div style={{flex:1}} />
              {[["↩",()=>{ if (histIdx>0) { setHistIdx(h=>h-1); setGrid(history[histIdx-1]); } },histIdx===0],
                ["↪",()=>{ if (histIdx<history.length-1) { setHistIdx(h=>h+1); setGrid(history[histIdx+1]); } },histIdx===history.length-1],
                ["🗑",()=>pushHistory(mkGrid()),false]].map(([lbl,fn,dis])=>(
                <button key={lbl} onClick={fn} disabled={dis} style={{width:38,height:38,borderRadius:12,border:"none",fontSize:16,cursor:dis?"not-allowed":"pointer",background:"#f5f5f5",color:dis?"#ccc":T.text,boxShadow:T.shadow}}>{lbl}</button>
              ))}
            </div>
            <div style={{background:T.card,borderRadius:20,padding:14,marginBottom:12,boxShadow:T.shadow}}>
              <div style={{display:"flex",gap:6,marginBottom:10,overflowX:"auto",paddingBottom:2}}>
                {Object.keys(PALETTES).map(p=>(
                  <button key={p} onClick={()=>setPalette(p)} style={{whiteSpace:"nowrap",padding:"5px 10px",borderRadius:20,border:"none",cursor:"pointer",fontSize:11,fontWeight:700,background:palette===p?T.accent:"#f5f5f5",color:palette===p?"#fff":T.text}}>{p}</button>
                ))}
              </div>
              <div style={{display:"flex",gap:7,flexWrap:"wrap",alignItems:"center"}}>
                {PALETTES[palette].map(c=>(
                  <button key={c} onClick={()=>{ setColor(c); setTool("draw"); }} style={{width:30,height:30,borderRadius:10,border:color===c?"3px solid #333":"2px solid transparent",background:c,cursor:"pointer",boxShadow:color===c?"0 0 10px "+c+"99":"none",transform:color===c?"scale(1.2)":"scale(1)",transition:"all 0.15s"}} />
                ))}
                <input type="color" value={color} onChange={e=>{ setColor(e.target.value); setTool("draw"); }} style={{width:30,height:30,borderRadius:10,border:"2px dashed #ccc",cursor:"pointer",padding:0}} />
              </div>
            </div>
            <div style={{display:"flex",justifyContent:"center",marginBottom:12}}>
              <div style={{borderRadius:16,overflow:"hidden",boxShadow:"0 8px 32px rgba(0,0,0,0.15)",border:"3px solid "+T.border}}>
                <div style={{display:"grid",gridTemplateColumns:"repeat("+GRID+","+cs+"px)",cursor:tool==="erase"?"cell":"crosshair",userSelect:"none",touchAction:"none"}} onMouseLeave={endStroke} onMouseUp={endStroke}>
                  {grid.map((row,r)=>row.map((col,c)=>(
                    <div key={r+"-"+c} style={{width:cs,height:cs,background:col||((r+c)%2===0?"#f9f9f9":"#f0f0f0"),boxSizing:"border-box",border:"0.5px solid rgba(0,0,0,0.04)"}}
                      onMouseDown={()=>{ setPainting(true); paint(r,c); }}
                      onMouseEnter={()=>{ if (painting) paint(r,c); }}
                      onTouchStart={e=>{ e.preventDefault(); setPainting(true); paint(r,c); }}
                      onTouchMove={e=>{ e.preventDefault(); const t=e.touches[0]; const el=document.elementFromPoint(t.clientX,t.clientY); if (el&&el.dataset.r!==undefined) paint(+el.dataset.r,+el.dataset.c); }}
                      data-r={r} data-c={c} />
                  )))}
                </div>
              </div>
            </div>
            <div style={{background:T.card,borderRadius:16,padding:12,marginBottom:14,boxShadow:T.shadow,display:"flex",alignItems:"center",gap:12}}>
              <div style={{fontSize:12,color:T.sub,fontWeight:700}}>Preview</div>
              {[4,8,14].map(sz=>(
                <div key={sz} style={{background:"#f5f5f5",borderRadius:8,padding:4}}>
                  <div style={{display:"grid",gridTemplateColumns:"repeat("+GRID+","+sz+"px)"}}>
                    {grid.map((row,r)=>row.map((col,c)=><div key={"pv-"+r+"-"+c} style={{width:sz,height:sz,background:col||"transparent"}} />))}
                  </div>
                </div>
              ))}
            </div>
            <div style={{display:"flex",gap:8}}>
              <input value={plantName} onChange={e=>setPlantName(e.target.value)} placeholder="Name your plant..."
                style={{flex:1,background:T.card,border:"2px solid "+T.border,borderRadius:14,padding:"12px 16px",color:T.text,fontSize:14,outline:"none",boxShadow:T.shadow}} />
              <button onClick={savePlant} style={{padding:"12px 20px",borderRadius:14,border:"none",cursor:"pointer",fontWeight:800,background:potsFull?"#ccc":"linear-gradient(135deg,"+T.green+",#20c997)",color:"#fff",fontSize:16,boxShadow:potsFull?"none":"0 4px 16px "+T.green+"66"}}>🌱</button>
            </div>
            <div style={{fontSize:11,color:T.sub,textAlign:"center",marginTop:8,marginBottom:16}}>🪴 {potsUsed}/{MAX_POTS} pots used</div>
          </div>
        )}

        {/* ── Garden ── */}
        {tab==="garden"&&(
          <div style={{padding:16}}>
            <div style={{fontWeight:800,fontSize:18,color:T.text,marginBottom:2}}>My Garden 🌿</div>
            <div style={{fontSize:12,color:T.sub,marginBottom:4}}>Your pots and seeds</div>
            <div style={{fontSize:11,color:potsUsed>=MAX_POTS?T.accent:T.sub,fontWeight:700,marginBottom:16}}>🪴 {potsUsed}/{MAX_POTS} pots used</div>
            <div style={{fontWeight:700,fontSize:13,color:T.text,marginBottom:10}}>🪴 My Pots</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:24}}>
              {pots.map((plant,i)=>(
                <PotSlot key={i} plant={plant} onPlantCutting={plantCuttingFromPot} onRemove={removePlantFromPot} />
              ))}
            </div>
            {inventory.length>0&&(
              <>
                <div style={{fontWeight:700,fontSize:13,color:T.text,marginBottom:10}}>🌰 Seeds & Cuttings ({inventory.length})</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                  {inventory.map(seed=><SeedCard key={seed.id} seed={seed} onPlant={placeOnMap} />)}
                </div>
              </>
            )}
            {potsUsed===0&&inventory.length===0&&(
              <div style={{textAlign:"center",padding:"40px 20px",color:T.sub}}>
                <div style={{fontSize:56,marginBottom:12}}>🪴</div>
                <div style={{fontWeight:700,fontSize:16,color:T.text}}>No plants yet!</div>
                <div style={{fontSize:13,margin:"8px 0 20px"}}>Draw one in the editor or collect seeds on the map.</div>
                <button onClick={()=>setTab("editor")} style={{padding:"12px 28px",borderRadius:14,border:"none",background:T.accent,color:"#fff",fontWeight:700,fontSize:14,cursor:"pointer"}}>Open Editor ✏️</button>
              </div>
            )}
          </div>
        )}

        {/* ── Map ── */}
        {tab==="map"&&(
          <div style={{padding:16}}>
            <div style={{fontWeight:800,fontSize:18,color:T.text,marginBottom:2}}>World Map 🗺️</div>
            <div style={{fontSize:12,color:placingPlant?T.accent:T.sub,marginBottom:10,fontWeight:placingPlant?700:400}}>
              {placingPlant?"Tap the map to plant your cutting!":"🌟 Rare seeds at landmarks · 🌰 Common seeds within "+PROXIMITY_RADIUS+"m"}
            </div>
            {gpsError&&<div style={{background:"#fff5f5",border:"1px solid #fecaca",borderRadius:14,padding:"12px 16px",marginBottom:12,fontSize:13,color:"#dc2626"}}>⚠️ {gpsError}</div>}
            <MapView userPos={userPos} gpsAccuracy={gpsAccuracy} nearbyPlants={nearbyPlants} nearbySeeds={nearbySeeds} localSeeds={nearbyLocalSeeds} placingPlant={placingPlant} onMapClick={handleMapClick} onPinClick={handlePinClick} gpsLoading={gpsLoading} />
            {userPos&&allNearby.length>0&&(
              <>
                <div style={{fontWeight:800,fontSize:14,color:T.text,marginBottom:10}}>Within {PROXIMITY_RADIUS}m ({allNearby.length})</div>
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {allNearby.slice(0,20).map(pin=>(
                    <div key={pin.id} onClick={()=>handlePinClick(pin)} style={{background:T.card,borderRadius:16,padding:"12px 14px",display:"flex",alignItems:"center",gap:12,boxShadow:T.shadow,border:"2px solid "+(selectedPin===pin.id?pin.color:pin.rarity==="rare"?"#f59e0b44":T.border),cursor:"pointer",transition:"all 0.15s"}}>
                      <div style={{width:36,height:36,borderRadius:12,background:pin.rarity==="rare"?"#fef3c7":pin.color+"22",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                        {pin.pinType==="plant"&&pin.grid?<GrowingPlant grid={pin.grid} size={32} />:<span style={{fontSize:18}}>{pin.rarity==="rare"?"🌟":"🌰"}</span>}
                      </div>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:700,fontSize:13,color:T.text,display:"flex",alignItems:"center",gap:6}}>
                          {pin.name}
                          {pin.rarity==="rare"&&<span style={{fontSize:10,background:"#fef3c7",color:"#f59e0b",borderRadius:10,padding:"1px 6px",fontWeight:800}}>RARE</span>}
                        </div>
                        <div style={{fontSize:11,color:T.sub}}>
                          {pin.pinType==="plant"?"By "+(pin.username||"unknown")+(pin.hearts?" · 💚"+pin.hearts:""):pin.rarity==="rare"?"At "+(pin.landmark_name||"landmark"):"Seed · tap to collect"}
                        </div>
                      </div>
                      <div style={{fontSize:12,fontWeight:700,color:pin.distM<30?T.green:pin.distM<100?T.yellow:T.sub,flexShrink:0}}>{pin.distM}m</div>
                    </div>
                  ))}
                </div>
              </>
            )}
            {userPos&&allNearby.length===0&&(
              <div style={{textAlign:"center",padding:"32px 0",color:T.sub}}>
                <div style={{fontSize:40,marginBottom:8}}>🌍</div>
                <div style={{fontSize:13}}>Nothing within {PROXIMITY_RADIUS}m.<br />Explore to discover plants and seeds!</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom nav */}
      <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:430,background:"#fff",borderTop:"1px solid "+T.border,display:"flex",padding:"8px 0 20px",boxShadow:"0 -4px 20px rgba(0,0,0,0.08)",zIndex:100}}>
        {NAV.map(n=>(
          <button key={n.id} onClick={()=>setTab(n.id)} style={{flex:1,border:"none",background:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3,padding:"4px 0"}}>
            <div style={{fontSize:22,lineHeight:1,filter:tab===n.id?"none":"grayscale(0.3)",transform:tab===n.id?"scale(1.18)":"scale(1)",transition:"all 0.2s"}}>{n.icon}</div>
            <div style={{fontSize:10,fontWeight:tab===n.id?800:500,color:tab===n.id?T.accent:T.sub}}>{n.label}</div>
            {tab===n.id&&<div style={{width:4,height:4,borderRadius:"50%",background:T.accent}} />}
          </button>
        ))}
      </div>

      {seedModal&&<SeedModal pin={seedModal} onCollect={handleSeedCollect} onClose={()=>setSeedModal(null)} />}
      {visitModal&&<VisitModal pin={visitModal} onHarvest={handleHarvest} onClose={()=>setVisitModal(null)} onHeart={handleHeart} />}
      {ceremony&&<PlantingCeremony plant={ceremony.plant} onDone={()=>setCeremony(null)} />}
      {toast&&(
        <div style={{position:"fixed",top:70,left:"50%",transform:"translateX(-50%)",background:"#2d2d2d",color:"#fff",padding:"10px 20px",borderRadius:20,fontSize:13,fontWeight:600,boxShadow:"0 8px 32px rgba(0,0,0,0.25)",zIndex:999,whiteSpace:"nowrap"}}>{toast}</div>
      )}
    </div>
  );
}