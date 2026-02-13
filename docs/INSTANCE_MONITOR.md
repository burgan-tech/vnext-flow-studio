# Instance Monitor - Teknik Dokumantasyon

## 1. Ne Yaptik?

VS Code extension'imiza **Instance Monitor** ozelligi ekledik. Bu ozellik, Amorphie workflow runtime'inda calisan workflow instance'larini VS Code icinden **canli olarak izlemeyi** saglar. Zeebe Operate'in yaklasimini referans aldik.

### Temel Yetenekler

| Yetenek                  | Aciklama                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------ |
| Instance Listeleme       | Secili workflow'un tum instance'larini runtime API'den ceker                         |
| Instance Detay           | Tiklandiginda state, status, data, transition bilgilerini gosterir                   |
| Show on Flow             | Instance'in gectigi state'leri canvas uzerinde Zeebe Operate tarzinda renklendirir   |
| Watch Live (Polling)     | Secili instance'i 2sn aralikla canli izler, state degisikliklerini anlik gosterir    |
| ClickHouse Entegrasyonu  | Opsiyonel — zengin transition history, duration metrikleri, workflow istatistikleri  |
| Otomatik Runtime Tespiti | Ortam konfigurasyonu yoksa localhost portlarini tarar (4201, 5000, 5001, 3000, 8080) |
| Graceful Fallback        | API 400/500 dondugunde bile minimal bilgiyle UI'i acik tutar                         |

---

## 2. Mimari (Architecture)

```
                    VS Code Extension (Node.js)
                    ============================
                    InstanceMonitorProvider.ts
                         |          |
            +------------+          +-------------+
            |                                     |
    WorkflowTestService.ts              ClickHouseService.ts
    (Runtime REST API)                  (ClickHouse HTTP)
            |                                     |
            v                                     v
    Amorphie Runtime                     ClickHouse DB
    http://localhost:4201                http://localhost:8123
    /api/v1.0/{domain}/...              workflow_analytics DB


                    VS Code Webview (React)
                    ========================
                    InstanceMonitorApp.tsx
                    InstanceMonitorApp.css
                    main.tsx (entry point)

    Extension <---postMessage---> Webview
```

### Katmanlar

1. **InstanceMonitorProvider** (Extension tarafinda): Tum backend mantigi. Webview olusturur, mesajlari dinler, API cagrilarini yapar, Canvas'a overlay gonderir.
2. **WorkflowTestService** (Extension tarafinda): Amorphie Runtime REST API client. `listInstances`, `getInstanceStatus`, `getStateFunctions` gibi metodlar icerir.
3. **ClickHouseService** (Extension tarafinda): Opsiyonel ClickHouse baglantisi. Transition history, visited states, workflow stats.
4. **EnvironmentManager** (Extension tarafinda): VS Code settings uzerinden ortam konfigurasyonu yonetimi.
5. **InstanceMonitorApp** (Webview tarafinda): React UI. Instance listesi, detay paneli, setup ekrani.
6. **Canvas.tsx** (Webview tarafinda): Monitoring overlay rendering. State node'larini ve edge'leri renklendirir.

---

## 3. Veri Akisi (Data Flow)

### Panel Acilis Sirasi

```
1. Kullanici "Open Instance Monitor" komutunu calistirir
2. InstanceMonitorProvider.createOrShowPanel() cagirilir
3. WebviewPanel olusturulur, HTML yuklenir
4. Init verisi hazirlanir (environment listesi, auto-detect sonucu)
5. Webview React mount olur → `monitor:checkStatus` mesaji gonderir
6. Extension bu mesaji alir → init verisini gonderir + status check yapar
7. Webview `init` alir → workflow state'ini set eder → handleRefreshInstances() cagirilir
8. Extension `monitor:listInstances` alir → API'ye istek atar → sonuclari gonderir
9. Webview instance listesini gosterir
```

### Kritik Nokta: Init Zamanlama Sorunu (Cozuldu)

**Sorun**: Extension `panel.webview.html` set ettikten hemen sonra `postMessage('init')` gonderiyordu. Ancak React henuz mount olmamisti, `window.addEventListener('message')` kayitli degildi. Mesaj kayboluyordu.

