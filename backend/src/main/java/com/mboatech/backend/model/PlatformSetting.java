package com.mboatech.backend.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.sql.Timestamp;

@Entity
@Table(name = "platform_settings")
public class PlatformSetting {

    @Id
    @Column(name = "setting_key", length = 64, nullable = false)
    private String key;

    @Column(name = "setting_value", length = 255, nullable = false)
    private String value;

    @Column(name = "updated_at", nullable = false, updatable = false)
    private Timestamp updatedAt;

    @PrePersist
    public void prePersist() {
        if (this.updatedAt == null) {
            this.updatedAt = new Timestamp(System.currentTimeMillis());
        }
    }

    public PlatformSetting() {
    }

    public PlatformSetting(String key, String value) {
        this.key = key;
        this.value = value;
    }

    public String getKey() {
        return key;
    }

    public void setKey(String key) {
        this.key = key;
    }

    public String getValue() {
        return value;
    }

    public void setValue(String value) {
        this.value = value;
    }

    public Timestamp getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Timestamp updatedAt) {
        this.updatedAt = updatedAt;
    }
}
