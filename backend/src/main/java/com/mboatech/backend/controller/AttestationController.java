package com.mboatech.backend.controller;

import com.mboatech.backend.model.AttestationLevel;
import com.mboatech.backend.model.Role;
import com.mboatech.backend.model.TechnicianProfile;
import com.mboatech.backend.model.User;
import com.mboatech.backend.repository.TechnicianProfileRepository;
import com.mboatech.backend.repository.UserRepository;
import com.mboatech.backend.service.AttestationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/attestation")
public class AttestationController {

    private static final Logger logger = LoggerFactory.getLogger(AttestationController.class);

    private final AttestationService attestationService;
    private final UserRepository userRepository;
    private final TechnicianProfileRepository technicianProfileRepository;

    public AttestationController(AttestationService attestationService,
                                 UserRepository userRepository,
                                 TechnicianProfileRepository technicianProfileRepository) {
        this.attestationService = attestationService;
        this.userRepository = userRepository;
        this.technicianProfileRepository = technicianProfileRepository;
    }

    @GetMapping("/check")
    public ResponseEntity<?> checkEligibility(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        Optional<User> optionalUser = AuthController.authenticateToken(authorizationHeader, userRepository);
        if (optionalUser.isEmpty() || optionalUser.get().getRole() != Role.technician) {
            return ResponseEntity.status(401).body(Map.of("message", "Accès réservé aux techniciens."));
        }

        Optional<TechnicianProfile> optionalProfile = technicianProfileRepository.findByUser(optionalUser.get());
        if (optionalProfile.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("message", "Profil technicien introuvable."));
        }

        try {
            Map<String, Object> eligibility = attestationService.checkEligibility(optionalProfile.get().getId());
            return ResponseEntity.ok(eligibility);
        } catch (Exception e) {
            logger.error("Erreur vérification éligibilité attestation", e);
            return ResponseEntity.internalServerError().body(Map.of("message", "Erreur lors de la vérification."));
        }
    }

    @PostMapping("/generate")
    public ResponseEntity<?> generate(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
            @RequestParam(value = "level", required = false) String levelParam) {
        Optional<User> optionalUser = AuthController.authenticateToken(authorizationHeader, userRepository);
        if (optionalUser.isEmpty() || optionalUser.get().getRole() != Role.technician) {
            return ResponseEntity.status(401).body(Map.of("message", "Accès réservé aux techniciens."));
        }

        Optional<TechnicianProfile> optionalProfile = technicianProfileRepository.findByUser(optionalUser.get());
        if (optionalProfile.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("message", "Profil technicien introuvable."));
        }

        try {
            byte[] pdfBytes;
            String filename;
            if (levelParam != null && !levelParam.isBlank()) {
                AttestationLevel target;
                try {
                    target = AttestationLevel.valueOf(levelParam.trim().toUpperCase());
                } catch (IllegalArgumentException e) {
                    return ResponseEntity.badRequest().body(Map.of("message", "Niveau inconnu : " + levelParam));
                }
                pdfBytes = attestationService.generateForLevel(optionalProfile.get().getId(), target);
                filename = "attestation-mboatech-" + target.name().toLowerCase() + ".pdf";
            } else {
                pdfBytes = attestationService.generate(optionalProfile.get().getId());
                filename = "attestation-mboatech.pdf";
            }

            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=" + filename)
                    .contentType(MediaType.APPLICATION_PDF)
                    .contentLength(pdfBytes.length)
                    .body(pdfBytes);
        } catch (RuntimeException e) {
            logger.warn("Génération attestation refusée: {}", e.getMessage());
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        } catch (Exception e) {
            logger.error("Erreur génération attestation", e);
            return ResponseEntity.internalServerError().body(Map.of("message", "Erreur lors de la génération."));
        }
    }

    /**
     * Consultation publique d'une attestation : les clients peuvent voir le
     * certificat d'un technicien depuis son profil, mais uniquement en
     * affichage intégré (iframe du profil). L'ouverture directe de l'URL ou
     * tout autre accès (téléchargement via curl/navigateur) est refusé :
     * le document se consulte, il ne se télécharge pas.
     */
    @GetMapping("/{attestationId}/download")
    public ResponseEntity<?> downloadPublic(
            @PathVariable("attestationId") Long attestationId,
            jakarta.servlet.http.HttpServletRequest request) {
        String fetchDest = request.getHeader("Sec-Fetch-Dest");
        if (fetchDest == null || fetchDest.isBlank()
                || "document".equalsIgnoreCase(fetchDest)
                || "empty".equalsIgnoreCase(fetchDest)) {
            logger.warn("Consultation attestation {} refusée (Sec-Fetch-Dest={})",
                    attestationId, fetchDest);
            return ResponseEntity.status(403)
                    .body(Map.of("message", "Consultation autorisée uniquement depuis le profil."));
        }
        try {
            byte[] pdfBytes = attestationService.renderById(attestationId);
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION,
                            "inline; filename=attestation-mboatech-" + attestationId + ".pdf")
                    .contentType(MediaType.APPLICATION_PDF)
                    .header(HttpHeaders.CACHE_CONTROL, "no-store")
                    .contentLength(pdfBytes.length)
                    .body(pdfBytes);
        } catch (RuntimeException e) {
            logger.warn("Attestation {} introuvable: {}", attestationId, e.getMessage());
            return ResponseEntity.status(404).body(Map.of("message", "Attestation introuvable."));
        } catch (Exception e) {
            logger.error("Erreur consultation attestation {}", attestationId, e);
            return ResponseEntity.internalServerError().body(Map.of("message", "Erreur lors de la consultation."));
        }
    }

    @GetMapping("/history")
    public ResponseEntity<?> history(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        Optional<User> optionalUser = AuthController.authenticateToken(authorizationHeader, userRepository);
        if (optionalUser.isEmpty() || optionalUser.get().getRole() != Role.technician) {
            return ResponseEntity.status(401).body(Map.of("message", "Accès réservé aux techniciens."));
        }

        Optional<TechnicianProfile> optionalProfile = technicianProfileRepository.findByUser(optionalUser.get());
        if (optionalProfile.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("message", "Profil technicien introuvable."));
        }

        try {
            return ResponseEntity.ok(attestationService.getHistory(optionalProfile.get().getId()));
        } catch (Exception e) {
            logger.error("Erreur chargement historique attestations", e);
            return ResponseEntity.internalServerError().body(Map.of("message", "Erreur lors du chargement."));
        }
    }
}
