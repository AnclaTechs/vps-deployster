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
        </div>
        <div v-if="!pipelineModeIsActive" class="row text-muted">
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

      <!--Pipelines-->
      <PipelineList
        :pipelines="this.pipelines"
        :fetchPipelines="this.fetchProjectPipelines"
        :selectedPipelineStage="this.selectedPipelineStage"
        :selectPipelineStage="this.selectPipelineStage"
        :saveChangesToSelectedPipeline="this.saveChangesToSelectedPipeline"
        :createOrSaveNewPipelineToProject="
          this.createOrSaveNewPipelineToProject
        "
        :deleteProjectPipelineStage="deleteProjectPipelineStage"
      />
      <!---->

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
              :getPipelineNameFromUUID="getPipelineNameFromUUID"
              :selectedPipelineStage="selectedPipelineStage"
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
        <!--Pipeline In View-->
        <div
          class="d-flex my-3 flex-row align-items-center rounded"
          style="border: 1px solid gray; font-weight: 500"
        >
          <div style="padding: 5px">Pipeline Stage:</div>
          <div
            style="
              padding: 5px;
              background: gray;
              flex: 1;
              margin-left: 5px;
              color: #f2f2f2;
            "
          >
            {{ selectedPipelineStage?.stage_name || "General" }}
          </div>
        </div>
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
            <ul class="dropdown-menu w-100" style="cursor: pointer">
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
              :disabled="selectedPipelineStage"
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
          <div
            v-if="project.deployster_conf?.status"
            class="alert alert-primary"
          >
            <i class="bi bi-check-circle-fill me-2"></i> Supervisor
            <span class="commit-hash">deployster.conf</span> is setup.
          </div>
          <div v-else class="alert alert-danger">
            <i class="bi bi-exclamation-octagon-fill me-2"></i>
            {{ project.deployster_conf?.message }}
          </div>

          <div
            v-if="
              !pipelineModeIsActive ||
              (pipelineModeIsActive && selectedPipelineStage)
            "
          >
            <div
              v-if="deploysterServerServiceInProgress"
              class="d-flex flex-column justify-content-center align-items-center"
            >
              <div class="spinner-grow" role="status">
                <span class="visually-hidden">Loading...</span>
              </div>

              <small>Initiating command...</small>
            </div>
            <div v-else class="d-flex gap-3 flex-column">
              <button
                :disabled="!project.deployster_conf?.status"
                class="btn btn-outline-danger"
                style="font-weight: 600"
                @click="killServer"
              >
                Kill Server
              </button>
              <button
                :disabled="!project.deployster_conf?.status"
                class="btn btn-outline-primary"
                @click="redeployServer"
              >
                Redeploy
              </button>
            </div>
          </div>
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
    PipelineList: defineAsyncComponent(() =>
      loadModule(
        "/vue/components/pipeline/PipelineList.vue",
        window.$httpLoaderOption
      )
    ),
    HeaderX: defineAsyncComponent(() =>
      loadModule("/vue/components/Header.vue", window.$httpLoaderOption)
    ),
  },
  data() {
    return {
      pipelines: null,
      selectedPipelineStage: null,
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
        deployster_conf: {},
      },
      projectDeploymentActivities: [],
      deploysterServerServiceInProgress: false,
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
    pipelineModeIsActive() {
      return this.pipelines?.length || 0 > 0;
    },
  },
  watch: {
    selectedLog(newPath) {
      if (newPath) {
        this.fetchLog(newPath);
        this.startLogStreamPolling();
      }
    },

    selectedPipelineStage(newPipelineStageObject) {
      if (this.pipelineModeIsActive && newPipelineStageObject) {
        this.appUrl = newPipelineStageObject.app_url || "";
        this.gitUrl = this.project.repository_url || "";
        this.logPaths = Array.from(
          new Set(
            [
              newPipelineStageObject.log_file_i_location || "",
              newPipelineStageObject.log_file_ii_location || "",
              newPipelineStageObject.log_file_iii_location || "",
            ].filter(Boolean)
          )
        );
      } else {
        this.gitUrl = this.project.repository_url || "";
        this.appUrl = this.project.app_url || "";
        this.logPaths = Array.from(
          new Set(
            [
              this.project.log_file_i_location || "",
              this.project.log_file_ii_location || "",
              this.project.log_file_iii_location || "",
            ].filter(Boolean)
          )
        );
      }

      this.tab = "activity";
      this.projectActivityIsLoading = true;
      this.getProjectActivities();
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
          if (!this.selectedPipelineStage) {
            // i.e Only Update Generic Data directly when NO pipeline is selected
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
          }
          this.projectDataIsLoading = false;
        });
    },
    getProjectActivities() {
      if (this.tab === "activity") {
        axios
          .get(
            this.selectedPipelineStage
              ? `${this.$BACKEND_BASE_URL}/project/${this.id}/deployment-activities?pipelineStage=${this.selectedPipelineStage?.stage_uuid}`
              : `${this.$BACKEND_BASE_URL}/project/${this.id}/deployment-activities`,
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
          this.selectedPipelineStage
            ? `${this.$BACKEND_BASE_URL}/project/${this.id}?pipelineStage=${this.selectedPipelineStage?.stage_uuid}`
            : `${this.$BACKEND_BASE_URL}/project/${this.id}`,
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
          if (this.pipelineModeIsActive) {
            this.fetchProjectPipelines();
          }
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
          let isAtBottom;
          if (container) {
            isAtBottom =
              container.scrollTop + container.clientHeight >=
              container.scrollHeight - 50; // 50px THRESHHOLD
          }

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
        this.initiateDeploysterServerActivity("kill");
      }
    },
    redeployServer() {
      if (confirm("Redeploy the server now?")) {
        this.initiateDeploysterServerActivity("redeploy");
      }
    },
    initiateDeploysterServerActivity(action) {
      this.deploysterServerServiceInProgress = true;

      axios
        .post(
          `${this.$BACKEND_BASE_URL}/server-action`,
          { project_id: this.project.id, action },
          this.$store.state.headers
        )
        .then((res) => {
          toastr.success(res.data.message);
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
        })
        .finally(() => {
          this.deploysterServerServiceInProgress = false;
        });
    },
    fetchProjectPipelines() {
      axios
        .get(
          `${this.$BACKEND_BASE_URL}/project/${this.id}/pipe-line-json`,
          this.$store.state.headers
        )
        .then((res) => {
          this.pipelines = res.data.data || [];
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
        });
    },
    selectPipelineStage(stageId) {
      if (stageId) {
        if (this.selectedPipelineStage?.stage_uuid === stageId) {
          this.selectedPipelineStage = null;
        } else {
          this.selectedPipelineStage = this.pipelines.find(
            (data) => data.stage_uuid == stageId
          );
        }
      } else {
        this.selectedPipelineStage = null;
      }
    },
    saveChangesToSelectedPipeline(stageUUID, data) {
      return axios
        .post(
          `${this.$BACKEND_BASE_URL}/project/update-pipeline-json`,
          {
            project_id: this.project.id,
            stage_uuid: stageUUID,
            data: data,
          },
          this.$store.state.headers
        )
        .then((res) => {
          return true;
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
          return false;
        });
    },
    createOrSaveNewPipelineToProject(data) {
      return axios
        .post(
          `${this.$BACKEND_BASE_URL}/project/add-pipeline-json`,
          {
            project_id: this.project.id,
            data: data,
          },
          this.$store.state.headers
        )
        .then((res) => {
          return true;
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
          return false;
        });
    },
    deleteProjectPipelineStage(stageUUID) {
      return axios
        .post(
          `${this.$BACKEND_BASE_URL}/project/delete-pipeline-json`,
          {
            project_id: this.project.id,
            stage_uuid: stageUUID,
          },
          this.$store.state.headers
        )
        .then((res) => {
          return true;
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
          return false;
        });
    },
    getPipelineNameFromUUID(stageUUID) {
      if (this.pipelineModeIsActive && Array.isArray(this.pipelines)) {
        const pipelineInView = this.pipelines.find(
          (data) => data.stage_uuid == stageUUID
        );
        if (pipelineInView) {
          return pipelineInView.git_branch;
        } else {
          return null;
        }
      }
      return null;
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
