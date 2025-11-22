<style></style>

<template>
  <!-- Reauthentication Modal -->
  <div
    class="modal fade"
    id="pgReauthModal"
    tabindex="-1"
    aria-labelledby="pgReauthLabel"
    aria-hidden="true"
  >
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header border-0 pb-0">
          <span
            class="alert alert-danger w-100 h5 modal-title fw-bold"
            id="pgReauthLabel"
          >
            Authenticate PostgreSQL Access
          </span>
        </div>
        <div class="modal-body pt-2">
          <p class="text-muted mb-4 small" style="font-weight: 500">
            Session times out after 10 minutes of inactivity. Enter your
            credentials to continue.
          </p>
          <form @submit.prevent="setDBCredentials">
            <div class="mb-3">
              <label for="pgCluster" class="form-label small fw-bold"
                >Cluster Port</label
              >
              <select
                :disabled="selectClusterDisabled"
                v-model="selectedCluster.port"
                class="form-control"
              >
                <option v-if="!selectClusterDisabled" value="">
                  --- Select Cluster ---
                </option>
                <option v-else :value="this.clusterInSession.port">
                  vDefault (port: {{ this.clusterInSession.port }})
                </option>
                <option
                  v-for="cluster in clusters"
                  :key="cluster.port"
                  :value="cluster.port"
                >
                  v{{ cluster.version }} (port: {{ cluster.port }})
                </option>
              </select>
            </div>
            <div class="mb-3">
              <label for="pgUser" class="form-label small fw-bold"
                >Database Username</label
              >
              <input
                type="text"
                class="form-control"
                id="pgUser"
                v-model="username"
                placeholder="postgres"
                required
              />
            </div>
            <div class="mb-3">
              <label for="pgPass" class="form-label small fw-bold"
                >Database Password</label
              >
              <input
                type="password"
                class="form-control"
                id="pgPass"
                v-model="password"
                required
              />
            </div>
          </form>
        </div>
        <div
          v-if="!loading"
          class="modal-footer border-0 pt-0 d-flex justify-content-center"
        >
          <button
            type="button"
            class="btn btn-primary w-100"
            @click="setDBCredentials"
            :disabled="loading"
          >
            <span
              v-if="loading"
              class="spinner-border spinner-border-sm me-2"
            ></span>
            Authenticate
          </button>

          <span
            class="mt-2 fw-medium text-danger"
            style="cursor: pointer"
            data-bs-dismiss="modal"
          >
            Cancel
          </span>
        </div>
        <div v-else class="d-flex w-100 justify-content-center mb-3">
          <div class="spinner-border spinner-border-md" role="status"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: "DatabasePasswordModal",
  props: {
    clusters: {
      type: Array,
      required: false,
    },
    clusterInSession: {
      type: Object,
      required: false,
    },
    callbackFunc: {
      type: Function,
      required: false,
    },
  },
  data() {
    return {
      username: "",
      password: "",
      port: "",
      modalInstance: null,
      loading: false,
      selectedCluster: this.clusterInSession || {port : ""},
      selectClusterDisabled: false,
    };
  },
  computed: {
    dbAuthRequired() {
      return this.$dbVisualiserAuthRequired.value;
    },
    clusterInView() {
      return (
        Array.from(this.clusters || []).find(
          (cluster) => cluster.port == this.selectedCluster.port
        ) ||
        this.clusterInSession ||
        null
      );
    },
  },
  watch: {
    dbAuthRequired(newVal) {
      this.toggleModal();
    },
  },
  methods: {
    toggleModal() {
      if (this.dbAuthRequired.status === true) {
        if (this.clusterInSession) {
          this.selectClusterDisabled = true;
        }
        this.modalInstance.show();
      } else {
        this.modalInstance.hide();
      }
    },
    setDBCredentials() {
      if (!this.username) {
        return toastr.error("Enter a Database username");
      }

      if (!this.password) {
        return toastr.error("Enter a Database password");
      }

      this.loading = true;

      axios
        .post(
          `${this.$BACKEND_BASE_URL}/database/postgres/set-password`,
          {
            username: this.username,
            password: this.password,
            database: "postgres",
            version: this.clusterInView.version,
            port: this.clusterInView.port,
          },
          this.$store.state.headers
        )
        .then((res) => {
          const dbData = res.data;
          this.loading = false;
          this.$dbVisualiserAuthenticatorFunc(
            dbData,
            "postgres",
            this.clusterInView.version
          );
          if (this.callbackFunc) {
            this.callbackFunc();
          }
          if (!this.clusterInSession) {
            this.$router.push(
              `/database/postgres/${this.clusterInView.version}-${this.clusterInView.port}/analytics`
            );
          }
        })
        .catch((err) => {
          if (err.response?.data) {
            toastr.error(
              err.response.data?.message || "Error processing request"
            );
          } else {
            toastr.error("Error processing request");
          }
          this.loading = false;
        });
    },
  },
  mounted() {
    this.modalInstance = new bootstrap.Modal(
      document.getElementById("pgReauthModal")
    );
    // this.toggleModal();
  },
};
</script>
