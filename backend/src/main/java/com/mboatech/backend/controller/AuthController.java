package com.mboatech.backend.controller;

import com.mboatech.backend.dto.LoginRequest;
import com.mboatech.backend.dto.RegistrationRequest;
import com.mboatech.backend.model.AdminProfile;
import com.mboatech.backend.model.AuthSession;
import com.mboatech.backend.model.AvailabilityStatus;
import com.mboatech.backend.model.ClientProfile;
import com.mboatech.backend.model.TechnicianProfile;
import com.mboatech.backend.model.TechnicianRecommendation;
import com.mboatech.backend.model.User;
import com.mboatech.backend.model.Role;
import com.mboatech.backend.repository.AdminProfileRepository;
import com.mboatech.backend.repository.AuthSessionRepository;
import com.mboatech.backend.repository.ClientProfileRepository;
import com.mboatech.backend.repository.TechnicianProfileRepository;
import com.mboatech.backend.repository.TechnicianRecommendationRepository;
import com.mboatech.backend.repository.UserRepository;
import com.mboatech.backend.service.TechnicianEventService;
import com.mboatech.backend.util.InputValidator;
import jakarta.transaction.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@RestController
@RequestMapping("/api")
public class AuthController {

    private static final Logger logger = LoggerFactory.getLogger(AuthController.class);

    private final UserRepository userRepository;
    private final ClientProfileRepository clientProfileRepository;
    private final TechnicianProfileRepository technicianProfileRepository;
    private final TechnicianRecommendationRepository technicianRecommendationRepository;
    private final AdminProfileRepository adminProfileRepository;
    private final TechnicianEventService technicianEventService;
    private final BCryptPasswordEncoder passwordEncoder;
    private static final Map<String, String> tokenStore = new ConcurrentHashMap<>();
    private static AuthSessionRepository authSessionRepository;

    @Value("${upload.dir:./uploads}")
    private String uploadDir;

    public AuthController(UserRepository userRepository,
                          ClientProfileRepository clientProfileRepository,
                          TechnicianProfileRepository technicianProfileRepository,
                          TechnicianRecommendationRepository technicianRecommendationRepository,
                          AdminProfileRepository adminProfileRepository,
                          TechnicianEventService technicianEventService,
                          AuthSessionRepository authSessionRepository) {
        this.userRepository = userRepository;
        this.clientProfileRepository = clientProfileRepository;
        this.technicianProfileRepository = technicianProfileRepository;
        this.technicianRecommendationRepository = technicianRecommendationRepository;
        this.adminProfileRepository = adminProfileRepository;
        this.technicianEventService = technicianEventService;
        AuthController.authSessionRepository = authSessionRepository;
        this.passwordEncoder = new BCryptPasswordEncoder();
    }

