'use strict';
const byId = id => document.getElementById(id);
const el = (tag, text) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  return node;
};
const drafts = new Map();
let tests = [];
let current;
function openTest(test) {
  current = test;
  byId('catalog').hidden = true;
  byId('paper').hidden = false;
  byId('title').textContent = test.title;
  const marks = test.questions.reduce((sum, q) => sum + q.marks, 0);
  byId('course').textContent = test.level + ' · ' + test.questions.length + ' questions · ' + marks + ' marks';
  const practice = test.practice;
  const choices = el('fieldset');
  choices.append(el('legend', practice.prompt));
  for (const option of practice.options) {
    const label = el('label');
    const radio = el('input');
    radio.type = 'radio'; radio.name = 'practice'; radio.value = option;
    label.append(radio, ' ' + option); choices.append(label);
  }
  const check = el('button','Check practice answer');
  const feedback = el('p');
  feedback.setAttribute('role','status');
  check.onclick = () => {
    const chosen = choices.querySelector('input:checked');
    feedback.textContent = !chosen ? 'Choose an answer first.' :
      (chosen.value === practice.answer ? 'Correct. ' : 'Review your answer. ') + practice.explanation;
  };
  byId('practice').replaceChildren(choices, check, feedback);
  byId('questions').replaceChildren();
  for (const [i,q] of test.questions.entries()) {
    const card = el('section'); card.className = 'card';
    const label = el('label', q.prompt); label.htmlFor = q.id;
    const input = el('textarea'); input.id = q.id; input.value = drafts.get(q.id) || '';
    const copy = el('p', input.value); copy.className = 'print-answer';
    input.oninput = () => { drafts.set(q.id, input.value); copy.textContent = input.value; };
    card.append(el('small', 'Q' + (i+1) + ' · ' + q.difficulty + ' · ' + q.marks + (q.marks === 1 ? ' mark' : ' marks')), label, input, copy);
    byId('questions').append(card);
  }
}
function route() {
  const hash = location.hash.slice(1);
  const match = tests.find(t => t.id === hash);
  if (match) { openTest(match); window.scrollTo(0,0); return; }
  current = null;
  byId('paper').hidden = true;
  byId('catalog').hidden = false;
  if (hash === 'gcse' || hash === 'alevel') byId(hash).scrollIntoView();
}
byId('save').onclick = () => {
  if (!current) return;
  const lines = [current.level + ' · ' + current.title, ...current.questions.map((q,i) =>
    'Q' + (i+1) + '. ' + q.prompt + '\n' + (drafts.get(q.id) || '(unanswered)'))];
  const url = URL.createObjectURL(new Blob([lines.join('\n\n')],{type:'text/plain;charset=utf-8'}));
  const a = el('a'); a.href = url; a.download = current.id + '-responses.txt'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
async function start() {
  const response = await fetch('questions.json');
  if (!response.ok) throw Error('load');
  tests = await response.json();
  for (const t of tests) {
    const link = el('a', t.title); link.href = '#' + t.id;
    link.append(el('small', t.questions.length + ' assessment questions + practice'));
    byId(t.level === 'GCSE' ? 'gcse' : 'alevel').querySelector('.topics').append(link);
  }
  const extra = el('a','Year 11 · Network Threats');
  extra.href = 'network-threats.html'; extra.append(el('small','18 practice questions · 20-mark final'));
  byId('gcse').querySelector('.topics').append(extra);
  byId('status').hidden = true; window.addEventListener('hashchange', route); route();
}
start().catch(() => { byId('status').textContent = 'The assessment bank could not load. Refresh the page to try again.'; });
