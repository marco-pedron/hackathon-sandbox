# Brief: Agentic Dollars on Bitcoin Hackathon — idea di progetto e regole

> Documento di contesto da dare a un assistente AI. Contiene: l'idea su cui il team sta lavorando, le regole verificate dell'hackathon, lo stack tecnico obbligatorio e i punti aperti.
> Aggiornato al 15 ottobre 2026 (hackathon: 17-18 ottobre 2026). Regole verificate sulla pagina ufficiale: https://rgbprotocol.org/agentic-dollars-hackathon/
> **Pivot del 15 ottobre:** l'idea non è più "dividere i debiti e saldarli tra viaggiatori", ma una **cassa comune digitale e trasparente** che sostituisce la busta di contanti del coordinatore. Le specifiche tecniche sono in `docs/PROMPT-hackathon.md`, il calendario in `docs/ROADMAP.md`.

---

## 1. L'idea chiave

**Cassa comune digitale e trasparente per viaggi di gruppo organizzati, che sostituisce la busta di contanti: prefinanziata in dollari digitali su Bitcoin (asset NIA su RGB, USDT nel prodotto reale), custodita dal coordinatore, con AI locale che legge gli scontrini e rimborso immediato di chi anticipa.**

### Il contesto d'uso
Viaggi di gruppo organizzati tra persone che non si conoscono (format tipo WeRoad, citato solo come esempio di mercato): 10-15 persone, spesso di nazionalità diverse, 1-3 settimane, decine di spese condivise (cene, taxi, benzina, alloggi, attività) pagate in valuta locale. C'è un **coordinatore** del viaggio, che oggi spesso gestisce una cassa comune in contanti.

### Chi sono gli utenti (B2B2C)
- **Cliente pagante:** il tour operator.
- **Utente operativo:** il coordinatore (nella demo: Dave), custode della cassa.
- **Utenti finali:** i viaggiatori (nella demo: Alice IT, Bob DE, Charlie US, in Vietnam).

### Il problema
- **Busta di contanti:** opaca, in contanti e in valuta locale, un solo custode, il residuo restituito a mano a fine viaggio.
- **Oppure qualcuno anticipa** e "poi ci sentiamo": le app esistenti (Splitwise, Tricount) calcolano chi deve cosa ma non regolano nulla. I più disponibili finiscono in credito verso sconosciuti che spariscono.

### La soluzione
1. A inizio viaggio ogni partecipante versa una quota D nella **cassa comune** (nodo RGB del coordinatore).
2. Chi paga una spesa comune fotografa lo scontrino. L'**AI on-device (QVAC)** fa OCR ed estrazione strutturata, poi trasforma una frase ("Bob e io la pho, Charlie solo birre, acqua in tre") nell'assegnazione delle righe.
3. **Ogni debitore approva solo le proprie righe**: può contestarle, e dopo un timeout vale il silenzio-assenso. Il coordinatore approva il rimborso: è il momento "l'AI propone, l'umano approva".
4. Chi ha pagato viene **rimborsato dalla cassa**, con le quote degli altri, tramite un trasferimento RGB reale. Ogni partecipante ha una quota visibile: deposito + crediti − debiti − rimborsi ricevuti.
5. A fine viaggio, **un solo pagamento batch** restituisce a ciascuno il residuo. Chi è irraggiungibile trova il suo residuo "non riscosso" nella cassa.
6. **Privacy:** la foto dello scontrino resta sul telefono di chi ha pagato; al gruppo arrivano solo le righe strutturate necessarie. Nessun cloud, nessun server terzo.

### Il valore, detto onestamente
- Il valore è la **certezza di essere rimborsati**, non contante spendibile durante il viaggio: un ristorante in Vietnam non accetta USDT su RGB.
- Il vero concorrente è la **busta di contanti**, non Splitwise.
- L'argomento "perché RGB" regge con **gruppi multinazionali senza un sistema di pagamento comune**: dollaro digitale uguale per tutti, nessun IBAN, nessun gas token separato, un'unica transazione witness per pagare tutto il gruppo a fine viaggio. Con un gruppo tutto italiano, Satispay o Revolut bastano.

### Decisioni prese (15 ottobre)
| Tema | Decisione |
|---|---|
| Custodia della cassa | Coordinatore (nodo RGB `dave`). È custodiale: lo diciamo. Esposizione limitata da D piccolo, ricariche e rimborsi durante il viaggio. Multisig 2-di-3 solo in roadmap (scartata la multisig tra membri: con N-di-N chiunque blocca la cassa, con M-di-N tra sconosciuti la maggioranza può derubare la minoranza; tooling non verificato). |
| Chi scansiona | Chi ha pagato. |
| Chi approva | Ogni debitore le proprie righe (contestazione o silenzio-assenso); il coordinatore approva i pagamenti dalla cassa e può solo annullare una spesa contestata. |
| Quota esaurita | Avviso al 20% residuo. Quota negativa → `TOPUP_REQUIRED`, prelievi bloccati. La parte scoperta non viene rimborsata subito: resta un credito di chi ha pagato. |
| Liquidità della cassa | Un rimborso non può mai usare soldi che appartengono alle quote positive degli altri: regola deterministica nel ledger. |
| Registro | Off-chain, append-only, condiviso (SQLite nella demo). Catena di hash come extra; P2P e firme in roadmap. |
| Tassi di cambio | "Tasso del giorno" del coordinatore (tabella con data e fonte), bloccato al momento dell'approvazione. |
| Uscita e fuga | Il deposito fa da garanzia: chi sparisce ha già pagato la sua parte con la propria quota. Uscita anticipata come extra. |
| Consumer o B2B | B2B2C: venduto al tour operator, usato dal coordinatore e dai viaggiatori. |
| UI | Una sola web app con viste per ruolo (`?as=alice|bob|charlie|dave`); tre finestre a larghezza telefono affiancate sul palco. |

