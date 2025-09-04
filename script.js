// Dantzig Demo — nessuna dipendenza esterna. Solo Canvas + Monte Carlo.

  // ---- Funzioni teoriche per Normale standard ----
  function phi(z){ return Math.exp(-0.5*z*z)/Math.sqrt(2*Math.PI); }
  function Phi(z){ // CDF (erf-based)
    return 0.5*(1 + Math.erf(z/Math.SQRT2));
  }
  // Inversa CDF (quantile) — Acklam
  function PhiInv(p){
    // https://web.archive.org/web/20150910044734/http://home.online.no/~pjacklam/notes/invnorm/
    if (p <= 0 || p >= 1) {
      if (p === 0) return -Infinity;
      if (p === 1) return  Infinity;
      throw new Error("p out of (0,1): "+p);
    }
    const a1=-39.6968302866538,a2=220.946098424521,a3=-275.928510446969,
          a4=138.357751867269,a5=-30.6647980661472,a6=2.50662827745924;
    const b1=-54.4760987982241,b2=161.585836858041,b3=-155.698979859887,
          b4=66.8013118877197,b5=-13.2806815528857;
    const c1=-0.00778489400243029,c2=-0.322396458041136,c3=-2.40075827716184,
          c4=-2.54973253934373,c5=4.37466414146497,c6=2.93816398269878;
    const d1=0.00778469570904146,d2=0.32246712907004,d3=2.445134137143,d4=3.75440866190742;
    const plow=0.02425, phigh=1-plow;
    let q,r;
    if(p<plow){
      q=Math.sqrt(-2*Math.log(p));
      return (((((c1*q+c2)*q+c3)*q+c4)*q+c5)*q+c6)/((((d1*q+d2)*q+d3)*q+d4)*q+1);
    }
    if(phigh<p){
      q=Math.sqrt(-2*Math.log(1-p));
      return -(((((c1*q+c2)*q+c3)*q+c4)*q+c5)*q+c6)/((((d1*q+d2)*q+d3)*q+d4)*q+1);
    }
    q=p-0.5; r=q*q;
    return (((((a1*r+a2)*r+a3)*r+a4)*r+a5)*r+a6)*q / (((((b1*r+b2)*r+b3)*r+b4)*r+b5)*r+1);
  }

