package com.mboatech.backend.config;

import com.mboatech.backend.controller.ChatController;
import com.mboatech.backend.model.AdminProfile;
import com.mboatech.backend.model.Role;
import com.mboatech.backend.model.User;
import com.mboatech.backend.repository.AdminProfileRepository;
import com.mboatech.backend.repository.UserRepository;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;

@Component
public class SystemUserInitializer {

    private static final Logger logger = LoggerFactory.getLogger(SystemUserInitializer.class);

    private final UserRepository userRepository;
    private final AdminProfileRepository adminProfileRepository;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    @Value("${admin.email}")
    private String adminEmail;

    @Value("${admin.password}")
    private String adminPassword;

    public SystemUserInitializer(UserRepository userRepository, AdminProfileRepository adminProfileRepository) {
        this.userRepository = userRepository;
        this.adminProfileRepository = adminProfileRepository;
    }

    @PostConstruct
    public void ensureSystemUser() {
        if (!userRepository.existsById(ChatController.SYSTEM_SENDER_USER_ID)) {
            User system = new User();
            system.setId(ChatController.SYSTEM_SENDER_USER_ID);
            system.setUsername("system");
            system.setEmail("system@mboatech.com");
            system.setPasswordHash("");
            system.setFirstName("MboaTech");
            system.setLastName("Systeme");
            system.setRole(Role.client);
            system.setStatus("active");
            try {
                userRepository.save(system);
            } catch (DataIntegrityViolationException e) {
                system.setUsername("systeme");
                userRepository.save(system);
            }
            logger.info("Utilisateur systeme cree (id={}) pour les messages systeme du chat", ChatController.SYSTEM_SENDER_USER_ID);
        }
        ensureDefaultAdmin();
    }

    private void ensureDefaultAdmin() {
        if (!userRepository.findByRole(Role.admin).isEmpty()) {
            return;
        }
        User admin = new User();
        admin.setUsername("admin");
        admin.setEmail(adminEmail);
        admin.setPasswordHash(passwordEncoder.encode(adminPassword));
        admin.setFirstName("MboaTech");
        admin.setLastName("Administrateur");
        admin.setRole(Role.admin);
        admin.setStatus("active");
        admin = userRepository.save(admin);

        AdminProfile profile = new AdminProfile();
        profile.setUser(admin);
        adminProfileRepository.save(profile);
        logger.info("Compte administrateur predefini cree (email={}) — accessible uniquement par connexion", adminEmail);
    }
}
