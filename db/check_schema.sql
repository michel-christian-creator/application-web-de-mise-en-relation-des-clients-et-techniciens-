-- ═══════════════════════════════════════════════════════════════════════
-- MboaTech – Diagnostic complet de la structure de la base de données
-- ═══════════════════════════════════════════════════════════════════════
-- Vérifie SANS rien modifier. Collez tout ce fichier dans le SQL Editor
-- de Neon, ou exécutez via psql. Les résultats s'affichent directement
-- en requêtes (avec leur résultat).
--
-- NB : Neon affiche plusieurs result-sets. Chaque requête renvoie la
-- liste des problèmes détectés (vide = tout est OK pour cet élément).
-- ═══════════════════════════════════════════════════════════════════════

-- ─── 1. TABLES ATTENDUES ───────────────────────────────────────────────
-- Tables manquantes (aucune ligne = toutes présentes)
SELECT t.tbl AS table_manquante,
       'MANQUANTE' AS statut
FROM   (SELECT unnest(ARRAY[
         'users','clients','technicians','admins','service_requests',
         'chat_messages','payments','technician_recommendations','notifications',
         'documents','kyc_documents','disputes','attestations','auth_sessions',
         'withdrawals','request_declines','portfolio_items','platform_settings'
       ]) AS tbl) t
WHERE  NOT EXISTS (SELECT 1
                   FROM information_schema.tables
                   WHERE table_schema = 'public' AND table_name = t.tbl);

-- ─── 2. LISTE COMPLÈTE DES TABLES EXISTANTES ───────────────────────────
SELECT table_name AS table_existante,
       (SELECT COUNT(*) FROM information_schema.columns
        WHERE table_schema='public'
          AND table_name = t.table_name) AS nb_colonnes
FROM information_schema.tables t
WHERE table_schema='public'
  AND table_type='BASE TABLE'
ORDER BY table_name;

