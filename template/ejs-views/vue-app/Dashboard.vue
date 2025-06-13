<template>
  <div class="admin-container">
    <!-- Main Content -->
    <main class="content">
      <headerx></headerx>
      <div class="mt-4 container">
        <div class="row col gap-3">
          <div class="col-sm-12 col-md-5 card card-body rounded">
            <div class="d-flex flex-row gap-3 align-items-center">
              <div class="dashboard-analytics-icon-container">
                <i class="fad fa-window fa-lg"></i>
              </div>
              <div
                class="d-flex flex-column justify-content-center align-items-center gap-2"
                style="flex-basis: 50%"
              >
                <strong class="text-muted">Total Projects</strong>
                <div
                  v-if="dashboardDataIsLoading"
                  class="spinner-grow"
                  role="status"
                >
                  <span class="visually-hidden">Loading...</span>
                </div>
                <h3 v-else>{{ dashboardData.count }}</h3>
              </div>
            </div>
          </div>

          <div class="col-sm-12 col-md-5 card card-body rounded">
            <div class="d-flex flex-row gap-3 align-items-center">
              <div
                class="dashboard-analytics-icon-container"
                style="background-color: rgb(201 143 60)"
              >
                <i class="fad fa-clock fa-lg"></i>
              </div>
              <div
                class="d-flex flex-column justify-content-center align-items-center gap-2"
                style="flex-basis: 50%"
              >
                <strong class="text-muted">Last Deployment</strong>
                <div
                  v-if="dashboardDataIsLoading"
                  class="spinner-grow"
                  role="status"
                >
                  <span class="visually-hidden">Loading...</span>
                </div>
                <h6 v-else>{{ dashboardData.lastDeployment }}</h6>
              </div>
            </div>
          </div>
        </div>

        <section class="mt-5">
          <h3 class="fw-bold text-muted mb-4">Projects</h3>

          <div v-if="dashboardDataIsLoading">
            <span class="project-loader"></span>
            <span class="project-loader mt-4"></span>
          </div>
          <div v-else>
            <div
              v-if="dashboardData.data.length == 0"
              class="d-flex flex-column justify-content-center align-items-center"
            >
              <h3 class="fw-bold text-muted mt-4">No Project Yet</h3>

              <span class="fw-light mb-3">Create New Project</span>

              <a
                href="https://github.com/AnclaTechs/vps-deployster"
                target="_blank"
                >📘 View Documentation</a
              >
            </div>
            <div class="v-else">
              <article
                v-for="project in dashboardData?.data"
                :key="project.id"
                class="card shadow-sm border-0 mb-3"
              >
                <div class="card-body fs-6">
                  <div class="mb-2">
                    <i class="fad fa-terminal me-2 text-secondary"></i>
                    <span class="fw-semibold text-dark">{{
                      project.app_local_path
                    }}</span>
                  </div>

                  <div class="mb-2">
                    <i class="fad fa-map-marker me-2 text-secondary"></i>
                    <span class="text-dark"
                      >TCP Port: {{ project.tcp_port }}</span
                    >
                  </div>

                  <div class="mb-2">
                    <i class="fad fa-globe me-2 text-secondary"></i>
                    <span class="text-dark"
                      >Status:
                      <span class="text-success fw-semibold">{{
                        project.status
                      }}</span></span
                    >
                  </div>

                  <div class="mb-3">
                    <i class="fad fa-link me-2 text-secondary"></i>
                    <span class="text-dark"
                      >App Link:
                      <a href="http://velt.energy" target="_blank">{{
                        project.app_url
                      }}</a></span
                    >
                  </div>

                  <router-link
                    class="btn btn-primary btn-sm"
                    :to="{ name: 'ProjectView', params: { id: project.id } }"
                  >
                    Go to Project
                  </router-link>
                </div>
              </article>
            </div>
          </div>
        </section>
      </div>
    </main>
    <!--Floating Icon-->
    <button
      class="floating-icon"
      type="button"
      data-bs-toggle="offcanvas"
      data-bs-target="#bashInterface"
      aria-controls="bashInterface"
    >
      <i class="gw-bolder fad fa-terminal fa-md"></i>
    </button>
    <!--Bash Interface-->
    <div
      class="offcanvas offcanvas-bottom"
      tabindex="-1"
      id="bashInterface"
      aria-labelledby="bashInterfaceLabel"
      :style="{ height: terminalActive ? '55vh' : '75vh' }"
    >
      <div class="offcanvas-header">
        <h5 class="offcanvas-title" id="bashInterfaceLabel">
          <i class="gw-bolder fad fa-terminal me-2"></i> Bash Terminal
        </h5>
        <button
          type="button"
          class="btn-close text-reset"
          data-bs-dismiss="offcanvas"
          aria-label="Close"
        ></button>
      </div>
      <div class="offcanvas-body small">
        <div ref="terminalContainer" class="">
          <div class="my-2 container" v-if="!terminalActive">
            <span>Setting up Terminal...</span>

            <form
              @submit.prevent="bashLogin"
              class="p-3 border rounded mt-2 bg-light"
            >
              <div class="">
                <label class="form-label fw-bold">Remote Username</label>
                <div class="alert alert-info">
                  Enter your <strong>specific remote username</strong> (the name
                  of your home directory on the VPS). <br /><strong
                    >Note:</strong
                  >
                  Logging in as <code>root</code> is not allowed for security
                  reasons.
                </div>
                <input
                  v-model="bashUsername"
                  placeholder="e.g. olaronke-alice"
                  class="form-control"
                  required
                />
              </div>

              <div class="mt-4">
                <label class="form-label fw-bold">Deployster Password</label>
                <div class="alert alert-info">
                  Enter your <strong>Deployster password</strong>. <br />This is
                  used to re-authenticate your GUI access. This is
                  <strong>not</strong> your VPS system password.
                </div>
                <input
                  v-model="bashVPSpassword"
                  type="password"
                  placeholder="Password"
                  class="form-control"
                  required
                />
              </div>

              <button
                :disabled="deploysterGUIverificationInProgress"
                type="submit"
                class="mt-4 btn btn-danger w-100"
              >
                <div
                  v-if="deploysterGUIverificationInProgress"
                  class="spinner-border spinner-border-sm"
                  aria-hidden="true"
                ></div>
                <span v-else>Verify</span>
              </button>

              <small class="d-block mt-3 text-muted">
                <strong>Why is this required?</strong><br />
                Without authentication, anyone accessing this interface could
                open a live shell session to your server — posing a serious
                security risk.
              </small>
            </form>
          </div>
        </div>
      </div>
    </div>
    <!--End Bash-->
  </div>
