<script setup lang="ts">
import { onMounted } from 'vue'
import Canana from '@/views/canana/canana.vue'
import { useSub2ApiStore } from '@/stores/sub2api'

const { status, errorMessage, load } = useSub2ApiStore()

onMounted(() => {
  void load().catch(() => undefined)
})

const goToSubKeys = () => {
  window.location.assign('/keys')
}

const goToSubHome = () => {
  window.location.assign('/')
}

const retry = () => {
  void load(true).catch(() => undefined)
}
</script>

<template>
  <div v-if="status !== 'ready'" class="min-h-screen bg-[#f7f8fa] px-6 py-16 text-slate-900 dark:bg-[#111318] dark:text-slate-100">
    <main class="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center text-center">
      <p class="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-600 dark:text-cyan-300">Duomi AI Studio</p>
      <h1 class="text-3xl font-semibold tracking-tight">进入创作台</h1>
      <p v-if="status === 'loading'" class="mt-4 text-sm text-slate-500">正在读取 Sub2API 登录状态和可用模型分组…</p>
      <p v-else-if="status === 'empty'" class="mt-4 max-w-md text-sm leading-6 text-slate-500">当前账号没有可用于图片或视频生成的 API Key。请先在 Sub2API 创建 Key 并绑定允许生成的分组。</p>
      <p v-else-if="status === 'auth' || errorMessage" class="mt-4 max-w-md text-sm leading-6 text-slate-500">{{ errorMessage || 'Sub2API 登录状态已失效，请返回主站重新登录。' }}</p>
      <p v-else class="mt-4 text-sm leading-6 text-slate-500">正在准备你的云端创作空间。</p>

      <div v-if="status !== 'loading'" class="mt-8 flex flex-wrap justify-center gap-3">
        <button v-if="status === 'empty'" type="button" class="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200" @click="goToSubKeys">前往 API Key 管理</button>
        <button v-else-if="status === 'auth'" type="button" class="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200" @click="goToSubHome">返回 Sub2API</button>
        <button v-else type="button" class="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200" @click="retry">重新读取</button>
      </div>
    </main>
  </div>

  <Canana v-else gateway-mode="duomi" />
</template>