**Cozum**: Init verisini webview'den ilk mesaj geldiginde (`ready` veya `monitor:checkStatus`) gondermek:

```typescript
// Extension tarafinda (InstanceMonitorProvider.ts)
const initData = await buildInitData();
let initSentViaMessage = false;

panel.webview.onDidReceiveMessage(async (message) => {
  if (
    !initSentViaMessage &&
    (message.type === "ready" || message.type === "monitor:checkStatus")
  ) {
    initSentViaMessage = true;
    panel.webview.postMessage(initData);
  }
  await this.handleMessage(message, panel, workflow, panelKey);
});

// Yedek: hemen de gonder (webview hazirsa yakalayabilir)
panel.webview.postMessage(initData);
```

---

## 4. Mesaj Protokolu (Extension <-> Webview)

### Webview -> Extension

| Mesaj Tipi                  | Aciklama                  | Parametreler                                                    |
| --------------------------- | ------------------------- | --------------------------------------------------------------- |
| `ready`                     | Webview mount oldu        | -                                                               |
| `monitor:checkStatus`       | API baglanti durumu sor   | -                                                               |
| `monitor:listInstances`     | Instance listesi getir    | `workflowKey`, `domain`, `page`, `pageSize`                     |
| `monitor:getInstanceDetail` | Instance detayi getir     | `instanceId`, `workflowKey`, `domain`, `currentState`, `status` |
| `monitor:showOnFlow`        | Canvas'ta goster          | `instanceId`, `workflowKey`, `domain`, `currentState`, `status` |
| `monitor:startPolling`      | Canli izleme baslat       | `instanceId`, `workflowKey`, `domain`                           |
| `monitor:highlightInstance` | Canvas'ta vurgula         | `instanceId`, `workflowKey`, `currentState`, `visitedStates`    |
| `monitor:clearHighlight`    | Vurgulamayi kaldir        | -                                                               |
| `monitor:clearOverlay`      | Overlay'i kaldir          | -                                                               |
| `monitor:saveEnvironment`   | Yeni ortam kaydet         | `baseUrl`, `name`                                               |
| `monitor:updateEnvironment` | Ortami guncelle           | `envId`, `baseUrl`, `name`                                      |
| `monitor:deleteEnvironment` | Ortami sil                | `envId`                                                         |
| `monitor:switchEnvironment` | Aktif ortami degistir     | `environmentId`                                                 |
| `monitor:getWorkflowStats`  | ClickHouse istatistikleri | `workflowKey`                                                   |

### Extension -> Webview

| Mesaj Tipi                   | Aciklama                | Icerik                                                                                                             |
| ---------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `init`                       | Baslangic verisi        | `workflow`, `environments`, `activeEnvironment`, `hasEnvironment`, `autoDetected`                                  |
| `test:status`                | API baglanti durumu     | `ready`, `clickhouseAvailable`                                                                                     |
| `monitor:instancesList`      | Instance listesi        | `instances[]`, `source`, `pagination`                                                                              |
| `monitor:instanceDetail`     | Instance detayi         | `detail { instanceId, currentState, status, data, transitions, visitedStates, transitionHistory, isFinal, error }` |
| `monitor:instanceUpdate`     | Polling guncellemesi    | `instanceId`, `currentState`, `status`, `data`, `visitedStates`, `isFinal`                                         |
| `monitor:showOnFlowResult`   | Canvas overlay sonucu   | `success`, `overlay`                                                                                               |
| `monitor:error`              | Hata mesaji             | `error`                                                                                                            |
| `monitor:environmentSaved`   | Ortam kaydedildi        | -                                                                                                                  |
| `monitor:environmentChanged` | Aktif ortam degisti     | `environmentId`, `hasClickHouse`                                                                                   |
| `monitor:workflowStats`      | Workflow istatistikleri | `stats { total, active, completed, failed, avgDuration }`                                                          |
| `monitor:pollingError`       | Polling durdu           | `instanceId`, `error`                                                                                              |

### Extension -> Canvas (ModelBridge uzerinden)

