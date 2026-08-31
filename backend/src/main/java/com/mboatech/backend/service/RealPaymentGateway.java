package com.mboatech.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mboatech.backend.config.HrSkillsProperties;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Passerelle réelle « HR-Skills Pay » (https://api.hrskills-pay.com) branchée à
 * la place du simulateur. Active uniquement quand hrskills.enabled=true
 * (voir application.yml).
 *
 * <p>Flux Cash-In (collecte Mobile Money) :
 * <ol>
 *   <li>Obtenir un transaction_token (JWT) via POST /v1/auth/transaction-token
 *       avec Clé A (Bearer) + Clé B (api_secret dans le body) ;</li>
 *   <li>Initier le cash-in via POST /api/v1/payin/mobile-money avec
 *       X-Transaction-Token + Idempotency-Key ;</li>
 *   <li>Le statut final arrive sur le webhook payment.succeeded / payment.failed
 *       (header X-Hub-Signature).</li>
 * </ol>
 */
@Component
@ConditionalOnProperty(name = "hrskills.enabled", havingValue = "true")
public class RealPaymentGateway implements PaymentGateway {

    private final HrSkillsProperties properties;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    private String transactionToken;
    private long transactionTokenExpiry;

    public RealPaymentGateway(HrSkillsProperties properties, ObjectMapper objectMapper) {
        this.properties = properties;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(15))
                .build();
    }

    @Override
    public PaymentResult charge(PaymentRequest request) {
        System.out.println("[DEBUG] RealPaymentGateway.charge appelé - amount=" + request.getAmount() + ", phone=" + request.getPayerPhone() + ", method=" + request.getMethod());
        try {
            String token = obtainTransactionToken();

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("operator", resolveOperator(request.getMethod(), request.getPayerPhone()));
            payload.put("country", properties.getCountry());
            payload.put("phone_number", normalizePhone(request.getPayerPhone()));
            payload.put("amount", request.getAmount().longValue());
            payload.put("currency", properties.getCurrency());
            if (request.getDescription() != null && !request.getDescription().isBlank()) {
                payload.put("description", request.getDescription());
            }
            payload.put("metadata", Map.of(
                    "request_id", String.valueOf(request.getRequestId()),
                    "platform", "MboaTech",
                    "payer_user_id", String.valueOf(request.getPayerUserId())));

            HttpRequest httpRequest = HttpRequest.newBuilder()
                    .uri(URI.create(properties.getApiBase() + "/api/v1/payin/mobile-money"))
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/json")
                    .header("Authorization", "Bearer " + properties.getApiKey())
                    .header("X-Transaction-Token", token)
                    .header("X-API-Secret", properties.getApiSecret())
                    .header("Idempotency-Key", UUID.randomUUID().toString())
                    .timeout(Duration.ofSeconds(30))
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(payload)))
                    .build();

            System.out.println("[DEBUG] Requête HR-Skills: URI=" + properties.getApiBase() + "/api/v1/payin/mobile-money");
            System.out.println("[DEBUG] Payload: " + objectMapper.writeValueAsString(payload));
            HttpResponse<String> response = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString());
            System.out.println("[DEBUG] Réponse API HR-Skills: status=" + response.statusCode() + ", body=" + response.body());
            JsonNode body = objectMapper.readTree(response.body());
            boolean ok = body.path("success").asBoolean(false) && body.has("data");
            if (!ok || response.statusCode() >= 400) {
                String message = body.path("message").asText("La passerelle a refusé la transaction.");
                return PaymentResult.failure(message);
            }
            String reference = body.path("data").path("reference").asText("");
            if (reference.isEmpty()) {
                return PaymentResult.failure("Réponse de la passerelle incomplète (reference absente).");
            }
            return PaymentResult.pending(reference, reference, "PENDING");
        } catch (Exception e) {
            return PaymentResult.failure("Erreur de communication avec la passerelle : " + e.getMessage());
        }
    }

    /**
     * Obtient (ou réutilise) un transaction_token JWT valide.
     * POST /v1/auth/transaction-token avec Clé A (Bearer) + Clé B (api_secret).
     */
    private synchronized String obtainTransactionToken() throws Exception {
        long now = System.currentTimeMillis();
        if (transactionToken != null && now < transactionTokenExpiry) {
            return transactionToken;
        }
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("api_secret", properties.getApiSecret());

        HttpRequest httpRequest = HttpRequest.newBuilder()
                .uri(URI.create(properties.getApiBase() + "/v1/auth/transaction-token"))
                .header("Content-Type", "application/json")
                .header("Accept", "application/json")
                .header("Authorization", "Bearer " + properties.getApiKey())
                .timeout(Duration.ofSeconds(30))
                .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(payload)))
                .build();

        System.out.println("[DEBUG] Obtention transaction-token: " + properties.getApiBase() + "/v1/auth/transaction-token");
        HttpResponse<String> response = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString());
        System.out.println("[DEBUG] Réponse token: status=" + response.statusCode() + ", body=" + response.body());
        if (response.statusCode() != 200) {
            throw new IllegalStateException("Échec obtention transaction token (HTTP " + response.statusCode() + ").");
        }
        JsonNode body = objectMapper.readTree(response.body());
        String token = body.path("transaction_token").asText("");
        long ttl = body.path("expires_in").asLong(2700);
        if (token.isEmpty()) {
            throw new IllegalStateException("Réponse auth incomplète (transaction_token absent).");
        }
        long margin = Math.min(300, Math.max(10, ttl / 10));
        this.transactionToken = token;
        this.transactionTokenExpiry = now + (ttl - margin) * 1000;
        return token;
    }

    private static String resolveOperator(String method, String phone) {
        if (method != null) {
            String m = method.toLowerCase();
            if ("orange".equals(m)) {
                return "ORANGE";
            }
            if ("momo".equals(m)) {
                return "MTN";
            }
        }
        String prefix = phonePrefix(phone);
        if (prefix != null) {
            if (prefix.startsWith("69") || prefix.startsWith("66")
                    || prefix.startsWith("655") || prefix.startsWith("656")
                    || prefix.startsWith("657") || prefix.startsWith("658") || prefix.startsWith("659")) {
                return "ORANGE";
            }
            return "MTN";
        }
        return "MTN";
    }

    private static String phonePrefix(String phone) {
        if (phone == null) {
            return null;
        }
        String digits = phone.replaceAll("[^0-9]", "");
        if (digits.startsWith("237") && digits.length() >= 12) {
            return digits.substring(3, 6);
        }
        if (digits.length() >= 3) {
            return digits.substring(0, 3);
        }
        return null;
    }

    private static String normalizePhone(String phone) {
        if (phone == null) {
            return "";
        }
        String digits = phone.replaceAll("[^0-9]", "");
        if (digits.startsWith("237") && digits.length() == 12) {
            return digits;
        }
        if (digits.length() == 9) {
            return "237" + digits;
        }
        return digits;
    }
}
