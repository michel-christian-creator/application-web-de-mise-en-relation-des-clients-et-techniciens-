/**
 * Validation et assainissement des saisies utilisateur.
 *
 * Défense en profondeur contre les injections SQL et autres entrées malveillantes :
 * les caractères de contrôle sont supprimés, les tailles sont bornées et les
 * motifs d'injection classiques sont détectés avant l'envoi au serveur.
 */

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u00AD]/g
const ZERO_WIDTH_CHARS = /[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g

export const MAX_NAME_LENGTH = 80
export const MAX_TEXT_LENGTH = 500
export const MAX_MULTILINE_LENGTH = 2000
export const MAX_PASSWORD_LENGTH = 128

/** Supprime les caractères de contrôle et les marqueurs invisibles. */
export function stripUnsafeChars(value: string, preserveNewlines = false): string {
  const unsafe = preserveNewlines
    ? CONTROL_CHARS
    : /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u00AD]/g
  return (value ?? "")
    .replace(unsafe, "")
    .replace(ZERO_WIDTH_CHARS, "")
    .replace(/\r\n?/g, "\n")
    .trim()
}

/** Champ texte sur une ligne : nettoyé, borné, sans caractères de contrôle. */
export function sanitizeText(value: string, maxLength = MAX_TEXT_LENGTH): string {
  return stripUnsafeChars(value, false).slice(0, maxLength)
}

/** Champ texte multiligne (description, avis, bio) : conserve les retours à la ligne. */
export function sanitizeMultiline(value: string, maxLength = MAX_MULTILINE_LENGTH): string {
  return stripUnsafeChars(value, true).slice(0, maxLength)
}

/** Validation simple d'adresse email. */
export function isValidEmail(value: string): boolean {
  const email = (value ?? "").trim()
  if (email.length < 3 || email.length > 254) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

/** Numéro de téléphone (8 à 15 chiffres, préfixe + autorisé). */
export function isValidPhone(value: string): boolean {
  const digits = (value ?? "").replace(/[\s().-]/g, "")
  return /^\+?[0-9]{8,15}$/.test(digits)
}

/** Montant en FCFA : entier positif borné. */
export function isValidAmount(value: number): boolean {
  return Number.isFinite(value) && value > 0 && value <= 100_000_000 && Number.isInteger(value)
}

const LETTERS_ONLY = /^[\p{L} .'’-]+$/u
const DIGITS_ONLY = /^[0-9]+$/
const USERNAME_PATTERN = /^[A-Za-z0-9._-]{3,30}$/

/** Nom ou ville : uniquement lettres, accents, espaces, apostrophes, tirets et points. */
export function isValidName(value: string): boolean {
  const name = (value ?? "").trim()
  if (name.length < 2 || name.length > 80) return false
  return LETTERS_ONLY.test(name)
}

/** Ne garde que les chiffres (téléphone, montant saisi au clavier). */
export function sanitizeDigits(value: string): string {
  return (value ?? "").replace(/\D/g, "")
}

/** Ne garde que les lettres, espaces et ponctuations de nom. */
export function sanitizeLetters(value: string): string {
  return (value ?? "").replace(/[^\p{L} .'’-]/gu, "").slice(0, 80)
}

/** True si la valeur ne contient que des chiffres. */
export function isOnlyDigits(value: string): boolean {
  return DIGITS_ONLY.test((value ?? "").trim())
}

/** Nom d'utilisateur : 3 à 30 caractères alphanumériques (point, tiret, underscore). */
export function isValidUsername(value: string): boolean {
  return USERNAME_PATTERN.test((value ?? "").trim())
}

/** Ne garde que les caractères autorisés d'un nom d'utilisateur. */
export function sanitizeUsername(value: string): string {
  return (value ?? "").replace(/[^A-Za-z0-9._-]/g, "").slice(0, 30)
}

/**
 * Détecte les motifs classiques d'injection SQL (commentaires, requêtes
 * multi-instructions, unions, fonctions d'endormissement, octets nuls…).
 */
const SQL_INJECTION_PATTERNS = [
  /[\u0000]/,
  /'?\s*--[^-\n]*/,
  /\/\*[\s\S]*?\*\//,
  /;\s*(drop|delete|update|insert|select|alter|truncate|create|exec|execute|declare|grant|revoke)\b/i,
  /\bunion\s+(all\s+)?(select|distinct)\b/i,
  /\bselect\b[\s\S]{0,80}\bfrom\b/i,
  /\b(insert\s+into|delete\s+from|drop\s+table|truncate\s+table|alter\s+table|create\s+table|create\s+procedure)\b/i,
  /\b(exec|execute)\s*\(/i,
  /\bxp_[a-z0-9_]+\b/i,
  /\b(pg_sleep|sleep|benchmark|waitfor)\s*\(/i,
  /\bwaitfor\s+delay\b/i,
  /\bdeclare\b/i,
  /0x[0-9a-f]{6,}/i,
]

/** Retourne true si l'entrée ressemble à une tentative d'injection SQL. */
export function hasSqlInjectionPattern(value: string): boolean {
  if (!value) return false
  return SQL_INJECTION_PATTERNS.some((pattern) => pattern.test(value))
}

export interface ValidationResult {
  valid: boolean
  field?: string
  message?: string
}

/**
 * Valide un ensemble de champs : assainit chaque valeur, vérifie les longueurs
 * et la présence de motifs d'injection. Retourne l'erreur rencontrée ou null.
 */
export function validateFields(
  fields: Array<{
    key: string
    label: string
    value: string
    maxLength?: number
    required?: boolean
  }>,
): ValidationResult {
  for (const field of fields) {
    if (!field.value) {
      if (field.required)
        return {
          valid: false,
          field: field.key,
          message: `Veuillez renseigner votre ${field.label}.`,
        }
      continue
    }
    const max = field.maxLength ?? MAX_TEXT_LENGTH
    if (field.value.length > max) {
      return {
        valid: false,
        field: field.key,
        message: `Le champ « ${field.label} » ne doit pas dépasser ${max} caractères.`,
      }
    }
    if (hasSqlInjectionPattern(field.value)) {
      return {
        valid: false,
        field: field.key,
        message: `Le champ « ${field.label} » contient des caractères ou expressions non autorisés.`,
      }
    }
  }
  return { valid: true }
}
