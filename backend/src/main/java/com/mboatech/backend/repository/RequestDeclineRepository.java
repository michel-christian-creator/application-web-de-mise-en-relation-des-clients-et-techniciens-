package com.mboatech.backend.repository;

import com.mboatech.backend.model.RequestDecline;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface RequestDeclineRepository extends JpaRepository<RequestDecline, Long> {

    List<RequestDecline> findByTechnicianId(Long technicianId);

    boolean existsByRequestIdAndTechnicianId(Long requestId, Long technicianId);

    long countByTechnicianIdAndCreatedAtAfter(Long technicianId, LocalDateTime after);

    long countByTechnicianIdAndReasonAndCreatedAtAfter(Long technicianId, String reason, LocalDateTime after);

    void deleteByRequestIdAndTechnicianId(Long requestId, Long technicianId);
}
