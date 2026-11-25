'use strict';
const $=id=>document.getElementById(id);
const el=(tag,txt,cls)=>{const n=document.createElement(tag);if(txt!=null)n.textContent=txt;if(cls)n.className=cls;return n;};
const KEY='adam-workflow-desk-v1';
const statuses=['待分工','待開始','進行中','待交接','已完成'];
const tones=['open','open','active','handoff','done'];
const seed=[
 ['接案與資料確認','確認需求及案件類別','列出缺件與回覆期限'],
 ['聘工與申請送件','確認申請文件與送件狀況','確認選工、面試或人選進度'],
 ['報到與後續服務','安排報到及待辦交接','追蹤續聘、轉換或結案'],
 ['收費與帳務','確認請款條件與時點','核對收款、欠費與追蹤日'],
 ['職務調整與交接','盤點現任主責、備援與接手人','確認交接完成與接手人可獨立作業']
];
const uid=()=>crypto.randomUUID?.()??Date.now().toString(36)+Math.random().toString(36).slice(2);
function initial(){
 const groups=seed.map(([name],i)=>({id:'g'+i,name}));
 const items=seed.flatMap(([, ...names],i)=>names.map((name,j)=>({id:'s'+i+j,groupId:'g'+i,name,owner:'',backup:'',handoff:'',status:'待分工',due:'',next:'',notes:''})));
 return {version:1,groups,items};
}
function checked(x){
 if(!x||x.version!==1||!Array.isArray(x.groups)||!Array.isArray(x.items)||x.groups.length>200||x.items.length>5000)throw Error('不是有效的看板備份。');
 const isText=(s,max)=>typeof s==='string'&&s.length<=max;
 const validId=s=>isText(s,90)&&/^[a-z0-9_-]+$/i.test(s);
 const used=new Set(), ids=new Set();
 const groups=x.groups.map(g=>{
  if(!g||!validId(g.id)||ids.has(g.id)||!isText(g.name,100)||!g.name.trim())throw Error('備份含無效的流程區塊。');
  ids.add(g.id);return {id:g.id,name:g.name.trim()};
 });
 const items=x.items.map(i=>{
  if(!i||!validId(i.id)||used.has(i.id)||!ids.has(i.groupId)||!isText(i.name,120)||!i.name.trim()||
  ![i.owner,i.backup,i.handoff].every(s=>isText(s,80))||!statuses.includes(i.status)||!isText(i.due,10)||
  (i.due&&!/^\d{4}-\d{2}-\d{2}$/.test(i.due))||!isText(i.next,600)||!isText(i.notes,1200))throw Error('備份含無效的工作項目。');
  used.add(i.id);const {id,groupId,name,owner,backup,handoff,status,due,next,notes}=i;
  return {id,groupId,name:name.trim(),owner,backup,handoff,status,due,next,notes};
 });
 return {version:1,groups,items};
}
let state=initial(), damaged=false, timer;
try {const raw=localStorage.getItem(KEY);if(raw)state=checked(JSON.parse(raw));}
catch {damaged=true;}
function toast(msg){clearTimeout(timer);$('toast').textContent=msg;timer=setTimeout(()=>$('toast').textContent='',5100);}
function save(next,err){
 if(damaged){err.textContent='現有資料無法讀取。請先從「備份／匯入」還原，避免覆寫原資料。';return false;}
 try{const v=checked(next);localStorage.setItem(KEY,JSON.stringify(v));state=v;render();return true;}
 catch(e){err.textContent=e.name==='Error'?e.message:'瀏覽器無法儲存。請確認允許網站儲存且空間足夠。';return false;}
}
const clone=()=>JSON.parse(JSON.stringify(state));
function localDay(){const d=new Date();return [d.getFullYear(),d.getMonth()+1,d.getDate()].map(n=>String(n).padStart(2,'0')).join('-');}
const late=i=>!!i.due&&i.status!=='已完成'&&i.due<localDay();
const needOwner=i=>!i.owner&&i.status!=='已完成';
function matches(i,v){return !v||(v==='已逾期'?late(i):v==='待分工'?i.status===v||needOwner(i):i.status===v);}
function btn(label,fn,cls,title){const n=el('button',label,cls);n.type='button';if(title){n.title=title;n.setAttribute('aria-label',title);}n.addEventListener('click',fn);return n;}

