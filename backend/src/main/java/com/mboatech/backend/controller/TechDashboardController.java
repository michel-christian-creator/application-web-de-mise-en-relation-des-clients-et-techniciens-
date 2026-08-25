package com.mboatech.backend.controller;

import com.mboatech.backend.model.AvailabilityStatus;
import com.mboatech.backend.model.ChatMessage;
import com.mboatech.backend.model.ClientProfile;
import com.mboatech.backend.model.ClientRequest;
import com.mboatech.backend.model.Role;
import com.mboatech.backend.model.TechnicianProfile;
import com.mboatech.backend.model.TechnicianRecommendation;
import com.mboatech.backend.model.User;
import com.mboatech.backend.repository.ChatMessageRepository;
import com.mboatech.backend.repository.ClientProfileRepository;
import com.mboatech.backend.repository.ClientRequestRepository;
import com.mboatech.backend.repository.TechnicianProfileRepository;
import com.mboatech.backend.repository.TechnicianRecommendationRepository;
import com.mboatech.backend.repository.UserRepository;
import com.mboatech.backend.service.ChatEventService;
import com.mboatech.backend.service.MissionGuardService;
import com.mboatech.backend.service.NotificationService;
import com.mboatech.backend.service.TechnicianEventService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/tech")
public class TechDashboardController {

    private final UserRepository userRepository;
    private final TechnicianProfileRepository technicianProfileRepository;
    private final TechnicianRecommendationRepository technicianRecommendationRepository;
    private final ClientProfileRepository clientProfileRepository;
    private final ClientRequestRepository requestRepository;
    private final ChatMessageRepository messageRepository;
    private final ChatEventService chatEventService;
    private final TechnicianEventService technicianEventService;
    private final NotificationService notificationService;
    private final MissionGuardService missionGuardService;
    private final JdbcTemplate jdbcTemplate;

