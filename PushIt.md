# __Spezifikation PushIt App__

Bei der App geht es darum ein Backend und Frontend für Pushnachrichten auf allen gängigen Devices zur Verfügung zu stellen. Das bedeutet ein Ereignis tritt ein und je nach Ereignis, wird eine entsprechende Nachricht auf bestimmte ausgewählte Devices gepusht. Für Standard Nachrichten sollen über Templates die Devices vorausgewählt werden können.

Liste der möglichen Devices:

| Devicetyp                | Device                                                  | Technologie |
|--------------------------|---------------------------------------------------------|-------------|
| Notebook/Desktop Rechner | Notebook oder Desktoprechner mit Windows Betriebssystem |             |
| Notebook/Desktop Rechner | Notebook oder Desktoprechner mit MacOS Betriebsystem    |             |
| Notebook/Desktop Rechner | Notebook oder Desktoprechner mitn Linux Betriebsystem   |             |
| Fernseher                | Samsung Fernseher                                       |             |
| Smartphone               | Smartphone mit IOS                                      |             |
| Smartphone               | Smartphone mit Android                                  |             |
| Streaming-Box            | Amazone Fire TV Cube                                    |             |
|                          |                                                         |             |

Anforderungen:

| Als…      | möchte ich…                                                     | so dass…                                                                                                                                        |
|-----------|-----------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------|
| Anwender  | möchte ich im PushIT Client eine Meldung eingeben               | diese auf ausgewählten Devices als Push Nachricht erscheint                                                                                     |
| Anwender  | möchte ich einer Push Nachricht eine Dauer mitgeben             | so dass sie nach ablauf der Dauer auf den Zieldevices nicht mehr angezeigt wird                                                                 |
| Anwender  | möchte ich einer Push Nachricht auch Bilder mitschicken können  | diese auch auf dem Zieldevice angezeigt wird, sofern es dies unterstützt                                                                        |
| Admin     | möchte ich Zieldevices konfigurieren können                     | diese bei Pushnachrichten adressiert werden können                                                                                              |
| Admin     | möchte ich Zieldevice aktivieren und deaktivieren können        | diese zwar nicht gelöscht werden aber für einen bestimmten Zeitraum nicht angewählt werden können                                               |
| Admin     | möchte ich per API von außen eine PushNachricht triggern können | diese an die Zieldevices geschickt werden kann, als wenn sie über den Client verschickt würde.                                                  |
| Admin     | möchte ich Nachrichten Templates anlegen können                 | So das bei Neuanlage eine Push Nachricht und ausgewähltem Template die Devices welche die Nachricht bekommen sollen bereits vorausgewählt sind. |
| Admin     | möchte ich ein Gerät ohne Tastatureingabe registrieren können   | so dass TVs, Streaming-Boxen und andere Fernbedienungsgeräte bequem über ein zweites Gerät (Smartphone/PC) eingerichtet werden können.        |

---

## Technologiezuordnung je Gerät

| Devicetyp | Device | Technologie | Status |
|---|---|---|---|
| Notebook/Desktop | Windows | Web Push API (VAPID) via Browser + Service Worker | Phase 2 |
| Notebook/Desktop | macOS | Web Push API (VAPID) via Browser + Service Worker | Phase 2 |
| Notebook/Desktop | Linux | Web Push API (VAPID) via Browser + Service Worker | Phase 2 |
| Smartphone | Android | Firebase Cloud Messaging (FCM) | Phase 2 |
| Smartphone | iOS | Apple Push Notification Service (APNs) | Phase 3 |
| Streaming-Box | Amazon Fire TV Cube | Amazon Device Messaging (ADM) | Phase 4 |
| Fernseher | Samsung Fernseher | WebSocket-App (Tizen OS – kein nativer Push möglich) | Phase 4 |

---

## Device-Pairing (tastaturlose Geräte)

Geräte ohne Tastatur (Samsung TV, Fire TV Cube, Kiosk-Terminals) können API-Key und Device-ID nicht manuell eingeben. Stattdessen wird ein **PIN-basierter Pairing-Flow** verwendet.

### Ablauf

```
Gerät (TV/Fire TV)                Backend                      Browser (Admin)
       |                             |                               |
       |-- POST /api/v1/pair/init -->|                               |
       |   { deviceType }            |                               |
       |<-- { code: "A7X-29K",       |                               |
       |      expiresAt }            |                               |
       |                             |                               |
       | [zeigt Code + QR-Code]      |<-- GET /api/v1/pair/A7X-29K --|
       |                             |--> { deviceType, expiresAt } ->|
       |                             |                               |
       |                             |<-- POST /pair/A7X-29K/complete-|
       |                             |    { deviceName }             |
       |                             | [legt Device + API-Key an]    |
       |                             |                               |
       |-- GET /pair/A7X-29K/status >|                               |
       |<-- { done: true,            |                               |
       |      deviceId, apiKey }     |                               |
       | [speichert Credentials]     |                               |
```

