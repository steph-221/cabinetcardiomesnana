import html, pathlib
fig_n = [0]
def fig(nom, legende):
    fig_n[0] += 1
    return f'<figure><img src="captures/{nom}.jpg" alt="{html.escape(legende)}"><figcaption><b>Figure {fig_n[0]}.</b> {legende}</figcaption></figure>'
def etapes(*liste): return "<ol class='etapes'>" + "".join(f"<li>{e}</li>" for e in liste) + "</ol>"
def points(*liste): return "<ul>" + "".join(f"<li>{e}</li>" for e in liste) + "</ul>"
def note(t, genre="info"): return f'<div class="note {genre}">{t}</div>'

parties = []
def partie(titre, corps, saut=True): parties.append((titre, corps, saut))

partie("1. Les règles à retenir", f"""
<p>L'espace cabinet est un <b>assistant</b> : il prépare, il range, il rappelle. <b>Vous décidez.</b> Cinq règles valent pour tout le reste du guide.</p>
{points(
"<b>L'application prépare, vous validez.</b> Rien n'entre dans un dossier sans que vous ayez relu : note vocale, dictée, compte rendu rédigé, reprise d'un ancien Word, résultat d'analyses classé automatiquement, seuil proposé par l'assistant. Chaque écran de relecture porte un bouton explicite d'enregistrement.",
"<b>Les alertes sont des aides, pas des décisions.</b> Les alertes du dossier (INR, bradycardie, tension, DFG, FEVG), celles de l'ordonnance et celles de la population attirent l'attention ; <b>l'absence d'alerte ne prouve rien</b>.",
"<b>Les références se vérifient.</b> L'assistant ne répond qu'à partir de la bibliothèque du cabinet et cite ses sources : ouvrez le passage cité avant de vous y fier. « Pas de réponse dans la bibliothèque » est une réponse honnête, pas une panne.",
"<b>Ce qui part vers les patients est limité et visible.</b> Les rappels du lendemain et les relances de suivi par e-mail peuvent partir automatiquement une fois activés ; tout le reste (WhatsApp, liste d'attente, courriers) est préparé et envoyé par une personne. L'assistant WhatsApp ne donne <b>jamais</b> d'avis médical.",
"<b>Les données de santé sont protégées.</b> Un compte par personne, un mot de passe long, la déconnexion en quittant le poste, le journal des accès. Les noms des patients sont masqués avant tout envoi à l'intelligence artificielle."
)}
{note("<b>Pour les exemples de ce guide</b>, tous les patients, rendez-vous et résultats sont <b>fictifs</b> : ils servent seulement à montrer les écrans.")}
""")

partie("2. S'y retrouver", f"""
<p>La barre du haut propose <b>cinq espaces</b> ; en dessous, les pages de l'espace où vous êtes. Les <b>pastilles rouges</b> indiquent ce qui attend (messages, éléments à valider, suivis en retard) et se voient depuis n'importe quelle page.</p>
<table class="t"><tr><th>Espace</th><th>Ce qu'on y fait</th></tr>
<tr><td><b>Aujourd'hui</b></td><td>Ma journée, À valider, Messages, Rappels, Liste d'attente, Suivis, Résultats</td></tr>
<tr><td><b>Patients</b></td><td>Dossiers, nouvelle consultation, ordonnance, facture, courrier ; Population</td></tr>
<tr><td><b>Agenda</b></td><td>Rendez-vous des 14 prochains jours, ajout, modification, fermeture de créneaux</td></tr>
<tr><td><b>Savoir</b></td><td>Assistant à références, Bibliothèque, Calculateurs, Lexique de la dictée</td></tr>
<tr><td><b>Cabinet</b></td><td>Comptabilité, Reprise Word ; pour l'administrateur : Modèles IA, Drive, Journal, Comptes</td></tr></table>
{fig("02-ma-journee", "« Ma journée » : les rendez-vous du jour, et pour chaque patient connu ce qui a changé depuis sa dernière visite. À gauche de l'écran, les cinq espaces ; dessous, les pages d'Aujourd'hui.")}
<h3>Les trois rôles</h3>
{points("<b>Administrateur</b> (vous) : tout, y compris comptes, journal, Drive et réglages des modèles IA.",
"<b>Médecin</b> (remplaçant) : agenda, dossiers médicaux complets, dictée, assistant. Pas de comptes ni de journal.",
"<b>Secrétaire</b> : agenda, identité et coordonnées, suivis et relances, rappels, messages, facturation. <b>Elle ne voit pas le contenu médical</b> : rien n'en est envoyé à son navigateur.")}
<h3>Les deux raccourcis utiles</h3>
{points("<b>Ctrl + M</b> : dicter dans le champ où se trouve le curseur ; hors d'un champ, il ouvre la note vocale.", "<b>Échap</b> : arrête la dictée en cours.")}
""")