(() => {
  'use strict';

  // RNG semplice (Mulberry32) per risultati riproducibili lato client
  function mulberry32(a) {
    return function() {
      let t = a += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
  }
  let rand = mulberry32(123456);

  function randn() {
    // Box-Muller
    let u = 0, v = 0;
    while (u===0) u = rand();
    while (v===0) v = rand();
    return Math.sqrt(-2.0*Math.log(u)) * Math.cos(2*Math.PI*v);
  }

  function sampleNormal(mu, sigma) {
    return mu + sigma * randn();
  }

  function mean(arr) {
    let s = 0; for (let x of arr) s += x; return s/arr.length;
  }
  function std(arr) {
    const m = mean(arr);
    let s2 = 0;
    for (let x of arr) s2 += (x-m)*(x-m);
    return Math.sqrt(s2/(arr.length-1));
  }
  function quantile(sortedArr, q) {
    const n = sortedArr.length;
    const pos = (n - 1) * q;
    const base = Math.floor(pos);
    const rest = pos - base;
    if (sortedArr[base+1] !== undefined) {
      return sortedArr[base] + rest * (sortedArr[base+1] - sortedArr[base]);
    } else {
      return sortedArr[base];
    }
  }

  // ------- Chart utils (Canvas) -------
  function clearCanvas(ctx, w, h) {
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle = "#0d0f14";
    ctx.fillRect(0,0,w,h);
  }
  function drawAxes(ctx, w, h, xmin, xmax, ymin, ymax, title) {
    ctx.strokeStyle = "#2a2d35";
    ctx.lineWidth = 1;
    ctx.strokeRect(48, 16, w-64, h-64);
    ctx.fillStyle = "#9aa0a6";
    ctx.font = "12px ui-monospace, monospace";
    ctx.fillText(title, 56, 14);
    // ticks x
    for (let i=0; i<=5; i++){
      const x = 48 + (w-64)*i/5;
      ctx.fillRect(x, h-48, 1, 6);
      const xv = (xmin + (xmax-xmin)*i/5).toFixed(2);
      ctx.fillText(xv, x-10, h-28);
    }
    // ticks y
    for (let j=0; j<=5; j++){
      const y = 16 + (h-64)*(1 - j/5);
      ctx.fillRect(42, y, 6, 1);
      const yv = (ymin + (ymax-ymin)*j/5).toFixed(2);
      ctx.fillText(yv, 8, y+4);
    }
  }
  function plotLine(ctx, w, h, xmin, xmax, ymin, ymax, xs, ys) {
    const toX = v => 48 + (w-64)*(v - xmin)/(xmax - xmin);
    const toY = v => 16 + (h-64)*(1 - (v - ymin)/(ymax - ymin));
    ctx.beginPath();
    for (let i=0;i<xs.length;i++){
      const x = toX(xs[i]);
      const y = toY(ys[i]);
      if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    }
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#66d9ef";
    ctx.stroke();
  }

  // ------- Problema 1: potenza vs sigma -------
  function runProblem1() {
    const n = parseInt(document.getElementById('n1').value,10);
    const alpha = parseFloat(document.getElementById('alpha1').value);
    const delta = parseFloat(document.getElementById('delta1').value);
    const smin = parseFloat(document.getElementById('smin').value);
    const smax = parseFloat(document.getElementById('smax').value);
    const trials = parseInt(document.getElementById('trials1').value,10);

    // Calibrazione t-crit sotto H0 (sigma arbitrario -> prendiamo 1)
    const t0 = [];
    for (let k=0;k<trials;k++){
      const x = Array.from({length:n}, _=> sampleNormal(0,1));
      const m = mean(x), s = std(x);
      const t = Math.sqrt(n)*(m-0)/s;
      t0.push(t);
    }
    t0.sort((a,b)=>a-b);
    const tcrit = quantile(t0, 1 - alpha);

    // sweep su sigma
    const K = 9;
    const sigmas = Array.from({length:K}, (_,i)=> smin + i*(smax-smin)/(K-1));
    const powers = [];
    for (let sigma of sigmas){
      let count=0;
      for (let k=0;k<trials;k++){
        const x = Array.from({length:n}, _=> sampleNormal(delta, sigma));
        const m = mean(x), s = std(x);
        const t = Math.sqrt(n)*(m-0)/s;
        if (t > tcrit) count++;
      }
      powers.push(count/trials);
    }

    const ctx = document.getElementById('chart1').getContext('2d');
    const w = ctx.canvas.width, h = ctx.canvas.height;
    clearCanvas(ctx, w, h);
    const ymin = 0, ymax = 1;
    drawAxes(ctx, w, h, sigmas[0], sigmas[sigmas.length-1], ymin, ymax, "Potenza (test t, una coda) al variare di σ");
    plotLine(ctx, w, h, sigmas[0], sigmas[sigmas.length-1], ymin, ymax, sigmas, powers);

    document.getElementById('res1').textContent =
      "t_crit ≈ " + tcrit.toFixed(3) + " | punti: " + sigmas.map((s,i)=>`σ=${s.toFixed(2)}→P=${powers[i].toFixed(3)}`).join("  ");
  }

  // ------- Problema 2: Neyman–Pearson (LRT vs bilaterale) -------
  
  function runProblem2() {
    const n = parseInt(document.getElementById('n2').value,10);
    const alpha = parseFloat(document.getElementById('alpha2').value);
    const mu0 = parseFloat(document.getElementById('mu0').value);
    const mu1 = parseFloat(document.getElementById('mu1').value);
    const sigma = parseFloat(document.getElementById('sigma2').value);

    // Teoria: mean ~ N(mu, s^2) con s = sigma/sqrt(n)
    const s = sigma/Math.sqrt(n);
    const zA = PhiInv(1 - alpha);       // una coda
    const cA = mu0 + zA*s;              // soglia LRT: P0(mean>cA) = alpha
    const zB = PhiInv(1 - alpha/2);     // due code (bilaterale)
    const cB = zB*s;                    // |mean - mu0| > cB

    // griglia di mu tra mu0 e mu1 (o mu1->mu0 se mu1<mu0)
    const K = 200;
    const mus = Array.from({length:K}, (_,i)=> mu0 + (mu1-mu0)*i/(K-1));

    // curve di potenza teorica
    const powerLRT = mus.map(m => 1 - Phi((cA - m)/s));
    const powerB   = mus.map(m => (1 - Phi((mu0 + cB - m)/s)) + Phi((mu0 - cB - m)/s));

    // disegno
    const ctx = document.getElementById('chart2').getContext('2d');
    const w = ctx.canvas.width, h = ctx.canvas.height;
    clearCanvas(ctx, w, h);

    const xmin = Math.min(mus[0], mus[mus.length-1]);
    const xmax = Math.max(mus[0], mus[mus.length-1]);
    const ymin = 0, ymax = 1;
    drawAxes(ctx, w, h, xmin, xmax, ymin, ymax, "Curve di potenza teoriche: LRT (ciano) vs bilaterale (blu)");

    // linee
    plotLine(ctx, w, h, xmin, xmax, ymin, ymax, mus, powerB);   // blu default first
    // LRT in ciano (sovrascrive)
    ctx.strokeStyle = "#66d9ef"; ctx.lineWidth=2;
    (function(){
      const toX = v => 48 + (w-64)*(v - xmin)/(xmax - xmin);
      const toY = v => 16 + (h-64)*(1 - (v - ymin)/(ymax - ymin));
      ctx.beginPath();
      for (let i=0;i<mus.length;i++){
        const x = toX(mus[i]); const y = toY(powerLRT[i]);
        if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
      }
      ctx.stroke();
    })();

    // Mostra soglie come riferimento verticale su mu0 e mu1
    ctx.setLineDash([6,4]); ctx.strokeStyle="#ffcc66";
    const toX = v => 48 + (w-64)*(v - xmin)/(xmax - xmin);
    ctx.beginPath(); ctx.moveTo(toX(mu0),16); ctx.lineTo(toX(mu0),h-48); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(toX(mu1),16); ctx.lineTo(toX(mu1),h-48); ctx.stroke();
    ctx.setLineDash([]);

    document.getElementById('res2').textContent =
      `LRT: cA=${cA.toFixed(3)} | Bilaterale: cB=${cB.toFixed(3)} | s=${s.toFixed(4)}`;

    // Prepara dati per animazione del marker
    window.__p2_data = { mus, powerLRT, powerB, xmin, xmax, ymin, ymax };
    window.__p2_frame = 0;
  }

    means0.sort((a,b)=>a-b);
    const cA = quantile(means0, 1 - alpha);
    const abs0 = means0.map(x=>Math.abs(x-mu0)).sort((a,b)=>a-b);
    const cB = quantile(abs0, 1 - alpha);

    let countA=0, countB=0;
    const means1 = [];
    for (let k=0;k<trials;k++){
      const x = Array.from({length:n}, _=> sampleNormal(mu1, sigma));
      const m = mean(x);
      means1.push(m);
      if (m > cA) countA++;
      if (Math.abs(m-mu0) > cB) countB++;
    }
    const powerA = countA/trials;
    const powerB = countB/trials;

    // Visualizza le due distribuzioni means0 e means1
    const ctx = document.getElementById('chart2').getContext('2d');
    const w = ctx.canvas.width, h = ctx.canvas.height;
    clearCanvas(ctx, w, h);
    const all = means0.concat(means1);
    const xmin = Math.min(...all), xmax = Math.max(...all);
    const bins = 40;
    const hx0 = new Array(bins).fill(0), hx1 = new Array(bins).fill(0);
    for (let v of means0){
      const b = Math.min(bins-1, Math.floor((v-xmin)/(xmax-xmin+1e-9)*bins));
      hx0[b]++;
    }
    for (let v of means1){
      const b = Math.min(bins-1, Math.floor((v-xmin)/(xmax-xmin+1e-9)*bins));
      hx1[b]++;
    }
    const ymax = Math.max(...hx0, ...hx1) * 1.1;
    drawAxes(ctx, w, h, xmin, xmax, 0, ymax, "Distribuzione media campionaria: H0 (blu) vs H1 (ciano)");

    function toX(v){return 48 + (w-64)*(v - xmin)/(xmax - xmin)}
    function toY(v){return 16 + (h-64)*(1 - (v)/(ymax))}
    const bw = (w-64)/bins;
    // H0 (linea)
    ctx.beginPath(); ctx.strokeStyle="#4686ff"; ctx.lineWidth=2;
    for(let i=0;i<bins;i++){
      const x = 48 + i*bw + bw/2;
      const y = toY(hx0[i]);
      if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    }
    ctx.stroke();
    // H1 (linea)
    ctx.beginPath(); ctx.strokeStyle="#66d9ef"; ctx.lineWidth=2;
    for(let i=0;i<bins;i++){
      const x = 48 + i*bw + bw/2;
      const y = toY(hx1[i]);
      if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    }
    ctx.stroke();

    // Soglie
    ctx.strokeStyle="#ffcc66"; ctx.setLineDash([6,4]);
    const xCA = toX(cA); ctx.beginPath(); ctx.moveTo(xCA,16); ctx.lineTo(xCA,h-48); ctx.stroke();
    const xCB1 = toX(mu0 + cB); ctx.beginPath(); ctx.moveTo(xCB1,16); ctx.lineTo(xCB1,h-48); ctx.stroke();
    const xCB2 = toX(mu0 - cB); ctx.beginPath(); ctx.moveTo(xCB2,16); ctx.lineTo(xCB2,h-48); ctx.stroke();
    ctx.setLineDash([]);

    document.getElementById('res2').textContent =
      `LRT: potenza ≈ ${powerA.toFixed(3)} (soglia cA=${cA.toFixed(3)}) — ` +
      `Bilaterale: potenza ≈ ${powerB.toFixed(3)} (|mean-mu0|>cB, cB=${cB.toFixed(3)})`;
  }

  document.getElementById('run1').addEventListener('click', runProblem1);
  document.getElementById('run2').addEventListener('click', runProblem2);

  // Auto-ricalcolo: quando cambiano i campi, ricalcola dopo 250ms (debounce)
  const debounce = (fn, ms=250) => { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); } };
  const auto1 = debounce(runProblem1, 250);
  const auto2 = debounce(runProblem2, 250);
  ['n1','alpha1','delta1','smin','smax','trials1'].forEach(id => {
    document.getElementById(id).addEventListener('input', auto1);
    document.getElementById(id).addEventListener('change', auto1);
  });
  ['n2','alpha2','mu0','mu1','sigma2','trials2'].forEach(id => {
    document.getElementById(id).addEventListener('input', auto2);
    document.getElementById(id).addEventListener('change', auto2);
  });

  // Tasto Invio attiva il pulsante più vicino
  document.addEventListener('keydown', (e)=>{
    if(e.key === 'Enter'){
      if(document.activeElement && document.activeElement.closest('section')?.querySelector('#run1')===document.activeElement.closest('section')?.querySelector('#run1')){
        runProblem1();
      } else if(document.activeElement && document.activeElement.closest('section')?.querySelector('#run2')===document.activeElement.closest('section')?.querySelector('#run2')){
        runProblem2();
      }
    }
  });


  // ------- Animazioni & Registrazione Video -------
  let raf1 = null, raf2 = null;
  let anim1Running = false, anim2Running = false;

  function animateProblem1() {
    if (anim1Running) return; anim1Running = true;
    const ctx = document.getElementById('chart1').getContext('2d');
    const w = ctx.canvas.width, h = ctx.canvas.height;

    const n = parseInt(document.getElementById('n1').value,10);
    const alpha = parseFloat(document.getElementById('alpha1').value);
    const delta = parseFloat(document.getElementById('delta1').value);
    const smin = parseFloat(document.getElementById('smin').value);
    const smax = parseFloat(document.getElementById('smax').value);
    const trials = Math.max(5000, (parseInt(document.getElementById('trials1').value,10) / 3 | 0));

    // Precalibra tcrit
    const t0 = [];
    for (let k=0;k<trials;k++){
      const x = Array.from({length:n}, _=> sampleNormal(0,1));
      const m = mean(x), s = std(x);
      t0.push(Math.sqrt(n)*(m)/s);
    }
    t0.sort((a,b)=>a-b);
    const tcrit = quantile(t0, 1 - alpha);

    const steps = 300; // ~10s a 30fps, più fluido // ~4s a 30fps
    let frame = 0;
    (function loop(){
      if (!anim1Running) {raf1=null; return;}
      frame++;
      const t = frame/steps;
      const sigma = smin + (smax - smin) * (0.5 - 0.5*Math.cos(Math.PI*2*t)); // ping-pong
      // stima potenza al volo
      let count=0;
      for (let k=0;k<trials;k++){
        const x = Array.from({length:n}, _=> sampleNormal(delta, sigma));
        const m = mean(x), s = std(x);
        const tv = Math.sqrt(n)*m/s;
        if (tv>tcrit) count++;
      }
      const power = count/trials;

      clearCanvas(ctx, w, h);
      drawAxes(ctx, w, h, smin, smax, 0, 1, "Potenza istantanea mentre σ oscilla");
      // marker su sigma, potenza
      const toX = v => 48 + (w-64)*(v - smin)/(smax - smin);
      const toY = v => 16 + (h-64)*(1 - v);
      ctx.beginPath();
      ctx.arc(toX(sigma), toY(power), 5, 0, Math.PI*2);
      ctx.fillStyle = "#66d9ef";
      ctx.fill();
      ctx.fillStyle = "#9aa0a6";
      ctx.font = "12px ui-monospace,monospace";
      ctx.fillText(`σ=${sigma.toFixed(2)}  Potenza≈${power.toFixed(3)}  tcrit≈${tcrit.toFixed(3)}`, 56, 32);

      raf1 = requestAnimationFrame(loop);
    })();
  }
  function stopAnim1(){ anim1Running=false; if(raf1) cancelAnimationFrame(raf1); }

  

  function animateProblem2() {
    if (anim2Running) return; anim2Running = true;
    if (!window.__p2_data) runProblem2();

    const { mus, powerLRT, powerB, xmin, xmax, ymin, ymax } = window.__p2_data;
    const ctx = document.getElementById('chart2').getContext('2d');
    const w = ctx.canvas.width, h = ctx.canvas.height;
    const steps = 300; // ~10s a 30fps
    let frame = 0;

    (function loop(){
      if (!anim2Running) {raf2=null; return;}
      frame++;
      const t = (frame % steps) / (steps-1); // 0..1
      const idx = Math.floor(t*(mus.length-1));
      const mu = mus[idx];
      const yL = powerLRT[idx];
      const yB = powerB[idx];

      // Ridisegna statico
      clearCanvas(ctx, w, h);
      drawAxes(ctx, w, h, xmin, xmax, ymin, ymax, "Curve di potenza teoriche: LRT (ciano) vs bilaterale (blu)");

      // curve
      plotLine(ctx, w, h, xmin, xmax, ymin, ymax, mus, powerB); // blu
      ctx.strokeStyle = "#66d9ef"; ctx.lineWidth=2;
      (function(){
        const toX = v => 48 + (w-64)*(v - xmin)/(xmax - xmin);
        const toY = v => 16 + (h-64)*(1 - (v - ymin)/(ymax - ymin));
        ctx.beginPath();
        for (let i=0;i<mus.length;i++){
          const x = toX(mus[i]); const y = toY(powerLRT[i]);
          if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
        }
        ctx.stroke();
        // marker su entrambe le curve
        ctx.fillStyle = "#66d9ef"; ctx.beginPath(); ctx.arc(toX(mu), toY(yL), 5, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = "#4686ff"; ctx.beginPath(); ctx.arc(toX(mu), toY(yB), 5, 0, Math.PI*2); ctx.fill();
        // testo
        ctx.fillStyle = "#9aa0a6"; ctx.font = "12px ui-monospace,monospace";
        ctx.fillText(`μ=${mu.toFixed(3)}  LRT=${yL.toFixed(3)}  Bilat=${yB.toFixed(3)}`, 56, 32);
      })();

      raf2 = requestAnimationFrame(loop);
    })();
  }
  function stopAnim2(){ anim2Running=false; if(raf2) cancelAnimationFrame(raf2); }


  // Toggle animazione
  document.getElementById('anim1').addEventListener('click', () => {
    if (anim1Running){ stopAnim1(); document.getElementById('anim1').textContent='Animazione'; }
    else { animateProblem1(); document.getElementById('anim1').textContent='Ferma'; }
  });
  document.getElementById('anim2').addEventListener('click', () => {
    if (anim2Running){ stopAnim2(); document.getElementById('anim2').textContent='Animazione'; }
    else { animateProblem2(); document.getElementById('anim2').textContent='Ferma'; }
  });

  // Registrazione WebM per ciascun canvas
  function setupRecorder(buttonId, canvasId, animStart, animStop) {
    const btn = document.getElementById(buttonId);
    let recorder = null;
    let chunks = [];
    let recording = false;
    btn.addEventListener('click', async () => {
      if (!recording) {
        // start
        try {
          const stream = document.getElementById(canvasId).captureStream(30);
          const opts = { mimeType: 'video/webm;codecs=vp9' };
          recorder = new MediaRecorder(stream, opts);
        } catch (e) {
          alert('Registrazione non supportata su questo browser.');
          return;
        }
        chunks = [];
        recorder.ondataavailable = e => { if (e.data && e.data.size>0) chunks.push(e.data); };
        recorder.onstop = () => {
          const blob = new Blob(chunks, {type: 'video/webm'});
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = canvasId + '-' + Date.now() + '.webm';
          a.textContent = 'Scarica video';
          a.style.marginLeft = '8px';
          btn.insertAdjacentElement('afterend', a);
          setTimeout(()=>URL.revokeObjectURL(url), 60*1000);
        };
        // accendi animazione se non attiva
        animStart();
        recorder.start();
        recording = true;
        btn.textContent = 'Stop';
      } else {
        // stop
        recorder.stop();
        animStop();
        recording = false;
        btn.textContent = 'Registra WebM';
      }
    });
  }

  setupRecorder('rec1', 'chart1', () => { if(!anim1Running) animateProblem1(); }, () => stopAnim1());
  setupRecorder('rec2', 'chart2', () => { if(!anim2Running) animateProblem2(); }, () => stopAnim2());


  // esecuzione iniziale per mostrare qualcosa subito
  runProblem1();
  runProblem2();
})();
