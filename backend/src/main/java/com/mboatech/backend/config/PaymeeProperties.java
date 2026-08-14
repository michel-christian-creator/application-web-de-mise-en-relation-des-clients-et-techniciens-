package com.mboatech.backend.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;

/**
 * Configuration Paymee (paymee.tn) définie dans application.yml (section paymee)
 * et surchargeable par variables d'environnement (PAYMEE_API_KEY, …).
 */
@Component
@ConfigurationProperties(prefix = "paymee")
public class PaymeeProperties {

    private boolean enabled;
    private String apiKey = "";
    private String apiBase = "https://sandbox.paymee.tn/api/v2";
    private String returnUrl = "http://localhost:5173";
    private String cancelUrl = "http://localhost:5173";
    private String webhookUrl = "http://localhost:8082/api/payments/webhook";

    /**
     * Vérifie le check_sum reçu sur le webhook :
     * check_sum = md5(token + payment_status(1 ou 0) + API Token).
     */
    public boolean verifySignature(String token, boolean paymentStatus, String checkSum) {
        if (token == null || checkSum == null || apiKey == null || apiKey.isEmpty()) {
            return false;
        }
        String expected = md5(token + (paymentStatus ? 1 : 0) + apiKey);
        return expected.equalsIgnoreCase(checkSum);
    }

    private static String md5(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("MD5");
            byte[] hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (Exception e) {
            throw new IllegalStateException("MD5 indisponible", e);
        }
    }

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public String getApiKey() {
        return apiKey;
    }

    public void setApiKey(String apiKey) {
        this.apiKey = apiKey;
    }

    public String getApiBase() {
        return apiBase;
    }

    public void setApiBase(String apiBase) {
        this.apiBase = apiBase;
    }

    public String getReturnUrl() {
        return returnUrl;
    }

    public void setReturnUrl(String returnUrl) {
        this.returnUrl = returnUrl;
    }

    public String getCancelUrl() {
        return cancelUrl;
    }

    public void setCancelUrl(String cancelUrl) {
        this.cancelUrl = cancelUrl;
    }

    public String getWebhookUrl() {
        return webhookUrl;
    }

    public void setWebhookUrl(String webhookUrl) {
        this.webhookUrl = webhookUrl;
    }
}
