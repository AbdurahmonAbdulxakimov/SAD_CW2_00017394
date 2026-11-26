# FlockBook (high-fidelity prototype)

SAD Coursework 2, student 00017394.
A phone app for Nurota Halol Parranda farm (the case from Coursework 1).

## How to run

Open `index.html` in Chrome, Edge or Safari. Nothing needs to be installed, and it works offline.

Log in with one of these users:

| User | Role | PIN |
|---|---|---|
| Director | sees everything | 1234 |
| Jasur | worker | 1111 |
| Bekzod | worker | 2222 |
| Dilshod | worker | 3333 |

Data is saved in the browser. **Reset demo data** at the bottom of the Home tab brings back the demo data.

## Pages

- **Worker:** one page to record dead chicks and feed deliveries.
- **Director:** five tabs. Home (things to check, and each house with temperature, humidity, lights and profit), Slaughter (sessions and their history), + Sale (quick sale form), Costs and Analytics (the report: all batches, details and the sales history).

## Code

- `js/domain`: classes for farm, houses, batches, deliveries, deaths, slaughter, sales and costs.
- `js/services`: sensors and lights (simulated), saving data and login.
- `js/ui`: the pages.
- `css/app.css`: styles.

The sensors and lights are simulated because the farm does not have the hardware yet.
Voice entry and the density estimate are in the class design but not in this prototype.
Built with help from an AI coding tool (Claude), as the coursework allows.