partie("3. Votre journée type", f"""
<h3>3.1 Le matin : faire le point en deux minutes</h3>
{etapes("Ouvrir <b>Aujourd'hui → Ma journée</b> : les patients du jour avec allergies, alertes du dossier, dernière consultation, résultats à relire et suivis dus.",
"Regarder <b>À valider</b> : tout ce que le site a préparé et qui attend un coup d'œil.",
"Lire <b>Messages</b> : un message marqué <b>Urgence possible</b> se traite en premier, par téléphone de préférence.",
"Vérifier <b>Rappels</b> : les rendez-vous d'aujourd'hui et des deux jours suivants, confirmés ou non.")}
{fig("03-a-valider", "« À valider » : résultats d'analyses, suivis en retard, anciens comptes rendus Word, médicaments modifiés, seuils proposés. Chaque ligne mène à l'écran qui traite l'élément.")}
{fig("06-messages", "« Messages » : les messages WhatsApp des patients. Le message d'urgence possible est en rouge, en tête. « Marquer traité » le sort de la liste.")}
<h3>3.2 Recevoir un patient</h3>
{etapes("Ouvrir le dossier depuis <b>Ma journée</b> (bouton « Ouvrir le dossier ») ou depuis <b>Patients</b>. Si le patient n'a pas de dossier, « Créer le dossier » reprend ce qu'il a indiqué en réservant.",
"Lire le haut de la fiche : <b>allergies</b> (en rouge), <b>alertes</b>, valeurs clés, dernière consultation, traitements en cours.",
"Cliquer <b>Nouvelle consultation</b>. Dicter (§ 4.2) ou saisir : motif, examen physique, ECG, valeurs, conclusion, conduite à tenir.",
"Si un suivi est à prévoir (« ETT dans 6 mois »), le remplir en bas de la consultation : il apparaîtra dans <b>Suivis</b>.",
"<b>Enregistrer la consultation.</b>")}
{fig("11-fiche-patient", "La fiche patient : identité, allergies, alertes, valeurs clés, puis les onglets Aperçu, Consultations, Évolution et calculs, Examens, Ordonnances et factures, Fiche.")}
{fig("13-nouvelle-consultation", "La nouvelle consultation. En haut, le bloc de dictée avec « Qui parle ? » ; dessous, les rubriques du rapport de consultation du cabinet.")}
<h3>3.3 Fin de consultation : quatre gestes</h3>
<p>Sur la page de la consultation, le bandeau <b>« Fin de consultation »</b> réunit les gestes suivants. Rien n'est créé automatiquement : chaque lien ouvre l'écran où vous vérifiez.</p>
{points("<b>Ordonnance</b> : les traitements en cours sont repris ; vous retirez ou complétez (§ 4.3).", "<b>Facture proposée</b> : la consultation, plus un acte par examen fait le même jour, avec vos tarifs (§ 4.5).", "<b>Courrier au confrère</b> : modèle rempli avec la consultation, à relire (§ 4.6).", "<b>Rapport PDF</b> : le rapport de consultation du cabinet, toujours à jour.")}
{fig("14-consultation-fin", "Une consultation enregistrée : le bandeau « Fin de consultation » donne accès à l'ordonnance, à la facture proposée, au courrier et au rapport PDF.")}
<h3>3.4 Après : suivis et résultats</h3>
{points("<b>Suivis</b> : les contrôles à prévoir classés en retard, dans 7 jours, dans le mois. « Message WhatsApp » ouvre un rappel déjà rédigé ; on clique ensuite « Relancé », puis « Fait » quand le rendez-vous est pris.",
"<b>Résultats</b> : les PDF des laboratoires reçus par e-mail. Un résultat classé automatiquement est marqué « À relire » (un clic confirme, « Ce n'est pas lui » le retire) ; sinon il attend dans « À classer » (§ 4.9).")}
""")

