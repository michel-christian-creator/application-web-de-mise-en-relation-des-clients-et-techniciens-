package com.mboatech.backend.repository;

import com.mboatech.backend.model.Withdrawal;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface WithdrawalRepository extends JpaRepository<Withdrawal, Long> {

    List<Withdrawal> findByTechnicianUserIdOrderByCreatedAtDesc(Long technicianUserId);

    List<Withdrawal> findByClientUserIdOrderByCreatedAtDesc(Long clientUserId);

    List<Withdrawal> findAllByOrderByCreatedAtDesc();

    @Modifying
    @Query("UPDATE Withdrawal w SET w.status = 'paid' WHERE w.id = :id AND w.status = 'pending'")
    int markPaidIfPending(@Param("id") Long id);

    @Modifying
    @Query("UPDATE Withdrawal w SET w.status = 'rejected' WHERE w.id = :id AND w.status = 'pending'")
    int markRejectedIfPending(@Param("id") Long id);
}
