package com.mboatech.backend.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Garde-fous contre l'accaparement des demandes d'intervention
 * (section missions dans application.yml, surchargeable par variables
 * d'environnement : MISSIONS_MAX_CONCURRENT, MISSIONS_RESERVATION_HOURS,
 * MISSIONS_MAX_DECLINES, MISSIONS_DECLINES_WINDOW_HOURS).
 * maxConcurrent = plafond de demandes réservées PAR NIVEAU D'URGENCE.
 */
@Component
@ConfigurationProperties(prefix = "missions")
public class MissionsProperties {

    private int maxConcurrent = 3;

    private long reservationHours = 24;

    private long reservationCritiqueHours = 1;

    private long reservationImportantHours = 4;

    private long reservationNormalHours = 8;

    private int maxDeclines = 3;

    private long declinesWindowHours = 24;

    public int getMaxConcurrent() {
        return maxConcurrent;
    }

    public void setMaxConcurrent(int maxConcurrent) {
        this.maxConcurrent = maxConcurrent;
    }

    public long getReservationHours() {
        return reservationHours;
    }

    public void setReservationHours(long reservationHours) {
        this.reservationHours = reservationHours;
    }

    public long getReservationCritiqueHours() {
        return reservationCritiqueHours;
    }

    public void setReservationCritiqueHours(long reservationCritiqueHours) {
        this.reservationCritiqueHours = reservationCritiqueHours;
    }

    public long getReservationImportantHours() {
        return reservationImportantHours;
    }

    public void setReservationImportantHours(long reservationImportantHours) {
        this.reservationImportantHours = reservationImportantHours;
    }

    public long getReservationNormalHours() {
        return reservationNormalHours;
    }

    public void setReservationNormalHours(long reservationNormalHours) {
        this.reservationNormalHours = reservationNormalHours;
    }

    public int getMaxDeclines() {
        return maxDeclines;
    }

    public void setMaxDeclines(int maxDeclines) {
        this.maxDeclines = maxDeclines;
    }

    public long getDeclinesWindowHours() {
        return declinesWindowHours;
    }

    public void setDeclinesWindowHours(long declinesWindowHours) {
        this.declinesWindowHours = declinesWindowHours;
    }
}
