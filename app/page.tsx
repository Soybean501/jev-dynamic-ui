'use client';

import { FormEvent, ReactNode, useEffect, useState } from 'react';

type CommandResult =
  | { kind: 'timer'; seconds: number; original: string; confidence?: number }
  | { kind: 'weather'; place: string; time: string; temperature: number; feelsLike: number; humidity: number; wind: number; description: string; confidence?: number }
  | { kind: 'color'; color: string; original: string; confidence?: number }
  | { kind: 'calculator'; expression: string; value: number }
  | { kind: 'converter'; value: number; from: string; to: string; converted: number }
  | { kind: 'random'; value: number; lower: number; upper: number }
  | { kind: 'dice'; rolls: number[]; sides: number }
  | { kind: 'coin'; side: string }
  | { kind: 'stopwatch' }
  | { kind: 'password'; length:number }
  | { kind: 'clock'; timestamp: string; place?:string; timezone?:string }
  | { kind: 'tip'; bill:number; percent:number; tipAmount:number; total:number; people:number; perPerson:number; currency:string }
  | { kind: 'bmi'; weight:number; heightCm:number; value:number; category:string }
  | { kind: 'text'; words:number; characters:number; charactersNoSpaces:number }
  | { kind: 'countdown'; date:string; days:number }
  | { kind: 'error'; message: string };
const examples = ['timer 20s', 'weather tokyo', 'minecraft diamond colour'];
const ideaGroups = [
  { title:'Time', ideas:['timer for two minutes','set a timer for 90 seconds','set a timer for 45 minutes','Pomodoro focus session','start a stopwatch','time me for a 400 metre run','days until 2026-12-31','what time is it?','what date is it today?'] },
  { title:'Weather & colour', ideas:['weather Ambleside Cumbria','weather in Paris, France','weather in New York City','current weather for postcode 90210','rain in Tokyo','show me the colour coral','hex code for black','hex code for gold','what colour is rebeccapurple?','pick a Minecraft diamond colour'] },
  { title:'Numbers & conversions', ideas:['what is 15% of 80','calculate 248 divided by 4','what is 238 plus 579','convert 5 km to miles','20 celsius to fahrenheit','convert 12 inches to cm','convert 70 kg to pounds','convert 5 miles to km','20% tip on £48 split between 3','BMI for 70 kg and 175 cm'] },
  { title:'Random & handy', ideas:['pick a number between 1 and 100','choose a number from -5 to 20','roll 2d6','roll a d20','roll 4d8','flip a coin','heads or tails','generate a secure password','make a 24 character password','word count: The quick brown fox jumps','character count: Hello there','count characters in: Jev is quick'] },
];

