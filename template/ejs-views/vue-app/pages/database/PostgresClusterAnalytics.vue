<template>
  <main class="flex-grow-1 overflow-auto mt-4 container">
    <section>
      <hr />
      <div class="d-flex flex-row justify-content-between align-items-center">
        <div>
          <h4>{{ clusterInViewFullname }}</h4>
          <small>Real time overview of database health</small>
        </div>
        <button
          :disabled="clusterDataIsLoading"
          type="button"
          class="btn btn-primary btn-sm"
          style="height: 40px; border-radius: 13px"
          @click="getPgClusterAnalytics()"
        >
          <i
            :class="
              clusterDataIsLoading
                ? 'fal fa-redo fa-spin'
                : 'bi bi-arrow-clockwise'
            "
          ></i>
          &nbsp; <span>Refresh status</span>
        </button>
      </div>

      <div class="mt-3 row gap-3">
        <div class="col-sm-2 card card-body">
          <div class="fw-bold h6">Status</div>
          <div
            v-if="!clusterDataIsLoading"
            class="active-status"
            :style="{ color: clusterStatus ? '#198754' : '#DC3545' }"
          >
            <div v-if="clusterStatus" class="beeping-dot"></div>
            {{ clusterStatus ? "Active" : "Inactive" }}
          </div>
          <div
            v-else
            class="d-flex justify-content-center align-items-center py-3"
          >
            <span
              class="spinner-grow spinner-grow-md"
              role="status"
              aria-hidden="true"
            ></span>
            <span class="sr-only"> &nbsp; Loading...</span>
          </div>
        </div>
        <div class="col-sm-2 card card-body">
          <div class="fw-bold h6">System Uptime</div>
          <div v-if="!clusterDataIsLoading" class="statboard--item">
            {{ clusterUptime }}
          </div>
          <div
            v-else
            class="d-flex justify-content-center align-items-center py-3"
          >
            <span
              class="spinner-grow spinner-grow-md"
              role="status"
              aria-hidden="true"
            ></span>
            <span class="sr-only"> &nbsp; Loading...</span>
          </div>
        </div>
        <div class="col-sm-2 card card-body">
          <div class="fw-bold h6">Cluster Size</div>
          <div v-if="!clusterDataIsLoading" class="statboard--item">
            {{ clusterSize }}
          </div>
          <div
            v-else
            class="d-flex justify-content-center align-items-center py-3"
          >
            <span
              class="spinner-grow spinner-grow-md"
              role="status"
              aria-hidden="true"
            ></span>
            <span class="sr-only"> &nbsp; Loading...</span>
          </div>
        </div>
        <div class="col-sm-2 card card-body">
          <div class="fw-bold h6">Postgres Version</div>
          <div v-if="!clusterDataIsLoading" class="statboard--item">
            {{ clusterPgVersion }}
          </div>
          <div
            v-else
            class="d-flex justify-content-center align-items-center py-3"
          >
            <span
              class="spinner-grow spinner-grow-md"
              role="status"
              aria-hidden="true"
            ></span>
            <span class="sr-only"> &nbsp; Loading...</span>
          </div>
        </div>
      </div>

      <!--Databases-->
      <div class="mt-4">
        <h5 class="fw-bold mb-2">Databases ({{ databases.length }})</h5>
        <div v-if="databases.length <= 5" class="d-flex flex-wrap gap-2">
          <span
            v-for="db in databases"
            :key="db"
            class="badge rounded-pill px-3 py-2 text-white cursor-pointer"
            :style="{ backgroundColor: getDbColor(db) }"
            :title="`Connect to ${db}`"
            @click="
              dbConnNavigate(
                `database/postgres/${clusterData}/${db.datname}/visualizer`
              )
            "
          >
            <i class="bi bi-database-fill"></i> {{ db.datname }} — {{ db.size }}
          </span>
        </div>
        <div v-else>
          <div class="d-flex flex-wrap gap-2 mb-2">
            <span
              v-for="db in databases.slice(0, 3)"
              :key="db"
              class="badge rounded-pill px-3 py-2 text-white cursor-pointer"
              :style="{ backgroundColor: getDbColor(db) }"
              :title="`Connect to ${db}`"
              @click="
                dbConnNavigate(
                  `database/postgres/${clusterData}/${db.datname}/visualizer`
                )
              "
            >
              <i class="bi bi-database-fill"></i> {{ db.datname }} —
              {{ db.size }}
            </span>
            <span v-if="!showAllDatabases" class="badge rounded-pill bg-secondary px-3 py-2 cursor-pointer"
            @click="showAllDatabases = !showAllDatabases"
            >
              +{{ databases.length - 3 }} more
            </span>
          </div>
          <button
            class="btn btn-link btn-sm p-0"
            @click="showAllDatabases = !showAllDatabases"
          >
            {{ showAllDatabases ? "Hide" : "Show all" }}
          </button>
          <div v-if="showAllDatabases" class="d-flex flex-wrap gap-2 mt-2">
            <span
              v-for="db in databases.slice(3)"
              :key="db"
              class="badge rounded-pill px-3 py-2 text-white cursor-pointer"
              :style="{ backgroundColor: getDbColor(db) }"
              :title="`Connect to ${db}`"
              @click="
                dbConnNavigate(
                  `database/postgres/${clusterData}/${db.datname}/visualizer`
                )
              "
            >
              <i class="bi bi-database-fill"></i> {{ db.datname }} —
              {{ db.size }}
            </span>
          </div>
        </div>
      </div>

      <!--Connections-->
      <div class="mt-5">
        <h4 class="p-0 fw-bold">
          Current Connections ({{ totalClusterConnections }})
        </h4>
        <div v-if="!clusterDataIsLoading" class="card card-body">
          <table class="table table-sm">
            <thead>
              <tr>
                <th>User</th>
                <th>Database</th>
                <th>Client Address</th>
                <th>State</th>
                <th>Duration</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody class="connection-data-row">
              <tr
                v-for="connection in paginatedConnections"
                :key="connection.pid"
              >
                <td>{{ connection.usename || "N/A" }}</td>
                <td>
                  <span
                    v-if="connection.datname"
                    class="badge rounded-pill bg-secondary text-white"
                    >{{ connection.datname }}</span
                  >
                  <small v-else class="text-muted" style="opacity: 0.7"
                    >Unknown</small
                  >
                </td>
                <td>{{ connection.client_addr || "Local" }}</td>
                <td>
                  <small
                    v-if="connection.state"
                    class="badge rounded-pill"
                    :class="{
                      'text-bg-success': connection.state === 'active',
                      'text-bg-warning': connection.state === 'idle',
                      'text-bg-danger':
                        connection.state === 'idle in transaction',
                      'text-bg-secondary': !connection.state,
                    }"
                  >
                    {{ connection.state }}
                  </small>

                  <small v-else class="text-muted" style="opacity: 0.7"
                    >Unknown</small
                  >
                </td>
                <td>{{ formatDuration(connection.query_start) }}</td>
                <td>
                  <div
                    v-if="loadingPids.includes(connection.pid)"
                    class="d-flex align-items-center gap-2"
                  >
                    <span
                      class="spinner-grow spinner-grow-sm"
                      role="status"
                      aria-hidden="true"
                    ></span>
                    <span class="sr-only">Loading...</span>
                  </div>
                  <button
                    v-else
                    class="btn btn-link text-danger p-0"
                    @click="disconnect(connection.pid)"
                  >
                    Disconnect
                  </button>
                </td>
              </tr>
            </tbody>
          </table>

          <div class="d-flex justify-content-between align-items-center mt-3">
            <button
              class="btn btn-sm btn-outline-primary"
              :disabled="currentPage === 1"
              @click="currentPage--"
            >
              &lt; Prev
            </button>
            <span>Page {{ currentPage }} of {{ totalPages }}</span>
            <button
              class="btn btn-sm btn-outline-primary"
              :disabled="currentPage === totalPages"
              @click="currentPage++"
            >
              Next &gt;
            </button>
          </div>
        </div>
        <div v-else class="card card-body">
          <!-- Loading Skeleton -->
          <table class="table table-sm">
            <thead>
              <tr>
                <th><div class="skeleton skeleton-header"></div></th>
                <th><div class="skeleton skeleton-header"></div></th>
                <th><div class="skeleton skeleton-header"></div></th>
                <th><div class="skeleton skeleton-header"></div></th>
                <th><div class="skeleton skeleton-header"></div></th>
                <th><div class="skeleton skeleton-header"></div></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="n in 5" :key="n">
                <td><div class="skeleton skeleton-text"></div></td>
                <td><div class="skeleton skeleton-text"></div></td>
                <td><div class="skeleton skeleton-text"></div></td>
                <td><div class="skeleton skeleton-badge"></div></td>
                <td><div class="skeleton skeleton-text short"></div></td>
                <td><div class="skeleton skeleton-text short"></div></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
    <PasswordModal
      :clusters="null"
      :clusterInSession="this.clusterDataInSession"
      :callbackFunc="this.getPgClusterAnalytics"
    />
  </main>
