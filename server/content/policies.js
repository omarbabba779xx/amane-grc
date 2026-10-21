// Policy templates (French, Markdown). {{organisation}} and {{rssi}} are filled in when the policy is created.
const p = (code, title, summary, body) => ({ code, title, summary, body: body.trim() });

module.exports = [
  p("POL-PSSI", "Politique de sécurité des systèmes d'information (PSSI)", "Cadre général, engagements de la direction et principes de sécurité.", `
# Politique de sécurité des systèmes d'information

## 1. Objet
La présente politique fixe le cadre de la sécurité de l'information de **{{organisation}}**. Elle s'applique à toutes les personnes (salariés, stagiaires, prestataires) et à tous les systèmes, données et locaux de l'organisme.

## 2. Engagement de la direction
La direction de {{organisation}} considère l'information comme un actif essentiel. Elle s'engage à :
- protéger la confidentialité, l'intégrité et la disponibilité des informations ;
- respecter les exigences légales, notamment la loi 09-08 sur la protection des données personnelles et la loi 05-20 sur la cybersécurité ;
- fournir les moyens humains, techniques et financiers nécessaires ;
- améliorer en continu le système de management de la sécurité de l'information (SMSI).

## 3. Organisation
- Le **Responsable de la sécurité des SI (RSSI)**, {{rssi}}, pilote le SMSI et rend compte à la direction.
- Chaque **propriétaire d'actif** est responsable de la classification et des accès aux informations dont il a la charge.
- Chaque **collaborateur** applique les règles de sécurité et signale tout incident.

## 4. Principes
1. Les risques sont appréciés au moins une fois par an et traités selon un plan approuvé.
2. Les accès sont attribués selon le besoin d'en connaître et le principe du moindre privilège.
3. Les postes et serveurs sont protégés, chiffrés lorsque c'est nécessaire et maintenus à jour.
4. Les données critiques sont sauvegardées et la restauration est testée.
5. Les incidents sont signalés, traités et analysés.
6. Les fournisseurs ayant accès aux informations sont évalués et liés par des clauses de sécurité.

## 5. Revue
Cette politique est revue au moins une fois par an, ou lors de tout changement significatif.
`),
  p("POL-ACCES", "Politique de contrôle d'accès et de mots de passe", "Comptes, droits, mots de passe, authentification multifacteur et revues.", `
# Politique de contrôle d'accès et de mots de passe

## 1. Principes
- Chaque utilisateur dispose d'un **compte nominatif** ; les comptes partagés sont interdits sauf exception validée par le RSSI.
- Les droits sont accordés selon le **besoin d'en connaître** et le **moindre privilège**, après validation du responsable hiérarchique.

## 2. Mots de passe
- Longueur minimale : **12 caractères** (16 pour les comptes administrateurs), sans obligation de changement périodique sauf suspicion de compromission.
- Interdiction de réutiliser un mot de passe professionnel ailleurs ; usage recommandé d'un gestionnaire de mots de passe.
- Verrouillage du compte après 10 tentatives infructueuses.

## 3. Authentification multifacteur (MFA)
La MFA est **obligatoire** pour : la messagerie, les accès à distance (VPN, bureau à distance), les consoles cloud et tous les comptes à privilèges.

## 4. Comptes à privilèges
- Les administrateurs utilisent un compte dédié, distinct de leur compte quotidien.
- La liste des comptes à privilèges est revue chaque trimestre.

## 5. Cycle de vie
- Arrivée : création des accès sur demande validée.
- Mobilité : révision des droits sous 5 jours ouvrés.
- Départ : désactivation de tous les accès **le jour même**.

## 6. Revue des accès
Les droits sur les applications et données sensibles sont revus **tous les six mois** par leurs propriétaires.
`),
  p("POL-CHARTE", "Charte d'utilisation des moyens informatiques", "Règles d'usage acceptable du matériel, de la messagerie et d'internet.", `
# Charte d'utilisation des moyens informatiques

En acceptant cette charte, je m'engage à utiliser les moyens informatiques de **{{organisation}}** de façon responsable.

## Je m'engage à
- garder mes identifiants secrets et ne jamais les communiquer, y compris au support informatique ;
- verrouiller ma session dès que je quitte mon poste (touches **Windows + L**) ;
- ne pas installer de logiciel non autorisé ni désactiver l'antivirus, le pare-feu ou le chiffrement ;
- ne stocker les données professionnelles que sur les espaces autorisés par l'organisme ;
- signaler immédiatement tout courriel suspect, perte de matériel ou incident au RSSI ;
- respecter la confidentialité des informations et la vie privée des personnes (loi 09-08).

## Il est interdit de
- utiliser les moyens de l'organisme à des fins illicites ou contraires à son image ;
- transférer des données professionnelles vers une messagerie ou un stockage personnels ;
- brancher un support amovible inconnu.

## Contrôles
L'organisme peut contrôler l'usage des moyens informatiques dans le respect de la loi et de la vie privée. Les manquements peuvent entraîner des sanctions disciplinaires.
`),
  p("POL-SAUV", "Politique de sauvegarde et de restauration", "Fréquences, règle 3-2-1, copie hors ligne et tests de restauration.", `
# Politique de sauvegarde et de restauration

## 1. Périmètre
Serveurs, bases de données, applications métiers, messagerie et espaces de partage de **{{organisation}}**.

## 2. Règles
- Application de la règle **3-2-1** : 3 copies, sur 2 supports différents, dont 1 hors site.
- Au moins une copie est **hors ligne ou immuable** pour résister aux rançongiciels.
- Les sauvegardes sont **chiffrées** et leur accès est restreint.

## 3. Fréquences et conservation
| Données | Fréquence | Conservation |
|---|---|---|
| Bases de données critiques | quotidienne | 30 jours |
| Serveurs de fichiers | quotidienne | 30 jours, mensuelle 12 mois |
| Configurations | à chaque changement | 12 mois |

## 4. Tests
Une restauration complète d'un système critique est testée **chaque trimestre** et le résultat est consigné.
`),
  p("POL-INC", "Procédure de gestion des incidents de sécurité", "Signalement, qualification, traitement, déclaration DGSSI et CNDP, retour d'expérience.", `
# Procédure de gestion des incidents de sécurité

## 1. Signaler
Tout collaborateur qui constate un événement suspect (courriel frauduleux, perte de matériel, comportement anormal d'un poste, fuite de données) le signale **immédiatement** au RSSI ({{rssi}}).

## 2. Qualifier
Le RSSI évalue la gravité : **faible**, **moyenne**, **élevée** ou **critique**, selon l'impact sur la confidentialité, l'intégrité, la disponibilité et les données personnelles.

## 3. Traiter
1. Contenir (isoler le poste, désactiver le compte, couper un flux).
2. Éradiquer la cause et restaurer le service.
3. Préserver les preuves (journaux, images disque) avant toute remise à zéro.

## 4. Déclarer
- Incidents affectant la sécurité ou le fonctionnement des SI : déclaration à la **DGSSI (maCERT)** lorsque l'organisme y est soumis (loi 05-20).
- Violation de données personnelles : information de la **CNDP** et, si nécessaire, des personnes concernées.

## 5. Tirer les enseignements
Chaque incident élevé ou critique fait l'objet d'un rapport d'analyse et d'actions correctives suivies dans Amane.
`),
  p("POL-DCP", "Politique de protection des données personnelles (loi 09-08)", "Principes 09-08, registre, formalités CNDP, droits et transferts.", `
# Politique de protection des données personnelles

## 1. Engagement
**{{organisation}}** traite les données personnelles conformément à la loi n° 09-08 et sous le contrôle de la CNDP.

## 2. Principes
- Collecte **loyale et licite**, pour des **finalités déterminées** ;
- données **adéquates, pertinentes et non excessives** ;
- données **exactes** et tenues à jour ;
- **durée de conservation** limitée à la finalité.

## 3. Registre et formalités
- Chaque traitement est inscrit au **registre des traitements** tenu dans Amane.
- Chaque traitement est **déclaré à la CNDP** ou soumis à son **autorisation préalable** avant sa mise en œuvre.

## 4. Droits des personnes
Les demandes d'**accès**, de **rectification** et d'**opposition** sont traitées dans les délais légaux. Elles sont adressées à : dpo@{{organisation}}.

## 5. Sécurité et sous-traitance
Les mesures techniques et organisationnelles du SMSI s'appliquent aux données personnelles. Les sous-traitants sont liés par contrat et offrent des garanties suffisantes.

## 6. Transferts
Aucun transfert vers l'étranger n'a lieu sans vérification du niveau de protection du pays destinataire ou autorisation de la CNDP.
`),
  p("POL-FOUR", "Politique de sécurité des relations fournisseurs", "Évaluation, clauses contractuelles, suivi et fin de contrat.", `
# Politique de sécurité des relations fournisseurs

## 1. Évaluation
Avant toute contractualisation, le fournisseur est classé selon sa **criticité** (accès aux données, aux systèmes, à des services essentiels). Les fournisseurs critiques remplissent un questionnaire de sécurité.

## 2. Contrat
Les contrats incluent : confidentialité, sécurité des données, notification des incidents, droit d'audit, localisation des données, clauses de sous-traitance au sens de la loi 09-08 et restitution des données en fin de contrat.

## 3. Suivi
Les fournisseurs critiques sont revus **chaque année** dans le registre des fournisseurs d'Amane.

## 4. Fin de relation
Les accès sont révoqués et les données restituées ou détruites, avec preuve.
`),
  p("POL-ACTIFS", "Politique de gestion et de classification des actifs", "Inventaire, propriétaires, niveaux de classification et marquage.", `
# Politique de gestion et de classification des actifs

## 1. Inventaire
Les matériels, logiciels, données et services sont inventoriés avec un **propriétaire** désigné. L'agent Amane alimente l'inventaire des postes.

## 2. Classification
| Niveau | Exemples | Règles |
|---|---|---|
| Public | site web, plaquettes | diffusion libre |
| Interne | procédures, notes | personnel uniquement |
| Confidentiel | contrats, données RH, données clients | accès restreint, chiffrement en transfert |
| Secret | données stratégiques, secrets d'authentification | accès nominatif, chiffrement systématique |

## 3. Marquage et manipulation
Les documents confidentiels et secrets portent leur niveau de classification. Leur envoi à l'extérieur se fait par un moyen chiffré.
`),
  p("POL-TELE", "Politique de télétravail et de sécurité des terminaux", "Postes chiffrés, VPN, mises à jour et confidentialité à distance.", `
# Politique de télétravail et de sécurité des terminaux

## Postes de travail
- Disque **chiffré** (BitLocker), antivirus et pare-feu **actifs**, mises à jour installées sous **30 jours**.
- Verrouillage automatique après **15 minutes** d'inactivité au plus.
- L'agent Amane est installé et vérifie ces points en continu.

## Travail à distance
- Connexion au système d'information uniquement via le **VPN** de l'organisme avec MFA.
- Pas de travail sur des informations confidentielles dans les lieux publics sans filtre de confidentialité.
- Réseau Wi-Fi domestique protégé par WPA2 ou WPA3.

## Perte ou vol
Toute perte ou vol de matériel est signalé **immédiatement** au RSSI.
`),
  p("POL-DEV", "Politique de développement sécurisé", "Exigences, revue de code, tests, secrets et séparation des environnements.", `
# Politique de développement sécurisé

1. Les **exigences de sécurité** sont définies dès la conception (authentification, journalisation, protection des données).
2. Le code est versionné ; toute modification de la branche principale passe par une **revue de code**.
3. Les **secrets** (mots de passe, clés d'API) ne sont jamais stockés dans le code.
4. Les dépendances sont analysées et mises à jour ; les vulnérabilités critiques sont corrigées avant mise en production.
5. Les environnements de **développement, test et production** sont séparés ; les données réelles ne sont pas utilisées en test sans anonymisation.
6. Une **recette de sécurité** est réalisée avant chaque mise en production majeure.
`),
  p("POL-PCA", "Politique de continuité d'activité", "Activités critiques, RTO / RPO, plan de reprise et exercices.", `
# Politique de continuité d'activité

## 1. Bilan d'impact
Les activités critiques de **{{organisation}}** sont identifiées avec leur durée maximale d'interruption admissible (**RTO**) et leur perte de données maximale admissible (**RPO**).

## 2. Plan de continuité et de reprise
Pour chaque activité critique, le plan décrit : les ressources nécessaires, les solutions de repli, les responsabilités, les étapes de reprise et les contacts de crise.

## 3. Exercices
Le plan est testé **au moins une fois par an**. Les enseignements sont intégrés au plan.
`),
  p("POL-VULN", "Politique de gestion des correctifs et des vulnérabilités", "Délais de correction selon la criticité, scans et exceptions.", `
# Politique de gestion des correctifs et des vulnérabilités

## Délais maximaux de correction
| Criticité (CVSS) | Systèmes exposés à internet | Autres systèmes |
|---|---|---|
| Critique (9 à 10) | 72 heures | 7 jours |
| Élevée (7 à 8,9) | 7 jours | 30 jours |
| Moyenne et faible | 30 jours | 90 jours |

## Pratiques
- Abonnement aux alertes de sécurité (maCERT, éditeurs).
- Scan mensuel des systèmes exposés.
- Systèmes en fin de support remplacés ou isolés.
- Toute exception est documentée, approuvée par le RSSI et limitée dans le temps.
`),
];