| Metod                                                                 | Aciklama                    |
| --------------------------------------------------------------------- | --------------------------- |
| `broadcastInstanceHighlight(instanceId, workflowKey, currentState)`   | Tek state vurgulama         |
| `broadcastHistoryHighlight(workflowKey, visitedStates, currentState)` | Gecmis state'leri vurgulama |
| `broadcastMonitoringOverlay(instanceId, workflowKey, overlay)`        | Zeebe-style tam overlay     |
| `clearInstanceHighlight()`                                            | Vurgulamayi temizle         |
| `clearMonitoringOverlay()`                                            | Overlay'i temizle           |

---

## 5. Runtime API Kullanimi

### Endpoint'ler

```
GET /api/v1.0/{domain}/workflows/{workflowKey}/instances
    → Instance listesi (pagination: links.next, links.prev)
    → Response: { links: { self, first, next, prev }, items: [...] }

GET /api/v1.0/{domain}/instances/{instanceId}/functions/state
    → Instance'in mevcut state, status, transition bilgileri
    → Response: { state, status, transitions[], isFinal, data, dataHref }
```

### Instance Itemlarin API Formati

Runtime API'den gelen instance objeleri sunlari icerir:

- `id` (instanceId olarak kullanilir)
- `key`, `flow`, `domain`, `flowVersion`
- `etag`, `tags`, `attributes`, `extensions`

**NOT**: API dogrudan `state`, `status`, `created` donmuyor. Bu bilgiler icin her instance'a ayri `/functions/state` istegi atilir (enrichment).

### Domain Cozumleme

Domain bilgisi webview'den gelebilir veya:

