import { computed, ref } from 'vue'
import {
  loadSub2ApiStudioContext,
  loadSub2ApiModels,
  classifySub2ApiModels,
  type EligibleSub2ApiKey,
  type Sub2ApiGroup,
  type Sub2ApiModel,
  type Sub2ApiUser,
  Sub2ApiAuthError,
} from '@/api/sub2api'

export type Sub2ApiStudioStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'auth' | 'error'

const user = ref<Sub2ApiUser | null>(null)
const groups = ref<Sub2ApiGroup[]>([])
const keys = ref<EligibleSub2ApiKey[]>([])
const models = ref<Sub2ApiModel[]>([])
const activeKeyId = ref<number | null>(null)
const status = ref<Sub2ApiStudioStatus>('idle')
const errorMessage = ref('')
const modelsLoading = ref(false)
let loadPromise: Promise<void> | null = null
let modelLoadPromise: Promise<void> | null = null
let modelLoadVersion = 0

export const useSub2ApiStore = () => {
  const activeKey = computed(() => keys.value.find((key) => key.id === activeKeyId.value) || keys.value[0] || null)
  const categorizedModels = computed(() => classifySub2ApiModels(activeKey.value, models.value))

  const load = async (force = false) => {
    if (loadPromise && !force) return loadPromise

    status.value = 'loading'
    errorMessage.value = ''
    loadPromise = loadSub2ApiStudioContext()
      .then((context) => {
        user.value = context.user
        groups.value = context.groups
        keys.value = context.keys
        activeKeyId.value = context.keys[0]?.id ?? null
        if (!context.keys.length) {
          status.value = 'empty'
          return
        }
        return loadModels().then(() => {
          if (!models.value.length) {
            throw new Error('当前 API Key 所属分组没有返回可用模型。')
          }
          status.value = 'ready'
        })
      })
      .catch((error) => {
        user.value = null
        groups.value = []
        keys.value = []
        models.value = []
        activeKeyId.value = null
        modelsLoading.value = false
        status.value = error instanceof Sub2ApiAuthError ? 'auth' : 'error'
        errorMessage.value = error instanceof Error ? error.message : String(error)
        throw error
      })
      .finally(() => {
        loadPromise = null
      })

    return loadPromise
  }

  const selectKey = (keyId: number) => {
    if (keys.value.some((key) => key.id === keyId)) {
      activeKeyId.value = keyId
      models.value = []
      void loadModels(true).catch((error) => {
        errorMessage.value = error instanceof Error ? error.message : String(error)
      })
    }
  }

  const loadModels = async (force = false) => {
    if (modelLoadPromise && !force) return modelLoadPromise
    const key = keys.value.find((item) => item.id === activeKeyId.value) || keys.value[0]
    if (!key) {
      models.value = []
      return
    }
    const requestVersion = ++modelLoadVersion
    const keyId = key.id
    modelsLoading.value = true
    modelLoadPromise = loadSub2ApiModels(key.key)
      .then((items) => {
        if (requestVersion === modelLoadVersion && activeKeyId.value === keyId) {
          models.value = items
        }
      })
      .finally(() => {
        if (requestVersion === modelLoadVersion) {
          modelsLoading.value = false
          modelLoadPromise = null
        }
      })
    return modelLoadPromise
  }

  return {
    user,
    groups,
    keys,
    models,
    imageModels: computed(() => categorizedModels.value.image),
    videoModels: computed(() => categorizedModels.value.video),
    activeKey,
    modelsLoading,
    activeKeyId,
    status,
    errorMessage,
    load,
    selectKey,
  }
}