### Rischi aperti
- **On-ramp:** oggi i viaggiatori non hanno USDT su RGB. Risposta nel pitch: acquisto alla prenotazione tramite l'operatore o un partner di emissione. Nella demo i fondi sono pre-caricati.
- **Regolamentazione UE:** un operatore che custodisce stablecoin per i clienti è un'attività regolata, e USDT non è autorizzato sotto MiCA. Va preparata la risposta; non va messo nelle slide.
- **Telefono perso = stash perso** senza backup: backup cifrato in roadmap.
- **Coordinatore disonesto:** stesso rischio della busta di contanti, ma esposizione limitata e tracciata.
- **OCR:** gli scontrini di prova vanno testati prima. Il vietnamita è in alfabeto latino ma con molti diacritici.

### Scope della demo (~27 ore di build)
Tre viaggiatori più il coordinatore, depositi reali da 50.00, uno scontrino in VND. Flusso: foto → proposta AI → frase per la divisione → approvazione di Bob → silenzio-assenso di Charlie → Dave approva il rimborso → transfer RGB reale → quote aggiornate e "cassa = saldo del nodo" → chiusura con batch ad Alice e Bob, e il residuo di Charlie (offline) che resta non riscosso. Nient'altro.

---

## 2. L'hackathon in breve

| Voce | Dettaglio |
|---|---|
| Nome | Agentic Dollars on Bitcoin — Powered by local AI |
| Organizzatore | RGB Protocol Association (non-profit svizzera) |
| Sponsor | Tether (main sponsor; team WDK e QVAC presenti come mentor), Utexo (co-sponsor, in giuria) |
| Partner | BLOX (venue), BitPolito, Atlas21 (media) |
| Luogo e data | BLOX, Torino — 17-18 ottobre 2026 |
| Partecipanti | ~70 builder, team da 2 a 4 persone |
| Costo | Gratuito; pranzo sabato, coffee break e colazione domenica inclusi |
| Premi | 1° €4.000 + posto garantito alle finali **CypherTank** (Lugano, Plan B: 3 premi da $100.000 in servizi di incubazione/accelerazione); 2° €1.500; 3° €500 |
| Giuria | Membri dei team di Tether, KaleidoSwap e Utexo |

### Orari
- **Sabato 17**: 08:30 apertura e kickoff · 09:30 inizio build
- **Domenica 18**: **13:00 fine build e submit** · 16:00 pitch · 18:00 premiazione · 19:00 fine

→ Tempo di build effettivo: ~27,5 ore incluso il sonno.

### Le quattro tracce (nessun brief fisso)
1. **Payments and checkout** — invoicing, payroll, flussi cross-border
2. **Self-custodial digital dollar apps** — wallet, risparmio, conti condivisi
3. **Private financial intelligence** — budgeting e alert antifrode on-device
4. **Autonomous economic agents** — AI locale che propone, l'utente approva

L'idea del team tocca la traccia 2 (conti condivisi), la 1 (cross-border) e il pattern della 4.

### Criteri di giudizio — 5 criteri, peso uguale, voto 1-10 ciascuno
1. **RGB usage** — integrazione reale e corretta con RGB Protocol su Bitcoin. *Transazioni funzionanti, non simulate.*
2. **QVAC e AI locale** — quanto il modello gira davvero on-device e quanto è centrale. Conta l'uso, non la dimensione del modello.
3. **Execution** — il progetto funziona end-to-end? Quanto lavoro sostanziale è stato fatto durante l'hackathon?
4. **Marketability** — problema reale, utente identificabile, motivo di esistere dopo domenica.
5. **UX/UI** — si giudica il *flusso*, non l'estetica: chiarezza dei passaggi, gestione degli errori, intuitività per un estraneo.

**Bonus WDK**: opzionale. Un'integrazione funzionante dà punti extra sopra il totale; un'integrazione ben fatta e centrale dà il bonus pieno.

### Regole obbligatorie
- **RGB e QVAC sono obbligatori** in ogni progetto. WDK è opzionale (bonus).
- **Progetti già iniziati**: ammessi, ma si giudica solo il lavoro fatto durante l'hackathon. Bisogna dichiarare all'arrivo cosa esiste già, tenere il lavoro del weekend in **commit datati**, e fare **l'integrazione RGB e QVAC sul posto**.
- Hardware: basta una macchina capace per team; i modelli consigliati sono piccoli e quantizzati.

