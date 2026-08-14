package com.mboatech.backend.controller;

import com.mboatech.backend.model.ChatMessage;
import com.mboatech.backend.model.ClientProfile;
import com.mboatech.backend.model.ClientRequest;
import com.mboatech.backend.model.Role;
import com.mboatech.backend.model.TechnicianProfile;
import com.mboatech.backend.model.User;
import com.mboatech.backend.model.Payment;
import com.mboatech.backend.repository.ChatMessageRepository;
import com.mboatech.backend.repository.ClientProfileRepository;
import com.mboatech.backend.repository.ClientRequestRepository;
import com.mboatech.backend.repository.PaymentRepository;
import com.mboatech.backend.repository.TechnicianProfileRepository;
import com.mboatech.backend.repository.UserRepository;
import com.mboatech.backend.service.NotificationService;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/admin/disputes")
public class AdminDisputeController {

    private final UserRepository userRepository;
    private final ClientProfileRepository clientProfileRepository;
    private final TechnicianProfileRepository technicianProfileRepository;
    private final ClientRequestRepository requestRepository;
    private final ChatMessageRepository messageRepository;
    private final PaymentRepository paymentRepository;
    private final NotificationService notificationService;

    public AdminDisputeController(UserRepository userRepository,
                                  ClientProfileRepository clientProfileRepository,
                                  TechnicianProfileRepository technicianProfileRepository,
                                  ClientRequestRepository requestRepository,
                                  ChatMessageRepository messageRepository,
                                  PaymentRepository paymentRepository,
                                  NotificationService notificationService) {
        this.userRepository = userRepository;
        this.clientProfileRepository = clientProfileRepository;
        this.technicianProfileRepository = technicianProfileRepository;
        this.requestRepository = requestRepository;
        this.messageRepository = messageRepository;
        this.paymentRepository = paymentRepository;
        this.notificationService = notificationService;
    }

    private ResponseEntity<?> unauthorized() {
        return ResponseEntity.status(401).body(Map.of("message", "Utilisateur non authentifié."));
    }

    private ResponseEntity<?> forbidden() {
        return ResponseEntity.status(403).body(Map.of("message", "Espace réservé aux administrateurs."));
    }

    private Optional<User> requireAdmin(String authorizationHeader) {
        Optional<User> user = AuthController.authenticateToken(authorizationHeader, null, userRepository);
        if (user.isPresent() && user.get().getRole() == Role.admin) {
            return user;
        }
        return Optional.empty();
    }

    private String userName(User user) {
        if (user == null) {
            return "";
        }
        String first = user.getFirstName() != null ? user.getFirstName() : "";
        String last = user.getLastName() != null ? user.getLastName() : "";
        return (first + " " + last).trim();
    }

    private Long clientUserId(ClientRequest request) {
        if (request.getClientId() == null) {
            return null;
        }
        return clientProfileRepository.findById(request.getClientId())
                .map(ClientProfile::getUser)
                .map(User::getId)
                .orElse(null);
    }

    private Long technicianUserId(ClientRequest request) {
        if (request.getTechnicianId() == null) {
            return null;
        }
        return technicianProfileRepository.findById(request.getTechnicianId())
                .map(TechnicianProfile::getUser)
                .map(User::getId)
                .orElse(null);
    }

    private String reporterRole(ClientRequest request) {
        Long clientUserId = clientUserId(request);
        Long reporterUserId = request.getDisputeReporterUserId();
        if (reporterUserId != null && reporterUserId.equals(clientUserId)) {
            return "client";
        }
        return "technician";
    }

    private BigDecimal heldAmount(ClientRequest request) {
        BigDecimal total = BigDecimal.ZERO;
        for (ChatMessage m : messageRepository.findByRequestIdOrderByTimestampAsc(request.getId())) {
            if ("accepted".equals(m.getDevisStatus()) && m.getDevisAmount() != null) {
                total = total.add(m.getDevisAmount());
            }
        }
        return total;
    }

    private String currentDevisState(ClientRequest request) {
        ChatMessage latest = messageRepository.findTopByRequestIdOrderByTimestampDesc(request.getId());
        if (latest != null && latest.getDevisStatus() != null && latest.getDevisAmount() != null) {
            return latest.getDevisStatus();
        }
        return null;
    }

    private Payment disputePayment(Long requestId, Long payerUserId, Long payeeUserId, BigDecimal amount,
                                   String method, String notes) {
        Payment payment = new Payment();
        payment.setRequestId(requestId);
        payment.setPayerUserId(payerUserId);
        payment.setPayeeUserId(payeeUserId);
        payment.setAmount(amount);
        payment.setCurrency("XAF");
        payment.setStatus("released");
        payment.setMethod(method);
        payment.setTransactionRef("ADM-" + requestId + "-" + method + "-" + System.currentTimeMillis());
        payment.setNotes(notes);
        return paymentRepository.save(payment);
    }

