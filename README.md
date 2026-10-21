# Amane GRC

**Plateforme de conformité pour les PME marocaines** : ISO 27001:2022, loi 09-08 (CNDP) et DNSSI / loi 05-20, plus NIST CSF 2.0 et COBIT 2019 en option, dans une seule application web : mesures unifiées, tests automatisés sur les postes Windows et Microsoft 365, politiques prêtes à l'emploi, analyse de risques EBIOS RM, registre des incidents avec déclaration à la DGSSI, alertes par e-mail et Trust Center public.

> « Amane » (أمان) signifie sécurité, confiance.

<p align="center"><img src="docs/dashboard.png" alt="Vue d’ensemble : préparation par référentiel, indicateurs, priorités, carte des risques" width="100%"></p>

## En images

<table>
  <tr>
    <td width="50%"><img src="docs/dashboard-sombre.png" alt="Vue d’ensemble en thème sombre"><p align="center"><b>Thème sombre</b> · basculez en un clic, mémorisé par navigateur</p></td>
    <td width="50%"><img src="docs/palette.png" alt="Palette de commandes"><p align="center"><b>Palette de commandes</b> · <code>Ctrl K</code> / <code>⌘ K</code> pour aller à une page, une mesure, une politique, un risque</p></td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/referentiel.png" alt="Référentiel ISO 27001"><p align="center"><b>Référentiels</b> · exigences satisfaites, mesures liées, exclusions justifiées</p></td>
    <td width="50%"><img src="docs/mesure.png" alt="Fiche d’une mesure"><p align="center"><b>Mesures</b> · mise en œuvre, exigences couvertes, tests et preuves</p></td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/tests.png" alt="Tests automatisés"><p align="center"><b>Tests automatisés</b> · postes, Microsoft 365, incidents et programme</p></td>
    <td width="50%"><img src="docs/politique.png" alt="Politique et acceptations"><p align="center"><b>Politiques</b> · versions approuvées et acceptation par chacun</p></td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/ebios-traitement.png" alt="EBIOS RM, atelier 5"><p align="center"><b>EBIOS RM</b> · cartographie, mesures et envoi au registre</p></td>
    <td width="50%"><img src="docs/ebios-atelier1.png" alt="EBIOS RM, atelier 1"><p align="center"><b>EBIOS RM</b> · cinq ateliers, socle de sécurité calculé</p></td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/risques.png" alt="Registre des risques"><p align="center"><b>Risques</b> · cartes inhérente et résiduelle, plan de traitement</p></td>
    <td width="50%"><img src="docs/incidents.png" alt="Registre des incidents"><p align="center"><b>Incidents</b> · échéance de déclaration DGSSI, violations de données</p></td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/trust-center.png" alt="Trust Center public"><p align="center"><b>Trust Center</b> · page publique mise à jour en continu</p></td>
    <td width="50%"><img src="docs/trust-center-admin.png" alt="Administration du Trust Center"><p align="center"><b>Trust Center</b> · contenu publié et demandes d’accès aux documents</p></td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/registre-0908.png" alt="Registre loi 09-08"><p align="center"><b>Registre 09-08</b> · bases légales, transferts, statut CNDP</p></td>
    <td width="50%"><img src="docs/integrations.png" alt="Intégration Microsoft 365"><p align="center"><b>Microsoft 365</b> · MFA de chaque compte, administrateurs, accès conditionnel</p></td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/appareils.png" alt="Appareils surveillés"><p align="center"><b>Appareils</b> · 8 contrôles par poste via l’agent Windows</p></td>
    <td width="50%"><img src="docs/personnes.png" alt="Personnes"><p align="center"><b>Personnes</b> · politiques, formation, poste et MFA de chacun</p></td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/mon-espace.png" alt="Espace collaborateur"><p align="center"><b>Mon espace</b> · les tâches de chaque collaborateur</p></td>
    <td width="50%"><img src="docs/ebios-sombre.png" alt="EBIOS RM en thème sombre"><p align="center"><b>EBIOS RM</b> · thème sombre</p></td>
  </tr>
  <tr>
    <td colspan="2"><img src="docs/connexion.png" alt="Connexion"><p align="center"><b>Connexion</b></p></td>
  </tr>
</table>

