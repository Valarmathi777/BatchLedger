// Hand-built SVG scenes for the landing page slides.
// All animation is driven by CSS in landing.css (keyed on the active slide).

function spiral(cx, cy, r0, r1, turns, sy = 0.94, steps = 190) {
  let d = '';
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = t * turns * Math.PI * 2;
    const r = r0 + (r1 - r0) * t;
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a) * sy;
    d += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';
  }
  return d;
}

/* A murukku coil. The spiral "pipes itself" when its slide becomes active. */
function Murukku({ cx, cy, r = 60, w = 10, turns = 3.2, sy = 0.94, delay = 0 }) {
  const d = spiral(cx, cy, w * 0.55, r, turns, sy);
  const common = { d, pathLength: 1, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round', className: 'lp-draw' };
  return (
    <g style={{ '--d': `${delay}s` }}>
      <path {...common} stroke="#7a4410" strokeWidth={w + 4} opacity=".45" transform="translate(2.5 4.5)" />
      <path {...common} stroke="#c98320" strokeWidth={w + 1} />
      <path {...common} stroke="#e3a132" strokeWidth={w - 1} />
      <path {...common} stroke="#f6cd72" strokeWidth={Math.max(2, w * 0.3)} transform="translate(-1 -1.6)" opacity=".85" />
    </g>
  );
}

function SmallPouch({ x, y, c = '#14b8a6', k = 0 }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className="lp-drop" style={{ '--k': k }}>
        <rect width="38" height="54" rx="4" fill={c} />
        <rect width="38" height="7" rx="3" fill="#000" opacity=".18" />
        <rect x="6" y="18" width="26" height="22" rx="3" fill="#fff" opacity=".92" />
        <circle cx="19" cy="29" r="6" fill="none" stroke="#c98320" strokeWidth="2.4" />
        <circle cx="19" cy="29" r="2.2" fill="#c98320" />
      </g>
    </g>
  );
}

