<style scoped>
.log-out-container {
  background-color: #f10f0f26;
  cursor: pointer;
  padding: 10px;
  border-radius: 20px;
}

.log-out-button {
  background-color: #ff0000ad;
  padding: 5px 10px;
  width: 120px;
  color: #ffffff;
  border-radius: 10px;
  display: flex;
  align-items: center;
}
</style>

<template>
  <div class="container">
    <i
      :class="[
        'bi',
        sidebarIsCollapsed
          ? 'bi-arrows-expand-vertical'
          : 'bi-arrows-collapse-vertical',
        'fs-5',
      ]"
      style="cursor: pointer"
      @click="toggleSidebar()"
    ></i>
    <div class="mt-4 mb-3">
      <div class="d-flex flex-row justify-content-between align-items-center">
        <router-link
          :to="{ name: 'MainDashboard' }"
          class="text-decoration-none w-100 member-icon d-flex flex-row gap-2 align-items-center"
        >
          <img src="/public/images/code.svg" style="max-width: 40px" />

          <span class="fs-5 fw-bold" style="color: #000000c2">
            Deployster Admin
          </span>
        </router-link>

        <div class="log-out-container">
          <div @click="signOutUser()" class="log-out-button">
            <i class="far fa-sign-out me-2"></i> &nbsp;
            <span v-if="!isSideBarCollapsed">Log Out</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
module.exports = {
  props: {
    sidebarIsCollapsed: {
      type: Boolean,
      required: true,
    },
    toggleSidebar: {
      type: Function,
      required: true,
    },
  },
  data() {
    return {};
  },
  methods: {
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
