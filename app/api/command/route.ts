import cssColorNames from 'color-name';
import { experimental_evaluate as evaluate, gateway } from 'ai';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
const intentOptions = {
  timer: 'Create a countdown timer or Pomodoro focus timer.',
  weather: 'Show current weather, forecast, or temperature for a place.',
  color: 'Open a color picker, choose a color, or show a color name or hex code. Includes Minecraft diamond colors.',
  calculator: 'Calculate a numeric expression, percentage, tip, split bill, or simple arithmetic question.',
  converter: 'Convert a quantity between units of length, mass, temperature, or volume.',
  random: 'Generate a random number within a requested range.',
  dice: 'Roll one or more dice, such as a d20 or 2d6.',
  coin: 'Flip a coin or make a random heads-or-tails choice.',
  stopwatch: 'Open a stopwatch to measure elapsed time.',
  password: 'Generate a random secure password.',
  clock: 'Show the current local time or date, or tell the time in a named city or time zone.',
  tip: 'Calculate a restaurant tip and optionally split the total between people.',
  bmi: 'Calculate body mass index from a weight in kilograms and height in centimetres.',
  text: 'Count words and characters in text supplied by the user.',
  countdown: 'Count the days until a specific date.',
  unknown: 'The request does not match one of the available mini tools.',
};
const colorNames = Object.keys(cssColorNames);

function parseDuration(text: string) {
  const normalized = text.toLowerCase();
  if (/\bpomodoro\b/.test(normalized)) return 25 * 60;
  const units = normalized.match(/(\d+(?:\.\d+)?)\s*(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h)\b/i);
  if (units) {
    const amount = Number(units[1]);
    const unit = units[2].toLowerCase();
    const scale = unit.startsWith('ms') || unit.startsWith('millisecond') ? 0.001 : unit.startsWith('h') ? 3600 : unit.startsWith('m') ? 60 : 1;
    return Math.max(1, Math.round(amount * scale));
  }
  const words: Record<string, number> = {a:1, an:1, one:1, two:2, couple:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9, ten:10, fifteen:15, twenty:20, thirty:30, sixty:60};
  const wordDuration = normalized.match(/\b(a couple(?: of)?|half|a|an|one|two|three|four|five|six|seven|eight|nine|ten|fifteen|twenty|thirty|sixty)\s+(seconds?|minutes?|hours?)\b/);
  if (wordDuration) {
    const amount = wordDuration[1] === 'half' ? 0.5 : wordDuration[1].startsWith('a couple') ? 2 : words[wordDuration[1].replace(' of', '')] ?? words[wordDuration[1].split(' ').at(-1)!];
    return Math.max(1, Math.round(amount * (wordDuration[2].startsWith('hour') ? 3600 : wordDuration[2].startsWith('minute') ? 60 : 1)));
  }
  const bare = normalized.match(/\btimer\s+(\d+)\b/);
  return bare ? Math.max(1, Number(bare[1])) : 60;
}