/* ---------- Slide 1: murukku on a banana leaf ---------- */
export function HeroScene() {
  return (
    <svg viewBox="0 0 600 520" role="img" aria-label="Murukku snacks on a banana leaf beside a packed pouch" className="lp-svg">
      <defs>
        <radialGradient id="h-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#14b8a6" stopOpacity=".34" />
          <stop offset="1" stopColor="#14b8a6" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="h-leaf" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#47a866" />
          <stop offset="1" stopColor="#1f6b3e" />
        </linearGradient>
        <linearGradient id="h-pouch" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2dd4bf" />
          <stop offset="1" stopColor="#0d9488" />
        </linearGradient>
      </defs>

      <circle cx="300" cy="270" r="270" fill="url(#h-glow)" />

      {/* banana leaf */}
      <g className="lp-pop" style={{ '--k': 0 }}>
        <g transform="rotate(-7 300 300)">
          <path d="M36 318 C 90 140, 470 96, 568 292 C 520 462, 150 486, 36 318 Z" fill="#0b2a1a" opacity=".35" transform="translate(6 12)" />
          <path d="M36 318 C 90 140, 470 96, 568 292 C 520 462, 150 486, 36 318 Z" fill="url(#h-leaf)" />
          <path d="M44 316 C 200 300, 400 296, 560 290" stroke="#a8e0b4" strokeWidth="4" fill="none" strokeLinecap="round" opacity=".8" />
          {Array.from({ length: 11 }).map((_, i) => {
            const x = 90 + i * 40;
            return (
              <g key={i} stroke="#a8e0b4" strokeWidth="1.8" opacity=".38" strokeLinecap="round">
                <path d={`M${x} ${309 - i * 1.4} q ${14} -52 ${34} -86`} fill="none" />
                <path d={`M${x} ${309 - i * 1.4} q ${14} 52 ${34} 94`} fill="none" />
              </g>
            );
          })}
        </g>
      </g>

      <Murukku cx={290} cy={290} r={98} w={14} turns={3.4} delay={0} />
      <Murukku cx={152} cy={336} r={56} w={11} turns={3} delay={0.5} />
      <Murukku cx={410} cy={372} r={54} w={11} turns={3} delay={0.9} />
      <Murukku cx={226} cy={158} r={36} w={9} turns={2.8} delay={1.3} />

      {/* steam */}
      <g className="lp-steam" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" opacity=".0">
        <path style={{ '--k': 0 }} d="M250 130 q -14 -24 0 -46 q 14 -22 0 -44" />
        <path style={{ '--k': 1 }} d="M300 120 q -14 -24 0 -46 q 14 -22 0 -44" />
        <path style={{ '--k': 2 }} d="M350 132 q -14 -24 0 -46 q 14 -22 0 -44" />
      </g>

      {/* pouch */}
      <g transform="translate(418 150) rotate(7)">
        <g className="lp-pop" style={{ '--k': 2 }}>
          <rect x="6" y="10" width="124" height="190" rx="8" fill="#06201c" opacity=".35" transform="translate(8 10)" />
          <rect width="124" height="190" rx="8" fill="url(#h-pouch)" />
          <path d="M0 9 H124" stroke="#065e55" strokeWidth="18" strokeDasharray="2.5 4.5" />
          <path d="M0 181 H124" stroke="#065e55" strokeWidth="18" strokeDasharray="2.5 4.5" />
          <rect x="12" y="38" width="100" height="116" rx="8" fill="#fff" />
          <circle cx="62" cy="80" r="23" fill="none" stroke="#c98320" strokeWidth="6" />
          <circle cx="62" cy="80" r="12" fill="none" stroke="#e3a132" strokeWidth="5" />
          <circle cx="62" cy="80" r="3.5" fill="#c98320" />
          <text x="62" y="126" textAnchor="middle" fontSize="17" fontWeight="800" fill="#0f1729" fontFamily="Inter, system-ui, sans-serif">Murukku</text>
          <text x="62" y="144" textAnchor="middle" fontSize="12" fontWeight="600" fill="#64748b" fontFamily="Inter, system-ui, sans-serif">200 g</text>
          <rect x="10" y="12" width="14" height="168" rx="6" fill="#fff" opacity=".13" />
        </g>
      </g>
    </svg>
  );
}

