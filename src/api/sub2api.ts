import { buildSub2ApiUrl } from './http'

const AUTH_TOKEN_KEY = 'auth_token'
const API_KEY_PAGE_SIZE = 100

export interface Sub2ApiUser {
  id: string | number
  username?: string
  email?: string
  name?: string
  [key: string]: unknown
}

export interface Sub2ApiGroup {
  id: number
  name: string
  platform: string
  status: string
  allow_image_generation: boolean
  video_rate_independent?: boolean
  video_price_480p?: number | null
  video_price_720p?: number | null
  video_price_1080p?: number | null
  video_model_prices?: Record<string, unknown> | null
}

export interface Sub2ApiKey {
  id: number
  name: string
  key: string
  group_id: number | null
  status: string
  expires_at: string | null
}

export interface EligibleSub2ApiKey {
  id: number
  name: string
  key: string
  groupId: number
  groupName: string
  groupPlatform: string
  supportsImage: boolean
  supportsVideo: boolean
  videoModelIds: string[]
}

export interface Sub2ApiModel {
  id: string
  label: string
}

export interface Sub2ApiStudioContext {
  user: Sub2ApiUser
  groups: Sub2ApiGroup[]
  keys: EligibleSub2ApiKey[]
}

export class Sub2ApiAuthError extends Error {
  constructor(message = 'Sub2API 登录状态已失效，请返回主站重新登录') {
    super(message)
    this.name = 'Sub2ApiAuthError'
  }
}

interface ApiEnvelope<T> {
  code?: number
  message?: string
  data?: T
}

export const getSub2ApiAuthToken = () => {
  if (typeof window === 'undefined') return ''
  return String(window.localStorage.getItem(AUTH_TOKEN_KEY) || '').trim()
}

const unwrap = <T>(payload: T | ApiEnvelope<T>): T => {
  if (payload && typeof payload === 'object' && 'code' in payload) {
    const envelope = payload as ApiEnvelope<T>
    if (envelope.code !== undefined && envelope.code !== 0) {
      throw new Error(envelope.message || 'Sub2API 请求失败')
    }
    return (envelope.data ?? payload) as T
  }
  return payload as T
}

const fetchSub2ApiJson = async <T>(path: string, token: string, signal?: AbortSignal) => {
  const response = await fetch(buildSub2ApiUrl(path), {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
    signal,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  })

  if (response.status === 401 || response.status === 403) {
    throw new Sub2ApiAuthError()
  }

  const payload = await response.json().catch(() => ({})) as T | ApiEnvelope<T>
  if (!response.ok) {
    throw new Error((payload as ApiEnvelope<T>)?.message || `Sub2API 请求失败 (${response.status})`)
  }
  return unwrap(payload)
}

const parseDate = (value: string | null) => {
  if (!value) return null
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : null
}

export const filterEligibleSub2ApiKeys = (
  groups: Sub2ApiGroup[],
  keys: Sub2ApiKey[],
  now = new Date(),
): EligibleSub2ApiKey[] => {
  const availableGroups = new Map(
    groups
      .filter((group) => group.status === 'active')
      .map((group) => [group.id, group]),
  )

  return keys.flatMap((key) => {
    if (key.status !== 'active' || !key.key.trim() || key.group_id == null) return []
    const expiresAt = parseDate(key.expires_at)
    if (expiresAt !== null && expiresAt <= now.getTime()) return []

    const group = availableGroups.get(key.group_id)
    if (!group) return []
    const supportsImage = Boolean(group.allow_image_generation)
    const supportsVideo = /video|sora|veo|seedance|kling|runway/i.test(group.platform)
      || Number(group.video_price_480p || 0) > 0
      || Number(group.video_price_720p || 0) > 0
      || Number(group.video_price_1080p || 0) > 0
      || Boolean(group.video_model_prices && Object.keys(group.video_model_prices).length)
    if (!supportsImage && !supportsVideo) return []

    return [{
      id: key.id,
      name: key.name,
      key: key.key,
      groupId: group.id,
      groupName: group.name,
      groupPlatform: group.platform,
      supportsImage,
      supportsVideo,
      videoModelIds: group.video_model_prices ? Object.keys(group.video_model_prices) : [],
    }]
  })
}

