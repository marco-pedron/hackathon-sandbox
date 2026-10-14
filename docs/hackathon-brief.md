# Brief: Agentic Dollars on Bitcoin Hackathon — idea di progetto e regole

> Documento di contesto da dare a un assistente AI. Contiene: l'idea su cui il team sta lavorando, le regole verificate dell'hackathon, lo stack tecnico obbligatorio e i punti aperti.
> Aggiornato al 14 ottobre 2026 (hackathon: 17-18 ottobre 2026). Regole verificate sulla pagina ufficiale: https://rgbprotocol.org/agentic-dollars-hackathon/

---

## 1. L'idea chiave

**Gestione e regolamento di debiti/crediti nei viaggi di gruppo tra sconosciuti, multi-valuta, con AI locale e settlement in dollari digitali su Bitcoin (USDT via RGB).**

### Il contesto d'uso
Viaggi di gruppo organizzati tra persone che non si conoscono (format tipo WeRoad / "si vola"): 10-15 persone, spesso di nazionalità diverse, 1-3 settimane, decine di spese condivise (cene, taxi, benzina, alloggi, attività), pagate a turno da persone diverse e in valute diverse.

### Il problema
- Chi paga per primo anticipa soldi a sconosciuti e rischia di non rivederli: a fine viaggio il gruppo si scioglie e i debiti piccoli non vengono mai saldati.
- Le persone più disponibili/ingenue finiscono sistematicamente in credito.
- Multi-valuta: spese in valuta locale, partecipanti con conti in EUR, USD, GBP, CHF… I bonifici internazionali tra privati costano e sono lenti; non esiste un conto comune.
- Le app esistenti (Splitwise, Tricount) **calcolano** chi deve cosa ma **non regolano** nulla: il saldo resta un promemoria.

### La soluzione proposta
1. Si fotografa lo scontrino → **AI on-device (QVAC)** fa OCR ed estrazione strutturata (voci, importi, valuta, data), propone chi ha consumato cosa e la divisione.
2. L'umano approva o corregge la proposta (pattern "l'AI propone, l'umano approva").
3. Il registro delle spese è condiviso nel gruppo; i saldi sono netti e normalizzati in **un'unica unità: il dollaro digitale (USDT su RGB)**, a prescindere dalla valuta della spesa.
4. Il regolamento avviene **subito o durante il viaggio**, non "poi ci sentiamo": trasferimento di asset RGB via Lightning, istantaneo e a costo quasi nullo, senza banche né confini.
5. Privacy: scontrini e abitudini di spesa non lasciano il dispositivo.

### Perché questa versione è diversa dallo "Splitwise con RGB" (idea che il team aveva già scartato)
L'obiezione precedente era: *"esiste già, e RGB non serve"*. Questa versione prova a rispondere così:
- **Sconosciuti senza fiducia reciproca** → il valore non è il calcolo, è il *settlement immediato* che evita i crediti inesigibili a fine viaggio.
- **Persone di paesi diversi senza un sistema di pagamento comune** → un dollaro digitale self-custodial è un denominatore comune che non richiede IBAN, banche compatibili o app nazionali (Satispay, Bizum, Venmo… non si parlano).
- **Unica unità di conto** → la normalizzazione multi-valuta diventa un problema di conversione al momento della spesa, non di bonifici in valute diverse.

### Rischi e punti aperti da risolvere (non ancora risolti)
- **L'obiezione "RGB non serve" non è eliminata, è solo indebolita.** Va dimostrata con un utente specifico: es. "italiana in viaggio in Vietnam con un tedesco, un americano e due argentini". Se il gruppo è tutto italiano, Satispay/Revolut bastano e l'argomento crolla.
- **Onboarding**: ogni partecipante deve avere un wallet RGB e un canale Lightning con liquidità in entrata per ricevere. In un gruppo di sconosciuti è un attrito enorme. Serve una risposta (es. organizzatore/LSP che apre i canali, o settlement on-chain come fallback).
- **Tassi di cambio**: un modello locale offline non conosce i tassi. Serve una fonte (tasso inserito/registrato al momento della spesa, tabella scaricata, ecc.) e una regola chiara su quale tasso vale.
- **Off-ramp**: chi riceve USDT deve poterli convertire o spendere; va almeno citato nel pitch.
- **Ruolo dell'AI**: deve essere centrale (estrazione, attribuzione delle voci, gestione dei casi ambigui), non un chatbot decorativo.