/* ---------- Slide 2: the store room ---------- */
export function StoreScene() {
  const font = 'Inter, system-ui, sans-serif';
  return (
    <svg viewBox="0 0 600 520" role="img" aria-label="Store room shelves holding a rice flour sack, oil can, spice jar, pouches, cartons and finished goods" className="lp-svg">
      {/* planks */}
      <g>
        <rect x="24" y="262" width="552" height="16" rx="4" fill="#9a6b3a" />
        <rect x="24" y="274" width="552" height="5" fill="#000" opacity=".12" />
        <rect x="24" y="436" width="552" height="16" rx="4" fill="#9a6b3a" />
        <rect x="24" y="448" width="552" height="5" fill="#000" opacity=".12" />
        <path d="M60 278 l0 34 l34 -34 Z M540 278 l0 34 l-34 -34 Z M60 452 l0 34 l34 -34 Z M540 452 l0 34 l-34 -34 Z" fill="#7b5128" />
      </g>

      {/* rice flour sack */}
      <g className="lp-drop" style={{ '--k': 0 }}>
        <path d="M56 156 C 44 196, 44 242, 60 262 L 176 262 C 192 242, 192 196, 180 156 Z" fill="#f3ead2" stroke="#cdbf9a" strokeWidth="2" />
        <path d="M56 156 C 70 132, 100 128, 98 112 L 138 112 C 136 128, 168 132, 180 156 Z" fill="#ece0bf" stroke="#cdbf9a" strokeWidth="2" />
        <path d="M94 126 Q118 140 142 126" stroke="#a88d4f" strokeWidth="4" fill="none" strokeLinecap="round" />
        <rect x="74" y="178" width="86" height="56" rx="7" fill="#fff" stroke="#e1d6b5" />
        <rect x="74" y="178" width="86" height="12" rx="5" fill="#14b8a6" />
        <text x="117" y="210" textAnchor="middle" fontSize="15" fontWeight="800" fill="#0f1729" fontFamily={font}>Rice flour</text>
        <text x="117" y="226" textAnchor="middle" fontSize="11" fontWeight="600" fill="#64748b" fontFamily={font}>160 kg</text>
      </g>

      {/* oil can */}
      <g className="lp-drop" style={{ '--k': 1 }}>
        <path d="M262 164 v-26 h30 v26" stroke="#b8821a" strokeWidth="9" fill="none" strokeLinejoin="round" />
        <rect x="216" y="160" width="86" height="102" rx="11" fill="#e8b53a" />
        <rect x="224" y="168" width="70" height="86" rx="8" fill="#f4c95a" opacity=".6" />
        <rect x="222" y="140" width="20" height="24" rx="3" fill="#c8921f" />
        <rect x="219" y="134" width="26" height="9" rx="3" fill="#8f6410" />
        <rect x="234" y="190" width="52" height="46" rx="6" fill="#fff" />
        <text x="260" y="218" textAnchor="middle" fontSize="15" fontWeight="800" fill="#0f1729" fontFamily={font}>Oil</text>
        <text x="260" y="231" textAnchor="middle" fontSize="10.5" fontWeight="600" fill="#64748b" fontFamily={font}>19.5 L</text>
      </g>

      {/* spice jar */}
      <g className="lp-drop" style={{ '--k': 2 }}>
        <rect x="334" y="188" width="68" height="74" rx="13" fill="#c2410c" />
        <rect x="341" y="196" width="10" height="58" rx="5" fill="#fff" opacity=".22" />
        <rect x="340" y="170" width="56" height="20" rx="5" fill="#1f2937" />
        <rect x="344" y="214" width="48" height="28" rx="4" fill="#fff" />
        <text x="368" y="233" textAnchor="middle" fontSize="12" fontWeight="800" fill="#0f1729" fontFamily={font}>Spice</text>
      </g>

      {/* pouch stack */}
      <g className="lp-drop" style={{ '--k': 3 }}>
        {[0, 1, 2, 3, 4].map(i => (
          <rect key={i} x={432 + (i % 2) * 4} y={248 - i * 11} width="98" height="11" rx="3" fill={i % 2 ? '#2dd4bf' : '#14b8a6'} stroke="#0d8f82" strokeWidth="1" />
        ))}
        <rect x="446" y="168" width="70" height="22" rx="4" fill="#fff" />
        <text x="481" y="183" textAnchor="middle" fontSize="11.5" fontWeight="800" fill="#0f1729" fontFamily={font}>Pouches 306</text>
      </g>

      {/* cartons */}
      <g className="lp-drop" style={{ '--k': 4 }}>
        <rect x="48" y="360" width="126" height="76" rx="3" fill="#c99a5e" />
        <rect x="100" y="360" width="22" height="76" fill="#e6c996" opacity=".85" />
        <rect x="60" y="306" width="102" height="54" rx="3" fill="#d4a56a" />
        <rect x="100" y="306" width="22" height="54" fill="#e6c996" opacity=".85" />
        <rect x="66" y="396" width="26" height="22" rx="3" fill="#fff" opacity=".9" />
      </g>

      {/* finished goods */}
      {[0, 1, 2, 3].map(i => <SmallPouch key={`a${i}`} x={192 + i * 39} y={382} c={i % 2 ? '#14b8a6' : '#e4572e'} k={5 + i} />)}
      {[0, 1, 2].map(i => <SmallPouch key={`b${i}`} x={211 + i * 39} y={328} c={i % 2 ? '#e4572e' : '#14b8a6'} k={9 + i} />)}
    </svg>
  );
}

