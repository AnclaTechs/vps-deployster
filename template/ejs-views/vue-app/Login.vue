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
        <h2 class="fw-bold text-center">🐚 Deployster Admin</h2>
        <section class="mt-3">
          <form id="signInForm">
            <div class="mt-3">
              <label class="my-2 text-muted fw-bold">Username</label>
              <input
                type="text"
                v-model="username"
                class="form-control"
                placeholder="Enter your registered email or username"
                required=""
              />
              <div class="mt-3 mb-3">
                <label class="my-2 text-muted fw-bold">Password</label>
                <input
                  type="password"
                  v-model="password"
                  class="form-control"
                  placeholder="Password"
                  required
                />
              </div>
            </div>

            <a
              v-if="!loading"
              @click="loginUser()"
              class="btn btn-primary w-100 mb-3"
              type="submit"
            >
              Log In
            </a>

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

        <p>
          Don't have an Admin account?
          <router-link to="/register">Create Account</router-link>
        </p>

        <div class="alert alert-primary mt-5">
          <small class=""
            >{{ randomQuote.quote }}
            <strong> -- {{ randomQuote.author }}</strong>
          </small>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
module.exports = {
  data: function () {
    return {
      loading: false,
      username: "",
      password: "",
      quotes: [
        {
          quote: "Computer science is the operating system for all Innovation.",
          author: "Steve Ballmer",
        },
        {
          quote:
            "In DevOps, we don’t just build systems; we automate trust and scale dreams.",
          author: "Anonymous",
        },
        {
          quote: "Code is poetry, but debugging is detective work.",
          author: "Anonymous",
        },
        {
          quote:
            "A good engineer is someone who can do for a dollar what any fool can do for two.",
          author: "Arthur M. Wellington",
        },
        {
          quote: "Servers don’t crash; they just take unscheduled naps.",
          author: "Anonymous",
        },
        {
          quote:
            "The best way to secure a system is to assume it’s already been hacked.",
          author: "Kevin Mitnick",
        },
        {
          quote: "Programming is not about typing; it’s about thinking.",
          author: "Rich Hickey",
        },
        {
          quote:
            "In DevOps, we don’t fix problems; we prevent them with pipelines and monitoring.",
          author: "Anonymous",
        },
        {
          quote:
            "The art of engineering is turning chaos into order, one commit at a time.",
          author: "Anonymous",
        },
        {
          quote:
            "Hackers don’t break systems; they find the cracks we forgot to seal.",
          author: "Anonymous",
        },
        {
          quote: "Good code is its own best documentation.",
          author: "Steve McConnell",
        },
        {
          quote:
            "DevOps is not a toolset; it’s a mindset where failure is just feedback.",
          author: "Anonymous",
        },
        {
          quote: "A server without logs is like a ship without a compass.",
          author: "Anonymous",
        },
        {
          quote: "The only way to go fast is to go well.",
          author: "Robert C. Martin",
        },
        {
          quote:
            "Security is not a product; it’s a process baked into every layer of your stack.",
          author: "Anonymous",
        },
        {
          quote:
            "Engineering is the art of making what you want from things you can get.",
          author: "Jerry Pournelle",
        },
        {
          quote:
            "In programming, the hard part isn’t solving problems, but deciding what problems to solve.",
          author: "Paul Graham",
        },
        {
          quote: "A DevOps engineer’s superpower is making deployments boring.",
          author: "Anonymous",
        },
        {
          quote:
            "If you think good architecture is expensive, try bad architecture.",
          author: "Brian Foote",
        },
        {
          quote:
            "The best defense against a hacker is a system that’s too boring to attack.",
          author: "Anonymous",
        },
        {
          quote:
            "Code is like a joke: if you have to explain it, it’s probably not that good.",
          author: "Cory House",
        },
      ],
      randomQuote: {},
    };
  },
  created() {
    this.randomQuote =
      this.quotes[Math.floor(Math.random() * this.quotes.length)];
  },

  methods: {
    loginUser() {
      if (!this.username) {
        return toastr.error("Enter a valid email or username");
      } else {
        if (this.username.includes("@")) {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(this.username)) {
            return toastr.error("Invalid Email address");
          }
        } else if (this.username.length < 3) {
          return toastr.error("Enter a valid email or username");
        }
      }

      this.loading = true;
      axios
        .post(
          `${this.$BACKEND_BASE_URL}/login`,
          { username: this.username, password: this.password },
          this.$store.state.headers
        )
        .then((res) => {
          const userData = res.data.data;
          this.$store.commit("updateUserData", userData);
          if (!userData.user.isAdmin) {
            this.$router.push("/dashboard");
          } else {
            this.$router.push("/admin");
          }
          this.loading = false;
        })
        .catch((err) => {
          console.log(err);
          if (err.response?.data) {
            toastr.error(
              err.response.data?.message || "Error processing request"
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
