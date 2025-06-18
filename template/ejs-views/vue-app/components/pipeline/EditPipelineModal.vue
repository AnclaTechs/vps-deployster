<style scoped>
.form-label {
  font-weight: 500;
}
</style>
<template>
  <div
    v-if="showEditPipelineModal"
    class="modal d-block"
    tabindex="-1"
    style="background: rgba(0, 0, 0, 0.5)"
  >
    <div class="modal-dialog modal-lg modal-dialog-scrollable">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Edit Pipeline: {{ pipeline.stageName }}</h5>
          <button type="button" class="btn-close" @click="cancel" />
        </div>
        <div class="modal-body">
          <div class="mb-3">
            <label class="form-label">Stage Name</label>
            <input
              v-model="pipeline.stage_name"
              type="text"
              class="form-control"
            />
          </div>
          <div class="mb-3">
            <label class="form-label">Git Branch</label>
            <input
              v-model="pipeline.git_branch"
              type="text"
              class="form-control"
            />
          </div>

          <div class="mb-2">
            <label class="form-label">Environment Variables</label>
            <div
              v-for="(env, idx) in pipeline.environment_variables"
              :key="idx"
              class="d-flex gap-2 mb-2"
            >
              <input v-model="env.key" class="form-control" placeholder="KEY" />
              <input
                v-model="env.value"
                class="form-control"
                placeholder="VALUE"
              />
              <button class="btn btn-outline-danger" @click="removeEnv(idx)">
                &times;
              </button>
            </div>
            <button class="btn btn-outline-secondary btn-sm" @click="addEnv">
              + Add Env Variable
            </button>
          </div>

          <div class="border-top alert alert-danger mt-3">
            <div class="form-check my-2">
              <input
                class="form-check-input"
                type="checkbox"
                v-model="confirmPipelineStageDelete"
              />
              <label
                class="form-check-label text-danger"
                for="confirmPipelineStageDelete"
              >
                <strong>Remove Stage?</strong> I understand that this action
                will delete this pipeline stage.
              </label>
            </div>
          </div>
        </div>

        <div
          v-if="!dataIsProcessing"
          class="modal-footer d-flex justify-content-between"
        >
          <div v-if="confirmPipelineStageDelete">
            <button class="btn btn-danger" @click="deletePipeline">
              Delete Pipeline Stage
            </button>
          </div>

          <div
            :class="{
              'd-flex': true,
              'gap-2': true,
              'w-100': !confirmPipelineStageDelete,
              'justify-content-end': !confirmPipelineStageDelete,
            }"
          >
            <button class="btn btn-secondary" @click="cancel">Cancel</button>
            <button class="btn btn-success" @click="save">Save Changes</button>
          </div>
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
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: "Activity",
  props: {
    showEditPipelineModal: {
      type: Boolean,
      required: true,
    },
    hideEditPipelineModalFunc: {
      type: Function,
      required: true,
    },
    pipelineData: {
      type: Object,
      required: true,
    },
    saveChangesToSelectedPipeline: {
      type: Function,
      required: true,
    },
    deleteProjectPipelineStage: {
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
      dataIsProcessing: false,
      pipeline: {},
      confirmPipelineStageDelete: false,
    };
  },

  watch: {
    showEditPipelineModal(newValue) {
      if (newValue && this.pipelineData) {
        this.pipeline = JSON.parse(JSON.stringify(this.pipelineData));
      } else {
        this.pipeline = {};
      }
    },
  },
  methods: {
    addEnv() {
      this.pipeline.environment_variables.push({ key: "", value: "" });
    },

    removeEnv(idx) {
      this.pipeline.environment_variables.splice(idx, 1);
    },

    cancel() {
      this.hideEditPipelineModalFunc();
    },

    save() {
      this.dataIsProcessing = true;
      this.saveChangesToSelectedPipeline(this.pipeline.stage_uuid, {
        stage_name: this.pipeline.stage_name,
        git_branch: this.pipeline.git_branch,
        environment_variables: this.pipeline.environment_variables,
      })
        .then((res) => {
          if (res) {
            this.fetchPipelines();
            toastr.success("Pipeline updates successfully");
          }
        })
        .finally(() => {
          this.confirmPipelineStageDelete = false;
          this.dataIsProcessing = false;
        });
    },
    deletePipeline() {
      this.dataIsProcessing = true;
      this.deleteProjectPipelineStage(this.pipeline.stage_uuid)
        .then((res) => {
          if (res) {
            this.fetchPipelines();
            this.hideEditPipelineModalFunc();
          }
        })
        .finally(() => {
          this.confirmPipelineStageDelete = false;
          this.dataIsProcessing = false;
        });
    },
  },
};
</script>
