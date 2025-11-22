<template>
  <main class="flex-grow-1 overflow-auto mt-4 container">
    <section>
      <hr />
      <div
        class="d-flex flex-row justify-content-between align-items-center mb-4"
      >
        <div>
          <h3 class="fw-bold text-light">System Monitor</h3>
          <small class="text-secondary"
            >Real-time resource monitoring • {{ currentTime }}</small
          >
        </div>

        <div class="d-flex align-items-center gap-3">
          <small class="text-secondary">Updated: just now</small>
          <button
            @click="refresh"
            class="btn btn-outline-secondary btn-sm rounded-pill px-3"
          >
            <i class="fa-solid fa-rotate-right"></i>
          </button>
        </div>
      </div>

      <!-- CPU Topology + Live Chart Row -->
      <div class="row g-4 mb-4">
        <!-- CPU Core Details -->
        <div class="col-lg-4">
          <div class="glass-card p-4 h-100 text-light">
            <h5 class="mb-4">
              <i class="bi bi-cpu-fill text-primary me-2"></i>CPU Topology
            </h5>
            <div class="row text-center">
              <div class="col-6 mb-3">
                <div class="display-6 fw-bold text-primary">8</div>
                <small class="text-secondary">Physical Cores</small>
              </div>
              <div class="col-6 mb-3">
                <div class="display-6 fw-bold text-info">16</div>
                <small class="text-secondary">Logical Cores</small>
              </div>
              <div class="col-6">
                <div class="display-6 fw-bold text-cyan">2</div>
                <small class="text-secondary">Threads / Core</small>
              </div>
              <div class="col-6">
                <div class="display-6 fw-bold text-success">16</div>
                <small class="text-secondary">Total Threads</small>
              </div>
            </div>
            <div class="mt-3 text-center">
              <span class="badge bg-success fs-6"
                >Hyper-Threading: Enabled</span
              >
            </div>
          </div>
        </div>

        <!-- Live Chart (Chart.js via CDN) -->
        <div class="col-lg-8">
          <div class="glass-card p-4 h-100">
            <h5 class="text-light mb-3">
              <i class="bi bi-graph-up-arrow me-2"></i>CPU & RAM Usage (Live)
            </h5>
            <canvas ref="chartCanvas" height="280"></canvas>
          </div>
        </div>
      </div>

      <!-- RAM + Disk Cards -->
      <div class="row g-4">
        <div class="col-md-6">
          <div class="glass-card p-4 text-light">
            <div class="d-flex justify-content-between align-items-center mb-3">
              <h6 class="m-0">
                <i class="bi bi-memory text-primary me-2"></i>Memory (RAM)
              </h6>
              <span class="fs-4 fw-bold text-primary">{{ ramPercent }}%</span>
            </div>
            <div
              class="progress-ring mx-auto"
              :style="{ '--value': ramPercent }"
            >
              <span class="usage-text"
                >{{ ramUsed }} GB<br /><small class="text-secondary"
                  >of {{ ramTotal }} GB</small
                ></span
              >
            </div>
            <div class="mt-4 p-3 bg-dark bg-opacity-50 rounded text-center">
              <small
                >Available:
                <strong class="text-success"
                  >{{ (ramTotal - ramUsed).toFixed(1) }} GB</strong
                ></small
              >
            </div>
          </div>
        </div>

        <div class="col-md-6">
          <div class="glass-card p-4 text-light">
            <div class="d-flex justify-content-between align-items-center mb-3">
              <h6 class="m-0">
                <i class="bi bi-hdd-fill text-warning me-2"></i>Storage
              </h6>
              <span class="fs-4 fw-bold text-warning">70%</span>
            </div>
            <div class="progress-ring mx-auto text-warning" style="--value: 70">
              <span class="usage-text"
                >360 GB<br /><small class="text-secondary"
                  >of 512 GB</small
                ></span
              >
            </div>
            <div class="mt-4 p-3 bg-dark bg-opacity-50 rounded text-center">
              <small
                >Available: <strong class="text-success">152 GB</strong></small
              >
            </div>
          </div>
        </div>
      </div>
    </section>
  </main>
</template>