/* ---------- Slide 3: the kadai ---------- */
export function KadaiScene() {
  return (
    <svg viewBox="0 0 600 520" role="img" aria-label="Murukku frying in an iron kadai over a gas flame" className="lp-svg">
      <defs>
        <radialGradient id="k-glow" cx="50%" cy="70%" r="55%">
          <stop offset="0" stopColor="#ff9d2e" stopOpacity=".34" />
          <stop offset="1" stopColor="#ff9d2e" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="k-iron" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4a566b" />
          <stop offset="1" stopColor="#111827" />
        </linearGradient>
        <radialGradient id="k-oil" cx="50%" cy="40%" r="65%">
          <stop offset="0" stopColor="#f8cf5d" />
          <stop offset="1" stopColor="#c9771a" />
        </radialGradient>
      </defs>

      <ellipse cx="300" cy="400" rx="300" ry="190" fill="url(#k-glow)" />

      {/* steam */}
      <g className="lp-steam" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" opacity="0">
        <path style={{ '--k': 0 }} d="M230 292 q -14 -22 0 -42 q 14 -20 0 -40" />
        <path style={{ '--k': 1 }} d="M300 286 q -14 -22 0 -42 q 14 -20 0 -40" />
        <path style={{ '--k': 2 }} d="M370 292 q -14 -22 0 -42 q 14 -20 0 -40" />
      </g>

      {/* burner */}
      <path d="M200 476 H400 L420 508 H180 Z" fill="#1b2438" />
      {/* flames */}
      <g>
        <path className="lp-flame" style={{ '--k': 0 }} d="M300 412 C 340 444 356 470 300 482 C 244 470 260 444 300 412 Z" fill="#ff8a1f" />
        <path className="lp-flame" style={{ '--k': 1 }} d="M238 436 C 262 456 270 472 238 482 C 206 472 214 456 238 436 Z" fill="#ff9d2e" />
        <path className="lp-flame" style={{ '--k': 2 }} d="M362 436 C 386 456 394 472 362 482 C 330 472 338 456 362 436 Z" fill="#ff9d2e" />
        <path className="lp-flame" style={{ '--k': 3 }} d="M300 442 C 318 458 322 470 300 478 C 278 470 282 458 300 442 Z" fill="#ffd45a" />
      </g>

      {/* kadai */}
      <g className="lp-pop" style={{ '--k': 0 }}>
        <path d="M92 346 L48 336 a9 9 0 0 0 -2 18 L92 360 Z" fill="#1c2536" />
        <path d="M508 346 L552 336 a9 9 0 0 1 2 18 L508 360 Z" fill="#1c2536" />
        <path d="M92 340 C 96 440, 200 462, 300 462 C 400 462, 504 440, 508 340 Z" fill="url(#k-iron)" />
        <ellipse cx="300" cy="340" rx="208" ry="40" fill="#2a3447" stroke="#56647c" strokeWidth="3" />
        <ellipse cx="300" cy="344" rx="192" ry="31" fill="url(#k-oil)" />
        <ellipse cx="300" cy="350" rx="150" ry="14" fill="#fff" opacity=".1" />
      </g>

      <Murukku cx={222} cy={346} r={52} w={10} turns={3} sy={0.4} delay={0.6} />
      <Murukku cx={340} cy={343} r={50} w={10} turns={3} sy={0.4} delay={1.0} />
      <Murukku cx={420} cy={353} r={32} w={8} turns={2.6} sy={0.4} delay={1.4} />

      {/* bubbles */}
      <g fill="none" stroke="#fff" strokeWidth="2" opacity="0" className="lp-bubbles">
        <circle style={{ '--k': 0 }} cx="168" cy="346" r="5" />
        <circle style={{ '--k': 1 }} cx="282" cy="352" r="4" />
        <circle style={{ '--k': 2 }} cx="372" cy="334" r="6" />
        <circle style={{ '--k': 3 }} cx="444" cy="346" r="4" />
        <circle style={{ '--k': 4 }} cx="250" cy="332" r="3.5" />
      </g>
    </svg>
  );
}

