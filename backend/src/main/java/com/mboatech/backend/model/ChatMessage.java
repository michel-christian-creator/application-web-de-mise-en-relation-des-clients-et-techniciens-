package com.mboatech.backend.model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "chat_messages")
public class ChatMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "service_request_id", nullable = false)
    private Long requestId;

    @Column(name = "sender_user_id", nullable = false)
    private Long senderUserId;

    @Column(name = "message_text")
    private String text;

    @Column(name = "attachment_url")
    private String imageUrl;

    @Column(name = "created_at")
    private LocalDateTime timestamp;

    @Column(name = "is_read", nullable = false)
    private boolean isRead = false;

    @Column(name = "devis_amount")
    private BigDecimal devisAmount;

    @Column(name = "devis_status")
    private String devisStatus;

    @Column(name = "schedule_at")
    private LocalDateTime scheduleAt;

    @Column(name = "schedule_status")
    private String scheduleStatus;

    @Transient
    private String sender;

    public ChatMessage() {
    }

    public ChatMessage(Long requestId, String sender, String text, String imageUrl, LocalDateTime timestamp) {
        this.requestId = requestId;
        this.sender = sender;
        this.text = text;
        this.imageUrl = imageUrl;
        this.timestamp = timestamp;
        this.isRead = false;
    }

    public boolean isRead() {
        return isRead;
    }

    public void setRead(boolean read) {
        isRead = read;
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

    public Long getSenderUserId() {
        return senderUserId;
    }

    public void setSenderUserId(Long senderUserId) {
        this.senderUserId = senderUserId;
    }

    public String getSender() {
        return sender;
    }

    public void setSender(String sender) {
        this.sender = sender;
    }

    public String getText() {
        return text;
    }

    public void setText(String text) {
        this.text = text;
    }

    public String getImageUrl() {
        return imageUrl;
    }

    public void setImageUrl(String imageUrl) {
        this.imageUrl = imageUrl;
    }

    public LocalDateTime getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(LocalDateTime timestamp) {
        this.timestamp = timestamp;
    }

    public BigDecimal getDevisAmount() {
        return devisAmount;
    }

    public void setDevisAmount(BigDecimal devisAmount) {
        this.devisAmount = devisAmount;
    }

    public String getDevisStatus() {
        return devisStatus;
    }

    public void setDevisStatus(String devisStatus) {
        this.devisStatus = devisStatus;
    }

    public LocalDateTime getScheduleAt() {
        return scheduleAt;
    }

    public void setScheduleAt(LocalDateTime scheduleAt) {
        this.scheduleAt = scheduleAt;
    }

    public String getScheduleStatus() {
        return scheduleStatus;
    }

    public void setScheduleStatus(String scheduleStatus) {
        this.scheduleStatus = scheduleStatus;
    }
}
