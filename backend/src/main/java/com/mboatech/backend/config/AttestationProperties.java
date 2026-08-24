package com.mboatech.backend.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Paramètres du programme d'attestations de service (section attestation dans
 * application.yml, surchargeable par variables d'environnement :
 * ATTESTATION_MIN_RATING, ATTESTATION_NUMBER_PREFIX, ATTESTATION_PLATFORM_NAME,
 * ATTESTATION_TITLE, ATTESTATION_SIGNATORY_NAME, ATTESTATION_SIGNATORY_ROLE,
 * ATTESTATION_THRESHOLD_BRONZE / _SILVER / _GOLD / _DIAMOND).
 */
@Component
@ConfigurationProperties(prefix = "attestation")
public class AttestationProperties {

    /** Note moyenne minimum pour pouvoir générer une attestation. */
    private double minRating = 3.5;

    /** Préfixe des numéros d'attestation (le suffixe est l'ID auto-incrément). */
    private String numberPrefix = "MBT-";

    /** Nom de la plateforme affiché sur le certificat. */
    private String platformName = "MboaTech";

    /** Titre principal imprimé sur le certificat. */
    private String title = "ATTESTATION DE SERVICE";

    /** Mention sous la signature dessinée (le nom n'est pas imprimé). */
    private String signatoryRole = "RESPONSABLE PLATEFORME";

    /** Seuils d'interventions par niveau (bronze < silver < gold < diamond). */
    private int thresholdBronze = 1;

    private int thresholdSilver = 2;

    private int thresholdGold = 3;

    private int thresholdDiamond = 5;

    public double getMinRating() {
        return minRating;
    }

    public void setMinRating(double minRating) {
        this.minRating = minRating;
    }

    public String getNumberPrefix() {
        return numberPrefix;
    }

    public void setNumberPrefix(String numberPrefix) {
        this.numberPrefix = numberPrefix;
    }

    public String getPlatformName() {
        return platformName;
    }

    public void setPlatformName(String platformName) {
        this.platformName = platformName;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getSignatoryRole() {
        return signatoryRole;
    }

    public void setSignatoryRole(String signatoryRole) {
        this.signatoryRole = signatoryRole;
    }

    public int getThresholdBronze() {
        return thresholdBronze;
    }

    public void setThresholdBronze(int thresholdBronze) {
        this.thresholdBronze = thresholdBronze;
    }

    public int getThresholdSilver() {
        return thresholdSilver;
    }

    public void setThresholdSilver(int thresholdSilver) {
        this.thresholdSilver = thresholdSilver;
    }

    public int getThresholdGold() {
        return thresholdGold;
    }

    public void setThresholdGold(int thresholdGold) {
        this.thresholdGold = thresholdGold;
    }

    public int getThresholdDiamond() {
        return thresholdDiamond;
    }

    public void setThresholdDiamond(int thresholdDiamond) {
        this.thresholdDiamond = thresholdDiamond;
    }
}