1. `vnext.config.json` dosyasindan okunur (workspace root'ta)
2. Bulunamazsa `'core'` fallback kullanilir

```typescript
private static async resolveDomain(domain?: string): Promise<string> {
  if (domain) return domain;
  // vnext.config.json'dan oku
  // bulunamazsa 'core' don
}
```

---

## 6. Monitoring Overlay (Show on Flow)

Canvas uzerinde instance'in gectigi yolu gorsellestiren Zeebe Operate tarzinda overlay.

### Overlay Veri Yapisi

```typescript
interface MonitoringOverlayData {
  states: Record<
    string,
    {
      status:
        | "completed"
        | "active"
        | "error"
        | "human-waiting"
        | "suspended"
        | "unvisited";
      visitOrder: number; // Ziyaret sirasi (1, 2, 3...)
      stateData?: any; // Sadece current state icin
    }
  >;
  edges: Record<
    string,
    {
      status: "traversed";
      traversalTime?: string;
      duration?: number;
      _matchPrefix?: boolean; // Prefix eslestirme (transition history yoksa)
    }
  >;
  instanceId: string;
  instanceStatus: string; // A, C, F, S
  currentState: string;
}
```

### Canvas'ta Goruntu

- **Yesil (completed)**: Gecilmis state'ler, tamamlanmis
- **Mavi pulsing (active)**: Su anki aktif state
- **Kirmizi (error)**: Hata ile bitmis state
- **Sari (human-waiting)**: Insan bekleniyor
- Her state uzerinde **ziyaret sirasi badge'i** (#1, #2, #3...)
- Her state uzerinde **sure badge'i** (ornegin "2.3s", "1m 45s")
- Edge'ler yesilimsi renk ile isaretelenir (traversed)

### CSS Sinif Hiyearsisi

```
.state-node--monitor-completed    → yesil border/glow
.state-node--monitor-active       → mavi pulsing border
.state-node--monitor-error        → kirmizi border
.state-node--monitor-human-waiting → sari border
.state-node--monitor-suspended    → turuncu border
.state-node--monitor-unvisited    → gri/soluk

.monitoring-badge                 → genel badge stili
.monitoring-badge--status         → sol ust kose (durum ikonu)
.monitoring-badge--order          → sag ust kose (ziyaret sirasi)
.monitoring-badge--duration       → alt orta (sure)
```

---

## 7. Polling (Watch Live)

Secili instance icin her 2 saniyede bir state degisikligini kontrol eder.

### Ozellikler

- 2 saniye aralik
- Maksimum 300 deneme (10 dakika)
- 5 ardisik hata sonrasi otomatik durma
- Her basarili sorguda `monitor:instanceUpdate` mesaji
- State degistiginde otomatik `broadcastHistoryHighlight` ve `broadcastMonitoringOverlay` guncellenmesi

### Akis

```
1. Kullanici "Watch Live" butonuna tiklar
2. Webview → Extension: monitor:startPolling { instanceId, workflowKey, domain }
3. Extension 2sn aralikla getInstanceStatus() cagirir
4. Yeni state bulunursa → monitor:instanceUpdate mesaji gonderir
5. Canvas overlay guncellenir (broadcastMonitoringOverlay)
6. Instance final state'e ulasirsa polling otomatik durur
```

---

## 8. ClickHouse Entegrasyonu (Opsiyonel)

ClickHouse baglandigi zaman **zengin transition history** ve **workflow istatistikleri** saglar.

### Konfigürasyon

VS Code settings'te:

```json
{
  "amorphie.environments": {
    "local": {
      "id": "local",
      "name": "Local",
      "baseUrl": "http://localhost:4201",
      "monitoring": {
        "clickhouseUrl": "http://localhost:8123",
        "clickhouseDatabase": "workflow_analytics",
        "clickhouseUser": "default",
        "clickhousePassword": ""
      }
    }
  }
}
```

### Tablolar

```sql
-- instances: Workflow instance'lari
Id, Key, Flow, CurrentState, Status, CreatedAt, DurationSeconds

-- instance_transitions: State gecisleri (KEY FEATURE)
InstanceId, FromState, ToState, StartedAt, FinishedAt, DurationSeconds

-- instance_tasks: Task calisma kayitlari
TransitionId, TaskId, Status, DurationSeconds
```

### ClickHouse vs API Karsilastirmasi

| Ozellik                 | Runtime API             | ClickHouse                                   |
| ----------------------- | ----------------------- | -------------------------------------------- |
| Instance listesi        | Evet (pagination)       | Evet (limit)                                 |
| Mevcut state            | Evet (/functions/state) | Evet                                         |
| Transition history      | Hayir (sinirli)         | Evet (tam gecmis)                            |
| Workflow istatistikleri | Hayir                   | Evet (total, active, completed, avgDuration) |
| State durations         | Hayir                   | Evet (her state icin)                        |
| Visited states          | Sinirli                 | Evet (tam liste)                             |

---

## 9. Ortam Yonetimi (Environment Management)

### Otomatik Tespit

Hic ortam konfigurasyonu yoksa, asagidaki portlari tarar:

```
4201 → 5000 → 5001 → 3000 → 8080
```

Her port icin su path'leri dener:

```
/health → /api/health → /healthz → /api/v1.0/health → /
```

500'den kucuk HTTP status kodu → port acik, runtime bulundu.

### Manuel Konfigürasyon

Webview'deki Setup ekraniyla veya VS Code settings'ten:

```json
{
  "amorphie.environments": {
    "local": {
      "id": "local",
      "name": "Local Development",
      "baseUrl": "http://localhost:4201"
    }
  },
  "amorphie.activeEnvironment": "local"
}
```

### Coklu Ortam Destegi

Birden fazla ortam tanimlanabilir (dev, staging, prod). Instance Monitor header'daki dropdown ile degistirilebilir.

---

## 10. Hata Yonetimi (Error Handling)

### Graceful Fallback Stratejisi

| Senaryo                        | Davranis                                                          |
| ------------------------------ | ----------------------------------------------------------------- |
| `/functions/state` 400 donerse | Cache'teki veya webview'den gelen bilgiyle minimal detay gosterir |
| API tamamen erisilemazse       | Bos liste + hata mesaji gonderir, UI "Loading..." da takilmaz     |
| ClickHouse erisilemazse        | Sessizce API'ye fallback yapar                                    |
| Enrichment basarisizsa         | Instance'in mevcut status'unu korur (veya 'A' fallback)           |
| Polling'de ardisik hatalar     | 5 ardisik hata sonrasi otomatik durma, kullaniciya bildirim       |
| Domain undefined gelirse       | vnext.config.json'dan okur, bulamazsa 'core' kullanir             |

### lastInstancesCache

Extension, son basan listInstances sonucunu cache'ler. Sonraki API cagrilari basarisiz olursa bu cache'ten bilgi alinir (ornegin instance detail fallback'inde).

---

## 11. Dosya Haritasi

### Extension (packages/extension/src/)

| Dosya                                   | Sorumluluk                                                                               |
| --------------------------------------- | ---------------------------------------------------------------------------------------- |
| `monitoring/InstanceMonitorProvider.ts` | Ana backend sinif. Panel olusturma, mesaj yonetimi, API koordinasyonu                    |
| `monitoring/ClickHouseService.ts`       | ClickHouse HTTP query client                                                             |
| `testing/WorkflowTestService.ts`        | Runtime API client (listInstances, getInstanceStatus, getStateFunctions, testConnection) |
| `deployment/EnvironmentManager.ts`      | VS Code settings uzerinden ortam CRUD                                                    |
| `bridge/ModelBridge.ts`                 | Extension ↔ Canvas iletisim hub'i (broadcastMonitoringOverlay vb.)                      |

### Webview (packages/webview/src/)

| Dosya                                     | Sorumluluk                                                                 |
| ----------------------------------------- | -------------------------------------------------------------------------- |
| `instanceMonitor/InstanceMonitorApp.tsx`  | React UI (instance listesi, detay, setup, pagination, filter)              |
| `instanceMonitor/InstanceMonitorApp.css`  | Tum stiller                                                                |
| `instanceMonitor/main.tsx`                | React entry point                                                          |
| `components/Canvas.tsx`                   | Monitoring overlay rendering (state renklendirme, badge'ler)               |
| `components/nodes/PluggableStateNode.tsx` | State node'unda monitoring badge'leri (status ikonu, ziyaret sirasi, sure) |

---

## 12. Nasil Kullanilir?

### Onkosuller

1. Amorphie runtime calisir durumda olmali (varsayilan: `http://localhost:4201`)
2. VS Code'da bir vNext workflow projesi acik olmali
3. Workflow daha once runtime'a deploy edilmis olmali

### Adimlar

1. Flow editor'de sag tik → **"Open Instance Monitor"** sec
   - Veya Command Palette → `Amorphie: Open Instance Monitor`
2. Ilk acilista runtime otomatik tespit edilir (veya Setup ekrani cikar)
3. Instance listesi otomatik yuklenir
4. Bir instance'a tikla → detay paneli acilir
5. **"Show on Flow"** → Canvas'ta instance'in gectigi yol gorunur
6. **"Watch Live"** → Canli izleme baslar (2sn aralik)

### Yaygin Senaryolar

**Senaryo 1: Instance neden bu state'te takili?**

1. Instance Monitor'u ac
2. Ilgili instance'i tikla
3. "Show on Flow" ile canvas'ta gorselestir
4. Mevcut state mavi yanip soner, gecmis state'ler yesil gosterilir
5. Detay panelinde `data` alaninda instance verisini incele

**Senaryo 2: Instance'in gecis surelerini gormek**

1. ClickHouse yapilandirmasi gereklidir
2. Instance'i sec → detay panelinde Transition History bolumu
3. Her state gecisinin suresi (duration) gorulur

**Senaryo 3: Bir instance'i canli izlemek**

1. Instance'i sec
2. "Watch Live" butonuna tikla
3. State degistiginde canvas otomatik guncellenir
4. Instance final state'e ulasinca polling otomatik durur

---

## 13. Bilinen Kisitlamalar

1. **Runtime API'den gelen instance listesinde `state` alani yok** — her instance icin ayri `/functions/state` istegi gerekiyor (enrichment). Bu N+1 query problemi olusturabilir.
2. **Bazi instance'lar icin `/functions/state` 400 donuyor** — instance baska workflow'a ait olabilir veya state artik gecerli degil. Fallback mekanizmasi bu durumu yonetiyor.
3. **ClickHouse olmadan transition history sinirli** — runtime API sadece mevcut state'i donuyor, gecmis state'leri donmuyor (veya sinirli donuyor).
4. **Polling sirasinda fitView sorunu** — her polling tick'inde canvas focus yapilmamali, sadece state degistiginde bir kez yapilmali (plan item #7).
