package com.mboatech.backend.util;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.regex.Pattern;

/**
 * Validation et assainissement des saisies utilisateur côté serveur.
 *
 * Double sécurité avec le module frontend (src/utils/validation.ts) :
 * bornes de longueur, contrôle du type de contenu (lettres / chiffres) et
 * détection des motifs d'injection avant tout enregistrement en base.
 */
public final class InputValidator {

    private InputValidator() {
    }

    public static final int MAX_TEXT_LENGTH = 500;
    public static final int MAX_MULTILINE_LENGTH = 2000;
    public static final int MAX_NAME_LENGTH = 80;
    public static final BigDecimal MAX_AMOUNT = new BigDecimal("100000000");

    private static final Pattern CONTROL_CHARS = Pattern.compile("[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u00AD]");
    private static final Pattern ZERO_WIDTH_CHARS = Pattern.compile("[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]");
    private static final Pattern NAME_PATTERN = Pattern.compile("^[\\p{L} .'’’-]{2,80}$");
    private static final Pattern USERNAME_PATTERN = Pattern.compile("^[A-Za-z0-9._-]{3,30}$");
    private static final Pattern PHONE_PATTERN = Pattern.compile("^\\+?[0-9]{8,15}$");

    private static final Pattern[] SQL_INJECTION_PATTERNS = {
            Pattern.compile("[\u0000]"),
            Pattern.compile("'?\\s*--[^-\\n]*"),
            Pattern.compile("/\\*[\\s\\S]*?\\*/"),
            Pattern.compile(";\\s*(drop|delete|update|insert|select|alter|truncate|create|exec|execute|declare|grant|revoke)\\b", Pattern.CASE_INSENSITIVE),
            Pattern.compile("\\bunion\\s+(all\\s+)?(select|distinct)\\b", Pattern.CASE_INSENSITIVE),
            Pattern.compile("\\bselect\\b[\\s\\S]{0,80}\\bfrom\\b", Pattern.CASE_INSENSITIVE),
            Pattern.compile("\\b(insert\\s+into|delete\\s+from|drop\\s+table|truncate\\s+table|alter\\s+table|create\\s+table|create\\s+procedure)\\b", Pattern.CASE_INSENSITIVE),
            Pattern.compile("\\b(exec|execute)\\s*\\(", Pattern.CASE_INSENSITIVE),
            Pattern.compile("\\bxp_[a-z0-9_]+\\b", Pattern.CASE_INSENSITIVE),
            Pattern.compile("\\b(pg_sleep|sleep|benchmark|waitfor)\\s*\\(", Pattern.CASE_INSENSITIVE),
            Pattern.compile("\\bwaitfor\\s+delay\\b", Pattern.CASE_INSENSITIVE),
            Pattern.compile("\\bdeclare\\b", Pattern.CASE_INSENSITIVE),
            Pattern.compile("0x[0-9a-f]{6,}", Pattern.CASE_INSENSITIVE),
    };

    /** Nettoie un champ texte sur une ligne : caractères de contrôle retirés, borné, trimmé. */
    public static String sanitizeText(String value, int maxLength) {
        String cleaned = (value == null ? "" : value)
                .replaceAll(CONTROL_CHARS.pattern(), "")
                .replaceAll(ZERO_WIDTH_CHARS.pattern(), "")
                .replace("\r\n", "\n")
                .trim();
        return cleaned.length() > maxLength ? cleaned.substring(0, maxLength) : cleaned;
    }

    /** Nettoie un champ multiligne en conservant les retours à la ligne. */
    public static String sanitizeMultiline(String value, int maxLength) {
        String cleaned = (value == null ? "" : value)
                .replaceAll(CONTROL_CHARS.pattern(), "")
                .replaceAll(ZERO_WIDTH_CHARS.pattern(), "")
                .trim();
        return cleaned.length() > maxLength ? cleaned.substring(0, maxLength) : cleaned;
    }

    public static boolean hasSqlInjectionPattern(String value) {
        if (value == null || value.isBlank()) {
            return false;
        }
        for (Pattern pattern : SQL_INJECTION_PATTERNS) {
            if (pattern.matcher(value).find()) {
                return true;
            }
        }
        return false;
    }

    /** Nom (prénom, ville, quartier…) : uniquement lettres, accents, espaces, apostrophes, tirets et points. */
    public static boolean isValidName(String value) {
        if (value == null || value.isBlank()) {
            return false;
        }
        String cleaned = value.trim();
        return NAME_PATTERN.matcher(cleaned).matches();
    }

    /** Nom d'utilisateur : 3 à 30 caractères alphanumériques (point, tiret, underscore autorisés). */
    public static boolean isValidUsername(String value) {
        if (value == null || value.isBlank()) {
            return false;
        }
        return USERNAME_PATTERN.matcher(value.trim()).matches();
    }

    /** Numéro de téléphone : 8 à 15 chiffres, préfixe « + » autorisé. */
    public static boolean isValidPhone(String value) {
        if (value == null || value.isBlank()) {
            return false;
        }
        String digits = value.replaceAll("[\\s().-]", "");
        return PHONE_PATTERN.matcher(digits).matches();
    }

    /** Montant FCFA : entier positif borné à 100 000 000. */
    public static boolean isValidAmount(BigDecimal value) {
        if (value == null) {
            return false;
        }
        if (value.signum() <= 0 || value.compareTo(MAX_AMOUNT) > 0) {
            return false;
        }
        return value.stripTrailingZeros().scale() <= 0;
    }

    /** Créneau d'intervention : présent et non passé. */
    public static boolean isValidSchedule(LocalDateTime value) {
        return value != null && value.isAfter(LocalDateTime.now().minusMinutes(1));
    }
}
