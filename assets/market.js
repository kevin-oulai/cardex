/* CARDEX Market: all purchases and listings are committed atomically by Supabase RPCs. */
(()=>{
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const coins=n=>Number(n||0).toLocaleString('en-US');
let listings=[],mine={inventory:[],listings:[],history:[]},tab='browse',busy=false;
const car=id=>window.cardexSocialCarDetails?.(id);
const name=id=>{const c=car(id);return c?c.make+' '+c.model:'Car #'+id};
const cardArt=(id,finish)=>window.cardexSocialRenderCard?.(id,finish)||'<div class="market-fallback">🏎️</div>';
const message=t=>{const el=$('marketMessage');el.hidden=!t;el.textContent=t||''};
async function rpc(fn,args){if(!window.cardexCloudReady||!window.cardexSupabase)throw Error('Sign in to use the market');const {data,error}=await window.cardexSupabase.rpc(fn,args);if(error)throw error;return data}
function listing(x,kind){const own=kind==='mine',history=kind==='history';return '<article class="market-item"><div class="market-card-art">'+cardArt(x.car_id,x.finish)+'</div><div class="market-item-info"><div class="eyebrow">'+esc(car(x.car_id)?.rarity||'COLLECTIBLE')+'</div><strong>'+esc(name(x.car_id))+'</strong><span class="sub">'+esc(x.finish)+' · Serial #'+esc(x.model_serial)+'</span><div class="market-price">🪙 '+coins(x.price)+'</div><span class="sub">'+(history?esc(x.side==='bought'?'Purchased':'Sold')+' · Fee '+coins(x.fee):own?'Your listing':'Seller: '+esc(x.seller_name))+'</span></div>'+(history?'':own?'<button data-market-cancel="'+x.id+'">Cancel listing</button>':'<button class="primary" data-market-buy="'+x.id+'">Buy card</button>')+'</article>'}
function render(){
 const q=$('marketSearch').value.trim().toLowerCase(),rarity=$('marketRarity').value,sort=$('marketSort').value;
 const filtered=listings.filter(x=>(!rarity||car(x.car_id)?.rarity===rarity)&&(!q||name(x.car_id).toLowerCase().includes(q)||x.seller_name.toLowerCase().includes(q)));
 filtered.sort((a,b)=>sort==='cheap'?a.price-b.price:sort==='expensive'?b.price-a.price:b.id-a.id);
 $('marketBrowse').innerHTML=filtered.length?filtered.map(x=>listing(x)).join(''):'<p class="muted">No listings match your search.</p>';
 $('marketMine').innerHTML=mine.listings.length?mine.listings.map(x=>listing(x,'mine')).join(''):'<p class="muted">You have no active listings.</p>';
 $('marketHistory').innerHTML=mine.history.length?mine.history.map(x=>listing(x,'history')).join(''):'<p class="muted">No completed trades yet.</p>';
 const sel=$('marketSellCard'),prev=sel.value;sel.innerHTML='<option value="">Choose a card</option>'+mine.inventory.map(x=>'<option value="'+x.id+'">'+esc(name(x.car_id))+' · '+esc(x.finish)+' · #'+esc(x.model_serial)+'</option>').join('');if(mine.inventory.some(x=>String(x.id)===prev))sel.value=prev;
 preview();window.cardexSocialPaintPhotos?.();
}
function preview(){const x=mine.inventory.find(x=>String(x.id)===$('marketSellCard').value);$('marketSellPreview').innerHTML=x?'<div class="market-preview-card">'+cardArt(x.car_id,x.finish)+'</div><div><strong>'+esc(name(x.car_id))+'</strong><p class="muted">'+esc(x.finish)+' · #'+esc(x.model_serial)+'</p></div>':'';window.cardexSocialPaintPhotos?.()}
async function refresh(){if(busy)return;busy=true;try{[listings,mine]=await Promise.all([rpc('cardex_market_list',{p_limit:100}),rpc('cardex_market_mine')]);render();message('')}catch(e){message('Market unavailable: '+e.message)}finally{busy=false}}
async function mutate(fn,args,confirmText){if(busy)return;if(confirmText&&!window.confirm(confirmText))return;busy=true;try{await rpc(fn,args);message('Transaction completed.');await window.cardexOnlineRefresh?.();[listings,mine]=await Promise.all([rpc('cardex_market_list',{p_limit:100}),rpc('cardex_market_mine')]);render()}catch(e){message(e.message)}finally{busy=false}}
function switchTab(next){tab=next;document.querySelectorAll('[data-market-tab]').forEach(b=>b.classList.toggle('active',b.dataset.marketTab===next));document.querySelectorAll('[data-market-panel]').forEach(p=>p.hidden=p.dataset.marketPanel!==next);refresh()}
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.marketTab){switchTab(b.dataset.marketTab);return}if(b.id==='marketRefresh'){refresh();return}if(b.dataset.marketBuy){const x=listings.find(x=>String(x.id)===b.dataset.marketBuy);if(x)mutate('cardex_market_buy',{p_listing_id:x.id},'Buy '+name(x.car_id)+' for '+coins(x.price)+' coins?');return}if(b.dataset.marketCancel){mutate('cardex_market_cancel',{p_listing_id:Number(b.dataset.marketCancel)},'Cancel this listing?');return}if(b.id==='marketCreate'){const serial=Number($('marketSellCard').value),price=Number($('marketSellPrice').value);if(!serial||!Number.isSafeInteger(price)||price<10||price>10000000){message('Select a card and enter a price between 10 and 10,000,000 coins.');return}mutate('cardex_market_create',{p_serial_id:serial,p_price:price});return}if(b.dataset.page==='market')refresh()});
$('marketSellCard').addEventListener('change',preview);
['marketSearch','marketRarity','marketSort'].forEach(id=>$(id).addEventListener(id==='marketSearch'?'input':'change',render));
window.cardexMarketRefresh=refresh;
})();