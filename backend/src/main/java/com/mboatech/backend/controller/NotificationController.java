package com.mboatech.backend.controller;

import com.mboatech.backend.model.Notification;
import com.mboatech.backend.model.User;
import com.mboatech.backend.repository.UserRepository;
import com.mboatech.backend.service.NotificationService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private final NotificationService notificationService;
    private final UserRepository userRepository;

    public NotificationController(NotificationService notificationService, UserRepository userRepository) {
        this.notificationService = notificationService;
        this.userRepository = userRepository;
    }

    @GetMapping
    public ResponseEntity<?> getNotifications(@RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        Optional<User> user = AuthController.authenticateToken(authorizationHeader, null, userRepository);
        if (user.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("message", "Utilisateur non authentifié."));
        }
        Long userId = user.get().getId();
        List<Notification> notifications = notificationService.listForUser(userId);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("notifications", notifications);
        body.put("unreadCount", notificationService.unreadCount(userId));
        return ResponseEntity.ok(body);
    }

    @PostMapping("/read/{id}")
    public ResponseEntity<?> markRead(@RequestHeader(value = "Authorization", required = false) String authorizationHeader,
                                      @PathVariable("id") Long id) {
        Optional<User> user = AuthController.authenticateToken(authorizationHeader, null, userRepository);
        if (user.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("message", "Utilisateur non authentifié."));
        }
        boolean updated = notificationService.markRead(user.get().getId(), id);
        return updated ? ResponseEntity.ok(Map.of("success", true)) : ResponseEntity.notFound().build();
    }

    @PostMapping("/read-all")
    public ResponseEntity<?> markAllRead(@RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        Optional<User> user = AuthController.authenticateToken(authorizationHeader, null, userRepository);
        if (user.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("message", "Utilisateur non authentifié."));
        }
        notificationService.markAllRead(user.get().getId());
        return ResponseEntity.ok(Map.of("success", true));
    }

    @DeleteMapping
    public ResponseEntity<?> clearAll(@RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        Optional<User> user = AuthController.authenticateToken(authorizationHeader, null, userRepository);
        if (user.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("message", "Utilisateur non authentifié."));
        }
        notificationService.clearAll(user.get().getId());
        return ResponseEntity.ok(Map.of("success", true));
    }
}
