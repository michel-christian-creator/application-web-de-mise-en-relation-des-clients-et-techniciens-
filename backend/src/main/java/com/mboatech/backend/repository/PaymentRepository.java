package com.mboatech.backend.repository;

import com.mboatech.backend.model.Payment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PaymentRepository extends JpaRepository<Payment, Long> {

    Optional<Payment> findFirstByRequestIdAndStatusOrderByIdAsc(Long requestId, String status);

    List<Payment> findByRequestIdOrderByIdDesc(Long requestId);

    List<Payment> findAllByOrderByCreatedAtDesc();

    Optional<Payment> findFirstByTransactionRef(String transactionRef);
}
