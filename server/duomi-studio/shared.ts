import { readJsonBody, sendJson } from '../ai-gateway/shared'

export interface DuomiProjectBody {
  name?: unknown
  data?: unknown
  metadata?: unknown
}

export interface DuomiGenerationBody {
  kind?: unknown
  model?: unknown
  prompt?: unknown
  status?: unknown
  resultUrls?: unknown
  contentPath?: unknown
  errorMessage?: unknown
}

export const readDuomiProjectBody = async (req: any): Promise<DuomiProjectBody | null> => {
  const body = await readJsonBody(req) as DuomiProjectBody
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null
  return body
}

export const readDuomiGenerationBody = async (req: any): Promise<DuomiGenerationBody | null> => {
  const body = await readJsonBody(req) as DuomiGenerationBody
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null
  return body
}

export const sendDuomiError = (res: any, statusCode: number, message: string, type = 'duomi_studio_error') => {
  sendJson(res, statusCode, {
    message,
    error: { type, message },
  })
}

export const serializeDuomiProject = (project: any) => ({
  id: project.id,
  name: project.name,
  data: project.dataJson ?? {},
  metadata: project.metadataJson ?? {},
  createdAt: project.createdAt,
  updatedAt: project.updatedAt,
})

export const serializeDuomiGeneration = (generation: any) => {
  const response = generation.responseJson && typeof generation.responseJson === 'object'
    ? generation.responseJson as Record<string, unknown>
    : {}
  const resultUrls = Array.isArray(response.urls)
    ? response.urls.map(value => String(value || '')).filter(Boolean)
    : generation.resultUrl ? [generation.resultUrl] : []
  const contentPath = typeof response.contentPath === 'string' && response.contentPath.startsWith('/')
    ? response.contentPath
    : null
  return {
    id: generation.id,
    kind: generation.kind,
    status: generation.status,
    model: generation.model,
    prompt: generation.prompt,
    resultUrls,
    contentPath,
    expiresAt: generation.expiresAt,
    errorMessage: generation.errorMessage,
    createdAt: generation.createdAt,
  }
}
