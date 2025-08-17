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

.redis-loader--container {
  width: 100%;
  height: 200px;
  background: #d5d4d49e;
  justify-content: center;
  display: flex;
  align-items: center;
  border-radius: 15px;
  flex-direction: column;
  gap: 5px;
}
.redis-loader {
  position: relative;
  width: 48px;
  height: 48px;
  background: #de3500;
  transform: rotateX(65deg) rotate(45deg);
  /** transform: perspective(200px) rotateX(65deg) rotate(45deg); **/
  color: #fff;
  animation: layers1 1s linear infinite alternate;
}
.redis-loader:after {
  content: "";
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.7);
  animation: layerTr 0.7s linear infinite alternate;
}

@keyframes layers1 {
  0% {
    box-shadow: 0px 0px 0 0px;
  }
  90%,
  100% {
    box-shadow: 20px 20px 0 -4px;
  }
}
@keyframes layerTr {
  0% {
    transform: translate(0, 0) scale(1);
  }
  100% {
    transform: translate(-25px, -25px) scale(1);
  }
}
</style>

<template>
  <main class="flex-grow-1 overflow-auto mt-4 container">
    <div v-if="!redisAvailable" class="alert alert-danger p-2">
      <strong>Redis is not currently installed on this VPS.</strong> <br />
      You can use the floating shell icon on your Deployster Dashboard to
      install it manually. <br />
      <br />
      For guidance, refer to the official
      <a
        href="https://redis.io/docs/latest/operate/oss_and_stack/install/archive/install-redis/install-redis-on-linux/"
        target="_blank"
      >
        Redis installation documentation for Linux </a
      >.
    </div>
    <div class="row g-3 mb-4">
      <div v-if="defaultServer?.port" class="col-12 col-md-6 col-lg-5">
        <div class="bg-white p-4 rounded shadow d-flex align-items-center">
          <div class="bg-success bg-opacity-25 p-3 rounded-circle me-3">
            <i
              v-if="defaultServer?.portIsActive"
              class="fad fa-signal-stream p-1 fa-lg"
            ></i>
            <i v-else class="fad fa-signal-slash p-1 fa-lg"></i>
          </div>
          <div>
            <h6 class="text-muted mb-0">
              Default Instance ({{ defaultServer?.port || "N?A" }})
            </h6>
            <p class="fs-4 fw-bold text-success mb-0">Online</p>
          </div>
        </div>
      </div>
      <div v-else class="d-flex justify-content-center py-2">
        <div class="spinner-grow text-danger" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
      </div>
    </div>

    <div class="d-flex justify-content-between align-items-center mb-4">
      <h2 class="h4 fw-bold text-dark mb-0">Manage Instances</h2>
      <button
        :disabled="serverOverviewDataIsLoading && !redisAvailable"
        class="btn btn-primary d-flex align-items-center shadow"
        data-bs-toggle="modal"
        data-bs-target="#newRedisServerModal"
      >
        <i class="fad fa-plus-circle mx-2"></i>
        New Instance
      </button>
    </div>

    <div
      v-if="!serverOverviewDataIsLoading"
      class="bg-white rounded shadow mb-4 overflow-auto"
    >
      <table class="table table-striped table-hover mb-0">
        <thead class="table-light">
          <tr>
            <th>Instance Name</th>
            <th>Port</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="server in allServers" :key="server.id">
            <td>{{ server.name }}</td>
            <td>{{ server.port }}</td>
            <td>
              <span
                v-if="server.portIsActive"
                class="badge bg-success bg-opacity-25 text-success"
                >Online</span
              >
              <span v-else class="badge bg-danger bg-opacity-25 text-danger"
                >Offline</span
              >
            </td>
            <td>
              <button
                class="btn btn-link text-primary p-0 me-1"
                @click.prevent="openRedisModal(server)"
              >
                Details
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-else class="redis-loader--container">
      <div class="redis-loader"></div>
      <div>Loading Instances...</div>
    </div>

    <section v-if="!serverOverviewDataIsLoading">
      <div class="d-flex gap-2 align-items-center mb-4">
        <h2 class="h4 fw-bold text-dark d-flex align-items-center mb-0">
          <i class="bi bi-window-desktop me-2"></i>
          Instance Logs:
        </h2>
        <div class="mb-3">
          <select class="border-3 form-select mt-3" v-model="selectedLog">
            <option value="" disabled selected>--- Select ---</option>
            <option
              v-for="server in allServers"
              :key="server.id"
              :value="server.logPath"
            >
              {{ server.name }}
            </option>
          </select>
        </div>
      </div>

      <div
        class="bg-dark text-white rounded shadow p-4 font-monospace small"
        style="height: 24rem; overflow-y: auto"
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
        <pre v-if="redisLogIsLoading" class="log-content">
                <code class="language-bash" style="padding: 0 !important; background: none;">[INFO] Fetching log {{ `${selectedLog ? `${selectedLog}...`: "-- Select Log File"}` }}</code>
              </pre>
        <pre v-else class="log-content">
                <code class="language-bash" style="padding: 0 !important; background: none;">
                {{ logFileStreams[selectedLog]?.data.join("\n") }}
                </code>
              </pre>
      </div>
    </section>

    <!-- Create New Redis server Modal -->
    <div
      class="modal fade"
      id="newRedisServerModal"
      tabindex="-1"
      aria-labelledby="newRedisServerModalLabel"
      aria-hidden="true"
    >
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="newRedisServerModalLabel">
              <img
                src="https://www.svgrepo.com/show/303460/redis-logo.svg"
                style="object-fit: contain; width: 40px; height: 50px"
              />
              Create New Redis Instance
            </h5>
            <button
              type="button"
              class="btn-close"
              data-bs-dismiss="modal"
              aria-label="Close"
            ></button>
          </div>
          <div class="modal-body">
            <form
              ref="newInstanceForm"
              @submit.prevent="createNewInstanceSubmitFunction"
            >
              <div class="mt-3">
                <label class="fw-bold my-1">Name</label>
                <input
                  required
                  v-model="newInstanceName"
                  class="form-control"
                  placeholder="Enter Instance Name"
                />
              </div>
              <div class="mt-3">
                <label class="fw-bold my-1">Port Number</label>
                <input
                  required
                  v-model="newInstancePortNo"
                  class="form-control"
                  placeholder="E.g 6379"
                />
              </div>
              <div class="mt-3">
                <label class="fw-bold my-1">Description</label>
                <textarea
                  required
                  class="form-control"
                  v-model="newInstanceDescription"
                ></textarea>
              </div>
              <div class="w-100 mt-3 d-flex justify-content-center">
                <button
                  v-if="!newInstanceCreationIsProcessing"
                  type="submit"
                  class="btn btn-success w-100"
                >
                  Create
                </button>
                <div v-else class="spinner-border text-secondary" role="status">
                  <span class="visually-hidden">Loading...</span>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
    <!---->

    <!-- View Insance Modal -->
    <div
      class="modal fade"
      id="viewRedisServerModal"
      ref="viewRedisServerModal"
      tabindex="-1"
      aria-labelledby="viewRedisServerModalLabel"
      aria-hidden="true"
    >
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="viewRedisServerModalLabel">
              <img
                src="https://www.svgrepo.com/show/303460/redis-logo.svg"
                style="object-fit: contain; width: 40px; height: 50px"
              />
              Redis Instance Profile
            </h5>
            <button
              type="button"
              class="btn-close"
              data-bs-dismiss="modal"
              aria-label="Close"
            ></button>
          </div>
          <div class="modal-body">
            <table class="table table-bordered table-striped">
              <tbody>
                <tr>
                  <td class="fw-bold">Name:</td>
                  <td>{{ redisInstanceInView.name }}</td>
                </tr>

                <tr>
                  <td class="fw-bold">Port No:</td>
                  <td>{{ redisInstanceInView.port }}</td>
                </tr>

                <tr>
                  <td class="fw-bold">Description:</td>
                  <td>{{ redisInstanceInView.metadata }}</td>
                </tr>

                <tr>
                  <td class="fw-bold">Status:</td>
                  <td>
                    <span
                      v-if="redisInstanceInView.portIsActive"
                      class="badge bg-success bg-opacity-25 text-success"
                      >Online</span
                    >
                    <span
                      v-else
                      class="badge bg-danger bg-opacity-25 text-danger"
                      >Offline</span
                    >
                  </td>
                </tr>
                <tr>
                  <td class="fw-bold">URI:</td>
                  <td class="d-flex flex-row align-items-center">
                    <input
                      :value="redisInstanceInView.uri"
                      disabled
                      class="form-control border-0 me-2"
                    />
                    <span
                      class="badge pill bg-primary"
                      style="cursor: pointer"
                      @click="copyTextToClipboard(redisInstanceInView.uri)"
                      ><i class="bi bi-copy me-2"></i>Copy</span
                    >
                  </td>
                </tr>
              </tbody>
            </table>

            <div
              v-if="!redisAdminActionIsProcessing"
              class="mt-3 mb-3 d-flex justify-content-center"
            >
              <button
                type="button"
                class="btn btn-outline-danger me-2"
                @click="killRedisInstance()"
              >
                Kill Instance
              </button>
              <button
                type="button"
                class="btn btn-primary"
                @click="redeployRedisInstance()"
              >
                Restart
              </button>
            </div>

            <div v-else class="mt-3 mb-3 d-flex justify-content-center">
              <div class="spinner-border text-secondary" role="status">
                <span class="visually-hidden">Loading...</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>