### Endpunkte

| Method | Pfad | Auth | Beschreibung |
|--------|------|------|--------------|
| POST | `/api/v1/pair/init` | — | Gerät startet Pairing, erhält Code (TTL: 10 min) |
| GET | `/api/v1/pair/:code` | — | Browser liest Geräteinformationen für Bestätigungsseite |
| POST | `/api/v1/pair/:code/complete` | Admin-JWT | Admin bestätigt, Backend legt Device + API-Key an |
| GET | `/api/v1/pair/:code/status` | — | Gerät pollt bis `done: true`; API-Key wird einmalig zurückgegeben |

### Sicherheitsaspekte

- Code-Format: `XXX-XXX` aus ambiguitätsfreiem Zeichensatz (keine 0/O, 1/I/L)
- Entropie: 32^6 ≈ 1 Milliarde Kombinationen — bei 10 min TTL kein Brute-Force möglich
- Der `pendingApiKey` wird im Klartext in der DB zwischengespeichert und nach Abholung durch das Gerät sofort gelöscht
- Das Gerät zeigt zusätzlich zum Code auch einen QR-Code an (enthält die Pairing-URL), der mit dem Smartphone gescannt werden kann

### Implementierungshinweise

- `POST /pair/init` ist ohne Authentifizierung erreichbar (das Gerät hat noch keine Credentials)
- `GET /pair/:code/status` gibt den API-Key **genau einmal** zurück und löscht `pending_api_key` danach aus der DB
- Abgelaufene Codes (HTTP 410) werden nicht automatisch bereinigt — ein periodischer Cleanup-Job (z. B. via BullMQ) kann alte Einträge löschen

---

## Offene Punkte / Zurückgestellte Blocker

Die folgenden Punkte wurden identifiziert, aber bewusst auf spätere Phasen verschoben. Sie müssen vor Beginn der jeweiligen Phase geklärt werden.

| # | Thema | Beschreibung | Betrifft Phase |
|---|---|---|---|
| B1 | Samsung TV – Keine native Push-Unterstützung | Tizen OS besitzt keinen Push-Hintergrunddienst. Push-Nachrichten können nur empfangen werden, wenn eine eigene Tizen-App auf dem TV läuft und per WebSocket mit dem Backend verbunden ist. Echte Hintergrund-Notifications wie auf Smartphones sind technisch nicht möglich. Zu klären: Ist dieses Einschränkung akzeptabel? | Phase 4 |
| B2 | Amazon Fire TV Cube – ADM-Registrierung | Amazon Device Messaging (ADM) erfordert einen Amazon Developer Account sowie eine im Amazon Appstore registrierte App. Zu klären: Liegt ein Amazon Developer Account vor? Soll die App im Appstore veröffentlicht werden? | Phase 4 |
| B3 | iOS – Apple Developer Account | Push-Nachrichten an iOS-Geräte über APNs erfordern zwingend einen Apple Developer Account (99 USD/Jahr) sowie eine im App Store verteilte App. Zu klären: Liegt ein Apple Developer Account vor? Wie soll die iOS-App verteilt werden? | Phase 3 |
| B4 | API-Authentifizierung | **Entschieden (2026-05-15):** Statische API-Keys. Der Key wird bei Erstellung einmalig im Klartext ausgegeben und danach nur noch als Hash gespeichert. Übertragung via HTTP-Header `X-Api-Key`. Rotation und Deaktivierung über das Admin-UI. | ~~Phase 1~~ erledigt |
| B7 | Device-Pairing (tastaturlose Geräte) | **Entschieden (2026-05-16):** PIN-basierter Pairing-Flow. Gerät zeigt 7-stelligen Code (Format `XXX-XXX`) + QR-Code an. Admin bestätigt auf zweitem Gerät. Backend erzeugt Device + API-Key automatisch. Implementiert in `POST /pair/init`, `GET /pair/:code`, `POST /pair/:code/complete`, `GET /pair/:code/status`. | ~~Phase 1~~ erledigt |
| B5 | Bilder-Hosting | Noch nicht spezifiziert, ob Bilder in das Backend hochgeladen (S3-kompatibler Storage, z.B. MinIO) oder nur als externe URLs referenziert werden. | Phase 3 |
| B6 | Nachrichtenablauf (TTL) | "Nicht mehr angezeigt nach Ablauf" muss präzisiert werden: Nur keine neue Zustellung, oder aktives Löschen bereits angezeigter Notifications auf dem Gerät? Letzteres ist plattformabhängig (FCM `collapse_key`, APNs `apns-collapse-id`). | Phase 2 |