partie("4. Les outils, un par un", f"""
<h3>4.1 Le dossier patient</h3>
<p>Un dossier regroupe l'identité, la couverture (CNSS, CNOPS, AMO Tadamon…), les facteurs de risque, les antécédents, les allergies, les traitements (en cours et arrêtés), les consultations, les examens, les ordonnances et les factures. Deux dossiers qui se ressemblent (même téléphone, ou même nom, prénom et date de naissance) sont signalés à la création.</p>
{points("<b>Alertes automatiques</b> : INR hors de la zone cible (à régler dans « Modifier »), bradycardie, TA ≥ 140/90, DFG &lt; 60 (critique &lt; 30), FEVG ≤ 40 % ou en baisse d'au moins 10 points.",
"<b>Évolution et calculs</b> : courbes de chaque valeur, calculs rattachés au dossier (CHA₂DS₂-VA, HFA-ICOS…), préremplis avec les données du dossier mais à vérifier à chaque fois.",
"<b>Langue parlée</b> : français ou arabe, dans « Modifier » ; elle sert à la dictée de la parole du patient.",
"<b>Fiche papier</b> : page A4 à faire remplir par le patient (le contenu médical n'est jamais prérempli).")}
{fig("12-alertes", "Dossier d'un patient avec trois alertes : bradycardie sous bêtabloquant, DFG abaissé, FEVG altérée. Elles se calculent à partir des consultations et des examens.")}
<h3>4.2 La voix</h3>
<p>La reconnaissance vocale est celle du navigateur (<b>Chrome, Edge ou Safari</b>), gratuite ; elle a besoin d'Internet. <b>Le son n'est jamais enregistré par le site.</b></p>
<table class="t"><tr><th>Outil</th><th>Comment</th><th>À savoir</th></tr>
<tr><td>Micro sur chaque champ de texte</td><td>Cliquer dans le champ : un micro apparaît dans son coin. <b>Ctrl+M</b> pour dicter, <b>Échap</b> pour arrêter.</td><td>Dites « virgule », « point », « à la ligne », « deux points » : la ponctuation est mise ; sigles et médicaments sont corrigés ; le texte s'insère au curseur.</td></tr>
<tr><td>Dictée de consultation</td><td>Bloc rouge en haut de la consultation : « Dicter la consultation ».</td><td>Annoncez les rubriques (« motif… conclusion… conduite à tenir… »). Les valeurs (« TA 13 8 », « INR 2,8 ») remplissent aussi les champs. Vous relisez avant « Insérer ».</td></tr>
<tr><td>Note vocale</td><td>Bouton rouge en bas à droite, ou Ctrl+M hors d'un champ.</td><td>Vous dictez librement ; le site propose des actions (note, suivi, traitement à ajouter ou arrêter, ordonnance) que vous cochez, corrigez puis enregistrez.</td></tr>
<tr><td>Parole du patient (arabe ou français)</td><td>« Qui parle ? → Le patient — arabe » ou français.</td><td>Sa parole est rapportée <b>en français</b> dans « Motif » et « Autres », à relire.</td></tr>
<tr><td>Consultation écoutée</td><td>« Qui parle ? → Toute la consultation ».</td><td><b>Accord du patient obligatoire</b> (case à cocher, inscrit au journal). Une heure au plus. Le texte est rangé par rubriques, à relire.</td></tr></table>
{fig("15-micro-champ", "Le micro apparaît dans le coin du champ où l'on écrit (ici, les antécédents).")}
{fig("16-note-vocale", "La note vocale : dossier choisi, texte dicté ou saisi, puis « Ranger en actions ». Le nom du patient est masqué avant l'envoi à l'intelligence artificielle.")}
{note("<b>Limites à connaître.</b> La reconnaissance du navigateur ne distingue pas les voix et gère <b>une langue à la fois</b> : un mélange français-arabe dans la même phrase est mal reconnu. L'arabe marocain parlé est incertain. Essayez avec de vrais cas avant de vous y fier ; si la qualité ne suffit pas, le moteur de reconnaissance peut être remplacé sans changer les écrans.", "att")}
<h3>4.3 L'ordonnance et ses vérifications</h3>
{etapes("Dans le dossier : <b>Ordonnance</b>. Les traitements en cours sont repris.",
"Taper le nom d'un médicament : la <b>base medicament.ma</b> (5 000 fiches) propose nom, substance, laboratoire et prix ; un clic remplit la ligne et affiche les informations de la fiche. On peut aussi <b>dicter</b> l'ordonnance (« bisoprolol 5, un comprimé le matin, trois mois, à la ligne… »).",
"Compléter la posologie et la durée. L'<b>aide à la prescription</b> rappelle des familles et des posologies usuelles selon la consultation.",
"Lire les <b>vérifications</b> sous les lignes, puis <b>Enregistrer l'ordonnance</b> ; <b>Imprimer</b> ouvre le PDF avec l'en-tête du cabinet.")}
{fig("17-ordonnance-alertes", "Vérifications d'une ordonnance : allergie notée au dossier (critique) et association IEC + ARA II (attention).")}
{note("Les vérifications repèrent : une <b>allergie</b> notée au dossier (avec les synonymes courants : aspirine = Kardégic, pénicilline = amoxicilline…), un médicament <b>en double</b>, deux médicaments de la <b>même famille</b>, et quelques <b>associations à surveiller</b>. Ces règles sont des mises en garde courantes que <b>vous devez relire</b> avant de vous y fier.")}
<h3>4.4 L'agenda</h3>
{points("<b>Ajouter un rendez-vous</b> (téléphone, WhatsApp) : on peut chercher un dossier existant, dont les coordonnées remplissent le formulaire. Type « Consultation » (30 min, retire un créneau aux patients) ou « Contrôle » (10 min, se glisse entre deux consultations).",
"<b>Modifier</b> : date, heure, durée, médecin, contact, motif — sur tous les rendez-vous, même ceux ajoutés directement dans Google Agenda. Si l'horaire change, le patient peut être prévenu (e-mail, WhatsApp).",
"<b>Fermer des créneaux</b> (congé, absence, formation) : un jour, plusieurs jours ou une plage horaire. Les rendez-vous déjà pris ne sont pas annulés.",
"<b>Dossier lié</b> : chaque rendez-vous indique son dossier, ou propose « C'est le même patient » quand il en trouve un probable.")}
{fig("04-agenda", "L'agenda : ajout d'un rendez-vous, fermeture de créneaux, puis les 14 prochains jours avec dossier lié, médecin, modifier et annuler.")}
<h3>4.5 Facturation et comptabilité</h3>
{points("<b>Facture proposée</b> : depuis la consultation, les lignes sont déjà remplies (consultation + actes du jour d'après vos tarifs). Vérifier, ajuster la remise, le mode de paiement, enregistrer.",
"Les factures sont <b>numérotées par mois</b> (2026-11-0001) et ne sont jamais supprimées : on les <b>annule</b> avec un motif.",
"<b>Comptabilité</b> : encaissements, charges (dont charges mensuelles récurrentes), statistiques, répartition entre médecins associés, export. Les tarifs et actes se règlent dans <b>Réglages</b>.")}
{fig("19-facture-proposee", "Facture proposée d'après la consultation : consultation de cardiologie et échocardiographie, déjà remplies.")}
{fig("20-comptabilite", "La comptabilité : vue d'ensemble des encaissements et des charges.")}
<h3>4.6 Le courrier au confrère</h3>
<p>Dans le dossier ou la consultation : <b>Courrier au confrère</b>. Le texte est rempli avec la consultation (motif, antécédents, traitement, examen, ECG, conclusion, conduite) et adressé au médecin traitant de la fiche. <b>Rien n'est ajouté</b> : les rubriques vides sont omises. Corrigez, puis <b>Imprimer le PDF</b> (en-tête du cabinet, emplacement « signature et cachet »).</p>
{fig("18-courrier", "Le courrier au confrère : destinataire, objet et texte modifiables avant l'impression du PDF.")}
<h3>4.7 Rappels, confirmation et liste d'attente</h3>
{points("<b>Rappels</b> : chaque rendez-vous des trois prochains jours est « pas encore rappelé », « rappelé sans réponse » ou « confirmé ». Le bouton envoie le rappel (si l'envoi automatique est configuré) ou prépare l'e-mail et le message WhatsApp.",
"Le rappel contient un <b>lien personnel</b> : le patient y <b>confirme</b> sa venue ou <b>annule</b> (le créneau est libéré aussitôt). Une modification de date efface l'ancienne confirmation.",
"<b>Liste d'attente</b> : on y inscrit les patients qui veulent un créneau plus tôt. Un rendez-vous annulé apparaît dans « Créneaux libérés » ; <b>Prévenir</b> prépare le message pour le patient suivant.",
"<b>Réservation en ligne</b> : les patients choisissent un créneau libre sur le site (français, arabe, anglais, espagnol).")}
{fig("05-rappels", "Rappels : confirmé, rappelé sans réponse, ou pas encore rappelé.")}
{fig("07-liste-attente", "Liste d'attente et créneaux libérés par les annulations.")}
{fig("33-lien-patient", "Ce que voit le patient avec son lien personnel : il confirme ou annule en un clic.")}
<h3>4.8 Messages WhatsApp et urgences</h3>
{points("Les messages écrits au numéro WhatsApp du cabinet arrivent dans <b>Messages</b>, avec un lien vers le dossier quand le téléphone est connu.",
"L'assistant (s'il est activé) répond seul à des <b>questions pratiques</b> : horaires, adresse, prise de rendez-vous, en français ou en arabe. Pour tout le reste il accuse réception et <b>laisse le message au secrétariat</b>.",
"Un message qui évoque une <b>urgence possible</b> (douleur thoracique, essoufflement brutal, malaise…) reçoit le rappel d'appeler le 141 ou le 15, passe en rouge en tête de la boîte et est inscrit au journal.")}
{note("<b>Le site n'envoie pas de notification</b> pour une urgence possible : quelqu'un doit regarder la boîte Messages. La pastille rouge est visible sur toutes les pages. La liste de mots d'urgence est une base de départ, à compléter.", "att")}
<h3>4.9 Résultats d'analyses</h3>
<p>Les PDF des laboratoires arrivent par e-mail, via un petit script Google. Le nom et le prénom du patient sont recherchés ; si un seul dossier correspond, le résultat est classé et marqué <b>À relire</b>. Sinon il attend dans <b>À classer</b> : ouvrez-le, vérifiez, choisissez le patient. Un même PDF n'est jamais enregistré deux fois.</p>
{fig("09-resultats", "Résultats reçus : à classer, à relire, et déjà traités.")}
<h3>4.10 Suivis</h3>
{fig("08-suivis", "Suivis classés en retard, dans les 7 jours et dans le mois. « Message WhatsApp » ouvre un rappel déjà rédigé.")}
<h3>4.11 Savoir : assistant, bibliothèque, calculateurs</h3>
{points("<b>Assistant</b> : posez une question (médicament, dose, seuil, conduite à tenir) ; la réponse ne vient <b>que de la bibliothèque</b>, chaque affirmation porte un numéro qui renvoie au passage cité (source, année, page). Depuis un dossier, un résumé <b>sans nom ni coordonnées</b> est joint : il s'affiche avant l'envoi. Notez chaque réponse <b>Juste</b> ou <b>À revoir</b> ; une réponse juste peut devenir une <b>fiche validée</b>.",
"<b>Bibliothèque</b> : recommandations (ESC…), RCP, protocoles du cabinet, fiches validées, classées <b>par thème</b> (fibrillation atriale, insuffisance cardiaque, coronaires, HTA…). Ajoutez un PDF (le DOI est lu et les champs se remplissent seuls) ou plusieurs à la fois ; quand une nouvelle recommandation paraît, marquez l'ancienne <b>remplacée</b> : elle n'est plus citée.",
"<b>Sites et revues</b> : le site suit les pages de recommandations et les flux de revues ; les nouveautés sont signalées. <b>À lire</b> épingle une publication, <b>Écarter</b> la masque.",
"<b>Médicaments</b> : recherche dans la base medicament.ma, avec alertes sur les médicaments prescrits qui ont changé.",
"<b>Calculateurs</b> : scores cliniques ; les calculs se rattachent au dossier.",
"<b>Vérifier les seuils</b> : pour chaque règle utilisée dans les comptes rendus, l'assistant propose si la source la confirme ; <b>vous validez</b> après avoir lu le passage.")}
{fig("23-assistant", "L'assistant à références : question libre ou depuis un dossier.")}
{fig("24-bibliotheque", "La bibliothèque : thèmes, ajout d'une source, sources en vigueur ou remplacées.")}
{fig("25-sites-revues", "Sites et revues suivis : publications nouvelles, « À lire », lien vers la version officielle (DOI).")}
{fig("22-calculateurs", "Calculateurs de scores cliniques.")}
<h3>4.12 Population</h3>
<p><b>Patients → Population</b> : le dernier INR de chaque patient qui a une zone cible, quand il en sort ; et les patients traités qu'on n'a pas revus depuis plus d'un an (avec un lien pour les appeler).</p>
{fig("21-population", "Vue d'ensemble de la patientèle : INR hors zone et patients traités pas revus.")}
<h3>4.13 Cabinet : reprise Word, modèles IA, journal, Drive, comptes</h3>
{points("<b>Reprise Word</b> : fait entrer les anciens rapports .docx dans les dossiers. Le nom et la date de naissance sont masqués avant lecture ; vous vérifiez tout à côté du texte d'origine, puis validez.",
"<b>Modèles IA</b> (administrateur) : le modèle et l'effort de chaque tâche confiée à Claude, et la dépense estimée par mois. Les tâches simples tournent sur le modèle le moins cher ; si une réponse ne passe pas son contrôle, elle est redemandée au modèle supérieur.",
"<b>Journal</b> (administrateur) : qui a ouvert, créé ou modifié quoi, et quand, avec filtres. Chaque connexion, réussie ou ratée, y figure.",
"<b>Drive</b> (administrateur) : connexion du Google Drive du cabinet, où sont rangés examens et PDF (un sous-dossier par patient).",
"<b>Comptes</b> (administrateur) : création et suppression des accès du personnel, choix du rôle.")}
{fig("29-modeles-ia", "Modèles IA : réglage par tâche et dépense estimée.")}
{fig("30-journal", "Le journal des accès, avec niveau de criticité.")}
{fig("28-reprise-word", "Reprise des anciens comptes rendus Word.")}
{fig("27-lexique", "Le lexique de la dictée : un mot mal reconnu se corrige une fois, pour toutes les dictées suivantes.")}
""")

