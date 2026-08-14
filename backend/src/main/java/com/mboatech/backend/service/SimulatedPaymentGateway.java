package com.mboatech.backend.service;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * Implémentation de repli de {@link PaymentGateway} qui accepte tous les débits
 * sans contacter un fournisseur réel. N'est active que lorsque la passerelle
 * Paymee est désactivée ({@code paymee.enabled} absent ou {@code false}).
 *
 * <p>Avec Paymee actif, c'est {@link RealPaymentGateway} qui est injecté.</p>
 */
@Component
@ConditionalOnProperty(name = "paymee.enabled", havingValue = "false", matchIfMissing = true)
public class SimulatedPaymentGateway implements PaymentGateway {

    @Override
    public PaymentResult charge(PaymentRequest request) {
        String transactionRef = "SIM-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12).toUpperCase();
        return PaymentResult.success(transactionRef);
    }
}