export const loadSub2ApiModels = async (apiKey: string): Promise<Sub2ApiModel[]> => {
  const response = await fetch(buildSub2ApiGatewayUrl('/v1/models'), {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
    headers: { Accept: 'application/json', Authorization: `Bearer ${apiKey}` },
  })
  const payload = await response.json().catch(() => ({})) as any
  if (!response.ok) throw new Error(payload?.error?.message || payload?.message || `读取 Sub2API 模型失败 (${response.status})`)
  const unwrapped = unwrap(payload) as any
  const data = Array.isArray(unwrapped) ? unwrapped : unwrapped?.data
  if (!Array.isArray(data)) return []
  return data.flatMap((item: any) => {
    const id = String(item?.id || item?.name || '').trim()
    const label = String(item?.display_name || item?.name || id)
    return id ? [{ id, label }] : []
  })
}

export const classifySub2ApiModels = (key: EligibleSub2ApiKey | null, models: Sub2ApiModel[]) => {
  if (!key) return { image: [], video: [] }

  const configuredVideoModels = new Set(key.videoModelIds.map(value => value.toLowerCase()))
  const videoPattern = /video|sora|veo|seedance|kling|runway|wan|hailuo|luma/i
  const video = models.filter(model =>
    configuredVideoModels.has(model.id.toLowerCase())
    || videoPattern.test(model.id)
    || videoPattern.test(model.label),
  )
  const videoIds = new Set(video.map(model => model.id))
  const groupIsVideoOnly = /video|sora|veo|seedance|kling|runway/i.test(key.groupPlatform)

  return {
    image: key.supportsImage ? models.filter(model => !videoIds.has(model.id) || video.length === 0) : [],
    video: key.supportsVideo ? (video.length ? video : (groupIsVideoOnly ? models : [])) : [],
  }
}

export const loadSub2ApiStudioContext = async (signal?: AbortSignal): Promise<Sub2ApiStudioContext> => {
  const token = getSub2ApiAuthToken()
  if (!token) throw new Sub2ApiAuthError('请先登录 Sub2API 主站')

  const [userPayload, groups] = await Promise.all([
    fetchSub2ApiJson<Sub2ApiUser | { user: Sub2ApiUser }>('/api/v1/auth/me', token, signal),
    fetchSub2ApiJson<Sub2ApiGroup[]>('/api/v1/groups/available', token, signal),
  ])

  const userContainer = userPayload as Sub2ApiUser | { user?: Sub2ApiUser }
  const user = (
    'user' in userContainer && userContainer.user
      ? userContainer.user
      : userContainer
  ) as Sub2ApiUser

  const keys: Sub2ApiKey[] = []
  let page = 1
  let total = Number.POSITIVE_INFINITY

  while (keys.length < total && page <= 100) {
    const result = await fetchSub2ApiJson<{ items?: Sub2ApiKey[]; total?: number }>(
      `/api/v1/keys?page=${page}&page_size=${API_KEY_PAGE_SIZE}`,
      token,
      signal,
    )
    const items = Array.isArray(result.items) ? result.items : []
    keys.push(...items)
    total = Number.isFinite(result.total) ? Number(result.total) : keys.length
    if (items.length < API_KEY_PAGE_SIZE) break
    page += 1
  }

  return {
    user,
    groups,
    keys: filterEligibleSub2ApiKeys(groups, keys),
  }
}

export const buildSub2ApiGatewayUrl = (path: string) => buildSub2ApiUrl(path)

export const requestSub2Api = async <T>(
  path: string,
  apiKey: string,
  init: RequestInit = {},
): Promise<T> => {
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${apiKey}`)
  if (init.body && !headers.has('Content-Type') && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(buildSub2ApiGatewayUrl(path), {
    ...init,
    credentials: 'include',
    headers,
  })
  const payload = await response.json().catch(() => ({})) as T & ApiEnvelope<T>
  if (!response.ok) {
    throw new Error(payload.message || (payload as any)?.error?.message || `生成请求失败 (${response.status})`)
  }
  return unwrap(payload)
}

export const requestSub2ApiBlob = async (
  path: string,
  apiKey: string,
  init: RequestInit = {},
): Promise<Blob> => {
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${apiKey}`)
  const response = await fetch(buildSub2ApiUrl(path), {
    ...init,
    credentials: 'include',
    headers,
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as any
    throw new Error(payload?.message || payload?.error?.message || `读取 Sub2API 媒体失败 (${response.status})`)
  }
  return response.blob()
}
