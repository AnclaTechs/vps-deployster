<style scoped>
.pipeline-form-group {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
}

.form-label {
  font-weight: 500;
  text-align: start;
}

.plus-env-button {
  max-width: 200px;
  height: 35px;
}
</style>
<template>
  <div>
    <button class="btn btn-primary" @click="showCreatePipelineModalFunc">
      Create Pipeline
    </button>

    <!-- Modal -->
    <div
      v-if="showCreatePipelineModal"
      class="modal d-block"
      tabindex="-1"
      style="background: rgba(0, 0, 0, 0.5)"
    >
      <div class="modal-dialog modal-lg modal-dialog-scrollable">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Create Pipeline</h5>
            <button type="button" class="btn-close" @click="cancel"></button>
          </div>

          <form ref="newPipelineForm" @submit.prevent="submitForm">
            <div class="modal-body">
              <div
                v-for="(pipeline, index) in pipelines"
                :key="index"
                class="border rounded p-3 mb-3"
              >
                <div class="pipeline-form-group mb-3">
                  <label class="form-label">Stage Name</label>
                  <input
                    v-model="pipeline.stage_name"
                    type="text"
                    class="form-control"
                    placeholder="e.g. Production"
                    required
                  />
                </div>

                <div class="pipeline-form-group mb-3">
                  <label class="form-label">Git Branch</label>
                  <input
                    v-model="pipeline.git_branch"
                    type="text"
                    class="form-control"
                    placeholder="e.g. main"
                    required
                  />
                </div>

                <!-- ENV VARS -->
                <div class="pipeline-form-group mb-2">
                  <label class="form-label">Environment Variables</label>
                  <div
                    v-for="(env, idx) in pipeline.environment_variables"
                    :key="idx"
                    class="d-flex gap-2 mb-2"
                  >
                    <input
                      v-model="env.key"
                      type="text"
                      class="form-control"
                      placeholder="KEY"
                      required
                    />
                    <input
                      v-model="env.value"
                      type="text"
                      class="form-control"
                      placeholder="VALUE"
                      required
                    />
                    <button
                      class="btn btn-outline-danger"
                      type="button"
                      @click="removeEnv(index, idx)"
                    >
                      &times;
                    </button>
                  </div>
                  <button
                    class="btn btn-outline-secondary btn-sm plus-env-button"
                    type="button"
                    @click="addEnv(index)"
                  >
                    + Add Env Variable
                  </button>
                </div>

                <button
                  class="btn btn-sm btn-danger mt-2"
                  type="button"
                  @click="removePipeline(index)"
                >
                  Remove Pipeline
                </button>
              </div>

              <button
                class="btn btn-outline-primary"
                type="button"
                @click="addPipeline"
              >
                + Add Another Pipeline
              </button>
            </div>

            <div v-if="!newRecordIsProcessing" class="modal-footer">
              <button class="btn btn-secondary" type="button" @click="cancel">
                Cancel
              </button>
              <button class="btn btn-success" type="submit">
                Save Pipelines
              </button>
            </div>
            <div
              v-else
              class="modal-footer d-flex justify-content-center align-items-center"
            >
              <div
                class="spinner-border spinner-border-md"
                aria-hidden="true"
              ></div>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: "CreatePipelineModal",
  props: {
    showCreatePipelineModal: {
      type: Boolean,
      required: true,
    },
    showCreatePipelineModalFunc: {
      type: Function,
      required: true,
    },
    hideCreatePipelineModalFunc: {
      type: Function,
      required: true,
    },
    createOrSaveNewPipelineToProject: {
      type: Function,
      required: true,
    },
    fetchPipelines: {
      type: Function,
      required: true,
    },
  },
  data() {
    return {
      newRecordIsProcessing: false,
      pipelines: [],
    };
  },
  methods: {
    addPipeline() {
      this.pipelines.push({
        stage_name: "",
        git_branch: "",
        environment_variables: [{ key: "", value: "" }],
      });
    },

    removePipeline(index) {
      this.pipelines.splice(index, 1);
    },

    addEnv(pipelineIndex) {
      this.pipelines[pipelineIndex].envVars.push({ key: "", value: "" });
    },

    removeEnv(pipelineIndex, envIndex) {
      this.pipelines[pipelineIndex].envVars.splice(envIndex, 1);
    },

    cancel() {
      this.hideCreatePipelineModalFunc();
      this.pipelines = [];
    },

    async submitForm() {
      if (this.$refs?.newPipelineForm) {
        if (this.$refs.newPipelineForm.checkValidity()) {
          this.newRecordIsProcessing = true;
          this.createOrSaveNewPipelineToProject(this.pipelines)
            .then((res) => {
              if (res) {
                this.fetchPipelines();
                this.hideCreatePipelineModalFunc();
              } else {
                //PASS
              }
            })
            .finally(() => {
              this.newRecordIsProcessing = false;
            });
        } else {
          this.$refs.newPipelineForm.reportValidity();
        }
      }
    },
  },
};
</script>
