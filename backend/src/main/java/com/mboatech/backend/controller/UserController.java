package com.mboatech.backend.controller;

import com.mboatech.backend.model.User;
import com.mboatech.backend.repository.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api")
public class UserController {

    private final UserRepository userRepository;

    public UserController(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @GetMapping("/user")
    public ResponseEntity<?> getUser(@RequestHeader(value = "Authorization", required = false) String authorizationHeader,
                                     @RequestParam(value = "username", required = false) String username) {
        Optional<User> optionalUser = AuthController.authenticateToken(authorizationHeader, username, userRepository);
        if (optionalUser.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("message", "Utilisateur non authentifié."));
        }
        User user = optionalUser.get();
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("username", user.getUsername());
        data.put("firstName", user.getFirstName());
        data.put("lastName", user.getLastName());
        data.put("role", user.getRole().name());
        data.put("photoUrl", user.getPhotoUrl());
        return ResponseEntity.ok(data);
    }
}
