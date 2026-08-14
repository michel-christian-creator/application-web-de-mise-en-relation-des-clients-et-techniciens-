import { createPayment, verifyWebhookSignature } from "./paymee.js"

/*
 * Exemple d'implémentation de POST /api/payments/deposit côté backend.
 * Le frontend continue d'appeler /api/payments/deposit ; ici on crée la
 * session Paymee puis on renvoie paymentUrl pour rediriger le client.
 */
export async function depositHandler(req, res, db) {
  const { requestId, amount, method } = req.body

  if (!requestId || !Number.isInteger(amount) || amount <= 0) {
    return res.status(400).json({ error: "Données de dépôt invalides" })
  }

  const customer = await db.getPayerForRequest(requestId)
  try {
    const payment = await createPayment({
      amount,
      orderId: requestId,
      note: `Dépôt de garantie MboaTech #${requestId}`,
      customer: {
        firstName: customer?.firstName,
        lastName: customer?.lastName,
        email: customer?.email,
        phone: customer?.phone,
      },
      urls: {
        returnUrl: `${process.env.APP_BASE_URL}/paiement/retour`,
        cancelUrl: `${process.env.APP_BASE_URL}/paiement/annulation`,
        webhookUrl: `${process.env.APP_BASE_URL}/api/payments/webhook`,
      },
    })

    await db.storePendingPayment({
      requestId,
      amount,
      method,
      token: payment.token,
      status: "pending",
    })

    return res.json({ txRef: payment.token, paymentUrl: payment.paymentUrl })
  } catch (error) {
    return res.status(502).json({ error: error.message })
  }
}

/*
 * Webhook Paymee : vérifie la signature, puis marque les fonds déposés.
 */
export async function webhookHandler(req, res, db) {
  const { token, payment_status, check_sum, order_id, transaction_id } = req.body
  if (
    !verifyWebhookSignature({
      token,
      paymentStatus: payment_status,
      checkSum: check_sum,
    })
  ) {
    return res.status(401).json({ error: "Signature invalide" })
  }
  if (payment_status === true) {
    await db.markFundsDeposited({
      orderId: order_id,
      transactionId: transaction_id,
    })
  }
  return res.json({ received: true })
}
