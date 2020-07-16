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
}) => async (src: any, _: any, context: any, info: any) => {
  const { fieldName } = info
  const srcPath = src[fieldName]
  if (!srcPath) {
    return null
  }

  const isArray = Array.isArray(srcPath)
  const partialPaths: string[] = isArray ? srcPath : [ srcPath ]
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

  const filePaths = partialPaths.map(partialPath => path.join(baseDir, partialPath))

  const fileNodes = await context.nodeModel.runQuery({
    type: 'File',
    query: {
      filter: {
        absolutePath: {
          in: filePaths
        }
      }
    }
  })

  if (!fileNodes) {
    return null
  }

  if (fileNodes.length === 1 && !isArray) {
    return fileNodes[0]
  }

  return fileNodes
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