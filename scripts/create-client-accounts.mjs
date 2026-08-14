// scripts/create-client-accounts.mjs
// One-off: cria contas temporárias (nome@cliqueboost.io + senha provisória) pros 6 clientes
// fixos, com must_reset_credentials=true. Não fica no repo depois de rodado — ver git log.
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error("SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY faltando");

const admin = createClient(url, serviceKey);

const CLIENTS = ["debora", "lais", "sam", "nelson", "tiago", "bela"];

function genPassword() {
  return randomBytes(9).toString("base64url"); // ~12 chars, url-safe
}

const results = [];

for (const clientId of CLIENTS) {
  const { data: existing } = await admin.from("client_accounts").select("client_id").eq("client_id", clientId).maybeSingle();
  if (existing) {
    results.push({ clientId, email: null, password: null, skipped: "já tem conta" });
    continue;
  }

  const email = `${clientId}@cliqueboost.io`;
  const password = genPassword();

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (authError || !authData.user) {
    results.push({ clientId, email, password: null, skipped: `erro ao criar auth user: ${authError?.message}` });
    continue;
  }

  const { error: accountError } = await admin
    .from("client_accounts")
    .insert({ user_id: authData.user.id, client_id: clientId, must_reset_credentials: true });
  if (accountError) {
    await admin.auth.admin.deleteUser(authData.user.id);
    results.push({ clientId, email, password: null, skipped: `erro ao criar client_accounts: ${accountError.message}` });
    continue;
  }

  results.push({ clientId, email, password, skipped: null });
}

console.log(JSON.stringify(results, null, 2));
