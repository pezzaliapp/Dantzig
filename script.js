// Dantzig Demo — v6 (stabile)
(() => {
  'use strict';

  // ---------- RNG & Stat helpers ----------

  // Polyfill erf (Abramowitz & Stegun 7.1.26) — per browser senza Math.erf
  function __erf(x){
    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x);
    const a1=0.254829592, a2=-0.284496736, a3=1.421413741, a4=-1.453152027, a5=1.061405429, p=0.3275911;
    const t = 1/(1 + p*x);
    const y = 1 - (((((a5*t + a4)*t) + a3)*t + a2)*t + a1)*t*Math.exp(-x*x);
    return sign * y;
  }

  function mulberry32(a) {
    return function() {
      let t = a += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
  }
  let rand = mulberry32(123456);

  function randn() { // Box-Muller
    let u = 0, v = 0;
    while (u===0) u = rand();
    while (v===0) v = rand();
    return Math.sqrt(-2.0*Math.log(u)) * Math.cos(2*Math.PI*v);
  }

  function sampleNormal(mu, sigma){ return mu + sigma * randn(); }
  function mean(arr){ let s=0; for(let x of arr) s+=x; return s/arr.length; }
  function std(arr){ const m=mean(arr); let s2=0; for(let x of arr) s2+=(x-m)*(x-m); return Math.sqrt(s2/(arr.length-1)); }
  function quantile(sortedArr, q){
    const n=sortedArr.length, pos=(n-1)*q, base=Math.floor(pos), rest=pos-base;
    if (sortedArr[base+1] !== undefined) return sortedArr[base] + rest*(sortedArr[base+1]-sortedArr[base]);
    return sortedArr[base];
  }

  // Normale standard
  function Phi(z){ return 0.5*(1 + __erf(z/Math.SQRT2)); }
  function PhiInv(p){
    if (p<=0 || p>=1){ if(p===0) return -Infinity; if(p===1) return Infinity; throw new Error('p out of (0,1)'); }
    const a1=-39.6968302866538,a2=220.946098424521,a3=-275.928510446969,a4=138.357751867269,a5=-30.6647980661472,a6=2.50662827745924;
    const b1=-54.4760987982241,b2=161.585836858041,b3=-155.698979859887,b4=66.8013118877197,b5=-13.2806815528857;
    const c1=-0.00778489400243029,c2=-0.322396458041136,c3=-2.40075827716184,c4=-2.54973253934373,c5=4.37466414146497,c6=2.93816398269878;
    const d1=0.00778469570904146,d2=0.32246712907004,d3=2.445134137143,d4=3.75440866190742, plow=0.02425, phigh=1-plow;
    let q,r;
    if(p<plow){ q=Math.sqrt(-2*Math.log(p)); return (((((c1*q+c2)*q+c3)*q+c4)*q+c5)*q+c6)/((((d1*q+d2)*q+d3)*q+d4)*q+1); }
    if(phigh<p){ q=Math.sqrt(-2*Math.log(1-p)); return -(((((c1*q+c2)*q+c3)*q+c4)*q+c5)*q+c6)/((((d1*q+d2)*q+d3)*q+d4)*q+1); }
    q=p-0.5; r=q*q;
    return (((((a1*r+a2)*r+a3)*r+a4)*r+a5)*r+a6)*q/(((((b1*r+b2)*r+b3)*r+b4)*r+b5)*r+1);
  }

  // ---------- Canvas helpers ----------
  function clearCanvas(ctx, w, h){ ctx.clearRect(0,0,w,h); ctx.fillStyle="#0d0f14"; ctx.fillRect(0,0,w,h); }
  function drawAxes(ctx, w, h, xmin, xmax, ymin, ymax, title){
    ctx.strokeStyle="#2a2d35"; ctx.lineWidth=1; ctx.strokeRect(48,16,w-64,h-64);
    ctx.fillStyle="#9aa0a6"; ctx.font="12px ui-monospace,monospace"; ctx.fillText(title,56,14);
    for(let i=0;i<=5;i++){ const x=48+(w-64)*i/5; ctx.fillRect(x,h-48,1,6); const xv=(xmin+(xmax-xmin)*i/5).toFixed(2); ctx.fillText(xv,x-10,h-28); }
    for(let j=0;j<=5;j++){ const y=16+(h-64)*(1-j/5); ctx.fillRect(42,y,6,1); const yv=(ymin+(ymax-ymin)*j/5).toFixed(2); ctx.fillText(yv,8,y+4); }
  }
  function plotLine(ctx, w, h, xmin, xmax, ymin, ymax, xs, ys, stroke="#66d9ef"){
    const toX=v=>48+(w-64)*(v-xmin)/(xmax-xmin), toY=v=>16+(h-64)*(1-(v-ymin)/(ymax-ymin));
    ctx.beginPath(); for(let i=0;i<xs.length;i++){ const x=toX(xs[i]), y=toY(ys[i]); if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y); }
    ctx.lineWidth=2; ctx.strokeStyle=stroke; ctx.stroke();
  }

  // ---------- Stato animazioni ----------
  let raf1=null, raf2=null;
  let anim1Running=false, anim2Running=false;
  let P1=null, P2=null; // dati precomputati

  // ---------- Problema 1 ----------
  function runProblem1(){
    const n=parseInt(document.getElementById('n1').value,10);
    const alpha=parseFloat(document.getElementById('alpha1').value);
    const delta=parseFloat(document.getElementById('delta1').value);
    const smin=parseFloat(document.getElementById('smin').value);
    const smax=parseFloat(document.getElementById('smax').value);
    const trials=parseInt(document.getElementById('trials1').value,10);

    // Calibrazione tcrit sotto H0 (σ irrilevante: uso 1)
    const t0=[];
    for(let k=0;k<trials;k++){
      const x=Array.from({length:n}, _=> sampleNormal(0,1));
      const m=mean(x), s=std(x);
      t0.push(Math.sqrt(n)*m/s);
    }
    t0.sort((a,b)=>a-b);
    const tcrit=quantile(t0, 1-alpha);

    const K=13;
    const sigmas=Array.from({length:K}, (_,i)=> smin + i*(smax-smin)/(K-1));
    const powers=[];
    for(let sigma of sigmas){
      // Potenza per sigma: simulazione unica (stabile) con trials
      let count=0;
      for(let k=0;k<trials;k++){
        const x=Array.from({length:n}, _=> sampleNormal(delta, sigma));
        const m=mean(x), s=std(x);
        if (Math.sqrt(n)*m/s > tcrit) count++;
      }
      powers.push(count/trials);
    }

    // Disegno
    const ctx=document.getElementById('chart1').getContext('2d');
    const w=ctx.canvas.width, h=ctx.canvas.height;
    clearCanvas(ctx,w,h);
    drawAxes(ctx,w,h,sigmas[0],sigmas[sigmas.length-1],0,1,"Potenza (test t) al variare di σ");
    plotLine(ctx,w,h,sigmas[0],sigmas[sigmas.length-1],0,1,sigmas,powers,"#66d9ef");

    document.getElementById('res1').textContent = "t_crit ≈ "+tcrit.toFixed(3)+"  |  " +
      sigmas.map((s,i)=>`σ=${s.toFixed(2)}→P=${powers[i].toFixed(3)}`).join("  ");

    P1 = {sigmas, powers};
  }

  function animateProblem1(){
    if(anim1Running) return; anim1Running=true;
    if(!P1) runProblem1();
    const {sigmas, powers} = P1;
    const ctx=document.getElementById('chart1').getContext('2d');
    const w=ctx.canvas.width, h=ctx.canvas.height;
    const xmin=sigmas[0], xmax=sigmas[sigmas.length-1], ymin=0, ymax=1;
    let frame=0, steps=360; // ~12s a 30fps

    (function loop(){
      if(!anim1Running){ raf1=null; return; }
      frame++; const t=(frame%steps)/(steps-1);
      // posione continua sul segmento usando interpolazione lineare sugli indici
      const pos=t*(sigmas.length-1);
      const i=Math.floor(pos), frac=pos-i;
      const sigma = (i>=sigmas.length-1)? sigmas[sigmas.length-1] : sigmas[i]*(1-frac)+sigmas[i+1]*frac;
      const power = (i>=powers.length-1)? powers[powers.length-1] : powers[i]*(1-frac)+powers[i+1]*frac;

      clearCanvas(ctx,w,h);
      drawAxes(ctx,w,h,xmin,xmax,ymin,ymax,"Potenza (test t) al variare di σ");
      plotLine(ctx,w,h,xmin,xmax,ymin,ymax,sigmas,powers,"#66d9ef");

      const toX=v=>48+(w-64)*(v-xmin)/(xmax-xmin), toY=v=>16+(h-64)*(1-(v-ymin)/(ymax-ymin));
      ctx.beginPath(); ctx.arc(toX(sigma), toY(power), 6, 0, Math.PI*2);
      ctx.fillStyle="#66d9ef"; ctx.fill();
      ctx.fillStyle="#9aa0a6"; ctx.font="12px ui-monospace,monospace";
      ctx.fillText(`σ=${sigma.toFixed(2)}  P≈${power.toFixed(3)}`, 56, 32);

      raf1 = requestAnimationFrame(loop);
    })();
  }
  function stopAnim1(){ anim1Running=false; if(raf1) cancelAnimationFrame(raf1); }

  // ---------- Problema 2 (teorico, stabile) ----------
  
  function runProblem2(){
    const n=parseInt(document.getElementById('n2').value,10);
    const alpha=parseFloat(document.getElementById('alpha2').value);
    const mu0=parseFloat(document.getElementById('mu0').value);
    const mu1=parseFloat(document.getElementById('mu1').value);
    const sigma=parseFloat(document.getElementById('sigma2').value);

    const s = sigma/Math.sqrt(n);
    const zA = PhiInv(1-alpha);
    const cA = mu0 + zA*s;
    const zB = PhiInv(1-alpha/2);
    const cB = zB*s;

    const K=200;
    const mus = Array.from({length:K}, (_,i)=> mu0 + (mu1-mu0)*i/(K-1));

    const powerLRT = mus.map(m => 1 - Phi((cA - m)/s));
    const powerB   = mus.map(m => (1 - Phi((mu0 + cB - m)/s)) + Phi((mu0 - cB - m)/s));

    // Imposta esattamente il valore in mu=mu0 pari ad alpha (correzione numerica)
    powerLRT[0] = alpha;
    powerB[0]   = alpha;

    const ctx=document.getElementById('chart2').getContext('2d');
    const w=ctx.canvas.width, h=ctx.canvas.height;
    clearCanvas(ctx,w,h);
    const xmin=Math.min(mus[0], mus[mus.length-1]), xmax=Math.max(mus[0], mus[mus.length-1]);
    const ymin=0, ymax=1;
    drawAxes(ctx,w,h,xmin,xmax,ymin,ymax,"Curve di potenza teoriche: LRT (ciano) vs bilaterale (blu)");

    // linea orizzontale a y=alpha (baseline potenza sotto H0)
    ctx.strokeStyle="#888"; ctx.setLineDash([4,4]); ctx.beginPath();
    const yAlpha = 16 + (h-64)*(1 - (alpha - ymin)/(ymax - ymin));
    ctx.moveTo(48, yAlpha); ctx.lineTo(w-16, yAlpha); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle="#9aa0a6"; ctx.font="12px ui-monospace,monospace"; ctx.fillText(`baseline α=${alpha}`, w-140, yAlpha-6);

    plotLine(ctx,w,h,xmin,xmax,ymin,ymax,mus,powerB,"#4686ff");
    plotLine(ctx,w,h,xmin,xmax,ymin,ymax,mus,powerLRT,"#66d9ef");

    document.getElementById('res2').textContent = `LRT: cA=${cA.toFixed(3)}  |  Bilaterale: cB=${cB.toFixed(3)}  |  s=${s.toFixed(4)}  |  P(μ0)=α=${alpha}`;

    P2 = {mus, powerLRT, powerB, xmin, xmax, ymin, ymax, alpha};
  }

  // Diagnostica: controlla che P(μ0)=α e stampa alcuni valori
  document.getElementById('diag2').addEventListener('click', ()=>{
    const n=parseInt(document.getElementById('n2').value,10);
    const alpha=parseFloat(document.getElementById('alpha2').value);
    const mu0=parseFloat(document.getElementById('mu0').value);
    const mu1=parseFloat(document.getElementById('mu1').value);
    const sigma=parseFloat(document.getElementById('sigma2').value);
    const s = sigma/Math.sqrt(n);
    const zA = PhiInv(1-alpha);
    const zB = PhiInv(1-alpha/2);
    const cA = mu0 + zA*s;
    const cB = zB*s;

    const pL_mu0 = 1 - Phi((cA - mu0)/s);
    const pB_mu0 = (1 - Phi((mu0 + cB - mu0)/s)) + Phi((mu0 - cB - mu0)/s);
    const mid = (mu0+mu1)/2;
    const pL_mid = 1 - Phi((cA - mid)/s);
    const pB_mid = (1 - Phi((mu0 + cB - mid)/s)) + Phi((mu0 - cB - mid)/s);

    alert(`Diagnostica
n=${n}, alpha=${alpha}, mu0=${mu0}, mu1=${mu1}, sigma=${sigma}, s=${s.toFixed(4)}
cA=${cA.toFixed(3)}  cB=${cB.toFixed(3)}
P_LRT(mu0)=${pL_mu0.toFixed(5)} (dovrebbe ≈ α)
P_BIL(mu0)=${pB_mu0.toFixed(5)} (dovrebbe ≈ α)
P_LRT(mid)=${pL_mid.toFixed(5)}  P_BIL(mid)=${pB_mid.toFixed(5)}`);
  });

  function animateProblem2(){
    if(anim2Running) return; anim2Running=true;
    if(!P2) runProblem2();
    const {mus, powerLRT, powerB, xmin, xmax, ymin, ymax, alpha} = P2;

    const ctx=document.getElementById('chart2').getContext('2d');
    const w=ctx.canvas.width, h=ctx.canvas.height;
    let frame=0, steps=360;
    const toX=v=>48+(w-64)*(v-xmin)/(xmax-xmin), toY=v=>16+(h-64)*(1-(v-ymin)/(ymax-ymin));

    (function loop(){
      if(!anim2Running){ raf2=null; return; }
      frame++; const t=(frame%steps)/(steps-1);
      const pos= t*(mus.length-1);
      const i=Math.floor(pos), frac=pos-i;
      const mu = (i>=mus.length-1)? mus[mus.length-1] : mus[i]*(1-frac)+mus[i+1]*frac;
      const yL = (i>=powerLRT.length-1)? powerLRT[powerLRT.length-1] : powerLRT[i]*(1-frac)+powerLRT[i+1]*frac;
      const yB = (i>=powerB.length-1)? powerB[powerB.length-1] : powerB[i]*(1-frac)+powerB[i+1]*frac;

      clearCanvas(ctx,w,h);
      drawAxes(ctx,w,h,xmin,xmax,ymin,ymax,"Curve di potenza teoriche: LRT (ciano) vs bilaterale (blu)");
      // baseline alpha
      ctx.strokeStyle="#888"; ctx.setLineDash([4,4]); ctx.beginPath();
      const yAlpha = 16 + (h-64)*(1 - (alpha - ymin)/(ymax - ymin));
      ctx.moveTo(48, yAlpha); ctx.lineTo(w-16, yAlpha); ctx.stroke(); ctx.setLineDash([]);

      plotLine(ctx,w,h,xmin,xmax,ymin,ymax,mus,powerB,"#4686ff");
      plotLine(ctx,w,h,xmin,xmax,ymin,ymax,mus,powerLRT,"#66d9ef");

      ctx.beginPath(); ctx.arc(toX(mu), toY(yL), 6, 0, Math.PI*2); ctx.fillStyle="#66d9ef"; ctx.fill();
      ctx.beginPath(); ctx.arc(toX(mu), toY(yB), 6, 0, Math.PI*2); ctx.fillStyle="#4686ff"; ctx.fill();

      ctx.fillStyle="#9aa0a6"; ctx.font="12px ui-monospace,monospace";
      ctx.fillText(`μ=${mu.toFixed(3)}  LRT=${yL.toFixed(3)}  Bilat=${yB.toFixed(3)}`, 56, 32);

      raf2 = requestAnimationFrame(loop);
    })();
  }


  function animateProblem2(){
    if(anim2Running) return; anim2Running=true;
    if(!P2) runProblem2();
    const {mus, powerLRT, powerB, xmin, xmax, ymin, ymax} = P2;

    const ctx=document.getElementById('chart2').getContext('2d');
    const w=ctx.canvas.width, h=ctx.canvas.height;
    let frame=0, steps=360; // ~12s
    const toX=v=>48+(w-64)*(v-xmin)/(xmax-xmin), toY=v=>16+(h-64)*(1-(v-ymin)/(ymax-ymin));

    (function loop(){
      if(!anim2Running){ raf2=null; return; }
      frame++; const t=(frame%steps)/(steps-1);
      const pos= t*(mus.length-1);
      const i=Math.floor(pos), frac=pos-i;
      const mu = (i>=mus.length-1)? mus[mus.length-1] : mus[i]*(1-frac)+mus[i+1]*frac;
      const yL = (i>=powerLRT.length-1)? powerLRT[powerLRT.length-1] : powerLRT[i]*(1-frac)+powerLRT[i+1]*frac;
      const yB = (i>=powerB.length-1)? powerB[powerB.length-1] : powerB[i]*(1-frac)+powerB[i+1]*frac;

      clearCanvas(ctx,w,h);
      drawAxes(ctx,w,h,xmin,xmax,ymin,ymax,"Curve di potenza teoriche: LRT (ciano) vs bilaterale (blu)");
      plotLine(ctx,w,h,xmin,xmax,ymin,ymax,mus,powerB,"#4686ff");
      plotLine(ctx,w,h,xmin,xmax,ymin,ymax,mus,powerLRT,"#66d9ef");

      // Marker
      ctx.beginPath(); ctx.arc(toX(mu), toY(yL), 6, 0, Math.PI*2); ctx.fillStyle="#66d9ef"; ctx.fill();
      ctx.beginPath(); ctx.arc(toX(mu), toY(yB), 6, 0, Math.PI*2); ctx.fillStyle="#4686ff"; ctx.fill();

      ctx.fillStyle="#9aa0a6"; ctx.font="12px ui-monospace,monospace";
      ctx.fillText(`μ=${mu.toFixed(3)}  LRT=${yL.toFixed(3)}  Bilat=${yB.toFixed(3)}`, 56, 32);

      raf2 = requestAnimationFrame(loop);
    })();
  }
  function stopAnim2(){ anim2Running=false; if(raf2) cancelAnimationFrame(raf2); }

  // ---------- Registrazione WebM ----------
  function setupRecorder(btnId, canvasId, startAnim, stopAnim){
    const btn=document.getElementById(btnId), cvs=document.getElementById(canvasId);
    let recorder=null, chunks=[], recording=false, linkEl=null;
    btn.addEventListener('click', ()=>{
      if(!recording){
        if(!('captureStream' in cvs) || !('MediaRecorder' in window)){
          alert('Registrazione non supportata su questo browser.');
          return;
        }
        const stream = cvs.captureStream(30);
        try{ recorder = new MediaRecorder(stream, {mimeType:'video/webm;codecs=vp9'}); }
        catch(e){ alert('MediaRecorder non supporta vp9: riprova con Chrome/Edge/Brave.'); return; }
        chunks=[];
        recorder.ondataavailable = e => { if(e.data&&e.data.size>0) chunks.push(e.data); };
        recorder.onstop = () => {
          const blob = new Blob(chunks, {type:'video/webm'});
          const url = URL.createObjectURL(blob);
          if (linkEl) linkEl.remove();
          linkEl = document.createElement('a');
          linkEl.href=url; linkEl.download=canvasId+'-'+Date.now()+'.webm';
          linkEl.textContent='Scarica video';
          linkEl.style.marginLeft='8px';
          btn.insertAdjacentElement('afterend', linkEl);
          setTimeout(()=>URL.revokeObjectURL(url), 60*1000);
        };
        startAnim();
        recorder.start();
        recording=true; btn.textContent='Stop';
      } else {
        recorder.stop();
        stopAnim();
        recording=false; btn.textContent='Registra WebM';
      }
    });
  }

  // ---------- Eventi UI ----------
  const debounce=(fn,ms=250)=>{ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),ms); }; };
  ['n1','alpha1','delta1','smin','smax','trials1'].forEach(id => {
    document.getElementById(id).addEventListener('input', debounce(runProblem1, 200));
    document.getElementById(id).addEventListener('change', runProblem1);
  });
  ['n2','alpha2','mu0','mu1','sigma2'].forEach(id => {
    document.getElementById(id).addEventListener('input', debounce(runProblem2, 200));
    document.getElementById(id).addEventListener('change', runProblem2);
  });

  document.getElementById('run1').addEventListener('click', runProblem1);
  document.getElementById('run2').addEventListener('click', runProblem2);
  document.getElementById('anim1').addEventListener('click', ()=>{
    if(anim1Running){ stopAnim1(); document.getElementById('anim1').textContent='Animazione'; }
    else { animateProblem1(); document.getElementById('anim1').textContent='Ferma'; }
  });
  document.getElementById('anim2').addEventListener('click', ()=>{
    if(anim2Running){ stopAnim2(); document.getElementById('anim2').textContent='Animazione'; }
    else { animateProblem2(); document.getElementById('anim2').textContent='Ferma'; }
  });

  setupRecorder('rec1','chart1',()=>{ if(!anim1Running) animateProblem1(); }, ()=> stopAnim1());
  setupRecorder('rec2','chart2',()=>{ if(!anim2Running) animateProblem2(); }, ()=> stopAnim2());

  // Iniziale
  runProblem1();
  runProblem2();
})();