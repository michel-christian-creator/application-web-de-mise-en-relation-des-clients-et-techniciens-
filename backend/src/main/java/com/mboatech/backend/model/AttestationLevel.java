package com.mboatech.backend.model;

public enum AttestationLevel {
    BRONZE(1),
    SILVER(2),
    GOLD(3),
    DIAMOND(5);

    private final int requiredInterventions;

    AttestationLevel(int requiredInterventions) {
        this.requiredInterventions = requiredInterventions;
    }

    public int getRequiredInterventions() {
        return requiredInterventions;
    }

    public AttestationLevel next() {
        return switch (this) {
            case BRONZE -> SILVER;
            case SILVER -> GOLD;
            case GOLD -> DIAMOND;
            case DIAMOND -> null;
        };
    }
}
