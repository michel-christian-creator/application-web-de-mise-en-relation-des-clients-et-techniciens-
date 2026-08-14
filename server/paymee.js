/**
 * Client Paymee (API v2) — à importer UNIQUEMENT depuis le backend.
 * Documentation : https://www.paymee.tn/paymee-integration-with-redirection/
 * La clé API ne doit jamais être embarquée dans le frontend.
 */
import { createHash } from "node:crypto"

const PAYMEE_SANDBOX = "https://sandbox.paymee.tn/api/v2"
const PAYMEE_LIVE = "https://app.paymee.tn/api/v2"

const PAYMEE_API_BASE = process.env.PAYMEE_API_BASE || PAYMEE_SANDBOX
const PAYMEE_API_KEY = process.env.PAYMEE_API_KEY || ""

function authHeaders() {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Token ${PAYMEE_API_KEY}`,
  }
}

/**
 * Crée une session de paiement Paymee (redirection).
 * Retourne { token, orderId, paymentUrl } pour rediriger le client.
 */
export async function createPayment({ amount, orderId, note, customer = {}, urls = {} }) {
  if (!PAYMEE_API_KEY) {
    throw new Error("PAYMEE_API_KEY manquante côté backend.")
  }
  const response = await fetch(`${PAYMEE_API_BASE}/payments/create`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      amount,
      note,
      first_name: customer.firstName,
      last_name: customer.lastName,
      email: customer.email,
      phone: customer.phone,
      return_url: urls.returnUrl,
      cancel_url: urls.cancelUrl,
      webhook_url: urls.webhookUrl,
      order_id: String(orderId),
    }),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok || body.status !== true || !body.data) {
    throw new Error(body.message || `Paymee create a échoué (HTTP ${response.status})`)
  }
  return {
    token: body.data.token,
    orderId: body.data.order_id,
    paymentUrl: body.data.payment_url,
  }
}

/**
 * Valide la signature check_sum reçue sur webhook_url / return_url.
 * check_sum = md5(token + payment_status(1 ou 0) + API Token)
 */
export function verifyWebhookSignature({ token, paymentStatus, checkSum }) {
  const expected = createHash("md5")
    .update(`${token}${paymentStatus ? 1 : 0}${PAYMEE_API_KEY}`)
    .digest("hex")
  return expected === checkSum
}
