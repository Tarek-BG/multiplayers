document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('fileInput');
    const editorContainer = document.getElementById('editorContainer');
    const saveButton = document.getElementById('saveButton');

    let originalData = null;
    let isArrayData = false;

    fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const parsed = JSON.parse(e.target.result);
                    
                    // Check if data is array or single object
                    if (Array.isArray(parsed)) {
                        originalData = parsed.filter(item => Object.keys(item).length > 0);
                        isArrayData = true;
                    } else {
                        originalData = parsed;
                        isArrayData = false;
                    }
                    
                    renderForm(originalData, isArrayData);
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

    function renderForm(data, isArray) {
        if (!data || (Array.isArray(data) && data.length === 0)) {
            editorContainer.innerHTML = '<p>No data found in the JSON file.</p>';
            return;
        }

        let html = '<div style="overflow-x: auto;">';
        
        if (isArray) {
            // Handle array data
            data.forEach((item, index) => {
                html += `<div style="margin-bottom: 30px; border: 1px solid #4CAF50; padding: 20px; border-radius: 8px; background: #f9f9f9;">`;
                html += `<h3 style="margin-top: 0; color: #4CAF50;">Record ${index + 1}</h3>`;
                html += renderObject(item, `[${index}]`, 0);
                html += `</div>`;
            });
        } else {
            // Handle single object
            html += `<div style="margin-bottom: 30px; border: 1px solid #4CAF50; padding: 20px; border-radius: 8px; background: #f9f9f9;">`;
            html += `<h3 style="margin-top: 0; color: #4CAF50;">Family Data</h3>`;
            html += renderObject(data, '', 0);
            html += `</div>`;
        }

        html += '</div>';
        editorContainer.innerHTML = html;
        
        // Add click listeners for image preview
        document.querySelectorAll('.photo-preview').forEach(img => {
            img.addEventListener('click', function() {
                showImagePreview(this.src);
            });
        });
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
                // Handle URLs/photo URLs with preview
                html += `<div style="margin-left: ${indent}px; margin-bottom: 5px; padding: 5px;">`;
                html += `<strong>${key}:</strong> `;
                const id = `input_${currentPath}`;
                html += `<input type="text" id="${id}" data-path="${currentPath}" value="${value || ''}" style="width: 50%; padding: 5px; border: 1px solid #ccc; border-radius: 4px;">`;
                if (value) {
                    html += ` <button onclick="showImagePreview('${value}')" style="margin-left: 10px; padding: 5px 10px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">👁️ Preview</button>`;
                    html += ` <img src="${value}" class="photo-preview" style="width: 50px; height: 50px; object-fit: cover; border-radius: 50%; margin-left: 10px; cursor: pointer; border: 2px solid #4CAF50;" alt="Preview">`;
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
            
            // Handle single object vs array
            if (!isArrayData && !Array.isArray(result)) {
                // For single objects, start from the root
                current = result;
            } else if (isArrayData && Array.isArray(result)) {
                // For arrays, we need to handle the index
                if (pathParts[0].includes('[')) {
                    const match = pathParts[0].match(/\[(\d+)\]/);
                    if (match) {
                        const index = parseInt(match[1]);
                        if (index < result.length) {
                            current = result[index];
                            pathParts.shift(); // Remove the index part
                        }
                    }
                }
            }
            
            // Navigate through the path
            for (let i = 0; i < pathParts.length; i++) {
                const part = pathParts[i];
                
                // Handle array indices like [0]
                if (part.includes('[')) {
                    const match = part.match(/(.+?)\[(\d+)\]/);
                    if (match) {
                        const arrayName = match[1];
                        const index = parseInt(match[2]);
                        
                        if (i === pathParts.length - 1) {
                            // This is the last part - update the value
                            if (input.type === 'checkbox') {
                                if (Array.isArray(current[arrayName])) {
                                    current[arrayName][index] = input.checked;
                                } else {
                                    current[arrayName][index] = input.checked;
                                }
                            } else {
                                if (Array.isArray(current[arrayName])) {
                                    current[arrayName][index] = input.value;
                                } else {
                                    current[arrayName][index] = input.value;
                                }
                            }
                        } else {
                            // Navigate deeper
                            if (Array.isArray(current[arrayName])) {
                                current = current[arrayName][index];
                            } else {
                                current = current[arrayName][index];
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

    // Function to show image preview in a modal
    window.showImagePreview = function(imageUrl) {
        if (!imageUrl) return;
        
        // Create modal overlay
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 9999;
            cursor: pointer;
        `;
        
        // Create image container
        const container = document.createElement('div');
        container.style.cssText = `
            background: white;
            padding: 20px;
            border-radius: 10px;
            max-width: 90%;
            max-height: 90%;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5);
            position: relative;
        `;
        
        // Create close button
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '✕';
        closeBtn.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            background: #f44336;
            color: white;
            border: none;
            border-radius: 50%;
            width: 30px;
            height: 30px;
            font-size: 18px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        closeBtn.onclick = (e) => {
            e.stopPropagation();
            document.body.removeChild(overlay);
        };
        
        // Create image
        const img = document.createElement('img');
        img.src = imageUrl;
        img.style.cssText = `
            max-width: 100%;
            max-height: 80vh;
            border-radius: 5px;
            display: block;
        `;
        img.onerror = function() {
            this.style.display = 'none';
            const errorMsg = document.createElement('p');
            errorMsg.textContent = 'Failed to load image';
            errorMsg.style.cssText = 'color: #f44336; padding: 20px;';
            container.appendChild(errorMsg);
        };
        
        // Append elements
        container.appendChild(closeBtn);
        container.appendChild(img);
        overlay.appendChild(container);
        document.body.appendChild(overlay);
        
        // Click on overlay to close
        overlay.onclick = function(e) {
            if (e.target === overlay) {
                document.body.removeChild(overlay);
            }
        };
        
        // Close on Escape key
        const escapeHandler = function(e) {
            if (e.key === 'Escape') {
                document.body.removeChild(overlay);
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
    };
});