partie("5. Bonnes pratiques et sécurité", f"""
<h3>Au quotidien</h3>
{points("Se <b>déconnecter</b> en quittant le poste (la connexion reste ouverte 12 heures).",
"Un <b>compte par personne</b>, mot de passe <b>long</b> (12 caractères au moins) et différent pour chaque compte. Pour changer un mot de passe : ressaisir l'identifiant avec le nouveau.",
"<b>Supprimer le compte d'un remplaçant</b> dès la fin du remplacement : il est déconnecté aussitôt.",
"Ne <b>jamais écrire le nom d'un patient dans un champ libre</b> (antécédents, notes) : ces textes peuvent être joints à une question à l'assistant ; seuls les noms des champs d'identité sont masqués.",
"Relire <b>avant d'enregistrer</b>, toujours : la dictée peut mal comprendre une dose ou un nom.",
"Pour une <b>ordonnance</b>, vérifier la posologie sur la fiche du médicament ; l'aide à la prescription n'est qu'un repère.",
"Écrire sur le <b>papier</b> ou téléphoner quand un doute persiste : l'écran ne remplace pas le jugement clinique.")}
<h3>Avec les patients</h3>
{points("<b>Consultation écoutée</b> : informez le patient et obtenez son accord avant de cocher la case ; affichez l'information dans la salle d'attente.",
"<b>WhatsApp</b> : le patient doit savoir qu'un assistant répond aux questions pratiques et que le secrétariat lit ses messages.",
"<b>Urgence</b> : l'assistant ne remplace pas le 141 (SAMU) ni le 15 (Protection civile).")}
<h3>Obligations légales</h3>
<p>Les dossiers contiennent des données de santé, « sensibles » au sens de la loi 09-08 : leur traitement demande l'<b>autorisation préalable de la CNDP</b> (cndp.ma). Les services utilisés (base de données Neon, Google Drive et Agenda, reconnaissance vocale de Google ou Apple, Claude, Meta/WhatsApp, Resend) sont hébergés hors du Maroc : ces transferts doivent figurer dans la demande. <b>À faire avant de saisir de vrais dossiers</b>, et avant d'activer la consultation écoutée et l'assistant WhatsApp.</p>
""")