</template>

<script>
export default {
  name: "PostgresClusterAnalytics",
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
      currentPage: 1,
      perPage: 10,
      clusterDataIsLoading: true,
      clusterInViewFullname: "Postgres",
      clusterData: null,
      showAllDatabases: false,
      clusterStatus: null,
      clusterUptime: null,
      totalClusterConnections: null,
      clusterPgVersion: null,
      databases: [],
      currentConnections: [],
      clusterSize: null,
      loadingPids: [],
    };
  },
  computed: {
    clusterDataInSession() {
      return {
        version: String(this.clusterData).split("-")[0],
        port: String(this.clusterData).split("-")[1],
      };
    },
    paginatedConnections() {
      const start = (this.currentPage - 1) * this.perPage;
      return this.currentConnections.slice(start, start + this.perPage);
    },
    totalPages() {
      return Math.ceil(this.currentConnections.length / this.perPage);
    },
  },

  methods: {
    getDbColor(db) {
      const coolColors = [
        "#3498DB", // Blue
        "#6699CC", // Blue Gray
        "#27AE60", // Green
        "#16A085", // Teal
        "#2980B9", // Dark Blue
        "#2C3E50", // Navy
        "#1ABC9C", // Turquoise
        "#e08955", // Burnt Sienna
        "#483d3c", // Cool Gray
        "#DB6E30", // Burnt Orange
        "#836663", // Rose Quartz
        "#B44131", // Chilli Pepper
      ];

      return coolColors[Math.floor(Math.random() * coolColors.length)];
    },
    getPgClusterAnalytics() {
      this.clusterDataIsLoading = true;
      axios
        .get(
          `${this.$BACKEND_BASE_URL}/database/postgres/${this.clusterData}/analytics`,
          this.$store.state.headers
        )
        .then((res) => {
          const resData = res.data.data;
          console.log({ resData });
          this.clusterInViewFullname = resData.clusterFullName;
          this.clusterStatus = resData.clusterStatus;
          this.clusterUptime = resData.uptime;
          this.totalClusterConnections = resData.totalConnections;
          this.clusterPgVersion = String(resData.version).includes(".")
            ? Number(resData.version).toFixed(2)
            : resData.version;
          this.databases = resData.databases;
          this.currentConnections = resData.connectionList;
          this.clusterSize = resData.totalClusterSize;
          this.clusterDataIsLoading = false;
          //
          this.$dbVisualiserAuthenticatorFunc(
            res.data,
            "postgres",
            this.clusterDataInSession.version
          );
        })
        .catch((err) => {
          err.response.data;
          this.$dbVisualiserAuthenticatorFunc(
            err?.response?.data || {},
            "postgres",
            this.clusterDataInSession.version
          );
        });
    },
    formatDuration(start) {
      if (!start) return "N/A";
      const diff = (Date.now() - new Date(start)) / 1000; // Seconds
      const days = Math.floor(diff / 86400);
      const hours = Math.floor((diff % 86400) / 3600);
      const mins = Math.floor((diff % 3600) / 60);
      const secs = Math.floor(diff % 60);
      return days
        ? `${days}d ${hours}h`
        : hours
        ? `${hours}h ${mins}m`
        : mins
        ? `${mins}m ${secs}s`
        : `${secs}s ago`;
    },
    disconnect(pid) {
      this.loadingPids.push(pid);
      axios
        .post(
          `${this.$BACKEND_BASE_URL}/database/postgres/${this.clusterData}/disconnect-conn`,
          { pid },
          this.$store.state.headers
        )
        .then(() => {
          toastr.success("Connection removed successfully");
          this.currentConnections = this.currentConnections.filter(
            (c) => c.pid !== pid
          );
          this.totalClusterConnections -= 1;
        })
        .catch((error) => {
          console.error("Disconnect failed:", error);
          toastr.error(
            error.response?.data?.message || "Error processing request"
          );
        })
        .finally(() => {
          this.loadingPids = this.loadingPids.filter((data) => data != pid);
        });
    },
    dbConnNavigate(path) {
      const clusterVersion = this.clusterData.split("-")[0];
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
  },
  mounted() {
    this.clusterData = this.$route.params.cluster;
    this.getPgClusterAnalytics();
  },
};
</script>

