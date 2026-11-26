import { config } from '../shared/firebase-config.mjs';
const fail=code=>Object.assign(new Error(code),{code});
export function connect(ui,{derive}={}){
 const api={save:async()=>{throw fail('unavailable');}};
 const link=location.hash.slice(1);
 if(!/^[A-Za-z0-9_-]{43}$/.test(link)){
  queueMicrotask(()=>ui.status('denied','請使用包含 # 後方代碼的完整共用連結。'));
  return api;
 }
 boot().catch(()=>ui.status('error','無法連接共用看板，請重新開啟完整連結。'));
 return api;
 async function boot(){
  const sdk='https://www.gstatic.com/firebasejs/10.12.0/';
  const [{initializeApp},f]=await Promise.all([import(sdk+'firebase-app.js'),import(sdk+'firebase-firestore.js')]);
  const db=f.getFirestore(initializeApp(config,'admin-workflow-link')),ref=f.doc(db,'workflowLinkBoards',derive?await derive(link):link);
  const decode=s=>{if(!s.exists())throw fail('permission-denied');return s.data();};
  const status=e=>ui.status(e?.code==='permission-denied'?'denied':'error',e?.code==='permission-denied'?'無法開啟共用看板。請檢查完整連結是否仍有效。':'雲端連線失敗，請稍後再試。');
  api.save=(payload,expected)=>f.runTransaction(db,async tx=>{
   const now=decode(await tx.get(ref));
   if(now.rev!==expected)throw fail('conflict');
   const rev=now.rev+1;
   tx.set(ref,{rev,payload,updatedAt:f.serverTimestamp()});
   return rev;
  });
  try{
   const first=decode(await f.getDocFromServer(ref));
   ui.snapshot(first);
   f.onSnapshot(ref,{includeMetadataChanges:true},s=>{
    if(!s.metadata.fromCache&&!s.metadata.hasPendingWrites){
     try{ui.snapshot(decode(s));}catch(e){status(e);}
    }
   },status);
  }catch(e){status(e);}
 }
}
