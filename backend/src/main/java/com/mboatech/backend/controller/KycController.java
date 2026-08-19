package com.mboatech.backend.controller;

import com.mboatech.backend.model.KycDocument;
import com.mboatech.backend.model.Role;
import com.mboatech.backend.model.User;
import com.mboatech.backend.repository.KycDocumentRepository;
import com.mboatech.backend.repository.UserRepository;
import com.mboatech.backend.service.NotificationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.MediaTypeFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@RestController
@RequestMapping("/api/kyc")
public class KycController {

    private static final Logger logger = LoggerFactory.getLogger(KycController.class);

    private final KycDocumentRepository kycDocumentRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;

    @Value("${private-upload.dir:./private-uploads}")
    private String privateUploadDir;

    public KycController(KycDocumentRepository kycDocumentRepository,
                         UserRepository userRepository,
                         NotificationService notificationService) {
        this.kycDocumentRepository = kycDocumentRepository;
        this.userRepository = userRepository;
        this.notificationService = notificationService;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<?> listDocuments(@RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        Optional<User> optionalUser = AuthController.authenticateToken(authorizationHeader, userRepository);
        if (optionalUser.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("message", "Utilisateur non authentifié."));
        }
        List<Map<String, Object>> result = kycDocumentRepository
                .findByUserIdOrderByCreatedAtDesc(optionalUser.get().getId())
                .stream()
                .map(this::mapToDto)
                .toList();
        return ResponseEntity.ok(result);
    }

    @PostMapping
    @Transactional
    public ResponseEntity<?> uploadDocument(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
            @RequestParam(value = "docType", required = false) String docType,
            @RequestParam(value = "file", required = false) MultipartFile file) {
        Optional<User> optionalUser = AuthController.authenticateToken(authorizationHeader, userRepository);
        if (optionalUser.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("message", "Utilisateur non authentifié."));
        }
        if (docType == null || docType.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Le type de document est requis."));
        }
        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Fichier manquant."));
        }
        User user = optionalUser.get();

        KycDocument document = new KycDocument();
        document.setUserId(user.getId());
        document.setDocType(docType.trim());
        String fileUrl = saveFile(file, user.getId(), docType.trim());
        if (fileUrl == null) {
            return ResponseEntity.status(500).body(Map.of("message", "Impossible d'enregistrer le fichier."));
        }
        document.setFileUrl(fileUrl);
        kycDocumentRepository.save(document);
        logger.info("Document KYC enregistré: userId={} docType={}", user.getId(), document.getDocType());

        notifyAdmins("Document KYC à vérifier",
                "Un nouveau document KYC (" + document.getDocType() + ") a été téléversé et attend votre validation.");

        return ResponseEntity.ok(mapToDto(document));
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<?> deleteDocument(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
            @PathVariable("id") Long id) {
        Optional<User> optionalUser = AuthController.authenticateToken(authorizationHeader, userRepository);
        if (optionalUser.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("message", "Utilisateur non authentifié."));
        }
        Optional<KycDocument> documentOpt = kycDocumentRepository.findById(id);
        if (documentOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        if (!documentOpt.get().getUserId().equals(optionalUser.get().getId())) {
            return ResponseEntity.status(403).body(Map.of("message", "Vous ne pouvez supprimer que vos propres documents."));
        }
        kycDocumentRepository.delete(documentOpt.get());
        return ResponseEntity.ok(Map.of("ok", true));
    }

    @GetMapping("/file/{filename:.+}")
    public ResponseEntity<?> getFile(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
            @RequestParam(value = "token", required = false) String token,
            @PathVariable("filename") String filename) {
        String combined = (authorizationHeader != null && !authorizationHeader.isBlank())
                ? authorizationHeader
                : (token != null && !token.isBlank() ? "Bearer " + token : null);
        Optional<User> optionalUser = AuthController.authenticateToken(combined, userRepository);
        if (optionalUser.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("message", "Utilisateur non authentifié."));
        }
        Optional<KycDocument> documentOpt = kycDocumentRepository.findByFileUrl("/api/kyc/file/" + filename);
        if (documentOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        User user = optionalUser.get();
        boolean isOwner = documentOpt.get().getUserId().equals(user.getId());
        boolean isAdmin = user.getRole() == Role.admin;
        if (!isOwner && !isAdmin) {
            return ResponseEntity.status(403).body(Map.of("message", "Accès refusé à ce document."));
        }

        Path base = Path.of(privateUploadDir, "kyc").toAbsolutePath().normalize();
        Path file = base.resolve(filename).normalize();
        if (!file.startsWith(base)) {
            return ResponseEntity.badRequest().body(Map.of("message", "Chemin invalide."));
        }
        if (!Files.exists(file) || !Files.isRegularFile(file)) {
            return ResponseEntity.notFound().build();
        }
        try {
            byte[] data = Files.readAllBytes(file);
            MediaType mediaType = MediaTypeFactory.getMediaType(filename).orElse(MediaType.APPLICATION_OCTET_STREAM);
            return ResponseEntity.ok()
                    .contentType(mediaType)
                    .contentLength(data.length)
                    .header("Content-Disposition", "inline")
                    .body(data);
        } catch (IOException e) {
            logger.error("Erreur lors de la lecture du document KYC {}", filename, e);
            return ResponseEntity.status(500).body(Map.of("message", "Impossible de lire le fichier."));
        }
    }

    private void notifyAdmins(String title, String text) {
        for (User admin : userRepository.findByRole(Role.admin)) {
            notificationService.create(admin.getId(), title, text, "system", null);
        }
    }

    private Map<String, Object> mapToDto(KycDocument document) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("id", document.getId());
        data.put("docType", document.getDocType());
        data.put("fileUrl", document.getFileUrl());
        data.put("status", document.getStatus());
        data.put("createdAt", document.getCreatedAt() != null ? document.getCreatedAt().getTime() : null);
        return data;
    }

    private static final Set<String> ALLOWED_KYC_EXTENSIONS = Set.of(".jpg", ".jpeg", ".png", ".gif", ".pdf");
    private static final long MAX_KYC_SIZE = 10L * 1024 * 1024;

    private String saveFile(MultipartFile file, Long userId, String docType) {
        if (file.getSize() > MAX_KYC_SIZE) {
            logger.warn("Document KYC refusé: taille {} dépasse 10 Mo", file.getSize());
            return null;
        }
        try {
            File dir = new File(privateUploadDir, "kyc");
            if (!dir.exists() && !dir.mkdirs()) {
                logger.warn("Impossible de créer le répertoire d'upload: {}", dir.getAbsolutePath());
                return null;
            }
            String original = file.getOriginalFilename() == null ? "document.pdf" : file.getOriginalFilename();
            String extension = "";
            int dot = original.lastIndexOf('.');
            if (dot >= 0 && dot < original.length() - 1) {
                extension = original.substring(dot).toLowerCase(Locale.ROOT);
            }
            if (!ALLOWED_KYC_EXTENSIONS.contains(extension)) {
                logger.warn("Document KYC refusé: extension '{}' non autorisée", extension);
                return null;
            }
            String safeType = docType.replaceAll("[^a-zA-Z0-9_-]", "");
            String filename = "kyc-" + userId + "-" + safeType + "-" + UUID.randomUUID() + extension;
            Path target = Path.of(dir.getAbsolutePath(), filename).normalize();
            Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);
            logger.info("Document KYC enregistré: {}", target.getFileName());
            return "/api/kyc/file/" + filename;
        } catch (IOException e) {
            logger.error("Erreur lors de l'enregistrement du document KYC", e);
            return null;
        }
    }
}
