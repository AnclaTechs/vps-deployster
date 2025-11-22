<style scoped>
.glass-card-parent-container {
  /* background: rgba(15, 23, 42, 0.95); */
  background: #f1f1f1b0;
}
.glass-card {
  /* background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  backdrop-filter: blur(12px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.37);
  transition: all 0.3s ease; */

  background: #f1f5f9 !important;
  border: 0.3px solid #e7dfdf;
  border-radius: 16px;
  transition: all 0.3s ease;
}
.glass-card:hover {
  transform: translateY(-4px);
}

.progress-circle {
  position: relative;
  width: 200px;
  height: 200px;
  border-radius: 50%;
  background: conic-gradient(currentColor calc(var(--value) * 1%), #e9ecef 0);
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.progress-circle::before {
  content: "";
  position: absolute;
  width: 165px;
  height: 165px;
  background-color: white;
  border-radius: 50%;
}

.progress-circle span {
  position: relative;
  font-weight: bold;
  font-size: 0.9rem;
  color: #212529;
}

.refetch-container {
  color: #f2f2f2;
  padding: 10px 15px;
  background: grey;
  border-radius: 5px;
}

.ram-process-thead > :first-child {
  border-top-left-radius: 5px;
}

.ram-process-thead > :last-child {
  border-top-right-radius: 5px;
}

.text-cyan {
  color: #00d4ff;
}

.topology-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  margin: auto;
  height: 100%;
}

.topology-grid > div {
  display: flex;
  flex-direction: column;
  justify-content: center;
  height: 100px;
}

.table-row-hover:hover {
  background-color: rgba(255, 255, 255, 0.08) !important;
  transition: all 0.2s;
}

.table-dark {
  --bs-table-bg: rgba(33, 37, 41, 0.8);
}

.btn-group {
  gap: 5px;
}

.btn-group .btn {
  border-radius: 0.5rem !important;
  font-size: 0.85rem;
  font-weight: 500;
  padding: 0.35rem 0.75rem;
  transition: all 0.25s ease;
  z-index: 1;
}

.btn-group .btn:first-child {
  border-top-left-radius: 0.6rem !important;
  border-bottom-left-radius: 0.6rem !important;
}

.btn-group .btn:last-child {
  border-top-right-radius: 0.6rem !important;
  border-bottom-right-radius: 0.6rem !important;
}

.btn-group .btn:hover:not(.btn-primary) {
  background-color: rgba(13, 110, 253, 0.1);
  border-color: #0d6efd;
}

.pulse {
  animation: pulse 2s infinite;
}
@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.stroked-text {
  text-decoration: line-through;
}
</style>

<template>
  <main class="flex-grow-1 overflow-auto mt-4 container">
    <section>
      <hr />
      <div class="d-flex flex-row justify-content-between align-items-center">
        <div>
          <h3 class="fw-bold">System Monitor</h3>
          <small
            >Real time resource monitoring for {{ dataBank.hostname }}
          </small>
        </div>

        <div>
          <span class="refetch-container">
            <i class="fad fa-redo-alt"></i>
          </span>
        </div>
      </div>

      <div class="p-5 text-light rounded-3 glass-card-parent-container">
        <div class="row g-4">
          <div class="col-md-4">
            <div
              class="glass-card p-3 d-flex flex-column align-items-center h-100"
            >
              <div class="w-100 d-flex justify-content-between mb-2">
                <h6 class="text-dark">
                  <i class="bi bi-cpu-fill me-2"></i>Memory (RAM) Usage
                </h6>
                <span class="fw-bold text-dark">{{
                  dataBank.ram?.used_percent
                    ? `${dataBank.ram.used_percent}%`
                    : "N/A"
                }}</span>
              </div>
              <div
                class="mt-2 progress-circle text-primary"
                :style="`--value: ${dataBank.ram?.used_percent || 0}`"
              >
                <span
                  >{{ dataBank.ram?.used.replace(" ", "") || 0 }} of
                  {{ dataBank.ram?.total.replace(" ", "") || 0 }}</span
                >
              </div>

              <div
                class="w-100 rounded-2 mt-3 p-3 bg-secondary text-center"
                style="font-weight: 500"
              >
                <span>Available: </span>
                <span class="fw-bold">{{
                  dataBank.ram?.available.replace(" ", "") || 0
                }}</span>
              </div>
            </div>
          </div>

          <div class="col-md-4">
            <div
              class="glass-card p-3 d-flex flex-column align-items-center h-100"
            >
              <div class="w-100 d-flex justify-content-between mb-2">
                <h6 class="text-dark">
                  <i class="bi bi-cpu-fill me-2"></i>Storage (Disk) Usage
                </h6>
                <span class="fw-bold text-dark">{{
                  dataBank.disk?.used_percent
                    ? `${parseFloat(dataBank.disk.used_percent)}%`
                    : "N/A"
                }}</span>
              </div>
              <div
                class="mt-2 progress-circle text-warning"
                :style="`--value: ${parseFloat(dataBank.disk?.used_percent)}`"
              >
                <span
                  >{{ dataBank.disk?.used.replace(" ", "") || 0 }} of
                  {{ dataBank.disk?.total.replace(" ", "") || 0 }}</span
                >
              </div>

              <div
                class="w-100 rounded-2 mt-3 p-3 bg-secondary text-center"
                style="font-weight: 500"
              >
                <span>Available: </span>
                <span class="fw-bold">{{
                  dataBank.disk?.available.replace(" ", "") || 0
                }}</span>
              </div>
            </div>
          </div>

          <div class="col-lg-4">
            <div class="glass-card p-4 text-dark">
              <h6 class="mb-4">
                <i class="bi bi-cpu-fill me-2"></i>CPU Topology
              </h6>
              <div class="topology-grid text-center">
                <div class="">
                  <div class="display-6 fw-bold text-primary">
                    {{ dataBank.cpu?.physical_cores }}
                  </div>
                  <small class="text-secondary">Physical Cores</small>
                </div>
                <div class="">
                  <div class="display-6 fw-bold text-info">
                    {{ dataBank.cpu?.logical_cpus }}
                  </div>
                  <small class="text-secondary">Logical Cores</small>
                </div>
                <div class="">
                  <div class="display-6 fw-bold text-cyan">
                    {{ dataBank.cpu?.hyperthreaded_logical_extra }}
                  </div>
                  <small class="text-secondary">Hyperthreaded Cores</small>
                </div>
                <div class="">
                  <div class="display-6 fw-bold text-success">
                    {{ dataBank.cpu?.threads_per_core }}
                  </div>
                  <small class="text-secondary">Threads/Core</small>
                </div>
              </div>
              <button
                :class="[
                  'mt-2',
                  'btn',
                  dataBank.cpu?.hyperthreaded_logical_extra
                    ? 'btn-outline-success'
                    : 'btn-outline-secondary',
                  'text-center',
                  'w-100',
                ]"
                style="padding: 12px 0px"
              >
                <span
                  v-if="dataBank.cpu?.hyperthreaded_logical_extra"
                  class="badge bg-success fs-6 text-wrap"
                  >Hyper-Threading: Enabled</span
                >
                <span v-else class="badge bg-secondary fs-6 text-wrap"
                  >Hyper-Threading: False</span
                >
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="mt-4 text-light rounded-3 glass-card-parent-container">
        <!-- Live Chart (Chart.js via CDN) -->
        <div class="col-lg-12">
          <div class="glass-card p-4 h-100 d-flex flex-column">
            <div
              class="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center mb-4 gap-3"
            >
              <h5 class="text-dark mb-0" style="font-weight: 500">
                CPU & RAM Usage (Live)
              </h5>

              <div
                class="btn-group shadow-sm"
                role="group"
                aria-label="Time range selector"
              >
                <button
                  v-for="range in timeRanges"
                  :key="range.value"
                  type="button"
                  class="btn btn-sm position-relative overflow-hidden"
                  :class="
                    selectedRange === range.value
                      ? 'btn-primary text-white'
                      : 'btn-outline-secondary'
                  "
                  @click="selectedRange = range.value"
                >
                  {{ range.label }}
                  <span
                    v-if="selectedRange === range.value"
                    class="position-absolute bottom-0 start-0 w-100 bg-primary opacity-25"
                    style="height: 3px; transition: all 0.3s ease"
                  ></span>
                </button>
              </div>
            </div>

            <!-- Chart Canvas -->
            <canvas
              ref="chartCanvas"
              height="280"
              style="max-height: 350px"
            ></canvas>

            <div class="mt-3 text-center">
              <small
                :class="[
                  'fw-medium',
                  selectedRange == '15m' ? 'text-success' : 'text-secondary',
                ]"
              >
                <i
                  v-if="selectedRange == '15m'"
                  class="bi bi-circle-fill fs-10 text-success pulse me-1"
                ></i>
                <i
                  v-else
                  class="bi bi-pause-circle-fill fs-10 text-secondary me-2"
                ></i>
                <span :class="[selectedRange != '15m' && 'stroked-text']"
                  >Updating live</span
                >
                • {{ selectedRangeLabel }}
              </small>
            </div>
          </div>
        </div>
      </div>

      <div class="mt-2 rounded-3 glass-card-parent-container">
        <div class="row g-4 mt-4">
          <!-- Top Processes Card -->
          <div class="col-lg-6">
            <div class="glass-card p-4 h-100 d-flex flex-column">
              <h5 class="text-muted mb-3">
                <i class="bi bi-cpu me-2"></i>Top Processes by Memory
              </h5>

              <div class="table-responsive flex-grow-1">
                <table class="table table-sm table-hover align-middle mb-0">
                  <thead class="table-dark">
                    <tr>
                      <th class="ps-3">Process</th>
                      <th>PID</th>
                      <th>Memory</th>
                      <th>CPU</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="process in paginatedProcesses"
                      :key="process.pid"
                      class="table-row-hover"
                    >
                      <td
                        class="ps-3 text-truncate"
                        style="max-width: 180px"
                        :title="process.process"
                      >
                        <i class="bi bi-box-seam me-2 text-primary"></i>
                        {{ process.process }}
                      </td>
                      <td class="text-center">{{ process.pid }}</td>
                      <td>{{ process.size }}</td>
                      <td>
                        <span class="badge bg-success rounded-pill">
                          {{ process.memory_percentage }}%
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- Pagination for Processes -->
              <div
                class="mt-3 d-flex justify-content-between align-items-center"
              >
                <small class="text-muted">
                  Showing
                  {{ processesPage * itemsPerPage - (itemsPerPage - 1) }}-{{
                    Math.min(
                      processesPage * itemsPerPage,
                      dataBank.top_processes?.length || 0
                    )
                  }}
                  of {{ dataBank.top_processes?.length || 0 }}
                </small>
                <div class="btn-group btn-group-sm" role="group">
                  <button
                    class="btn btn-outline-secondary"
                    @click="processesPage--"
                    :disabled="processesPage === 1"
                  >
                    &lt;
                  </button>
                  <button
                    class="btn btn-outline-secondary"
                    @click="processesPage++"
                    :disabled="processesPage >= maxProcessPages"
                  >
                    &gt;
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Top Directories/Files Card -->
          <div class="col-lg-6">
            <div class="glass-card p-4 h-100 d-flex flex-column">
              <h5 class="text-muted mb-3">
                <i class="bi bi-folder-fill me-2 text-warning"></i>Top Disk
                Space Usage
              </h5>

              <div class="table-responsive flex-grow-1">
                <table class="table table-sm table-hover align-middle mb-0">
                  <thead class="table-dark">
                    <tr>
                      <th class="ps-3">Path</th>
                      <th>Size</th>
                      <th>Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="item in paginatedFiles"
                      :key="item.path"
                      class="table-row-hover"
                    >
                      <td
                        class="ps-3 text-truncate"
                        style="max-width: 220px"
                        :title="item.path"
                      >
                        <i
                          :class="
                            isFile(item.path)
                              ? 'bi bi-file-earmark-text text-info'
                              : 'bi bi-folder text-warning'
                          "
                          class="me-2"
                        ></i>
                        {{ truncatePath(item.path) }}
                      </td>
                      <td>{{ item.size }}</td>
                      <td>
                        <span class="badge bg-light text-dark">
                          {{ isFile(item.path) ? "File" : "Folder" }}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- Pagination for Files -->
              <div
                class="mt-3 d-flex justify-content-between align-items-center"
              >
                <small class="text-muted">
                  Showing
                  {{ filesPage * itemsPerPage - (itemsPerPage - 1) }}-{{
                    Math.min(
                      filesPage * itemsPerPage,
                      dataBank.top_files?.length || 0
                    )
                  }}
                  of {{ dataBank.top_files?.length || 0 }}
                </small>
                <div class="btn-group btn-group-sm" role="group">
                  <button
                    class="btn btn-outline-secondary"
                    @click="filesPage--"
                    :disabled="filesPage === 1"
                  >
                    &lt;
                  </button>
                  <button
                    class="btn btn-outline-secondary"
                    @click="filesPage++"
                    :disabled="filesPage >= maxFilePages"
                  >
                    &gt;
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </main>
</template>