    private Map<String, Object> personDto(ClientProfile profile) {
        Map<String, Object> dto = new LinkedHashMap<>();
        User user = profile != null ? profile.getUser() : null;
        dto.put("name", userName(user));
        dto.put("username", user != null ? user.getUsername() : "");
        dto.put("photoUrl", user != null && user.getPhotoUrl() != null ? user.getPhotoUrl() : "");
        dto.put("city", profile != null && profile.getCity() != null ? profile.getCity() : "");
        return dto;
    }

    private Map<String, Object> personDto(TechnicianProfile profile) {
        Map<String, Object> dto = new LinkedHashMap<>();
        User user = profile != null ? profile.getUser() : null;
        dto.put("name", userName(user));
        dto.put("username", user != null ? user.getUsername() : "");
        dto.put("photoUrl", user != null && user.getPhotoUrl() != null ? user.getPhotoUrl() : "");
        dto.put("city", profile != null && profile.getCity() != null ? profile.getCity() : "");
        return dto;
    }

    private Map<String, Object> summaryDto(ClientRequest request) {
        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("requestId", request.getId());
        dto.put("category", request.getCategory());
        dto.put("description", request.getDescription());
        dto.put("status", request.getStatus());
        dto.put("urgency", request.getUrgency());
        dto.put("createdAt", request.getCreatedAt());
        dto.put("disputeOpenAt", request.getDisputeOpenAt());
        dto.put("reporterRole", reporterRole(request));
        dto.put("heldAmount", heldAmount(request));
        dto.put("client", request.getClientId() != null
                ? clientProfileRepository.findById(request.getClientId()).map(this::personDto).orElse(null)
                : null);
        dto.put("technician", request.getTechnicianId() != null
                ? technicianProfileRepository.findById(request.getTechnicianId()).map(this::personDto).orElse(null)
                : null);
        return dto;
    }

    @GetMapping
    public ResponseEntity<?> listDisputes(@RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        Optional<User> admin = requireAdmin(authorizationHeader);
        if (admin.isEmpty()) {
            Optional<User> user = AuthController.authenticateToken(authorizationHeader, null, userRepository);
            return user.isEmpty() ? unauthorized() : forbidden();
        }
        List<Map<String, Object>> disputes = new ArrayList<>();
        requestRepository.findByDisputeOpenTrueOrderByDisputeOpenAtDesc().forEach(request -> disputes.add(summaryDto(request)));
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("disputes", disputes);
        body.put("count", disputes.size());
        return ResponseEntity.ok(body);
    }

    @GetMapping("/{requestId}")
    public ResponseEntity<?> disputeDetail(@RequestHeader(value = "Authorization", required = false) String authorizationHeader,
                                           @PathVariable("requestId") Long requestId) {
        Optional<User> admin = requireAdmin(authorizationHeader);
        if (admin.isEmpty()) {
            Optional<User> user = AuthController.authenticateToken(authorizationHeader, null, userRepository);
            return user.isEmpty() ? unauthorized() : forbidden();
        }
        Optional<ClientRequest> optional = requestRepository.findById(requestId);
        if (optional.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        ClientRequest request = optional.get();
        Long clientUserId = clientUserId(request);
        Long technicianUserId = technicianUserId(request);

        Map<String, Object> detail = summaryDto(request);
        detail.put("decision", currentDevisState(request));
        detail.put("fundsDeposited", request.isFundsDeposited());

        List<Map<String, Object>> messages = new ArrayList<>();
        messageRepository.findByRequestIdOrderByTimestampAsc(requestId).forEach(m -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", m.getId());
            Long senderId = m.getSenderUserId();
            String role;
            if (senderId != null && senderId.equals(ChatController.SYSTEM_SENDER_USER_ID)) {
                role = "system";
            } else if (senderId != null && senderId.equals(clientUserId)) {
                role = "client";
            } else if (senderId != null && senderId.equals(technicianUserId)) {
                role = "technician";
            } else {
                role = "system";
            }
            item.put("senderRole", role);
            item.put("senderName", role.equals("system") ? "MboaTech"
                    : role.equals("client") ? userName(clientProfileRepository.findById(request.getClientId()).map(ClientProfile::getUser).orElse(null))
                    : userName(technicianProfileRepository.findById(request.getTechnicianId()).map(TechnicianProfile::getUser).orElse(null)));
            item.put("text", m.getText());
            item.put("time", m.getTimestamp());
            item.put("hasAttachment", m.getImageUrl() != null && !m.getImageUrl().isBlank());
            item.put("attachmentUrl", m.getImageUrl());
            item.put("devisAmount", m.getDevisAmount());
            item.put("devisStatus", m.getDevisStatus());
            item.put("scheduleAt", m.getScheduleAt());
            messages.add(item);
        });
        detail.put("messages", messages);
        return ResponseEntity.ok(detail);
    }