### Scope minimo realistico per la demo (~27 ore di build)
Un gruppo pre-caricato di 3 persone, 2-3 scontrini di esempio in valute diverse, un flusso: foto → proposta AI → approvazione → saldo in USD → pagamento RGB reale su regtest → saldo aggiornato. Nient'altro.

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

Concetti chiave: single-use seal (lo stato è legato a un UTXO Bitcoin), client-side validation (i dati stanno sui client, on-chain solo un commitment tapret/opret), consignment, stash, invoice con blinded UTXO, witness transaction. Nel trasferimento è il **ricevente** a generare l'invoice per primo; un **RGB proxy server** fa da buca delle lettere per i consignment.

Tool principale: **`rgb-lightning-node`** (RLN, `github.com/RGB-Tools/rgb-lightning-node`) — daemon Rust con REST API e Swagger UI, pilotabile da qualsiasi linguaggio. Stack regtest in Docker: bitcoind + electrs + esplora + RGB proxy, più 2-3 nodi RLN. È early alpha. Rete per la demo: **regtest** (transazioni vere su rete locale).

Riferimento di codice: `iris-wallet-desktop` (wallet RGB completo sopra RLN). Libreria wallet: `rgb-lib` (binding Python, Node.js, Kotlin, Swift).

### QVAC — AI locale (Tether)
- SDK open-source (Apache 2.0), JS/TS (`@qvac/sdk`) e Python. Richiede **Node ≥ 22.17**.
- Capability utili per l'idea: **OCR**, **vision**, LLM per **estrazione strutturata in JSON**, traduzione (Bergamot), classificazione, embeddings/RAG.
- Modelli GGUF (registry QVAC, HuggingFace o file locale). Il primo avvio scarica il modello: va fatto prima dell'evento.
- `QVAC.md`: file di contesto ufficiale per coding agent, da includere nelle regole dell'agente.
- Ricette pronte su `qvac.tether.io/recipes`, inclusa l'estrazione strutturata da fatture/scontrini — punto di partenza diretto per l'idea.
- Con modelli piccoli il JSON va validato (es. zod) con retry e fallback.

### WDK — wallet self-custodial (Tether, opzionale/bonus)
- `@tetherto/wdk` + `@tetherto/wdk-wallet-btc` (BIP-84, Electrum, multi-account).
- Ponte RGB già esistente (Utexo, beta): `@utexo/wdk-wallet-rgb` (chiavi e balance RGB da seed BIP-39) e `@utexo/wdk-rgb-lightning` (canali, invoice, pagamenti RGB-over-LN; superficie `UtexoLsp` con `connect`, `waitForChannel`, `receiveAsset`, `sendAsset`, `payAddress`…), più binding Node nativi `@utexo/rgb-lightning-node-nodejs`. Da testare prima dell'evento; piano B: RLN via REST.

### Architettura consigliata
Tutto TypeScript/Node: UI React + Vite → logica Node 22.17+ con `@qvac/sdk`, `@tetherto/wdk`, `@utexo/wdk-rgb-lightning` → `rgb-lightning-node` + bitcoind + electrs + proxy in Docker su regtest.

### Contesto di mercato (per il pitch)
Tether ha annunciato USDT su Bitcoin via RGB; Utexo è issuer/distributore di USDT Bitcoin-native. Punti forti per l'idea: pagamenti istantanei via Lightning, privacy migliore, **nessun gas token separato** per le fee.

---

## 4. Vincoli operativi per il weekend
- Percorso felice unico e blindato; dati demo pre-caricati; script di reset.
- Tutto offline: modelli scaricati, immagini Docker già pullate, dipendenze installate.
- Registrare un video della demo funzionante sabato sera come backup.
- Nel pitch mostrare le transazioni vere (explorer regtest), non lasciarle intuire.
- Feature freeze domenica mattina presto: il submit è alle **13:00**.

---

## 5. Cosa chiedo all'assistente AI
Aiutami a: (a) mettere sotto stress l'idea rispetto ai 5 criteri, soprattutto Marketability e "perché serve RGB"; (b) risolvere i punti aperti (onboarding, tassi di cambio, off-ramp); (c) definire lo scope minimo della demo e l'architettura; (d) preparare il pitch per una giuria Tether/Utexo/KaleidoSwap. Sii critico: se l'idea non regge, dimmelo.
