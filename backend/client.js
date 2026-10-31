import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const URL = 'https://svqaunlehadayyyctvuo.supabase.co';
const PUBLISHABLE_KEY = 'sb_publishable_bmN4o7CWUi8OqQ8_jqLaig_DSYcorRO';
const status = document.getElementById('onlineStatus');
const authForm = document.getElementById('onlineAuthForm');
const signedIn = document.getElementById('onlineSignedIn');
const leaderboard = document.getElementById('onlineLeaderboard');
const cloudStatus=document.getElementById('cloudSyncStatus');
const shared = document.getElementById('onlineSharedBoss');
const text = (el, value) => { if (el) el.textContent = value; };
let client;
let packBusy=false;
window.cardexServerGameReady=false;
window.cardexServerError='Server connection not initialized';
async function syncServerGame(){
  const {data:wallet,error}=await client.rpc('cardex_get_wallet');
  if(error){window.cardexServerGameReady=false;window.cardexServerError='Wallet request: '+error.message;text(cloudStatus,'Server game unavailable: '+error.message);console.error('CARDEX wallet RPC',error);return}
  const {data:cards,error:cardError}=await client.from('global_card_serials').select('id,car_id,finish,issued_at').order('id',{ascending:true}).limit(10000);
  if(cardError){window.cardexServerGameReady=false;window.cardexServerError='Card inventory: '+cardError.message;text(cloudStatus,'Card inventory unavailable: '+cardError.message);console.error('CARDEX cards',cardError);return}
  window.cardexServerError='';
  window.cardexServerGameReady=true;
  window.cardexApplyServerCards?.(cards,wallet);
  text(cloudStatus,'Account collection and server-issued cards synchronized.');
  const {error:bossError}=await client.rpc('cardex_publish_boss');
  if(bossError)console.warn('CARDEX boss publish',bossError);
  try{await loadPublic()}catch(e){console.warn('CARDEX public data',e)}
}
window.cardexOpenServerPack=async(theme,quantity=1,instant=false)=>{
  if(packBusy)return;
  packBusy=true;
  const draws=[];
  try{
    for(let i=0;i<quantity;i++){
      const {data,error}=await client.rpc('cardex_open_pack',{p_theme:theme});
      if(error)throw error;
      draws.push(...data.cards);
    }
    const {data:wallet,error:walletError}=await client.rpc('cardex_get_wallet');
    if(walletError)throw walletError;
    const {data:cards,error:cardError}=await client.from('global_card_serials').select('id,car_id,finish,issued_at').order('id',{ascending:true}).limit(10000);
    if(cardError)throw cardError;
    window.cardexApplyServerCards?.(cards,wallet,draws,instant);
    text(cloudStatus,'Cards issued and saved online.');
  }catch(e){
    text(cloudStatus,'Pack request failed: '+e.message+'. Refresh to reconcile issued cards.');
    await syncServerGame();
  }finally{packBusy=false}
};

