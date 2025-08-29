import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, getDocs, writeBatch } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

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

// ---------------------------------------------------------------------------
// Column width persistence/resizing helpers (from previous implementation)
// ---------------------------------------------------------------------------
function widthsStorageKey(schoolId, termId, classId) {
  return `scoreTableWidths:${schoolId}:${termId}:${classId}`;
}

function loadStoredWidths(schoolId, termId, classId) {
  try { return JSON.parse(localStorage.getItem(widthsStorageKey(schoolId, termId, classId)) || '[]'); }
  catch { return []; }
}

function saveStoredWidths(schoolId, termId, classId, arr) {
  localStorage.setItem(widthsStorageKey(schoolId, termId, classId), JSON.stringify(arr));
}

function getHeaderCells() {
  return Array.from(document.querySelectorAll('#scores-table thead tr#sub-header th'));
}

function getAllCellsInColumn(colIndex) {
  const rows = Array.from(document.querySelectorAll('#scores-table tr'));
  return rows.map(r => r.children[colIndex]).filter(Boolean);
}

function ensureColgroupMatchesHeaders() {
  const headers = getHeaderCells();
  const cg = document.getElementById('scores-colgroup');
  if (!cg) return;
  cg.innerHTML = '';
  headers.forEach(() => {
    const col = document.createElement('col');
    cg.appendChild(col);
  });
}

function applyColumnWidthsFromStorage() {
  const headers = getHeaderCells();
  const cg = document.getElementById('scores-colgroup');
  if (!cg) return;
  const cols = Array.from(cg.children);
  const stored = loadStoredWidths(schoolId, termId, classId);
  headers.forEach((th, i) => {
    th.classList.add('th-resizable');
    const w = stored[i];
    if (w && cols[i]) cols[i].style.width = `${w}px`;
  });
}

function measureAutoFitWidth(colIndex) {
  const cells = getAllCellsInColumn(colIndex);
  let max = 0;
  cells.forEach(cell => {
    const w = cell.scrollWidth + 16;
    if (w > max) max = w;
  });
  const container = document.querySelector('.table-container') || document.getElementById('scores-table').parentElement;
  const maxAllowed = container ? container.clientWidth - 24 : max;
  return Math.min(max, maxAllowed);
}

let _drag = null; // { startX, startWidth, colIndex, colEl, guideEl }

function installColumnResizers() {
  ensureColgroupMatchesHeaders();
  applyColumnWidthsFromStorage();

  const headers = getHeaderCells();
  const cg = document.getElementById('scores-colgroup');
  const cols = cg ? Array.from(cg.children) : [];

  headers.forEach((th, i) => {
    if (th.querySelector('.th-resizer')) return;
    const handle = document.createElement('div');
    handle.className = 'th-resizer';
    th.appendChild(handle);

    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      document.body.classList.add('user-select-none');
      const colEl = cols[i];
      const startWidth = (colEl && colEl.style.width) ? parseFloat(colEl.style.width) : th.offsetWidth;
      _drag = { startX: e.clientX, startWidth, colIndex: i, colEl };

      const guide = document.createElement('div');
      guide.className = 'col-resize-guide';
      guide.style.left = `${e.clientX}px`;
      document.body.appendChild(guide);
      _drag.guideEl = guide;

      const onMove = (ev) => {
        if (!_drag) return;
        const delta = ev.clientX - _drag.startX;
        const newW = Math.max(60, _drag.startWidth + delta);
        if (_drag.colEl) _drag.colEl.style.width = `${newW}px`;
        if (_drag.guideEl) _drag.guideEl.style.left = `${ev.clientX}px`;
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.body.classList.remove('user-select-none');
        if (_drag?.guideEl) _drag.guideEl.remove();
        const newWidths = Array.from(cols).map(c => c.style.width ? parseFloat(c.style.width) : null);
        saveStoredWidths(schoolId, termId, classId, newWidths);
        _drag = null;
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });

    handle.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      const autoW = measureAutoFitWidth(i);
      if (cols[i]) {
        cols[i].style.width = `${autoW}px`;
        const newWidths = Array.from(cols).map(c => c.style.width ? parseFloat(c.style.width) : null);
        saveStoredWidths(schoolId, termId, classId, newWidths);
      }
    });
  });
}

function applyDefaultProfileWidthsIfEmpty() {
  const cg = document.getElementById('scores-colgroup');
  if (!cg) return;
  const cols = Array.from(cg.children);
  const stored = loadStoredWidths(schoolId, termId, classId);
  if (stored.length) return;
  if (cols[0]) cols[0].style.width = '280px';
  if (cols[1]) cols[1].style.width = '120px';
  if (cols[2]) cols[2].style.width = '120px';
  if (cols[3]) cols[3].style.width = '80px';
  if (cols[4]) cols[4].style.width = '260px';
  if (cols[5]) cols[5].style.width = '90px';
  if (cols[6]) cols[6].style.width = '120px';
}

