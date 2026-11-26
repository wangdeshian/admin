import { connect } from './sync.mjs?v=canvas1';
import { mountCanvas } from './canvas.mjs?v=dragScroll10';
import { mountWorkload } from './workload.mjs?v=kindTabs9';
const $=id=>document.getElementById(id);
const statuses=['待分工','待開始','進行中','待交接','已完成'];
const seed=[
 ['接案與資料確認','確認需求及案件類別','列出缺件與回覆期限'],
 ['文件準備與送件','確認申請文件與送件狀況','追蹤待補文件與回覆'],
 ['後續追蹤','安排待辦交接','確認回覆與結案進度'],
 ['收費與帳務','確認請款條件與時點','核對收款、欠費與追蹤日'],
 ['職務調整與交接','盤點現任主責、備援與接手人','確認交接完成與接手人可獨立作業']
];
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
  ids.add(g.id);return {id:g.id,name:g.name.trim(),flowLane:g.flowLane==='side'||g.flowLane==='main'?g.flowLane:(g.id==='g4'?'side':'main')};
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

let view='canvas',canvas,revision=null;
const workload=mountWorkload(id=>canvas?.edit(id),{read:()=>canvas?.reference(),save:(value,rev)=>canvas?.saveReference(value,rev)});
function renderView(){
 const showing=view==='canvas';
 $('canvasMode').setAttribute('aria-pressed',String(showing));
 $('listMode').setAttribute('aria-pressed',String(!showing));
 $('canvasPanel').hidden=!showing;$('workloadPanel').hidden=showing;
 if(showing)canvas?.show();else workload.show();
}
$('canvasMode').onclick=()=>{view='canvas';renderView();};
$('listMode').onclick=()=>{view='list';renderView();};
connect({
 status(mode,message){
  $('cloudStatus').textContent=message;
  if(mode!=='ready'&&!canvas)$('boardMain').hidden=true;
 },
 snapshot({rev,payload}){
  if(revision!==null&&rev<revision)return;
  try{
   const source=rev===0?initial():checked(JSON.parse(payload));revision=rev;
   $('boardMain').hidden=false;
   $('cloudStatus').textContent='已連線。共用網址可查看和修改最新圖卡。';
   if(canvas)canvas.seed(source);else canvas=mountCanvas(source,{onChange:workload.update,onStatus:workload.status});
   renderView();
  }catch{$('cloudStatus').textContent='無法讀取共用看板，未更動任何資料。';}
 }
});
