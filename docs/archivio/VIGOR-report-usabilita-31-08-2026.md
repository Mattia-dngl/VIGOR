# VIGOR — Cosa non è ancora del tutto intuitivo

Report richiesto per verificare l'obiettivo "rendere l'app più pulita, moderna e intuitiva" dopo il giro di modifiche del 31/08/2026. Le correzioni di questo giro (promemoria, cronometro, navigazione Allenamento libero, barra di progresso, accordion PT, riordino Home, form Nuova scheda, scanner barcode, Dieta, Impostazioni, Esercizi personalizzati) hanno risolto i problemi segnalati esplicitamente. Quello che segue sono invece punti che restano, o che sono emersi rivedendo l'app schermata per schermata: non bloccano l'uso, ma qualcuno che apre l'app per la prima volta può fermarsi a capire cosa fare.

## Account come cassetto unico

Il pannello Account mette nello stesso elenco a tendine cose molto diverse tra loro: i dati del profilo (nome, password), le impostazioni dell'app (timer, promemoria, esercizi personali), un contenuto di consultazione (il Glossario) e le funzioni sociali (Messaggi, Area Personal Trainer). Sono tutte tendine identiche, una dietro l'altra, senza un titolo di sezione che separi "il tuo account" da "impostazioni" da "risorse". Chi cerca il Glossario deve scorrere oltre Impostazioni senza sapere se è nella lista giusta finché non legge ogni riga. Una piccola etichetta di raggruppamento (anche solo un titoletto discreto sopra ciascun blocco) risolverebbe la maggior parte della confusione, senza dover reinventare la struttura.

## Il codice di recupero resta in fondo a due tendine

Il codice di recupero del profilo — l'unico modo per rientrare se si dimentica la password — è raggiungibile solo aprendo Account → Impostazioni → Sicurezza dei dati. In questo giro è stato tolto un livello di tendina annidata, ma restano comunque due passaggi prima di vederlo, e niente nell'app invita a generarlo e salvarlo subito dopo la creazione del profilo. Chi non lo scopre da solo rischia di restarne fuori per sempre in caso di password persa.

## Le tendine restano il modo principale di nascondere le cose

Il pattern a tendina (`<details>`) è stato tolto solo dove l'utente lo ha segnalato esplicitamente (i permessi del Personal Trainer in Scheda). Resta però ovunque nell'app: ogni sezione di Account, i tre sotto-blocchi di "Esercizi" in Impostazioni, "Progressi per esercizio" e "Schede archiviate" in Storico, il piano alimentare assegnato dal PT in Dieta. Non è un errore — molte di queste sezioni contengono contenuto secondario che ha senso tenere chiuso — ma è comunque il pattern visivo dominante dell'app, e chi non ama le tendine in generale continuerà a incontrarle spesso. Vale la pena chiedersi, sezione per sezione, quali contengono davvero informazioni che si vogliono nascondere e quali invece si aprono quasi sempre (in quel caso tanto vale mostrarle già aperte, come già fatto per i permessi PT).

## Registro allenamento appare due volte con lo stesso nome

L'intestazione "Registro allenamento" (con la striscia dei giorni della settimana e il riepilogo rapido) compare identica sia in cima a Scheda sia in cima a Registra. Le due schermate condividono questa intestazione per motivi di codice, ma per chi le guarda sembra di essere rimasti sulla stessa pagina anche dopo aver toccato una voce diversa della barra in basso. Un titolo diverso per le due schermate (es. "La tua Scheda" contro "Registra allenamento") renderebbe più chiaro dove ci si trova.

## Segui scheda contro Allenamento libero non è spiegato al primo utilizzo

Il tasto + in basso apre un menu con due opzioni, ma nulla nell'interfaccia spiega la differenza finché non se ne prova una: "Segui scheda" registra quello che il piano prevede per oggi, "Allenamento libero" lascia scegliere gli esercizi al momento. Un utente nuovo può non capire subito quale scegliere, soprattutto se ha già una scheda attiva ma quel giorno preferisce allenarsi diversamente.

## La barra di avanzamento della scheda non è garantita

La barra "Settimana X di Y" ora appare con la sola durata in settimane impostata (corretto in questo giro), ma se la scheda non ha una durata l'utente non vede nessun indizio che compilando quel campo otterrebbe la barra. Chi non nota il collegamento tra "Durata (settimane)" nel form e la barra nella scheda può pensare che la funzione semplicemente non esista.

## Lo scanner del codice a barre non funziona su iPhone, e non è ovvio perché

Ora lo scanner mostra un messaggio onesto quando non è disponibile (prima non succedeva nulla), ma il messaggio non spiega che il motivo è tecnico e legato al sistema operativo (Safari su iPhone non supporta la fotocamera per i codici a barre, mentre Chrome su Android sì). Senza questo dettaglio, chi lo prova su iPhone può pensare che sia un difetto dell'app piuttosto che un limite della piattaforma.

## In Dieta non è ovvio quale pasto si sta compilando

Sopra il diario si sceglie il pasto (Colazione, Pranzo, Spuntino, Cena) toccando una delle quattro pillole, poi si scrive l'alimento. Le card dei pasti più sotto restano però visivamente separate da quella scelta: non c'è un collegamento visivo diretto (per esempio evidenziare la card del pasto selezionato) tra la pillola toccata sopra e la card che si popolerà sotto dopo aver premuto "+ Aggiungi". Chi scorre in fretta può non capire subito dove è finito quello che ha appena registrato.

## Le sezioni riservate a chi ha i permessi spariscono senza spiegazione visibile

In Impostazioni, "Aggiungi esercizio" e "Esercizi di base" sono visibili solo a chi può modificare il database esercizi condiviso; a chi non ha questo permesso appare un unico avviso ("Il tuo personal trainer non ti ha dato il permesso...") al posto di quelle sezioni. Funziona, ma per un cliente che segue le istruzioni di qualcun altro e non trova più "Aggiungi esercizio" dove se lo aspettava, il messaggio è facile da non notare se non scorre fino in fondo.

## In sintesi

I punti con l'impatto più alto sul "sembra intuitivo" sono probabilmente due: la mancanza di titoli che separino i blocchi dentro Account, e la profondità con cui è nascosto il codice di recupero — sono entrambi correggibili con interventi piccoli e mirati, senza toccare la struttura generale dell'app. Gli altri punti sono rifiniture che contano soprattutto per chi apre l'app per la primissima volta.
