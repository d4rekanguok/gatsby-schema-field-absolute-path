import fs from 'fs'
import path from 'path'
import type { Node, GatsbyNode, NodePluginArgs, PluginOptions, Reporter } from 'gatsby'

import { PLUGIN_NAME } from './constants'
import { createFieldExts } from './utils'

interface CustomPluginOptions extends PluginOptions {
  dirs?: string | string[] | Record<string, string>
  verbose?: boolean
}

type Resolve = (...args: any[]) => any
type ResolveOptions = Record<'path', string>
interface CreateResolveArgs {
  rootDir: string
  dir?: string
  options?: ResolveOptions
  reporter: Reporter
  verbose: boolean
}
type CreateResolve = (args: CreateResolveArgs) => Resolve
const createResolve: CreateResolve = ({ options, dir, rootDir, reporter, verbose }) => async (
  src: any,
  _: any,
  context: any,
  info: any
) => {
  const { fieldName } = info
  const srcPath = src[fieldName]
  if (!srcPath) {
    return null
  }

  const isArray = Array.isArray(srcPath)
  const partialPaths: string[] = isArray ? srcPath : [srcPath]
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
  const baseDir = path.posix.join(rootDir, basePath)
  if (!fs.existsSync(baseDir)) {
    throw new Error(`${PLUGIN_NAME}: ${basePath} doesn't exist`)
  }

  const filePaths = partialPaths.map((partialPath) =>
    path.posix.join(baseDir, partialPath)
  )

  if (verbose) {
    reporter.info(`[${PLUGIN_NAME}] querying for ${filePaths.length} path(s):`)
    filePaths.forEach((filePath) => {
      reporter.info(filePath)
    })
  }

  // Entries may be in a different order here
  const fileNodes: Node[] = await context.nodeModel.runQuery({
    type: 'File',
    query: {
      filter: {
        absolutePath: {
          in: filePaths,
        },
      },
    },
  })

  if (verbose) {
    reporter.info(`[${PLUGIN_NAME}] found ${fileNodes.length} node(s).`)
    fileNodes.forEach((node) => {
      if (node && node.id) reporter.success(`node id: ${node.id}`)
      else reporter.warn(`invalid node: ${JSON.stringify(node)}`)
    })
  }

  if (!fileNodes) {
    return null
  }

  if (fileNodes.length === 1 && !isArray) {
    return fileNodes[0]
  }

  // Return in original order
  const fileNodesOrdered = filePaths.map((filepath) => {
    return fileNodes.find((node: any) => {
      return node.absolutePath === filepath
    })
  })

  return fileNodesOrdered
}

export const createSchemaCustomization: GatsbyNode['createSchemaCustomization'] = async (
  { actions, store, reporter }: NodePluginArgs,
  options: CustomPluginOptions
) => {
  const { dirs, verbose: userVerbose = false } = options
  const verbose = process.env.NODE_ENV !== 'production' && userVerbose
  const rootDir = store.getState().program.directory

  try {
    const fieldExts = createFieldExts(dirs)

    fieldExts.forEach((entry) => {
      const { dir, name } = entry

      if (process.env.NODE_ENV !== 'production') {
        reporter.info(
          `${PLUGIN_NAME}: Field extension created! Use @${name} for ${dir}`
        )
      }

      actions.createFieldExtension({
        name,
        extend: (options: ResolveOptions) => ({
          resolve: createResolve({ options, dir, rootDir, reporter, verbose }),
        }),
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
        resolve: createResolve({ options, rootDir, reporter, verbose }),
      }),
    })
  } catch (err) {
    reporter.warn(err)
  }
}
