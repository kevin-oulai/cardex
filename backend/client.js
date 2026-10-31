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
let showdownBusy=false;
window.cardexSubmitShowdown=async(carId)=>{
  if(showdownBusy)return;
  showdownBusy=true;
  try{
    const {data:owned,error:ownError}=await client.from('global_card_serials').select('id').eq('car_id',carId).order('id',{ascending:true}).limit(1);
    if(ownError)throw ownError;
    if(!owned?.length)throw new Error('You must own a server-issued copy of this car');
    const {data,error}=await client.rpc('cardex_submit_showdown',{p_serial_id:owned[0].id});
    if(error)throw error;
    window.cardexSetShowdownResult?.(data);
    if(data.wallet)await syncServerGame();
    else await loadPublic();
  }catch(e){window.cardexNotify?.('Showdown unavailable: '+e.message)}
  finally{showdownBusy=false}
};
window.cardexServerGameReady=false;
window.cardexServerError='Server connection not initialized';
async function syncTitles(){
 if(!activeUser)return;
 const {data,error}=await client.rpc('cardex_titles',{p_user_id:activeUser});
 if(error){console.warn('CARDEX titles unavailable',error);return}
 window.cardexSetTitles?.(data);
}
window.cardexEquipTitle=async(id)=>{
 const {data,error}=await client.rpc('cardex_equip_title',{p_title:id});
 if(error)throw error;
 window.cardexSetTitles?.(data);
 return data;
};
async function syncServerGame(){
  const {data:wallet,error}=await client.rpc('cardex_get_wallet');
  if(error){window.cardexServerGameReady=false;window.cardexServerError='Wallet request: '+error.message;text(cloudStatus,'Server game unavailable: '+error.message);console.error('CARDEX wallet RPC',error);return}
  const {data:cards,error:cardError}=await client.from('global_card_serials').select('id,car_id,finish,issued_at,model_serial').order('id',{ascending:true}).limit(10000);
  if(cardError){window.cardexServerGameReady=false;window.cardexServerError='Card inventory: '+cardError.message;text(cloudStatus,'Card inventory unavailable: '+cardError.message);console.error('CARDEX cards',cardError);return}
  window.cardexServerError='';
  window.cardexServerGameReady=true;
  window.cardexApplyServerCards?.(cards,wallet);
  text(cloudStatus,'Account collection and server-issued cards synchronized.');
  const {error:bossError}=await client.rpc('cardex_publish_boss');
  if(bossError)console.warn('CARDEX boss publish',bossError);
  try{await loadPublic()}catch(e){console.warn('CARDEX public data',e)}
  await syncShowdownStatus();
  await syncAchievementClaims();
  await syncTitles();
}
async function syncShowdownStatus(){
  const {data,error}=await client.rpc('cardex_get_showdown_status');
  if(error){console.warn('Showdown status not available',error);return}
  window.cardexSetShowdownStatus?.(data);
}
let economyBusy=false;
async function syncAchievementClaims(){
  const {data,error}=await client.rpc('cardex_get_achievement_claims');
  if(error){console.warn('Achievement claims unavailable',error);return}
  window.cardexSetAchievementClaims?.(data||[]);
}
async function economyAction(fn,args,success){
  if(economyBusy)return;
  economyBusy=true;
  try{
    const {data,error}=await client.rpc(fn,args||{});
    if(error)throw error;
    await syncServerGame();
    success(data);
  }catch(e){window.cardexNotify?.('Action failed: '+e.message)}
  finally{economyBusy=false}
}
window.cardexBuyServerTickets=(quantity=1)=>economyAction('cardex_buy_tickets',{p_quantity:quantity},data=>window.cardexNotify?.('Purchased '+data.quantity+' ticket'+(data.quantity===1?'':'s')+' · −'+Number(data.cost).toLocaleString()+' credits'));
window.cardexBuyServerTicket=()=>window.cardexBuyServerTickets(1);
window.cardexRecycleServerDuplicates=(carId=null,finish=null)=>economyAction('cardex_recycle_duplicates',{p_car_id:carId,p_finish:finish},data=>window.cardexNotify?.(data.count?('Recycled '+data.count+' cards · +'+data.credits+' credits'):'No eligible duplicates (Showdown entries are protected)'));
window.cardexClaimServerAchievement=id=>economyAction('cardex_claim_achievement',{p_id:id},async data=>{await syncAchievementClaims();window.cardexNotify?.('Achievement claimed · +'+data.credits+' credits')});
function showBoosterError(message){
 const el=document.getElementById('boosterError');
 if(el){el.textContent=message;el.hidden=!message}
 if(message)window.cardexNotify?.(message);
}
window.cardexOpenServerPack=async(theme,quantity=1,instant=false)=>{
  showBoosterError('');
  if(packBusy){showBoosterError('A booster request is already processing. Please wait.');return}
  packBusy=true;
  const draws=[];
  const prior=new Set((window.cardexOwnedModelIds?.()||[]).map(Number));
  try{
    const {data:opened,error:openError}=await client.rpc('cardex_open_packs',{p_theme:theme,p_quantity:quantity});
    if(openError)throw openError;
    draws.push(...opened.cards);
    const {data:wallet,error:walletError}=await client.rpc('cardex_get_wallet');
    if(walletError)throw walletError;
    const {data:cards,error:cardError}=await client.from('global_card_serials').select('id,car_id,finish,issued_at,model_serial').order('id',{ascending:true}).limit(10000);
    if(cardError)throw cardError;
    // A model is NEW only if it was absent before this opening (including bulk packs).
    const seen=new Set(prior);
    const labeled=draws.map(d=>{const isNew=!seen.has(Number(d.id));seen.add(Number(d.id));return {...d,isNew}});
    if(typeof window.cardexApplyServerCards!=='function')throw new Error('Card reveal component not ready');
    window.cardexApplyServerCards(cards,wallet,labeled,instant);
    text(cloudStatus,'Cards issued and saved online.');
  }catch(e){
    const message='Booster failed: '+(e?.message||String(e))+'. Your collection will be refreshed.';
    console.error('CARDEX booster opening',e);
    text(cloudStatus,message);
    showBoosterError(message);
    try{await syncServerGame()}catch(syncError){console.error('CARDEX booster reconciliation',syncError);window.cardexNotify?.('Collection refresh failed. Please reload before opening another booster.')}
  }finally{packBusy=false}
};

