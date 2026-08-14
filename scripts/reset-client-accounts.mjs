// scripts/reset-client-accounts.mjs
// One-off: limpa resíduo de teste em todas as contas de cliente — apaga histórico de chat do
// Booster AI, reverte email/senha pro temporário original, e reativa a obrigação de trocar
// email/senha no próximo login (must_reset_credentials=true).
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error("SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY faltando");

const admin = createClient(url, serviceKey);

// clientId -> email temporário original (mesmo padrão nome.sobrenome@cliqueboost.io criado
// manualmente no Supabase). Senha original: CliqueBoost1234 pra todos.
const ORIGINAL_EMAILS = {
  debora: "debora.segnini@cliqueboost.io",
  lais: "lais.daltrozo@cliqueboost.io",
  sam: "sam.fernandes@cliqueboost.io",
  nelson: "nelson.modesti@cliqueboost.io",
  tiago: "tiago.zamboni@cliqueboost.io",
  bela: "bela.castro@cliqueboost.io",
};
const ORIGINAL_PASSWORD = "CliqueBoost1234";

const results = [];

for (const [clientId, email] of Object.entries(ORIGINAL_EMAILS)) {
  const { data: account } = await admin.from("client_accounts").select("user_id").eq("client_id", clientId).maybeSingle();
  if (!account) {
    results.push({ clientId, skipped: "sem client_accounts — não criado ainda" });
    continue;
  }

  const { error: authError } = await admin.auth.admin.updateUserById(account.user_id, {
    email,
    password: ORIGINAL_PASSWORD,
    email_confirm: true,
  });
  if (authError) {
    results.push({ clientId, skipped: `erro ao reverter auth: ${authError.message}` });
    continue;
  }

  const { error: flagError } = await admin
    .from("client_accounts")
    .update({ must_reset_credentials: true })
    .eq("client_id", clientId);
  if (flagError) {
    results.push({ clientId, skipped: `erro ao reativar flag: ${flagError.message}` });
    continue;
  }

  const { error: msgError } = await admin.from("chat_messages").delete().eq("client_id", clientId);
  const { error: usageError } = await admin.from("chat_usage").delete().eq("client_id", clientId);

  results.push({
    clientId,
    email,
    password: ORIGINAL_PASSWORD,
    chatCleared: !msgError && !usageError,
    warnings: [msgError?.message, usageError?.message].filter(Boolean),
  });
}

console.log(JSON.stringify(results, null, 2));
