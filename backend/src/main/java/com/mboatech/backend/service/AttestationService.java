package com.mboatech.backend.service;

import com.mboatech.backend.model.Attestation;
import com.mboatech.backend.model.AttestationLevel;
import com.mboatech.backend.model.TechnicianProfile;
import com.mboatech.backend.model.TechnicianRecommendation;
import com.mboatech.backend.model.User;
import com.mboatech.backend.config.AttestationProperties;
import com.mboatech.backend.repository.AttestationRepository;
import com.mboatech.backend.repository.TechnicianProfileRepository;
import com.mboatech.backend.repository.TechnicianRecommendationRepository;
import com.mboatech.backend.repository.UserRepository;
import com.lowagie.text.Document;
import com.lowagie.text.Element;
import com.lowagie.text.Font;
import com.lowagie.text.FontFactory;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.Phrase;
import com.lowagie.text.pdf.ColumnText;
import com.lowagie.text.pdf.PdfContentByte;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class AttestationService {

    private static final Logger logger = LoggerFactory.getLogger(AttestationService.class);

    private final AttestationRepository attestationRepository;
    private final TechnicianProfileRepository technicianProfileRepository;
    private final TechnicianRecommendationRepository technicianRecommendationRepository;
    private final UserRepository userRepository;
    private final JdbcTemplate jdbcTemplate;
    private final AttestationProperties attestationProperties;

    public AttestationService(AttestationRepository attestationRepository,
                              TechnicianProfileRepository technicianProfileRepository,
                              TechnicianRecommendationRepository technicianRecommendationRepository,
                              UserRepository userRepository,
                              JdbcTemplate jdbcTemplate,
                              AttestationProperties attestationProperties) {
        this.attestationRepository = attestationRepository;
        this.technicianProfileRepository = technicianProfileRepository;
        this.technicianRecommendationRepository = technicianRecommendationRepository;
        this.userRepository = userRepository;
        this.jdbcTemplate = jdbcTemplate;
        this.attestationProperties = attestationProperties;
    }

    public Map<String, Object> checkEligibility(Long techId) {
        Map<String, Object> result = new LinkedHashMap<>();

        int completedCount = countCompletedInterventions(techId);
        double avgRating = liveRatingAvg(techId);

        AttestationLevel currentLevel = resolveLevel(completedCount);
        AttestationLevel nextLevel = currentLevel != null ? currentLevel.next() : AttestationLevel.BRONZE;

        boolean eligible = currentLevel != null && avgRating >= attestationProperties.getMinRating();

        int interventionsNeeded = 0;
        if (nextLevel != null) {
            interventionsNeeded = Math.max(0, requiredInterventionsFor(nextLevel) - completedCount);
        }

        Optional<Attestation> lastAttestation = attestationRepository.findTopByTechnicianIdOrderByGeneratedAtDesc(techId);
        String lastAttestationNumber = lastAttestation.map(Attestation::getAttestationNumber).orElse(null);
        String lastAttestationLevel = lastAttestation.map(a -> a.getLevel().name()).orElse(null);

        result.put("eligible", eligible);
        result.put("completedCount", completedCount);
        result.put("avgRating", avgRating);
        // Tous les niveaux dont le seuil est atteint : le technicien peut
        // télécharger le certificat de chacun d'eux, pas seulement le courant.
        java.util.List<String> reachedLevels = new java.util.ArrayList<>();
        for (AttestationLevel lv : AttestationLevel.values()) {
            if (completedCount >= requiredInterventionsFor(lv)) {
                reachedLevels.add(lv.name());
            }
        }
        result.put("reachedLevels", reachedLevels);
        result.put("minRating", attestationProperties.getMinRating());
        result.put("ratingMet", avgRating >= attestationProperties.getMinRating());
        result.put("currentLevel", currentLevel != null ? currentLevel.name() : null);
        result.put("currentLevelThreshold", currentLevel != null ? requiredInterventionsFor(currentLevel) : 0);
        result.put("nextLevel", nextLevel != null ? nextLevel.name() : null);
        result.put("nextLevelThreshold", nextLevel != null ? requiredInterventionsFor(nextLevel) : 0);
        result.put("interventionsNeeded", interventionsNeeded);
        result.put("lastAttestationNumber", lastAttestationNumber);
        result.put("lastAttestationLevel", lastAttestationLevel);

        return result;
    }

    public byte[] generate(Long techId) {
        TechnicianProfile profile = technicianProfileRepository.findById(techId)
                .orElseThrow(() -> new RuntimeException("Profil technicien introuvable."));

        int completedCount = countCompletedInterventions(techId);
        double avgRating = liveRatingAvg(techId);

        AttestationLevel level = resolveLevel(completedCount);
        if (level == null) {
            throw new RuntimeException("Seuil d'interventions non atteint.");
        }
        if (avgRating < attestationProperties.getMinRating()) {
            throw new RuntimeException("Note moyenne insuffisante (minimum " + attestationProperties.getMinRating() + "/5).");
        }

        Attestation attestation = upsertAttestation(profile, level, completedCount, avgRating);
        return generatePdf(attestation, profile, resolveFullName(profile));
    }

    /**
     * Génère (ou met à jour puis restitue) l'attestation d'un niveau précis
     * déjà atteint par le technicien : permet de retélécharger les
     * certificats des paliers antérieurs (Bronze, Silver...) sans créer de
     * doublon — une seule ligne par niveau, numéro immuable.
     */
    public byte[] generateForLevel(Long techId, AttestationLevel target) {
        TechnicianProfile profile = technicianProfileRepository.findById(techId)
                .orElseThrow(() -> new RuntimeException("Profil technicien introuvable."));

        int completedCount = countCompletedInterventions(techId);
        if (completedCount < requiredInterventionsFor(target)) {
            throw new RuntimeException("Seuil non atteint pour le niveau " + target.name() + ".");
        }
        double avgRating = liveRatingAvg(techId);
        if (avgRating < attestationProperties.getMinRating()) {
            throw new RuntimeException("Note moyenne insuffisante (minimum " + attestationProperties.getMinRating() + "/5).");
        }

        Attestation attestation = upsertAttestation(profile, target, completedCount, avgRating);
        return generatePdf(attestation, profile, resolveFullName(profile));
    }

    private String resolveFullName(TechnicianProfile profile) {
        User user = profile.getUser();
        String fullName = ((user.getFirstName() != null ? user.getFirstName() : "")
                + " " + (user.getLastName() != null ? user.getLastName() : "")).trim();
        if (fullName.isBlank()) {
            fullName = user.getUsername();
        }
        return fullName;
    }

    // Une seule attestation par catégorie : si une attestation du même
    // niveau existe déjà, on la met simplement à jour (compteurs, note,
    // date) au lieu de créer un doublon.
    private Attestation upsertAttestation(TechnicianProfile profile, AttestationLevel level,
                                          int completedCount, double avgRating) {
        Long techId = profile.getId();
        Optional<Attestation> existing = attestationRepository.findByTechnicianIdAndLevel(techId, level);
        if (existing.isPresent()) {
            Attestation attestation = existing.get();
            attestation.setInterventionCount(completedCount);
            attestation.setAvgRating(avgRating);
            attestation = attestationRepository.save(attestation);
            logger.info("Attestation {} mise à jour pour technicien id={} ({} interventions, note {})",
                    attestation.getAttestationNumber(), techId, completedCount, avgRating);
            return attestation;
        }
        return createAttestation(profile, level, completedCount, avgRating);
    }

    // Création protégée contre les doublons : synchronisée pour éviter que
    // deux consultations simultanées créent la même ligne, avec revérification
    // de l'existence sous le verrou.
    private synchronized Attestation createAttestation(TechnicianProfile profile, AttestationLevel level,
                                                       int completedCount, double avgRating) {
        Long techId = profile.getId();
        Optional<Attestation> existing = attestationRepository.findByTechnicianIdAndLevel(techId, level);
        if (existing.isPresent()) {
            return existing.get();
        }

        Attestation attestation = new Attestation();
        attestation.setTechnician(profile);
        attestation.setInterventionCount(completedCount);
        attestation.setAvgRating(avgRating);
        attestation.setLevel(level);
        // La colonne attestation_number est NOT NULL + UNIQUE et de taille
        // réduite (~15 caractères en base) : on insère avec un jeton
        // provisoire COURT et quasi unique pour obtenir l'ID auto-incrémenté,
        // puis on le remplace par le numéro définitif construit sur cet ID.
        attestation.setAttestationNumber("T" + Long.toString(System.nanoTime(), 36));
        attestation = attestationRepository.save(attestation);
        String attestationNumber = generateAttestationNumber(attestation.getId());
        attestation.setAttestationNumber(attestationNumber);
        attestationRepository.save(attestation);

        logger.info("Attestation {} générée pour technicien id={} ({} interventions, note {})",
                attestationNumber, techId, completedCount, avgRating);
        return attestation;
    }

    /**
     * Provisionne automatiquement les attestations gagnées : dès qu'un niveau
     * est atteint (seuil d'interventions + note minimum), sa ligne existe en
     * base — même si le technicien n'a jamais cliqué sur « Télécharger ».
     * Ainsi les clients peuvent consulter chaque certificat dès qu'il est
     * réellement mérité. Les lignes existantes ne sont pas touchées (leur
     * date/numéro restent ceux de l'émission).
     */
    private void ensureEarnedAttestations(Long techId) {
        TechnicianProfile profile = technicianProfileRepository.findById(techId).orElse(null);
        if (profile == null) {
            return;
        }
        int completedCount = countCompletedInterventions(techId);
        double avgRating = liveRatingAvg(techId);
        if (avgRating < attestationProperties.getMinRating()) {
            return;
        }
        for (AttestationLevel lv : AttestationLevel.values()) {
            if (completedCount >= requiredInterventionsFor(lv)) {
                createAttestation(profile, lv, completedCount, avgRating);
            }
        }
    }

    public List<Map<String, Object>> getHistory(Long techId) {
        // S'assure que tous les niveaux gagnés existent avant de lire :
        // un client qui consulte un profil voit toujours les certificats
        // réellement mérités par le technicien.
        ensureEarnedAttestations(techId);
        List<Attestation> attestations = attestationRepository.findByTechnicianIdOrderByGeneratedAtDesc(techId);
        // Dédoublonnage : une seule entrée par catégorie (la plus récente),
        // affichée du niveau le plus élevé au plus bas. La liste est triée
        // par date décroissante, donc la 1re occurrence est la plus récente.
        Map<AttestationLevel, Attestation> latestByLevel = new LinkedHashMap<>();
        for (Attestation a : attestations) {
            latestByLevel.putIfAbsent(a.getLevel(), a);
        }
        return latestByLevel.values().stream()
                .sorted(Comparator.comparing((Attestation a) -> a.getLevel()).reversed())
                .limit(10)
                .map(a -> {
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("id", a.getId());
                    item.put("attestationNumber", a.getAttestationNumber());
                    item.put("level", a.getLevel().name());
                    item.put("interventionCount", a.getInterventionCount());
                    item.put("avgRating", a.getAvgRating());
                    item.put("generatedAt", a.getGeneratedAt() != null ? a.getGeneratedAt().toLocalDateTime().toString() : null);
                    return item;
                }).toList();
    }

    /**
     * Regénère les octets PDF d'une attestation existante (lecture publique
     * : permet aux clients de consulter le certificat d'un technicien).
     */
    public byte[] renderById(Long attestationId) {
        Attestation attestation = attestationRepository.findById(attestationId)
                .orElseThrow(() -> new RuntimeException("Attestation introuvable."));
        TechnicianProfile profile = attestation.getTechnician();
        User user = profile.getUser();
        String fullName = ((user.getFirstName() != null ? user.getFirstName() : "")
                + " " + (user.getLastName() != null ? user.getLastName() : "")).trim();
        if (fullName.isBlank()) {
            fullName = user.getUsername();
        }
        return generatePdf(attestation, profile, fullName);
    }

    private int countCompletedInterventions(Long techId) {
        Long count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM service_requests WHERE technician_id = ? AND status = 'completed'",
                Long.class, techId);
        return count != null ? count.intValue() : 0;
    }

    private double liveRatingAvg(Long techId) {
        List<TechnicianRecommendation> rated = technicianRecommendationRepository
                .findByTechnicianIdAndRatingNotNullOrderByCreatedAtDesc(techId);
        if (rated.isEmpty()) {
            return 0.0;
        }
        double avg = rated.stream()
                .mapToInt(r -> r.getRating() == null ? 0 : r.getRating())
                .average()
                .orElse(0.0);
        return Math.round(avg * 10.0) / 10.0;
    }

    private AttestationLevel resolveLevel(int completedCount) {
        AttestationLevel resolved = null;
        for (AttestationLevel level : AttestationLevel.values()) {
            if (completedCount >= requiredInterventionsFor(level)) {
                resolved = level;
            }
        }
        return resolved;
    }

    /**
     * Seuil d'interventions requis pour un niveau, lu depuis la configuration
     * (attestation.threshold-*) et non plus codé en dur dans l'enum.
     */
    private int requiredInterventionsFor(AttestationLevel level) {
        return switch (level) {
            case BRONZE -> attestationProperties.getThresholdBronze();
            case SILVER -> attestationProperties.getThresholdSilver();
            case GOLD -> attestationProperties.getThresholdGold();
            case DIAMOND -> attestationProperties.getThresholdDiamond();
        };
    }

    private String generateAttestationNumber(Long attestationId) {
        long year = LocalDate.now().getYear();
        return attestationProperties.getNumberPrefix() + year + "-" + String.format("%06d", attestationId);
    }

    /**
     * Fond du certificat : chaque catégorie possède une teinte unique
     * (cuivre / gris acier / or champagne / bleu glacier). L'écriture et
     * les ornements restent, eux, identiques pour tous les niveaux : la
     * distinction se fait uniquement par la couleur du fond.
     */
    private Color backgroundColor(AttestationLevel level) {
        return switch (level) {
            case BRONZE  -> new Color(243, 229, 208);
            case SILVER  -> new Color(233, 236, 240);
            case GOLD    -> new Color(251, 242, 212);
            case DIAMOND -> new Color(221, 238, 250);
        };
    }

    private static final Color GOLD = new Color(176, 138, 62);
    private static final Color GOLD_LIGHT = new Color(217, 185, 120);
    private static final Color NAVY = new Color(30, 58, 99);
    private static final Color NAVY_DARK = new Color(20, 39, 67);
    private static final Color INK = new Color(38, 38, 36);

    // ============================================================
    //  GENERATION PDF — tout est positionné en ABSOLU (ColumnText /
    //  canvas). On n'utilise plus document.add() pour le contenu :
    //  c'était la cause du chevauchement (le flux ignorait les
    //  éléments dessinés en absolu comme le tableau ou le sceau).
    // ============================================================
    private byte[] generatePdf(Attestation attestation, TechnicianProfile profile, String fullName) {
        com.lowagie.text.Rectangle pageSize = PageSize.A4.rotate();
        float PAD = 0; // on gère nous-mêmes toutes les marges en absolu
        Document document = new Document(pageSize, PAD, PAD, PAD, PAD);
        ByteArrayOutputStream baos = new ByteArrayOutputStream();

        try {
            PdfWriter writer = PdfWriter.getInstance(document, baos);
            document.open();

            // Fond propre au niveau : la différence entre catégories se fait
            // sur la couleur du fond ; l'écriture reste identique partout.
            final Color PAGE_BG = backgroundColor(attestation.getLevel());
            final Color ROW_SEP = new Color(176, 138, 62, 115);

            PdfContentByte canvas = writer.getDirectContent();
            float W = pageSize.getWidth();   // 842 en A4 paysage
            float H = pageSize.getHeight();  // 595 en A4 paysage

            // ── Polices (chargées une fois avec repli si non enregistrées) ──
            Font titleFont   = loadTitleFont(34, NAVY_DARK);
            Font introFont   = FontFactory.getFont(FontFactory.TIMES_ROMAN, 15.5f, INK);
            Font nameFont    = FontFactory.getFont(FontFactory.TIMES_ROMAN, 15.5f, Font.BOLD, NAVY);
            Font platformFont= FontFactory.getFont(FontFactory.TIMES_ROMAN, 15.5f, Font.BOLD, NAVY);
            Font closingFont = FontFactory.getFont(FontFactory.TIMES_ROMAN, 13f, Font.ITALIC, INK);
            Font labelFont   = FontFactory.getFont(FontFactory.TIMES_ROMAN, 13.5f, Font.BOLD, new Color(138, 106, 42));
            Font valueFont   = FontFactory.getFont(FontFactory.TIMES_ROMAN, 13.5f, INK);
            Font strongFont  = FontFactory.getFont(FontFactory.TIMES_ROMAN, 14.5f, Font.BOLD, NAVY);
            Font monoFont    = FontFactory.getFont(FontFactory.HELVETICA, 12.5f, INK);
            Font sigLabelFont= FontFactory.getFont(FontFactory.HELVETICA, 9.5f, Font.BOLD, new Color(138, 106, 42));

            // ── 1. Fond teinté par niveau + reflets ──
            canvas.setColorFill(PAGE_BG);
            canvas.rectangle(0, 0, W, H);
            canvas.fill();
            canvas.saveState();
            drawSoftGlow(canvas, W * 0.12f, H * 0.90f, 200, new Color(255, 255, 255, 140));
            drawSoftGlow(canvas, W * 0.88f, H * 0.10f, 160, new Color(255, 255, 255, 90));
            canvas.restoreState();

            // ── 2. Cadres ──
            drawOrnamentalFrame(canvas, 18, W - 36, 18, H - 36, GOLD, GOLD_LIGHT);
            canvas.setColorStroke(GOLD);
            canvas.setLineWidth(1.5f);
            canvas.rectangle(48, 48, W - 96, H - 96);
            canvas.stroke();
            canvas.setLineWidth(0.6f);
            canvas.rectangle(52, 52, W - 104, H - 104);
            canvas.stroke();

            // ── 3. Motif circuit + coins floraux ──
            // Inset recalculé à partir des vraies zones de contenu (intro,
            // texte de clôture) pour garantir qu'il ne les chevauche jamais
            // — voir le commentaire dans drawCircuitMotif pour le détail
            // des marges de sécurité utilisées.
            drawCircuitMotif(canvas, W - 54, H - 54, 1, 1, NAVY);
            drawCircuitMotif(canvas, 54, 54, -1, -1, NAVY);
            drawFloralCorner(canvas, 48, H - 48, 1, 1, GOLD, GOLD_LIGHT);
            drawFloralCorner(canvas, W - 48, H - 48, -1, 1, GOLD, GOLD_LIGHT);
            drawFloralCorner(canvas, 48, 48, 1, -1, GOLD, GOLD_LIGHT);
            drawFloralCorner(canvas, W - 48, 48, -1, -1, GOLD, GOLD_LIGHT);

            // ============================================================
            //  LAYOUT VERTICAL — calculé de haut en bas, une seule fois.
            //  Toutes les tailles ci-dessous sont des constantes que tu
            //  peux ajuster ; l'important est qu'elles ne se chevauchent
            //  jamais car chaque bloc "réserve" sa zone.
            // ============================================================
            float titleY     = H - 78;   // baseline du titre
            float dividerY   = H - 108;  // centre de l'ornement sous le titre

            float introTop    = H - 128;
            float introBottom = H - 182;   // ~54pt -> jusqu'à 2 lignes
            float introWidth  = 620;
            float introLeft   = (W - introWidth) / 2;

            float tableW = 500;
            float tableH = 235;
            float tableX = (W - tableW) / 2;
            float tableTop = introBottom - 14;         // juste sous l'intro
            float tableBottom = tableTop - tableH;

            float closingTop    = tableBottom - 16;
            float closingBottom = closingTop - 40;
            float closingWidth  = 660;
            float closingLeft   = (W - closingWidth) / 2;

            float sigLineY  = 76;
            float sigNameY  = sigLineY + 12;
            float sigLabelY = sigLineY - 16;

            // ── 4. Titre ──
            ColumnText.showTextAligned(canvas, Element.ALIGN_CENTER, new Phrase(attestationProperties.getTitle(), titleFont), W / 2, titleY, 0);

            // ── 5. Divider ornemental ──
            drawDividerOrnament(canvas, W / 2, dividerY, NAVY, GOLD);

            // ── 6. Paragraphe intro (wrap automatique dans sa boîte) ──
            Paragraph introPara = new Paragraph();
            introPara.setAlignment(Element.ALIGN_CENTER);
            introPara.setLeading(22);
            introPara.add(new Phrase("Cette attestation est délivrée à ", introFont));
            introPara.add(new Phrase(fullName, nameFont));
            introPara.add(new Phrase(" en reconnaissance de la complétion honorable de ses services en tant que technicien certifié sur la plateforme ", introFont));
            introPara.add(new Phrase(attestationProperties.getPlatformName(), platformFont));
            introPara.add(new Phrase(".", introFont));

            ColumnText introCt = new ColumnText(canvas);
            introCt.setSimpleColumn(introLeft, introBottom, introLeft + introWidth, introTop);
            introCt.addElement(introPara);
            introCt.go();

            // ── 7. Boîte du tableau (fond + double liseré doré) ──
            canvas.setColorStroke(GOLD);
            canvas.setLineWidth(1.4f);
            drawRoundedRect(canvas, tableX, tableBottom, tableW, tableH, 16);
            canvas.stroke();
            canvas.setLineWidth(0.6f);
            canvas.setColorStroke(GOLD_LIGHT);
            drawRoundedRect(canvas, tableX + 5, tableBottom + 5, tableW - 10, tableH - 10, 12);
            canvas.stroke();
            canvas.saveState();
            canvas.setColorFill(new Color(255, 255, 255, 80));
            drawRoundedRect(canvas, tableX, tableBottom, tableW, tableH, 16);
            canvas.fill();
            canvas.restoreState();

            // Accolades décoratives aux 4 coins du tableau (effet "cartouche
            // gravé" de la maquette : deux petits traits fins qui débordent
            // légèrement du rectangle à chaque coin).
            drawCartoucheCorner(canvas, tableX, tableBottom + tableH, 1, -1, GOLD, GOLD_LIGHT);
            drawCartoucheCorner(canvas, tableX + tableW, tableBottom + tableH, -1, -1, GOLD, GOLD_LIGHT);
            drawCartoucheCorner(canvas, tableX, tableBottom, 1, 1, GOLD, GOLD_LIGHT);
            drawCartoucheCorner(canvas, tableX + tableW, tableBottom, -1, 1, GOLD, GOLD_LIGHT);

            // ── 8. Contenu du tableau ──
            float[] widths = {200, tableW - 200};
            PdfPTable table = new PdfPTable(widths);
            table.setTotalWidth(tableW);
            table.setLockedWidth(true);
            table.getDefaultCell().setBorder(PdfPCell.NO_BORDER);

            addInfoRow(table, "Nom complet", fullName, labelFont, valueFont, ROW_SEP, false);
            addInfoRow(table, "Domaine(s)", profile.getDomain() != null ? profile.getDomain() : "N/A", labelFont, valueFont, ROW_SEP, false);
            int platformThreshold = requiredInterventionsFor(AttestationLevel.DIAMOND);
            addInfoRow(table, "Interventions complétées", attestation.getInterventionCount() + "/" + platformThreshold, labelFont, strongFont, ROW_SEP, false);
            addInfoRow(table, "Note moyenne", String.format("%.1f / 5", attestation.getAvgRating()), labelFont, strongFont, ROW_SEP, false);
            addInfoRow(table, "Date de délivrance", formatDate(attestation.getGeneratedAt()), labelFont, valueFont, ROW_SEP, false);
            addInfoRow(table, "Numéro d'attestation", attestation.getAttestationNumber(), labelFont, monoFont, ROW_SEP, true);

            // writeSelectedRows dessine à partir du coin HAUT-GAUCHE -> on passe le haut de la boîte
            table.writeSelectedRows(0, -1, tableX, tableTop - 10, canvas);

            // ── 9. Phrase de clôture ──
            Paragraph closing = new Paragraph(
                    "Cette attestation certifie le nombre d'interventions complétées avec succès ainsi que la qualité "
                            + "des services fournis par le technicien sur la plateforme "
                            + attestationProperties.getPlatformName() + ".", closingFont);
            closing.setAlignment(Element.ALIGN_CENTER);
            closing.setLeading(18);

            ColumnText closingCt = new ColumnText(canvas);
            closingCt.setSimpleColumn(closingLeft, closingBottom, closingLeft + closingWidth, closingTop);
            closingCt.addElement(closing);
            closingCt.go();

            // ── 10. Signature ──
            float sigLineHalf = 90;
            float sigCx = W / 2;

            canvas.setColorStroke(GOLD);
            canvas.setLineWidth(0.8f);
            canvas.moveTo(sigCx - sigLineHalf, sigLineY);
            canvas.lineTo(sigCx + sigLineHalf, sigLineY);
            canvas.stroke();

            // Paraphe dessiné (aucun nom n'est imprimé : le responsable de la
            // plateforme est l'admin, la signature reste générique).
            drawSignatureScribble(canvas, sigCx, sigNameY + 2f, 1f, NAVY_DARK);
            ColumnText.showTextAligned(canvas, Element.ALIGN_CENTER, new Phrase(attestationProperties.getSignatoryRole(), sigLabelFont), sigCx, sigLabelY, 0);

            document.close();
            writer.close();

        } catch (Exception e) {
            logger.error("Erreur génération PDF attestation", e);
            throw new RuntimeException("Impossible de générer le PDF.", e);
        }

        return baos.toByteArray();
    }

    /**
     * Charge une police "display" pour le titre si un TTF a été fourni
     * dans /fonts (ex: PlayfairDisplay-Black.ttf), sinon replie sur
     * Times-Bold. Times-Bold seul ne rend jamais aussi massif que sur
     * la maquette : pour un résultat identique, embarque le vrai TTF.
     */
    private Font loadTitleFont(float size, Color fallbackColor) {
        try {
            String path = "fonts/PlayfairDisplay-Black.ttf";
            FontFactory.register(path, "PlayfairTitle");
            return FontFactory.getFont("PlayfairTitle", com.lowagie.text.pdf.BaseFont.WINANSI, com.lowagie.text.pdf.BaseFont.EMBEDDED, size, Font.NORMAL, fallbackColor);
        } catch (Exception e) {
            return FontFactory.getFont(FontFactory.TIMES_ROMAN, size, Font.BOLD, fallbackColor);
        }
    }

    /**
     * Paraphe manuscrit dessiné en vectoriel (aucun nom imprimé) : grande
     * boucle initiale, bosses cursives, pic de majuscule médian, descente
     * finale, paraphe soulignant et point d'accent. (cx,cy) = centre de la
     * zone de signature ; s = échelle.
     */
    private void drawSignatureScribble(PdfContentByte canvas, float cx, float cy, float s, Color inkColor) {
        canvas.saveState();
        canvas.setColorStroke(inkColor);
        canvas.setLineWidth(1.4f * s);
        canvas.setLineCap(PdfContentByte.LINE_CAP_ROUND);
        canvas.setLineJoin(PdfContentByte.LINE_JOIN_ROUND);

        // Grand bouclé initial (majuscule)
        canvas.moveTo(cx - 75 * s, cy + 4 * s);
        canvas.curveTo(cx - 86 * s, cy + 16 * s, cx - 60 * s, cy + 20 * s, cx - 54 * s, cy + 10 * s);
        canvas.curveTo(cx - 49 * s, cy + 3 * s, cx - 60 * s, cy - 2 * s, cx - 63 * s, cy + 3 * s);
        canvas.curveTo(cx - 65 * s, cy + 6 * s, cx - 56 * s, cy + 8 * s, cx - 47 * s, cy + 5 * s);
        // Bosses cursives du corps
        canvas.curveTo(cx - 41 * s, cy + 3 * s, cx - 39 * s, cy - 2 * s, cx - 33 * s, cy + 1 * s);
        canvas.curveTo(cx - 28 * s, cy + 3 * s, cx - 29 * s, cy + 7 * s, cx - 24 * s, cy + 5 * s);
        canvas.curveTo(cx - 19 * s, cy + 3 * s, cx - 21 * s, cy - 1 * s, cx - 15 * s, cy + 2 * s);
        canvas.curveTo(cx - 11 * s, cy + 3 * s, cx - 12 * s, cy + 8 * s, cx - 7 * s, cy + 6 * s);
        // Pic de majuscule médian
        canvas.curveTo(cx - 3 * s, cy + 4 * s, cx + 1 * s, cy + 18 * s, cx + 6 * s, cy + 15 * s);
        canvas.curveTo(cx + 10 * s, cy + 13 * s, cx + 6 * s, cy + 5 * s, cx + 11 * s, cy + 4 * s);
        // Descente finale avec élan
        canvas.curveTo(cx + 18 * s, cy + 2 * s, cx + 26 * s, cy - 2 * s, cx + 36 * s, cy + 2 * s);
        canvas.curveTo(cx + 48 * s, cy + 6 * s, cx + 58 * s, cy + 8 * s, cx + 70 * s, cy + 3 * s);
        canvas.stroke();

        // Paraphe soulignant la signature
        canvas.moveTo(cx - 62 * s, cy - 4 * s);
        canvas.curveTo(cx - 25 * s, cy - 9 * s, cx + 25 * s, cy - 8 * s, cx + 66 * s, cy - 3 * s);
        canvas.stroke();

        // Point d'accent final
        canvas.setColorFill(inkColor);
        canvas.circle(cx + 71 * s, cy - 1 * s, 1.3f * s);
        canvas.fill();
        canvas.restoreState();
    }

    /**
     * Petite accolade décorative à un coin d'un cadre rectangulaire (le
     * tableau, ici) : un trait diagonal court + une volute fine, comme sur
     * un cartouche gravé. (ox,oy) = coin du rectangle ; (dx,dy) = direction
     * vers l'intérieur du rectangle (+1/-1).
     */
    private void drawCartoucheCorner(PdfContentByte canvas, float ox, float oy, float dx, float dy,
                                     Color mainColor, Color lightColor) {
        canvas.saveState();
        canvas.setColorStroke(mainColor);
        canvas.setLineWidth(1f);
        canvas.moveTo(ox - dx * 6, oy);
        canvas.lineTo(ox + dx * 14, oy);
        canvas.curveTo(ox + dx * 22, oy, ox + dx * 22, oy - dy * 8, ox + dx * 16, oy - dy * 12);
        canvas.stroke();
        canvas.moveTo(ox, oy - dy * 6);
        canvas.lineTo(ox, oy + dy * 14);
        canvas.curveTo(ox, oy + dy * 22, ox - dx * 8, oy + dy * 22, ox - dx * 12, oy + dy * 16);
        canvas.stroke();
        canvas.setColorFill(lightColor);
        canvas.circle(ox, oy, 2.2f);
        canvas.fill();
        canvas.restoreState();
    }

    private void drawSoftGlow(PdfContentByte canvas, float cx, float cy, float radius, Color color) {
        for (float r = radius; r > 0; r -= 8) {
            float alpha = (float) color.getAlpha() * (1f - r / radius);
            canvas.setColorFill(new Color(color.getRed(), color.getGreen(), color.getBlue(), (int) Math.max(0, Math.min(255, alpha))));
            canvas.circle(cx, cy, r);
            canvas.fill();
        }
    }

    private void drawRoundedRect(PdfContentByte canvas, float x, float y, float w, float h, float r) {
        canvas.moveTo(x + r, y);
        canvas.lineTo(x + w - r, y);
        canvas.curveTo(x + w - r, y, x + w, y, x + w, y + r);
        canvas.lineTo(x + w, y + h - r);
        canvas.curveTo(x + w, y + h - r, x + w, y + h, x + w - r, y + h);
        canvas.lineTo(x + r, y + h);
        canvas.curveTo(x + r, y + h, x, y + h, x, y + h - r);
        canvas.lineTo(x, y + r);
        canvas.curveTo(x, y + r, x, y, x + r, y);
        canvas.closePath();
    }

    /**
     * Cadre extérieur. NOTE: pour un rendu vraiment identique à la maquette
     * (feuillage doré dense continu sur tout le pourtour), le plus fiable
     * est d'embarquer un asset PNG transparent (une bande motif + un coin)
     * et de le carreler avec Image.getInstance(...).setAbsolutePosition(...)
     * plutôt que de redessiner des courbes de Bézier à la main : OpenPDF n'a
     * pas de "border-image" comme le CSS. Le code ci-dessous reste un motif
     * vectoriel simplifié (points + trait) tant qu'aucun asset n'est fourni.
     */
    private void drawOrnamentalFrame(PdfContentByte canvas, float x, float w, float y, float h,
                                     Color mainColor, Color lightColor) {
        canvas.saveState();
        canvas.setColorStroke(mainColor);
        canvas.setLineWidth(1.2f);
        canvas.rectangle(x, y, w, h);
        canvas.stroke();

        canvas.setColorFill(lightColor);
        for (float px = x + 20; px < x + w; px += 26) {
            canvas.circle(px, y, 1.8f);
            canvas.fill();
            canvas.circle(px, y + h, 1.8f);
            canvas.fill();
        }
        for (float py = y + 20; py < y + h; py += 26) {
            canvas.circle(x, py, 1.8f);
            canvas.fill();
            canvas.circle(x + w, py, 1.8f);
            canvas.fill();
        }
        canvas.restoreState();
    }

    /**
     * Motif "circuit imprimé" décoratif dans un coin. (ox,oy) est le point
     * d'ancrage (déjà placé juste à l'intérieur du double-liseré par
     * l'appelant) ; (dx,dy) valent +1/-1 et indiquent la direction vers
     * l'intérieur du certificat.
     *
     * IMPORTANT — marges de sécurité : avec le layout actuel de
     * generatePdf(), l'espace réellement libre autour de chaque coin est
     * étroit (le texte de clôture arrive à ~35pt du coin bas-gauche à
     * l'horizontale, l'intro à ~45pt du coin haut-droit). Le motif est
     * donc volontairement étroit en largeur (max 26pt) et peut s'étirer
     * un peu plus en hauteur (max 58pt), car il y a plus de marge
     * verticale que horizontale des deux côtés. Si tu changes tableW,
     * introWidth, closingWidth ou les insets d'ancrage, recalcule ces
     * deux maximums avant d'agrandir le motif — c'est cette vérification
     * qui manquait la dernière fois et qui a causé le chevauchement.
     */
    private void drawCircuitMotif(PdfContentByte canvas, float ox, float oy, float dx, float dy,
                                  Color baseColor) {
        canvas.saveState();
        canvas.setColorStroke(new Color(baseColor.getRed(), baseColor.getGreen(), baseColor.getBlue(), 32));
        canvas.setLineWidth(1.1f);

        canvas.moveTo(ox, oy);
        canvas.lineTo(ox - dx * 26, oy);
        canvas.lineTo(ox - dx * 26, oy - dy * 22);
        canvas.lineTo(ox - dx * 14, oy - dy * 22);
        canvas.lineTo(ox - dx * 14, oy - dy * 58);
        canvas.stroke();

        canvas.moveTo(ox, oy - dy * 14);
        canvas.lineTo(ox - dx * 18, oy - dy * 14);
        canvas.lineTo(ox - dx * 18, oy - dy * 40);
        canvas.stroke();

        canvas.moveTo(ox - dx * 6, oy);
        canvas.lineTo(ox - dx * 6, oy - dy * 30);
        canvas.lineTo(ox - dx * 22, oy - dy * 30);
        canvas.stroke();
        canvas.restoreState();

        canvas.saveState();
        canvas.setColorFill(new Color(baseColor.getRed(), baseColor.getGreen(), baseColor.getBlue(), 40));
        float[][] dots = {{0, 0}, {26, 0}, {26, 22}, {14, 22}, {14, 58},
                {0, 14}, {18, 14}, {18, 40}, {6, 0}, {6, 30}, {22, 30}};
        for (float[] d : dots) {
            canvas.circle(ox - d[0] * dx, oy - d[1] * dy, 2.4f);
            canvas.fill();
        }
        canvas.restoreState();
    }

    /**
     * Coin floral. La maquette a un filigrane dense (plusieurs volutes
     * imbriquées de tailles différentes) — une seule paire de courbes ne
     * suffit pas à donner cette impression de dentelle. On superpose donc
     * 3 familles de courbes (grande / moyenne / petite) plus quelques
     * accroches courtes pour casser la symétrie trop parfaite.
     */
    private void drawFloralCorner(PdfContentByte canvas, float ox, float oy, float dx, float dy,
                                  Color mainColor, Color lightColor) {
        canvas.saveState();

        // Grande volute principale (2 branches en L, comme avant)
        canvas.setColorStroke(mainColor);
        canvas.setLineWidth(1.6f);
        canvas.moveTo(ox, oy);
        canvas.curveTo(ox + dx * 34, oy, ox + dx * 40, oy + dy * 16, ox + dx * 40, oy + dy * 16);
        canvas.curveTo(ox + dx * 40, oy + dy * 16, ox + dx * 52, oy + dy * 11, ox + dx * 52, oy + dy * 40);
        canvas.curveTo(ox + dx * 52, oy + dy * 40, ox + dx * 63, oy + dy * 40, ox + dx * 63, oy + dy * 63);
        canvas.stroke();

        canvas.moveTo(ox, oy);
        canvas.curveTo(ox, oy + dy * 34, ox + dx * 16, oy + dy * 40, ox + dx * 16, oy + dy * 40);
        canvas.curveTo(ox + dx * 16, oy + dy * 40, ox + dx * 11, oy + dy * 52, ox + dx * 40, oy + dy * 52);
        canvas.curveTo(ox + dx * 40, oy + dy * 52, ox + dx * 40, oy + dy * 63, ox + dx * 63, oy + dy * 63);
        canvas.stroke();

        // Volute secondaire, plus petite, décalée vers l'intérieur
        canvas.setLineWidth(1.1f);
        canvas.moveTo(ox + dx * 10, oy + dy * 10);
        canvas.curveTo(ox + dx * 26, oy + dy * 10, ox + dx * 30, oy + dy * 20, ox + dx * 24, oy + dy * 28);
        canvas.curveTo(ox + dx * 18, oy + dy * 36, ox + dx * 8, oy + dy * 32, ox + dx * 10, oy + dy * 22);
        canvas.stroke();

        // Petites vrilles courtes (accroches) pour casser la symétrie
        canvas.setLineWidth(0.9f);
        canvas.moveTo(ox + dx * 48, oy + dy * 6);
        canvas.curveTo(ox + dx * 58, oy + dy * 6, ox + dx * 60, oy + dy * 14, ox + dx * 54, oy + dy * 18);
        canvas.stroke();
        canvas.moveTo(ox + dx * 6, oy + dy * 48);
        canvas.curveTo(ox + dx * 6, oy + dy * 58, ox + dx * 14, oy + dy * 60, ox + dx * 18, oy + dy * 54);
        canvas.stroke();
        canvas.moveTo(ox + dx * 46, oy + dy * 46);
        canvas.curveTo(ox + dx * 54, oy + dy * 50, ox + dx * 50, oy + dy * 58, ox + dx * 42, oy + dy * 56);
        canvas.stroke();

        canvas.restoreState();

        // Points dorés (feuilles / graines) répartis sur les volutes
        canvas.saveState();
        canvas.setColorFill(lightColor);
        float[][] leaves = {
                {0, 0, 4f}, {40, 16, 2.4f}, {16, 40, 2.4f}, {52, 40, 2f}, {40, 52, 2f},
                {63, 63, 2.6f}, {24, 28, 1.8f}, {10, 22, 1.6f}, {54, 18, 1.6f}, {18, 54, 1.6f}, {42, 56, 1.6f}
        };
        for (float[] l : leaves) {
            canvas.circle(ox + dx * l[0], oy + dy * l[1], l[2]);
            canvas.fill();
        }
        canvas.restoreState();
    }

    private void drawDividerOrnament(PdfContentByte canvas, float cx, float cy,
                                     Color darkColor, Color mainColor) {
        canvas.saveState();
        canvas.setColorStroke(darkColor);
        canvas.setLineWidth(2f);
        canvas.moveTo(cx - 210, cy);
        canvas.lineTo(cx - 85, cy);
        canvas.moveTo(cx + 85, cy);
        canvas.lineTo(cx + 210, cy);
        canvas.stroke();

        canvas.setColorStroke(mainColor);
        canvas.setLineWidth(1.6f);
        canvas.moveTo(cx - 85, cy);
        canvas.curveTo(cx - 65, cy + 11, cx - 45, cy + 11, cx - 25, cy);
        canvas.curveTo(cx - 5, cy - 11, cx + 5, cy - 11, cx + 25, cy);
        canvas.curveTo(cx + 45, cy + 11, cx + 65, cy + 11, cx + 85, cy);
        canvas.stroke();

        canvas.moveTo(cx - 85, cy);
        canvas.curveTo(cx - 65, cy - 11, cx - 45, cy - 11, cx - 25, cy);
        canvas.curveTo(cx - 5, cy + 11, cx + 5, cy + 11, cx + 25, cy);
        canvas.curveTo(cx + 45, cy - 11, cx + 65, cy - 11, cx + 85, cy);
        canvas.stroke();

        canvas.setColorFill(darkColor);
        canvas.circle(cx, cy, 4.5f);
        canvas.fill();
        canvas.setColorFill(mainColor);
        canvas.circle(cx - 30, cy, 2.4f);
        canvas.fill();
        canvas.circle(cx + 30, cy, 2.4f);
        canvas.fill();
        canvas.restoreState();
    }


    private void addInfoRow(PdfPTable table, String label, String value,
                            Font labelFont, Font valueFont, Color separatorColor, boolean isLast) {
        PdfPCell lc = new PdfPCell(new Phrase(label, labelFont));
        lc.setBorder(PdfPCell.NO_BORDER);
        lc.setPadding(10);
        lc.setPaddingTop(8);
        lc.setPaddingBottom(isLast ? 12 : 8);
        if (!isLast) {
            lc.setBorderWidthBottom(0.8f);
            lc.setBorderColorBottom(separatorColor);
        }

        PdfPCell vc = new PdfPCell(new Phrase(value, valueFont));
        vc.setBorder(PdfPCell.NO_BORDER);
        vc.setPadding(10);
        vc.setPaddingTop(8);
        vc.setPaddingBottom(isLast ? 12 : 8);
        if (!isLast) {
            vc.setBorderWidthBottom(0.8f);
            vc.setBorderColorBottom(separatorColor);
        }

        table.addCell(lc);
        table.addCell(vc);
    }

    private String formatDate(java.sql.Timestamp timestamp) {
        if (timestamp == null) return "N/A";
        return timestamp.toLocalDateTime().format(DateTimeFormatter.ofPattern("dd/MM/yyyy"));
    }
}