partie("6. Quand ça ne marche pas", f"""
<table class="t"><tr><th>Constat</th><th>Que faire</th></tr>
<tr><td>« This page couldn't load » en changeant de page</td><td>Recharger la page (F5) ; si cela se reproduit, prévenir en notant la page et l'heure.</td></tr>
<tr><td>Le micro ne démarre pas</td><td>Autoriser le micro dans le navigateur (cadenas à gauche de l'adresse) ; utiliser Chrome, Edge ou Safari ; vérifier la connexion Internet.</td></tr>
<tr><td>La dictée comprend mal un médicament ou un sigle</td><td>Pendant la relecture, « Retenir dans le lexique » : la correction vaut pour toutes les dictées suivantes. Après un enregistrement, les mots corrigés à la main sont aussi proposés.</td></tr>
<tr><td>« Pas de réponse dans la bibliothèque »</td><td>La source manque : ajouter la recommandation ou le RCP dans la bibliothèque.</td></tr>
<tr><td>« Impossible de lire l'agenda Google »</td><td>Vérifier que l'agenda est partagé avec le compte de service (voir RESERVATION.md).</td></tr>
<tr><td>Le lien d'un patient n'est pas valide</td><td>Le rendez-vous a été supprimé ou modifié, ou le secret de signature a changé ; le patient est invité à téléphoner.</td></tr>
<tr><td>Un résultat de laboratoire n'arrive pas</td><td>Vérifier l'étiquette « LABORATOIRE/nom » dans Gmail et le déclencheur du script (RESULTATS.md).</td></tr>
<tr><td>Un message WhatsApp n'apparaît pas</td><td>Vérifier l'adresse du webhook dans Meta et les variables WhatsApp (RESERVATION.md, § 9).</td></tr></table>
""")

