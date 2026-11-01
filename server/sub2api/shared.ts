import { sendJson } from '../ai-gateway/shared'
import { Sub2ApiRequestError } from './client'

export const sendSub2ApiError = (res: any, error: unknown) => {
  const statusCode = error instanceof Sub2ApiRequestError ? error.statusCode : 500
  const message = error instanceof Error ? error.message : 'Sub2API 请求失败'
  const type = error instanceof Sub2ApiRequestError ? error.kind : 'server_error'

  sendJson(res, statusCode, {
    message,
    error: { type, message },
  })
}
