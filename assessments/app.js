'use strict';
const $ = id => document.getElementById(id);
function node(tag, text) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  return element;
}
function options(select, pairs) {
  const previous = select.value;
  select.replaceChildren(...pairs.map(([value, label]) => new Option(label, value)));
  if (pairs.some(([value]) => value === previous)) select.value = previous;
}
function shuffled(items) {
  const copy = [...items];
  for (let i=copy.length-1; i>0; i--) {
    const j = Math.floor(Math.random()*(i+1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
// Take one question per lesson on each pass so larger pools do not crowd out smaller ones.
function sample(pool, limit) {
  const buckets = new Map();
  for (const q of shuffled(pool)) {
    if (!buckets.has(q.lessonKey)) buckets.set(q.lessonKey, []);
    buckets.get(q.lessonKey).push(q);
  }
  const result = [];
  while (buckets.size && result.length < limit) {
    for (const [key, rows] of buckets) {
      result.push(rows.pop());
      if (!rows.length) buckets.delete(key);
      if (result.length === limit) break;
    }
  }
  return result;
}
let lessons = [], bank = [], topics = [], session;
const covered = new Set();
const papers = level => ['Computer systems',level === 'GCSE' ? 'Computational thinking, algorithms and programming' : 'Algorithms and programming'];
function loadTopics(data) {
  topics = data;
  for (const t of data) {
    t.lessons.forEach((name,index) => lessons.push({key:t.id+'-'+index,name,unit:t.unit,paper:t.paper,level:t.level}));
    const practice = [{...t.practice,id:t.id+'-practice'}, ...(t.extraPractice || [])];
    for (const q of [...t.questions, ...practice]) bank.push({...q, lessonKey:t.id+'-'+q.lesson, topic:t.id, marks:q.marks || 1, level:t.level, unit:t.unit, paper:t.paper, lessonTitle:t.lessons[q.lesson]});
  }
}
function focusLessons() {
  return lessons.filter(l => l.level === $('spec').value && l.paper === Number($('component').value) &&
    ($('scope').value === 'paper' || l.unit === $('unit').value) &&
    ($('scope').value !== 'lesson' || l.key === $('lesson').value));
}
function pools() {
  const focus = new Set(focusLessons().map(l => l.key));
  const permitted = bank.filter(q => q.level === $('spec').value && ($('mode').value !== 'summative' || !q.answer));
  const current = permitted.filter(q => focus.has(q.lessonKey));
  const prior = $('cum').checked && $('scope').value !== 'paper' ?
    permitted.filter(q => !focus.has(q.lessonKey) && covered.has(q.lessonKey)) : [];
  return {current,prior};
}
function reviewCount(current,prior) {return Math.min(prior.length, Math.ceil(current.length / 2));}
function refreshSummary() {
  const {current,prior} = pools();
  const n = reviewCount(current,prior);
  const paper = $('scope').value === 'paper';
  const needPrior = !paper && $('cum').checked && !n;
  $('build').disabled = !current.length || needPrior;
  $('build').textContent = $('mode').value === 'practice' ? 'Start practice' : 'Start summative assessment';
  $('summary').textContent = paper ? current.length+' questions across the lessons currently available for this paper. This is a topic-bank paper, with no official exam timing or weighting.' :
    current.length+' current questions' + ($('cum').checked ? ' + '+n+' earlier questions. '+(needPrior?'Choose at least one previously taught lesson.':'Up to one review question for every two current questions.') : '.');
}
function controls() {
  const level = $('spec').value, scope = $('scope').value;
  options($('component'),papers(level).map((s,i)=>[String(i+1),'Paper '+(i+1)+' · '+s]));
  const list = lessons.filter(l=>l.level===level && l.paper===Number($('component').value));
  options($('unit'),[...new Set(list.map(l=>l.unit))].map(u=>[u,u]));
  options($('lesson'),list.filter(l=>l.unit===$('unit').value).map(l=>[l.key,l.name]));
  $('unitField').hidden = scope==='paper';
  $('lessonField').hidden = scope!=='lesson';
  $('mix').hidden = scope==='paper';
  $('history').hidden = !$('cum').checked;
  const focus = new Set(focusLessons().map(l=>l.key));
  const groups=new Map();
  $('past').replaceChildren();
  for(const l of lessons.filter(l=>l.level===level && !focus.has(l.key))) {
    if(!groups.has(l.unit)){
      const group=node('details');group.append(node('summary',l.unit));groups.set(l.unit,group);$('past').append(group);
    }
    const label=node('label'), input=node('input');input.type='checkbox';input.checked=covered.has(l.key);
    input.onchange=()=>{if(input.checked)covered.add(l.key);else covered.delete(l.key);refreshSummary()};
    label.append(input,' '+l.name);groups.get(l.unit).append(label);
  }
  $('networkActivity').hidden = !(level === 'GCSE' && scope === 'lesson' && $('lesson').value === 'PX-J277-T06-0');
  refreshSummary();
}
function showSession(title, rows, mode, reviewIDs=new Set()) {
  $('networkActivity').hidden=true;
  session={title,rows,mode,answers:new Map()};
  $('builder').hidden=true;$('session').hidden=false;$('sessionTitle').textContent=title;
  $('meta').textContent=mode+' · '+rows.length+' questions · '+rows.reduce((a,q)=>a+q.marks,0)+' marks';
  $('instructions').textContent='Download your responses before changing selection or leaving the page. Written answers are teacher-marked.';
  $('items').replaceChildren();
  for(const [i,q] of rows.entries()){
    const card=node('section');card.className='card';
    const section=reviewIDs.has(q.id)?'Earlier learning · ':'';
    card.append(node('small',section+q.lessonTitle+' · '+q.marks+(q.marks===1?' mark':' marks')));
    const heading=node('h3','Q'+(i+1)+'. '+q.prompt);heading.id='prompt-'+q.id;card.append(heading);
    const copy=node('p');copy.className='printAnswer';
    function record(value){session.answers.set(q.id,value);copy.textContent=value}
    if(q.options){
      const group=node('div');group.setAttribute('role','radiogroup');group.setAttribute('aria-labelledby',heading.id);
      const feedback=node('p');feedback.setAttribute('role','status');feedback.className='feedback';
      for(const choice of q.options){const label=node('label');label.className='choice';const radio=node('input');radio.type='radio';radio.name=q.id;radio.onchange=()=>{record(choice);feedback.textContent=''};label.append(radio,' '+choice);group.append(label)}
      card.append(group);
      if(q.answer && mode==='Practice'){const check=node('button','Check answer');check.onclick=()=>{const value=session.answers.get(q.id);feedback.textContent=!value?'Choose an answer first.':(value===q.answer?'Correct. ':'Review your answer. ')+q.explanation};card.append(check,feedback)}
    }else{const field=node('textarea');field.setAttribute('aria-labelledby',heading.id);field.oninput=()=>record(field.value);card.append(field)}
    card.append(copy);$('items').append(card);
  }
  $('sessionTitle').tabIndex=-1;$('sessionTitle').focus();window.scrollTo(0,0);
}
$('builder').onsubmit=e=>{
  e.preventDefault();if($('build').disabled)return;
  const {current,prior}=pools(),review=sample(prior,reviewCount(current,prior));
  const scope=$('scope').value;
  const title=scope==='lesson'?focusLessons()[0].name:scope==='unit'?$('unit').value:$('component').selectedOptions[0].text;
  const mode=$('mode').value==='practice'?'Practice':'Summative assessment';
  showSession($('spec').value+' · '+title,review.length?shuffled([...current,...review]):current,mode,new Set(review.map(q=>q.id)));
};
$('networkActivity').ontoggle=()=>{
  if(!$('networkActivity').open || $('networkActivity').querySelector('iframe'))return;
  const frame=node('iframe');frame.src='network-threats.html';frame.title='Year 11 Network Threats practice and final assessment';
  $('networkActivity').append(frame);
};
function setup(){session=null;$('session').hidden=true;$('builder').hidden=false;controls()}
$('back').onclick=()=>{
  if(session.answers.size && !window.confirm('Leave these responses? Download them first if you want to keep them.'))return;
  history.replaceState(null,'',location.pathname+location.search);setup();$('spec').focus();
};
$('print').onclick=()=>window.print();
$('download').onclick=()=>{
  const {title,mode,answers,rows}=session;
  const lines=[title,mode,...rows.map((q,i)=>'Q'+(i+1)+'. '+q.prompt+' ['+q.marks+']\n'+(answers.get(q.id)||'(unanswered)'))];
  const url=URL.createObjectURL(new Blob([lines.join('\n\n')],{type:'text/plain;charset=utf-8'}));
  const link=node('a');link.href=url;link.download=title.replace(/[^a-z0-9]+/gi,'-')+'-responses.txt';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
function route(){
  setup();const hash=location.hash.slice(1);
  if(hash==='alevel'||hash==='gcse'){$('spec').value=hash==='alevel'?'A Level':'GCSE';controls()}
  const old=topics.find(t=>t.id===hash);
  if(old){$('spec').value=old.level;controls();showSession(old.title,bank.filter(q=>q.topic===old.id),'Practice')}
}
async function init(){
  const response=await fetch('questions.json');if(!response.ok)throw Error('bank');
  loadTopics(await response.json());$('status').hidden=true;
  for(const id of ['spec','scope','component','unit','lesson','mode','cum'])$(id).onchange=controls;
  window.addEventListener('hashchange',route);route();
}
init().catch(()=>{$('status').hidden=false;$('status').textContent='Questions could not load. Refresh the page to try again.'});
