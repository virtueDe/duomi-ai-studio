import { sendJson } from '../ai-gateway/shared'
import { isPrismaConfigured } from '../db/prisma'
import { fetchSub2ApiUser } from '../sub2api/client'
import { sendSub2ApiError } from '../sub2api/shared'
import { DUOMI_STUDIO_BASE_PATH } from './constants'
import { readDuomiGenerationBody, readDuomiProjectBody, sendDuomiError } from './shared'
import {
  createDuomiProject,
  createDuomiGeneration,
  deleteDuomiProject,
  deleteDuomiGeneration,
  getDuomiProject,
  listDuomiProjects,
  listDuomiGenerations,
  updateDuomiProject,
  upsertDuomiUser,
} from './service'

const extractProjectId = (pathname: string) => {
  const prefix = `${DUOMI_STUDIO_BASE_PATH}/projects/`
  if (!pathname.startsWith(prefix)) return null
  const id = pathname.slice(prefix.length)
  return id && !id.includes('/') ? id : null
}

const extractGenerationId = (pathname: string) => {
  const prefix = `${DUOMI_STUDIO_BASE_PATH}/generations/`
  if (!pathname.startsWith(prefix)) return null
  const id = pathname.slice(prefix.length)
  return id && !id.includes('/') ? id : null
}

export const handleDuomiStudioRequest = async (req: any, res: any) => {
  try {
    if (!isPrismaConfigured()) {
      sendDuomiError(res, 503, 'Duomi 云端数据暂不可用，请配置 DATABASE_URL。', 'configuration_error')
      return
    }

    const user = await fetchSub2ApiUser(req)
    const duomiUser = await upsertDuomiUser(user)
    const pathname = String(req.url || '').split('?')[0]

    if (req.method === 'GET' && pathname === `${DUOMI_STUDIO_BASE_PATH}/me`) {
      sendJson(res, 200, {
        data: {
          subUserId: duomiUser.subUserId,
          username: duomiUser.username,
          name: duomiUser.name,
          email: duomiUser.email,
          avatarUrl: duomiUser.avatarUrl,
        },
      })
      return
    }

    if (req.method === 'GET' && pathname === `${DUOMI_STUDIO_BASE_PATH}/projects`) {
      sendJson(res, 200, { data: { items: await listDuomiProjects(duomiUser.id) } })
      return
    }

    if (req.method === 'POST' && pathname === `${DUOMI_STUDIO_BASE_PATH}/projects`) {
      const body = await readDuomiProjectBody(req)
      if (!body) {
        sendDuomiError(res, 400, '项目请求体格式错误。')
        return
      }
      sendJson(res, 201, { data: await createDuomiProject(duomiUser.id, body) })
      return
    }

    if (req.method === 'GET' && pathname === `${DUOMI_STUDIO_BASE_PATH}/generations`) {
      sendJson(res, 200, { data: { items: await listDuomiGenerations(duomiUser.id) } })
      return
    }

    if (req.method === 'POST' && pathname === `${DUOMI_STUDIO_BASE_PATH}/generations`) {
      const body = await readDuomiGenerationBody(req)
      if (!body) {
        sendDuomiError(res, 400, '作品记录格式错误。')
        return
      }
      const generation = await createDuomiGeneration(duomiUser.id, body)
      if (!generation) {
        sendDuomiError(res, 400, '作品记录缺少有效的类型、模型或提示词。')
        return
      }
      sendJson(res, 201, { data: generation })
      return
    }

    const generationId = extractGenerationId(pathname)
    if (generationId && req.method === 'DELETE') {
      const deleted = await deleteDuomiGeneration(generationId, duomiUser.id)
      if (!deleted) {
        sendDuomiError(res, 404, '作品不存在或已删除。')
        return
      }
      sendJson(res, 200, { data: { id: generationId, deleted: true } })
      return
    }

    const projectId = extractProjectId(pathname)
    if (projectId && req.method === 'GET') {
      const project = await getDuomiProject(projectId, duomiUser.id)
      if (!project) {
        sendDuomiError(res, 404, '项目不存在或已被删除。')
        return
      }
      sendJson(res, 200, { data: project })
      return
    }

    if (projectId && req.method === 'PUT') {
      const body = await readDuomiProjectBody(req)
      if (!body) {
        sendDuomiError(res, 400, '项目请求体格式错误。')
        return
      }
      const project = await updateDuomiProject(projectId, duomiUser.id, body)
      if (!project) {
        sendDuomiError(res, 404, '项目不存在或已被删除。')
        return
      }
      sendJson(res, 200, { data: project })
      return
    }

    if (projectId && req.method === 'DELETE') {
      const deleted = await deleteDuomiProject(projectId, duomiUser.id)
      if (!deleted) {
        sendDuomiError(res, 404, '项目不存在或已被删除。')
        return
      }
      sendJson(res, 200, { data: { id: projectId, deleted: true } })
      return
    }

    sendDuomiError(res, 405, 'Method Not Allowed')
  } catch (error: any) {
    if (error?.name === 'Sub2ApiRequestError') {
      sendSub2ApiError(res, error)
      return
    }
    sendDuomiError(res, 500, error?.message || 'Duomi 请求处理失败。')
  }
}
