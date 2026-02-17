# VNext Gelismis IntelliSense

Amorphie Flow Studio v2.6.1 ile gelen gelismis IntelliSense ozellikleri. Tum vnext yapisi icin JSON schema dogrulama, CSX script autocomplete, cross-file referans kontrolu ve Go-to-Definition destegi saglar.

---

## Icindekiler

- [Genel Bakis](#genel-bakis)
- [Mimari](#mimari)
- [Ozellikler](#ozellikler)
  - [1. JSON Schema Dogrulama + Autocomplete](#1-json-schema-dogrulama--autocomplete)
  - [2. Cross-File Referans Dogrulama](#2-cross-file-referans-dogrulama)
  - [3. Go-to-Definition](#3-go-to-definition)
  - [4. CSX IntelliSense](#4-csx-intellisense)
- [Kurulum](#kurulum)
- [Nasil Calisir](#nasil-calisir)
- [Build Pipeline](#build-pipeline)
- [Dosya Yapisi](#dosya-yapisi)
- [Test Rehberi](#test-rehberi)
- [Sorun Giderme](#sorun-giderme)
- [vnext-template Destegi](#vnext-template-destegi)
- [Gelistirici Notlari](#gelistirici-notlari)

---

## Genel Bakis

IntelliSense sistemi 4 ana bilesendan olusur:

| Ozellik | Ne Yapar | Dosya Tipi |
|---------|----------|------------|
| JSON Schema Validation | Yanlis alan yazinca kirmizi squiggle, eksik zorunlu alanlar, enum onerileri | `*.json` |
| Cross-File Referans | Referans edilen component bulunamazsa uyari | `*.flow.json` vb. |
| Go-to-Definition | Ctrl+Click ile referans edilen dosyaya git | `*.json` |
| CSX IntelliSense | BBT Workflow API autocomplete + hover docs | `*.csx` |

### Kaynak: `@burgan-tech/vnext-schema`

Tum JSON semalari `@burgan-tech/vnext-schema` npm paketinden (v0.0.35+) cikarilir. Bu paket:
- npm registry'de yayinlanmis (168.5 kB, 36+ versiyon)
- 6 component tipi icin JSON Schema tanimlari icerir
- `vnext-template/validate.js` tarafindan AJV ile kullanilir
- `getSchema(type)` ve `getAvailableTypes()` API'si var

Semalari sifirdan yazmak yerine bu paketten extract ediyoruz.

---

## Mimari

```
@burgan-tech/vnext-schema (npm)
        |
        v
extract-schemas.js (packages/core/scripts/)
        |
        v
packages/extension/schemas/
  |- workflow-definition.schema.json  (42 KB)
  |- task-definition.schema.json      (28 KB)
  |- view-definition.schema.json      (14 KB)
  |- schema-definition.schema.json    (7 KB)
  |- extension-definition.schema.json (8 KB)
  |- function-definition.schema.json  (6 KB)
  |- core-schema.schema.json          (8 KB)
        |
        v
extension.ts: registerJsonSchemas()
  -> VS Code json.schemas config
  -> Autocomplete + Validation + Hover

extension.ts: ComponentIndex
  -> Workspace indexer (FileWatcher)
  -> JsonDefinitionProvider (Ctrl+Click)
  -> JsonReferenceValidator (broken ref warnings)

extension.ts: CSX Providers
  -> CsxCompletionProvider (context. autocomplete)
  -> CsxHoverProvider (hover documentation)
```

---

## Ozellikler

### 1. JSON Schema Dogrulama + Autocomplete

Tum vnext JSON dosyalari icin otomatik schema dogrulama ve alan tamamlama.

**Desteklenen Component Tipleri:**

| Dizin | Schema | Ornek |
|-------|--------|-------|
| `Workflows/` | workflow-definition.schema.json | `otp-sms.json` |
| `Tasks/` | task-definition.schema.json | `validate-otp-content.json` |
| `Schemas/` | schema-definition.schema.json | `otp-request.json` |
| `Views/` | view-definition.schema.json | `otp-view.json` |
| `Functions/` | function-definition.schema.json | `send-sms.json` |
| `Extensions/` | extension-definition.schema.json | `sms-extension.json` |

**Ne Saglar:**

- **Ctrl+Space**: Alan onerileri (key, domain, version, attributes, tags vb.)
- **Validation**: Yanlis alan yazinca kirmizi squiggle
- **Hover**: Alan uzerine gelince aciklama
- **Enum Degerleri**: Ornegin `stateType` yazinca gecerli degerler onerilir
- **Required Fields**: Zorunlu alanlar eksikse uyari
- **Additional Properties**: Schema disinda alan eklenirse hata

**Ornek - Workflow JSON:**
```json
{
  "key": "otp-sms",          // pattern: ^[a-z0-9-]+$
  "flow": "sys-flows",
  "domain": "messaging",     // pattern: ^[a-z0-9-]+$
  "version": "1.0.0",        // pattern: ^\d+\.\d+\.\d+$
  "tags": ["otp", "sms"],    // minItems: 1
  "attributes": {
    "type": "F",              // enum onerileri gelir
    "states": [...]
  }
}
```

### 2. Cross-File Referans Dogrulama

Workflow JSON dosyalarinda diger componentlere yapilan referanslari dogrular.

**Desteklenen Referans Tipleri:**

| Referans | Konum | Ornek |
|----------|-------|-------|
| Task | `states[].onEntries[].task`, `transitions[].onExecutionTasks[].task` | `{"key":"validate-otp","domain":"messaging","flow":"sys-tasks","version":"1.0.0"}` |
| Schema | `transitions[].schema`, `startTransition.schema` | `{"key":"otp-request","domain":"messaging","flow":"sys-schemas","version":"1.0.0"}` |
| View | `states[].view.view` | `{"key":"otp-view","domain":"messaging","flow":"sys-views","version":"1.0.0"}` |
| Process | `states[].subFlow.process` | `{"key":"sub-process","domain":"messaging","flow":"sys-flows","version":"1.0.0"}` |

**Ne Saglar:**
- Referans edilen component workspace'te bulunamazsa **Warning** diagnostics gosterir
- `VNEXT_REF_TASK_NOT_FOUND`, `VNEXT_REF_SCHEMA_NOT_FOUND` vb. hata kodlari
- Quick Fix: "Create missing component" code action (scaffold)

### 3. Go-to-Definition

JSON dosyalarinda component referanslari uzerinde **Ctrl+Click** (veya F12) ile hedef dosyaya gider.

**Calisma Mantigi:**

1. Cursor konumundaki JSON path analiz edilir
2. Reference pattern tanimlanir (task/schema/view/process)
3. `ComponentIndex`'ten hedef dosya bulunur
4. `vscode.Location` ile dosya acilir

**ComponentIndex:**
- Extension aktif oldugunda workspace'teki tum component JSON dosyalarini tarar
- `key`, `domain`, `flow`, `version` bilgilerini indexler
- `FileSystemWatcher` ile degisiklikleri anlik takip eder
- `vnext.config.json`'dan path konfigurasyonunu okur

**Ornek:**
```json
// otp-sms.flow.json icinde:
"task": {
  "key": "validate-otp-content",  // <- Ctrl+Click
  "domain": "messaging",
  "flow": "sys-tasks",
  "version": "1.0.0"
}
// -> Tasks/validate-otp-content.json dosyasi acilir
```

### 4. CSX IntelliSense

`.csx` (C# Script) dosyalari icin BBT Workflow API autocomplete ve hover documentation.

**Context-Aware Autocomplete:**

| Yazdiginiz | Oneriler |
|------------|----------|
| `context.` | `Instance`, `Body`, `Headers`, `RouteValues`, `Workflow`, `Transition`, `CurrentState`, `QueryString` |
| `context.Instance.` | `Id`, `Key`, `Flow`, `CurrentState`, `Status`, `Data`, `Domain`, `UserId`, `CorrelationId`, `CreatedAt`, `ModifiedAt` |
| `context.Body.` | `StatusCode`, `Data`, `ErrorMessage`, `IsSuccess`, `TaskType`, `ExecutionDurationMs`, `Headers`, `Metadata` |
| `response.` | `Data`, `Headers`, `StatusCode` |
| `using ` | `using BBT.Workflow.Scripting;`, `using BBT.Workflow.Definitions;`, `using System.Text.Json;`, `using System.Linq;` |
| (top-level) | `ScriptBase`, `IMapping`, `IConditionMapping`, `ScriptContext`, `ScriptResponse`, `WorkflowTask`, `HttpTask` |

**Snippet Template'ler:**

| Snippet | Aciklama |
|---------|----------|
| `IMapping Class` | Tam IMapping sinifi (InputHandler + OutputHandler) |
| `IConditionMapping Class` | Tam IConditionMapping sinifi (Handler) |
| `InputHandler` | InputHandler method template |
| `OutputHandler` | OutputHandler method template |
| `Handler (condition)` | Condition handler method template |

**ScriptBase Methods:**

| Method | Aciklama |
|--------|----------|
| `GetSecret(storeName, secretName, key)` | Dapr secret store'dan secret al |
| `Log(message)` | Log mesaji yaz |
| `LogError(message, exception?)` | Hata logu yaz |

**Hover Documentation:**

CSX dosyasinda bir keyword uzerine gelince Markdown formatinda detayli aciklama gosterir:
- `ScriptBase` -> Class aciklama + method listesi
- `IMapping` -> Interface aciklama + method imzalari
- `ScriptContext` -> Tum property'lerin listesi
- `context.Instance` -> Instance property'leri
- `context.Body` -> Body property'leri
- `GetSecret` -> Parametre aciklamalari + ornek kod
- `InputHandler` / `OutputHandler` / `Handler` -> Method dokumantasyonu

---

## Kurulum

### Flow Studio Extension Kurulumu

1. VSIX'i olustur:
   ```bash
   cd vnext-flow-studio
   npm install
   npm run build
   npm run package
   ```

2. VS Code'da kur:
   - `Ctrl+Shift+P` -> "Extensions: Install from VSIX..."
   - `packages/extension/amorphie-flow-studio-2.6.1.vsix` sec

3. VS Code'u yeniden baslat

### vnext-template Projesi Icin

vnext-template projelerinde Flow Studio kurulu olmasa bile JSON IntelliSense calisir:

1. `@burgan-tech/vnext-schema` devDependency olarak kurul (zaten `^0.0.23`+ mevcut)
2. `.vscode/settings.json`'daki `json.schemas` ayarlari otomatik calisir

---

## Nasil Calisir

### Extension Aktivasyonu

`extension.ts:activate()` icerisinde sirasiyla:

1. **`registerJsonSchemas()`** - `schemas/` dizinindeki JSON schema dosyalarini VS Code'un `json.schemas` konfigurasyonuna kayit eder
2. **`ComponentIndex.initialize()`** - Workspace'teki tum component dosyalarini tarar ve indexler
3. **`registerJsonDefinitionProvider()`** - JSON dosyalarda Ctrl+Click navigasyonu kayit eder
4. **`registerJsonReferenceValidator()`** - Referans dogrulama + diagnostics + Quick Fix kayit eder
5. **`registerCsxCompletionProvider()`** - `.csx` dosyalarda autocomplete kayit eder
6. **`registerCsxHoverProvider()`** - `.csx` dosyalarda hover docs kayit eder

### Schema Registration Akisi

```
Extension aktif olur
  -> registerJsonSchemas() cagirilir
  -> vnext.config.json'dan path config yuklenir (varsa)
  -> Her schema tipi icin fileMatch pattern'leri olusturulur
  -> json.schemas VS Code global config'e yazilir
  -> Eski/bozuk schema kayitlari temizlenir
  -> VS Code JSON language service otomatik devreye girer
```

### ComponentIndex Akisi

```
Extension aktif olur
  -> ComponentIndex.initialize() cagirilir
  -> vnext.config.json yuklenir (path config icin)
  -> Glob pattern ile tum JSON dosyalar taranir
     (Tasks/, Schemas/, Views/, Functions/, Extensions/, Workflows/)
  -> Her dosya parse edilir: key, domain, flow, version cikarilir
  -> Map<compositeKey, IndexedComponent> olarak saklanir
  -> FileSystemWatcher kurulur:
     - Yeni dosya -> indexle
     - Degisen dosya -> guncelle
     - Silinen dosya -> indexten cikar
     - Her degisiklikte acik dokumanlari yeniden dogrula
```

---

## Build Pipeline

```bash
npm run build
```

Bu komut sirasiyla:

1. **`packages/core build`** - TypeScript derleme
2. **`packages/core extract-schemas`** - `@burgan-tech/vnext-schema`'dan 7 schema dosyasi cikarir
3. **`packages/graph-core build`** - Graph core derleme
4. **`packages/webview build`** - Vite ile webview build
5. **`packages/extension build`** - esbuild ile extension bundle + schema dosya dogrulama

### Schema Extraction Ayri Calistirma

```bash
npm run -w packages/core extract-schemas
```

Cikti:
```
📦 Extracting JSON Schemas from @burgan-tech/vnext-schema...
Found 8 schema types: core, workflow, task, view, function, extension, schema, header
  ✅ workflow-definition.schema.json (42.3 KB, 9 properties, 6 required)
  ✅ task-definition.schema.json (27.7 KB, 9 properties, 7 required)
  ✅ schema-definition.schema.json (7.1 KB, 9 properties, 7 required)
  ✅ view-definition.schema.json (14.4 KB, 9 properties, 7 required)
  ✅ function-definition.schema.json (6.4 KB, 9 properties, 7 required)
  ✅ extension-definition.schema.json (7.5 KB, 9 properties, 7 required)
  ✅ core-schema.schema.json (core/base schema)
📊 Extracted 7 schema(s) to packages/extension/schemas/
```

---

## Dosya Yapisi

### Yeni Dosyalar

```
packages/
├── core/
│   ├── scripts/
│   │   └── extract-schemas.js          # Schema extraction script
│   └── package.json                     # +@burgan-tech/vnext-schema devDep
│
├── extension/
│   ├── schemas/                         # Extracted JSON schemas (7 dosya)
│   │   ├── workflow-definition.schema.json
│   │   ├── task-definition.schema.json
│   │   ├── schema-definition.schema.json
│   │   ├── view-definition.schema.json
│   │   ├── function-definition.schema.json
│   │   ├── extension-definition.schema.json
│   │   └── core-schema.schema.json
│   │
│   ├── src/
│   │   ├── intellisense/               # YENİ - Tum IntelliSense modulleri
│   │   │   ├── ComponentIndex.ts        # Workspace indexer (FileWatcher)
│   │   │   ├── JsonDefinitionProvider.ts # Go-to-Definition (Ctrl+Click)
│   │   │   ├── JsonReferenceValidator.ts # Cross-file referans dogrulama
│   │   │   ├── CsxCompletionProvider.ts  # CSX autocomplete
│   │   │   └── CsxHoverProvider.ts       # CSX hover docs
│   │   │
│   │   └── extension.ts                 # +IntelliSense provider registrations
│   │
│   └── esbuild.config.mjs              # Schema dosya dogrulama (verify)
│
└── package.json                         # Build pipeline'a extract-schemas eklendi
```

### Degistirilen Dosyalar

| Dosya | Degisiklik |
|-------|-----------|
| `packages/core/package.json` | `@burgan-tech/vnext-schema` devDep + `extract-schemas` script |
| `packages/extension/esbuild.config.mjs` | Eski submodule copy -> schema verify |
| `packages/extension/src/extension.ts` | 5 yeni import + IntelliSense provider registrations |
| `package.json` (root) | Build pipeline'a `extract-schemas` step eklendi |

### vnext-template Degisiklikleri

| Dosya | Degisiklik |
|-------|-----------|
| `.vscode/settings.json` | `json.schemas` array eklendi (6 schema mapping) |
| `.vscode/extensions.json` | **YENİ** - Amorphie Flow Studio onerisi |

---

## Test Rehberi

### 1. JSON IntelliSense Testi

**On Kosul:** VSIX kurulu, vnext-template projesi acik

#### 1.1 Autocomplete
1. `Workflows/` altinda bir `.json` dosyasi ac (orn. `otp-sms.json`)
2. Dosya iceriginde bos bir satira git
3. `Ctrl+Space` bas
4. **Beklenen:** `key`, `domain`, `version`, `flow`, `flowVersion`, `tags`, `attributes` vb. alan onerileri gorunmeli

#### 1.2 Validation - Yanlis Alan
1. Workflow JSON dosyasinda root seviyesine su satiri ekle:
   ```json
   "yanlisAlan": "test"
   ```
2. **Beklenen:** Kirmizi squiggle + "must NOT have additional property" hatasi

#### 1.3 Validation - Zorunlu Alan Eksik
1. Workflow JSON dosyasindan `"key"` satirini sil
2. **Beklenen:** Kirmizi squiggle + "must have required property 'key'" hatasi

#### 1.4 Enum Onerileri
1. Workflow JSON'da `attributes.states` icinde bir state'in `type` alanina git
2. `Ctrl+Space` bas
3. **Beklenen:** Gecerli state type degerleri onerilmeli

#### 1.5 Hover Documentation
1. JSON dosyasinda `"key"` alaninin uzerine gel
2. **Beklenen:** "Schema key identifier" aciklamasi gorunmeli

#### 1.6 Farkli Component Tipleri
Her dizin icin ayri test yap:
- `Tasks/` altinda bir JSON ac -> task schema dogrulamasi
- `Schemas/` altinda bir JSON ac -> schema schema dogrulamasi
- `Views/` altinda bir JSON ac -> view schema dogrulamasi
- `Functions/` altinda bir JSON ac -> function schema dogrulamasi
- `Extensions/` altinda bir JSON ac -> extension schema dogrulamasi

### 2. Cross-File Referans Testi

#### 2.1 Gecerli Referans
1. Workflow JSON'da bir `task` referansi bul:
   ```json
   "task": {
     "key": "validate-otp-content",
     "domain": "messaging",
     "flow": "sys-tasks",
     "version": "1.0.0"
   }
   ```
2. `Tasks/validate-otp-content.json` dosyasinin var oldugunu dogrula
3. **Beklenen:** Hicbir uyari yok

#### 2.2 Kirik Referans
1. Workflow JSON'da bir task referansinin `key` degerini degistir:
   ```json
   "task": {
     "key": "olmayan-task-key",
     ...
   }
   ```
2. Dosyayi kaydet
3. **Beklenen:** Warning diagnostics: `task not found: "olmayan-task-key"`

#### 2.3 Quick Fix
1. Kirik referanstaki uyarinin uzerine git
2. `Ctrl+.` bas (Quick Fix)
3. **Beklenen:** "Create missing task component" code action gosterilmeli

### 3. Go-to-Definition Testi

#### 3.1 Task Referansi
1. Workflow JSON'da bir `task.key` degeri uzerinde `Ctrl+Click`
2. **Beklenen:** Ilgili task JSON dosyasi yeni tab'da acilmali

#### 3.2 Schema Referansi
1. Bir transition'in `schema.key` degeri uzerinde `Ctrl+Click`
2. **Beklenen:** Ilgili schema JSON dosyasi acilmali

#### 3.3 View Referansi
1. Bir state'in `view.view.key` degeri uzerinde `Ctrl+Click`
2. **Beklenen:** Ilgili view JSON dosyasi acilmali

#### 3.4 Process Referansi
1. Bir state'in `subFlow.process.key` degeri uzerinde `Ctrl+Click`
2. **Beklenen:** Ilgili workflow JSON dosyasi acilmali

#### 3.5 F12 ile
1. Referans uzerinde `F12` (Go to Definition)
2. **Beklenen:** Ayni sonuc, hedef dosya acilmali

### 4. CSX IntelliSense Testi

**On Kosul:** Bir `.csx` dosyasi acik (veya Flow Studio'da "Edit in VS Code" ile)

#### 4.1 Context Autocomplete
1. `.csx` dosyasinda `context.` yaz
2. **Beklenen:** `Instance`, `Body`, `Headers`, `RouteValues`, `Workflow`, `Transition`, `CurrentState`, `QueryString` onerileri

#### 4.2 Instance Autocomplete
1. `context.Instance.` yaz
2. **Beklenen:** `Id`, `Key`, `Flow`, `CurrentState`, `Status`, `Data`, `Domain`, `UserId`, `CorrelationId`, `CreatedAt`, `ModifiedAt` onerileri

#### 4.3 Body Autocomplete
1. `context.Body.` yaz
2. **Beklenen:** `StatusCode`, `Data`, `ErrorMessage`, `IsSuccess`, `TaskType`, `ExecutionDurationMs`, `Headers`, `Metadata` onerileri

#### 4.4 Response Autocomplete
1. `response.` yaz
2. **Beklenen:** `Data`, `Headers`, `StatusCode` onerileri

#### 4.5 Using Statements
1. `using ` yaz (boslukla)
2. **Beklenen:** `using BBT.Workflow.Scripting;`, `using BBT.Workflow.Definitions;` vb.

#### 4.6 Class Templates
1. Bos bir `.csx` dosyasinda `IMapping` yaz
2. Onerilerden "IMapping Class" sec
3. **Beklenen:** Tam sinif template'i insert edilmeli (InputHandler + OutputHandler ile)

#### 4.7 Method Snippets
1. `InputHandler` yaz, snippet sec
2. **Beklenen:** Tam method template'i insert edilmeli

#### 4.8 Hover - ScriptBase
1. `ScriptBase` kelimesinin uzerine gel
2. **Beklenen:** Markdown aciklama: "Base class for scripts..." + method listesi

#### 4.9 Hover - context.Instance
1. `context.Instance` uzerine gel
2. **Beklenen:** Instance property listesi gosterilmeli

#### 4.10 Hover - GetSecret
1. `GetSecret` uzerine gel
2. **Beklenen:** Parametre aciklamalari + ornek kod gosterilmeli

### 5. Regression Testleri

Bu testler mevcut ozelliklerin bozulmadigini dogrular:

#### 5.1 Canvas Normal Calisiyor
1. Bir `.flow.json` dosyasini sag tikla -> "Amorphie: Open Workflow"
2. **Beklenen:** Canvas acilmali, state'ler ve transition'lar gorunmeli

#### 5.2 Linter Diagnostics
1. Canvas'ta bir workflow ac
2. Problems panelini ac (`Ctrl+Shift+M`)
3. **Beklenen:** Mevcut E_*/W_* lint uyarilari gorunmeli (degismemis olmali)

#### 5.3 Test Panel
1. Canvas toolbar'dan Test Panel ac
2. **Beklenen:** Test paneli normal calismali

#### 5.4 Instance Monitor
1. Canvas toolbar'dan Instance Monitor butonuna bas
2. **Beklenen:** Instance Monitor paneli acilmali

#### 5.5 Mapper Editor
1. Bir `.mapper.json` dosyasini ac
2. **Beklenen:** Mapper editor normal calismali

---

## Sorun Giderme

### Schema dosyalari VSIX'te yok

```bash
# Schema'lari yeniden cikar
npm run -w packages/core extract-schemas

# VSIX'i yeniden paketle
npm run package

# Dogrula
unzip -l packages/extension/amorphie-flow-studio-*.vsix | grep schema
```

### JSON IntelliSense calismiyor

1. VS Code Output panelini ac -> "Amorphie Flow Studio" sec
2. `[Schema Registration]` loglarini kontrol et
3. Eger "Schema URI" loglari gorunmuyorsa:
   ```
   Ctrl+Shift+P -> "Amorphie: Show Schema Registrations"
   ```
4. Schema dosyalarinin `~/.vscode/extensions/` altinda oldugundan emin ol

### ComponentIndex bos gorunuyor

1. Output panelinde `[ComponentIndex]` loglarini kontrol et
2. Workspace'te `vnext.config.json` veya component dizinleri (Tasks/, Schemas/ vb.) oldugundan emin ol
3. Extension'i yeniden yukle: `Ctrl+Shift+P` -> "Developer: Reload Window"

### CSX dosyalarinda oneri gelmiyor

1. Dosyanin `.csx` uzantili oldugundan emin ol
2. `Ctrl+Space` ile manual tetikle
3. VS Code'un dosya dilini kontrol et (sag alt kosenin "C#" gosterdiginden emin ol)
4. Eger "Plain Text" gosteriyorsa: `Ctrl+K M` -> "C#" sec

### Cross-file referans uyarilari gelmiyor

1. Dosyanin bir workflow dosyasi oldugundan emin ol (`.flow.json`, Workflows/ altinda vb.)
2. Dosyayi kaydet (save tetikler)
3. ComponentIndex'in initialize oldugunu dogrula (Output panelinde "ComponentIndex ready" logu)

---

## vnext-template Destegi

vnext-template projeleri Flow Studio kurulu **olmasa bile** temel JSON IntelliSense alir.

### Nasil Calisir

`.vscode/settings.json` dosyasindaki `json.schemas` ayari VS Code'un yerlesik JSON language service'ini kullanir:

```json
{
  "json.schemas": [
    {
      "fileMatch": ["**/Workflows/**/*.json", "**/*.flow.json"],
      "url": "./node_modules/@burgan-tech/vnext-schema/schemas/workflow-definition.schema.json"
    },
    {
      "fileMatch": ["**/Tasks/**/*.json"],
      "url": "./node_modules/@burgan-tech/vnext-schema/schemas/task-definition.schema.json"
    }
    // ... diger 4 tip
  ]
}
```

**On Kosul:** `@burgan-tech/vnext-schema` paketinin `devDependencies`'de olmasi (`npm install` yapilmis olmasi)

### Flow Studio Farki

| Ozellik | vnext-template (settings.json) | Flow Studio Extension |
|---------|-------------------------------|----------------------|
| JSON Autocomplete | ✅ | ✅ |
| JSON Validation | ✅ | ✅ |
| JSON Hover | ✅ | ✅ |
| Cross-File Referans | ❌ | ✅ |
| Go-to-Definition | ❌ | ✅ |
| CSX IntelliSense | ❌ | ✅ |
| Quick Fix | ❌ | ✅ |

### Onerilen Extension

`.vscode/extensions.json`:
```json
{
  "recommendations": [
    "amorphie.amorphie-flow-studio"
  ]
}
```

Bu dosya VS Code'da projeyi acinca "Recommended Extensions" bildirimi gosterir.

---

## Gelistirici Notlari

### Yeni Schema Versiyonu Geldiginde

`@burgan-tech/vnext-schema` paketinin yeni versiyonu cikarsa:

1. `packages/core/package.json`'da versiyon guncelle:
   ```json
   "@burgan-tech/vnext-schema": "^0.0.40"
   ```
2. `npm install`
3. `npm run -w packages/core extract-schemas`
4. Schema dosyalarini git'e commit et
5. VSIX'i yeniden paketle

### Yeni Component Tipi Eklendiginde

Eger vnext'e yeni bir component tipi eklenirse (orn. "Policy"):

1. `extract-schemas.js`'deki `componentTypes` array'ine ekle
2. `extension.ts:registerJsonSchemas()`'deki `schemaDefinitions`'a yeni entry ekle
3. `ComponentIndex.ts`'deki `DIR_TO_TYPE` ve `TYPE_TO_FLOW` map'lerine ekle
4. `JsonReferenceValidator.ts`'e yeni referans pattern ekle
5. vnext-template `.vscode/settings.json`'a yeni schema mapping ekle

### CSX IntelliSense Genisletme

Yeni BBT Workflow API'lari eklenmek istenirse:

1. `CsxCompletionProvider.ts`'deki ilgili array'e yeni suggestion ekle
2. `CsxHoverProvider.ts`'deki `HOVER_DOCS` array'ine yeni hover entry ekle
3. Webview'daki `bbt-workflow-intellisense.ts`'yi de guncelle (Monaco editor icin)

### Performans Notlari

- **ComponentIndex**: Workspace tamamini ilk seferde tarar (~100-500ms), sonra incremental
- **JsonReferenceValidator**: Dosya save'de tetiklenir, sadece acik workflow dosyalarini dogrular
- **Schema dosyalari**: Extension icerisinde statik olarak paketlenir, runtime'da indirilmez
- **FileSystemWatcher**: Sadece `{Tasks,Schemas,Views,Functions,Extensions,Workflows}/**/*.json` pattern'ini izler

### Debug

Extension loglarini gormek icin:
```
Ctrl+Shift+P -> "Developer: Toggle Developer Tools"
Console tab'ina gec
```

Aranacak log prefix'leri:
- `[Schema Registration]` - JSON schema kayit islemleri
- `[ComponentIndex]` - Component indexleme
- `[Extension]` - Genel extension loglar

---

## Versiyonlama

| Paket | Versiyon | Not |
|-------|---------|-----|
| amorphie-flow-studio | 2.6.1 | IntelliSense dahil |
| @burgan-tech/vnext-schema | ^0.0.35 | Schema kaynagi |
| @amorphie-flow-studio/core | 0.1.0 | extract-schemas script |
