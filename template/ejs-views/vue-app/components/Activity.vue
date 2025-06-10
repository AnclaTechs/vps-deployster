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

      <div v-else-if="events.deploymentActivityLogs?.length">
        <div
          v-for="(log, index) in events.deploymentActivityLogs"
          :key="index"
          class="border-bottom py-2"
          style="font-family: monospace; font-size: 0.875rem"
        >
          <span class="text-muted">{{ formatTimestamp(log.created_at) }}</span
          ><br />
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
              v{{ log.id }}</span
            >
            <div>
              <a
                href="#"
                @click.prevent="showPastDeploymentLog(log?.log_output)"
                >View Build Log</a
              >
              <a
                v-if="log.message?.toLowerCase().includes('succeeded')"
                href="#"
                class="ms-2"
                >Roll back here</a
              >
            </div>
          </div>
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
                Build Log
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
              <code class="language-bash" style="padding: 0 !important;">{{ line }}
                </code>
              </pre>
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
    projectId: {
      type: Number,
      required: true,
    },
    events: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      activeLogContent: "",
      activeLogLineCount: 0,
      pollingInterval: null,
      parsedDeploymentLog: null,
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
          `${this.$BACKEND_BASE_URL}/project/${this.projectId}/active-deployment-log/${deploymentId}?streamPoint=${this.activeLogLineCount}`,
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
    showPastDeploymentLog(rawLogOutput) {
      this.parsedDeploymentLog = rawLogOutput || "No log data available";

      const modal = new bootstrap.Modal(
        document.getElementById("deploymentLogModal")
      );
      modal.show();
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
