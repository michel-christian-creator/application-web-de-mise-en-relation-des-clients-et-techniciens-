package com.mboatech.backend.model;

import jakarta.persistence.*;

@Entity
@Table(name = "auth_sessions")
public class AuthSession {

    @Id
    @Column(length = 64, nullable = false)
    private String token;

    @Column(nullable = false)
    private String username;

    public String getToken() {
        return token;
    }

    public void setToken(String token) {
        this.token = token;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }
}
