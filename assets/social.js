/* CARDEX Social — uses the authenticated Supabase client from backend/client.js.
   Server RPCs enforce ownership and public-collection privacy. */
(()=>{
const $=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uuid=x=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(x));
const icon=name=>'<i data-lucide="'+name+'"></i>';
let state={friends:[],incoming:[],outgoing:[],notifications:[]},tab='friends',profileId=null,loading=false;
function icons(){window.lucide?.createIcons({attrs:{'stroke-width':1.8}})}
function message(t){const el=$('socialMessage');el.hidden=!t;el.textContent=t||''}
function avatar(name){return '<span class="social-avatar">'+esc((name||'C').slice(0,1).toUpperCase())+'</span>'}
function relation(id){
 if(state.friends.some(x=>x.id===id))return 'friends';
 if(state.outgoing.some(x=>x.id===id))return 'outgoing';
 if(state.incoming.some(x=>x.id===id))return 'incoming';
 return 'none';
}
function buttons(p){
 const rel=relation(p.id);
 if(rel==='friends')return '<button data-social-action="remove" data-id="'+esc(p.id)+'">'+icon('user-minus')+' Remove</button>';
 if(rel==='outgoing')return '<button data-social-action="cancel" data-id="'+esc(p.id)+'">'+icon('clock')+' Cancel request</button>';
 if(rel==='incoming'){const r=state.incoming.find(x=>x.id===p.id);return '<button class="primary" data-social-action="accept" data-request="'+r.request_id+'">'+icon('check')+' Accept</button><button data-social-action="decline" data-request="'+r.request_id+'">Decline</button>'}
 return '<button class="primary" data-social-action="send" data-id="'+esc(p.id)+'">'+icon('user-plus')+' Add friend</button>';
}
function person(p){return '<div class="social-person">'+avatar(p.name)+'<div class="social-person-info"><strong>'+esc(p.name||'Collector')+'</strong><span>'+((p.public===false)?'Private garage':'Public garage')+'</span></div><div class="social-person-actions"><button data-view-collector="'+esc(p.id)+'">'+icon('eye')+' Profile</button>'+buttons(p)+'</div></div>'}
function list(id,arr,empty){$(id).innerHTML=arr.length?arr.map(person).join(''):'<p class="muted">'+empty+'</p>'}
function render(){
 $('friendCount').textContent=state.friends.length||'';
 $('requestCount').textContent=state.incoming.length||'';
 const unread=state.notifications.filter(x=>!x.read).length;
 $('inboxCount').textContent=unread||'';
 const badge=$('socialNavBadge');if(badge){badge.hidden=!unread;badge.textContent=unread>99?'99+':String(unread)};
 list('socialFriends',state.friends,'No friends yet. Find collectors and send a request.');
 list('socialIncoming',state.incoming,'No incoming requests.');
 list('socialOutgoing',state.outgoing,'No outgoing requests.');
 $('socialInbox').innerHTML=state.notifications.length?state.notifications.map(n=>'<div class="social-notification '+(n.read?'':'unread')+'"><span class="social-notification-icon">'+icon(n.kind==='friend_request'?'user-plus':n.kind==='friend_accepted'?'users':'bell')+'</span><div><strong>'+esc(n.kind==='friend_request'?'Friend request':n.kind==='friend_accepted'?'New friend':'Notification')+'</strong><p>'+esc(n.message)+'</p><small>'+new Date(n.created_at).toLocaleString()+'</small></div><div class="social-person-actions">'+(uuid(n.actor_id)?'<button data-view-collector="'+n.actor_id+'">View</button>':'')+(!n.read?'<button data-social-action="read" data-notification="'+n.id+'">Mark read</button>':'')+'</div></div>').join(''):'<p class="muted">Your inbox is empty.</p>';
 icons();
}
function switchTab(next){tab=next;document.querySelectorAll('[data-social-tab]').forEach(b=>b.classList.toggle('active',b.dataset.socialTab===next));document.querySelectorAll('[data-social-panel]').forEach(p=>p.hidden=p.dataset.socialPanel!==next);if(next==='discover'&&$('socialSearch').value.trim().length>=2)search()}
async function rpc(name,args){const c=window.cardexSupabase;if(!c||!window.cardexCloudReady)throw Error('Sign in to use community features');const {data,error}=await c.rpc(name,args);if(error)throw error;return data}
async function refresh(){if(loading)return;loading=true;try{state=await rpc('cardex_social_list');render();message('')}catch(e){message('Community unavailable: '+e.message)}finally{loading=false}}
let searchSeq=0;
async function search(){const q=$('socialSearch').value.trim(),seq=++searchSeq;if(q.length<2){$('socialResults').innerHTML='<p class="muted">Enter at least two characters.</p>';return}
 $('socialResults').innerHTML='<p class="muted">Searching…</p>';
 try{const rows=await rpc('cardex_social_search',{p_query:q});if(seq!==searchSeq)return;list('socialResults',rows,'No collectors found.')}catch(e){if(seq===searchSeq)$('socialResults').textContent=e.message}}
async function action(act,id,request,notification){
 try{const args={p_action:act,p_target:uuid(id)?id:null,p_request:request?Number(request):null,p_notification:notification?Number(notification):null};state=await rpc('cardex_social_action',args);render();if(tab==='discover')await search();if(profileId)await openProfile(profileId);message(act==='send'?'Friend request sent.':act==='accept'?'Friend request accepted.':act==='remove'?'Friend removed.':'Updated.')}catch(e){message('Action failed: '+e.message)}
}
const cardPhoto=(id)=>{const c=window.cardexSocialCar?.(id);return c?.src?'<img loading="lazy" src="'+esc(c.src)+'" alt="">':'<span class="social-car-fallback">'+esc(c?.emoji||'🚗')+'</span>'};
async function openProfile(id){
 if(!uuid(id))return;profileId=id;window.cardexPage?.('collectorView');
 $('socialProfileBody').innerHTML='<p class="muted">Loading collector profile…</p>';
 try{
  const [p,g]=await Promise.all([window.cardexFetchPublicProfile(id),rpc('cardex_social_garage',{p_user_id:id})]);
  const title=p.equipped_title?'<span class="social-equipped-title">'+icon('award')+' '+esc(p.equipped_title)+'</span>':'';
  const head='<div class="social-cover"><div class="social-cover-pattern"></div><div class="social-profile-heading">'+avatar(p.display_name)+'<div><div class="eyebrow">CARDEX COLLECTOR</div><h1>'+esc(p.display_name||'Collector')+'</h1>'+title+'<p class="muted">Joined '+(p.joined_at?new Date(p.joined_at).toLocaleDateString('en-GB',{month:'long',year:'numeric'}):'CARDEX')+'</p></div></div><div class="social-profile-actions">'+buttons({id:p.id,name:p.display_name,public:!p.private})+'</div></div>';
  if(p.private||g.private){$('socialProfileBody').innerHTML=head+'<div class="social-private">'+icon('lock')+'<h2>Private garage</h2><p>This collector has chosen not to share their collection or Showdown history.</p></div>';icons();return}
  const stats='<div class="social-stats"><div><strong>'+Number(p.cards_owned||0)+'</strong><span>Cards owned</span></div><div><strong>'+Number(p.unique_models||0)+'</strong><span>Unique models</span></div><div><strong>'+Number(p.high_tier_cards||0)+'</strong><span>Legendary+</span></div><div><strong>'+Number(p.title_count||0)+'</strong><span>Titles unlocked</span></div></div>';
  const garage=(g.cards||[]).map(x=>{const c=window.cardexSocialCar?.(x.car_id);return '<article class="social-garage-card">'+cardPhoto(x.car_id)+'<div class="social-garage-info"><span class="social-rarity">'+esc(c?.rarity||'')+'</span><strong>'+esc(c?.name||'Car #'+x.car_id)+'</strong><span>'+esc(x.finish)+' · '+Number(x.copies)+' owned</span></div></article>'}).join('');
  const recent=(p.recent_showdowns||[]).map(x=>'<div class="social-showdown"><span>'+esc(x.challenge_date)+'</span><strong>'+Number(x.best_score)+'%</strong></div>').join('');
  $('socialProfileBody').innerHTML=head+stats+'<div class="social-heading"><h2>Garage <small>('+Number(p.unique_models||0)+' models)</small></h2></div><div class="social-garage-grid">'+(garage||'<p class="muted">No cards yet.</p>')+'</div><h2>Recent Showdowns</h2><div class="social-showdowns">'+(recent||'<p class="muted">No entries yet.</p>')+'</div>';icons();
 }catch(e){$('socialProfileBody').textContent='Unable to load collector: '+e.message}
}
window.cardexSocialOpenProfile=openProfile;
window.cardexSocialRefresh=refresh;
window.cardexSocialReset=()=>{state={friends:[],incoming:[],outgoing:[],notifications:[]};profileId=null;render()};
document.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.socialTab){switchTab(b.dataset.socialTab);return}
 if(b.dataset.viewCollector){openProfile(b.dataset.viewCollector);return}
 if(b.dataset.socialAction){action(b.dataset.socialAction,b.dataset.id,b.dataset.request,b.dataset.notification);return}
 if(b.id==='socialReadAll')action('read_all');
 if(b.id==='socialBack')window.cardexPage?.('social');
 if(b.dataset.page==='social')refresh();
});
$('socialSearch').addEventListener('input',()=>search());
window.addEventListener('focus',()=>{if($('social')?.classList.contains('active'))refresh()});
})();