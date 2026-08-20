// ============================================================
// DELPHI-STYLE SQL QUERY BUILDER
// ============================================================

class QueryBuilder {
    constructor() {
        // State
        this.columns = [];
        this.tables = [];
        this.joins = [];
        this.whereConditions = [];
        this.groupBy = [];
        this.havingConditions = [];
        this.orderBy = [];
        this.unions = [];
        this.selectedField = null;
        this.currentAliasCounter = 1;
        this.tableAliasCounter = 1;

        // Sample data
        this.schema = {
            tables: [
                { name: 'Orders', columns: ['OrderID', 'CustomerID', 'EmployeeID', 'OrderDate', 'RequiredDate', 'ShippedDate', 'ShipVia', 'Freight', 'ShipName', 'ShipAddress', 'ShipCity', 'ShipRegion', 'ShipPostalCode'] },
                { name: 'Order Details', columns: ['OrderID', 'ProductID', 'UnitPrice', 'Quantity', 'Discount'] },
                { name: 'Products', columns: ['ProductID', 'ProductName', 'SupplierID', 'CategoryID', 'QuantityPerUnit', 'UnitPrice', 'UnitsInStock', 'UnitsOnOrder', 'ReorderLevel', 'Discontinued'] },
                { name: 'Customers', columns: ['CustomerID', 'CompanyName', 'ContactName', 'ContactTitle', 'Address', 'City', 'Region', 'PostalCode', 'Country', 'Phone', 'Fax'] },
                { name: 'Employees', columns: ['EmployeeID', 'LastName', 'FirstName', 'Title', 'TitleOfCourtesy', 'BirthDate', 'HireDate', 'Address', 'City', 'Region', 'PostalCode', 'Country', 'HomePhone', 'Extension'] },
                { name: 'Categories', columns: ['CategoryID', 'CategoryName', 'Description'] },
                { name: 'Suppliers', columns: ['SupplierID', 'CompanyName', 'ContactName', 'ContactTitle', 'Address', 'City', 'Region', 'PostalCode', 'Country', 'Phone', 'Fax'] },
                { name: 'Shippers', columns: ['ShipperID', 'CompanyName', 'Phone'] }
            ],
            views: [
                { name: 'Current Product List', columns: ['ProductID', 'ProductName'] },
                { name: 'Category Sales for 1997', columns: ['CategoryName', 'CategorySales'] },
                { name: 'Invoices', columns: ['CustomerID', 'OrderID', 'ProductName', 'Quantity', 'UnitPrice', 'ExtendedPrice'] },
                { name: 'Order Subtotal', columns: ['OrderID', 'Subtotal'] },
                { name: 'Product Sales for 1997', columns: ['CategoryName', 'ProductName', 'ProductSales'] }
            ],
            savedQueries: [
                { name: 'Northwind Orders', sql: 'SELECT * FROM Orders WHERE OrderDate > \'1997-01-01\'' },
                { name: 'Top Customers', sql: 'SELECT CustomerID, COUNT(*) as OrderCount FROM Orders GROUP BY CustomerID HAVING COUNT(*) > 5' }
            ]
        };

        this.init();
        this.populateSchema();
        this.addDefaultColumns();
        this.addDefaultTables();
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

        // Tree collapse/expand
        document.querySelectorAll('.tree-header').forEach(header => {
            header.addEventListener('click', () => {
                const arrow = header.querySelector('.arrow');
                const content = header.parentElement.querySelector('.tree-content');
                arrow.classList.toggle('collapsed');
                content.classList.toggle('collapsed');
            });
        });

        // Column actions
        document.getElementById('addColumnBtn').addEventListener('click', () => this.addColumn());
        document.getElementById('clearColumnsBtn').addEventListener('click', () => this.clearColumns());

        // Table actions
        document.getElementById('addTableBtn').addEventListener('click', () => this.addTable());
        document.getElementById('clearTablesBtn').addEventListener('click', () => this.clearTables());

        // Join actions
        document.getElementById('addJoinBtn').addEventListener('click', () => this.addJoin());

        // Where actions
        document.getElementById('addWhereBtn').addEventListener('click', () => this.addWhere());
        document.getElementById('clearWhereBtn').addEventListener('click', () => this.clearWhere());

        // Group By actions
        document.getElementById('addGroupBtn').addEventListener('click', () => this.addGroup());
        document.getElementById('clearGroupBtn').addEventListener('click', () => this.clearGroup());

        // Having actions
        document.getElementById('addHavingBtn').addEventListener('click', () => this.addHaving());
        document.getElementById('clearHavingBtn').addEventListener('click', () => this.clearHaving());

        // Order By actions
        document.getElementById('addOrderBtn').addEventListener('click', () => this.addOrder());
        document.getElementById('clearOrderBtn').addEventListener('click', () => this.clearOrder());

        // Union actions
        document.getElementById('addUnionBtn').addEventListener('click', () => this.addUnion());

        // Execute
        document.getElementById('executeBtn').addEventListener('click', () => this.executeQuery());
        document.getElementById('executeSqlBtn').addEventListener('click', () => this.executeSql());

        // Clear
        document.getElementById('clearBtn').addEventListener('click', () => this.clearAll());

        // SQL actions
        document.getElementById('copySqlBtn').addEventListener('click', () => this.copySql());
        document.getElementById('formatSqlBtn').addEventListener('click', () => this.formatSql());

        // Save Query
        document.getElementById('saveQueryBtn').addEventListener('click', () => this.saveQuery());

        // Results actions
        document.getElementById('exportCsvBtn').addEventListener('click', () => this.exportCsv());
        document.getElementById('clearResultsBtn').addEventListener('click', () => this.clearResults());

        // Properties
        document.getElementById('propAlias').addEventListener('change', (e) => this.updateFieldProperty('alias', e.target.value));
        document.getElementById('propAggregate').addEventListener('change', (e) => this.updateFieldProperty('aggregate', e.target.value));
        document.getElementById('propSortType').addEventListener('change', (e) => this.updateFieldProperty('sortType', e.target.value));
        document.getElementById('propSortOrder').addEventListener('change', (e) => this.updateFieldProperty('sortOrder', parseInt(e.target.value) || 0));
        document.getElementById('propGrouping').addEventListener('change', (e) => this.updateFieldProperty('grouping', e.target.value));
        document.getElementById('propCriteria').addEventListener('change', (e) => this.updateFieldProperty('criteria', e.target.value));
    }

