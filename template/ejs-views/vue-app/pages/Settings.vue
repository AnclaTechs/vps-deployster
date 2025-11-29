<template>
  <main class="flex-grow-1 overflow-auto mt-4 container">
    <hr />
    <div class="d-flex flex-row justify-content-between align-items-center">
      <div>
        <h3 class="fw-bold">Settings</h3>
        <small>Manage your system configurations and preference</small>
      </div>
    </div>

    <div class="py-5">
      <div class="row">
        <div class="col">
          <!-- 2FA Card -->
          <div class="card shadow-sm mb-5">
            <div class="card-header bg-gradient bg-primary text-white">
              <h5 class="mb-0">
                <i :hidden="!twofa.enabled" class="fas fa-shield-alt me-2"></i>
                Two-Factor Authentication (2FA)
              </h5>
            </div>
            <div class="card-body">
              <!-- Loading -->
              <div v-if="twofa.loading" class="text-center py-5">
                <div class="spinner-border text-primary" role="status">
                  <span class="visually-hidden">Loading...</span>
                </div>
              </div>

              <!-- 2FA Disabled -->
              <div v-else-if="!twofa.enabled && !twofa.settingUp">
                <div class="text-center text-lg-start">
                  <div class="d-flex align-items-center mb-4">
                    <div class="flex-shrink-0">
                      <i class="fas fa-shield-alt text-muted display-3"></i>
                    </div>
                    <div class="ms-4">
                      <h5>2FA is not enabled</h5>
                      <p class="text-muted mb-3">
                        Add an extra layer of security using Google
                        Authenticator or Authy.
                      </p>

                      <div v-if="twofa.hasConfig && !twofa.enabled">
                        <!-- This shows If MFA is enabled globally but user hasn't set it up -->
                        <button
                          @click="start2FASetup"
                          class="btn btn-primary btn-sm py-2 px-3 rounded-pill"
                        >
                          <i class="fas fa-plus me-2"></i>Enable 2FA
                        </button>
                      </div>
                    </div>
                  </div>

                  <!-- If MFA is globally disabled in .env -->
                  <div
                    v-if="!twofa.hasConfig"
                    class="alert alert-danger border-0 shadow-sm"
                  >
                    <h6 class="alert-heading">
                      <i class="fas fa-exclamation-triangle me-2"></i>
                      Missing 2FA configuration in Deployster environment
                      variables.
                    </h6>

                    <hr class="my-3" />

                    <p class="mb-2 fw-bold">Required variables:</p>
                    <pre
                      class="bg-dark text-white p-3 rounded mb-3 small overflow-auto"
                    ><code>DEPLOYSTER_USE_MFA=true</code></pre>
                  </div>
                </div>
              </div>

              <!-- 2FA Setup -->
              <div v-else-if="twofa.settingUp">
                <div class="alert alert-warning">
                  <strong>Step 1:</strong> Scan the QR code with
                  <strong>Google Authenticator</strong> or any TOTP app.
                </div>

                <div class="row">
                  <div class="col-md-6 text-center">
                    <div
                      ref="qrcode"
                      class="border rounded p-3 bg-white shadow-sm d-flex justify-content-center"
                    ></div>
                    <p class="mt-3 small text-muted">
                      Can't scan? Use this code:
                    </p>
                    <code
                      class="d-block bg-dark text-white p-2 rounded font-monospace"
                    >
                      {{ twofa.secret }}
                    </code>
                  </div>

                  <form @submit.prevent="verify2FA" class="col-md-6">
                    <div>
                      <div class="form-group">
                        <label class="form-label fw-bold"
                          >Authenticator Label <br /><small
                            class="text-muted fw-normal"
                            >So you can recognize it later</small
                          >
                        </label>

                        <input
                          required
                          v-model="twofa.label"
                          type="text"
                          maxlength="20"
                          class="form-control"
                          placeholder="e.g. My XYZ, Zoho Authenticator IV, Staging Auth"
                        />
                      </div>
                      <div class="form-group mt-2">
                        <label class="form-label fw-bold"
                          >Enter 6-digit code</label
                        >
                        <input
                          required
                          v-model="twofa.otp"
                          type="text"
                          maxlength="6"
                          class="form-control"
                          placeholder="123456"
                        />
                      </div>
                      <div
                        v-if="!twofa.completingSetup"
                        class="mt-3 d-grid gap-2 d-md-flex"
                      >
                        <button type="submit" class="btn btn-success me-md-2">
                          Verify & Activate
                        </button>
                        <button
                          @click="cancel2FASetup"
                          class="btn btn-secondary"
                        >
                          Cancel
                        </button>
                      </div>
                      <div v-else class="text-center">
                        <div class="spinner-border text-primary" role="status">
                          <span class="visually-hidden">Loading...</span>
                        </div>
                      </div>
                    </div>
                  </form>
                </div>
              </div>

              <!-- 2FA Enabled -->
              <div v-else>
                <div class="row align-items-center">
                  <div class="col-auto">
                    <i class="fas fa-check-circle text-success display-4"></i>
                  </div>
                  <div class="col">
                    <h5 class="text-success">2FA is Active</h5>
                    <p class="text-muted">
                      Your account is protected with two-factor authentication.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Email Notifications Card -->
          <div class="card shadow-sm">
            <div class="card-header bg-gradient bg-teal text-white">
              <h5 class="mb-0">
                <i class="fas fa-envelope me-2"></i>
                Email Notifications (SMTP)
              </h5>
            </div>
            <div class="card-body">
              <div
                class="d-flex align-items-center justify-content-between mb-4"
              >
                <div>
                  <h5 :class="smtp.active ? 'text-success' : 'text-danger'">
                    {{
                      smtp.active
                        ? "Email notifications are ACTIVE"
                        : "Email notifications are disabled"
                    }}
                  </h5>
                  <p class="text-muted mb-0">
                    Deployment status, application crashes, and unusual spikes
                    in resource or CPU usage.
                  </p>
                </div>
                <span
                  :class="smtp.active ? 'bg-success' : 'bg-danger'"
                  class="badge text-white fs-6 px-4 py-2"
                >
                  <i :class="smtp.active ? 'fas fa-check' : 'fas fa-times'"></i>
                  {{ smtp.active ? "Active" : "Not Configured" }}
                </span>
              </div>

              <hr />

              <h6>How to enable email notifications</h6>
              <p class="text-muted">
                Add these variables to your <code>.env</code> file and restart
                your deployster app:
              </p>

              <pre
                class="bg-dark text-white p-4 rounded mb-4 overflow-auto"
              ><code>
