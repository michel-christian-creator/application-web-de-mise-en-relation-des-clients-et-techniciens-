package com.mboatech.backend.service;

/** Résultat d'un débit effectué auprès de la passerelle de paiement. */
public class PaymentResult {

    private final boolean success;
    private final String transactionRef;
    private final String message;
    private final String paymentUrl;

    public PaymentResult(boolean success, String transactionRef, String message, String paymentUrl) {
        this.success = success;
        this.transactionRef = transactionRef;
        this.message = message;
        this.paymentUrl = paymentUrl;
    }

    public static PaymentResult success(String transactionRef) {
        return new PaymentResult(true, transactionRef, "Paiement accepté.", null);
    }

    public static PaymentResult success(String transactionRef, String paymentUrl) {
        return new PaymentResult(true, transactionRef, "Paiement accepté.", paymentUrl);
    }

    public static PaymentResult failure(String message) {
        return new PaymentResult(false, null, message, null);
    }

    public boolean isSuccess() {
        return success;
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
