package com.mboatech.backend.controller;

import com.mboatech.backend.model.PlatformSetting;
import com.mboatech.backend.model.Role;
import com.mboatech.backend.model.User;
import com.mboatech.backend.repository.PlatformSettingRepository;
import com.mboatech.backend.repository.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api")
public class PlatformSettingsController {

    private static final String PAYMENTS_KEY = "payments_enabled";
    private static final String ACCOUNT_MOMO_KEY = "payment_account_momo";
    private static final String ACCOUNT_ORANGE_KEY = "payment_account_orange";
    private static final String ACCOUNT_CARD_KEY = "payment_account_card";

    private final PlatformSettingRepository settingsRepository;
    private final UserRepository userRepository;

    public PlatformSettingsController(PlatformSettingRepository settingsRepository, UserRepository userRepository) {
        this.settingsRepository = settingsRepository;
        this.userRepository = userRepository;
    }

    @GetMapping("/settings/payments")
    public ResponseEntity<?> getPayments() {
        return ResponseEntity.ok(paymentsResponse());
    }

    @PutMapping("/admin/settings/payments")
    @Transactional
    public ResponseEntity<?> setPayments(@RequestHeader(value = "Authorization", required = false) String authorizationHeader,
                                         @RequestBody(required = false) Map<String, Object> body) {
        Optional<User> user = AuthController.authenticateToken(authorizationHeader, null, userRepository);
        if (user.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("message", "Utilisateur non authentifié."));
        }
        if (user.get().getRole() != Role.admin) {
            return ResponseEntity.status(403).body(Map.of("message", "Espace réservé aux administrateurs."));
        }
        if (body != null && body.containsKey("paymentsEnabled")) {
            boolean enabled = Boolean.parseBoolean(String.valueOf(body.get("paymentsEnabled")));
            writeBoolean(PAYMENTS_KEY, enabled);
        }
        if (body != null && body.get("accounts") instanceof Map<?, ?> accounts) {
            writeString(ACCOUNT_MOMO_KEY, stringValue(accounts.get("momo")));
            writeString(ACCOUNT_ORANGE_KEY, stringValue(accounts.get("orange")));
            writeString(ACCOUNT_CARD_KEY, stringValue(accounts.get("card")));
        }
        return ResponseEntity.ok(paymentsResponse());
    }

    private Map<String, Object> paymentsResponse() {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("paymentsEnabled", readBoolean(PAYMENTS_KEY, true));
        Map<String, String> accounts = new LinkedHashMap<>();
        accounts.put("momo", readString(ACCOUNT_MOMO_KEY, ""));
        accounts.put("orange", readString(ACCOUNT_ORANGE_KEY, ""));
        accounts.put("card", readString(ACCOUNT_CARD_KEY, ""));
        response.put("accounts", accounts);
        return response;
    }

    private String stringValue(Object value) {
        return value != null ? String.valueOf(value) : "";
    }

    private boolean readBoolean(String key, boolean fallback) {
        return settingsRepository.findById(key)
                .map(setting -> Boolean.parseBoolean(setting.getValue()))
                .orElse(fallback);
    }

    private String readString(String key, String fallback) {
        return settingsRepository.findById(key)
                .map(PlatformSetting::getValue)
                .orElse(fallback);
    }

    private void writeBoolean(String key, boolean value) {
        writeString(key, String.valueOf(value));
    }

    private void writeString(String key, String value) {
        PlatformSetting setting = settingsRepository.findById(key).orElseGet(() -> new PlatformSetting(key, ""));
        setting.setValue(value != null ? value : "");
        settingsRepository.save(setting);
    }
}
