<template>
  <div class="row">
    <div class="col-lg-8 col-md-4 col-sm-12 background-container-bracket">
      <div class="background-container"></div>
    </div>

    <div
      class="auth-container col-lg-4 col-md-8 col-sm-12 d-flex justify-content-center align-items-center"
    >
      <div class="container">
        <img
          src="/public/images/code.svg"
          style="width: 80px; justify-self: center"
          class="d-flex"
        />
        <h2 class="fw-bold mb-5 text-center">🐚 Deployster Admin</h2>
        <section v-if="stage == 1">
          <form
            v-on:submit.prevent="postUserInputForAccountCreation()"
            id="signInForm"
          >
            <div class="mt-4 mb-3">
              <label class="form-label fw-bold text-muted"
                >Deployster Token</label
              >
              <input
                type="text"
                class="form-control"
                placeholder="Enter Deployster Token"
                v-model="token"
                required
              />
            </div>

            <div class="mb-3">
              <label class="form-label fw-bold text-muted">Username</label>
              <input
                type="text"
                class="form-control"
                placeholder="Preferred username"
                v-model="username"
                required
              />
            </div>
            <div class="mb-3">
              <label class="form-label fw-bold text-muted">Email Address</label>
              <input
                type="email"
                class="form-control"
                placeholder="Email Address"
                v-model="email"
                required
              />
            </div>
            <div class="mb-3">
              <label class="form-label fw-bold text-muted">Password</label>
              <input
                type="password"
                class="form-control"
                placeholder="Enter Password"
                v-model="password"
                required
              />
              <input
                type="password"
                class="form-control my-3"
                placeholder="Re-enter Password"
                v-model="password2"
                required
              />
            </div>

            <button
              v-if="!loading"
              class="btn btn-primary w-100 mt-3 mb-3"
              type="submit"
            >
              Create Admin Account
            </button>

            <div v-else>
              <button
                class="mb-3 w-100 btn btn-primary text-white fw-bold"
                type="button"
                disabled
              >
                <span
                  class="spinner-grow spinner-grow-sm"
                  role="status"
                  aria-hidden="true"
                ></span>
                <span class="sr-only"> &nbsp; Loading...</span>
              </button>
            </div>
          </form>
        </section>
        <section v-else>
          <div class="alert alert-success mt-5">
            <small class="fw-bold">
              <p>🚀 Big Cheers, Hacker!</p>

              <p>
                You're all set to deploy greatness. Love open source?
                <a
                  target="_blank"
                  href="https://github.com/AnclaTechs/vps-deployster"
                  >Check it out on GitHub</a
                >
              </p>
            </small>
          </div>
        </section>
        <p>
          Already have an account?
          <router-link to="/login">Login Here</router-link>
        </p>
      </div>
    </div>
  </div>
</template>

<script>
module.exports = {
  data: function () {
    return {
      loading: false,
      stage: 1,
      token: "",
      email: "",
      username: "",
      password: "",
      password2: "",
    };
  },

  methods: {
    proceedToStageTwo() {
      this.stage = 2;
    },
    postUserInputForAccountCreation() {
      if (this.password !== this.password2) {
        return toastr.error("Password must be the same");
      }

      this.loading = true;
      axios
        .post(
          `${this.$BACKEND_BASE_URL}/create-user-account`,
          {
            token: this.token,
            username: this.username,
            email: this.email,
            password: this.password,
          },
          this.$store.state.headers
        )
        .then((data) => {
          console.log({ data });
          toastr.success("Account created successfully");
          this.proceedToStageTwo();
        })
        .catch((err) => {
          console.log(err.response);
          if (err.response?.data) {
            toastr.error(
              err.response.data.message || "Error processing request"
            );
          } else {
            toastr.error("Error processing request");
          }
          this.loading = false;
        });
    },
  },
};
</script>