<style>
.active-status {
  color: #198754;
  font-size: 25px;
  font-weight: 600;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 10px;
}

.statboard--item {
  font-size: 25px;
  font-weight: 600;
  color: grey;
}

.connection-data-row td {
  font-weight: 500;
  color: #535353;
}

tr > td {
  padding: 15px 10px !important;
}

.database {
  background: grey;
  padding: 5px 10px;
  margin-top: 5px;
  border-radius: 5px;
  color: #f2f2f2;
  font-weight: 600;
  font-size: 13px;
}

.beeping-dot {
  position: relative;
  width: 12px;
  height: 12px;
  background: #198754;
  border-radius: 50%;
  animation: beep-dot 1.5s infinite ease-in-out;
}

.beeping-dot::before,
.beeping-dot::after {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: #198754;
  opacity: 0.7;
  animation: beep-wave 3s infinite ease-out;
}

.beeping-dot::after {
  animation-delay: 1.5s; /* Second wave offset */
}

@keyframes beep-dot {
  0%,
  100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.2);
    opacity: 0.8;
  }
}

@keyframes beep-wave {
  0% {
    transform: scale(1);
    opacity: 0.7;
  }
  100% {
    transform: scale(3);
    opacity: 0;
  }
}

.fa-spin {
  animation-duration: 1s;
}

.skeleton {
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite linear;
  border-radius: 4px;
  height: 1.2em;
  width: 100%;
}

.skeleton-header {
  height: 1em;
  width: 80%;
  margin: 0 auto;
}
.skeleton-text {
  height: 1em;
}
.skeleton-badge {
  height: 1.2em;
  width: 60%;
  border-radius: 20px;
}
.skeleton.short {
  width: 50%;
}

@keyframes skeleton-loading {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

.cursor-pointer {
  cursor: pointer;
}
</style>
