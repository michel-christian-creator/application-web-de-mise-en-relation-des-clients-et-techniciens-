package com.mboatech.backend.controller;

import com.mboatech.backend.model.ClientProfile;
import com.mboatech.backend.model.TechnicianProfile;
import com.mboatech.backend.model.TechnicianRecommendation;
import com.mboatech.backend.model.User;
import com.mboatech.backend.repository.ClientProfileRepository;
import com.mboatech.backend.repository.ClientRequestRepository;
import com.mboatech.backend.repository.TechnicianProfileRepository;
import com.mboatech.backend.repository.TechnicianRecommendationRepository;
import com.mboatech.backend.repository.TechnicianRecommendationRepository.RecommendationStats;
import com.mboatech.backend.repository.UserRepository;
import com.mboatech.backend.service.AttestationService;
import com.mboatech.backend.service.NotificationService;
import com.mboatech.backend.service.TechnicianEventService;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.text.Normalizer;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/technicians")
public class TechnicianCatalogController {

    private static final Logger logger = LoggerFactory.getLogger(TechnicianCatalogController.class);

    private static final String COMPLETED_REQUEST_STATUS = "completed";

    private final TechnicianProfileRepository technicianProfileRepository;
    private final TechnicianEventService technicianEventService;
    private final TechnicianRecommendationRepository technicianRecommendationRepository;
    private final NotificationService notificationService;
    private final ClientRequestRepository clientRequestRepository;
    private final ClientProfileRepository clientProfileRepository;
    private final UserRepository userRepository;
    private final AttestationService attestationService;

    public TechnicianCatalogController(TechnicianProfileRepository technicianProfileRepository,
                                       TechnicianEventService technicianEventService,
                                       TechnicianRecommendationRepository technicianRecommendationRepository,
                                       NotificationService notificationService,
                                       ClientRequestRepository clientRequestRepository,
                                       ClientProfileRepository clientProfileRepository,
                                       UserRepository userRepository,
                                       AttestationService attestationService) {
        this.technicianProfileRepository = technicianProfileRepository;
        this.technicianEventService = technicianEventService;
        this.technicianRecommendationRepository = technicianRecommendationRepository;
        this.notificationService = notificationService;
        this.clientRequestRepository = clientRequestRepository;
        this.clientProfileRepository = clientProfileRepository;
        this.userRepository = userRepository;
        this.attestationService = attestationService;
    }

    @GetMapping("/categories")
    public ResponseEntity<List<String>> getCategories() {
        logger.debug("GET /api/technicians/categories called");
        LinkedHashMap<String, String> uniqueCategories = new LinkedHashMap<>();

        technicianProfileRepository.findAll().stream()
                .map(TechnicianProfile::getDomain)
                .filter(domain -> domain != null && !domain.isBlank())
                .forEach(domain -> {
                    String[] parts = domain.split(",");
                    for (String part : parts) {
                        String trimmed = part.trim();
                        if (!trimmed.isEmpty()) {
                            uniqueCategories.computeIfAbsent(normalizeDomain(trimmed), ignored -> trimmed);
                        }
                    }
                });

        List<String> categories = uniqueCategories.values().stream()
                .sorted(Comparator.comparing(this::normalizeDomain))
                .collect(Collectors.toList());

        return ResponseEntity.ok(categories);
    }

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<List<Map<String, Object>>> getTechnicians(@RequestParam(name = "domain", required = false) String domain) {
        logger.debug("GET /api/technicians called with domain='{}'", domain);
        String selectedDomain = domain == null ? "" : normalizeDomain(domain);

        List<TechnicianProfile> profiles;
        try {
            profiles = technicianProfileRepository.findAll();
        } catch (Exception e) {
            logger.error("Failed to load technician profiles", e);
            return ResponseEntity.ok(List.of());
        }

        List<TechnicianProfile> filteredProfiles = profiles.stream()
                .filter(profile -> {
                    if (selectedDomain.isBlank()) return true;
                    String[] parts = (profile.getDomain() != null ? profile.getDomain() : "").split(",");
                    for (String part : parts) {
                        String profileDomain = normalizeDomain(part);
                        if (!profileDomain.isEmpty() && (profileDomain.equals(selectedDomain) || profileDomain.contains(selectedDomain) || selectedDomain.contains(profileDomain))) {
                            logger.debug("Profile id={} domain='{}' matches selected='{}'", profile.getId(), profile.getDomain(), selectedDomain);
                            return true;
                        }
                    }
                    return false;
                })
                .toList();

        logger.debug("Found {} profiles matching domain='{}'", filteredProfiles.size(), selectedDomain);

        Map<Long, RecommendationStats> statsById = filteredProfiles.isEmpty()
                ? Map.of()
                : technicianRecommendationRepository.findStatsGroupedByTechnician().stream()
                        .collect(Collectors.toMap(RecommendationStats::getTechnicianId, s -> s, (a, b) -> a));

        List<Map<String, Object>> response;
        try {
            response = filteredProfiles.stream()
                    .map(profile -> mapToDto(profile, statsById.get(profile.getId())))
                    .collect(Collectors.toList());
        } catch (Exception e) {
            logger.error("Failed to map technician profiles", e);
            response = List.of();
        }

        return ResponseEntity.ok(response);
    }

