package com.mboatech.backend.controller;

import com.mboatech.backend.model.Role;
import com.mboatech.backend.model.User;
import com.mboatech.backend.repository.UserRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/admin")
public class AdminDashboardController {

    private final UserRepository userRepository;
    private final JdbcTemplate jdbcTemplate;

    public AdminDashboardController(UserRepository userRepository, JdbcTemplate jdbcTemplate) {
        this.userRepository = userRepository;
        this.jdbcTemplate = jdbcTemplate;
    }

    @GetMapping("/dashboard")
    @Transactional(readOnly = true)
    public ResponseEntity<?> dashboard(@RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        Optional<User> optionalUser = AuthController.authenticateToken(authorizationHeader, userRepository);
        if (optionalUser.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("message", "Utilisateur non authentifié."));
        }
        User user = optionalUser.get();
        if (user.getRole() != Role.admin) {
            return ResponseEntity.status(403).body(Map.of("message", "Espace réservé aux administrateurs."));
        }

        Long activeUsers = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM users WHERE status = 'active' AND id <> ?",
                Long.class, ChatController.SYSTEM_SENDER_USER_ID);
        LocalDateTime monthStart = LocalDate.now().withDayOfMonth(1).atStartOfDay();
        Long newUsersThisMonth = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM users WHERE created_at >= ? AND id <> ?",
                Long.class, monthStart, ChatController.SYSTEM_SENDER_USER_ID);
        Long ongoingChantiers = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM service_requests WHERE status = 'assigned'",
                Long.class);
        Long requestsThisMonth = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM service_requests WHERE created_at >= ?",
                Long.class, monthStart);
        BigDecimal heldAmount = jdbcTemplate.queryForObject(
                "SELECT COALESCE(SUM(m.devis_amount), 0) FROM chat_messages m "
                        + "JOIN service_requests r ON r.id = m.service_request_id "
                        + "WHERE m.devis_status = 'accepted' AND m.devis_amount IS NOT NULL "
                        + "AND NOT EXISTS (SELECT 1 FROM payments p "
                        +                 "WHERE p.service_request_id = r.id AND p.status = 'released')",
                BigDecimal.class);
        Long heldChantierCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(DISTINCT m.service_request_id) FROM chat_messages m "
                        + "JOIN service_requests r ON r.id = m.service_request_id "
                        + "WHERE m.devis_status = 'accepted' AND m.devis_amount IS NOT NULL "
                        + "AND NOT EXISTS (SELECT 1 FROM payments p "
                        +                 "WHERE p.service_request_id = r.id AND p.status = 'released')",
                Long.class);
        Long openDisputes = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM service_requests WHERE dispute_open = 1",
                Long.class);

        List<Map<String, Object>> weekData = new ArrayList<>();
        String[] days = {"Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"};
        LocalDate monday = LocalDate.now().with(DayOfWeek.MONDAY);
        jdbcTemplate.query(
                "SELECT WEEKDAY(created_at) AS wd, COUNT(*) AS cnt FROM service_requests "
                        + "WHERE created_at >= ? GROUP BY wd",
                rs -> {
                    weekData.add(Map.of("day", days[rs.getInt("wd")], "value", rs.getLong("cnt")));
                },
                monday.atStartOfDay());
        Map<String, Long> byDay = new LinkedHashMap<>();
        for (String day : days) byDay.put(day, 0L);
        for (Map<String, Object> entry : weekData) {
            byDay.put((String) entry.get("day"), (Long) entry.get("value"));
        }
        List<Map<String, Object>> fullWeek = new ArrayList<>();
        for (String day : days) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("day", day);
            item.put("value", byDay.get(day));
            fullWeek.add(item);
        }

        Long totalRequests = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM service_requests", Long.class);
        List<Map<String, Object>> tradeDistribution = new ArrayList<>();
        jdbcTemplate.query(
                "SELECT category, COUNT(*) AS cnt FROM service_requests GROUP BY category ORDER BY cnt DESC",
                rs -> {
                    String category = rs.getString("category");
                    long cnt = rs.getLong("cnt");
                    double pct = totalRequests != null && totalRequests > 0
                            ? Math.round(cnt * 1000.0 / totalRequests) / 10.0
                            : 0.0;
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("label", category != null ? category : "Autre");
                    item.put("count", cnt);
                    item.put("pct", pct);
                    tradeDistribution.add(item);
                });

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("activeUsers", activeUsers);
        data.put("newUsersThisMonth", newUsersThisMonth);
        data.put("ongoingChantiers", ongoingChantiers);
        data.put("requestsThisMonth", requestsThisMonth);
        data.put("heldAmount", heldAmount);
        data.put("heldChantierCount", heldChantierCount);
        data.put("openDisputes", openDisputes);
        data.put("weekData", fullWeek);
        data.put("tradeDistribution", tradeDistribution);
        data.put("weekStart", monday.toString());
        data.put("weekEnd", monday.plusDays(6).toString());
        return ResponseEntity.ok(data);
    }
}
