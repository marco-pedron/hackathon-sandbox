# ROADMAP — Cassa comune digitale per viaggi organizzati

> Per il team (umani). Le specifiche e i criteri di accettazione di ogni fase sono in `docs/PROMPT-hackathon.md`; qui ci sono solo **chi, quando e cosa tagliare**. Aggiornata al 15 ottobre 2026.

## In una riga
Ogni viaggiatore versa una quota in una cassa RGB custodita dal coordinatore. Chi paga una spesa comune viene rimborsato dalla cassa dopo che l'AI locale ha letto lo scontrino e gli interessati hanno approvato le proprie righe. A fine viaggio, un solo batch restituisce i residui.

## Cosa cambia rispetto a ieri
- **Via** il saldo diretto tra viaggiatori ("Settle now" Bob → Alice) e il piano di semplificazione nella UI.
- **Via** dal percorso critico lo spike sulla multisig: custodia del coordinatore (nodo `dave`), multisig solo come slide di roadmap.
- **Dentro** un quarto nodo RLN (`dave` = cassa), il modello a quote, l'approvazione per riga con silenzio-assenso, la coda pagamenti del coordinatore, la chiusura in batch con residui "non riscossi".
- **Riusato tutto:** stack, rail on-chain, ledger (FX, split, balances, `closePot`). Il nuovo codice di dominio è la Phase 2c.

## Ruoli (3 persone)
| Ruolo | Possiede | Fasi |
|---|---|---|
| **AI** | QVAC, prompt, fixture scontrini, `ai:eval` | 3, poi 5a WDK |
| **RGB + API** | nodo dave, `pot/`, `pot:e2e`, route Fastify, `demo:reset` | 0b, 4a, metà di 4b, poi 5c Lightning |
| **UI + pitch** | viste per ruolo, stati di errore, video, `pitch.md` | 2c (se è chi conosce il ledger), metà di 4b, 7 |

Chi ha scritto il ledger fa la 2c, qualunque sia il suo ruolo.

## Prima dell'evento (giovedì 15 – venerdì 16)
- [ ] **Phase 0b:** `rln-dave` nel compose, `infra:check` verde, misura della RAM con 4 nodi.
- [ ] **Phase 2c:** modello a quote, `reimbursable`, approvazioni con silenzio-assenso, `closePot` generalizzato con "non riscosso". Test verdi.
- [ ] **Fixture:** 3 foto di scontrini veri (ristorante VND, taxi EUR, supermercato USD) più il JSON atteso.
- [ ] **Pitch v0:** struttura dalla sezione 7 del PROMPT, slide "cosa vede l'operatore", slide "limiti onesti".
- [ ] **Se c'è un contatto con un coordinatore reale:** una frase sulla busta di contanti, utilizzabile nel pitch (con il suo permesso). Vale più di qualsiasi slide sulla Marketability.
- [ ] **Venerdì sera:** `pnpm infra:reset`, `ai:smoke` con Wi-Fi spento, immagini Docker e dipendenze già scaricate, caricabatterie.

## Sul posto
| Quando | AI | RGB + API | UI + pitch |
|---|---|---|---|
| Sab 09:30–13:30 | Phase 3: estrazione + split, `ai:eval` | Phase 4a: seed dave, depositi, rimborso, batch, `pot:e2e` | Shell UI: routing `?as=`, layout a 3 finestre, viste vuote |
| Sab 14:30–19:00 | Route AI, stato del modello, fallback manuali | Route Fastify (spese, approvazioni, pagamenti, chiusura, proof) | Phase 4b: viste collegate alle API |
| Sab 19:00–22:00 | Tutti sul percorso felice da `demo:reset`, Wi-Fi spento → **tag `demo-v1` + video** | | |
| Sab notte (facoltativo, max una cosa a testa) | 5a WDK (3 h) | 5c Lightning (4 h) | 5b catena di hash (1,5 h) |
| Dom 08:00–11:00 | Phase 7: errori, README, due run puliti consecutivi | | Prove del pitch |
| **Dom 11:00** | **Feature freeze** | | |
| Dom 11:00–12:30 | Video finale, submit (obiettivo 12:30, limite 13:00) | | |

**Regola d'oro:** se alle 23:00 di sabato `demo-v1` non c'è, niente Phase 5. Si taglia secondo la lista qui sotto finché il percorso felice non funziona.

## Ordine dei tagli (dal primo all'ultimo)
1. Tutta la Phase 5.
2. Contestazione e annullamento (resta solo "approva").
3. Ricarica della quota.
4. Batch di chiusura → pagamenti singoli in sequenza.
5. Tasso del giorno modificabile → solo tabella statica.

**Mai tagliare:** transfer RGB reali, estrazione on-device, divisione da frase (fallback a checkbox sì, eliminazione no), approvazione esplicita del coordinatore, proof panel.

## Come copriamo i 5 criteri
| Criterio | Cosa lo dimostra nella demo |
|---|---|
| RGB usage | Depositi, rimborso e batch di chiusura reali su regtest; txid su esplora; "cassa = saldo del nodo dave"; residuo non riscosso perché senza invoice non si riceve (mostra che conosciamo il protocollo) |
| QVAC | OCR + estrazione JSON + frase → assegnazione, tutto offline, con indicatore "gira su questo dispositivo" |
| Execution | Un percorso end-to-end da `demo:reset`; commit datati |
| Marketability | Concorrente = busta di contanti; cliente = tour operator; utente nominabile (Alice in Vietnam con sconosciuti); limiti detti apertamente |
| UX/UI | Tre finestre, ogni passaggio spiegato, countdown del silenzio-assenso, errori con un'azione suggerita |
| Bonus WDK | Solo se `demo-v1` è taggato: derivazione wallet da seed, saldi RGB via `@utexo/wdk-wallet-rgb` |

## Rischi principali e piano B
| Rischio | Segnale | Piano B |
|---|---|---|
| RAM con 4 nodi | OOM in Docker, nodi che si riavviano | Stack sul laptop Linux, backend + QVAC sul MacBook (già supportato dalle env var) |
| OCR scarso sullo scontrino VND | `ai:eval` sotto soglia | Modello vision documentato in QVAC.md, poi form manuale pre-compilato; in demo uno scontrino con stampa nitida |
| Batch send con dave instabile | `pot:e2e` rosso | Pagamenti singoli in sequenza |
| Nodo che si blocca durante il pitch | transfer pending > 90 s | `demo:reset` tra un run e l'altro; video di backup |
