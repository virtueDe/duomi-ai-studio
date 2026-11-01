export const DUOMI_STUDIO_BASE_PATH = '/api/duomi-studio'

export const isDuomiStudioPath = (requestPath: string) => {
  return requestPath === DUOMI_STUDIO_BASE_PATH || requestPath.startsWith(`${DUOMI_STUDIO_BASE_PATH}/`)
}
