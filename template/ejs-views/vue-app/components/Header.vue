<template>
  <div class="container">
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
      </div>
    </div>
  </div>
</template>
