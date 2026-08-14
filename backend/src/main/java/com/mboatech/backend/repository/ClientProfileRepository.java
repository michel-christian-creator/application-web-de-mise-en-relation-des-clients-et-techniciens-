package com.mboatech.backend.repository;

import com.mboatech.backend.model.ClientProfile;
import com.mboatech.backend.model.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ClientProfileRepository extends JpaRepository<ClientProfile, Long> {
    Optional<ClientProfile> findByUser(User user);
    Optional<ClientProfile> findByUserId(Long userId);
}