-- ─── 3. COLONNES MANQUANTES (table | colonne | type attendu) ───────────
-- Modèle : (table, colonne, type). Ajoutez/retirez des lignes selon besoin.
WITH expected(table_name, column_name, data_type) AS (
  VALUES
    ('users','id','bigint'),
    ('users','username','character varying'),
    ('users','email','character varying'),
    ('users','password_hash','character varying'),
    ('users','first_name','character varying'),
    ('users','last_name','character varying'),
    ('users','role','character varying'),
    ('users','phone','character varying'),
    ('users','photo_url','character varying'),
    ('users','status','character varying'),
    ('users','created_at','timestamp without time zone'),
    ('users','updated_at','timestamp without time zone'),
    ('clients','id','bigint'),
    ('clients','user_id','bigint'),
    ('clients','city','character varying'),
    ('clients','location','character varying'),
    ('clients','created_at','timestamp without time zone'),
    ('clients','updated_at','timestamp without time zone'),
    ('technicians','id','bigint'),
    ('technicians','user_id','bigint'),
    ('technicians','domain','character varying'),
    ('technicians','city','character varying'),
    ('technicians','location','character varying'),
    ('technicians','bio','text'),
    ('technicians','specialties','text'),
    ('technicians','rating_avg','numeric'),
    ('technicians','rating_count','integer'),
    ('technicians','experience_years','smallint'),
    ('technicians','verified','boolean'),
    ('technicians','availability_status','character varying'),
    ('technicians','hourly_rate','numeric'),
    ('technicians','success_rate','numeric'),
    ('technicians','acceptance_count','integer'),
    ('technicians','decline_count','integer'),
    ('technicians','avg_response_time_sec','integer'),
    ('technicians','suspended_until','timestamp without time zone'),
    ('technicians','suspended_permanent','boolean'),
    ('technicians','created_at','timestamp without time zone'),
    ('technicians','updated_at','timestamp without time zone'),
    ('admins','id','bigint'),
    ('admins','user_id','bigint'),
    ('admins','role_name','character varying'),
    ('admins','created_at','timestamp without time zone'),
    ('admins','updated_at','timestamp without time zone'),
    ('service_requests','id','bigint'),
    ('service_requests','client_id','bigint'),
    ('service_requests','technician_id','bigint'),
    ('service_requests','category','character varying'),
    ('service_requests','description','text'),
    ('service_requests','urgency','character varying'),
    ('service_requests','status','character varying'),
    ('service_requests','budget_min','numeric'),
    ('service_requests','budget_max','numeric'),
    ('service_requests','address','character varying'),
    ('service_requests','city','character varying'),
    ('service_requests','scheduled_at','timestamp without time zone'),
    ('service_requests','reserved_until','timestamp without time zone'),
    ('service_requests','completed_at','timestamp without time zone'),
    ('service_requests','funds_deposited','boolean'),
    ('service_requests','dispute_open','boolean'),
    ('service_requests','dispute_reporter_user_id','bigint'),
    ('service_requests','dispute_open_at','timestamp without time zone'),
    ('service_requests','created_at','timestamp without time zone'),
    ('service_requests','updated_at','timestamp without time zone'),
    ('chat_messages','id','bigint'),
    ('chat_messages','service_request_id','bigint'),
    ('chat_messages','sender_user_id','bigint'),
    ('chat_messages','message_text','text'),
    ('chat_messages','attachment_url','character varying'),
    ('chat_messages','is_read','boolean'),
    ('chat_messages','schedule_at','timestamp without time zone'),
    ('chat_messages','schedule_status','character varying'),
    ('chat_messages','created_at','timestamp without time zone'),
    ('payments','id','bigint'),
    ('payments','service_request_id','bigint'),
    ('payments','payer_user_id','bigint'),
    ('payments','payee_user_id','bigint'),
    ('payments','amount','numeric'),
    ('payments','currency','character varying'),
    ('payments','status','character varying'),
    ('payments','method','character varying'),
    ('payments','transaction_ref','character varying'),
    ('payments','payment_url','character varying'),
    ('payments','notes','text'),
    ('payments','created_at','timestamp without time zone'),
    ('payments','updated_at','timestamp without time zone'),
    ('technician_recommendations','id','bigint'),
    ('technician_recommendations','technician_id','bigint'),
    ('technician_recommendations','recommender_user_id','bigint'),
    ('technician_recommendations','recommender_name','character varying'),
    ('technician_recommendations','comment','text'),
    ('technician_recommendations','rating','smallint'),
    ('technician_recommendations','verified','boolean'),
    ('technician_recommendations','created_at','timestamp without time zone'),
    ('notifications','id','bigint'),
    ('notifications','user_id','bigint'),
    ('notifications','title','character varying'),
    ('notifications','message','text'),
    ('notifications','type','character varying'),
    ('notifications','is_read','boolean'),
    ('notifications','created_at','timestamp without time zone'),
    ('documents','id','bigint'),
    ('documents','user_id','bigint'),
    ('documents','type','character varying'),
    ('documents','file_url','character varying'),
    ('documents','status','character varying'),
    ('documents','review_comments','text'),
    ('documents','uploaded_at','timestamp without time zone'),
    ('documents','reviewed_at','timestamp without time zone'),
    ('kyc_documents','id','bigint'),
    ('kyc_documents','user_id','bigint'),
    ('kyc_documents','doc_type','character varying'),
    ('kyc_documents','file_url','character varying'),
    ('kyc_documents','status','character varying'),
    ('kyc_documents','created_at','timestamp without time zone'),
    ('disputes','id','bigint'),
    ('disputes','service_request_id','bigint'),
    ('disputes','reported_by_user_id','bigint'),
    ('disputes','description','text'),
    ('disputes','status','character varying'),
    ('disputes','resolution','text'),
    ('disputes','created_at','timestamp without time zone'),
    ('disputes','resolved_at','timestamp without time zone'),
    ('attestations','id','bigint'),
    ('attestations','technician_id','bigint'),
    ('attestations','intervention_count','integer'),
    ('attestations','avg_rating','numeric'),
    ('attestations','level','character varying'),
    ('attestations','attestation_number','character varying'),
    ('attestations','generated_at','timestamp without time zone'),
    ('auth_sessions','token','character varying'),
    ('auth_sessions','username','character varying'),
    ('auth_sessions','created_at','timestamp without time zone'),
    ('auth_sessions','expires_at','timestamp without time zone'),
    ('withdrawals','id','bigint'),
    ('withdrawals','technician_user_id','bigint'),
    ('withdrawals','client_user_id','bigint'),
    ('withdrawals','amount','numeric'),
    ('withdrawals','method','character varying'),
    ('withdrawals','account','character varying'),
    ('withdrawals','status','character varying'),
    ('withdrawals','notes','text'),
    ('withdrawals','created_at','timestamp without time zone'),
    ('request_declines','id','bigint'),
    ('request_declines','request_id','bigint'),
    ('request_declines','technician_id','bigint'),
    ('request_declines','reason','character varying'),
    ('request_declines','created_at','timestamp without time zone'),
    ('portfolio_items','id','bigint'),
    ('portfolio_items','technician_id','bigint'),
    ('portfolio_items','label','character varying'),
    ('portfolio_items','before_url','character varying'),
    ('portfolio_items','after_url','character varying'),
    ('portfolio_items','created_at','timestamp without time zone'),
    ('platform_settings','setting_key','character varying'),
    ('platform_settings','setting_value','character varying'),
    ('platform_settings','updated_at','timestamp without time zone')
)
SELECT e.table_name, e.column_name, e.data_type,
       'MANQUANTE' AS statut
