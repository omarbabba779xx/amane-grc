// ISO/IEC 27001:2022 — clauses 4 to 10 and the 93 Annex A controls.
// Titles are short French renderings; descriptions are Amane's own wording, not the standard's text.
const clauses = [
  ["4.1", "Contexte", "Compréhension de l'organisme et de son contexte", "Identifier les enjeux internes et externes qui influencent la sécurité de l'information."],
  ["4.2", "Contexte", "Besoins et attentes des parties intéressées", "Recenser les parties intéressées (clients, autorités, partenaires) et leurs exigences de sécurité."],
  ["4.3", "Contexte", "Domaine d'application du SMSI", "Définir et documenter le périmètre du système de management (sites, activités, systèmes)."],
  ["4.4", "Contexte", "Système de management de la sécurité de l'information", "Établir, mettre en œuvre, tenir à jour et améliorer le SMSI."],
  ["5.1", "Leadership", "Leadership et engagement", "La direction s'implique visiblement et fournit les moyens nécessaires au SMSI."],
  ["5.2", "Leadership", "Politique", "Une politique de sécurité approuvée par la direction fixe le cadre et les engagements."],
  ["5.3", "Leadership", "Rôles, responsabilités et autorités", "Les responsabilités liées à la sécurité sont attribuées et communiquées."],
  ["6.1", "Planification", "Actions face aux risques et opportunités", "Apprécier puis traiter les risques de sécurité selon une méthode définie et reproductible."],
  ["6.2", "Planification", "Objectifs de sécurité de l'information", "Fixer des objectifs mesurables, suivis et communiqués."],
  ["6.3", "Planification", "Planification des modifications", "Les changements apportés au SMSI sont planifiés et maîtrisés."],
  ["7.1", "Support", "Ressources", "Allouer les ressources humaines, techniques et financières nécessaires."],
  ["7.2", "Support", "Compétences", "S'assurer que les personnes ont les compétences requises et le prouver."],
  ["7.3", "Support", "Sensibilisation", "Chacun connaît la politique, sa contribution et les conséquences des écarts."],
  ["7.4", "Support", "Communication", "Définir quoi communiquer, quand, à qui et comment."],
  ["7.5", "Support", "Informations documentées", "Créer, mettre à jour et maîtriser la documentation du SMSI."],
  ["8.1", "Fonctionnement", "Planification et maîtrise opérationnelles", "Planifier, mettre en œuvre et contrôler les processus nécessaires à la sécurité."],
  ["8.2", "Fonctionnement", "Appréciation des risques", "Réaliser l'appréciation des risques à intervalles planifiés et lors de changements importants."],
  ["8.3", "Fonctionnement", "Traitement des risques", "Mettre en œuvre le plan de traitement des risques et en conserver la trace."],
  ["9.1", "Évaluation", "Surveillance, mesure, analyse et évaluation", "Mesurer l'efficacité du SMSI à l'aide d'indicateurs."],
  ["9.2", "Évaluation", "Audit interne", "Conduire des audits internes planifiés et indépendants."],
  ["9.3", "Évaluation", "Revue de direction", "La direction revoit le SMSI à intervalles planifiés et décide des améliorations."],
  ["10.1", "Amélioration", "Amélioration continue", "Améliorer en continu la pertinence et l'efficacité du SMSI."],
  ["10.2", "Amélioration", "Non-conformité et action corrective", "Traiter les non-conformités, en analyser les causes et vérifier l'efficacité des actions."],
];

