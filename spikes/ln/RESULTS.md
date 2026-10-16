# Spike Lightning RGB: risultati

Data: venerdì 16/10/2026, 10:18–10:35 CEST (circa 20 minuti di esperimenti). RLN: immagine `settleup/rln:d4762ac` (upstream `RGB-Tools/rgb-lightning-node@d4762ac`), regtest. Branch `spike-ln`, cartella `spikes/ln/`.
Log completo di ogni chiamata (body esatti, password e mnemonica oscurate): `spikes/ln/calls.log`. Helper: `spikes/ln/lib.sh`.

## Verdetto

**Modalità consigliata: `ln-2ch`.** Le domande del gate 1, 3, 4 e 5 sono verdi, e lo è anche la 2: due canali RGB tra la stessa coppia (uno per verso) si aprono e instradano un pagamento Alice → Dave → Bob in 3,4 s, senza minare blocchi.

**Due cambi necessari alla SPEC** (dettagli sotto):
1. `/signmessage` di RLN a `d4762ac` **non firma il messaggio** (firma sempre la stringa vuota). Non si può usare per il registro firmato → si applica il fallback [D] di §9.1: chiave applicativa ed25519 per membro.
2. `/backup` richiede il nodo **bloccato**. Il "backup automatico dopo ogni cambiamento" (§12) significa lock → backup → unlock: il nodo è offline per qualche secondo e su Dave ferma l'instradamento. Va fatto a eventi rari, non a ogni pagamento.

## Domande

| # | Domanda | Esito | Note |
|---|---|---|---|
| 1 | Apertura canale RGB DUSD viaggiatore → Dave | ✅ | `capacity_sat` 100000, `asset_amount` 5000, `push_msat` 0, `public` true, `with_anchors` true, fee 0. **6 conferme** per `ready`/`is_usable` (mining di 6 blocchi in un colpo funziona). I DUSD escono subito dal saldo on-chain e compaiono in `offchain_outbound`. |
| 2 | Due canali nella stessa coppia | ✅ | Dave → Alice con 3000 DUSD di Dave, mentre Alice → Dave era già aperto: entrambi `Opened`, usabili, `scid` diversi. Lo stesso per bob e charlie; aperture da due nodi diversi nello stesso blocco ok. |
| 3 | Pagamento instradato Alice → Dave → Bob | ✅ | Invoice di bob 309 DUSD, `/sendpayment` di alice → `Succeeded` in **3,4 s** (polling ogni 250 ms), **0 blocchi**. Canali pubblici. Funziona anche **in uscita su un canale privato** (charlie → dave privato → alice, `Succeeded`). Ricezione su canale privato non provata. |
| 4 | `preimage` sul pagatore | ✅ | `/getpayment` di alice (`inbound: false`) ha `preimage`; `sha256(preimage) == payment_hash` verificato. Anche bob la vede. |
| 5 | `/decodelninvoice.payee_pubkey` = pubkey del creditore | ✅ | Decodificato dal nodo di alice: `payee_pubkey` = `/nodeinfo.pubkey` di bob. Restituisce anche `asset_id`, `asset_amount`, `description`, `expiry_sec`, `timestamp`, `payment_hash`. |
| 6 | Formato `/signmessage` e verifica TS | ⚠️ | Formato: 104 caratteri zbase32 = 65 byte `[31+recid, r, s]`, firma ricuperabile su `sha256d("Lightning Signed Message:" + msg)` (`lightning::util::message_signing`). `verify-sig.ts` funziona. **Ma RLN firma `&message.as_bytes()[message.len()..]`, cioè una slice vuota** (`src/routes.rs:4278-4281`): messaggi diversi danno **la stessa firma**, che verifica con alice solo per `msg = ""`. È un token costante e riusabile, non una firma. → fallback ed25519. |
| 7 | Chiusura cooperativa, dove vanno i DUSD | ✅ | `/closechannel` da Dave con `force: false` su entrambi i canali di charlie. I canali spariscono subito dalla lista e da `offchain_*`; i DUSD tornano a charlie **on-chain** dopo: conferma della tx di chiusura (altezza N) → circa 6 blocchi dopo LDK emette "tracking 1 spendable outputs" e RLN fa uno sweep → **`/refreshtransfers` di charlie** → `settled`. Risultato: 450.00 + 46.50 (canale di viaggio) + 1.00 (liquidità) = 497.50 `settled` ✓; Dave 942.50 dopo il suo `/refreshtransfers` ✓. `/sync` non serve. Contare ~N+6, budget 12 blocchi. |
| 8 | `/backup` e `/restore` | ⚠️ | Su nodo sbloccato: `403 UnlockedNode`. Dopo `/lock`: file cifrato da 440 KB (zip di tutto lo storage, canali LDK compresi) scritto **dentro il container** al `backup_path` dato; l'API non restituisce i byte. `/restore` su nodo nuovo (mai inizializzato, bloccato) → `/unlock`: stessa pubkey, 4 canali `Opened` e usabili, peer riconnessi da soli, saldi identici, e **instrada un pagamento** (alice → bob 0.10 `Succeeded`). Trappola: la directory del file deve essere scrivibile dall'utente del container (`IO Permission denied` altrimenti). |
| 9 | BTC per HTLC, pagamenti per canale | ✅ | `rgb_htlc_min_msat` = 3 000 000 (3000 sat). `amt_msat` più basso o `null` → `400 InvalidAmount`. Ogni pagamento sposta **3000 sat** per hop insieme ai DUSD: canale di alice 99013 → 96013 sat, liquidità Dave → bob 99013 → 96013. Outbound iniziale 98 340 000 msat → **32 pagamenti** per canale da 100 000 sat, indipendentemente dai DUSD. `next_outbound_htlc_limit_msat` 10 000 000 → al massimo 3 HTLC in volo per canale. |
| 10 | Latenza; invoice scaduto | ✅ | 3,4 s. Invoice con `expiry_sec` 5 pagato dopo 10 s: **nessun errore HTTP**, `/sendpayment` risponde 200 con `status: "Failed"` subito; `/invoicestatus` di bob → `Expired`; `/decodelninvoice` non segnala la scadenza (calcolare `timestamp + expiry_sec`). |

