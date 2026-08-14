package com.mboatech.backend.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "payments")
public class Payment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "service_request_id", nullable = false)
    private Long requestId;

    @Column(name = "payer_user_id", nullable = false)
    private Long payerUserId;

    @Column(name = "payee_user_id", nullable = false)
    private Long payeeUserId;

    @Column(nullable = false)
    private BigDecimal amount;

    @Column(nullable = false)
    private String currency = "XAF";

    @Column(nullable = false)
    private String status = "pending";

    @Column(nullable = false)
    private String method = "momo";

    @Column(name = "transaction_ref")
    private String transactionRef;

    @Column(name = "payment_url", length = 500)
    private String paymentUrl;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        if (this.createdAt == null) {
            this.createdAt = LocalDateTime.now();
        }
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getRequestId() {
        return requestId;
    }

    public void setRequestId(Long requestId) {
        this.requestId = requestId;
    }

    public Long getPayerUserId() {
        return payerUserId;
    }

    public void setPayerUserId(Long payerUserId) {
        this.payerUserId = payerUserId;
    }

    public Long getPayeeUserId() {
        return payeeUserId;
    }

    public void setPayeeUserId(Long payeeUserId) {
        this.payeeUserId = payeeUserId;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public void setAmount(BigDecimal amount) {
        this.amount = amount;
    }

    public String getCurrency() {
        return currency;
    }

    public void setCurrency(String currency) {
        this.currency = currency != null && !currency.isBlank() ? currency : "XAF";
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status != null && !status.isBlank() ? status : "pending";
    }

    public String getMethod() {
        return method;
    }

    public void setMethod(String method) {
        this.method = method != null && !method.isBlank() ? method : "momo";
    }

    public String getTransactionRef() {
        return transactionRef;
    }

    public void setTransactionRef(String transactionRef) {
        this.transactionRef = transactionRef;
    }

    public String getPaymentUrl() {
        return paymentUrl;
    }

    public void setPaymentUrl(String paymentUrl) {
        this.paymentUrl = paymentUrl;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
