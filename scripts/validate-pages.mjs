// Run: node scripts/validate-pages.mjs
import { readFileSync } from 'node:fs';
const pages=['boosters','garage','duel','profile','auth'];
const files=['index.html',...pages.map(p=>'pages/'+p+'.html')];
const ids=new Map();
let failed=false;
for(const file of files){
 const html=readFileSync(new URL('../'+file,import.meta.url),'utf8');
 for(const m of html.matchAll(/\bid="([^"]+)"/g)){
  const prev=ids.get(m[1]);if(prev){console.error('Duplicate id',m[1],prev,file);failed=true}
  ids.set(m[1],file);
 }
 if(file.startsWith('pages/')){
  const expected=file.slice(6,-5);
  if(!html.startsWith('<section')||!html.includes('id="'+expected+'"')){console.error('Invalid page root',file);failed=true}
  const stack=[];
  for(const match of html.matchAll(/<\/?(section|div|details|summary|article)\b[^>]*>/g)){
   const name=match[1];
   if(match[0].startsWith('</')){if(stack.pop()!==name){console.error('Mismatched closing tag',file,match.index,name);failed=true}}
   else stack.push(name);
  }
  if(stack.length){console.error('Unclosed structural tags',file,stack);failed=true}
 }
}
const shell=readFileSync(new URL('../index.html',import.meta.url),'utf8');
for(const file of ['assets/styles.css','assets/game.js','backend/client.js',...pages.map(p=>'pages/'+p+'.html')]){
 if(!shell.includes(file)&&!shell.includes("'./pages/'+id+'.html'")&&file.startsWith('pages/'))continue;
 try{readFileSync(new URL('../'+file,import.meta.url))}catch{console.error('Missing asset',file);failed=true}
}
if(!ids.has('titleManager')||!ids.has('profile')||!ids.has('revealModal')){console.error('Missing critical UI');failed=true}
if(failed)process.exit(1);
console.log('CARDEX structural check passed: '+files.length+' HTML files, '+ids.size+' unique IDs');
