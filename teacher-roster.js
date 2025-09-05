import { db } from './firebase.js';
import {
  collection, doc, getDocs, addDoc, updateDoc, deleteDoc,
  serverTimestamp, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// These should be set when the teacher picks School/Term/Class:
let current = { schoolId: null, termId: null, classId: null };

// Expose a function you can call from your class picker flow:
export async function openRosterSheet(schoolId, termId, classId) {
  current = { schoolId, termId, classId };
  document.getElementById("roster-sheet").style.display = "block";
  setupFiltering();
  await renderRosterTable();
}

// ------- Helpers -------
function rosterColRef() {
  const { schoolId, termId, classId } = current;
  return collection(db, `schools/${schoolId}/terms/${termId}/classes/${classId}/roster`);
}

const debounceMap = new Map();     // rowId -> {timer, payload}
const pendingCreate = new Set();   // temp local rows that need addDoc
const saveStatus = document.getElementById("saveStatus");
function setStatus(txt){ saveStatus.textContent = txt; }

// ------- Build Tabulator -------
let table;

async function renderRosterTable() {
  const rows = await fetchRosterRows();

  // Create table once
  if (!table) {
    table = new Tabulator("#rosterGrid", {
      data: rows,
      reactiveData: true,
      height: "70vh",
      layout: "fitColumns",
      clipboard: true,
      history: true, // enables Undo/Redo
      index: "id",   // doc id ties table row to Firestore

      columns: [
        { title: "Name", field: "name", editor: "input", validator: ["required"] },
        { title: "LRN", field: "lrn", editor: "input", validator: ["required"],
          mutatorEdit: v => (v||"").replace(/\D/g,""), // digits only
          headerFilter:"input"
        },
        { title: "Sex", field: "sex", editor: "select",
          editorParams: { values: { "M":"M","F":"F" } },
          validator: ["required", v => (v==="M"||v==="F")? true : "M/F only"]
        },
        { title: "Birthdate", field: "birthdate", editor: "input",
          placeholder: "YYYY-MM-DD",
          validator: [v => /^\d{4}-\d{2}-\d{2}$/.test(v||"") ? true : "YYYY-MM-DD"]
        },
        { title: "Group", field: "group", editor: "input", width: 100 },
        { title: "", field: "actions", hozAlign: "center", width: 70, headerSort:false,
          formatter: () => "🗑️", cellClick: onDeleteRow }
      ],

      // Auto-add empty row at bottom to feel spreadsheet-y
      dataLoaded: () => ensureTrailingBlankRows(),
      dataChanged: () => highlightDuplicateLRNs(),

      cellEdited: onCellEdited, // auto-save
      keybindings: {
        "undo": "ctrl+z",
        "redo": "ctrl+y",
        "navUp": "up",
        "navDown": "down",
        "navLeft": "left",
        "navRight": "right",
        "scrollPageUp": "pageup",
        "scrollPageDown": "pagedown",
      },
    });

    document.getElementById("undoBtn").onclick = () => table.undo();
    document.getElementById("redoBtn").onclick = () => table.redo();
    document.getElementById("addBlankRowsBtn").onclick = () => addBlankRows(10);

    // Re-save when undo/redo modifies cells (Tabulator fires cellEdited)
    table.on("historyUndo", () => setStatus("Saving..."));
    table.on("historyRedo", () => setStatus("Saving..."));
  } else {
    table.replaceData(rows);
  }
}

async function fetchRosterRows() {
  const q = query(rosterColRef(), orderBy("name"));
  const snap = await getDocs(q);
  const rows = [];
  snap.forEach(docSnap => {
    rows.push({ id: docSnap.id, ...docSnap.data() });
  });
  return rows;
}

function ensureTrailingBlankRows() {
  const data = table.getData();
  if (!data.length || Object.values(data[data.length-1] || {}).filter(Boolean).length > 0) {
    addBlankRows(1);
  }
}
function addBlankRows(n=1){
  const blanks = Array.from({length:n}, () => ({
    id: `__tmp_${crypto.randomUUID()}`, name:"", lrn:"", sex:"", birthdate:"", group:""
  }));
  blanks.forEach(b => pendingCreate.add(b.id));
  table.addData(blanks, true);
  setTimeout(()=> ensureTrailingBlankRows(), 0);
}

async function onDeleteRow(e, cell) {
  const row = cell.getRow();
  const rowData = row.getData();
  if (String(rowData.id || "").startsWith("__tmp_")) {
    row.delete();
    return;
  }
  if (!confirm(`Delete ${rowData.name || "this row"}?`)) return;
  setStatus("Deleting...");
  try {
    const ref = doc(db, `${rosterColRef().path}/${rowData.id}`);
    await deleteDoc(ref);
    row.delete();
    setStatus("All changes saved");
  } catch (err) {
    console.error(err);
    setStatus("Delete failed");
  }
}

function onCellEdited(cell) {
  const row = cell.getRow();
  const rowData = row.getData();
  const field = cell.getField();
  const value = cell.getValue();

  // Front-end duplicate LRN warning (within the grid)
  if (field === "lrn") highlightDuplicateLRNs();

  // Skip autosave if row is truly blank
  const anyValue = ["name","lrn","sex","birthdate","group"].some(k => (rowData[k]||"").length);
  if (!anyValue) return;

  setStatus("Saving...");

  // Debounce per row
  const key = rowData.id;
  const payload = debounceMap.get(key) || { timer:null, data:{} };
  payload.data[field] = value;
  if (payload.timer) clearTimeout(payload.timer);
  payload.timer = setTimeout(() => flushRowSave(row), 600);
  debounceMap.set(key, payload);
}

async function flushRowSave(row) {
  const rowData = row.getData();
  const key = rowData.id;
  const payload = debounceMap.get(key);
  if (!payload) return;

  try {
    // If temp row (no Firestore doc yet), create once with current data
    if (pendingCreate.has(key) || String(key).startsWith("__tmp_")) {
      const initData = sanitizeRow(rowData);
      const ref = await addDoc(rosterColRef(), {
        ...initData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      pendingCreate.delete(key);
      row.update({ id: ref.id }); // bind row to doc id
    } else {
      const ref = doc(db, `${rosterColRef().path}/${rowData.id}`);
      await updateDoc(ref, { ...payload.data, updatedAt: serverTimestamp() });
    }
    setStatus("All changes saved");
  } catch (err) {
    console.error(err);
    setStatus("Save failed");
  } finally {
    debounceMap.delete(key);
    ensureTrailingBlankRows();
  }
}

function sanitizeRow(d){
  return {
    name: (d.name||"").trim(),
    lrn: (d.lrn||"").replace(/\D/g,""),
    sex: (d.sex||"").toUpperCase().replace(/[^MF]/g,""),
    birthdate: (d.birthdate||"").trim(), // expect YYYY-MM-DD
    group: (d.group||"").trim(),
  };
}

function highlightDuplicateLRNs(){
  const rows = table.getRows();
  const lrnMap = new Map();
  // First pass: count LRNs
  rows.forEach(r => {
    const l = (r.getData().lrn||"").trim();
    if (!l) return;
    lrnMap.set(l, (lrnMap.get(l) || 0) + 1);
  });
  // Second pass: flag duplicates
  rows.forEach(r => {
    const c = r.getCell("lrn");
    const l = (r.getData().lrn||"").trim();
    if (!l) { c.getElement().style.background = ""; return; }
    c.getElement().style.background = (lrnMap.get(l) > 1) ? "rgba(255,0,0,.12)" : "";
  });
}

// ------- Filtering -------
let filterSetup = false;
function setupFiltering(){
  if(filterSetup) return;
  filterSetup = true;
  const container = document.getElementById("roster-sheet");
  const wrap = document.createElement("div");
  wrap.id = "roster-filter";
  const select = document.createElement("select");
  select.id = "rosterFilterField";
  [
    {value:"name", label:"Name"},
    {value:"lrn", label:"LRN"},
    {value:"group", label:"Group"}
  ].forEach(opt=>{
    const o = document.createElement("option");
    o.value = opt.value;
    o.textContent = opt.label;
    select.appendChild(o);
  });
  const input = document.createElement("input");
  input.id = "rosterFilterValue";
  input.placeholder = "Find student";
  wrap.appendChild(select);
  wrap.appendChild(input);
  container.prepend(wrap);

  const apply = () => {
    if(!table) return;
    const field = select.value;
    const term = input.value.trim();
    table.clearFilter();
    if(term){
      table.setFilter(field, "like", term);
    }
  };
  select.addEventListener("change", apply);
  input.addEventListener("input", apply);
}

// Optionally expose to window for your existing class picker:
window.openRosterSheet = openRosterSheet;
