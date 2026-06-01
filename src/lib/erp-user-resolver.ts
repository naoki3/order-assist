import { createAdminClient } from './supabase-admin'

export interface PerformedBy {
  source_system: string
  source_user_id: string
  email: string
}

export interface ResolvedUser {
  wms_user_id: string
  email: string
}

export async function resolvePerformedBy(
  performedBy: PerformedBy
): Promise<ResolvedUser | null> {
  const supabase = createAdminClient()
  const email = performedBy.email.toLowerCase()

  const { data: mapping } = await supabase
    .from('erp_user_mappings')
    .select('wms_user_id, email')
    .eq('source_system', performedBy.source_system)
    .eq('source_user_id', performedBy.source_user_id)
    .eq('active', true)
    .maybeSingle()

  if (mapping) {
    const m = mapping as { wms_user_id: string; email: string }
    return { wms_user_id: m.wms_user_id, email: m.email }
  }

  const { data: listData } = await supabase.auth.admin.listUsers()
  const matchedUser = listData?.users.find(u => u.email?.toLowerCase() === email)
  if (!matchedUser) return null

  await supabase.from('erp_user_mappings').insert({
    source_system: performedBy.source_system,
    source_user_id: performedBy.source_user_id,
    wms_user_id: matchedUser.id,
    email,
  })

  return { wms_user_id: matchedUser.id, email }
}

export async function logErpAudit(params: {
  source_system: string
  source_user_id: string | null
  wms_user_id: string | null
  email: string | null
  action: string
  entity_type?: string
  entity_id?: number
  details?: Record<string, unknown>
}) {
  try {
    const supabase = createAdminClient()
    await supabase.from('erp_audit_log').insert(params)
  } catch (_e) {
    // 監査ログ失敗はメイン処理をブロックしない
  }
}