/* ---------- Slide 4: delivery truck (invoice is HTML) ---------- */
export function TruckScene() {
  return (
    <svg viewBox="0 0 600 150" className="lp-svg lp-truck-svg" role="img" aria-label="Delivery truck carrying cartons">
      <path className="lp-road" d="M0 142 H600" stroke="#0f1729" strokeOpacity=".35" strokeWidth="4" strokeLinecap="round" fill="none" />
      <g className="lp-truck">
        <rect x="70" y="26" width="236" height="88" rx="8" fill="#14b8a6" />
        <rect x="70" y="26" width="236" height="16" rx="8" fill="#0d9488" />
        <text x="188" y="84" textAnchor="middle" fontSize="26" fontWeight="800" fill="#fff" fontFamily="Inter, system-ui, sans-serif">Murukku 200 g</text>
        <text x="188" y="102" textAnchor="middle" fontSize="12" fontWeight="600" fill="#fff" opacity=".85" fontFamily="Inter, system-ui, sans-serif">Dispatched with invoice</text>
        <path d="M312 52 H364 Q 380 52 388 70 L 408 92 Q 412 98 412 104 V 114 H312 Z" fill="#0f1729" />
        <path d="M324 62 H362 Q 370 62 376 74 L 386 90 H324 Z" fill="#a5f3fc" opacity=".85" />
        <rect x="60" y="112" width="360" height="10" rx="4" fill="#1e2d4a" />
        {[130, 360].map(cx => (
          <g key={cx}>
            <circle cx={cx} cy="122" r="18" fill="#0b1322" />
            <g className="lp-wheel">
              <circle cx={cx} cy="122" r="9" fill="#cbd5e1" />
              <path d={`M${cx - 8} 122 H${cx + 8} M${cx} 114 V130`} stroke="#64748b" strokeWidth="2.5" />
            </g>
          </g>
        ))}
      </g>
    </svg>
  );
}

/* ---------- Slide 5: flour sack at the end of the audit trail ---------- */
export function SackScene() {
  const font = 'Inter, system-ui, sans-serif';
  return (
    <svg viewBox="0 0 150 160" className="lp-svg" role="img" aria-label="Sack of rice flour">
      <path d="M12 56 C 0 100, 0 142, 16 158 L 134 158 C 150 142, 150 100, 138 56 Z" fill="#f3ead2" stroke="#cdbf9a" strokeWidth="2" />
      <path d="M12 56 C 26 32, 58 28, 56 10 L 94 10 C 92 28, 124 32, 138 56 Z" fill="#ece0bf" stroke="#cdbf9a" strokeWidth="2" />
      <path d="M50 24 Q75 38 100 24" stroke="#a88d4f" strokeWidth="4" fill="none" strokeLinecap="round" />
      <rect x="30" y="80" width="90" height="56" rx="7" fill="#fff" stroke="#e1d6b5" />
      <rect x="30" y="80" width="90" height="12" rx="5" fill="#14b8a6" />
      <text x="75" y="112" textAnchor="middle" fontSize="15" fontWeight="800" fill="#0f1729" fontFamily={font}>Rice flour</text>
      <text x="75" y="127" textAnchor="middle" fontSize="11" fontWeight="600" fill="#64748b" fontFamily={font}>60 kg @ ₹45</text>
    </svg>
  );
}