partie("7. Aide-mémoire", f"""
<table class="t"><tr><th>Je veux…</th><th>Je vais dans…</th></tr>
<tr><td>Voir ma journée et les alertes de chaque patient</td><td>Aujourd'hui → Ma journée</td></tr>
<tr><td>Savoir ce qui attend une validation</td><td>Aujourd'hui → À valider (ou les pastilles rouges)</td></tr>
<tr><td>Lire les messages des patients</td><td>Aujourd'hui → Messages</td></tr>
<tr><td>Rappeler ou faire confirmer les rendez-vous</td><td>Aujourd'hui → Rappels</td></tr>
<tr><td>Proposer un créneau libéré</td><td>Aujourd'hui → Liste d'attente → Prévenir</td></tr>
<tr><td>Dicter une note n'importe où</td><td>Ctrl+M (ou le bouton « Note vocale »)</td></tr>
<tr><td>Ouvrir un dossier, créer une consultation</td><td>Patients → dossier → Nouvelle consultation</td></tr>
<tr><td>Faire l'ordonnance, la facture, le courrier</td><td>Bandeau « Fin de consultation » de la consultation</td></tr>
<tr><td>Fermer l'agenda pour un congé</td><td>Agenda → Fermer des créneaux</td></tr>
<tr><td>Trouver les patients à rappeler, les INR hors cible</td><td>Patients → Population</td></tr>
<tr><td>Poser une question avec sources</td><td>Savoir → Assistant</td></tr>
<tr><td>Ajouter une recommandation</td><td>Savoir → Bibliothèque → Ajouter une source</td></tr>
<tr><td>Voir qui a ouvert un dossier</td><td>Cabinet → Journal (administrateur)</td></tr>
<tr><td>Donner ou retirer un accès</td><td>Cabinet → Comptes (administrateur)</td></tr></table>
""")

