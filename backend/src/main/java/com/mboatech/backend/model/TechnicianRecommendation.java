package com.mboatech.backend.model;

import jakarta.persistence.*;

@Entity
@Table(name = "technician_recommendations")
public class TechnicianRecommendation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "technician_id", nullable = false)
    private TechnicianProfile technician;

    @Column(name = "recommender_user_id")
    private Long recommenderUserId;

    @Column(name = "recommender_name")
    private String recommenderName;

    @Column(columnDefinition = "TEXT")
    private String comment;

    private Integer rating;

    @Column(nullable = false)
    private boolean verified = false;

    @Column(name = "created_at", nullable = false, updatable = false)
    private java.sql.Timestamp createdAt = new java.sql.Timestamp(System.currentTimeMillis());

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

    public Long getRecommenderUserId() {
        return recommenderUserId;
    }

    public void setRecommenderUserId(Long recommenderUserId) {
        this.recommenderUserId = recommenderUserId;
    }

    public String getRecommenderName() {
        return recommenderName;
    }

    public void setRecommenderName(String recommenderName) {
        this.recommenderName = recommenderName;
    }

    public String getComment() {
        return comment;
    }

    public void setComment(String comment) {
        this.comment = comment;
    }

    public Integer getRating() {
        return rating;
    }

    public void setRating(Integer rating) {
        this.rating = rating;
    }

    public boolean isVerified() {
        return verified;
    }

    public void setVerified(boolean verified) {
        this.verified = verified;
    }

    public java.sql.Timestamp getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(java.sql.Timestamp createdAt) {
        this.createdAt = createdAt;
    }
}
