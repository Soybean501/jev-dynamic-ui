# Little Things

A natural-language command page that uses Jev to choose a small interactive tool, then renders a matching React component from a fixed catalog.

## Run it

Use Node.js 22 or later. Keep `AI_GATEWAY_API_KEY` in `.env.local` (ignored by git), then run:

```sh
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Built-in use cases

The “Explore simple things I can do” list contains more than 35 example requests covering:

- Timers, Pomodoro focus sessions, stopwatches, local clocks, city time, and date countdowns.
- Current weather by city, region, or postcode, including requests where the city and county are both named.
- Minecraft diamond recolouring, named CSS colours, and hex codes.
- Arithmetic, percentages, unit conversion, tip splitting, and BMI.
- Random numbers, coin flips, dice rolls, secure passwords, and word/character counts.

`/api/command` asks Jev to select the appropriate supported capability, then uses bounded parsing or a purpose-built service for any needed values. Weather and city-time lookups use Open-Meteo. `/api/evaluate` remains available as the lower-level Jev endpoint.

The interface components are prebuilt, while Jev chooses which one to show. A generative model can create UI dynamically, but a safer design is to have it return a constrained component description or JSON schema and render only approved components. This avoids executing arbitrary model-generated browser code.

## References

- [Vercel AI Gateway: Jev](https://vercel.com/ai-gateway/models/jev) — model ID and evaluation request shape.
- [Vercel: Jev and System One](https://vercel.com/blog/ai-gateway-jev-model-launch) — overview of Jev as a structured decision model.
- [Open-Meteo geocoding API](https://open-meteo.com/en/docs/geocoding-api) and [weather forecast API](https://open-meteo.com/en/docs) — location lookup and current conditions.