let activeUser=null, pending=null, saving=false, revision=0, savedRevision=0, serverSaveRevision=0, saveConflict=false;
window.cardexCloudReady=false;
const cacheKey=id=>'cardex-account-cache-'+id;
async function loadCloud(id){
  window.cardexCloudReady=false;
  activeUser=id;
  text(cloudStatus,'Loading account collection…');
  const {data,error}=await client.from('player_saves').select('state,revision').eq('user_id',id).maybeSingle();
  if(error){
    text(status,'Cloud save unavailable: '+error.message+'. Apply backend/cloud-saves.sql in Supabase.');
    text(cloudStatus,'Cloud save unavailable; gameplay locked to prevent data loss.');
    document.getElementById('accountGate').style.display='flex';
    return;
  }
  let remote=data?.state;
  serverSaveRevision=Number(data?.revision||0);
  saveConflict=false;pending=null;revision=0;savedRevision=0;document.getElementById('cloudConflictActions')?.setAttribute('hidden','');
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
// Resolve a stale save by loading the authoritative server state. A copy of local edits
// remains in the account-scoped browser cache; we never auto-upload stale economy fields.
window.cardexResolveSaveConflict=async()=>{
 if(!activeUser||!saveConflict)return;
 const id=activeUser;
 const cached=localStorage.getItem(cacheKey(id));
 if(cached)try{localStorage.setItem(cacheKey(id)+'-conflict-backup',cached)}catch{}
 text(cloudStatus,'Reloading the latest account save…');
 await loadCloud(id);
 if(!window.cardexCloudReady)throw new Error('Could not reload server preferences');
 text(cloudStatus,'Latest server save loaded. A backup of your previous local edits remains on this device.');
 window.cardexNotify?.('Server preferences loaded. Previous local edits backed up on this device.');
};
window.cardexCloudSave=(state)=>{
  if(!window.cardexCloudReady||!activeUser||saveConflict)return;
  pending=JSON.stringify(state);revision++;
  localStorage.setItem(cacheKey(activeUser),pending);
  clearTimeout(window.cardexCloudTimer);
  window.cardexCloudTimer=setTimeout(flushCloud,500);
};
async function flushCloud(){
  if(saving||!pending||!activeUser||saveConflict)return;
  saving=true;
  const snapshot=pending, rev=revision, id=activeUser;
  text(cloudStatus,'Saving collection…');
  const {data,error}=await client.rpc('cardex_save_preferences',{p_state:JSON.parse(snapshot),p_expected_revision:serverSaveRevision});
  saving=false;
  if(activeUser!==id)return;
  if(error){
    if(error.message?.includes('SAVE_CONFLICT')){
      saveConflict=true;
      text(cloudStatus,'Cloud save conflict: another device changed your preferences. Choose Reload server preferences below; local edits will be backed up on this device.');document.getElementById('cloudConflictActions')?.removeAttribute('hidden');
      window.cardexNotify?.('Cloud save conflict — reload to see latest account preferences');
    }else text(cloudStatus,'Cloud save failed: '+error.message+'. Changes remain in browser cache.');
    return;
  }
  serverSaveRevision=Number(data.revision);
  savedRevision=rev;
  if(revision===rev){pending=null;text(cloudStatus,'Collection saved online.')}
  else setTimeout(flushCloud,0);
}
window.cardexDeleteAccount=async(password,confirmation)=>{
 if(!activeUser||!window.cardexCloudReady)throw new Error('Sign in first');
 if(confirmation!=='DELETE MY ACCOUNT')throw new Error('Confirmation phrase does not match');
 // Persist any pending preference changes before the irreversible operation.
 await flushCloud();
 const {data,error}=await client.functions.invoke('cardex-delete-account',{body:{password,confirmation}});
 if(error)throw new Error(data?.error||error.message||'Account deletion failed');
 if(!data?.deleted)throw new Error(data?.error||'Account deletion was not confirmed');
 const deletedId=activeUser;
 activeUser=null;pending=null;saveConflict=false;
 localStorage.removeItem(cacheKey(deletedId));
 window.cardexCloudReady=false;window.cardexServerGameReady=false;
 window.cardexLoadCloudState?.({});
 await client.auth.signOut({scope:'local'});
 await refreshSession();
};
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
  const {data:results,error} = await client.rpc('cardex_daily_leaderboard',{p_day:today});
  if(error){text(leaderboard,'Detailed rankings unavailable: '+error.message+'. Apply backend/leaderboard-profiles.sql.');return}
  if(!results?.length){leaderboard.innerHTML='<div class="leaderboard-empty">🏁 <strong>No challengers yet</strong><span>Be the first to enter today’s verified Showdown.</span></div>';return}
  const formatTime=(date)=>date?new Date(date).toLocaleString('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit',timeZone:'UTC',hour12:false})+' UTC':'—';
  leaderboard.innerHTML='<div class="lb-heading"><span>RANK / COLLECTOR</span><span>SCORE</span></div>'+
    '<div class="lb-list">'+results.map((r,i)=>{
      const cleared=r.best_score===100&&r.first_cleared_at;
      const car=window.cardexCarLabel?.(r.car_id)||'Unknown challenger';
      const rank=i+1;
      return '<button type="button" class="lb-entry '+(cleared?'lb-cleared ':'')+(i<3?'lb-podium':'')+'" data-collector-id="'+escapeHTML(r.user_id)+'" aria-label="Inspect '+escapeHTML(r.display_name||'Collector')+' profile">'+
        '<span class="lb-rank '+(i===0?'lb-gold':i===1?'lb-silver':i===2?'lb-bronze':'')+'">'+(rank<10?'0':'')+rank+'</span>'+
        '<span class="lb-person"><strong>'+escapeHTML(r.display_name||'Collector')+'</strong><small>🏎 '+escapeHTML(car)+(r.model_serial!=null?' · #'+String(r.model_serial).padStart(6,'0'):'')+'</small>'+
        '<small>'+(cleared?'🏁 Defeated '+formatTime(r.first_cleared_at):'Last improved '+formatTime(r.updated_at))+' · '+Number(r.unique_models||0)+' models</small></span>'+
        '<span class="lb-score"><strong>'+Number(r.best_score)+'%</strong><small>'+(cleared?'DEFEATED':'BEST SCORE')+'</small></span>'+
        '<span class="lb-chevron" aria-hidden="true">›</span></button>';
    }).join('')+'</div>';
  leaderboard.querySelectorAll('[data-collector-id]').forEach(button=>button.addEventListener('click',()=>window.cardexOpenPublicProfile?.(button.dataset.collectorId)));

}
window.cardexSetPublicVisibility=async(visible)=>{
 const {data,error}=await client.rpc('cardex_set_collection_visibility',{p_visible:visible});
 if(error)throw error;
 window.cardexSetProfileVisibility?.(data);
 return data;
};
window.cardexFetchPublicProfile=async(userId)=>{
  const {data,error}=await client.rpc('cardex_public_collector',{p_user_id:userId});
  if(error)throw error;
  if(!data)throw new Error('Collector profile not found');
  if(!data.private){
    const {data:titles,error:titleError}=await client.rpc('cardex_titles',{p_user_id:userId});
    if(!titleError&&titles){const equipped=titles.titles?.find(t=>t.id===titles.equipped&&t.unlocked);data.equipped_title=equipped?.label||null;data.title_count=titles.titles?.filter(t=>t.unlocked).length||0}
  }
  return data;
};
async function refreshSession(){
  const {data:{user}}=await client.auth.getUser();
  authForm.hidden=!!user;
  signedIn.hidden=!user;
  if(!user){window.cardexCloudReady=false;window.cardexServerGameReady=false;document.getElementById('accountGate').style.display='none';window.cardexShowAuth?.();text(status,'Sign in or create an account to play.');return}
  text(status,'Signed in as '+user.email+'. Your collection is linked to this account.');
  const {data:profile}=await client.from('profiles').select('display_name,public_collection').eq('id',user.id).maybeSingle();
  if(profile)window.cardexSetProfileVisibility?.(profile.public_collection!==false);
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
  client.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_OUT'){activeUser=null;pending=null;saveConflict=false;window.cardexCloudReady=false;window.cardexServerGameReady=false;window.cardexLoadCloudState?.({});}setTimeout(()=>refreshSession().catch(console.error),0)});
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
  const signOut=async()=>{await flushCloud();await client.auth.signOut();await refreshSession()};
  document.getElementById('reloadCloudPreferences').addEventListener('click',async()=>{const b=document.getElementById('reloadCloudPreferences');b.disabled=true;try{await window.cardexResolveSaveConflict()}catch(e){text(cloudStatus,'Reload failed: '+e.message)}finally{b.disabled=false}});
  document.getElementById('onlineLogout').addEventListener('click',signOut);
  document.getElementById('profileLogout').addEventListener('click',signOut);
  document.getElementById('onlineRefresh').addEventListener('click',async()=>{await loadPublic();await refreshSession()});
} catch(e) {
  window.cardexShowAuth?.();
  text(status,'Online services unavailable: '+(e?.message||'Unknown error'));
  const gate=document.getElementById('accountGate');if(gate)gate.style.display='flex';
  text(document.getElementById('gateStatus'),'Unable to connect. Try reloading.');
  console.error('CARDEX online initialization failed',e);
}