    // ============================================================
    // SCHEMA POPULATION
    // ============================================================
    populateSchema() {
        const tablesTree = document.getElementById('tablesTree');
        const viewsTree = document.getElementById('viewsTree');
        const queriesTree = document.getElementById('queriesTree');

        // Tables
        tablesTree.innerHTML = '';
        this.schema.tables.forEach(table => {
            const div = document.createElement('div');
            div.className = 'tree-item';
            div.innerHTML = `
                <span class="item-icon">📋</span>
                <span class="item-name">${table.name}</span>
                <span class="item-type">${table.columns.length} cols</span>
            `;
            div.addEventListener('click', () => this.addTable(table.name));
            div.addEventListener('dblclick', () => this.addAllColumns(table.name));
            tablesTree.appendChild(div);
        });
        document.getElementById('tableCount').textContent = this.schema.tables.length;

        // Views
        viewsTree.innerHTML = '';
        this.schema.views.forEach(view => {
            const div = document.createElement('div');
            div.className = 'tree-item';
            div.innerHTML = `
                <span class="item-icon">👁️</span>
                <span class="item-name">${view.name}</span>
                <span class="item-type">${view.columns.length} cols</span>
            `;
            div.addEventListener('click', () => this.addView(view));
            viewsTree.appendChild(div);
        });
        document.getElementById('viewCount').textContent = this.schema.views.length;

        // Queries
        queriesTree.innerHTML = '';
        this.schema.savedQueries.forEach(query => {
            const div = document.createElement('div');
            div.className = 'tree-item';
            div.innerHTML = `
                <span class="item-icon">💾</span>
                <span class="item-name">${query.name}</span>
            `;
            div.addEventListener('click', () => this.loadQuery(query));
            queriesTree.appendChild(div);
        });
        document.getElementById('queryCount').textContent = this.schema.savedQueries.length;
    }

    // ============================================================
    // COLUMN MANAGEMENT
    // ============================================================
    addColumn(field = '', alias = '', aggregate = '', sortType = '', sortOrder = 0, grouping = '', criteria = '') {
        const container = document.getElementById('columnsContainer');
        const emptyState = container.querySelector('.empty-state');
        if (emptyState) emptyState.remove();

        const row = document.createElement('div');
        row.className = 'field-row';
        row.dataset.index = this.columns.length;

        const tableOptions = this.getTableOptions();

        row.innerHTML = `
            <select class="field-select">
                ${tableOptions}
            </select>
            <input type="text" class="field-alias" placeholder="Alias" value="${alias}" />
            <select class="field-aggregate">
                <option value="">None</option>
                <option value="COUNT" ${aggregate === 'COUNT' ? 'selected' : ''}>COUNT</option>
                <option value="SUM" ${aggregate === 'SUM' ? 'selected' : ''}>SUM</option>
                <option value="AVG" ${aggregate === 'AVG' ? 'selected' : ''}>AVG</option>
                <option value="MIN" ${aggregate === 'MIN' ? 'selected' : ''}>MIN</option>
                <option value="MAX" ${aggregate === 'MAX' ? 'selected' : ''}>MAX</option>
            </select>
            <select class="field-sort">
                <option value="">None</option>
                <option value="ASC" ${sortType === 'ASC' ? 'selected' : ''}>ASC</option>
                <option value="DESC" ${sortType === 'DESC' ? 'selected' : ''}>DESC</option>
            </select>
            <input type="number" class="field-sort-order" placeholder="Order" value="${sortOrder}" min="1" />
            <button class="field-remove" title="Remove">×</button>
        `;

        container.appendChild(row);

        // Set field value
        if (field) {
            const select = row.querySelector('.field-select');
            if (Array.from(select.options).some(o => o.value === field)) {
                select.value = field;
            }
        }

        // Auto-generate alias if not provided
        if (!alias && field) {
            const aliasInput = row.querySelector('.field-alias');
            const baseName = field.split('.').pop() || field;
            aliasInput.value = baseName + (this.currentAliasCounter++ > 1 ? this.currentAliasCounter : '');
        }

        // Store in state
        const fieldData = {
            field: field || row.querySelector('.field-select').value,
            alias: alias || row.querySelector('.field-alias').value,
            aggregate: aggregate,
            sortType: sortType,
            sortOrder: sortOrder,
            grouping: grouping,
            criteria: criteria
        };
        this.columns.push(fieldData);

        // Events
        const select = row.querySelector('.field-select');
        const aliasInput = row.querySelector('.field-alias');
        const aggregateSelect = row.querySelector('.field-aggregate');
        const sortSelect = row.querySelector('.field-sort');
        const sortOrderInput = row.querySelector('.field-sort-order');
        const removeBtn = row.querySelector('.field-remove');

        select.addEventListener('change', () => {
            const idx = parseInt(row.dataset.index);
            this.columns[idx].field = select.value;
            this.updateSql();
            this.updateProperties(idx);
        });

        aliasInput.addEventListener('change', () => {
            const idx = parseInt(row.dataset.index);
            this.columns[idx].alias = aliasInput.value;
            this.updateSql();
            this.updateProperties(idx);
        });

        aggregateSelect.addEventListener('change', () => {
            const idx = parseInt(row.dataset.index);
            this.columns[idx].aggregate = aggregateSelect.value;
            this.updateSql();
            this.updateProperties(idx);
        });

        sortSelect.addEventListener('change', () => {
            const idx = parseInt(row.dataset.index);
            this.columns[idx].sortType = sortSelect.value;
            this.updateSql();
            this.updateProperties(idx);
        });

        sortOrderInput.addEventListener('change', () => {
            const idx = parseInt(row.dataset.index);
            this.columns[idx].sortOrder = parseInt(sortOrderInput.value) || 0;
            this.updateSql();
            this.updateProperties(idx);
        });

        removeBtn.addEventListener('click', () => {
            const idx = parseInt(row.dataset.index);
            this.columns.splice(idx, 1);
            row.remove();
            this.reindexFields();
            this.updateSql();
            if (this.columns.length === 0) {
                container.innerHTML = '<div class="empty-state">Click "+ Column" to add fields</div>';
            }
        });

        row.addEventListener('click', (e) => {
            if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'SELECT' && e.target.tagName !== 'BUTTON') {
                const idx = parseInt(row.dataset.index);
                this.selectField(idx);
            }
        });

