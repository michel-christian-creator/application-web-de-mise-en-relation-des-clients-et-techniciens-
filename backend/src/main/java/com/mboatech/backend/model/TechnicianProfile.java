package com.mboatech.backend.model;

import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "technicians")
public class TechnicianProfile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    private String domain;
    private String city;
    private String location;
    private String bio;
    private String specialties;
    private double ratingAvg = 0.0;
    private int ratingCount = 0;
    private Integer experienceYears;
    private boolean verified = false;

    @Enumerated(EnumType.STRING)
    private AvailabilityStatus availabilityStatus = AvailabilityStatus.available;

    private Double hourlyRate;

    @Column(name = "success_rate")
    private Double successRate = 0.0;

    @Column(name = "acceptance_count", nullable = false)
    private int acceptanceCount = 0;

    @Column(name = "decline_count", nullable = false)
    private int declineCount = 0;

    @Column(name = "avg_response_time_sec")
    private Integer avgResponseTimeSec = 0;

    @Column(name = "suspended_until")
    private LocalDateTime suspendedUntil;

    @Column(name = "suspended_permanent", nullable = false)
    private boolean suspendedPermanent = false;

    @Column(name = "created_at", nullable = false, updatable = false)
    private java.sql.Timestamp createdAt = new java.sql.Timestamp(System.currentTimeMillis());

    @Column(name = "updated_at", nullable = false)
    private java.sql.Timestamp updatedAt = new java.sql.Timestamp(System.currentTimeMillis());

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = new java.sql.Timestamp(System.currentTimeMillis());
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public User getUser() {
        return user;
    }

    public void setUser(User user) {
        this.user = user;
    }

    public String getDomain() {
        return domain;
    }

    public void setDomain(String domain) {
        this.domain = domain;
    }

    public String getCity() {
        return city;
    }

    public void setCity(String city) {
        this.city = city;
    }

    public String getLocation() {
        return location;
    }

    public void setLocation(String location) {
        this.location = location;
    }

    public String getBio() {
        return bio;
    }

    public void setBio(String bio) {
        this.bio = bio;
    }

    public String getSpecialties() {
        return specialties;
    }

    public void setSpecialties(String specialties) {
        this.specialties = specialties;
    }

    public double getRatingAvg() {
        return ratingAvg;
    }

    public void setRatingAvg(double ratingAvg) {
        this.ratingAvg = ratingAvg;
    }

    public int getRatingCount() {
        return ratingCount;
    }

    public void setRatingCount(int ratingCount) {
        this.ratingCount = ratingCount;
    }

    public Integer getExperienceYears() {
        return experienceYears;
    }

    public void setExperienceYears(Integer experienceYears) {
        this.experienceYears = experienceYears;
    }

    public boolean isVerified() {
        return verified;
    }

    public void setVerified(boolean verified) {
        this.verified = verified;
    }

    public AvailabilityStatus getAvailabilityStatus() {
        return availabilityStatus;
    }

    public void setAvailabilityStatus(AvailabilityStatus availabilityStatus) {
        this.availabilityStatus = availabilityStatus;
    }

    public Double getHourlyRate() {
        return hourlyRate;
    }

    public void setHourlyRate(Double hourlyRate) {
        this.hourlyRate = hourlyRate;
    }

    public Double getSuccessRate() {
        return successRate;
    }

    public void setSuccessRate(Double successRate) {
        this.successRate = successRate;
    }

    public int getAcceptanceCount() {
        return acceptanceCount;
    }

    public void setAcceptanceCount(int acceptanceCount) {
        this.acceptanceCount = acceptanceCount;
    }

    public int getDeclineCount() {
        return declineCount;
    }

    public void setDeclineCount(int declineCount) {
        this.declineCount = declineCount;
    }

    public Integer getAvgResponseTimeSec() {
        return avgResponseTimeSec;
    }

    public void setAvgResponseTimeSec(Integer avgResponseTimeSec) {
        this.avgResponseTimeSec = avgResponseTimeSec;
    }

    public LocalDateTime getSuspendedUntil() {
        return suspendedUntil;
    }

    public void setSuspendedUntil(LocalDateTime suspendedUntil) {
        this.suspendedUntil = suspendedUntil;
    }

    public boolean isSuspendedPermanent() {
        return suspendedPermanent;
    }

    public void setSuspendedPermanent(boolean suspendedPermanent) {
        this.suspendedPermanent = suspendedPermanent;
    }
}
