import { db } from './firebase.js';
import { collection, getDocs } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';

const params = new URLSearchParams(window.location.search);
const schoolId = params.get('school');
const termId = params.get('term');
const classId = params.get('class');
const storageKey = classId ? `teacherScoreData_${classId}` : 'teacherScoreData';

const tableBody = document.getElementById('studentTable').getElementsByTagName('tbody')[0];
let history = [];
const totalColumns = document.querySelector('#studentTable thead tr:nth-child(2)').cells.length;

async function loadRoster() {
  if (!schoolId || !termId || !classId) return;
  tableBody.innerHTML = '';
  const snap = await getDocs(collection(db, 'schools', schoolId, 'terms', termId, 'classes', classId, 'roster'));
  snap.forEach(docSnap => {
    const s = docSnap.data();
    const row = tableBody.insertRow();
    const vals = [s.name || '', s.lrn || '', s.sex || '', s.birthdate || ''];
    vals.forEach(v => {
      const cell = row.insertCell();
      cell.textContent = v;
    });
    for (let i = vals.length; i < totalColumns; i++) {
      const cell = row.insertCell();
      cell.contentEditable = 'true';
    }
  });
  loadScores();
}

function saveData() {
  const data = [];
  for (const row of tableBody.rows) {
    const rowData = [];
    for (let i = 4; i < row.cells.length; i++) {
      rowData.push(row.cells[i].innerText);
    }
    data.push(rowData);
  }
  localStorage.setItem(storageKey, JSON.stringify(data));
}

function loadScores() {
  const data = JSON.parse(localStorage.getItem(storageKey));
  if (!data) return;
  data.forEach((rowData, rIdx) => {
    const row = tableBody.rows[rIdx];
    if (!row) return;
    rowData.forEach((cellData, cIdx) => {
      const cell = row.cells[cIdx + 4];
      if (cell) cell.innerText = cellData;
    });
  });
}

function addRow() {
  const row = tableBody.insertRow();
  for (let i = 0; i < totalColumns; i++) {
    const cell = row.insertCell();
    if (i >= 4) cell.contentEditable = 'true';
  }
  saveData();
}

function undo() {
  if (history.length > 0) {
    tableBody.innerHTML = history.pop();
    saveData();
  }
}

function clearAll() {
  if (confirm('Clear all data?')) {
    tableBody.innerHTML = '';
    saveData();
  }
}

tableBody.addEventListener('input', () => {
  history.push(tableBody.innerHTML);
  saveData();
});

window.addEventListener('load', loadRoster);

window.addRow = addRow;
window.undo = undo;
window.clearAll = clearAll;
