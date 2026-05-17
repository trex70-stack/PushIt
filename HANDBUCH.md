# PushIt – Benutzerhandbuch

PushIt ist ein selbst gehostetes System zum Senden von Push-Benachrichtigungen an Browser und Desktop-Geräte (Windows, macOS, Linux).

---

## Inhaltsverzeichnis

1. [Systemübersicht](#1-systemübersicht)
2. [Anmeldung](#2-anmeldung)
3. [Geräte registrieren](#3-geräte-registrieren)
   - [3.1 Browser (Web-Push)](#31-browser-web-push)
   - [3.2 Tauri Desktop-Client](#32-tauri-desktop-client)
4. [Nachrichten senden](#4-nachrichten-senden)
5. [Templates](#5-templates)
6. [API-Keys](#6-api-keys)
7. [Geräte verwalten](#7-geräte-verwalten)
8. [Darstellung und Dark Mode](#8-darstellung-und-dark-mode)
9. [Häufige Fragen](#9-häufige-fragen)

---

## 1. Systemübersicht

PushIt besteht aus drei Komponenten:

| Komponente | Beschreibung |
|---|---|
| **Web-Oberfläche** | Administrations-Frontend im Browser (`http://[server]:5173`) |
| **Backend** | API-Server, der Benachrichtigungen verarbeitet und verschickt (`http://[server]:3000`) |
| **Tauri Desktop-Client** | Native App für Windows, macOS und Linux – empfängt Benachrichtigungen als Overlay |

Die **Web-Oberfläche** wird immer über Port **5173** aufgerufen. Der direkte Aufruf von Port 3000 zeigt nur API-Antworten, keine Benutzeroberfläche.

---

## 2. Anmeldung

1. Öffne die Web-Oberfläche im Browser: `http://[server-ip]:5173`
2. Gib E-Mail-Adresse und Passwort des Admin-Kontos ein
3. Klicke auf **Anmelden**

Nach erfolgreicher Anmeldung erscheint die Hauptansicht mit der Nachrichtenübersicht. Die Seitennavigation ist auf dem Desktop links zu sehen; auf mobilen Geräten öffnet sich das Menü über das Hamburger-Symbol oben rechts.

> **Hinweis:** Die Anmeldedaten werden als Admin im Backend konfiguriert (Umgebungsvariablen in der `.env`-Datei des Backends).

---

## 3. Geräte registrieren

Es gibt zwei Arten von Geräten, die jeweils einen eigenen Registrierungsweg haben.

### 3.1 Browser (Web-Push)

Browser auf Windows, macOS und Linux empfangen Benachrichtigungen über die Web-Push-API. Die Registrierung läuft vollständig im Browser – kein zusätzliches Programm nötig.

**Schritt 1 – Registrierungslink kopieren**

1. Melde dich in der Web-Oberfläche an
2. Navigiere zu **Geräte**
3. Klicke oben rechts auf **Registrierungslink kopieren**
4. Der Link `http://[server]:5173/register` ist jetzt in der Zwischenablage

**Schritt 2 – Link öffnen**

Sende den kopierten Link an den Nutzer (oder öffne ihn selbst im Zielbrowser). Der Link funktioniert auch von anderen Geräten im Netzwerk, solange der Server erreichbar ist.

**Schritt 3 – Gerät registrieren**

1. Der Nutzer öffnet den Link im Browser
2. Gibt einen Namen für das Gerät ein (z.B. „Büro-PC" oder „Küchen-Tablet")
3. Klickt auf **Aktivieren**
4. Der Browser fragt nach der Berechtigung für Benachrichtigungen → **Zulassen** klicken
5. Nach wenigen Sekunden erscheint die Bestätigung „Erfolgreich registriert!"

Das Gerät erscheint nun in der Geräteliste mit dem Status **registriert**.

> **Wichtig:** Die Berechtigung muss im Browser erlaubt werden. Wurde sie einmal verweigert, muss sie in den Browser-Einstellungen manuell zurückgesetzt werden:
> - **Chrome/Edge:** Adressleiste → Schloss-Symbol → Benachrichtigungen
> - **Firefox:** Adressleiste → Schloss-Symbol → Berechtigungen → Benachrichtigungen

---

### 3.2 Tauri Desktop-Client

Der Tauri-Client ist eine native Desktop-Anwendung für Windows, macOS und Linux. Er läuft im Hintergrund als Tray-App und zeigt Benachrichtigungen als Overlay an.

**Voraussetzung:** Der Tauri-Client muss installiert und gestartet sein.

**Schritt 1 – Client starten**

Starte die PushIt-App auf dem Zielgerät. Das App-Icon erscheint in der Taskleiste (Windows) bzw. Menüleiste (macOS).

**Schritt 2 – Pairing initiieren**

1. Klicke auf das Tray-Icon
2. Wähle **Einstellungen**
3. Trage die Backend-URL ein: `http://[server-ip]:3000`
4. Klicke auf **Verbinden / Pairing starten**
5. Der Client generiert einen Pairing-Code und zeigt einen Link an (z.B. `http://[server]:5173/pair/ABCDEF`)

**Schritt 3 – Pairing bestätigen**

1. Öffne den angezeigten Link im Browser (auf einem Gerät, auf dem du eingeloggt bist)
2. Falls noch nicht angemeldet: Melde dich mit dem Admin-Konto an – du wirst danach automatisch zur Bestätigungsseite weitergeleitet
3. Gib einen Namen für das Gerät ein (z.B. „Wohnzimmer-PC")
4. Klicke auf **Gerät bestätigen**

**Schritt 4 – Verbindung abwarten**

Der Tauri-Client erkennt die Bestätigung automatisch und verbindet sich mit dem Backend. Das Gerät erscheint in der Geräteliste als **registriert**.

> **Hinweis:** Der Pairing-Code ist 10 Minuten gültig. Falls die Zeit abläuft, muss der Vorgang am Client neu gestartet werden.

---

## 4. Nachrichten senden

**Schritt 1 – Neue Nachricht erstellen**

1. Klicke in der Navigation auf **Nachrichten**
2. Klicke oben rechts auf **Neue Nachricht** (oder das `+`-Symbol auf Mobilgeräten)

**Schritt 2 – Formular ausfüllen**

| Feld | Beschreibung |
|---|---|
| **Template** | Optional: Lädt eine gespeicherte Gerätekombination (siehe [Templates](#5-templates)) |
| **Kategorie** | Art der Meldung: Information (blau), Warnung (gelb), Notfall (rot) |
| **Titel** | Überschrift der Benachrichtigung (z.B. „Türklingel") |
| **Nachricht** | Vollständiger Text der Benachrichtigung |
| **Bild-URL** | Optional: URL zu einem Bild, das in der Benachrichtigung angezeigt wird |
| **Anzeigedauer** | Optional: Sekunden, nach denen die Benachrichtigung automatisch verschwindet (z.B. `300` = 5 Minuten) |
| **Zielgeräte** | Auswahl der Geräte, an die die Nachricht gesendet werden soll |

**Schritt 3 – Senden**

Klicke auf **Nachricht senden**. Die Nachricht wird sofort an alle ausgewählten Geräte übermittelt.

**Lieferstatus verfolgen**

In der Nachrichtenübersicht ist jede gesendete Nachricht mit dem Lieferstatus je Gerät zu sehen:

- 🟢 **Gesendet / Zugestellt** – Benachrichtigung wurde erfolgreich übermittelt
- 🔴 **Fehlgeschlagen** – Übermittlung ist gescheitert (Gerät offline oder Push-Subscription abgelaufen)
- ⏳ **Ausstehend** – Wird noch verarbeitet
- ⌛ **Abgelaufen** – TTL überschritten, bevor das Gerät erreichbar war

---

## 5. Templates

Templates speichern eine Kombination von Zielgeräten, um häufig verwendete Gerätgruppen schnell auswählen zu können.

> **Hinweis:** Templates werden aktuell über die API oder direkt in der Datenbank angelegt. Eine Verwaltungsoberfläche für das Erstellen von Templates ist in der **Templates**-Seite vorhanden – dort können bestehende Templates eingesehen und gelöscht werden.

**Template beim Senden verwenden**

1. Öffne **Neue Nachricht**
2. Wähle im Dropdown **Template wählen** das gewünschte Template aus
3. Die zugehörigen Geräte werden automatisch ausgewählt
4. Felder können anschließend noch angepasst werden

---

## 6. API-Keys

API-Keys ermöglichen externen Diensten (z.B. Home Assistant, Skripten oder Automatisierungen), Benachrichtigungen über die PushIt-API zu senden – ohne Admin-Login.

**Neuen Key erstellen**

1. Navigiere zu **API-Keys**
2. Gib eine Bezeichnung ein (z.B. „Home Assistant" oder „Überwachungsskript")
3. Klicke auf **Erstellen**
4. Der generierte Key wird **einmalig** angezeigt – jetzt kopieren und sicher aufbewahren!

> **Wichtig:** Der Key ist nach dem Schließen des Dialogs nicht mehr abrufbar. Bei Verlust muss ein neuer Key erstellt werden.

**Key verwenden**

Sende den Header `X-Api-Key: [dein-key]` mit jeder API-Anfrage:

```bash
curl -X POST http://[server]:3000/api/v1/notifications \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: pk_dein-key-hier" \
  -d '{
    "title": "Türklingel",
    "body": "Jemand klingelt an der Haustür.",
    "category": "info",
    "deviceIds": ["uuid-des-geräts"]
  }'
```

**Kategorien:** `info`, `warning`, `emergency`

**Key löschen / widerrufen**

Klicke in der Zeile des Keys auf das Papierkorb-Symbol. Der Key wird sofort ungültig.

---

## 7. Geräte verwalten

Die Geräteübersicht zeigt alle registrierten Geräte mit ihrem aktuellen Status.

**Gerät aktivieren / deaktivieren**

Klicke auf den **Aktiv**- bzw. **Inaktiv**-Button in der Gerätezeile. Deaktivierte Geräte empfangen keine Benachrichtigungen, bleiben aber in der Liste erhalten.

**Gerät löschen**

Klicke auf das Papierkorb-Symbol am Ende der Zeile und bestätige die Sicherheitsabfrage.

**Mehrere Geräte gleichzeitig löschen**

1. Aktiviere die Checkboxen der zu löschenden Geräte (oder „Alle auswählen" oben)
2. Die rote Aktionsleiste erscheint oben
3. Klicke auf **[Anzahl] löschen** und bestätige mit **Ja, löschen**

**UUID eines Tauri-Geräts kopieren**

Für Tauri-Geräte wird ein **UUID kopieren**-Button angezeigt. Diese UUID identifiziert das Gerät und wird intern für die Verbindung verwendet.

**Registrierungslink teilen**

Der Button **Registrierungslink kopieren** oben rechts kopiert die URL `http://[server]:5173/register` in die Zwischenablage. Dieser Link kann an beliebige Nutzer weitergegeben werden, die einen Browser als Empfänger registrieren möchten.

---

## 8. Darstellung und Dark Mode

Die Oberfläche passt sich automatisch dem System-Farbschema an. Das kann manuell überschrieben werden:

**Desktop:** Die drei Buttons oben in der Seitenleiste wechseln zwischen:
- ☀️ **Hell** – Helles Design
- 🌙 **Dunkel** – Dunkles Design
- ⚙️ **System** – Folgt der Betriebssystem-Einstellung

**Mobil:** Die gleichen Buttons befinden sich oben rechts im Header.

Die Einstellung wird im Browser gespeichert und bleibt nach dem Neuladen erhalten.

---

## 10. Häufige Fragen

**Die App öffnet sich, aber keine Daten laden.**
→ Stelle sicher, dass du die Adresse mit Port **5173** verwendest (z.B. `http://192.168.1.100:5173`). Port 3000 ist nur das Backend und zeigt keine Benutzeroberfläche.

**Browser-Push-Benachrichtigungen kommen nicht an.**
→ Prüfe folgende Punkte:
- Wurde die Berechtigung im Browser erteilt? (Adressleiste → Schloss-Symbol)
- macOS: Systemeinstellungen → Mitteilungen → Browser (Chrome/Safari/Firefox) → Benachrichtigungen erlauben
- Windows: Einstellungen → System → Benachrichtigungen → Browser aktiviert?
- Ist das Gerät in der Geräteliste als **Aktiv** markiert?

**Der Tauri-Client findet den Server nicht.**
→ Prüfe die eingetragene Backend-URL in den Einstellungen. Sie muss auf Port **3000** zeigen (z.B. `http://192.168.1.100:3000`), nicht auf 5173.

**Pairing-Code ist abgelaufen.**
→ Der Code ist 10 Minuten gültig. Starte das Pairing am Tauri-Client neu und bestätige den neuen Code zügig.

**API-Key wurde nicht gespeichert und ist nicht mehr sichtbar.**
→ Der Key kann nicht erneut abgerufen werden. Lösche den alten Key und erstelle einen neuen.

**Nachrichten werden als „Fehlgeschlagen" angezeigt.**
→ Das Gerät war zum Sendezeitpunkt offline oder die Push-Subscription ist abgelaufen. Browser-Geräte müssen sich ggf. neu registrieren (Registrierungslink erneut öffnen).

---

*Letzte Aktualisierung: Mai 2026*
