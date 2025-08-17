<template>
  <div class="layout">
    <Sidebarx :sidebarIsCollapsed="sidebarIsCollapsed" />
    <div class="main-content">
      <Headerx
        :sidebarIsCollapsed="sidebarIsCollapsed"
        :toggleSidebar="toggleSidebar"
      />
      <component :is="primaryChildComponent" />
    </div>
  </div>
</template>

<script>
export default {
  components: {
    Sidebarx: defineAsyncComponent(() =>
      loadModule("/vue/components/Sidebar.vue", window.$httpLoaderOption)
    ),
    Headerx: defineAsyncComponent(() =>
      loadModule("/vue/components/Header.vue", window.$httpLoaderOption)
    ),
  },
  props: {
    primaryChildComponent: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      sidebarIsCollapsed: false,
    };
  },
  methods: {
    toggleSidebar() {
      this.sidebarIsCollapsed = !this.sidebarIsCollapsed;
    },
  },
  mounted() {
    console.log("got here 223"); // ✅ Safe here
    console.log("object");
  },
};
</script>

<style scoped>
.layout {
  display: flex;
  height: 100vh;
  background-color: #f8fafc;
}

.main-content {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  background-color: #f1f5f9; /* light background for contrast */
}
</style>
