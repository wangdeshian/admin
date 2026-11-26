import { connect } from './sync.mjs?v=canvas1';
const $=id=>document.getElementById(id);
const E=(tag,txt,cls)=>{const n=document.createElement(tag);if(txt!=null)n.textContent=txt;if(cls)n.className=cls;return n;};
const NS='http://www.w3.org/2000/svg';
const ports={t:'上',r:'右',b:'下',l:'左'};
const cap=(n,lo,hi)=>Math.min(hi,Math.max(lo,n));
const id=()=>crypto.randomUUID();
const copy=o=>JSON.parse(JSON.stringify(o));
const workLines=body=>body.replace(/\r\n?/g,'\n').split('\n');
const validName=n=>typeof n==='string'&&n.trim()===n&&n.length>0&&n.length<=40&&!/[\r\n]/.test(n);
const facing=(a,b)=>(a==='l'&&b==='r')||(a==='r'&&b==='l')||(a==='t'&&b==='b')||(a==='b'&&b==='t');
export function snapPosition(rect,others,zoom=1){
 const {x,y,w,h}=rect,result={x,y,gx:null,gy:null};
 let bestX,bestY;
 for(const o of others){
  // Only snap to neighboring cards. Match centers rather than edges so ports line up on different-height cards.
  for(const axis of ['x','y']){
   const horizontal=axis==='x',limit=horizontal?'w':'h',parallel=horizontal?'y':'x',extent=horizontal?'h':'w';
   const separated=rect[parallel]+rect[extent]+8<=o[parallel]||o[parallel]+o[extent]+8<=rect[parallel];
   if(!separated)continue;
   const linked=horizontal?o.vertical:o.horizontal;
   const center=o[axis]+o[limit]/2,at=Math.round(center-rect[limit]/2);
   const distance=Math.abs(at-rect[axis])*zoom;
   if(at<0||at>12000||distance>(linked?22:13))continue;
   const gap=Math.max(o[parallel]-rect[parallel]-rect[extent],rect[parallel]-o[parallel]-o[extent],0);
   const score=distance-(linked?9:0)+Math.min(gap,1200)/1200;
   const best=horizontal?bestX:bestY;if(best&&best.score<=score)continue;
   const winner={score,at,center,other:o};
   if(horizontal)bestX=winner;else bestY=winner;
  }
 }
 if(bestX){result.x=bestX.at;result.gx=bestX;}
 if(bestY){result.y=bestY.at;result.gy=bestY;}
 return result;
}
export function arrowPath([x,y,dx,dy],[X,Y,dX,dY]){
 const aligned=dx&&dx===-dX&&Math.abs(Y-y)<.75&&(X-x)*dx>0
  ||dy&&dy===-dY&&Math.abs(X-x)<.75&&(Y-y)*dy>0;
 if(aligned)return `M ${x} ${y} L ${X} ${Y}`;
 const bend=cap(Math.hypot(X-x,Y-y)*.37,34,145);
 return `M ${x} ${y} C ${x+dx*bend} ${y+dy*bend}, ${X+dX*bend} ${Y+dY*bend}, ${X} ${Y}`;
}
export function canvasDocId(key){return crypto.subtle.digest('SHA-256',new TextEncoder().encode('admin-workflow-canvas-v1:'+key)).then(b=>btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''));}
export function checkedCanvas(x){
 if(!x||![1,2].includes(x.version)||!Array.isArray(x.cards)||!Array.isArray(x.links)||x.cards.length>160||x.links.length>450)throw Error('無法讀取圖卡資料。');
 const ids=new Set(),seen=new Set();
 const roster=x.roster??[];
 if(!Array.isArray(roster)||roster.length>80||!roster.every(validName)||new Set(roster).size!==roster.length)throw Error('行政名單格式不正確。');
 const people=new Set(roster);
 const cards=x.cards.map(c=>{if(!c||typeof c.id!=='string'||!/^[-a-zA-Z0-9_]{1,90}$/.test(c.id)||ids.has(c.id)||typeof c.title!=='string'||!c.title.trim()||c.title.length>120||typeof c.body!=='string'||c.body.length>1600||!['x','y'].every(k=>Number.isInteger(c[k])&&c[k]>=0&&c[k]<=12000))throw Error('圖卡資料格式不正確。');ids.add(c.id);
  const card={id:c.id,title:c.title,body:c.body,x:c.x,y:c.y};
  if(c.assignees!==undefined){
   if(!Array.isArray(c.assignees)||c.assignees.length!==workLines(c.body).length||!c.assignees.every(n=>n===''||people.has(n)))throw Error('工作項目分工格式不正確。');
   if(c.assignees.some(Boolean))card.assignees=c.assignees.slice();
  }
  return card;});
 const links=x.links.map(e=>{if(!e||!ids.has(e.from)||!ids.has(e.to)||e.from===e.to||!Object.hasOwn(ports,e.a)||!Object.hasOwn(ports,e.b))throw Error('箭頭資料格式不正確。');const k=[e.from,e.a,e.to,e.b].join('|');if(seen.has(k))throw Error('箭頭重複。');seen.add(k);return {from:e.from,a:e.a,to:e.to,b:e.b};});
 return {version:roster.length||x.version===2?2:1,cards,links,...(roster.length?{roster:roster.slice()}:{})};
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
 const rowBox=$('canvasWorkRows'),nameInput=$('canvasRosterName'),rosterStatus=$('canvasRosterStatus');
 let draftRoster=[],zoom=1,expanded=false;
 const panel=$('canvasPanel'),zOut=$('canvasZoomOut'),zIn=$('canvasZoomIn'),zReset=$('canvasZoomReset'),expand=$('canvasExpand');
 function setZoom(next){
  if(gesture)return;
  const value=cap(Math.round(next*10)/10,.6,1.8);if(value===zoom)return;
  const x=(scroll.scrollLeft+scroll.clientWidth/2)/zoom,y=(scroll.scrollTop+scroll.clientHeight/2)/zoom;
  zoom=value;surface.style.zoom=zoom;const pct=Math.round(zoom*100)+'%';
  zReset.textContent=pct;zReset.setAttribute('aria-label','回到原始大小，目前 '+pct);
  zOut.disabled=zoom<=.6;zIn.disabled=zoom>=1.8;
  scroll.scrollLeft=x*zoom-scroll.clientWidth/2;scroll.scrollTop=y*zoom-scroll.clientHeight/2;edges();
 }
 zOut.onclick=()=>setZoom(zoom-.1);zIn.onclick=()=>setZoom(zoom+.1);zReset.onclick=()=>setZoom(1);
 function setExpanded(value){
  expanded=value;panel.classList.toggle('cv-expanded',value);document.body.classList.toggle('cv-expanded-page',value);
  expand.textContent=value?'離開全畫面':'全畫面';expand.setAttribute('aria-pressed',String(value));edges();
 }
 expand.onclick=()=>setExpanded(!expanded);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&gesture){e.preventDefault();gesture=null;draw();}else if(e.key==='Escape'&&expanded&&!dialog.open){setExpanded(false);expand.focus();}});
 function labelRows(){Array.from(rowBox.children).forEach((r,i)=>{
  r.querySelector('input').setAttribute('aria-label','工作項目 '+(i+1));
  r.querySelector('select').setAttribute('aria-label','工作項目 '+(i+1)+' 的負責行政');
  r.querySelector('button').setAttribute('aria-label','移除工作項目 '+(i+1));
 });}
 function fillOwners(select,value){
  select.replaceChildren(new Option('未指定',''),...draftRoster.map(n=>new Option(n,n)));
  select.value=value;
 }
 function appendWork(value='',owner=''){
  const row=E('div',null,'cv-work-row'),input=E('input'),select=E('select');
  input.type='text';input.value=value;input.maxLength=1600;input.placeholder='輸入工作項目';
  fillOwners(select,owner);
  const remove=act('×',()=>{
   if(rowBox.children.length===1){input.value='';select.value='';input.focus();return;}
   const focus=row.nextElementSibling??row.previousElementSibling;row.remove();labelRows();focus.querySelector('input').focus();
  },'cv-work-remove');
  row.append(input,select,remove);rowBox.append(row);labelRows();return input;
 }
 function addPerson(){
  const name=nameInput.value.trim();
  if(!validName(name)){rosterStatus.textContent='請輸入暱稱或代號。';nameInput.focus();return false;}
  if(draftRoster.includes(name)){rosterStatus.textContent='這個人已在下拉選單裡。';return false;}
  if(draftRoster.length>=80){rosterStatus.textContent='行政名單最多 80 位。';return false;}
  draftRoster.push(name);nameInput.value='';
  for(const select of rowBox.querySelectorAll('select'))fillOwners(select,select.value);
  rosterStatus.textContent='已加入下拉選單。儲存圖卡後會同步。';return true;
 }
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
  $('canvasTitle').value=c?.title??'';$('canvasDelete').hidden=!c;err.textContent='';
  draftRoster=(model.roster??[]).slice();nameInput.value='';rosterStatus.textContent='';$('canvasRosterPanel').open=false;
  rowBox.replaceChildren();workLines(c?.body??'').forEach((line,i)=>appendWork(line,c?.assignees?.[i]??''));
  dialog.showModal();$('canvasTitle').focus();
 }
 form.addEventListener('submit',async ev=>{
  ev.preventDefault();const title=$('canvasTitle').value.trim();if(!title){err.textContent='請輸入圖卡標題。';return;}
  const rows=Array.from(rowBox.children,r=>({text:r.querySelector('input').value,owner:r.querySelector('select').value}));
  const body=rows.map(r=>r.text).join('\n');
  if(body.length>1600){err.textContent='工作項目合計最多 1,600 字。';return;}
  const missing=rows.findIndex(r=>!r.text.trim()&&r.owner);
  if(missing>=0){err.textContent='請填寫已指定行政的工作項目。';rowBox.children[missing].querySelector('input').focus();return;}
  if(nameInput.value.trim()){$('canvasRosterPanel').open=true;err.textContent='名單欄位還有未加入的名稱，請先按「加入名單」或清空欄位。';nameInput.focus();return;}
  const v=copy(model);v.roster=draftRoster.slice();
  const values={title,body,assignees:rows.map(r=>r.owner)};
  if(editing){const c=v.cards.find(t=>t.id===editing);if(!c){err.textContent='這張圖卡已被移除。';return;}Object.assign(c,values);}
  else{let x=scroll.scrollLeft/zoom+32,y=scroll.scrollTop/zoom+48;const isNear=()=>v.cards.some(c=>Math.abs(c.x-x)<80&&Math.abs(c.y-y)<84);for(let i=0;i<8&&isNear();i++)y+=86;v.cards.push({id:id(),...values,x:cap(Math.round(x),0,12000),y:cap(Math.round(y),0,12000)});}
  if(await save(v,openingRev)){dialog.close();}
  else err.textContent=status.textContent+' 文字仍保留在這裡。';
 });
 $('canvasAddWork').onclick=()=>appendWork().focus();
 $('canvasRosterAdd').onclick=()=>addPerson();
 nameInput.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.isComposing){e.preventDefault();addPerson();}});
 rowBox.addEventListener('keydown',e=>{
  if(e.key==='Enter'&&!e.isComposing&&e.target.tagName==='INPUT'){
   e.preventDefault();appendWork().focus();
  }
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
 const guideX=$('canvasGuideX'),guideY=$('canvasGuideY');
 function showGuides(next,w=0,h=0){
  for(const [guide,match,cross,size,offset,from,len] of [[guideX,next?.gx,'y','h',next?.y,'top','height'],[guideY,next?.gy,'x','w',next?.x,'left','width']]){
   guide.hidden=!match;if(!match)continue;
   const other=match.other,span=size==='w'?w:h,lo=Math.min(offset,other[cross]),hi=Math.max(offset+span,other[cross]+other[size]);
   guide.style[guide===guideX?'left':'top']=match.center+'px';guide.style[from]=lo+'px';guide.style[len]=(hi-lo)+'px';
  }
 }
 function startDrag(ev,c,node){
  if(ev.button!==0||gesture||!can())return;
  ev.preventDefault();const grip=ev.currentTarget;grip.setPointerCapture(ev.pointerId);
  const size=node.getBoundingClientRect(),connected=new Map();
  for(const e of model.links){
   const other=e.from===c.id?e.to:e.to===c.id?e.from:null;
   if(other&&facing(e.a,e.b)){
    const flag=connected.get(other)??{};flag[e.a==='t'||e.a==='b'?'vertical':'horizontal']=true;connected.set(other,flag);
   }
  }
  const others=model.cards.filter(other=>other.id!==c.id).flatMap(other=>{
   const n=nodes.get(other.id);if(!n)return[];
   const r=n.getBoundingClientRect();return [{x:other.x,y:other.y,w:r.width/zoom,h:r.height/zoom,...connected.get(other.id)}];
  });
  gesture={id:c.id,p:ev.pointerId,x:ev.clientX,y:ev.clientY,bx:c.x,by:c.y,rev:revision,sx:scroll.scrollLeft,sy:scroll.scrollTop,w:size.width/zoom,h:size.height/zoom,others};
  node.classList.add('cv-moving');
 }
 function drag(ev,c){
  if(gesture?.id!==c.id||gesture.p!==ev.pointerId)return;
  const g=gesture,dx=ev.clientX-g.x+scroll.scrollLeft-g.sx,dy=ev.clientY-g.y+scroll.scrollTop-g.sy;
  if(!g.moved&&Math.hypot(dx,dy)<4)return;
  g.moved=true;
  const x=cap(Math.round(g.bx+dx/zoom),0,12000),y=cap(Math.round(g.by+dy/zoom),0,12000);
  const next=ev.shiftKey?{x,y}:snapPosition({x,y,w:g.w,h:g.h},g.others,zoom);
  g.nx=next.x;g.ny=next.y;showGuides(next,g.w,g.h);position(c,g.nx,g.ny);
 }
 function endDrag(ev,c,cancel){
  if(gesture?.id!==c.id||gesture.p!==ev.pointerId)return;
  if(!cancel)drag(ev,c);
  const g=gesture;gesture=null;showGuides();nodes.get(c.id)?.classList.remove('cv-moving');
  if(cancel||g.nx==null||g.nx===c.x&&g.ny===c.y){draw();return;}
  const v=copy(model),t=v.cards.find(t=>t.id===c.id);if(!t)return draw();t.x=g.nx;t.y=g.ny;
  save(v,g.rev).then(ok=>{if(!ok)draw();});
 }
 function edges(){
  const root=surface.getBoundingClientRect();const scene=node=>{const r=node.getBoundingClientRect();return {x:(r.left-root.left)/zoom,y:(r.top-root.top)/zoom,w:r.width/zoom,h:r.height/zoom};};
  const xy=(n,p)=>{const r=scene(n);return p==='l'?[r.x,r.y+r.h/2,-1,0]:p==='r'?[r.x+r.w,r.y+r.h/2,1,0]:p==='t'?[r.x+r.w/2,r.y,0,-1]:[r.x+r.w/2,r.y+r.h,0,1];};
  $('canvasPaths').replaceChildren();
  model.links.forEach(e=>{const a=nodes.get(e.from),b=nodes.get(e.to);if(!a||!b)return;
   const p=document.createElementNS(NS,'path');p.setAttribute('d',arrowPath(xy(a,e.a),xy(b,e.b)));p.setAttribute('marker-end','url(#cvArrow)');$('canvasPaths').append(p);
  });
 }
 function draw(){
  showGuides();observer?.disconnect();cards.replaceChildren();nodes.clear();
  surface.style.width=Math.max(845,...model.cards.map(c=>c.x+305))+'px';surface.style.height=Math.max(540,...model.cards.map(c=>c.y+260))+'px';
  $('canvasCancelLink').hidden=!port;$('canvasAdd').disabled=revision===null;
  for(const c of model.cards){
   const n=E('article',null,'cv-card');n.style.left=c.x+'px';n.style.top=c.y+'px';
   const header=E('div',null,'cv-card-head'),grip=act('⠿',()=>{},'cv-grip');grip.setAttribute('aria-label','移動圖卡：'+c.title);grip.title='拖曳自動對齊。按住 Shift 可自由移動，也可用方向鍵微調';
   const edit=act('編輯',()=>open(c));edit.setAttribute('aria-label','編輯圖卡：'+c.title);
   header.append(grip,E('h3',c.title),edit);n.append(header);
   if(c.assignees?.some(Boolean)){
    const tasks=E('ul',null,'cv-card-tasks');workLines(c.body).forEach((line,i)=>{
     const item=E('li');item.append(E('span',line||' '));
     if(c.assignees[i])item.append(E('small',c.assignees[i],'cv-owner-tag'));tasks.append(item);
    });n.append(tasks);
   }else n.append(E('p',c.body||'尚未填寫內容'));
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
  try{const next=rev===0?seedCanvas(latestSeed):checkedCanvas(JSON.parse(payload));if(gesture&&rev===revision)return;if(gesture)gesture=null;model=next;revision=rev;if(port&&!model.cards.some(c=>c.id===port.id))port=null;draw();if(first){first=false;if(scroll.clientWidth<620&&model.cards.some(c=>c.x===300))scroll.scrollLeft=260;}setStatus(rev===0?'已帶入原流程。移動、編輯或連線後會儲存畫布。':'已同步');}
  catch(e){setStatus(e.message);}
 }},{derive:canvasDocId});
 return {show(){edges();},seed(v){latestSeed=v;}};
}
