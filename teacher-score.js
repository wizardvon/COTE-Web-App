import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
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

const params = new URLSearchParams(location.search);
const schoolId = params.get('schoolId');
const termId = params.get('termId');
const classId = params.get('classId');
if (!schoolId || !termId || !classId) location.href = 'teacher.html';

document.getElementById('class-path').textContent = `School ID: ${schoolId} • Term ID: ${termId} • Class ID: ${classId}`;

let wwCount = 1, ptCount = 1, meritCount = 1, demeritCount = 1;

function ensureAddButtons() {
  const groups = [
    { id: 'ww-group', handler: addWWColumn },
    { id: 'pt-group', handler: addPTColumn },
    { id: 'merit-group', handler: addMeritColumn },
    { id: 'demerit-group', handler: addDemeritColumn }
  ];
  groups.forEach(g => {
    const header = document.getElementById(g.id);
    let btn = header.querySelector('.add-col-btn');
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = '+';
      btn.className = 'add-col-btn';
      header.appendChild(btn);
    }
    btn.onclick = g.handler;
  });
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

function attachRowListeners(row) {
  row.querySelectorAll('.ww-input').forEach(i => i.addEventListener('input', () => updateRowTotals(row)));
  row.querySelectorAll('.pt-input').forEach(i => i.addEventListener('input', () => updateRowTotals(row)));
  row.querySelectorAll('.merit-input').forEach(i => i.addEventListener('input', () => updateRowTotals(row)));
  row.querySelectorAll('.demerit-input').forEach(i => i.addEventListener('input', () => updateRowTotals(row)));
}

function addRowFromRosterEntry({ name, lrn, birthdate, sex }) {
  const tbody = document.getElementById('scores-body');
  const tr = document.createElement('tr');
  let cells = `
    <td>${name || ''}</td>
    <td>${lrn || ''}</td>
    <td>${birthdate || ''}</td>
    <td>${sex || ''}</td>
  `;
  for (let i = 0; i < wwCount; i++) cells += '<td><input type="number" class="ww-input"></td>';
  cells += '<td><input type="number" class="ww-total" readonly></td>';
  for (let i = 0; i < ptCount; i++) cells += '<td><input type="number" class="pt-input"></td>';
  cells += '<td><input type="number" class="pt-total" readonly></td>';
  for (let i = 0; i < meritCount; i++) cells += '<td><input type="number" class="merit-input"></td>';
  cells += '<td><input type="number" class="merit-total" readonly></td>';
  for (let i = 0; i < demeritCount; i++) cells += '<td><input type="number" class="demerit-input"></td>';
  cells += '<td><input type="number" class="demerit-total" readonly></td>';
  tr.innerHTML = cells;
  tbody.appendChild(tr);
  attachRowListeners(tr);
  updateRowTotals(tr);
}

function addWWColumn() {
  wwCount++;
  const subHeader = document.getElementById('sub-header');
  const totalHeader = document.getElementById('ww-total-header');
  const th = document.createElement('th');
  th.className = 'ww-header';
  th.textContent = `W${wwCount}`;
  subHeader.insertBefore(th, totalHeader);
  document.getElementById('ww-group').colSpan = wwCount + 1;
  const maxRow = document.getElementById('max-row');
  const placeholder = document.getElementById('ww-max-placeholder');
  const thMax = document.createElement('th');
  const inputMax = document.createElement('input');
  inputMax.type = 'number';
  inputMax.className = 'ww-max';
  thMax.appendChild(inputMax);
  maxRow.insertBefore(thMax, placeholder);
  document.querySelectorAll('#scores-body tr').forEach(row => {
    const totalCell = row.querySelector('.ww-total').parentElement;
    const td = document.createElement('td');
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'ww-input';
    td.appendChild(input);
    row.insertBefore(td, totalCell);
    input.addEventListener('input', () => updateRowTotals(row));
  });
}

function addPTColumn() {
  ptCount++;
  const subHeader = document.getElementById('sub-header');
  const totalHeader = document.getElementById('pt-total-header');
  const th = document.createElement('th');
  th.className = 'pt-header';
  th.textContent = `PT${ptCount}`;
  subHeader.insertBefore(th, totalHeader);
  document.getElementById('pt-group').colSpan = ptCount + 1;
  const maxRow = document.getElementById('max-row');
  const placeholder = document.getElementById('pt-max-placeholder');
  const thMax = document.createElement('th');
  const inputMax = document.createElement('input');
  inputMax.type = 'number';
  inputMax.className = 'pt-max';
  thMax.appendChild(inputMax);
  maxRow.insertBefore(thMax, placeholder);
  document.querySelectorAll('#scores-body tr').forEach(row => {
    const totalCell = row.querySelector('.pt-total').parentElement;
    const td = document.createElement('td');
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'pt-input';
    td.appendChild(input);
    row.insertBefore(td, totalCell);
    input.addEventListener('input', () => updateRowTotals(row));
  });
}

