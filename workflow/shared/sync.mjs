import { config } from './firebase-config.mjs';
const unavailable=()=>Object.assign(new Error('Unavailable'),{code:'unavailable'});
export function connect(ui){
 const api={signedIn:false,login:async()=>{},logout:async()=>{},save:async()=>{throw unavailable();}};
 if(!config){queueMicrotask(()=>ui.status('unconfigured','雲端版尚未啟用，原有看板不受影響。'));return api;}
 boot().catch(()=>ui.status('error','Google 登入元件載入失敗，請重新整理或稍後再試。'));
 return api;
 async function boot(){
  const sdk='https://www.gstatic.com/firebasejs/10.12.0/';
  const [{initializeApp},a,f]=await Promise.all([
   import(sdk+'firebase-app.js'),import(sdk+'firebase-auth.js'),import(sdk+'firebase-firestore.js')
  ]);
  const app=initializeApp(config,'admin-workflow-shared'),auth=a.getAuth(app),db=f.getFirestore(app);
  await a.setPersistence(auth,a.browserSessionPersistence).catch(()=>a.setPersistence(auth,a.inMemoryPersistence));
  const ref=f.doc(db,'boards','administration');
  let stop, generation=0;
  const permission=e=>e?.code==='permission-denied';
  api.login=async()=>{
   try{const p=new a.GoogleAuthProvider();p.setCustomParameters({prompt:'select_account'});await a.signInWithPopup(auth,p);}
   catch(e){if(e.code!=='auth/cancelled-popup-request'&&e.code!=='auth/popup-closed-by-user')ui.status('locked','登入未完成。請用 Safari 或 Chrome 開啟，並允許 Google 登入視窗。');}
  };
  api.logout=async()=>{try{await a.signOut(auth);}catch{ui.status('error','未能登出，請重新整理後再試。');}};
  const decode=s=>s.exists()?s.data():{rev:0,payload:''};
  a.onAuthStateChanged(auth,async user=>{
   const g=++generation;stop?.();stop=undefined;api.signedIn=!!user;
   if(!user){ui.status('locked','請用你的 Google 帳號登入。');return;}
   ui.status('loading','正在查驗帳號權限…');
   try {
    const first=await f.getDocFromServer(ref);if(g!==generation)return;
    ui.snapshot(decode(first));
    stop=f.onSnapshot(ref,{includeMetadataChanges:true},s=>{
     if(g===generation&&!s.metadata.fromCache&&!s.metadata.hasPendingWrites)ui.snapshot(decode(s));
    },e=>{if(g===generation)ui.status(permission(e)?'denied':'error',permission(e)?'此 Google 帳號未獲授權。':'雲端讀取失敗，請稍後重新登入。');});
   }catch(e){if(g===generation)ui.status(permission(e)?'denied':'error',permission(e)?'此 Google 帳號未獲授權。':'雲端讀取失敗，請稍後重新登入。');}
  });
  api.save=(payload,expected)=>{
   const uid=auth.currentUser?.uid,g=generation;
   if(!uid) return Promise.reject(unavailable());
   return f.runTransaction(db,async tx=>{
    const now=decode(await tx.get(ref));
    if(g!==generation||auth.currentUser?.uid!==uid)throw unavailable();
    if(now.rev!==expected)throw Object.assign(new Error('Conflict'),{code:'conflict'});
    const rev=now.rev+1;tx.set(ref,{rev,payload,updatedAt:f.serverTimestamp(),updatedBy:uid});return rev;
   });
  };
 }
}