## Richieste che funzionano

`AID = rgb:2aLz0H5a-oCXS4Nl-qXW2IEn-QH6UP3L-LBHA5C8-isU0B4U` (DUSD, precisione 2). Porte API: alice 3001, bob 3002, charlie 3003, dave 3004; porte peer LN 9735–9738, raggiungibili nella rete docker come `rln-<nome>:<porta>`. Mining: `bitcoin-cli -rpcwallet=miner -generate n` (vedi `lib.sh`).

### Passo 0 — rln-dave
`infra/docker-compose.yml`: servizio `rln-dave` come gli altri, `--daemon-listening-port 3004 --ldk-peer-listening-port 9738` (flag confermati da `rgb-lightning-node --help`).
- dave `POST /init` `{"password":"…"}` → `{"mnemonic":"…"}`
- dave `POST /unlock`
  ```json
  {"password":"…","ldk_chain_sync":{"mode":"BlockSync","config":{"bitcoind_rpc_username":"user","bitcoind_rpc_password":"password","bitcoind_rpc_host":"bitcoind","bitcoind_rpc_port":18443}},"indexer_url":"electrs:50001","announce_addresses":[],"announce_alias":"dave"}
  ```
  → `{}`
- 2 BTC a dave (`fund.sh`), mina 1.
- dave `POST /createutxos` `{"up_to":true,"num":10,"size":null,"fee_rate":5,"skip_sync":false}` → `{}`, mina 1.
- dave `POST /rgbinvoice` `{"min_confirmations":1,"asset_id":null,"assignment":{"type":"Fungible","value":100000},"witness":false,"expiration_timestamp":<now+3600>,"transport_endpoints":["rpc://proxy:3000/json-rpc"]}` → `recipient_id`
- alice `POST /sendrgb` `{"donation":true,"fee_rate":5,"min_confirmations":1,"expiration_timestamp":<now+3600>,"recipient_map":{"<AID>":[{"recipient_id":"<rid>","assignment":{"type":"Fungible","value":100000},"transport_endpoints":["rpc://proxy:3000/json-rpc"]}]}}` → `{"txid":"78770a89…"}`, mina 1, `/refreshtransfers` su entrambi → dave 1000.00 `settled`.
- Saldi on-chain DUSD all'inizio: alice 8505.00, bob 995.00, charlie 500.00, dave 1000.00.

