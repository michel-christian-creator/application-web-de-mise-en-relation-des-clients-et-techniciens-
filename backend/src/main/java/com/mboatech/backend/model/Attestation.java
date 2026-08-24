package com.mboatech.backend.model;

import jakarta.persistence.*;

@Entity
@Table(name = "attestations")
public class Attestation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "technician_id", nullable = false)
    private TechnicianProfile technician;

    @Column(name = "intervention_count", nullable = false)
    private int interventionCount;

    @Column(name = "avg_rating", nullable = false)
    private double avgRating;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AttestationLevel level;

    @Column(name = "attestation_number", nullable = false, unique = true)
    private String attestationNumber;

    @Column(name = "generated_at", nullable = false)
    private java.sql.Timestamp generatedAt;

    @PrePersist
    public void prePersist() {
        this.generatedAt = new java.sql.Timestamp(System.currentTimeMillis());
    }

    @PreUpdate
    public void preUpdate() {
        this.generatedAt = new java.sql.Timestamp(System.currentTimeMillis());
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public TechnicianProfile getTechnician() {
        return technician;
    }

    public void setTechnician(TechnicianProfile technician) {
        this.technician = technician;
    }

    public int getInterventionCount() {
        return interventionCount;
    }

    public void setInterventionCount(int interventionCount) {
        this.interventionCount = interventionCount;
    }

    public double getAvgRating() {
        return avgRating;
    }

    public void setAvgRating(double avgRating) {
        this.avgRating = avgRating;
    }

    public AttestationLevel getLevel() {
        return level;
    }

    public void setLevel(AttestationLevel level) {
        this.level = level;
    }

    public String getAttestationNumber() {
        return attestationNumber;
    }

    public void setAttestationNumber(String attestationNumber) {
        this.attestationNumber = attestationNumber;
    }

    public java.sql.Timestamp getGeneratedAt() {
        return generatedAt;
    }

    public void setGeneratedAt(java.sql.Timestamp generatedAt) {
        this.generatedAt = generatedAt;
    }
}
