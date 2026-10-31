/* CARDEX Social — uses the authenticated Supabase client from backend/client.js.
   Server RPCs enforce ownership and public-collection privacy. */
(()=>{
const $=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uuid=x=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(x));
const iconPaths={
'eye':'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
'user-plus':'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M20 8v6m-3-3h6"/>',
'user-minus':'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M17 11h6"/>',
'users':'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
'bell':'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
'check':'<path d="m5 12 4 4L19 6"/>','clock':'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
'search':'<circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/>',
'lock':'<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
'warehouse':'<path d="M3 21V8l9-5 9 5v13M3 11h18M7 21v-6h10v6"/>',
'arrow-right':'<path d="M5 12h14m-6-6 6 6-6 6"/>',
'arrow-left':'<path d="M19 12H5m6-6-6 6 6 6"/>',
'award':'<circle cx="12" cy="8" r="5"/><path d="m8 12-2 9 6-3 6 3-2-9"/>'
};
const icon=name=>'<svg class="social-icon" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(iconPaths[name]||iconPaths.eye)+'</svg>';
let state={friends:[],incoming:[],outgoing:[],notifications:[]},tab='friends',profileId=null,loading=false,currentUserId=null;
function icons(){} // Icons are inline SVGs; no external icon library or rendering delay.
function message(t){const el=$('socialMessage');el.hidden=!t;el.textContent=t||''}
function avatar(name){return '<span class="social-avatar">'+esc((name||'C').slice(0,1).toUpperCase())+'</span>'}
function relation(id){
 if(state.friends.some(x=>x.id===id))return 'friends';
 if(state.outgoing.some(x=>x.id===id))return 'outgoing';
 if(state.incoming.some(x=>x.id===id))return 'incoming';
 return 'none';
}
function buttons(p){
 if(currentUserId&&p.id===currentUserId)return '<span class="sub">Your profile</span>';
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
 const inboxCount=$('inboxCount');if(inboxCount)inboxCount.textContent=unread||'';
 const badge=$('socialNavBadge');if(badge){badge.hidden=!unread;badge.textContent=unread>99?'99+':String(unread)};
 list('socialFriends',state.friends,'No friends yet. Find collectors and send a request.');
 list('socialIncoming',state.incoming,'No incoming requests.');
 list('socialOutgoing',state.outgoing,'No outgoing requests.');
 const notificationsMarkup=state.notifications.length?state.notifications.map(n=>'<div class="social-notification '+(n.read?'':'unread')+'"><span class="social-notification-icon">'+icon(n.kind==='friend_request'?'user-plus':n.kind==='friend_accepted'?'users':'bell')+'</span><div><strong>'+esc(n.kind==='friend_request'?'Friend request':n.kind==='friend_accepted'?'New friend':'Notification')+'</strong><p>'+esc(n.message)+'</p><small>'+new Date(n.created_at).toLocaleString()+'</small></div><div class="social-person-actions">'+(uuid(n.actor_id)?'<button data-view-collector="'+n.actor_id+'">View</button>':'')+(!n.read?'<button data-social-action="read" data-notification="'+n.id+'">Mark read</button>':'')+'</div></div>').join(''):'<p class="muted">Your inbox is empty.</p>';
 $('socialInbox').innerHTML=notificationsMarkup;
 const popList=$('socialPopoverList');if(popList)popList.innerHTML=notificationsMarkup;
 icons();
}
function switchTab(next){tab=next;document.querySelectorAll('[data-social-tab]').forEach(b=>b.classList.toggle('active',b.dataset.socialTab===next));document.querySelectorAll('[data-social-panel]').forEach(p=>p.hidden=p.dataset.socialPanel!==next);if(next==='discover'&&$('socialSearch').value.trim().length>=2)search()}
async function rpc(name,args){const c=window.cardexSupabase;if(!c||!window.cardexCloudReady)throw Error('Sign in to use community features');const {data,error}=await c.rpc(name,args);if(error)throw error;return data}
async function refresh(){if(loading)return;loading=true;try{if(!currentUserId){const {data}=await window.cardexSupabase.auth.getUser();currentUserId=data?.user?.id||null}state=await rpc('cardex_social_list');render();message('')}catch(e){message('Community unavailable: '+e.message)}finally{loading=false}}
let searchSeq=0;
async function search(){const q=$('socialSearch').value.trim(),seq=++searchSeq;if(q.length<2){$('socialResults').innerHTML='<p class="muted">Enter at least two characters.</p>';return}
 $('socialResults').innerHTML='<p class="muted">Searching…</p>';
 try{const rows=await rpc('cardex_social_search',{p_query:q});if(seq!==searchSeq)return;list('socialResults',rows,'No collectors found.')}catch(e){if(seq===searchSeq)$('socialResults').textContent=e.message}}
async function action(act,id,request,notification){
 try{if(act==='send'&&id===currentUserId)throw Error('You cannot add yourself as a friend');const args={p_action:act,p_target:uuid(id)?id:null,p_request:request?Number(request):null,p_notification:notification?Number(notification):null};state=await rpc('cardex_social_action',args);render();if(tab==='discover')await search();if(profileId)await openProfile(profileId);message(act==='send'?'Friend request sent.':act==='accept'?'Friend request accepted.':act==='remove'?'Friend removed.':'Updated.')}catch(e){message('Action failed: '+e.message)}
}
let viewedGarage=[],viewedProfile=null,duplicatesOnly=false,groupCopies=true;
const rarityOrder=['Common','Uncommon','Rare','Super Rare','Ultra Rare','Legendary','Exotic','Limited'];
function renderGarage(){
 const q=$('socialGarageSearch').value.trim().toLowerCase(),rarity=$('socialGarageRarity').value,drive=$('socialGarageDrive').value,country=$('socialGarageCountry').value,finish=$('socialGarageFinish').value,sort=$('socialGarageSort').value;
 const counts=new Map(viewedGarage.map(x=>[x.car_id+'|'+x.finish,x.copies]));
 let arr=viewedGarage.filter(x=>{
  const c=window.cardexSocialCarDetails?.(x.car_id);return c&&(!duplicatesOnly||x.copies>1)&&(!rarity||c.rarity===rarity)&&(!drive||c.drive===drive)&&(!country||c.country===country)&&(!finish||x.finish===finish)&&(c.make+' '+c.model).toLowerCase().includes(q)
 });
 arr.sort((a,b)=>{const x=window.cardexSocialCarDetails(a.car_id),y=window.cardexSocialCarDetails(b.car_id);
 switch(sort){
 case 'name':return (x.make+x.model).localeCompare(y.make+y.model);
 case 'power':return y.hp-x.hp;case 'powerAsc':return x.hp-y.hp;
 case 'speed':return y.speed-x.speed;case 'speedAsc':return x.speed-y.speed;
 case 'weight':return y.weight-x.weight;case 'light':return x.weight-y.weight;
 case 'year':return y.year-x.year;case 'oldest':return x.year-y.year;
 case 'rarity':return rarityOrder.indexOf(y.rarity)-rarityOrder.indexOf(x.rarity);
 default:return 0;
 }});
 $('socialGarageGroup').textContent='Group copies: '+(groupCopies?'ON':'OFF');
 $('socialGarageDuplicates').textContent=duplicatesOnly?'✓ Duplicates only':'Duplicates only';
 const expanded=groupCopies?arr:arr.flatMap(x=>Array.from({length:Math.min(x.copies,500)},()=>({...x,copies:1})));
 $('socialGarageGrid').innerHTML=expanded.length?expanded.map(x=>'<div class="garage-item social-readonly-card">'+window.cardexSocialRenderCard(x.car_id,x.finish)+'<span class="garage-item-foot">'+(x.copies>1?'×'+x.copies+' · ':'')+'VIEW ONLY <span>↗</span></span></div>').join(''):'<div class="empty">No cars match your filters.</div>';
 $('socialGarageSummary').textContent=viewedGarage.reduce((n,x)=>n+x.copies,0)+' cards · '+new Set(viewedGarage.map(x=>x.car_id)).size+' / 192 models discovered';
 window.cardexSocialPaintPhotos?.();
}
function openGarage(){
 if(!viewedProfile||viewedProfile.private)return;
 $('socialGarageName').textContent=(viewedProfile.display_name||'Collector')+'’s Garage';
 window.cardexPage?.('collectorGarage');renderGarage();icons();
}
async function openProfile(id){
 if(!uuid(id))return;profileId=id;window.cardexPage?.('collectorView');
 $('socialProfileBody').innerHTML='<p class="muted">Loading collector profile…</p>';
 try{
  if(!currentUserId){const {data}=await window.cardexSupabase.auth.getUser();currentUserId=data?.user?.id||null}
  if(id===currentUserId){window.cardexPage?.('profile');return}
  const [p,g]=await Promise.all([window.cardexFetchPublicProfile(id),rpc('cardex_social_garage',{p_user_id:id})]);
  viewedProfile=p;viewedGarage=g.private?[]:g.cards||[];
  const title=p.equipped_title?'<div class="collector-title-badge social-profile-title">✦ '+esc(p.equipped_title)+'</div>':'';
  const avatarText='🏎️';
  const head='<div class="eyebrow">COLLECTOR IDENTITY / PUBLIC PROFILE</div><h1>Profile</h1>'+
  '<div class="profile-cover" data-theme="heritage"><div class="profile-identity"><div class="profile-avatar">'+avatarText+'</div><div><div class="eyebrow">CARDEX COLLECTOR</div><h2>'+esc(p.display_name||'Collector')+'</h2><div class="sub">Driven by the chase.</div></div></div>'+
  (p.private?'':'<div class="profile-numbers"><div><strong>'+Number(p.unique_models||0)+'/192</strong><span>Discovered</span></div><div><strong>'+Number(p.cards_owned||0)+'</strong><span>Cards owned</span></div><div><strong>'+Number(p.high_tier_cards||0)+'</strong><span>Legendary+</span></div><div><strong>'+Number(p.title_count||0)+'</strong><span>Titles unlocked</span></div></div>')+'</div>'+
  title+'<div class="social-profile-actions">'+buttons({id,name:p.display_name,public:!p.private})+'</div>';
  if(p.private||g.private){$('socialProfileBody').innerHTML=head+'<div class="panel social-private">'+icon('lock')+'<h2>Private collection</h2><p>This collector has chosen not to share their Garage or Showdown history.</p></div>';icons();return}
  const featured=(p.featured_cards||[]).map((x,i)=>{const c=window.cardexSocialCarDetails?.(x.car_id);return c?'<div class="showcase-slot"><div class="slot-label">DISPLAY 0'+(i+1)+'</div><div class="art" data-car-photo="'+x.car_id+'" data-fallback="'+esc(c.emoji)+'">'+esc(c.emoji)+'</div><div class="slot-name">'+esc(c.make+' '+c.model)+'</div><span class="sub">'+esc(x.finish)+' · #'+esc(x.model_serial)+'</span></div>':''}).join('');
  const recent=(p.recent_showdowns||[]).map(x=>'<div class="social-showdown"><span>'+esc(x.challenge_date)+'</span><strong>'+Number(x.best_score)+'%</strong></div>').join('');
  $('socialProfileBody').innerHTML=head+'<div class="social-garage-entry panel"><div><div class="eyebrow">COLLECTION</div><h2>Garage</h2><p class="muted">Explore '+esc(p.display_name||'this collector')+'’s cards with the familiar CARDEX filters and card layout.</p></div><button class="primary" id="socialOpenGarage">'+icon('warehouse')+' Inspect garage '+icon('arrow-right')+'</button></div>'+
  '<h2>Showroom <span class="sub">/ Featured cars</span></h2><div class="profile-showcase">'+(featured||'<p class="muted">No featured cars yet.</p>')+'</div>'+
  '<h2>Recent Showdowns</h2><div class="social-showdowns">'+(recent||'<p class="muted">No verified entries yet.</p>')+'</div>';
  window.cardexSocialPaintPhotos?.();icons();
 }catch(e){$('socialProfileBody').textContent='Unable to load collector: '+e.message}
}
window.cardexSocialOpenProfile=openProfile;
window.cardexSocialShowInbox=()=>{const pop=$('socialInboxPopover');if(!pop)return;const opening=pop.hidden;pop.hidden=!opening;$('topInbox')?.setAttribute('aria-expanded',String(opening));if(opening)refresh()};
window.cardexSocialShowCommunity=()=>{closeInbox();window.cardexPage?.('social');switchTab('friends');refresh()};
function closeInbox(){const pop=$('socialInboxPopover');if(pop)pop.hidden=true;$('topInbox')?.setAttribute('aria-expanded','false')}
window.cardexSocialRefresh=refresh;
window.cardexSocialReset=()=>{state={friends:[],incoming:[],outgoing:[],notifications:[]};profileId=null;currentUserId=null;closeInbox();render()};
document.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.socialTab){switchTab(b.dataset.socialTab);return}
 if(b.dataset.viewCollector){const notice=b.closest('[data-notification-id]');if(notice){const id=Number(notice.dataset.notificationId);const item=state.notifications.find(n=>n.id===id);if(item&&!item.read){item.read=true;render();rpc('cardex_social_action',{p_action:'read',p_target:null,p_request:null,p_notification:id}).then(next=>{state=next;render()}).catch(err=>{console.warn('Could not mark notification as read',err);refresh()})}}closeInbox();openProfile(b.dataset.viewCollector);return}
 if(b.dataset.socialAction){action(b.dataset.socialAction,b.dataset.id,b.dataset.request,b.dataset.notification);return}
 if(b.id==='socialReadAll'||b.id==='socialPopoverReadAll')action('read_all');
 if(b.id==='socialBack')window.cardexPage?.('social');
 if(b.id==='socialOpenGarage')openGarage();
 if(b.id==='socialGarageBack')window.cardexPage?.('collectorView');
 if(b.id==='socialGarageDuplicates'){duplicatesOnly=!duplicatesOnly;renderGarage()}
 if(b.id==='socialGarageGroup'){groupCopies=!groupCopies;renderGarage()}
 if(b.id==='topCommunity')window.cardexSocialShowCommunity()
 if(b.id==='topInbox')window.cardexSocialShowInbox()
 if(b.dataset.page==='social')refresh();
});
$('socialSearch').addEventListener('input',()=>search());
['socialGarageSearch','socialGarageRarity','socialGarageSort','socialGarageDrive','socialGarageCountry','socialGarageFinish'].forEach(id=>$(id).addEventListener(id==='socialGarageSearch'?'input':'change',renderGarage));
$('socialGarageCountry').innerHTML+=(window.cardexSocialCountries||[]).map(c=>'<option>'+esc(c)+'</option>').join('');
$('topCommunity').addEventListener('click',e=>{e.stopPropagation();window.cardexSocialShowCommunity()});
$('topInbox').addEventListener('click',e=>{e.stopPropagation();window.cardexSocialShowInbox()});
document.addEventListener('click',e=>{if(!$('socialInboxPopover')?.hidden&&!e.target.closest('#socialInboxPopover')&&!e.target.closest('#topInbox'))closeInbox()});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeInbox()});
window.addEventListener('focus',()=>{if($('social')?.classList.contains('active'))refresh()});
})();