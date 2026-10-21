// Directive Nationale de la Sécurité des Systèmes d'Information (DNSSI, DGSSI) et loi n° 05-20
// relative à la cybersécurité (Maroc). Exigences reformulées par thème pour le pilotage :
// l'applicabilité exacte dépend du statut de l'organisme (administration, IIV, opérateur, prestataire).
module.exports = {
  code: "DNSSI",
  name: "DNSSI & loi 05-20 · Cybersécurité (Maroc)",
  short: "DNSSI / 05-20",
  description: "Règles de la Direction Générale de la Sécurité des Systèmes d'Information (DGSSI) et obligations de la loi 05-20 sur la cybersécurité.",
  requirements: [
    { ref: "ORG-1", section: "Organisation", title: "Désigner un responsable de la sécurité des SI", description: "Nommer un RSSI, lui donner une autorité et des moyens, et formaliser ses missions." },
    { ref: "ORG-2", section: "Organisation", title: "Politique de sécurité des SI", description: "Adopter une PSSI approuvée par la direction, diffusée et révisée régulièrement." },
    { ref: "ORG-3", section: "Organisation", title: "Comité et pilotage de la sécurité", description: "Piloter la sécurité par une instance de gouvernance avec des revues périodiques." },
    { ref: "ACT-1", section: "Gestion des actifs", title: "Inventaire et classification des actifs", description: "Recenser les actifs informationnels, leur propriétaire et leur niveau de sensibilité." },
    { ref: "RH-1", section: "Ressources humaines", title: "Sensibilisation et charte d'utilisation", description: "Sensibiliser régulièrement le personnel et faire signer une charte d'utilisation des moyens informatiques." },
    { ref: "RH-2", section: "Ressources humaines", title: "Arrivées, mutations et départs", description: "Gérer les droits et la restitution des moyens à chaque étape du parcours d'un collaborateur." },
    { ref: "PHY-1", section: "Sécurité physique", title: "Protection physique des locaux techniques", description: "Contrôler l'accès aux salles serveurs et protéger les équipements contre les risques environnementaux." },
    { ref: "EXP-1", section: "Exploitation", title: "Protection contre les codes malveillants", description: "Déployer et maintenir à jour une protection anti-malware sur l'ensemble du parc." },
    { ref: "EXP-2", section: "Exploitation", title: "Sauvegarde et restauration", description: "Sauvegarder régulièrement les données critiques, isoler les copies et tester la restauration." },
    { ref: "EXP-3", section: "Exploitation", title: "Journalisation et supervision", description: "Journaliser les événements de sécurité, conserver les journaux et les analyser." },
    { ref: "EXP-4", section: "Exploitation", title: "Gestion des correctifs et vulnérabilités", description: "Appliquer les mises à jour de sécurité dans des délais définis et suivre les vulnérabilités." },
    { ref: "EXP-5", section: "Exploitation", title: "Sécurité des réseaux", description: "Cloisonner les réseaux, filtrer les flux et sécuriser les accès distants." },
    { ref: "ACC-1", section: "Contrôle d'accès", title: "Gestion des identités et des droits", description: "Attribuer des comptes nominatifs, appliquer le moindre privilège et revoir les droits périodiquement." },
    { ref: "ACC-2", section: "Contrôle d'accès", title: "Authentification forte", description: "Imposer des mots de passe robustes et l'authentification multifacteur pour les accès sensibles et distants." },
    { ref: "DEV-1", section: "Acquisition et développement", title: "Sécurité dans les projets et développements", description: "Intégrer la sécurité dès la conception, tester avant la mise en production et encadrer les prestataires." },
    { ref: "INC-1", section: "Incidents", title: "Gestion des incidents de sécurité", description: "Disposer d'une procédure de détection, de traitement et de retour d'expérience des incidents." },
    { ref: "INC-2", section: "Incidents", title: "Déclaration des incidents à la DGSSI (loi 05-20)", description: "Déclarer sans délai à la DGSSI (maCERT) les incidents affectant la sécurité ou le fonctionnement des systèmes, selon le statut de l'organisme." },
    { ref: "CON-1", section: "Continuité", title: "Continuité et reprise d'activité", description: "Définir et tester un plan de continuité et de reprise des activités critiques." },
    { ref: "AUD-1", section: "Conformité et audit", title: "Audits de sécurité périodiques (loi 05-20)", description: "Faire réaliser des audits de sécurité réguliers, notamment pour les infrastructures d'importance vitale, par des prestataires qualifiés." },
    { ref: "AUD-2", section: "Conformité et audit", title: "Hébergement des données sensibles", description: "Héberger les données sensibles sur le territoire national lorsque la réglementation l'exige (IIV, administrations)." },
    { ref: "PRE-1", section: "Prestataires", title: "Recours à des prestataires de confiance", description: "Encadrer contractuellement les prestataires et privilégier les prestataires qualifiés par la DGSSI pour les missions sensibles." },
  ],
};