let activeUser=null, pending=null, saving=false, revision=0, savedRevision=0;
window.cardexCloudReady=false;
const cacheKey=id=>'cardex-account-cache-'+id;
async function loadCloud(id){
  window.cardexCloudReady=false;
  activeUser=id;
  text(cloudStatus,'Loading account collection…');
  const {data,error}=await client.from('player_saves').select('state').eq('user_id',id).maybeSingle();
  if(error){
    text(status,'Cloud save unavailable: '+error.message+'. Apply backend/cloud-saves.sql in Supabase.');
    text(cloudStatus,'Cloud save unavailable; gameplay locked to prevent data loss.');
    document.getElementById('accountGate').style.display='flex';
    return;
  }
  let remote=data?.state;
  if(!remote){
    remote={packs:10,last:Date.now(),owned:[],favorites:[],opened:0,credits:0,xp:0,pity:0,achievements:[],lastDuel:''};
    const {error:createError}=await client.from('player_saves').insert({user_id:id,state:remote});
    if(createError){text(status,'Unable to initialize account: '+createError.message);return}
  }
  localStorage.setItem(cacheKey(id),JSON.stringify(remote));
  window.cardexLoadCloudState?.(remote);
  window.cardexCloudReady=true;
  document.getElementById('accountGate').style.display='none';
  text(cloudStatus,'Collection loaded from your account.');
  await syncServerGame();
}
window.cardexCloudSave=(state)=>{
  if(!window.cardexCloudReady||!activeUser)return;
  pending=JSON.stringify(state);revision++;
  localStorage.setItem(cacheKey(activeUser),pending);
  clearTimeout(window.cardexCloudTimer);
  window.cardexCloudTimer=setTimeout(flushCloud,500);
};
async function flushCloud(){
  if(saving||!pending||!activeUser)return;
  saving=true;
  const snapshot=pending, rev=revision, id=activeUser;
  text(cloudStatus,'Saving collection…');
  const {error}=await client.from('player_saves').update({state:JSON.parse(snapshot),updated_at:new Date().toISOString()}).eq('user_id',id);
  saving=false;
  if(error){text(cloudStatus,'Cloud save failed: '+error.message+'. Changes remain in browser cache.');return}
  savedRevision=rev;
  if(revision===rev){pending=null;text(cloudStatus,'Collection saved online.')}
  else setTimeout(flushCloud,0);
}
window.cardexUpdateName=async(name)=>{
  if(!activeUser)return;
  const {error}=await client.from('profiles').update({display_name:name}).eq('id',activeUser);
  if(error)text(status,'Public display name update failed: '+error.message);
};
const dateUTC = () => new Date().toISOString().slice(0,10);
const escapeHTML = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function loadPublic() {
  const today = dateUTC();
  const {data:boss,error:bossError} = await client.from('daily_bosses').select('car_id').eq('challenge_date',today).maybeSingle();
  if (bossError) text(shared,'Shared boss unavailable: '+bossError.message);
  else if (boss && Number.isInteger(boss.car_id)) {
    window.cardexSharedBoss = {date:today,id:boss.car_id};
    text(shared,'Online boss active for '+today+' (UTC).');
    window.cardexRefreshShowdown?.();
  } else text(shared,'No server-published boss yet. The UTC daily boss is consistent for all browsers; verified rankings remain unavailable until server services are deployed.');
  const {data:results,error} = await client.from('showdown_results').select('user_id,best_score,updated_at,first_cleared_at').eq('challenge_date',today).limit(500);
  if(error){text(leaderboard,'Leaderboard unavailable: '+error.message);return}
  if(!results?.length){text(leaderboard,'No verified online results yet. Local Showdown results are not uploaded.');return}
  results.sort((a,b)=>{
    const aClear=a.best_score===100&&a.first_cleared_at;
    const bClear=b.best_score===100&&b.first_cleared_at;
    if(!!aClear!==!!bClear)return aClear?-1:1;
    if(aClear&&bClear)return Date.parse(a.first_cleared_at)-Date.parse(b.first_cleared_at);
    return Number(b.best_score)-Number(a.best_score)||Date.parse(a.updated_at)-Date.parse(b.updated_at);
  });
  const top=results.slice(0,25);
  const ids=[...new Set(top.map(x=>x.user_id))];
  const {data:profiles}=await client.from('profiles').select('id,display_name').in('id',ids);
  const names=new Map((profiles||[]).map(p=>[p.id,p.display_name]));
  leaderboard.innerHTML='<ol>'+top.map(r=>'<li>'+escapeHTML(names.get(r.user_id)||'Collector')+' — '+Number(r.best_score)+'%'+(r.first_cleared_at?' · cleared '+new Date(r.first_cleared_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',timeZone:'UTC'})+' UTC':'')+'</li>').join('')+'</ol>';
}
async function refreshSession(){
  const {data:{user}}=await client.auth.getUser();
  authForm.hidden=!!user;
  signedIn.hidden=!user;
  if(!user){window.cardexCloudReady=false;window.cardexServerGameReady=false;document.getElementById('accountGate').style.display='none';window.cardexShowAuth?.();text(status,'Sign in or create an account to play.');return}
  text(status,'Signed in as '+user.email+'. Your collection is linked to this account.');
  const {data:profile}=await client.from('profiles').select('display_name').eq('id',user.id).maybeSingle();
  if(profile?.display_name && window.cardexCloudReady){const input=document.getElementById('profileNameInput');if(input)input.value=profile.display_name;}
  if(activeUser!==user.id)await loadCloud(user.id);
  else if(window.cardexCloudReady)document.getElementById('accountGate').style.display='none';
  if(window.cardexCloudReady && document.getElementById('auth')?.classList.contains('active'))window.cardexShowGame?.();

}
try {
  client=createClient(URL,PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  window.cardexSupabase=client;
  text(status,'Connecting to online services…');
  window.cardexOnlineRefresh=async()=>{if(window.cardexCloudReady)await syncServerGame();else await loadPublic()};
  window.cardexOnlineSession=()=>refreshSession().catch(console.error);
  await refreshSession();
  try{await loadPublic()}catch(e){console.warn('CARDEX leaderboard',e)}
  client.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_OUT'){activeUser=null;pending=null;window.cardexCloudReady=false;window.cardexServerGameReady=false;window.cardexLoadCloudState?.({});}setTimeout(()=>refreshSession().catch(console.error),0)});
  document.getElementById('onlineLogin').addEventListener('click',async()=>{
    const email=document.getElementById('onlineEmail').value.trim();
    const password=document.getElementById('onlinePassword').value;
    if(!email||!password){text(status,'Enter your email and password.');return}
    text(status,'Signing in…');
    const {error}=await client.auth.signInWithPassword({email,password});
    if(error)text(status,error.message);else await refreshSession();
  });
  document.getElementById('onlineSignup').addEventListener('click',async()=>{
    const email=document.getElementById('onlineEmail').value.trim();
    const password=document.getElementById('onlinePassword').value;
    if(!email||password.length<8){text(status,'Enter an email and a password of at least 8 characters.');return}
    text(status,'Creating account…');
    const {data,error}=await client.auth.signUp({email,password,options:{emailRedirectTo:'https://kevin-oulai.github.io/cardex/'}});
    if(error)text(status,error.message);else text(status,data.session?'Account created and signed in.':'Check your email to confirm your account, then sign in.');
  });
  document.getElementById('onlineLogout').addEventListener('click',async()=>{await flushCloud();await client.auth.signOut();await refreshSession()});
  document.getElementById('onlineRefresh').addEventListener('click',async()=>{await loadPublic();await refreshSession()});
} catch(e) {
  window.cardexShowAuth?.();
  text(status,'Online services unavailable: '+(e?.message||'Unknown error'));
  const gate=document.getElementById('accountGate');if(gate)gate.style.display='flex';
  text(document.getElementById('gateStatus'),'Unable to connect. Try reloading.');
  console.error('CARDEX online initialization failed',e);
}
