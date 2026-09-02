package com.mboatech.backend.controller;

import com.mboatech.backend.dto.LoginRequest;
import com.mboatech.backend.dto.RegistrationRequest;
import com.mboatech.backend.model.AdminProfile;
import com.mboatech.backend.model.AuthSession;
import com.mboatech.backend.model.ClientProfile;
import com.mboatech.backend.model.TechnicianProfile;
import com.mboatech.backend.model.User;
import com.mboatech.backend.model.Role;
import com.mboatech.backend.repository.AdminProfileRepository;
import com.mboatech.backend.repository.AuthSessionRepository;
import com.mboatech.backend.repository.ClientProfileRepository;
import com.mboatech.backend.repository.TechnicianProfileRepository;
import com.mboatech.backend.repository.UserRepository;
import jakarta.transaction.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.*;

@RestController
@RequestMapping("/api")
public class AuthController {

    private static final Logger logger = LoggerFactory.getLogger(AuthController.class);

    private final UserRepository userRepository;
    private final ClientProfileRepository clientProfileRepository;
    private final TechnicianProfileRepository technicianProfileRepository;
    private final AdminProfileRepository adminProfileRepository;
    private final AuthSessionRepository authSessionRepository;
    private final BCryptPasswordEncoder passwordEncoder;
    private static AuthSessionRepository sessionRepository;

    @Value("${admin.email}")
    private String adminEmail;

    @Value("${admin.password}")
    private String adminPassword;

    public AuthController(UserRepository userRepository,
                          ClientProfileRepository clientProfileRepository,
                          TechnicianProfileRepository technicianProfileRepository,
                          AdminProfileRepository adminProfileRepository,
                          AuthSessionRepository authSessionRepository) {
        this.userRepository = userRepository;
        this.clientProfileRepository = clientProfileRepository;
        this.technicianProfileRepository = technicianProfileRepository;
        this.adminProfileRepository = adminProfileRepository;
        this.authSessionRepository = authSessionRepository;
        this.passwordEncoder = new BCryptPasswordEncoder();
        AuthController.sessionRepository = authSessionRepository;
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

        String token = generateToken(user);
        Map<String, Object> profile = buildProfileResponse(user, null);
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
            if (!adminEmail.equals(request.getEmail()) || !adminPassword.equals(request.getPassword())) {
                logger.warn("Inscription admin échouée: identifiants invalides pour {}", request.getEmail());
                return ResponseEntity.badRequest().body("Identifiants admin invalides.");
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
        user.setPhone(request.getPhone());
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
    public ResponseEntity<?> getProfile(@RequestHeader(value = "Authorization", required = false) String authorizationHeader,
                                        @RequestParam(value = "username", required = false) String username) {
        Optional<User> optionalUser = authenticateUser(authorizationHeader, username);
        if (optionalUser.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("message", "Utilisateur non authentifié."));
        }
        User user = optionalUser.get();
        return ResponseEntity.ok(buildProfileResponse(user, null));
    }

    @GetMapping("/profile/me")
    public ResponseEntity<?> getProfileMe(@RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        Optional<User> optionalUser = authenticateUser(authorizationHeader, null);
        if (optionalUser.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("message", "Utilisateur non authentifié."));
        }
        User user = optionalUser.get();
        return ResponseEntity.ok(buildProfileResponse(user, null));
    }