const annexA = [
  // 5 — Mesures organisationnelles
  ["5.1", "Politiques de sécurité de l'information"], ["5.2", "Fonctions et responsabilités liées à la sécurité"], ["5.3", "Séparation des tâches"],
  ["5.4", "Responsabilités de la direction"], ["5.5", "Contacts avec les autorités"], ["5.6", "Contacts avec des groupes d'intérêt spécifiques"],
  ["5.7", "Renseignement sur les menaces"], ["5.8", "Sécurité de l'information dans la gestion de projet"], ["5.9", "Inventaire des informations et autres actifs associés"],
  ["5.10", "Utilisation correcte des informations et des actifs"], ["5.11", "Restitution des actifs"], ["5.12", "Classification des informations"],
  ["5.13", "Marquage des informations"], ["5.14", "Transfert des informations"], ["5.15", "Contrôle d'accès"], ["5.16", "Gestion des identités"],
  ["5.17", "Informations d'authentification"], ["5.18", "Droits d'accès"], ["5.19", "Sécurité dans les relations avec les fournisseurs"],
  ["5.20", "Sécurité dans les accords avec les fournisseurs"], ["5.21", "Sécurité dans la chaîne d'approvisionnement TIC"],
  ["5.22", "Surveillance et gestion des changements des services fournisseurs"], ["5.23", "Sécurité de l'utilisation des services en nuage"],
  ["5.24", "Planification et préparation de la gestion des incidents"], ["5.25", "Évaluation des événements et prise de décision"],
  ["5.26", "Réponse aux incidents de sécurité"], ["5.27", "Tirer des enseignements des incidents"], ["5.28", "Collecte des preuves"],
  ["5.29", "Sécurité de l'information durant une perturbation"], ["5.30", "Préparation des TIC pour la continuité d'activité"],
  ["5.31", "Exigences légales, réglementaires et contractuelles"], ["5.32", "Droits de propriété intellectuelle"], ["5.33", "Protection des enregistrements"],
  ["5.34", "Vie privée et protection des données personnelles"], ["5.35", "Revue indépendante de la sécurité de l'information"],
  ["5.36", "Conformité aux politiques, règles et normes"], ["5.37", "Procédures d'exploitation documentées"],
  // 6 — Mesures liées aux personnes
  ["6.1", "Sélection des candidats"], ["6.2", "Termes et conditions du contrat de travail"], ["6.3", "Sensibilisation, enseignement et formation"],
  ["6.4", "Processus disciplinaire"], ["6.5", "Responsabilités après la fin ou le changement d'un emploi"], ["6.6", "Accords de confidentialité"],
  ["6.7", "Travail à distance"], ["6.8", "Déclaration des événements de sécurité"],
  // 7 — Mesures physiques
  ["7.1", "Périmètres de sécurité physique"], ["7.2", "Contrôle des accès physiques"], ["7.3", "Sécurisation des bureaux, salles et installations"],
  ["7.4", "Surveillance de la sécurité physique"], ["7.5", "Protection contre les menaces physiques et environnementales"], ["7.6", "Travail dans les zones sécurisées"],
  ["7.7", "Bureau propre et écran verrouillé"], ["7.8", "Emplacement et protection du matériel"], ["7.9", "Sécurité des actifs hors des locaux"],
  ["7.10", "Supports de stockage"], ["7.11", "Services généraux (énergie, climatisation)"], ["7.12", "Sécurité du câblage"], ["7.13", "Maintenance du matériel"],
  ["7.14", "Mise au rebut ou recyclage sécurisé du matériel"],
  // 8 — Mesures technologiques
  ["8.1", "Terminaux des utilisateurs"], ["8.2", "Droits d'accès privilégiés"], ["8.3", "Restriction de l'accès aux informations"], ["8.4", "Accès au code source"],
  ["8.5", "Authentification sécurisée"], ["8.6", "Dimensionnement"], ["8.7", "Protection contre les logiciels malveillants"], ["8.8", "Gestion des vulnérabilités techniques"],
  ["8.9", "Gestion des configurations"], ["8.10", "Suppression des informations"], ["8.11", "Masquage des données"], ["8.12", "Prévention de la fuite de données"],
  ["8.13", "Sauvegarde des informations"], ["8.14", "Redondance des moyens de traitement"], ["8.15", "Journalisation"], ["8.16", "Activités de surveillance"],
  ["8.17", "Synchronisation des horloges"], ["8.18", "Utilisation de programmes utilitaires à privilèges"], ["8.19", "Installation de logiciels sur les systèmes en exploitation"],
  ["8.20", "Sécurité des réseaux"], ["8.21", "Sécurité des services réseau"], ["8.22", "Cloisonnement des réseaux"], ["8.23", "Filtrage web"],
  ["8.24", "Utilisation de la cryptographie"], ["8.25", "Cycle de développement sécurisé"], ["8.26", "Exigences de sécurité des applications"],
  ["8.27", "Architecture et ingénierie des systèmes sécurisés"], ["8.28", "Codage sécurisé"], ["8.29", "Tests de sécurité en développement et recette"],
  ["8.30", "Développement externalisé"], ["8.31", "Séparation des environnements de développement, test et production"], ["8.32", "Gestion des changements"],
  ["8.33", "Informations de test"], ["8.34", "Protection des systèmes pendant les audits"],
];

const THEMES = { 5: "Mesures organisationnelles", 6: "Mesures liées aux personnes", 7: "Mesures physiques", 8: "Mesures technologiques" };

module.exports = {
  code: "ISO27001",
  name: "ISO/IEC 27001:2022",
  short: "ISO 27001",
  description: "Norme internationale du système de management de la sécurité de l'information (SMSI) : clauses 4 à 10 et 93 mesures de l'Annexe A.",
  requirements: [
    ...clauses.map(([ref, section, title, description]) => ({ ref: `C${ref}`, section: `Clause ${ref.split(".")[0]} · ${section}`, title, description })),
    ...annexA.map(([ref, title]) => ({ ref: `A.${ref}`, section: `Annexe A · ${THEMES[ref.split(".")[0]]}`, title, description: "" })),
  ],
};
