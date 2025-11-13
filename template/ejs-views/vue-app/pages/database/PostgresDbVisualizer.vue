<style scoped>
.dbname {
  letter-spacing: 2px;
  font-variant: all-small-caps;
}
.visualiser-tab--container {
  display: flex;
  flex-direction: row;
  gap: 10px;
}

.visualiser-tab--item {
  cursor: pointer;
  padding: 8px 20px;
  background: darkgray;
  border-radius: 20px;
  font-weight: bold;
  font-size: 14px;
  color: #292929;
}

.active-item {
  background: #677189 !important;
  color: #fffafa !important;
}

.pg-query-tab-container {
  color: #ccc;
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.pg-tab-bar {
  display: flex;
  align-items: center;
  background: #282a36;
  padding: 4px 6px;
  gap: 4px;
}

.pg-tab-item {
  display: flex;
  align-items: center;
  background: #3a3a3a;
  border-radius: 8px 8px 0 0;
  padding: 4px 12px;
  cursor: pointer;
  position: relative;
  transition: background 0.2s ease;
}

.pg-tab-item.active {
     background: #90a8cd;
    color: #fff;
    font-weight: 550;
}

.pg-tab-name {
  font-size: 13px;
  white-space: nowrap;
}

.pg-tab-close-btn {
  border: none;
  background: transparent;
  color: #ccc;
  margin-left: 8px;
  font-size: 13px;
  cursor: pointer;
  border-radius: 50%;
  transition: color 0.2s ease;
}

.pg-tab-close-btn:hover {
  color: #fff;
  background: red;
  font-weight: 600;
}

.pg-tab-add-btn {
  background: #3a3a3a;
  color: #ffffff;
  border: none;
  border-radius: 50%;
  font-size: 16px;
  width: 24px;
  height: 24px;
  margin-left: 6px;
  cursor: pointer;
  line-height: 24px;
  transition: all 0.2s ease;
}

.pg-tab-add-btn:hover {
  background: #f2f2f2;
  color: #3a3a3a;
}

.pg-tab-content {
  flex: 1;
  padding: 8px;
  border-top: 1px solid #333;
}
</style>

<template>
  <main class="flex-grow-1 overflow-auto mt-4 container">
    <section>
      <hr />
      <h4 class="mb-3">
        <i class="bi bi-database-fill"></i>
        <span class="dbname">{{ databaseInView }}</span> Database Visualizer
      </h4>

      <div class="visualiser-tab--container">
        <div
          v-for="tab in tabs"
          :key="tab.slug"
          :class="['visualiser-tab--item', tab.active && 'active-item']"
          @click="switchToTab(tab.slug)"
        >
          {{ tab.title }}
        </div>
      </div>

      <div v-show="tabIsActive == 'editor'" class="mt-4 query-editor">
        <div class="pg-query-tab-container">
          <!-- Tab Bar -->
          <div class="pg-tab-bar">
            <div
              v-for="(pgEditorTab, index) in pgEditorTabs"
              :key="pgEditorTab.id"
              :class="['pg-tab-item', { active: index === activePgEditorTabIndex }]"
              @click="activePgEditorTabIndex = index"
            >
              <span class="pg-tab-name">{{ pgEditorTab.name }}</span>
              <button class="pg-tab-close-btn" @click.stop="closePgEditorTab(index)">×</button>
            </div>

            <!-- Add (+) Button -->
            <button class="pg-tab-add-btn" @click="addPgEditorTab">+</button>
          </div>

          <!-- Tab Content -->
          <div class="pg-tab-content">
            <PgQueryEditor
              v-for="(pgEditorTab, index) in pgEditorTabs"
              v-show="index === activePgEditorTabIndex"
              :key="pgEditorTab.id"
              :databaseInView="databaseInView"
              :clusterData="clusterData"
              :clusterDataInSession="clusterDataInSession"
            />
          </div>
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
  name: "PostgresDbVisualizer",
  components: {
    PasswordModal: defineAsyncComponent(() =>
      loadModule(
        "/vue/components/database/DatabasePasswordModal.vue",
        window.$httpLoaderOption
      )
    ),
    PgQueryEditor: defineAsyncComponent(() =>
      loadModule(
        "/vue/components/database/PgQueryEditor.vue",
        window.$httpLoaderOption
      )
    ),
  },
  data() {
    return {
      clusterData: null,
      databaseInView: null,
      tabIsActive: "table",
      tabs: [
        {
          title: "Table",
          active: true,
          slug: "table",
        },
        {
          title: "Indexes",
          active: false,
          slug: "indexes",
        },
        {
          title: "Constraints",
          active: false,
          slug: "constraints",
        },
        {
          title: "Query Editor",
          active: false,
          slug: "editor",
        },
        {
          title: "Security & Settings",
          active: false,
          slug: "settings",
        },
      ],
       pgEditorTabs: [],
      activePgEditorTabIndex: 0,
    };
  },
  computed: {
    clusterDataInSession() {
      return {
        version: String(this.clusterData).split("-")[0],
        port: String(this.clusterData).split("-")[1],
      };
    },
  },
  methods: {
    switchToTab(slug) {
      if (this.tabIsActive != slug) {
        this.tabs = this.tabs.map((data) => {
          return {
            ...data,
            active: data.slug === slug,
          };
        });
        this.tabIsActive = slug;
        if (slug == "editor") {
          if(this.pgEditorTabs.length == 0){
            this.addPgEditorTab()
          }
        }
      }
    },
    addPgEditorTab() {
      const id = Date.now();
      const slugNo = Number(this.pgEditorTabs.at(-1)?.slugNo || 0) + 1
      this.pgEditorTabs.push({ id, slugNo, name: `Query ${slugNo}` });
      this.activePgEditorTabIndex = this.pgEditorTabs.length - 1;
    },
    closePgEditorTab(index) {
      this.pgEditorTabs.splice(index, 1);

      if (this.pgEditorTabs.length === 0) {
        this.addPgEditorTab(); // always keep one tab open
      } else if (this.activePgEditorTabIndex >= this.pgEditorTabs.length) {
        this.activePgEditorTabIndex = this.pgEditorTabs.length - 1;
      }
    },
  },

  mounted() {
    this.clusterData = this.$route.params.cluster;
    this.databaseInView = this.$route.params.database;
  },
};
</script>
