-- Données FICTIVES de démonstration (aucun vrai patient)
INSERT INTO praticiens (nom, compte, part, actif) VALUES ('Dr Taouab', 'taouab', 100, true);
INSERT INTO patients (id, nom, prenom, sexe, naissance, telephone, email, cin, adresse, couverture, medecin_traitant, langue, facteurs_risque, antecedents, allergies, notes, inr_min, inr_max, poids, taille, tabac_statut, cree_par, modifie_par) OVERRIDING SYSTEM VALUE VALUES
 (1,'Bennani','Salma','F','1962-03-14','06 12 34 56 78','salma.bennani@exemple.test','A123456','Tanger','CNSS','Dr Alami','fr','{HTA,Diabète}','RVAo mécanique (2019), ACFA. Diabète de type 2.','pénicilline','',2.5,3.5,72,162,'non','taouab','taouab'),
 (2,'Idrissi','Omar','M','1955-07-02','06 61 22 33 44','','B654321','Tanger','CNOPS','Dr Berrada','ar','{HTA,Dyslipidémie,Tabac}','HTA depuis 2008. Dyslipidémie.','','',NULL,NULL,84,174,'ancien','taouab','taouab'),
 (3,'Tazi','Lina','F','1988-11-20','07 70 11 22 33','lina.tazi@exemple.test','','Tanger','Mutuelle / assurance privée','','fr','{}','','','',NULL,NULL,61,168,'non','taouab','taouab'),
 (4,'Chraibi','Karim','M','1948-01-09','06 70 55 44 33','','C112233','Tétouan','AMO Tadamon','Dr Alami','fr','{HTA,Diabète,Insuffisance rénale}','Insuffisance cardiaque à FEVG altérée (cardiopathie ischémique). IDM en 2016, stent IVA.','sulfamides','',NULL,NULL,78,170,'ancien','taouab','taouab'),
 (5,'Fassi','Nadia','F','1971-05-30','06 66 77 88 99','nadia.fassi@exemple.test','','Tanger','CNSS','','fr','{HTA}','HTA.','','',NULL,NULL,66,160,'non','taouab','taouab');
SELECT setval(pg_get_serial_sequence('patients','id'), 5);
INSERT INTO consultations (patient_id, date, motif, ta_sys, ta_dia, fc, spo2, poids, taille, examen, ecg, mesures, autres, conclusion, conduite, cree_par, modifie_par) VALUES
 (1, current_date - 162, 'Contrôle sous AVK', 128, 78, 66, 98, 72, 162, 'RAS. Clic de prothèse net.', 'ACFA à 66 bpm', '{"inr":3.0,"creatinine":9,"hba1c":7.1}', '', 'INR dans la cible.', 'Continuer Sintrom. INR dans 1 mois.', 'taouab','taouab'),
 (1, current_date - 81, 'Contrôle sous AVK', 130, 80, 64, 98, 72, 162, 'RAS.', 'ACFA à 64 bpm', '{"inr":2.8}', '', 'Bon équilibre.', 'Même traitement.', 'taouab','taouab'),
 (1, current_date - 29, 'Contrôle sous AVK, ETT annuelle', 130, 80, 62, 98, 72, 162, 'Pas de signe d''insuffisance cardiaque.', 'ACFA contrôlée à 62 bpm', '{"inr":4.2,"fevg":58,"creatinine":9}', 'ETT : prothèse aortique normofonctionnelle.', 'INR au-dessus de la cible (4,2).', 'Diminuer le Sintrom d''un quart, contrôle INR dans une semaine.', 'taouab','taouab'),
 (2, current_date - 120, 'Contrôle tension', 152, 88, 72, 97, 84, 174, 'Souffle systolique 2/6 aortique.', 'Rythme sinusal, HVG électrique', '{"ldl":1.6}', '', 'HTA non contrôlée.', 'Ajouter un IEC. MAPA à prévoir.', 'taouab','taouab'),
 (2, current_date - 45, 'Résultats de MAPA', 148, 86, 70, 97, 83, 174, 'RAS.', 'Rythme sinusal', '{"ldl":1.4}', 'MAPA : non-dipper.', 'HTA persistante.', 'Majorer le traitement.', 'taouab','taouab'),
 (4, current_date - 90, 'Insuffisance cardiaque', 118, 70, 58, 95, 79, 170, 'Œdèmes des membres inférieurs discrets.', 'Rythme sinusal, séquelle antérieure', '{"fevg":38,"ntprobnp":2400,"creatinine":14}', 'ETT : FEVG 38 %.', 'IC à FEVG altérée stable.', 'Optimiser le traitement de fond.', 'taouab','taouab'),
 (4, current_date - 14, 'Contrôle', 112, 68, 48, 94, 78, 170, 'Pas de congestion.', 'Bradycardie sinusale 48 bpm', '{"fevg":36,"ntprobnp":2900,"creatinine":16}', '', 'Bradycardie sous bêtabloquant. FEVG 36 %.', 'Réévaluer la dose de bêtabloquant. Bilan rénal.', 'taouab','taouab');
