package com.mboatech.backend.repository;

import com.mboatech.backend.model.TechnicianRecommendation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TechnicianRecommendationRepository extends JpaRepository<TechnicianRecommendation, Long> {
    List<TechnicianRecommendation> findByTechnicianIdOrderByCreatedAtDesc(Long technicianId);
    List<TechnicianRecommendation> findByTechnicianIdAndRatingNotNullOrderByCreatedAtDesc(Long technicianId);
    long countByTechnicianId(Long technicianId);
}
