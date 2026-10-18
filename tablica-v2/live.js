// Wyłącznie odczyt publicznego API. Tablica nie zapisuje cen ani konfiguracji.
const sections=[...document.querySelectorAll('main section')];
const sectionKeys=['bullion','historical','other','goldBars','scrap','silverCoins','silverBars'];
const status=document.querySelector('.demo');
const money=value=>typeof value==='number'&&Number.isFinite(value)?Math.round(value).toLocaleString('pl-PL',{useGrouping:false,maximumFractionDigits:0})+' zł':'—';
const spotMoney=value=>typeof value==='number'&&Number.isFinite(value)?value.toLocaleString('pl-PL',{useGrouping:false,maximumFractionDigits:2,minimumFractionDigits:2})+' zł':'—';
let deadline=Date.now(),lastSuccess=null,busy=false;
function addRow(body,label,prices,number){
 const tr=document.createElement('tr'),th=document.createElement('th');
 if(number){const badge=document.createElement('b');badge.className='display-number';badge.textContent=number+'.';th.append(badge,' ')}
 th.append(document.createTextNode(label));tr.append(th);
 for(const value of prices){const td=document.createElement('td');td.textContent=money(value);tr.append(td)}
 body.append(tr);
}
function renderBoard(board){
 if(board.version!==1||!Array.isArray(board.rows))throw Error('Nieobsługiwana wersja tablicy');
 for(const [index,key] of sectionKeys.entries()){
  const section=sections[index],body=section.querySelector('tbody');body.replaceChildren();
  section.classList.toggle('section-disabled',board.sections[key]?.visible===false);
  const rows=board.rows.filter(r=>r.section===key).sort((a,b)=>(a.order??a.number*1000)-(b.order??b.number*1000)||a.number-b.number||b.fineWeight-a.fineWeight);
  if(['bullion','historical','other'].includes(key)){
   const families=new Map();for(const row of rows){if(!families.has(row.family))families.set(row.family,[]);families.get(row.family).push(row)}
   for(const group of families.values()){
    const first=group[0];
    if(key!=='bullion'&&group.length===1){addRow(body,first.label,[first.buy,first.sell],first.number);continue}
    const tr=document.createElement('tr'),th=document.createElement('th'),badge=document.createElement('b');tr.className='family';th.colSpan=key==='bullion'?4:3;badge.className='display-number';badge.textContent=first.number+'.';th.append(badge,' '+first.label);tr.append(th);body.append(tr);
    for(const row of group)addRow(body,row.weight||row.label,[row.buy,row.sell,...(key==='bullion'?[row.delivery]:[])]);
   }
  }else for(const row of rows)addRow(body,row.label,[row.buy,row.sell,...(key==='goldBars'?[row.delivery]:[])],row.number);
  for(const header of section.querySelectorAll('[data-delivery]'))header.textContent='Dostawa '+board.deliveryDays+' dni';
 }
}
function renderLegacy(data){
 // Pozwala zachować odczyt w czasie niezależnego wdrażania panelu i tablicy.
 const groups=['goldCoins',null,null,'goldBars',null,'silverCoins','silverBars'];
 sections.forEach((section,index)=>{
  const body=section.querySelector('tbody');body.replaceChildren();
  const rows=index===4?Object.entries(data.metals.gold.purities).map(([p,v])=>({name:'Próba '+p,price:v.price})):(data.products[groups[index]]||[]).filter(p=>p.active!==false);
  for(const row of rows)addRow(body,row.name,[row.price,null,...([0,3].includes(index)?[null]:[])]);
 });
}
function stamp(){return lastSuccess?new Date(lastSuccess).toLocaleString('pl-PL',{timeZone:'Europe/Warsaw'}):'—'}
function assessOverflow(){
 for(const section of sections){section.classList.remove('compact','dense');if(section.scrollHeight>section.clientHeight)section.classList.add('compact');if(section.scrollHeight>section.clientHeight)section.classList.add('dense')}
 return sections.some(s=>s.scrollHeight>s.clientHeight||s.scrollWidth>s.clientWidth);
}
async function refresh(){
 if(busy)return;busy=true;
 try{
  const res=await fetch('/panel-api/prices',{cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(!res.ok)throw Error('HTTP '+res.status);
  const data=await res.json();
  if(!data.products||!data.metals?.gold||!data.metals?.silver||!Number.isFinite(Date.parse(data.fetchedAt)))throw Error('Nieprawidłowe dane');
  if(Date.now()-Date.parse(data.fetchedAt)>600000||/zapasowe/i.test(data.provider||''))throw Error('Nieaktualne notowania');
  if(data.board)renderBoard(data.board);else renderLegacy(data);
  ['gold','silver'].forEach((metal,index)=>{
   const item=data.metals[metal],target=document.querySelectorAll('.rate')[index];
   target.textContent=(index?'Srebro 999':'Złoto 999,9')+' '+(item.change>0?'↑':item.change<0?'↓':'↔')+' '+spotMoney(item.spot)+'/g | '+spotMoney(item.spot*31.1034768)+'/oz';
  });
  lastSuccess=data.fetchedAt;document.body.classList.remove('fetch-error');
  status.textContent=data.board?'TABLICA TESTOWA • CENY Z PANELU':'TABLICA TESTOWA • WYMAGANE WDROŻENIE NOWEGO PANELU';
  if(assessOverflow())status.textContent+=' • ZA DUŻO POZYCJI — ZMNIEJSZ ZAKRES W PANELU';
 }catch(error){
  document.body.classList.add('fetch-error');
  status.textContent=lastSuccess?'BŁĄD AKTUALIZACJI • OSTATNIE DANE: '+stamp():'BRAK POŁĄCZENIA Z PANELEM • CENY NIEDOSTĘPNE';
 }finally{busy=false;deadline=Date.now()+60000;updateTimer()}
}
function updateTimer(){
 if(lastSuccess&&Date.now()-Date.parse(lastSuccess)>600000){document.body.classList.add('fetch-error');status.textContent='NIEAKTUALNE CENY • OSTATNIE DANE: '+stamp()}
 const remaining=Math.max(0,Math.ceil((deadline-Date.now())/1000));
 document.querySelector('#refresh-timer').textContent=busy?'Pobieranie cen…':'Aktualizacja za '+String(Math.floor(remaining/60)).padStart(2,'0')+':'+String(remaining%60).padStart(2,'0')+' • Dane: '+stamp();
}
refresh();setInterval(()=>{updateTimer();if(Date.now()>=deadline)refresh()},1000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
