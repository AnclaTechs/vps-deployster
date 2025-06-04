const { createApp, ref, defineAsyncComponent } = Vue;
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
  LoginPage: () => loadModule("/vue/Login.vue", httpLoaderOption),
  RegisterPage: () => loadModule("/vue/Signup.vue", httpLoaderOption),
  DashboardPage: () => loadModule("/vue/Dashboard.vue", httpLoaderOption),
  ProjectViewPage: () => loadModule("/vue/ProjectView.vue", httpLoaderOption),
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
  data() {
    return {};
  },
  computed: {},
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

app.mount("#app");