    @PutMapping(value = "/profile", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Transactional
    public ResponseEntity<?> updateProfile(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
            @RequestParam(value = "username", required = false) String username,
            @RequestParam(value = "firstName", required = false) String firstName,
            @RequestParam(value = "lastName", required = false) String lastName,
            @RequestParam(value = "phone", required = false) String phone,
            @RequestParam(value = "role", required = false) String role,
            @RequestParam(value = "domain", required = false) String domain,
            @RequestParam(value = "city", required = false) String city,
            @RequestParam(value = "location", required = false) String location,
            @RequestParam(value = "photoUrl", required = false) String photoUrl,
            @RequestParam(value = "photo", required = false) MultipartFile photo
    ) {
        Optional<User> optionalUser = authenticateUser(authorizationHeader, username);
        if (optionalUser.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("message", "Utilisateur non authentifié."));
        }
        User user = optionalUser.get();

        if (firstName != null && !firstName.isBlank()) {
            user.setFirstName(firstName.trim());
        }
        if (lastName != null && !lastName.isBlank()) {
            user.setLastName(lastName.trim());
        }
        if (phone != null && !phone.isBlank()) {
            user.setPhone(phone.trim());
        }
        if (username != null && !username.isBlank() && !username.equals(user.getUsername())) {
            if (userRepository.findByUsername(username).isPresent()) {
                return ResponseEntity.badRequest().body(Map.of("message", "Nom d'utilisateur déjà utilisé."));
            }
            user.setUsername(username);
        }
        userRepository.save(user);

        String resolvedPhotoUrl = photoUrl;
        if (photo != null && !photo.isEmpty()) {
            resolvedPhotoUrl = "/uploads/" + photo.getOriginalFilename();
        }

        if (user.getRole() == Role.client) {
            ClientProfile profile = clientProfileRepository.findByUser(user).orElseGet(ClientProfile::new);
            profile.setUser(user);
            profile.setCity(city);
            profile.setLocation(location);
            clientProfileRepository.save(profile);
        } else if (user.getRole() == Role.technician) {
            TechnicianProfile profile = technicianProfileRepository.findByUser(user).orElseGet(TechnicianProfile::new);
            profile.setUser(user);
            profile.setDomain(domain);
            profile.setCity(city);
            profile.setLocation(location);
            technicianProfileRepository.save(profile);
        }

        return ResponseEntity.ok(buildProfileResponse(user, resolvedPhotoUrl));
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
        technicianProfileRepository.save(profile);
    }

    private void createAdminProfile(User user) {
        AdminProfile profile = new AdminProfile();
        profile.setUser(user);
        adminProfileRepository.save(profile);
    }



    private Map<String, Object> buildProfileResponse(User user, String photoUrl) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("username", user.getUsername());
        data.put("firstName", user.getFirstName());
        data.put("lastName", user.getLastName());
        data.put("phone", user.getPhone() != null ? user.getPhone() : "");
        data.put("role", user.getRole().name());
        data.put("domain", "");
        data.put("city", "");
        data.put("location", "");
        if (photoUrl != null) {
            data.put("photoUrl", photoUrl);
        }

        if (user.getRole() == Role.client) {
            clientProfileRepository.findByUser(user).ifPresent(profile -> {
                data.put("city", profile.getCity() != null ? profile.getCity() : "");
                data.put("location", profile.getLocation() != null ? profile.getLocation() : "");
            });
        } else if (user.getRole() == Role.technician) {
            technicianProfileRepository.findByUser(user).ifPresent(profile -> {
                data.put("domain", profile.getDomain() != null ? profile.getDomain() : "");
                data.put("city", profile.getCity() != null ? profile.getCity() : "");
                data.put("location", profile.getLocation() != null ? profile.getLocation() : "");
            });
        }

        return data;
    }

    public static Optional<User> authenticateToken(String authorizationHeader, UserRepository userRepository) {
        return authenticateToken(authorizationHeader, null, userRepository);
    }

    public static Optional<User> authenticateToken(String authorizationHeader, String username, UserRepository userRepository) {
        if (authorizationHeader != null && !authorizationHeader.isBlank()) {
            String token = authorizationHeader.startsWith("Bearer ") ? authorizationHeader.substring(7) : authorizationHeader;
            if (!token.isBlank()) {
                if (sessionRepository == null) {
                    return Optional.empty();
                }
                return sessionRepository.findByToken(token)
                        .filter(session -> session.getExpiresAt() == null || session.getExpiresAt().isAfter(java.time.LocalDateTime.now()))
                        .map(AuthSession::getUsername)
                        .flatMap(userRepository::findByUsername);
            }
        }
        if (username != null && !username.isBlank()) {
            return userRepository.findByUsername(username);
        }
        return Optional.empty();
    }

    private Optional<User> authenticateUser(String authorizationHeader, String username) {
        return authenticateToken(authorizationHeader, username, userRepository);
    }

    private String generateToken(User user) {
        String token = UUID.randomUUID().toString();
        AuthSession session = new AuthSession();
        session.setToken(token);
        session.setUsername(user.getUsername());
        authSessionRepository.save(session);
        return token;
    }
}
