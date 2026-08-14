package com.mboatech.backend.model;

import jakarta.persistence.*;

@Entity
@Table(name = "admins")
public class AdminProfile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "role_name", nullable = false)
    private String roleName = "admin";

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

    public String getRoleName() {
        return roleName;
    }

    public void setRoleName(String roleName) {
        this.roleName = roleName;
    }
}
