import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// Replace with your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDtaaCxT9tYXPwX3Pvoh_5pJosdmI1KEkM",
  authDomain: "cote-web-app.firebaseapp.com",
  projectId: "cote-web-app",
  storageBucket: "cote-web-app.appspot.com",
  messagingSenderId: "763908867537",
  appId: "1:763908867537:web:8611fb58fdaca485be0cf0",
  measurementId: "G-ZHZDZDGKQX"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let classSelection = null;
let currentClassInfo = {};
function getVal(id) { return document.getElementById(id)?.value.trim(); }
function validLRN(v) { return /^\d{12}$/.test(v); }
function validDate(v) { return /^\d{4}-\d{2}-\d{2}$/.test(v); }
window.addEventListener('class-selected', e => {
  classSelection = e.detail;
  loadSavedData();
});

export async function createSchool(name) {
  const existing = await getDocs(collection(db, 'schools'));
  const duplicate = existing.docs.some(d => d.data().name.toLowerCase() === name.toLowerCase());
  if (duplicate) { alert('School already exists'); return null; }
  const ref = doc(collection(db, 'schools'));
  await setDoc(ref, { name, ownerUid: auth.currentUser.uid });
  alert('School created');
  return ref.id;
}

export async function createTerm(schoolId, { name, startDate, endDate }) {
  const existing = await getDocs(collection(db, 'schools', schoolId, 'terms'));
  const duplicate = existing.docs.some(d => d.data().name.toLowerCase() === name.toLowerCase());
  if (duplicate) { alert('Term already exists'); return null; }
  const ref = doc(collection(db, 'schools', schoolId, 'terms'));
  await setDoc(ref, { name, startDate, endDate });
  alert('Term created');
  return ref.id;
}

export async function createClass(schoolId, termId, { name, gradeLevel, section }) {
  const ref = doc(collection(db, 'schools', schoolId, 'terms', termId, 'classes'));
  await setDoc(ref, { name, gradeLevel, section, teacherUid: auth.currentUser.uid });
  alert('Class created');
  return ref.id;
}

export async function addRosterRow(schoolId, termId, classId, data) {
  const ref = doc(collection(db, 'schools', schoolId, 'terms', termId, 'classes', classId, 'roster'));
  await setDoc(ref, { ...data, linkedUid: null, createdAt: Date.now() });
  alert('Student added');
}

// Event listeners for actions
document.getElementById('download').addEventListener('click', downloadCSV);
document.getElementById('save').addEventListener('click', saveTable);
document.getElementById('add-student-form').addEventListener('submit', async e => {
  e.preventDefault();
  if (!classSelection) { alert('Select class first'); return; }
  const data = {
    name: getVal('student-name'),
    lrn: getVal('student-lrn'),
    birthdate: getVal('student-birthdate'),
    sex: getVal('student-sex'),
    email: getVal('student-email') || null,
    guardianContact: getVal('guardian-contact') || null
  };
  if (!data.name || !validLRN(data.lrn) || !validDate(data.birthdate) || !data.sex) { alert('Invalid input'); return; }
  const { schoolId, termId, classId } = classSelection;
  await addRosterRow(schoolId, termId, classId, data);
  addStudentRow(data, currentClassInfo);
  e.target.reset();
});

// Initial counts for dynamic columns
let wwCount = 1;
let ptCount = 1;
let meritCount = 1;
let demeritCount = 1;

function addRow() {
  const tbody = document.getElementById('scores-body');
  const row = document.createElement('tr');
  let cells = `
    <td><input type="text" placeholder="Student Name"></td>
    <td><input type="text" placeholder="LRN"></td>
    <td><input type="text" placeholder="Grade-Section"></td>
    <td><input type="text" placeholder="Class"></td>
  `;

  for (let i = 0; i < wwCount; i++) {
    cells += `<td><input type="number" class="ww-input"></td>`;
  }
  cells += `<td><input type="number" class="ww-total" readonly></td>`;

  for (let i = 0; i < ptCount; i++) {
    cells += `<td><input type="number" class="pt-input"></td>`;
  }
  cells += `<td><input type="number" class="pt-total" readonly></td>`;

  for (let i = 0; i < meritCount; i++) {
    cells += `<td><input type="number" class="merit-input"></td>`;
  }
  cells += `<td><input type="number" class="merit-total" readonly></td>`;

  for (let i = 0; i < demeritCount; i++) {
    cells += `<td><input type="number" class="demerit-input"></td>`;
  }
  cells += `<td><input type="number" class="demerit-total" readonly></td>`;

  row.innerHTML = cells;
  tbody.appendChild(row);

  attachRowListeners(row);
  updateRowTotals(row);
  updateAddRowButton();
}

