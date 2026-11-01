import { Prisma } from '@prisma/client'
import { prisma } from '../db/prisma'
import type { Sub2ApiUser } from '../sub2api/client'
import {
  serializeDuomiGeneration,
  serializeDuomiProject,
  type DuomiGenerationBody,
  type DuomiProjectBody,
} from './shared'

const normalizeSubUserId = (user: Sub2ApiUser) => String(user.id).trim()

export const upsertDuomiUser = async (user: Sub2ApiUser) => {
  const subUserId = normalizeSubUserId(user)
  return prisma.duomiUser.upsert({
    where: { subUserId },
    create: {
      subUserId,
      username: user.username ? String(user.username) : null,
      name: user.name ? String(user.name) : null,
      email: user.email ? String(user.email) : null,
      avatarUrl: user.avatar_url ? String(user.avatar_url) : null,
    },
    update: {
      username: user.username ? String(user.username) : null,
      name: user.name ? String(user.name) : null,
      email: user.email ? String(user.email) : null,
      avatarUrl: user.avatar_url ? String(user.avatar_url) : null,
    },
  })
}

const normalizeProjectName = (value: unknown) => {
  const name = String(value || '').trim()
  return name.slice(0, 255) || '未命名项目'
}

const toJsonValue = (value: unknown) => (value === undefined ? {} : value) as Prisma.InputJsonValue

export const listDuomiProjects = async (userId: string) => {
  const projects = await prisma.duomiProject.findMany({
    where: { userId, isDeleted: false },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, name: true, metadataJson: true, createdAt: true, updatedAt: true },
  })
  return projects.map(project => ({
    id: project.id,
    name: project.name,
    metadata: project.metadataJson ?? {},
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  }))
}

export const getDuomiProject = async (id: string, userId: string) => {
  const project = await prisma.duomiProject.findFirst({ where: { id, userId, isDeleted: false } })
  return project ? serializeDuomiProject(project) : null
}

export const createDuomiProject = async (userId: string, body: DuomiProjectBody) => {
  const project = await prisma.duomiProject.create({
    data: {
      userId,
      name: normalizeProjectName(body.name),
      dataJson: toJsonValue(body.data),
      metadataJson: toJsonValue(body.metadata),
    },
  })
  return serializeDuomiProject(project)
}

export const updateDuomiProject = async (id: string, userId: string, body: DuomiProjectBody) => {
  const existing = await prisma.duomiProject.findFirst({ where: { id, userId, isDeleted: false } })
  if (!existing) return null

  const project = await prisma.duomiProject.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: normalizeProjectName(body.name) } : {}),
      ...(body.data !== undefined ? { dataJson: toJsonValue(body.data) } : {}),
      ...(body.metadata !== undefined ? { metadataJson: toJsonValue(body.metadata) } : {}),
    },
  })
  return serializeDuomiProject(project)
}

export const deleteDuomiProject = async (id: string, userId: string) => {
  const existing = await prisma.duomiProject.findFirst({ where: { id, userId, isDeleted: false } })
  if (!existing) return false
  await prisma.duomiProject.update({ where: { id }, data: { isDeleted: true } })
  await prisma.duomiAsset.updateMany({ where: { projectId: id }, data: { isDeleted: true } })
  await prisma.duomiGeneration.updateMany({ where: { projectId: id }, data: { isDeleted: true } })
  return true
}

export const listDuomiGenerations = async (userId: string) => {
  const generations = await prisma.duomiGeneration.findMany({
    where: { userId, isDeleted: false },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  return generations.map(serializeDuomiGeneration)
}

export const createDuomiGeneration = async (userId: string, body: DuomiGenerationBody) => {
  const kind = String(body.kind || '').toUpperCase()
  const status = String(body.status || '').toUpperCase()
  const model = String(body.model || '').trim()
  const prompt = String(body.prompt || '').trim()
  const resultUrls = Array.isArray(body.resultUrls)
    ? body.resultUrls
        .map(value => String(value || '').trim())
        .filter(value => /^https?:\/\//i.test(value))
        .slice(0, 16)
    : []
  const contentPath = String(body.contentPath || '').trim()
  const safeContentPath = /^\/(?:v1\/)?videos\/[A-Za-z0-9._~-]+\/content(?:\?.*)?$/i.test(contentPath)
    ? contentPath.slice(0, 512)
    : ''

  if (!['IMAGE', 'VIDEO'].includes(kind) || !['COMPLETED', 'FAILED'].includes(status) || !model || !prompt) {
    return null
  }

  const generation = await prisma.duomiGeneration.create({
    data: {
      userId,
      kind: kind as 'IMAGE' | 'VIDEO',
      status: status as 'COMPLETED' | 'FAILED',
      model: model.slice(0, 191),
      prompt: prompt.slice(0, 20_000),
      resultUrl: resultUrls[0] || null,
      expiresAt: resultUrls.length || safeContentPath ? new Date(Date.now() + 60 * 60 * 1000) : null,
      errorMessage: status === 'FAILED' ? String(body.errorMessage || '生成失败').slice(0, 10_000) : null,
      responseJson: toJsonValue({ urls: resultUrls, ...(safeContentPath ? { contentPath: safeContentPath } : {}) }),
    },
  })
  return serializeDuomiGeneration(generation)
}

export const deleteDuomiGeneration = async (id: string, userId: string) => {
  const result = await prisma.duomiGeneration.updateMany({
    where: { id, userId, isDeleted: false },
    data: { isDeleted: true },
  })
  return result.count > 0
}
