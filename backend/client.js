import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const URL = 'https://svqaunlehadayyyctvuo.supabase.co';
const PUBLISHABLE_KEY = 'sb_publishable_bmN4o7CWUi8OqQ8_jqLaig_DSYcorRO';
const status = document.getElementById('onlineStatus');
const authForm = document.getElementById('onlineAuthForm');
const signedIn = document.getElementById('onlineSignedIn');
const leaderboard = document.getElementById('onlineLeaderboard');
const serials = document.getElementById('onlineSerials');
const shared = document.getElementById('onlineSharedBoss');
const text = (el, value) => { if (el) el.textContent = value; };
let client;
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
  } else text(shared,'No online boss published for today yet. Local Showdown remains available.');
  const {data:results,error} = await client.from('showdown_results').select('user_id,best_score,updated_at').eq('challenge_date',today).order('best_score',{ascending:false}).order('updated_at',{ascending:true}).limit(25);
  if(error){text(leaderboard,'Leaderboard unavailable: '+error.message);return}
  if(!results?.length){text(leaderboard,'No verified online results yet. Local Showdown results are not uploaded.');return}
  const ids=[...new Set(results.map(x=>x.user_id))];
  const {data:profiles}=await client.from('profiles').select('id,display_name').in('id',ids);
  const names=new Map((profiles||[]).map(p=>[p.id,p.display_name]));
  leaderboard.innerHTML='<ol>'+results.map(r=>'<li>'+escapeHTML(names.get(r.user_id)||'Collector')+' — '+Number(r.best_score)+' pts</li>').join('')+'</ol>';
}
async function refreshSession(){
  const {data:{user}}=await client.auth.getUser();
  authForm.hidden=!!user;
  signedIn.hidden=!user;
  if(!user){text(status,'Guest mode — progress stays on this device.');text(serials,'Sign in to view server-issued serials.');return}
  text(status,'Signed in as '+user.email+'. Your current local collection is not yet synced.');
  const {data:profile}=await client.from('profiles').select('display_name').eq('id',user.id).maybeSingle();
  document.getElementById('onlineName').value=profile?.display_name||'Collector';
  const {data:owned,error}=await client.from('global_card_serials').select('id,car_id,finish,issued_at').order('id',{ascending:false}).limit(30);
  text(serials,error?'Unable to load online serials: '+error.message:owned?.length?owned.map(x=>'#'+x.id+' · Car '+x.car_id+' · '+x.finish).join(' | '):'No server-issued serials yet. Existing local cards do not have global serial numbers.');
}
try {
  client=createClient(URL,PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  window.cardexSupabase=client;
  text(status,'Connecting to online services…');
  await refreshSession();
  await loadPublic();
  client.auth.onAuthStateChange(()=>{setTimeout(()=>refreshSession().catch(console.error),0)});
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
  document.getElementById('onlineLogout').addEventListener('click',async()=>{await client.auth.signOut();await refreshSession()});
  document.getElementById('onlineSaveName').addEventListener('click',async()=>{
    const name=document.getElementById('onlineName').value.trim();
    if(!name||name.length>24){text(status,'Name must be 1–24 characters.');return}
    const {data:{user}}=await client.auth.getUser();if(!user)return;
    const {error}=await client.from('profiles').update({display_name:name}).eq('id',user.id);
    text(status,error?'Name update failed: '+error.message:'Online display name saved.');
    if(!error)await loadPublic();
  });
  document.getElementById('onlineRefresh').addEventListener('click',async()=>{await loadPublic();await refreshSession()});
} catch(e) {
  text(status,'Online services unavailable. Offline play still works.');
  console.error('CARDEX online initialization failed',e);
}
