package com.mboatech.backend.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.HexFormat;

/**
 * Configuration de la passerelle de paiement « HR-Skills Pay » définie dans
 * application.yml (section hrsdkills) et surchargeable par variables
 * d'environnement (HRSK_API_KEY, HRSK_API_SECRET, …).
 *
 * <p>La plateforme utilise un mécanisme à double clé :
 * <ul>
 *   <li>{@code apiKey} — Clé A (publique, préfixe {@code hrsk_pk_…}) envoyée
 *       dans {@code Authorization: Bearer} sur chaque requête ;</li>
 *   <li>{@code apiSecret} — Clé B (secrète, préfixe {@code hrsk_sk_…}) échangée
 *       une seule fois contre un {@code transaction_token} (JWT, TTL 45 min).</li>
 *   <li>{@code webhookSecret} — secret de signature des webhooks
 *       ({@code X-Hub-Signature: sha256=<hmac>}).</li>
 * </ul>
 * Aucune de ces clés ne doit jamais être embarquée dans le frontend.
 */
@Component
@ConfigurationProperties(prefix = "hrskills")
public class HrSkillsProperties {

    private boolean enabled;
    private String apiKey = "";
    private String apiSecret = "";
    private String webhookSecret = "";
    private String apiBase = "https://api.hrskills-pay.com";
    private String country = "CM";
    private String currency = "XAF";
    private String returnUrl = "http://localhost:5173";
    private String cancelUrl = "http://localhost:5173";
    private String webhookUrl = "http://localhost:8082/api/payments/webhook";

    /**
     * Vérifie la signature HMAC-SHA256 reçue sur le webhook dans le header
     * {@code X-Hub-Signature: sha256=<hmac>}, calculée sur le corps brut de la
     * requête avec le {@code webhookSecret}.
     *
     * @param rawBody    corps brut (raw bytes) de la requête webhook
     * @param signature  valeur du header {@code X-Hub-Signature} (ex. {@code sha256=abc…})
     */
    public boolean verifyWebhookSignature(byte[] rawBody, String signature) {
        if (rawBody == null || signature == null || webhookSecret == null || webhookSecret.isEmpty()) {
            return false;
        }
        String hmac = hmacSha256(rawBody, webhookSecret);
        String expected = "sha256=" + hmac;
        return constantTimeEquals(expected, signature.trim());
    }

    private static String hmacSha256(byte[] data, String secret) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal(data));
        } catch (Exception e) {
            throw new IllegalStateException("HMAC-SHA256 indisponible", e);
        }
    }

    private static boolean constantTimeEquals(String a, String b) {
        return java.security.MessageDigest.isEqual(
                a.getBytes(StandardCharsets.UTF_8),
                b.getBytes(StandardCharsets.UTF_8));
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

    public String getApiSecret() {
        return apiSecret;
    }

    public void setApiSecret(String apiSecret) {
        this.apiSecret = apiSecret;
    }

    public String getWebhookSecret() {
        return webhookSecret;
    }

    public void setWebhookSecret(String webhookSecret) {
        this.webhookSecret = webhookSecret;
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

    public String getCountry() {
        return country;
    }

    public void setCountry(String country) {
        this.country = country;
    }

    public String getCurrency() {
        return currency;
    }

    public void setCurrency(String currency) {
        this.currency = currency;
    }
}
