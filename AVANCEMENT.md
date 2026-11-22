---
statut: actif
maj: 2026-11-22
---
# Avancement — cabinetcardiomesnana

## Où on en est
Application déjà riche : consultation écoutée avec accord du patient et assistant WhatsApp prudent (10/11), fin de consultation avec facture, courrier au confrère et vérification d'ordonnance, liste d'attente et import de PDF, guide du médecin en PDF. Le 12/11, dossier patient allégé et modèles de certificats. Le 19-20/11, impression des ordonnances, prescriptions et certificats en A5 ou A4 avec ou sans en-tête (A5 sans en-tête par défaut), et mise à jour de sécurité Next.js 16.4.6. Dernier commit le 20/11.

## Évolutions proposées
- Définir `CRON_SECRET` sur Vercel et vérifier que les crons tournent.
- Corriger les 2 tests au fuseau horaire et le lint des scripts guide.
- Écrire un vrai README (démarrage, variables, déploiement).
- Valider l'environnement cloud « cabinetcardio » de bout en bout.
- Brancher la surveillance après mise en ligne (Sentry ou équivalent).

## Journal
### 2026-11-22
- Création du suivi (inventaire automatique, fiches complétées à partir des docs et des derniers commits).
- Impression : A5 sans en-tête par défaut, en-tête et A4 en option (#61).
- Mise à jour de sécurité Next.js 16.4.3 → 16.4.6 (#60).
