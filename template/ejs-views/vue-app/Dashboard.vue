<template>
  <div class="admin-container">
    <!-- Sidebar -->
    <!-- <sidebar></sidebar> -->

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
                <i class="fad fa-terminal fa-lg"></i>
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
      dashboardDataIsLoading: true,
      dashboardData: {
        count: "N?A",
        lastDeployment: "N?A",
        data: [],
      },
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
  },
  mounted() {
    this.getAnalytics();
  },
  beforeMount() {
    if (this.$route.meta.requiresAuth) {
      this.$checkAuthentication();
    }
  },
};
</script>