<script>
export default {
  name: "RedisDashboard",
  components: {},
  data() {
    return {
      newInstanceName: "",
      newInstancePortNo: "",
      newInstanceDescription: "",
      newInstanceCreationIsProcessing: false,
      redisAvailable: true,
      defaultServer: {},
      allServers: [],
      serverOverviewDataIsLoading: true,
      redisInstanceInView: {},
      redisAdminActionIsProcessing: false,
      selectedLog: "",
      logFileStreams: {
        // [path]: {
        //   data: [],
        //   lastLineIndex: 0,
        //   scrollToBottom: true
        // }
      },
      logFileStreamPollingInterval: null,
      redisLogIsLoading: true,
    };
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
    this.getRedisOverview();
  },
  beforeUnmount() {
    clearInterval(this.logFileStreamPollingInterval);
  },
  methods: {
    getRedisOverview() {
      axios
        .get(
          `${this.$BACKEND_BASE_URL}/redis/get-overview`,
          this.$store.state.headers
        )
        .then((res) => {
          const resData = res.data.data;
          this.allServers = resData.servers;
          this.redisAvailable = resData.redisAvailable;
          this.defaultServer = resData.servers.find(
            (data) => data.port == 6379
          );
          this.serverOverviewDataIsLoading = false;
        });
    },
    createNewInstanceSubmitFunction() {
      this.newInstanceCreationIsProcessing = true;
      axios
        .post(
          `${this.$BACKEND_BASE_URL}/redis/create-instance`,
          {
            name: this.newInstanceName,
            port: this.newInstancePortNo,
            description: this.newInstanceDescription,
          },
          this.$store.state.headers
        )
        .then((res) => {
          toastr.success(res.data.message);
          this.$refs.newInstanceForm.reset();
          this.getRedisOverview();
        })
        .catch((err) => {
          console.log(err);
          if (err.response?.data) {
            toastr.error(
              err.response.data?.message || "Error processing request"
            );
          } else {
            toastr.error("Error processing request");
          }
        })
        .finally(() => {
          this.newInstanceCreationIsProcessing = false;
        });
    },
    openRedisModal(data) {
      this.redisInstanceInView = data;
      this.openedRedisModalInstance = new bootstrap.Modal(
        this.$refs.viewRedisServerModal
      );

      this.openedRedisModalInstance.show();
    },
    redeployRedisInstance() {
      this.redisAdminActionIsProcessing = true;
      axios
        .post(
          `${this.$BACKEND_BASE_URL}/redis/instance/${this.redisInstanceInView.id}`,
          {
            action: "redeploy",
          },
          this.$store.state.headers
        )
        .then((res) => {
          this.redisInstanceInView.portIsActive = true;
          toastr.success(res.data.message);
          this.getRedisOverview();
        })
        .catch((err) => {
          console.log(err);
          if (err.response?.data) {
            toastr.error(
              err.response.data?.message || "Error processing request"
            );
          } else {
            toastr.error("Error processing request");
          }
        })
        .finally(() => {
          this.redisAdminActionIsProcessing = false;
        });
    },
    killRedisInstance() {
      this.redisAdminActionIsProcessing = true;
      axios
        .post(
          `${this.$BACKEND_BASE_URL}/redis/instance/${this.redisInstanceInView.id}`,
          {
            action: "kill",
          },
          this.$store.state.headers
        )
        .then((res) => {
          this.redisInstanceInView.portIsActive = false;
          toastr.success(res.data.message);
          this.getRedisOverview();
        })
        .catch((err) => {
          console.log(err);
          if (err.response?.data) {
            toastr.error(
              err.response.data?.message || "Error processing request"
            );
          } else {
            toastr.error("Error processing request");
          }
        })
        .finally(() => {
          this.redisAdminActionIsProcessing = false;
        });
    },
    copyTextToClipboard(text) {
      navigator.clipboard.writeText(text);
      toastr.success("Redis URI copied to Clipboard");
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

          this.redisLogIsLoading = false;

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
      if (!this.logFileStreams[path]) return;

      const stream = this.logFileStreams[path];

      axios
        .get(
          `${this.$BACKEND_BASE_URL}/stream-log-file?path=${encodeURIComponent(
            path
          )}&fromLine=${stream.lastLineIndex}`,
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
      this.logFileStreamPollingInterval = setInterval(() => {
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
  },
};
</script>
