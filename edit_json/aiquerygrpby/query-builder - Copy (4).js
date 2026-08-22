// ============================================================
// JSON QUERY BUILDER - Clean field names & auto-output all fields
// ============================================================

class JsonQueryBuilder {
    constructor() {
        this.jsonData = null;
        this.fileSha = null;
        this.fileSize = 0;
        this.selectedNodes = new Set();
        this.whereConditions = [];
        this.groupByFields = [];
        this.outputFields = [];
        this.aggregations = [];
        this.orderBy = [];
        this.limit = 100;
        this.currentResults = [];
        this.nodeCache = {};
        this.currentAliasCounter = 1;
        this.defaultQuerySet = false;
        this.dataIsArray = false;

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

        document.getElementById('fetchBtn').addEventListener('click', () => this.fetchJson());
        document.getElementById('executeBtn').addEventListener('click', () => this.executeQuery());
        document.getElementById('executeJsonpathBtn').addEventListener('click', () => this.executeJsonpath());
        document.getElementById('clearBtn').addEventListener('click', () => this.clearAll());

        document.getElementById('addWhereBtn').addEventListener('click', () => this.addWhereCondition());
        document.getElementById('clearWhereBtn').addEventListener('click', () => this.clearWhere());

        document.getElementById('addGroupBtn').addEventListener('click', () => this.addGroupBy());
        document.getElementById('clearGroupBtn').addEventListener('click', () => this.clearGroupBy());

        document.getElementById('addOutputBtn').addEventListener('click', () => this.addOutputField());
        document.getElementById('clearOutputBtn').addEventListener('click', () => this.clearOutput());

        document.getElementById('addAggBtn').addEventListener('click', () => this.addAggregation());
        document.getElementById('clearAggBtn').addEventListener('click', () => this.clearAggregations());

        document.getElementById('addOrderBtn').addEventListener('click', () => this.addOrderBy());
        document.getElementById('clearOrderBtn').addEventListener('click', () => this.clearOrderBy());

        document.getElementById('limitInput').addEventListener('change', (e) => {
            this.limit = parseInt(e.target.value) || 100;
        });

        document.getElementById('selectAllNodes').addEventListener('click', () => this.selectAllTreeNodes());
        document.getElementById('deselectAllNodes').addEventListener('click', () => this.deselectAllTreeNodes());
        document.getElementById('expandAllBtn').addEventListener('click', () => this.expandAllTreeNodes());

        document.getElementById('applyPropsBtn').addEventListener('click', () => this.applyProperties());
        document.getElementById('resetPropsBtn').addEventListener('click', () => this.resetProperties());

        document.getElementById('exportCsvBtn').addEventListener('click', () => this.exportCsv());
        document.getElementById('exportJsonBtn').addEventListener('click', () => this.exportJson());
        document.getElementById('clearResultsBtn').addEventListener('click', () => this.clearResults());

        document.getElementById('copyJsonpathBtn').addEventListener('click', () => this.copyJsonpath());
        document.getElementById('formatJsonpathBtn').addEventListener('click', () => this.formatJsonpath());

        document.getElementById('saveQueryBtn').addEventListener('click', () => this.saveQuery());

        document.querySelectorAll('#repoInput, #pathInput, #branchInput').forEach(inp => {
            inp.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') this.fetchJson();
            });
        });

        // Add a button to add all fields as output
        const outputHeader = document.querySelector('#outputContainer').closest('.clause-section').querySelector('.clause-actions');
        const addAllBtn = document.createElement('button');
        addAllBtn.className = 'btn-sm btn-secondary';
        addAllBtn.textContent = 'Add All';
        addAllBtn.addEventListener('click', () => this.addAllOutputFields());
        outputHeader.appendChild(addAllBtn);

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

            const decoded = atob(data.content.replace(/\s/g, ''));
            this.jsonData = JSON.parse(decoded);
            this.fileSha = data.sha;
            this.fileSize = data.size || decoded.length;

            this.dataIsArray = Array.isArray(this.jsonData);

            document.getElementById('shaDisplay').textContent = `SHA: ${this.fileSha.substring(0, 7)}…`;
            document.getElementById('sizeDisplay').textContent = `Size: ${this.fileSize} bytes`;
            document.getElementById('nodeCount').textContent = `Nodes: ${this.countNodes(this.jsonData)}`;

            // Clear old state
            this.defaultQuerySet = false;
            this.whereConditions = [];
            this.groupByFields = [];
            this.outputFields = [];
            this.aggregations = [];
            this.orderBy = [];

            this.buildTree(this.jsonData);

            // Set default query after tree is built
            if (!this.defaultQuerySet) {
                this.setupDefaultQuery();
                this.defaultQuerySet = true;
            }

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
    // DEFAULT QUERY: GROUP BY name, WHERE surname = 'ben gadha'
    // and automatically add ALL fields to output
    // ============================================================
    setupDefaultQuery() {
        if (!this.jsonData) return;

        // Find paths for "name" and "surname"
        const namePath = Object.keys(this.nodeCache).find(p => 
            p.endsWith('.name') || p.includes('[0].name')
        );
        const surnamePath = Object.keys(this.nodeCache).find(p => 
            p.endsWith('.surname') || p.includes('[0].surname')
        );

        if (namePath) {
            this.addGroupBy(namePath);
        }
        if (surnamePath) {
            this.addWhereCondition(surnamePath, '==', 'ben gadha');
        }

        // Automatically add ALL leaf nodes as output fields
        this.addAllOutputFields();

        // Select all nodes for display
        this.selectAllTreeNodes();

        this.updateQueryPreview();
        this.showNotification('Default query: GROUP BY name, WHERE surname = "ben gadha". All fields added to output.', 'info');
    }

    // ============================================================
    // ADD ALL LEAF NODES AS OUTPUT FIELDS
    // ============================================================
    addAllOutputFields() {
        // Clear existing output
        this.clearOutput();
        const leafPaths = Object.keys(this.nodeCache).filter(path => {
            const node = this.nodeCache[path];
            // Leaf nodes are those that are not arrays or objects
            return node && node.type !== 'array' && node.type !== 'object';
        });
        leafPaths.forEach(path => {
            const alias = path.split('.').pop() || path;
            this.addOutputField(path, alias);
        });
    }

    // ============================================================
    // TREE BUILDING - SHOW PROPERTY NAMES, NOT INDICES
    // ============================================================
    buildTree(data, path = '$', name = 'root') {
        const container = document.getElementById('jsonTree');
        container.innerHTML = '';
        this.nodeCache = {};
        this.selectedNodes = new Set();

        const html = this.buildTreeNodes(data, path, name);
        container.innerHTML = html;

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
            // For display, show the property name (the last part) without index
            const displayName = name.startsWith('[') ? name : name;
            html += `<div class="tree-node" data-path="${path}">`;
            html += `<div class="node-content">`;
            html += `<input type="checkbox" class="node-checkbox" data-path="${path}" />`;
            html += `<span class="node-icon">${icon}</span>`;
            html += `<span class="node-name">${displayName}</span>`;
            html += `<span class="node-type">${type}</span>`;
            html += `<span class="node-value">${displayValue}</span>`;
            html += `</div></div>`;
            this.nodeCache[path] = { type, value: data, name: displayName };
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
                // For array items, we want to show the properties directly without the index as a separate node
                // So we skip the index level and go directly to the object's properties
                if (typeof item === 'object' && !Array.isArray(item)) {
                    Object.keys(item).forEach(key => {
                        const childPath = `${path}[${idx}].${key}`;
                        html += this.buildTreeNodes(item[key], childPath, key);
                    });
                } else {
                    // If item is primitive or array, show with index
                    html += this.buildTreeNodes(item, `${path}[${idx}]`, `[${idx}]`);
                }
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

        document.querySelectorAll('.node-checkbox').forEach(cb => {
            cb.addEventListener('change', (e) => {
                e.stopPropagation();
                const path = cb.dataset.path;
                if (cb.checked) {
                    this.selectedNodes.add(path);
                    this.selectChildren(path, true);
                } else {
                    this.selectedNodes.delete(path);
                    this.selectChildren(path, false);
                }
                this.updateSelectedDisplay();
                this.updateQueryPreview();
                this.updateFieldOptions();
                this.highlightSelected();
            });
        });

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
    // GROUP BY
    // ============================================================
    addGroupBy(field = '') {
        const container = document.getElementById('groupContainer');
        const emptyState = container.querySelector('.empty-state');
        if (emptyState) emptyState.remove();

        const row = document.createElement('div');
        row.className = 'field-row';

        const fieldOptions = this.getFieldOptions();

        row.innerHTML = `
            <select class="field-select group-field">
                ${fieldOptions}
            </select>
            <button class="field-remove group-remove">×</button>
        `;

        container.appendChild(row);

        const group = { field: field || '' };
        this.groupByFields.push(group);

        row.querySelector('.group-field').addEventListener('change', (e) => {
            const idx = Array.from(container.children).indexOf(row);
            this.groupByFields[idx].field = e.target.value;
            this.updateQueryPreview();
        });

        row.querySelector('.group-remove').addEventListener('click', () => {
            const idx = Array.from(container.children).indexOf(row);
            this.groupByFields.splice(idx, 1);
            row.remove();
            if (this.groupByFields.length === 0) {
                container.innerHTML = '<div class="empty-state">No group by defined</div>';
            }
            this.updateQueryPreview();
        });

        if (field) {
            const select = row.querySelector('.group-field');
            if (Array.from(select.options).some(o => o.value === field)) {
                select.value = field;
            }
        }

        this.updateQueryPreview();
    }

    clearGroupBy() {
        this.groupByFields = [];
        document.getElementById('groupContainer').innerHTML = '<div class="empty-state">No group by defined</div>';
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
    // FIELD OPTIONS - SHOW ONLY PROPERTY NAMES (last part)
    // ============================================================
    getFieldOptions() {
        let options = '<option value="">Select field...</option>';
        // Get all leaf nodes
        const leafPaths = Object.keys(this.nodeCache).filter(path => {
            const node = this.nodeCache[path];
            return node && node.type !== 'array' && node.type !== 'object';
        });
        if (leafPaths.length === 0) {
            return options;
        }
        leafPaths.sort((a, b) => a.length - b.length);
        leafPaths.forEach(path => {
            const node = this.nodeCache[path];
            // Extract the property name (last part after dot or bracket)
            let displayName = path.split('.').pop() || path;
            // Remove any trailing index
            displayName = displayName.replace(/\[\d+\]$/, '');
            const type = node ? node.type : 'unknown';
            options += `<option value="${path}">${displayName} (${type})</option>`;
        });
        return options;
    }

    updateFieldOptions() {
        document.querySelectorAll('.where-field, .group-field, .output-field, .agg-field, .order-field')
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

        const existing = this.outputFields.find(f => f.field === path);
        if (existing) {
            document.getElementById('propAlias').value = existing.alias || '';
        } else {
            document.getElementById('propAlias').value = '';
        }

        const agg = this.aggregations.find(a => a.field === path);
        if (agg) {
            document.getElementById('propAggregate').value = agg.function || '';
        } else {
            document.getElementById('propAggregate').value = '';
        }

        const order = this.orderBy.find(o => o.field === path);
        if (order) {
            document.getElementById('propSortType').value = order.direction || '';
        } else {
            document.getElementById('propSortType').value = '';
        }

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

        let outputField = this.outputFields.find(f => f.field === path);
        if (!outputField && alias) {
            this.addOutputField(path, alias);
        } else if (outputField) {
            outputField.alias = alias || path.split('.').pop() || path;
            const rows = document.querySelectorAll('.output-field');
            rows.forEach(row => {
                if (row.value === path) {
                    const container = row.closest('.field-row');
                    const aliasInput = container.querySelector('.output-alias');
                    if (aliasInput) aliasInput.value = outputField.alias;
                }
            });
        }

        let aggField = this.aggregations.find(a => a.field === path);
        if (aggregate) {
            if (!aggField) {
                this.addAggregation(path, aggregate, `${aggregate}_${path.split('.').pop() || path}`);
            } else {
                aggField.function = aggregate;
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
            const idx = this.aggregations.indexOf(aggField);
            if (idx > -1) {
                this.aggregations.splice(idx, 1);
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

        let orderField = this.orderBy.find(o => o.field === path);
        if (sortType) {
            if (!orderField) {
                this.addOrderBy(path, sortType);
            } else {
                orderField.direction = sortType;
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

        let whereField = this.whereConditions.find(w => w.field === path);
        if (criteria) {
            let operator = '==';
            let value = criteria;
            if (criteria.includes('>=')) { operator = '>='; value = criteria.split('>=')[1].trim(); }
            else if (criteria.includes('<=')) { operator = '<='; value = criteria.split('<=')[1].trim(); }
            else if (criteria.includes('!=')) { operator = '!='; value = criteria.split('!=')[1].trim(); }
            else if (criteria.includes('>')) { operator = '>'; value = criteria.split('>')[1].trim(); }
            else if (criteria.includes('<')) { operator = '<'; value = criteria.split('<')[1].trim(); }
            if (!whereField) {
                this.addWhereCondition(path, operator, value);
            } else {
                whereField.value = criteria;
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
        let whereClause = '';
        if (this.whereConditions.length > 0) {
            const conditions = this.whereConditions.filter(w => w.field && w.value);
            if (conditions.length > 0) {
                const condStr = conditions.map(w => {
                    let fieldPath = w.field;
                    fieldPath = fieldPath.replace(/\[\d+\]/g, '');
                    fieldPath = fieldPath.replace(/^\$\./, '');
                    fieldPath = fieldPath.replace(/^\./, '');
                    
                    let val = w.value;
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
                        return `@.${fieldPath}.${op}("${val}")`;
                    }
                    if (!isNaN(val) && val !== '') {
                        return `@.${fieldPath} ${op} ${val}`;
                    }
                    return `@.${fieldPath} ${op} "${val}"`;
                }).join(' && ');
                whereClause = `[?(${condStr})]`;
            }
        }

        let basePath = '$';
        if (this.outputFields.length > 0) {
            const firstField = this.outputFields[0].field;
            let base = firstField.replace(/\[\d+\]/g, '');
            base = base.replace(/\.[^.]+$/, '');
            if (base && base !== '$') {
                basePath = base;
            }
        }

        return basePath + whereClause;
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
            if (this.groupByFields.length > 0) parts.push(`Group by ${this.groupByFields.length} field(s)`);
            if (this.outputFields.length > 0) parts.push(`${this.outputFields.length} output field(s)`);
            if (this.aggregations.length > 0) parts.push(`${this.aggregations.length} aggregation(s)`);
            if (this.orderBy.length > 0) parts.push(`${this.orderBy.length} order(s)`);
            description.textContent = parts.length > 0 ? parts.join(', ') : 'No query configured';
        }

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

        this.setStatus('Executing query...', 'info');

        const startTime = performance.now();

        try {
            let data = this.jsonData;
            if (!Array.isArray(data)) {
                data = [data];
            }

            // Apply WHERE filters
            let filteredData = data;
            if (this.whereConditions.length > 0) {
                filteredData = data.filter(item => {
                    return this.evaluateFilterOnItem(item);
                });
            }

            if (filteredData.length === 0) {
                this.currentResults = [];
                this.displayResults([], (performance.now() - startTime).toFixed(0));
                this.setStatus('No results found matching the filters.', 'info');
                this.showNotification('0 results found', 'info');
                return;
            }

            // Group By
            let groupedData = filteredData;
            if (this.groupByFields.length > 0) {
                groupedData = this.applyGroupByOnData(filteredData);
            }

            // Aggregations
            let finalData = groupedData;
            if (this.aggregations.length > 0) {
                finalData = this.applyAggregationsOnData(groupedData);
            }

            // Order By
            if (this.orderBy.length > 0) {
                finalData = this.applyOrderingOnData(finalData);
            }

            // Limit
            if (this.limit > 0 && finalData.length > this.limit) {
                finalData = finalData.slice(0, this.limit);
            }

            // Format output fields
            if (this.outputFields.length > 0) {
                finalData = finalData.map(row => {
                    const newRow = {};
                    this.outputFields.forEach(out => {
                        const fieldName = out.alias || out.field.split('.').pop() || out.field;
                        const value = this.getFieldValueFromRow(row, out.field);
                        newRow[fieldName] = value !== undefined ? value : '';
                    });
                    return newRow;
                });
            }

            this.currentResults = finalData;
            this.displayResults(finalData, (performance.now() - startTime).toFixed(0));

            this.setStatus(`✅ Query executed. ${finalData.length} results found.`, 'success');
            this.showNotification(`Found ${finalData.length} results`, 'success');

        } catch (err) {
            this.setStatus(`Error: ${err.message}`, 'error');
            console.error('Query execution error:', err);
        }
    }

    evaluateFilterOnItem(item) {
        if (this.whereConditions.length === 0) return true;
        
        return this.whereConditions.every(condition => {
            if (!condition.field) return true;
            
            let path = condition.field.replace(/\[\d+\]/g, '');
            path = path.replace(/^\$\./, '');
            const value = this.getValueFromObject(item, path);
            
            if (value === undefined) return false;
            
            const compareValue = condition.value;
            const operator = condition.operator;
            
            const strValue = String(value);
            const strCompare = String(compareValue);
            
            switch(operator) {
                case '==': return value == compareValue;
                case '!=': return value != compareValue;
                case '>': return parseFloat(value) > parseFloat(compareValue);
                case '<': return parseFloat(value) < parseFloat(compareValue);
                case '>=': return parseFloat(value) >= parseFloat(compareValue);
                case '<=': return parseFloat(value) <= parseFloat(compareValue);
                case 'contains': return strValue.includes(strCompare);
                case 'starts': return strValue.startsWith(strCompare);
                case 'ends': return strValue.endsWith(strCompare);
                case 'exists': return value !== undefined && value !== null;
                default: return false;
            }
        });
    }

    getValueFromObject(obj, path) {
        if (!path || path === '') return obj;
        const parts = path.split('.');
        let current = obj;
        for (const part of parts) {
            if (current === null || current === undefined) return undefined;
            if (typeof current === 'object' && part in current) {
                current = current[part];
            } else {
                return undefined;
            }
        }
        return current;
    }

    getFieldValueFromRow(row, fieldPath) {
        if (row._items && Array.isArray(row._items) && row._items.length > 0) {
            const path = fieldPath.replace(/\[\d+\]/g, '').replace(/^\$\./, '');
            return this.getValueFromObject(row._items[0], path);
        }
        const path = fieldPath.replace(/\[\d+\]/g, '').replace(/^\$\./, '');
        return this.getValueFromObject(row, path);
    }

    // ============================================================
    // GROUP BY
    // ============================================================
    applyGroupByOnData(data) {
        if (this.groupByFields.length === 0) return data;

        const groupKeys = this.groupByFields.map(g => g.field);
        const groups = new Map();

        data.forEach(item => {
            const key = groupKeys.map(k => {
                const path = k.replace(/\[\d+\]/g, '').replace(/^\$\./, '');
                const val = this.getValueFromObject(item, path);
                return String(val !== undefined && val !== null ? val : 'null');
            }).join('|||');

            if (!groups.has(key)) {
                groups.set(key, { items: [], groupKey: key });
            }
            groups.get(key).items.push(item);
        });

        const result = [];
        groups.forEach((group) => {
            const row = {};
            groupKeys.forEach((k) => {
                const path = k.replace(/\[\d+\]/g, '').replace(/^\$\./, '');
                const val = this.getValueFromObject(group.items[0], path);
                const fieldName = k.split('.').pop() || k;
                row[fieldName] = val;
            });
            row._items = group.items;
            result.push(row);
        });

        return result;
    }

    // ============================================================
    // AGGREGATIONS
    // ============================================================
    applyAggregationsOnData(data) {
        if (this.aggregations.length === 0 || data.length === 0) return data;

        const hasGroups = data.some(row => row._items);
        
        if (!hasGroups) {
            const allItems = data;
            const row = {};
            this.aggregations.forEach(agg => {
                const values = allItems.map(item => {
                    const path = agg.field.replace(/\[\d+\]/g, '').replace(/^\$\./, '');
                    return this.getValueFromObject(item, path);
                }).filter(v => v !== undefined && v !== null);

                const aggResult = this.calculateAggregate(values, agg.function);
                const key = agg.alias || `${agg.function}_${agg.field.split('.').pop() || agg.field}`;
                row[key] = aggResult;
            });
            return [row];
        }

        const result = data.map(row => {
            const items = row._items || [];
            const newRow = { ...row };
            
            this.aggregations.forEach(agg => {
                const values = items.map(item => {
                    const path = agg.field.replace(/\[\d+\]/g, '').replace(/^\$\./, '');
                    return this.getValueFromObject(item, path);
                }).filter(v => v !== undefined && v !== null);

                const aggResult = this.calculateAggregate(values, agg.function);
                const key = agg.alias || `${agg.function}_${agg.field.split('.').pop() || agg.field}`;
                newRow[key] = aggResult;
            });
            
            delete newRow._items;
            return newRow;
        });

        return result;
    }

    calculateAggregate(values, func) {
        if (values.length === 0) return 0;
        
        switch(func) {
            case 'COUNT': return values.length;
            case 'SUM': return values.reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0);
            case 'AVG': return values.reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0) / values.length;
            case 'MIN': return Math.min(...values.filter(v => typeof v === 'number'));
            case 'MAX': return Math.max(...values.filter(v => typeof v === 'number'));
            default: return values;
        }
    }

    // ============================================================
    // ORDER BY
    // ============================================================
    applyOrderingOnData(data) {
        if (this.orderBy.length === 0) return data;

        const order = this.orderBy[0];
        const direction = order.direction === 'DESC' ? -1 : 1;
        const field = order.field;
        const fieldName = field.split('.').pop() || field;

        return [...data].sort((a, b) => {
            let valA = a[fieldName] !== undefined ? a[fieldName] : this.getValueFromObject(a, field.replace(/^\$\./, ''));
            let valB = b[fieldName] !== undefined ? b[fieldName] : this.getValueFromObject(b, field.replace(/^\$\./, ''));
            
            if (valA === undefined || valA === null) return direction;
            if (valB === undefined || valB === null) return -direction;
            
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
            let data = this.jsonData;
            if (!Array.isArray(data)) data = [data];
            
            const cleanPath = path.replace(/^\$\./, '');
            if (cleanPath) {
                const results = [];
                data.forEach(item => {
                    const val = this.getValueFromObject(item, cleanPath);
                    if (val !== undefined) results.push(val);
                });
                this.currentResults = results;
                this.displayResults(results, (performance.now() - startTime).toFixed(0));
                this.setStatus(`JSONPath executed. ${results.length} results found.`, 'success');
            } else {
                this.displayResults(data, (performance.now() - startTime).toFixed(0));
                this.setStatus(`JSONPath executed. ${data.length} results found.`, 'success');
            }

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

        const columns = new Set();
        data.forEach(row => {
            if (row && typeof row === 'object') {
                Object.keys(row).forEach(k => {
                    if (k !== '_items') columns.add(k);
                });
            }
        });

        if (columns.size === 0) {
            const colArray = ['Value'];
            let html = '<table class="results-grid"><thead><tr><th>Value</th></tr></thead><tbody>';
            data.forEach(val => {
                html += `<tr><td>${val}</td></tr>`;
            });
            html += '</tbody></table>';
            container.innerHTML = html;
            count.textContent = `${data.length} rows`;
            time.textContent = timeMs ? `(${timeMs}ms)` : '';
            return;
        }

        const colArray = Array.from(columns);
        let html = '<table class="results-grid"><thead><tr>';
        colArray.forEach(col => {
            html += `<th>${col}</th>`;
        });
        html += '</tr></thead><tbody>';

        data.forEach(row => {
            html += '<tr>';
            colArray.forEach(col => {
                let value = row[col];
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

        const columns = new Set();
        this.currentResults.forEach(row => {
            if (row && typeof row === 'object') {
                Object.keys(row).forEach(k => {
                    if (k !== '_items') columns.add(k);
                });
            }
        });

        if (columns.size === 0) {
            let csv = 'Value\n';
            this.currentResults.forEach(val => {
                csv += `${val}\n`;
            });
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `query_results_${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            this.showNotification('CSV exported', 'success');
            return;
        }

        const colArray = Array.from(columns);
        let csv = colArray.join(',') + '\n';

        this.currentResults.forEach(row => {
            const values = colArray.map(col => {
                let value = row[col] || '';
                if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                    value = `"${value.replace(/"/g, '""')}"`;
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
            groupByFields: this.groupByFields,
            outputFields: this.outputFields,
            aggregations: this.aggregations,
            orderBy: this.orderBy,
            limit: this.limit
        };

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
        this.groupByFields = [];
        this.outputFields = [];
        this.aggregations = [];
        this.orderBy = [];
        this.currentResults = [];
        this.defaultQuerySet = false;

        document.getElementById('jsonTree').innerHTML = '<div class="empty-state">Fetch a JSON file to see structure</div>';
        document.getElementById('selectedNodesDisplay').innerHTML = '<div class="empty-state">Select nodes from the left panel</div>';
        document.getElementById('selectedCount').textContent = '0 nodes';
        document.getElementById('whereContainer').innerHTML = '<div class="empty-state">No conditions defined</div>';
        document.getElementById('groupContainer').innerHTML = '<div class="empty-state">No group by defined</div>';
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