package com.mboatech.backend.repository;

import com.mboatech.backend.model.ClientRequest;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface ClientRequestRepository extends JpaRepository<ClientRequest, Long> {
    List<ClientRequest> findByTechnicianIdOrderByCreatedAtDesc(Long technicianId);

    List<ClientRequest> findByStatusOrderByCreatedAtDesc(String status);

    List<ClientRequest> findByClientIdOrderByCreatedAtDesc(Long clientId);

    List<ClientRequest> findByDisputeOpenTrueOrderByDisputeOpenAtDesc();

    boolean existsByClientIdAndTechnicianIdAndStatus(Long clientId, Long technicianId, String status);

    List<ClientRequest> findByStatusAndReservedUntilBeforeAndFundsDepositedFalseAndDisputeOpenFalse(
            String status, LocalDateTime reservedUntil);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT r FROM ClientRequest r WHERE r.id = :requestId")
    Optional<ClientRequest> findByIdForUpdate(@Param("requestId") Long requestId);
}