<script>
export default {
  data() {
    return {
      chart: null,
      currentTime: new Date().toLocaleTimeString(),
      dataPoints: [
        { ts: 1763629288, cpu: 35.7, ram_used: 11116, ram_total: 39806 },
        { ts: 1763629318, cpu: 1.5, ram_used: 11084, ram_total: 39806 },
        { ts: 1763629349, cpu: 7.6, ram_used: 11435, ram_total: 39806 },
        { ts: 1763629379, cpu: 6.0, ram_used: 11192, ram_total: 39806 },
        { ts: 1763629409, cpu: 1.5, ram_used: 11284, ram_total: 39806 },
      ],
      interval: null,
    };
  },
  computed: {
    ramPercent() {
      if (this.dataPoints.length === 0) return 0;
      const latest = this.dataPoints[this.dataPoints.length - 1];
      return Math.round((latest.ram_used / latest.ram_total) * 100);
    },
    ramUsed() {
      if (this.dataPoints.length === 0) return 0;
      return (
        this.dataPoints[this.dataPoints.length - 1].ram_used / 1024
      ).toFixed(1);
    },
    ramTotal() {
      return (this.dataPoints[0].ram_total / 1024).toFixed(0);
    },
  },
  mounted() {
    this.createChart();
    this.startLiveUpdate();
  },
  beforeUnmount() {
    if (this.interval) clearInterval(this.interval);
    if (this.chart) this.chart.destroy();
  },
  methods: {
    createChart() {
      const ctx = this.$refs.chartCanvas.getContext("2d");
      this.chart = new Chart(ctx, {
        type: "line",
        data: this.getChartData(),
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: "index", intersect: false },
          plugins: {
            legend: { labels: { color: "#ccc" } },
            tooltip: { mode: "index", intersect: false },
          },
          scales: {
            x: {
              ticks: { color: "#888" },
              grid: { color: "rgba(255,255,255,0.05)" },
            },
            y: {
              position: "left",
              ticks: { color: "#0d6efd" },
              grid: { color: "rgba(255,255,255,0.05)" },
              title: { display: true, text: "CPU %", color: "#0d6efd" },
            },
            y1: {
              position: "right",
              ticks: { color: "#20c997" },
              grid: { drawOnChartArea: false },
              title: { display: true, text: "RAM GB", color: "#20c997" },
            },
          },
        },
      });
    },
    getChartData() {
      return {
        labels: this.dataPoints.map((p) =>
          new Date(p.ts * 1000).toLocaleTimeString([], { second: "2-digit" })
        ),
        datasets: [
          {
            label: "CPU %",
            data: this.dataPoints.map((p) => p.cpu),
            borderColor: "#0d6efd",
            backgroundColor: "rgba(13,110,253,0.1)",
            fill: true,
            tension: 0.4,
            pointRadius: 3,
          },
          {
            label: "RAM Used (GB)",
            data: this.dataPoints.map((p) => (p.ram_used / 1024).toFixed(1)),
            borderColor: "#20c997",
            backgroundColor: "rgba(32,201,151,0.1)",
            fill: true,
            tension: 0.4,
            pointRadius: 3,
            yAxisID: "y1",
          },
        ],
      };
    },
    refresh() {
      // Simulate new data point
      const last = this.dataPoints[this.dataPoints.length - 1];
      const newPoint = {
        ts: Math.floor(Date.now() / 1000),
        cpu: Math.random() * 40 + 5,
        ram_used: last.ram_used + (Math.random() - 0.5) * 200,
        ram_total: last.ram_total,
      };
      this.dataPoints.push(newPoint);
      if (this.dataPoints.length > 50) this.dataPoints.shift();

      this.chart.data = this.getChartData();
      this.chart.update("quiet");
      this.currentTime = new Date().toLocaleTimeString();
    },
    startLiveUpdate() {
      this.interval = setInterval(this.refresh, 3000); // every 3 seconds
    },
  },
};
</script>

<style scoped>
.glass-card {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  backdrop-filter: blur(12px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.37);
  transition: all 0.3s ease;
}
.glass-card:hover {
  transform: translateY(-4px);
}

.progress-ring {
  position: relative;
  width: 180px;
  height: 180px;
  border-radius: 50%;
  background: conic-gradient(
    currentColor calc(var(--value) * 1%),
    rgba(255, 255, 255, 0.1) 0
  );
  display: flex;
  align-items: center;
  justify-content: center;
}
.progress-ring::before {
  content: "";
  position: absolute;
  inset: 15px;
  background: #0f172a;
  border-radius: 50%;
}
.usage-text {
  position: relative;
  font-size: 1.4rem;
  font-weight: bold;
  text-align: center;
  line-height: 1.2;
}
.text-cyan {
  color: #00d4ff;
}
</style>
