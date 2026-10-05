// Day notes (grown-ups only): a quick note about a child's day; that night's chapter weaves it in.
// Reached from Grown-ups on the games home (behind the same grown-ups question); a phone can remember it.
import {parentChallenge,parentAnswerMatches} from "./menu-options.mjs";
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
const KEY="family-daynotes-unlocked",FROM_KEY="family-daynotes-from",DAYS=30;
const store={get(k){try{return localStorage.getItem(k);}catch{return null;}},set(k,v){try{localStorage.setItem(k,v);}catch{}},del(k){try{localStorage.removeItem(k);}catch{}}};
let state={children:[],notes:[],today:""},child="both",from=store.get(FROM_KEY)==="mom"?"mom":"dad",gate=null,tries=0;

function unlocked(){const t=Number(store.get(KEY));return Number.isFinite(t)&&t>Date.now();}
function showGate(){gate=parentChallenge();$("#gate-question").textContent=gate.question;$("#gate-code").textContent=gate.code;$("#gate-answer").value="";$("#gate").hidden=false;$("#notes").hidden=true;}
$("#gate-form").onsubmit=e=>{e.preventDefault();
  if(!parentAnswerMatches(gate,$("#gate-answer").value)){tries++;$("#gate-error").textContent="Read the instruction and try again.";if(tries%3===0)showGate();return;}
  if($("#gate-remember").checked)store.set(KEY,String(Date.now()+DAYS*864e5));else store.del(KEY);
  $("#gate").hidden=true;void open();};

const nameOf=id=>id==="both"?"Both":(state.children.find(c=>c.id===id)?.name||id);
function chips(){
  const all=[...state.children,{id:"both",name:"Both"}];
  $("#children").innerHTML=all.map(c=>`<button type="button" class="chip" role="radio" data-child="${esc(c.id)}" aria-checked="${c.id===child}">${esc(c.name)}</button>`).join("");
  $("#children").querySelectorAll("[data-child]").forEach(b=>b.onclick=()=>{child=b.dataset.child;chips();});
  $("#from").querySelectorAll("[data-from]").forEach(b=>{b.setAttribute("aria-checked",String(b.dataset.from===from));b.onclick=()=>{from=b.dataset.from;store.set(FROM_KEY,from);chips();};});
}
function when(iso){try{return new Date(iso).toLocaleTimeString([], {hour:"numeric",minute:"2-digit"});}catch{return "";}}
function item(n){
  const used=Object.entries(n.used||{}).filter(([,d])=>d);
  const tags=[`<span class="tag">${esc(nameOf(n.child))}</span>`,
    n.memory?`<span class="tag memory">memory only</span>`:"",
    n.gentle?`<span class="tag memory">told gently</span>`:"",
    n.left?`<span class="tag memory">left out (private)</span>`:"",
    ...used.map(([p])=>`<span class="tag used">in ${esc(nameOf(p))}'s chapter</span>`)].join("");
  return `<li><div class="body"><p class="text">${esc(n.text)}</p><p class="meta">${tags}${n.from==="mom"?"Mom":n.from==="claude"?"via Claude":"Dad"} · ${esc(n.date===state.today?when(n.at):n.date)}</p></div><button type="button" data-remove="${esc(n.id)}" aria-label="Delete this note">✕</button></li>`;
}
function render(){
  $("#today").textContent=new Date(state.today+"T12:00:00").toLocaleDateString([], {weekday:"long",month:"long",day:"numeric"});
  const today=state.notes.filter(n=>n.date===state.today),earlier=state.notes.filter(n=>n.date!==state.today&&!n.memory&&!Object.keys(n.used||{}).length);
  $("#today-list").innerHTML=today.length?today.map(item).join(""):`<li class="empty">Nothing yet today.</li>`;
  $("#earlier-title").hidden=!earlier.length;$("#earlier-list").innerHTML=earlier.map(item).join("");
  document.querySelectorAll("[data-remove]").forEach(b=>b.onclick=()=>{if(confirm("Delete this note?"))void call({remove:b.dataset.remove});});
}
async function call(body){
  const r=await fetch("/api/daynotes",body?{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:{});
  const j=await r.json().catch(()=>({error:"Could not reach the games."}));
  if(!r.ok){$("#status").className="";$("#status").textContent=j.error||"Could not save.";return false;}
  state=j;render();return true;
}
async function open(){
  $("#notes").hidden=false;
  if(!(await call()))return;
  if(!state.children.some(c=>c.id===child))child="both";chips();
}
$("#note-form").onsubmit=async e=>{e.preventDefault();
  const text=$("#note-text").value.trim();if(!text){$("#status").textContent="Write a few words about the day.";$("#note-text").focus();return;}
  $("#save").disabled=true;
  try{if(await call({child,text,from,memory:$("#note-memory").checked})){$("#note-text").value="";$("#note-memory").checked=false;$("#status").className="ok";$("#status").textContent=`Saved for ${nameOf(child)}.`;}}
  finally{$("#save").disabled=false;}
};
if(unlocked())void open();else showGate();
