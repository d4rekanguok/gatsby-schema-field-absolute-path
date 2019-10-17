import fs from 'fs'
import path from 'path'
import { GatsbyNode, NodePluginArgs, PluginOptions } from 'gatsby'

import { PLUGIN_NAME } from './constants'
import { createFieldExts } from './utils'

type Resolve = (...args: any[]) => any
type CreateResolve = ({ baseDir }: { baseDir: string }) => Resolve
const createResolve: CreateResolve = ({
  baseDir,
}) => (src: any, args: any, context: any, info: any) => {
  const { fieldName } = info
  const partialPath = src[fieldName]
    if (!partialPath) {
      return null
    }

  const filePath = path.join(baseDir, partialPath)
  const fileNode = context.nodeModel.runQuery({
    firstOnly: true,
    type: 'File',
    query: {
      filter: {
        absolutePath: {
          eq: filePath
        }
      }
    }
  })

  if (!fileNode) {
    return null
  }

  return fileNode
}

export const createSchemaCustomization: GatsbyNode['createSchemaCustomization'] = async (
  { actions, store, reporter }: NodePluginArgs,
  options: PluginOptions,
) => {
  const { dirs } = options
  const progDir = store.getState().program.directory

  try {
    const fieldExts = createFieldExts(dirs)

    fieldExts.forEach(entry => {
      const { dir, name } = entry
      const baseDir = path.join(progDir, dir)
      if (!fs.existsSync(baseDir)) {
        throw new Error(`${PLUGIN_NAME}: ${dir} doesn't exist`)
      }

      if (process.env.NODE_ENV !== 'production') {
        reporter.info(`${PLUGIN_NAME}: Field extension created! Use @${name} for ${dir}`)
      }

      actions.createFieldExtension({
        name,
        extend: () => ({
          resolve: createResolve({ baseDir })
        })
      })
    })
  } catch(err) {
    reporter.warn(err)
  }
}