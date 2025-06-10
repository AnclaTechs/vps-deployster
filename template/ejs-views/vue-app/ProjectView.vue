<template>
  <section>
    <div class="container py-4">
      <HeaderX></HeaderX>
      <!-- Top Summary Section -->
      <div
        v-if="projectDataIsLoading"
        class="bg-white p-4 rounded shadow-sm mb-4"
      >
        <div
          class="d-flex flex-column justify-content-center align-items-center"
        >
          <div>
            <span
              class="spinner-grow spinner-grow-md"
              role="status"
              aria-hidden="true"
            ></span>
            <span class="sr-only"> &nbsp; Loading...</span>
          </div>
          Project Data is Loading...
        </div>
      </div>
      <div v-else class="bg-white p-4 rounded shadow-sm mb-4">
        <div class="d-flex justify-content-between align-items-center mb-3">
          <h4 class="fw-bold mb-0">{{ project.name }}</h4>
          <button
            class="btn btn-sm btn-outline-secondary ms-2"
            type="button"
            data-bs-toggle="offcanvas"
            data-bs-target="#offcanvasRight"
            aria-controls="offcanvasRight"
          >
            <i class="fad fa-cogs me-2"></i>
            Settings
          </button>
        </div>

        <div class="row text-muted">
          <div class="col-md-6 mb-2">
            <i class="fad fa-terminal me-2"></i>
            <strong>Path: &nbsp;</strong> {{ project.app_local_path }}
          </div>
          <div class="col-md-6 mb-2">
            <i class="fad fa-code-branch me-2"></i>
            <strong>Git: &nbsp;</strong>
            <a
              :href="project.repository_url"
              target="_blank"
              :title="
                project.repository_url?.length > 35
                  ? project.repository_url
                  : ''
              "
              v-tooltip="
                project.repository_url?.length > 35
                  ? project.repository_url
                  : null
              "
              class="text-decoration-none"
            >
              {{
                project.repository_url?.length > 35
                  ? project.repository_url.slice(0, 35) + "..."
                  : project.repository_url
              }}
            </a>
          </div>
          <div class="col-md-6 mb-2">
            <i class="fad fa-hashtag me-2"></i>
            <strong>HEAD: &nbsp; </strong>
            <span class="badge rounded-pill bg-secondary">{{
              project.current_head
            }}</span>
          </div>
          <div class="col-md-6 mb-2">
            <i class="fad fa-map-marker-alt me-2"></i>
            <strong>TCP Port: &nbsp;</strong> {{ project.tcp_port }}
          </div>
          <div class="col-md-6 mb-2">
            <i class="fad fa-link me-2"></i>
            <strong>Live URL: &nbsp;</strong>
            <a
              :href="project.app_url"
              target="_blank"
              :title="project.app_url?.length > 35 ? project.app_url : ''"
              v-tooltip="project.app_url?.length > 35 ? project.app_url : null"
              class="text-decoration-none"
            >
              {{
                project.app_url?.length > 35
                  ? project.app_url.slice(0, 35) + "..."
                  : project.app_url
              }}
            </a>
          </div>
          <div class="col-md-6 mb-2">
            <i class="fad fa-globe me-2"></i>
            <strong>Status: &nbsp;</strong>

            <span
              :class="['badge', project.status ? 'bg-success' : 'bg-danger']"
              :aria-label="
                project.status ? 'Project is online' : 'Project is offline'
              "
              role="status"
            >
              {{ project.status ? "Online" : "Offline" }}
            </span>
          </div>
        </div>
      </div>

      <!-- Tabs for Activity and Logs -->
      <div class="bg-white p-4 rounded shadow-sm">
        <ul class="nav nav-tabs mb-3">
          <li class="nav-item">
            <a
              class="nav-link cursor-pointer"
              :class="{ active: tab === 'activity' }"
              @click="tab = 'activity'"
              >Activity</a
            >
          </li>
          <li class="nav-item">
            <a
              class="nav-link cursor-pointer"
              :class="{ active: tab === 'logs' }"
              @click="tab = 'logs'"
              >Logs</a
            >
          </li>
        </ul>

        <div
          v-if="projectLogIsLoading && projectActivityIsLoading"
          class="d-flex justify-content-center align-items-center"
        >
          <span class="fetching-log-loader">Fetching Logs</span>
        </div>
        <div v-else>
          <div v-if="tab === 'activity'">
            <ActivityFeed
              :projectId="this.project.id"
              :events="projectDeploymentActivities"
            />
          </div>

          <div v-else>
            <div class="mb-3">
              <label class="fw-bold">Select Log File:</label>
              <select class="form-select mt-3" v-model="selectedLog">
                <option value="" disabled selected>--- Select ---</option>
                <option
                  v-for="log in projectLogPathsObjectifiedArray"
                  :key="log.name"
                  :value="log.path"
                >
                  {{ log.name }}
                </option>
              </select>
            </div>

            <div
              class="log-view bg-dark text-light p-3 rounded"
              style="min-height: 300px; overflow: auto; max-height: 500px"
              ref="logBoxContainer"
              @scroll.passive="handleScroll"
            >
              <div
                v-if="logFileStreams[selectedLog]?.loadingOlder"
                class="loading-older-log-indicator"
              >
                <hr />
                <div style="text-align: center; font-size: 12px; color: gray">
                  Loading older logs...
                </div>
                <hr />
              </div>
              <pre v-if="projectLogIsLoading" class="log-content">
                <code class="language-bash" style="padding: 0 !important; background: none;">[INFO] Fetching log {{ `${selectedLog ? `${selectedLog}...`: "-- Select Log File"}` }}</code>
              </pre>
              <pre v-else class="log-content">
                <code class="language-bash" style="padding: 0 !important; background: none;">
                {{ logFileStreams[selectedLog]?.data.join("\n") }}
                </code>
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Settings Canvas -->
    <div
      class="offcanvas offcanvas-end"
      tabindex="-1"
      id="offcanvasRight"
      aria-labelledby="offcanvasRightLabel"
    >
      <div class="offcanvas-header">
        <h5 style="font-weight: 600" id="offcanvasRightLabel">
          Project Control Center
        </h5>
        <button
          type="button"
          class="btn-close text-reset"
          data-bs-dismiss="offcanvas"
          aria-label="Close"
        ></button>
      </div>

      <div class="offcanvas-body">
        <!-- Dropdown Nav -->
        <div class="mb-3">
          <div class="btn-group w-100">
            <button
              class="fw-normal btn btn-light dropdown-toggle w-50"
              type="button"
              data-bs-toggle="dropdown"
              aria-expanded="false"
            >
              {{ activeSettingsTab }}
            </button>
            <ul class="dropdown-menu w-100">
              <li>
                <a
                  class="dropdown-item"
                  @click="switchSettingsTab('Project Profile')"
                  ><i class="bi bi-person-gear me-2"></i>Project Profile</a
                >
              </li>
              <li>
                <a
                  class="dropdown-item"
                  @click="switchSettingsTab('More Settings')"
                  ><i class="bi bi-gear-wide-connected me-2"></i>More
                  Settings</a
                >
              </li>
            </ul>
          </div>
        </div>

        <!-- Project Profile Tab -->
        <div v-if="activeSettingsTab === 'Project Profile'">
          <div class="mb-3">
            <label for="appUrl" class="form-label">App URL</label>
            <input
              type="url"
              class="form-control"
              v-model="appUrl"
              placeholder="E.g https://your-project.com"
            />
          </div>

          <div class="mb-3">
            <label for="gitUrl" class="form-label">Git URL</label>
            <input
              type="url"
              class="form-control"
              v-model="gitUrl"
              placeholder="E.g https://github.com/your/project.git"
            />
          </div>

          <div class="mb-3">
            <label class="form-label">Log Paths</label>
            <div
              v-for="(log, index) in logPaths"
              :key="index"
              class="input-group mb-2"
            >
              <input
                type="text"
                class="form-control"
                v-model="logPaths[index]"
                placeholder="E.g /var/log/app.log"
              />
              <button
                class="btn btn-outline-danger"
                type="button"
                @click="removeLogPath(index)"
                :disabled="logPaths.length <= 1"
              >
                &times;
              </button>
            </div>
            <button
              class="btn btn-outline-secondary btn-sm"
              @click="addNewLogPath"
              :disabled="logPaths.length >= 3"
            >
              + Add Log Path
            </button>
          </div>

          <div
            v-if="updatingProjectSettings"
            class="mb-2 text-center text-muted"
          >
            <div class="spinner-border spinner-border-md" role="status"></div>
          </div>
          <div v-else class="mb-2">
            <button
              type="button"
              @click="updateProjectProfile"
              class="btn btn-success w-100"
            >
              Save Changes
            </button>
          </div>
        </div>

        <!-- More Settings Tab -->
        <div v-if="activeSettingsTab === 'More Settings'" class="d-grid gap-2">
          <button disabled class="btn btn-outline-danger" @click="killServer">
            Kill Server
          </button>
          <button
            disabled
            class="btn btn-outline-primary"
            @click="redeployServer"
          >
            Redeploy
          </button>
        </div>
      </div>
    </div>
  </section>
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
      activeSettingsTab: "Project Profile",
      gitUrl: "",
      appUrl: "",
      logPaths: [""],
      logFileStreams: {
        // [path]: {
        //   data: [],
        //   lastLineIndex: 0,
        //   scrollToBottom: true
        // }
      },
      logFileStreamPollingInterval: null,
      logFileStreamAtBottom: true,
      selectedLog: null,
      updatingProjectSettings: false,
      tab: "activity",
      projectDataIsLoading: true,
      projectActivityIsLoading: true,
      projectLogIsLoading: true,
      project: {
        name: "",
        app_local_path: "",
        status: "",
        repository_url: "",
        current_head: "",
        tcp_port: "",
        app_url: "",
      },
      projectDeploymentActivities: [],
    };
  },
  computed: {
    projectLogPathsObjectifiedArray() {
      return this.logPaths.map((path) => {
        const segments = path.split("/");
        return {
          name: segments[segments.length - 1],
          path,
        };
      });
    },
  },
  watch: {
    selectedLog(newPath) {
      if (newPath) {
        this.fetchLog(newPath);
        this.startLogStreamPolling();
      }
    },
  },
  mounted() {
    if (this.projectLogPathsObjectifiedArray.length) {
      this.selectedLog = this.projectLogPathsObjectifiedArray[0].name;
    }

    this.getProjectData();
    this.getProjectActivities();

    this.activityInterval = setInterval(() => {
      this.getProjectActivities();
    }, 10000); // 10 seconds
  },
  beforeUnmount() {
    if (this.activityInterval) {
      clearInterval(this.activityInterval);
    }
    clearInterval(this.pollingInterval);
  },
  methods: {
    getProjectData() {
      axios
        .get(
          `${this.$BACKEND_BASE_URL}/project/${this.id}`,
          this.$store.state.headers
        )
        .then((res) => {
          const projectData = res.data.data;
          this.project = projectData;
          this.gitUrl = projectData.repository_url || "";
          this.appUrl = projectData.app_url || "";
          this.logPaths = Array.from(
            new Set(
              [
                projectData.log_file_i_location || "",
                projectData.log_file_ii_location || "",
                projectData.log_file_iii_location || "",
              ].filter(Boolean)
            )
          );
          this.projectDataIsLoading = false;
        });
    },
    getProjectActivities() {
      if (this.tab === "activity") {
        axios
          .get(
            `${this.$BACKEND_BASE_URL}/project/${this.id}/deployment-activities`,
            this.$store.state.headers
          )
          .then((res) => {
            const data = res.data.data;
            this.projectDeploymentActivities = data;
            this.projectActivityIsLoading = false;
          });
      }
    },
    updateProjectProfile() {
      this.updatingProjectSettings = true;
      axios
        .patch(
          `${this.$BACKEND_BASE_URL}/project/${this.id}`,
          {
            git_url: this.gitUrl,
            app_url: this.appUrl,
            log_paths: this.logPaths,
          },
          this.$store.state.headers
        )
        .then((res) => {
          toastr.success(res.data.message);
          this.updatingProjectSettings = false;
          this.getProjectData();
        })
        .catch((err) => {
          console.log(err);
          if (err.response?.data) {
            toastr.error(
              err.response.data.message || "Error processing request"
            );
          } else {
            toastr.error("Error processing request");
          }
          this.updatingProjectSettings = false;
        });
    },
    switchSettingsTab(tab) {
      this.activeSettingsTab = tab;
    },
    addNewLogPath() {
      if (this.logPaths.length < 3) {
        this.logPaths.push("");
      }
    },
    removeLogPath(index) {
      if (this.logPaths.length > 1) {
        this.logPaths.splice(index, 1);
      }
    },
    fetchLog(path) {
      if (this.logFileStreams[path]) {
        Vue.nextTick(() => {
          this.scrollLogFileStreamContainerToBottom();
          this.updateHighlight();
        });
      } else {
        this.fetchInitialLogs(path);
      }
    },
    async fetchInitialLogs(path) {
      axios
        .get(
          `${this.$BACKEND_BASE_URL}/stream-log-file?path=${encodeURIComponent(
            path
          )}&fromLine=-1`,
          this.$store.state.headers
        )
        .then((res) => {
          const data = res.data.data;
          this.logFileStreams[path] = {
            data: data.lines,
            lastLineIndex: data.nextLineIndex,
          };

          this.projectLogIsLoading = false;

          Vue.nextTick(() => {
            this.scrollLogFileStreamContainerToBottom();
            this.updateHighlight();
          });
        })
        .catch((err) => {
          toastr.error(
            err.response?.data?.message || "Failed to fetch initial logs"
          );
          console.error("Failed to fetch initial logs:", err);
        });
    },
    async fetchNewLogs(path) {
      if (this.tab === "logs") {
        if (!this.logFileStreams[path]) return;

        const stream = this.logFileStreams[path];

        axios
          .get(
            `${
              this.$BACKEND_BASE_URL
            }/stream-log-file?path=${encodeURIComponent(path)}&fromLine=${
              stream.lastLineIndex
            }`,
            this.$store.state.headers
          )
          .then((res) => {
            const data = res.data.data;
            if (data.lines.length > 0) {
              stream.data.push(...data.lines);
              stream.lastLineIndex = data.nextLineIndex;

              // Keep recent N lines (optional memory cap)
              stream.data = stream.data.slice(-10000);

              if (this.atBottom && path === this.selectedLog) {
                Vue.nextTick(() => this.scrollLogFileStreamContainerToBottom());
              }
              this.updateHighlight();
            }
          })
          .catch((err) => {
            toastr.error(err.response?.data?.message || "Polling failed");
            console.error("Polling failed:", err);
          });
      }
    },
    async fetchOlderLogs(path) {
      const stream = this.logFileStreams[path];
      if (
        !stream ||
        stream.loadingOlder ||
        stream.data.length >= stream.totalLines
      )
        return;

      stream.loadingOlder = true;

      const from = Math.max(
        stream.lastLineIndex - stream.data.length - 1000,
        0
      );
      const limit = 1000;

      // Preserve scroll height before update
      const container = this.$refs.logBoxContainer;
      const beforeHeight = container.scrollHeight;

      axios
        .get(
          `${this.$BACKEND_BASE_URL}/stream-log-file?path=${encodeURIComponent(
            path
          )}&fromLine=${from}&limit=${limit}`,
          this.$store.state.headers
        )
        .then((res) => {
          const data = res.data.data;
          if (data.lines.length > 0) {
            stream.data = [...data.lines, ...stream.data];
            stream.loadingOlder = false;
            //stream.data = stream.data.slice(-10000);

            Vue.nextTick(() => {
              // Adjust scroll position to maintain view after prepending
              const afterHeight = container.scrollHeight;
              container.scrollTop = afterHeight - beforeHeight;
            });
            this.updateHighlight();
          }
        })
        .catch((err) => {
          toastr.error(
            err.response?.data?.message || "Older logs fetch failed"
          );
          console.error("Older logs fetch failed:", err);
        });
    },
    startLogStreamPolling() {
      this.pollingInterval = setInterval(() => {
        if (this.selectedLog) {
          const container = this.$refs.logBoxContainer;
          const isAtBottom =
            container.scrollTop + container.clientHeight >=
            container.scrollHeight - 50; // 50px THRESHHOLD

          if (!isAtBottom) {
            return; // Do not poll new log if user has scrolled up
          }
          this.fetchNewLogs(this.selectedLog);
        }
      }, 3000);
    },

    scrollLogFileStreamContainerToBottom() {
      const container = this.$refs.logBoxContainer;
      if (container) {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: "smooth",
        });
        this.atBottom = true;
      }
    },

    handleScroll() {
      const el = this.$refs.logBoxContainer;
      if (!el) return;

      if (el.scrollTop < 30 && this.selectedLog) {
        this.fetchOlderLogs(this.selectedLog);
      }

      const nearBottom =
        Math.abs(el.scrollHeight - el.scrollTop - el.clientHeight) < 10;
      this.atBottom = nearBottom;
    },
    updateHighlight() {
      document.querySelectorAll("[data-highlighted]").forEach((el) => {
        delete el.dataset.highlighted;
      });
      hljs.highlightAll();
    },
    killServer() {
      if (confirm("Are you sure you want to kill the server?")) {
        alert("Server killed (mock action).");
      }
    },
    redeployServer() {
      if (confirm("Redeploy the server now?")) {
        alert("Redeploy started (mock action).");
      }
    },
  },
};
</script>

<style scoped>
.log-content {
  display: flex;
  overflow-y: auto;
  white-space: pre-wrap;
  font-family: monospace;
  font-size: 0.875rem;
}

.loading-older-log-indicator {
  padding: 6px;
  background-color: #f9f9f9;
}

.cursor-pointer {
  cursor: pointer;
}

.form-label {
  font-weight: 500;
}

.log-view {
  font-family: monospace;
  font-size: 0.875rem;
}

.fetching-log-loader {
  font-size: 35px;
  display: inline-block;
  font-weight: 400;
  position: relative;
}

.fetching-log-loader:after {
  content: "";
  height: 4px;
  width: 0%;
  display: block;
  background: #ff3d00;
  animation: lineGrow 5s linear infinite;
}

@keyframes lineGrow {
  0% {
    width: 0%;
    background-color: #ff3d00;
  }
  100% {
    width: 100%;
    background-color: grey;
    /* background-color: #198754; */
  }
}
</style>
