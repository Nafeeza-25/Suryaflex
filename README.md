# SuryaFlex

> The grid is dynamic. Why should rooftop solar have a static connection?

SuryaFlex is a grid-aware rooftop-solar export management prototype. It uses converged Pandapower AC power flows to compare fixed static export with household-level export limits that respect feeder voltage and loading constraints.

## Validated prototype

- 100 modeled rooftop-solar households mapped onto six residential buses.
- CIGRE low-voltage residential feeder, solved with Pandapower 3.5.5.
- FastAPI backend and React/Vite interactive simulation.
- Live Simulation requires `PANDAPOWER_AC`; a failed or invalid solve is shown as ENGINE OFFLINE, with no mock substitution.

### Scenario A — Available headroom

At 13:00, 80% PV penetration, 8% cloud cover, and 1.0× demand:

| Mode | Export | Curtailment | Maximum voltage | Violations |
|---|---:|---:|---:|---:|
| Static | 79.092 kW | 291.752 kW | 1.002689 pu | 0 |
| SuryaFlex | 250.915 kW | 119.929 kW | 1.049996 pu | 0 |

SuryaFlex enables 217.242% more export and reduces curtailment by 58.893% in this modeled case. Its maximum voltage is within the configured limit, near the upper bound.

### Scenario B — High-PV stress

At 13:00, 100% PV penetration, clear sky, and 0.6× demand:

| Mode | Export | Maximum voltage | Violations |
|---|---:|---:|---:|
| Static / unmanaged baseline | 577.986 kW | 1.150061 pu | 13 |
| SuryaFlex | 187.270 kW | 1.049999 pu | 0 |

The Static baseline permits all available PV surplus; SuryaFlex curtails export to remain within the configured limits.

## Run locally

Use Python 3.12 and Node.js. In one terminal, start the backend:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

For backend tests, install `requirements-dev.txt` instead of `requirements.txt`, then run `python -m pytest -q`.

In a second terminal, start the frontend:

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

### Start both with one command (Git Bash)

After completing the one-time dependency setup above, open Git Bash in the project root and run:

```bash
bash ./dev.sh
```

This starts the backend at `http://127.0.0.1:8000` and the frontend at `http://localhost:5173`. Keep the terminal open while using the app; press **Ctrl+C** to stop the services.

The local API URL defaults to `http://localhost:8000`; set `VITE_API_BASE_URL` to override it. The health endpoint is `GET /api/health`; `POST /api/compare` returns Static and SuryaFlex AC results for the supplied simulation state.

## Reproduce the scenarios

Open **Scenario Controls**, choose **SCENARIO A — HEADROOM** or **SCENARIO B — STRESS**, then return to **Simulation**. The preset applies the competition settings. Use the Static and SuryaFlex controls to compare the independently solved AC results.

Detailed validation, assumptions, raw AC tables, and the final benchmark JSON files are in `backend/VALIDATION.md` and `backend/final_scenario_*.json`.

## Deployment

- **Backend:** `render.yaml` defines a Render Python web service rooted at `backend`, with a `/api/health` health check. Render's CORS configuration permits local development and Vercel app origins.
- **Frontend:** Import this GitHub repository into Vercel with the Vite preset. Set the `VITE_API_BASE_URL` environment variable to the deployed Render service origin (for example, `https://suryaflex-api.onrender.com`) for Production, Preview, and Development as needed, then redeploy.

The 24-hour replay is an illustrative profile; it is separately labeled and is not the live AC comparison.

## Limitations

The network is modeled as a balanced single-phase equivalent. Phase unbalance and temperature-dependent line ratings are not represented. At 22:00, the converged no-PV, 1.0× demand case reached 0.948 pu minimum voltage, below the configured 0.950 pu lower limit; the UI reports a voltage violation. See `backend/VALIDATION.md` for details.
