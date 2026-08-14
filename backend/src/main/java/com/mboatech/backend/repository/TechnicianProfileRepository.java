package com.mboatech.backend.repository;

import com.mboatech.backend.model.TechnicianProfile;
import com.mboatech.backend.model.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface TechnicianProfileRepository extends JpaRepository<TechnicianProfile, Long> {
    Optional<TechnicianProfile> findByUser(User user);
    Optional<TechnicianProfile> findByUserId(Long userId);
}
