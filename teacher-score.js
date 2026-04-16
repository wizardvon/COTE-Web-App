import { db } from './firebase.js';
import {
  collection, doc, getDocs, getDoc, setDoc, query, orderBy, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';

const params = new URLSearchParams(location.search);
const schoolId = params.get('schoolId');
const termId = params.get('termId');
const classId = params.get('classId');

if (!schoolId || !termId || !classId) {
  alert('Missing school, term, or class ID');
} else {
  init();
}

const tableBody = document.getElementById('scoreBody');
const saveStatus = document.getElementById('saveStatus');
const pending = new Map(); // studentId -> {timer, data:{}}

function setStatus(txt) {
  if (saveStatus) saveStatus.textContent = txt;
}

async function init() {
  await loadRoster();
}

async function loadRoster() {
  const rosterRef = collection(db, `schools/${schoolId}/terms/${termId}/classes/${classId}/roster`);
  const snap = await getDocs(query(rosterRef, orderBy('name')));
  tableBody.innerHTML = '';
  for (const d of snap.docs) {
    const stu = { id: d.id, ...d.data() };
    const tr = document.createElement('tr');
    tr.dataset.student = stu.id;
    tr.dataset.lrn = stu.lrn || '';
    tr.innerHTML = `
      <td>${stu.name || ''}</td>
      <td>${stu.lrn || ''}</td>
      <td>${stu.sex || ''}</td>
      <td>${stu.birthdate || ''}</td>
      ${makeScoreCells('ww',10,stu.id)}
      ${makeScoreCells('pt',10,stu.id)}
      ${makeScoreCells('mp',10,stu.id)}
      ${makeScoreCells('dp',10,stu.id)}
    `;
    tableBody.appendChild(tr);
    await hydrateScores(stu.id);
  }
}

function makeScoreCells(type, count, studentId) {
  const cells = [];
  for (let i=1;i<=count;i++) {
    cells.push(`<td contenteditable="true" data-student="${studentId}" data-type="${type}" data-index="${i}"></td>`);
  }
  return cells.join('');
}

async function hydrateScores(studentId) {
  const ref = doc(db, `schools/${schoolId}/terms/${termId}/classes/${classId}/scoresheets/${studentId}`);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data();
  ['ww','pt','mp','dp'].forEach(cat => {
    const map = data[cat] || {};
    Object.entries(map).forEach(([i,v]) => {
      const cell = tableBody.querySelector(`td[data-student="${studentId}"][data-type="${cat}"][data-index="${i}"]`);
      if (cell) cell.textContent = v;
    });
  });
}

tableBody.addEventListener('input', e => {
  const cell = e.target;
  if (cell.tagName !== 'TD' || !cell.dataset.type) return;
  let val = cell.textContent.replace(/\D/g,'');
  if (val !== '') {
    val = Math.max(0, Math.min(100, parseInt(val,10)));
    cell.textContent = String(val);
  } else {
    cell.textContent = '';
  }
  scheduleSave(cell);
});

function scheduleSave(cell) {
  const studentId = cell.dataset.student;
  const type = cell.dataset.type;
  const index = cell.dataset.index;
  const row = cell.parentElement;
  const lrn = row.dataset.lrn || '';
  const value = cell.textContent === '' ? null : Number(cell.textContent);
  setStatus('Saving...');
  const item = pending.get(studentId) || { timer:null, data:{} };
  item.data[type] = { ...(item.data[type]||{}), [index]: value };
  if (item.timer) clearTimeout(item.timer);
  item.timer = setTimeout(() => flushSave(studentId, lrn), 800);
  pending.set(studentId, item);
}

async function flushSave(studentId, lrn) {
  const item = pending.get(studentId);
  if (!item) return;
  try {
    const ref = doc(db, `schools/${schoolId}/terms/${termId}/classes/${classId}/scoresheets/${studentId}`);
    await setDoc(ref, { lrn, ...item.data, updatedAt: serverTimestamp() }, { merge: true });
    setStatus('Saved');
  } catch(err) {
    console.error(err);
    setStatus('Save failed');
  } finally {
    pending.delete(studentId);
  }
}