    @PostMapping("/{requestId}/decide")
    @Transactional
    public ResponseEntity<?> decide(@RequestHeader(value = "Authorization", required = false) String authorizationHeader,
                                    @PathVariable("requestId") Long requestId,
                                    @RequestBody Map<String, String> body) {
        Optional<User> admin = requireAdmin(authorizationHeader);
        if (admin.isEmpty()) {
            Optional<User> user = AuthController.authenticateToken(authorizationHeader, null, userRepository);
            return user.isEmpty() ? unauthorized() : forbidden();
        }
        String decision = body != null ? body.get("decision") : null;
        if (decision == null || !(decision.equals("client") || decision.equals("tech") || decision.equals("split"))) {
            return ResponseEntity.badRequest().body(Map.of("message", "Décision invalide (client, tech ou split)."));
        }
        Optional<ClientRequest> optional = requestRepository.findById(requestId);
        if (optional.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        ClientRequest request = optional.get();
        if (!request.isDisputeOpen()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Aucun litige en cours pour cette demande."));
        }
        Long clientUserId = clientUserId(request);
        Long technicianUserId = technicianUserId(request);
        BigDecimal held = heldAmount(request);
        String releaseStatus = decision.equals("client") ? "refunded" : decision.equals("tech") ? "paid" : "split";
        messageRepository.releaseAcceptedDevis(requestId, releaseStatus);

        if (held != null && held.compareTo(BigDecimal.ZERO) > 0) {
            if (decision.equals("client") && clientUserId != null) {
                disputePayment(requestId, ChatController.SYSTEM_SENDER_USER_ID, clientUserId, held, "refund",
                        "Remboursement intégral au client — décision admin (demande #" + requestId + ")");
            } else if (decision.equals("tech") && technicianUserId != null) {
                disputePayment(requestId, ChatController.SYSTEM_SENDER_USER_ID, technicianUserId, held, "payout",
                        "Versement intégral au technicien — décision admin (demande #" + requestId + ")");
            } else if (decision.equals("split")) {
                BigDecimal half = held.divideToIntegralValue(BigDecimal.valueOf(2));
                if (clientUserId != null) {
                    disputePayment(requestId, ChatController.SYSTEM_SENDER_USER_ID, clientUserId, half, "refund",
                            "Remboursement partiel (50%) — décision admin (demande #" + requestId + ")");
                }
                if (technicianUserId != null) {
                    disputePayment(requestId, ChatController.SYSTEM_SENDER_USER_ID, technicianUserId, held.subtract(half), "payout",
                            "Versement partiel (50%) — décision admin (demande #" + requestId + ")");
                }
            }
        }

        request.setDisputeOpen(false);
        request.setDisputeReporterUserId(null);
        request.setDisputeOpenAt(null);
        request.setFundsDeposited(false);
        request.setStatus("completed");
        request.setUpdatedAt(LocalDateTime.now());
        requestRepository.save(request);

        String label = decision.equals("client") ? "remboursement intégral au client"
                : decision.equals("tech") ? "versement intégral des fonds au technicien"
                : "partage des fonds (50/50)";
        ChatMessage systemMessage = new ChatMessage();
        systemMessage.setRequestId(requestId);
        systemMessage.setSenderUserId(ChatController.SYSTEM_SENDER_USER_ID);
        systemMessage.setText("Décision de l'administration : " + label + " pour la demande #" + requestId + ".");
        systemMessage.setTimestamp(LocalDateTime.now());
        systemMessage.setRead(false);
        messageRepository.save(systemMessage);

        String clientMessage = "L'administration a statué sur le litige de la demande #" + requestId + " : " + label + ".";
        if (clientUserId != null) {
            notificationService.create(clientUserId, "Litige résolu",
                    decision.equals("client")
                            ? "Vous avez été intégralement remboursé pour la demande #" + requestId + "."
                            : clientMessage,
                    "request", requestId);
        }
        if (technicianUserId != null) {
            notificationService.create(technicianUserId, "Litige résolu",
                    decision.equals("tech")
                            ? "Les fonds de la demande #" + requestId + " vous ont été intégralement versés."
                            : clientMessage,
                    "request", requestId);
        }
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", true);
        response.put("decision", decision);
        response.put("requestId", requestId);
        return ResponseEntity.ok(response);
    }
}
