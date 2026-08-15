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
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

@RestController
@RequestMapping("/api/client/withdraw")
public class ClientWithdrawController {

    private static final Set<String> ALLOWED_METHODS = Set.of("momo", "orange", "bank");
    private static final BigDecimal MIN_AMOUNT = BigDecimal.valueOf(100);

    private final UserRepository userRepository;
    private final WithdrawalRepository withdrawalRepository;
    private final JdbcTemplate jdbcTemplate;
    private final NotificationService notificationService;

    public ClientWithdrawController(UserRepository userRepository,
                                    WithdrawalRepository withdrawalRepository,
                                    JdbcTemplate jdbcTemplate,
                                    NotificationService notificationService) {
        this.userRepository = userRepository;
        this.withdrawalRepository = withdrawalRepository;
        this.jdbcTemplate = jdbcTemplate;
        this.notificationService = notificationService;
    }

    private Optional<User> requireClient(String authorizationHeader) {
        Optional<User> user = AuthController.authenticateToken(authorizationHeader, userRepository);
        if (user.isPresent() && user.get().getRole() == Role.client) {
            return user;
        }
        return Optional.empty();
    }

    private BigDecimal refundBalance(Long clientUserId) {
        BigDecimal balance = jdbcTemplate.queryForObject(
                "SELECT COALESCE((SELECT COALESCE(SUM(amount), 0) FROM payments "
                        + "WHERE payee_user_id = ? AND status = 'released' AND method = 'refund') "
                        + "- (SELECT COALESCE(SUM(amount), 0) FROM withdrawals "
                        + "WHERE client_user_id = ? AND status = 'paid'), 0)",
                BigDecimal.class, clientUserId, clientUserId);
        return balance != null ? balance : BigDecimal.ZERO;
    }

    private Map<String, Object> item(Withdrawal w) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("id", w.getId());
        item.put("amount", w.getAmount());
        item.put("method", w.getMethod());
        item.put("account", w.getAccount());
        item.put("status", w.getStatus());
        item.put("notes", w.getNotes());
        item.put("createdAt", w.getCreatedAt());
        return item;
    }

    @GetMapping
    public ResponseEntity<?> status(@RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        Optional<User> client = requireClient(authorizationHeader);
        if (client.isEmpty()) {
            Optional<User> user = AuthController.authenticateToken(authorizationHeader, userRepository);
            return user.isEmpty()
                    ? ResponseEntity.status(401).body(Map.of("message", "Utilisateur non authentifié."))
                    : ResponseEntity.status(403).body(Map.of("message", "Espace réservé aux clients."));
        }
        User user = client.get();
        BigDecimal balance = refundBalance(user.getId());
        List<Map<String, Object>> withdrawals = new ArrayList<>();
        BigDecimal pendingTotal = BigDecimal.ZERO;
        for (Withdrawal w : withdrawalRepository.findByClientUserIdOrderByCreatedAtDesc(user.getId())) {
            withdrawals.add(item(w));
            if ("pending".equals(w.getStatus())) {
                pendingTotal = pendingTotal.add(w.getAmount());
            }
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("balance", balance);
        body.put("pendingTotal", pendingTotal);
        body.put("withdrawals", withdrawals);
        return ResponseEntity.ok(body);
    }

    @PostMapping
    @Transactional
    public ResponseEntity<?> withdraw(@RequestHeader(value = "Authorization", required = false) String authorizationHeader,
                                      @RequestBody(required = false) Map<String, Object> body) {
        Optional<User> client = requireClient(authorizationHeader);
        if (client.isEmpty()) {
            Optional<User> user = AuthController.authenticateToken(authorizationHeader, userRepository);
            return user.isEmpty()
                    ? ResponseEntity.status(401).body(Map.of("message", "Utilisateur non authentifié."))
                    : ResponseEntity.status(403).body(Map.of("message", "Espace réservé aux clients."));
        }
        if (body == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "Corps de requête manquant."));
        }
        User user = client.get();

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

        BigDecimal balance = refundBalance(user.getId());
        if (amount.compareTo(balance) > 0) {
            return ResponseEntity.badRequest().body(Map.of(
                    "message",
                    "Montant supérieur à votre solde de remboursement disponible ("
                            + balance.toBigInteger() + " FCFA)."));
        }

        Withdrawal withdrawal = new Withdrawal();
        withdrawal.setClientUserId(user.getId());
        withdrawal.setMethod(method);
        withdrawal.setAccount(account);
        withdrawal.setAmount(amount);
        withdrawal.setStatus("pending");
        withdrawal.setNotes("Retrait de remboursement demandé par le client via " + method);
        Withdrawal saved = withdrawalRepository.save(withdrawal);

        for (User admin : userRepository.findByRole(Role.admin)) {
            notificationService.create(admin.getId(), "Nouveau retrait soumis",
                    "Un client a soumis un retrait de remboursement de " + amount.toBigInteger()
                            + " FCFA (" + method + ") à valider.",
                    "system", null);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", saved.getId());
        result.put("amount", saved.getAmount());
        result.put("method", saved.getMethod());
        result.put("account", saved.getAccount());
        result.put("status", saved.getStatus());
        result.put("createdAt", saved.getCreatedAt());
        return ResponseEntity.ok(result);
    }
}
