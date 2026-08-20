// ============================================================
// JSON QUERY BUILDER - Works with GitHub JSON Files
// ============================================================

class JsonQueryBuilder {
    constructor() {
        // State
        this.jsonData = null;
        this.fileSha = null;
        this.fileSize = 0;
        this.selectedNodes = new Set();
        this.whereConditions = [];
        this.outputFields = [];
        this.aggregations = [];
        this.orderBy = [];
        this.limit = 100;
        this.currentResults = [];
        this.nodeCache = {};
        this.currentAliasCounter = 1;

        this.init();
    }

    init() {
        // Tab switching
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                tab.classList.add('active');
                document.getElementById(tab.dataset.tab + 'Tab').classList.add('active');
            });
        });

        // Fetch JSON
        document.getElementById('fetchBtn').addEventListener('click', () => this.fetchJson());

        // Execute
        document.getElementById('executeBtn').addEventListener('click', () => this.executeQuery());
        document.getElementById('executeJsonpathBtn').addEventListener('click', () => this.executeJsonpath());

        // Clear
        document.getElementById('clearBtn').addEventListener('click', () => this.clearAll());

        // Where conditions
        document.getElementById('addWhereBtn').addEventListener('click', () => this.addWhereCondition());
        document.getElementById('clearWhereBtn').addEventListener('click', () => this.clearWhere());

        // Output fields
        document.getElementById('addOutputBtn').addEventListener('click', () => this.addOutputField());
        document.getElementById('clearOutputBtn').addEventListener('click', () => this.clearOutput());

        // Aggregations
        document.getElementById('addAggBtn').addEventListener('click', () => this.addAggregation());
        document.getElementById('clearAggBtn').addEventListener('click', () => this.clearAggregations());

        // Order by
        document.getElementById('addOrderBtn').addEventListener('click', () => this.addOrderBy());
        document.getElementById('clearOrderBtn').addEventListener('click', () => this.clearOrderBy());

        // Limit
        document.getElementById('limitInput').addEventListener('change', (e) => {
            this.limit = parseInt(e.target.value) || 100;
        });

        // Tree controls
        document.getElementById('selectAllNodes').addEventListener('click', () => this.selectAllTreeNodes());
        document.getElementById('deselectAllNodes').addEventListener('click', () => this.deselectAllTreeNodes());
        document.getElementById('expandAllBtn').addEventListener('click', () => this.expandAllTreeNodes());

        // Properties
        document.getElementById('applyPropsBtn').addEventListener('click', () => this.applyProperties());
        document.getElementById('resetPropsBtn').addEventListener('click', () => this.resetProperties());

        // Results
        document.getElementById('exportCsvBtn').addEventListener('click', () => this.exportCsv());
        document.getElementById('exportJsonBtn').addEventListener('click', () => this.exportJson());
        document.getElementById('clearResultsBtn').addEventListener('click', () => this.clearResults());

        // JSONPath
        document.getElementById('copyJsonpathBtn').addEventListener('click', () => this.copyJsonpath());
        document.getElementById('formatJsonpathBtn').addEventListener('click', () => this.formatJsonpath());

        // Save Query
        document.getElementById('saveQueryBtn').addEventListener('click', () => this.saveQuery());

        // Enter key on inputs
        document.querySelectorAll('#repoInput, #pathInput, #branchInput').forEach(inp => {
            inp.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') this.fetchJson();
            });
        });

        // Load defaults
        this.loadDefaults();
        this.setStatus('Ready. Enter GitHub details and click "Fetch JSON".');
    }

    // ============================================================
    // GITHUB FETCH
    // ============================================================
    async fetchJson() {
        const repo = document.getElementById('repoInput').value.trim();
        const path = document.getElementById('pathInput').value.trim();
        const branch = document.getElementById('branchInput').value.trim();

        if (!repo || !path || !branch) {
            this.setStatus('Please fill in repository, file path, and branch.', 'error');
            return;
        }

        // Validate repo format
        if (!repo.includes('/')) {
            this.setStatus('Repository must be in format "owner/repo"', 'error');
            return;
        }

        const url = `https://api.github.com/repos/${repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch)}`;

        this.setStatus(`Fetching ${path} from ${repo}...`, 'info');
        document.getElementById('fetchBtn').disabled = true;

        try {
            const response = await fetch(url);

            if (response.status === 404) {
                this.setStatus(`File "${path}" not found. Check path and branch.`, 'error');
                document.getElementById('fetchBtn').disabled = false;
                return;
            }

            if (!response.ok) {
                let errMsg = `GitHub API error (${response.status})`;
                try {
                    const errData = await response.json();
                    if (errData.message) errMsg += `: ${errData.message}`;
                } catch (_) {}
                throw new Error(errMsg);
            }

            const data = await response.json();

            if (!data.content) {
                throw new Error('No content in response');
            }

            // Decode base64
            const decoded = atob(data.content.replace(/\s/g, ''));
            this.jsonData = JSON.parse(decoded);
            this.fileSha = data.sha;
            this.fileSize = data.size || decoded.length;

            // Update file info
            document.getElementById('shaDisplay').textContent = `SHA: ${this.fileSha.substring(0, 7)}…`;
            document.getElementById('sizeDisplay').textContent = `Size: ${this.fileSize} bytes`;
            document.getElementById('nodeCount').textContent = `Nodes: ${this.countNodes(this.jsonData)}`;

            // Build tree
            this.buildTree(this.jsonData);

            this.setStatus(`✅ Successfully fetched ${path} (${this.fileSize} bytes)`, 'success');
            this.showNotification('JSON loaded successfully!', 'success');

        } catch (err) {
            this.setStatus(`❌ ${err.message}`, 'error');
        } finally {
            document.getElementById('fetchBtn').disabled = false;
        }
    }

    countNodes(obj) {
        let count = 0;
        if (obj && typeof obj === 'object') {
            if (Array.isArray(obj)) {
                obj.forEach(item => count += this.countNodes(item));
            } else {
                count += Object.keys(obj).length;
                Object.values(obj).forEach(val => count += this.countNodes(val));
            }
        }
        return count;
    }

    // ============================================================
    // TREE BUILDING
    // ============================================================
    buildTree(data, path = '$', name = 'root') {
        const container = document.getElementById('jsonTree');
        container.innerHTML = '';
        this.nodeCache = {};
        this.selectedNodes = new Set();

        const html = this.buildTreeNodes(data, path, name);
        container.innerHTML = html;

        // Attach events
        this.attachTreeEvents();
        this.updateSelectedDisplay();
        this.updateQueryPreview();
        this.updateFieldOptions();
    }

    buildTreeNodes(data, path, name) {
        const isArray = Array.isArray(data);
        const isObject = data && typeof data === 'object' && !isArray;
        const isValue = !isArray && !isObject;

        let html = '';

        if (isValue) {
            const displayValue = typeof data === 'string' ? `"${data}"` : String(data);
            const type = typeof data;
            const icon = this.getTypeIcon(type);
            html += `<div class="tree-node" data-path="${path}">`;
            html += `<div class="node-content">`;
            html += `<input type="checkbox" class="node-checkbox" data-path="${path}" />`;
            html += `<span class="node-icon">${icon}</span>`;
            html += `<span class="node-name">${name}</span>`;
            html += `<span class="node-type">${type}</span>`;
            html += `<span class="node-value">${displayValue}</span>`;
            html += `</div></div>`;
            this.nodeCache[path] = { type, value: data, name };
        } else if (isArray) {
            const icon = '📋';
            html += `<div class="tree-node" data-path="${path}">`;
            html += `<div class="node-content">`;
            html += `<input type="checkbox" class="node-checkbox" data-path="${path}" />`;
            html += `<span class="node-toggle">▼</span>`;
            html += `<span class="node-icon">${icon}</span>`;
            html += `<span class="node-name">${name}</span>`;
            html += `<span class="node-type">array [${data.length}]</span>`;
            html += `</div>`;
            html += `<div class="node-children">`;
            data.forEach((item, idx) => {
                html += this.buildTreeNodes(item, `${path}[${idx}]`, `[${idx}]`);
            });
            html += `</div></div>`;
            this.nodeCache[path] = { type: 'array', value: data, name };
        } else if (isObject) {
            const icon = '📁';
            const keys = Object.keys(data);
            html += `<div class="tree-node" data-path="${path}">`;
            html += `<div class="node-content">`;
            html += `<input type="checkbox" class="node-checkbox" data-path="${path}" />`;
            html += `<span class="node-toggle">▼</span>`;
            html += `<span class="node-icon">${icon}</span>`;
            html += `<span class="node-name">${name}</span>`;
            html += `<span class="node-type">object {${keys.length}}</span>`;
            html += `</div>`;
            html += `<div class="node-children">`;
            keys.forEach(key => {
                html += this.buildTreeNodes(data[key], `${path}.${key}`, key);
            });
            html += `</div></div>`;
            this.nodeCache[path] = { type: 'object', value: data, name };
        }

        return html;
    }

    getTypeIcon(type) {
        const icons = {
            'string': '🔤',
            'number': '🔢',
            'boolean': '✅',
            'object': '📁',
            'array': '📋',
            'null': '⬛',
            'undefined': '⬛'
        };
        return icons[type] || '📄';
    }

    attachTreeEvents() {
        // Toggle expand/collapse
        document.querySelectorAll('.node-toggle').forEach(toggle => {
            toggle.addEventListener('click', (e) => {
                e.stopPropagation();
                const node = toggle.closest('.tree-node');
                const children = node.querySelector('.node-children');
                if (children) {
                    children.classList.toggle('collapsed');
                    toggle.classList.toggle('collapsed');
                }
            });
        });

        // Checkbox events
        document.querySelectorAll('.node-checkbox').forEach(cb => {
            cb.addEventListener('change', (e) => {
                e.stopPropagation();
                const path = cb.dataset.path;
                if (cb.checked) {
                    this.selectedNodes.add(path);
                    // Auto-select children
                    this.selectChildren(path, true);
                } else {
                    this.selectedNodes.delete(path);
                    // Auto-deselect children
                    this.selectChildren(path, false);
                }
                this.updateSelectedDisplay();
                this.updateQueryPreview();
                this.updateFieldOptions();
                this.highlightSelected();
            });
        });

        // Click on node content
        document.querySelectorAll('.node-content').forEach(content => {
            content.addEventListener('click', (e) => {
                if (e.target.tagName === 'INPUT') return;
                const path = content.closest('.tree-node').dataset.path;
                this.selectNode(path);
                this.updateProperties(path);
            });
        });
    }

    selectChildren(path, checked) {
        document.querySelectorAll(`.node-checkbox[data-path^="${path}"]`).forEach(cb => {
            if (cb.dataset.path !== path) {
                cb.checked = checked;
                if (checked) this.selectedNodes.add(cb.dataset.path);
                else this.selectedNodes.delete(cb.dataset.path);
            }
        });
    }

    highlightSelected() {
        document.querySelectorAll('.node-content').forEach(el => {
            el.classList.toggle('selected', 
                this.selectedNodes.has(el.closest('.tree-node').dataset.path)
            );
        });
    }

    selectAllTreeNodes() {
        document.querySelectorAll('.node-checkbox').forEach(cb => {
            cb.checked = true;
            this.selectedNodes.add(cb.dataset.path);
        });
        this.updateSelectedDisplay();
        this.updateQueryPreview();
        this.updateFieldOptions();
        this.highlightSelected();
    }

    deselectAllTreeNodes() {
        document.querySelectorAll('.node-checkbox').forEach(cb => {
            cb.checked = false;
            this.selectedNodes.delete(cb.dataset.path);
        });
        this.updateSelectedDisplay();
        this.updateQueryPreview();
        this.updateFieldOptions();
        this.highlightSelected();
    }

    expandAllTreeNodes() {
        document.querySelectorAll('.node-children').forEach(el => {
            el.classList.remove('collapsed');
        });
        document.querySelectorAll('.node-toggle').forEach(el => {
            el.classList.remove('collapsed');
        });
    }

    selectNode(path) {
        // Find and highlight the node
        document.querySelectorAll('.node-content').forEach(el => {
            el.classList.remove('selected');
        });
        const node = document.querySelector(`.tree-node[data-path="${path}"] .node-content`);
        if (node) node.classList.add('selected');
    }

    // ============================================================
    // SELECTED NODES DISPLAY
    // ============================================================
    updateSelectedDisplay() {
        const container = document.getElementById('selectedNodesDisplay');
        const count = document.getElementById('selectedCount');

        const paths = Array.from(this.selectedNodes);
        count.textContent = `${paths.length} nodes`;

        if (paths.length === 0) {
            container.innerHTML = '<div class="empty-state">Select nodes from the left panel</div>';
            return;
        }

        let html = '';
        paths.forEach(path => {
            const node = this.nodeCache[path];
            const shortPath = path.length > 40 ? '…' + path.substring(path.length - 37) : path;
            const icon = node ? this.getTypeIcon(node.type) : '📄';
            html += `<span class="selected-node-tag">${icon} ${shortPath}</span>`;
        });
        container.innerHTML = html;
    }

    // ============================================================
    // WHERE CONDITIONS
    // ============================================================
    addWhereCondition(field = '', operator = '==', value = '') {
        const container = document.getElementById('whereContainer');
        const emptyState = container.querySelector('.empty-state');
        if (emptyState) emptyState.remove();

        const row = document.createElement('div');
        row.className = 'field-row';

        const fieldOptions = this.getFieldOptions();

        row.innerHTML = `
            <select class="field-select where-field">
                ${fieldOptions}
            </select>
            <select class="field-operator where-operator">
                <option value="==" ${operator === '==' ? 'selected' : ''}>==</option>
                <option value="!=" ${operator === '!=' ? 'selected' : ''}>!=</option>
                <option value=">" ${operator === '>' ? 'selected' : ''}>&gt;</option>
                <option value="<" ${operator === '<' ? 'selected' : ''}>&lt;</option>
                <option value=">=" ${operator === '>=' ? 'selected' : ''}>&gt;=</option>
                <option value="<=" ${operator === '<=' ? 'selected' : ''}>&lt;=</option>
                <option value="contains" ${operator === 'contains' ? 'selected' : ''}>contains</option>
                <option value="starts" ${operator === 'starts' ? 'selected' : ''}>starts with</option>
                <option value="ends" ${operator === 'ends' ? 'selected' : ''}>ends with</option>
                <option value="exists" ${operator === 'exists' ? 'selected' : ''}>exists</option>
            </select>
            <input type="text" class="field-value where-value" placeholder="Value" value="${value}" />
            <button class="field-remove where-remove">×</button>
        `;

        container.appendChild(row);

        const condition = { field: field || '', operator: operator || '==', value: value || '' };
        this.whereConditions.push(condition);

        // Events
        row.querySelector('.where-field').addEventListener('change', (e) => {
            const idx = Array.from(container.children).indexOf(row);
            this.whereConditions[idx].field = e.target.value;
            this.updateQueryPreview();
        });

        row.querySelector('.where-operator').addEventListener('change', (e) => {
            const idx = Array.from(container.children).indexOf(row);
            this.whereConditions[idx].operator = e.target.value;
            this.updateQueryPreview();
        });

        row.querySelector('.where-value').addEventListener('change', (e) => {
            const idx = Array.from(container.children).indexOf(row);
            this.whereConditions[idx].value = e.target.value;
            this.updateQueryPreview();
        });

        row.querySelector('.where-remove').addEventListener('click', () => {
            const idx = Array.from(container.children).indexOf(row);
            this.whereConditions.splice(idx, 1);
            row.remove();
            if (this.whereConditions.length === 0) {
                container.innerHTML = '<div class="empty-state">No conditions defined</div>';
            }
            this.updateQueryPreview();
        });

        // Set field value if provided
        if (field) {
            const select = row.querySelector('.where-field');
            if (Array.from(select.options).some(o => o.value === field)) {
                select.value = field;
            }
        }

        this.updateQueryPreview();
    }

    clearWhere() {
        this.whereConditions = [];
        document.getElementById('whereContainer').innerHTML = '<div class="empty-state">No conditions defined</div>';
        this.updateQueryPreview();
    }

    // ============================================================
    // OUTPUT FIELDS
    // ============================================================
    addOutputField(field = '', alias = '') {
        const container = document.getElementById('outputContainer');
        const emptyState = container.querySelector('.empty-state');
        if (emptyState) emptyState.remove();

        const row = document.createElement('div');
        row.className = 'field-row';

        const fieldOptions = this.getFieldOptions();

        row.innerHTML = `
            <select class="field-select output-field">
                ${fieldOptions}
            </select>
            <input type="text" class="field-alias output-alias" placeholder="Alias" value="${alias}" />
            <button class="field-remove output-remove">×</button>
        `;

        container.appendChild(row);

        const output = { field: field || '', alias: alias || '' };
        this.outputFields.push(output);

        row.querySelector('.output-field').addEventListener('change', (e) => {
            const idx = Array.from(container.children).indexOf(row);
            this.outputFields[idx].field = e.target.value;
            if (!row.querySelector('.output-alias').value) {
                const alias = e.target.value.split('.').pop() || e.target.value;
                row.querySelector('.output-alias').value = alias;
                this.outputFields[idx].alias = alias;
            }
            this.updateQueryPreview();
        });

        row.querySelector('.output-alias').addEventListener('change', (e) => {
            const idx = Array.from(container.children).indexOf(row);
            this.outputFields[idx].alias = e.target.value;
            this.updateQueryPreview();
        });

        row.querySelector('.output-remove').addEventListener('click', () => {
            const idx = Array.from(container.children).indexOf(row);
            this.outputFields.splice(idx, 1);
            row.remove();
            if (this.outputFields.length === 0) {
                container.innerHTML = '<div class="empty-state">Select fields to display</div>';
            }
            this.updateQueryPreview();
        });

        if (field) {
            const select = row.querySelector('.output-field');
            if (Array.from(select.options).some(o => o.value === field)) {
                select.value = field;
                if (!alias) {
                    const autoAlias = field.split('.').pop() || field;
                    row.querySelector('.output-alias').value = autoAlias;
                    this.outputFields[this.outputFields.length - 1].alias = autoAlias;
                }
            }
        }

        this.updateQueryPreview();
    }

    clearOutput() {
        this.outputFields = [];
        document.getElementById('outputContainer').innerHTML = '<div class="empty-state">Select fields to display</div>';
        this.updateQueryPreview();
    }

    // ============================================================
    // AGGREGATIONS
    // ============================================================
    addAggregation(field = '', func = 'COUNT', alias = '') {
        const container = document.getElementById('aggContainer');
        const emptyState = container.querySelector('.empty-state');
        if (emptyState) emptyState.remove();

        const row = document.createElement('div');
        row.className = 'field-row';

        const fieldOptions = this.getFieldOptions();

        row.innerHTML = `
            <select class="field-select agg-field">
                ${fieldOptions}
            </select>
            <select class="agg-function">
                <option value="COUNT" ${func === 'COUNT' ? 'selected' : ''}>COUNT</option>
                <option value="SUM" ${func === 'SUM' ? 'selected' : ''}>SUM</option>
                <option value="AVG" ${func === 'AVG' ? 'selected' : ''}>AVG</option>
                <option value="MIN" ${func === 'MIN' ? 'selected' : ''}>MIN</option>
                <option value="MAX" ${func === 'MAX' ? 'selected' : ''}>MAX</option>
            </select>
            <input type="text" class="field-alias agg-alias" placeholder="Alias" value="${alias}" />
            <button class="field-remove agg-remove">×</button>
        `;

        container.appendChild(row);

        const agg = { field: field || '', function: func || 'COUNT', alias: alias || '' };
        this.aggregations.push(agg);

        row.querySelector('.agg-field').addEventListener('change', (e) => {
            const idx = Array.from(container.children).indexOf(row);
            this.aggregations[idx].field = e.target.value;
            this.updateQueryPreview();
        });

        row.querySelector('.agg-function').addEventListener('change', (e) => {
            const idx = Array.from(container.children).indexOf(row);
            this.aggregations[idx].function = e.target.value;
            this.updateQueryPreview();
        });

        row.querySelector('.agg-alias').addEventListener('change', (e) => {
            const idx = Array.from(container.children).indexOf(row);
            this.aggregations[idx].alias = e.target.value;
            this.updateQueryPreview();
        });

        row.querySelector('.agg-remove').addEventListener('click', () => {
            const idx = Array.from(container.children).indexOf(row);
            this.aggregations.splice(idx, 1);
            row.remove();
            if (this.aggregations.length === 0) {
                container.innerHTML = '<div class="empty-state">No aggregations defined</div>';
            }
            this.updateQueryPreview();
        });

        if (field) {
            const select = row.querySelector('.agg-field');
            if (Array.from(select.options).some(o => o.value === field)) {
                select.value = field;
            }
        }

        this.updateQueryPreview();
    }

    clearAggregations() {
        this.aggregations = [];
        document.getElementById('aggContainer').innerHTML = '<div class="empty-state">No aggregations defined</div>';
        this.updateQueryPreview();
    }

    // ============================================================
    // ORDER BY
    // ============================================================
    addOrderBy(field = '', direction = 'ASC') {
        const container = document.getElementById('orderContainer');
        const emptyState = container.querySelector('.empty-state');
        if (emptyState) emptyState.remove();

        const row = document.createElement('div');
        row.className = 'field-row';

        const fieldOptions = this.getFieldOptions();

        row.innerHTML = `
            <select class="field-select order-field">
                ${fieldOptions}
            </select>
            <select class="order-direction">
                <option value="ASC" ${direction === 'ASC' ? 'selected' : ''}>ASC</option>
                <option value="DESC" ${direction === 'DESC' ? 'selected' : ''}>DESC</option>
            </select>
            <button class="field-remove order-remove">×</button>
        `;

        container.appendChild(row);

        const order = { field: field || '', direction: direction || 'ASC' };
        this.orderBy.push(order);

        row.querySelector('.order-field').addEventListener('change', (e) => {
            const idx = Array.from(container.children).indexOf(row);
            this.orderBy[idx].field = e.target.value;
            this.updateQueryPreview();
        });

        row.querySelector('.order-direction').addEventListener('change', (e) => {
            const idx = Array.from(container.children).indexOf(row);
            this.orderBy[idx].direction = e.target.value;
            this.updateQueryPreview();
        });

        row.querySelector('.order-remove').addEventListener('click', () => {
            const idx = Array.from(container.children).indexOf(row);
            this.orderBy.splice(idx, 1);
            row.remove();
            if (this.orderBy.length === 0) {
                container.innerHTML = '<div class="empty-state">No order by defined</div>';
            }
            this.updateQueryPreview();
        });

        if (field) {
            const select = row.querySelector('.order-field');
            if (Array.from(select.options).some(o => o.value === field)) {
                select.value = field;
            }
        }

        this.updateQueryPreview();
    }

    clearOrderBy() {
        this.orderBy = [];
        document.getElementById('orderContainer').innerHTML = '<div class="empty-state">No order by defined</div>';
        this.updateQueryPreview();
    }

    // ============================================================
    // FIELD OPTIONS
    // ============================================================
    getFieldOptions() {
        let options = '<option value="">Select field...</option>';
        const paths = Array.from(this.selectedNodes);
        paths.forEach(path => {
            const node = this.nodeCache[path];
            if (node) {
                const value = path;
                const display = path.length > 40 ? '…' + path.substring(path.length - 37) : path;
                const type = node.type;
                options += `<option value="${value}">${display} (${type})</option>`;
            }
        });
        // If no selected nodes, show all nodes
        if (paths.length === 0) {
            Object.keys(this.nodeCache).forEach(path => {
                const node = this.nodeCache[path];
                const display = path.length > 40 ? '…' + path.substring(path.length - 37) : path;
                options += `<option value="${path}">${display} (${node.type})</option>`;
            });
        }
        return options;
    }

    updateFieldOptions() {
        // Update all select dropdowns
        document.querySelectorAll('.where-field, .output-field, .agg-field, .order-field')
            .forEach(select => {
                const currentVal = select.value;
                const newOptions = this.getFieldOptions();
                select.innerHTML = newOptions;
                if (Array.from(select.options).some(o => o.value === currentVal)) {
                    select.value = currentVal;
                }
            });
    }

    // ============================================================
    // PROPERTIES
    // ============================================================
    updateProperties(path) {
        const node = this.nodeCache[path];
        if (!node) return;

        document.getElementById('fieldProperties').style.display = 'block';
        document.getElementById('propPath').value = path;
        document.getElementById('propType').value = node.type;
        document.getElementById('propValue').value = typeof node.value === 'object' ? 
            JSON.stringify(node.value).substring(0, 100) : String(node.value);

        // Check if this node is already in output fields
        const existing = this.outputFields.find(f => f.field === path);
        if (existing) {
            document.getElementById('propAlias').value = existing.alias || '';
        } else {
            document.getElementById('propAlias').value = '';
        }

        // Check if in aggregations
        const agg = this.aggregations.find(a => a.field === path);
        if (agg) {
            document.getElementById('propAggregate').value = agg.function || '';
        } else {
            document.getElementById('propAggregate').value = '';
        }

        // Check if in order by
        const order = this.orderBy.find(o => o.field === path);
        if (order) {
            document.getElementById('propSortType').value = order.direction || '';
        } else {
            document.getElementById('propSortType').value = '';
        }

        // Check if in where conditions
        const where = this.whereConditions.find(w => w.field === path);
        if (where) {
            document.getElementById('propCriteria').value = where.value || '';
        } else {
            document.getElementById('propCriteria').value = '';
        }

        document.getElementById('propSortOrder').value = '';
    }

    applyProperties() {
        const path = document.getElementById('propPath').value;
        if (!path) return;

        const alias = document.getElementById('propAlias').value;
        const aggregate = document.getElementById('propAggregate').value;
        const sortType = document.getElementById('propSortType').value;
        const criteria = document.getElementById('propCriteria').value;

        // Update output fields
        let outputField = this.outputFields.find(f => f.field === path);
        if (!outputField && alias) {
            // Add to output
            this.addOutputField(path, alias);
        } else if (outputField) {
            outputField.alias = alias || path.split('.').pop() || path;
            // Update UI
            const rows = document.querySelectorAll('.output-field');
            rows.forEach(row => {
                if (row.value === path) {
                    const container = row.closest('.field-row');
                    const aliasInput = container.querySelector('.output-alias');
                    if (aliasInput) aliasInput.value = outputField.alias;
                }
            });
        }

        // Update aggregations
        let aggField = this.aggregations.find(a => a.field === path);
        if (aggregate) {
            if (!aggField) {
                this.addAggregation(path, aggregate, `${aggregate}_${path.split('.').pop() || path}`);
            } else {
                aggField.function = aggregate;
                // Update UI
                const rows = document.querySelectorAll('.agg-field');
                rows.forEach(row => {
                    if (row.value === path) {
                        const container = row.closest('.field-row');
                        const funcSelect = container.querySelector('.agg-function');
                        if (funcSelect) funcSelect.value = aggregate;
                    }
                });
            }
        } else if (aggField) {
            // Remove aggregation
            const idx = this.aggregations.indexOf(aggField);
            if (idx > -1) {
                this.aggregations.splice(idx, 1);
                // Remove UI row
                const rows = document.querySelectorAll('.agg-field');
                rows.forEach(row => {
                    if (row.value === path) {
                        row.closest('.field-row').remove();
                    }
                });
                if (this.aggregations.length === 0) {
                    document.getElementById('aggContainer').innerHTML = '<div class="empty-state">No aggregations defined</div>';
                }
            }
        }

        // Update order by
        let orderField = this.orderBy.find(o => o.field === path);
        if (sortType) {
            if (!orderField) {
                this.addOrderBy(path, sortType);
            } else {
                orderField.direction = sortType;
                // Update UI
                const rows = document.querySelectorAll('.order-field');
                rows.forEach(row => {
                    if (row.value === path) {
                        const container = row.closest('.field-row');
                        const dirSelect = container.querySelector('.order-direction');
                        if (dirSelect) dirSelect.value = sortType;
                    }
                });
            }
        } else if (orderField) {
            // Remove order
            const idx = this.orderBy.indexOf(orderField);
            if (idx > -1) {
                this.orderBy.splice(idx, 1);
                const rows = document.querySelectorAll('.order-field');
                rows.forEach(row => {
                    if (row.value === path) {
                        row.closest('.field-row').remove();
                    }
                });
                if (this.orderBy.length === 0) {
                    document.getElementById('orderContainer').innerHTML = '<div class="empty-state">No order by defined</div>';
                }
            }
        }

        // Update where conditions
        let whereField = this.whereConditions.find(w => w.field === path);
        if (criteria) {
            if (!whereField) {
                // Try to parse criteria for operator
                let operator = '==';
                let value = criteria;
                if (criteria.includes('>=')) { operator = '>='; value = criteria.split('>=')[1].trim(); }
                else if (criteria.includes('<=')) { operator = '<='; value = criteria.split('<=')[1].trim(); }
                else if (criteria.includes('!=')) { operator = '!='; value = criteria.split('!=')[1].trim(); }
                else if (criteria.includes('>')) { operator = '>'; value = criteria.split('>')[1].trim(); }
                else if (criteria.includes('<')) { operator = '<'; value = criteria.split('<')[1].trim(); }
                this.addWhereCondition(path, operator, value);
            } else {
                whereField.value = criteria;
                // Update UI
                const rows = document.querySelectorAll('.where-field');
                rows.forEach(row => {
                    if (row.value === path) {
                        const container = row.closest('.field-row');
                        const valueInput = container.querySelector('.where-value');
                        if (valueInput) valueInput.value = criteria;
                    }
                });
            }
        } else if (whereField) {
            // Remove where
            const idx = this.whereConditions.indexOf(whereField);
            if (idx > -1) {
                this.whereConditions.splice(idx, 1);
                const rows = document.querySelectorAll('.where-field');
                rows.forEach(row => {
                    if (row.value === path) {
                        row.closest('.field-row').remove();
                    }
                });
                if (this.whereConditions.length === 0) {
                    document.getElementById('whereContainer').innerHTML = '<div class="empty-state">No conditions defined</div>';
                }
            }
        }

        this.updateQueryPreview();
        this.showNotification('Properties applied', 'success');
    }

    resetProperties() {
        document.getElementById('propAlias').value = '';
        document.getElementById('propAggregate').value = '';
        document.getElementById('propSortType').value = '';
        document.getElementById('propSortOrder').value = '';
        document.getElementById('propCriteria').value = '';
    }

    // ============================================================
    // QUERY GENERATION
    // ============================================================
    generateJsonPath() {
        const selectedNodes = Array.from(this.selectedNodes);
        if (selectedNodes.length === 0) return '$';

        let path = '';

        // Build WHERE conditions
        let whereClause = '';
        if (this.whereConditions.length > 0) {
            const conditions = this.whereConditions.filter(w => w.field && w.value);
            if (conditions.length > 0) {
                const condStr = conditions.map(w => {
                    const fieldPath = w.field;
                    let val = w.value;
                    if (w.operator === 'exists') {
                        return `${fieldPath}`;
                    }
                    const opMap = {
                        '==': '==',
                        '!=': '!=',
                        '>': '>',
                        '<': '<',
                        '>=': '>=',
                        '<=': '<=',
                        'contains': 'includes',
                        'starts': 'startsWith',
                        'ends': 'endsWith'
                    };
                    const op = opMap[w.operator] || '==';
                    if (['includes', 'startsWith', 'endsWith'].includes(op)) {
                        return `${fieldPath}.${op}("${val}")`;
                    }
                    if (!isNaN(val) && val !== '') {
                        return `${fieldPath} ${op} ${val}`;
                    }
                    return `${fieldPath} ${op} "${val}"`;
                }).join(' && ');
                whereClause = `[?(${condStr})]`;
            }
        }

        // Build output selection
        let output = '';
        if (this.outputFields.length > 0) {
            const fields = this.outputFields.map(f => f.field);
            // Use a simple approach - select the first selected node
            output = selectedNodes[0];
            // If there are multiple, use OR
            if (selectedNodes.length > 1) {
                output = `(${selectedNodes.join(' || ')})`;
            }
        } else {
            output = selectedNodes.length === 1 ? selectedNodes[0] : `(${selectedNodes.join(' || ')})`;
        }

        path = output + whereClause;

        // Add order by if specified
        if (this.orderBy.length > 0) {
            // JSONPath doesn't have native ordering, we'll handle in JS
            // Just add a comment for now
        }

        return path || '$';
    }

    updateQueryPreview() {
        const path = this.generateJsonPath();
        const preview = document.getElementById('queryPreview');
        const description = document.getElementById('queryDescription');

        if (preview) {
            preview.textContent = path || 'No query built';
        }

        if (description) {
            const parts = [];
            if (this.selectedNodes.size > 0) parts.push(`Selecting ${this.selectedNodes.size} node(s)`);
            if (this.whereConditions.length > 0) parts.push(`${this.whereConditions.length} condition(s)`);
            if (this.outputFields.length > 0) parts.push(`${this.outputFields.length} output field(s)`);
            if (this.aggregations.length > 0) parts.push(`${this.aggregations.length} aggregation(s)`);
            if (this.orderBy.length > 0) parts.push(`${this.orderBy.length} order(s)`);
            description.textContent = parts.length > 0 ? parts.join(', ') : 'No query configured';
        }

        // Update JSONPath editor
        const editor = document.getElementById('jsonpathEditor');
        if (editor && !editor.matches(':focus')) {
            editor.value = path;
        }
    }

    // ============================================================
    // EXECUTION
    // ============================================================
    executeQuery() {
        if (!this.jsonData) {
            this.setStatus('No JSON data loaded. Fetch a file first.', 'error');
            return;
        }

        const path = this.generateJsonPath();
        if (!path || path === '$') {
            this.setStatus('Please select nodes and/or add conditions.', 'error');
            return;
        }

        const startTime = performance.now();

        try {
            // Execute the query
            const results = this.executeJsonPathQuery(this.jsonData, path);
            const endTime = performance.now();

            // Apply aggregations if any
            let finalResults = results;
            if (this.aggregations.length > 0) {
                finalResults = this.applyAggregations(results);
            }

            // Apply ordering
            if (this.orderBy.length > 0) {
                finalResults = this.applyOrdering(finalResults);
            }

            // Apply limit
            if (this.limit > 0 && finalResults.length > this.limit) {
                finalResults = finalResults.slice(0, this.limit);
            }

            this.currentResults = finalResults;
            this.displayResults(finalResults, (endTime - startTime).toFixed(0));

            this.setStatus(`Query executed. ${finalResults.length} results found.`, 'success');
            this.showNotification(`Found ${finalResults.length} results`, 'success');

        } catch (err) {
            this.setStatus(`Error: ${err.message}`, 'error');
        }
    }

    executeJsonPathQuery(obj, path) {
        // Simple JSONPath implementation
        const results = [];

        // Handle filter expressions
        const filterMatch = path.match(/^(.+)\[\(\?(.+)\)\]$/);
        if (filterMatch) {
            const basePath = filterMatch[1];
            const filterExpr = filterMatch[2];
            const baseData = this.getValueByPath(obj, basePath);
            if (Array.isArray(baseData)) {
                return baseData.filter(item => this.evaluateFilter(item, filterExpr));
            }
            return [];
        }

        // Handle OR expressions
        if (path.includes('||')) {
            const paths = path.split('||').map(p => p.trim());
            paths.forEach(p => {
                const val = this.getValueByPath(obj, p);
                if (val !== undefined) {
                    if (Array.isArray(val)) results.push(...val);
                    else results.push(val);
                }
            });
            return results;
        }

        // Simple path
        const result = this.getValueByPath(obj, path);
        if (result !== undefined) {
            return Array.isArray(result) ? result : [result];
        }

        return results;
    }

    getValueByPath(obj, path) {
        if (!path || path === '$') return obj;
        // Remove leading $.
        const cleanPath = path.replace(/^\$\./, '');
        const parts = cleanPath.split('.');
        let current = obj;
        for (const part of parts) {
            if (current === null || current === undefined) return undefined;
            // Handle array indexing
            const arrayMatch = part.match(/^(.+)\[(\d+)\]$/);
            if (arrayMatch) {
                const key = arrayMatch[1];
                const index = parseInt(arrayMatch[2]);
                if (current[key] && Array.isArray(current[key])) {
                    current = current[key][index];
                } else {
                    return undefined;
                }
            } else if (current[part] !== undefined) {
                current = current[part];
            } else {
                return undefined;
            }
        }
        return current;
    }

    evaluateFilter(item, filterExpr) {
        try {
            // Parse conditions like: @.field == value
            const parts = filterExpr.split('&&').map(p => p.trim());
            return parts.every(part => {
                const match = part.match(/@\.([^ ]+)\s*(==|!=|>|<|>=|<=)\s*(.+)/);
                if (match) {
                    const field = match[1];
                    const op = match[2];
                    let value = match[3].trim();
                    if (value.startsWith('"') && value.endsWith('"')) {
                        value = value.substring(1, value.length - 1);
                    } else if (!isNaN(value) && value !== '') {
                        value = parseFloat(value);
                    }
                    const itemVal = this.getValueByPath(item, field);
                    switch(op) {
                        case '==': return itemVal == value;
                        case '!=': return itemVal != value;
                        case '>': return itemVal > value;
                        case '<': return itemVal < value;
                        case '>=': return itemVal >= value;
                        case '<=': return itemVal <= value;
                        default: return false;
                    }
                }
                // Handle includes
                const includesMatch = part.match(/@\.([^ ]+)\.includes\((.+)\)/);
                if (includesMatch) {
                    const field = includesMatch[1];
                    let value = includesMatch[2].trim();
                    if (value.startsWith('"') && value.endsWith('"')) {
                        value = value.substring(1, value.length - 1);
                    }
                    const itemVal = this.getValueByPath(item, field);
                    return String(itemVal).includes(String(value));
                }
                // Handle startsWith
                const startsMatch = part.match(/@\.([^ ]+)\.startsWith\((.+)\)/);
                if (startsMatch) {
                    const field = startsMatch[1];
                    let value = startsMatch[2].trim();
                    if (value.startsWith('"') && value.endsWith('"')) {
                        value = value.substring(1, value.length - 1);
                    }
                    const itemVal = this.getValueByPath(item, field);
                    return String(itemVal).startsWith(String(value));
                }
                // Handle endsWith
                const endsMatch = part.match(/@\.([^ ]+)\.endsWith\((.+)\)/);
                if (endsMatch) {
                    const field = endsMatch[1];
                    let value = endsMatch[2].trim();
                    if (value.startsWith('"') && value.endsWith('"')) {
                        value = value.substring(1, value.length - 1);
                    }
                    const itemVal = this.getValueByPath(item, field);
                    return String(itemVal).endsWith(String(value));
                }
                return true;
            });
        } catch (e) {
            return false;
        }
    }

    applyAggregations(data) {
        if (this.aggregations.length === 0 || data.length === 0) return data;

        const result = {};
        this.aggregations.forEach(agg => {
            const values = data.map(item => {
                const val = this.getValueByPath(item, agg.field);
                return val;
            }).filter(v => v !== undefined && v !== null);

            let aggResult;
            switch(agg.function) {
                case 'COUNT': aggResult = values.length; break;
                case 'SUM': aggResult = values.reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0); break;
                case 'AVG': aggResult = values.length > 0 ? values.reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0) / values.length : 0; break;
                case 'MIN': aggResult = Math.min(...values.filter(v => typeof v === 'number')); break;
                case 'MAX': aggResult = Math.max(...values.filter(v => typeof v === 'number')); break;
                default: aggResult = values;
            }
            const key = agg.alias || `${agg.function}_${agg.field.split('.').pop() || agg.field}`;
            result[key] = aggResult;
        });

        return [result];
    }

    applyOrdering(data) {
        if (this.orderBy.length === 0) return data;

        const order = this.orderBy[0];
        const field = order.field;
        const direction = order.direction === 'DESC' ? -1 : 1;

        return [...data].sort((a, b) => {
            const valA = this.getValueByPath(a, field);
            const valB = this.getValueByPath(b, field);
            if (valA === undefined) return direction;
            if (valB === undefined) return -direction;
            if (typeof valA === 'number' && typeof valB === 'number') {
                return (valA - valB) * direction;
            }
            return String(valA).localeCompare(String(valB)) * direction;
        });
    }

    // ============================================================
    // JSONPATH EXECUTION
    // ============================================================
    executeJsonpath() {
        if (!this.jsonData) {
            this.setStatus('No JSON data loaded. Fetch a file first.', 'error');
            return;
        }

        const editor = document.getElementById('jsonpathEditor');
        const path = editor.value.trim();

        if (!path) {
            this.setStatus('Please enter a JSONPath expression.', 'error');
            return;
        }

        const startTime = performance.now();

        try {
            const results = this.executeJsonPathQuery(this.jsonData, path);
            const endTime = performance.now();

            this.currentResults = results;
            this.displayResults(results, (endTime - startTime).toFixed(0));

            this.setStatus(`JSONPath executed. ${results.length} results found.`, 'success');
            this.showNotification(`Found ${results.length} results`, 'success');

        } catch (err) {
            this.setStatus(`Error: ${err.message}`, 'error');
        }
    }

    // ============================================================
    // RESULTS DISPLAY
    // ============================================================
    displayResults(data, timeMs) {
        const container = document.getElementById('resultsContainer');
        const count = document.getElementById('resultsCount');
        const time = document.getElementById('resultsTime');

        if (!data || data.length === 0) {
            container.innerHTML = '<div class="empty-state">No results returned</div>';
            count.textContent = '0 rows';
            time.textContent = '';
            return;
        }

        // Determine columns
        const columns = new Set();
        data.forEach(row => {
            if (row && typeof row === 'object') {
                Object.keys(row).forEach(k => columns.add(k));
            }
        });

        // If items are primitives, create a single column
        const isPrimitive = data.every(item => typeof item !== 'object' || item === null);
        const colArray = isPrimitive ? ['Value'] : Array.from(columns);

        let html = '<table class="results-grid"><thead><tr>';
        colArray.forEach(col => {
            html += `<th>${col}</th>`;
        });
        html += '</tr></thead><tbody>';

        data.forEach(row => {
            html += '<tr>';
            colArray.forEach(col => {
                let value;
                if (isPrimitive) {
                    value = row;
                } else {
                    value = row[col];
                }
                if (typeof value === 'object' && value !== null) {
                    value = JSON.stringify(value);
                }
                if (value === null || value === undefined) {
                    value = '';
                }
                html += `<td>${value}</td>`;
            });
            html += '</tr>';
        });

        html += '</tbody></table>';

        container.innerHTML = html;
        count.textContent = `${data.length} rows`;
        time.textContent = timeMs ? `(${timeMs}ms)` : '';
    }

    // ============================================================
    // EXPORT
    // ============================================================
    exportCsv() {
        if (this.currentResults.length === 0) {
            this.setStatus('No results to export', 'error');
            return;
        }

        // Determine columns
        const columns = new Set();
        this.currentResults.forEach(row => {
            if (row && typeof row === 'object') {
                Object.keys(row).forEach(k => columns.add(k));
            }
        });

        const colArray = Array.from(columns);
        let csv = colArray.join(',') + '\n';

        this.currentResults.forEach(row => {
            const values = colArray.map(col => {
                let value = row[col] || '';
                if (typeof value === 'string' && value.includes(',')) {
                    value = `"${value}"`;
                }
                return value;
            });
            csv += values.join(',') + '\n';
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `query_results_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);

        this.showNotification('CSV exported', 'success');
    }

    exportJson() {
        if (this.currentResults.length === 0) {
            this.setStatus('No results to export', 'error');
            return;
        }

        const json = JSON.stringify(this.currentResults, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `query_results_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);

        this.showNotification('JSON exported', 'success');
    }

    clearResults() {
        this.currentResults = [];
        const container = document.getElementById('resultsContainer');
        container.innerHTML = '<div class="empty-state"><span style="font-size:2rem;display:block;">📋</span><p>Execute a query to see results here</p></div>';
        document.getElementById('resultsCount').textContent = '0 rows';
        document.getElementById('resultsTime').textContent = '';
    }

    // ============================================================
    // JSONPATH UTILITIES
    // ============================================================
    copyJsonpath() {
        const editor = document.getElementById('jsonpathEditor');
        if (!editor || !editor.value) {
            this.setStatus('No JSONPath to copy', 'error');
            return;
        }
        navigator.clipboard.writeText(editor.value).then(() => {
            this.showNotification('JSONPath copied', 'success');
        }).catch(() => {
            editor.select();
            document.execCommand('copy');
            this.showNotification('JSONPath copied', 'success');
        });
    }

    formatJsonpath() {
        const editor = document.getElementById('jsonpathEditor');
        if (!editor) return;
        // Simple formatting - wrap long expressions
        let path = editor.value;
        path = path.replace(/\[\(\?/g, '[\n  (?');
        path = path.replace(/\)\]/g, ')\n]');
        editor.value = path;
        this.showNotification('JSONPath formatted', 'success');
    }

    // ============================================================
    // SAVE QUERY
    // ============================================================
    saveQuery() {
        const path = this.generateJsonPath();
        if (!path || path === '$') {
            this.setStatus('No query to save', 'error');
            return;
        }

        const name = prompt('Enter a name for this query:');
        if (!name) return;

        const query = {
            name: name,
            path: path,
            selectedNodes: Array.from(this.selectedNodes),
            whereConditions: this.whereConditions,
            outputFields: this.outputFields,
            aggregations: this.aggregations,
            orderBy: this.orderBy,
            limit: this.limit
        };

        // Save to localStorage
        const savedQueries = JSON.parse(localStorage.getItem('json_queries') || '[]');
        savedQueries.push(query);
        localStorage.setItem('json_queries', JSON.stringify(savedQueries));

        this.showNotification(`Query "${name}" saved`, 'success');
    }

    // ============================================================
    // CLEAR ALL
    // ============================================================
    clearAll() {
        this.selectedNodes = new Set();
        this.whereConditions = [];
        this.outputFields = [];
        this.aggregations = [];
        this.orderBy = [];
        this.currentResults = [];

        document.getElementById('jsonTree').innerHTML = '<div class="empty-state">Fetch a JSON file to see structure</div>';
        document.getElementById('selectedNodesDisplay').innerHTML = '<div class="empty-state">Select nodes from the left panel</div>';
        document.getElementById('selectedCount').textContent = '0 nodes';
        document.getElementById('whereContainer').innerHTML = '<div class="empty-state">No conditions defined</div>';
        document.getElementById('outputContainer').innerHTML = '<div class="empty-state">Select fields to display</div>';
        document.getElementById('aggContainer').innerHTML = '<div class="empty-state">No aggregations defined</div>';
        document.getElementById('orderContainer').innerHTML = '<div class="empty-state">No order by defined</div>';
        document.getElementById('queryPreview').textContent = 'No query built';
        document.getElementById('queryDescription').textContent = 'No query configured';
        document.getElementById('jsonpathEditor').value = '';
        document.getElementById('fieldProperties').style.display = 'none';
        this.clearResults();

        this.setStatus('All cleared');
        this.showNotification('All cleared', 'info');
    }

    // ============================================================
    // LOAD DEFAULTS
    // ============================================================
    loadDefaults() {
        // Load saved queries from localStorage
        const savedQueries = JSON.parse(localStorage.getItem('json_queries') || '[]');
        if (savedQueries.length > 0) {
            console.log(`Loaded ${savedQueries.length} saved queries`);
        }
    }

    // ============================================================
    // UI HELPERS
    // ============================================================
    setStatus(message, type = 'info') {
        const statusBar = document.getElementById('statusBar');
        if (statusBar) {
            statusBar.textContent = message;
            statusBar.style.color = type === 'error' ? '#f38ba8' : 
                                    type === 'success' ? '#a6e3a1' : '#a6adc8';
        }
    }

    showNotification(message, type = 'info') {
        const statusBar = document.getElementById('statusBar');
        if (statusBar) {
            statusBar.textContent = message;
            statusBar.style.color = type === 'error' ? '#f38ba8' : 
                                    type === 'success' ? '#a6e3a1' : '#89b4fa';
            setTimeout(() => {
                statusBar.style.color = '#a6adc8';
            }, 3000);
        }
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    const builder = new JsonQueryBuilder();
    window.queryBuilder = builder;
});