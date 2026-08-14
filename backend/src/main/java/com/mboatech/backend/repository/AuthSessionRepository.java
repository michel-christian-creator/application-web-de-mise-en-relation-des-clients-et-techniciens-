package com.mboatech.backend.repository;

import com.mboatech.backend.model.AuthSession;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface AuthSessionRepository extends JpaRepository<AuthSession, String> {
    Optional<AuthSession> findByToken(String token);
}
