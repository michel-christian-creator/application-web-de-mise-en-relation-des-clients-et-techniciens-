package com.mboatech.backend.controller;

import com.mboatech.backend.model.KycDocument;
import com.mboatech.backend.model.Role;
import com.mboatech.backend.model.TechnicianProfile;
import com.mboatech.backend.model.User;
import com.mboatech.backend.repository.KycDocumentRepository;
import com.mboatech.backend.repository.TechnicianProfileRepository;
import com.mboatech.backend.repository.UserRepository;
import com.mboatech.backend.service.NotificationService;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * Revue des documents KYC par les administrateurs.
 *
 * <p>Les techniciens déposent leurs pièces (CNI recto/verso, certificat métier,
 * lettres de recommandation) via {@code POST /api/kyc}. Ce contrôleur permet à
 * l'administration de les valider ou de les rejeter, et bascule automatiquement le
 * profil du technicien en {@code verified} quand la pièce d'identité et le
 * certificat métier sont tous validés.</p>
 */
@RestController
@RequestMapping("/api/admin/kyc")
public class AdminKycController {

    private static final Set<String> REQUIRED_VALIDATED = Set.of("id_recto", "id_verso", "certificate");

    private final KycDocumentRepository kycDocumentRepository;
    private final UserRepository userRepository;
    private final TechnicianProfileRepository technicianProfileRepository;
    private final NotificationService notificationService;

    public AdminKycController(KycDocumentRepository kycDocumentRepository,
                              UserRepository userRepository,
                              TechnicianProfileRepository technicianProfileRepository,
                              NotificationService notificationService) {
        this.kycDocumentRepository = kycDocumentRepository;
        this.userRepository = userRepository;
        this.technicianProfileRepository = technicianProfileRepository;
        this.notificationService = notificationService;
    }

    private Optional<User> authenticateAdmin(String authorizationHeader) {
        Optional<User> user = AuthController.authenticateToken(authorizationHeader, null, userRepository);
        if (user.isEmpty() || user.get().getRole() != Role.admin) {
            return Optional.empty();
        }
        return user;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<?> listDocuments(@RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        if (authenticateAdmin(authorizationHeader).isEmpty()) {
            return ResponseEntity.status(403).body(Map.of("message", "Espace réservé aux administrateurs."));
        }
        List<Map<String, Object>> documents = new ArrayList<>();
        kycDocumentRepository.findAllByOrderByCreatedAtDesc().forEach(document -> {
            Map<String, Object> item = toDto(document);
            userRepository.findById(document.getUserId()).ifPresent(user -> {
                item.put("userName", fullName(user));
                item.put("username", user.getUsername());
            });
            technicianProfileRepository.findByUserId(document.getUserId()).ifPresent(profile -> {
                item.put("technicianId", profile.getId());
                item.put("verified", profile.isVerified());
            });
            documents.add(item);
        });
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("documents", documents);
        body.put("count", documents.size());
        return ResponseEntity.ok(body);
    }

    @PostMapping("/{id}/approve")
    @Transactional
    public ResponseEntity<?> approve(@RequestHeader(value = "Authorization", required = false) String authorizationHeader,
                                     @PathVariable("id") Long id) {
        return review(authorizationHeader, id, "validated");
    }

    @PostMapping("/{id}/reject")
    @Transactional
    public ResponseEntity<?> reject(@RequestHeader(value = "Authorization", required = false) String authorizationHeader,
                                    @PathVariable("id") Long id) {
        return review(authorizationHeader, id, "rejected");
    }

    private ResponseEntity<?> review(String authorizationHeader, Long id, String newStatus) {
        if (authenticateAdmin(authorizationHeader).isEmpty()) {
            return ResponseEntity.status(403).body(Map.of("message", "Espace réservé aux administrateurs."));
        }
        Optional<KycDocument> documentOpt = kycDocumentRepository.findById(id);
        if (documentOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        KycDocument document = documentOpt.get();
        if ("validated".equals(document.getStatus()) && "validated".equals(newStatus)) {
            return ResponseEntity.ok(toDto(document));
        }
        document.setStatus(newStatus);
        kycDocumentRepository.save(document);

        Long userId = document.getUserId();
        boolean nowVerified = recomputeVerified(userId);
        notifyUser(userId, newStatus, document);

        Map<String, Object> dto = toDto(document);
        dto.put("verified", nowVerified);
        return ResponseEntity.ok(dto);
    }

    /**
     * Marque le profil technicien comme vérifié quand tous les documents requis
     * (identité recto/verso + certificat métier) sont validés, et le dé-vérifie
     * si l'un d'eux est rejeté ou supprimé.
     */
    private boolean recomputeVerified(Long userId) {
        Optional<TechnicianProfile> profileOpt = technicianProfileRepository.findByUserId(userId);
        if (profileOpt.isEmpty()) {
            return false;
        }
        List<String> validatedTypes = kycDocumentRepository.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .filter(document -> "validated".equals(document.getStatus()))
                .map(KycDocument::getDocType)
                .toList();
        boolean allValidated = REQUIRED_VALIDATED.stream().allMatch(validatedTypes::contains);
        TechnicianProfile profile = profileOpt.get();
        if (allValidated && !profile.isVerified()) {
            profile.setVerified(true);
            technicianProfileRepository.save(profile);
            notificationService.create(userId, "Profil vérifié",
                    "Félicitations, votre identité a été vérifiée. Votre profil est désormais marqué « vérifié ».",
                    "review");
        } else if (!allValidated && profile.isVerified()) {
            profile.setVerified(false);
            technicianProfileRepository.save(profile);
        }
        return allValidated;
    }

    private void notifyUser(Long userId, String newStatus, KycDocument document) {
        String docLabel = docTypeLabel(document.getDocType());
        if ("validated".equals(newStatus)) {
            notificationService.create(userId, "Document validé",
                    "Votre document « " + docLabel + " » a été approuvé par l'administration.",
                    "review");
        } else if ("rejected".equals(newStatus)) {
            notificationService.create(userId, "Document rejeté",
                    "Votre document « " + docLabel + " » a été rejeté. Merci de fournir une pièce valide.",
                    "review");
        }
    }

    private Map<String, Object> toDto(KycDocument document) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("id", document.getId());
        data.put("userId", document.getUserId());
        data.put("docType", document.getDocType());
        data.put("fileUrl", document.getFileUrl());
        data.put("status", document.getStatus());
        data.put("createdAt", document.getCreatedAt() != null ? document.getCreatedAt().getTime() : null);
        return data;
    }

    private String docTypeLabel(String docType) {
        switch (docType == null ? "" : docType) {
            case "id_recto":
                return "Pièce d'identité — recto";
            case "id_verso":
                return "Pièce d'identité — verso";
            case "certificate":
                return "Certificat métier";
            case "recommendation_letter":
                return "Lettre de recommandation";
            default:
                return docType == null ? "Document" : docType;
        }
    }

    private String fullName(User user) {
        String first = user.getFirstName() != null ? user.getFirstName() : "";
        String last = user.getLastName() != null ? user.getLastName() : "";
        return (first + " " + last).trim();
    }
}
