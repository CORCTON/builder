import { describe, expect, it } from 'vitest'
import { fromConfig, fromText, toConfig } from '@/models/common/file'
import { hashFiles } from '@/models/common/hash'
import { xbpHelpers } from '@/models/common/xbp'
import { Backdrop } from '@/models/spx/backdrop'
import { Costume } from '@/models/spx/costume'
import { Sound } from '@/models/spx/sound'
import { Sprite } from '@/models/spx/sprite'
import { SpxProject, projectConfigFilePath } from '@/models/spx/project'
import { History } from './history'
import { importProjectFile } from './project-import'

function mockFile(name: string) {
  return fromText(name, name)
}

function makeProject(name: string, spriteName: string) {
  const project = new SpxProject('owner', name)
  project.displayName = name
  project.stage.addBackdrop(new Backdrop(`${name}Backdrop`, mockFile(`${name}Backdrop`)))
  project.addSound(new Sound(`${name}Sound`, mockFile(`${name}Sound`)))

  const sprite = new Sprite(spriteName)
  sprite.addCostume(new Costume(`${spriteName}Costume`, mockFile(`${spriteName}Costume`)))
  project.addSprite(sprite)
  return project
}

async function makeXbpFile(project: SpxProject, displayName: string) {
  return xbpHelpers.save({
    metadata: { displayName },
    files: project.exportFiles()
  })
}

describe('importProjectFile', () => {
  it('preserves the active project and undo/redo history when an XBP references a missing tilemap', async () => {
    const project = makeProject('Current project', 'Current sprite')
    const history = new History(project)
    const firstAction = { name: { en: 'First edit', zh: '首次编辑' } }
    const redoAction = { name: { en: 'Redo edit', zh: '重做编辑' } }

    const initialHash = await hashFiles(project.exportFiles())
    await history.doAction(firstAction, () => project.sprites[0].setName('CurrentAfterFirstEdit'))
    const currentHash = await hashFiles(project.exportFiles())
    await history.doAction(redoAction, () => project.sprites[0].setName('CurrentAfterRedo'))
    const redoHash = await hashFiles(project.exportFiles())
    await history.undo()

    const imported = makeProject('Replacement project', 'Replacement sprite')
    const files = { ...imported.exportFiles() }
    const configFile = files[projectConfigFilePath]!
    const config = (await toConfig(configFile)) as Record<string, unknown>
    files[projectConfigFilePath] = fromConfig(configFile.name, {
      ...config,
      tilemapPath: 'maps/missing.json'
    })
    const file = await xbpHelpers.save({
      metadata: { displayName: 'Replacement project' },
      files
    })

    await expect(importProjectFile(file, project, history)).rejects.toThrow('tilemap file not found')

    expect.soft(await hashFiles(project.exportFiles())).toBe(currentHash)
    expect.soft(project.displayName).toBe('Current project')
    expect.soft(project.sprites.map((sprite) => sprite.name)).toEqual(['CurrentAfterFirstEdit'])
    expect.soft(project.sounds.map((sound) => sound.name)).toEqual(['Current projectSound'])
    expect.soft(history.getUndoAction()).toBe(firstAction)
    expect.soft(history.getRedoAction()).toBe(redoAction)

    await history.undo()
    expect.soft(await hashFiles(project.exportFiles())).toBe(initialHash)
    await history.redo()
    expect.soft(await hashFiles(project.exportFiles())).toBe(currentHash)
    await history.redo()
    expect.soft(await hashFiles(project.exportFiles())).toBe(redoHash)

    imported.dispose()
    project.dispose()
  })

  it('preserves the active project and undo/redo history when XBP parsing fails', async () => {
    const project = makeProject('Current project', 'Current sprite')
    const history = new History(project)
    const firstAction = { name: { en: 'First edit', zh: '首次编辑' } }
    const redoAction = { name: { en: 'Redo edit', zh: '重做编辑' } }

    const initialHash = await hashFiles(project.exportFiles())
    await history.doAction(firstAction, () => project.sprites[0].setName('CurrentAfterFirstEdit'))
    const currentHash = await hashFiles(project.exportFiles())
    await history.doAction(redoAction, () => project.sprites[0].setName('CurrentAfterRedo'))
    const redoHash = await hashFiles(project.exportFiles())
    await history.undo()

    const file = new File(['not an XBP archive'], 'invalid.xbp')

    await expect(importProjectFile(file, project, history)).rejects.toThrow()

    expect(await hashFiles(project.exportFiles())).toBe(currentHash)
    expect(project.displayName).toBe('Current project')
    expect(history.getUndoAction()).toBe(firstAction)
    expect(history.getRedoAction()).toBe(redoAction)

    await history.undo()
    expect(await hashFiles(project.exportFiles())).toBe(initialHash)
    await history.redo()
    expect(await hashFiles(project.exportFiles())).toBe(currentHash)
    await history.redo()
    expect(await hashFiles(project.exportFiles())).toBe(redoHash)

    project.dispose()
  })

  it('imports valid XBP files as undoable actions', async () => {
    const project = makeProject('Current project', 'Current sprite')
    const beforeHash = await hashFiles(project.exportFiles())
    const history = new History(project)
    const imported = makeProject('Replacement project', 'Replacement sprite')
    const file = await makeXbpFile(imported, 'Imported project')
    const importedHash = await hashFiles(imported.exportFiles())

    await importProjectFile(file, project, history)

    expect(project.displayName).toBe('Imported project')
    expect(project.sprites.map((sprite) => sprite.name)).toEqual(['ReplacementSprite'])
    expect(history.getUndoAction()).toMatchObject({ name: { en: 'Import project file' } })
    await history.undo()
    expect(await hashFiles(project.exportFiles())).toBe(beforeHash)
    await history.redo()
    expect(await hashFiles(project.exportFiles())).toBe(importedHash)

    imported.dispose()
    project.dispose()
  })

  it('imports an empty XBP file', async () => {
    const project = makeProject('Current project', 'Current sprite')
    const history = new History(project)
    const file = await xbpHelpers.save({ metadata: { displayName: 'Empty project' }, files: {} })

    await importProjectFile(file, project, history)

    expect(project.displayName).toBe('Empty project')
    expect(project.sprites).toHaveLength(0)
    expect(project.sounds).toHaveLength(0)

    project.dispose()
  })
})