    public TechDashboardController(UserRepository userRepository,
                                   TechnicianProfileRepository technicianProfileRepository,
                                   TechnicianRecommendationRepository technicianRecommendationRepository,
                                   ClientProfileRepository clientProfileRepository,
                                   ClientRequestRepository requestRepository,
                                   ChatMessageRepository messageRepository,
                                   ChatEventService chatEventService,
                                   TechnicianEventService technicianEventService,
                                   NotificationService notificationService,
                                   MissionGuardService missionGuardService,
                                   JdbcTemplate jdbcTemplate) {
        this.userRepository = userRepository;
        this.technicianProfileRepository = technicianProfileRepository;
        this.technicianRecommendationRepository = technicianRecommendationRepository;
        this.clientProfileRepository = clientProfileRepository;
        this.requestRepository = requestRepository;
        this.messageRepository = messageRepository;
        this.chatEventService = chatEventService;
        this.technicianEventService = technicianEventService;
        this.notificationService = notificationService;
        this.missionGuardService = missionGuardService;
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
        if (user.getRole() != Role.technician) {
            return ResponseEntity.status(403).body(Map.of("message", "Espace réservé aux techniciens."));
        }
        Optional<TechnicianProfile> optionalProfile = technicianProfileRepository.findByUser(user);
        if (optionalProfile.isEmpty()) {
            return ResponseEntity.status(403).body(Map.of("message", "Profil technicien introuvable."));
        }
        TechnicianProfile profile = optionalProfile.get();
        Long techProfileId = profile.getId();
        Long techUserId = user.getId();

        BigDecimal balance = jdbcTemplate.queryForObject(
                "SELECT COALESCE((SELECT COALESCE(SUM(amount), 0) FROM payments "
                        + "WHERE payee_user_id = ? AND status = 'released' "
                        + "AND method <> 'withdraw' AND method <> 'refund') "
                        + "- (SELECT COALESCE(SUM(amount), 0) FROM withdrawals "
                        +                 "WHERE technician_user_id = ? AND status = 'paid'), 0)",
                BigDecimal.class, techUserId, techUserId);
        BigDecimal held = jdbcTemplate.queryForObject(
                "SELECT COALESCE(SUM(m.devis_amount), 0) FROM chat_messages m "
                        + "JOIN service_requests r ON r.id = m.service_request_id "
                        + "WHERE r.technician_id = ? AND m.devis_status = 'accepted' AND m.devis_amount IS NOT NULL "
                        + "AND NOT EXISTS (SELECT 1 FROM payments p "
                        +                 "WHERE p.service_request_id = r.id AND p.status = 'released')",
                BigDecimal.class, techProfileId);
        LocalDate monthStart = LocalDate.now().withDayOfMonth(1);
        Long completedThisMonth = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM service_requests WHERE technician_id = ? AND status = 'completed' AND updated_at >= ?",
                Long.class, techProfileId, monthStart.atStartOfDay());
        Long missions = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM service_requests WHERE technician_id = ?",
                Long.class, techProfileId);
        Long completedMissions = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM service_requests WHERE technician_id = ? AND status = 'completed'",
                Long.class, techProfileId);

        List<Map<String, Object>> activeChantiers = new ArrayList<>();
        requestRepository.findByTechnicianIdOrderByCreatedAtDesc(techProfileId).stream()
                .filter(r -> "assigned".equals(r.getStatus()))
                .forEach(r -> {
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("id", r.getId());
                    item.put("category", r.getCategory());
                    item.put("description", r.getDescription());
                    item.put("scheduledAt", r.getScheduledAt());
                    item.put("reservedUntil", r.getReservedUntil());
                    item.put("urgency", r.getUrgency());
                    item.put("clientName", resolveClientName(r.getClientId()));
                    item.put("clientLocation", resolveClientLocation(r.getClientId()));
                    item.put("clientCity", resolveClientCity(r.getClientId()));
                    item.put("heldAmount", heldForRequest(r.getId()));
                    activeChantiers.add(item);
                });

        Map<String, Long> urgencyUsage = new LinkedHashMap<>();
        requestRepository.findByTechnicianIdOrderByCreatedAtDesc(techProfileId).stream()
                .filter(r -> "assigned".equals(r.getStatus()))
                .forEach(r -> {
                    String urgency = normalizeUrgency(r.getUrgency());
                    urgencyUsage.put(urgency, urgencyUsage.getOrDefault(urgency, 0L) + 1);
                });

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("balance", balance);
        data.put("held", held);
        data.put("completedThisMonth", completedThisMonth);
        data.put("missions", missions);
        data.put("completedMissions", completedMissions);
        data.put("ratingAvg", liveRatingAvg(profile));
        data.put("ratingCount", liveRatingCount(profile));
        data.put("successRate", profile.getSuccessRate());
        data.put("avgResponseTimeSec", profile.getAvgResponseTimeSec());
        data.put("availabilityStatus", profile.getAvailabilityStatus() != null ? profile.getAvailabilityStatus().name() : "available");
        data.put("activeChantiers", activeChantiers);
        data.put("activeReservations", activeChantiers.size());
        data.put("maxReservations", missionGuardService.getMaxConcurrent());
        data.put("reservationUrgencyUsage", urgencyUsage);
        data.put("freezeRemainingSec", missionGuardService.freezeRemainingSec(profile));
        data.put("suspendedUntil", profile.getSuspendedUntil());
        data.put("suspendedPermanent", profile.isSuspendedPermanent());
        data.put("suspensionRemainingSec", missionGuardService.suspensionRemainingSec(profile));
        data.put("noShows30d", missionGuardService.countNoShows(profile));
        data.put("reservationRules", missionGuardService.getReservationRules());
        return ResponseEntity.ok(data);
    }

    @PostMapping("/availability")
    @Transactional
    public ResponseEntity<?> setAvailability(@RequestHeader(value = "Authorization", required = false) String authorizationHeader,
                                             @RequestParam("status") String status) {
        Optional<TechnicianProfile> optionalProfile = currentTechnician(authorizationHeader);
        if (optionalProfile.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("message", "Utilisateur non authentifié."));
        }
        TechnicianProfile profile = optionalProfile.get();
        if (profile.getAvailabilityStatus() == AvailabilityStatus.busy) {
            return ResponseEntity.badRequest().body(Map.of("message", "Vous êtes en intervention. Terminez-la avant de changer de statut."));
        }
        String normalized = status != null ? status.toLowerCase().trim() : "";
        AvailabilityStatus newStatus;
        if ("available".equals(normalized) || "online".equals(normalized)) {
            newStatus = AvailabilityStatus.available;
        } else if ("offline".equals(normalized)) {
            newStatus = AvailabilityStatus.offline;
        } else {
            return ResponseEntity.badRequest().body(Map.of("message", "Statut invalide (available|offline)."));
        }
        profile.setAvailabilityStatus(newStatus);
        technicianProfileRepository.save(profile);
        technicianEventService.broadcast("availability", Map.of("technicianId", profile.getId(), "status", newStatus.name()));
        return ResponseEntity.ok(Map.of("availabilityStatus", newStatus.name()));
    }

    @GetMapping("/day")
    @Transactional(readOnly = true)
    public ResponseEntity<?> day(@RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        Optional<TechnicianProfile> optionalProfile = currentTechnician(authorizationHeader);
        if (optionalProfile.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("message", "Utilisateur non authentifié."));
        }
        TechnicianProfile profile = optionalProfile.get();
        LocalDateTime dayStart = LocalDate.now().atStartOfDay();
        LocalDateTime dayEnd = dayStart.plusDays(1);

        List<Map<String, Object>> planned = new ArrayList<>();
        List<Map<String, Object>> inProgress = new ArrayList<>();
        List<Map<String, Object>> completedToday = new ArrayList<>();
        requestRepository.findByTechnicianIdOrderByCreatedAtDesc(profile.getId()).forEach(r -> {
            if ("in_progress".equals(r.getStatus())) {
                inProgress.add(toDayItem(r));
            } else if ("assigned".equals(r.getStatus())
                    && r.getScheduledAt() != null
                    && !r.getScheduledAt().isBefore(dayStart)
                    && r.getScheduledAt().isBefore(dayEnd)) {
                planned.add(toDayItem(r));
            } else if ("completed".equals(r.getStatus())
                    && r.getUpdatedAt() != null
                    && !r.getUpdatedAt().isBefore(dayStart)
                    && r.getUpdatedAt().isBefore(dayEnd)) {
                completedToday.add(toDayItem(r));
            }
        });
        planned.sort((a, b) -> {
            LocalDateTime at = (LocalDateTime) a.get("scheduledAt");
            LocalDateTime bt = (LocalDateTime) b.get("scheduledAt");
            if (at == null && bt == null) return 0;
            if (at == null) return 1;
            if (bt == null) return -1;
            return at.compareTo(bt);
        });
        inProgress.sort((a, b) -> {
            LocalDateTime at = (LocalDateTime) a.get("scheduledAt");
            LocalDateTime bt = (LocalDateTime) b.get("scheduledAt");
            if (at == null && bt == null) return 0;
            if (at == null) return 1;
            if (bt == null) return -1;
            return at.compareTo(bt);
        });

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("date", LocalDate.now().toString());
        data.put("planned", planned);
        data.put("inProgress", inProgress);
        data.put("completedToday", completedToday);
        return ResponseEntity.ok(data);
    }

    @PostMapping("/request/{requestId}/start")
    @Transactional
    public ResponseEntity<?> startRequest(@RequestHeader(value = "Authorization", required = false) String authorizationHeader,
                                          @PathVariable("requestId") Long requestId) {
        Optional<TechnicianProfile> optionalProfile = currentTechnician(authorizationHeader);
        if (optionalProfile.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("message", "Utilisateur non authentifié."));
        }
        Optional<ClientRequest> optionalRequest = requestRepository.findById(requestId);
        if (optionalRequest.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        ClientRequest request = optionalRequest.get();
        if (!optionalProfile.get().getId().equals(request.getTechnicianId())) {
            return ResponseEntity.status(403).body(Map.of("message", "Cette demande ne vous est pas assignée."));
        }
        if (!"assigned".equals(request.getStatus())) {
            return ResponseEntity.badRequest().body(Map.of("message", "Cette intervention n'est pas en attente de démarrage."));
        }
        request.setStatus("in_progress");
        request.setUpdatedAt(LocalDateTime.now());
        requestRepository.save(request);

        TechnicianProfile profile = optionalProfile.get();
        profile.setAvailabilityStatus(AvailabilityStatus.busy);
        technicianProfileRepository.save(profile);
        technicianEventService.broadcast("availability", Map.of("technicianId", profile.getId(), "status", "busy"));
        technicianEventService.broadcast("request", Map.of("id", request.getId(), "status", "in_progress"));

        saveSystemChatMessage(request.getId(), "Intervention démarrée : le technicien est sur place.");
        notifyClient(request, "Intervention démarrée", "Votre technicien a commencé l'intervention.");
        return ResponseEntity.ok(request);
    }

    @PostMapping("/request/{requestId}/complete")
    @Transactional
    public ResponseEntity<?> completeRequest(@RequestHeader(value = "Authorization", required = false) String authorizationHeader,
                                             @PathVariable("requestId") Long requestId) {
        Optional<TechnicianProfile> optionalProfile = currentTechnician(authorizationHeader);
        if (optionalProfile.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("message", "Utilisateur non authentifié."));
        }
        Optional<ClientRequest> optionalRequest = requestRepository.findById(requestId);
        if (optionalRequest.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        ClientRequest request = optionalRequest.get();
        if (!optionalProfile.get().getId().equals(request.getTechnicianId())) {
            return ResponseEntity.status(403).body(Map.of("message", "Cette demande ne vous est pas assignée."));
        }
        if (!"in_progress".equals(request.getStatus()) && !"assigned".equals(request.getStatus())) {
            return ResponseEntity.badRequest().body(Map.of("message", "Cette intervention ne peut pas être terminée."));
        }
        request.setStatus("completed");
        request.setUpdatedAt(LocalDateTime.now());
        requestRepository.save(request);

        TechnicianProfile profile = optionalProfile.get();
        profile.setAvailabilityStatus(AvailabilityStatus.available);
        technicianProfileRepository.save(profile);
        technicianEventService.broadcast("availability", Map.of("technicianId", profile.getId(), "status", "available"));
        technicianEventService.broadcast("request", Map.of("id", request.getId(), "status", "completed"));

        saveSystemChatMessage(request.getId(), "Intervention terminée. Le paiement sera débloqué après validation.");
        notifyClient(request, "Intervention terminée", "Votre technicien a terminé l'intervention. N'oubliez pas de laisser une évaluation.");
        return ResponseEntity.ok(request);
    }

    private Optional<TechnicianProfile> currentTechnician(String authorizationHeader) {
        Optional<User> optionalUser = AuthController.authenticateToken(authorizationHeader, userRepository);
        if (optionalUser.isEmpty() || optionalUser.get().getRole() != Role.technician) {
            return Optional.empty();
        }
        return technicianProfileRepository.findByUser(optionalUser.get());
    }

    private Map<String, Object> toDayItem(ClientRequest r) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("id", r.getId());
        item.put("category", r.getCategory());
        item.put("description", r.getDescription());
        item.put("status", r.getStatus());
        item.put("scheduledAt", r.getScheduledAt());
        item.put("updatedAt", r.getUpdatedAt());
        item.put("clientName", resolveClientName(r.getClientId()));
        item.put("clientLocation", resolveClientLocation(r.getClientId()));
        item.put("clientCity", resolveClientCity(r.getClientId()));
        item.put("heldAmount", heldForRequest(r.getId()));
        return item;
    }

    private ChatMessage saveSystemChatMessage(Long requestId, String text) {
        ChatMessage chatMessage = new ChatMessage();
        chatMessage.setRequestId(requestId);
        chatMessage.setSenderUserId(ChatController.SYSTEM_SENDER_USER_ID);
        chatMessage.setText(text);
        chatMessage.setTimestamp(LocalDateTime.now());
        chatMessage.setRead(false);
        ChatMessage saved = messageRepository.save(chatMessage);
        chatEventService.broadcastMessage(requestId, saved);
        return saved;
    }

    private void notifyClient(ClientRequest request, String title, String message) {
        if (request.getClientId() == null) {
            return;
        }
        clientProfileRepository.findById(request.getClientId())
                .map(ClientProfile::getUser)
                .map(User::getId)
                .ifPresent(userId -> notificationService.create(userId, title, message, "message", request.getId()));
    }

    private BigDecimal heldForRequest(Long requestId) {
        BigDecimal value = jdbcTemplate.queryForObject(
                "SELECT COALESCE(SUM(m.devis_amount), 0) FROM chat_messages m "
                        + "WHERE m.service_request_id = ? AND m.devis_status = 'accepted' AND m.devis_amount IS NOT NULL",
                BigDecimal.class, requestId);
        return value == null ? BigDecimal.ZERO : value;
    }

    private String resolveClientName(Long clientId) {
        if (clientId == null) {
            return "Client";
        }
        return clientProfileRepository.findById(clientId)
                .map(com.mboatech.backend.model.ClientProfile::getUser)
                .map(this::formatUserName)
                .orElse("Client");
    }

    private String resolveClientLocation(Long clientId) {
        if (clientId == null) {
            return "";
        }
        return clientProfileRepository.findById(clientId)
                .map(com.mboatech.backend.model.ClientProfile::getLocation)
                .orElse("");
    }

    private String resolveClientCity(Long clientId) {
        if (clientId == null) {
            return "";
        }
        return clientProfileRepository.findById(clientId)
                .map(com.mboatech.backend.model.ClientProfile::getCity)
                .orElse("");
    }

    private String formatUserName(User user) {
        if (user == null) {
            return "";
        }
        String first = user.getFirstName() != null ? user.getFirstName() : "";
        String last = user.getLastName() != null ? user.getLastName() : "";
        return (first + " " + last).trim();
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

    /**
     * Moyenne des notes calculée en direct depuis les avis, identique au
     * catalogue, pour ne jamais dépendre des colonnes stockées rating_avg.
     */
    private double liveRatingAvg(TechnicianProfile profile) {
        List<TechnicianRecommendation> rated = technicianRecommendationRepository
                .findByTechnicianIdAndRatingNotNullOrderByCreatedAtDesc(profile.getId());
        if (rated.isEmpty()) {
            return 0.0;
        }
        double avg = rated.stream()
                .mapToInt(r -> r.getRating() == null ? 0 : r.getRating())
                .average()
                .orElse(0.0);
        return Math.round(avg * 10.0) / 10.0;
    }

    private int liveRatingCount(TechnicianProfile profile) {
        return technicianRecommendationRepository
                .findByTechnicianIdAndRatingNotNullOrderByCreatedAtDesc(profile.getId())
                .size();
    }
}
