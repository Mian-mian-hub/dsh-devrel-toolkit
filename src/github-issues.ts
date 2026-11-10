import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
export const name = 'devrel-github-ingress'
export const inject = ['devrelBoard']
export const Config = z.object({ source: z.string().default('devrel-github'), maxBodyChars: z.number().min(256).max(50000).default(6000) })

export function parseIssue(delivery: any, repositories: string[], source = 'devrel-github', maxBodyChars = 6000) {
  if (delivery.kind !== 'github' || delivery.source !== source || delivery.event?.name !== 'issues') return null
  const p = delivery.event.payload
  const repo = p?.repository?.full_name
  if (p?.action !== 'opened' || typeof repo !== 'string' || !repositories.some((r) => r.toLowerCase() === repo.toLowerCase())) return null
  const i = p.issue
  if (!i || i.pull_request !== undefined) return null
  if (!Number.isSafeInteger(i.id) || i.id <= 0 || !Number.isSafeInteger(i.number) || i.number <= 0 ||
    typeof i.title !== 'string' || !i.title.trim() || !(i.body === null || typeof i.body === 'string')) throw new Error('Malformed Issue')
  const demo = i.devrelDemo === true
  return { repository: repo, issueId: demo ? null : i.id, number: demo ? null : i.number,
    url: demo ? null : `https://github.com/${repo}/issues/${i.number}`, isDemo: demo,
    title: i.title.slice(0, 500), body: (i.body ?? '').slice(0, maxBodyChars), bodyTruncated: (i.body ?? '').length > maxBodyChars,
    deliveryId: delivery.deliveryId, author: typeof i.user?.login === 'string' ? i.user.login : null }
}

export function apply(ctx: Context, config: { source: string; maxBodyChars: number }) {
  // Mounted in the ingress's isolated webhookRuntime realm. The official signed
  // adapter dispatches here; no WebhookSessionRequest or Agent is ever created.
  ctx.provide('webhookRuntime', {
    dispatch(delivery: any) {
      const issue = parseIssue(delivery, (ctx as any).devrelBoard.config.repositories, config.source, config.maxBodyChars)
      if (issue) void (ctx as any).devrelBoard.enqueue(issue).catch(() => ctx.logger.warn('DevRel issue could not be saved.'))
    },
  } as any)
}
