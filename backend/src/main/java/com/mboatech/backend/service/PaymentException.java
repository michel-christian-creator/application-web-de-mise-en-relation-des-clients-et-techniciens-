package com.mboatech.backend.service;

/** Erreur métier liée au dépôt/au débit des fonds en garde. */
public class PaymentException extends RuntimeException {

    public PaymentException(String message) {
        super(message);
    }
}
