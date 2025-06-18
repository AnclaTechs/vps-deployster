<style scoped>
.card-body {
  transition: background-color 0.3s ease;
}

.card-text.pipeline-stage-data {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
</style>

<template>
  <div class="container py-3">
    <!-- When no pipelines exist -->
    <div v-if="pipelines?.length === 0" class="text-center">
      <div class="accordion" id="noPipelineAccordion">
        <div class="accordion-item">
          <h2 class="accordion-header" id="headingOne">
            <button
              class="accordion-button fw-bold"
              type="button"
              data-bs-toggle="collapse"
              data-bs-target="#collapseOne"
              aria-expanded="true"
              aria-controls="collapseOne"
            >
              <i class="fad fa-code-commit me-1"></i> Your Pipelines
            </button>
          </h2>
          <div
            id="collapseOne"
            class="accordion-collapse collapse"
            aria-labelledby="headingOne"
            data-bs-parent="#noPipelineAccordion"
          >
            <div class="accordion-body">
              <div class="alert alert-secondary">
                <strong>No pipelines yet</strong> <br />
                A pipeline allows you to deploy a specific branch with custom
                environment settings. <br />Useful for staging, preview
                environments, or production releases.
              </div>
              <CreatePipelineModal
                :showCreatePipelineModal="showCreatePipelineModal"
                :showCreatePipelineModalFunc="showCreatePipelineModalFunc"
                :hideCreatePipelineModalFunc="hideCreatePipelineModalFunc"
                :createOrSaveNewPipelineToProject="
                  createOrSaveNewPipelineToProject
                "
                :fetchPipelines="fetchPipelines"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- When pipelines exist -->
    <div v-else>
      <div class="d-flex justify-content-between align-items-center mb-4">
        <h4 class="mb-0">Your Pipelines</h4>
        <CreatePipelineModal
          :showCreatePipelineModal="showCreatePipelineModal"
          :showCreatePipelineModalFunc="showCreatePipelineModalFunc"
          :hideCreatePipelineModalFunc="hideCreatePipelineModalFunc"
          :createOrSaveNewPipelineToProject="createOrSaveNewPipelineToProject"
          :fetchPipelines="fetchPipelines"
        />
      </div>

      <div class="row">
        <div
          class="col-md-6 col-lg-4 mb-4"
          v-for="(pipeline, index) in pipelines"
          :key="index"
        >
          <div class="card h-100 shadow-sm" style="border-radius: 15px">
            <div
              class="card-body"
              :style="[
                {
                  backgroundColor:
                    selectedPipelineStage?.stage_uuid == pipeline.stage_uuid
                      ? '#95a1afbd'
                      : 'unset',
                  borderRadius: 15,
                  cursor: 'pointer',
                },
              ]"
              @click="selectPipelineStage(pipeline.stage_uuid)"
            >
              <h5 class="card-title">
                {{ pipeline.stage_name }}
              </h5>
              <div class="card-text pipeline-stage-data">
                <div class="mb-4">
                  <strong>Branch:</strong> {{ pipeline.git_branch }}
                  <br />
                </div>
                <div>
                  <i class="fad fa-hashtag me-2"></i>
                  <strong>HEAD: &nbsp; </strong>
                  <span class="badge rounded-pill bg-secondary">{{
                    pipeline.current_head
                  }}</span>
                </div>
                <div>
                  <i class="fad fa-map-marker-alt me-2"></i>
                  <strong>TCP Port: &nbsp;</strong> {{ pipeline.tcp_port }}
                </div>
                <div>
                  <i class="fad fa-globe me-2"></i>
                  <strong>Status: &nbsp;</strong>

                  <span
                    :class="[
                      'badge',
                      pipeline.status ? 'bg-success' : 'bg-danger',
                    ]"
                    :aria-label="
                      pipelinestatus
                        ? 'Project is online'
                        : 'Project is offline'
                    "
                    role="status"
                  >
                    {{ pipeline.status ? "Online" : "Offline" }}
                  </span>
                </div>
                <div>
                  <i class="fad fa-link me-2"></i>
                  <strong>Live URL: &nbsp;</strong>
                  <a
                    :href="pipeline.app_url"
                    target="_blank"
                    :title="
                      pipeline.app_url?.length > 35 ? pipeline.app_url : ''
                    "
                    v-tooltip="
                      pipelineapp_url?.length > 35 ? pipeline.app_url : null
                    "
                    class="text-decoration-none"
                  >
                    {{
                      pipeline.app_url?.length > 35
                        ? pipeline.app_url.slice(0, 35) + "..."
                        : pipeline.app_url
                    }}
                  </a>
                </div>
              </div>

              <div class="w-100 d-flex justify-content-end">
                <button
                  v-if="
                    selectedPipelineStage?.stage_uuid == pipeline.stage_uuid
                  "
                  class="btn btn-outline-primary btn-sm mt-2"
                  @click.stop="editPipeline(pipeline.stage_uuid)"
                >
                  Edit
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!--Edit Pipeline Modal-->
    <EditPipelineModal
      :showEditPipelineModal="showEditPipelineModal"
      :pipelineData="selectedPipelineStage"
      :hideEditPipelineModalFunc="hideEditPipelineModalFunc"
      :saveChangesToSelectedPipeline="saveChangesToSelectedPipeline"
      :deleteProjectPipelineStage="deleteProjectPipelineStage"
      :fetchPipelines="fetchPipelines"
    />
  </div>
</template>

<script>
const { defineAsyncComponent } = Vue;
const { loadModule } = window["vue3-sfc-loader"];

export default {
  name: "PipelineList",
  components: {
    CreatePipelineModal: defineAsyncComponent(() =>
      loadModule(
        "/vue/components/pipeline/CreatePipelineModal.vue",
        window.$httpLoaderOption
      )
    ),
    EditPipelineModal: defineAsyncComponent(() =>
      loadModule(
        "/vue/components/pipeline/EditPipelineModal.vue",
        window.$httpLoaderOption
      )
    ),
  },
  props: {
    pipelines: {
      type: Array,
      required: true,
    },
    fetchPipelines: {
      type: Function,
      required: true,
    },
    selectedPipelineStage: {
      type: Object,
    },
    selectPipelineStage: {
      type: Function,
      required: true,
    },
    saveChangesToSelectedPipeline: {
      type: Function,
      required: true,
    },
    createOrSaveNewPipelineToProject: {
      type: Function,
      required: true,
    },
    deleteProjectPipelineStage: {
      type: Function,
      required: true,
    },
  },
  data() {
    return {
      showEditPipelineModal: false,
      showCreatePipelineModal: false,
    };
  },
  methods: {
    editPipeline(stageId) {
      // PROCESS

      //
      this.showEditPipelineModalFunc();
    },
    showEditPipelineModalFunc() {
      this.showEditPipelineModal = true;
    },
    hideEditPipelineModalFunc() {
      this.showEditPipelineModal = false;
    },

    showCreatePipelineModalFunc() {
      this.showCreatePipelineModal = true;
    },
    hideCreatePipelineModalFunc() {
      this.showCreatePipelineModal = false;
    },
  },
  mounted() {
    this.fetchPipelines();
  },
};
</script>
