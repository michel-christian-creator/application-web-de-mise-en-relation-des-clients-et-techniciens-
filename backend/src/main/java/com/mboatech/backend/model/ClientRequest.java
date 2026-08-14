package com.mboatech.backend.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "service_requests")
public class ClientRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "client_id")
    private Long clientId;

    @Column(name = "technician_id")
    private Long technicianId;

    @Column(name = "category", nullable = false)
    private String category;

    @Column(name = "description", nullable = false)
    private String description;

    @Column(name = "urgency")
    private String urgency = "normal";

    @Column(name = "status")
    private String status = "published";

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "scheduled_at")
    private LocalDateTime scheduledAt;

    @Column(name = "reserved_until")
    private LocalDateTime reservedUntil;

    @Column(name = "funds_deposited", nullable = false)
    private boolean fundsDeposited = false;

    @Column(name = "dispute_open", nullable = false)
    private boolean disputeOpen = false;

    @Column(name = "dispute_reporter_user_id")
    private Long disputeReporterUserId;

    @Column(name = "dispute_open_at")
    private LocalDateTime disputeOpenAt;

    @Transient
    private String title;

    @Transient
    private String domain;

    @Transient
    private boolean urgent;

    @Transient
    private String photoUrl;

    public ClientRequest() {
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getClientId() {
        return clientId;
    }

    public void setClientId(Long clientId) {
        this.clientId = clientId;
    }

    public Long getTechnicianId() {
        return technicianId;
    }

    public void setTechnicianId(Long technicianId) {
        this.technicianId = technicianId;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public String getDomain() {
        return domain;
    }

    public void setDomain(String domain) {
        this.domain = domain;
    }

    public String getUrgency() {
        return urgency;
    }

    public void setUrgency(String urgency) {
        this.urgency = urgency != null && !urgency.isBlank() ? urgency : "normal";
    }

    public boolean isUrgent() {
        return "important".equalsIgnoreCase(urgency) || "critique".equalsIgnoreCase(urgency);
    }

    public void setUrgent(boolean urgent) {
        this.urgent = urgent;
        this.urgency = urgent ? "critique" : "normal";
    }

    public String getPhotoUrl() {
        return photoUrl;
    }

    public void setPhotoUrl(String photoUrl) {
        this.photoUrl = photoUrl;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status != null && !status.isBlank() ? status : "published";
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }

    public LocalDateTime getScheduledAt() {
        return scheduledAt;
    }

    public void setScheduledAt(LocalDateTime scheduledAt) {
        this.scheduledAt = scheduledAt;
    }

    public LocalDateTime getReservedUntil() {
        return reservedUntil;
    }

    public void setReservedUntil(LocalDateTime reservedUntil) {
        this.reservedUntil = reservedUntil;
    }

    public boolean isFundsDeposited() {
        return fundsDeposited;
    }

    public void setFundsDeposited(boolean fundsDeposited) {
        this.fundsDeposited = fundsDeposited;
    }

    public boolean isDisputeOpen() {
        return disputeOpen;
    }

    public void setDisputeOpen(boolean disputeOpen) {
        this.disputeOpen = disputeOpen;
    }

    public Long getDisputeReporterUserId() {
        return disputeReporterUserId;
    }

    public void setDisputeReporterUserId(Long disputeReporterUserId) {
        this.disputeReporterUserId = disputeReporterUserId;
    }

    public LocalDateTime getDisputeOpenAt() {
        return disputeOpenAt;
    }

    public void setDisputeOpenAt(LocalDateTime disputeOpenAt) {
        this.disputeOpenAt = disputeOpenAt;
    }
}
