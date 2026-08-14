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
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

@RestController
@RequestMapping("/api/technicians")
public class TechnicianWithdrawController {

    private static final Set<String> ALLOWED_METHODS = Set.of("momo", "orange", "bank");
    private static final BigDecimal MIN_AMOUNT = BigDecimal.valueOf(100);

    private final UserRepository userRepository;
    private final WithdrawalRepository withdrawalRepository;
    private final JdbcTemplate jdbcTemplate;
    private final NotificationService notificationService;

    public TechnicianWithdrawController(UserRepository userRepository,
                                        WithdrawalRepository withdrawalRepository,
                                        JdbcTemplate jdbcTemplate,
                                        NotificationService notificationService) {
        this.userRepository = userRepository;
        this.withdrawalRepository = withdrawalRepository;
        this.jdbcTemplate = jdbcTemplate;
        this.notificationService = notificationService;
    }

    @PostMapping("/withdraw")
    @Transactional
    public ResponseEntity<?> withdraw(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
            @RequestBody(required = false) Map<String, Object> body) {
        Optional<User> optionalUser = AuthController.authenticateToken(authorizationHeader, null, userRepository);
        if (optionalUser.isEmpty() || optionalUser.get().getRole() != Role.technician) {
            return ResponseEntity.status(401).body(Map.of("message", "Espace réservé aux techniciens."));
        }
        if (body == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "Corps de requête manquant."));
        }
        User user = optionalUser.get();

        String method = body.get("method") != null ? String.valueOf(body.get("method")).trim().toLowerCase() : "";
        if (!ALLOWED_METHODS.contains(method)) {
            return ResponseEntity.badRequest().body(Map.of("message", "Méthode de retrait invalide (momo|orange|bank)."));
        }
        String account = body.get("account") != null ? String.valueOf(body.get("account")).trim() : "";
        if (account.isEmpty() || account.length() > 60) {
            return ResponseEntity.badRequest().body(Map.of("message", "Numéro de compte invalide."));
        }

        BigDecimal amount;
        try {
            amount = new BigDecimal(String.valueOf(body.get("amount")));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", "Montant invalide."));
        }
        if (amount.compareTo(MIN_AMOUNT) < 0 || amount.stripTrailingZeros().scale() > 0) {
            return ResponseEntity.badRequest().body(Map.of("message", "Montant invalide (minimum 100 FCFA)."));
        }

        BigDecimal balance = jdbcTemplate.queryForObject(
                "SELECT COALESCE((SELECT COALESCE(SUM(amount), 0) FROM payments "
                        + "WHERE payee_user_id = ? AND status = 'released' AND method <> 'withdraw') "
                        + "- (SELECT COALESCE(SUM(amount), 0) FROM withdrawals "
                        +                 "WHERE technician_user_id = ? AND status = 'paid'), 0)",
                BigDecimal.class, user.getId(), user.getId());
        if (balance == null) {
            balance = BigDecimal.ZERO;
        }
        if (amount.compareTo(balance) > 0) {
            return ResponseEntity.badRequest().body(Map.of(
                    "message",
                    "Montant supérieur à votre solde disponible (" + balance.toBigInteger() + " FCFA)."));
        }

        Withdrawal withdrawal = new Withdrawal();
        withdrawal.setTechnicianUserId(user.getId());
        withdrawal.setMethod(method);
        withdrawal.setAccount(account);
        withdrawal.setAmount(amount);
        withdrawal.setStatus("pending");
        withdrawal.setNotes("Retrait demandé par le technicien via " + method);
        Withdrawal saved = withdrawalRepository.save(withdrawal);

        notifyAdmins("Nouveau retrait soumis",
                "Un technicien a soumis un retrait de " + amount.toBigInteger()
                        + " FCFA (" + method + ") à valider.");

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", saved.getId());
        result.put("amount", saved.getAmount());
        result.put("method", saved.getMethod());
        result.put("account", saved.getAccount());
        result.put("status", saved.getStatus());
        result.put("createdAt", saved.getCreatedAt());
        return ResponseEntity.ok(result);
    }

    private void notifyAdmins(String title, String text) {
        for (User admin : userRepository.findByRole(Role.admin)) {
            notificationService.create(admin.getId(), title, text, "system", null);
        }
    }
}