</template>

<style scoped>
body {
  background: #ffffff !important;
}

.project-loader {
  width: 360px;
  height: 100px;
  display: block;
  position: relative;
  background-image: linear-gradient(
      95deg,
      transparent,
      rgba(38, 50, 56, 0.3) 50%,
      transparent 80%
    ),
    linear-gradient(#e0e0e0 20px, transparent 0),
    linear-gradient(#e0e0e0 20px, transparent 0),
    linear-gradient(#e0e0e0 20px, transparent 0);
  background-repeat: no-repeat;
  background-size: 75px 100px, 125px 20px, 260px 20px, 260px 20px;
  background-position: 0% 0, 120px 0, 120px 40px, 120px 80px;
  box-sizing: border-box;
  animation: animloader 1s linear infinite;
}
.project-loader::after {
  content: "";
  box-sizing: border-box;
  width: 100px;
  height: 100px;
  border-radius: 8px;
  background: #e0e0e0;
  position: absolute;
  top: 0;
  left: 0;
}

@keyframes animloader {
  0% {
    background-position: 0% 0, 120px 0, 120px 40px, 120px 80px;
  }
  100% {
    background-position: 100% 0, 120px 0, 120px 40px, 120px 80px;
  }
}

.dashboard-analytics-icon-container {
  width: 60px;
  height: 60px;
  background-color: #266cdc69;
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
}

.offcanvas-bottom {
  height: 55vh;
}

.floating-icon {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 50px;
  height: 50px;
  background-color: #007bffa8;
  border: 0;
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  cursor: pointer;
  /* transition: transform 0.3s ease; */
  animation: heartbeat 1.5s ease-in-out infinite;
}

/* .floating-icon:hover {
  transform: scale(1.1);
} */

@keyframes heartbeat {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
  100% {
    transform: scale(1);
  }
}
</style>

<script>
const { defineAsyncComponent } = Vue;
const { loadModule } = window["vue3-sfc-loader"];

module.exports = {
  components: {
    headerx: defineAsyncComponent(() =>
      loadModule("/vue/components/Header.vue", window.$httpLoaderOption)
    ),
  },
  data: function () {
    return {
      socket: null,
      terminal: null,
      terminalActive: false,
      bashUsername: "",
      bashVPSpassword: "",
      dashboardDataIsLoading: true,
      dashboardData: {
        count: "N?A",
        lastDeployment: "N?A",
        data: [],
      },
      deploysterGUIverificationInProgress: false,
    };
  },
  watch: {},
  methods: {
    getAnalytics() {
      axios
        .get(`${this.$BACKEND_BASE_URL}/projects`, this.$store.state.headers)
        .then((res) => {
          this.dashboardData = res.data;
          this.dashboardDataIsLoading = false;
        });
    },
    bashLogin() {
      this.deploysterGUIverificationInProgress = true;
      axios
        .post(
          `${this.$BACKEND_BASE_URL}/verify-bash-access`,
          {
            system_username: this.bashUsername,
            deployster_password: this.bashVPSpassword,
          },
          this.$store.state.headers
        )
        .then((res) => {
          this.initTerminal();
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
          this.deploysterGUIverificationInProgress = false;
        });
    },
    async initTerminal() {
      if (!this.terminal) {
        this.terminal = new Terminal({
          cursorBlink: true,
          fontFamily: "monospace",
          fontSize: 14,
        });

        this.socket = new WebSocket(
          `ws://${new URL(this.$BACKEND_BASE_URL).host}/ws/terminal?token=${
            this.$store.state.headers.headers.Authorization
          }&username=${String(this.bashUsername).toLocaleLowerCase()}`
        );

        this.socket.onmessage = (event) => {
          this.terminal.write(event.data);
        };

        this.terminal.onData((data) => {
          this.socket.send(data);
        });

        await Vue.nextTick();
        this.terminal.open(this.$refs.terminalContainer);
        this.terminal.focus();
        this.terminalActive = true;
      } else {
        console.error("Terminal container not found");
      }
    },
    resetTerminalSession() {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.close();
        this.socket = null;
      }

      if (this.terminal) {
        this.terminal.dispose();
        this.terminal = null;
        this.terminalActive = false;
      }

      this.bashUsername = "";
      this.bashVPSpassword = "";
      this.deploysterGUIverificationInProgress = false;
    },
  },
  mounted() {
    this.getAnalytics();
    const offcanvasElement = document.getElementById("bashInterface");
    if (offcanvasElement) {
      offcanvasElement.addEventListener("shown.bs.offcanvas", () => {
        // this.initTerminal();
      });

      offcanvasElement.addEventListener("hidden.bs.offcanvas", () => {
        if (this.terminal) {
          this.resetTerminalSession();
          this.terminal.dispose();
          this.terminal = null;
        }
      });
    }
  },
  beforeMount() {
    if (this.$route.meta.requiresAuth) {
      this.$checkAuthentication();
    }
  },
  beforeUnmount() {
    this.resetTerminalSession();
  },
};
</script>
