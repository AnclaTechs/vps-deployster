<style>
.query-editor.CodeMirror {
  flex: 1;
  height: 500px;
  font-size: 14px;
  border-radius: 8px;
  border: 1px solid #ccc;
}

.visualiser-container {
  display: flex;
  flex-direction: column;
  height: 800px;
  position: relative;
  border: 1px solid #333;
  border-radius: 8px;
  overflow: hidden;
}

.editor-pane {
  background: #282a36 !important;
}

.divider {
  height: 6px;
  background: #444;
  cursor: row-resize;
  transition: background 0.2s;
}
.divider:hover {
  background: #666;
}

.results-pane {
  flex: 1;
  /* background: #121212; */
  height: 300px;
  color: #eee;
  padding: 10px;
  overflow: auto;
}

.loading-state {
  text-align: center;
  padding: 20px;
  color: #434242;
}
.empty-state {
  text-align: center;
  padding: 20px;
  color: #777;
}

.result-table {
  width: 100%;
  border-collapse: collapse;
  color: #eee;
}

.result-table th,
.result-table td {
  border: 1px solid #333;
  padding: 6px 8px;
  text-align: left;
}

.result-table th {
  background: #222222;
}

.result-table td {
  color: #2f4f4f;
  font-size: 12.5px;
}

.result-table tr.table-warning {
  background-color: #fce8a6 !important;
}

.fa-spin {
  animation-duration: 1s;
}

.query-error {
  color: red;
  text-align: start;
}

.editable-cell {
  cursor: pointer;
}
.editable-cell:hover {
  background-color: #f8f9fa; /* Light hover for edit hint */
}

input.form-control-sm {
  padding: 3px 5px;
  font-size: 0.85rem;
}
</style>

<template>
  <div class="visualiser-container">
    <div
      class="editor-pane"
      ref="editorContainer"
      :style="{ height: editorHeight + 'px' }"
    ></div>
    <!--Divider-->
    <div ref="divider" class="divider" @mousedown="startResizing"></div>

    <div class="results-pane">
      <div v-if="loading" class="loading-state">
        <i class="fad fa-spinner-third fa-2x fa-spin"></i>
        <h5>Loading query...</h5>
      </div>
      <div v-else-if="result && result.length">
        <!-- Utility Bar -->
        <div class="d-flex justify-content-between align-items-center mb-3">
          <div class="input-group" style="max-width: 300px">
            <input
              type="text"
              class="form-control"
              v-model="searchQuery"
              placeholder="Search records..."
            />
            <button class="btn btn-outline-secondary" type="button">
              <i class="bi bi-search"></i>
            </button>
          </div>

          <div class="d-flex align-items-center gap-3">
            <small class="text-muted">{{ resultComment }}</small>
            <small v-if="isReadOnly" class="text-muted"
              ><i class="fas fa-info-circle text-primary"></i> Read only</small
            >
            <button
              v-else-if="hasChanges"
              class="btn btn-primary btn-sm"
              @click="saveChanges"
            >
              <i class="bi bi-save"></i> Save changes
            </button>
          </div>
        </div>

        <!-- Data Table -->
        <table class="result-table">
          <thead>
            <tr>
              <th v-for="(key, idx) in Object.keys(result[0])" :key="idx">
                {{ key }}
              </th>
              <th v-if="!isReadOnly">**Action</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(row, index) in paginatedResults"
              :key="index"
              :class="{
                'table-warning': isRowChanged(absoluteRowIndex(index)),
              }"
            >
              <td
                v-for="(val, columnKey) in row"
                :key="columnKey"
                @dblclick="!isReadOnly && startEditing(index, columnKey)"
                :class="{ 'editable-cell': !isReadOnly }"
              >
                <input
                  v-if="
                    editingCell?.rowIndex === index &&
                    editingCell?.columnKey === columnKey
                  "
                  :value="val"
                  type="text"
                  class="form-control form-control-sm"
                  @blur="stopEditing"
                  @input="(e) => updateCell(index, columnKey, e.target.value)"
                  @keyup.enter="stopEditing"
                  @keyup.esc="cancelEdit"
                  autofocus
                />
                <span v-else>{{ val }}</span>
              </td>

              <td v-if="!isReadOnly">
                <button
                  v-if="isRowChanged(absoluteRowIndex(index))"
                  class="btn btn-outline-danger btn-sm"
                  @click="revertRow(absoluteRowIndex(index))"
                  title="Revert this row"
                >
                  <i class="bi bi-arrow-counterclockwise"></i>
                </button>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Pagination Controls -->
        <div
          class="d-flex justify-content-between align-items-center mt-3"
          v-if="totalResultPages > 1"
        >
          <button
            class="btn btn-sm btn-outline-secondary"
            :disabled="currentResultPage === 1"
            @click="currentResultPage--"
          >
            &lt; Prev
          </button>
          <span>
            Page {{ currentResultPage }} of {{ totalResultPages }} ({{
              filteredResults.length
            }}
            rows)
          </span>
          <button
            class="btn btn-sm btn-outline-secondary"
            :disabled="currentResultPage === totalResultPages"
            @click="currentResultPage++"
          >
            Next &gt;
          </button>
        </div>
      </div>
      <div v-else class="empty-state">
        <div v-if="queryErrorResonse != ''" class="query-error">
          {{ queryErrorResonse }}
        </div>
        <div v-else>
          <div v-if="resultComment" class="alert alert-success fw-medium">
            <i class="fad fa-info-circle"></i> &nbsp; {{ resultComment }}
          </div>
          <span v-else>No result yet</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
