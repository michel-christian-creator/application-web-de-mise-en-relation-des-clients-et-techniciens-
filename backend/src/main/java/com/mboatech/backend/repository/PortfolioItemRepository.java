package com.mboatech.backend.repository;

import com.mboatech.backend.model.PortfolioItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PortfolioItemRepository extends JpaRepository<PortfolioItem, Long> {
    List<PortfolioItem> findByTechnicianIdOrderByCreatedAtDesc(Long technicianId);
}
