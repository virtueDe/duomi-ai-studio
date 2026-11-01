import { buildApiUrl } from './http'
import { getSub2ApiAuthToken } from './sub2api'

export interface DuomiStudioUser {
  subUserId: string
  username?: string | null
  name?: string | null
  email?: string | null
  avatarUrl?: string | null
}

export interface DuomiProjectSummary {
  id: string
  name: string
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface DuomiProject extends DuomiProjectSummary {
  data: unknown
}

export interface DuomiGeneration {
  id: string
  kind: 'IMAGE' | 'VIDEO'
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELED'
  model: string | null
  prompt: string | null
  resultUrls: string[]
  contentPath: string | null
  expiresAt: string | null
  errorMessage: string | null
  createdAt: string
}

interface DuomiEnvelope<T> {
  data: T
  message?: string
}

const requestDuomi = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  const token = getSub2ApiAuthToken()
  if (!token) throw new Error('请先登录 Sub2API 主站。')

  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  headers.set('Authorization', `Bearer ${token}`)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')

  const response = await fetch(buildApiUrl(path), {
    ...init,
    credentials: 'include',
    cache: 'no-store',
    headers,
  })
  const payload = await response.json().catch(() => ({})) as DuomiEnvelope<T> & { message?: string }
  if (!response.ok) throw new Error(payload.message || `Duomi 请求失败 (${response.status})`)
  return payload.data
}

export const getDuomiStudioUser = () => requestDuomi<DuomiStudioUser>('/api/duomi-studio/me')

export const listDuomiProjects = () =>
  requestDuomi<{ items: DuomiProjectSummary[] }>('/api/duomi-studio/projects')

export const getDuomiProject = (id: string) =>
  requestDuomi<DuomiProject>(`/api/duomi-studio/projects/${encodeURIComponent(id)}`)

export const createDuomiProject = (input: { name?: string; data?: unknown; metadata?: unknown }) =>
  requestDuomi<DuomiProject>('/api/duomi-studio/projects', {
    method: 'POST',
    body: JSON.stringify(input),
  })

export const updateDuomiProject = (id: string, input: { name?: string; data?: unknown; metadata?: unknown }) =>
  requestDuomi<DuomiProject>(`/api/duomi-studio/projects/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })

export const deleteDuomiProject = (id: string) =>
  requestDuomi<{ id: string; deleted: boolean }>(`/api/duomi-studio/projects/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })

export const listDuomiGenerations = () =>
  requestDuomi<{ items: DuomiGeneration[] }>('/api/duomi-studio/generations')

export const createDuomiGeneration = (input: {
  kind: 'IMAGE' | 'VIDEO'
  model: string
  prompt: string
  status: 'COMPLETED' | 'FAILED'
  resultUrls?: string[]
  contentPath?: string
  errorMessage?: string
}) =>
  requestDuomi<DuomiGeneration>('/api/duomi-studio/generations', {
    method: 'POST',
    body: JSON.stringify(input),
  })

export const deleteDuomiGeneration = (id: string) =>
  requestDuomi<{ id: string; deleted: boolean }>(`/api/duomi-studio/generations/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
