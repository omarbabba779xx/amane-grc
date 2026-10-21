// NIST Cybersecurity Framework (CSF) 2.0 — the 6 functions and 22 categories.
// The CSF is a U.S. government publication; titles are French renderings, descriptions are Amane's wording.
const cat = (ref, section, title, description) => ({ ref, section, title, description });

module.exports = {
  code: "NIST_CSF",
  name: "NIST Cybersecurity Framework 2.0",
  short: "NIST CSF",
  enabled: 0,
  description: "Cadre du NIST organisé en six fonctions (Gouverner, Identifier, Protéger, Détecter, Répondre, Rétablir), très utilisé par les clients et partenaires internationaux.",
  requirements: [
    cat("GV.OC", "Gouverner", "Contexte organisationnel", "Connaître la mission, les parties prenantes, les dépendances et les obligations légales qui orientent la gestion du risque cyber."),
    cat("GV.RM", "Gouverner", "Stratégie de gestion des risques", "Fixer l'appétence au risque, les priorités et la méthode d'appréciation, et les intégrer aux décisions de l'entreprise."),
    cat("GV.RR", "Gouverner", "Rôles, responsabilités et autorités", "Attribuer les responsabilités cyber, rendre la direction redevable et prévoir les ressources et compétences."),
    cat("GV.PO", "Gouverner", "Politique", "Établir, communiquer, appliquer et réviser la politique de cybersécurité."),
    cat("GV.OV", "Gouverner", "Supervision", "Revoir les résultats de la stratégie de gestion des risques et l'ajuster."),
    cat("GV.SC", "Gouverner", "Risques liés à la chaîne d'approvisionnement", "Identifier, évaluer et suivre les risques cyber liés aux fournisseurs et prestataires."),
    cat("ID.AM", "Identifier", "Gestion des actifs", "Inventorier matériels, logiciels, services, données et flux, et les gérer selon leur importance."),
    cat("ID.RA", "Identifier", "Appréciation des risques", "Identifier vulnérabilités, menaces, impacts et vraisemblances, puis prioriser les réponses."),
    cat("ID.IM", "Identifier", "Amélioration", "Tirer les leçons des évaluations, exercices, incidents et audits pour améliorer les pratiques."),
    cat("PR.AA", "Protéger", "Identités, authentification et contrôle d'accès", "Gérer les identités, authentifier les utilisateurs et limiter les accès logiques et physiques au besoin."),
    cat("PR.AT", "Protéger", "Sensibilisation et formation", "Donner au personnel les connaissances nécessaires pour accomplir ses tâches en sécurité."),
    cat("PR.DS", "Protéger", "Sécurité des données", "Protéger la confidentialité, l'intégrité et la disponibilité des données au repos, en transit et en usage."),
    cat("PR.PS", "Protéger", "Sécurité des plateformes", "Gérer la configuration, les mises à jour, les logiciels et les journaux des matériels et systèmes."),
    cat("PR.IR", "Protéger", "Résilience de l'infrastructure", "Protéger les réseaux et environnements et assurer capacité et redondance."),
    cat("DE.CM", "Détecter", "Surveillance continue", "Surveiller réseaux, postes, personnes et prestataires pour repérer les événements anormaux."),
    cat("DE.AE", "Détecter", "Analyse des événements indésirables", "Analyser et corréler les événements pour caractériser les attaques et déclencher la réponse."),
    cat("RS.MA", "Répondre", "Gestion des incidents", "Déclencher, trier, prioriser, escalader et piloter la réponse aux incidents."),
    cat("RS.AN", "Répondre", "Analyse des incidents", "Enquêter pour comprendre la cause, l'étendue et préserver les preuves."),
    cat("RS.CO", "Répondre", "Communication et signalement", "Informer les parties internes et externes et notifier les autorités selon les obligations."),
    cat("RS.MI", "Répondre", "Atténuation des incidents", "Contenir et éradiquer les incidents."),
    cat("RC.RP", "Rétablir", "Exécution du plan de reprise", "Restaurer systèmes et services, vérifier l'intégrité des sauvegardes et confirmer le retour à la normale."),
    cat("RC.CO", "Rétablir", "Communication pendant la reprise", "Coordonner la communication interne et publique pendant le rétablissement."),
  ],
};
