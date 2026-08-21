document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('fileInput');
    const editorContainer = document.getElementById('editorContainer');
    const saveButton = document.getElementById('saveButton');

    let jsonData = [];

    fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    jsonData = JSON.parse(e.target.result);
                    renderForm(jsonData);
                    saveButton.disabled = false;
                } catch (err) {
                    editorContainer.innerHTML = `<p style="color: red;">Error parsing JSON file: ${err.message}</p>`;
                    saveButton.disabled = true;
                }
            };
            reader.readAsText(file);
        }
    });

    saveButton.addEventListener('click', () => {
        // Collect data from the table
        const updatedData = collectFormData();
        
        // Create a downloadable blob of the new JSON file
        const jsonString = JSON.stringify(updatedData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        // Create a temporary link and click it to trigger download
        const a = document.createElement('a');
        a.href = url;
        a.download = 'edited_data.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    function renderForm(data) {
        let tableHtml = '<table><thead><tr>';
        
        // Create table headers
        const keys = Object.keys(data[0] || {});
        keys.forEach(key => {
            tableHtml += `<th>${key}</th>`;
        });
        tableHtml += '</tr></thead><tbody>';

        // Create table rows with editable inputs
        data.forEach((item, index) => {
            tableHtml += `<tr data-index="${index}">`;
            keys.forEach(key => {
                const value = item[key];
                if (typeof value === 'boolean') {
                    tableHtml += `<td><input type="checkbox" data-key="${key}" ${value ? 'checked' : ''} /></td>`;
                } else if (key.includes('date')) {
                    tableHtml += `<td><input type="date" data-key="${key}" value="${value}" /></td>`;
                } else {
                    tableHtml += `<td><input type="text" data-key="${key}" value="${value}" /></td>`;
                }
            });
            tableHtml += '</tr>';
        });

        tableHtml += '</tbody></table>';
        editorContainer.innerHTML = tableHtml;
    }

    function collectFormData() {
        const tableRows = document.querySelectorAll('#editorContainer tbody tr');
        const updatedData = [];

        tableRows.forEach(row => {
            const newItem = {};
            const inputs = row.querySelectorAll('input');
            inputs.forEach(input => {
                const key = input.dataset.key;
                if (input.type === 'checkbox') {
                    newItem[key] = input.checked;
                } else {
                    newItem[key] = input.value;
                }
            });
            updatedData.push(newItem);
        });

        return updatedData;
    }
});