function calculate(text: string) {
  let expression = text.toLowerCase().replace(/[’‘]/g, "'").replace(/[×✕]/g, '*').replace(/[÷]/g, '/');
  expression = expression
    .replace(/\bwhat do you get if\b|\bwhat is the result of\b|\bwhat happens (?:when|if)\b|\bhow much is\b|\bthe answer to\b/g, ' ')
    .replace(/\bwhat(?:'s|s| is)?\b|\bcalculate\b|\bcompute\b|\bwork out\b|\bsolve\b|\bplease\b|\bcan you\b|\bcould you\b|\btell me\b|\byou\b/g, ' ')
    .replace(/\bsubtract\s+(-?\d+(?:\.\d+)?)\s+from\s+(-?\d+(?:\.\d+)?)/g, '$2-$1')
    .replace(/\b(percent(?:age)?|per cent)\s+of\b/g, '/100*')
    .replace(/\bplus\b|\badd\b|\bsum\b/g, '+').replace(/\bminus\b|\bsubtract\b/g, '-').replace(/\btimes\b|\bmultiply by\b|\bmultiplied by\b|\bmultiplied\b|\binto\b/g, '*')
    .replace(/\bdivided by\b|\bdivide by\b|\bover\b/g, '/').replace(/\b(to the power of|power of)\b/g, '**')
    .replace(/\bzero\b/g,'0').replace(/\bone\b/g,'1').replace(/\btwo\b/g,'2').replace(/\bthree\b/g,'3').replace(/\bfour\b/g,'4').replace(/\bfive\b/g,'5')
    .replace(/\bsix\b/g,'6').replace(/\bseven\b/g,'7').replace(/\beight\b/g,'8').replace(/\bnine\b/g,'9').replace(/\bten\b/g,'10')
    .replace(/\beleven\b/g,'11').replace(/\btwelve\b/g,'12').replace(/\bthirteen\b/g,'13').replace(/\bfourteen\b/g,'14').replace(/\bfifteen\b/g,'15')
    .replace(/\bsixteen\b/g,'16').replace(/\bseventeen\b/g,'17').replace(/\beighteen\b/g,'18').replace(/\bnineteen\b/g,'19').replace(/\btwenty\b/g,'20')
    .replace(/\bthirty\b/g,'30').replace(/\bforty\b/g,'40').replace(/\bfifty\b/g,'50').replace(/\bsixty\b/g,'60').replace(/\bseventy\b/g,'70').replace(/\beighty\b/g,'80').replace(/\bninety\b/g,'90')
    .replace(/\band\b/g, '+').replace(/,/g, '').replace(/=/g, '').trim();
  expression = expression.replace(/(\d+(?:\.\d+)?)\s*%\s*of\s*(\d+(?:\.\d+)?)/g, '($1/100*$2)');
  if (/%/.test(expression)) expression = expression.replace(/(\d+(?:\.\d+)?)\s*%/g, '($1/100)');
  const tokens = expression.match(/\d+(?:\.\d+)?|\*\*|[()+\-*/%]/g) ?? [];
  if (!tokens.length || tokens.join('') !== expression.replace(/\s/g, '')) throw new Error('Try a sum like “whats 2 + 2”, “add two and two”, or “15 percent of 80”.');
  let cursor = 0;
  const primary = (): number => {
    const token = tokens[cursor++];
    if (token === '(') { const value = sum(); if (tokens[cursor++] !== ')') throw new Error('Check the brackets in that calculation.'); return value; }
    if (token === '-') return -primary();
    if (token === '+') return primary();
    const value = Number(token); if (!Number.isFinite(value)) throw new Error('That calculation did not look like a number.'); return value;
  };
  const product = (): number => { let value = primary(); while (['*','/','%','**'].includes(tokens[cursor])) { const op=tokens[cursor++]; const rhs=primary(); value=op==='*'?value*rhs:op==='/'?value/rhs:op==='%'?value%rhs:value**rhs; } return value; };
  const sum = (): number => { let value = product(); while (['+','-'].includes(tokens[cursor])) { const op=tokens[cursor++]; const rhs=product(); value=op==='+'?value+rhs:value-rhs; } return value; };
  const value = sum();
  if (cursor !== tokens.length || !Number.isFinite(value)) throw new Error('That calculation is incomplete or out of range.');
  return Number(value.toFixed(8));
}

function convertUnits(text: string) {
  const match = text.toLowerCase().match(/(-?\d+(?:\.\d+)?)\s*(kilometers?|kilometres?|km|meters?|metres?|m|centimeters?|centimetres?|cm|millimeters?|millimetres?|mm|miles?|mi|feet|foot|ft|inches?|in|kilograms?|kg|grams?|g|pounds?|lbs?|ounces?|oz|liters?|litres?|l|milliliters?|millilitres?|ml|celsius|fahrenheit|°c|°f)\s+(?:to|in|as)\s+(kilometers?|kilometres?|km|meters?|metres?|m|centimeters?|centimetres?|cm|millimeters?|millimetres?|mm|miles?|mi|feet|foot|ft|inches?|in|kilograms?|kg|grams?|g|pounds?|lbs?|ounces?|oz|liters?|litres?|l|milliliters?|millilitres?|ml|celsius|fahrenheit|°c|°f)\b/);
  if (!match) throw new Error('Try a conversion like “5 km to miles” or “20 celsius to fahrenheit”.');
  const value=Number(match[1]), from=match[2], to=match[3];
  const groups: Record<string,{group:string;scale:number;offset?:number}> = {};
  const add=(names:string[],group:string,scale:number,offset=0)=>names.forEach(name=>groups[name]={group,scale,offset});
  add(['km','kilometer','kilometers','kilometre','kilometres'],'length',1000); add(['m','meter','meters','metre','metres'],'length',1); add(['cm','centimeter','centimeters','centimetre','centimetres'],'length',.01); add(['mm','millimeter','millimeters','millimetre','millimetres'],'length',.001); add(['mi','mile','miles'],'length',1609.344); add(['ft','foot','feet'],'length',.3048); add(['in','inch','inches'],'length',.0254);
  add(['kg','kilogram','kilograms'],'mass',1000); add(['g','gram','grams'],'mass',1); add(['lb','lbs','pound','pounds'],'mass',453.59237); add(['oz','ounce','ounces'],'mass',28.3495);
  add(['l','liter','liters','litre','litres'],'volume',1); add(['ml','milliliter','milliliters','millilitre','millilitres'],'volume',.001);
  add(['celsius','°c'],'temperature',1); add(['fahrenheit','°f'],'temperature',1);
  const a=groups[from],b=groups[to]; if(!a||!b||a.group!==b.group) throw new Error('Those units can’t be converted directly. Try matching types, like length to length.');
  let converted:number;
  if(a.group==='temperature') converted=from===to?value:from==='celsius'||from==='°c'?(value*9/5)+32:(value-32)*5/9;
  else converted=value*a.scale/b.scale;
  const rounded=Number(converted.toFixed(4)); return {value,from,to,converted:rounded};
}

function parseLocation(text: string) {
  let place = text.toLowerCase().trim();
  place = place.replace(/^(?:hey\s+)?(?:please\s+)?(?:can you\s+)?(?:could you\s+)?(?:what(?:'s| is)\s+)?(?:the\s+)?(?:weather|forecast|temperature|conditions|rain(?:ing)?|wind)(?:\s+(?:like|looking like))?/i, ' ');
  place = place.replace(/\b(?:weather|forecast|temperature|conditions|rain(?:ing)?|snowing|wind|sunny|cloudy|clear|thunderstorms?)\b/gi, ' ');
  place = place.replace(/\b(?:postcode|post code|zip code|zip)\b/gi, ' ');
  place = place.replace(/\b(?:what(?:'s| is)|how(?:'s| is)|tell me|show me|get|check|look up|find|give me|in|for|at|around|the|like|today|tonight|now|currently|please|outside|going to be|going to rain|will it be|will|is|it|do|be|there|any)\b/gi, ' ');
  return place.replace(/[?!.,]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseTimeLocation(text: string) {
  return text.toLowerCase()
    .replace(/\b(?:what(?:'s| is)?|is|it|tell me|show me|give me|current|local|the|time|date|clock|today|please|in|at|for|right now)\b/g, ' ')
    .replace(/[?!.,]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function locationQueries(location: string) {
  const words = location.split(/\s+/).filter(Boolean);
  const queries = [location];
  if (!location.includes(',')) {
    for (let split = 1; split < words.length; split++) {
      queries.push(`${words.slice(0, split).join(' ')}, ${words.slice(split).join(' ')}`);
    }
    // Place names are often followed by a county, province, or region. Retry
    // shorter place names if the full phrase isn't indexed as a city.
    for (let length = words.length - 1; length >= 1; length--) queries.push(words.slice(0, length).join(' '));
  }
  return [...new Set(queries)];
}

function parseColor(text: string) {
  const hex = text.match(/#(?:[\da-f]{3}|[\da-f]{6})\b/i)?.[0];
  if (hex) return hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex;
  const normalized = text.toLowerCase();
  const color = [...colorNames].sort((a,b) => b.length-a.length).find(name => new RegExp(`\\b${name}\\b`, 'i').test(normalized));
  const rgb = color ? cssColorNames[color] : undefined;
  return rgb ? `#${rgb.map(value => value.toString(16).padStart(2, '0')).join('')}` : '#3ab3da';
}

function describeWeather(code: number) {
  if (code === 0) return 'Clear sky';
  if ([1,2,3].includes(code)) return ['','Mainly clear','Partly cloudy','Overcast'][code];
  if ([45,48].includes(code)) return 'Fog';
  if ([51,53,55,56,57].includes(code)) return 'Drizzle';
  if ([61,63,65,66,67,80,81,82].includes(code)) return 'Rain';
  if ([71,73,75,77,85,86].includes(code)) return 'Snow';
  if ([95,96,99].includes(code)) return 'Thunderstorm';
  return 'Current conditions';
}

export async function POST(request: Request) {
  if (!process.env.AI_GATEWAY_API_KEY) return NextResponse.json({ error: 'AI Gateway key is missing from .env.local.' }, { status: 500 });
  try {
    const body = await request.json();
    const text = typeof body.text === 'string' ? body.text.trim().slice(0, 2000) : '';
    if (!text) return NextResponse.json({ error: 'Type a request first.' }, { status: 400 });
    const decision = await evaluate({
      model: gateway.evaluationModel('typesafe-ai/jev'),
      state: text,
      questions: { intent: { type: 'choice', instructions: 'Choose the tool that fulfills the request. Understand paraphrases, typos, colloquial wording, and implied intent; do not require exact trigger words. Examples: “whats 2 + 2” and “add two and two” mean calculator; “make it 5 minutes” means timer; “is it raining in Rome” means weather; “what shade is #111111” means color; “roll a d20” means dice; “toss for me” means coin; “how much should I leave on a £40 bill” means tip; “make this 24 chars, hard to guess” means password; “how many days until 2026-12-31” means countdown; “what time is it in Tokyo” means clock.', criteria: intentOptions } },
    });
    const intent = decision.answers.intent;
    if (intent.type !== 'choice') throw new Error('Jev returned an unexpected decision type.');
    if (intent.choice === 'timer') return NextResponse.json({ kind: 'timer', seconds: parseDuration(text), original: text });
    if (intent.choice === 'color') return NextResponse.json({ kind: 'color', color: parseColor(text), original: text });
    if (intent.choice === 'calculator') return NextResponse.json({ kind: 'calculator', expression: text, value: calculate(text) });
    if (intent.choice === 'converter') return NextResponse.json({ kind: 'converter', ...convertUnits(text) });
    if (intent.choice === 'random') {
      const bounds=text.match(/(?:between|from)\s+(-?\d+)\s+(?:and|to)\s+(-?\d+)/i) ?? text.match(/(-?\d+)\s+(?:to|through)\s+(-?\d+)/i);
      const lower=bounds?Math.min(Number(bounds[1]),Number(bounds[2])):1, upper=bounds?Math.max(Number(bounds[1]),Number(bounds[2])):100;
      const { randomInt } = await import('node:crypto'); return NextResponse.json({kind:'random',value:randomInt(lower,upper+1),lower,upper});
    }
    if (intent.choice === 'dice') {
      const match=text.match(/(\d*)\s*d\s*(\d+)/i); const count=Math.min(20,Math.max(1,Number(match?.[1]||1))), sides=Math.min(1000,Math.max(2,Number(match?.[2]||6)));
      const { randomInt } = await import('node:crypto'); return NextResponse.json({kind:'dice',rolls:Array.from({length:count},()=>randomInt(1,sides+1)),sides});
    }
    if (intent.choice === 'coin') { const { randomInt } = await import('node:crypto'); return NextResponse.json({kind:'coin',side:randomInt(0,2)?'Heads':'Tails'}); }
    if (intent.choice === 'stopwatch') return NextResponse.json({kind:'stopwatch'});
    if (intent.choice === 'password') {
      const requestedLength=Number(text.match(/\b(\d+)\s*(?:character|characters|char|chars|symbol|symbols)\b/i)?.[1] ?? 16);
      return NextResponse.json({kind:'password',length:Math.min(40,Math.max(8,requestedLength))});
    }
    if (intent.choice === 'clock') {
      const placeName=parseTimeLocation(text);
      if (placeName) {
        const url=new URL('https://geocoding-api.open-meteo.com/v1/search'); url.searchParams.set('name',placeName); url.searchParams.set('count','1'); url.searchParams.set('language','en');
        let response=await fetch(url,{next:{revalidate:3600}}); let data=await response.json(); let found=data.results?.[0];
        if (!found && placeName.includes(' ')) {
          const shortName=placeName.split(' ').slice(0,-1).join(' '); url.searchParams.set('name',shortName); response=await fetch(url,{next:{revalidate:3600}}); data=await response.json(); found=data.results?.[0];
        }
        if (!found) return NextResponse.json({kind:'error',message:`I couldn’t find “${placeName}” to look up its local time.`});
        return NextResponse.json({kind:'clock',timestamp:new Date().toISOString(),place:found.name,timezone:found.timezone});
      }
      return NextResponse.json({kind:'clock',timestamp:new Date().toISOString()});
    }
    if (intent.choice === 'tip') {
      const values=[...text.matchAll(/(?:£|\$)?(\d+(?:\.\d{1,2})?)/g)].map(match=>Number(match[1]));
      const percent=Number(text.match(/(\d+(?:\.\d+)?)\s*%/)?.[1] ?? 15);
      const bill=values.find(value=>value>0 && value!==percent) ?? 0;
      const people=Number(text.match(/(?:split|divide|between)\s+(\d+)/i)?.[1] ?? 1);
      if (!bill) throw new Error('Try “20% tip on £48, split between 3”.');
      const tipAmount=Number((bill*percent/100).toFixed(2)), total=Number((bill+tipAmount).toFixed(2));
      return NextResponse.json({kind:'tip',bill,percent,tipAmount,total,people,perPerson:Number((total/people).toFixed(2)),currency:text.match(/[$£€¥]/)?.[0] ?? '£'});
    }
    if (intent.choice === 'bmi') {
      const weightMatch=text.match(/(\d+(?:\.\d+)?)\s*(?:kg|kilograms?)/i), heightMatch=text.match(/(\d+(?:\.\d+)?)\s*(?:cm|centimet(?:er|re)s?)/i);
      if (!weightMatch || !heightMatch) throw new Error('Try “BMI for 70 kg and 175 cm”.');
      const weight=Number(weightMatch[1]), height=Number(heightMatch[1])/100, value=Number((weight/(height*height)).toFixed(1));
      return NextResponse.json({kind:'bmi',weight,heightCm:height*100,value,category:value<18.5?'Below the usual range':value<25?'Within the usual range':value<30?'Above the usual range':'High'});
    }
    if (intent.choice === 'text') {
      const match=text.match(/(?:word|character|letter)\s+count(?:\s+of)?\s*[:\-]?\s*[“"']?(.+?)[”"']?$/i) ?? text.match(/count\s+(?:words?|characters?|letters?)\s*(?:in|of)?\s*[:\-]?\s*(.+)$/i);
      if (!match) throw new Error('Try “word count: paste your text here”.');
      const content=match[1].trim(), words=content?content.split(/\s+/).length:0;
      return NextResponse.json({kind:'text',words,characters:content.length,charactersNoSpaces:content.replace(/\s/g,'').length});
    }
    if (intent.choice === 'countdown') {
      const dateMatch=text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
      if (!dateMatch) throw new Error('Try “days until 2026-12-31”.');
      const target=new Date(`${dateMatch[1]}T00:00:00Z`), today=new Date();
      if (Number.isNaN(target.getTime())) throw new Error('That date didn’t look valid.');
      const days=Math.ceil((Date.UTC(target.getUTCFullYear(),target.getUTCMonth(),target.getUTCDate())-Date.UTC(today.getUTCFullYear(),today.getUTCMonth(),today.getUTCDate()))/86400000);
      return NextResponse.json({kind:'countdown',date:dateMatch[1],days});
    }
    if (intent.choice === 'weather') {
      const location = parseLocation(text);
      if (!location) return NextResponse.json({ kind: 'error', message: 'Which place should I check the weather for?' });
      let found;
      for (const query of locationQueries(location)) {
        const geoUrl = new URL('https://geocoding-api.open-meteo.com/v1/search');
        geoUrl.searchParams.set('name', query); geoUrl.searchParams.set('count', '5'); geoUrl.searchParams.set('language', 'en'); geoUrl.searchParams.set('format', 'json');
        const geoResponse = await fetch(geoUrl, { next: { revalidate: 3600 } });
        if (!geoResponse.ok) throw new Error('Could not search for that place right now.');
        const geo = await geoResponse.json();
        if (geo.results?.length) { found = geo.results[0]; break; }
      }
      if (!found) return NextResponse.json({ kind: 'error', message: `I couldn’t find “${location}”. Try adding a country, like “Paris, France”.` });
      const weatherUrl = new URL('https://api.open-meteo.com/v1/forecast');
      weatherUrl.searchParams.set('latitude', String(found.latitude)); weatherUrl.searchParams.set('longitude', String(found.longitude));
      weatherUrl.searchParams.set('current', 'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m');
      weatherUrl.searchParams.set('temperature_unit', 'celsius'); weatherUrl.searchParams.set('wind_speed_unit', 'kmh'); weatherUrl.searchParams.set('timezone', 'auto');
      const weatherResponse = await fetch(weatherUrl, { next: { revalidate: 900 } });
      if (!weatherResponse.ok) throw new Error('The weather service did not respond. Try again in a moment.');
      const weather = await weatherResponse.json();
      const current = weather.current;
      return NextResponse.json({ kind: 'weather', place: `${found.name}${found.country ? `, ${found.country}` : ''}`, time: current.time, temperature: current.temperature_2m, feelsLike: current.apparent_temperature, humidity: current.relative_humidity_2m, wind: current.wind_speed_10m, description: describeWeather(current.weather_code) });
    }
    return NextResponse.json({ kind: 'error', message: 'I can make a timer, check the weather, or open a colour picker. Try describing one of those.' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The request failed.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
