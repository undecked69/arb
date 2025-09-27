import React, { useEffect, useState } from 'react'

// React frontend for Arbitrage Monitor with backend integration.

export default function ArbMonitor() {
  const [oddsData, setOddsData] = useState([])
  const [arbs, setArbs] = useState([])
  const [loading, setLoading] = useState(false)
  const [stake, setStake] = useState(100)

  async function loadOdds() {
    setLoading(true)
    try {
      const res = await fetch('/api/odds')
      const json = await res.json()
      setOddsData(json)
    } catch (e) {
      console.error('Failed to load odds', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadOdds()
    const interval = setInterval(loadOdds, 60000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const found = []
    for (const event of oddsData) {
      for (const market of event.markets || []) {
        const outcomes = market.outcomes || []
        if (outcomes.length === 2) {
          const a = outcomes[0].price
          const b = outcomes[1].price
          if (a > 0 && b > 0) {
            const arbIndex = (1 / a) + (1 / b)
            if (arbIndex < 1) {
              const profitPct = (1 / arbIndex - 1) * 100
              const stakeA = (stake * (1 / a)) / arbIndex
              const stakeB = (stake * (1 / b)) / arbIndex
              found.push({ event: event.name, market: market.name, type: '2-way', profitPct, odds: [a, b], stakes: [stakeA, stakeB] })
            }
          }
        } else if (outcomes.length === 3) {
          const [x, y, z] = outcomes.map(o => o.price)
          if (x > 0 && y > 0 && z > 0) {
            const arbIndex = (1 / x) + (1 / y) + (1 / z)
            if (arbIndex < 1) {
              const profitPct = (1 / arbIndex - 1) * 100
              const stakeX = (stake * (1 / x)) / arbIndex
              const stakeY = (stake * (1 / y)) / arbIndex
              const stakeZ = (stake * (1 / z)) / arbIndex
              found.push({ event: event.name, market: market.name, type: '3-way', profitPct, odds: [x, y, z], stakes: [stakeX, stakeY, stakeZ] })
            }
          }
        }
      }
    }
    found.sort((a, b) => b.profitPct - a.profitPct)
    setArbs(found)
  }, [oddsData, stake])

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">ArbMonitor</h1>
        <p className="text-sm text-gray-600">Valós odds API integrációval működő arbitrázs monitor.</p>
      </header>

      <section className="mb-4 flex items-center gap-4">
        <label className="text-sm">Össz tét (€):</label>
        <input type="number" value={stake} onChange={e => setStake(Number(e.target.value) || 0)} className="border rounded px-2 py-1 w-28" />
        <div className="ml-auto text-sm text-gray-500">Betöltés: {loading ? 'igen' : 'nem'}</div>
      </section>

      <section>
        {arbs.length === 0 ? (
          <div className="text-gray-500">Jelenleg nincs talált arbitrázs a betöltött feed alapján.</div>
        ) : (
          <div className="space-y-4">
            {arbs.map((a, i) => (
              <div key={i} className="p-4 border rounded shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold">{a.event} — {a.market}</div>
                    <div className="text-xs text-gray-600">Típus: {a.type}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold">Profit: {a.profitPct.toFixed(2)}%</div>
                    <div className="text-sm text-gray-600">Odds: {a.odds.map(o => o.toFixed(2)).join(' / ')}</div>
                  </div>
                </div>
                <div className="mt-3 text-sm">
                  Javasolt tétek: {a.stakes.map(s => `${s.toFixed(2)}€`).join(' · ')}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <footer className="mt-6 text-xs text-gray-500">
        <div>Ez egy prototípus rendszer. Az odds feedhez szükséges API-kulcsot neked kell beszerezned (pl. The Odds API). Az alkalmazás nem helyez el automatikusan fogadásokat.</div>
      </footer>
    </div>
  )
}

/* ========================
Backend példa (server.js)
=========================
const express = require('express')
const fetch = require('node-fetch')
const app = express()
const PORT = process.env.PORT || 5000
const API_KEY = process.env.ODDS_API_KEY

app.get('/api/odds', async (req, res) => {
  try {
    const sport = 'soccer_epl'
    const url = `https://api.the-odds-api.com/v4/sports/${sport}/odds/?regions=eu&markets=h2h&apiKey=${API_KEY}`
    const r = await fetch(url)
    const data = await r.json()
    const events = data.map(ev => ({
      name: ev.home_team + ' vs ' + ev.away_team,
      markets: ev.bookmakers.map(bm => ({
        name: 'Match Winner',
        outcomes: bm.markets[0].outcomes.map(o => ({ name: o.name, price: o.price }))
      }))
    }))
    res.json(events)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch odds' })
  }
})

app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
*/

/* ========================
Dockerfile (frontend + backend)
=========================
# Stage 1: build React app
FROM node:18 AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: run backend + serve frontend
FROM node:18
WORKDIR /app
COPY --from=build /app/build ./build
COPY server.js ./server.js
COPY package*.json ./
RUN npm install --only=production
ENV PORT=5000
CMD ["node", "server.js"]
*/

/* ========================
docker-compose.yml
=========================
version: '3'
services:
  arbmonitor:
    build: .
    ports:
      - "5000:5000"
    environment:
      - ODDS_API_KEY=your_api_key_here
*/
