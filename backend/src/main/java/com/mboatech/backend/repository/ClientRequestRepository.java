package com.mboatech.backend.repository;

import com.mboatech.backend.model.ClientRequest;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface ClientRequestRepository extends JpaRepository<ClientRequest, Long> {
    List<ClientRequest> findByTechnicianIdOrderByCreatedAtDesc(Long technicianId);

    List<ClientRequest> findByStatusOrderByCreatedAtDesc(String status);

    List<ClientRequest> findByClientIdOrderByCreatedAtDesc(Long clientId);

    List<ClientRequest> findByDisputeOpenTrueOrderByDisputeOpenAtDesc();

    boolean existsByClientIdAndTechnicianIdAndStatus(Long clientId, Long technicianId, String status);

    List<ClientRequest> findByStatusAndReservedUntilBeforeAndFundsDepositedFalseAndDisputeOpenFalse(
            String status, LocalDateTime reservedUntil);
}
