import { xbpHelpers } from '@/models/common/xbp'
import { SpxProject } from '@/models/spx/project'
import type { History } from './history'

export const importProjectFileMessage = { en: 'Import project file', zh: '导入项目文件' }
const importProjectFileAction = { name: importProjectFileMessage }

export async function importProjectFile(file: globalThis.File, project: SpxProject, history: History) {
  const serialized = await xbpHelpers.load(file)
  const validationProject = new SpxProject()
  try {
    await validationProject.load(serialized)
  } finally {
    validationProject.dispose()
  }

  await history.doAction(importProjectFileAction, () => project.load(serialized))
}