        this.updateSql();
        return row;
    }

    addAllColumns(tableName) {
        const table = this.schema.tables.find(t => t.name === tableName);
        if (table) {
            table.columns.forEach(col => {
                this.addColumn(`${tableName}.${col}`, col);
            });
        }
    }

    clearColumns() {
        this.columns = [];
        document.getElementById('columnsContainer').innerHTML = '<div class="empty-state">Click "+ Column" to add fields</div>';
        this.updateSql();
    }

    // ============================================================
    // TABLE MANAGEMENT
    // ============================================================
    addTable(name = '') {
        const container = document.getElementById('tablesContainer');
        const emptyState = container.querySelector('.empty-state');
        if (emptyState) emptyState.remove();

        const row = document.createElement('div');
        row.className = 'field-row';

        const tableOptions = this.schema.tables.map(t => 
            `<option value="${t.name}" ${t.name === name ? 'selected' : ''}>${t.name}</option>`
        ).join('');

        const alias = this.getTableAlias(name);

        row.innerHTML = `
            <select class="field-select table-select">
                <option value="">Select table...</option>
                ${tableOptions}
            </select>
            <input type="text" class="field-alias table-alias" placeholder="Alias" value="${alias}" />
            <button class="field-remove table-remove" title="Remove">×</button>
        `;

        container.appendChild(row);

        const select = row.querySelector('.table-select');
        const aliasInput = row.querySelector('.table-alias');
        const removeBtn = row.querySelector('.table-remove');

        if (name) select.value = name;

        const tableData = {
            table: select.value,
            alias: aliasInput.value
        };
        this.tables.push(tableData);

        select.addEventListener('change', () => {
            const idx = Array.from(container.children).indexOf(row);
            this.tables[idx].table = select.value;
            if (!aliasInput.value) {
                aliasInput.value = this.getTableAlias(select.value);
                this.tables[idx].alias = aliasInput.value;
            }
            this.updateSql();
            this.updateFieldOptions();
        });

        aliasInput.addEventListener('change', () => {
            const idx = Array.from(container.children).indexOf(row);
            this.tables[idx].alias = aliasInput.value;
            this.updateSql();
        });

        removeBtn.addEventListener('click', () => {
            const idx = Array.from(container.children).indexOf(row);
            this.tables.splice(idx, 1);
            row.remove();
            this.updateSql();
            this.updateFieldOptions();
            if (this.tables.length === 0) {
                container.innerHTML = '<div class="empty-state">Click "+ Table" to add tables</div>';
            }
        });

        this.updateSql();
        this.updateFieldOptions();
    }

    clearTables() {
        this.tables = [];
        document.getElementById('tablesContainer').innerHTML = '<div class="empty-state">Click "+ Table" to add tables</div>';
        this.updateSql();
        this.updateFieldOptions();
    }

    getTableAlias(name) {
        if (!name) return 't' + this.tableAliasCounter++;
        const parts = name.split(' ');
        let alias = parts[0].substring(0, 3).toLowerCase();
        // Check if alias already used
        if (this.tables.some(t => t.alias === alias)) {
            alias += this.tableAliasCounter++;
        }
        return alias;
    }

    // ============================================================
    // JOIN MANAGEMENT
    // ============================================================
    addJoin() {
        const container = document.getElementById('joinsContainer');
        const emptyState = container.querySelector('.empty-state');
        if (emptyState) emptyState.remove();

        const row = document.createElement('div');
        row.className = 'join-row';

        const tableOptions = this.schema.tables.map(t => 
            `<option value="${t.name}">${t.name}</option>`
        ).join('');

        row.innerHTML = `
            <select class="join-type">
                <option value="INNER">INNER</option>
                <option value="LEFT">LEFT</option>
                <option value="RIGHT">RIGHT</option>
                <option value="FULL">FULL</option>
            </select>
            <select class="join-table">
                <option value="">Select table...</option>
                ${tableOptions}
            </select>
            <input type="text" class="join-on" placeholder="ON condition (e.g., Orders.OrderID = Details.OrderID)" />
            <button class="join-remove" title="Remove">×</button>
        `;

        container.appendChild(row);

        const joinData = {
            type: 'INNER',
            table: '',
            on: ''
        };
        this.joins.push(joinData);

        const typeSelect = row.querySelector('.join-type');
        const tableSelect = row.querySelector('.join-table');
        const onInput = row.querySelector('.join-on');
        const removeBtn = row.querySelector('.join-remove');

        typeSelect.addEventListener('change', () => {
            const idx = Array.from(container.children).indexOf(row);
            this.joins[idx].type = typeSelect.value;
            this.updateSql();
        });

        tableSelect.addEventListener('change', () => {
            const idx = Array.from(container.children).indexOf(row);
            this.joins[idx].table = tableSelect.value;
            this.updateSql();
        });

        onInput.addEventListener('change', () => {
            const idx = Array.from(container.children).indexOf(row);
            this.joins[idx].on = onInput.value;
            this.updateSql();
        });

        removeBtn.addEventListener('click', () => {
            const idx = Array.from(container.children).indexOf(row);
            this.joins.splice(idx, 1);
            row.remove();
            this.updateSql();
            if (this.joins.length === 0) {
                container.innerHTML = '<div class="empty-state">No joins defined</div>';
            }
        });

        this.updateSql();
    }

    // ============================================================
    // WHERE MANAGEMENT
    // ============================================================
    addWhere() {
        const container = document.getElementById('whereContainer');
        const emptyState = container.querySelector('.empty-state');
        if (emptyState) emptyState.remove();

        const row = document.createElement('div');
        row.className = 'field-row';

        const fieldOptions = this.getFieldOptions();

        row.innerHTML = `
            <select class="where-field">
                ${fieldOptions}
            </select>
            <select class="where-operator">
                <option value="=">=</option>
                <option value="!=">!=</option>
                <option value=">">&gt;</option>
                <option value="<">&lt;</option>
                <option value=">=">&gt;=</option>
                <option value="<=">&lt;=</option>
                <option value="LIKE">LIKE</option>
                <option value="NOT LIKE">NOT LIKE</option>
                <option value="IN">IN</option>
                <option value="NOT IN">NOT IN</option>
                <option value="IS NULL">IS NULL</option>
                <option value="IS NOT NULL">IS NOT NULL</option>
            </select>
            <input type="text" class="where-value" placeholder="Value" />
            <button class="field-remove where-remove" title="Remove">×</button>
        `;

        container.appendChild(row);

        const whereData = {
            field: '',
            operator: '=',
            value: ''
        };
        this.whereConditions.push(whereData);

        const fieldSelect = row.querySelector('.where-field');
        const operatorSelect = row.querySelector('.where-operator');
        const valueInput = row.querySelector('.where-value');
        const removeBtn = row.querySelector('.where-remove');

        fieldSelect.addEventListener('change', () => {
            const idx = Array.from(container.children).indexOf(row);
            this.whereConditions[idx].field = fieldSelect.value;
            this.updateSql();
        });

        operatorSelect.addEventListener('change', () => {
            const idx = Array.from(container.children).indexOf(row);
            this.whereConditions[idx].operator = operatorSelect.value;
            // Show/hide value input based on operator
            if (['IS NULL', 'IS NOT NULL'].includes(operatorSelect.value)) {
                valueInput.style.display = 'none';
            } else {
                valueInput.style.display = '';
            }
            this.updateSql();
        });

        valueInput.addEventListener('change', () => {
            const idx = Array.from(container.children).indexOf(row);
            this.whereConditions[idx].value = valueInput.value;
            this.updateSql();
        });

        removeBtn.addEventListener('click', () => {
            const idx = Array.from(container.children).indexOf(row);
            this.whereConditions.splice(idx, 1);
            row.remove();
            this.updateSql();
            if (this.whereConditions.length === 0) {
                container.innerHTML = '<div class="empty-state">No conditions defined</div>';
            }
        });

        this.updateSql();
    }

    clearWhere() {
        this.whereConditions = [];
        document.getElementById('whereContainer').innerHTML = '<div class="empty-state">No conditions defined</div>';
        this.updateSql();
    }

    // ============================================================
    // GROUP BY MANAGEMENT
    // ============================================================
    addGroup() {
        const container = document.getElementById('groupContainer');
        const emptyState = container.querySelector('.empty-state');
        if (emptyState) emptyState.remove();

        const row = document.createElement('div');
        row.className = 'field-row';

        const fieldOptions = this.getFieldOptions();

        row.innerHTML = `
            <select class="group-field">
                ${fieldOptions}
            </select>
            <button class="field-remove group-remove" title="Remove">×</button>
        `;

        container.appendChild(row);

        const groupData = { field: '' };
        this.groupBy.push(groupData);

        const fieldSelect = row.querySelector('.group-field');
        const removeBtn = row.querySelector('.group-remove');

        fieldSelect.addEventListener('change', () => {
            const idx = Array.from(container.children).indexOf(row);
            this.groupBy[idx].field = fieldSelect.value;
            this.updateSql();
        });

        removeBtn.addEventListener('click', () => {
            const idx = Array.from(container.children).indexOf(row);
            this.groupBy.splice(idx, 1);
            row.remove();
            this.updateSql();
            if (this.groupBy.length === 0) {
                container.innerHTML = '<div class="empty-state">No group by defined</div>';
            }
        });

        this.updateSql();
    }

    clearGroup() {
        this.groupBy = [];
        document.getElementById('groupContainer').innerHTML = '<div class="empty-state">No group by defined</div>';
        this.updateSql();
    }

    // ============================================================
    // HAVING MANAGEMENT
    // ============================================================
    addHaving() {
        const container = document.getElementById('havingContainer');
        const emptyState = container.querySelector('.empty-state');
        if (emptyState) emptyState.remove();

        const row = document.createElement('div');
        row.className = 'field-row';

        const fieldOptions = this.getFieldOptions();

        row.innerHTML = `
            <select class="having-field">
                ${fieldOptions}
            </select>
            <select class="having-operator">
                <option value="=">=</option>
                <option value="!=">!=</option>
                <option value=">">&gt;</option>
                <option value="<">&lt;</option>
                <option value=">=">&gt;=</option>
                <option value="<=">&lt;=</option>
            </select>
            <input type="text" class="having-value" placeholder="Value" />
            <button class="field-remove having-remove" title="Remove">×</button>
        `;

        container.appendChild(row);

        const havingData = {
            field: '',
            operator: '=',
            value: ''
        };
        this.havingConditions.push(havingData);

        const fieldSelect = row.querySelector('.having-field');
        const operatorSelect = row.querySelector('.having-operator');
        const valueInput = row.querySelector('.having-value');
        const removeBtn = row.querySelector('.having-remove');

        fieldSelect.addEventListener('change', () => {
            const idx = Array.from(container.children).indexOf(row);
            this.havingConditions[idx].field = fieldSelect.value;
            this.updateSql();
        });

        operatorSelect.addEventListener('change', () => {
            const idx = Array.from(container.children).indexOf(row);
            this.havingConditions[idx].operator = operatorSelect.value;
            this.updateSql();
        });

        valueInput.addEventListener('change', () => {
            const idx = Array.from(container.children).indexOf(row);
            this.havingConditions[idx].value = valueInput.value;
            this.updateSql();
        });

        removeBtn.addEventListener('click', () => {
            const idx = Array.from(container.children).indexOf(row);
            this.havingConditions.splice(idx, 1);
            row.remove();
            this.updateSql();
            if (this.havingConditions.length === 0) {
                container.innerHTML = '<div class="empty-state">No having conditions</div>';
            }
        });

        this.updateSql();
    }

    clearHaving() {
        this.havingConditions = [];
        document.getElementById('havingContainer').innerHTML = '<div class="empty-state">No having conditions</div>';
        this.updateSql();
    }

    // ============================================================
    // ORDER BY MANAGEMENT
    // ============================================================
    addOrder() {
        const container = document.getElementById('orderContainer');
        const emptyState = container.querySelector('.empty-state');
        if (emptyState) emptyState.remove();

        const row = document.createElement('div');
        row.className = 'field-row';

        const fieldOptions = this.getFieldOptions();

        row.innerHTML = `
            <select class="order-field">
                ${fieldOptions}
            </select>
            <select class="order-direction">
                <option value="ASC">ASC</option>
                <option value="DESC">DESC</option>
            </select>
            <button class="field-remove order-remove" title="Remove">×</button>
        `;

        container.appendChild(row);

        const orderData = {
            field: '',
            direction: 'ASC'
        };
        this.orderBy.push(orderData);

        const fieldSelect = row.querySelector('.order-field');
        const directionSelect = row.querySelector('.order-direction');
        const removeBtn = row.querySelector('.order-remove');

        fieldSelect.addEventListener('change', () => {
            const idx = Array.from(container.children).indexOf(row);
            this.orderBy[idx].field = fieldSelect.value;
            this.updateSql();
        });

        directionSelect.addEventListener('change', () => {
            const idx = Array.from(container.children).indexOf(row);
            this.orderBy[idx].direction = directionSelect.value;
            this.updateSql();
        });

        removeBtn.addEventListener('click', () => {
            const idx = Array.from(container.children).indexOf(row);
            this.orderBy.splice(idx, 1);
            row.remove();
            this.updateSql();
            if (this.orderBy.length === 0) {
                container.innerHTML = '<div class="empty-state">No order by defined</div>';
            }
        });

        this.updateSql();
    }

    clearOrder() {
        this.orderBy = [];
        document.getElementById('orderContainer').innerHTML = '<div class="empty-state">No order by defined</div>';
        this.updateSql();
    }

    // ============================================================
    // UNION MANAGEMENT
    // ============================================================
    addUnion() {
        const container = document.getElementById('unionsContainer');
        const emptyState = container.querySelector('.empty-state');
        if (emptyState) emptyState.remove();

        const row = document.createElement('div');
        row.className = 'union-item';

        row.innerHTML = `
            <span style="font-weight:600;color:#89b4fa;">UNION</span>
            <textarea class="union-sql" placeholder="Enter SQL query for UNION..." rows="2"></textarea>
            <button class="union-remove" title="Remove">×</button>
        `;

        container.appendChild(row);

        const unionData = { sql: '' };
        this.unions.push(unionData);

        const sqlTextarea = row.querySelector('.union-sql');
        const removeBtn = row.querySelector('.union-remove');

        sqlTextarea.addEventListener('input', () => {
            const idx = Array.from(container.children).indexOf(row);
            this.unions[idx].sql = sqlTextarea.value;
            this.updateSql();
        });

        removeBtn.addEventListener('click', () => {
            const idx = Array.from(container.children).indexOf(row);
            this.unions.splice(idx, 1);
            row.remove();
            if (this.unions.length === 0) {
                container.innerHTML = '<div class="empty-state">No UNION queries defined</div>';
            }
            this.updateSql();
        });

        this.updateSql();
    }

    // ============================================================
    // SQL GENERATION
    // ============================================================
    generateSql() {
        let sql = '';

        // SELECT
        if (this.columns.length === 0) {
            sql += 'SELECT *';
        } else {
            const selectParts = this.columns.map(col => {
                let part = col.field || '*';
                if (col.aggregate) {
                    part = `${col.aggregate}(${part})`;
                }
                if (col.alias) {
                    part += ` AS ${col.alias}`;
                }
                return part;
            });
            sql += 'SELECT ' + selectParts.join(', ');
        }

        // FROM
        if (this.tables.length === 0) {
            sql += ' FROM ';
        } else {
            const fromParts = this.tables.map(t => {
                let part = t.table;
                if (t.alias) part += ` ${t.alias}`;
                return part;
            });
            sql += ' FROM ' + fromParts.join(', ');
        }

        // JOIN
        if (this.joins.length > 0) {
            this.joins.forEach(join => {
                if (join.table && join.on) {
                    sql += ` ${join.type} JOIN ${join.table} ON ${join.on}`;
                }
            });
        }

        // WHERE
        if (this.whereConditions.length > 0) {
            const whereParts = this.whereConditions.map(w => {
                if (['IS NULL', 'IS NOT NULL'].includes(w.operator)) {
                    return `${w.field} ${w.operator}`;
                }
                return `${w.field} ${w.operator} ${this.quoteValue(w.value)}`;
            });
            sql += ' WHERE ' + whereParts.join(' AND ');
        }

        // GROUP BY
        if (this.groupBy.length > 0) {
            const groupParts = this.groupBy.map(g => g.field);
            sql += ' GROUP BY ' + groupParts.join(', ');
        }

        // HAVING
        if (this.havingConditions.length > 0) {
            const havingParts = this.havingConditions.map(h => {
                return `${h.field} ${h.operator} ${this.quoteValue(h.value)}`;
            });
            sql += ' HAVING ' + havingParts.join(' AND ');
        }

        // ORDER BY
        if (this.orderBy.length > 0) {
            const orderParts = this.orderBy.map(o => `${o.field} ${o.direction}`);
            sql += ' ORDER BY ' + orderParts.join(', ');
        }

        // UNION
        if (this.unions.length > 0) {
            const unionParts = this.unions.map(u => u.sql);
            if (unionParts.some(u => u.trim())) {
                sql = '(' + sql + ')\n' + unionParts.filter(u => u.trim()).map(u => 'UNION\n(' + u + ')').join('\n');
            }
        }

        return sql;
    }

    quoteValue(value) {
        if (!value) return 'NULL';
        if (/^-?\d+(\.\d+)?$/.test(value)) return value;
        if (value.toUpperCase() === 'NULL') return 'NULL';
        return `'${value.replace(/'/g, "''")}'`;
    }

    updateSql() {
        const sql = this.generateSql();
        const editor = document.getElementById('sqlEditor');
        if (editor) editor.value = sql;
        this.updateQueryPreview();
    }

    updateQueryPreview() {
        // Update preview in the UI if needed
    }

    // ============================================================
    // FIELD OPTIONS
    // ============================================================
    getFieldOptions() {
        let options = '<option value="">Select field...</option>';
        this.tables.forEach(table => {
            const schema = this.schema.tables.find(t => t.name === table.table);
            if (schema) {
                schema.columns.forEach(col => {
                    const value = table.alias ? `${table.alias}.${col}` : col;
                    options += `<option value="${value}">${value}</option>`;
                });
            }
        });
        return options;
    }

    getTableOptions() {
        let options = '<option value="">Select field...</option>';
        this.tables.forEach(table => {
            const schema = this.schema.tables.find(t => t.name === table.table);
            if (schema) {
                schema.columns.forEach(col => {
                    const value = table.alias ? `${table.alias}.${col}` : col;
                    options += `<option value="${value}">${value}</option>`;
                });
            }
        });
        // If no tables, add all fields from all tables
        if (this.tables.length === 0) {
            this.schema.tables.forEach(table => {
                table.columns.forEach(col => {
                    options += `<option value="${table.name}.${col}">${table.name}.${col}</option>`;
                });
            });
        }
        return options;
    }

    updateFieldOptions() {
        // Update all select dropdowns with new field options
        document.querySelectorAll('.field-select, .where-field, .group-field, .having-field, .order-field')
            .forEach(select => {
                const currentVal = select.value;
                const newOptions = this.getFieldOptions();
                // Only update if it's a field select (not table select)
                if (!select.classList.contains('table-select')) {
                    select.innerHTML = newOptions;
                    if (Array.from(select.options).some(o => o.value === currentVal)) {
                        select.value = currentVal;
                    }
                }
            });
    }

    // ============================================================
    // PROPERTIES
    // ============================================================
    selectField(index) {
        this.selectedField = index;
        const field = this.columns[index];
        if (!field) return;

        document.getElementById('fieldProperties').style.display = 'block';
        document.getElementById('propField').value = field.field || '';
        document.getElementById('propAlias').value = field.alias || '';
        document.getElementById('propAggregate').value = field.aggregate || '';
        document.getElementById('propSortType').value = field.sortType || '';
        document.getElementById('propSortOrder').value = field.sortOrder || '';
        document.getElementById('propGrouping').value = field.grouping || '';
        document.getElementById('propCriteria').value = field.criteria || '';

        // Highlight selected row
        document.querySelectorAll('.field-row').forEach((row, i) => {
            row.style.background = i === index ? '#313244' : '';
        });
    }

    updateFieldProperty(property, value) {
        if (this.selectedField === null) return;
        const field = this.columns[this.selectedField];
        if (!field) return;

        field[property] = value;

        // Update the corresponding input in the row
        const rows = document.querySelectorAll('.field-row');
        const row = rows[this.selectedField];
        if (row) {
            const inputs = row.querySelectorAll('input, select');
            // Find the correct input based on property
            switch(property) {
                case 'alias':
                    const aliasInput = row.querySelector('.field-alias');
                    if (aliasInput) aliasInput.value = value;
                    break;
                case 'aggregate':
                    const aggSelect = row.querySelector('.field-aggregate');
                    if (aggSelect) aggSelect.value = value;
                    break;
                case 'sortType':
                    const sortSelect = row.querySelector('.field-sort');
                    if (sortSelect) sortSelect.value = value;
                    break;
                case 'sortOrder':
                    const orderInput = row.querySelector('.field-sort-order');
                    if (orderInput) orderInput.value = value;
                    break;
            }
        }

        this.updateSql();
    }

    reindexFields() {
        document.querySelectorAll('.field-row').forEach((row, i) => {
            row.dataset.index = i;
        });
    }

    // ============================================================
    // DEFAULT VALUES
    // ============================================================
    addDefaultColumns() {
        this.addColumn('Orders.OrderID', 'OrderID');
        this.addColumn('Orders.CustomerID', 'CustomerID');
        this.addColumn('Orders.OrderDate', 'OrderDate');
    }

    addDefaultTables() {
        this.addTable('Orders');
        this.addTable('Order Details');
        this.addTable('Products');
    }

    // ============================================================
    // VIEW / QUERY LOADING
    // ============================================================
    addView(view) {
        this.clearAll();
        view.columns.forEach(col => {
            this.addColumn(col, col);
        });
        this.addTable(view.name);
        this.updateSql();
    }

    loadQuery(query) {
        // Parse the SQL and populate the builder
        // This is a simplified version
        const editor = document.getElementById('sqlEditor');
        if (editor) editor.value = query.sql;
        this.showNotification('Query loaded: ' + query.name);
    }

    // ============================================================
    // EXECUTION
    // ============================================================
    executeQuery() {
        const sql = this.generateSql();
        this.executeSqlQuery(sql);
    }

    executeSql() {
        const editor = document.getElementById('sqlEditor');
        const sql = editor ? editor.value : '';
        this.executeSqlQuery(sql);
    }

    executeSqlQuery(sql) {
        if (!sql.trim()) {
            this.showNotification('Please build a query first', 'error');
            return;
        }

        // Simulate query execution with sample data
        const startTime = performance.now();

        // Generate sample results based on the query
        const results = this.generateSampleResults(sql);

        const endTime = performance.now();
        const timeMs = (endTime - startTime).toFixed(0);

        this.displayResults(results, timeMs);
        this.showNotification(`Query executed successfully. ${results.length} rows returned.`, 'success');
    }

    generateSampleResults(sql) {
        // Generate sample data based on the query
        const sampleData = [];
        const rowCount = Math.floor(Math.random() * 20) + 5;

        // Get selected columns for display
        const columns = this.columns.length > 0 ? this.columns : [{ field: 'OrderID', alias: 'OrderID' }];

        for (let i = 0; i < rowCount; i++) {
            const row = {};
            columns.forEach(col => {
                const fieldName = col.alias || col.field || 'field';
                // Generate random data based on field name
                const lowerField = fieldName.toLowerCase();
                if (lowerField.includes('id')) {
                    row[fieldName] = Math.floor(Math.random() * 1000) + 1;
                } else if (lowerField.includes('date')) {
                    const date = new Date(2024, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1);
                    row[fieldName] = date.toISOString().split('T')[0];
                } else if (lowerField.includes('name')) {
                    const names = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry'];
                    row[fieldName] = names[Math.floor(Math.random() * names.length)];
                } else if (lowerField.includes('price') || lowerField.includes('amount')) {
                    row[fieldName] = (Math.random() * 100 + 10).toFixed(2);
                } else if (lowerField.includes('quantity')) {
                    row[fieldName] = Math.floor(Math.random() * 50) + 1;
                } else {
                    row[fieldName] = Math.floor(Math.random() * 100) + 1;
                }
            });
            sampleData.push(row);
        }

        return sampleData;
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

        const columns = Object.keys(data[0]);

        let html = '<table class="results-grid"><thead><tr>';
        columns.forEach(col => {
            html += `<th>${col}</th>`;
        });
        html += '</tr></thead><tbody>';

        data.forEach(row => {
            html += '<tr>';
            columns.forEach(col => {
                let value = row[col] !== undefined ? row[col] : '';
                if (typeof value === 'object') value = JSON.stringify(value);
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
        const container = document.getElementById('resultsContainer');
        const table = container.querySelector('table');
        if (!table) {
            this.showNotification('No results to export', 'error');
            return;
        }

        let csv = '';
        // Headers
        const headers = table.querySelectorAll('thead th');
        headers.forEach((th, i) => {
            csv += (i > 0 ? ',' : '') + `"${th.textContent}"`;
        });
        csv += '\n';

        // Data
        const rows = table.querySelectorAll('tbody tr');
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            cells.forEach((td, i) => {
                csv += (i > 0 ? ',' : '') + `"${td.textContent}"`;
            });
            csv += '\n';
        });

        // Download
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `query_results_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);

        this.showNotification('CSV exported successfully', 'success');
    }

    clearResults() {
        const container = document.getElementById('resultsContainer');
        container.innerHTML = '<div class="empty-state"><span style="font-size:2rem;display:block;">📋</span><p>Execute a query to see results here</p></div>';
        document.getElementById('resultsCount').textContent = '0 rows';
        document.getElementById('resultsTime').textContent = '';
    }

    // ============================================================
    // SQL UTILITIES
    // ============================================================
    copySql() {
        const editor = document.getElementById('sqlEditor');
        if (!editor || !editor.value) {
            this.showNotification('No SQL to copy', 'error');
            return;
        }
        navigator.clipboard.writeText(editor.value).then(() => {
            this.showNotification('SQL copied to clipboard', 'success');
        }).catch(() => {
            // Fallback
            editor.select();
            document.execCommand('copy');
            this.showNotification('SQL copied to clipboard', 'success');
        });
    }

    formatSql() {
        const editor = document.getElementById('sqlEditor');
        if (!editor) return;
        // Simple formatting - just add newlines after SELECT, FROM, WHERE, etc.
        let sql = editor.value;
        sql = sql.replace(/\s+/g, ' ');
        sql = sql.replace(/SELECT /gi, 'SELECT\n  ');
        sql = sql.replace(/ FROM /gi, '\nFROM ');
        sql = sql.replace(/ WHERE /gi, '\nWHERE ');
        sql = sql.replace(/ GROUP BY /gi, '\nGROUP BY ');
        sql = sql.replace(/ HAVING /gi, '\nHAVING ');
        sql = sql.replace(/ ORDER BY /gi, '\nORDER BY ');
        sql = sql.replace(/ JOIN /gi, '\n  JOIN ');
        sql = sql.replace(/ INNER JOIN /gi, '\n  INNER JOIN ');
        sql = sql.replace(/ LEFT JOIN /gi, '\n  LEFT JOIN ');
        sql = sql.replace(/ RIGHT JOIN /gi, '\n  RIGHT JOIN ');
        sql = sql.replace(/ UNION /gi, '\nUNION\n');
        editor.value = sql;
        this.showNotification('SQL formatted', 'success');
    }

    // ============================================================
    // CLEAR ALL
    // ============================================================
    clearAll() {
        this.clearColumns();
        this.clearTables();
        this.clearWhere();
        this.clearGroup();
        this.clearHaving();
        this.clearOrder();
        this.clearResults();
        this.joins = [];
        document.getElementById('joinsContainer').innerHTML = '<div class="empty-state">No joins defined</div>';
        document.getElementById('unionsContainer').innerHTML = '<div class="empty-state">No UNION queries defined</div>';
        this.unions = [];
        this.selectedField = null;
        document.getElementById('fieldProperties').style.display = 'none';
        const editor = document.getElementById('sqlEditor');
        if (editor) editor.value = '';
        this.showNotification('All cleared', 'info');
    }

    // ============================================================
    // SAVE QUERY
    // ============================================================
    saveQuery() {
        const sql = this.generateSql();
        if (!sql.trim()) {
            this.showNotification('No query to save', 'error');
            return;
        }

        const name = prompt('Enter a name for this query:');
        if (!name) return;

        this.schema.savedQueries.push({ name, sql });
        this.populateSchema();
        this.showNotification(`Query "${name}" saved`, 'success');
    }

    // ============================================================
    // NOTIFICATIONS
    // ============================================================
    showNotification(message, type = 'info') {
        const statusDiv = document.getElementById('statusMessage');
        if (statusDiv) {
            statusDiv.textContent = message;
            statusDiv.className = 'status';
            if (type === 'error') statusDiv.classList.add('error');
            else if (type === 'success') statusDiv.classList.add('success');
        } else {
            // Create temporary notification
            const div = document.createElement('div');
            div.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: ${type === 'error' ? '#f38ba8' : type === 'success' ? '#a6e3a1' : '#89b4fa'};
                color: #1e1e2e;
                padding: 12px 20px;
                border-radius: 8px;
                z-index: 9999;
                font-weight: 500;
                max-width: 400px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                animation: slideIn 0.3s ease;
            `;
            div.textContent = message;
            document.body.appendChild(div);
            setTimeout(() => {
                div.style.opacity = '0';
                div.style.transition = 'opacity 0.3s';
                setTimeout(() => div.remove(), 300);
            }, 3000);
        }
    }
}

// Add animation styles
const styleSheet = document.createElement("style");
styleSheet.textContent = `
    @keyframes slideIn {
        from { transform: translateY(20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
    }
    .status {
        padding: 8px 12px;
        border-radius: 6px;
        margin-bottom: 8px;
        font-size: 0.85rem;
    }
    .status.success {
        background: #1e3a2f;
        color: #a6e3a1;
        border-left: 3px solid #a6e3a1;
    }
    .status.error {
        background: #3a1e2a;
        color: #f38ba8;
        border-left: 3px solid #f38ba8;
    }
    .status.info {
        background: #1e2a3a;
        color: #89b4fa;
        border-left: 3px solid #89b4fa;
    }
`;
document.head.appendChild(styleSheet);

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    const builder = new QueryBuilder();
    window.queryBuilder = builder;
});