### Passo 1 — connectpeer (viaggiatore → dave)
alice/bob/charlie `POST /connectpeer` `{"peer_pubkey_and_addr":"0383bab7…634a@rln-dave:9738"}` → `{}`. `/listpeers` di dave mostra i 3.

### Passo 2 — D1, canale di viaggio
alice `POST /openchannel`
```json
{"peer_pubkey_and_opt_addr":"<dave_pubkey>@rln-dave:9738","capacity_sat":100000,"push_msat":0,"asset_amount":5000,"asset_id":"<AID>","public":true,"with_anchors":true,"fee_base_msat":0,"fee_proportional_millionths":0}
```
→ `{"temporary_channel_id":"ccbd2999…"}`. `/listchannels` subito: `Opening`, `local_balance_sat` 99013, `outbound_balance_msat` 98340000, `asset_local_amount` 5000. Blocchi minati uno alla volta: `short_channel_id` presente dopo 1, `Opened ready=true is_usable=true` **dopo il 6°**.

### Passo 3 — D2, canale di liquidità
dave `POST /openchannel` stesso body con `"<alice_pubkey>@rln-alice:9735"` e `"asset_amount":3000` → `temporary_channel_id`; mina 6 → `Opened`, usabile. Alice vede due canali verso dave: `asset 5000/0` e `0/3000`.

### Passo 4 — bob
bob → dave (5000) e dave → bob (3000), aperture di seguito, poi mina 6 → entrambi usabili.

### Passo 5 — D3, pagamento instradato
bob `POST /lninvoice`
```json
{"amt_msat":3000000,"expiry_sec":3600,"asset_id":"<AID>","asset_amount":309,"description":"kitty:test:1:alice"}
```
→ `{"invoice":"lnbcrt30u1p4drhky…"}`
alice `POST /sendpayment` `{"invoice":"<bolt11>"}` → `{"payment_id":"3659d9ba…","payment_hash":"3659d9ba…","payment_secret":"…","status":"Pending"}`
alice `POST /getpayment` `{"payment_hash":"3659d9ba…"}` in polling → `Succeeded` in 3,44 s:
```json
{"payment":{"amt_msat":3000000,"asset_amount":309,"asset_id":"<AID>","payment_hash":"3659d9ba…48f1","inbound":false,"status":"Succeeded","payee_pubkey":"0394f926…c6c4","preimage":"c9c42055…269b","description":"kitty:test:1:alice"}}
```
Bob: stesso oggetto con `inbound: true`. 0 blocchi minati.

### Passo 6 — D4
`sha256(c9c42055…269b) == 3659d9ba…48f1` → `True`.

### Passo 7 — D5
alice `POST /decodelninvoice` `{"invoice":"<bolt11 di bob>"}` → `{"amt_msat":3000000,"expiry_sec":3600,"timestamp":1792138948,"asset_id":"<AID>","asset_amount":309,"description":"kitty:test:1:alice","payment_hash":"3659d9ba…","payment_secret":"…","payee_pubkey":"0394f926…c6c4","network":"Regtest"}`; bob `/nodeinfo.pubkey` = `0394f926…c6c4`.

### Passo 8 — D6
alice `POST /signmessage` `{"message":"kitty spike test 1"}` e `{"message":"pay bob 1000000"}` → entrambi `{"signed_message":"rdpwjyz1oz4qzftq9pkdyfe8t1yproqpen8um5g7da7iws3epjy8wbwpnqhnx9z9r6fgrz4gy9mha7ak7iocu96xsmgq8sz6es361rcw"}`.
`node --experimental-strip-types verify-sig.ts "<msg>" <sig> <pubkey>`: con `""` → `valid: true` (recupera la pubkey di alice); con il messaggio vero → recupera un'altra chiave, `valid: false`.