/* ---------- Slide 6: shop front with a kolam ---------- */
export function ShopScene() {
  const font = 'Inter, system-ui, sans-serif';
  const stripes = Array.from({ length: 8 });
  const sw = 460 / 8;
  const cols = ['#14b8a6', '#e4572e', '#e3a132'];
  return (
    <svg viewBox="0 0 600 520" role="img" aria-label="A neighbourhood snack shop with a striped awning and a kolam at the door" className="lp-svg">
      {/* ground */}
      <rect x="24" y="446" width="552" height="66" rx="14" fill="#ecd7a2" opacity=".75" />

      {/* shop body */}
      <rect x="70" y="170" width="460" height="276" fill="#fff8e6" stroke="#dcc489" strokeWidth="2" />

      {/* shelves + pouches */}
      <g>
        <rect x="96" y="276" width="408" height="10" rx="3" fill="#9a6b3a" />
        <rect x="96" y="356" width="408" height="10" rx="3" fill="#9a6b3a" />
        {Array.from({ length: 8 }).map((_, i) => (
          <SmallPouch key={`r1${i}`} x={104 + i * 50} y={222} c={cols[i % 3]} k={i} />
        ))}
        {Array.from({ length: 6 }).map((_, i) => (
          <SmallPouch key={`r2${i}`} x={204 + i * 50} y={302} c={cols[(i + 1) % 3]} k={i + 3} />
        ))}
      </g>

      {/* counter */}
      <rect x="64" y="388" width="472" height="58" fill="#8a5a2b" />
      <rect x="58" y="380" width="484" height="12" rx="4" fill="#b07a42" />
      {/* murukku jar on counter */}
      <g>
        <rect x="110" y="334" width="68" height="48" rx="11" fill="#fff" opacity=".75" stroke="#b9a979" />
        <circle cx="130" cy="366" r="10" fill="none" stroke="#e3a132" strokeWidth="4.5" />
        <circle cx="156" cy="366" r="10" fill="none" stroke="#c98320" strokeWidth="4.5" />
        <circle cx="143" cy="349" r="10" fill="none" stroke="#e3a132" strokeWidth="4.5" />
        <rect x="114" y="326" width="60" height="10" rx="4" fill="#1f2937" />
      </g>

      {/* awning */}
      <g className="lp-awning">
        {stripes.map((_, i) => (
          <g key={i}>
            <rect x={70 + i * sw} y="112" width={sw + 0.5} height="58" fill={i % 2 ? '#f2b53a' : '#14b8a6'} />
            <path d={`M${70 + i * sw} 170 a${sw / 2} ${sw / 2} 0 0 0 ${sw} 0 Z`} fill={i % 2 ? '#f2b53a' : '#14b8a6'} />
          </g>
        ))}
        <rect x="64" y="104" width="472" height="12" rx="5" fill="#0d9488" />
      </g>

      {/* sign */}
      <g className="lp-pop" style={{ '--k': 1 }}>
        <path d="M230 104 V82 M370 104 V82" stroke="#0f1729" strokeWidth="3" />
        <rect x="186" y="42" width="228" height="44" rx="9" fill="#0f1729" />
        <text x="300" y="72" textAnchor="middle" fontSize="23" fontWeight="800" fill="#fff" fontFamily={font}>Rajan Stores</text>
      </g>

      {/* kolam */}
      <g fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
        <path className="lp-draw" pathLength="1" style={{ '--d': '0.7s' }} d="M300 454 Q 352 474 372 486 Q 352 500 300 518 Q 248 500 228 486 Q 248 474 300 454 Z" />
        <path className="lp-draw" pathLength="1" style={{ '--d': '1.3s' }} d="M300 466 Q 330 478 342 486 Q 330 494 300 506 Q 270 494 258 486 Q 270 478 300 466 Z" />
        <path className="lp-draw" pathLength="1" style={{ '--d': '1.9s' }} d="M300 478 Q 312 482 316 486 Q 312 490 300 494 Q 288 490 284 486 Q 288 482 300 478 Z" />
      </g>
      <g fill="#fff" className="lp-pop" style={{ '--k': 4 }}>
        {[[300, 486], [248, 486], [352, 486], [300, 462], [300, 510]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3" />)}
      </g>
    </svg>
  );
}
