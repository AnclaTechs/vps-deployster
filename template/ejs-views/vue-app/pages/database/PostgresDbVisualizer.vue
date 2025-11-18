<style scoped>
.c-grid {
  display: grid;
  gap: 5px;
  grid-template-columns: repeat(auto-fit, minmax(min(100px, 100%), 1fr));
}

.c-grid label {
  font-weight: 500;
}

.dbname {
  letter-spacing: 2px;
  font-variant: all-small-caps;
}
.visualiser-tab--container {
  display: flex;
  flex-direction: row;
  gap: 10px;
}

.visualiser-tab--item {
  cursor: pointer;
  padding: 8px 20px;
  background: darkgray;
  border-radius: 20px;
  font-weight: bold;
  font-size: 14px;
  color: #292929;
}

.active-item {
  background: #677189 !important;
  color: #fffafa !important;
}

.pg-query-tab-container {
  color: #ccc;
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.pg-tab-bar {
  display: flex;
  align-items: center;
  background: #282a36;
  padding: 4px 6px;
  gap: 4px;
}

.pg-tab-item {
  display: flex;
  align-items: center;
  background: #3a3a3a;
  border-radius: 8px 8px 0 0;
  padding: 4px 12px;
  cursor: pointer;
  position: relative;
  transition: background 0.2s ease;
}

.pg-tab-item.active {
  background: #90a8cd;
  color: #fff;
  font-weight: 550;
}

.pg-tab-name {
  font-size: 13px;
  white-space: nowrap;
}

.pg-tab-close-btn {
  border: none;
  background: transparent;
  color: #ccc;
  margin-left: 8px;
  font-size: 13px;
  cursor: pointer;
  border-radius: 50%;
  transition: color 0.2s ease;
}

.pg-tab-close-btn:hover {
  color: #fff;
  background: red;
  font-weight: 600;
}

.pg-tab-add-btn {
  background: #3a3a3a;
  color: #ffffff;
  border: none;
  border-radius: 50%;
  font-size: 16px;
  width: 24px;
  height: 24px;
  margin-left: 6px;
  cursor: pointer;
  line-height: 24px;
  transition: all 0.2s ease;
}

.pg-tab-add-btn:hover {
  background: #f2f2f2;
  color: #3a3a3a;
}

.pg-tab-content {
  flex: 1;
  padding: 8px;
  border-top: 1px solid #333;
}

nav > ul {
  cursor: pointer;
}

.table-name {
  color: #f2f2f2;
  background-color: #494642 !important;
  cursor: pointer;
}

.table-name:hover {
  background-color: #387ce1 !important;
}

.table-name--active {
  color: #f2f2f2;
  background-color: #387ce1 !important;
  cursor: pointer;
  font-size: 16px;
}

.table-name--active-container {
  display: flex;
  align-items: center;
  border: 1px solid #387ce1;
  padding: 10px;
  width: max-content;
  border-radius: 5px;
}

.table-data-loader {
  width: 48px;
  height: 48px;
  border: 3px solid #387ce1;
  border-bottom-color: transparent;
  border-radius: 50%;
  display: inline-block;
  position: relative;
  box-sizing: border-box;
  animation: rotation 1s linear infinite;
}

.table-data-loader::after {
  content: "";
  position: absolute;
  box-sizing: border-box;
  left: 20px;
  top: 31px;
  border: 10px solid transparent;
  border-right-color: #387ce1;
  transform: rotate(-40deg);
}

@keyframes rotation {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.bg-gray-100 th {
  background-color: #f8f9fa;
}

.table-view--tbody td + td {
  font-weight: 500;
  color: #505353;
}

.hover-expand {
  transition: background-color 0.2s ease;
}

.hover-expand:hover {
  background-color: #f8f9fa !important;
}

.hover-expand .fade-height-enter-active,
.hover-expand .fade-height-leave-active {
  transition: all 0.25s ease;
  overflow: hidden;
}

.hover-expand .fade-height-enter-from,
.hover-expand .fade-height-leave-to {
  opacity: 0;
  max-height: 0;
  margin-top: 0 !important;
  padding-top: 0 !important;
}

.hover-expand .fade-height-enter-to,
.hover-expand .fade-height-leave-from {
  opacity: 1;
  max-height: 100px; /* enough for 2 rows */
}

/* Smooth chevron rotation */
.transition-transform {
  transition: transform 0.25s ease;
}
.rotate-180 {
  transform: rotate(180deg);
}
</style>

<template>
  <main class="flex-grow-1 overflow-auto mt-4 container">
    <section>
      <hr />
      <h4 class="mb-3">
        <i class="bi bi-database-fill"></i>
        <span class="dbname">{{ databaseInView }}</span> Database Visualizer
      </h4>

      <div class="visualiser-tab--container">
        <div
          v-for="tab in tabs"
          :key="tab.slug"
          :class="['visualiser-tab--item', tab.active && 'active-item']"
          @click="switchToTab(tab.slug)"
        >
          {{ tab.title }}
        </div>
      </div>

      <!--Tabs Content-->
      <div v-if="tabIsActive === 'table'" class="mt-4">
        <div v-if="!tableInView">
          <div class="mb-4 c-grid gap-2">
            <div>
              <label for="schemaFilter" class="me-2 font-medium">Schema:</label>
              <select
                id="schemaFilter"
                v-model="selectedSchema"
                class="border rounded px-2 py-1"
              >
                <option value="">All schemas</option>
                <option v-for="s in uniqueSchemas" :key="s" :value="s">
                  {{ s }}
                </option>
              </select>
            </div>

            <div>
              <label for="itemsPerPage" class="me-2 font-medium"
                >Items per page:</label
              >
              <select
                id="itemsPerPage"
                v-model="itemsPerPage"
                class="border rounded px-2 py-1"
                style="width: auto"
              >
                <option :value="10">10</option>
                <option :value="25">25</option>
                <option :value="50">50</option>
                <option :value="100">100</option>
              </select>
            </div>

            <span class="text-muted"
              >Total items: {{ filteredTables.length }}</span
            >
          </div>
          <table class="table table-sm">
            <thead class="bg-gray-100">
              <tr>
                <th class="px-4 py-2 text-left">Schema</th>
                <th class="px-4 py-2 text-left">Table</th>
                <th class="px-4 py-2 text-right">Rows</th>
                <th class="px-4 py-2 text-right">Size</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="t in paginatedTables" :key="t.table_name">
                <td class="border px-4 py-2">{{ t.schema }}</td>
                <td class="border px-4 py-2">
                  <span
                    @click="viewTable(t.table_name, t.schema)"
                    class="badge rounded-pill table-name"
                    >{{ t.table_name }}</span
                  >
                </td>
                <td class="border px-4 py-2 text-right">{{ t.row_count }}</td>
                <td class="border px-4 py-2 text-right">{{ t.total_size }}</td>
              </tr>
            </tbody>
          </table>

          <nav aria-label="Indexes pagination" v-if="numPagesTables > 1">
            <ul class="pagination justify-content-center">
              <li
                class="page-item"
                :class="{ disabled: currentPageTables === 1 }"
              >
                <a class="page-link" @click.prevent="currentPageTables = 1"
                  >First</a
                >
              </li>
              <li
                class="page-item"
                :class="{ disabled: currentPageTables === 1 }"
              >
                <a
                  class="page-link"
                  @click.prevent="currentPageTables--"
                  aria-label="Previous"
                >
                  <span aria-hidden="true">&laquo;</span>
                </a>
              </li>
              <li
                class="page-item"
                v-for="page in numPagesTables"
                :key="page"
                :class="{ active: currentPageTables === page }"
              >
                <a
                  class="page-link"
                  @click.prevent="currentPageTables = page"
                  >{{ page }}</a
                >
              </li>
              <li
                class="page-item"
                :class="{ disabled: currentPageTables === numPagesTables }"
              >
                <a
                  class="page-link"
                  @click.prevent="currentPageTables++"
                  aria-label="Next"
                >
                  <span aria-hidden="true">&raquo;</span>
                </a>
              </li>
              <li
                class="page-item"
                :class="{ disabled: currentPageTables === numPagesTables }"
              >
                <a
                  class="page-link"
                  @click.prevent="currentPageTables = numPagesTables"
                  >Last</a
                >
              </li>
            </ul>
          </nav>
        </div>
        <div v-else>
          <div class="d-flex gap-3 mb-3">
            <!--Active Table In View-->
            <div class="table-name--active-container">
              <span class="badge rounded-pill table-name--active">{{
                tableInView
              }}</span>
              &nbsp; &nbsp;
              <span
                style="cursor: pointer"
                class="text-danger"
                @click="hideTable()"
                ><i class="fas fa-times-circle"></i
              ></span>
            </div>

            <!--Actions-->
            <button @click="openAddModal" class="btn btn-success">
              <i class="bi bi-plus-circle"></i> Add Record
            </button>
            <button @click="openFilterModal" class="btn btn-primary">
              <i class="bi bi-funnel"></i> Filter / Select Data
            </button>
          </div>

          <div
            v-if="tableDataIsLoading"
            class="mt-5 d-flex align-items-center justify-content-center"
            style="height: 200px"
          >
            <div class="d-flex justify-content-center">
              <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
              </div>
            </div>
          </div>

          <div v-else class="mt-3">
            <div class="fw-bold">
              <span
                ><span class="text-muted"></span>
                {{ tableInViewData.table.row_count }} Row{{
                  tableInViewData.table.row_count > 1 ? "s" : ""
                }}</span
              >
              &nbsp; | &nbsp;
              <span
                ><span class="text-muted">Table Size:</span>
                {{ tableInViewData.table.size }}</span
              >
            </div>

            <table class="mt-3 table table-sm">
              <thead class="bg-gray-100">
                <tr>
                  <th class="px-4 py-2 text-left">Name</th>
                  <th class="px-4 py-2 text-left">Data Type</th>
                  <th class="px-4 py-2 text-left">Nullable</th>
                  <th class="px-4 py-2 text-left">Default</th>
                  <th class="px-4 py-2 text-left">Description</th>
                </tr>
              </thead>
              <tbody class="table-view--tbody">
                <tr
                  v-for="(col, index) in tableInViewData?.metaData || []"
                  :key="index"
                >
                  <td class="border px-4 py-2" style="font-weight: 600">
                    <span v-if="col.is_primary_key === 't'"
                      ><i
                        class="bi bi-key-fill fa-lg"
                        style="color: darkgoldenrod"
                      ></i
                    ></span>
                    {{ col.column_name }}
                  </td>
                  <td
                    class="border px-4 py-2 text-uppercase position-relative align-top hover-expand"
                    :class="{ expanded: hoveredCol === col.column_name }"
                    @mouseenter="hoveredCol = col.column_name"
                    @mouseleave="hoveredCol = null"
                  >
                    <div
                      class="d-flex align-items-center justify-content-between"
                    >
                      <span class="type-main">
                        {{ col.udt_name
                        }}{{ col.max_length ? `(${col.max_length})` : "" }}
                      </span>
                      <i
                        v-if="col.precision || col.scale"
                        class="fas fa-chevron-down text-primary ms-2 transition-transform"
                        :class="{
                          'rotate-180': hoveredCol === col.column_name,
                        }"
                        style="font-size: 0.85em"
                      ></i>
                    </div>

                    <!-- Mini details that expand inside the same cell -->
                    <transition name="fade-height">
                      <div
                        v-if="
                          hoveredCol === col.column_name &&
                          (col.precision || col.scale)
                        "
                        class="mt-2 pt-2 border-top border-light"
                      >
                        <table class="table table-sm table-borderless mb-0">
                          <tbody class="small">
                            <tr>
                              <td class="text-muted fw-bold text-nowrap">
                                Precision
                              </td>
                              <td class="text-dark">
                                {{ col.precision || "–" }}
                              </td>
                            </tr>
                            <tr>
                              <td class="text-muted fw-bold text-nowrap">
                                Scale
                              </td>
                              <td class="text-dark">{{ col.scale || "–" }}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </transition>
                  </td>
                  <td class="border px-4 py-2">
                    <span
                      class="badge"
                      :class="{
                        'bg-success': col.is_nullable === 'NO',
                        'bg-danger': col.is_nullable === 'YES',
                      }"
                      >{{ col.is_nullable }}</span
                    >
                  </td>
                  <td class="border px-4 py-2">
                    {{ col.column_default || "N/A" }}
                  </td>
                  <td class="border px-4 py-2">
                    {{ col.description || "N/A" }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <!---->
        </div>
      </div>

      <div v-else-if="tabIsActive === 'indexes'" class="mt-4">
        <div class="mb-4 c-grid gap-2">
          <div>
            <label for="schemaFilter" class="me-2 font-medium">Schema:</label>
            <select
              id="schemaFilter"
              v-model="selectedSchema"
              class="border rounded px-2 py-1"
            >
              <option value="">All schemas</option>
              <option v-for="s in uniqueSchemas" :key="s" :value="s">
                {{ s }}
              </option>
            </select>
          </div>

          <div>
            <label for="itemsPerPage" class="me-2 font-medium"
              >Items per page:</label
            >
            <select
              id="itemsPerPage"
              v-model="itemsPerPage"
              class="border rounded px-2 py-1"
              style="width: auto"
            >
              <option :value="10">10</option>
              <option :value="25">25</option>
              <option :value="50">50</option>
              <option :value="100">100</option>
            </select>
          </div>

          <span class="text-muted"
            >Total items: {{ filteredIndexes.length }}</span
          >
        </div>
        <table class="table table-sm">
          <thead class="bg-gray-100">
            <tr>
              <th class="px-4 py-2 text-left">Index</th>
              <th class="px-4 py-2 text-left">Type</th>
              <th class="px-4 py-2 text-left">Primary Key</th>
              <th class="px-4 py-2 text-left">Unique</th>
              <th class="px-4 py-2 text-left">Table</th>
              <th class="px-4 py-2 text-left">Schema</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="i in paginatedIndexes" :key="i.index_name">
              <td class="border px-4 py-2">{{ i.index_name }}</td>
              <td class="border px-4 py-2">{{ i.index_type }}</td>
              <td class="border px-4 py-2">
                <span
                  class="badge"
                  :class="{
                    'bg-success':
                      i.is_primary_key === 'YES' || i.is_primary_key === true,
                    'bg-secondary':
                      i.is_primary_key === 'NO' || i.is_primary_key === false,
                  }"
                  >{{ i.is_primary_key }}</span
                >
              </td>
              <td class="border px-4 py-2">
                <span class="badge bg-primary">{{ i.uniqueness }}</span>
              </td>
              <td class="border px-4 py-2">{{ i.table_name }}</td>
              <td class="border px-4 py-2">{{ i.schema }}</td>
            </tr>
          </tbody>
        </table>
        <nav aria-label="Indexes pagination" v-if="numPagesIndexes > 1">
          <ul class="pagination justify-content-center">
            <li
              class="page-item"
              :class="{ disabled: currentPageIndexes === 1 }"
            >
              <a class="page-link" @click.prevent="currentPageIndexes = 1"
                >First</a
              >
            </li>
            <li
              class="page-item"
              :class="{ disabled: currentPageIndexes === 1 }"
            >
              <a
                class="page-link"
                @click.prevent="currentPageIndexes--"
                aria-label="Previous"
              >
                <span aria-hidden="true">&laquo;</span>
              </a>
            </li>
            <li
              class="page-item"
              v-for="page in numPagesIndexes"
              :key="page"
              :class="{ active: currentPageIndexes === page }"
            >
              <a class="page-link" @click.prevent="currentPageIndexes = page">{{
                page
              }}</a>
            </li>
            <li
              class="page-item"
              :class="{ disabled: currentPageIndexes === numPagesIndexes }"
            >
              <a
                class="page-link"
                @click.prevent="currentPageIndexes++"
                aria-label="Next"
              >
                <span aria-hidden="true">&raquo;</span>
              </a>
            </li>
            <li
              class="page-item"
              :class="{ disabled: currentPageIndexes === numPagesIndexes }"
            >
              <a
                class="page-link"
                @click.prevent="currentPageIndexes = numPagesIndexes"
                >Last</a
              >
            </li>
          </ul>
        </nav>
      </div>

      <div v-else-if="tabIsActive === 'constraints'" class="mt-4">
        <div class="mb-4 c-grid gap-2">
          <div>
            <label for="schemaFilter" class="me-2 font-medium">Schema:</label>
            <select
              id="schemaFilter"
              v-model="selectedSchema"
              class="border rounded px-2 py-1"
            >
              <option value="">All schemas</option>
              <option v-for="s in uniqueSchemas" :key="s" :value="s">
                {{ s }}
              </option>
            </select>
          </div>

          <div>
            <label for="itemsPerPage" class="me-2 font-medium"
              >Items per page:</label
            >
            <select
              id="itemsPerPage"
              v-model="itemsPerPage"
              class="border rounded px-2 py-1"
              style="width: auto"
            >
              <option :value="10">10</option>
              <option :value="25">25</option>
              <option :value="50">50</option>
              <option :value="100">100</option>
            </select>
          </div>

          <span class="text-muted"
            >Total items: {{ filteredConstraints.length }}</span
          >
        </div>
        <table class="table table-sm">
          <thead class="bg-gray-100">
            <tr>
              <th class="px-4 py-2 text-left">Constraint</th>
              <th class="px-4 py-2 text-left">Type</th>
              <th class="px-4 py-2 text-left">Table</th>
              <th class="px-4 py-2 text-left">Schema</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in paginatedConstraints" :key="c.constraint_name">
              <td class="border px-4 py-2">{{ c.constraint_name }}</td>
              <td class="border px-4 py-2">
                <span
                  class="badge"
                  :class="getConstraintClass(c.constraint_description)"
                  >{{ c.constraint_description }}</span
                >
              </td>
              <td class="border px-4 py-2">{{ c.table_name }}</td>
              <td class="border px-4 py-2">{{ c.schema }}</td>
            </tr>
          </tbody>
        </table>
        <nav aria-label="Indexes pagination" v-if="numPagesConstraints > 1">
          <ul class="pagination justify-content-center">
            <li
              class="page-item"
              :class="{ disabled: currentPageConstraints === 1 }"
            >
              <a class="page-link" @click.prevent="currentPageConstraints = 1"
                >First</a
              >
            </li>
            <li
              class="page-item"
              :class="{ disabled: currentPageConstraints === 1 }"
            >
              <a
                class="page-link"
                @click.prevent="currentPageConstraints--"
                aria-label="Previous"
              >
                <span aria-hidden="true">&laquo;</span>
              </a>
            </li>
            <li
              class="page-item"
              v-for="page in numPagesConstraints"
              :key="page"
              :class="{ active: currentPageConstraints === page }"
            >
              <a
                class="page-link"
                @click.prevent="currentPageConstraints = page"
                >{{ page }}</a
              >
            </li>
            <li
              class="page-item"
              :class="{
                disabled: currentPageConstraints === numPagesConstraints,
              }"
            >
              <a
                class="page-link"
                @click.prevent="currentPageConstraints++"
                aria-label="Next"
              >
                <span aria-hidden="true">&raquo;</span>
              </a>
            </li>
            <li
              class="page-item"
              :class="{
                disabled: currentPageConstraints === numPagesConstraints,
              }"
            >
              <a
                class="page-link"
                @click.prevent="currentPageConstraints = numPagesConstraints"
                >Last</a
              >
            </li>
          </ul>
        </nav>
      </div>

      <div v-show="tabIsActive == 'editor'" class="mt-4 query-editor">
        <div class="pg-query-tab-container">
          <!-- Tab Bar -->
          <div class="pg-tab-bar">
            <div
              v-for="(pgEditorTab, index) in pgEditorTabs"
              :key="pgEditorTab.id"
              :class="[
                'pg-tab-item',
                { active: index === activePgEditorTabIndex },
              ]"
              @click="activePgEditorTabIndex = index"
            >
              <span class="pg-tab-name">{{ pgEditorTab.name }}</span>
              <button
                class="pg-tab-close-btn"
                @click.stop="closePgEditorTab(index)"
              >
                ×
              </button>
            </div>

            <!-- Add (+) Button -->
            <button class="pg-tab-add-btn" @click="addPgEditorTab">+</button>
          </div>

          <!-- Tab Content -->
          <div class="pg-tab-content">
            <PgQueryEditor
              v-for="(pgEditorTab, index) in pgEditorTabs"
              v-show="index === activePgEditorTabIndex"
              :key="pgEditorTab.id"
              :databaseInView="databaseInView"
              :clusterData="clusterData"
              :clusterDataInSession="clusterDataInSession"
              :defaultQueryString="pgEditorTab.defaultQuery"

            />
          </div>
        </div>
      </div>

      <!-- ADD RECORD MODAL -->
      <div class="modal fade" id="addRecordModal" tabindex="-1">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header bg-success text-white">
              <h5 class="modal-title">
                Add New Record to {{ databaseInView }}.{{ tableInView  }}
              </h5>
              <button
                type="button"
                class="btn-close btn-close-white"
                data-bs-dismiss="modal"
              ></button>
            </div>
            <div class="modal-body">
              <form @submit.prevent="generateInsertSql">
                <div
                  v-for="col in nonPkColumns"
                  :key="col.column_name"
                  class="mb-3"
                >
                  <label class="form-label fw-bold">
                    {{ col.column_name }}
                    <small class="text-muted text-uppercase" style="font-size: 12px;">({{ col.udt_name }})</small>
                    <span v-if="col.is_nullable === 'NO'" class="text-danger"
                      >*</span
                    >
                  </label>

                  <!-- Text / Number / Date inputs -->
                  <input
                    v-if="
                      ['text', 'varchar', 'char', 'uuid'].includes(col.udt_name)
                    "
                    v-model="newRecordToBeInserted[col.column_name]"
                    :required="col.is_nullable === 'NO' && !col.column_default"
                    class="form-control"
                    :placeholder="col.column_name"
                  />

                  <input
                    v-else-if="
                      ['int4', 'int8', 'numeric'].includes(col.udt_name)
                    "
                    v-model.number="newRecordToBeInserted[col.column_name]"
                    type="number"
                    class="form-control"
                    :step="col.udt_name === 'numeric' ? 'any' : '1'"
                  />

                  <input
                    v-else-if="
                      col.udt_name === 'timestamptz' ||
                      col.udt_name === 'timestamp'
                    "
                    v-model="newRecordToBeInserted[col.column_name]"
                    type="datetime-local"
                    class="form-control"
                  />

                  <input
                    v-else-if="col.udt_name.includes('date')"
                    v-model="newRecordToBeInserted[col.column_name]"
                    type="date"
                    class="form-control"
                  />

                  <input
                    v-else-if="col.udt_name === 'bool'"
                    type="checkbox"
                    v-model="newRecordToBeInserted[col.column_name]"
                    class="form-check-input"
                  />

                  <input
                    v-else
                    v-model="newRecordToBeInserted[col.column_name]"
                    class="form-control"
                    :placeholder="col.udt_name"
                  />
                </div>

                <div class="d-flex justify-content-end gap-2">
                  <button
                    type="button"
                    class="btn btn-secondary"
                    data-bs-dismiss="modal"
                  >
                    Cancel
                  </button>
                  <button type="submit" class="btn btn-success">
                    Generate INSERT SQL
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      <!-- FILTER / SELECT MODAL -->
      <div class="modal fade" id="filterModal" tabindex="-1">
        <div class="modal-dialog modal-xl">
          <div class="modal-content">
            <div class="modal-header bg-primary text-white">
              <h5 class="modal-title">
                Build SELECT Query – {{ databaseInView }}.{{ tableInView }}
              </h5>
              <button
                type="button"
                class="btn-close btn-close-white"
                data-bs-dismiss="modal"
              ></button>
            </div>
            <div class="modal-body">
              <!-- Selected columns -->
              <div class="mb-3">
                <label class="form-label fw-bold">SELECT columns</label><br />
                <div
                  class="btn-group-toggle d-flex flex-wrap gap-2"
                  data-toggle="buttons"
                >
                  <label
                    v-for="col in tableInViewData?.metaData || []"
                    :key="col.column_name"
                    class="btn btn-outline-primary btn-sm"
                  >
                    <input
                      type="checkbox"
                      v-model="selectedColumns"
                      :value="col.column_name"
                    />
                    {{ col.column_name }}
                  </label>
                </div>
              </div>

              <!-- Filters -->
              <div class="mb-3">
                <h6 class="fw-bold">WHERE conditions</h6>
                <div
                  v-for="(filter, idx) in queryFilters"
                  :key="idx"
                  class="row align-items-center mb-2"
                >
                  <div class="col-md-3">
                    <select v-model="filter.column" class="form-select">
                      <option value="">-- column --</option>
                      <option
                        v-for="col in tableInViewData?.metaData || []"
                        :value="col.column_name"
                        :key="col.column_name"
                      >
                        {{ col.column_name }}
                      </option>
                    </select>
                  </div>
                  <div class="col-md-2">
                    <!-- Operator -->
                    <select v-model="filter.operator" class="form-select">
                      <option>=</option>
                      <option>!=</option>
                      <option>></option>
                      <option>>=</option>
                      <option>{{ "<" }}</option>
                      <option>{{ "<=" }}</option>
                      <option>LIKE</option>
                      <option>ILIKE</option>
                      <option>IN</option>
                      <option>IS</option>
                    </select>
                  </div>
                  <div class="col-md-5">
                    <!-- Regular text input (for =, !=, LIKE, IN, etc.) -->
                    <input
                      v-if="filter.operator !== 'IS'"
                      v-model="filter.value"
                      class="form-control"
                      placeholder="value (comma separated for IN)"
                    />

                    <!-- Special dropdown when operator is "IS" -->
                    <select v-else v-model="filter.isValue" class="form-select">
                      <option :value="null" disabled>-- select --</option>
                      <option>NULL</option>
                      <option>NOT NULL</option>
                      <option>TRUE</option>
                      <option>NOT TRUE</option>
                      <option>FALSE</option>
                      <option>NOT FALSE</option>
                    </select>
                  </div>
                  <div class="col-md-2">
                    <button
                      @click="removeFilter(idx)"
                      class="btn btn-danger btn-sm"
                    >
                      <i class="bi bi-trash"></i>
                    </button>
                  </div>
                </div>
                <button
                  @click="addFilterRow"
                  class="btn btn-outline-secondary btn-sm"
                >
                  + Add condition
                </button>
              </div>

              <!-- ORDER BY -->
              <div class="mb-3">
                <label class="form-label fw-bold">ORDER BY &nbsp;</label>
                <select
                  v-model="orderBy"
                  class="form-select w-auto d-inline-block"
                >
                  <option :value="null">-- none --</option>
                  <option
                    v-for="col in tableInViewData?.metaData || []"
                    :value="col.column_name"
                    :key="col.column_name"
                  >
                    {{ col.column_name }}
                  </option>
                </select>
                <select
                  v-model="orderDir"
                  class="form-select w-auto d-inline-block ms-2"
                >
                  <option>ASC</option>
                  <option>DESC</option>
                </select>
              </div>

              <!-- LIMIT -->
              <div class="mb-3">
                <label class="form-label fw-bold">LIMIT &nbsp;</label>
                <input
                  v-model.number="limit"
                  type="number"
                  min="1"
                  class="form-control w-auto d-inline-block"
                  style="width: 120px"
                />
              </div>

              <div class="d-flex justify-content-end gap-2">
                <button @click="generateSelectSql" class="btn btn-primary">
                  Generate SELECT SQL
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
    <PasswordModal
      :clusters="null"
      :clusterInSession="this.clusterDataInSession"
      :callbackFunc="this.getDbAnalytics"
    />
  </main>
