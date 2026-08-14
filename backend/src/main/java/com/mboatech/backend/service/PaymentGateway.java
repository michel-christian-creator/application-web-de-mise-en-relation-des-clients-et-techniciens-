package com.mboatech.backend.service;

/**
 * Passerelle de paiement de la plateforme.
 *
 * <p><strong>Point d'intégration réservé :</strong> le débit réel (MTN MoMo, Orange Money, carte)
 * sera branché ici. L'implémentation actuellement active est {@link SimulatedPaymentGateway},
 * qui simule un paiement accepté afin de ne pas bloquer le flux en développement.
 *
 * <p>Quand l'API du fournisseur sera disponible, il suffira de fournir une nouvelle
 * implémentation de cette interface (appels HTTP, HMAC, callback de confirmation) et de la
 * brancher à la place du simulateur dans {@link PaymentService}.
 */
public interface PaymentGateway {

    /**
     * Tente de débiter l'utilisateur payeur du montant demandé.
     *
     * @param request détails du débit (demande, montant, méthode, payeur…)
     * @return un résultat contenant la référence de transaction en cas de succès.
     */
    PaymentResult charge(PaymentRequest request);
}
