package com.mboatech.backend.repository;

import com.mboatech.backend.model.Attestation;
import com.mboatech.backend.model.AttestationLevel;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AttestationRepository extends JpaRepository<Attestation, Long> {
    List<Attestation> findByTechnicianIdOrderByGeneratedAtDesc(Long technicianId);

    Optional<Attestation> findByTechnicianIdAndLevel(Long technicianId, AttestationLevel level);

    Optional<Attestation> findTopByTechnicianIdOrderByGeneratedAtDesc(Long technicianId);
}
