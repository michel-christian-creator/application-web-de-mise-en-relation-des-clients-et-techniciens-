package com.mboatech.backend.service;

/** Résultat d'un débit effectué auprès de la passerelle de paiement. */
public class PaymentResult {

    private final boolean success;
    private final boolean pending;
    private final String transactionRef;
    private final String message;
    private final String paymentUrl;

    public PaymentResult(boolean success, boolean pending, String transactionRef, String message, String paymentUrl) {
        this.success = success;
        this.pending = pending;
        this.transactionRef = transactionRef;
        this.message = message;
        this.paymentUrl = paymentUrl;
    }

    public static PaymentResult success(String transactionRef) {
        return new PaymentResult(true, false, transactionRef, "Paiement accepté.", null);
    }

    public static PaymentResult success(String transactionRef, String paymentUrl) {
        return new PaymentResult(true, false, transactionRef, "Paiement accepté.", paymentUrl);
    }

    /**
     * Débit initié avec succès mais en attente de confirmation (ex. cash-in Mobile
     * Money : le client doit confirmer sur son téléphone avant que la transaction
     * ne passe à SUCCESS). La {@code reference} de la passerelle est utilisée pour
     * le suivi via webhook/polling.
     */
    public static PaymentResult pending(String transactionRef, String reference, String status) {
        return new PaymentResult(true, true, transactionRef, status == null ? "PENDING" : status, null);
    }

    public static PaymentResult failure(String message) {
        return new PaymentResult(false, false, null, message, null);
    }

    public boolean isSuccess() {
        return success;
    }

    public boolean isPending() {
        return pending;
    }

    public String getTransactionRef() {
        return transactionRef;
    }

    public String getMessage() {
        return message;
    }

    public String getPaymentUrl() {
        return paymentUrl;
    }
}
