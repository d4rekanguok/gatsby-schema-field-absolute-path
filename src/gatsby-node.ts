import fs from 'fs'
import path from 'path'
import { GatsbyNode, NodePluginArgs, PluginOptions } from 'gatsby'

import { PLUGIN_NAME } from './constants'
import { createFieldExts } from './utils'

type Resolve = (...args: any[]) => any
type ResolveOptions = Record<'path', string>
interface CreateResolveArgs {
  rootDir: string;
  dir?: string;
  options?: ResolveOptions;
}
type CreateResolve = (args: CreateResolveArgs) => Resolve
const createResolve: CreateResolve = ({
  options,
  dir,
  rootDir,
}) => (src: any, _: any, context: any, info: any) => {
  const { fieldName } = info
  const partialPath = src[fieldName]
    if (!partialPath) {
      return null
    }

  // if baseDir is not passed in, generate
  // a generic resolve function that
  // accepts options instead
  let basePath
  if (dir) {
    basePath = dir
  } else {
    if (!options || typeof options.path !== 'string') {
      return null
    }
    basePath = options.path
  }
  const baseDir = path.join(rootDir, basePath)
  if (!fs.existsSync(baseDir)) {
    throw new Error(`${PLUGIN_NAME}: ${basePath} doesn't exist`)
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
  const rootDir = store.getState().program.directory

  try {
    const fieldExts = createFieldExts(dirs)

    fieldExts.forEach(entry => {
      const { dir, name } = entry

      if (process.env.NODE_ENV !== 'production') {
        reporter.info(`${PLUGIN_NAME}: Field extension created! Use @${name} for ${dir}`)
      }

      actions.createFieldExtension({
        name,
        extend: (options: ResolveOptions) => ({
          resolve: createResolve({ options, dir, rootDir })
        })
      })
    })

    // generic function
    actions.createFieldExtension({
      name: 'fileByAbsolutePath',
      args: {
        path: {
          type: 'String!',
          defaultValue: '',
        },
      },
      extend: (options: ResolveOptions) => ({
        args: {
          path: 'String',
        },
        resolve: createResolve({ options, rootDir })
      })
    })

  } catch(err) {
    reporter.warn(err)
  }
}