    private Map<String, Object> mapToDto(TechnicianProfile profile, RecommendationStats stats) {
        var user = profile.getUser();
        String firstName = "";
        String lastName = "";
        if (user != null) {
            firstName = user.getFirstName() != null ? user.getFirstName() : "";
            lastName = user.getLastName() != null ? user.getLastName() : "";
        }
        String fullname = (firstName + " " + lastName).trim();
        String profileDomain = profile.getDomain() != null ? profile.getDomain() : "";

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("id", profile.getId());
        data.put("fullname", fullname.isBlank() ? "Technicien" : fullname);
        data.put("domain", profileDomain);
        data.put("city", profile.getCity());
        data.put("location", profile.getLocation());
        data.put("bio", profile.getBio());
        data.put("specialties", profile.getSpecialties());
        data.put("photoUrl", user != null ? user.getPhotoUrl() : null);

        long ratingCount = stats != null ? stats.getRatedCount() : 0L;
        double ratingAvg = 0.0;
        if (ratingCount > 0 && stats != null && stats.getAvgRating() != null) {
            ratingAvg = Math.round(stats.getAvgRating() * 10.0) / 10.0;
        }
        data.put("ratingAvg", ratingAvg);
        data.put("ratingCount", ratingCount);
        data.put("experienceYears", profile.getExperienceYears());
        data.put("verified", profile.isVerified());
        data.put("availabilityStatus", profile.getAvailabilityStatus() != null ? profile.getAvailabilityStatus().name() : "available");
        data.put("hourlyRate", profile.getHourlyRate() != null ? profile.getHourlyRate() : 0.0);
        data.put("successRate", profile.getSuccessRate() != null ? profile.getSuccessRate() : 0.0);
        data.put("avgResponseTimeSec", profile.getAvgResponseTimeSec() != null ? profile.getAvgResponseTimeSec() : 0);
        data.put("recommendationsCount", stats != null ? stats.getCount() : 0L);
        return data;
    }

