<template>
  <aside :class="['sidebar', sidebarIsCollapsed ? 'collapsed' : 'expanded']">
    <nav>
      <ul class="menu">
        <li
          @click="navigate('dashboard')"
          :class="{ active: isActive('dashboard') }"
        >
          <img
            src="https://www.svgrepo.com/show/449701/dashboard.svg"
            class="menu-icon"
          />
          Dashboard
        </li>

        <li @click="toggleSection('dbs')" :class="['section', {active: isActive('postgres')}]">
          <img
            src="https://www.svgrepo.com/show/485254/database.svg"
            class="menu-icon"
          />
          Databases
        </li>
        <ul v-if="sections.dbs" class="submenu">
          <li
            @click="navigate('database/postgres')"
            :class="{ active: isActive('postgres') }"
          >
            📘 PostgreSQL
          </li>
          <li
            @click="navigate('mysql')"
            :class="{ active: isActive('mysql') }"
            style="pointer-events: none"
          >
            🐬 MySQL
          </li>
        </ul>

        <li
          @click="navigate('redis-dash')"
          :class="{ active: isActive('redis') }"
        >
          <img
            src="https://www.svgrepo.com/show/303460/redis-logo.svg"
            class="menu-icon"
          />
          Redis
        </li>

        <li @click="toggleSection('tools')" class="section">
          🐳 Docker (Coming Soon)
        </li>
      </ul>
    </nav>
  </aside>
</template>

<script>
export default {
  name: "Sidebar",
  props: {
    sidebarIsCollapsed: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      isCollapsed: false,
      sections: {
        dbs: true,
        tools: false,
      },
    };
  },
  computed: {
    route() {
      return this.$route;
    },
  },
  methods: {
    toggleSection(section) {
      this.sections[section] = !this.sections[section];
    },
    navigate(path) {
      this.$router.push(`/${path}`);
    },
    isActive(path) {
      return this.route.path.includes(path);
    },
  },
};
</script>

<style scoped>
.sidebar {
  width: 240px;
  /* background-color: #0f172a; */
  background-color: #0f172ad9;
  color: #e2e8f0;
  height: 100vh;
  padding: 24px 16px;
  font-family: "Inter", sans-serif;
  box-shadow: 2px 0 4px rgba(0, 0, 0, 0.2);
}

.menu {
  list-style: none;
  padding: 0;
  margin: 0;
}

.menu-icon {
  max-height: 25px;
  max-width: 25px;
  object-fit: contain;
}

.menu > li {
  border-bottom: 0.5px dashed grey;
  padding-bottom: 10px;
  border-bottom-left-radius: unset !important;
  border-bottom-right-radius: unset !important;
}

.menu > li,
.submenu > li {
  /* padding: 10px 12px; */
  cursor: pointer;
  border-radius: 6px;
  transition: background 0.2s ease;
  display: flex;
  gap: 5px;
  align-items: center;
  padding: 10px 8px;
  font-size: 14px;
}

.menu > li:hover,
.submenu > li:hover {
  background-color: rgba(56, 189, 248, 0.15);
}

.active {
  background-color: rgba(16, 185, 129, 0.2);
  color: #10b981;
  font-weight: 600;
}

.section {
  margin-top: 16px;
  /* font-size: 14px; */
  font-weight: 500;
  color: #94a3b8;
}

.submenu {
  margin-left: 16px;
  margin-top: 4px;
}

.pending {
  opacity: 0.5;
  cursor: not-allowed;
}

@keyframes collapse-anime {
  0% {
    width: 240px;
  }
  100% {
    width: 0px;
  }
}

@keyframes expand-anime {
  0% {
    width: 0px;
  }
  100% {
    width: 240px;
  }
}

.collapsed {
  width: 0px;
  padding: 0px;
  animation-duration: 400ms;
  animation-name: collapse-anime;
}

.expanded {
  width: 240px;
  padding: 24px 16px;
  animation-duration: 400ms;
  animation-name: expand-anime;
}
</style>
