# Amane GRC

**Plateforme de conformité pour les PME marocaines** : ISO 27001:2022, loi 09-08 (CNDP) et DNSSI / loi 05-20, dans une seule application web, avec une bibliothèque de mesures unifiées, des tests automatisés sur les postes Windows, des politiques prêtes à l'emploi et les registres exigés par les auditeurs.

> « Amane » (أمان) signifie sécurité, confiance.

## Ce que fait Amane

| Module | Contenu |
|---|---|
| **Référentiels** | ISO 27001:2022 (clauses 4 à 10 + 93 mesures de l'Annexe A), loi 09-08 (16 obligations), DNSSI et loi 05-20 (21 exigences). Score de préparation par référentiel, exigences satisfaites, exclusions justifiées. |
| **Mesures unifiées** | 66 mesures en français, chacune reliée à toutes les exigences qu'elle couvre : avancer sur une mesure fait progresser les trois référentiels. 100 % des exigences sont couvertes. |
| **Preuves** | Fichiers, liens et notes déposés sur chaque mesure, horodatés et attribués. |
| **Tests automatisés** | 17 tests en continu : 8 vérifiés sur chaque poste par l'agent Windows (chiffrement, antivirus, pare-feu, mises à jour, verrouillage, version de Windows, droits administrateur, mots de passe) et 9 calculés par la plateforme (politiques acceptées, formation, revue des risques, des fournisseurs et des accès, déclarations CNDP…). |
| **Politiques** | 12 modèles en français (PSSI, contrôle d'accès, charte, sauvegarde, incidents, données personnelles, fournisseurs, actifs, télétravail, développement, continuité, vulnérabilités), versionnés, approuvés et acceptés par chaque collaborateur. |
| **Risques** | Registre avec cartographie inhérente et résiduelle (5 × 5), plan de traitement, mesures associées et bibliothèque de 10 risques types de PME. |
| **Fournisseurs** | Criticité, accès aux données, pays, clauses de protection des données, revue annuelle. |
| **Registre 09-08** | Traitements, finalités, bases légales, catégories de données, durées, transferts hors Maroc, statut et référence CNDP. |
| **Personnes et appareils** | Intégration sécurité de chaque collaborateur (politiques, formation, poste équipé) et inventaire des postes remonté par l'agent. |
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

Les identifiants de démonstration sont écrits dans `demo-data/IDENTIFIANTS-DEMO.txt`.

## Agent Windows

Chaque collaborateur trouve dans **Mon espace** une commande PowerShell personnalisée, sans droits administrateur :

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -Command "iwr 'http://SERVEUR:4870/agent/install.ps1?token=…&email=…' -OutFile $env:TEMP\amane-agent.ps1; & $env:TEMP\amane-agent.ps1 -Install"
```

L'agent vérifie le poste, envoie le résultat, puis se planifie toutes les 4 heures (tâche « Amane Agent »). `-Uninstall` le retire. Il ne collecte que le nom du poste, le numéro de série, la version de Windows, l'e-mail de l'utilisateur et le résultat des 8 contrôles.

## Architecture

| Dossier | Rôle |
|---|---|
| `server/index.js` | API REST (Express), sessions, rôles, exports, endpoint de l'agent |
| `server/db.js` | Schéma SQLite (`node:sqlite`) et chargement du contenu réglementaire |
| `server/engine.js` | Moteur de conformité : tests automatisés, santé des mesures, scores |
| `server/auth.js` | Mots de passe (scrypt), sessions en cookie HttpOnly, contrôle des rôles |
| `server/content/` | Référentiels, 66 mesures et leurs correspondances, tests, modèles de politiques |
| `web/` | Application web (modules JavaScript, sans framework ni dépendance externe) |
| `agent/amane-agent.ps1` | Agent Windows |
| `scripts/demo.js` | Base de démonstration |

## Sécurité de l'application

- Mots de passe hachés avec scrypt, 12 caractères minimum, limitation des tentatives de connexion.
- Sessions par cookie `HttpOnly` et `SameSite=Strict`, en-têtes de sécurité (CSP stricte, anti-iframe).
- Contrôle des rôles sur chaque route de l'API, journal d'activité.
- Fonctionne hors ligne : aucune donnée n'est envoyée à un service tiers.

## Avertissement

Les textes des exigences sont des **reformulations** destinées au pilotage, pas les textes officiels : la norme ISO/IEC 27001 est protégée par le droit d'auteur, et les références aux articles de la loi 09-08, de la DNSSI et de la loi 05-20 sont indicatives. Faites valider votre déclaration d'applicabilité et vos obligations réglementaires par votre auditeur ou votre conseil juridique.
