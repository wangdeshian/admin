import { connect } from './sync.mjs';
const $=id=>document.getElementById(id);
const E=(tag,txt,cls)=>{const n=document.createElement(tag);if(txt!=null)n.textContent=txt;if(cls)n.className=cls;return n;};
const NS='http://www.w3.org/2000/svg';
const ports={t:'上',r:'右',b:'下',l:'左'};
const cap=(n,lo,hi)=>Math.min(hi,Math.max(lo,n));
const id=()=>crypto.randomUUID();
const copy=o=>JSON.parse(JSON.stringify(o));
export function canvasDocId(key){return crypto.subtle.digest('SHA-256',new TextEncoder().encode('admin-workflow-canvas-v1:'+key)).then(b=>btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''));}
export function checkedCanvas(x){
 if(!x||x.version!==1||!Array.isArray(x.cards)||!Array.isArray(x.links)||x.cards.length>160||x.links.length>450)throw Error('無法讀取圖卡資料。');
 const ids=new Set(),seen=new Set();
 const cards=x.cards.map(c=>{if(!c||typeof c.id!=='string'||!/^[-a-zA-Z0-9_]{1,90}$/.test(c.id)||ids.has(c.id)||typeof c.title!=='string'||!c.title.trim()||c.title.length>120||typeof c.body!=='string'||c.body.length>1600||!['x','y'].every(k=>Number.isInteger(c[k])&&c[k]>=0&&c[k]<=12000))throw Error('圖卡資料格式不正確。');ids.add(c.id);return {id:c.id,title:c.title,body:c.body,x:c.x,y:c.y};});
 const links=x.links.map(e=>{if(!e||!ids.has(e.from)||!ids.has(e.to)||e.from===e.to||!Object.hasOwn(ports,e.a)||!Object.hasOwn(ports,e.b))throw Error('箭頭資料格式不正確。');const k=[e.from,e.a,e.to,e.b].join('|');if(seen.has(k))throw Error('箭頭重複。');seen.add(k);return {from:e.from,a:e.a,to:e.to,b:e.b};});
 return {version:1,cards,links};
}
export function seedCanvas(board){
 const result={version:1,cards:[],links:[]};let main=0,side=0,y=36,ys=100,prev;
 for(const g of board.groups.slice(0,150)){
  const isSide=g.flowLane==='side';const i=isSide?++side:++main;
  const body=board.items.filter(t=>t.groupId===g.id).map(t=>t.name).join('\n').slice(0,1600);
  const c={id:g.id,title:(isSide?'':String(i).padStart(2,'0')+' ')+g.name,body,x:isSide?34:300,y:isSide?ys:y};
  result.cards.push(c);
  const gap=Math.max(185,124+Math.ceil(body.length/14)*21);
  if(isSide)ys+=gap;else{y+=gap;if(prev)result.links.push({from:prev,a:'b',to:c.id,b:'t'});prev=c.id;}
 }
 for(const c of result.cards)c.y=Math.min(12000,c.y);
 return checkedCanvas(result);
}
export function mountCanvas(seed){
 const scroll=$('canvasScroll'),surface=$('canvasSurface'),cards=$('canvasCards'),svg=$('canvasLinks'),status=$('canvasStatus'),hint=$('canvasHint'),dialog=$('canvasDialog'),form=$('canvasForm'),err=$('canvasError');
 let model={version:1,cards:[],links:[]},revision=null,busy=false,port=null,openingRev=null,editing=null,latestSeed=seed,first=true,gesture=null;
 const nodes=new Map();let observer,cloud;
 function setStatus(s){status.textContent=s;}
 const act=(label,fn,cls)=>{const b=E('button',label,cls);b.type='button';b.addEventListener('click',fn);return b;};
 function can(){if(revision===null){setStatus('尚未連線，暫時不能儲存。');return false;}if(busy){setStatus('正在儲存，請稍候。');return false;}return true;}
 async function save(next,expected=revision){
  if(!can())return false;
  if(expected!==revision){setStatus('看板剛更新，未覆蓋。請關閉後重新編輯。');return false;}
  busy=true;setStatus('正在儲存…');
  try{let v=checkedCanvas(next),p=JSON.stringify(v);if(new TextEncoder().encode(p).length>300000)throw Error('畫布已接近容量上限。');let r=await cloud.save(p,expected);
   if(r>=revision){model=v;revision=r;draw();}setStatus('已同步');return true;
  }catch(e){if(e.code==='conflict')setStatus('別人剛更新看板，這次沒有覆蓋。請再試一次。');else setStatus(e.code?'未能儲存，請檢查連線再試。':e.message);draw();return false;}
  finally{busy=false;}
 }
 function open(c){
  if(!can())return;
  editing=c?.id??null;openingRev=revision;
  $('canvasDialogTitle').textContent=c?'編輯圖卡':'新增圖卡';
  $('canvasTitle').value=c?.title??'';$('canvasBody').value=c?.body??'';$('canvasDelete').hidden=!c;err.textContent='';
  dialog.showModal();$('canvasTitle').focus();
 }
 form.addEventListener('submit',async ev=>{
  ev.preventDefault();const title=$('canvasTitle').value.trim(),body=$('canvasBody').value;if(!title){err.textContent='請輸入圖卡標題。';return;}
  const v=copy(model);
  if(editing){const c=v.cards.find(t=>t.id===editing);if(!c){err.textContent='這張圖卡已被移除。';return;}Object.assign(c,{title,body});}
  else{let x=scroll.scrollLeft+32,y=scroll.scrollTop+48;const isNear=()=>v.cards.some(c=>Math.abs(c.x-x)<80&&Math.abs(c.y-y)<84);for(let i=0;i<8&&isNear();i++)y+=86;v.cards.push({id:id(),title,body,x:cap(Math.round(x),0,12000),y:cap(Math.round(y),0,12000)});}
  if(await save(v,openingRev)){dialog.close();}
  else err.textContent=status.textContent+' 文字仍保留在這裡。';
 });
 $('canvasCancel').onclick=()=>dialog.close();
 $('canvasDelete').onclick=async()=>{
  if(!editing||!confirm('刪除這張圖卡和相連的箭頭？'))return;
  const v=copy(model);v.cards=v.cards.filter(c=>c.id!==editing);v.links=v.links.filter(e=>e.from!==editing&&e.to!==editing);if(await save(v,openingRev))dialog.close();else err.textContent=status.textContent;
 };
 $('canvasAdd').onclick=()=>open();
 $('canvasCancelLink').onclick=()=>{port=null;hint.textContent='點一張卡的圓點，再點另一張卡的圓點。';draw();};
 function linkFrom(c,p){
  if(!can())return;
  if(!port||port.id===c.id){port={id:c.id,p};hint.textContent='已選起點：'+c.title+'。再點另一張卡的圓點。';draw();return;}
  const e={from:port.id,a:port.p,to:c.id,b:p};
  port=null;hint.textContent='點一張卡的圓點，再點另一張卡的圓點。';
  if(model.links.some(l=>['from','a','to','b'].every(k=>l[k]===e[k]))){draw();return;}
  const v=copy(model);v.links.push(e);save(v);
 }
 function position(c,x,y){
  const n=nodes.get(c.id);if(!n)return;n.style.left=x+'px';n.style.top=y+'px';edges();
 }
 function startDrag(ev,c,node){
  if(ev.button!==0||!can())return;
  ev.preventDefault();const grip=ev.currentTarget;grip.setPointerCapture(ev.pointerId);
  gesture={id:c.id,p:ev.pointerId,x:ev.clientX,y:ev.clientY,bx:c.x,by:c.y,rev:revision};
  node.classList.add('cv-moving');
 }
 function drag(ev,c){
  if(gesture?.id!==c.id||gesture.p!==ev.pointerId)return;
  const g=gesture;g.nx=cap(Math.round(g.bx+ev.clientX-g.x),0,12000);g.ny=cap(Math.round(g.by+ev.clientY-g.y),0,12000);position(c,g.nx,g.ny);
 }
 function endDrag(ev,c,cancel){
  if(gesture?.id!==c.id||gesture.p!==ev.pointerId)return;
  const g=gesture;gesture=null;
  if(cancel||g.nx==null||g.nx===c.x&&g.ny===c.y){draw();return;}
  const v=copy(model),t=v.cards.find(t=>t.id===c.id);if(!t)return draw();t.x=g.nx;t.y=g.ny;
  save(v,g.rev).then(ok=>{if(!ok)draw();});
 }
 function edges(){
  const root=surface.getBoundingClientRect();const scene=node=>{const r=node.getBoundingClientRect();return {x:r.left-root.left,y:r.top-root.top,w:r.width,h:r.height};};
  const xy=(n,p)=>{const r=scene(n);return p==='l'?[r.x,r.y+r.h/2,-1,0]:p==='r'?[r.x+r.w,r.y+r.h/2,1,0]:p==='t'?[r.x+r.w/2,r.y,0,-1]:[r.x+r.w/2,r.y+r.h,0,1];};
  $('canvasPaths').replaceChildren();
  model.links.forEach(e=>{const a=nodes.get(e.from),b=nodes.get(e.to);if(!a||!b)return;
   const [x,y,dx,dy]=xy(a,e.a),[X,Y,dX,dY]=xy(b,e.b),bend=cap(Math.hypot(X-x,Y-y)*.37,34,145);
   const p=document.createElementNS(NS,'path');p.setAttribute('d',`M ${x} ${y} C ${x+dx*bend} ${y+dy*bend}, ${X+dX*bend} ${Y+dY*bend}, ${X} ${Y}`);p.setAttribute('marker-end','url(#cvArrow)');$('canvasPaths').append(p);
  });
 }
 function draw(){
  observer?.disconnect();cards.replaceChildren();nodes.clear();
  surface.style.width=Math.max(845,...model.cards.map(c=>c.x+305))+'px';surface.style.height=Math.max(540,...model.cards.map(c=>c.y+260))+'px';
  $('canvasCancelLink').hidden=!port;$('canvasAdd').disabled=revision===null;
  for(const c of model.cards){
   const n=E('article',null,'cv-card');n.style.left=c.x+'px';n.style.top=c.y+'px';
   const header=E('div',null,'cv-card-head'),grip=act('⠿',()=>{},'cv-grip');grip.setAttribute('aria-label','移動圖卡：'+c.title);grip.title='拖曳移動，也可用方向鍵';
   const edit=act('編輯',()=>open(c));edit.setAttribute('aria-label','編輯圖卡：'+c.title);
   header.append(grip,E('h3',c.title),edit);n.append(header,E('p',c.body||'尚未填寫內容'));
   grip.addEventListener('pointerdown',e=>startDrag(e,c,n));grip.addEventListener('pointermove',e=>drag(e,c));grip.addEventListener('pointerup',e=>endDrag(e,c,false));grip.addEventListener('pointercancel',e=>endDrag(e,c,true));
   grip.addEventListener('keydown',e=>{const shifts={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};if(!shifts[e.key])return;e.preventDefault();const [dx,dy]=shifts[e.key],v=copy(model),t=v.cards.find(t=>t.id===c.id);const step=e.shiftKey?60:16;t.x=cap(t.x+dx*step,0,12000);t.y=cap(t.y+dy*step,0,12000);save(v).then(()=>nodes.get(c.id)?.querySelector('.cv-grip')?.focus({preventScroll:true}));});
   for(const [k,label] of Object.entries(ports)){const b=act('',()=>linkFrom(c,k),'cv-port cv-port-'+k);b.setAttribute('aria-label',c.title+'：'+label+'方接點');b.setAttribute('aria-pressed',String(port?.id===c.id&&port.p===k));n.append(b);}
   cards.append(n);nodes.set(c.id,n);
  }
  if(!model.cards.length)cards.append(E('p','點「新增圖卡」開始。','cv-empty'));
  const selector=$('canvasEdgeList');selector.replaceChildren(new Option('選擇要移除的箭頭',''));
  model.links.forEach((e,i)=>selector.append(new Option((model.cards.find(c=>c.id===e.from)?.title||'')+' → '+(model.cards.find(c=>c.id===e.to)?.title||''),String(i))));
  $('canvasRemoveEdge').disabled=true;edges();
  if(typeof ResizeObserver!=='undefined'){observer=new ResizeObserver(edges);for(const n of nodes.values())observer.observe(n);}
 }
 $('canvasEdgeList').onchange=()=>{$('canvasRemoveEdge').disabled=$('canvasEdgeList').value==='';};
 $('canvasRemoveEdge').onclick=()=>{const ix=$('canvasEdgeList').value;if(ix==='')return;const v=copy(model);v.links.splice(Number(ix),1);save(v);};
 cloud=connect({status(_mode,message){setStatus(message);},snapshot({rev,payload}){
  if(revision!==null&&rev<revision)return;
  try{const next=rev===0?seedCanvas(latestSeed):checkedCanvas(JSON.parse(payload));if(gesture&&rev===revision)return;model=next;revision=rev;if(port&&!model.cards.some(c=>c.id===port.id))port=null;draw();if(first){first=false;if(scroll.clientWidth<620&&model.cards.some(c=>c.x===300))scroll.scrollLeft=260;}setStatus(rev===0?'已帶入原流程。移動、編輯或連線後會儲存畫布。':'已同步');}
  catch(e){setStatus(e.message);}
 }},{derive:canvasDocId});
 return {show(){edges();},seed(v){latestSeed=v;}};
}