var queryEditor = null;

export default {
  name: "",
  props: {
    databaseInView: {
      type: String,
      required: true,
    },
    clusterData: {
      type: String,
      required: true,
    },
    clusterDataInSession: {
      type: Object,
      required: true,
    },
    defaultQueryString: {
      type: String,
      required: true,
    }
  },
  data() {
    return {
      //   queryEditor: null,
      queryText: "",
      debugQueryText: "",
      loading: false,
      result: [],
      originalResult: [],
      resultComment: "",
      searchQuery: "",
      currentResultPage: 1,
      resultPerPage: 20,
      queryErrorResonse: "",
      editingCell: null, //{  rowIndex: num, columnKey: str}
      changedRows: new Map(),
      editorHeight: 500,
      isResizing: false,
      startY: 0,
      startHeight: 0,
    };
  },
  computed: {
    isReadOnly() {
      const query = this.debugQueryText || "";

      const hasJoinClause = /\bjoin\b/i.test(query);
      const firstRow = this.originalResult?.[0] || {};

      const missingIdColumn = !Object.prototype.hasOwnProperty.call(
        firstRow,
        "id"
      );

      return hasJoinClause || missingIdColumn;
    },

    filteredResults() {
      if (!this.searchQuery) return this.result;
      const q = this.searchQuery.toLowerCase();
      return this.result.filter((row) =>
        Object.values(row).some(
          (v) => v && v.toString().toLowerCase().includes(q)
        )
      );
    },

    paginatedResults() {
      const start = (this.currentResultPage - 1) * this.resultPerPage;
      return this.filteredResults.slice(start, start + this.resultPerPage);
    },

    totalResultPages() {
      return Math.ceil(this.filteredResults.length / this.resultPerPage);
    },

    hasChanges() {
      return this.changedRows.size > 0;
    },
  },
  methods: {
    async initiateVueCodeMirror() {
      await Promise.all([
        this.$loadStyle(
          "https://cdn.jsdelivr.net/npm/codemirror@5/lib/codemirror.css"
        ),
        this.$loadStyle(
          "https://cdn.jsdelivr.net/npm/codemirror@5/theme/dracula.css"
        ),
      ]);
      await this.$loadScript(
        "https://cdn.jsdelivr.net/npm/codemirror@5/lib/codemirror.js"
      );
      await this.$loadScript(
        "https://cdn.jsdelivr.net/npm/codemirror@5/mode/sql/sql.js"
      );

      await new Promise((r) => setTimeout(r, 50));

      this.$nextTick(() => {
        const container = this.$refs.editorContainer;
        if (!container) return;

        queryEditor = CodeMirror(container, {
          value: this.queryText || "",
          mode: "text/x-sql",
          theme: "dracula",
          lineNumbers: true,
          smartIndent: true,
          indentWithTabs: true,
          extraKeys: { "Ctrl-Enter": () => this.runQuery() },
        });

        queryEditor.on("change", (cm) => {
          this.queryText = cm.getValue();
        });

        queryEditor.setSize(null, this.editorHeight);

        // Refresh on visibility/focus
        const refresh = () => queryEditor && queryEditor.refresh();
        window.addEventListener("focus", refresh);
        document.addEventListener("visibilitychange", refresh);

        // Observe container resize
        const ro = new ResizeObserver(refresh);
        ro.observe(container);
        this._resizeObserver = ro;
      });

      window.addEventListener("mousemove", this.resize);
      window.addEventListener("mouseup", this.stopResizing);
    },

    setContent(content) {
      if (!queryEditor) return;
      queryEditor.setValue(content);
      queryEditor.setCursor({ line: 0, ch: 0 });
      queryEditor.refresh();
    },

    startResizing(e) {
      this.isResizing = true;
      this.startY = e.clientY;
      this.startHeight = this.editorHeight;
      document.body.style.cursor = "row-resize";
      document.addEventListener("mousemove", this.resize);
      document.addEventListener("mouseup", this.stopResizing);
    },
    resize(e) {
      if (!this.isResizing) return;
      const diff = e.clientY - this.startY;
      const newHeight = this.startHeight + diff;
      if (newHeight > 200 && newHeight < window.innerHeight - 200) {
        this.editorHeight = newHeight;
        const cm = this.$refs.editorContainer.querySelector(".CodeMirror");
        if (cm) cm.style.height = `${newHeight}px`;
        queryEditor.refresh();
      }
    },
    stopResizing() {
      if (this.isResizing) {
        this.isResizing = false;
        document.body.style.cursor = "default";
        document.removeEventListener("mousemove", this.resize);
        document.removeEventListener("mouseup", this.stopResizing);
      }
    },
    async runQuery() {
      this.debugQueryText = String(this.queryText);
      this.loading = true;
      this.result = [];
      this.originalResult = [];
      this.queryErrorResonse = "";
      this.resultComment = "";

      axios
        .post(
          `${this.$BACKEND_BASE_URL}/database/postgres/${this.clusterData}/${this.databaseInView}/query`,
          { query: this.queryText },
          this.$store.state.headers
        )
        .then((res) => {
          const resData = res.data.data;
          this.result = resData.rows;
          this.originalResult = JSON.parse(JSON.stringify(resData.rows));
          this.resultComment = `${
            resData.command == "SELECT" ? "Rows returned" : "Rows affected"
          } ${resData.rowCount}`;
          //
          this.$dbVisualiserAuthenticatorFunc(
            res.data,
            "postgres",
            this.clusterDataInSession.version
          );
        })
        .catch((err) => {
          if (err.status == 422) {
            console.log("PSQL");
            this.queryErrorResonse = err.response.data.data.error;
          } else {
            this.$dbVisualiserAuthenticatorFunc(
              err?.response?.data || {},
              "postgres",
              this.clusterDataInSession.version
            );
          }
        })
        .finally(() => {
          this.loading = false;
        });
    },
    absoluteRowIndex(paginatedIndex) {
      // Maps paginated index to full result index
      const start = (this.currentResultPage - 1) * this.resultPerPage;
      return start + paginatedIndex;
    },

    startEditing(rowIndex, columnKey) {
      this.editingCell = { rowIndex, columnKey };
    },
    stopEditing() {
      this.editingCell = null;
    },

    cancelEdit() {
      if (!this.editingCell) return;
      const { rowIndex, columnKey } = this.editingCell;
      const absIndex = this.absoluteRowIndex(rowIndex);

      this.result[absIndex][columnKey] =
        this.originalResult[absIndex][columnKey];

      if (
        JSON.stringify(this.result[absIndex]) ===
        JSON.stringify(this.originalResult[absIndex])
      ) {
        this.changedRows.delete(absIndex);
      }

      this.stopEditing();
    },

    updateCell(rowIndex, columnKey, newValue) {
      const absIndex = this.absoluteRowIndex(rowIndex);
      const originalRow = this.originalResult[absIndex];
      const currentRow = this.result[absIndex];

      currentRow[columnKey] = newValue;

      let rowChanges = this.changedRows.get(absIndex) || {};

      if (currentRow[columnKey] !== originalRow[columnKey]) {
        rowChanges[columnKey] = newValue;
        rowChanges["id"] = originalRow["id"];
        this.changedRows.set(absIndex, rowChanges);
      } else {
        delete rowChanges[columnKey];
        delete rowChanges["id"];

        if (Object.keys(rowChanges).length === 0) {
          this.changedRows.delete(absIndex);
        } else {
          this.changedRows.set(absIndex, rowChanges);
        }
      }
    },

    revertRow(absIndex) {
      console.log({ a: this.originalResult[absIndex] });
      this.result[absIndex] = { ...this.originalResult[absIndex] };
      this.changedRows.delete(absIndex);
    },

    isRowChanged(absIndex) {
      return this.changedRows.has(absIndex);
    },

    saveChanges() {
      if (!this.changedRows.size) return;

      const changedArray = Array.from(this.changedRows.values());
      const sqlUpdates = this.generateSQL(changedArray);

      console.log("SQL to send:", sqlUpdates);

      this.$nextTick(() => {
        if (!queryEditor) return;
        queryEditor.setOption("readOnly", false);
        queryEditor.setValue(sqlUpdates.join("\n\n"));
        queryEditor.setCursor({ line: 0, ch: 0 });
        queryEditor.refresh();
      });
    },

    getMainTableName() {
      const normalized = this.debugQueryText
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();

      const matched = normalized.match(
        /\bfrom\s+([^\s;]+)(\s+as\s+\w+|\s+\w+)?/i
      );

      if (matched) {
        return matched[1];
      }

      return null;
    },

    generateSQL(changedRows) {
      return changedRows.map((row) => {
        const sets = Object.entries(row)
          .filter(([k]) => k !== "id")
          .map(([k, v]) => `${k} = '${String(v).replace(/'/g, "''")}'`)
          .join(", ");
        return `UPDATE ${this.getMainTableName()} SET ${sets} WHERE id = ${
          row.id
        };`;
      });
    },
  },
  mounted() {
    this.initiateVueCodeMirror();
    setTimeout(() => {
      if(this.defaultQueryString){
        this.setContent(this.defaultQueryString)
      }
    }, 500)
  },
  beforeUnmount() {
    if (queryEditor) queryEditor = null;
    if (this._resizeObserver) this._resizeObserver.disconnect();
    document.removeEventListener("mousemove", this.resize);
    document.removeEventListener("mouseup", this.stopResizing);
  },
};
</script>
