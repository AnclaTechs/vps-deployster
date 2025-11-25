const { createApp, ref, defineAsyncComponent, defineComponent } = Vue;
const { createStore } = Vuex;
const { createRouter, createWebHashHistory } = VueRouter;
const { loadModule } = window["vue3-sfc-loader"];

const httpLoaderOption = {
  moduleCache: {
    vue: Vue,
  },
  async getFile(url) {
    const res = await fetch(url);
    if (!res.ok)
      throw Object.assign(new Error(res.statusText + " " + url), { res });
    return {
      getContentData: (asBinary) => (asBinary ? res.arrayBuffer() : res.text()),
    };
  },
  addStyle(textContent) {
    const style = Object.assign(document.createElement("style"), {
      textContent,
    });
    const ref = document.head.getElementsByTagName("style")[0] || null;
    document.head.insertBefore(style, ref);
  },
};

const components = {
  MainLayout: defineAsyncComponent(() =>
    loadModule("/vue/layouts/MainLayout.vue", httpLoaderOption)
  ),
  LoginPage: () => loadModule("/vue/Login.vue", httpLoaderOption),
  RegisterPage: () => loadModule("/vue/Signup.vue", httpLoaderOption),
  DashboardPage: () => loadModule("/vue/Dashboard.vue", httpLoaderOption),
  ProjectViewPage: () => loadModule("/vue/ProjectView.vue", httpLoaderOption),
  RedisDashboard: () =>
    loadModule("/vue/pages/RedisDashboard.vue", httpLoaderOption),
  PostgresDashboard: () =>
    loadModule("/vue/pages/database/PostgresMain.vue", httpLoaderOption),
  PostgresClusterAnalytics: () =>
    loadModule(
      "/vue/pages/database/PostgresClusterAnalytics.vue",
      httpLoaderOption
    ),
  PostgresDbVisualizer: () =>
    loadModule(
      "/vue/pages/database/PostgresDbVisualizer.vue",
      httpLoaderOption
    ),
  MonitorDashboard: () =>
    loadModule("/vue/pages/MonitorDashboard.vue", httpLoaderOption),
  SettingsPage: () => loadModule("/vue/pages/Settings.vue", httpLoaderOption),
};

const routes = [
  { path: "/", component: components.LoginPage },
  { path: "/login", component: components.LoginPage },
  { path: "/register", component: components.RegisterPage },
  {
    path: "/dashboard",
    name: "MainDashboard",
    component: components.DashboardPage,
    meta: { requiresAuth: true },
  },
  {
    path: "/project/:id",
    name: "ProjectView",
    component: components.ProjectViewPage,
    props: true,
    meta: { requiresAuth: true },
  },
  {
    path: "/redis-dash",
    name: "RedisDashboard",
    component: components.RedisDashboard,
    meta: { requiresAuth: true },
  },
  {
    path: "/database/postgres",
    name: "PostgresDatabase",
    component: components.PostgresDashboard,
    meta: { requiresAuth: true },
  },
  {
    path: "/database/postgres/:cluster/analytics",
    name: "PostgresClusterAnalytics",
    component: components.PostgresClusterAnalytics,
    meta: { requiresAuth: true },
  },
  {
    path: "/database/postgres/:cluster/:database/visualizer",
    name: "PostgresDbVisualizer",
    component: components.PostgresDbVisualizer,
    meta: { requiresAuth: true },
  },
  {
    path: "/sys-monitor",
    name: "MonitorDashboard",
    component: components.MonitorDashboard,
    meta: { requiresAuth: true },
  },
  {
    path: "/settings",
    name: "SettingsPage",
    component: components.SettingsPage,
    meta: { requiresAuth: true },
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

router.beforeEach((to, from) => {
  store.commit("setLoader", true);
});

router.afterEach(() => {
  store.commit("setLoader", false);
});

const store = createStore({
  state: {
    showLoader: true,
    userData: { token: null },
    headers: {
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: localStorage.getItem("token", null),
      },
    },
  },
  mutations: {
    updateUserData(state, object) {
      state.userData = object?.user;
      if (object?.token) {
        state.headers["headers"]["Authorization"] = object?.token;
        localStorage.setItem("token", object.token);
      }
    },
    resetUserData(state) {
      state.userData = { token: null };
      state.headers = {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: null,
        },
      };
      localStorage.removeItem("token");
    },
    setLoader(state, status) {
      state.showLoader = status;
    },
  },
});

const app = createApp({
  template: `
    <router-view v-slot="{ Component }">
      <transition name="fade">
        <component
          :is="shouldUseMainLayoutComponent ? 'MainLayoutComponent' : Component"
          :primaryChildComponent="shouldUseMainLayoutComponent ? Component : null"
        />
      </transition>
    </router-view>
  `,
  data() {
    return {};
  },
  components: {
    MainLayoutComponent: components.MainLayout,
  },
  computed: {
    shouldUseMainLayoutComponent() {
      return this.$router.currentRoute.value.meta?.requiresAuth === true;
    },
  },
  methods: {},
  watch: {},
  mounted() {
    console.log("App is Mounted");
  },
  delimiters: ["[[", "]]"],
  compilerOptions: {
    delimiters: ["[[", "]]"],
  },
});

app.use(store);
app.use(router);
app.config.globalProperties.$BACKEND_BASE_URL = window.VUE_BASE_API_URL || "";
app.config.globalProperties.$httpLoaderOption = { ...httpLoaderOption };
window.$httpLoaderOption = { ...httpLoaderOption };
app.config.globalProperties.$checkAuthentication = async function () {
  let currentPath = router.currentRoute.value.path;

  if (currentPath !== "/login") {
    if (!localStorage.getItem("token")) {
      router.push("/login");
      toastr.error("Invalid authentication details");
      return;
    }

    try {
      const res = await axios.get(
        `${this.$BACKEND_BASE_URL}/user`,
        store.state.headers
      );
      store.commit("updateUserData", {
        user: res.data.data.user,
      });
    } catch (err) {
      router.push("/login");
      toastr.error(err.response?.data?.message || "Authentication failed");
    }
  }
};
app.config.globalProperties.$dbVisualiserAuthRequired = ref({
  status: true,
  database: null,
  version: null,
});
app.config.globalProperties.$dbVisualiserAuthenticatorFunc = function (
  apiResponse,
  database = null,
  version = null
) {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let randomChar = "";
  for (let i = 0; i < 15; i++) {
    randomChar += characters.charAt(
      Math.floor(Math.random() * characters.length)
    );
  }

  if (typeof apiResponse.dbVisualiserAuthRequired == "undefined") {
    app.config.globalProperties.$dbVisualiserAuthRequired.value = {
      randomChar,
      database,
      version,
      status: true,
    };
  } else {
    app.config.globalProperties.$dbVisualiserAuthRequired.value = {
      randomChar,
      database,
      version,
      status: apiResponse.dbVisualiserAuthRequired,
    };
  }
};

app.config.globalProperties.$loadScript = function (src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
};

app.config.globalProperties.$loadStyle = function (href) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`link[href="${href}"]`)) {
      resolve();
      return;
    }
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.onload = resolve;
    link.onerror = reject;
    document.head.appendChild(link);
  });
};

app.mount("#app");
