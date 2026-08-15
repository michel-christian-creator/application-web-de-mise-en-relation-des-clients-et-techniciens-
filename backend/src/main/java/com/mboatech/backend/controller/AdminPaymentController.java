package com.mboatech.backend.controller;

import com.mboatech.backend.model.Payment;
import com.mboatech.backend.model.Role;
import com.mboatech.backend.model.User;
import com.mboatech.backend.repository.PaymentRepository;
import com.mboatech.backend.repository.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
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
@RequestMapping("/api/admin/payments")
public class AdminPaymentController {

    private final PaymentRepository paymentRepository;
    private final UserRepository userRepository;

    public AdminPaymentController(PaymentRepository paymentRepository, UserRepository userRepository) {
        this.paymentRepository = paymentRepository;
        this.userRepository = userRepository;
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
        if (userId.equals(ChatController.SYSTEM_SENDER_USER_ID)) {
            return "MboaTech (plateforme)";
        }
        Optional<User> user = userRepository.findById(userId);
        if (user.isEmpty()) {
            return "Utilisateur #" + userId;
        }
        User u = user.get();
        String first = u.getFirstName() != null ? u.getFirstName() : "";
        String last = u.getLastName() != null ? u.getLastName() : "";
        String name = (first + " " + last).trim();
        if (name.isEmpty()) {
            name = u.getUsername() != null ? u.getUsername() : "Utilisateur #" + userId;
        }
        return name;
    }

    private String typeLabel(Payment p) {
        String method = p.getMethod();
        if ("refund".equals(method)) {
            return "Remboursement";
        }
        if ("payout".equals(method)) {
            return "Versement";
        }
        return "Dépôt";
    }

    private Map<String, Object> ledgerItem(Payment p) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("id", p.getId());
        item.put("requestId", p.getRequestId());
        item.put("payer", userName(p.getPayerUserId()));
        item.put("payee", userName(p.getPayeeUserId()));
        item.put("amount", p.getAmount());
        item.put("currency", p.getCurrency());
        item.put("status", p.getStatus());
        item.put("method", p.getMethod());
        item.put("typeLabel", typeLabel(p));
        item.put("transactionRef", p.getTransactionRef());
        item.put("notes", p.getNotes());
        item.put("createdAt", p.getCreatedAt());
        return item;
    }

    @GetMapping
    public ResponseEntity<?> ledger(@RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        Optional<User> admin = requireAdmin(authorizationHeader);
        if (admin.isEmpty()) {
            Optional<User> user = AuthController.authenticateToken(authorizationHeader, userRepository);
            return user.isEmpty()
                    ? ResponseEntity.status(401).body(Map.of("message", "Utilisateur non authentifié."))
                    : ResponseEntity.status(403).body(Map.of("message", "Espace réservé aux administrateurs."));
        }
        List<Map<String, Object>> payments = new ArrayList<>();
        BigDecimal releasedTotal = BigDecimal.ZERO;
        BigDecimal heldTotal = BigDecimal.ZERO;
        BigDecimal grandTotal = BigDecimal.ZERO;
        Map<String, BigDecimal> heldByMethod = new LinkedHashMap<>();
        Map<String, BigDecimal> totalByMethod = new LinkedHashMap<>();
        for (Payment p : paymentRepository.findAllByOrderByCreatedAtDesc()) {
            payments.add(ledgerItem(p));
            if ("released".equals(p.getStatus())) {
                releasedTotal = releasedTotal.add(p.getAmount());
            }
            if ("held".equals(p.getStatus())) {
                heldTotal = heldTotal.add(p.getAmount());
                heldByMethod.merge(p.getMethod(), p.getAmount(), BigDecimal::add);
            }
            if ("held".equals(p.getStatus()) || "released".equals(p.getStatus())) {
                grandTotal = grandTotal.add(p.getAmount());
                totalByMethod.merge(p.getMethod(), p.getAmount(), BigDecimal::add);
            }
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("payments", payments);
        body.put("count", payments.size());
        body.put("releasedTotal", releasedTotal);
        body.put("heldTotal", heldTotal);
        body.put("grandTotal", grandTotal);
        body.put("heldByMethod", heldByMethod);
        body.put("totalByMethod", totalByMethod);
        return ResponseEntity.ok(body);
    }
}
