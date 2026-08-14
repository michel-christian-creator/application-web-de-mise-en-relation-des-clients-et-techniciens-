package com.mboatech.backend.service;

import com.mboatech.backend.config.MissionsProperties;
import com.mboatech.backend.model.RequestDecline;
import com.mboatech.backend.model.TechnicianProfile;
import com.mboatech.backend.repository.RequestDeclineRepository;
import com.mboatech.backend.repository.TechnicianProfileRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.Objects;

/**
 * Logique métier des garde-fous anti-accaparement des demandes
 * (plafond de réservations, expiration, gel après déclins, score de fiabilité).
 */
@Service
public class MissionGuardService {

    private final MissionsProperties properties;
    private final RequestDeclineRepository requestDeclineRepository;
    private final TechnicianProfileRepository technicianProfileRepository;

    public MissionGuardService(MissionsProperties properties,
                               RequestDeclineRepository requestDeclineRepository,
                               TechnicianProfileRepository technicianProfileRepository) {
        this.properties = properties;
        this.requestDeclineRepository = requestDeclineRepository;
        this.technicianProfileRepository = technicianProfileRepository;
    }

    public static final String NO_SHOW_REASON = "no_show";
    private static final int NO_SHOW_WINDOW_DAYS = 30;

    public int getMaxConcurrent() {
        return properties.getMaxConcurrent();
    }

    public long getReservationHours() {
        return properties.getReservationHours();
    }

    /**
     * Durée de réservation selon le niveau d'urgence :
     * critique → le plus court, normal → le plus long.
     */
    public long getReservationHoursFor(String urgency) {
        if ("critique".equalsIgnoreCase(urgency)) {
            return properties.getReservationCritiqueHours();
        }
        if ("important".equalsIgnoreCase(urgency)) {
            return properties.getReservationImportantHours();
        }
        return properties.getReservationNormalHours();
    }

    public Map<String, Object> getReservationRules() {
        Map<String, Object> rules = new java.util.LinkedHashMap<>();
        rules.put("critique", properties.getReservationCritiqueHours());
        rules.put("important", properties.getReservationImportantHours());
        rules.put("normal", properties.getReservationNormalHours());
        return rules;
    }

    public int getMaxDeclines() {
        return properties.getMaxDeclines();
    }

    public long getDeclinesWindowHours() {
        return properties.getDeclinesWindowHours();
    }

    /**
     * Temps restant (secondes) pendant lequel ce technicien est gelé :
     * le nombre de déclins dans la fenêtre a atteint le seuil et le gel se
     * lève lorsque le déclin le plus ancien sort de la fenêtre.
     */
    public long freezeRemainingSec(TechnicianProfile profile) {
        LocalDateTime cutoff = LocalDateTime.now().minusHours(properties.getDeclinesWindowHours());
        long recent = requestDeclineRepository.countByTechnicianIdAndCreatedAtAfter(profile.getId(), cutoff);
        if (recent < properties.getMaxDeclines()) {
            return 0L;
        }
        LocalDateTime oldest = requestDeclineRepository.findByTechnicianId(profile.getId()).stream()
                .map(RequestDecline::getCreatedAt)
                .filter(Objects::nonNull)
                .filter(ts -> !ts.isBefore(cutoff))
                .sorted()
                .findFirst()
                .orElse(cutoff);
        long remaining = java.time.Duration
                .between(LocalDateTime.now(), oldest.plusHours(properties.getDeclinesWindowHours()))
                .getSeconds();
        return Math.max(0L, remaining);
    }

    public boolean isFrozen(TechnicianProfile profile) {
        return freezeRemainingSec(profile) > 0;
    }

    public String formatDuration(long seconds) {
        long hours = seconds / 3600;
        long minutes = (seconds % 3600) / 60;
        if (hours > 0) {
            return hours + " h " + minutes + " min";
        }
        return Math.max(1L, minutes) + " min";
    }

    /**
     * Enregistre un déclin pour masquer la demande à ce technicien
     * et le comptabiliser dans le gel anti-accaparement.
     */
    @Transactional
    public void recordDecline(Long requestId, Long technicianProfileId) {
        recordDecline(requestId, technicianProfileId, null);
    }

    /**
     * Enregistre une non-présentation : déclin marqué {@code no_show}
     * (masque la demande et alimente les sanctions de suspension).
     */
    @Transactional
    public void recordNoShow(Long requestId, Long technicianProfileId) {
        recordDecline(requestId, technicianProfileId, NO_SHOW_REASON);
    }

    @Transactional
    public void recordDecline(Long requestId, Long technicianProfileId, String reason) {
        if (technicianProfileId != null
                && !requestDeclineRepository.existsByRequestIdAndTechnicianId(requestId, technicianProfileId)) {
            RequestDecline decline = new RequestDecline();
            decline.setRequestId(requestId);
            decline.setTechnicianId(technicianProfileId);
            decline.setReason(reason);
            requestDeclineRepository.save(decline);
        }
    }

    /**
     * Nombre de non-présentations du technicien sur la fenêtre glissante
     * de 30 jours (utilisé pour déclencher les suspensions).
     */
    public long countNoShows(TechnicianProfile profile) {
        if (profile == null || profile.getId() == null) {
            return 0L;
        }
        return requestDeclineRepository.countByTechnicianIdAndReasonAndCreatedAtAfter(
                profile.getId(), NO_SHOW_REASON, LocalDateTime.now().minusDays(NO_SHOW_WINDOW_DAYS));
    }

    /**
     * Secondes restantes de suspension du technicien (Long.MAX_VALUE si définitive).
     */
    public long suspensionRemainingSec(TechnicianProfile profile) {
        if (profile == null) {
            return 0L;
        }
        if (profile.isSuspendedPermanent()) {
            return Long.MAX_VALUE;
        }
        LocalDateTime until = profile.getSuspendedUntil();
        if (until == null) {
            return 0L;
        }
        return Math.max(0L, java.time.Duration.between(LocalDateTime.now(), until).getSeconds());
    }

    public boolean isSuspended(TechnicianProfile profile) {
        return suspensionRemainingSec(profile) > 0;
    }

    /**
     * Recalcule le taux de réussite : proportion des demandes acceptées qui
     * n'ont pas été déclinées (accepté - décliné) / accepté, borné à [0;100].
     */
    @Transactional
    public void recomputeSuccessRate(TechnicianProfile profile) {
        int accepted = profile.getAcceptanceCount();
        int declined = profile.getDeclineCount();
        double rate = accepted <= 0 ? 0.0
                : Math.max(0.0, Math.min(100.0, (double) (accepted - declined) / accepted * 100.0));
        profile.setSuccessRate(Math.round(rate * 100.0) / 100.0);
        technicianProfileRepository.save(profile);
    }
}