### Passo 9 — D7
- charlie → dave (5000) e dave → charlie (3000), mina 6.
- charlie paga 3.50 ad alice, bob paga 1.00 a charlie (entrambi `Succeeded`): canali di charlie `4650/350` e `100/2900`.
- dave `POST /closechannel` `{"channel_id":"8f68ae30…2b3d","peer_pubkey":"03bd12cf…b95b","force":false}` → `{}`; idem per `e51909c9…3408`. Mempool: 2 tx di chiusura.
- Mina 6, poi charlie `POST /refreshtransfers` `{"asset_id":null,"filter":[],"skip_sync":false}` → `{"transfers":{"3":{"updated_status":"Settled","failure":null}}}`; `/assetbalance` → `settled` 49750. In `/listtransfers` (`{"asset_filter":{"type":"Id","value":"<AID>"}}`): un `ReceiveWitness` da 4750 nella tx di sweep `e724150b…`, confermata a h170, che spende la chiusura `e3583cde…` confermata a h164.
- Ripetuto con un canale privato: chiusura confermata a h176, `settled` dopo il blocco h182.

### Passo 10 — D8
dave `POST /lock` `{}` → `{}`; `POST /backup` `{"backup_path":"/RLNdata/spike-backup.bin","password":"…"}` → `{}` (2 s). `docker cp` del file in un container nuovo (`spike-rln-restore`, stessa immagine, porta 3005, volume vuoto), directory `chown user`; `POST /restore` `{"backup_path":"/tmp/bk/spike-backup.bin","password":"…"}` → `{}`; `POST /unlock` (stesso body del passo 0) → `{}`; `/nodeinfo`: stessa pubkey, `num_channels` 4, `num_usable_channels` 4, `num_peers` 2; pagamento alice → bob instradato dal nodo ripristinato `Succeeded`.

### Passo 11 — D9
Vedi la tabella. Prima/dopo il pagamento da 309: alice canale di viaggio `99013 → 96013` sat, `asset 5000/0 → 4691/309`; dave liquidità verso bob `99013 → 96013`, `3000/0 → 2691/309`.

### Passo 12 — D10
bob `/lninvoice` con `"expiry_sec":5`, attesa 10 s; alice `/sendpayment` → `{"payment_id":"db60f2e6…","status":"Failed"}` (HTTP 200); bob `POST /invoicestatus` `{"invoice":"…"}` → `{"status":"Expired"}`.

## Sorprese e trappole

