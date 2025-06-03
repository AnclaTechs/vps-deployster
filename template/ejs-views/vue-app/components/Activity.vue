<template>
  <div class="mt-5">
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h5 class="fw-bold text-muted mb-0">Activity & Logs</h5>
      <div v-if="logFiles.length" class="form-group mb-0">
        <select class="form-select form-select-sm" v-model="selectedLog">
          <option disabled value="">Select log file</option>
          <option v-for="file in logFiles" :key="file" :value="file">
            {{ file }}
          </option>
        </select>
      </div>
    </div>

    <div class="card p-3" style="min-height: 300px">
      <div v-if="loading" class="text-center text-muted">
        <div class="spinner-border spinner-border-sm" role="status"></div>
        <span class="ms-2">Loading logs...</span>
      </div>

      <div v-else-if="logs.length">
        <div
          v-for="(log, index) in logs"
          :key="index"
          class="border-bottom py-2"
          style="font-family: monospace; font-size: 0.875rem"
        >
          <span class="text-muted">{{ formatTimestamp(log.timestamp) }}</span>
          <br />
          <span>{{ log.message }}</span>
        </div>
      </div>

      <div v-else class="text-center text-muted">No logs available.</div>
    </div>
  </div>
</template>

<script>
export default {
  name: "Activity",
  props: {
    projectId: {
      type: [String, Number],
      required: true,
    },
  },
  data() {
    return {
      logFiles: [],
      selectedLog: "",
      logs: [],
      loading: false,
    };
  },
  watch: {
    selectedLog() {
      this.fetchLogs();
    },
  },
  mounted() {
    this.fetchLogFiles();
  },
  methods: {
    async fetchLogFiles() {
      try {
        // Replace with real API
        this.logFiles = ["app.log", "error.log", "deploy.log"];
        this.selectedLog = this.logFiles[0];
      } catch (error) {
        console.error("Failed to load log files", error);
      }
    },
    async fetchLogs() {
      if (!this.selectedLog) return;

      this.loading = true;
      try {
        // Simulated API call – replace with real one
        this.logs = [
          { timestamp: new Date(), message: "Deployment started..." },
          { timestamp: new Date(), message: "Pulling latest commit..." },
          { timestamp: new Date(), message: "Build successful." },
        ];
      } catch (err) {
        console.error("Error loading logs:", err);
      } finally {
        this.loading = false;
      }
    },
    formatTimestamp(ts) {
      return new Date(ts).toLocaleString();
    },
  },
};
</script>

<style scoped>
select.form-select-sm {
  width: auto;
  min-width: 150px;
}
</style>
