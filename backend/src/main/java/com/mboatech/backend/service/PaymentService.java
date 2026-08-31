package com.mboatech.backend.service;

import com.mboatech.backend.model.ClientRequest;
import com.mboatech.backend.model.Payment;
import com.mboatech.backend.model.Role;
import com.mboatech.backend.model.User;
import com.mboatech.backend.repository.ClientProfileRepository;
import com.mboatech.backend.repository.ClientRequestRepository;
import com.mboatech.backend.repository.PaymentRepository;
import com.mboatech.backend.repository.PlatformSettingRepository;
import com.mboatech.backend.repository.TechnicianProfileRepository;
import com.mboatech.backend.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * Orchestre le dépôt des fonds en garde.
 *
 * <p>Avec la passerelle, le dépôt est d'abord créé en statut {@code pending} : le client est
 * redirigé sur la page de paiement, puis la confirmation arrive sur
 * {@code POST /api/payments/webhook} (voir {@link #confirmPayment}) qui passe le
 * paiement en {@code held} et sécurise les fonds.</p>
 */
@Service
public class PaymentService {

    private static final String PAYMENTS_KEY = "payments_enabled";
    private static final Set<String> ALLOWED_METHODS = Set.of("momo", "orange", "card", "wallet");

    private final PaymentGateway paymentGateway;
    private final PaymentRepository paymentRepository;
    private final PlatformSettingRepository settingsRepository;
    private final ClientRequestRepository requestRepository;
    private final ClientProfileRepository clientProfileRepository;
    private final TechnicianProfileRepository technicianProfileRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;

    public PaymentService(PaymentGateway paymentGateway,
                          PaymentRepository paymentRepository,
                          PlatformSettingRepository settingsRepository,
                          ClientRequestRepository requestRepository,
                          ClientProfileRepository clientProfileRepository,
                          TechnicianProfileRepository technicianProfileRepository,
                          UserRepository userRepository,
                          NotificationService notificationService) {
        this.paymentGateway = paymentGateway;
        this.paymentRepository = paymentRepository;
        this.settingsRepository = settingsRepository;
        this.requestRepository = requestRepository;
        this.clientProfileRepository = clientProfileRepository;
        this.technicianProfileRepository = technicianProfileRepository;
        this.userRepository = userRepository;
        this.notificationService = notificationService;
    }

    @Transactional
    public Map<String, Object> deposit(Long requestId, Long payerUserId, BigDecimal amount, String method) {
        System.out.println("[DEBUG] deposit() - requestId=" + requestId + ", payerId=" + payerUserId + ", amount=" + amount + ", method=" + method);
        boolean enabled = settingsRepository.findById(PAYMENTS_KEY)
                .map(setting -> Boolean.parseBoolean(setting.getValue()))
                .orElse(true);
        System.out.println("[DEBUG] payments_enabled=" + enabled);
        if (!enabled) {
            throw new PaymentException("Les paiements sont temporairement désactivés par l'administration.");
        }
        if (method == null || !ALLOWED_METHODS.contains(method)) {
            System.out.println("[DEBUG] méthode invalide: " + method);
            throw new PaymentException("Mode de paiement invalide.");
        }
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new PaymentException("Montant invalide.");
        }
        System.out.println("[DEBUG] recherche request id=" + requestId);
        ClientRequest request = requestRepository.findById(requestId)
                .orElseThrow(() -> new PaymentException("Demande introuvable."));
        System.out.println("[DEBUG] request trouvé, clientId=" + request.getClientId());
        Long clientUserId = request.getClientId() != null
                ? clientProfileRepository.findById(request.getClientId())
                        .map(profile -> profile.getUser().getId())
                        .orElse(null)
                : null;
        System.out.println("[DEBUG] clientUserId=" + clientUserId + ", payerUserId=" + payerUserId);
        if (clientUserId == null || !clientUserId.equals(payerUserId)) {
            System.out.println("[DEBUG] REFUSÉ: clientUserId != payerUserId ou null");
            throw new PaymentException("Vous n'êtes pas autorisé à payer pour cette demande.");
        }

        Optional<Payment> held = paymentRepository.findFirstByRequestIdAndStatusOrderByIdAsc(requestId, "held");
        if (held.isPresent()) {
            System.out.println("[DEBUG] Déjà un paiement held");
            Map<String, Object> out = outcome(held.get());
            out.put("alreadyHeld", true);
            return out;
        }

        Optional<Payment> pending = paymentRepository.findFirstByRequestIdAndStatusOrderByIdAsc(requestId, "pending");
        if (pending.isPresent()) {
            System.out.println("[DEBUG] Déjà un paiement pending");
            Map<String, Object> out = outcome(pending.get());
            out.put("alreadyPending", true);
            return out;
        }

        Long payeeUserId = request.getTechnicianId() != null
                ? technicianProfileRepository.findById(request.getTechnicianId())
                        .map(profile -> profile.getUser().getId())
                        .orElse(null)
                : null;
        System.out.println("[DEBUG] technicianId=" + request.getTechnicianId() + ", payeeUserId=" + payeeUserId);
        if (payeeUserId == null) {
            System.out.println("[DEBUG] REFUSÉ: aucun technicien assigné");
            throw new PaymentException("Aucun technicien n'est assigné à cette demande : les fonds ne peuvent pas être sécurisés.");
        }
        User payer = userRepository.findById(payerUserId).orElse(null);
        String payerName = payer != null ? fullName(payer) : "Client";
        System.out.println("[DEBUG] appel paymentGateway.charge avec phone=" + (payer != null ? payer.getPhone() : "null"));

        PaymentResult result = paymentGateway.charge(new PaymentRequest(
                requestId, amount, "XAF", method, payerUserId, payeeUserId, payerName, request.getDescription(),
                payer != null ? payer.getEmail() : null, payer != null ? payer.getPhone() : null));
        if (!result.isSuccess()) {
            throw new PaymentException(result.getMessage() != null ? result.getMessage() : "Débit refusé par la passerelle.");
        }

        Payment payment = new Payment();
        payment.setRequestId(requestId);
        payment.setPayerUserId(payerUserId);
        payment.setPayeeUserId(payeeUserId);
        payment.setAmount(amount);
        payment.setCurrency("XAF");
        payment.setMethod(method);
        payment.setTransactionRef(result.getTransactionRef());
        payment.setPaymentUrl(result.getPaymentUrl());

        boolean pendingFlow = result.isPending()
                || (result.getPaymentUrl() != null && !result.getPaymentUrl().isBlank());
        if (pendingFlow) {
            payment.setStatus("pending");
            payment.setNotes("Paiement en attente de confirmation.");
            paymentRepository.save(payment);
            Map<String, Object> out = outcome(payment);
            out.put("alreadyHeld", false);
            return out;
        }

        payment.setStatus("held");
        payment.setNotes("Fonds déposés en garde MboaTech.");
        paymentRepository.save(payment);

        request.setFundsDeposited(true);
        request.setUpdatedAt(LocalDateTime.now());
        requestRepository.save(request);

        if (payeeUserId != null) {
            notificationService.create(payeeUserId, "Fonds sécurisés",
                    "Le client a déposé " + amount + " FCFA en garde pour la demande #" + requestId + ". Les travaux peuvent commencer.",
                    "request", requestId);
        }
        notifyAdmins("Fonds déposés en garde",
                amount + " FCFA ont été déposés en garde pour la demande #" + requestId + ".");

        Map<String, Object> out = outcome(payment);
        out.put("alreadyHeld", false);
        return out;
    }

    /**
     * Libère les fonds en garde ({@code held} → {@code released}) quand le client
     * valide les travaux terminés. Le solde du technicien est crédité.
     */
    @Transactional
    public Map<String, Object> release(Long requestId, Long clientUserId) {
        ClientRequest request = requestRepository.findById(requestId)
                .orElseThrow(() -> new PaymentException("Demande introuvable."));
        Long clientId = request.getClientId() != null
                ? clientProfileRepository.findById(request.getClientId())
                        .map(profile -> profile.getUser().getId())
                        .orElse(null)
                : null;
        if (clientId == null || !clientId.equals(clientUserId)) {
            throw new PaymentException("Vous n'êtes pas autorisé à valider cette demande.");
        }
        if (!"completed".equals(request.getStatus())) {
            throw new PaymentException("Les fonds ne peuvent être libérés qu'après la fin des travaux.");
        }
        if (request.isDisputeOpen()) {
            throw new PaymentException("Un litige est en cours : la libération des fonds passe par l'administration.");
        }
        Payment payment = paymentRepository.findFirstByRequestIdAndStatusOrderByIdAsc(requestId, "held")
                .orElseGet(() -> paymentRepository.findFirstByRequestIdAndStatusOrderByIdAsc(requestId, "released")
                        .orElse(null));
        if (payment == null) {
            throw new PaymentException("Aucun fonds en garde à libérer pour cette demande.");
        }
        if ("released".equals(payment.getStatus())) {
            Map<String, Object> already = outcome(payment);
            already.put("released", true);
            already.put("alreadyReleased", true);
            return already;
        }
        payment.setStatus("released");
        payment.setNotes("Fonds libérés au technicien après validation des travaux par le client.");
        paymentRepository.save(payment);

        request.setUpdatedAt(LocalDateTime.now());
        requestRepository.save(request);

        if (payment.getPayeeUserId() != null) {
            notificationService.create(payment.getPayeeUserId(), "Fonds libérés",
                    "Le client a validé les travaux. " + payment.getAmount()
                            + " FCFA ont été versés sur votre solde pour la demande #" + requestId + ".",
                    "request", requestId);
        }

        Map<String, Object> out = outcome(payment);
        out.put("released", true);
        return out;
    }

    /**
     * Confirmation reçue sur le webhook « HR-Skills Pay » (signature déjà vérifiée
     * côté contrôleur). {@code reference} est la référence de transaction
     * (ex. {@code ref_…}) fournie par la passerelle à l'initiation et au webhook.
     * {@code success} vaut {@code true} pour {@code payment.succeeded}, {@code false}
     * pour {@code payment.failed}.
     */
    @Transactional
    public Map<String, Object> confirmPayment(String reference, boolean success, String transactionId) {
        Payment payment = findPendingByReference(reference);
        if (payment == null) {
            throw new PaymentException("Transaction de la passerelle inconnue.");
        }
        if ("held".equals(payment.getStatus())) {
            Map<String, Object> out = outcome(payment);
            out.put("confirmed", true);
            out.put("alreadyHeld", true);
            return out;
        }
        if ("released".equals(payment.getStatus()) || "refunded".equals(payment.getStatus())) {
            Map<String, Object> out = outcome(payment);
            out.put("confirmed", true);
            out.put("alreadyReleased", true);
            return out;
        }
        if (!success) {
            payment.setStatus("failed");
            payment.setNotes("Paiement refusé ou annulé.");
            paymentRepository.save(payment);
            Map<String, Object> out = outcome(payment);
            out.put("confirmed", false);
            return out;
        }

        payment.setStatus("held");
        payment.setNotes("Fonds déposés en garde MboaTech (transaction #" + (transactionId != null ? transactionId : payment.getTransactionRef()) + ").");
        paymentRepository.save(payment);

        Long requestId = payment.getRequestId();
        if (requestId != null) {
            requestRepository.findById(requestId).ifPresent(request -> {
                request.setFundsDeposited(true);
                request.setUpdatedAt(LocalDateTime.now());
                requestRepository.save(request);
            });
            if (payment.getPayeeUserId() != null) {
                notificationService.create(payment.getPayeeUserId(), "Fonds sécurisés",
                        "Le client a déposé " + payment.getAmount() + " FCFA en garde pour la demande #" + requestId + ". Les travaux peuvent commencer.",
                        "request", requestId);
            }
            notifyAdmins("Fonds déposés en garde",
                    payment.getAmount() + " FCFA ont été déposés en garde pour la demande #" + requestId + ".");
        }

        Map<String, Object> out = outcome(payment);
        out.put("confirmed", true);
        return out;
    }

    private void notifyAdmins(String title, String text) {
        for (User admin : userRepository.findByRole(Role.admin)) {
            notificationService.create(admin.getId(), title, text, "system", null);
        }
    }

    private String fullName(User user) {
        String first = user.getFirstName() != null ? user.getFirstName() : "";
        String last = user.getLastName() != null ? user.getLastName() : "";
        return (first + " " + last).trim();
    }

    private Payment findPendingByReference(String reference) {
        if (reference == null) {
            return null;
        }
        return paymentRepository.findFirstByTransactionRef(reference)
                .filter(p -> "pending".equals(p.getStatus()))
                .orElse(null);
    }

    private Map<String, Object> outcome(Payment payment) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("success", true);
        out.put("paymentId", payment.getId());
        out.put("requestId", payment.getRequestId());
        out.put("amount", payment.getAmount());
        out.put("currency", payment.getCurrency());
        out.put("method", payment.getMethod());
        out.put("status", payment.getStatus());
        out.put("transactionRef", payment.getTransactionRef());
        out.put("txRef", payment.getTransactionRef());
        out.put("paymentUrl", payment.getPaymentUrl());
        return out;
    }
}
