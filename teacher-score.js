import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDtaaCxT9tYXPwX3Pvoh_5pJosdmI1KEkM",
  authDomain: "cote-web-app.firebaseapp.com",
  projectId: "cote-web-app",
  storageBucket: "cote-web-app.appspot.com",
  messagingSenderId: "763908867537",
  appId: "1:763908867537:web:8611fb58fdaca485be0cf0",
  measurementId: "G-ZHZDZDGKQX",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const params = new URLSearchParams(window.location.search);
const schoolId = params.get('schoolId');
const termId = params.get('termId');
const classId = params.get('classId');
if (!schoolId || !termId || !classId) {
  window.location.href = 'teacher.html';
}

let wwCount = 1, ptCount = 1, meritCount = 1, demeritCount = 1;

function validLRN(v) { return /^\d{12}$/.test(v); }
function validDate(v) { return /^\d{4}-\d{2}-\d{2}$/.test(v); }

function attachRowListeners(row) {
  row.querySelectorAll('.ww-input').forEach(i => i.addEventListener('input', () => updateRowTotals(row)));
  row.querySelectorAll('.pt-input').forEach(i => i.addEventListener('input', () => updateRowTotals(row)));
  row.querySelectorAll('.merit-input').forEach(i => i.addEventListener('input', () => updateRowTotals(row)));
  row.querySelectorAll('.demerit-input').forEach(i => i.addEventListener('input', () => updateRowTotals(row)));
}

function updateRowTotals(row) {
  const sum = sel => Array.from(row.querySelectorAll(sel)).reduce((acc, el) => acc + (parseFloat(el.value) || 0), 0);
  const wwTotal = row.querySelector('.ww-total');
  const ptTotal = row.querySelector('.pt-total');
  const meritTotal = row.querySelector('.merit-total');
  const demeritTotal = row.querySelector('.demerit-total');
  if (wwTotal) wwTotal.value = sum('.ww-input');
  if (ptTotal) ptTotal.value = sum('.pt-input');
  if (meritTotal) meritTotal.value = sum('.merit-input');
  if (demeritTotal) demeritTotal.value = sum('.demerit-input');
}

function addStudentRow(student) {
  const tbody = document.getElementById('scores-body');
  const tr = document.createElement('tr');
  let cells = `
    <td>${student.name || ''}</td>
    <td>${student.lrn || ''}</td>
    <td>${student.birthdate || ''}</td>
    <td>${student.sex || ''}</td>
  `;
  for (let i = 0; i < wwCount; i++) cells += `<td><input type="number" class="ww-input"></td>`;
  cells += `<td><input type="number" class="ww-total" readonly></td>`;
  for (let i = 0; i < ptCount; i++) cells += `<td><input type="number" class="pt-input"></td>`;
  cells += `<td><input type="number" class="pt-total" readonly></td>`;
  for (let i = 0; i < meritCount; i++) cells += `<td><input type="number" class="merit-input"></td>`;
  cells += `<td><input type="number" class="merit-total" readonly></td>`;
  for (let i = 0; i < demeritCount; i++) cells += `<td><input type="number" class="demerit-input"></td>`;
  cells += `<td><input type="number" class="demerit-total" readonly></td>`;
  tr.innerHTML = cells;
  tbody.appendChild(tr);
  attachRowListeners(tr);
  updateRowTotals(tr);
}

async function loadPageInfo() {
  const classInfoEl = document.getElementById('class-info');
  const schoolSnap = await getDoc(doc(db, 'schools', schoolId));
  const termSnap = await getDoc(doc(db, 'schools', schoolId, 'terms', termId));
  const classSnap = await getDoc(doc(db, 'schools', schoolId, 'terms', termId, 'classes', classId));
  const schoolName = schoolSnap.exists() ? schoolSnap.data().name : schoolId;
  const termName = termSnap.exists() ? termSnap.data().name : termId;
  const className = classSnap.exists() ? classSnap.data().name : classId;
  classInfoEl.textContent = `School: ${schoolName} • Term: ${termName} • Class: ${className}`;
}

async function loadRoster() {
  const rosterSnap = await getDocs(collection(db, 'schools', schoolId, 'terms', termId, 'classes', classId, 'roster'));
  rosterSnap.docs.forEach(d => addStudentRow(d.data()));
}

function restoreTable(data) {
  const table = document.getElementById('scores-table');
  table.innerHTML = data.tableHTML;
  wwCount = data.wwCount || 1;
  ptCount = data.ptCount || 1;
  meritCount = data.meritCount || 1;
  demeritCount = data.demeritCount || 1;
  document.querySelectorAll('#scores-body tr').forEach(tr => {
    attachRowListeners(tr);
    updateRowTotals(tr);
  });
}

async function loadScores() {
  const ref = doc(db, 'schools', schoolId, 'terms', termId, 'classes', classId, 'scores', auth.currentUser.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    restoreTable(snap.data());
  } else {
    await loadRoster();
  }
}

async function saveTable() {
  const tableHTML = document.getElementById('scores-table').innerHTML;
  const ref = doc(db, 'schools', schoolId, 'terms', termId, 'classes', classId, 'scores', auth.currentUser.uid);
  await setDoc(ref, { tableHTML, wwCount, ptCount, meritCount, demeritCount, updatedAt: Date.now() });
  alert('Saved');
}

function downloadCSV() {
  const rows = Array.from(document.querySelectorAll('#scores-table tr')).map(tr =>
    Array.from(tr.children).map(td => td.querySelector('input') ? td.querySelector('input').value : td.textContent)
  );
  const csv = rows.map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'scores.csv';
  link.click();
}

async function handleAddStudent(e) {
  e.preventDefault();
  const data = {
    name: document.getElementById('student-name').value.trim(),
    lrn: document.getElementById('student-lrn').value.trim(),
    birthdate: document.getElementById('student-birthdate').value.trim(),
    sex: document.getElementById('student-sex').value,
    email: document.getElementById('student-email').value.trim() || null,
    guardianContact: document.getElementById('guardian-contact').value.trim() || null,
    linkedUid: null,
    createdAt: Date.now()
  };
  if (!data.name || !validLRN(data.lrn) || !validDate(data.birthdate) || !data.sex) {
    alert('Invalid input');
    return;
  }
  const rosterRef = doc(collection(db, 'schools', schoolId, 'terms', termId, 'classes', classId, 'roster'));
  await setDoc(rosterRef, data);
  addStudentRow(data);
  e.target.reset();
}

document.getElementById('add-student-form').addEventListener('submit', handleAddStudent);
document.getElementById('save').addEventListener('click', saveTable);
document.getElementById('download').addEventListener('click', downloadCSV);

loadPageInfo();
loadScores();