    @PostMapping("/auth/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request) {
        if (request == null || request.getEmail() == null || request.getPassword() == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "Email et mot de passe requis."));
        }

        Optional<User> optionalUser = userRepository.findByEmail(request.getEmail());
        if (optionalUser.isEmpty()) {
            logger.warn("Tentative de connexion avec un email inconnu: {}", request.getEmail());
            return ResponseEntity.status(401).body(Map.of("message", "Identifiants invalides."));
        }

        User user = optionalUser.get();
        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            logger.warn("Tentative de connexion avec mot de passe invalide pour l'utilisateur: {}", request.getEmail());
            return ResponseEntity.status(401).body(Map.of("message", "Identifiants invalides."));
        }

        if (user.getRole() == Role.technician) {
            Optional<TechnicianProfile> optionalTechnician = technicianProfileRepository.findByUser(user);
            if (optionalTechnician.isPresent() && optionalTechnician.get().isSuspendedPermanent()) {
                return ResponseEntity.status(403).body(Map.of("message",
                        "Ce compte technicien a été définitivement suspendu pour non-présentations répétées."));
            }
            if (optionalTechnician.isPresent()
                    && optionalTechnician.get().getAvailabilityStatus() == AvailabilityStatus.offline) {
                TechnicianProfile profile = optionalTechnician.get();
                profile.setAvailabilityStatus(AvailabilityStatus.available);
                technicianProfileRepository.save(profile);
                technicianEventService.broadcast("availability",
                        Map.of("technicianId", profile.getId(), "status", "available"));
            }
        }

        String token = generateToken(user);
        Map<String, Object> profile = buildProfileResponse(user);
        profile.put("message", "Connexion réussie.");
        profile.put("token", token);

        logger.info("Connexion réussie pour l'utilisateur: {}", user.getUsername());
        return ResponseEntity.ok(profile);
    }

    @PostMapping("/register")
    @Transactional
    public ResponseEntity<String> register(@RequestBody RegistrationRequest request) {
        logger.debug("Requête d'inscription reçue: username={}, email={}, role={}", request.getUsername(), request.getEmail(), request.getRole());

        if (request.getRole() == null) {
            logger.warn("Inscription échouée: rôle manquant");
            return ResponseEntity.badRequest().body("Le rôle est requis.");
        }

        if (userRepository.findByUsername(request.getUsername()).isPresent()) {
            logger.warn("Inscription échouée: nom d'utilisateur déjà utilisé: {}", request.getUsername());
            return ResponseEntity.badRequest().body("Nom d'utilisateur déjà utilisé.");
        }
        if (userRepository.findByEmail(request.getEmail()).isPresent()) {
            logger.warn("Inscription échouée: email déjà utilisé: {}", request.getEmail());
            return ResponseEntity.badRequest().body("Email déjà utilisé.");
        }

        if (request.getRole() == Role.admin) {
            return ResponseEntity.badRequest().body("La création d'un compte administrateur se fait uniquement par connexion avec le compte prédéfini.");
        }

        if (!InputValidator.isValidUsername(request.getUsername())) {
            return ResponseEntity.badRequest().body("Nom d'utilisateur invalide : 3 à 30 caractères (lettres, chiffres, point, tiret, underscore).");
        }
        if (request.getPassword() == null || request.getPassword().isBlank()
                || request.getPassword().length() < 6) {
            return ResponseEntity.badRequest().body("Le mot de passe doit contenir au moins 6 caractères.");
        }
        if (request.getFirstName() != null && !request.getFirstName().isBlank()
                && !InputValidator.isValidName(request.getFirstName())) {
            return ResponseEntity.badRequest().body("Le prénom ne doit contenir que des lettres.");
        }
        if (request.getLastName() != null && !request.getLastName().isBlank()
                && !InputValidator.isValidName(request.getLastName())) {
            return ResponseEntity.badRequest().body("Le nom ne doit contenir que des lettres.");
        }
        if (request.getRole() == Role.technician) {
            if (request.getHourlyRate() != null && (request.getHourlyRate().isNaN()
                    || request.getHourlyRate().isInfinite() || request.getHourlyRate() < 0
                    || request.getHourlyRate() > 100_000_000)) {
                return ResponseEntity.badRequest().body("Le tarif horaire doit être compris entre 0 et 100 000 000 FCFA.");
            }
            if (request.getExperienceYears() != null
                    && (request.getExperienceYears() < 0 || request.getExperienceYears() > 200)) {
                return ResponseEntity.badRequest().body("L'expérience doit être comprise entre 0 et 200 ans.");
            }
        }

        String firstName = request.getFirstName() == null ? "" : request.getFirstName().trim();
        String lastName = request.getLastName() == null ? "" : request.getLastName().trim();

        if (firstName.isBlank()) {
            firstName = request.getUsername();
        }
        if (lastName.isBlank()) {
            lastName = request.getRole() == Role.technician ? "Technicien" : "Client";
        }

        User user = new User();
        user.setUsername(request.getUsername());
        user.setEmail(request.getEmail());
        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        user.setFirstName(firstName);
        user.setLastName(lastName);
        user.setRole(request.getRole());
        user = userRepository.save(user);
        logger.debug("Utilisateur créé: id={}, username={} ", user.getId(), user.getUsername());

        switch (request.getRole()) {
            case client -> createClientProfile(user, request);
            case technician -> createTechnicianProfile(user, request);
            case admin -> createAdminProfile(user);
        }

        logger.info("Inscription réussie pour username={} role={}", user.getUsername(), user.getRole());
        return ResponseEntity.ok("Inscription réussie.");
    }

    @GetMapping("/profile")
    public ResponseEntity<?> getProfile(@RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        Optional<User> optionalUser = authenticateUser(authorizationHeader);
        if (optionalUser.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("message", "Utilisateur non authentifié."));
        }
        User user = optionalUser.get();
        return ResponseEntity.ok(buildProfileResponse(user));
    }

    @GetMapping("/profile/me")
    public ResponseEntity<?> getProfileMe(@RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        Optional<User> optionalUser = authenticateUser(authorizationHeader);
        if (optionalUser.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("message", "Utilisateur non authentifié."));
        }
        User user = optionalUser.get();
        return ResponseEntity.ok(buildProfileResponse(user));
    }

    @PutMapping(value = "/profile", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Transactional
    public ResponseEntity<?> updateProfile(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
            @RequestParam(value = "firstName", required = false) String firstName,
            @RequestParam(value = "lastName", required = false) String lastName,
            @RequestParam(value = "role", required = false) String role,
            @RequestParam(value = "domain", required = false) String domain,
            @RequestParam(value = "city", required = false) String city,
            @RequestParam(value = "location", required = false) String location,
            @RequestParam(value = "phone", required = false) String phone,
            @RequestParam(value = "specialties", required = false) String specialties,
            @RequestParam(value = "bio", required = false) String bio,
            @RequestParam(value = "hourlyRate", required = false) Double hourlyRate,
            @RequestParam(value = "experienceYears", required = false) Integer experienceYears,
            @RequestParam(value = "photoUrl", required = false) String photoUrl,
            @RequestParam(value = "photo", required = false) MultipartFile photo
    ) {
        Optional<User> optionalUser = authenticateUser(authorizationHeader);
        if (optionalUser.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("message", "Utilisateur non authentifié."));
        }
        User user = optionalUser.get();

        if (firstName != null && !firstName.isBlank()) {
            String cleaned = InputValidator.sanitizeText(firstName, InputValidator.MAX_NAME_LENGTH);
            if (!InputValidator.isValidName(cleaned)) {
                return ResponseEntity.badRequest().body(Map.of("message", "Le prénom ne doit contenir que des lettres."));
            }
            user.setFirstName(cleaned);
        }
        if (lastName != null && !lastName.isBlank()) {
            String cleaned = InputValidator.sanitizeText(lastName, InputValidator.MAX_NAME_LENGTH);
            if (!InputValidator.isValidName(cleaned)) {
                return ResponseEntity.badRequest().body(Map.of("message", "Le nom ne doit contenir que des lettres."));
            }
            user.setLastName(cleaned);
        }
        if (phone != null && !phone.isBlank()) {
            if (!InputValidator.isValidPhone(phone)) {
                return ResponseEntity.badRequest().body(Map.of("message", "Numéro de téléphone invalide (8 à 15 chiffres)."));
            }
            user.setPhone(InputValidator.sanitizeText(phone, 20));
        }
        userRepository.save(user);

        String resolvedPhotoUrl = photoUrl;
        if (photo != null && !photo.isEmpty()) {
            resolvedPhotoUrl = savePhoto(photo, user.getId());
        }
        user.setPhotoUrl(resolvedPhotoUrl);
        userRepository.save(user);

        if (user.getRole() == Role.client) {
            ClientProfile profile = clientProfileRepository.findByUser(user).orElseGet(ClientProfile::new);
            profile.setUser(user);
            profile.setCity(city != null && !city.isBlank() ? InputValidator.sanitizeText(city, InputValidator.MAX_TEXT_LENGTH) : null);
            profile.setLocation(location != null && !location.isBlank() ? InputValidator.sanitizeText(location, InputValidator.MAX_TEXT_LENGTH) : null);
            clientProfileRepository.save(profile);
        } else if (user.getRole() == Role.technician) {
            TechnicianProfile profile = technicianProfileRepository.findByUser(user).orElseGet(TechnicianProfile::new);
            profile.setUser(user);
            profile.setDomain(domain != null && !domain.isBlank() ? InputValidator.sanitizeText(domain, InputValidator.MAX_TEXT_LENGTH) : null);
            profile.setCity(city != null && !city.isBlank() ? InputValidator.sanitizeText(city, InputValidator.MAX_TEXT_LENGTH) : null);
            profile.setLocation(location != null && !location.isBlank() ? InputValidator.sanitizeText(location, InputValidator.MAX_TEXT_LENGTH) : null);
            if (specialties != null && !specialties.isBlank()) {
                profile.setSpecialties(InputValidator.sanitizeText(specialties, InputValidator.MAX_TEXT_LENGTH));
            }
            if (bio != null && !bio.isBlank()) {
                profile.setBio(InputValidator.sanitizeMultiline(bio, InputValidator.MAX_MULTILINE_LENGTH));
            }
            if (hourlyRate != null) {
                if (hourlyRate.isNaN() || hourlyRate.isInfinite() || hourlyRate < 0 || hourlyRate > 100_000_000) {
                    return ResponseEntity.badRequest().body(Map.of("message", "Le tarif horaire doit être compris entre 0 et 100 000 000 FCFA."));
                }
                profile.setHourlyRate(hourlyRate);
            }
            if (experienceYears != null) {
                if (experienceYears < 0 || experienceYears > 200) {
                    return ResponseEntity.badRequest().body(Map.of("message", "L'expérience doit être comprise entre 0 et 200 ans."));
                }
                profile.setExperienceYears(experienceYears);
            }
            technicianProfileRepository.save(profile);
        }

        return ResponseEntity.ok(buildProfileResponse(user));
    }

    private String savePhoto(MultipartFile photo, Long userId) {
        try {
            File dir = new File(uploadDir);
            if (!dir.exists() && !dir.mkdirs()) {
                logger.warn("Impossible de créer le répertoire d'upload: {}", dir.getAbsolutePath());
                return null;
            }
            String original = photo.getOriginalFilename() == null ? "photo.jpg" : photo.getOriginalFilename();
            String extension = "";
            int dot = original.lastIndexOf('.');
            if (dot >= 0 && dot < original.length() - 1) {
                extension = original.substring(dot).toLowerCase(Locale.ROOT);
            }
            String filename = "user-" + userId + "-" + UUID.randomUUID() + extension;
            Path target = Path.of(dir.getAbsolutePath(), filename).normalize();
            Files.copy(photo.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);
            logger.info("Photo de profil enregistrée: {}", target.getFileName());
            return "/uploads/" + filename;
        } catch (IOException e) {
            logger.error("Erreur lors de l'enregistrement de la photo de profil", e);
            return null;
        }
    }

    private void createClientProfile(User user, RegistrationRequest request) {
        ClientProfile profile = new ClientProfile();
        profile.setUser(user);
        profile.setCity(request.getCity());
        profile.setLocation(request.getLocation());
        clientProfileRepository.save(profile);
    }

    private void createTechnicianProfile(User user, RegistrationRequest request) {
        TechnicianProfile profile = new TechnicianProfile();
        profile.setUser(user);
        profile.setDomain(request.getDomain());
        profile.setCity(request.getCity());
        profile.setLocation(request.getLocation());
        profile.setBio(request.getBio());
        profile.setSpecialties(request.getSpecialties());
        profile.setHourlyRate(request.getHourlyRate());
        profile.setExperienceYears(request.getExperienceYears());
        technicianProfileRepository.save(profile);
    }

    private void createAdminProfile(User user) {
        AdminProfile profile = new AdminProfile();
        profile.setUser(user);
        adminProfileRepository.save(profile);
    }

    /**
     * Moyenne des notes calculée en direct depuis les avis, identique au
     * catalogue, pour que le profil affiche la même note que le catalogue.
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

    private Map<String, Object> buildProfileResponse(User user) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("userId", user.getId());
        data.put("username", user.getUsername());
        data.put("email", user.getEmail());
        data.put("firstName", user.getFirstName());
        data.put("lastName", user.getLastName());
        data.put("role", user.getRole().name());
        data.put("domain", "");
        data.put("city", "");
        data.put("location", "");
        data.put("photoUrl", user.getPhotoUrl());
        data.put("phone", user.getPhone() != null ? user.getPhone() : "");

        if (user.getRole() == Role.client) {
            clientProfileRepository.findByUser(user).ifPresent(profile -> {
                data.put("city", profile.getCity() != null ? profile.getCity() : "");
                data.put("location", profile.getLocation() != null ? profile.getLocation() : "");
            });
        } else if (user.getRole() == Role.technician) {
            technicianProfileRepository.findByUser(user).ifPresent(profile -> {
                data.put("technicianId", profile.getId());
                data.put("domain", profile.getDomain() != null ? profile.getDomain() : "");
                data.put("city", profile.getCity() != null ? profile.getCity() : "");
                data.put("location", profile.getLocation() != null ? profile.getLocation() : "");
                data.put("specialties", profile.getSpecialties() != null ? profile.getSpecialties() : "");
                data.put("bio", profile.getBio() != null ? profile.getBio() : "");
                data.put("verified", profile.isVerified());
                data.put("ratingAvg", liveRatingAvg(profile));
                data.put("ratingCount", liveRatingCount(profile));
                data.put("hourlyRate", profile.getHourlyRate() != null ? profile.getHourlyRate() : 0.0);
                data.put("experienceYears", profile.getExperienceYears() != null ? profile.getExperienceYears() : 0);
                data.put("successRate", profile.getSuccessRate() != null ? profile.getSuccessRate() : 0.0);
                data.put("avgResponseTimeSec", profile.getAvgResponseTimeSec() != null ? profile.getAvgResponseTimeSec() : 0);
            });
        } else if (user.getRole() == Role.admin) {
            data.put("city", user.getCity() != null ? user.getCity() : "");
            data.put("location", user.getLocation() != null ? user.getLocation() : "");
        }

        return data;
    }

    public static Optional<User> authenticateToken(String authorizationHeader, UserRepository userRepository) {
        if (authorizationHeader != null && !authorizationHeader.isBlank()) {
            String token = authorizationHeader.startsWith("Bearer ") ? authorizationHeader.substring(7) : authorizationHeader;
            if (!token.isBlank()) {
                String storedUsername = lookupStoredUsername(token);
                if (storedUsername != null && !storedUsername.isBlank()) {
                    return userRepository.findByUsername(storedUsername);
                }
            }
        }
        return Optional.empty();
    }

    private static String lookupStoredUsername(String token) {
        if (authSessionRepository != null) {
            try {
                Optional<AuthSession> session = authSessionRepository.findByToken(token);
                if (session.isPresent()) {
                    AuthSession stored = session.get();
                    if (stored.getExpiresAt() != null && stored.getExpiresAt().isBefore(LocalDateTime.now())) {
                        authSessionRepository.delete(stored);
                        return null;
                    }
                    return stored.getUsername();
                }
            } catch (Exception e) {
                logger.warn("Impossible de lire la session {}: {}", token, e.getMessage());
            }
        }
        return tokenStore.get(token);
    }

    private Optional<User> authenticateUser(String authorizationHeader) {
        return authenticateToken(authorizationHeader, userRepository);
    }

    private String generateToken(User user) {
        String token = UUID.randomUUID().toString();
        tokenStore.put(token, user.getUsername());
        if (authSessionRepository != null) {
            try {
                AuthSession session = new AuthSession();
                session.setToken(token);
                session.setUsername(user.getUsername());
                session.setExpiresAt(LocalDateTime.now().plusDays(30));
                authSessionRepository.save(session);
            } catch (Exception e) {
                logger.warn("Impossible de persister la session: {}", e.getMessage());
            }
        }
        return token;
    }

    @PostMapping("/auth/logout")
    public ResponseEntity<?> logout(@RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        if (authorizationHeader != null && !authorizationHeader.isBlank()) {
            String token = authorizationHeader.startsWith("Bearer ") ? authorizationHeader.substring(7) : authorizationHeader;
            if (!token.isBlank()) {
                tokenStore.remove(token);
                if (authSessionRepository != null) {
                    try {
                        authSessionRepository.deleteById(token);
                    } catch (Exception e) {
                        logger.warn("Impossible de supprimer la session {}: {}", token, e.getMessage());
                    }
                }
            }
        }
        return ResponseEntity.ok(Map.of("ok", true));
    }

    @Scheduled(cron = "0 15 3 * * *")
    public void purgeExpiredSessions() {
        if (authSessionRepository != null) {
            try {
                List<AuthSession> expired = authSessionRepository.findAll().stream()
                        .filter(s -> s.getExpiresAt() != null && s.getExpiresAt().isBefore(LocalDateTime.now()))
                        .toList();
                if (!expired.isEmpty()) {
                    authSessionRepository.deleteAll(expired);
                    logger.info("Sessions expirées purgées : {}", expired.size());
                }
            } catch (Exception e) {
                logger.warn("Purge des sessions expirées impossible : {}", e.getMessage());
            }
        }
    }
}
