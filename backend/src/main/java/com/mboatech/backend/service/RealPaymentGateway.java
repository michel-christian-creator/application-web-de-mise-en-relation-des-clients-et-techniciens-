package com.mboatech.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mboatech.backend.config.PaymeeProperties;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Passerelle réelle Paymee (paymee.tn) branchée à la place du simulateur.
 * Active uniquement quand paymee.enabled=true (voir application.yml).
 *
 * <p>Crée une session de paiement via POST /api/v2/payments/create puis renvoie
 * le token et payment_url : le client est redirigé sur la page Paymee, et la
 * confirmation arrive ensuite sur le webhook (voir PaymentService.confirmPayment).</p>
 */
@Component
@ConditionalOnProperty(name = "paymee.enabled", havingValue = "true")
public class RealPaymentGateway implements PaymentGateway {

    private final PaymeeProperties properties;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    public RealPaymentGateway(PaymeeProperties properties, ObjectMapper objectMapper) {
        this.properties = properties;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(15))
                .build();
    }

    @Override
    public PaymentResult charge(PaymentRequest request) {
        try {
            NameSplit name = splitName(request.getPayerName());

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("amount", request.getAmount());
            payload.put("note", request.getDescription() != null && !request.getDescription().isBlank()
                    ? request.getDescription() : "Dépôt MboaTech #" + request.getRequestId());
            payload.put("first_name", name.first);
            payload.put("last_name", name.last);
            payload.put("email", request.getPayerEmail() != null ? request.getPayerEmail() : "");
            payload.put("phone", request.getPayerPhone() != null ? request.getPayerPhone() : "");
            payload.put("return_url", properties.getReturnUrl());
            payload.put("cancel_url", properties.getCancelUrl());
            payload.put("webhook_url", properties.getWebhookUrl());
            payload.put("order_id", String.valueOf(request.getRequestId()));

            HttpRequest httpRequest = HttpRequest.newBuilder()
                    .uri(URI.create(properties.getApiBase() + "/payments/create"))
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/json")
                    .header("Authorization", "Token " + properties.getApiKey())
                    .timeout(Duration.ofSeconds(30))
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(payload)))
                    .build();

            HttpResponse<String> response = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString());
            JsonNode body = objectMapper.readTree(response.body());
            boolean ok = body.path("status").asBoolean(false) && body.has("data");
            if (!ok) {
                return PaymentResult.failure(body.path("message").asText("Paymee a refusé la transaction."));
            }
            String token = body.path("data").path("token").asText("");
            String paymentUrl = body.path("data").path("payment_url").asText("");
            if (token.isEmpty() || paymentUrl.isEmpty()) {
                return PaymentResult.failure("Réponse Paymee incomplète (token ou payment_url absent).");
            }
            return PaymentResult.success(token, paymentUrl);
        } catch (Exception e) {
            return PaymentResult.failure("Erreur de communication avec Paymee : " + e.getMessage());
        }
    }

    private static NameSplit splitName(String fullName) {
        if (fullName == null || fullName.isBlank()) {
            return new NameSplit("Client", "");
        }
        String trimmed = fullName.trim();
        int idx = trimmed.indexOf(' ');
        if (idx < 0) {
            return new NameSplit(trimmed, "");
        }
        return new NameSplit(trimmed.substring(0, idx), trimmed.substring(idx + 1).trim());
    }

    private record NameSplit(String first, String last) {
    }
}