1. **`/signmessage` non firma il messaggio** (bug upstream a `d4762ac`, `src/routes.rs:4280`). La firma è costante per nodo: chiunque l'abbia vista una volta può "firmare" qualsiasi cosa come quel nodo. Mai usarla per autenticare eventi. Usare ed25519 applicativo, legato al nodo in `MEMBER_JOINED` (e magari confermato da Dave in `MEMBER_ADMITTED`). `verify-sig.ts` resta valido se upstream corregge il bug.
2. **`/backup` solo a nodo bloccato.** Per Dave significa fermare l'instradamento; per un viaggiatore significa non poter pagare né ricevere durante il backup. Il file finisce nel filesystem del container: serve un volume condiviso (es. `/backups`) da cui l'agente legge i byte per caricarli sul relay. `/restore` vuole un nodo mai inizializzato e una directory scrivibile accanto al file.
3. **Dopo un restore il nodo originale è "vecchio" e non deve tornare online.** Nel test, il `rln-dave` di compose è rimasto fermo con uno stato ormai superato; il dave attivo è `spike-rln-restore` su :3005 (vedi "Stato lasciato" sotto).
4. **I DUSD di una chiusura arrivano con uno sweep**, circa 6 blocchi dopo la conferma della chiusura, e si vedono solo dopo `/refreshtransfers`. In demo: mina 1 finché la tx di chiusura è confermata, poi altri 6, poi refresh (budget 12 blocchi). Una chiusura (canale privato) è stata confermata più tardi del previsto: aspettare la tx in mempool prima di minare.
5. **Ogni pagamento RGB porta 3000 sat** per hop. Un canale da 100 000 sat regge 32 pagamenti in uscita, qualunque sia l'importo in DUSD. Per la demo basta; in produzione va dimensionato (o usato `push_msat` per riequilibrare). Il canale di liquidità del viaggiatore riceve 3000 sat a pagamento ma può spenderli solo oltre la riserva.
6. **Massimo 3 HTLC in volo per canale** (`next_outbound_htlc_limit_msat` 10 000 000 / 3 000 000). L'agente deve serializzare i pagamenti dello stesso debitore.
7. **Invoice scaduto = `status: "Failed"` con HTTP 200**, non un errore. Il motivo si deduce da `/invoicestatus` (lato creditore) o confrontando `timestamp + expiry_sec` con l'ora. Controllare la scadenza **prima** di pagare e, se scaduto, chiedere `INVOICE_REISSUED`.
8. `amt_msat` è obbligatorio di fatto: `null` o < 3 000 000 → `400 InvalidAmount`.
9. `/assetbalance` espone `offchain_outbound` e `offchain_inbound`: bastano per `Wallet.balances()` (on-chain = `settled`).
10. Aprire un canale toglie subito i DUSD dal `settled` on-chain. Il nodo che apre deve avere DUSD `settled` e UTXO colorabili.
11. `/listpayments` include anche i pagamenti in entrata (`inbound: true`).
12. Non provato: ricezione su canale **privato** (route hint negli invoice), due `/openchannel` di dave in parallelo (nel test erano sempre in sequenza), `force: true`.

## Parametri consigliati per il seed

| Parametro | Valore |
|---|---|
| `capacity_sat` | 100 000 (32 pagamenti per canale; minimo RGB `rgb_channel_capacity_min_sat` = 30 010) |
| `push_msat` | 0 |
| `asset_amount` | 5000 (viaggio, D) / 3000 (liquidità, L) |
| `public` | `true` (provato end-to-end; il privato funziona in uscita, la ricezione non è provata) |
| `with_anchors` | `true` |
| `fee_base_msat` / `fee_proportional_millionths` | 0 / 0 |
| Blocchi per l'apertura | 6 (si possono minare in un colpo dopo aver aperto tutti i canali) |
| Blocchi per la chiusura cooperativa | 1 per confermarla + ~6 per lo sweep, poi `/refreshtransfers` (budget 12) |
| `amt_msat` degli invoice | 3 000 000 (= `rgb_htlc_min_msat`, leggerlo da `/nodeinfo`) |
| `expiry_sec` | 3600 in demo (`INVOICE_EXPIRY_SECONDS`) |
| BTC per nodo | ≥ 0.01 BTC per canale aperto + fee; dave ne apre uno per viaggiatore |
| DUSD on-chain di dave | ≥ 3 × L + G per la garanzia; nel test 1000.00 |
| Polling `/getpayment` | 250 ms, timeout ~30 s |

## Stato lasciato dallo spike

- Canali aperti: alice ⇄ dave (2), bob ⇄ dave (2). Charlie senza canali, 497.50 DUSD on-chain.
- **Il dave attivo è il container `spike-rln-restore` (API :3005, peer 9739, volume `spike-rln-restore`)**, ripristinato dal backup. Il servizio compose `rln-dave` (:3004) è fermo con uno stato superato: **non riavviarlo così com'è** (rischio di pubblicare uno stato vecchio dei canali). Opzioni: `pnpm infra:reset` per ripartire puliti, oppure copiare il volume `spike-rln-restore` dentro `settleup_rln-dave` e rimuovere il container dello spike.
- `infra/docker-compose.yml`: aggiunto il servizio `rln-dave`. Password e mnemonica di dave in `spikes/ln/.secrets` (gitignored).
