/**
 * I18n
 *
 * UI strings. French only for now, the keys keep the door open for English
 * and Arabic.
 *
 * @package    albe-currency
 * @author     kekefreedog <kevin.zarshenas@gmail.com>
 * @copyright  2026 Kévin Zarshenas
 */

const FR = {
    appName: "AlbeCurrency",
    history: "Historique",
    emptyHistory: "Aucune transaction. Touchez + pour vérifier un paiement.",
    newTx: "Nouvelle transaction",
    settings: "Réglages",
    rateBdl: "BDL",
    rateReceipt: "Ticket",
    rateManual: "Manuel",
    rateUpdated: "mis à jour {date}",
    rateNever: "taux par défaut",
    rateRefreshed: "Taux BDL mis à jour : {rate}",
    rateOffline: "Hors ligne, dernier taux conservé",
    modePaid: "Je donne",
    modeReturned: "On me rend",
    scan: "Scanner le ticket",
    scanning: "Lecture du ticket…",
    scanFailed: "Ticket illisible, saisissez le total",
    scanFound: "Total trouvé : {total}",
    label: "Libellé (ex. Spinneys, taxi…)",
    type: "Type",
    newType: "Nouveau type",
    newTypeShort: "Type",
    editType: "Modifier le type",
    typeName: "Nom du type",
    typeEmoji: "Emoji",
    typeColor: "Couleur",
    types: "Types de transaction",
    addType: "Ajouter un type",
    cancel: "Annuler",
    total: "Total du ticket",
    totalUsd: "Total $",
    totalLbp: "Total LL",
    rate: "Taux (LL pour $1)",
    useBdl: "Taux BDL",
    equals: "soit {amount}",
    toPay: "À payer",
    given: "Donné",
    remaining: "Il reste à donner",
    expectedChange: "Monnaie attendue",
    returned: "Rendu",
    suggestion: "Rendu idéal",
    keyboardHint: "Touchez un billet pour l'ajouter, − (ou appui long) pour l'enlever",
    clear: "Effacer",
    back: "Retour",
    save: "Enregistrer",
    saved: "Transaction enregistrée",
    delete: "Supprimer",
    deleted: "Transaction supprimée",
    statusOk: "Le compte est bon",
    statusMissing: "Il manque {usd} ({lbp})",
    statusSurplus: "Rendu en trop : {usd} ({lbp})",
    statusUnderpaid: "Paiement insuffisant : il manque {usd} ({lbp})",
    tolerance: "Tolérance (LL)",
    toleranceHelp: "Écart accepté, les petites coupures ne circulent plus",
    preferChange: "Rendu idéal de préférence en",
    banknotesUsd: "Billets $ affichés",
    banknotesLbp: "Billets LL affichés",
    defaultRate: "Taux par défaut (LL pour $1)",
    refreshRate: "Actualiser le taux BDL",
    settingsSaved: "Réglages enregistrés",
    totalRequired: "Indiquez le total du ticket ou scannez-le",
    rateRequired: "Indiquez un taux valide",
};

export type I18nKey = keyof typeof FR;

/**
 * Translate
 *
 * @param key String key
 * @param vars Values for the {placeholders}
 * @return Translated string
 */
export const t = (key:I18nKey, vars:Record<string, string> = {}):string =>
    FR[key].replace(/\{(\w+)\}/g, (_, name:string) => vars[name] ?? "");