function addStudentRow(student, classInfo) {
  const tbody = document.getElementById('scores-body');
  const row = document.createElement('tr');
  let cells = `
    <td>${student.name || ''}</td>
    <td>${student.lrn || ''}</td>
    <td>${classInfo.gradeLevel || ''} - ${classInfo.section || ''}</td>
    <td>${classInfo.subject || ''} - ${classInfo.classCode || ''}</td>
  `;

  for (let i = 0; i < wwCount; i++) {
    cells += `<td><input type="number" class="ww-input"></td>`;
  }
  cells += `<td><input type="number" class="ww-total" readonly></td>`;

  for (let i = 0; i < ptCount; i++) {
    cells += `<td><input type="number" class="pt-input"></td>`;
  }
  cells += `<td><input type="number" class="pt-total" readonly></td>`;

  for (let i = 0; i < meritCount; i++) {
    cells += `<td><input type="number" class="merit-input"></td>`;
  }
  cells += `<td><input type="number" class="merit-total" readonly></td>`;

  for (let i = 0; i < demeritCount; i++) {
    cells += `<td><input type="number" class="demerit-input"></td>`;
  }
  cells += `<td><input type="number" class="demerit-total" readonly></td>`;

  row.innerHTML = cells;
  tbody.appendChild(row);
  attachRowListeners(row);
  updateRowTotals(row);
  updateAddRowButton();
}

function attachRowListeners(row) {
  row.querySelectorAll('.ww-input').forEach(input => input.addEventListener('input', () => updateRowTotals(row)));
  row.querySelectorAll('.pt-input').forEach(input => input.addEventListener('input', () => updateRowTotals(row)));
  row.querySelectorAll('.merit-input').forEach(input => input.addEventListener('input', () => updateRowTotals(row)));
  row.querySelectorAll('.demerit-input').forEach(input => input.addEventListener('input', () => updateRowTotals(row)));
}

function updateRowTotals(row) {
  const sum = selector => Array.from(row.querySelectorAll(selector)).reduce((acc, input) => acc + (parseFloat(input.value) || 0), 0);
  row.querySelector('.ww-total').value = sum('.ww-input');
  row.querySelector('.pt-total').value = sum('.pt-input');
  row.querySelector('.merit-total').value = sum('.merit-input');
  row.querySelector('.demerit-total').value = sum('.demerit-input');
}

function updateWWAddButton() {
  const header = document.getElementById('ww-group');
  header.style.position = 'relative';
  if (!header.querySelector('.add-col-btn')) {
    const btn = document.createElement('button');
    btn.textContent = '+';
    btn.className = 'add-col-btn';
    btn.addEventListener('click', addWWColumn);
    header.appendChild(btn);
  }
}

function updatePTAddButton() {
  const header = document.getElementById('pt-group');
  header.style.position = 'relative';
  if (!header.querySelector('.add-col-btn')) {
    const btn = document.createElement('button');
    btn.textContent = '+';
    btn.className = 'add-col-btn';
    btn.addEventListener('click', addPTColumn);
    header.appendChild(btn);
  }
}

function updateMeritAddButton() {
  const header = document.getElementById('merit-group');
  header.style.position = 'relative';
  if (!header.querySelector('.add-col-btn')) {
    const btn = document.createElement('button');
    btn.textContent = '+';
    btn.className = 'add-col-btn';
    btn.addEventListener('click', addMeritColumn);
    header.appendChild(btn);
  }
}

