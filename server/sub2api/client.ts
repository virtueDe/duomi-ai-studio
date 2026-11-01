export interface Sub2ApiUser {
  id: string | number
  username?: string
  name?: string
  email?: string
  avatar_url?: string
  [key: string]: unknown
}

export class Sub2ApiRequestError extends Error {
  constructor(
    message: string,
    readonly statusCode = 502,
    readonly kind = 'sub2api_error',
  ) {
    super(message)
    this.name = 'Sub2ApiRequestError'
  }
}

const getSub2ApiBaseUrl = () => {
  const value = String(process.env.SUB2API_BASE_URL || '').trim().replace(/\/+$/, '')
  if (!value) {
    throw new Sub2ApiRequestError('缺少 SUB2API_BASE_URL，无法校验 Sub2API 登录态。', 500, 'configuration_error')
  }
  return value
}

const readBearerToken = (req: any) => {
  const authorization = String(req.headers?.authorization || '').trim()
  const match = authorization.match(/^Bearer\s+(.+)$/i)
  return match?.[1]?.trim() || ''
}

const unwrap = (payload: any) => {
  if (payload && typeof payload === 'object' && 'code' in payload) {
    const code = Number(payload.code)
    if (Number.isFinite(code) && code !== 0 && code !== 200) {
      throw new Sub2ApiRequestError(String(payload.message || 'Sub2API 登录态校验失败'), 401, 'authentication_error')
    }
    return payload.data ?? payload
  }
  return payload
}

export const requireSub2ApiToken = (req: any) => {
  const token = readBearerToken(req)
  if (!token) {
    throw new Sub2ApiRequestError('缺少 Sub2API 登录凭证。', 401, 'authentication_error')
  }
  return token
}

export const fetchSub2ApiUser = async (req: any): Promise<Sub2ApiUser> => {
  const token = requireSub2ApiToken(req)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)

  try {
    const response = await fetch(`${getSub2ApiBaseUrl()}/api/v1/auth/me`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      signal: controller.signal,
    })
    const payload = await response.json().catch(() => ({}))

    if (response.status === 401 || response.status === 403) {
      throw new Sub2ApiRequestError('Sub2API 登录状态已失效，请返回主站重新登录。', 401, 'authentication_error')
    }
    if (!response.ok) {
      throw new Sub2ApiRequestError(
        String(payload?.message || `Sub2API 身份校验失败 (${response.status})`),
        502,
        'upstream_error',
      )
    }

    const user = unwrap(payload)?.user || unwrap(payload)
    if (!user || (typeof user !== 'object') || user.id === undefined || user.id === null) {
      throw new Sub2ApiRequestError('Sub2API 返回的用户信息无效。', 502, 'upstream_error')
    }

    return user as Sub2ApiUser
  } catch (error: any) {
    if (error instanceof Sub2ApiRequestError) throw error
    if (error?.name === 'AbortError') {
      throw new Sub2ApiRequestError('Sub2API 身份校验超时。', 504, 'upstream_timeout')
    }
    throw new Sub2ApiRequestError(error?.message || '无法连接 Sub2API。', 502, 'upstream_error')
  } finally {
    clearTimeout(timeout)
  }
}