css = """
@page { size: A4; margin: 16mm 15mm 18mm 15mm; }
* { box-sizing: border-box; }
body { font-family: "Helvetica Neue", Arial, sans-serif; color: #0f172a; font-size: 10.5pt; line-height: 1.5; margin: 0; }
h1 { font-size: 26pt; margin: 0 0 6mm; color: #b91c1c; }
h2 { break-after: avoid; font-size: 16pt; color: #b91c1c; border-bottom: 2px solid #dc2626; padding-bottom: 2mm; margin: 0 0 5mm; }
h3 { font-size: 12pt; margin: 7mm 0 2mm; color: #0f172a; break-after: avoid; }
p { margin: 0 0 3mm; }
ul, ol { margin: 0 0 3mm; padding-left: 6mm; } li { margin-bottom: 1.5mm; }
.couverture { height: 255mm; display: flex; flex-direction: column; justify-content: center; }
.couverture .sous { font-size: 14pt; color: #334155; margin-bottom: 14mm; }
.couverture .meta { color: #64748b; font-size: 10pt; }
.sommaire { list-style: none; padding-left: 0; } .sommaire a { color: inherit; text-decoration: none; } .sommaire li { margin-bottom: 2mm; font-size: 11.5pt; }
section.partie { margin-top: 10mm; } section.partie.saut { break-before: page; margin-top: 0; }
figure { margin: 4mm 0 6mm; break-inside: avoid; text-align: center; }
figure img { max-width: 100%; max-height: 200mm; width: auto; height: auto; border: 1px solid #cbd5e1; border-radius: 2mm; }
figcaption { font-size: 9pt; color: #475569; margin-top: 1.5mm; text-align: left; }
.note { border-left: 3px solid #0284c7; background: #f0f9ff; padding: 2.5mm 4mm; margin: 3mm 0 4mm; border-radius: 0 2mm 2mm 0; break-inside: avoid; }
.note.att { border-color: #d97706; background: #fffbeb; }
table.t { width: 100%; border-collapse: collapse; margin: 2mm 0 5mm; font-size: 9.5pt; break-inside: auto; }
table.t th, table.t td { border: 1px solid #cbd5e1; padding: 2mm 3mm; text-align: left; vertical-align: top; }
table.t th { background: #f1f5f9; } tr { break-inside: avoid; }
ol.etapes { counter-reset: e; list-style: none; padding-left: 0; }
ol.etapes li { counter-increment: e; padding-left: 8mm; position: relative; }
ol.etapes li::before { content: counter(e); position: absolute; left: 0; top: 0; width: 5.5mm; height: 5.5mm; border-radius: 50%; background: #dc2626; color: #fff; font-size: 8.5pt; text-align: center; line-height: 5.5mm; }
"""
sommaire = "".join(f'<li><a href="#p{i}">{html.escape(t)}</a></li>' for i, (t, _, _) in enumerate(parties))
corps = "".join(f'<section class="partie{" saut" if i in (0, 2, 3, 6) else ""}" id="p{i}"><h2>{html.escape(t)}</h2>{c}</section>' for i, (t, c, _) in enumerate(parties))
doc = f"""<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Guide du médecin — Espace cabinet</title><style>{css}</style></head><body>
<div class="couverture"><h1>Guide du médecin</h1><div class="sous">Espace cabinet — procédures et outils au quotidien</div>
<div class="meta">Cabinet de cardiologie du Dr Taouab Zogarh Cursoux, Tanger<br>Novembre 2026<br>Les captures utilisent des données fictives.</div>
<h3 style="margin-top:18mm">Sommaire</h3><ol class="sommaire">{sommaire}</ol></div>
{corps}</body></html>"""
pathlib.Path(__file__).resolve().parents[2].joinpath("docs/guide-medecin/guide-medecin.html").write_text(doc)
print("figures:", fig_n[0])