<script>
let chartInstance = null;

export default {
  data() {
    return {
      dataIsLoading: true,
      dataBank: {},
      currentTime: new Date().toLocaleTimeString(),
      interval: null,
      processesPage: 1,
      filesPage: 1,
      itemsPerPage: 10,
      initialGraphLoaded: false,
      selectedRange: "15m",
      timeRanges: [
        { label: "15m", value: "15m" },
        { label: "30m", value: "30m" },
        { label: "1h", value: "1h" },
        { label: "6h", value: "6h" },
        { label: "12h", value: "12h" },
        { label: "24h", value: "24h" },
        // { label: "7d", value: "7d" },
        // { label: "30d", value: "30d" },
      ],
    };
  },
  watch: {
    selectedRange(newRange) {
      clearInterval(this.interval);
      this.interval = null;
      this.fetchAnalytics();
    },
  },
  computed: {
    graphDataPoints() {
      return this.dataBank.timelog?.map((data) => {
        return {
          ts: data[0],
          cpu: data[1],
          ram_used: data[2],
          ram_total: data[3],
        };
      });
    },
    paginatedProcesses() {
      const start = (this.processesPage - 1) * this.itemsPerPage;
      return (
        this.dataBank.top_processes?.slice(start, start + this.itemsPerPage) ||
        []
      );
    },

    paginatedFiles() {
      const start = (this.filesPage - 1) * this.itemsPerPage;
      return (
        this.dataBank.top_files?.slice(start, start + this.itemsPerPage) || []
      );
    },

    maxProcessPages() {
      return Math.ceil(
        (this.dataBank.top_processes?.length || 0) / this.itemsPerPage
      );
    },

    maxFilePages() {
      return Math.ceil(
        (this.dataBank.top_files?.length || 0) / this.itemsPerPage
      );
    },

    selectedRangeLabel() {
      const found = this.timeRanges.find((r) => r.value === this.selectedRange);
      return found ? found.label : this.selectedRange;
    },
  },
  mounted() {
    this.fetchAnalytics();
  },
  beforeUnmount() {
    clearInterval(this.interval);
    this.interval = null;
    chartInstance = null;
  },
  methods: {
    createOrUpdateChart() {
      const canvas = this.$refs.chartCanvas;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");

      if (chartInstance) {
        chartInstance.data = this.buildChartData();
        chartInstance.update("quiet");
        return;
      }

      chartInstance = new Chart(ctx, {
        type: "line",
        data: this.buildChartData(),
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          plugins: {
            legend: { labels: { color: "grey" } },
            tooltip: {
              callbacks: {
                title: function (tooltipItems) {
                  const timestamp = tooltipItems[0].label;
                  if (!timestamp) return "";

                  if (String(timestamp).length < 6)
                    return `${timestamp}, Today`;

                  return timestamp;
                },
              },
            },
          },
          scales: {
            x: {
              ticks: {
                color: "#888",
                autoSkip: true,
                maxTicksLimit: 20,
                maxRotation: 0,
              },
              grid: { color: "#3332" },
            },
            y: {
              position: "left",
              ticks: { color: "#00BBF9" },
              title: { display: true, text: "CPU %", color: "#00BBF9" },
            },
            y1: {
              position: "right",
              ticks: { color: "#9B5DE5" },
              grid: { drawOnChartArea: false },
              title: { display: true, text: "RAM GB", color: "#9B5DE5" },
            },
          },
        },
      });
    },
    buildChartData() {
      return {
        labels: (() => {
          const points = this.graphDataPoints || [];
          if (points.length === 0) return [];

          const formatLabel = (ts) => {
            const date = new Date(ts * 1000);
            const now = new Date();
            const isToday =
              date.getFullYear() === now.getFullYear() &&
              date.getMonth() === now.getMonth() &&
              date.getDate() === now.getDate();

            const time = date.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            });

            if (isToday) return time;

            const day = String(date.getDate()).padStart(2, "0");
            const month = String(date.getMonth() + 1).padStart(2, "0");
            const year = date.getFullYear();
            return `${day}-${month}-${year} ${time}`;
          };

          return points.map((p, index) => formatLabel(p.ts));
        })(),
        datasets: [
          {
            label: "CPU %",
            data: this.graphDataPoints.map((p) => p.cpu),
            borderColor: "#00BBF9",
            borderWidth: 0.3,
            backgroundColor: "rgba(0, 187, 249,0.23)",
            fill: true,
            tension: 0.4,
            pointRadius: 0,
            pointHoverRadius: 4,
            pointHitRadius: 8,
          },
          {
            label: "RAM Used (GB)",
            data: this.graphDataPoints.map((p) =>
              (p.ram_used / 1024).toFixed(1)
            ),
            borderColor: "#9B5DE5",
            borderWidth: 0.3,
            backgroundColor: "rgba(155, 93, 229,0.23)",
            fill: true,
            tension: 0.4,
            pointRadius: 0,
            pointHoverRadius: 4,
            pointHitRadius: 8,
            yAxisID: "y1",
          },
        ],
      };
    },
    refresh() {},
    startLiveUpdate() {
      this.interval = setInterval(this.fetchAnalytics, 10000);
    },
    fetchAnalytics() {
      axios
        .get(
          `${this.$BACKEND_BASE_URL}/sys-monitor?tsRange=${this.selectedRange}`,
          this.$store.state.headers
        )
        .then((res) => {
          const resData = res.data.data;
          this.dataBank = resData;
          this.createOrUpdateChart();
          this.initialGraphLoaded = true;
          if (!this.interval && this.selectedRange == "15m") {
            this.startLiveUpdate();
          }
        });
    },
    isFile(path) {
      return /\.\w+$/.test(path.split("/").pop());
    },
    truncatePath(path) {
      const parts = path.split("/");
      return parts.length > 4 ? "…/" + parts.slice(-3).join("/") : path;
    },
  },
};
</script>