INSERT INTO traitements (patient_id, medicament, posologie, debut, cree_par) VALUES
 (1,'Sintrom 4 mg','1/4 cp le soir',current_date-1500,'taouab'),(1,'Bisoprolol 5 mg','1 cp le matin',current_date-1500,'taouab'),
 (2,'Amlodipine 5 mg','1 cp le matin',current_date-900,'taouab'),(2,'Atorvastatine 40 mg','1 cp le soir',current_date-900,'taouab'),
 (4,'Bisoprolol 10 mg','1 cp le matin',current_date-700,'taouab'),(4,'Ramipril 5 mg','1 cp le matin',current_date-700,'taouab'),(4,'Furosémide 40 mg','1 cp le matin',current_date-400,'taouab'),(4,'Spironolactone 25 mg','1 cp le matin',current_date-400,'taouab'),
 (5,'Aténolol 50 mg','1 cp le matin',current_date-900,'taouab');
INSERT INTO examens (patient_id, type, date, conclusion, cree_par) VALUES
 (1,'Échocardiographie (ETT)',current_date-29,'Prothèse aortique mécanique normofonctionnelle. FEVG 58 %. Pas d''épanchement péricardique.','taouab'),
 (1,'Biologie',current_date-31,'INR 3,0 ; créatinine 9 mg/L.','taouab');
INSERT INTO suivis (patient_id, quoi, echeance, cree_par) VALUES
 (1,'INR',current_date-3,'taouab'),(1,'Échocardiographie (ETT)',current_date+20,'taouab'),(4,'Consultation de contrôle',current_date+5,'taouab'),(5,'Consultation de contrôle',current_date-40,'taouab');
INSERT INTO ordonnances (patient_id, date, lignes, remarque, cree_par) VALUES
 (1, current_date-29, '[{"medicament":"Sintrom 4 mg","posologie":"3/4 cp le soir","duree":"1 mois"},{"medicament":"Bisoprolol 5 mg","posologie":"1 cp le matin","duree":"3 mois"}]', 'INR dans une semaine.', 'taouab');
INSERT INTO factures (numero, date, patient_id, patient_nom, praticien_id, lignes, total_cts, cree_par) VALUES
 ('2026-10-0001', current_date-29, 1, 'BENNANI Salma', 1, '[{"libelle":"Consultation de cardiologie","quantite":1,"prixCts":30000},{"libelle":"Échocardiographie (ETT)","quantite":1,"prixCts":50000}]', 80000, 'taouab');
INSERT INTO paiements (facture_id, date, montant_cts, mode, cree_par) VALUES (1, current_date-29, 80000, 'especes', 'taouab');
INSERT INTO resultats_recus (message_id, nom_fichier, labo, expediteur, sujet, date_resultat, type_fichier, taille, statut, patient_id, candidats) VALUES
 ('demo1','BENNANI_Salma_2026.pdf','BEKKALI','labo@exemple.test','Résultats BENNANI Salma', current_date-2, 'application/pdf', 120000, 'a_relire', 1, '{}'),
 ('demo2','resultat_inconnu.pdf','FRANCO','labo2@exemple.test','Résultat analyses', current_date-1, 'application/pdf', 98000, 'a_classer', NULL, '{}');
INSERT INTO messages_whatsapp (wa_id, numero, nom, texte, intention, urgent, reponse_auto, recu_le) VALUES
 ('w1','212612345678','Salma Bennani','Bonjour, mon ordonnance est-elle prête ?','autre',false,'Message bien reçu. Le secrétariat vous répondra pendant les horaires d''ouverture.', now()-interval '2 hours'),
 ('w2','212699887766','Hamid','J''ai une douleur dans la poitrine depuis ce matin','urgence',true,'En cas de douleur thoracique, d''essoufflement brutal ou de malaise, n''attendez pas : appelez immédiatement le 141 (SAMU) ou le 15.', now()-interval '25 minutes'),
 ('w3','212670554433','Karim Chraibi','Quels sont vos horaires ?','horaires',false,'Horaires du cabinet : lundi au vendredi : 09:00 – 17:00 ; samedi : 09:30 – 14:00 ; dimanche : fermé.', now()-interval '1 day');