// ---------------------------------------------------------------------------
// Fixed score columns and per-LRN persistence
// ---------------------------------------------------------------------------
const WW_KEYS = Array.from({ length: 10 }, (_, i) => `W${i + 1}`);
const PT_KEYS = Array.from({ length: 10 }, (_, i) => `PT${i + 1}`);
const M_KEYS  = Array.from({ length: 10 }, (_, i) => `M${i + 1}`);
const D_KEYS  = Array.from({ length: 10 }, (_, i) => `D${i + 1}`);
const ALL_KEYS = [...WW_KEYS, ...PT_KEYS, ...M_KEYS, ...D_KEYS];

function buildFixedHeaders() {
  const groupHeader = document.getElementById('group-header');
  const subHeader = document.getElementById('sub-header');
  const maxRow = document.getElementById('max-row');
  if (!groupHeader || !subHeader) return;

  const wwGroup = document.getElementById('ww-group');
  const ptGroup = document.getElementById('pt-group');
  const meritGroup = document.getElementById('merit-group');
  const demeritGroup = document.getElementById('demerit-group');

  if (wwGroup) wwGroup.colSpan = WW_KEYS.length + 1;
  if (ptGroup) ptGroup.colSpan = PT_KEYS.length + 1;
  if (meritGroup) meritGroup.colSpan = M_KEYS.length + 1;
  if (demeritGroup) demeritGroup.colSpan = D_KEYS.length + 1;

  const subHeads = Array.from(subHeader.children);
  function injectHeaders(startClass, keys, totalHeaderId) {
    const firstIdx = subHeads.findIndex(th => th.classList.contains(startClass));
    if (firstIdx === -1) return;
    const totalIdx = subHeads.findIndex(th => th.id === totalHeaderId);
    if (totalIdx === -1) return;
    subHeads[firstIdx].textContent = keys[0];
    for (let i = firstIdx + 1; i < totalIdx; i++) {
      subHeader.removeChild(subHeader.children[firstIdx + 1]);
    }
    for (let k = 1; k < keys.length; k++) {
      const th = document.createElement('th');
      th.textContent = keys[k];
      th.className = subHeads[firstIdx].className;
      subHeader.insertBefore(th, document.getElementById(totalHeaderId));
    }
  }

  injectHeaders('ww-header', WW_KEYS, 'ww-total-header');
  injectHeaders('pt-header', PT_KEYS, 'pt-total-header');
  injectHeaders('merit-header', M_KEYS, 'merit-total-header');
  injectHeaders('demerit-header', D_KEYS, 'demerit-total-header');

  // maxRow is left untouched (keep existing inputs/placeholders)
}

function createScoreInputCell(key) {
  const td = document.createElement('td');
  const inp = document.createElement('input');
  inp.type = 'number';
  inp.inputMode = 'decimal';
  inp.dataset.key = key;
  inp.className = 'score-input';
  td.appendChild(inp);
  return td;
}

function createTotalCell() {
  const td = document.createElement('td');
  td.className = 'total-cell';
  td.textContent = '0';
  return td;
}

function attachRowListeners(tr) {
  tr.querySelectorAll('input.score-input').forEach(inp => {
    inp.addEventListener('input', () => recomputeRowTotals(tr));
  });
}

function recomputeRowTotals(tr) {
  function sum(keys) {
    return keys.reduce((acc, key) => {
      const input = tr.querySelector(`input[data-key="${key}"]`);
      const v = input && input.value.trim() !== '' ? Number(input.value) : 0;
      return acc + (isNaN(v) ? 0 : v);
    }, 0);
  }
  const wwTotalCell = tr.querySelector('td[data-total="WW"]');
  const ptTotalCell = tr.querySelector('td[data-total="PT"]');
  const meritTotalCell = tr.querySelector('td[data-total="M"]');
  const demeritTotalCell = tr.querySelector('td[data-total="D"]');

  if (wwTotalCell) wwTotalCell.textContent = String(sum(WW_KEYS));
  if (ptTotalCell) ptTotalCell.textContent = String(sum(PT_KEYS));
  if (meritTotalCell) meritTotalCell.textContent = String(sum(M_KEYS));
  if (demeritTotalCell) demeritTotalCell.textContent = String(sum(D_KEYS));
}

