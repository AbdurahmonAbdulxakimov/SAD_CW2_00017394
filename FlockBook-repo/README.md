# FlockBook

Prototype for **Nurota Halol Parranda MCHJ**, a two-house broiler farm in Nurata.
Systems Analysis and Design (6BUIS026C), Coursework 2. Student ID 00017394.

FlockBook puts the farm's records in one place: deaths, feed, slaughter head counts, bazaar sales and costs, all tied to a batch, so the director can see the profit of each batch. The requirements (FR-01 to FR-09, NFR-01 to NFR-05) come from Coursework 1.

## What is in this repository

| Folder | Contents |
| --- | --- |
| `FlockBook/` | High-fidelity prototype: a mobile-first web app (HTML, CSS, JavaScript) |
| `low-fidelity-prototype/` | Low-fidelity prototype in draw.io (13 linked pages) and PNG previews of each screen |
| `uml-diagrams/` | Architecture diagram and four class diagrams (PNG and SVG) |
| `screencast/` | `FlockBook_screencast_00017394.mp4`: 44-second screencast for the submission. `FlockBook_page_tour_00017394.mp4`: 51-second tour of every page |

## Run the app

Open `FlockBook/index.html` in a browser. Nothing needs to be installed. On a computer, narrow the window or use the browser's phone view, because the app is made for phones.

Demo PINs: Director `1234`, workers Jasur `1111`, Bekzod `2222`, Dilshod `3333`.
"Reset demo data" at the bottom of the director's Home page restores the demo data.

Sensor readings and the light switch are simulated. Data is saved in the browser only.

## Open the low-fidelity prototype

Open `low-fidelity-prototype/FlockBook_LowFi_Prototype.drawio` at [app.diagrams.net](https://app.diagrams.net) (File > Open from > Device) or in the draw.io desktop app. Start on the page "0 Overview" and click a box to open a screen. Buttons and tabs on each screen link to the next screen.

## Requirements covered by the prototype

| Requirement | Where |
| --- | --- |
| FR-01 Worker records deaths, duplicates flagged | Worker page, Home |
| FR-02 Feed recorded per batch | Worker page, Costs |
| FR-03 Profit per batch | Home, Analytics |
| FR-04 Slaughter head count with corrections | Slaughter |
| FR-05 Bazaar agent total checked against our tally | + Sale, Analytics |
| FR-07, FR-08 Temperature, humidity and lights | Home |
| FR-06 Voice entry, FR-09 Density estimate | In the class design only, planned for later releases |