---

## 3. Stack tecnico

### RGB — ATTENZIONE alla versione
Usare **solo RGB Protocol on Bitcoin v0.11.1** (in produzione su mainnet da luglio 2025).
- Fonti corrette: `rgb.info`, `docs.rgb.info` (ogni pagina disponibile in Markdown aggiungendo `.md`; indice in `docs.rgb.info/llms.txt`), `github.com/rgb-protocol`, `github.com/RGB-Tools`.
- **Da NON usare**: RGB v0.12 / `rgb.tech` / `github.com/RGB-WG` (riscrittura non finita, incompatibile), RGB++ (Nervos/CKB, altro protocollo).
- Terminologia corretta: schema **NIA** (Non-Inflatable Asset, fungibile a supply fissa — quello da usare), IFA, CFA, UDA, PFA. Non esistono "RGB20/RGB21/RGB25". Si dice "private contracts", non "smart contracts".

Concetti chiave: single-use seal (lo stato è legato a un UTXO Bitcoin), client-side validation (i dati stanno sui client, on-chain solo un commitment tapret/opret), consignment, stash, invoice con blinded UTXO, witness transaction. Nel trasferimento è il **ricevente** a generare l'invoice per primo; un **RGB proxy server** fa da buca delle lettere per i consignment. Conseguenza per la cassa: per pagare un viaggiatore serve un'invoice del suo nodo, quindi chi è offline non può ricevere e il suo residuo resta "non riscosso".

Tool principale: **`rgb-lightning-node`** (RLN, `github.com/RGB-Tools/rgb-lightning-node`) — daemon Rust con REST API e Swagger UI, pilotabile da qualsiasi linguaggio. Stack regtest in Docker: bitcoind + electrs + esplora + RGB proxy, più **4 nodi RLN** (alice, bob, charlie, dave = cassa). È early alpha. Rete per la demo: **regtest** (transazioni vere su rete locale).

Riferimento di codice: `iris-wallet-desktop` (wallet RGB completo sopra RLN). Libreria wallet: `rgb-lib` (binding Python, Node.js, Kotlin, Swift).

### QVAC — AI locale (Tether)
- SDK open-source (Apache 2.0), JS/TS (`@qvac/sdk`) e Python. Richiede **Node ≥ 22.17**. Nel progetto: `@qvac/sdk` ~0.21.0.
- Capability usate: **OCR**, LLM per **estrazione strutturata in JSON** e per la **divisione da linguaggio naturale**. Eventualmente vision e traduzione (Bergamot).
- Modelli GGUF già in cache (vedi `docs/STATUS.md`). `QVAC.md`: contesto ufficiale per coding agent.
- Con modelli piccoli il JSON va validato (zod) con retry e fallback.

### WDK — wallet self-custodial (Tether, opzionale/bonus)
- `@tetherto/wdk` + `@tetherto/wdk-wallet-btc` (BIP-84, Electrum, multi-account).
- Ponte RGB (Utexo, beta): `@utexo/wdk-wallet-rgb` e `@utexo/wdk-rgb-lightning`. Da tentare solo dopo `demo-v1`, con un limite di 3 ore.

### Architettura
Tutto TypeScript/Node: UI React + Vite con viste per ruolo → un backend Fastify che orchestra 4 nodi RLN, QVAC in-process, ledger SQLite append-only → `rgb-lightning-node` + bitcoind + electrs + proxy in Docker su regtest. Dettagli in `docs/PROMPT-hackathon.md`.

### Contesto di mercato (per il pitch)
Tether ha annunciato USDT su Bitcoin via RGB; Utexo è issuer/distributore di USDT Bitcoin-native. Punti forti per l'idea: nessun gas token separato, un'unica transazione per pagare tutto il gruppo, privacy della client-side validation, Lightning con il coordinatore come hub (roadmap).

---

## 4. Vincoli operativi per il weekend
- Percorso felice unico e blindato; dati demo pre-caricati; `pnpm demo:reset`.
- Tutto offline: modelli scaricati, immagini Docker già pullate, dipendenze installate.
- Registrare un video della demo funzionante sabato sera come backup.
- Nel pitch mostrare le transazioni vere (esplora REST e "cassa = saldo del nodo"), non lasciarle intuire.
- Feature freeze domenica alle 11:00; submit entro le **13:00** (obiettivo 12:30).

---

## 5. Cosa chiedo all'assistente AI
Aiutami a: (a) costruire la demo seguendo `docs/PROMPT-hackathon.md`, una fase alla volta; (b) tenere RGB e QVAC centrali e reali; (c) preparare il pitch per una giuria Tether/Utexo/KaleidoSwap, con risposte oneste ai punti deboli (custodia, on-ramp, regolamentazione). Sii critico: se qualcosa non regge, dimmelo.
