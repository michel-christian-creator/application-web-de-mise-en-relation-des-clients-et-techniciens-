package com.mboatech.backend.repository;

import com.mboatech.backend.model.TechnicianRecommendation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface TechnicianRecommendationRepository extends JpaRepository<TechnicianRecommendation, Long> {
    List<TechnicianRecommendation> findByTechnicianIdOrderByCreatedAtDesc(Long technicianId);
    List<TechnicianRecommendation> findByTechnicianIdAndRatingNotNullOrderByCreatedAtDesc(Long technicianId);
    long countByTechnicianId(Long technicianId);

    @Query("SELECT r.technician.id AS technicianId, " +
            "COUNT(r) AS count, " +
            "COUNT(r.rating) AS ratedCount, " +
            "AVG(r.rating) AS avgRating " +
            "FROM TechnicianRecommendation r " +
            "GROUP BY r.technician.id")
    List<RecommendationStats> findStatsGroupedByTechnician();

    interface RecommendationStats {
        Long getTechnicianId();
        Long getCount();
        Long getRatedCount();
        Double getAvgRating();
    }
}
