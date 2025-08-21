document.getElementById('add-row').addEventListener('click', addRow);
document.getElementById('download').addEventListener('click', downloadCSV);

function addRow() {
  const tbody = document.getElementById('scores-body');
  const row = document.createElement('tr');
  row.innerHTML = `
    <td><input type="text" placeholder="Student Name"></td>
    <td><input type="text" placeholder="LRN"></td>
    <td><input type="number"></td>
    <td><input type="number"></td>
    <td><input type="number"></td>
    <td><input type="number"></td>
    <td><input type="number"></td>`;
  tbody.appendChild(row);
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

// Initialize with one row
addRow();

