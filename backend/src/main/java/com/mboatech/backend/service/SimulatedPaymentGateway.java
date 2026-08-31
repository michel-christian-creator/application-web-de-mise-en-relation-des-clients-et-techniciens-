package com.mboatech.backend.service;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * Implémentation de repli de {@link PaymentGateway} qui accepte tous les débits
 * sans contacter un fournisseur réel. N'est active que lorsque la passerelle
 * « hr skills pay » est désactivée ({@code hrskills.enabled} absent ou {@code false}).
 *
 * <p>Avec la passerelle active, c'est {@link RealPaymentGateway} qui est injecté.</p>
 */
@Component
@ConditionalOnProperty(name = "hrskills.enabled", havingValue = "false", matchIfMissing = true)
public class SimulatedPaymentGateway implements PaymentGateway {

    @Override
    public PaymentResult charge(PaymentRequest request) {
        System.out.println("[DEBUG] SimulatedPaymentGateway.charge appelé - amount=" + request.getAmount() + ", phone=" + request.getPayerPhone() + ", method=" + request.getMethod());
        String transactionRef = "SIM-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12).toUpperCase();
        return PaymentResult.success(transactionRef);
    }
}
