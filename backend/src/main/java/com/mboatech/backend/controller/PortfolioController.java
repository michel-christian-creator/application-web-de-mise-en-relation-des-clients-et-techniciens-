package com.mboatech.backend.controller;

import com.mboatech.backend.model.PortfolioItem;
import com.mboatech.backend.model.TechnicianProfile;
import com.mboatech.backend.model.User;
import com.mboatech.backend.repository.PortfolioItemRepository;
import com.mboatech.backend.repository.TechnicianProfileRepository;
import com.mboatech.backend.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
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
import java.util.UUID;

@RestController
@RequestMapping("/api/technicians")
public class PortfolioController {

    private static final Logger logger = LoggerFactory.getLogger(PortfolioController.class);

    private final PortfolioItemRepository portfolioItemRepository;
    private final TechnicianProfileRepository technicianProfileRepository;
    private final UserRepository userRepository;

    @Value("${upload.dir:./uploads}")
    private String uploadDir;

    public PortfolioController(PortfolioItemRepository portfolioItemRepository,
                               TechnicianProfileRepository technicianProfileRepository,
                               UserRepository userRepository) {
        this.portfolioItemRepository = portfolioItemRepository;
        this.technicianProfileRepository = technicianProfileRepository;
        this.userRepository = userRepository;
    }

    @GetMapping("/{id}/portfolio")
    @Transactional(readOnly = true)
    public ResponseEntity<List<Map<String, Object>>> getPortfolio(@PathVariable("id") Long id) {
        List<Map<String, Object>> result = portfolioItemRepository
                .findByTechnicianIdOrderByCreatedAtDesc(id)
                .stream()
                .map(this::mapToDto)
                .toList();
        return ResponseEntity.ok(result);
    }

    @GetMapping("/portfolio/me")
    @Transactional(readOnly = true)
    public ResponseEntity<?> getMyPortfolio(@RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        Optional<User> optionalUser = AuthController.authenticateToken(authorizationHeader, null, userRepository);
        if (optionalUser.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("message", "Utilisateur non authentifié."));
        }
        User user = optionalUser.get();
        Optional<TechnicianProfile> profileOpt = technicianProfileRepository.findByUserId(user.getId());
        if (profileOpt.isEmpty()) {
            return ResponseEntity.ok(List.of());
        }
        List<Map<String, Object>> result = portfolioItemRepository
                .findByTechnicianIdOrderByCreatedAtDesc(profileOpt.get().getId())
                .stream()
                .map(this::mapToDto)
                .toList();
        return ResponseEntity.ok(result);
    }

    @PostMapping("/portfolio")
    @Transactional
    public ResponseEntity<?> addPortfolioItem(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
            @RequestParam(value = "before", required = false) MultipartFile before,
            @RequestParam(value = "after", required = false) MultipartFile after,
            @RequestParam(value = "label", required = false) String label) {
        Optional<User> optionalUser = AuthController.authenticateToken(authorizationHeader, null, userRepository);
        if (optionalUser.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("message", "Utilisateur non authentifié."));
        }
        User user = optionalUser.get();
        Optional<TechnicianProfile> profileOpt = technicianProfileRepository.findByUserId(user.getId());
        if (profileOpt.isEmpty()) {
            return ResponseEntity.status(403).body(Map.of("message", "Seul un technicien peut ajouter des réalisations."));
        }

        PortfolioItem item = new PortfolioItem();
        item.setTechnicianId(profileOpt.get().getId());
        item.setLabel(label != null ? label.trim() : "");

        String beforeUrl = before != null && !before.isEmpty() ? saveFile(before, "portfolio-before") : null;
        String afterUrl = after != null && !after.isEmpty() ? saveFile(after, "portfolio-after") : null;
        if (beforeUrl == null && afterUrl == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "Ajoutez au moins une photo (avant ou après)."));
        }
        item.setBeforeUrl(beforeUrl);
        item.setAfterUrl(afterUrl);
        portfolioItemRepository.save(item);
        logger.info("Réalisation ajoutée par le technicien userId={} itemId={}", user.getId(), item.getId());
        return ResponseEntity.ok(mapToDto(item));
    }

    @DeleteMapping("/portfolio/{itemId}")
    @Transactional
    public ResponseEntity<?> deletePortfolioItem(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
            @PathVariable("itemId") Long itemId) {
        Optional<User> optionalUser = AuthController.authenticateToken(authorizationHeader, null, userRepository);
        if (optionalUser.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("message", "Utilisateur non authentifié."));
        }
        User user = optionalUser.get();
        Optional<TechnicianProfile> profileOpt = technicianProfileRepository.findByUserId(user.getId());
        Optional<PortfolioItem> itemOpt = portfolioItemRepository.findById(itemId);
        if (itemOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        if (profileOpt.isEmpty() || !profileOpt.get().getId().equals(itemOpt.get().getTechnicianId())) {
            return ResponseEntity.status(403).body(Map.of("message", "Vous ne pouvez supprimer que vos propres réalisations."));
        }
        portfolioItemRepository.delete(itemOpt.get());
        return ResponseEntity.ok(Map.of("ok", true));
    }

    private Map<String, Object> mapToDto(PortfolioItem item) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("id", item.getId());
        data.put("label", item.getLabel());
        data.put("beforeUrl", item.getBeforeUrl());
        data.put("afterUrl", item.getAfterUrl());
        data.put("createdAt", item.getCreatedAt() != null ? item.getCreatedAt().getTime() : null);
        return data;
    }

    private String saveFile(MultipartFile file, String prefix) {
        try {
            File dir = new File(uploadDir);
            if (!dir.exists() && !dir.mkdirs()) {
                logger.warn("Impossible de créer le répertoire d'upload: {}", dir.getAbsolutePath());
                return null;
            }
            String original = file.getOriginalFilename() == null ? "photo.jpg" : file.getOriginalFilename();
            String extension = "";
            int dot = original.lastIndexOf('.');
            if (dot >= 0 && dot < original.length() - 1) {
                extension = original.substring(dot).toLowerCase(Locale.ROOT);
            }
            String filename = prefix + "-" + UUID.randomUUID() + extension;
            Path target = Path.of(dir.getAbsolutePath(), filename).normalize();
            Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);
            logger.info("Fichier portfolio enregistré: {}", target.getFileName());
            return "/uploads/" + filename;
        } catch (IOException e) {
            logger.error("Erreur lors de l'enregistrement du fichier portfolio", e);
            return null;
        }
    }
}
