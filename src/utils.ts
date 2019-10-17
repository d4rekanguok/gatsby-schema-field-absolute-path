import path from 'path'

import { PLUGIN_NAME } from './constants'

type ToTitleCase = (str: string) => string
const toTitleCase: ToTitleCase = str => {
  const [first, ...rest] = str
  return [first.toUpperCase(), ...rest].join('')
}

type CreateName = (dir: string) => string
const createName: CreateName = dir => {
  const { name } = path.parse(dir)
  const transformed = toTitleCase(name)
  return `fileBy${transformed}Path`
}

interface Ext {
  name: string,
  dir: string,
}
type CreateFieldExts = (dirs: any) => Ext[]
export const createFieldExts: CreateFieldExts = dirs => {
  const fieldExts: Ext[] = []

  if (!dirs) {
    throw new Error(`${PLUGIN_NAME}: No 'dirs' passed to this plugin's options.`)
  }

  if (typeof dirs === 'string') {
    fieldExts.push({
      name: createName(dirs),
      dir: dirs
    })
    return fieldExts
  }

  if (Array.isArray(dirs)) {
    const names = new Set()
    const processed = dirs.map(dir => {
      if (typeof dir !== 'string') return null
      const name = createName(dir)

      if (names.has(name)) {
        throw new Error(`${PLUGIN_NAME}: ${name} already exists.`)
      } else {
        names.add(name)
      }

      return {
        name: createName(dir),
        dir,
      }
    }).filter(dir => !!dir)
    Array.prototype.push.apply(fieldExts, processed)
    return fieldExts
  }

  if (typeof dirs === 'object') {
    const processed = Object.entries(dirs).map(entry => {
      const [name, dir] = entry
      if (typeof name !== 'string' || typeof dir !== 'string') return null
      return { name, dir }
    }).filter(dir => !!dir)
    Array.prototype.push.apply(fieldExts, processed)
    return fieldExts
  }

  return fieldExts
}