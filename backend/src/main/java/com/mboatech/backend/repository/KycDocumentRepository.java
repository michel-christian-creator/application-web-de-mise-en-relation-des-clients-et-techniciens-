package com.mboatech.backend.repository;

import com.mboatech.backend.model.KycDocument;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface KycDocumentRepository extends JpaRepository<KycDocument, Long> {
    List<KycDocument> findByUserIdOrderByCreatedAtDesc(Long userId);
    Optional<KycDocument> findByUserIdAndDocType(Long userId, String docType);
    List<KycDocument> findAllByOrderByCreatedAtDesc();
}