function addMeritColumn() {
  meritCount++;
  const subHeader = document.getElementById('sub-header');
  const totalHeader = document.getElementById('merit-total-header');
  const th = document.createElement('th');
  th.className = 'merit-header';
  th.textContent = `M${meritCount}`;
  subHeader.insertBefore(th, totalHeader);
  document.getElementById('merit-group').colSpan = meritCount + 1;
  const maxRow = document.getElementById('max-row');
  const placeholder = document.getElementById('merit-max-placeholder');
  const thMax = document.createElement('th');
  const inputMax = document.createElement('input');
  inputMax.type = 'text';
  inputMax.className = 'merit-label';
  inputMax.maxLength = 4;
  thMax.appendChild(inputMax);
  maxRow.insertBefore(thMax, placeholder);
  document.querySelectorAll('#scores-body tr').forEach(row => {
    const totalCell = row.querySelector('.merit-total').parentElement;
    const td = document.createElement('td');
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'merit-input';
    td.appendChild(input);
    row.insertBefore(td, totalCell);
    input.addEventListener('input', () => updateRowTotals(row));
  });
}

function addDemeritColumn() {
  demeritCount++;
  const subHeader = document.getElementById('sub-header');
  const totalHeader = document.getElementById('demerit-total-header');
  const th = document.createElement('th');
  th.className = 'demerit-header';
  th.textContent = `D${demeritCount}`;
  subHeader.insertBefore(th, totalHeader);
  document.getElementById('demerit-group').colSpan = demeritCount + 1;
  const maxRow = document.getElementById('max-row');
  const placeholder = document.getElementById('demerit-max-placeholder');
  const thMax = document.createElement('th');
  const inputMax = document.createElement('input');
  inputMax.type = 'text';
  inputMax.className = 'demerit-label';
  inputMax.maxLength = 4;
  thMax.appendChild(inputMax);
  maxRow.insertBefore(thMax, placeholder);
  document.querySelectorAll('#scores-body tr').forEach(row => {
    const totalCell = row.querySelector('.demerit-total').parentElement;
    const td = document.createElement('td');
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'demerit-input';
    td.appendChild(input);
    row.insertBefore(td, totalCell);
    input.addEventListener('input', () => updateRowTotals(row));
  });
}

async function loadScoresAndRoster() {
  const scoreRef = doc(db, 'schools', schoolId, 'terms', termId, 'classes', classId, 'scores', auth.currentUser.uid);
  const snap = await getDoc(scoreRef);
  if (snap.exists()) {
    const data = snap.data();
    document.getElementById('scores-table').innerHTML = data.tableHTML;
    wwCount = data.wwCount || 1;
    ptCount = data.ptCount || 1;
    meritCount = data.meritCount || 1;
    demeritCount = data.demeritCount || 1;
    document.querySelectorAll('#scores-body tr').forEach(row => { attachRowListeners(row); updateRowTotals(row); });
    ensureAddButtons();
    const rosterSnap = await getDocs(collection(db, 'schools', schoolId, 'terms', termId, 'classes', classId, 'roster'));
    const existingLRNs = new Set(Array.from(document.querySelectorAll('#scores-body tr td:nth-child(2)')).map(td => td.textContent.trim()));
    rosterSnap.forEach(d => {
      const r = d.data();
      if (!existingLRNs.has(String(r.lrn || ''))) {
        addRowFromRosterEntry({ name: r.name, lrn: r.lrn, birthdate: r.birthdate, sex: r.sex });
      }
    });
  } else {
    const rosterSnap = await getDocs(collection(db, 'schools', schoolId, 'terms', termId, 'classes', classId, 'roster'));
    rosterSnap.forEach(d => {
      const r = d.data();
      addRowFromRosterEntry({ name: r.name, lrn: r.lrn, birthdate: r.birthdate, sex: r.sex });
    });
    ensureAddButtons();
  }
}

function validLRN(v) { return /^\d{12}$/.test(v); }
function validDate(v) { return /^\d{4}-\d{2}-\d{2}$/.test(v); }

document.getElementById('add-student-form').addEventListener('submit', async e => {
  e.preventDefault();
  const name = document.getElementById('student-name').value.trim();
  const lrn = document.getElementById('student-lrn').value.trim();
  const birthdate = document.getElementById('student-birthdate').value.trim();
  const sex = document.getElementById('student-sex').value;
  const email = document.getElementById('student-email').value.trim() || null;
  const guardianContact = document.getElementById('guardian-contact').value.trim() || null;
  if (!name || !validLRN(lrn) || !validDate(birthdate) || !sex) { alert('Invalid input'); return; }
  const rosterRef = doc(collection(db, 'schools', schoolId, 'terms', termId, 'classes', classId, 'roster'));
  await setDoc(rosterRef, { name, lrn, birthdate, sex, email, guardianContact, linkedUid: null, createdAt: Date.now() });
  addRowFromRosterEntry({ name, lrn, birthdate, sex });
  e.target.reset();
});

document.getElementById('save').addEventListener('click', async () => {
  const tableHTML = document.getElementById('scores-table').innerHTML;
  const ref = doc(db, 'schools', schoolId, 'terms', termId, 'classes', classId, 'scores', auth.currentUser.uid);
  await setDoc(ref, { tableHTML, wwCount, ptCount, meritCount, demeritCount, updatedAt: Date.now() });
  alert('Saved');
});

document.getElementById('download').addEventListener('click', () => {
  const rows = Array.from(document.querySelectorAll('#scores-table tr')).map(tr =>
    Array.from(tr.children).map(td => td.querySelector('input') ? td.querySelector('input').value : td.textContent)
  );
  const csv = rows.map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'scores.csv';
  link.click();
});

await new Promise(resolve => {
  const unsub = onAuthStateChanged(auth, user => {
    if (user) { unsub(); resolve(); }
  });
});

await loadScoresAndRoster();