INSERT INTO liste_attente (nom, prenom, telephone, email, souhait, cree_par) VALUES
 ('Berrada','Hind','06 44 55 66 77','','Plutôt le matin, dès que possible','secretariat'),('Lahlou','Amine','06 33 22 11 00','amine.lahlou@exemple.test','Après 15 h','secretariat');
INSERT INTO creneaux_liberes (debut, fin, medecin, origine) VALUES (now()+interval '1 day 2 hours', now()+interval '1 day 2 hours 30 minutes', 'taouab','annulé par le patient'),(now()+interval '2 days 3 hours', now()+interval '2 days 3 hours 30 minutes','taouab','annulé par le secrétariat');
INSERT INTO lexique (entendu, correct, cree_par) VALUES ('sin trom','Sintrom','taouab'),('cardix','Cardix','taouab'),('bi soprolol','bisoprolol','taouab');
INSERT INTO sources (titre, organisme, annee, type, langue, url, pages, complete, cree_par) VALUES
 ('2024 ESC Guidelines for the management of atrial fibrillation','ESC',2024,'recommandation','en','https://academic.oup.com/eurheartj/article-lookup/doi/10.1093/eurheartj/ehae176',120,true,'taouab'),
 ('2021 ESC Guidelines for the diagnosis and treatment of acute and chronic heart failure','ESC',2021,'recommandation','en','',130,true,'taouab'),
 ('2019 ESC Guidelines for the management of dyslipidaemias','ESC',2019,'recommandation','en','',80,true,'taouab');
INSERT INTO passages (source_id, page, texte, tsv) SELECT id, 1, 'Extrait de démonstration : ce texte illustre l''affichage de la bibliothèque, il ne reproduit pas la recommandation.', to_tsvector('english','demonstration') FROM sources;
INSERT INTO sites_suivis (nom, adresse, organisme, type, langue, verifie_le, cree_par) VALUES ('Recommandations de l''ESC','https://www.escardio.org/guidelines/clinical-practice-guidelines/all-esc-practice-guidelines/','ESC','recommandation','en',now()-interval '3 hours','taouab');
INSERT INTO publications (site_id, titre, url, annee, nouvelle, doi, etat, resolue_le) VALUES
 (1,'2024 ESC Guidelines for the management of elevated blood pressure and hypertension','https://www.escardio.org/guidelines/clinical-practice-guidelines/all-esc-practice-guidelines/arterial-hypertension/',2024,true,'','a_lire',now()),
 (1,'2023 ESC Guidelines for the management of cardiomyopathies','https://www.escardio.org/guidelines/clinical-practice-guidelines/all-esc-practice-guidelines/cardiomyopathy/',2023,true,'',  '',now()),
 (1,'2023 ESC Guidelines for the management of acute coronary syndromes','https://www.escardio.org/guidelines/clinical-practice-guidelines/all-esc-practice-guidelines/acute-coronary-syndromes/',2023,false,'','',now()),
 (1,'2020 ESC Guidelines for the management of atrial fibrillation','https://www.escardio.org/guidelines/clinical-practice-guidelines/all-esc-practice-guidelines/atrial-fibrillation-old/',2020,false,'','',now());
INSERT INTO ia_usage (tache, modele, niveau, effort, entree, sortie, cout, duree_ms, escalade, issue, par) VALUES
 ('dictee','claude-haiku-5-5','haiku','medium',1800,520,0.00044,2100,false,'ok','taouab'),('dictee','claude-haiku-5-5','haiku','medium',2100,610,0.00052,2300,false,'ok','taouab'),
 ('assistant','claude-opus-5-5','opus','medium',14000,900,0.074,9800,false,'ok','taouab'),('redaction','claude-sonnet-5-5','sonnet','medium',6200,1500,0.0274,7400,false,'ok','taouab'),
 ('note_vocale','claude-haiku-5-5','haiku','medium',900,300,0.00024,1500,false,'ok','taouab');
INSERT INTO journal (qui, action, patient_id, detail) VALUES
 ('taouab','consultation du dossier',1,''),('taouab','création',5,'FASSI Nadia'),('secretariat','rendez-vous modifié',NULL,'RDV — Idrissi Omar'),('patient','rendez-vous confirmé par le patient',1,'RDV — Salma BENNANI'),('taouab','consultation écoutée avec l''accord du patient',4,'5200 caractères transcrits');
