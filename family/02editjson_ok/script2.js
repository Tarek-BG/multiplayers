document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('fileInput');
    const editorContainer = document.getElementById('editorContainer');
    const saveButton = document.getElementById('saveButton');

    let originalData = [];

    fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const parsed = JSON.parse(e.target.result);
                    originalData = parsed.filter(item => Object.keys(item).length > 0);
                    renderForm(originalData);
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

        let html = '<div style="overflow-x: auto;">';
        
        data.forEach((item, index) => {
            html += `<div style="margin-bottom: 30px; border: 1px solid #4CAF50; padding: 20px; border-radius: 8px; background: #f9f9f9;">`;
            html += `<h3 style="margin-top: 0; color: #4CAF50;">Record ${index + 1}</h3>`;
            html += renderObject(item, `[${index}]`, 0);
            html += `</div>`;
        });

        html += '</div>';
        editorContainer.innerHTML = html;
    }

    function renderObject(obj, path, depth) {
        let html = '';
        const indent = depth * 20;
        
        for (const [key, value] of Object.entries(obj)) {
            const currentPath = path ? `${path}.${key}` : key;
            
            if (Array.isArray(value)) {
                // Handle arrays
                html += `<div style="margin-left: ${indent}px; margin-bottom: 10px; padding: 10px; background: #e8f5e9; border-radius: 5px;">`;
                html += `<strong style="color: #2e7d32;">${key}:</strong> <span style="color: #666;">[Array - ${value.length} item${value.length !== 1 ? 's' : ''}]</span><br>`;
                
                value.forEach((item, idx) => {
                    html += `<div style="margin-left: 20px; padding: 8px; border-left: 3px solid #4CAF50; background: #f1f8e9; margin-top: 5px;">`;
                    html += `<strong style="color: #388e3c;">Item ${idx + 1}:</strong><br>`;
                    
                    if (typeof item === 'object' && item !== null) {
                        html += renderObject(item, `${currentPath}[${idx}]`, depth + 1);
                    } else {
                        const id = `input_${currentPath}[${idx}]`;
                        html += `<input type="text" id="${id}" data-path="${currentPath}[${idx}]" value="${item || ''}" style="width: 100%; max-width: 400px; padding: 5px; border: 1px solid #ccc; border-radius: 4px;">`;
                    }
                    html += `</div>`;
                });
                html += `</div>`;
            } else if (typeof value === 'object' && value !== null) {
                // Handle nested objects
                html += `<div style="margin-left: ${indent}px; margin-bottom: 10px; padding: 10px; background: #e3f2fd; border-radius: 5px; border-left: 3px solid #1976d2;">`;
                html += `<strong style="color: #0d47a1;">${key}:</strong><br>`;
                html += renderObject(value, currentPath, depth + 1);
                html += `</div>`;
            } else if (typeof value === 'boolean') {
                // Handle booleans
                html += `<div style="margin-left: ${indent}px; margin-bottom: 5px; padding: 5px;">`;
                html += `<strong>${key}:</strong> `;
                const id = `input_${currentPath}`;
                html += `<input type="checkbox" id="${id}" data-path="${currentPath}" ${value ? 'checked' : ''} style="transform: scale(1.2); margin-left: 5px;">`;
                html += `</div>`;
            } else if (typeof value === 'string' && key.toLowerCase().includes('date')) {
                // Handle dates
                html += `<div style="margin-left: ${indent}px; margin-bottom: 5px; padding: 5px;">`;
                html += `<strong>${key}:</strong> `;
                const id = `input_${currentPath}`;
                html += `<input type="date" id="${id}" data-path="${currentPath}" value="${value || ''}" style="padding: 5px; border: 1px solid #ccc; border-radius: 4px;">`;
                html += `</div>`;
            } else if (typeof value === 'string' && (key.toLowerCase().includes('photo') || key.toLowerCase().includes('url'))) {
                // Handle URLs/photo URLs
                html += `<div style="margin-left: ${indent}px; margin-bottom: 5px; padding: 5px;">`;
                html += `<strong>${key}:</strong> `;
                const id = `input_${currentPath}`;
                html += `<input type="text" id="${id}" data-path="${currentPath}" value="${value || ''}" style="width: 60%; padding: 5px; border: 1px solid #ccc; border-radius: 4px;">`;
                if (value) {
                    html += ` <a href="${value}" target="_blank" style="margin-left: 10px; font-size: 12px; color: #1976d2;">🔗 Preview</a>`;
                }
                html += `</div>`;
            } else {
                // Handle regular text
                html += `<div style="margin-left: ${indent}px; margin-bottom: 5px; padding: 5px;">`;
                html += `<strong>${key}:</strong> `;
                const id = `input_${currentPath}`;
                html += `<input type="text" id="${id}" data-path="${currentPath}" value="${value || ''}" style="width: 60%; padding: 5px; border: 1px solid #ccc; border-radius: 4px;">`;
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
            const pathParts = path.split('.');
            
            // Navigate to the correct position in the result
            let current = result;
            let currentPath = '';
            
            for (let i = 0; i < pathParts.length; i++) {
                const part = pathParts[i];
                
                // Handle array indices like [0]
                if (part.includes('[')) {
                    const match = part.match(/(.+?)\[(\d+)\]/);
                    if (match) {
                        const arrayName = match[1];
                        const index = parseInt(match[2]);
                        
                        // Move to the array
                        if (typeof current === 'object' && current !== null && !Array.isArray(current)) {
                            // Get the array property
                            if (Array.isArray(current[arrayName])) {
                                // Navigate to the specific item in the array
                                if (i === pathParts.length - 1) {
                                    // This is the last part - update the value
                                    const array = current[arrayName];
                                    if (input.type === 'checkbox') {
                                        array[index] = input.checked;
                                    } else {
                                        array[index] = input.value;
                                    }
                                } else {
                                    // Navigate deeper
                                    current = current[arrayName][index];
                                }
                            } else if (current[arrayName]) {
                                // Handle case where it's an object inside an array
                                if (i === pathParts.length - 1) {
                                    // This is the last part - update the value
                                    if (input.type === 'checkbox') {
                                        current[arrayName][index] = input.checked;
                                    } else {
                                        current[arrayName][index] = input.value;
                                    }
                                } else {
                                    current = current[arrayName][index];
                                }
                            }
                        }
                    }
                } else {
                    // Handle regular property
                    if (i === pathParts.length - 1) {
                        // This is the last part - update the value
                        if (input.type === 'checkbox') {
                            current[part] = input.checked;
                        } else {
                            current[part] = input.value;
                        }
                    } else {
                        // Navigate deeper
                        if (typeof current === 'object' && current !== null && !Array.isArray(current)) {
                            if (!current[part]) {
                                // Create the object if it doesn't exist
                                current[part] = {};
                            }
                            current = current[part];
                        }
                    }
                }
            }
        });
        
        return result;
    }
});