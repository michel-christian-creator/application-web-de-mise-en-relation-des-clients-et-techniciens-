package com.mboatech.backend.controller;

import com.mboatech.backend.model.Role;
import com.mboatech.backend.model.User;
import com.mboatech.backend.model.Withdrawal;
import com.mboatech.backend.repository.UserRepository;
import com.mboatech.backend.repository.WithdrawalRepository;
import com.mboatech.backend.service.NotificationService;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/admin/withdrawals")
public class AdminWithdrawController {

    private final UserRepository userRepository;
    private final WithdrawalRepository withdrawalRepository;
    private final JdbcTemplate jdbcTemplate;
    private final NotificationService notificationService;

    public AdminWithdrawController(UserRepository userRepository,
                                   WithdrawalRepository withdrawalRepository,
                                   JdbcTemplate jdbcTemplate,
                                   NotificationService notificationService) {
        this.userRepository = userRepository;
        this.withdrawalRepository = withdrawalRepository;
        this.jdbcTemplate = jdbcTemplate;
        this.notificationService = notificationService;
    }

    private Optional<User> requireAdmin(String authorizationHeader) {
        Optional<User> user = AuthController.authenticateToken(authorizationHeader, userRepository);
        if (user.isPresent() && user.get().getRole() == Role.admin) {
            return user;
        }
        return Optional.empty();
    }

    private String userName(Long userId) {
        if (userId == null) {
            return "";
        }
        Optional<User> user = userRepository.findById(userId);
        if (user.isEmpty()) {
            return "Technicien #" + userId;
        }
        User u = user.get();
        String first = u.getFirstName() != null ? u.getFirstName() : "";
        String last = u.getLastName() != null ? u.getLastName() : "";
        String name = (first + " " + last).trim();
        return name.isEmpty() ? (u.getUsername() != null ? u.getUsername() : "Technicien #" + userId) : name;
    }

    private Map<String, Object> withdrawItem(Withdrawal w) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("id", w.getId());
        item.put("technicianUserId", w.getTechnicianUserId());
        item.put("technicianName", userName(w.getTechnicianUserId()));
        item.put("amount", w.getAmount());
        item.put("method", w.getMethod());
        item.put("account", w.getAccount());
        item.put("status", w.getStatus());
        item.put("notes", w.getNotes());
        item.put("createdAt", w.getCreatedAt());
        return item;
    }

    @GetMapping
    public ResponseEntity<?> list(@RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        Optional<User> admin = requireAdmin(authorizationHeader);
        if (admin.isEmpty()) {
            Optional<User> user = AuthController.authenticateToken(authorizationHeader, userRepository);
            return user.isEmpty()
                    ? ResponseEntity.status(401).body(Map.of("message", "Utilisateur non authentifié."))
                    : ResponseEntity.status(403).body(Map.of("message", "Espace réservé aux administrateurs."));
        }
        List<Map<String, Object>> withdrawals = new ArrayList<>();
        BigDecimal pendingTotal = BigDecimal.ZERO;
        for (Withdrawal w : withdrawalRepository.findAllByOrderByCreatedAtDesc()) {
            withdrawals.add(withdrawItem(w));
            if ("pending".equals(w.getStatus())) {
                pendingTotal = pendingTotal.add(w.getAmount());
            }
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("withdrawals", withdrawals);
        body.put("count", withdrawals.size());
        body.put("pendingTotal", pendingTotal);
        return ResponseEntity.ok(body);
    }

    @PostMapping("/{id}/process")
    @Transactional
    public ResponseEntity<?> process(@RequestHeader(value = "Authorization", required = false) String authorizationHeader,
                                     @PathVariable("id") Long id) {
        Optional<User> admin = requireAdmin(authorizationHeader);
        if (admin.isEmpty()) {
            Optional<User> user = AuthController.authenticateToken(authorizationHeader, userRepository);
            return user.isEmpty()
                    ? ResponseEntity.status(401).body(Map.of("message", "Utilisateur non authentifié."))
                    : ResponseEntity.status(403).body(Map.of("message", "Espace réservé aux administrateurs."));
        }
        Optional<Withdrawal> optionalWithdrawal = withdrawalRepository.findById(id);
        if (optionalWithdrawal.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        Withdrawal withdrawal = optionalWithdrawal.get();
        if (!"pending".equals(withdrawal.getStatus())) {
            return ResponseEntity.badRequest().body(Map.of("message", "Ce retrait a déjà été traité."));
        }
        BigDecimal balance = availableBalance(withdrawal.getTechnicianUserId());
        if (withdrawal.getAmount().compareTo(balance) > 0) {
            return ResponseEntity.badRequest().body(Map.of(
                    "message",
                    "Solde insuffisant : disponible " + balance.toBigInteger()
                            + " FCFA pour un retrait de " + withdrawal.getAmount().toBigInteger() + " FCFA."));
        }
        withdrawal.setStatus("paid");
        withdrawal.setNotes("Retrait payé (" + withdrawal.getMethod() + " vers " + withdrawal.getAccount() + ").");
        withdrawalRepository.save(withdrawal);

        notificationService.create(withdrawal.getTechnicianUserId(), "Retrait payé",
                "Votre retrait de " + withdrawal.getAmount().toBigInteger()
                        + " FCFA (" + withdrawal.getMethod() + ") a été validé et payé.",
                "system");
        return ResponseEntity.ok(withdrawItem(withdrawal));
    }

    @PostMapping("/{id}/reject")
    @Transactional
    public ResponseEntity<?> reject(@RequestHeader(value = "Authorization", required = false) String authorizationHeader,
                                    @PathVariable("id") Long id) {
        Optional<User> admin = requireAdmin(authorizationHeader);
        if (admin.isEmpty()) {
            Optional<User> user = AuthController.authenticateToken(authorizationHeader, userRepository);
            return user.isEmpty()
                    ? ResponseEntity.status(401).body(Map.of("message", "Utilisateur non authentifié."))
                    : ResponseEntity.status(403).body(Map.of("message", "Espace réservé aux administrateurs."));
        }
        Optional<Withdrawal> optionalWithdrawal = withdrawalRepository.findById(id);
        if (optionalWithdrawal.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        Withdrawal withdrawal = optionalWithdrawal.get();
        if (!"pending".equals(withdrawal.getStatus())) {
            return ResponseEntity.badRequest().body(Map.of("message", "Ce retrait a déjà été traité."));
        }
        withdrawal.setStatus("rejected");
        withdrawal.setNotes("Retrait refusé par l'administration.");
        withdrawalRepository.save(withdrawal);

        notificationService.create(withdrawal.getTechnicianUserId(), "Retrait refusé",
                "Votre demande de retrait de " + withdrawal.getAmount().toBigInteger()
                        + " FCFA a été refusée. Vérifiez vos informations de retrait.",
                "system");
        return ResponseEntity.ok(withdrawItem(withdrawal));
    }

    private BigDecimal availableBalance(Long technicianUserId) {
        BigDecimal balance = jdbcTemplate.queryForObject(
                "SELECT COALESCE((SELECT COALESCE(SUM(amount), 0) FROM payments "
                        + "WHERE payee_user_id = ? AND status = 'released' AND method <> 'withdraw') "
                        + "- (SELECT COALESCE(SUM(amount), 0) FROM withdrawals "
                        + "WHERE technician_user_id = ? AND status = 'paid'), 0)",
                BigDecimal.class, technicianUserId, technicianUserId);
        return balance != null ? balance : BigDecimal.ZERO;
    }
}
