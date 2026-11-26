const $=id=>document.getElementById(id);
const el=(tag,txt,cls)=>{const n=document.createElement(tag);if(txt!=null)n.textContent=txt;if(cls)n.className=cls;return n;};
const percent=new Intl.NumberFormat('zh-TW',{style:'percent',maximumFractionDigits:1});
export function workloadFor(model){
 const people=new Map((model.roster??[]).map(name=>[name,0]));
 const cards=model.cards.slice().sort((a,b)=>a.y-b.y||a.x-b.x);
 const rows=[];let unassigned=0;
 for(const card of cards)card.body.replace(/\r\n?/g,'\n').split('\n').forEach((line,i)=>{
  const task=line.trim();if(!task)return;
  const owner=card.assignees?.[i]||'';
  if(owner)people.set(owner,(people.get(owner)??0)+1);else unassigned++;
  rows.push({id:card.id,card:card.title,task,owner});
 });
 const shares=Array.from(people,([name,count])=>({name,count})).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,'zh-TW'));
 return {rows,shares,total:rows.length,unassigned,assigned:rows.length-unassigned};
}

export function mountWorkload(edit){
 const panel=$('workloadPanel'),select=$('workloadOwner'),statusNode=$('workloadStatus');
 let data,filter='all';
 const filterValue=name=>name?'person:'+name:'unassigned';
 function totals(){
  const {total,assigned,unassigned}=data;
  const cards=[['全部工作項目',total],['已分派',assigned],['未分派',unassigned]];
  $('workloadTotals').replaceChildren(...cards.map(([label,count])=>{
   const tile=el('div',null,'wl-total');tile.append(el('span',label),el('strong',String(count)+' 項'));return tile;
  }));
 }
 function shares(){
  const container=$('workloadShares'),{total,unassigned}=data;
  const entries=[...data.shares,{name:'',count:unassigned}];
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
   row.append(el('span',label,'wl-person'),track,el('strong',count+' 項 · '+(total?percent.format(ratio):'—'),'wl-count'));
   row.onclick=()=>{filter=filter===value?'all':value;select.value=filter;drawRows();markShares();};
   row.dataset.filter=value;container.append(row);
  }
 }
 function markShares(){for(const b of $('workloadShares').querySelectorAll('button'))b.setAttribute('aria-pressed',String(b.dataset.filter===filter));}
 function drawRows(){
  const rows=data.rows.filter(r=>filter==='all'||filterValue(r.owner)===filter);
  const target=$('workloadRows');target.replaceChildren();
  $('workloadCount').textContent='顯示 '+rows.length+' 項，共 '+data.total+' 項';
  if(!rows.length){const tr=el('tr'),cell=el('td',data.total?'這個篩選條件下沒有工作項目。':'還沒有工作項目。請從「自由編排」新增或編輯圖卡。','wl-muted');cell.colSpan=3;tr.append(cell);target.append(tr);return;}
  const fragment=document.createDocumentFragment();
  for(const {id,card,task,owner} of rows){
   const tr=el('tr'),source=el('td'),button=el('button',card,'wl-card-link');button.type='button';
   button.setAttribute('aria-label','編輯來源圖卡：'+card);button.onclick=()=>edit(id);source.append(button);
   tr.append(source,el('td',task),el('td',owner||'未分派',owner?'':'wl-pending'));fragment.append(tr);
  }
  target.append(fragment);
 }
 select.onchange=()=>{filter=select.value;drawRows();markShares();};
 function render(){
  if(panel.hidden||!data)return;
  const focus=document.activeElement,focusedShare=focus?.classList.contains('wl-share')?focus.dataset.filter:null;
  select.replaceChildren(new Option('所有人','all'),new Option('未分派','unassigned'),...data.shares.map(p=>new Option(p.name,filterValue(p.name))));
  if(!Array.from(select.options).some(o=>o.value===filter))filter='all';
  select.value=filter;
  totals();shares();drawRows();$('workloadContent').hidden=false;
  if(focusedShare!==null)Array.from($('workloadShares').querySelectorAll('button')).find(b=>b.dataset.filter===focusedShare)?.focus({preventScroll:true});
 }
 return {
  update(model){data=workloadFor(model);render();},
  status(message){statusNode.textContent=message;},
  show(){render();}
 };
}
