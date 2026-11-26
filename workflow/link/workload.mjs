import { colorStaff } from './owner-colors.mjs?v=staffColors12';
import { mountCaseReference, workKinds, assignmentsFor } from './case-reference.mjs?v=staffColors12';
const $=id=>document.getElementById(id);
const el=(tag,txt,cls)=>{const n=document.createElement(tag);if(txt!=null)n.textContent=txt;if(cls)n.className=cls;return n;};
const percent=new Intl.NumberFormat('zh-TW',{style:'percent',maximumFractionDigits:1});
export function workloadFor(model,scope='all'){
 const people=new Map((model.roster??[]).map(name=>[name,0]));
 const cards=model.cards.slice().sort((a,b)=>a.y-b.y||a.x-b.x);
 const rows=[];let unassigned=0,unassignedShare=0;
 for(const card of cards)card.body.replace(/\r\n?/g,'\n').split('\n').forEach((line,i)=>{
  const task=line.trim();if(!task)return;
  let assignments=assignmentsFor(card,i);
  if(!assignments.length)assignments=[{owner:'',kinds:[]}];
  const selected=assignments.filter(a=>scope==='all'||(scope==='none'?!a.kinds.length:a.kinds.includes(scope)));
  if(!selected.length)return;
  if(!selected.some(a=>a.owner))unassigned++;
  for(const {owner} of selected){if(owner)people.set(owner,(people.get(owner)??0)+1/selected.length);else unassignedShare+=1/selected.length;}
  rows.push({id:card.id,card:card.title,task,assignments:selected});
 });
 const shares=Array.from(people,([name,count])=>({name,count})).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,'zh-TW'));
 return {rows,shares,total:rows.length,unassigned,unassignedShare,assigned:rows.length-unassigned};
}

export function mountWorkload(edit,referenceApi){
 const caseRef=mountCaseReference(referenceApi);
 const panel=$('workloadPanel'),select=$('workloadOwner'),statusNode=$('workloadStatus');
 let model,data,filter='all';
 const kindSelect=$('workloadKind');
 kindSelect.replaceChildren(new Option('全部大類','all'),...workKinds.map(k=>new Option(k,k)),new Option('未分類','none'));
 kindSelect.onchange=()=>render();
 const filterValue=name=>name?'person:'+name:'unassigned';
 function totals(){
  const {total,assigned,unassigned}=data;
  const cards=[[kindSelect.value==='all'?'全部工作項目':kindSelect.selectedOptions[0].text+'的工作項目',total],['已分派',assigned],['未分派',unassigned]];
  $('workloadTotals').replaceChildren(...cards.map(([label,count])=>{
   const tile=el('div',null,'wl-total');tile.append(el('span',label),el('strong',String(count)+' 項'));return tile;
  }));
 }
 function shares(){
  const container=$('workloadShares'),{total,unassignedShare}=data;
  const entries=[...data.shares,{name:'',count:unassignedShare}];
  container.replaceChildren();
  if(!data.shares.length&&total>0)container.append(el('p','目前還沒有行政人員分派。可點來源圖卡指定負責人。','wl-muted'));
  if(total===0)container.append(el('p','圖卡還沒有可計算占比的工作項目。','wl-muted'));
  for(const {name,count} of entries){
   const row=el('button',null,'wl-share'+(!name?' wl-unassigned':''));row.type='button';
   const value=filterValue(name);
   row.setAttribute('aria-pressed',String(filter===value));
   const label=name||'未分派',ratio=total?count/total:0;
   const track=el('span',null,'wl-track'),fill=el('span',null,'wl-fill');
   fill.style.width=(ratio*100)+'%';track.setAttribute('aria-hidden','true');track.append(fill);
   const person=el('span',label,'wl-person');colorStaff(person,name,model.roster??[]);colorStaff(fill,name,model.roster??[]);
   row.append(person,track,el('strong',new Intl.NumberFormat('zh-TW',{maximumFractionDigits:2}).format(count)+' 項 · '+(total?percent.format(ratio):'—'),'wl-count'));
   row.onclick=()=>{filter=filter===value?'all':value;select.value=filter;drawRows();markShares();};
   row.dataset.filter=value;container.append(row);
  }
 }
 function markShares(){for(const b of $('workloadShares').querySelectorAll('button'))b.setAttribute('aria-pressed',String(b.dataset.filter===filter));}
 function drawRows(){
  const rows=data.rows.map(r=>({...r,assignments:r.assignments.filter(a=>filter==='all'||filterValue(a.owner)===filter)})).filter(r=>r.assignments.length);
  const target=$('workloadRows');target.replaceChildren();
  $('workloadCount').textContent='顯示 '+rows.length+' 項，共 '+data.total+' 項';
  if(!rows.length){const tr=el('tr'),cell=el('td',data.total?'這個篩選條件下沒有工作項目。':kindSelect.value!=='all'?'這個大類目前沒有工作項目。':'還沒有工作項目。請從「自由編排」新增或編輯圖卡。','wl-muted');cell.colSpan=4;tr.append(cell);target.append(tr);return;}
  const fragment=document.createDocumentFragment();
  for(const {id,card,task,assignments} of rows){
   assignments.forEach(({owner,kinds},i)=>{
    const tr=el('tr',null,i?'wl-assignment-follow':null);
    if(!i){
     const source=el('td'),work=el('td',task),button=el('button',card,'wl-card-link');button.type='button';
     source.rowSpan=assignments.length;work.rowSpan=assignments.length;
     button.setAttribute('aria-label','編輯來源圖卡：'+card);button.onclick=()=>edit(id);source.append(button);tr.append(source,work);
    }
    const kindsCell=el('td');
    if(kinds.length){const tags=el('div',null,'wl-kind-tags');tags.append(...kinds.map(k=>el('span',k,'wl-kind-tag')));kindsCell.append(tags);}else kindsCell.textContent='未分類';
    const ownerCell=el('td'),ownerName=el('span',owner||'未分派',owner?'wl-owner-pill':'wl-pending');colorStaff(ownerName,owner,model.roster??[]);ownerCell.append(ownerName);
    tr.append(ownerCell,kindsCell);fragment.append(tr);
   });
  }
  target.append(fragment);
 }
 select.onchange=()=>{filter=select.value;drawRows();markShares();};
 function render(){
  if(panel.hidden||!model)return;
  data={...workloadFor(model,kindSelect.value),reference:model.caseReference};
  const focus=document.activeElement,focusedShare=focus?.classList.contains('wl-share')?focus.dataset.filter:null;
  select.replaceChildren(new Option('所有人','all'),new Option('未分派','unassigned'),...data.shares.map(p=>new Option(p.name,filterValue(p.name))));
  if(!Array.from(select.options).some(o=>o.value===filter))filter='all';
  select.value=filter;
  caseRef.draw(data.reference);totals();shares();drawRows();$('workloadContent').hidden=false;
  if(focusedShare!==null)Array.from($('workloadShares').querySelectorAll('button')).find(b=>b.dataset.filter===focusedShare)?.focus({preventScroll:true});
 }
 return {
  update(next){model=next;render();},
  status(message){statusNode.textContent=message;},
  show(){render();}
 };
}
