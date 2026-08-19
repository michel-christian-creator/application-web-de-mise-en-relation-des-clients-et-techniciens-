package com.mboatech.backend.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/public")
public class PublicController {

    private final JdbcTemplate jdbcTemplate;

    public PublicController(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getPublicStats() {
        Long technicianCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM technicians", Long.class);

        Long completedRequests = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM service_requests WHERE status = 'completed'", Long.class);

        Long cityCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(DISTINCT city) FROM technicians WHERE city IS NOT NULL AND city != ''",
                Long.class);

        Double avgRating = jdbcTemplate.queryForObject(
                "SELECT COALESCE(AVG(rating_avg), 0.0) FROM technicians WHERE rating_count > 0",
                Double.class);
        if (avgRating != null) {
            avgRating = Math.round(avgRating * 10.0) / 10.0;
        } else {
            avgRating = 0.0;
        }

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("technicianCount", technicianCount != null ? technicianCount : 0);
        data.put("completedRequests", completedRequests != null ? completedRequests : 0);
        data.put("cityCount", cityCount != null ? cityCount : 0);
        data.put("avgRating", avgRating);

        return ResponseEntity.ok(data);
    }
}