function updateDemeritAddButton() {
  const header = document.getElementById('demerit-group');
  header.style.position = 'relative';
  if (!header.querySelector('.add-col-btn')) {
    const btn = document.createElement('button');
    btn.textContent = '+';
    btn.className = 'add-col-btn';
    btn.addEventListener('click', addDemeritColumn);
    header.appendChild(btn);
  }
}

function updateAddRowButton() {
  const tbody = document.getElementById('scores-body');
  const existing = document.getElementById('add-row-btn-row');
  if (existing) existing.remove();
  const addRowRow = document.createElement('tr');
  addRowRow.id = 'add-row-btn-row';
  const totalColumns = 4 + (wwCount + 1) + (ptCount + 1) + (meritCount + 1) + (demeritCount + 1);
  const btnCell = document.createElement('td');
  btnCell.className = 'add-row-cell';
  const btn = document.createElement('button');
  btn.textContent = '+';
  btn.className = 'add-row-btn';
  btn.addEventListener('click', addRow);
  btnCell.appendChild(btn);
  addRowRow.appendChild(btnCell);
  const spacer = document.createElement('td');
  spacer.colSpan = totalColumns - 1;
  spacer.className = 'add-row-spacer';
  addRowRow.appendChild(spacer);
  tbody.appendChild(addRowRow);
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
  const maxPlaceholder = document.getElementById('ww-max-placeholder');
  const maxTh = document.createElement('th');
  const maxInput = document.createElement('input');
  maxInput.type = 'number';
  maxInput.className = 'ww-max';
  maxTh.appendChild(maxInput);
  maxRow.insertBefore(maxTh, maxPlaceholder);

  const rows = document.querySelectorAll('#scores-body tr');
  rows.forEach(row => {
    const totalCell = row.querySelector('.ww-total').parentElement;
    const td = document.createElement('td');
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'ww-input';
    input.addEventListener('input', () => updateRowTotals(row));
    td.appendChild(input);
    row.insertBefore(td, totalCell);
  });
  updateWWAddButton();
  updateAddRowButton();
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
  const maxPlaceholder = document.getElementById('pt-max-placeholder');
  const maxTh = document.createElement('th');
  const maxInput = document.createElement('input');
  maxInput.type = 'number';
  maxInput.className = 'pt-max';
  maxTh.appendChild(maxInput);
  maxRow.insertBefore(maxTh, maxPlaceholder);

  const rows = document.querySelectorAll('#scores-body tr');
  rows.forEach(row => {
    const totalCell = row.querySelector('.pt-total').parentElement;
    const td = document.createElement('td');
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'pt-input';
    input.addEventListener('input', () => updateRowTotals(row));
    td.appendChild(input);
    row.insertBefore(td, totalCell);
  });
  updatePTAddButton();
  updateAddRowButton();
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
  const maxPlaceholder = document.getElementById('merit-max-placeholder');
  const maxTh = document.createElement('th');
  const maxInput = document.createElement('input');
  maxInput.type = 'text';
  maxInput.className = 'merit-label';
  maxInput.maxLength = 4;
  maxTh.appendChild(maxInput);
  maxRow.insertBefore(maxTh, maxPlaceholder);

  const rows = document.querySelectorAll('#scores-body tr');
  rows.forEach(row => {
    const totalCell = row.querySelector('.merit-total').parentElement;
    const td = document.createElement('td');
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'merit-input';
    input.addEventListener('input', () => updateRowTotals(row));
    td.appendChild(input);
    row.insertBefore(td, totalCell);
  });
  updateMeritAddButton();
  updateAddRowButton();
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
  const maxPlaceholder = document.getElementById('demerit-max-placeholder');
  const maxTh = document.createElement('th');
  const maxInput = document.createElement('input');
  maxInput.type = 'text';
  maxInput.className = 'demerit-label';
  maxInput.maxLength = 4;
  maxTh.appendChild(maxInput);
  maxRow.insertBefore(maxTh, maxPlaceholder);

  const rows = document.querySelectorAll('#scores-body tr');
  rows.forEach(row => {
    const totalCell = row.querySelector('.demerit-total').parentElement;
    const td = document.createElement('td');
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'demerit-input';
    input.addEventListener('input', () => updateRowTotals(row));
    td.appendChild(input);
    row.insertBefore(td, totalCell);
  });
  updateDemeritAddButton();
  updateAddRowButton();
}

