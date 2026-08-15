package com.mboatech.backend.controller;

import com.mboatech.backend.model.AvailabilityStatus;
import com.mboatech.backend.model.ChatMessage;
import com.mboatech.backend.model.ClientProfile;
import com.mboatech.backend.model.ClientRequest;
import com.mboatech.backend.model.RequestDecline;
import com.mboatech.backend.model.Role;
import com.mboatech.backend.model.TechnicianProfile;
import com.mboatech.backend.model.User;
import com.mboatech.backend.repository.ChatMessageRepository;
import com.mboatech.backend.repository.ClientProfileRepository;
import com.mboatech.backend.repository.ClientRequestRepository;
import com.mboatech.backend.repository.PaymentRepository;
import com.mboatech.backend.repository.RequestDeclineRepository;
import com.mboatech.backend.repository.TechnicianProfileRepository;
import com.mboatech.backend.repository.UserRepository;
import com.mboatech.backend.service.ChatAccessService;
import com.mboatech.backend.service.ChatEventService;
import com.mboatech.backend.service.MissionGuardService;
import com.mboatech.backend.service.NotificationService;
import com.mboatech.backend.service.TechnicianEventService;
import com.mboatech.backend.util.InputValidator;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/chat")
public class ChatController {

    private final ClientRequestRepository requestRepository;
    private final ChatMessageRepository messageRepository;
    private final UserRepository userRepository;
    private final ClientProfileRepository clientProfileRepository;
    private final TechnicianProfileRepository technicianProfileRepository;
    private final RequestDeclineRepository requestDeclineRepository;
    private final ChatEventService chatEventService;
    private final TechnicianEventService technicianEventService;
    private final NotificationService notificationService;
    private final MissionGuardService missionGuardService;
    private final PaymentRepository paymentRepository;
    private final ChatAccessService chatAccessService;

    public static volatile Long SYSTEM_SENDER_USER_ID = 999_999_999_999L;

    public ChatController(ClientRequestRepository requestRepository, ChatMessageRepository messageRepository, UserRepository userRepository, ClientProfileRepository clientProfileRepository, TechnicianProfileRepository technicianProfileRepository, RequestDeclineRepository requestDeclineRepository, ChatEventService chatEventService, TechnicianEventService technicianEventService, NotificationService notificationService, MissionGuardService missionGuardService, PaymentRepository paymentRepository, ChatAccessService chatAccessService) {
        this.requestRepository = requestRepository;
        this.messageRepository = messageRepository;
        this.userRepository = userRepository;
        this.clientProfileRepository = clientProfileRepository;
        this.technicianProfileRepository = technicianProfileRepository;
        this.requestDeclineRepository = requestDeclineRepository;
        this.chatEventService = chatEventService;
        this.technicianEventService = technicianEventService;
        this.notificationService = notificationService;
        this.missionGuardService = missionGuardService;
        this.paymentRepository = paymentRepository;
        this.chatAccessService = chatAccessService;
    }

    @PostMapping("/request")
    public ResponseEntity<?> createRequest(@RequestHeader(value = "Authorization", required = false) String authorizationHeader,
                                                       @RequestBody(required = false) ClientRequest request) {
        return createRequestInternal(authorizationHeader, request);
    }