<sub>Captures réalisées sur l’instance de démonstration (société fictive Atlas Conseil SARL). Les jetons de l’agent sont masqués.</sub>

## Interface

Typographie Geist (police libre, embarquée dans `web/fonts/`, aucun appel à un CDN), surfaces neutres, un seul accent terracotta, thème clair et sombre, palette de commandes `Ctrl K` / `⌘ K`, tableaux denses et lisibles. Aucune bibliothèque d’interface : modules JavaScript natifs.

## Ce que fait Amane

| Module | Contenu |
|---|---|
| **Référentiels** | ISO 27001:2022 (clauses 4 à 10 + 93 mesures de l'Annexe A), loi 09-08 (16 obligations), DNSSI et loi 05-20 (21 exigences). En option, activables dans Paramètres : NIST CSF 2.0 (22 catégories) et COBIT 2019 (40 objectifs, dont 8 hors périmètre sécurité exclus avec justification). Score de préparation par référentiel, exigences satisfaites, exclusions justifiées. |
| **Mesures unifiées** | 66 mesures en français, chacune reliée à toutes les exigences qu'elle couvre : avancer sur une mesure fait progresser tous les référentiels. 100 % des exigences sont couvertes. |
| **Preuves** | Fichiers, liens et notes déposés sur chaque mesure, horodatés et attribués. |
| **Tests automatisés** | 22 tests en continu : 8 vérifiés sur chaque poste par l'agent Windows (chiffrement, antivirus, pare-feu, mises à jour, verrouillage, version de Windows, droits administrateur, mots de passe), 3 sur Microsoft 365 (MFA de tous les comptes, MFA des administrateurs, MFA imposée au niveau du locataire) et 11 calculés par la plateforme (politiques acceptées, formation, revue des risques, des fournisseurs et des accès, déclarations CNDP, incidents déclarés à la DGSSI, retours d'expérience…). |
| **Politiques** | 12 modèles en français (PSSI, contrôle d'accès, charte, sauvegarde, incidents, données personnelles, fournisseurs, actifs, télétravail, développement, continuité, vulnérabilités), versionnés, approuvés et acceptés par chaque collaborateur. |
| **Risques** | Registre avec cartographie inhérente et résiduelle (5 × 5), plan de traitement, mesures associées et bibliothèque de 10 risques types de PME. |
| **EBIOS RM** | Analyse de risques selon la méthode de l'ANSSI en cinq ateliers : valeurs métier, biens supports, événements redoutés et socle de sécurité (calculé depuis les référentiels), couples source de risque / objectif visé, parties prenantes et menace, scénarios stratégiques et opérationnels, cartographie gravité × vraisemblance. Les scénarios retenus sont envoyés au registre des risques avec leurs mesures. |
| **Incidents** | Registre des incidents, échéance de déclaration à la DGSSI (maCERT) selon un délai interne paramétrable, fiche de déclaration imprimable, suivi des violations de données personnelles (information de la CNDP), cause racine et retour d'expérience. |
| **Trust Center** | Page publique sans compte (`/trust`) : référentiels et scores, mesures en place par domaine, contrôles automatisés réussis, sous-traitants, politiques. Le texte des politiques est accessible sur demande, après accord de l'administrateur, par un lien personnel valable 30 jours. |
| **Alertes par e-mail** | Serveur SMTP au choix : alerte des administrateurs quand un test passe en échec, relance des collaborateurs chaque lundi (politiques, formation, agent), rappels des déclarations DGSSI, notification des demandes d'accès au Trust Center. Journal des envois. |
| **Fournisseurs** | Criticité, accès aux données, pays, clauses de protection des données, revue annuelle. |
| **Registre 09-08** | Traitements, finalités, bases légales, catégories de données, durées, transferts hors Maroc, statut et référence CNDP. |
| **Personnes et appareils** | Intégration sécurité de chaque collaborateur (politiques, formation, poste équipé, MFA) et inventaire des postes remonté par l'agent. |
| **Microsoft 365** | Connexion en lecture seule à Entra ID : méthodes d'authentification de chaque compte, rôles d'administration, paramètres de sécurité par défaut et stratégies d'accès conditionnel. Synchronisation toutes les 6 heures. |
| **Rapports** | Déclaration d'applicabilité (SoA), registres en CSV et rapport de préparation à l'audit imprimable en PDF. |
| **Rôles** | Administrateur (RSSI), collaborateur (son espace : politiques, formation, agent) et auditeur (lecture seule). Journal d'activité. |

## Démarrage

Prérequis : **Node.js 22.13 ou plus récent** (la base SQLite est intégrée à Node, aucune autre installation).

```bash
npm install
npm start
```

Ouvrez **http://localhost:4870** : l'écran de configuration crée l'organisme et le compte administrateur, puis charge les référentiels, les mesures et les modèles de politiques.

Les données sont stockées dans `data/` (base `amane.db` et preuves déposées). Sauvegardez ce dossier.

### Rendre Amane accessible aux postes du réseau

Pour que les collaborateurs et l'agent Windows joignent le serveur, lancez-le sur toutes les interfaces :

```bash
# PowerShell
$env:HOST = "0.0.0.0"; npm start
```

puis utilisez l'adresse du serveur sur le réseau local (par exemple `http://192.168.1.10:4870`). En production, placez Amane derrière un proxy HTTPS.

### Instance de démonstration

```bash
node scripts/demo.js                                   # crée demo-data/ (société fictive Atlas Conseil SARL)
# PowerShell
$env:AMANE_DATA = "demo-data"; $env:PORT = 4871; npm start
```

Les identifiants de démonstration sont écrits dans `demo-data/IDENTIFIANTS-DEMO.txt`. Les captures du README se régénèrent avec `npm run screenshots` (instance de démonstration lancée, Chrome ou Edge installé).

## Agent Windows

Chaque collaborateur trouve dans **Mon espace** une commande PowerShell personnalisée, sans droits administrateur :

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -Command "iwr 'http://SERVEUR:4870/agent/install.ps1?token=…&email=…' -OutFile $env:TEMP\amane-agent.ps1; & $env:TEMP\amane-agent.ps1 -Install"
```

L'agent vérifie le poste, envoie le résultat, puis se planifie toutes les 4 heures (tâche « Amane Agent »). `-Uninstall` le retire. Il ne collecte que le nom du poste, le numéro de série, la version de Windows, l'e-mail de l'utilisateur et le résultat des 8 contrôles.

## Intégration Microsoft 365

Dans **Organisation › Intégrations**, l'administrateur saisit l'ID du locataire, l'ID d'application et un secret client. La page explique comment créer l'application dans le centre d'administration Entra :

1. Inscriptions d'applications › Nouvelle inscription « Amane GRC » (comptes de cet annuaire uniquement).
2. API autorisées › Microsoft Graph › **autorisations d'application** : `User.Read.All`, `UserAuthenticationMethod.Read.All`, `RoleManagement.Read.Directory`, `Policy.Read.All`, et `AuditLog.Read.All` en option (rapport d'inscription Entra ID P1/P2, une seule requête au lieu d'une par compte).
3. Accorder le consentement administrateur, puis créer un secret client.

Amane ne fait que lire : aucune écriture n'est faite dans le locataire. Le secret est chiffré en AES-256-GCM (clé dans `data/secret.key` ou variable `AMANE_SECRET`) et n'est jamais renvoyé au navigateur. Les comptes invités sont ignorés ; les comptes désactivés sont listés mais n'entrent pas dans les tests.

Pour essayer sans locataire, un Graph simulé est fourni :

```bash
node scripts/mock-graph.js                    # MOCK_NO_REPORT=1 pour simuler un locataire sans P1/P2
# PowerShell, dans un autre terminal
$env:AMANE_M365_LOGIN = "http://127.0.0.1:4999"; $env:AMANE_M365_GRAPH = "http://127.0.0.1:4999"; npm start
```

puis configurez n'importe quels identifiants (GUID ou domaine) avec le secret `mock-secret`.

## Trust Center

Dans **Organisation › Trust Center**, choisissez ce que vous publiez puis partagez l'adresse `/trust` (Amane doit être joignable depuis Internet, derrière un proxy HTTPS). Seules les mesures **en place** sont listées : la page ne révèle jamais ce qui manque encore, ni preuves, ni risques, ni noms de personnes. Un client peut demander l'accès aux politiques ; l'administrateur accorde ou refuse la demande, et le demandeur reçoit un lien personnel valable 30 jours (par e-mail si les alertes sont configurées). Les demandes publiques sont limitées à 5 par heure et par adresse IP.

## Incidents et déclaration à la DGSSI

La loi 05-20 impose aux entités concernées (administrations, infrastructures d'importance vitale, opérateurs) de déclarer sans délai à la DGSSI (maCERT) les incidents affectant la sécurité ou le fonctionnement de leurs systèmes. Amane calcule une échéance à partir de l'heure de détection et d'un **délai interne** que vous fixez dans Paramètres (24 heures par défaut), le test `Incidents déclarés à la DGSSI` passe en échec tant que la déclaration n'est pas saisie, et la fiche de déclaration pré-remplie s'imprime ou s'enregistre en PDF depuis l'incident. Vérifiez le formulaire et le canal officiels de la DGSSI avant l'envoi.

## Alertes par e-mail

Dans **Paramètres › Alertes par e-mail**, renseignez votre serveur SMTP (Microsoft 365 : `smtp.office365.com`, port 587 ; ou celui de votre hébergeur), l'adresse d'expédition et l'adresse d'Amane utilisée dans les liens. Le mot de passe est chiffré en AES-256-GCM. Un bouton envoie un e-mail de test ; un autre envoie immédiatement les relances aux collaborateurs.

## EBIOS Risk Manager

**Risques et tiers › Analyse EBIOS RM** suit les cinq ateliers de la méthode de l'ANSSI. Les échelles EBIOS (gravité et vraisemblance de 1 à 4) sont converties sur l'échelle du registre (1 à 5) lorsqu'un scénario opérationnel est envoyé au registre des risques ; un nouvel envoi met à jour le même risque.

## Architecture

| Dossier | Rôle |
|---|---|
| `server/index.js` | API REST (Express), sessions, rôles, exports, endpoint de l'agent |
| `server/db.js` | Schéma SQLite (`node:sqlite`) et chargement du contenu réglementaire |
| `server/engine.js` | Moteur de conformité : tests automatisés, santé des mesures, scores |
| `server/trust.js` | Trust Center : vue publique, accès aux documents, demandes |
| `server/mailer.js` | Alertes e-mail (SMTP via Nodemailer), relances et rappels planifiés |
| `server/ebios.js` | Ateliers EBIOS RM et envoi des scénarios au registre des risques |
| `server/integrations/m365.js` | Connecteur Microsoft Graph (jeton client, comptes, méthodes MFA, rôles, accès conditionnel) |
| `server/auth.js` | Mots de passe (scrypt), sessions en cookie HttpOnly, contrôle des rôles |
| `server/content/` | Référentiels, 66 mesures et leurs correspondances, tests, modèles de politiques |
| `web/trust.html` | Page publique du Trust Center |
| `web/` | Application web (modules JavaScript, sans framework ni dépendance externe), `app.css` : système de design clair / sombre |
| `web/fonts/` | Polices Geist et Geist Mono (licence SIL OFL, `OFL.txt`) |
| `agent/amane-agent.ps1` | Agent Windows |
| `scripts/demo.js` | Base de démonstration |
| `scripts/mock-graph.js` | Microsoft Graph simulé pour tester l'intégration Microsoft 365 |

## Sécurité de l'application

- Mots de passe hachés avec scrypt, 12 caractères minimum, limitation des tentatives de connexion.
- Sessions par cookie `HttpOnly` et `SameSite=Strict`, en-têtes de sécurité (CSP stricte, anti-iframe).
- Contrôle des rôles sur chaque route de l'API, journal d'activité.
- Fonctionne hors ligne : aucune donnée n'est envoyée à un service tiers. Seules les fonctions que vous activez sortent du serveur : l'intégration Microsoft 365 (lecture de Microsoft Graph), les alertes (votre serveur SMTP) et le Trust Center (page publique, contenu choisi).
- Secrets d'intégration chiffrés au repos (AES-256-GCM).

## Avertissement

Les textes des exigences sont des **reformulations** destinées au pilotage, pas les textes officiels : la norme ISO/IEC 27001 est protégée par le droit d'auteur, et les références aux articles de la loi 09-08, de la DNSSI et de la loi 05-20 sont indicatives. Faites valider votre déclaration d'applicabilité et vos obligations réglementaires par votre auditeur ou votre conseil juridique.
