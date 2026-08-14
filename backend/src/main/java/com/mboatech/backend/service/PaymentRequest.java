package com.mboatech.backend.service;

import java.math.BigDecimal;

/**
 * Requête de débit envoyée à la passerelle de paiement.
 *
 * <p>C'est le contrat d'entrée utilisé par {@link PaymentGateway}.
 * Les champs suffisent pour un débit Mobile Money / carte sur un chantier MboaTech.</p>
 */
public class PaymentRequest {

    private final Long requestId;
    private final BigDecimal amount;
    private final String currency;
    private final String method;
    private final Long payerUserId;
    private final Long payeeUserId;
    private final String payerName;
    private final String description;
    private final String payerEmail;
    private final String payerPhone;

    public PaymentRequest(Long requestId, BigDecimal amount, String currency, String method,
                          Long payerUserId, Long payeeUserId, String payerName, String description) {
        this(requestId, amount, currency, method, payerUserId, payeeUserId, payerName, description, null, null);
    }

    public PaymentRequest(Long requestId, BigDecimal amount, String currency, String method,
                          Long payerUserId, Long payeeUserId, String payerName, String description,
                          String payerEmail, String payerPhone) {
        this.requestId = requestId;
        this.amount = amount;
        this.currency = currency != null && !currency.isBlank() ? currency : "XAF";
        this.method = method != null ? method : "momo";
        this.payerUserId = payerUserId;
        this.payeeUserId = payeeUserId;
        this.payerName = payerName;
        this.description = description;
        this.payerEmail = payerEmail;
        this.payerPhone = payerPhone;
    }

    public Long getRequestId() {
        return requestId;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public String getCurrency() {
        return currency;
    }

    public String getMethod() {
        return method;
    }

    public Long getPayerUserId() {
        return payerUserId;
    }

    public Long getPayeeUserId() {
        return payeeUserId;
    }

    public String getPayerName() {
        return payerName;
    }

    public String getDescription() {
        return description;
    }

    public String getPayerEmail() {
        return payerEmail;
    }

    public String getPayerPhone() {
        return payerPhone;
    }
}