function downloadCSV() {
  const rows = document.querySelectorAll('#scores-table tr');
  const csv = Array.from(rows).map(row => {
    const cols = row.querySelectorAll('th, td');
    return Array.from(cols).map(col => {
      const input = col.querySelector('input');
      return input ? input.value : col.innerText;
    }).join(',');
  }).join('\n');

  const blob = new Blob([csv], { type: 'text/csv' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'scores.csv';
  link.click();
}

async function saveTable() {
  if (!classSelection) { alert('Select class first'); return; }
  const tableHTML = document.getElementById('scores-table').innerHTML;
  localStorage.setItem('scoresTable', tableHTML);
  localStorage.setItem('wwCount', wwCount);
  localStorage.setItem('ptCount', ptCount);
  localStorage.setItem('meritCount', meritCount);
  localStorage.setItem('demeritCount', demeritCount);
  try {
    const { schoolId, termId, classId } = classSelection;
    await setDoc(doc(db, 'schools', schoolId, 'terms', termId, 'classes', classId, 'scores', auth.currentUser.uid), {
      tableHTML,
      wwCount,
      ptCount,
      meritCount,
      demeritCount,
      updatedAt: Date.now()
    });
    alert('Scores saved');
  } catch (e) {
    console.error('Firebase save failed', e);
    alert('Scores saved locally');
  }
}

async function loadSavedData() {
  if (!classSelection) return;
  const { schoolId, termId, classId } = classSelection;
  const classDoc = await getDoc(doc(db, 'schools', schoolId, 'terms', termId, 'classes', classId));
  currentClassInfo = classDoc.exists() ? classDoc.data() : {};
  const saved = localStorage.getItem('scoresTable');
  if (saved) {
    document.getElementById('scores-table').innerHTML = saved;
    wwCount = parseInt(localStorage.getItem('wwCount')) || 1;
    ptCount = parseInt(localStorage.getItem('ptCount')) || 1;
    meritCount = parseInt(localStorage.getItem('meritCount')) || 1;
    demeritCount = parseInt(localStorage.getItem('demeritCount')) || 1;
  } else {
    try {
      const docSnap = await getDoc(doc(db, 'schools', schoolId, 'terms', termId, 'classes', classId, 'scores', auth.currentUser.uid));
      if (docSnap.exists()) {
        const data = docSnap.data();
        document.getElementById('scores-table').innerHTML = data.tableHTML || '';
        wwCount = data.wwCount || 1;
        ptCount = data.ptCount || 1;
        meritCount = data.meritCount || 1;
        demeritCount = data.demeritCount || 1;
      } else {
        const rosterSnap = await getDocs(collection(db, 'schools', schoolId, 'terms', termId, 'classes', classId, 'roster'));
        rosterSnap.forEach(r => addStudentRow(r.data(), currentClassInfo));
        if (rosterSnap.size === 0) addRow();
      }
    } catch (e) {
      console.error('Firebase load failed', e);
      addRow();
    }
  }
  document.querySelectorAll('#scores-body tr').forEach(row => {
    attachRowListeners(row);
    updateRowTotals(row);
  });
  document.querySelectorAll('#ww-group .add-col-btn').forEach(btn => btn.addEventListener('click', addWWColumn));
  document.querySelectorAll('#pt-group .add-col-btn').forEach(btn => btn.addEventListener('click', addPTColumn));
  document.querySelectorAll('#merit-group .add-col-btn').forEach(btn => btn.addEventListener('click', addMeritColumn));
  document.querySelectorAll('#demerit-group .add-col-btn').forEach(btn => btn.addEventListener('click', addDemeritColumn));
  updateAddRowButton();
  updateWWAddButton();
  updatePTAddButton();
  updateMeritAddButton();
  updateDemeritAddButton();
}

// Initialize
