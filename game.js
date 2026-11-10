(() => {
  const canvas = document.getElementById('scene');
  const ctx = canvas.getContext('2d');
  const $ = id => document.getElementById(id);
  const ui = {speed:$('speed'),speedBar:$('speedBar'),gear:$('gear'),rpm:$('rpmLabel'),distance:$('distance'),timer:$('timer'),heat:$('heatLabel'),stars:$('stars'),heatNote:$('heatNote'),nitro:$('nitroPct'),nitroBar:$('nitroBar'),overlay:$('overlay'),play:$('playBtn'),copy:$('menuCopy'),status:$('raceStatus'),toast:$('toast'),pause:$('pauseOverlay')};
  let W=0,H=0,DPR=1,last=0,toastTime=0;
  const keys={left:false,right:false,accelerate:false,brake:false,nitro:false};
  const state={mode:'menu',distance:0,speed:0,playerX:0,nitro:100,heat:1,damage:0,time:0,score:0,traffic:[],particles:[],shake:0,lastHit:-10};
  const viewDist=2600, cameraDepth=245, targetDistance=3200;
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const lerp=(a,b,t)=>a+(b-a)*t;
  const random=(a,b)=>a+Math.random()*(b-a);
  const pathAt=d=>150*Math.sin(d/790)+58*Math.sin(d/255)+30*Math.sin(d/1300);
  function resize(){DPR=Math.min(window.devicePixelRatio||1,2);W=innerWidth;H=innerHeight;canvas.width=Math.floor(W*DPR);canvas.height=Math.floor(H*DPR);ctx.setTransform(DPR,0,0,DPR,0,0)}
  addEventListener('resize',resize,{passive:true});resize();
  function seedTraffic(){state.traffic=[];for(let d=250;d<targetDistance+350;d+=random(105,165)){let lane=[-.7,-.24,.25,.7][Math.floor(Math.random()*4)];state.traffic.push({d,lane,type:Math.random()<.24?'sport':'sedan',color:['#d8dfdf','#9aabb4','#bb382e','#e7b44b','#4a7793'][Math.floor(Math.random()*5)],passed:false})}}
  seedTraffic();
  function roundedRect(x,y,w,h,r,fill){ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=fill;ctx.fill()}
  function drawBackground(now){
    const sky=ctx.createLinearGradient(0,0,0,H*.57);sky.addColorStop(0,'#080e19');sky.addColorStop(.58,'#172230');sky.addColorStop(1,'#563c3a');ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
    const horizon=H*.37;
    ctx.save();ctx.globalAlpha=.72;
    // distant ridge
    ctx.fillStyle='#18212b';ctx.beginPath();ctx.moveTo(0,horizon+22);for(let x=0;x<=W+40;x+=40){const y=horizon+8+Math.sin(x*.009+1)*16+Math.sin(x*.021)*8;ctx.lineTo(x,y)}ctx.lineTo(W,horizon+95);ctx.lineTo(0,horizon+95);ctx.fill();
    // layered skyline
    for(let layer=0;layer<2;layer++){const base=horizon+48+layer*18;const shift=(state.distance*(layer?.018:.008))%(W+80);ctx.fillStyle=layer?'#0c141d':'#111b27';for(let x=-80-shift;x<W+100;x+=layer?39:57){const hash=Math.abs(Math.sin((x+shift)*12.83));const bw=(layer?25:38)+hash*22,bh=24+hash*(layer?74:112);ctx.fillRect(x,base-bh,bw,bh);if(hash>.35){ctx.fillStyle=layer?'#293542':'#263341';ctx.fillRect(x+bw*.24,base-bh-4,bw*.52,5);ctx.fillStyle=layer?'#dca95e':'#d7ad67';for(let wy=base-bh+9;wy<base-4;wy+=12)for(let wx=x+5;wx<x+bw-4;wx+=9)if(Math.sin(wx*3+wy*9)>.15)ctx.fillRect(wx,wy,2,4);ctx.fillStyle=layer?'#0c141d':'#111b27'}}}
    // glow behind skyline
    const glow=ctx.createRadialGradient(W*.67,horizon+23,3,W*.67,horizon+23,W*.42);glow.addColorStop(0,'#ffb27124');glow.addColorStop(1,'#ffb27100');ctx.fillStyle=glow;ctx.fillRect(0,horizon-160,W,250);ctx.restore();
    // road-side dusk haze
    const haze=ctx.createLinearGradient(0,horizon,0,H*.8);haze.addColorStop(0,'#d58d5220');haze.addColorStop(.35,'#19232a00');haze.addColorStop(1,'#070a0e');ctx.fillStyle=haze;ctx.fillRect(0,horizon,W,H-horizon);
  }
  function projection(z){const scale=cameraDepth/(z+cameraDepth);const y=H*.37+(H*.64)*scale;const ahead=pathAt(state.distance+z)-pathAt(state.distance);const center=W*.5+(ahead*.50-state.playerX*(W*.46)*.30)*scale;return {scale,y,center,road:W*.91*scale}}
  function drawRoad(){
    const horizon=H*.37;ctx.fillStyle='#10151a';ctx.fillRect(0,horizon,W,H-horizon);
    const step=28;for(let z=viewDist;z>=0;z-=step){const far=projection(z+step),near=projection(z);const stripe=Math.floor((state.distance+z)/95)%2;
      const farHalf=far.road*.5,nearHalf=near.road*.5;
      ctx.beginPath();ctx.moveTo(far.center-farHalf*1.17,far.y);ctx.lineTo(far.center+farHalf*1.17,far.y);ctx.lineTo(near.center+nearHalf*1.17,near.y);ctx.lineTo(near.center-nearHalf*1.17,near.y);ctx.closePath();ctx.fillStyle=stripe?'#292d30':'#343638';ctx.fill();
      ctx.beginPath();ctx.moveTo(far.center-farHalf,far.y);ctx.lineTo(far.center+farHalf,far.y);ctx.lineTo(near.center+nearHalf,near.y);ctx.lineTo(near.center-nearHalf,near.y);ctx.closePath();ctx.fillStyle=stripe?'#25282b':'#292c2f';ctx.fill();
      // lane dashes and reflective shoulder stripes
      for(let lane=-1;lane<=1;lane++){if(lane===0||Math.floor((state.distance+z)/62)%2===0){const fx=far.center+lane*farHalf/3,nx=near.center+lane*nearHalf/3;ctx.strokeStyle=lane===0?'#d5d0b544':'#e6e9dc42';ctx.lineWidth=Math.max(.5,near.scale*3);ctx.beginPath();ctx.moveTo(fx,far.y);ctx.lineTo(nx,near.y);ctx.stroke()}}
      const edge= ((Math.floor((state.distance+z)/48)%2)===0)?'#e5e3d7':'#d45445';ctx.strokeStyle=edge;ctx.lineWidth=Math.max(1,near.scale*10);ctx.beginPath();ctx.moveTo(far.center-farHalf,far.y);ctx.lineTo(near.center-nearHalf,near.y);ctx.moveTo(far.center+farHalf,far.y);ctx.lineTo(near.center+nearHalf,near.y);ctx.stroke();
    }
    // roadside reflectors and lamps
    for(let z=0;z<viewDist;z+=160){const p=projection(z);if(p.scale<.08)continue;const side=p.road*.59;for(const sign of [-1,1]){const x=p.center+side*sign,y=p.y;ctx.fillStyle='#d5d9d4';ctx.fillRect(x-1.2*p.scale,y-11*p.scale,2.4*p.scale,12*p.scale);ctx.fillStyle='#f0c974';ctx.shadowColor='#f3c26b';ctx.shadowBlur=10*p.scale;ctx.beginPath();ctx.arc(x,y-12*p.scale,2.5*p.scale,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0}}
  }
  function drawCar(x,y,scale,color,type='sedan',player=false,angle=0){
    const w=(type==='sport'?80:72)*scale,h=(type==='sport'?112:101)*scale;if(w<2||h<3)return;ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.scale(scale,scale);
    // ground shadow
    ctx.fillStyle='#0009';ctx.beginPath();ctx.ellipse(0,-5,45,17,0,0,Math.PI*2);ctx.fill();
    // tires
    ctx.fillStyle='#080b0f';for(const s of [-1,1]){roundedRect(s*31-6,-37,12,30,3,'#090d11');roundedRect(s*31-6,-88,12,25,3,'#090d11')}
    // body silhouette
    ctx.beginPath();ctx.moveTo(-34,-8);ctx.lineTo(-39,-28);ctx.lineTo(-33,-56);ctx.lineTo(-24,-88);ctx.quadraticCurveTo(-20,-103,0,-103);ctx.quadraticCurveTo(20,-103,24,-88);ctx.lineTo(34,-56);ctx.lineTo(39,-28);ctx.lineTo(34,-8);ctx.closePath();
    const body=ctx.createLinearGradient(-40,0,40,0);body.addColorStop(0,'#161b20');body.addColorStop(.2,color);body.addColorStop(.52,player?'#454e52':'#b4bec0');body.addColorStop(.78,color);body.addColorStop(1,'#10151a');ctx.fillStyle=body;ctx.fill();ctx.strokeStyle=player?'#d8ff3e':'#e8e8df77';ctx.lineWidth=player?1.5:.7;ctx.stroke();
    // hood details and glass
    ctx.beginPath();ctx.moveTo(-24,-61);ctx.lineTo(-19,-84);ctx.quadraticCurveTo(0,-94,19,-84);ctx.lineTo(24,-61);ctx.closePath();ctx.fillStyle='#17222a';ctx.fill();ctx.strokeStyle='#dce6e733';ctx.stroke();
    ctx.beginPath();ctx.moveTo(-22,-58);ctx.lineTo(22,-58);ctx.lineTo(28,-31);ctx.lineTo(-28,-31);ctx.closePath();ctx.fillStyle='#202e36';ctx.fill();
    // bonnet and center stripe
    ctx.fillStyle='#ffffff12';ctx.beginPath();ctx.moveTo(-25,-27);ctx.lineTo(25,-27);ctx.lineTo(29,-10);ctx.lineTo(-29,-10);ctx.fill();
    if(player){ctx.fillStyle='#d8ff3e';ctx.fillRect(-2,-24,4,14);ctx.fillStyle='#d8ff3e';ctx.fillRect(-35,-62,5,3);ctx.fillRect(30,-62,5,3)}
    // rear lights
    ctx.shadowColor=player?'#ff3e35':'#ff2525';ctx.shadowBlur=12;ctx.fillStyle='#ff493d';ctx.fillRect(-31,-14,12,4);ctx.fillRect(19,-14,12,4);ctx.shadowBlur=0;
    ctx.restore();
  }
  function drawBuildings(){
    const first=Math.floor(state.distance/175)*175;for(let abs=first-175;abs<state.distance+viewDist;abs+=175){const z=abs-state.distance;if(z<80||z>viewDist)continue;const p=projection(z);const seed=Math.abs(Math.sin(abs*1.1));for(const side of [-1,1]){const height=(100+seed*270)*p.scale,width=(70+Math.sin(abs*2.7)*25+35)*p.scale,x=p.center+side*(p.road*.59+width*.48+18*p.scale),y=p.y;
      if(width<2)continue;ctx.fillStyle=seed>.6?'#18212a':'#202830';ctx.fillRect(x-width/2,y-height,width,height);ctx.fillStyle='#34414a';ctx.fillRect(x-width/2,y-height,width,Math.max(1,3*p.scale));
      const rows=Math.floor(height/(11*p.scale||1));ctx.fillStyle=seed>.4?'#dfa865':'#a9c5cf';for(let r=1;r<rows;r++){for(let c=0;c<3;c++){if(Math.sin(abs*4+r*11+c*8)>-.2)ctx.fillRect(x-width/2+width*(.18+c*.29),y-height+r*11*p.scale,Math.max(1,2.5*p.scale),Math.max(1,4*p.scale))}}
      if(seed>.77&&p.scale>.16){ctx.save();ctx.globalAlpha=Math.min(1,p.scale*2);ctx.fillStyle='#11191d';ctx.fillRect(x-width*.46,y-height*.76,width*.92,14*p.scale);ctx.fillStyle='#d8ff3e';ctx.font=`${Math.max(5,9*p.scale)}px monospace`;ctx.textAlign='center';ctx.fillText('BAY CITY',x,y-height*.76+10*p.scale);ctx.restore()}
    }}
  }
  function drawTraffic(){
    const cars=state.traffic.filter(c=>c.d-state.distance>-12&&c.d-state.distance<viewDist).sort((a,b)=>b.d-a.d);
    for(const car of cars){const z=car.d-state.distance;if(z<0)continue;const p=projection(z);const x=p.center+car.lane*p.road*.35;drawCar(x,p.y,p.scale,car.color,car.type,false,Math.sin(car.d)*.015)}
    // headlights of pursuing units in the mirror/deep background
    if(state.heat>=2&&state.mode==='playing'){const pulse=(Math.sin(performance.now()*.012)+1)*.5;ctx.save();ctx.globalAlpha=.35+pulse*.45;for(const s of [-1,1]){const x=W*.5+s*18,y=H*.71;ctx.shadowColor=s===-1?'#48aaff':'#ff3048';ctx.shadowBlur=18;ctx.fillStyle=s===-1?'#6acbff':'#ff4555';ctx.beginPath();ctx.arc(x,y,3+pulse*2,0,Math.PI*2);ctx.fill()}ctx.restore()}
  }
  function drawPlayer(){
    const x=W*.5+state.playerX*W*.10,y=H*.91,scale=clamp(Math.min(W/1000,H/700),.72,1.18);if(state.speed>130){ctx.save();ctx.globalAlpha=clamp((state.speed-130)/320,.04,.22);for(let i=0;i<8;i++){const dx=(i-3.5)*W*.08;ctx.strokeStyle=i%2?'#e7e4d866':'#d8ff3e55';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x+dx,y-32);ctx.lineTo(x+dx*1.7,y-190-random(0,30));ctx.stroke()}ctx.restore()}
    // nitro plume
    if(keys.nitro&&state.nitro>0&&state.mode==='playing'){ctx.save();ctx.globalAlpha=.8;ctx.shadowColor='#49dfff';ctx.shadowBlur=20;ctx.fillStyle='#69eaff';ctx.beginPath();ctx.moveTo(x-15*scale,y-8);ctx.lineTo(x,y+random(25,48)*scale);ctx.lineTo(x+15*scale,y-8);ctx.fill();ctx.restore()}
    drawCar(x,y,scale,'#c7d4d7','sport',true,clamp((keys.right?1:0)-(keys.left?1:0),-1,1)*-.035);
  }
  function drawEffects(dt){for(let i=state.particles.length-1;i>=0;i--){const p=state.particles[i];p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=220*dt;if(p.life<=0){state.particles.splice(i,1);continue}ctx.globalAlpha=clamp(p.life,0,1);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,3,3)}ctx.globalAlpha=1}
  function render(now,dt){
    if(!W||!H)return;ctx.save();if(state.shake>0){const s=state.shake*7;ctx.translate(random(-s,s),random(-s,s));state.shake=Math.max(0,state.shake-dt*1.8)}
    drawBackground(now);drawRoad();drawBuildings();drawTraffic();drawPlayer();drawEffects(dt);
    if(keys.nitro&&state.nitro>0&&state.mode==='playing'){ctx.fillStyle='#40ceff0c';ctx.fillRect(0,0,W,H)}ctx.restore();
  }
  function updateHud(){const speed=Math.round(state.speed);ui.speed.textContent=String(speed).padStart(3,'0');ui.speedBar.style.width=`${clamp(speed/320*100,0,100)}%`;ui.gear.textContent=String(clamp(Math.floor(speed/65)+1,1,6));const bars=clamp(Math.round(speed/60),0,5);ui.rpm.textContent='●'.repeat(bars)+'○'.repeat(5-bars);ui.distance.innerHTML=`${(state.distance/1000).toFixed(1)} <small>KM</small>`;const m=Math.floor(state.time/60),s=Math.floor(state.time%60);ui.timer.textContent=`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;ui.heat.textContent=state.heat;ui.stars.innerHTML='★'.repeat(state.heat)+'<i>'+'★'.repeat(5-state.heat)+'</i>';ui.heatNote.textContent=state.heat>=4?'UNITS CLOSING':state.heat>=2?'PURSUIT ACTIVE':'KEEP IT CLEAN';ui.nitro.textContent=`${Math.round(state.nitro)}%`;ui.nitroBar.style.width=`${state.nitro}%`}
  function announce(text){ui.toast.textContent=text;ui.toast.classList.add('show');toastTime=1.35}
  function crash(car){if(state.time-state.lastHit<1.6)return;state.lastHit=state.time;state.damage++;state.speed=Math.max(40,state.speed*.42);state.playerX=clamp(state.playerX+(state.playerX<car.lane?-.3:.3),-1.25,1.25);state.shake=.8;for(let i=0;i<20;i++)state.particles.push({x:W*.5+random(-25,25),y:H*.8+random(-20,10),vx:random(-160,160),vy:random(-170,20),life:random(.2,.8),color:i%2?'#ffb23e':'#e9f2f2'});announce('CONTACT — KEEP MOVING');car.d=state.distance+random(100,190);car.lane=[-.7,-.24,.25,.7][Math.floor(Math.random()*4)];if(state.damage>=4)finish(false)}
  function finish(win){state.mode='finish';keys.nitro=false;ui.status.textContent=win?'FINISHED':'WRECKED';ui.copy.innerHTML=win?`You outran the night.<br><b style="color:#d8ff3e">${(state.distance/1000).toFixed(1)} KM</b> of open road. One more run?`:`The city got its story tonight.<br>Three hits, one last ride. Run it back?`;ui.play.innerHTML=(win?'RUN IT BACK':'TRY AGAIN')+' <span>↗</span>';ui.overlay.classList.remove('hidden')}
  function update(dt){if(state.mode==='playing'){
      state.time+=dt;const accelerating=keys.accelerate||!keys.brake;if(accelerating)state.speed=Math.min(300,state.speed+95*dt);else if(keys.brake)state.speed=Math.max(0,state.speed-210*dt);else state.speed=Math.max(0,state.speed-15*dt);
      if(keys.nitro&&state.nitro>0&&state.speed>35){state.nitro=Math.max(0,state.nitro-30*dt);state.speed=Math.min(350,state.speed+150*dt)}else state.nitro=Math.min(100,state.nitro+3.1*dt);
      const steer=(keys.right?1:0)-(keys.left?1:0);state.playerX=clamp(state.playerX+steer*dt*(1.15+state.speed/160),-1.16,1.16);if(Math.abs(state.playerX)>1){state.speed=Math.max(30,state.speed-90*dt);if(Math.random()<dt*1.5)announce('OFF THE ROAD')}
      state.distance+=state.speed/3.6*dt;state.score+=state.speed/3.6*dt;
      const nextHeat=clamp(1+Math.floor(state.distance/690),1,5);if(nextHeat>state.heat){state.heat=nextHeat;announce(nextHeat>=4?'PURSUIT HEATING UP':'POLICE ON YOUR TAIL')}
      for(const car of state.traffic){const rel=car.d-state.distance;if(Math.abs(rel)<16&&Math.abs(car.lane-state.playerX)<.34)crash(car);if(rel< -25&&!car.passed){car.passed=true;if(Math.abs(car.lane-state.playerX)<.55){state.score+=350;announce('CLOSE CALL +350')}}}
      if(state.distance>=targetDistance)finish(true);if(state.heat>=5&&state.speed<35&&state.time>22)finish(false);
    }
    if(toastTime>0){toastTime-=dt;if(toastTime<=0)ui.toast.classList.remove('show')}updateHud();
  }
  function frame(now){const dt=Math.min(.04,(now-last)/1000||0);last=now;update(dt);render(now,dt);requestAnimationFrame(frame)}requestAnimationFrame(frame);
  function reset(){Object.assign(state,{mode:'playing',distance:0,speed:70,playerX:0,nitro:100,heat:1,damage:0,time:0,score:0,particles:[],shake:0,lastHit:-10});keys.left=keys.right=keys.brake=keys.nitro=false;keys.accelerate=false;seedTraffic();ui.status.textContent='IN PROGRESS';ui.overlay.classList.add('hidden');ui.pause.classList.add('hidden');announce('NIGHT RUN — GO!')}
  ui.play.addEventListener('click',()=>reset());$('pauseBtn').addEventListener('click',()=>{if(state.mode==='playing'){state.mode='paused';ui.pause.classList.remove('hidden')}else if(state.mode==='paused'){state.mode='playing';ui.pause.classList.add('hidden')}});$('resumeBtn').addEventListener('click',()=>{state.mode='playing';ui.pause.classList.add('hidden')});
  function setKey(code,on){if(code==='ArrowLeft'||code==='KeyA')keys.left=on;else if(code==='ArrowRight'||code==='KeyD')keys.right=on;else if(code==='ArrowUp'||code==='KeyW')keys.accelerate=on;else if(code==='ArrowDown'||code==='KeyS')keys.brake=on;else if(code==='Space'||code==='ShiftLeft'||code==='ShiftRight')keys.nitro=on}
  addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space'].includes(e.code))e.preventDefault();if(e.code==='Escape'&&state.mode==='playing'){$('pauseBtn').click();return}setKey(e.code,true)});addEventListener('keyup',e=>setKey(e.code,false));addEventListener('blur',()=>{for(const k in keys)keys[k]=false});
  document.querySelectorAll('[data-control]').forEach(button=>{const control=button.dataset.control;const down=e=>{e.preventDefault();keys[control]=true;button.classList.add('active')};const up=e=>{e.preventDefault();keys[control]=false;button.classList.remove('active')};button.addEventListener('pointerdown',down);button.addEventListener('pointerup',up);button.addEventListener('pointercancel',up);button.addEventListener('lostpointercapture',up);button.addEventListener('contextmenu',e=>e.preventDefault())});
})();
