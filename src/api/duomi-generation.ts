import { requestSub2Api, requestSub2ApiBlob } from './sub2api'

export interface DuomiImageRequest {
  model: string
  prompt: string
  count: number
  size?: string
  quality?: string
  referenceImages?: string[]
  signal?: AbortSignal
}

export interface DuomiVideoRequest {
  model: string
  prompt: string
  ratio?: string
  resolution?: string
  duration?: string
  referenceImages?: string[]
  signal?: AbortSignal
}

const abortError = () => new DOMException('Generation request aborted', 'AbortError')

const wait = (milliseconds: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
  if (signal?.aborted) return reject(abortError())
  const timer = window.setTimeout(() => {
    signal?.removeEventListener('abort', onAbort)
    resolve()
  }, milliseconds)
  const onAbort = () => {
    window.clearTimeout(timer)
    reject(abortError())
  }
  signal?.addEventListener('abort', onAbort, { once: true })
})

const errorMessage = (payload: any, fallback: string) =>
  String(payload?.error?.message || payload?.message || payload?.result?.error?.message || fallback)

const makeImageFormData = async (request: DuomiImageRequest) => {
  const form = new FormData()
  form.set('model', request.model)
  form.set('prompt', request.prompt)
  form.set('n', String(request.count))
  if (request.size) form.set('size', request.size)
  if (request.quality) form.set('quality', request.quality)

  for (const [index, source] of (request.referenceImages || []).entries()) {
    const response = await fetch(source)
    if (!response.ok) throw new Error(`无法读取第 ${index + 1} 张参考图`)
    const blob = await response.blob()
    const mime = blob.type || 'image/png'
    const extension = mime.split('/')[1]?.split(';')[0] || 'png'
    form.append('image[]', blob, `reference-${index + 1}.${extension}`)
  }
  return form
}

const collectImageUrls = (payload: any) => {
  const result = payload?.result || payload?.data?.result || payload?.data || payload
  const items = Array.isArray(result?.data) ? result.data : []
  const urls = items.flatMap((item: any) => {
    if (item?.url) return [String(item.url)]
    if (item?.b64_json) return [`data:image/png;base64,${String(item.b64_json)}`]
    return []
  })
  if (!urls.length && result?.image_url) urls.push(String(result.image_url))
  return urls
}

const pollImageTask = async (apiKey: string, taskId: string, signal?: AbortSignal) => {
  const deadline = Date.now() + 30 * 60 * 1000
  while (Date.now() < deadline) {
    const task = await requestSub2Api<any>(`/v1/images/tasks/${encodeURIComponent(taskId)}`, apiKey, {
      method: 'GET',
      signal,
    })
    const status = String(task?.status || task?.data?.status || '').toLowerCase()
    if (['failed', 'error', 'cancelled', 'canceled'].includes(status)) {
      throw new Error(errorMessage(task, '图片生成失败'))
    }
    if (['completed', 'complete', 'done', 'succeeded', 'success'].includes(status)) {
      const images = collectImageUrls(task)
      if (images.length) return images
      throw new Error('图片任务已完成，但 Sub2API 没有返回可用图片链接。')
    }
    await wait(3000, signal)
  }
  throw new Error('图片生成超时，请稍后在 Sub2API 查看任务状态。')
}

export const generateDuomiImage = async (apiKey: string, request: DuomiImageRequest) => {
  const hasReferences = Boolean(request.referenceImages?.length)
  const body = hasReferences
    ? await makeImageFormData(request)
    : JSON.stringify({
        model: request.model,
        prompt: request.prompt,
        n: request.count,
        ...(request.size ? { size: request.size } : {}),
        ...(request.quality ? { quality: request.quality } : {}),
      })
  const submitted = await requestSub2Api<any>(
    hasReferences ? '/v1/images/edits/async' : '/v1/images/generations/async',
    apiKey,
    { method: 'POST', body, signal: request.signal },
  )
  const taskId = String(submitted?.task_id || submitted?.id || submitted?.data?.task_id || '').trim()
  if (!taskId) throw new Error('Sub2API 没有返回图片任务编号。')
  const images = await pollImageTask(apiKey, taskId, request.signal)
  return { taskId, images }
}

const appendVideoReference = async (form: FormData, source: string, model: string) => {
  if (/^data:image\//i.test(source)) {
    if (!/kling/i.test(model)) {
      throw new Error('当前视频渠道需要可访问的参考图 URL；本地参考图暂时仅支持 Kling 模型。')
    }
    const response = await fetch(source)
    const blob = await response.blob()
    const extension = blob.type.split('/')[1]?.split(';')[0] || 'png'
    form.append('input_reference', blob, `reference.${extension}`)
    return
  }
  form.set('input_reference', source)
}

const collectVideoLocation = (payload: any) => {
  const task = payload?.data || payload
  const metadata = task?.metadata || task?.data?.metadata || {}
  const video = task?.video || task?.data?.video || {}
  const candidates = [metadata.video_url, video.url, task?.video_url, task?.url]
  const value = candidates.map(item => String(item || '').trim()).find(Boolean) || ''
  if (/^https?:\/\//i.test(value)) return { url: value, contentPath: '' }
  if (/^\/(?:v1\/)?videos\/[A-Za-z0-9._~-]+\/content(?:\?.*)?$/i.test(value)) {
    return { url: '', contentPath: value }
  }
  return { url: '', contentPath: '' }
}

const pollVideoTask = async (apiKey: string, taskId: string, signal?: AbortSignal) => {
  const deadline = Date.now() + 30 * 60 * 1000
  while (Date.now() < deadline) {
    const task = await requestSub2Api<any>(`/v1/videos/generations/${encodeURIComponent(taskId)}`, apiKey, {
      method: 'GET',
      signal,
    })
    const status = String(task?.status || task?.data?.status || '').toLowerCase()
    if (['failed', 'error', 'cancelled', 'canceled'].includes(status)) {
      throw new Error(errorMessage(task, '视频生成失败'))
    }
    if (['completed', 'complete', 'done', 'succeeded', 'success'].includes(status)) {
      const location = collectVideoLocation(task)
      if (location.url || location.contentPath) return location
      throw new Error('视频任务已完成，但 Sub2API 没有返回可访问的上游视频链接。')
    }
    await wait(3000, signal)
  }
  throw new Error('视频生成超时，请稍后在 Sub2API 查看任务状态。')
}

export const generateDuomiVideo = async (apiKey: string, request: DuomiVideoRequest) => {
  const form = new FormData()
  form.set('model', request.model)
  form.set('prompt', request.prompt)
  form.set('seconds', String(Math.max(1, Number.parseInt(request.duration || '5', 10) || 5)))
  if (request.ratio) form.set('size', request.ratio)
  if (request.resolution) form.set('resolution', request.resolution)
  const reference = request.referenceImages?.[0]
  if (reference) await appendVideoReference(form, reference, request.model)

  const submitted = await requestSub2Api<any>('/v1/videos/generations', apiKey, {
    method: 'POST',
    body: form,
    signal: request.signal,
  })
  const taskId = String(submitted?.id || submitted?.request_id || submitted?.data?.id || '').trim()
  if (!taskId) throw new Error('Sub2API 没有返回视频任务编号。')
  const location = await pollVideoTask(apiKey, taskId, request.signal)
  if (location.url) return { taskId, url: location.url, contentPath: '' }
  const blob = await requestSub2ApiBlob(location.contentPath, apiKey, { method: 'GET', signal: request.signal })
  return { taskId, url: URL.createObjectURL(blob), contentPath: location.contentPath }
}