</template>

<script>
export default {
  name: "PostgresDbVisualizer",
  components: {
    PasswordModal: defineAsyncComponent(() =>
      loadModule(
        "/vue/components/database/DatabasePasswordModal.vue",
        window.$httpLoaderOption
      )
    ),
    PgQueryEditor: defineAsyncComponent(() =>
      loadModule(
        "/vue/components/database/PgQueryEditor.vue",
        window.$httpLoaderOption
      )
    ),
  },
  data() {
    return {
      clusterData: null,
      databaseInView: null,
      databaseAnalyticsIsLoading: true,
      databaseAnalytics: {},
      tabIsActive: "table",
      tabs: [
        {
          title: "Table",
          active: true,
          slug: "table",
        },
        {
          title: "Indexes",
          active: false,
          slug: "indexes",
        },
        {
          title: "Constraints",
          active: false,
          slug: "constraints",
        },
        {
          title: "Query Editor",
          active: false,
          slug: "editor",
        },
        {
          title: "Security & Settings",
          active: false,
          slug: "settings",
        },
      ],
      pgEditorTabs: [],
      activePgEditorTabIndex: 0,
      pgQueryDefaultString: '',
      tables: [],
      indexes: [],
      constraints: [],
      selectedSchema: "",
      itemsPerPage: 10,
      currentPageTables: 1,
      currentPageIndexes: 1,
      currentPageConstraints: 1,
      schemaInView: null,
      tableInView: null,
      tableDataIsLoading: false,
      tableInViewData: {},
      hoveredCol: null,
      newRecordToBeInserted: {},
      addModal: null,
      queryFilters: [],
      selectedColumns: [],
      queryOrderBy: null,
      queryOrderDir: "DESC",
      queryLimit: 100,
      filterModal: null,
    };
  },
  computed: {
    clusterDataInSession() {
      return {
        version: String(this.clusterData).split("-")[0],
        port: String(this.clusterData).split("-")[1],
      };
    },
    uniqueSchemas() {
      const set = new Set();
      this.tables.forEach((t) => set.add(t.schema));
      this.indexes.forEach((i) => set.add(i.schema));
      this.constraints.forEach((c) => set.add(c.schema));
      return Array.from(set).sort();
    },
    filteredTables() {
      return this.filterBySchema(this.tables);
    },
    filteredIndexes() {
      return this.filterBySchema(this.indexes);
    },
    filteredConstraints() {
      return this.filterBySchema(this.constraints);
    },
    numPagesTables() {
      return Math.ceil(this.filteredTables.length / this.itemsPerPage);
    },
    numPagesIndexes() {
      return Math.ceil(this.filteredIndexes.length / this.itemsPerPage);
    },
    numPagesConstraints() {
      return Math.ceil(this.filteredConstraints.length / this.itemsPerPage);
    },
    paginatedTables() {
      const start = (this.currentPageTables - 1) * this.itemsPerPage;
      const end = start + this.itemsPerPage;
      return this.filteredTables.slice(start, end);
    },
    paginatedIndexes() {
      const start = (this.currentPageIndexes - 1) * this.itemsPerPage;
      const end = start + this.itemsPerPage;
      return this.filteredIndexes.slice(start, end);
    },
    paginatedConstraints() {
      const start = (this.currentPageConstraints - 1) * this.itemsPerPage;
      const end = start + this.itemsPerPage;
      return this.filteredConstraints.slice(start, end);
    },
    nonPkColumns() {
      if (this.tableInViewData?.metaData) {
        return this.tableInViewData.metaData?.filter(
          (c) => c.is_primary_key !== "t"
        );
      } else {
        return [];
      }
    },
  },
  methods: {
    switchToTab(slug, options={}) {
      if (this.tabIsActive != slug) {
        this.tabs = this.tabs.map((data) => {
          return {
            ...data,
            active: data.slug === slug,
          };
        });
        this.tabIsActive = slug;
        if (slug == "editor") {
          if (this.pgEditorTabs.length == 0) {
            this.addPgEditorTab(options.default);
          }else{
            if(options.default){
            this.addPgEditorTab(options.default);
            }
          }
        }
      }
    },
    addPgEditorTab(defaultQuery=null) {
      const id = Date.now();
      const slugNo = Number(this.pgEditorTabs.at(-1)?.slugNo || 0) + 1;
      this.pgEditorTabs.push({ id, slugNo, name: `Query ${slugNo}`, defaultQuery });
      this.activePgEditorTabIndex = this.pgEditorTabs.length - 1;
    },
    closePgEditorTab(index) {
      this.pgEditorTabs.splice(index, 1);

      if (this.pgEditorTabs.length === 0) {
        this.addPgEditorTab(); // always keep one tab open
      } else if (this.activePgEditorTabIndex >= this.pgEditorTabs.length) {
        this.activePgEditorTabIndex = this.pgEditorTabs.length - 1;
      }
    },
    getDbAnalytics() {
      this.databaseAnalyticsIsLoading = true;
      axios
        .get(
          `${this.$BACKEND_BASE_URL}/database/postgres/${this.clusterData}/${this.databaseInView}/analytics`,
          this.$store.state.headers
        )
        .then((res) => {
          const resData = res.data.data;
          this.tables = resData.tables;
          this.indexes = resData.indexes;
          this.constraints = resData.constraints;

          this.$dbVisualiserAuthenticatorFunc(
            res.data,
            "postgres",
            this.clusterDataInSession.version
          );
        })
        .catch((err) => {
          err.response.data;
          this.$dbVisualiserAuthenticatorFunc(
            err?.response?.data || {},
            "postgres",
            this.clusterDataInSession.version
          );
        });
    },
    filterBySchema(arr) {
      if (!this.selectedSchema) return arr;
      return arr.filter((item) => item.schema === this.selectedSchema);
    },
    getConstraintClass(type) {
      switch (type?.toUpperCase()) {
        case "PRIMARY KEY":
          return "bg-primary";
        case "UNIQUE":
          return "bg-secondary";
        case "FOREIGN KEY":
          return "bg-info";
        case "CHECK":
          return "bg-warning";
        case "NOT NULL":
          return "bg-danger";
        case "EXCLUSION":
          return "bg-dark";
        default:
          return "bg-light";
      }
    },
    getTableAnalytics() {
      this.tableDataIsLoading = true;
      axios
        .get(
          `${this.$BACKEND_BASE_URL}/database/postgres/${this.clusterData}/${this.databaseInView}/${this.schemaInView}/${this.tableInView}/data-view`,
          this.$store.state.headers
        )
        .then((res) => {
          const resData = res.data.data;

          this.tableDataIsLoading = false;
          this.tableInViewData = resData;

          this.$dbVisualiserAuthenticatorFunc(
            res.data,
            "postgres",
            this.clusterDataInSession.version
          );

          setTimeout(() => {
            const tooltipTriggerList = document.querySelectorAll(
              '[data-bs-toggle="tooltip"]'
            );
            tooltipTriggerList.forEach((tooltipTriggerEl) => {
              new bootstrap.Tooltip(tooltipTriggerEl);
            });
          }, 2000);
        })
        .catch((err) => {
          err.response.data;
          this.$dbVisualiserAuthenticatorFunc(
            err?.response?.data || {},
            "postgres",
            this.clusterDataInSession.version
          );
        });
    },
    viewTable(tableName, schemaName) {
      const clusterVersion = this.clusterData.split("-")[0];
      if (
        this.$dbVisualiserAuthRequired.value.database != "postgres" ||
        this.$dbVisualiserAuthRequired.value.status ||
        this.$dbVisualiserAuthRequired.value.version != clusterVersion
      ) {
        this.$dbVisualiserAuthenticatorFunc(
          {},
          "postgres",
          this.$dbVisualiserAuthRequired.value.version
        );
      } else {
        this.showTable(tableName, schemaName);
      }
    },
    showTable(tableName, schemaName) {
      this.tableDataIsLoading = true;
      this.tableInView = tableName;
      this.schemaInView = schemaName;
      this.getTableAnalytics();
    },
    hideTable() {
      this.tableDataIsLoading = false;
      this.tableInView = null;
      this.tableInViewData = null;
      this.schemaInView = null;
    },
    openAddModal() {
      this.newRecordToBeInserted = {};
      this.addModal = new bootstrap.Modal("#addRecordModal");
      this.addModal.show();
    },
    openFilterModal() {
      this.selectedColumns = this.tableInViewData?.metaData.map(
        (c) => c.column_name
      );
      this.queryFilters = [{ column: "", operator: "=", value: "" }];
      this.filterModal = new bootstrap.Modal("#filterModal");
      this.filterModal.show();
    },

    addFilterRow() {
      this.queryFilters.push({
        column: "",
        operator: "=",
        value: "",
        isValue: null,
      });
    },

    removeFilter(idx) {
      this.queryFilters.splice(idx, 1);
    },

    generateInsertSql() {
      const cols = [];
      const vals = [];

      this.nonPkColumns.forEach((col) => {
        let val = this.newRecordToBeInserted[col.column_name];
        if (val === undefined || val === null || val === "") {
          if (col.column_default) return;
          if (col.is_nullable === "YES") {
            vals.push("NULL");
            cols.push(col.column_name);
          }
          return;
        }

        cols.push(col.column_name);

        if (
          typeof val === "string" &&
          !["timestamptz", "date"].includes(col.udt_name)
        ) {
          vals.push(`'${val.replace(/'/g, "''")}'`);
        } else if (col.udt_name === "bool") {
          vals.push(val ? "true" : "false");
        } else {
          vals.push(val);
        }
      });

      const sql = `INSERT INTO ${this.tableInView} (${cols.join(
        ", "
      )})\nVALUES (${vals.join(
        ", "
      )});`;

      this.switchToTab("editor", {default: sql})
      this.addModal.hide();
    },

    generateSelectSql() {
      let sql = "SELECT ";

      // Columns
      if (
        this.selectedColumns.length === 0 ||
        this.selectedColumns.length === this.tableInViewData?.metaData?.length
      ) {
        sql += "*";
      } else {
        sql += this.selectedColumns.join(", ");
      }

      sql += `\nFROM ${this.tableInView}`;

      // WHERE
      const whereParts = this.queryFilters
        .filter((f) => f.column)
        .map((f) => {
          const col = f.column;

          // Handle "IS" operator specially
          if (f.operator === "IS") {
            if (!f.isValue) return null;
            return `${col} IS ${f.isValue}`;
          }

          // All other operators
          if (!f.value) return null;

          let val = f.value.trim();

          if (f.operator === "IN") {
            const items = val
              .split(",")
              .map((v) => v.trim())
              .filter(Boolean);
            if (items.length === 0) return null;
            val = `(${items
              .map((v) => `'${v.replace(/'/g, "''")}'`)
              .join(", ")})`;
          } else if (f.operator === "LIKE" || f.operator === "ILIKE") {
            val = `'%${val.replace(/'/g, "''")}%'`;
          } else if (isNaN(val)) {
            val = `'${val.replace(/'/g, "''")}'`;
          }

          return `${col} ${f.operator} ${val}`;
        })
        .filter(Boolean);

      if (whereParts.length) {
        sql += `\nWHERE ${whereParts.join("\n  AND ")}`;
      }

      // ORDER BY
      if (this.queryOrderBy) {
        sql += `\nORDER BY ${this.queryOrderBy} ${this.queryOrderDir}`;
      }

      // LIMIT
      if (this.queryLimit) {
        sql += `\nLIMIT ${this.queryLimit}`;
      }

      sql += ";";
      

      this.switchToTab("editor", {default: sql})
      this.filterModal.hide()

    },
  },

  mounted() {
    this.clusterData = this.$route.params.cluster;
    this.databaseInView = this.$route.params.database;
    this.getDbAnalytics();
  },
};
</script>