export default function Home() {
  const [text, setText] = useState('');
  const [result, setResult] = useState<CommandResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function run(command: string) {
    if (!command.trim()) return;
    setText(command); setLoading(true); setError(''); setResult(null);
    try {
      const response = await fetch('/api/command', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({text: command}) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not process that request.');
      setResult(data as CommandResult);
    } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong.'); }
    finally { setLoading(false); }
  }
  function submit(e: FormEvent) { e.preventDefault(); void run(text); }

  return <main className="page">
    <div className="wordmark"><span className="spark">✳</span> little things</div>
    <section className="intro">
      <h1>What would you like?</h1>
      <p>Say it your way. I’ll figure out the right little tool.</p>
    </section>
    <form className="command" onSubmit={submit}>
      <input aria-label="Tell me what you want to do" autoComplete="off" value={text} onChange={e=>setText(e.target.value)} placeholder="Try “a two minute timer” or “weather in Ambleside”…" />
      <button disabled={!text.trim() || loading} aria-label="Go">{loading ? <span className="spinner"/> : <span>↗</span>}</button>
    </form>
    <div className="examples"><span>TRY</span>{examples.map(example=><button key={example} onClick={()=>void run(example)} disabled={loading}>{example}</button>)}</div>
    {(error || result?.kind === 'error')&&<div className="message">{error || (result as Extract<CommandResult,{kind:'error'}>).message}</div>}
    {result?.kind === 'timer'&&<Timer key={result.seconds} seconds={result.seconds} label={result.original.toLowerCase().includes('pomodoro')?'POMODORO FOCUS':'YOUR TIMER'}/>}
    {result?.kind === 'weather'&&<Weather result={result}/>}
    {result?.kind === 'color'&&<Color initial={result.color} original={result.original}/>}
    {result?.kind === 'calculator'&&<MiniCard title="CALCULATOR"><div className="result-value">{result.value.toLocaleString()}</div><div className="muted-line">{result.expression}</div></MiniCard>}
    {result?.kind === 'converter'&&<MiniCard title="UNIT CONVERTER"><div className="result-value">{result.converted.toLocaleString()} <small>{result.to}</small></div><div className="muted-line">{result.value} {result.from} = {result.converted} {result.to}</div></MiniCard>}
    {result?.kind === 'random'&&<MiniCard title="RANDOM PICK"><div className="result-value">{result.value}</div><div className="muted-line">A number between {result.lower} and {result.upper}</div><button className="plain reroll" onClick={()=>void run(`random number between ${result.lower} and ${result.upper}`)}>↻ Pick again</button></MiniCard>}
    {result?.kind === 'dice'&&<MiniCard title="DICE ROLL"><div className="dice-row">{result.rolls.map((roll,index)=><span className="die" key={index}>{roll}</span>)}</div><div className="muted-line">{result.rolls.length}d{result.sides} · total {result.rolls.reduce((a,b)=>a+b,0)}</div><button className="plain reroll" onClick={()=>void run(`roll ${result.rolls.length}d${result.sides}`)}>↻ Roll again</button></MiniCard>}
    {result?.kind === 'coin'&&<MiniCard title="COIN FLIP"><div className="coin">{result.side==='Heads'?'H':'T'}</div><div className="result-value small-result">{result.side}</div><button className="plain reroll" onClick={()=>void run('flip a coin')}>↻ Flip again</button></MiniCard>}
    {result?.kind === 'stopwatch'&&<Stopwatch/>}
    {result?.kind === 'password'&&<Password initialLength={result.length}/>}
    {result?.kind === 'clock'&&<Clock timestamp={result.timestamp}/>}
    {result?.kind === 'tip'&&<MiniCard title="TIP SPLITTER"><div className="result-value">{result.currency}{result.perPerson.toFixed(2)} <small>each</small></div><div className="muted-line">{result.currency}{result.bill.toFixed(2)} bill · {result.percent}% tip · {result.currency}{result.total.toFixed(2)} total for {result.people}</div></MiniCard>}
    {result?.kind === 'bmi'&&<MiniCard title="BMI"><div className="result-value">{result.value}</div><div className="muted-line">{result.category} · {result.weight} kg, {result.heightCm} cm</div></MiniCard>}
    {result?.kind === 'text'&&<MiniCard title="TEXT COUNTER"><div className="stats-grid"><Stat label="WORDS" value={result.words}/><Stat label="CHARACTERS" value={result.characters}/><Stat label="NO SPACES" value={result.charactersNoSpaces}/></div></MiniCard>}
    {result?.kind === 'countdown'&&<MiniCard title="DATE COUNTDOWN"><div className="result-value">{Math.max(0,result.days)} <small>days</small></div><div className="muted-line">until {result.date}{result.days<0?' · that date has passed':''}</div></MiniCard>}
    <details className="ideas"><summary>Explore simple things I can do <span>⌄</span></summary>{ideaGroups.map(group=><div className="idea-group" key={group.title}><b>{group.title}</b><div>{group.ideas.map(idea=><button key={idea} onClick={()=>void run(idea)} disabled={loading}>{idea}</button>)}</div></div>)}</details>
    <footer>Made for curious little requests <span>·</span> decisions by Jev</footer>
  </main>
}

function Timer({seconds,label='YOUR TIMER'}: {seconds:number;label?:string}) {
  const [remaining,setRemaining]=useState(seconds); const [running,setRunning]=useState(false);
  useEffect(()=>{ if(!running)return; const id=setInterval(()=>setRemaining(n=>Math.max(0,n-1)),1000); return ()=>clearInterval(id); },[running]);
  useEffect(()=>{if(remaining===0)setRunning(false)},[remaining]);
  const display=`${Math.floor(remaining/60).toString().padStart(2,'0')}:${(remaining%60).toString().padStart(2,'0')}`;
  return <section className="widget timer-widget"><div className="widget-kicker">{label}</div><div className={`timer-face ${remaining===0?'done':''}`}>{remaining===0?'Done!':display}</div><div className="timer-actions"><button className="primary" onClick={()=>remaining===0?setRemaining(seconds):setRunning(!running)}>{remaining===0?'↻ Restart':running?'Ⅱ Pause':'▶ Start'}</button><button className="plain" onClick={()=>{setRunning(false);setRemaining(seconds)}}>Reset</button></div></section>
}

function Weather({result}: {result:Extract<CommandResult,{kind:'weather'}>}) {
  return <section className="widget weather-widget"><div className="weather-heading"><div><div className="widget-kicker">CURRENT WEATHER</div><h2>{result.place}</h2></div><div className="weather-icon">{result.description.includes('Rain')?'🌧':result.description.includes('Snow')?'❄️':result.description.includes('Cloud')?'☁️':result.description.includes('Thunder')?'⛈️':'☀️'}</div></div><div className="temperature">{Math.round(result.temperature)}<span>°C</span></div><div className="condition">{result.description} <span>·</span> Feels like {Math.round(result.feelsLike)}°</div><div className="weather-stats"><div><small>WIND</small><b>{Math.round(result.wind)} <small>km/h</small></b></div><div><small>HUMIDITY</small><b>{Math.round(result.humidity)}%</b></div><div><small>LOCAL TIME</small><b>{result.time.slice(11,16)}</b></div></div><a className="attribution" href="https://open-meteo.com/" target="_blank" rel="noreferrer">Weather data by Open-Meteo ↗</a></section>
}

function Color({initial,original}: {initial:string;original:string}) {
  const [color,setColor]=useState(initial);
  return <section className="widget color-widget"><div className="widget-kicker">PICK YOUR DIAMOND COLOUR</div><div className="color-row"><label className="swatch" style={{backgroundColor:color}}><input aria-label="Pick a colour" type="color" value={color} onChange={e=>setColor(e.target.value)}/></label><div><h2>{color.toUpperCase()}</h2><p>{original.toLowerCase().includes('minecraft')?'Minecraft diamond, recoloured.':'Your colour, ready to use.'}</p></div></div><div className="hex-row"><span>HEX</span><b>{color.toUpperCase()}</b><button onClick={()=>navigator.clipboard.writeText(color.toUpperCase())}>Copy</button></div></section>
}

function MiniCard({title,children}: {title:string;children:ReactNode}) { return <section className="widget mini-card"><div className="widget-kicker">{title}</div>{children}</section> }
function Stat({label,value}: {label:string;value:number}) { return <div><small>{label}</small><b>{value}</b></div> }

function Stopwatch() {
  const [running,setRunning]=useState(false); const [elapsed,setElapsed]=useState(0); const [startedAt,setStartedAt]=useState(0);
  useEffect(()=>{if(!running)return;const id=setInterval(()=>setElapsed(Date.now()-startedAt),50);return()=>clearInterval(id)},[running,startedAt]);
  const minutes=Math.floor(elapsed/60000),seconds=Math.floor(elapsed/1000)%60,centis=Math.floor(elapsed/10)%100;
  return <MiniCard title="STOPWATCH"><div className="timer-face">{`${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`}<small>.{String(centis).padStart(2,'0')}</small></div><div className="timer-actions"><button className="primary" onClick={()=>{if(running)setRunning(false);else{setStartedAt(Date.now()-elapsed);setRunning(true)}}}>{running?'Ⅱ Pause':'▶ Start'}</button><button className="plain" onClick={()=>{setRunning(false);setElapsed(0)}}>Reset</button></div></MiniCard>
}

function Password({initialLength}:{initialLength:number}) {
  const [length,setLength]=useState(initialLength);const [value,setValue]=useState('');const [copied,setCopied]=useState(false);
  function generate(size=length){const chars='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*?';const bytes=new Uint8Array(size);crypto.getRandomValues(bytes);setValue(Array.from(bytes,b=>chars[b%chars.length]).join(''));setCopied(false)}
  useEffect(()=>{generate(initialLength)},[]);
  return <MiniCard title="PASSWORD GENERATOR"><div className="password-value">{value}</div><div className="password-controls"><label>Length <b>{length}</b><input type="range" min="8" max="40" value={length} onChange={e=>{setLength(Number(e.target.value));generate(Number(e.target.value))}}/></label><button className="primary" onClick={async()=>{await navigator.clipboard.writeText(value);setCopied(true)}}>{copied?'Copied ✓':'⧉ Copy password'}</button><button className="plain" onClick={()=>generate()}>↻ New</button></div></MiniCard>
}

function Clock({timestamp,place,timezone}:{timestamp:string;place?:string;timezone?:string}) {
  const [now,setNow]=useState(new Date(timestamp));useEffect(()=>{const id=setInterval(()=>setNow(new Date()),1000);return()=>clearInterval(id)},[]);
  const options: Intl.DateTimeFormatOptions = {timeZone:timezone,hour:'2-digit',minute:'2-digit',second:'2-digit'};
  const dateOptions: Intl.DateTimeFormatOptions = {timeZone:timezone,weekday:'long',year:'numeric',month:'long',day:'numeric'};
  return <MiniCard title={place?'LOCAL TIME THERE':'LOCAL TIME'}><div className="timer-face">{now.toLocaleTimeString([], options)}</div><div className="muted-line">{place?`${place} · `:''}{now.toLocaleDateString([], dateOptions)}{timezone?` · ${timezone}`:''}</div></MiniCard>
}