DEPLOYSTER_SMTP_HOST=your.smtp.com
DEPLOYSTER_SMTP_PORT=587
DEPLOYSTER_SMTP_USER=your-email@gmail.com
DEPLOYSTER_SMTP_PASS=your-app-password
# Optional
DEPLOYSTER_SMTP_FROM_NAME=Deployster
DEPLOYSTER_SMTP_FROM_EMAIL=no-reply@yourdomain.com
              </code></pre>

              <div class="alert alert-info">
                <strong>Tips:</strong>
                <ul class="mb-0 mt-2">
                  <li>Port 587 = TLS (recommended), Port 465 = SSL</li>
                  <li>Restart your Deployster app after updating .env</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>

<script>
export default {
  name: "SettingsPage",
  data() {
    return {
      twofa: {
        loading: true,
        completingSetup: false,
        hasConfig: false,
        enabled: false,
        settingUp: false,
        secret: "",
        totp: "",
        label: "",
      },
      smtp: {
        active: false,
        hasConfig: false,
        loading: true,
      },
    };
  },

  mounted() {
    this.loadSettings();
    this.$loadScript(
      "https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"
    );
  },

  methods: {
    async loadSettings() {
      axios
        .get(`${this.$BACKEND_BASE_URL}/settings`, this.$store.state.headers)
        .then((res) => {
          const data = res.data.data;
          console.log({ data });
          this.twofa.hasConfig = data.hasMfaConfig;
          this.twofa.enabled = data.mfaIsActive;
          this.twofa.loading = false;

          //
          this.smtp.active = data.hasEmailConfig;
          this.smtp.hasConfig = data.hasEmailConfig;
          this.smtp.loading = false;
        })
        .catch((err) => {
          toastr.error(err.response?.data?.message || "Error fetching data");
        });
    },

    async start2FASetup() {
      this.twofa.settingUp = true;
      this.twofa.loading = true;

      axios
        .post(
          `${this.$BACKEND_BASE_URL}/settings/generate-mfa-secret`,
          {},
          this.$store.state.headers
        )
        .then((res) => {
          const data = res.data.data;
          console.log({ data });

          this.twofa.secret = data.secret;
          this.twofa.loading = false;

          this.$nextTick(() => {
            this.$refs.qrcode.innerHTML = "";

            new QRCode(this.$refs.qrcode, {
              text: data.otpAuthUrl,
              width: 200,
              height: 200,
              colorDark: "#000000",
              colorLight: "#ffffff",
              correctLevel: QRCode.CorrectLevel.H,
            });
          });
        })
        .catch((err) => {
          console.log(err);
          toastr.error(err.response?.data?.message || "Error fetching data");
        });
    },

    verify2FA() {
      if (this.twofa.otp.length !== 6 || !/^\d+$/.test(this.twofa.otp)) {
        this.$toast.error("Please enter a valid 6-digit code");
        return;
      }

      this.twofa.completingSetup = true;

      axios
        .post(
          `${this.$BACKEND_BASE_URL}/settings/complete-mfa-setup`,
          {
            secret_base32: this.twofa.secret,
            label: this.twofa.label,
            totp: this.twofa.otp,
          },
          this.$store.state.headers
        )
        .then((res) => {
          if (res.data.success) {
            toastr.success("2FA activated successfully!");
            this.twofa.enabled = true;
            this.twofa.settingUp = false;
            this.twofa.otp = "";
          }
        })
        .catch((err) => {
          console.log(err);
          toastr.error(err.response?.data?.message || "Error fetching data");
        })
        .finally(() => {
          this.twofa.completingSetup = false;
        });
    },

    cancel2FASetup() {
      this.twofa.settingUp = false;
      this.twofa.secret = "";
      this.twofa.otp = "";
      if (this.$refs.qrcode) this.$refs.qrcode.innerHTML = "";
    },
  },
};
</script>

<style scoped>
.bg-gradient {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}
.bg-teal {
  background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
}
</style>