let selectedGroup=null, view='flow';
function drawFlow(){
 const flow=$('flowMap');flow.replaceChildren();flow.hidden=view!=='flow'||!state.groups.length;
 $('flowMode').setAttribute('aria-pressed',String(view==='flow'));$('listMode').setAttribute('aria-pressed',String(view==='list'));
 if(flow.hidden)return;
 state.groups.forEach((g,index)=>{
  const items=state.items.filter(i=>i.groupId===g.id);
  const handoffs=items.filter(i=>i.status==='待交接').length;
  const doneCount=items.filter(i=>i.status==='已完成').length;
  const step=el('li',null,'flow-step');
  const b=btn('',()=>{
   selectedGroup=g.id;
   $('query').value='';$('filter').value='';render();
   const section=$('group-'+g.id);
   section?.focus({preventScroll:true});
   section?.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
  },'flow-node');
  b.setAttribute('aria-controls','board');
  b.setAttribute('aria-pressed',String(g.id===selectedGroup&&!$('query').value.trim()&&!$('filter').value));
  b.append(el('span',String(index+1).padStart(2,'0'),'flow-num'),el('strong',g.name),el('span',items.length+' 項 · '+doneCount+' 完成','flow-meta'));
  if(handoffs)b.append(el('span',handoffs+' 項待交接','flow-tag'));
  step.append(b);
  if(index<state.groups.length-1){const arrow=el('span',null,'flow-arrow');arrow.setAttribute('aria-hidden','true');step.append(arrow);}
  flow.append(step);
 });
}
function render(){
 if(!state.groups.some(g=>g.id===selectedGroup))selectedGroup=state.groups[0]?.id??null;
 drawFlow();
 const filter=$('filter').value;
 const q=$('query').value.trim().toLocaleLowerCase();
 const stats=[['全部項目','',state.items.length],['待分工','待分工',state.items.filter(i=>matches(i,'待分工')).length],['待交接','待交接',state.items.filter(i=>i.status==='待交接').length],['已逾期','已逾期',state.items.filter(late).length]];
 $('stats').replaceChildren(...stats.map(([label,v,count])=>{const b=btn('',()=>{$('filter').value=v;render();$('stats').querySelector('[aria-pressed="true"]')?.focus();},'stat');b.setAttribute('aria-pressed',String(v===filter));b.append(el('b',count),el('span',label));return b;}));
 const board=$('board');board.replaceChildren();
 let groups=0;
 state.groups.forEach((g,index)=>{
  const all=state.items.filter(i=>i.groupId===g.id);
  const items=all.filter(i=>matches(i,filter)&&(!q||[g.name,i.name,i.owner,i.backup,i.handoff,i.next,i.notes].join(' ').toLocaleLowerCase().includes(q)));
  if((q||filter)&&!items.length)return;
  if(view==='flow'&&!q&&!filter&&g.id!==selectedGroup)return;
  groups++;
  const section=el('section',null,'group'), head=el('div',null,'group-head'), name=el('div');
  section.id='group-'+g.id;section.tabIndex=-1;
  name.append(el('h3',g.name),el('span',items.length+' 項工作','group-count'));
  const actions=el('div',null,'group-actions');
  actions.append(btn('↑',()=>move(g.id,-1),null,'上移：'+g.name),btn('↓',()=>move(g.id,1),null,'下移：'+g.name),btn('編輯',()=>openGroup(g),null,'編輯區塊：'+g.name),btn('＋ 項目',()=>openItem(undefined,g.id),null,'新增項目到：'+g.name));
  actions.children[0].disabled=index===0;actions.children[1].disabled=index===state.groups.length-1;
  head.append(name,actions);section.append(head);
  if(!items.length)section.append(el('p','此區塊還沒有工作項目。','empty'));
  else {
   const rows=el('ul',null,'rows');
   items.forEach(i=>{
    const row=el('li',null,'row'), a=el('div'), b=el('div'), c=el('div');
    const pill=el('span',i.status,'pill');pill.dataset.tone=tones[statuses.indexOf(i.status)];
    a.append(pill,el('h4',i.name));
    if(i.notes)a.append(el('p',i.notes));
    b.append(el('p','主責：'+(i.owner||'待確認'),i.owner?'':'warn'),el('p','備援：'+(i.backup||'未填')),el('p','接手：'+(i.handoff||'未填')));
    c.append(el('p',i.next?'下一步：'+i.next:'下一步未填','next'),el('p',i.due?'期限：'+i.due+(late(i)?'（逾期）':''):'未設定期限',late(i)?'warn':''));
    row.append(a,b,c,btn('編輯',()=>openItem(i),'edit','編輯項目：'+i.name));rows.append(row);
   });section.append(rows);
  }board.append(section);
 });
 if(!groups)board.append(el('p',state.groups.length?'沒有符合條件的工作項目。':'先新增一個流程區塊，接著把工作項目加進去。','empty'));
}
function move(id,delta){
 const v=clone(),i=v.groups.findIndex(g=>g.id===id),j=i+delta;if(i<0||j<0||j>=v.groups.length)return;
 [v.groups[i],v.groups[j]]=[v.groups[j],v.groups[i]];
 const err={};if(!save(v,err))toast(err.textContent);
}
const editor=$('editor'), form=$('form'), fields=$('fields'), editError=$('editError');
let submit;
function open(title,fn){$('editTitle').textContent=title;fields.replaceChildren();editError.textContent='';submit=fn;}
function field(label,name,val,type='text',max=120,required=false){
 const wrapper=el('label',null,'field'+(type==='textarea'||required?' wide':''));
 const inpt=el(type==='textarea'?'textarea':type==='select'?'select':'input');
 if(inpt.tagName==='INPUT')inpt.type=type;
 inpt.name=name;inpt.required=required;
 if(type==='textarea'||type==='text')inpt.maxLength=max;
 if(type!=='select')inpt.value=val??'';
 wrapper.append(el('span',label),inpt);fields.append(wrapper);return inpt;
}
function options(n,arr,val){for(const [v,t] of arr){const o=el('option',t);o.value=v;n.append(o);}n.value=val;}
function remove(label,confirmText,fn){fields.append(btn(label,()=>{if(confirm(confirmText))fn();},'wide danger'));}
function done(v,msg){if(save(v,editError)){editor.close();toast(msg);}}
function openGroup(g){
 open(g?'編輯流程區塊':'新增流程區塊',d=>{
  const name=d.get('name').trim();if(!name){editError.textContent='請輸入區塊名稱。';return;}
  if(state.groups.some(x=>x.id!==g?.id&&x.name===name)){editError.textContent='已有相同區塊名稱。';return;}
  const v=clone();if(g)v.groups.find(x=>x.id===g.id).name=name;else{const id=uid();v.groups.push({id,name});selectedGroup=id;$('query').value='';$('filter').value='';}done(v,'已儲存流程區塊');
 });
 field('區塊名稱','name',g?.name,'text',100,true);
 if(g){if(state.items.some(i=>i.groupId===g.id))fields.append(el('p','要刪除此區塊，請先移走或刪除區塊內的工作項目。','wide hint'));
  else remove('刪除此區塊','確定刪除空白區塊「'+g.name+'」？',()=>{const v=clone();v.groups=v.groups.filter(x=>x.id!==g.id);done(v,'已刪除區塊');});}
 editor.showModal();
}
function openItem(i,groupId){
 if(!state.groups.length){toast('請先新增流程區塊。');openGroup();return;}
 open(i?'編輯工作項目':'新增工作項目',d=>{
  const row=Object.fromEntries([...d].map(([k,v])=>[k,v.trim()]));
  if(!row.name){editError.textContent='請輸入工作項目名稱。';return;}
  row.id=i?.id??uid();const v=clone();if(i)v.items[v.items.findIndex(x=>x.id===i.id)]=row;else v.items.push(row);
  if(save(v,editError)){editor.close();selectedGroup=row.groupId;if(!matches(row,$('filter').value)||$('query').value){$('filter').value='';$('query').value='';}render();toast('已儲存工作項目');}
 });
 field('工作項目名稱','name',i?.name,'text',120,true);
 options(field('流程區塊','groupId','','select'),state.groups.map(g=>[g.id,g.name]),i?.groupId??groupId??selectedGroup??state.groups[0].id);
 options(field('進度','status','','select'),statuses.map(s=>[s,s]),i?.status??'待分工');
 field('目前主責','owner',i?.owner,'text',80);field('備援人或職務','backup',i?.backup,'text',80);
 field('交接對象','handoff',i?.handoff,'text',80);field('完成期限','due',i?.due,'date');
 field('下一步／要等誰','next',i?.next,'textarea',600);field('交接重點／備註','notes',i?.notes,'textarea',1200);
 if(i)remove('刪除此項目','確定刪除「'+i.name+'」？',()=>{const v=clone();v.items=v.items.filter(x=>x.id!==i.id);done(v,'已刪除工作項目');});
 editor.showModal();
}
form.addEventListener('submit',e=>{e.preventDefault();editError.textContent='';submit(new FormData(form));});
for(const n of document.querySelectorAll('[data-close]'))n.addEventListener('click',()=>n.closest('dialog').close());
$('newItem').addEventListener('click',()=>openItem());
$('newGroup').addEventListener('click',()=>openGroup());
$('flowMode').addEventListener('click',()=>{view='flow';render();});
$('listMode').addEventListener('click',()=>{view='list';render();});
$('filter').addEventListener('change',render);$('query').addEventListener('input',render);
$('backup').addEventListener('click',()=>{$('backupError').textContent=damaged?'現有資料無法讀取。可選擇匯入有效備份來還原。':'';$('backupDialog').showModal();});
$('exportBtn').addEventListener('click',()=>{
 if(damaged){$('backupError').textContent='目前資料無法讀取，請先匯入有效備份。';return;}
 const url=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));
 const a=el('a');a.href=url;a.download='行政流程備份-'+localDay()+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);toast('已匯出備份');
});
$('importBtn').addEventListener('click',()=>$('backupFile').click());
$('backupFile').addEventListener('change',async e=>{
 const f=e.target.files[0];e.target.value='';if(!f)return;
 const err=$('backupError');err.textContent='';
 try{
  if(f.size>10000000)throw Error('備份檔案太大。');
  const v=checked(JSON.parse(await f.text()));
  if(!confirm('將以 '+v.groups.length+' 個區塊、'+v.items.length+' 個工作項目取代目前瀏覽器的資料。確定匯入？'))return;
  const prev=damaged;damaged=false;
  if(save(v,err)){$('backupDialog').close();$('query').value='';$('filter').value='';render();toast('已匯入備份');}else damaged=prev;
 }catch(e){err.textContent=e instanceof SyntaxError?'這不是可讀取的 JSON 備份。':e.message;}
});
window.addEventListener('storage',e=>{if(e.key===KEY){try{state=e.newValue?checked(JSON.parse(e.newValue)):initial();damaged=false;render();}catch{damaged=true;}}});
render();if(damaged)toast('現有資料無法讀取，請匯入備份還原。');
