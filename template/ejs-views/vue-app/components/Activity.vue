<template>
  <div class="mt-5">
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h5 class="fw-bold text-muted mb-0">Deployment Activity</h5>
    </div>

    <div
      class="card p-3"
      style="min-height: 300px; overflow: auto; max-height: 500px"
    >
      <div v-if="events.currentDeployment">
        <pre
          v-if="activeLogContent"
          ref="logContainer"
          class="bg-dark text-light p-3 rounded"
          style="
            height: 250px;
            overflow-y: auto;
            white-space: pre-wrap;
            font-family: monospace;
            font-size: 0.875rem;
          "
        >
          <code class="language-bash" style="padding: 0 !important; background: none;">{{ activeLogContent }}</code>
        </pre>

        <div
          v-else
          class="d-flex align-items-center justify-content-center gap-2 text-muted"
          role="status"
          aria-label="Building project and fetching logs"
        >
          <div
            class="spinner-border spinner-border-sm"
            aria-hidden="true"
          ></div>
          <span class="text-sm">New Build incoming. Fetching logs...</span>
        </div>
      </div>

      <div
        v-else-if="events.deploymentActivityLogs?.length"
        ref="activityLogsContainer"
        class="logs-wrapper"
      >
        <div
          v-for="(log, index) in paginatedLogs"
          :key="index"
          class="border-bottom py-2"
          style="font-family: monospace; font-size: 0.875rem"
        >
          <div
            class="d-flex flex-row justify-content-between align-items-center"
          >
            <span class="text-muted">{{
              formatTimestamp(log.created_at)
            }}</span>

            <span v-if="log.pipeline_stage_uuid && !selectedPipelineStage">
              <i class="fad fa-code-commit fa-sm me-1"></i>
              {{ getPipelineNameFromUUID(log.pipeline_stage_uuid) }}</span
            >
          </div>
          <br />
          <span
            ><span class="fw-bold text-muted">{{ log.email }}</span
            >:
            <span
              :style="{
                color: log.message?.toLowerCase().includes('succeeded')
                  ? '#198754'
                  : '#DC3545',
                fontWeight: 600,
              }"
              >{{ log.message }}</span
            ></span
          >
          <div
            class="d-flex flex-row justify-content-between align-items-center mt-1"
          >
            <span
              ><code class="commit-hash">{{
                String(log.commit_hash).slice(0, 7)
              }}</code>
              v{{ log.sequential_id }}</span
            >
            <div>
              <a
                href="#"
                @click.prevent="
                  showPastDeploymentLog(
                    log?.log_output,
                    String(log.commit_hash).slice(0, 7),
                    log.sequential_id
                  )
                "
                >View Build Log</a
              >
              <a
                v-if="log.message?.toLowerCase().includes('succeeded')"
                href="#"
                class="ms-2"
                @click.prevent="
                  openRollbackModal(
                    log.commit_hash,
                    log.pipeline_stage_uuid ?? null
                  )
                "
                >Roll back here</a
              >
            </div>
          </div>
        </div>

        <div v-if="totalLogPages > 1" class="mt-3 text-center">
          <button
            class="btn btn-sm btn-outline-primary me-2"
            :disabled="currentActivityLogPage === 1"
            @click="changeLogPage(currentActivityLogPage - 1)"
          >
            Previous
          </button>

          <span>Page {{ currentActivityLogPage }} of {{ totalLogPages }}</span>

          <button
            class="btn btn-sm btn-outline-primary ms-2"
            :disabled="currentActivityLogPage === totalLogPages"
            @click="changeLogPage(currentActivityLogPage + 1)"
          >
            Next
          </button>
        </div>
      </div>

      <div v-else class="text-center text-muted">
        <div class="mt-5">
          <i class="fad fa-signal-stream fa-lg"></i>
          <p>No deployment activity available.</p>
        </div>
      </div>
    </div>

    <section>
      <!-- Previous Deployment Log Modal -->
      <div
        class="modal fade"
        id="deploymentLogModal"
        tabindex="-1"
        aria-labelledby="deploymentLogModalLabel"
        aria-hidden="true"
      >
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title" id="deploymentLogModalLabel">
                <span class="badge rounded-pill bg-secondary">{{
                  deploymentInViewHash
                }}</span>
                Build Log <small>v{{ deploymentInViewVersionId }}</small>
              </h5>
              <button
                type="button"
                class="btn-close"
                data-bs-dismiss="modal"
                aria-label="Close"
              ></button>
            </div>
            <div
              class="modal-body bg-light border rounded"
              style="max-height: 60vh; overflow-y: auto; font-family: monospace"
            >
              <pre>
              <code class="language-bash" style="padding: 0 !important;">{{ parsedDeploymentLog }}
                </code>
              </pre>
            </div>
          </div>
        </div>
      </div>

      <!-- Rollback Modal-->
      <div
        class="modal fade"
        id="rollbackModal"
        tabindex="-1"
        aria-labelledby="rollbackModalLabel"
        aria-hidden="true"
        ref="rollbackModal"
        data-bs-backdrop="static"
        data-bs-keyboard="false"
      >
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header bg-warning-subtle">
              <h5 class="modal-title text-warning" id="rollbackModalLabel">
                ⚠️ Rolling Back Notice
              </h5>
              <button
                type="button"
                class="btn-close"
                data-bs-dismiss="modal"
                aria-label="Close"
              ></button>
            </div>
            <div class="modal-body">
              <div class="mb-2">
                <strong class="me-2">Project:</strong>
                <span>{{ project.name }}</span>
              </div>
              <div class="mb-2">
                <strong class="me-2">Pipline:</strong>
                <span :class="{ 'text-muted': !rollbackPipelineUUIDinView }">
                  {{
                    rollbackPipelineUUIDinView
                      ? getPipelineNameFromUUID(rollbackPipelineUUIDinView)
                      : "NIL"
                  }}
                </span>
              </div>
              <div class="mb-2">
                <strong class="me-2">Commit Hash:</strong>
                <span>
                  <code class="commit-hash">{{
                    String(rollbackCommitHashInView).slice(0, 7)
                  }}</code></span
                >
              </div>
              <div class="mt-4 alert alert-danger">
                Rolling back locally to a previous Git branch snapshot can be
                risky.
                <p class="mt-3 fw-bold">
                  If the server doesn’t start smoothly afterward, you may need
                  to re-deploy via your GitHub Actions or CI/CD pipeline.
                </p>
              </div>
            </div>
            <div class="modal-footer">
              <div
                v-if="rollbackIsProcessing"
                class="d-flex justify-content-center align-items-center"
              >
                <div
                  class="spinner-border spinner-border-md"
                  aria-hidden="true"
                ></div>
              </div>
              <div v-else class="d-flex gap-3">
                <button
                  type="button"
                  class="btn btn-secondary"
                  data-bs-dismiss="modal"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  class="btn btn-danger"
                  @click="confirmRollback()"
                >
                  Proceed
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script>
export default {
  name: "Activity",
  props: {
    project: {
      type: Object,
      required: true,
    },
    events: {
      type: Object,
      required: true,
    },
    getPipelineNameFromUUID: {
      type: Function,
      required: true,
    },
    selectedPipelineStage: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      currentActivityLogPage: 1,
      itemsPerPage: 10,
      activeLogContent: "",
      activeLogLineCount: 0,
      pollingInterval: null,
      parsedDeploymentLog: null,
      deploymentInViewHash: "",
      deploymentInViewVersionId: "",
      rollbackModalInstance: null,
      rollbackCommitHashInView: null,
      rollbackPipelineUUIDinView: null,
      rollbackIsProcessing: false,
    };
  },
  mounted() {
    if (this.events.currentDeployment) {
      this.startLogStreaming(this.events.currentDeployment.id);
    }
  },
  beforeUnmount() {
    this.stopLogStreaming();
  },
  computed: {
    paginatedLogs() {
      const start = (this.currentActivityLogPage - 1) * this.itemsPerPage;
      const end = start + this.itemsPerPage;
      return this.events.deploymentActivityLogs?.slice(start, end) || [];
    },
    totalLogPages() {
      const total = this.events.deploymentActivityLogs?.length || 0;
      return Math.ceil(total / this.itemsPerPage);
    },
  },
  methods: {
    startLogStreaming(deploymentId) {
      this.pollingInterval = setInterval(() => {
        this.fetchActiveDeploymentLogData(deploymentId);
      }, 3000); // every 3s
    },
    stopLogStreaming() {
      if (this.pollingInterval) {
        clearInterval(this.pollingInterval);
        this.pollingInterval = null;
      }
    },
    async fetchActiveDeploymentLogData(deploymentId) {
      try {
        const res = await axios.get(
          `${this.$BACKEND_BASE_URL}/project/${this.project.id}/active-deployment-log/${deploymentId}?streamPoint=${this.activeLogLineCount}`,
          this.$store.state.headers
        );

        const { log_output, new_line_count, status } = res.data.data;

        if (log_output && new_line_count) {
          this.activeLogContent += "\n" + log_output;
          this.activeLogLineCount += new_line_count; //(log_output.match(/\n/g) || []).length;

          Vue.nextTick(() => {
            const container = this.$refs.logContainer;
            if (container) container.scrollTop = container.scrollHeight;
            this.updateHighlight();
          });
        }

        if (["COMPLETED", "FAILED"].includes(status)) {
          this.stopLogStreaming();
        }
      } catch (error) {
        console.error("Error fetching logs:", error);
      }
    },
    showPastDeploymentLog(
      rawLogOutput,
      deploymentInViewHash,
      deploymentInViewVersionId
    ) {
      this.parsedDeploymentLog = rawLogOutput || "No log data available";
      this.deploymentInViewHash = deploymentInViewHash;
      this.deploymentInViewVersionId = deploymentInViewVersionId;

      const modal = new bootstrap.Modal(
        document.getElementById("deploymentLogModal")
      );
      modal.show();
    },
    changeLogPage(newPage) {
      this.currentActivityLogPage = newPage;
      Vue.nextTick(() => {
        const container = this.$refs.activityLogsContainer;
        if (container) {
          container.scrollTo({
            top: 0,
            behavior: "smooth",
          });
        }
      });
    },
    formatTimestamp(ts) {
      return new Date(ts).toLocaleString();
    },
    updateHighlight() {
      document.querySelectorAll("[data-highlighted]").forEach((el) => {
        delete el.dataset.highlighted;
      });
      hljs.highlightAll();
    },
    openRollbackModal(commitHash, pipelineStageUUID) {
      if (!this.rollbackModalInstance) {
        this.rollbackModalInstance = new bootstrap.Modal(
          this.$refs.rollbackModal
        );
      }
      this.rollbackCommitHashInView = commitHash;
      this.rollbackPipelineUUIDinView = pipelineStageUUID;
      this.rollbackModalInstance.show();
    },
    confirmRollback() {
      console.log({
        project_id: this.project.id,
        pipeline_stage_uuid: this.selectedPipelineStage?.stage_uuid ?? "",
        commit_hash: this.rollbackCommitHashInView,
      });
      this.rollbackIsProcessing = true;
      //this.rollbackModalInstance.hide();

      // Trigger rollback logic here
    },
  },
};
</script>

<style scoped>
a {
  cursor: pointer;
  text-decoration: underline;
  color: var(--bs-primary);
}
.commit-hash {
  color: rgb(71, 83, 102);
  background-color: rgb(247, 248, 251);
  box-shadow: rgba(0, 0, 0, 0.1) 0px 0px 0px 1px inset;
  border-radius: 4px;
}
</style>
