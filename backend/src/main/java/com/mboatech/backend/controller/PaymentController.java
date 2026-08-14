package com.mboatech.backend.controller;

import com.mboatech.backend.config.PaymeeProperties;
import com.mboatech.backend.model.Payment;
import com.mboatech.backend.model.User;
import com.mboatech.backend.repository.PaymentRepository;
import com.mboatech.backend.repository.UserRepository;
import com.mboatech.backend.service.PaymentException;
import com.mboatech.backend.service.PaymentService;
import org.springframework.http.ResponseEntity;
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

@RestController
@RequestMapping("/api/payments")
public class PaymentController {

    private final PaymentService paymentService;
    private final UserRepository userRepository;
    private final PaymentRepository paymentRepository;
    private final PaymeeProperties paymeeProperties;

    public PaymentController(PaymentService paymentService, UserRepository userRepository,
                             PaymentRepository paymentRepository, PaymeeProperties paymeeProperties) {
        this.paymentService = paymentService;
        this.userRepository = userRepository;
        this.paymentRepository = paymentRepository;
        this.paymeeProperties = paymeeProperties;
    }

    private String userName(Long userId) {
        if (userId == null) {
            return "";
        }
        if (userId.equals(ChatController.SYSTEM_SENDER_USER_ID)) {
            return "MboaTech";
        }
        Optional<User> user = userRepository.findById(userId);
        if (user.isEmpty()) {
            return "Utilisateur #" + userId;
        }
        User u = user.get();
        String first = u.getFirstName() != null ? u.getFirstName() : "";
        String last = u.getLastName() != null ? u.getLastName() : "";
        return (first + " " + last).trim();
    }

    private String typeLabel(Payment p, boolean outgoing) {
        String method = p.getMethod();
        if ("refund".equals(method)) {
            return "Remboursement";
        }
        if ("payout".equals(method)) {
            return "Versement (technicien)";
        }
        return outgoing ? "Dépôt sécurisé" : "Crédit";
    }

    private Map<String, Object> historyItem(Payment p, Long userId) {
        Map<String, Object> item = new LinkedHashMap<>();
        boolean outgoing = userId.equals(p.getPayerUserId());
        item.put("id", p.getId());
        item.put("requestId", p.getRequestId());
        item.put("direction", outgoing ? "out" : "in");
        item.put("counterparty", outgoing ? userName(p.getPayeeUserId()) : userName(p.getPayerUserId()));
        item.put("amount", p.getAmount());
        item.put("currency", p.getCurrency());
        item.put("status", p.getStatus());
        item.put("method", p.getMethod());
        item.put("typeLabel", typeLabel(p, outgoing));
        item.put("transactionRef", p.getTransactionRef());
        item.put("notes", p.getNotes());
        item.put("createdAt", p.getCreatedAt());
        return item;
    }

    @GetMapping("/history")
    public ResponseEntity<?> history(@RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        Optional<User> user = AuthController.authenticateToken(authorizationHeader, null, userRepository);
        if (user.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("message", "Utilisateur non authentifié."));
        }
        List<Map<String, Object>> history = new ArrayList<>();
        paymentRepository.findAllByOrderByCreatedAtDesc().forEach(p -> {
            if (user.get().getId().equals(p.getPayerUserId()) || user.get().getId().equals(p.getPayeeUserId())) {
                history.add(historyItem(p, user.get().getId()));
            }
        });
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("history", history);
        body.put("count", history.size());
        return ResponseEntity.ok(body);
    }

    @PostMapping("/deposit")
    public ResponseEntity<?> deposit(@RequestHeader(value = "Authorization", required = false) String authorizationHeader,
                                     @RequestBody(required = false) Map<String, Object> body) {
        Optional<User> user = AuthController.authenticateToken(authorizationHeader, null, userRepository);
        if (user.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("message", "Utilisateur non authentifié."));
        }
        Object rawRequestId = body != null ? body.get("requestId") : null;
        Object rawAmount = body != null ? body.get("amount") : null;
        Object rawMethod = body != null ? body.get("method") : null;
        if (rawRequestId == null || rawAmount == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "requestId et amount requis."));
        }
        Long requestId;
        BigDecimal amount;
        try {
            requestId = Long.valueOf(String.valueOf(rawRequestId));
            amount = new BigDecimal(String.valueOf(rawAmount));
        } catch (NumberFormatException e) {
            return ResponseEntity.badRequest().body(Map.of("message", "Paramètres numériques invalides."));
        }
        String method = rawMethod != null ? String.valueOf(rawMethod) : "momo";
        try {
            return ResponseEntity.ok(paymentService.deposit(requestId, user.get().getId(), amount, method));
        } catch (PaymentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    /**
     * Validation client : libère les fonds en garde vers le technicien.
     */
    @PostMapping("/release")
    public ResponseEntity<?> release(@RequestHeader(value = "Authorization", required = false) String authorizationHeader,
                                     @RequestBody(required = false) Map<String, Object> body) {
        Optional<User> user = AuthController.authenticateToken(authorizationHeader, null, userRepository);
        if (user.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("message", "Utilisateur non authentifié."));
        }
        Object rawRequestId = body != null ? body.get("requestId") : null;
        if (rawRequestId == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "requestId requis."));
        }
        Long requestId;
        try {
            requestId = Long.valueOf(String.valueOf(rawRequestId));
        } catch (NumberFormatException e) {
            return ResponseEntity.badRequest().body(Map.of("message", "Identifiant de demande invalide."));
        }
        try {
            return ResponseEntity.ok(paymentService.release(requestId, user.get().getId()));
        } catch (PaymentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    /**
     * Webhook Paymee : reçoit la confirmation de paiement, vérifie check_sum puis
     * passe le dépôt de pending à held. Endpoint public (sans JWT) mais protégé
     * par la signature Paymee.
     */
    @PostMapping("/webhook")
    public ResponseEntity<?> webhook(@RequestBody(required = false) Map<String, Object> body) {
        if (body == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "Corps de requête manquant."));
        }
        String token = body.get("token") != null ? String.valueOf(body.get("token")) : null;
        String checkSum = body.get("check_sum") != null ? String.valueOf(body.get("check_sum")) : null;
        Object rawStatus = body.get("payment_status");
        boolean paymentStatus = rawStatus instanceof Boolean
                ? (Boolean) rawStatus
                : rawStatus != null && ("1".equals(String.valueOf(rawStatus)) || "true".equalsIgnoreCase(String.valueOf(rawStatus)));
        String orderId = body.get("order_id") != null ? String.valueOf(body.get("order_id")) : null;
        String transactionId = body.get("transaction_id") != null ? String.valueOf(body.get("transaction_id")) : null;

        if (token == null || !paymeeProperties.verifySignature(token, paymentStatus, checkSum)) {
            return ResponseEntity.status(401).body(Map.of("message", "Signature Paymee invalide."));
        }
        try {
            return ResponseEntity.ok(paymentService.confirmPayment(token, paymentStatus, orderId, transactionId));
        } catch (PaymentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }
}
