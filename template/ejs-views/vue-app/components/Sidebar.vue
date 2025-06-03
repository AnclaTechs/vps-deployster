<style scoped>
.custom-sidebar {
  width: 280px;
  transition: width 0.3s;
  overflow: hidden;
  height: 100%;
}

.collapsed {
  width: 80px;
}

.toggle-btn {
  border: none;
  background: none;
  cursor: pointer;
  font-size: 20px;
}

.log-out-container {
  background-color: #f10f0f26;
  cursor: pointer;
}

.log-out-button {
  background-color: #ff0000ad;
  padding: 5px 10px;
  max-width: 120px;
  color: #ffffff;
  border-radius: 10px;
}
</style>
<template>
  <section>
    <div
      :class="[
        'd-flex flex-column flex-shrink-0 p-3 bg-light custom-sidebar',
        { collapsed: isSideBarCollapsed },
      ]"
    >
      <div
        class="w-100 d-flex align-items-center mb-3 mb-md-0 me-md-auto link-dark text-decoration-none"
      >
        <span v-if="!isSideBarCollapsed" class="fs-6">VPS Deployster</span>
        <button @click="toggleSidebar" class="m-auto toggle-btn">☰</button>
      </div>
      <hr />
      <ul class="nav nav-pills flex-column mb-auto">
        <!-- <li>
          <router-link
            to="/admin/users"
            class="nav-link"
            :class="{ active: $route.path === '/users' } || 'link-dark'"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              fill="currentColor"
              class="me-2 bi bi-people-fill"
              viewBox="0 0 16 16"
            >
              <path
                d="M7 14s-1 0-1-1 1-4 5-4 5 3 5 4-1 1-1 1zm4-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6m-5.784 6A2.24 2.24 0 0 1 5 13c0-1.355.68-2.75 1.936-3.72A6.3 6.3 0 0 0 5 9c-4 0-5 3-5 4s1 1 1 1zM4.5 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5"
              />
            </svg>
            <span v-if="!isSideBarCollapsed">Users</span>
          </router-link>
        </li> -->

        <li
          class="nav-link text-primary"
          style="cursor: pointer"
          data-bs-toggle="modal"
          data-bs-target="#systemSettingsModal"
        >
          <i class="fad fa-cog"></i> &nbsp;
          <span v-if="!isSideBarCollapsed">Settings</span>
        </li>
        <li class="nav-link log-out-container">
          <div @click="signOutUser()" class="log-out-button">
            <i class="far fa-sign-out"></i> &nbsp;
            <span v-if="!isSideBarCollapsed">Log Out</span>
          </div>
        </li>
      </ul>
    </div>
  </section>
</template>

<script>
module.exports = {
  data() {
    return {
      variant: "dark",
      isSideBarCollapsed: false,
    };
  },

  methods: {
    toggleSidebar() {
      this.isSideBarCollapsed = !this.isSideBarCollapsed;
    },
    signOutUser() {
      axios
        .post(`${this.$BACKEND_BASE_URL}/logout`, {}, this.$store.state.headers)
        .then((data) => {
          this.$store.commit("resetUserData");
          this.$router.push("/login");
          toastr.success("User logged out successfully");
        })
        .catch((err) => {
          toastr.error(err.response.data.message || "Error processing request");
        });
    },
  },
};
</script>
