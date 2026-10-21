// Loi n° 09-08 relative à la protection des personnes physiques à l'égard du traitement
// des données à caractère personnel (Maroc, 2009) — obligations reformulées pour le pilotage.
// Les références d'articles sont indicatives : à valider avec votre conseil juridique ou la CNDP.
module.exports = {
  code: "LOI0908",
  name: "Loi 09-08 · Protection des données personnelles",
  short: "Loi 09-08",
  description: "Obligations des responsables de traitement au Maroc, sous le contrôle de la CNDP (Commission nationale de contrôle de la protection des données à caractère personnel).",
  requirements: [
    { ref: "Q-1", section: "Principes", title: "Qualité des données (art. 3)", description: "Données collectées de façon loyale et licite, pour des finalités déterminées, adéquates, exactes et conservées pour une durée limitée." },
    { ref: "Q-2", section: "Principes", title: "Licéité et consentement (art. 4)", description: "Chaque traitement repose sur le consentement indubitable de la personne ou sur l'une des exceptions prévues par la loi." },
    { ref: "Q-3", section: "Principes", title: "Durées de conservation", description: "Définir et appliquer une durée de conservation par finalité, puis supprimer ou anonymiser." },
    { ref: "D-1", section: "Droits des personnes", title: "Information des personnes (art. 5)", description: "Informer la personne de l'identité du responsable, des finalités, des destinataires et de ses droits lors de la collecte." },
    { ref: "D-2", section: "Droits des personnes", title: "Droit d'accès (art. 7)", description: "Permettre à toute personne d'obtenir la communication des données la concernant." },
    { ref: "D-3", section: "Droits des personnes", title: "Droit de rectification (art. 8)", description: "Corriger, compléter ou effacer les données inexactes ou incomplètes." },
    { ref: "D-4", section: "Droits des personnes", title: "Droit d'opposition (art. 9)", description: "Permettre l'opposition au traitement pour des motifs légitimes, et sans frais à la prospection." },
    { ref: "D-5", section: "Droits des personnes", title: "Prospection directe", description: "Recueillir le consentement préalable avant toute prospection par voie électronique ou automatisée." },
    { ref: "F-1", section: "Formalités CNDP", title: "Déclaration ou autorisation préalable (art. 12)", description: "Déclarer chaque traitement à la CNDP, ou obtenir son autorisation préalable pour les traitements soumis à autorisation (données sensibles, interconnexions…)." },
    { ref: "F-2", section: "Formalités CNDP", title: "Registre des traitements", description: "Tenir à jour l'inventaire des traitements, leurs finalités, catégories de données, destinataires et durées." },
    { ref: "S-1", section: "Sécurité", title: "Sécurité et confidentialité des traitements (art. 23)", description: "Mettre en œuvre des mesures techniques et organisationnelles appropriées contre la destruction, la perte, l'altération, la diffusion ou l'accès non autorisés." },
    { ref: "S-2", section: "Sécurité", title: "Recours à un sous-traitant (art. 24)", description: "Choisir des sous-traitants offrant des garanties suffisantes et encadrer la relation par contrat." },
    { ref: "S-3", section: "Sécurité", title: "Confidentialité des personnes autorisées", description: "Les personnes accédant aux données agissent sur instruction et sont tenues au secret professionnel." },
    { ref: "T-1", section: "Transferts", title: "Transferts vers l'étranger (art. 43 et 44)", description: "Ne transférer des données vers un pays étranger que s'il assure un niveau de protection suffisant, ou avec l'autorisation de la CNDP." },
    { ref: "G-1", section: "Gouvernance", title: "Responsable de la protection des données", description: "Désigner une personne chargée de piloter la conformité 09-08 et l'interface avec la CNDP." },
    { ref: "G-2", section: "Gouvernance", title: "Gestion des violations de données", description: "Détecter, documenter et traiter les violations de données personnelles, et informer les personnes et l'autorité si nécessaire." },
  ],
};
