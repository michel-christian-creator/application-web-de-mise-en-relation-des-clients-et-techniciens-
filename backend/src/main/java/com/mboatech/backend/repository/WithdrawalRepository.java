package com.mboatech.backend.repository;

import com.mboatech.backend.model.Withdrawal;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface WithdrawalRepository extends JpaRepository<Withdrawal, Long> {

    List<Withdrawal> findByTechnicianUserIdOrderByCreatedAtDesc(Long technicianUserId);

    List<Withdrawal> findByClientUserIdOrderByCreatedAtDesc(Long clientUserId);

    List<Withdrawal> findAllByOrderByCreatedAtDesc();
}