    @GetMapping("/{id}/recommendations")
    @Transactional(readOnly = true)
    public ResponseEntity<List<Map<String, Object>>> getRecommendations(@PathVariable("id") Long id) {
        logger.debug("GET /api/technicians/{}/recommendations called", id);
        List<Map<String, Object>> result = technicianRecommendationRepository
                .findByTechnicianIdOrderByCreatedAtDesc(id)
                .stream()
                .map(this::mapRecommendationToDto)
                .collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

    /**
     * Attestations publiques du technicien : affichées sur son profil pour
     * rassurer les clients (toutes catégories confondues).
     */
    @GetMapping("/{id}/attestations")
    public ResponseEntity<List<Map<String, Object>>> getAttestations(@PathVariable("id") Long id) {
        if (technicianProfileRepository.findById(id).isEmpty()) {
            return ResponseEntity.ok(List.of());
        }
        try {
            return ResponseEntity.ok(attestationService.getHistory(id));
        } catch (Exception e) {
            logger.error("Erreur chargement attestations du technicien {}", id, e);
            return ResponseEntity.ok(List.of());
        }
    }

    @PostMapping("/{id}/recommendations")
    @Transactional
    public ResponseEntity<?> addRecommendation(@PathVariable("id") Long id,
                                               @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
                                               @RequestBody(required = false) Map<String, Object> body) {
        logger.debug("POST /api/technicians/{}/recommendations called", id);
        Optional<TechnicianProfile> profileOpt = technicianProfileRepository.findById(id);
        if (profileOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        String recommenderName = body != null && body.get("recommenderName") != null ? body.get("recommenderName").toString().trim() : "";
        String comment = body != null && body.get("comment") != null ? body.get("comment").toString() : "";

        Integer rating = null;
        if (body != null && body.get("rating") != null) {
            try {
                rating = Integer.valueOf(body.get("rating").toString());
            } catch (NumberFormatException e) {
                return ResponseEntity.badRequest().body(Map.of("message", "La note doit être un nombre entier entre 1 et 5."));
            }
            if (rating < 1 || rating > 5) {
                return ResponseEntity.badRequest().body(Map.of("message", "La note doit être comprise entre 1 et 5."));
            }
        }
        Optional<User> authenticatedUser = AuthController.authenticateToken(authorizationHeader, userRepository);
        if (authenticatedUser.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("message", "Authentification requise pour noter un technicien."));
        }
        Long recommenderUserId = authenticatedUser.get().getId();
        if (rating != null) {
            // La notation est réservée aux clients authentifiés ayant terminé une intervention avec ce technicien.
            Long clientProfileId = clientProfileRepository.findByUserId(authenticatedUser.get().getId())
                    .map(ClientProfile::getId)
                    .orElse(null);
            if (clientProfileId == null
                    || !clientRequestRepository.existsByClientIdAndTechnicianIdAndStatus(clientProfileId, id, COMPLETED_REQUEST_STATUS)) {
                return ResponseEntity.status(403).body(Map.of("message",
                        "La notation est réservée aux clients ayant terminé une intervention avec ce technicien."));
            }
        }

        if (recommenderName.isBlank() && recommenderUserId == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "Le nom du recommandant est requis."));
        }

        TechnicianRecommendation rec = new TechnicianRecommendation();
        rec.setTechnician(profileOpt.get());
        rec.setRecommenderName(recommenderName);
        rec.setRecommenderUserId(recommenderUserId);
        rec.setComment(comment);
        rec.setRating(rating);
        rec.setVerified(false);
        rec = technicianRecommendationRepository.save(rec);

        long count = technicianRecommendationRepository.countByTechnicianId(id);
        technicianEventService.broadcast("recommendation", Map.of("technicianId", id, "count", count));
        logger.info("Recommandation ajoutée pour le technicien id={}, total={}", id, count);

        syncStoredRating(profileOpt.get());

        if (profileOpt.get().getUser() != null) {
            notificationService.create(
                    profileOpt.get().getUser().getId(),
                    "Nouvel avis",
                    "Un client a laissé un avis sur votre profil"
                            + (rating != null ? " (note : " + rating + "/5)" : "")
                            + ".",
                    "review");
        }

        return ResponseEntity.ok(mapRecommendationToDto(rec));
    }

    /**
     * Recalcule rating_avg / rating_count stockés dans technicians à partir des
     * avis notés, pour que le tableau de bord et le profil du technicien
     * affichent la même moyenne que le catalogue.
     */
    private void syncStoredRating(TechnicianProfile profile) {
        List<TechnicianRecommendation> rated = technicianRecommendationRepository
                .findByTechnicianIdAndRatingNotNullOrderByCreatedAtDesc(profile.getId());
        int count = rated.size();
        double avg = 0.0;
        if (count > 0) {
            avg = rated.stream()
                    .mapToInt(r -> r.getRating() == null ? 0 : r.getRating())
                    .average()
                    .orElse(0.0);
            avg = Math.round(avg * 10.0) / 10.0;
        }
        profile.setRatingCount(count);
        profile.setRatingAvg(avg);
        technicianProfileRepository.save(profile);
    }

    private Map<String, Object> mapRecommendationToDto(TechnicianRecommendation rec) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("id", rec.getId());
        data.put("recommenderName", rec.getRecommenderName());

        data.put("comment", rec.getComment());
        data.put("rating", rec.getRating());
        data.put("verified", rec.isVerified());
        data.put("createdAt", rec.getCreatedAt());
        return data;
    }

    @GetMapping("/stream")
    public SseEmitter streamTechnicians() {
        if (this.technicianEventService == null) {
            return new SseEmitter(0L);
        }
        return this.technicianEventService.createEmitter();
    }

    private String normalizeDomain(String value) {
        if (value == null) {
            return "";
        }

        String normalized = Normalizer.normalize(value.trim(), Normalizer.Form.NFD);
        normalized = normalized.replaceAll("\\p{M}", "");
        return normalized.toLowerCase();
    }
}