FROM   expected e
WHERE  NOT EXISTS (SELECT 1
                   FROM information_schema.columns c
                   WHERE c.table_schema='public'
                     AND c.table_name = e.table_name
                     AND c.column_name = e.column_name)
ORDER BY e.table_name, e.column_name;

-- ─── 4. CONTRAINTES CHECK MANQUANTES ──────────────────────────────────
WITH expected(table_name, constraint_name) AS (
  VALUES
    ('users','chk_users_status'),
    ('users','chk_users_role'),
    ('technicians','chk_technician_profiles_availability_status'),
    ('service_requests','chk_service_requests_urgency'),
    ('service_requests','chk_service_requests_status'),
    ('payments','chk_payments_status'),
    ('documents','chk_documents_type'),
    ('documents','chk_documents_status'),
    ('disputes','chk_disputes_status'),
    ('attestations','chk_attestations_level'),
    ('withdrawals','chk_withdrawals_method'),
    ('withdrawals','chk_withdrawals_status')
)
SELECT e.table_name, e.constraint_name, 'MANQUANTE' AS statut
FROM expected e
WHERE NOT EXISTS (SELECT 1
                  FROM information_schema.table_constraints tc
                  WHERE tc.constraint_schema='public'
                    AND tc.table_name = e.table_name
                    AND tc.constraint_name = e.constraint_name
                    AND tc.constraint_type='CHECK')
ORDER BY e.table_name;

-- ─── 5. FOREIGN KEYS MANQUANTES ───────────────────────────────────────
WITH expected(table_name, constraint_name) AS (
  VALUES
    ('clients','fk_clients_user'),
    ('technicians','fk_technicians_user'),
    ('admins','fk_admins_user'),
    ('service_requests','fk_service_requests_client'),
    ('service_requests','fk_service_requests_technician'),
    ('chat_messages','fk_chat_messages_request'),
    ('chat_messages','fk_chat_messages_sender'),
    ('payments','fk_payments_request'),
    ('payments','fk_payments_payer'),
    ('payments','fk_payments_payee'),
    ('technician_recommendations','fk_recommendations_technician'),
    ('technician_recommendations','fk_recommendations_recommender'),
    ('notifications','fk_notifications_user'),
    ('documents','fk_documents_user'),
    ('kyc_documents','fk_kyc_user'),
    ('disputes','fk_disputes_request'),
    ('disputes','fk_disputes_reported_by'),
    ('attestations','fk_attestation_technician'),
    ('withdrawals','fk_withdrawals_technician'),
    ('withdrawals','fk_withdrawals_client'),
    ('request_declines','fk_request_declines_request'),
    ('request_declines','fk_request_declines_technician'),
    ('portfolio_items','fk_portfolio_technician')
)
SELECT e.table_name, e.constraint_name, 'MANQUANTE' AS statut
FROM expected e
WHERE NOT EXISTS (SELECT 1
                  FROM information_schema.table_constraints tc
                  WHERE tc.constraint_schema='public'
                    AND tc.table_name = e.table_name
                    AND tc.constraint_name = e.constraint_name
                    AND tc.constraint_type='FOREIGN KEY')
ORDER BY e.table_name;

