<template>
  <div class="container py-4">
    <HeaderX></HeaderX>
    <!-- Top Summary Section -->
    <div class="bg-white p-4 rounded shadow-sm mb-4">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h4 class="fw-bold mb-0">{{ project.name }}</h4>
        <button
          class="btn btn-sm btn-outline-secondary ms-2"
          @click="openSettings"
        >
          <i class="fad fa-cogs me-2"></i>
          Edit Project
        </button>
      </div>

      <div class="row text-muted">
        <div class="col-md-6 mb-2">
          <i class="fad fa-terminal me-2"></i>
          <strong>Path: &nbsp;</strong> {{ project.path }}
        </div>
        <div class="col-md-6 mb-2">
          <i class="fad fa-code-branch me-2"></i>
          <strong>Git: &nbsp;</strong>
          <a :href="project.gitUrl" target="_blank">{{ project.gitUrl }}</a>
        </div>
        <div class="col-md-6 mb-2">
          <i class="fad fa-hashtag me-2"></i>
          <strong>HEAD: &nbsp; </strong> {{ project.currentHead }}
        </div>
        <div class="col-md-6 mb-2">
          <i class="fad fa-map-marker-alt me-2"></i>
          <strong>TCP Port: &nbsp;</strong> {{ project.port }}
        </div>
        <div class="col-md-6 mb-2">
          <i class="fad fa-link me-2"></i>
          <strong>Live URL: &nbsp;</strong>
          <a :href="project.appLink" target="_blank">{{ project.appLink }}</a>
        </div>
        <div class="col-md-6 mb-2">
          <i class="fad fa-globe me-2"></i>
          <strong>Status: &nbsp;</strong>

          <span class="badge bg-success">{{ project.status }}</span>
        </div>
      </div>
    </div>

    <!-- Tabs for Activity and Logs -->
    <div class="bg-white p-4 rounded shadow-sm">
      <ul class="nav nav-tabs mb-3">
        <li class="nav-item">
          <a
            class="nav-link"
            :class="{ active: tab === 'activity' }"
            @click="tab = 'activity'"
            >Activity</a
          >
        </li>
        <li class="nav-item">
          <a
            class="nav-link"
            :class="{ active: tab === 'logs' }"
            @click="tab = 'logs'"
            >Logs</a
          >
        </li>
      </ul>

      <div v-if="tab === 'activity'">
        <ActivityFeed :events="project.activity" />
      </div>

      <div v-else>
        <div class="mb-3">
          <label>Select Log File:</label>
          <select class="form-select" v-model="selectedLog">
            <option
              v-for="log in project.logs"
              :key="log.name"
              :value="log.path"
            >
              {{ log.name }}
            </option>
          </select>
        </div>

        <div
          class="log-view bg-dark text-light p-3 rounded"
          style="min-height: 300px; overflow: auto"
        >
          <pre>{{ logs[selectedLog] || "Loading..." }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: "ProjectView",
  props: ["id"],
  components: {
    ActivityFeed: defineAsyncComponent(() =>
      loadModule("/vue/components/Activity.vue", window.$httpLoaderOption)
    ),
    HeaderX: defineAsyncComponent(() =>
      loadModule("/vue/components/Header.vue", window.$httpLoaderOption)
    ),
  },
  data() {
    return {
      tab: "activity",
      selectedLog: null,
      logs: {},
      project: {
        name: "Example",
        path: "/var/www/example",
        status: "Active",
        gitUrl: "https://github.com/user/example",
        currentHead: "b4a91d3",
        port: 5000,
        appLink: "http://example.com",
        logs: [
          { name: "stdout.log", path: "/logs/stdout.log" },
          { name: "stderr.log", path: "/logs/stderr.log" },
        ],
        activity: [
          { time: "2025-05-25", action: "Deployed new build." },
          { time: "2025-05-22", action: "Restarted service." },
        ],
      },
    };
  },
  watch: {
    selectedLog(newPath) {
      this.fetchLog(newPath);
    },
  },
  mounted() {
    if (this.project.logs.length) {
      this.selectedLog = this.project.logs[0].path;
    }
  },
  methods: {
    openSettings() {
      // Open log settings modal
      alert("Open settings modal");
    },
    fetchLog(path) {
      // Simulate log fetch
      this.logs[
        path
      ] = `Log from ${path}...\n[INFO] Application started...\n[INFO] Listening on port ${this.project.port}`;
    },
  },
};
</script>

<style scoped>
.log-view {
  font-family: monospace;
  font-size: 0.875rem;
}
</style>
