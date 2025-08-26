import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, getDocs, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

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

const current = { schoolId, termId, classId, subject: null, className: null };

let wwCount = 1, ptCount = 1, meritCount = 1, demeritCount = 1;

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
  // Use the sub-header row as the canon for columns (Name, LRN, ... TW/TP/TM/TD etc.)
  return Array.from(document.querySelectorAll('#scores-table thead tr#sub-header th'));
}

function getAllCellsInColumn(colIndex) {
  // colIndex is 0-based; match both THs and TDs
  const rows = Array.from(document.querySelectorAll('#scores-table tr'));
  return rows
    .map(r => r.children[colIndex])
    .filter(Boolean);
}

function ensureColgroupMatchesHeaders() {
  const headers = getHeaderCells();
  const cg = document.getElementById('scores-colgroup');
  if (!cg) return;
  // Rebuild <colgroup> with one <col> per header
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
    th.classList.add('th-resizable'); // ensure resizable class
    const w = stored[i];
    if (w && cols[i]) cols[i].style.width = `${w}px`;
  });
}

function measureAutoFitWidth(colIndex) {
  // Find max scrollWidth among all cells in this column + a small padding
  const cells = getAllCellsInColumn(colIndex);
  let max = 0;
  cells.forEach(cell => {
    const w = cell.scrollWidth + 16; // 16px buffer
    if (w > max) max = w;
  });
  // Cap at table container width to avoid overshoot
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

function ci(a){return (a || '').trim().toLowerCase();}
function sortByName(a,b){return ci(a.name).localeCompare(ci(b.name));}
function splitBySexAndSort(roster){
  const males = roster.filter(r => (r.sex || '').toUpperCase() === 'M').sort(sortByName);
  const females = roster.filter(r => (r.sex || '').toUpperCase() === 'F').sort(sortByName);
  return [...males, ...females];
}

function sortExistingRows(){
  const tbody = document.getElementById('scores-body');
  const arr = Array.from(tbody.querySelectorAll('tr')).map(row => ({
    row,
    name: row.children[0]?.textContent || '',
    sex: row.children[3]?.textContent || ''
  }));
  arr.sort((a,b)=>{
    const sa=(a.sex||'').toUpperCase();
    const sb=(b.sex||'').toUpperCase();
    if(sa!==sb){
      if(sa==='M') return -1;
      if(sb==='M') return 1;
    }
    return ci(a.name).localeCompare(ci(b.name));
  });
  arr.forEach(r=>tbody.appendChild(r.row));
}

function ensureAddButtons(){
  const groups=[
    {id:'ww-group', handler:addWWColumn},
    {id:'pt-group', handler:addPTColumn},
    {id:'merit-group', handler:addMeritColumn},
    {id:'demerit-group', handler:addDemeritColumn}
  ];
  groups.forEach(g=>{
    const header=document.getElementById(g.id);
    if(!header) return;
    const existing=header.querySelectorAll('.add-col-btn');
    let btn;
    if(existing.length===0){
      btn=document.createElement('button');
      btn.type='button';
      btn.textContent='+';
      btn.className='add-col-btn';
      header.appendChild(btn);
    }else{
      btn=existing[0];
      existing.forEach((b,i)=>{ if(i>0) b.remove(); });
    }
    btn.onclick=g.handler;
  });
}

function updateRowTotals(row){
  const sum = sel => Array.from(row.querySelectorAll(sel)).reduce((acc, el) => acc + (parseFloat(el.value) || 0), 0);
  const wwTotal=row.querySelector('.ww-total');
  const ptTotal=row.querySelector('.pt-total');
  const meritTotal=row.querySelector('.merit-total');
  const demeritTotal=row.querySelector('.demerit-total');
  if(wwTotal) wwTotal.value=sum('.ww-input');
  if(ptTotal) ptTotal.value=sum('.pt-input');
  if(meritTotal) meritTotal.value=sum('.merit-input');
  if(demeritTotal) demeritTotal.value=sum('.demerit-input');
}

function attachRowListeners(row){
  row.querySelectorAll('.ww-input').forEach(i=>i.addEventListener('input',()=>updateRowTotals(row)));
  row.querySelectorAll('.pt-input').forEach(i=>i.addEventListener('input',()=>updateRowTotals(row)));
  row.querySelectorAll('.merit-input').forEach(i=>i.addEventListener('input',()=>updateRowTotals(row)));
  row.querySelectorAll('.demerit-input').forEach(i=>i.addEventListener('input',()=>updateRowTotals(row)));
}

function addRowFromRosterEntry({ id: rosterId, name, lrn, birthdate, sex, email, guardianContact, linkedUid, className }) {
  const tbody = document.getElementById('scores-body');
  const tr = document.createElement('tr');
  tr.dataset.rosterId = rosterId || '';
  tr.dataset.email = email || '';
  tr.dataset.guardian = guardianContact || '';

  const tdName = document.createElement('td'); tdName.textContent = name || '';
  const tdLrn = document.createElement('td'); tdLrn.textContent = lrn || '';
  const tdDob = document.createElement('td'); tdDob.textContent = birthdate || '';
  const tdSex = document.createElement('td'); tdSex.textContent = (sex || '').toUpperCase();
  const tdClass = document.createElement('td'); tdClass.innerHTML = className ? `<span class="badge">${className}</span>` : '';
  const tdLink = document.createElement('td'); tdLink.textContent = linkedUid ? 'Yes' : 'No';

  const tdActions = document.createElement('td');
  tdActions.className = 'actions-cell';
  const editBtn = document.createElement('button'); editBtn.type = 'button'; editBtn.className = 'link-btn'; editBtn.textContent = 'Edit';
  const delBtn = document.createElement('button'); delBtn.type = 'button'; delBtn.className = 'danger-link'; delBtn.textContent = 'Delete';
  tdActions.append(editBtn, delBtn);

  tr.append(tdName, tdLrn, tdDob, tdSex, tdClass, tdLink, tdActions);

  for (let i = 0; i < wwCount; i++) {
    const td = document.createElement('td');
    const inp = document.createElement('input');
    inp.type = 'number'; inp.className = 'ww-input';
    td.appendChild(inp); tr.appendChild(td);
  }
  const tdWWTotal = document.createElement('td');
  const wwTotalInp = document.createElement('input');
  wwTotalInp.type = 'number'; wwTotalInp.className = 'ww-total'; wwTotalInp.readOnly = true;
  tdWWTotal.appendChild(wwTotalInp); tr.appendChild(tdWWTotal);

  for (let i = 0; i < ptCount; i++) {
    const td = document.createElement('td');
    const inp = document.createElement('input');
    inp.type = 'number'; inp.className = 'pt-input';
    td.appendChild(inp); tr.appendChild(td);
  }
  const tdPTTotal = document.createElement('td');
  const ptTotalInp = document.createElement('input');
  ptTotalInp.type = 'number'; ptTotalInp.className = 'pt-total'; ptTotalInp.readOnly = true;
  tdPTTotal.appendChild(ptTotalInp); tr.appendChild(tdPTTotal);

  for (let i = 0; i < meritCount; i++) {
    const td = document.createElement('td');
    const inp = document.createElement('input');
    inp.type = 'number'; inp.className = 'merit-input';
    td.appendChild(inp); tr.appendChild(td);
  }
  const tdMeritTotal = document.createElement('td');
  const meritTotalInp = document.createElement('input');
  meritTotalInp.type = 'number'; meritTotalInp.className = 'merit-total'; meritTotalInp.readOnly = true;
  tdMeritTotal.appendChild(meritTotalInp); tr.appendChild(tdMeritTotal);

  for (let i = 0; i < demeritCount; i++) {
    const td = document.createElement('td');
    const inp = document.createElement('input');
    inp.type = 'number'; inp.className = 'demerit-input';
    td.appendChild(inp); tr.appendChild(td);
  }
  const tdDemeritTotal = document.createElement('td');
  const demTotalInp = document.createElement('input');
  demTotalInp.type = 'number'; demTotalInp.className = 'demerit-total'; demTotalInp.readOnly = true;
  tdDemeritTotal.appendChild(demTotalInp); tr.appendChild(tdDemeritTotal);

  tbody.appendChild(tr);
  attachRowListeners(tr);
  updateRowTotals(tr);

  editBtn.addEventListener('click', () => enterEditMode(tr, { name, lrn, birthdate, sex, email, guardianContact }));
  delBtn.addEventListener('click', () => attemptDeleteStudent(tr, { linkedUid }));
}

function enterEditMode(tr, initial) {
  if (tr.dataset.editing === '1') return;
  tr.dataset.editing = '1';

  const [tdName, tdLrn, tdDob, tdSex, tdClass, tdLink, tdActions] = tr.children;

  const nameInp = document.createElement('input'); nameInp.className = 'inline-input'; nameInp.value = tdName.textContent.trim();
  const lrnInp = document.createElement('input'); lrnInp.className = 'inline-input'; lrnInp.value = tdLrn.textContent.trim();
  const dobInp = document.createElement('input'); dobInp.type = 'date'; dobInp.className = 'inline-input'; dobInp.value = initial.birthdate || '';
  const sexSel = document.createElement('select'); sexSel.className = 'inline-input';
  sexSel.innerHTML = '<option value="">Sex</option><option value="M">M</option><option value="F">F</option>';
  sexSel.value = (initial.sex || '').toUpperCase();

  tdName.replaceChildren(nameInp);
  tdLrn.replaceChildren(lrnInp);
  tdDob.replaceChildren(dobInp);
  tdSex.replaceChildren(sexSel);

  tdActions.innerHTML = '';
  const emailInp = document.createElement('input'); emailInp.placeholder = 'Email (optional)'; emailInp.className = 'inline-input'; emailInp.value = initial.email || '';
  const guardInp = document.createElement('input'); guardInp.placeholder = 'Guardian Contact (optional)'; guardInp.className = 'inline-input'; guardInp.value = initial.guardianContact || '';
  const saveBtn = document.createElement('button'); saveBtn.type = 'button'; saveBtn.className = 'link-btn'; saveBtn.textContent = 'Save';
  const cancelBtn = document.createElement('button'); cancelBtn.type = 'button'; cancelBtn.className = 'link-btn'; cancelBtn.textContent = 'Cancel';
  tdActions.append(emailInp, guardInp, saveBtn, cancelBtn);

  cancelBtn.addEventListener('click', () => {
    tr.dataset.editing = '0';
    tdName.textContent = initial.name || '';
    tdLrn.textContent = initial.lrn || '';
    tdDob.textContent = initial.birthdate || '';
    tdSex.textContent = (initial.sex || '').toUpperCase();
    tdActions.innerHTML = '';
    const editBtn = document.createElement('button'); editBtn.type = 'button'; editBtn.className = 'link-btn'; editBtn.textContent = 'Edit';
    const delBtn = document.createElement('button'); delBtn.type = 'button'; delBtn.className = 'danger-link'; delBtn.textContent = 'Delete';
    tdActions.append(editBtn, delBtn);
    editBtn.addEventListener('click', () => enterEditMode(tr, initial));
    delBtn.addEventListener('click', () => attemptDeleteStudent(tr, { linkedUid: tr.children[5].textContent.trim() === 'Yes' }));
  });

  saveBtn.addEventListener('click', async () => {
    const rosterId = tr.dataset.rosterId;
    if (!rosterId) return alert('Missing rosterId.');
    const lrnVal = lrnInp.value.trim();
    if (!/^\d{12}$/.test(lrnVal)) return alert('LRN must be 12 digits.');
    const sexVal = (sexSel.value || '').toUpperCase();
    if (sexVal && !['M','F'].includes(sexVal)) return alert('Sex must be M or F.');

    const ref = doc(db,'schools',schoolId,'terms',termId,'classes',classId,'roster',rosterId);
    await updateDoc(ref, {
      name: nameInp.value.trim(),
      lrn: lrnVal,
      birthdate: dobInp.value || '',
      sex: sexVal,
      email: emailInp.value.trim() || null,
      guardianContact: guardInp.value.trim() || null,
      updatedAt: Date.now()
    });

    tr.dataset.editing = '0';
    tdName.textContent = nameInp.value.trim();
    tdLrn.textContent = lrnVal;
    tdDob.textContent = dobInp.value || '';
    tdSex.textContent = sexVal;
    tr.dataset.email = emailInp.value.trim() || '';
    tr.dataset.guardian = guardInp.value.trim() || '';
    tdActions.innerHTML = '';
    const editBtn = document.createElement('button'); editBtn.type = 'button'; editBtn.className = 'link-btn'; editBtn.textContent = 'Edit';
    const delBtn = document.createElement('button'); delBtn.type = 'button'; delBtn.className = 'danger-link'; delBtn.textContent = 'Delete';
    tdActions.append(editBtn, delBtn);
    editBtn.addEventListener('click', () => enterEditMode(tr, {
      name: tdName.textContent, lrn: tdLrn.textContent, birthdate: tdDob.textContent, sex: tdSex.textContent,
      email: emailInp.value.trim() || '', guardianContact: guardInp.value.trim() || ''
    }));
    delBtn.addEventListener('click', () => attemptDeleteStudent(tr, { linkedUid: tr.children[5].textContent.trim() === 'Yes' }));
    sortExistingRows();
    updateRowTotals(tr);
  });
}

async function attemptDeleteStudent(tr, { linkedUid }) {
  const name = tr.children[0]?.textContent?.trim() || 'this student';
  const isLinked = (tr.children[5]?.textContent?.trim() === 'Yes') || !!linkedUid;
  if (isLinked) {
    alert('Cannot delete: student is linked to an account. Ask the student to transfer/unenroll first, or archive instead.');
    return;
  }

  const inRowHasScores = rowHasAnyScores(tr);
  if (inRowHasScores) {
    const proceed = confirm(`This row has scores entered for "${name}". Deleting removes this row from your current table. Continue?`);
    if (!proceed) return;
  }

  const typed = prompt(`Delete "${name}" from this class?\nType DELETE to confirm.`);
  if (typed !== 'DELETE') return;

  const rosterId = tr.dataset.rosterId;
  if (!rosterId) return alert('Missing rosterId.');

  const ref = doc(db,'schools',schoolId,'terms',termId,'classes',classId,'roster',rosterId);
  await deleteDoc(ref);
  tr.remove();
}

function rowHasAnyScores(tr) {
  const cells = Array.from(tr.children).slice(7);
  return cells.some(td => {
    const inp = td.querySelector('input');
    return inp && (String(inp.value).trim() !== '');
  });
}

function addWWColumn(){
  wwCount++;
  const subHeader=document.getElementById('sub-header');
  const totalHeader=document.getElementById('ww-total-header');
  const th=document.createElement('th');
  th.className='ww-header';
  th.textContent=`W${wwCount}`;
  subHeader.insertBefore(th,totalHeader);
  document.getElementById('ww-group').colSpan=wwCount+1;
  const maxRow=document.getElementById('max-row');
  const placeholder=document.getElementById('ww-max-placeholder');
  const thMax=document.createElement('th');
  const inputMax=document.createElement('input');
  inputMax.type='number';
  inputMax.className='ww-max';
  thMax.appendChild(inputMax);
  maxRow.insertBefore(thMax, placeholder);
  document.querySelectorAll('#scores-body tr').forEach(row=>{
    const totalCell=row.querySelector('.ww-total').parentElement;
    const td=document.createElement('td');
    const input=document.createElement('input');
    input.type='number';
    input.className='ww-input';
    td.appendChild(input);
    row.insertBefore(td,totalCell);
    input.addEventListener('input',()=>updateRowTotals(row));
  });
  ensureColgroupMatchesHeaders();
  installColumnResizers();
}

function addPTColumn(){
  ptCount++;
  const subHeader=document.getElementById('sub-header');
  const totalHeader=document.getElementById('pt-total-header');
  const th=document.createElement('th');
  th.className='pt-header';
  th.textContent=`PT${ptCount}`;
  subHeader.insertBefore(th,totalHeader);
  document.getElementById('pt-group').colSpan=ptCount+1;
  const maxRow=document.getElementById('max-row');
  const placeholder=document.getElementById('pt-max-placeholder');
  const thMax=document.createElement('th');
  const inputMax=document.createElement('input');
  inputMax.type='number';
  inputMax.className='pt-max';
  thMax.appendChild(inputMax);
  maxRow.insertBefore(thMax, placeholder);
  document.querySelectorAll('#scores-body tr').forEach(row=>{
    const totalCell=row.querySelector('.pt-total').parentElement;
    const td=document.createElement('td');
    const input=document.createElement('input');
    input.type='number';
    input.className='pt-input';
    td.appendChild(input);
    row.insertBefore(td,totalCell);
    input.addEventListener('input',()=>updateRowTotals(row));
  });
  ensureColgroupMatchesHeaders();
  installColumnResizers();
}

function addMeritColumn(){
  meritCount++;
  const subHeader=document.getElementById('sub-header');
  const totalHeader=document.getElementById('merit-total-header');
  const th=document.createElement('th');
  th.className='merit-header';
  th.textContent=`M${meritCount}`;
  subHeader.insertBefore(th,totalHeader);
  document.getElementById('merit-group').colSpan=meritCount+1;
  const maxRow=document.getElementById('max-row');
  const placeholder=document.getElementById('merit-max-placeholder');
  const thMax=document.createElement('th');
  const inputMax=document.createElement('input');
  inputMax.type='text';
  inputMax.className='merit-label';
  inputMax.maxLength=4;
  thMax.appendChild(inputMax);
  maxRow.insertBefore(thMax,placeholder);
  document.querySelectorAll('#scores-body tr').forEach(row=>{
    const totalCell=row.querySelector('.merit-total').parentElement;
    const td=document.createElement('td');
    const input=document.createElement('input');
    input.type='number';
    input.className='merit-input';
    td.appendChild(input);
    row.insertBefore(td,totalCell);
    input.addEventListener('input',()=>updateRowTotals(row));
  });
  ensureColgroupMatchesHeaders();
  installColumnResizers();
}

function addDemeritColumn(){
  demeritCount++;
  const subHeader=document.getElementById('sub-header');
  const totalHeader=document.getElementById('demerit-total-header');
  const th=document.createElement('th');
  th.className='demerit-header';
  th.textContent=`D${demeritCount}`;
  subHeader.insertBefore(th,totalHeader);
  document.getElementById('demerit-group').colSpan=demeritCount+1;
  const maxRow=document.getElementById('max-row');
  const placeholder=document.getElementById('demerit-max-placeholder');
  const thMax=document.createElement('th');
  const inputMax=document.createElement('input');
  inputMax.type='text';
  inputMax.className='demerit-label';
  inputMax.maxLength=4;
  thMax.appendChild(inputMax);
  maxRow.insertBefore(thMax, placeholder);
  document.querySelectorAll('#scores-body tr').forEach(row=>{
    const totalCell=row.querySelector('.demerit-total').parentElement;
    const td=document.createElement('td');
    const input=document.createElement('input');
    input.type='number';
    input.className='demerit-input';
    td.appendChild(input);
    row.insertBefore(td,totalCell);
    input.addEventListener('input',()=>updateRowTotals(row));
  });
  ensureColgroupMatchesHeaders();
  installColumnResizers();
}

async function fetchClassMeta(){
  const classRef=doc(db,'schools',schoolId,'terms',termId,'classes',classId);
  const classSnap=await getDoc(classRef);
  current.className = classSnap.exists() ? (classSnap.data().name || classId) : classId;
  current.subject = classSnap.exists() ? (classSnap.data().subject || null) : null;

  let termText = `Term: ${termId}`;
  const termRef = doc(db,'schools',schoolId,'terms',termId);
  const termSnap = await getDoc(termRef);
  if(termSnap.exists()){
    const t = termSnap.data();
    if(t.schoolYear && t.termLabel){
      termText = `Term: S.Y.${t.schoolYear} - ${t.termLabel}`;
    } else if(t.name){
      const parts = String(t.name).split('|').map(s=>s.trim());
      termText = parts.length === 2 ? `Term: ${parts[0]} - ${parts[1]}` : `Term: ${t.name}`;
    }
  }

  document.getElementById('class-path').textContent = `Class: ${current.className} • Subject: ${current.subject || 'Unknown'} • ${termText}`;
}

async function fetchRosterForClass(cId){
  const rSnap=await getDocs(collection(db,'schools',schoolId,'terms',termId,'classes',cId,'roster'));
  return rSnap.docs.map(d=>({ id:d.id, ...d.data(), classId:cId }));
}

async function fetchClassesSameSubject(){
  if(!current.subject) return [];
  const classesSnap=await getDocs(collection(db,'schools',schoolId,'terms',termId,'classes'));
  const arr=classesSnap.docs.map(d=>({id:d.id, ...d.data()}));
  return arr.filter(c => (c.subject || '') === current.subject);
}

async function loadAndRenderSingleClass(){
  const scoresRef=doc(db,'schools',schoolId,'terms',termId,'classes',classId,'scores',auth.currentUser.uid);
  const sSnap=await getDoc(scoresRef);
  if(sSnap.exists()){
    const data=sSnap.data();
    document.getElementById('scores-table').innerHTML=data.tableHTML;
    wwCount=data.wwCount || 1;
    ptCount=data.ptCount || 1;
    meritCount=data.meritCount || 1;
    demeritCount=data.demeritCount || 1;
    document.querySelectorAll('#scores-body tr').forEach(row=>{
      attachRowListeners(row);
      updateRowTotals(row);
      const initial = {
        name: row.children[0]?.textContent.trim() || '',
        lrn: row.children[1]?.textContent.trim() || '',
        birthdate: row.children[2]?.textContent.trim() || '',
        sex: row.children[3]?.textContent.trim() || '',
        email: row.dataset.email || '',
        guardianContact: row.dataset.guardian || ''
      };
      const editBtn = row.children[6]?.querySelector('.link-btn');
      const delBtn = row.children[6]?.querySelector('.danger-link');
      if(editBtn) editBtn.addEventListener('click', () => enterEditMode(row, initial));
      if(delBtn) delBtn.addEventListener('click', () => attemptDeleteStudent(row, { linkedUid: row.children[5]?.textContent.trim() === 'Yes' }));
    });
    ensureAddButtons();
    const roster=await fetchRosterForClass(classId);
    const existingLRNs=new Set(Array.from(document.querySelectorAll('#scores-body tr td:nth-child(2)')).map(td=>td.textContent.trim()));
    const missing=roster.filter(r=>!existingLRNs.has(String(r.lrn||'')));
    if(missing.length){
      const ordered=splitBySexAndSort(missing);
      for(const m of ordered){
        addRowFromRosterEntry({
          id: m.id,
          name: m.name,
          lrn: m.lrn,
          birthdate: m.birthdate,
          sex: m.sex,
          email: m.email,
          guardianContact: m.guardianContact,
          linkedUid: m.linkedUid || null,
          className: current.className
        });
      }
    }
    sortExistingRows();
    ensureAddButtons();
  } else {
    const roster=await fetchRosterForClass(classId);
    const ordered=splitBySexAndSort(roster);
    document.querySelector('#scores-body').innerHTML='';
    for(const r of ordered){
      addRowFromRosterEntry({
        id: r.id,
        name: r.name,
        lrn: r.lrn,
        birthdate: r.birthdate,
        sex: r.sex,
        email: r.email,
        guardianContact: r.guardianContact,
        linkedUid: r.linkedUid || null,
        className: current.className
      });
    }
    ensureAddButtons();
  }
  ensureColgroupMatchesHeaders();
  applyDefaultProfileWidthsIfEmpty();
  installColumnResizers();
}

async function loadAndRenderMerged(subjectClasses, selected){
  let classesToLoad=[];
  if(selected==='__ALL__') classesToLoad=subjectClasses;
  else classesToLoad=subjectClasses.filter(c=>c.id===selected);
  const all=[];
  for(const c of classesToLoad){
    const roster=await fetchRosterForClass(c.id);
    const className=c.name || c.id;
    roster.forEach(x=>all.push({...x, className}));
  }
  const seen=new Set();
  const merged=[];
  for(const s of all){
    const key=String(s.lrn || '');
    if(!seen.has(key)){
      seen.add(key);
      merged.push(s);
    }
  }
  const ordered=splitBySexAndSort(merged);
  document.querySelector('#scores-body').innerHTML='';
  for(const s of ordered){
    addRowFromRosterEntry({
      id: s.id,
      name: s.name,
      lrn: s.lrn,
      birthdate: s.birthdate,
      sex: s.sex,
      email: s.email,
      guardianContact: s.guardianContact,
      linkedUid: s.linkedUid || null,
      className: s.className
    });
  }
  ensureAddButtons();
  ensureColgroupMatchesHeaders();
  applyDefaultProfileWidthsIfEmpty();
  installColumnResizers();
}

const showAllChk=document.getElementById('show-all-sections');
const sectionSelect=document.getElementById('section-select');

async function refreshFilterUI(){
  if(!showAllChk.checked){
    sectionSelect.classList.add('hidden');
    await loadAndRenderSingleClass();
    return;
  }
  sectionSelect.classList.remove('hidden');
  const classes=await fetchClassesSameSubject();
  classes.sort((a,b)=>ci(a.name).localeCompare(ci(b.name)));
  sectionSelect.innerHTML='';
  const allOpt=document.createElement('option'); allOpt.value='__ALL__'; allOpt.textContent='All sections';
  sectionSelect.appendChild(allOpt);
  for(const c of classes){
    const opt=document.createElement('option');
    opt.value=c.id; opt.textContent=c.name || c.id;
    sectionSelect.appendChild(opt);
  }
  sectionSelect.value='__ALL__';
  await loadAndRenderMerged(classes,'__ALL__');
}

showAllChk.addEventListener('change', refreshFilterUI);
sectionSelect.addEventListener('change', async e=>{
  const classes=await fetchClassesSameSubject();
  classes.sort((a,b)=>ci(a.name).localeCompare(ci(b.name)));
  await loadAndRenderMerged(classes, e.target.value);
});

function validLRN(v){ return /^\d{12}$/.test(v); }
function validDate(v){ return /^\d{4}-\d{2}-\d{2}$/.test(v); }

document.getElementById('add-student-form').addEventListener('submit', async e=>{
  e.preventDefault();
  const name=document.getElementById('student-name').value.trim();
  const lrn=document.getElementById('student-lrn').value.trim();
  const birthdate=document.getElementById('student-birthdate').value.trim();
  const sex=document.getElementById('student-sex').value;
  const email=document.getElementById('student-email').value.trim() || null;
  const guardianContact=document.getElementById('guardian-contact').value.trim() || null;
  if(!name || !validLRN(lrn) || !validDate(birthdate) || !sex){ alert('Invalid input'); return; }
  const rosterRef=doc(collection(db,'schools',schoolId,'terms',termId,'classes',classId,'roster'));
  await setDoc(rosterRef,{ name, lrn, birthdate, sex, email, guardianContact, linkedUid: null, createdAt: Date.now() });
  if(showAllChk.checked){
    await refreshFilterUI();
  } else {
    addRowFromRosterEntry({ id: rosterRef.id, name, lrn, birthdate, sex, email, guardianContact, linkedUid: null, className: current.className });
    sortExistingRows();
  }
  e.target.reset();
});

document.getElementById('save').addEventListener('click', async ()=>{
  if(showAllChk.checked){
    alert('Please disable "Show all sections in this subject" before saving.');
    return;
  }
    const table=document.getElementById('scores-table');
    const clone=table.cloneNode(true);
    clone.querySelectorAll('.th-resizer').forEach(el=>el.remove());
    clone.querySelectorAll('.th-resizable').forEach(el=>el.classList.remove('th-resizable'));
    const tableHTML=clone.innerHTML;
  const ref=doc(db,'schools',schoolId,'terms',termId,'classes',classId,'scores',auth.currentUser.uid);
  await setDoc(ref,{ tableHTML, wwCount, ptCount, meritCount, demeritCount, updatedAt: Date.now() });
  alert('Saved.');
});

document.getElementById('download').addEventListener('click', ()=>{
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

await new Promise(resolve=>{
  const unsub=onAuthStateChanged(auth,user=>{
    if(user){unsub(); resolve();}
  });
});

await fetchClassMeta();
await refreshFilterUI();
ensureColgroupMatchesHeaders();
applyDefaultProfileWidthsIfEmpty();
installColumnResizers();

