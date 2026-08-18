/**
 * multiple-chat-panels host half.
 *
 * Provides a lightweight git-info RPC for the client pane headers:
 * `GET /multiple-chat-panels/api/git-info?path=<dir>` returns
 * `{ isRepo, branch, worktree }`.
 */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'

export const name = 'multiple-chat-panels'
export const inject = ['webServer']

const execFileAsync = promisify(execFile)

async function gitInfo(path: string): Promise<{ isRepo: boolean; branch: string | null; worktree: string | null }> {
  let branch: string | null = null
  let worktree: string | null = null
  let isRepo = false
  try {
    // symbolic-ref handles an unborn HEAD (fresh repo, no commits yet);
    // rev-parse is the fallback for detached/ordinary branches.
    const { stdout } = await execFileAsync(
      'git', ['-C', path, 'symbolic-ref', '--short', 'HEAD'],
      { encoding: 'utf8', timeout: 5000 },
    ).catch(async () => execFileAsync(
      'git', ['-C', path, 'rev-parse', '--abbrev-ref', 'HEAD'],
      { encoding: 'utf8', timeout: 5000 },
    ))
    branch = stdout.trim() || null
    isRepo = true
  } catch {
    return { isRepo: false, branch: null, worktree: null }
  }
  try {
    const { stdout } = await execFileAsync(
      'git', ['-C', path, 'worktree', 'list', '--porcelain'],
      { encoding: 'utf8', timeout: 5000 },
    )
    worktree = stdout.includes('worktree ') ? 'worktree' : null
  } catch {
    worktree = null
  }
  return { isRepo, branch, worktree }
}

export function apply(ctx: Context): void {
  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: '/multiple-chat-panels/api',
    handler: async (req: any, res: any) => {
      const url = new URL(req.url ?? '/', 'http://localhost')
      if (url.pathname.endsWith('/git-info')) {
        const path = url.searchParams.get('path') ?? ''
        if (path === '') {
          res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' })
          res.end(JSON.stringify({ error: 'missing path' }))
          return
        }
        const info = await gitInfo(path)
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify(info))
        return
      }
      res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ error: 'not found' }))
    },
  }), 'multiple-chat-panels: git-info api')
}