    @PostMapping(value = "/request", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> createRequestMultipart(@RequestHeader(value = "Authorization", required = false) String authorizationHeader,
                                                    @RequestParam(value = "category", required = false) String category,
                                                    @RequestParam(value = "domain", required = false) String domain,
                                                    @RequestParam(value = "description", required = false) String description,
                                                    @RequestParam(value = "urgent", required = false) String urgent,
                                                    @RequestParam(value = "urgency", required = false) String urgency,
                                                    @RequestParam(value = "technicianId", required = false) Long technicianId) {
        ClientRequest request = new ClientRequest();
        request.setCategory(category);
        request.setDomain(domain);
        request.setDescription(description);
        if (urgency != null && !urgency.isBlank()) {
            request.setUrgency(urgency);
        } else {
            request.setUrgent("true".equalsIgnoreCase(urgent));
        }
        request.setTechnicianId(technicianId);
        return createRequestInternal(authorizationHeader, request);
    }

    private ResponseEntity<?> createRequestInternal(String authorizationHeader, ClientRequest request) {
        if (request == null) {
            return ResponseEntity.badRequest().build();
        }

        Long clientId = request.getClientId();
        Optional<User> optionalUser = AuthController.authenticateToken(authorizationHeader, userRepository);
        if (optionalUser.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("message", "Session expirée. Veuillez vous reconnecter."));
        }
        User authenticatedUser = optionalUser.get();
        clientId = resolveClientId(authenticatedUser);
        request.setClientId(clientId);

        if (request.getTechnicianId() != null) {
            Optional<TechnicianProfile> targetProfile = technicianProfileRepository.findById(request.getTechnicianId());
            if (targetProfile.isPresent() && isSameUserAsTechnician(targetProfile.get(), authenticatedUser, clientId)) {
                return ResponseEntity.badRequest().body(Map.of("message",
                        "Vous ne pouvez pas demander une intervention à vous-même."));
            }
        }

        String category = request.getCategory();
        if (category == null || category.isBlank()) {
            category = request.getDomain();
        }
        if (category == null || category.isBlank()) {
            category = "Général";
        }
        request.setCategory(category.trim());

        if (request.getUrgency() == null || request.getUrgency().isBlank()) {
            request.setUrgency(request.isUrgent() ? "critique" : "normal");
        }
        String urgency = request.getUrgency() == null ? "normal" : request.getUrgency().trim();
        if (!"normal".equals(urgency) && !"important".equals(urgency) && !"critique".equals(urgency)) {
            urgency = "normal";
        }
        request.setUrgency(urgency);

        String description = InputValidator.sanitizeMultiline(
                request.getDescription() == null ? "" : request.getDescription(), InputValidator.MAX_MULTILINE_LENGTH);
        if (description.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "La description de la demande est requise."));
        }
        if (InputValidator.hasSqlInjectionPattern(description)) {
            return ResponseEntity.badRequest().body(Map.of("message", "La description contient des caractères ou expressions non autorisés."));
        }
        request.setDescription(description);
        request.setCategory(InputValidator.sanitizeText(category, InputValidator.MAX_TEXT_LENGTH));

        if (request.getTechnicianId() != null) {
            request.setStatus("assigned");
        } else if (request.getStatus() == null || request.getStatus().isBlank()) {
            request.setStatus("published");
        }

        request.setCreatedAt(LocalDateTime.now());
        request.setUpdatedAt(LocalDateTime.now());
        ClientRequest saved = requestRepository.save(request);
        if (this.technicianEventService != null) {
            this.technicianEventService.broadcast("request", Map.of(
                    "id", saved.getId(),
                    "category", saved.getCategory() != null ? saved.getCategory() : "",
                    "description", saved.getDescription() != null ? saved.getDescription() : "",
                    "status", saved.getStatus() != null ? saved.getStatus() : ""));
        }
        if (saved.getTechnicianId() == null) {
            notifyMatchingTechnicians(saved);
        }
        return ResponseEntity.ok(saved);
    }

    @GetMapping("/requests/technician")
    public ResponseEntity<?> getTechnicianRequests(@RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        Optional<User> optionalUser = AuthController.authenticateToken(authorizationHeader, userRepository);
        if (optionalUser.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("message", "Utilisateur non authentifié."));
        }
        Optional<TechnicianProfile> optionalProfile = technicianProfileRepository.findByUserId(optionalUser.get().getId());
        if (optionalProfile.isEmpty()) {
            return ResponseEntity.ok(List.of());
        }
        TechnicianProfile profile = optionalProfile.get();
        List<Map<String, Object>> response = new java.util.ArrayList<>();
        Set<Long> seenIds = new HashSet<>();
        Set<Long> declinedIds = requestDeclineRepository.findByTechnicianId(profile.getId()).stream()
                .map(RequestDecline::getRequestId)
                .collect(Collectors.toSet());
        Long myUserId = optionalUser.get().getId();
        requestRepository.findByTechnicianIdOrderByCreatedAtDesc(profile.getId()).forEach(request -> {
            response.add(toTechnicianDto(request, "assigned", myUserId));
            seenIds.add(request.getId());
        });
        requestRepository.findByStatusOrderByCreatedAtDesc("published").stream()
                .filter(request -> request.getTechnicianId() == null)
                .filter(request -> !seenIds.contains(request.getId()))
                .filter(request -> !declinedIds.contains(request.getId()))
                .filter(request -> normalizeDomain(request.getCategory()).equals(normalizeDomain(profile.getDomain())))
                .forEach(request -> response.add(toTechnicianDto(request, "available", myUserId)));
        response.sort((a, b) -> {
            Object ca = a.get("createdAt");
            Object cb = b.get("createdAt");
            if (ca instanceof Comparable && cb instanceof Comparable) {
                return ((Comparable) cb).compareTo(ca);
            }
            return 0;
        });
        return ResponseEntity.ok(response);
    }

    @GetMapping("/requests/technician/archived")
    public ResponseEntity<?> getArchivedTechnicianRequests(@RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        Optional<User> optionalUser = AuthController.authenticateToken(authorizationHeader, userRepository);
        if (optionalUser.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("message", "Utilisateur non authentifié."));
        }
        Optional<TechnicianProfile> optionalProfile = technicianProfileRepository.findByUserId(optionalUser.get().getId());
        if (optionalProfile.isEmpty()) {
            return ResponseEntity.ok(List.of());
        }
        TechnicianProfile profile = optionalProfile.get();
        List<Map<String, Object>> response = new java.util.ArrayList<>();
        Long myUserId = optionalUser.get().getId();
        requestRepository.findByTechnicianIdOrderByCreatedAtDesc(profile.getId()).forEach(request -> {
            if (isArchived(request)) {
                response.add(toTechnicianDto(request, "assigned", myUserId));
            }
        });
        return ResponseEntity.ok(response);
    }

    private Map<String, Object> toTechnicianDto(ClientRequest request, String type, Long myUserId) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("id", request.getId());
        data.put("category", request.getCategory());
        data.put("domain", request.getDomain() != null ? request.getDomain() : request.getCategory());
        data.put("description", request.getDescription());
        data.put("urgency", request.getUrgency());
        data.put("status", request.getStatus());
        data.put("type", type);
        data.put("createdAt", request.getCreatedAt());
        data.put("clientName", resolveClientName(request.getClientId()));
        data.put("clientLocation", resolveClientLocation(request.getClientId()));
        data.put("fundsDeposited", request.isFundsDeposited());
        data.put("fundsReleased", paymentRepository
                .findFirstByRequestIdAndStatusOrderByIdAsc(request.getId(), "released")
                .isPresent());
        data.put("reservedUntil", request.getReservedUntil());
        data.put("disputeOpen", request.isDisputeOpen());
        data.put("disputeReporterUserId", request.getDisputeReporterUserId());
        data.put("disputeOpenAt", request.getDisputeOpenAt());
        data.put("unreadCount", myUserId != null ? messageRepository.countUnreadByRequest(request.getId(), myUserId) : 0L);
        appendLastMessage(data, request.getId(), myUserId);
        return data;
    }

    private void appendLastMessage(Map<String, Object> data, Long requestId, Long myUserId) {
        ChatMessage last = messageRepository.findTopByRequestIdOrderByTimestampDesc(requestId);
        if (last == null) {
            data.put("lastMessage", null);
            data.put("lastMessageAt", null);
            data.put("lastSender", null);
            data.put("lastIsMine", false);
            return;
        }
        data.put("lastMessage", last.getText());
        data.put("lastMessageAt", last.getTimestamp());
        data.put("lastSender", last.getSenderUserId());
        data.put("lastIsMine", myUserId != null && myUserId.equals(last.getSenderUserId()));
    }

    private String normalizeDomain(String value) {
        if (value == null) {
            return "";
        }
        String normalized = java.text.Normalizer.normalize(value.trim(), java.text.Normalizer.Form.NFD);
        normalized = normalized.replaceAll("\\p{M}", "");
        return normalized.toLowerCase();
    }

    private String normalizeUrgency(String urgency) {
        if (urgency == null) {
            return "normal";
        }
        String normalized = urgency.trim().toLowerCase();
        if ("critique".equals(normalized)) {
            return "critique";
        }
        if ("important".equals(normalized)) {
            return "important";
        }
        return "normal";
    }

    private boolean sameUrgency(String a, String b) {
        return normalizeUrgency(a).equals(normalizeUrgency(b));
    }

    private String resolveClientName(Long clientId) {
        if (clientId == null) {
            return "Client";
        }
        Optional<ClientProfile> profile = clientProfileRepository.findById(clientId);
        if (profile.isEmpty() || profile.get().getUser() == null) {
            return "Client";
        }
        String first = profile.get().getUser().getFirstName();
        String last = profile.get().getUser().getLastName();
        String name = ((first == null ? "" : first) + " " + (last == null ? "" : last)).trim();
        return name.isBlank() ? "Client" : name;
    }

    private String resolveClientLocation(Long clientId) {
        if (clientId == null) {
            return "";
        }
        return clientProfileRepository.findById(clientId)
                .map(ClientProfile::getLocation)
                .orElse("");
    }

    private boolean isSameUserAsTechnician(TechnicianProfile technician, User authenticatedUser, Long clientId) {
        if (technician == null || technician.getUser() == null) {
            return false;
        }
        Long technicianUserId = technician.getUser().getId();
        if (authenticatedUser != null && authenticatedUser.getId() != null) {
            return authenticatedUser.getId().equals(technicianUserId);
        }
        if (clientId != null) {
            return clientProfileRepository.findById(clientId)
                    .map(ClientProfile::getUser)
                    .filter(user -> user != null && user.getId() != null)
                    .map(user -> user.getId().equals(technicianUserId))
                    .orElse(false);
        }
        return false;
    }

    Long resolveClientId(User user) {
        if (user == null) {
            return null;
        }
        return clientProfileRepository.findByUserId(user.getId())
                .map(ClientProfile::getId)
                .orElseGet(() -> createClientProfile(user).getId());
    }

    private ClientProfile createClientProfile(User user) {
        ClientProfile profile = new ClientProfile();
        profile.setUser(user);
        return clientProfileRepository.save(profile);
    }

    @PostMapping("/message")
    @Transactional
    public ResponseEntity<?> sendMessage(@RequestHeader(value = "Authorization", required = false) String authorizationHeader,
                                         @RequestBody ChatMessage message) {
        if (message == null) {
            return ResponseEntity.badRequest().build();
        }
        Optional<User> authenticatedUser = AuthController.authenticateToken(authorizationHeader, userRepository);
        if (authenticatedUser.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("message", "Session expirée. Veuillez vous reconnecter."));
        }
        message.setSenderUserId(authenticatedUser.get().getId());
        try {
            return ResponseEntity.ok(saveMessageBroadcast(message));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @Transactional
    public ChatMessage saveMessageBroadcast(ChatMessage message) {
        String text = message.getText() == null ? "" : message.getText();
        if (text.isBlank() && message.getDevisAmount() == null && message.getScheduleAt() == null) {
            throw new IllegalArgumentException("Le message ne peut pas être vide.");
        }
        text = InputValidator.sanitizeMultiline(text, InputValidator.MAX_MULTILINE_LENGTH);
        if (InputValidator.hasSqlInjectionPattern(text)) {
            throw new IllegalArgumentException("Le message contient des caractères ou expressions non autorisés.");
        }
        message.setText(text);
        if (message.getDevisAmount() != null && !InputValidator.isValidAmount(message.getDevisAmount())) {
            throw new IllegalArgumentException("Montant du devis invalide : entier positif jusqu'à 100 000 000 FCFA.");
        }
        if (message.getScheduleAt() != null && !InputValidator.isValidSchedule(message.getScheduleAt())) {
            throw new IllegalArgumentException("Le créneau proposé doit être dans le futur.");
        }
        if (message.getTimestamp() == null) {
            message.setTimestamp(LocalDateTime.now());
        }
        message.setRead(false);
        ChatMessage saved = messageRepository.save(message);
        chatEventService.broadcastMessage(message.getRequestId(), saved);
        notifyChatPeer(saved);
        return saved;
    }

    @GetMapping("/requests/client")
    public ResponseEntity<?> getClientRequests(@RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        Optional<User> optionalUser = AuthController.authenticateToken(authorizationHeader, userRepository);
        if (optionalUser.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("message", "Utilisateur non authentifié."));
        }
        Long clientId = resolveClientId(optionalUser.get());
        List<Map<String, Object>> response = new java.util.ArrayList<>();
        Long myUserId = optionalUser.get().getId();
        requestRepository.findByClientIdOrderByCreatedAtDesc(clientId).forEach(request ->
                response.add(toClientDto(request, myUserId)));
        return ResponseEntity.ok(response);
    }

    @GetMapping("/requests/client/archived")
    public ResponseEntity<?> getArchivedClientRequests(@RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        Optional<User> optionalUser = AuthController.authenticateToken(authorizationHeader, userRepository);
        if (optionalUser.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("message", "Utilisateur non authentifié."));
        }
        Long clientId = resolveClientId(optionalUser.get());
        List<Map<String, Object>> response = new java.util.ArrayList<>();
        Long myUserId = optionalUser.get().getId();
        requestRepository.findByClientIdOrderByCreatedAtDesc(clientId).forEach(request -> {
            if (isArchived(request)) {
                response.add(toClientDto(request, myUserId));
            }
        });
        return ResponseEntity.ok(response);
    }

    private Map<String, Object> toClientDto(ClientRequest request, Long myUserId) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("id", request.getId());
        data.put("category", request.getCategory());
        data.put("domain", request.getDomain() != null ? request.getDomain() : request.getCategory());
        data.put("description", request.getDescription());
        data.put("urgency", request.getUrgency());
        data.put("status", request.getStatus());
        data.put("createdAt", request.getCreatedAt());
        data.put("technicianName", request.getTechnicianId() != null
                ? technicianProfileRepository.findById(request.getTechnicianId())
                        .map(TechnicianProfile::getUser)
                        .map(this::formatUserName)
                        .orElse("")
                : "");
        data.put("unreadCount", myUserId != null ? messageRepository.countUnreadByRequest(request.getId(), myUserId) : 0L);
        data.put("fundsDeposited", request.isFundsDeposited());
        data.put("fundsReleased", paymentRepository
                .findFirstByRequestIdAndStatusOrderByIdAsc(request.getId(), "released")
                .isPresent());
        data.put("disputeOpen", request.isDisputeOpen());
        data.put("disputeReporterUserId", request.getDisputeReporterUserId());
        data.put("disputeOpenAt", request.getDisputeOpenAt());
        appendLastMessage(data, request.getId(), myUserId);
        return data;
    }
    private boolean isArchived(ClientRequest request) {
        return "completed".equals(request.getStatus())
                && paymentRepository
                        .findFirstByRequestIdAndStatusOrderByIdAsc(request.getId(), "released")
                        .isPresent();
    }

    private String formatUserName(User user) {
        if (user == null) {
            return "";
        }
        String first = user.getFirstName() != null ? user.getFirstName() : "";
        String last = user.getLastName() != null ? user.getLastName() : "";
        return (first + " " + last).trim();
    }

    @GetMapping("/messages/{requestId}")
    @Transactional
    public ResponseEntity<?> getMessages(@RequestHeader(value = "Authorization", required = false) String authorizationHeader,
                                         @PathVariable("requestId") Long requestId) {
        Optional<User> optionalUser = AuthController.authenticateToken(authorizationHeader, userRepository);
        if (optionalUser.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("message", "Utilisateur non authentifié."));
        }
        User user = optionalUser.get();
        if (!chatAccessService.isConversationAccessible(user, requestId)) {
            return ResponseEntity.status(403).body(Map.of("message", "Accès refusé à cette conversation."));
        }
        markReadAndBroadcast(requestId, user.getId());
        List<ChatMessage> history = messageRepository.findByRequestIdOrderByTimestampAsc(requestId);
        return ResponseEntity.ok(history);
    }

    @PostMapping("/messages/{requestId}/read")
    @Transactional
    public ResponseEntity<?> markRequestRead(@RequestHeader(value = "Authorization", required = false) String authorizationHeader,
                                             @PathVariable("requestId") Long requestId) {
        Optional<User> optionalUser = AuthController.authenticateToken(authorizationHeader, userRepository);
        if (optionalUser.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("message", "Utilisateur non authentifié."));
        }
        User user = optionalUser.get();
        if (!chatAccessService.isConversationAccessible(user, requestId)) {
            return ResponseEntity.status(403).body(Map.of("message", "Accès refusé à cette conversation."));
        }
        markReadAndBroadcast(requestId, user.getId());
        return ResponseEntity.ok(Map.of("ok", true));
    }

    @Transactional
    public void markReadAndBroadcast(Long requestId, Long userId) {
        if (requestId == null || userId == null) {
            return;
        }
        List<Long> unreadIds = messageRepository.findUnreadIdsByRequest(requestId, userId);
        if (unreadIds.isEmpty()) {
            return;
        }
        messageRepository.markAllReadByRequest(requestId, userId);
        chatEventService.broadcastRead(requestId, Map.of(
                "requestId", requestId,
                "messageIds", unreadIds,
                "readBy", userId,
                "readAt", LocalDateTime.now().toString()));
    }

    @PostMapping("/devis/{messageId}/accept")
    @Transactional
    public ResponseEntity<?> acceptDevis(@RequestHeader(value = "Authorization", required = false) String authorizationHeader,
                                         @PathVariable("messageId") Long messageId) {
        return updateDevisStatus(authorizationHeader, messageId, "accepted");
    }

    @PostMapping("/devis/{messageId}/reject")
    @Transactional
    public ResponseEntity<?> rejectDevis(@RequestHeader(value = "Authorization", required = false) String authorizationHeader,
                                         @PathVariable("messageId") Long messageId) {
        return updateDevisStatus(authorizationHeader, messageId, "rejected");
    }

    @Transactional
    public ResponseEntity<?> updateDevisStatus(String authorizationHeader, Long messageId, String status) {
        if (messageId == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "messageId requis."));
        }
        Optional<User> optionalUser = AuthController.authenticateToken(authorizationHeader, userRepository);
        if (optionalUser.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("message", "Utilisateur non authentifié."));
        }
        Optional<ChatMessage> optional = messageRepository.findById(messageId);
        if (optional.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        ChatMessage message = optional.get();
        if (!chatAccessService.isRequestClient(optionalUser.get(), message.getRequestId())) {
            return ResponseEntity.status(403).body(Map.of("message", "Seul le client de la demande peut répondre à ce devis."));
        }
        if (message.getDevisAmount() == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "Ce message n'est pas un devis."));
        }
        boolean accepted = "accepted".equals(status);
        boolean rejected = "rejected".equals(status);
        if (!accepted && !rejected) {
            return ResponseEntity.badRequest().body(Map.of("message", "Statut de devis invalide."));
        }
        message.setDevisStatus(status);
        messageRepository.save(message);
        chatEventService.broadcastDevis(message.getRequestId(), message);

        String amountText = formatAmount(message.getDevisAmount());
        saveSystemChatMessage(message.getRequestId(), SYSTEM_SENDER_USER_ID,
                accepted
                        ? "Devis de " + amountText + " FCFA validé. Le client procède au paiement."
                        : "Devis de " + amountText + " FCFA rejeté.");
        if (message.getSenderUserId() != null) {
            notificationService.create(
                    message.getSenderUserId(),
                    accepted ? "Devis validé" : "Devis rejeté",
                    accepted
                            ? "Votre devis de " + amountText + " FCFA a été validé par le client."
                            : "Votre devis de " + amountText + " FCFA a été rejeté par le client.",
                    "message",
                    message.getRequestId());
        }
        return ResponseEntity.ok(message);
    }

    @PostMapping("/schedule/{messageId}/accept")
    @Transactional
    public ResponseEntity<?> acceptSchedule(@RequestHeader(value = "Authorization", required = false) String authorizationHeader,
                                            @PathVariable("messageId") Long messageId) {
        return updateScheduleStatus(authorizationHeader, messageId, "accepted");
    }

    @PostMapping("/schedule/{messageId}/reject")
    @Transactional
    public ResponseEntity<?> rejectSchedule(@RequestHeader(value = "Authorization", required = false) String authorizationHeader,
                                            @PathVariable("messageId") Long messageId) {
        return updateScheduleStatus(authorizationHeader, messageId, "rejected");
    }

    @Transactional
    public ResponseEntity<?> updateScheduleStatus(String authorizationHeader, Long messageId, String status) {
        if (messageId == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "messageId requis."));
        }
        Optional<User> optionalUser = AuthController.authenticateToken(authorizationHeader, userRepository);
        if (optionalUser.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("message", "Utilisateur non authentifié."));
        }
        Optional<ChatMessage> optional = messageRepository.findById(messageId);
        if (optional.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        ChatMessage message = optional.get();
        if (!chatAccessService.isRequestClient(optionalUser.get(), message.getRequestId())) {
            return ResponseEntity.status(403).body(Map.of("message", "Seul le client de la demande peut répondre à cette proposition."));
        }
        if (message.getScheduleAt() == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "Ce message n'est pas une proposition d'intervention."));
        }
        boolean accepted = "accepted".equals(status);
        boolean rejected = "rejected".equals(status);
        if (!accepted && !rejected) {
            return ResponseEntity.badRequest().body(Map.of("message", "Statut de planification invalide."));
        }
        message.setScheduleStatus(status);
        messageRepository.save(message);
        chatEventService.broadcastSchedule(message.getRequestId(), message);

        if (accepted) {
            requestRepository.findById(message.getRequestId()).ifPresent(request -> {
                request.setScheduledAt(message.getScheduleAt());
                request.setFundsDeposited(true);
                request.setUpdatedAt(LocalDateTime.now());
                requestRepository.save(request);
            });
        }

        String scheduleText = formatSchedule(message.getScheduleAt());
        saveSystemChatMessage(message.getRequestId(), SYSTEM_SENDER_USER_ID,
                accepted
                        ? "Intervention planifiée le " + scheduleText + " acceptée."
                        : "Proposition d'intervention le " + scheduleText + " rejetée.");
        if (message.getSenderUserId() != null) {
            notificationService.create(
                    message.getSenderUserId(),
                    accepted ? "Intervention acceptée" : "Intervention refusée",
                    accepted
                            ? "Le client a accepté votre intervention planifiée le " + scheduleText + "."
                            : "Le client a refusé votre proposition d'intervention le " + scheduleText + ".",
                    "message",
                    message.getRequestId());
        }
        return ResponseEntity.ok(message);
    }

    private String formatSchedule(LocalDateTime when) {
        if (when == null) {
            return "";
        }
        return java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy à HH:mm").format(when);
    }

    @PostMapping("/request/{requestId}/dispute")
    @Transactional
    public ResponseEntity<?> openDispute(@RequestHeader(value = "Authorization", required = false) String authorizationHeader,
                                         @PathVariable("requestId") Long requestId) {
        if (requestId == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "requestId requis."));
        }
        Optional<User> optionalReporter = AuthController.authenticateToken(authorizationHeader, userRepository);
        if (optionalReporter.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("message", "Utilisateur non authentifié."));
        }
        User reporter = optionalReporter.get();
        Optional<ClientRequest> optional = requestRepository.findById(requestId);
        if (optional.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        ClientRequest request = optional.get();
        if (!request.isFundsDeposited()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Les fonds doivent être déposés par le client pour signaler un litige."));
        }
        if (request.isDisputeOpen()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Un litige est déjà en cours pour cette demande."));
        }
        boolean fundsReleased = paymentRepository
                .findFirstByRequestIdAndStatusOrderByIdAsc(requestId, "released")
                .isPresent();
        if (fundsReleased) {
            return ResponseEntity.badRequest().body(Map.of(
                    "message",
                    "Les fonds ont déjà été libérés pour cette demande : il n'est plus possible de signaler un litige."));
        }
        Long clientUserId = request.getClientId() != null
                ? clientProfileRepository.findById(request.getClientId())
                        .map(ClientProfile::getUser)
                        .map(User::getId)
                        .orElse(null)
                : null;
        Long technicianUserId = request.getTechnicianId() != null
                ? technicianProfileRepository.findById(request.getTechnicianId())
                        .map(TechnicianProfile::getUser)
                        .map(User::getId)
                        .orElse(null)
                : null;
        Long reporterUserId = reporter.getId();
        boolean reporterIsClient = reporterUserId != null && reporterUserId.equals(clientUserId);
        boolean reporterIsTechnician = reporterUserId != null && reporterUserId.equals(technicianUserId);
        if (!reporterIsClient && !reporterIsTechnician) {
            return ResponseEntity.status(403).body(Map.of("message", "Vous ne participez pas à cette demande."));
        }
        List<User> admins = userRepository.findByRole(Role.admin);
        if (admins.isEmpty()) {
            return ResponseEntity.status(500).body(Map.of("message", "Aucun administrateur disponible pour traiter le litige."));
        }
        String reporterName = formatUserName(reporter);
        if (reporterName.isBlank()) {
            reporterName = reporter.getUsername() != null ? reporter.getUsername() : "Utilisateur";
        }
        String clientName = resolveClientName(request.getClientId());
        String technicianName = request.getTechnicianId() != null
                ? technicianProfileRepository.findById(request.getTechnicianId())
                        .map(TechnicianProfile::getUser)
                        .map(this::formatUserName)
                        .orElse("Artisan")
                : "Artisan";
        String interlocutorName = reporterIsClient ? technicianName : clientName;
        if (interlocutorName.isBlank() || "Client".equals(interlocutorName)) {
            interlocutorName = reporterIsClient ? "Artisan" : "Client";
        }

        request.setDisputeOpen(true);
        request.setDisputeReporterUserId(reporterUserId);
        request.setDisputeOpenAt(LocalDateTime.now());
        request.setUpdatedAt(LocalDateTime.now());
        requestRepository.save(request);
        saveSystemChatMessage(requestId, SYSTEM_SENDER_USER_ID,
                "Litige signalé par " + reporterName + " à l'encontre de " + interlocutorName
                        + ". L'administrateur va procéder à la résolution.");
        notifyAdmins(requestId, "Litige signalé",
                "Litige signalé sur la demande #" + requestId + " par " + reporterName + " contre "
                        + interlocutorName + ". Veuillez procéder à la résolution.");
        notificationService.create(reporterUserId,
                "Litige signalé avec succès",
                "Votre signalement concernant la demande #" + requestId + " a bien été envoyé à l'administration. "
                        + "Nous allons traiter le litige dans les plus brefs délais.",
                "request", requestId);
        Long interlocutorUserId = reporterIsClient ? technicianUserId : clientUserId;
        if (interlocutorUserId != null) {
            notificationService.create(interlocutorUserId,
                    "Litige signalé contre vous",
                    reporterName + " a signalé un litige à votre encontre sur la demande #" + requestId + ".",
                    "request", requestId);
        }
        return ResponseEntity.ok(request);
    }

    @PostMapping("/request/{requestId}/dispute/resolve")
    @Transactional
    public ResponseEntity<?> resolveDispute(@RequestHeader(value = "Authorization", required = false) String authorizationHeader,
                                            @PathVariable("requestId") Long requestId) {
        if (requestId == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "requestId requis."));
        }
        Optional<User> optionalRequester = AuthController.authenticateToken(authorizationHeader, userRepository);
        if (optionalRequester.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("message", "Utilisateur non authentifié."));
        }
        User requester = optionalRequester.get();
        Optional<ClientRequest> optional = requestRepository.findById(requestId);
        if (optional.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        ClientRequest request = optional.get();
        if (!request.isDisputeOpen()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Aucun litige en cours pour cette demande."));
        }
        if (request.getDisputeReporterUserId() == null
                || !request.getDisputeReporterUserId().equals(requester.getId())) {
            return ResponseEntity.status(403).body(Map.of("message", "Seule la personne ayant signalé le litige peut l'annuler."));
        }
        if (request.getDisputeOpenAt() != null
                && request.getDisputeOpenAt().plusHours(24).isBefore(LocalDateTime.now())) {
            return ResponseEntity.badRequest().body(Map.of("message", "Le délai de 24h pour annuler le litige est écoulé."));
        }
        request.setDisputeOpen(false);
        request.setDisputeReporterUserId(null);
        request.setDisputeOpenAt(null);
        request.setUpdatedAt(LocalDateTime.now());
        requestRepository.save(request);
        saveSystemChatMessage(requestId, SYSTEM_SENDER_USER_ID, "Litige annulé : les deux parties ont trouvé un compromis.");
        notifyChatDispute(requestId, "Litige annulé", "Le litige de la demande #" + requestId + " a été annulé : un compromis a été trouvé.");
        notifyAdmins(requestId, "Litige annulé", "Le litige de la demande #" + requestId + " a été annulé : les deux parties ont trouvé un compromis.");
        return ResponseEntity.ok(request);
    }

    private void notifyAdmins(Long requestId, String title, String text) {
        for (User admin : userRepository.findByRole(Role.admin)) {
            notificationService.create(admin.getId(), title, text, "request", requestId);
        }
    }

    private void notifyChatDispute(Long requestId, String title, String text) {
        requestRepository.findById(requestId).ifPresent(request -> {
            Long clientUserId = request.getClientId() != null
                    ? clientProfileRepository.findById(request.getClientId())
                            .map(ClientProfile::getUser)
                            .map(User::getId)
                            .orElse(null)
                    : null;
            Long technicianUserId = request.getTechnicianId() != null
                    ? technicianProfileRepository.findById(request.getTechnicianId())
                            .map(TechnicianProfile::getUser)
                            .map(User::getId)
                            .orElse(null)
                    : null;
            for (Long userId : java.util.Arrays.asList(clientUserId, technicianUserId)) {
                if (userId != null) {
                    notificationService.create(userId, title, text, "request", requestId);
                }
            }
        });
    }

    private ChatMessage saveSystemChatMessage(Long requestId, Long senderUserId, String text) {
        ChatMessage chatMessage = new ChatMessage();
        chatMessage.setRequestId(requestId);
        chatMessage.setSenderUserId(senderUserId);
        chatMessage.setText(text);
        chatMessage.setTimestamp(LocalDateTime.now());
        chatMessage.setRead(false);
        ChatMessage saved = messageRepository.save(chatMessage);
        chatEventService.broadcastMessage(requestId, saved);
        return saved;
    }

    private String formatAmount(java.math.BigDecimal amount) {
        if (amount == null) {
            return "";
        }
        return java.text.NumberFormat.getInstance(java.util.Locale.FRENCH).format(amount);
    }

    @GetMapping("/unread-count")
    public ResponseEntity<?> getUnreadCount(@RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        Optional<User> optionalUser = AuthController.authenticateToken(authorizationHeader, userRepository);
        if (optionalUser.isEmpty()) {
            return ResponseEntity.ok(Map.of("count", 0));
        }
        User user = optionalUser.get();
        List<Long> requestIds = new java.util.ArrayList<>();
        if (user.getRole() == Role.client) {
            clientProfileRepository.findByUserId(user.getId()).ifPresent(profile ->
                    requestRepository.findByClientIdOrderByCreatedAtDesc(profile.getId())
                            .forEach(request -> requestIds.add(request.getId())));
        } else if (user.getRole() == Role.technician) {
            technicianProfileRepository.findByUserId(user.getId()).ifPresent(profile ->
                    requestRepository.findByTechnicianIdOrderByCreatedAtDesc(profile.getId())
                            .forEach(request -> requestIds.add(request.getId())));
        }
        if (requestIds.isEmpty()) {
            return ResponseEntity.ok(Map.of("count", 0));
        }
        long count = messageRepository.countUnreadByRequestIds(requestIds, user.getId());
        return ResponseEntity.ok(Map.of("count", count));
    }

    @GetMapping("/stream/{requestId}")
    public ResponseEntity<?> streamMessages(@RequestHeader(value = "Authorization", required = false) String authorizationHeader,
                                            @RequestParam(value = "token", required = false) String token,
                                            @PathVariable("requestId") Long requestId) {
        Optional<User> optionalUser = AuthController.authenticateToken(
                authorizationHeader != null ? authorizationHeader : "Bearer " + (token == null ? "" : token),
                userRepository);
        if (optionalUser.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("message", "Utilisateur non authentifié."));
        }
        if (!chatAccessService.isConversationAccessible(optionalUser.get(), requestId)) {
            return ResponseEntity.status(403).body(Map.of("message", "Accès refusé à cette conversation."));
        }
        return ResponseEntity.ok(this.chatEventService.createEmitter(requestId));
    }

    @PostMapping("/request/{requestId}/assign")
    public ResponseEntity<?> assignTechnician(@RequestHeader(value = "Authorization", required = false) String authorizationHeader,
                                              @PathVariable("requestId") Long requestId,
                                              @RequestParam("technicianId") Long technicianId) {
        Optional<User> optionalUser = AuthController.authenticateToken(authorizationHeader, userRepository);
        if (optionalUser.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("message", "Utilisateur non authentifié."));
        }
        User user = optionalUser.get();
        if (user.getRole() != Role.technician && user.getRole() != Role.admin) {
            return ResponseEntity.status(403).body(Map.of("message", "Seul un technicien peut accepter une demande."));
        }
        if (technicianId == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "technicianId requis."));
        }
        Optional<TechnicianProfile> optionalProfile = Optional.empty();
        if (user.getRole() == Role.technician) {
            optionalProfile = technicianProfileRepository.findByUserId(user.getId());
            if (optionalProfile.isEmpty() || !optionalProfile.get().getId().equals(technicianId)) {
                return ResponseEntity.status(403).body(Map.of("message", "Impossible d'assigner cette demande à un autre technicien."));
            }
        }
        Optional<ClientRequest> optionalRequest = requestRepository.findById(requestId);
        if (optionalRequest.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        ClientRequest request = optionalRequest.get();
        if (request.getTechnicianId() != null) {
            return ResponseEntity.badRequest().body(Map.of("message", "Cette demande a déjà un technicien assigné."));
        }
        if (optionalProfile.isPresent()) {
            TechnicianProfile profile = optionalProfile.get();
            if (missionGuardService.isSuspended(profile)) {
                if (profile.isSuspendedPermanent()) {
                    return ResponseEntity.status(403).body(Map.of("message", "Votre compte technicien a été définitivement suspendu."));
                }
                return ResponseEntity.status(403).body(Map.of("message",
                        "Votre compte est suspendu. Réessayez dans " + missionGuardService.formatDuration(missionGuardService.suspensionRemainingSec(profile)) + "."));
            }
            if (profile.getAvailabilityStatus() == AvailabilityStatus.busy) {
                return ResponseEntity.badRequest().body(Map.of("message", "Vous êtes en intervention. Terminez-la avant d'accepter une nouvelle demande."));
            }
            long frozenSeconds = missionGuardService.freezeRemainingSec(profile);
            if (frozenSeconds > 0) {
                return ResponseEntity.badRequest().body(Map.of("message", "Vous avez décliné trop de demandes récemment. Les acceptations sont gelées pour encore " + missionGuardService.formatDuration(frozenSeconds) + "."));
            }
            long concurrent = requestRepository.findByTechnicianIdOrderByCreatedAtDesc(profile.getId()).stream()
                    .filter(r -> "assigned".equals(r.getStatus()))
                    .filter(r -> sameUrgency(r.getUrgency(), request.getUrgency()))
                    .count();
            if (concurrent >= missionGuardService.getMaxConcurrent()) {
                return ResponseEntity.badRequest().body(Map.of("message", "Vous avez déjà " + missionGuardService.getMaxConcurrent()
                        + " demandes réservées dans le niveau d'urgence « " + normalizeUrgency(request.getUrgency()) + " ». Terminez ou déclinez-en une avant d'en accepter une nouvelle."));
            }
        }
        request.setTechnicianId(technicianId);
        request.setStatus("assigned");
        request.setReservedUntil(LocalDateTime.now()
                .plusHours(missionGuardService.getReservationHoursFor(request.getUrgency())));
        request.setUpdatedAt(LocalDateTime.now());
        ClientRequest saved = requestRepository.save(request);
        optionalProfile.ifPresent(profile -> {
            profile.setAcceptanceCount(profile.getAcceptanceCount() + 1);
            recordResponseTime(profile, request);
            missionGuardService.recomputeSuccessRate(profile);
        });
        notifyTechnicianAssigned(saved);
        return ResponseEntity.ok(saved);
    }

    /**
     * Met à jour avg_response_time_sec : moyenne glissante du temps entre la
     * publication de la demande et son acceptation par le technicien.
     */
    private void recordResponseTime(TechnicianProfile profile, ClientRequest request) {
        if (request.getCreatedAt() == null) {
            return;
        }
        long responseSec = Math.max(0L, Duration.between(request.getCreatedAt(), LocalDateTime.now()).toSeconds());
        int newCount = profile.getAcceptanceCount();
        int oldCount = Math.max(0, newCount - 1);
        int currentAvg = profile.getAvgResponseTimeSec() != null ? profile.getAvgResponseTimeSec() : 0;
        long newAvg = oldCount <= 0
                ? responseSec
                : (long) Math.round(((double) currentAvg * oldCount + responseSec) / newCount);
        profile.setAvgResponseTimeSec((int) Math.min(Integer.MAX_VALUE, newAvg));
    }

    @PostMapping("/request/{requestId}/reopen")
    public ResponseEntity<?> reopenRequest(@RequestHeader(value = "Authorization", required = false) String authorizationHeader,
                                           @PathVariable("requestId") Long requestId) {
        Optional<User> optionalUser = AuthController.authenticateToken(authorizationHeader, userRepository);
        if (optionalUser.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("message", "Utilisateur non authentifié."));
        }
        User user = optionalUser.get();
        Optional<ClientRequest> optionalRequest = requestRepository.findById(requestId);
        if (optionalRequest.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        ClientRequest request = optionalRequest.get();
        if ("in_progress".equals(request.getStatus()) || "completed".equals(request.getStatus())) {
            return ResponseEntity.badRequest().body(Map.of("message", "Cette intervention ne peut plus être déclinée."));
        }
        boolean isAdmin = user.getRole() == Role.admin;
        boolean isAssignedTech = request.getTechnicianId() != null
                && technicianProfileRepository.findByUserId(user.getId())
                        .map(TechnicianProfile::getId)
                        .map(id -> id.equals(request.getTechnicianId()))
                        .orElse(false);
        if (!isAdmin && !isAssignedTech) {
            return ResponseEntity.status(403).body(Map.of("message", "Seul le technicien assigné (ou un administrateur) peut décliner cette demande."));
        }
        Long technicianProfileId = technicianProfileRepository.findByUserId(user.getId())
                .map(TechnicianProfile::getId)
                .orElse(null);
        missionGuardService.recordDecline(requestId, technicianProfileId);
        if (technicianProfileId != null) {
            technicianProfileRepository.findById(technicianProfileId).ifPresent(profile -> {
                profile.setDeclineCount(profile.getDeclineCount() + 1);
                missionGuardService.recomputeSuccessRate(profile);
            });
        }
        request.setTechnicianId(null);
        request.setStatus("published");
        request.setReservedUntil(null);
        request.setUpdatedAt(LocalDateTime.now());
        ClientRequest saved = requestRepository.save(request);
        saveSystemChatMessage(requestId, SYSTEM_SENDER_USER_ID,
                "La demande a été déclinée par le technicien : elle redevient disponible pour d'autres techniciens.");
        notifyMatchingTechnicians(saved);
        technicianEventService.broadcast("request", Map.of("id", saved.getId(), "status", "published"));
        return ResponseEntity.ok(saved);
    }

    @Scheduled(fixedDelay = 60_000)
    @Transactional
    public void expireReservations() {
        List<ClientRequest> expired = requestRepository
                .findByStatusAndReservedUntilBeforeAndFundsDepositedFalseAndDisputeOpenFalse(
                        "assigned", LocalDateTime.now());
        for (ClientRequest request : expired) {
            releaseExpiredReservation(request);
        }
    }

    private void releaseExpiredReservation(ClientRequest request) {
        Long technicianProfileId = request.getTechnicianId();
        if (technicianProfileId != null) {
            missionGuardService.recordDecline(request.getId(), technicianProfileId);
            technicianProfileRepository.findById(technicianProfileId).ifPresent(profile -> {
                profile.setDeclineCount(profile.getDeclineCount() + 1);
                missionGuardService.recomputeSuccessRate(profile);
            });
        }
        request.setTechnicianId(null);
        request.setStatus("published");
        request.setReservedUntil(null);
        request.setUpdatedAt(LocalDateTime.now());
        ClientRequest saved = requestRepository.save(request);
        saveSystemChatMessage(saved.getId(), SYSTEM_SENDER_USER_ID,
                "La réservation a expiré : la demande redevient disponible pour d'autres techniciens.");
        notifyMatchingTechnicians(saved);
        technicianEventService.broadcast("request", Map.of("id", saved.getId(), "status", "published"));
    }

    private static final java.time.Duration DUPLICATE_NOTIFICATION_WINDOW = java.time.Duration.ofSeconds(30);
    private static final java.time.Duration REMINDER_DEDUP_WINDOW = java.time.Duration.ofMinutes(30);

    /**
     * Surveille les interventions planifiées (statut "assigned") :
     * - rappel au technicien 10 minutes avant l'heure prévue ;
     * - rappel 2 minutes avant ;
     * - pénalité de non-présentation 10 minutes après l'heure prévue.
     */
    @Scheduled(fixedDelay = 30_000)
    @Transactional
    public void checkMissionReminders() {
        LocalDateTime now = LocalDateTime.now();
        for (ClientRequest request : requestRepository.findByStatusOrderByCreatedAtDesc("assigned")) {
            LocalDateTime start = request.getScheduledAt();
            if (start == null) {
                continue;
            }
            Long techUserId = request.getTechnicianId() != null
                    ? technicianProfileRepository.findById(request.getTechnicianId())
                            .map(TechnicianProfile::getUser)
                            .map(User::getId)
                            .orElse(null)
                    : null;
            if (techUserId == null) {
                continue;
            }
            String label = "« " + (request.getCategory() != null && !request.getCategory().isBlank()
                    ? request.getCategory() : "intervention") + " »";
            String timeText = formatSchedule(start);
            if (!now.isBefore(start.minusMinutes(10))) {
                notifyOnce(techUserId, "Intervention dans 10 minutes",
                        "Votre intervention " + label + " commence à " + timeText + ". Préparez-vous.",
                        request.getId());
            }
            if (!now.isBefore(start.minusMinutes(2))) {
                notifyOnce(techUserId, "Démarrage imminent",
                        "Votre intervention " + label + " doit démarrer à " + timeText + ". Cliquez sur « Démarrer ».",
                        request.getId());
            }
            if (!now.isBefore(start.plusMinutes(10))) {
                applyNoShowPenalty(request);
            }
        }
    }

    private void notifyOnce(Long userId, String title, String message, Long requestId) {
        if (notificationService.hasRecentDuplicate(userId, title, message, REMINDER_DEDUP_WINDOW)) {
            return;
        }
        notificationService.create(userId, title, message, "request", requestId);
    }

    /**
     * Pénalité de non-présentation : comptabilisée comme un déclin (gel du
     * garde-fou anti-accaparement), la demande est libérée pour les autres
     * techniciens, et des suspensions progressives sont appliquées à partir
     * de 5 non-présentations sur 30 jours glissants (1 j, 3 j, 7 j, 10 j,
     * puis suspension définitive).
     */
    private void applyNoShowPenalty(ClientRequest request) {
        Long technicianProfileId = request.getTechnicianId();
        if (technicianProfileId != null) {
            missionGuardService.recordNoShow(request.getId(), technicianProfileId);
            technicianProfileRepository.findById(technicianProfileId).ifPresent(profile -> {
                profile.setDeclineCount(profile.getDeclineCount() + 1);
                missionGuardService.recomputeSuccessRate(profile);
                applySuspensionIfNeeded(profile, request);
            });
            technicianProfileRepository.findById(technicianProfileId)
                    .map(TechnicianProfile::getUser)
                    .map(User::getId)
                    .ifPresent(userId -> notificationService.create(userId, "Pénalité : non-présentation",
                            "Vous n'avez pas démarré l'intervention dans les 10 minutes suivant l'heure prévue. "
                                    + "Un déclin a été enregistré et la demande a été libérée.",
                            "request", request.getId()));
        }
        saveSystemChatMessage(request.getId(), SYSTEM_SENDER_USER_ID,
                "Le technicien ne s'est pas présenté à l'heure prévue : la demande redevient disponible pour d'autres techniciens.");
        notifyClient(request, "Technicien non présent",
                "Votre technicien ne s'est pas présenté à l'heure prévue. "
                        + "La demande est de nouveau disponible pour d'autres techniciens.");
        request.setTechnicianId(null);
        request.setStatus("published");
        request.setReservedUntil(null);
        request.setScheduledAt(null);
        request.setUpdatedAt(LocalDateTime.now());
        requestRepository.save(request);
        technicianEventService.broadcast("request", Map.of("id", request.getId(), "status", "published"));
    }

    /**
     * Suspension progressive selon le nombre de non-présentations sur 30 jours
     * glissants : 5e → 1 jour, 6e → 3 jours, 7e → 7 jours, 8e → 10 jours,
     * 9e et au-delà → suspension définitive.
     */
    private void applySuspensionIfNeeded(TechnicianProfile profile, ClientRequest request) {
        long noShows = missionGuardService.countNoShows(profile);
        if (noShows < 5) {
            return;
        }
        boolean permanent = noShows >= 9;
        int days = 0;
        if (noShows == 5) {
            days = 1;
        } else if (noShows == 6) {
            days = 3;
        } else if (noShows == 7) {
            days = 7;
        } else if (noShows == 8) {
            days = 10;
        }
        profile.setSuspendedPermanent(permanent);
        profile.setSuspendedUntil(permanent ? null : LocalDateTime.now().plusDays(days));
        technicianProfileRepository.save(profile);
        if (profile.getUser() != null) {
            notificationService.create(profile.getUser().getId(),
                    permanent ? "Suspension définitive" : "Suspension de " + days + " jour" + (days > 1 ? "s" : ""),
                    permanent
                            ? "Vous avez atteint le seuil de 9 non-présentations sur 30 jours. Votre compte technicien est définitivement suspendu."
                            : "Vous avez atteint le seuil de " + noShows + " non-présentations sur 30 jours. Votre compte est suspendu jusqu'au "
                                    + formatSchedule(profile.getSuspendedUntil()) + ".",
                    "request", request.getId());
        }
        technicianEventService.broadcast("suspension", Map.of(
                "technicianId", profile.getId(),
                "permanent", permanent,
                "until", profile.getSuspendedUntil()));
    }

    private void notifyClient(ClientRequest request, String title, String message) {
        Long clientUserId = request.getClientId() != null
                ? clientProfileRepository.findById(request.getClientId())
                        .map(ClientProfile::getUser)
                        .map(User::getId)
                        .orElse(null)
                : null;
        if (clientUserId != null) {
            notificationService.create(clientUserId, title, message, "request", request.getId());
        }
    }

    private void notifyMatchingTechnicians(ClientRequest request) {
        String category = request.getCategory() != null ? request.getCategory().trim() : "";
        String normalizedCategory = normalizeDomain(category);
        String title = "Nouvelle demande d'intervention";
        String message = "Une demande « " + category + " » vient d'être publiée. Consultez votre tableau de bord.";
        technicianProfileRepository.findAll().stream()
                .filter(profile -> profile.getUser() != null)
                .filter(profile -> {
                    if (normalizedCategory.isEmpty()) {
                        return true;
                    }
                    String domain = normalizeDomain(profile.getDomain() != null ? profile.getDomain() : "");
                    return !domain.isEmpty() && (domain.equals(normalizedCategory) || domain.contains(normalizedCategory) || normalizedCategory.contains(domain));
                })
                .forEach(profile -> {
                    Long userId = profile.getUser().getId();
                    if (!notificationService.hasRecentDuplicate(userId, title, message, DUPLICATE_NOTIFICATION_WINDOW)) {
                        notificationService.create(userId, title, message, "request", request.getId());
                    }
                });
    }

    private void notifyTechnicianAssigned(ClientRequest request) {
        if (request.getTechnicianId() == null) {
            return;
        }
        technicianProfileRepository.findById(request.getTechnicianId())
                .map(TechnicianProfile::getUser)
                .ifPresent(user -> notificationService.create(
                        user.getId(),
                        "Nouvelle mission",
                        "Vous avez été assigné à la demande #" + request.getId()
                                + (request.getCategory() != null && !request.getCategory().isBlank() ? " (« " + request.getCategory() + " »)" : "")
                                + ".",
                        "request",
                        request.getId()));
    }

    private void notifyChatPeer(ChatMessage message) {
        if (message.getRequestId() == null || message.getSenderUserId() == null) {
            return;
        }
        Optional<ClientRequest> requestOpt = requestRepository.findById(message.getRequestId());
        if (requestOpt.isEmpty()) {
            return;
        }
        ClientRequest request = requestOpt.get();
        Long clientUserId = request.getClientId() != null
                ? clientProfileRepository.findById(request.getClientId())
                        .map(ClientProfile::getUser)
                        .map(User::getId)
                        .orElse(null)
                : null;
        Long technicianUserId = request.getTechnicianId() != null
                ? technicianProfileRepository.findById(request.getTechnicianId())
                        .map(TechnicianProfile::getUser)
                        .map(User::getId)
                        .orElse(null)
                : null;
        Long recipientUserId = clientUserId;
        if (recipientUserId != null && recipientUserId.equals(message.getSenderUserId())) {
            recipientUserId = technicianUserId;
        }
        if (recipientUserId == null || recipientUserId.equals(message.getSenderUserId())) {
            return;
        }
        String text = message.getText() != null ? message.getText().trim() : "";
        String preview = text.length() > 80 ? text.substring(0, 80) + "…" : text;
        String senderName = resolveUserName(message.getSenderUserId());
        notificationService.create(
                recipientUserId,
                "Nouveau message",
                preview.isEmpty()
                        ? "Vous avez reçu un nouveau message."
                        : "Vous avez reçu un message de " + senderName + " : « " + preview + " »",
                "message",
                message.getRequestId());
    }

    private String resolveUserName(Long userId) {
        if (userId == null) {
            return "quelqu'un";
        }
        Optional<User> user = userRepository.findById(userId);
        if (user.isEmpty()) {
            return "quelqu'un";
        }
        String first = user.get().getFirstName() != null ? user.get().getFirstName() : "";
        String last = user.get().getLastName() != null ? user.get().getLastName() : "";
        String name = (first + " " + last).trim();
        return name.isBlank() ? "quelqu'un" : name;
    }
}
