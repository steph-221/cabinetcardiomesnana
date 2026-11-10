# Point sur l'application — 10 novembre 2026

Cabinet de cardiologie du Dr Taouab, Tanger. Ce document fait le point sur ce que l'application fait, ce qui a été vérifié ou
non, ce qui reste à configurer, les questions qui attendent une décision et les évolutions restantes.

## 1. En bref

L'application a deux faces :

- **Le site public** (4 langues) : présentation du cabinet, réservation de rendez-vous en ligne sur l'agenda Google, lien
  personnel pour confirmer ou annuler.
- **L'espace cabinet** (français), réservé au personnel : agenda, dossiers patients, consultations, examens, ordonnances,
  facturation, bibliothèque de références avec assistant, voix, rappels, messages, comptabilité, sécurité.

Principe retenu partout : **l'automate prépare, le médecin valide.** Seuls partent sans geste humain, une fois activés : les
rappels du lendemain, les relances de suivi par e-mail et (si vous l'activez) les réponses pratiques de l'assistant WhatsApp.

Ordre de grandeur : ~330 fichiers suivis, 50 pages, 25 évolutions successives de la base, 400 tests automatiques.

## 2. Ce que l'application fait

| Domaine | Fonctions |
| --- | --- |
| **Agenda et rendez-vous** | Réservation en ligne (créneaux libres, anti-robots), ajout/modification/annulation, rattachement à un médecin et à un dossier, fermeture de créneaux, rappel J-1 avec lien de confirmation/annulation, liste d'attente et créneaux libérés |
| **Dossier patient** | Identité, couverture, facteurs de risque, antécédents, allergies, traitements, doublons signalés, fiche papier, langue parlée, journal des accès, rôles (administrateur, médecin, secrétaire) |
| **Consultation** | Rubriques du rapport du cabinet, courbes, alertes (INR, FC, TA, DFG, FEVG), calculs et scores, suivis à prévoir, rapport PDF, bandeau « fin de consultation » |
| **Examens** | Comptes rendus ETT, ECG, Holter, MAPA, effort, Doppler, coroscanner, coronarographie avec calculs et propositions de conclusion **référencées** ; rangement des PDF dans Google Drive ; résultats de laboratoire reçus par e-mail |
| **Ordonnance** | Base medicament.ma (5 042 fiches), aide à la prescription, vérifications (allergie, doublon, famille, associations), PDF |
| **Facturation / comptabilité** | Factures numérotées par mois, facture proposée d'après la consultation, paiements, charges récurrentes, statistiques, associés, export |
| **Courrier** | Courrier au confrère par modèle fixe, modifiable, PDF |
| **Voix** | Micro sur chaque champ (Ctrl+M), note vocale rangée en actions, ordonnance dictée, dictée de consultation, parole du patient en arabe/français, consultation écoutée (accord obligatoire), lexique qui apprend |
| **Savoir** | Assistant qui ne répond qu'avec la bibliothèque et cite ses sources ; bibliothèque par thème ; DOI, import de plusieurs PDF, sites et revues suivis, nuit de veille ; calculateurs ; vérification des seuils |
| **Secrétariat** | Rappels et confirmations, relances de suivi (WhatsApp préparé, e-mail automatique), liste d'attente, messages WhatsApp, boîte « À valider », « Ma journée » |
| **Pilotage** | Population (INR hors cible, patients traités pas revus), page Modèles IA (modèle par tâche, coût), journal |
| **IA par tâche** | Haiku pour les tâches simples, Sonnet pour la rédaction, Opus pour l'assistant ; seconde tentative sur un modèle plus fort quand le contrôle échoue |

## 3. Ce qui a été vérifié, et ce qui ne l'a pas été

**Vérifié** (tests automatiques et essais en démonstration) :

- 400 tests, types, style et compilation propres ; les 25 évolutions de la base s'appliquent sur un vrai Postgres et sont
  rejouables ; les requêtes principales ont été exécutées sur Postgres.
- Un parcours navigateur (Playwright) sur 33 écrans avec des données fictives, un agenda Google simulé et une vraie base :
  aucune erreur. C'est ce qui a servi aux captures du guide.
- Le webhook WhatsApp (vérification, signatures refusées ou acceptées) et le PDF du courrier.

**Non vérifié** (aucun accès à ces services depuis l'environnement de développement) :

- Les **vrais services** : Google Agenda et Drive, Resend (e-mail), Meta/WhatsApp, Claude (aucune clé), Crossref et Europe PMC,
  les sites des éditeurs. La logique est testée avec des réponses simulées ; le comportement réel est à contrôler.
- La **reconnaissance vocale** (micro réel, français et arabe), la consultation écoutée avec un vrai patient.
- La qualité des réponses de l'**assistant** et des comptes rendus rédigés (aucun appel à Claude n'a été fait).
- Les écrans sur de **vraies données** et sur téléphone.

**Un bug** a atteint la production (la page ne se chargeait plus en naviguant entre les pages) : corrigé et fusionné.
Aucune intégration continue n'existe dans le dépôt, donc rien ne bloque automatiquement un défaut avant fusion.

## 4. À configurer (variables d'environnement Vercel)

| Fonction | Variables | État à confirmer |
| --- | --- | --- |
| Base de données | `DATABASE_URL` (Neon) | ? |
| Connexion du personnel | `COMPTE_ADMIN`, `SESSION_SECRET` (32 car. min.), `KV_REST_API_URL` + `KV_REST_API_TOKEN` (Upstash), option `TOTP_ADMIN` | ? |
| Agenda | `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `GOOGLE_CALENDAR_ID` | ? |
| Google Drive | `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` | ? |
| Intelligence artificielle | `ANTHROPIC_API_KEY` (et une limite de dépense mensuelle chez Anthropic) | ? |
| Résultats de laboratoire | `RESULTATS_SECRET` + script Google dans Gmail | ? |
| E-mail automatique | `RESEND_API_KEY`, `EMAIL_EXPEDITEUR`, `EMAIL_REPONSE` | ? |
| WhatsApp (changements) | `WHATSAPP_TOKEN`, `WHATSAPP_NUMERO_ID`, `WHATSAPP_MODELE`, `WHATSAPP_LANGUE` | ? |
| WhatsApp (rappels) | `WHATSAPP_MODELE_RAPPEL` (modèle à faire approuver par Meta) | non |
| WhatsApp (messages reçus) | `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_ASSISTANT=1` pour les réponses automatiques | non |
| Tâches de nuit et d'après-midi | `CRON_SECRET` (veille de la bibliothèque, rappels, relances) | non |
| Anti-robots | `TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (facultatif) | ? |

Le détail est dans `DOSSIER.md`, `RESERVATION.md` et `RESULTATS.md`.

## 5. Questions en suspens (vos décisions)

1. **Autorisation CNDP** : est-elle déposée ou obtenue ? Elle conditionne la saisie de vrais dossiers, la consultation écoutée,
   l'assistant WhatsApp et l'usage de Claude (transferts hors du Maroc : Neon, Google, Anthropic, Meta, Resend).
2. **Reconnaissance vocale** : à essayer sur de vraies consultations (français, arabe). Si elle ne suffit pas, faut-il tester un
   moteur local ou un service payant ? Le moteur est remplaçable sans toucher aux écrans.
3. **Assistant WhatsApp** : l'activer (`WHATSAPP_ASSISTANT=1`) ? Qui regarde la boîte Messages, à quelle fréquence, puisqu'il n'y a
   **aucune notification** pour une urgence possible ? Faut-il compléter les mots d'urgence ?
4. **Rappels automatiques** : faire approuver le modèle WhatsApp de rappel par Meta ? Configurer Resend (domaine d'expédition) ?
5. **Règles cliniques à relire** : associations de l'ordonnance (`securite-prescription.ts`), seuils des comptes rendus (page
   « Vérifier les seuils »), actes et tarifs de Comptabilité → Réglages.
6. **Modèles IA** : garder les réglages de départ (Haiku/Sonnet/Opus) ou les ajuster après quelques semaines d'usage, en
   regardant la colonne « Secondes tentatives » ?
7. **Comptes** : qui a un accès, y a-t-il un remplaçant, le code à usage unique de l'administrateur (`TOTP_ADMIN`) est-il activé ?
8. **Secrétariat** : décider du poste après quelques mois d'usage ; le compteur de ce qui reste fait à la main n'est pas encore
   construit.

## 6. Évolutions restantes

| Priorité | Évolution | Ce qu'il me faut |
| --- | --- | --- |
| 1 | **Intégration continue** (vérifications automatiques à chaque modification) et suivi des erreurs | rien : à décider |
| 1 | **Mise en service** : variables, essais en préproduction avec un rendez-vous et un patient de test | vos accès |
| 2 | **Lecture des résultats de laboratoire** en PDF, valeurs proposées aux courbes | 2 ou 3 comptes rendus anonymisés de vos laboratoires |
| 2 | **Feuille de soins** AMO/CNSS/CNOPS préremplie | les formulaires officiels |
| 2 | **Pré-consultation en ligne** à la place de la fiche papier | votre accord |
| 3 | Arrivée par QR code et salle d'attente | — |
| 3 | Compteur de ce qui reste fait à la main (pour le secrétariat) | — |
| 3 | Résumé pour le patient en français ou en arabe | — |
| 3 | Lecture des PDF scannés par Claude ; catalogue de sites élargi (adresses à vérifier en ligne) | — |
| 3 | Bouton « Comparer » des modèles IA sur vos cas validés ; tâches déléguées par la voix | — |
| 3 | Interactions médicamenteuses tirées des RCP de la bibliothèque | — |

## 7. Risques et recommandations

- **Mise en service progressive** : commencer par l'agenda, les dossiers et la dictée, puis les rappels, puis WhatsApp.
- **Sauvegardes** : Neon garde un historique de restauration dont la durée dépend de l'offre ; vérifier l'offre et faire une
  restauration d'essai.
- **Coûts** : Claude est facturé à l'usage ; fixer une limite de dépense mensuelle et suivre la page Modèles IA.
- **Dépendance aux services** : Google (agenda, Drive, reconnaissance vocale du navigateur), Neon, Vercel, Anthropic, Meta,
  Resend. En cas de panne d'un service, la fonction concernée s'arrête ; le reste continue.
- **Responsabilité clinique** : alertes, vérifications, propositions et réponses de l'assistant sont des aides. Chaque écran de
  validation existe pour cela.
