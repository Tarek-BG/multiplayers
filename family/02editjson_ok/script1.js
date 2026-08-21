document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('fileInput');
    const editorContainer = document.getElementById('editorContainer');
    const saveButton = document.getElementById('saveButton');

    let jsonData = [];
    let originalData = [];

    fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    jsonData = JSON.parse(e.target.result);
                    originalData = JSON.parse(JSON.stringify(jsonData)); // Deep copy
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
        const updatedData = collectFormData();
        const jsonString = JSON.stringify(updatedData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'edited_data.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    function renderForm(data) {
        if (!data || data.length === 0) {
            editorContainer.innerHTML = '<p>No data found in the JSON file.</p>';
            return;
        }

        // Handle nested objects by showing them in a tree-like structure
        let html = '<div style="overflow-x: auto;">';
        
        data.forEach((item, index) => {
            if (Object.keys(item).length === 0) return; // Skip empty objects
            
            html += `<div style="margin-bottom: 30px; border: 1px solid #ccc; padding: 15px; border-radius: 5px;">`;
            html += `<h3>Record ${index + 1}</h3>`;
            html += renderObject(item, `item_${index}`, '');
            html += `</div>`;
        });

        html += '</div>';
        editorContainer.innerHTML = html;
    }

    function renderObject(obj, prefix, indent) {
        let html = '';
        
        for (const [key, value] of Object.entries(obj)) {
            const id = `${prefix}_${key}`;
            
            if (Array.isArray(value)) {
                // Handle arrays
                html += `<div style="margin-left: 20px; margin-bottom: 10px;">`;
                html += `<strong>${key}:</strong> [Array - ${value.length} items]<br>`;
                value.forEach((item, idx) => {
                    html += `<div style="margin-left: 20px; border-left: 2px solid #ddd; padding-left: 10px;">`;
                    html += `<strong>Item ${idx + 1}:</strong><br>`;
                    if (typeof item === 'object' && item !== null) {
                        html += renderObject(item, `${id}_${idx}`, '  ');
                    } else {
                        html += `<input type="text" data-path="${id}_${idx}" value="${item || ''}" style="width: 100%; max-width: 300px;">`;
                    }
                    html += `</div>`;
                });
                html += `</div>`;
            } else if (typeof value === 'object' && value !== null) {
                // Handle nested objects
                html += `<div style="margin-left: 20px; margin-bottom: 10px; border-left: 3px solid #4CAF50; padding-left: 10px;">`;
                html += `<strong>${key}:</strong><br>`;
                html += renderObject(value, `${id}`, '  ');
                html += `</div>`;
            } else if (typeof value === 'boolean') {
                // Handle booleans
                html += `<div style="margin-left: 20px; margin-bottom: 5px;">`;
                html += `<strong>${key}:</strong> `;
                html += `<input type="checkbox" data-path="${id}" ${value ? 'checked' : ''}>`;
                html += `</div>`;
            } else if (typeof value === 'string' && key.toLowerCase().includes('date')) {
                // Handle dates
                html += `<div style="margin-left: 20px; margin-bottom: 5px;">`;
                html += `<strong>${key}:</strong> `;
                html += `<input type="date" data-path="${id}" value="${value || ''}">`;
                html += `</div>`;
            } else if (typeof value === 'string' && key.toLowerCase().includes('url')) {
                // Handle URLs - show as text and preview
                html += `<div style="margin-left: 20px; margin-bottom: 5px;">`;
                html += `<strong>${key}:</strong> `;
                html += `<input type="text" data-path="${id}" value="${value || ''}" style="width: 60%;">`;
                if (value) {
                    html += ` <a href="${value}" target="_blank" style="font-size: 12px;">🔗 Preview</a>`;
                }
                html += `</div>`;
            } else {
                // Handle regular text
                html += `<div style="margin-left: 20px; margin-bottom: 5px;">`;
                html += `<strong>${key}:</strong> `;
                html += `<input type="text" data-path="${id}" value="${value || ''}" style="width: 60%;">`;
                html += `</div>`;
            }
        }
        
        return html;
    }

    function collectFormData() {
        // Start with a deep copy of the original data
        const result = JSON.parse(JSON.stringify(originalData));
        
        // Get all inputs in the editor
        const inputs = document.querySelectorAll('#editorContainer input');
        inputs.forEach(input => {
            const path = input.dataset.path;
            if (!path) return;
            
            // Parse the path
            const parts = path.split('_');
            const itemIndex = parseInt(parts[1]);
            const key = parts[2];
            
            // Navigate to the correct position in the result
            let current = result[itemIndex];
            
            // Handle nested paths (e.g., person_name, person_father_name)
            for (let i = 2; i < parts.length; i++) {
                if (i === parts.length - 1) {
                    // Last part is the key
                    const lastKey = parts[i];
                    if (input.type === 'checkbox') {
                        current[lastKey] = input.checked;
                    } else {
                        current[lastKey] = input.value;
                    }
                } else {
                    // Navigate deeper
                    if (!current[parts[i]]) {
                        current[parts[i]] = {};
                    }
                    current = current[parts[i]];
                }
            }
        });
        
        return result;
    }
});