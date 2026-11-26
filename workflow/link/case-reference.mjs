export const caseKinds=['入境後','續聘','廢止','承接轉換','離境返鄉','護居展延'];
export const workKinds=['基本文件',...caseKinds,'其他'];
const $=id=>document.getElementById(id);
const E=(tag,text,cls)=>{const node=document.createElement(tag);if(text!=null)node.textContent=text;if(cls)node.className=cls;return node;};
const date=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
export function checkedReference(x){
 if(!x||!date(x.from)||!date(x.to)||x.from>x.to||!Array.isArray(x.counts)||x.counts.length!==caseKinds.length||!x.counts.every(v=>Number.isSafeInteger(v)&&v>=0&&v<=1000000))throw Error('案件量資料格式不正確，請檢查日期與件數。');
 return {from:x.from,to:x.to,counts:x.counts.slice()};
}
export function mountCaseReference(api){
 const period=$('caseRefPeriod'),grid=$('caseRefCounts'),edit=$('caseRefEdit'),dialog=$('caseRefDialog'),form=$('caseRefForm'),err=$('caseRefError');
 let rev;
 const inputs=caseKinds.map(label=>{
  const wrap=E('label',null,'field'),input=E('input');
  input.type='number';input.min='0';input.max='1000000';input.step='1';input.required=true;
  wrap.append(E('span',label),input);$('caseRefInputs').append(wrap);return input;
 });
 edit.onclick=()=>{
  const current=api.read();if(!current||current.rev===null)return;
  rev=current.rev;const v=current.value;err.textContent='';
  $('caseRefFrom').value=v?.from??'';$('caseRefTo').value=v?.to??'';
  inputs.forEach((t,i)=>t.value=v?.counts?.[i]??'');dialog.showModal();
 };
 $('caseRefCancel').onclick=()=>dialog.close();
 form.onsubmit=async e=>{
  e.preventDefault();
  try{
   const v=checkedReference({from:$('caseRefFrom').value,to:$('caseRefTo').value,counts:inputs.map(t=>t.valueAsNumber)});
   if(await api.save(v,rev))dialog.close();else err.textContent='未能儲存。若看板剛被更新，請關閉後重新開啟再試。';
  }catch(e){err.textContent=e.message;}
 };
 const fmt=new Intl.NumberFormat('zh-TW');
 const tile=(label,value)=>{
  const c=E('div',null,'wl-case-tile');c.append(E('span',label),E('strong',value===null?'不統計':fmt.format(value)+' 件'));return c;
 };
 return {draw(v){
  if(!v){period.textContent='尚未加入案件量統計。';grid.replaceChildren();return;}
  period.textContent=v.from.replaceAll('-','/')+' ～ '+v.to.replaceAll('-','/')+'，以登錄日計，含已下架。';
  grid.replaceChildren(tile('六類合計',v.counts.reduce((a,b)=>a+b,0)),...workKinds.map(n=>tile(n,v.counts[caseKinds.indexOf(n)]??null)));
 }};
}
