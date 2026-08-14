package com.mboatech.backend.controller;

import com.mboatech.backend.dto.LoginRequest;
import com.mboatech.backend.model.Role;
import com.mboatech.backend.model.User;
import com.mboatech.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class AuthIdentityCheckTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @BeforeEach
    void setUp() {
        userRepository.findByUsername("existinguser").ifPresent(userRepository::delete);

        User user = new User();
        user.setUsername("existinguser");
        user.setEmail("existing@example.com");
        user.setPasswordHash(new BCryptPasswordEncoder().encode("secret123"));
        user.setFirstName("Existing");
        user.setLastName("User");
        user.setRole(Role.client);
        userRepository.save(user);
    }

    @Test
    void login_shouldRejectExistingUserWithWrongPassword() throws Exception {
        String payload = "{\"email\":\"existing@example.com\",\"password\":\"wrongpass\"}";

        mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload))
                .andExpect(status().isUnauthorized());
    }
}
