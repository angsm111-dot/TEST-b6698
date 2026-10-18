// Wyłącznie odczyt publicznego API. Tablica nie zapisuje cen ani konfiguracji.
const sections=[...document.querySelectorAll('main section')];
const sectionKeys=['bullion','historical','other','goldBars','scrap','silverCoins','silverBars'];
const status=document.querySelector('.demo');
const money=value=>typeof value==='number'&&Number.isFinite(value)?Math.round(value).toLocaleString('pl-PL',{useGrouping:false,maximumFractionDigits:0})+' zł':'—';
const spotMoney=value=>typeof value==='number'&&Number.isFinite(value)?value.toLocaleString('pl-PL',{useGrouping:false,maximumFractionDigits:2,minimumFractionDigits:2})+' zł':'—';
let deadline=Date.now(),lastSuccess=null,busy=false;
function appendLabel(cell,label,number){
 const wrapper=document.createElement('span');wrapper.className='position-label';
 if(number){const badge=document.createElement('b');badge.className='display-number';badge.textContent=number+'.';wrapper.append(badge)}
 const name=document.createElement('span');name.className='position-name';name.textContent=label;wrapper.append(name);cell.append(wrapper);
}
function addRow(body,label,prices,number){
 const tr=document.createElement('tr'),th=document.createElement('th');
 appendLabel(th,label,number);tr.append(th);
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
    const tr=document.createElement('tr'),th=document.createElement('th');tr.className='family';th.colSpan=key==='bullion'?4:3;appendLabel(th,first.label,first.number);tr.append(th);body.append(tr);
    for(const row of group)addRow(body,row.weight||row.label,[row.buy,row.sell,...(key==='bullion'?[row.delivery]:[])]);
   }
  }else for(const row of rows)addRow(body,row.label,[row.buy,row.sell,...(key==='goldBars'?[row.delivery]:[])],row.number);
  for(const header of section.querySelectorAll('[data-delivery]'))header.replaceChildren(document.createTextNode('Dostawa'),document.createElement('br'),document.createTextNode('w '+board.deliveryDays+' dni'));
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
function alignBullionBuyHeader(){
 const section=sections[0],header=section.querySelector('thead th:nth-child(2)');
 let label=header.querySelector('span');
 if(!label){label=document.createElement('span');label.textContent=header.textContent;header.replaceChildren(label);label.style.display='inline-block'}
 label.style.transform='';
 const starts=[...section.querySelectorAll('tbody tr:not(.family) td:first-of-type')].filter(cell=>cell.textContent!=='—').map(cell=>{const range=document.createRange();range.selectNodeContents(cell);return range.getBoundingClientRect().left});
 if(!starts.length)return;
 const board=document.querySelector('.board'),scale=board.getBoundingClientRect().width/board.offsetWidth;
 if(scale>0)label.style.transform='translateX('+((Math.min(...starts)-label.getBoundingClientRect().left)/scale)+'px)';
}
addEventListener('resize',()=>requestAnimationFrame(alignBullionBuyHeader));
function assessOverflow(){
 for(const section of sections){section.classList.remove('compact','dense');if(section.scrollHeight>section.clientHeight)section.classList.add('compact');if(section.scrollHeight>section.clientHeight)section.classList.add('dense')}
 alignBullionBuyHeader();
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
   const arrow=document.createElement('span');
   arrow.className='rate-arrow '+(item.change>0?'rate-up':item.change<0?'rate-down':'rate-flat');
   arrow.textContent=item.change>0?'↑':item.change<0?'↓':'↔';
   arrow.setAttribute('aria-label',item.change>0?'wzrost':item.change<0?'spadek':'bez zmian');
   target.replaceChildren(document.createTextNode((index?'Srebro 999':'Złoto 999,9')+' '),arrow,document.createTextNode(' '+spotMoney(item.spot)+'/g | '+spotMoney(item.spot*31.1034768)+'/oz'));
  });
  lastSuccess=data.fetchedAt;document.body.classList.remove('fetch-error');
  status.textContent=data.board?'':'WYMAGANE WDROŻENIE NOWEGO PANELU';
  if(assessOverflow())status.textContent+=(status.textContent?' • ':'')+'CZĘŚĆ TREŚCI NIE MIEŚCI SIĘ W KOLUMNACH';
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