-- ─── 6. INDEX MANQUANTS ───────────────────────────────────────────────
WITH expected(table_name, index_name) AS (
  VALUES
    ('service_requests','idx_service_requests_client'),
    ('service_requests','idx_service_requests_technician'),
    ('chat_messages','idx_chat_service_request'),
    ('chat_messages','idx_chat_sender'),
    ('payments','idx_payments_request'),
    ('technician_recommendations','idx_recommendations_technician'),
    ('notifications','idx_notifications_user'),
    ('documents','idx_documents_user'),
    ('kyc_documents','idx_kyc_user'),
    ('disputes','idx_disputes_request'),
    ('attestations','idx_attestation_technician'),
    ('withdrawals','idx_withdrawals_technician'),
    ('withdrawals','idx_withdrawals_client'),
    ('request_declines','idx_request_declines_technician'),
    ('portfolio_items','idx_portfolio_technician'),
    ('auth_sessions','idx_auth_sessions_username')
)
SELECT e.table_name, e.index_name, 'MANQUANT' AS statut
FROM expected e
WHERE NOT EXISTS (SELECT 1
                  FROM pg_indexes p
                  WHERE p.schemaname='public'
                    AND p.tablename = e.table_name
                    AND p.indexname = e.index_name)
ORDER BY e.table_name;

-- ─── 7. TRIGGERS updated_at MANQUANTS ─────────────────────────────────
WITH expected(table_name, trigger_name) AS (
  VALUES
    ('users','set_users_updated_at'),
    ('clients','set_clients_updated_at'),
    ('technicians','set_technicians_updated_at'),
    ('admins','set_admins_updated_at'),
    ('service_requests','set_service_requests_updated_at'),
    ('payments','set_payments_updated_at')
)
SELECT e.table_name, e.trigger_name, 'MANQUANT' AS statut
FROM expected e
WHERE NOT EXISTS (SELECT 1
                  FROM information_schema.triggers tr
                  WHERE tr.event_object_schema='public'
                    AND tr.event_object_table = e.table_name
                    AND tr.trigger_name = e.trigger_name)
ORDER BY e.table_name;

-- Fonction trigger_set_updated_at présente ?
SELECT 'trigger_set_updated_at' AS fonction,
       CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname='trigger_set_updated_at')
            THEN 'OK' ELSE 'MANQUANTE' END AS statut;

-- ─── 8. DONNÉES SEED ──────────────────────────────────────────────────
SELECT 'users.system (id=999999999999)' AS element,
       CASE WHEN EXISTS (SELECT 1 FROM users WHERE id=999999999999 AND username='system')
            THEN 'OK' ELSE 'MANQUANT' END AS statut
UNION ALL
SELECT 'platform_settings.payments_enabled',
       CASE WHEN EXISTS (SELECT 1 FROM platform_settings WHERE setting_key='payments_enabled')
            THEN 'OK' ELSE 'MANQUANT' END AS statut;

-- ─── 9. NOMBRE DE LIGNES PAR TABLE ────────────────────────────────────
SELECT 'users' AS table, COUNT(*) AS lignes FROM users
UNION ALL SELECT 'clients', COUNT(*) FROM clients
UNION ALL SELECT 'technicians', COUNT(*) FROM technicians
UNION ALL SELECT 'admins', COUNT(*) FROM admins
UNION ALL SELECT 'service_requests', COUNT(*) FROM service_requests
UNION ALL SELECT 'chat_messages', COUNT(*) FROM chat_messages
UNION ALL SELECT 'payments', COUNT(*) FROM payments
UNION ALL SELECT 'technician_recommendations', COUNT(*) FROM technician_recommendations
UNION ALL SELECT 'notifications', COUNT(*) FROM notifications
UNION ALL SELECT 'documents', COUNT(*) FROM documents
UNION ALL SELECT 'kyc_documents', COUNT(*) FROM kyc_documents
UNION ALL SELECT 'disputes', COUNT(*) FROM disputes
UNION ALL SELECT 'attestations', COUNT(*) FROM attestations
UNION ALL SELECT 'auth_sessions', COUNT(*) FROM auth_sessions
UNION ALL SELECT 'withdrawals', COUNT(*) FROM withdrawals
UNION ALL SELECT 'request_declines', COUNT(*) FROM request_declines
UNION ALL SELECT 'portfolio_items', COUNT(*) FROM portfolio_items
UNION ALL SELECT 'platform_settings', COUNT(*) FROM platform_settings
ORDER BY table;
