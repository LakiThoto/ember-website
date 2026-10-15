# Ember website

De website van Ember, een product van AvenNex. Dit is precies de versie die live staat op https://ember-avennex.vercel.app, met alle 3D-bestanden waaruit de beelden gemaakt zijn.

## Downloaden

Klik op de groene knop **Code** en kies **Download ZIP**. Of download direct: https://github.com/LakiThoto/ember-website/archive/refs/heads/main.zip

## Bekijken op je eigen computer

De site is statisch: HTML, CSS en JavaScript, zonder build-stap.

1. Pak de ZIP uit.
2. Open een terminal in de uitgepakte map.
3. Start een lokale server met een van deze twee commando's:

```bash
python3 -m http.server 8000
```

```bash
npx serve .
```

4. Open http://localhost:8000 (of het adres dat `npx serve` noemt).

Dubbelklikken op `index.html` werkt meestal ook, maar via een lokale server gedraagt de site zich precies als online.

## Online zetten

Upload de hele map naar een statische host, zoals Vercel, Netlify of een eigen webserver. `vercel.json` bevat de instellingen die nu op Vercel gebruikt worden: nette URL's, beveiligingsheaders, een dag cache voor `assets/`, en `noindex` zodat zoekmachines de site nog niet tonen. Haal die `noindex`-regel weg als de site gevonden mag worden.

## Wat staat waar

| Map of bestand | Inhoud |
| --- | --- |
| `index.html` | De pagina |
| `styles.css` | De opmaak |
| `main.js` | Animaties, het brein, Ember in detail, formulieren |
| `brain-data.js` | De stippen van het brein |
| `zwerm.js`, `zwerm-data.js` | De stippen in de hero |
| `assets/img/` | Beelden, renders, iconen, logo's van partners |
| `assets/fonts/` | Instrument Sans, met de open licentie (OFL) erbij |
| `3d/` | De 3D-scène, de scripts en alle renders (zie hieronder) |

## Formulieren

De wachtlijst en de vraag onderaan de FAQ hebben nog geen server.

- **Wachtlijst:** zonder server meldt het formulier dat er niets is opgeslagen. Met een server stuurt het een POST naar `{data-api}/signup`.
- **Vraag in de FAQ:** zonder server opent het een e-mail aan info@avennex.eu. Met een server stuurt het een POST naar `{data-api}/question`.

Een eigen server koppel je met het attribuut `data-api` op het formulier in `index.html`.

## 3D

Alle 3D-beelden van de site komen uit Blender, gemaakt met Python-scripts. Er zijn geen .blend-bestanden: de scène wordt elke keer uit het script opgebouwd.

| Bestand of map | Inhoud |
| --- | --- |
| `3d/ember_scene.py` | De hele scène: Ember, de fiets, de doos, de magneet, de lichtring, en het licht |
| `3d/ember_scene.v35.py` tot en met `v54.py` | Eerdere versies van de scène |
| `3d/build_sheets.py` | Zet losse renders om in de spritevellen van de site (`ember-flip.webp`, `ember-turn.webp`, `ember-hero.webp`) |
| `3d/compose_box.py` | Zet de USB-C-kabel van het team (`3d/team/box-cable.webp`) in de doos |
| `3d/brain_points.py` | Maakt de stippen van het brein (`brain-data.js`) |
| `3d/out/` | Alle renders, per versie en per beeld, met de instellingen als json |
| `3d/gen/` | De situatiebeelden (bakfiets, hal, schuur, stalling, step) met hun varianten |

Renderen gaat met Blender 4.5, zonder venster:

```bash
blender -b --factory-startup -P 3d/ember_scene.py -- mode=turn out=3d/out/turn samples=96
```

De modi en opties staan bovenaan in `3d/ember_scene.py`. Op een Mac staat Blender op `/Applications/Blender.app/Contents/MacOS/Blender`.

De stippen van het brein opnieuw maken (Python 3 met numpy):

```bash
python3 3d/brain_points.py brain-data.js
```

De beelden opnieuw samenstellen gebeurt met Pillow.
