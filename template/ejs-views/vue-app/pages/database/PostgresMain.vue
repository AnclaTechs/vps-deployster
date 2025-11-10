<style>
tr > td {
  padding: 15px 10px !important;
}
</style>

<template>
  <main class="flex-grow-1 overflow-auto mt-4 container">
    <section>
      <hr />
      <div class="d-flex flex-row justify-content-between align-items-center">
        <div>
          <h3 class="fw-bold">PostgreSQL Versions</h3>
          <small class="text-muted"
            >Manage your installed PostgreSQL versions and connections</small
          >
        </div>
        <button class="btn btn-primary py-2 rounded-pill">
          <i class="bi bi-plus"></i> &nbsp; Install New Version
        </button>
      </div>

      <div class="mt-3 card card-body">
        <div
          v-if="clusterIsLoading"
          class="spinner-grow"
          role="status"
          style="align-self: center"
        >
          <span class="visually-hidden">Loading...</span>
        </div>

        <div v-else>
          <table
            v-if="pgClusters?.length && pgClusters?.length > 0"
            class="table table-sm"
          >
            <thead>
              <tr class="fw-bold">
                <th>Version</th>
                <th>Status</th>
                <th>Directory</th>
                <th>Port</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              <tr v-for="cluster in pgClusters" :key="cluster.port">
                <td>{{ Number(cluster.version).toFixed(2) }}</td>
                <td>
                  <span
                    :class="[
                      'badge',
                      'rounded-pill',
                      [cluster.isActive ? 'bg-success' : 'bg-danger'],
                    ]"
                    >{{ cluster.isActive ? "Active" : "Inactive" }}</span
                  >
                </td>
                <td class="text-muted">{{ cluster.dataDir }}</td>
                <td>{{ cluster.port }}</td>
                <td style="font-weight: 500">
                  <button
                    :disabled="!cluster.isActive"
                    class="btn btn-sm btn-outline-secondary"
                    @click="
                      dbConnNavigate(
                        `database/postgres/${cluster.version}-${cluster.port}/analytics`
                      )
                    "
                  >
                    {{ cluster.isActive ? "View" : "N?A" }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
          <div v-else class="text-center py-5">
            <div class="mb-4">
              <i class="bi bi-database-x display-1 text-muted opacity-75"></i>
            </div>

            <h3 class="h4 fw-semibold text-body">
              No PostgreSQL clusters found
            </h3>
            <p class="text-muted mb-4 max-w-md mx-auto">
              It looks like PostgreSQL isn’t installed or no clusters are
              running on this server yet.
              <br />You can set it up in under a minute!
            </p>

            <div class="d-flex gap-3 justify-content-center flex-wrap">
              <!-- Ubuntu/Debian -->
              <button
                @click="runInstall('debian')"
                class="btn btn-primary d-flex align-items-center gap-2"
                :disabled="installing"
              >
                <i class="bi bi-ubuntu"></i>
                Install on Ubuntu / Debian
              </button>

              <!-- RHEL / CentOS -->
              <button
                @click="runInstall('rhel')"
                class="btn btn-outline-primary d-flex align-items-center gap-2"
                :disabled="installing"
              >
                <i class="bi bi-redhat"></i>
                Install on RHEL / CentOS
              </button>
            </div>

            <small class="text-muted d-block mt-3">
              After install, refresh this page or run
              <code class="bg-light px-2 py-1 rounded"
                >pg_ctlcluster --force reload</code
              >
            </small>
          </div>
        </div>
      </div>
    </section>
    <PasswordModal :clusters="this.pgClusters" :clusterPort="undefined" />
  </main>
</template>

<script>
export default {
  name: "",
  components: {
    PasswordModal: defineAsyncComponent(() =>
      loadModule(
        "/vue/components/database/DatabasePasswordModal.vue",
        window.$httpLoaderOption
      )
    ),
  },
  data() {
    return {
      clusterIsLoading: true,
      pgClusters: [],
    };
  },
  mounted() {
    this.getPgClusters();
  },
  methods: {
    getPgClusters() {
      axios
        .get(
          `${this.$BACKEND_BASE_URL}/database/postgres/clusters`,
          this.$store.state.headers
        )
        .then((res) => {
          const resData = res.data.data;
          this.clusterIsLoading = false;
          this.pgClusters = resData;
          this.$dbVisualiserAuthenticatorFunc(
            res.data,
            "postgres",
            this.$dbVisualiserAuthRequired.value.version
          );
        });
    },
    dbConnNavigate(path) {
      const clusterData = String(path).split("/")[2];
      const clusterVersion = clusterData.split("-")[0];
      if (
        this.$dbVisualiserAuthRequired.value.database != "postgres" ||
        this.$dbVisualiserAuthRequired.value.status ||
        this.$dbVisualiserAuthRequired.value.version != clusterVersion
      ) {
        this.$dbVisualiserAuthenticatorFunc(
          {},
          "postgres",
          this.$dbVisualiserAuthRequired.value.version
        );
      } else {
        this.$router.push(`/${path}`);
      }
    },
    runInstall() {
      window.open("https://www.postgresql.org/download/linux/", "_blank");
    },
  },
};
</script>