function addRowFromRosterEntry({ id, name, lrn, birthdate, sex, className, linkedUid }) {
  const tr = document.createElement('tr');
  tr.dataset.lrn = String(lrn || '');

  const tdName = document.createElement('td'); tdName.textContent = name || '';
  const tdLrn = document.createElement('td'); tdLrn.textContent = lrn || '';
  const tdDob = document.createElement('td'); tdDob.textContent = birthdate || '';
  const tdSex = document.createElement('td'); tdSex.textContent = (sex || '').toUpperCase();
  const tdClass = document.createElement('td'); tdClass.textContent = className || '';
  const tdLink = document.createElement('td'); tdLink.textContent = linkedUid ? 'Yes' : 'No';
  const tdActions = document.createElement('td'); tdActions.textContent = '';

  tr.append(tdName, tdLrn, tdDob, tdSex, tdClass, tdLink, tdActions);

  WW_KEYS.forEach(k => tr.appendChild(createScoreInputCell(k)));
  const wwTot = createTotalCell(); wwTot.dataset.total = 'WW'; tr.appendChild(wwTot);

  PT_KEYS.forEach(k => tr.appendChild(createScoreInputCell(k)));
  const ptTot = createTotalCell(); ptTot.dataset.total = 'PT'; tr.appendChild(ptTot);

  M_KEYS.forEach(k => tr.appendChild(createScoreInputCell(k)));
  const mTot = createTotalCell(); mTot.dataset.total = 'M'; tr.appendChild(mTot);

  D_KEYS.forEach(k => tr.appendChild(createScoreInputCell(k)));
  const dTot = createTotalCell(); dTot.dataset.total = 'D'; tr.appendChild(dTot);

  document.getElementById('scores-body').appendChild(tr);
  attachRowListeners(tr);
}

async function loadRosterRows() {
  const rosterSnap = await getDocs(collection(db, 'schools', schoolId, 'terms', termId, 'classes', classId, 'roster'));
  const rows = rosterSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  rows.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' }));
  for (const r of rows) {
    addRowFromRosterEntry({
      id: r.id,
      name: r.name,
      lrn: r.lrn,
      birthdate: r.birthdate,
      sex: r.sex,
      className: current.className || '',
      linkedUid: r.linkedUid || null
    });
  }
}

async function loadScoresByLRN() {
  const snap = await getDocs(collection(db, 'schools', schoolId, 'terms', termId, 'classes', classId, 'scoresByLRN'));
  const map = new Map();
  snap.forEach(docSnap => { map.set(String(docSnap.id), docSnap.data()); });

  document.querySelectorAll('#scores-body tr').forEach(tr => {
    const lrn = tr.dataset.lrn;
    if (!lrn) return;
    const data = map.get(String(lrn));
    if (!data) return;
    ALL_KEYS.forEach(key => {
      const input = tr.querySelector(`input[data-key="${key}"]`);
      if (!input) return;
      const v = data[key];
      if (v === 0 || v === '0' || (typeof v === 'number' && !isNaN(v))) {
        input.value = String(v);
      } else if (typeof v === 'string' && v.trim() !== '') {
        input.value = v;
      }
    });
    recomputeRowTotals(tr);
  });
}

document.getElementById('save').addEventListener('click', async () => {
  const batch = writeBatch(db);
  const tbody = document.getElementById('scores-body');
  const rows = Array.from(tbody.querySelectorAll('tr'));

  for (const tr of rows) {
    const lrn = (tr.dataset.lrn || '').trim();
    if (!lrn) continue;
    const payload = { updatedAt: Date.now(), teacherUid: auth.currentUser?.uid || null };
    ALL_KEYS.forEach(key => {
      const input = tr.querySelector(`input[data-key="${key}"]`);
      if (!input) return;
      const raw = input.value.trim();
      if (raw === '') {
        // omit field
      } else {
        const num = Number(raw);
        payload[key] = isNaN(num) ? raw : num;
      }
    });
    const ref = doc(db, 'schools', schoolId, 'terms', termId, 'classes', classId, 'scoresByLRN', lrn);
    batch.set(ref, payload, { merge: true });
  }

  await batch.commit();
  alert('Scores saved by LRN.');
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

async function initScoreTable() {
  const classRef = doc(db, 'schools', schoolId, 'terms', termId, 'classes', classId);
  const classSnap = await getDoc(classRef);
  if (classSnap.exists()) {
    const data = classSnap.data();
    current.className = data.name || '';
    const pathEl = document.getElementById('class-path');
    if (pathEl) {
      const subject = data.subject || '';
      const section = data.section || '';
      pathEl.textContent = `${subject} ${section}`.trim();
    }
  }

  buildFixedHeaders();
  await loadRosterRows();
  await loadScoresByLRN();
  ensureColgroupMatchesHeaders();
  applyDefaultProfileWidthsIfEmpty();
  installColumnResizers();
}

onAuthStateChanged(auth, (user) => {
  if (user) {
    initScoreTable();
  }
});

