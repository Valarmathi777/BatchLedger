import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3, Package, ShoppingCart, FileText, TrendingUp, Shield, ChevronRight,
  ChevronUp, ChevronDown, Factory, Users, BookOpen, Truck, Wheat, Check,
} from 'lucide-react';
import { HeroScene, StoreScene, KadaiScene, TruckScene, SackScene, ShopScene } from './landing/Scenes';
import './landing/landing.css';

const portals = [
  { key: 'owner', label: 'Owner / Admin portal', desc: 'Full business overview and every module', icon: <BarChart3 size={22} />, path: '/login?portal=owner' },
  { key: 'producer', label: 'Production portal', desc: 'Recipes, production runs and costing', icon: <Factory size={22} />, path: '/login?portal=producer' },
  { key: 'customer', label: 'Customer portal', desc: 'Place orders and track your invoices', icon: <Users size={22} />, path: '/login?portal=customer' },
];

const slideTitles = [
  'Recipe to reconciliation',
  'The store room',
  'Production batches',
  'Billing and GST',
  'Audit trail',
  'Choose your portal',
];

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Counts up to `value` once its slide is active. */
function CountUp({ value, active, decimals = 0, prefix = '', suffix = '', delay = 1400 }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!active) { setV(0); return undefined; }
    if (reducedMotion()) { setV(value); return undefined; }
    let raf; let start;
    const timer = setTimeout(() => {
      const tick = t => {
        start ??= t;
        const p = Math.min(1, (t - start) / 1400);
        setV(value * (1 - Math.pow(1 - p, 3)));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, delay);
    return () => { clearTimeout(timer); cancelAnimationFrame(raf); };
  }, [active, value, delay]);
  const text = v.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return <>{prefix}{text}{suffix}</>;
}

export default function Landing() {
  const navigate = useNavigate();
  const scrollerRef = useRef(null);
  const slideRefs = useRef([]);
  const [active, setActive] = useState(-1);

  /* Start the first slide's animation right after the first paint. */
  useEffect(() => {
    const id = requestAnimationFrame(() => setActive(a => (a === -1 ? 0 : a)));
    return () => cancelAnimationFrame(id);
  }, []);

  /* Track which slide is in the middle band of the scroller. */
  useEffect(() => {
    const io = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) setActive(Number(e.target.dataset.i)); }),
      { root: scrollerRef.current, rootMargin: '-45% 0px -45% 0px', threshold: 0 },
    );
    slideRefs.current.forEach(el => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  const goTo = useCallback(i => {
    const n = Math.max(0, Math.min(slideTitles.length - 1, i));
    slideRefs.current[n]?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
  }, []);

  /* Arrow keys / Page keys move between slides. */
  useEffect(() => {
    const onKey = e => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      const cur = Math.max(active, 0);
      if (e.key === 'ArrowDown' || e.key === 'PageDown') { e.preventDefault(); goTo(cur + 1); }
      else if (e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); goTo(cur - 1); }
      else if (e.key === 'Home') { e.preventDefault(); goTo(0); }
      else if (e.key === 'End') { e.preventDefault(); goTo(slideTitles.length - 1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, goTo]);

  const slide = i => ({
    'data-i': i,
    ref: el => { slideRefs.current[i] = el; },
    className: `lp-slide${active === i ? ' is-active' : ''}`,
    'aria-label': slideTitles[i],
  });
  const st = n => ({ '--i': n });

  return (
    <div className="lp">
      {/* Top bar */}
      <nav className="lp-nav">
        <div className="lp-brand">
          <div className="lp-brand-mark"><BookOpen size={18} /></div>
          <span className="lp-brand-name">BatchLedger</span>
          <span className="lp-brand-tag">From Recipe to Reconciliation</span>
        </div>
        <div className="lp-nav-actions">
          <button onClick={() => navigate('/login?portal=owner')} className="lp-btn lp-btn--ghost">Sign In</button>
          <button onClick={() => navigate('/login?portal=customer')} className="lp-btn lp-btn--primary">Customer Portal</button>
        </div>
      </nav>

      <main className="lp-scroller" ref={scrollerRef}>
        {/* 1 — text LEFT */}
        <section {...slide(0)} data-side="left" data-theme="hero">
          <div className="lp-text">
            <h1 style={st(0)}>From recipe to <span className="lp-soft">reconciliation.</span></h1>
            <p className="lp-lede" style={st(1)}>
              One place for every order, purchase, batch, invoice and payment in your snack business, so you always know what was made, what was sold and what is still owed.
            </p>
            <div className="lp-actions" style={st(2)}>
              <button onClick={() => navigate('/login?portal=owner')} className="lp-btn lp-btn--primary lp-btn--lg">
                Get started <ChevronRight size={18} />
              </button>
              <button onClick={() => navigate('/login?portal=customer')} className="lp-btn lp-btn--ghost lp-btn--lg">Customer login</button>
            </div>
            <p className="lp-note" style={st(3)}>Built for small South Indian food makers. Runs on your own computer, no cloud account needed.</p>
          </div>
          <div className="lp-art" aria-hidden={false}>
            <div className="lp-stage">
              <HeroScene />
              <div className="lp-chip" style={{ '--k': 0, left: '1%', top: '9%' }}><span className="lp-dot" />Batch complete · 188 packets</div>
              <div className="lp-chip" style={{ '--k': 1, right: '2%', bottom: '5%' }}><span className="lp-dot" />Invoice ₹7,875 · GST included</div>
            </div>
          </div>
        </section>

        {/* 2 — text RIGHT */}
        <section {...slide(1)} data-side="right" data-theme="store">
          <div className="lp-text">
            <h2 style={st(0)}>Know exactly what is in the store room.</h2>
            <p className="lp-lede" style={st(1)}>
              Rice flour, oil, spice mix, pouches and cartons are tracked as stock movements and never overwritten. Each purchase updates your average cost on its own.
            </p>
            <ul className="lp-facts">
              <li style={st(2)}>
                <span className="lp-fact-ico"><Package size={18} /></span>
                <span className="lp-fact-text"><b>A stock ledger, not a guess.</b> Every purchase, use and sale is a recorded movement you can look back at.</span>
              </li>
              <li style={st(3)}>
                <span className="lp-fact-ico"><TrendingUp size={18} /></span>
                <span className="lp-fact-text"><b>Average cost, automatically.</b> 100 kg at ₹42 plus 60 kg at ₹45 becomes ₹43.13 a kg.</span>
              </li>
            </ul>
          </div>
          <div className="lp-art">
            <div className="lp-stage">
              <StoreScene />
              <div className="lp-card lp-float" style={{ '--k': 0, left: '61%', top: '62%', width: '38%' }}>
                <h4>Rice flour · average cost</h4>
                <div className="lp-big"><CountUp value={43.13} decimals={2} prefix="₹" suffix="/kg" active={active === 1} delay={1500} /></div>
                <div style={{ marginTop: '0.5em' }}>
                  <div className="lp-row"><span>Opening</span><span>100 kg × ₹42</span></div>
                  <div className="lp-row"><span>Purchased</span><span>60 kg × ₹45</span></div>
                  <div className="lp-row"><b>In stock</b><b>160 kg</b></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3 — text LEFT */}
        <section {...slide(2)} data-side="left" data-theme="batch">
          <div className="lp-text">
            <h2 style={st(0)}>Every batch keeps its own record.</h2>
            <p className="lp-lede" style={st(1)}>
              Pick a recipe, enter what you really used, and BatchLedger compares it with the plan. Anything more than 3% off is flagged the moment you close the run.
            </p>
            <ul className="lp-facts">
              <li style={st(2)}>
                <span className="lp-fact-ico"><Package size={18} /></span>
                <span className="lp-fact-text"><b>Batch DNA.</b> Recipe, materials used, good output, damaged pouches and expenses stay together with the batch.</span>
              </li>
              <li style={st(3)}>
                <span className="lp-fact-ico"><TrendingUp size={18} /></span>
                <span className="lp-fact-text"><b>Variance Intelligence.</b> A 6% yield shortfall or 5% extra oil shows up straight away, not at month end.</span>
              </li>
            </ul>
          </div>
          <div className="lp-art">
            <div className="lp-stage">
              <KadaiScene />
              <div className="lp-card" style={{ '--k': 0, left: '0%', top: '0%', width: '60%' }}>
                <h4>Batch MK-0001 · Murukku 200 g</h4>
                <div className="lp-bar-row">
                  <div className="lp-bar-head"><span>Yield (188 of 200)</span><span style={{ color: '#c2410c' }}>−6%</span></div>
                  <div className="lp-bar"><i style={{ '--w': '60%', '--k': 0 }} /></div>
                </div>
                <div className="lp-bar-row">
                  <div className="lp-bar-head"><span>Cooking oil (10.5 L of 10)</span><span style={{ color: '#c2410c' }}>+5%</span></div>
                  <div className="lp-bar"><i style={{ '--w': '50%', '--k': 1 }} /></div>
                </div>
                <div className="lp-bar-row">
                  <div className="lp-bar-head"><span>Rice flour (40 kg of 40)</span><span style={{ color: '#15803d' }}>0%</span></div>
                  <div className="lp-bar"><i className="ok" style={{ '--w': '4%', '--k': 2 }} /></div>
                </div>
                <p className="lp-bar-key"><span className="lp-dot lp-dot--warn" />Dashed line marks the 3% alert limit</p>
              </div>
              <div className="lp-chip" style={{ '--k': 1, right: '1%', top: '30%' }}><span className="lp-dot lp-dot--warn" />Alert · oil use +5%</div>
            </div>
          </div>
        </section>

        {/* 4 — text RIGHT */}
        <section {...slide(3)} data-side="right" data-theme="sales">
          <div className="lp-text">
            <h2 style={st(0)}>Bill in a click, with GST done for you.</h2>
            <p className="lp-lede" style={st(1)}>
              Take the order, check stock, issue the invoice, dispatch and record each payment as it arrives.
            </p>
            <ul className="lp-facts">
              <li style={st(2)}>
                <span className="lp-fact-ico"><FileText size={18} /></span>
                <span className="lp-fact-text"><b>GST invoices as PDF.</b> CGST and SGST inside a state, IGST between states.</span>
              </li>
              <li style={st(3)}>
                <span className="lp-fact-ico"><ShoppingCart size={18} /></span>
                <span className="lp-fact-text"><b>Stock is checked on every order.</b> Ask for more than you have and it is stopped before you promise it.</span>
              </li>
              <li style={st(4)}>
                <span className="lp-fact-ico"><BarChart3 size={18} /></span>
                <span className="lp-fact-text"><b>Part payments tracked.</b> See who has paid and what is still due.</span>
              </li>
            </ul>
          </div>
          <div className="lp-art">
            <div className="lp-stage">
              <div className="lp-card lp-invoice" style={{ left: '3%', top: '4%', width: '63%' }}>
                <div className="lp-inv-head">
                  <div><h4 style={{ margin: 0 }}>Tax invoice</h4><small>Retailer A · Rajan Stores, Tamil Nadu</small></div>
                  <small>INV-0001</small>
                </div>
                <div className="lp-row"><span>Murukku 200 g × 150</span><span>₹7,500.00</span></div>
                <div className="lp-row"><span>CGST 2.5%</span><span>₹187.50</span></div>
                <div className="lp-row"><span>SGST 2.5%</span><span>₹187.50</span></div>
                <div className="lp-inv-total">
                  <b>Total</b>
                  <span className="lp-big"><CountUp value={7875} prefix="₹" active={active === 3} delay={1200} /></span>
                </div>
              </div>
              <div className="lp-stamp" style={{ right: '3%', top: '25%' }}>Paid ₹4,000<br /><small>Due ₹3,875</small></div>
              <div className="lp-chip lp-shake" style={{ left: '6%', top: '51%' }}>
                <span className="lp-dot lp-dot--bad" />Order for 120 blocked · only 88 in stock
              </div>
              <TruckScene />
            </div>
          </div>
        </section>

        {/* 5 — text LEFT */}
        <section {...slide(4)} data-side="left" data-theme="audit">
          <div className="lp-text">
            <h2 style={st(0)}>Trace any invoice back to the flour.</h2>
            <p className="lp-lede" style={st(1)}>
              Audit Explorer walks backwards from an invoice through dispatch, finished goods and the production batch to the raw-material purchase behind it.
            </p>
            <ul className="lp-facts">
              <li style={st(2)}>
                <span className="lp-fact-ico"><Shield size={18} /></span>
                <span className="lp-fact-text"><b>One invoice number is enough.</b> Enter it and follow the trail step by step.</span>
              </li>
              <li style={st(3)}>
                <span className="lp-fact-ico"><FileText size={18} /></span>
                <span className="lp-fact-text"><b>Reports you can hand over.</b> Sales, purchases, GST, stock, variance and collections, exported as PDF, Excel or CSV.</span>
              </li>
            </ul>
          </div>
          <div className="lp-art">
            <div className="lp-stage">
              <div className="lp-chain">
                <i className="lp-chain-line" />
                <div className="lp-node" style={{ '--k': 0 }}>
                  <span className="lp-node-ico"><FileText size={20} /></span>
                  <span><b>Invoice INV-0001</b><span className="lp-node-sub">₹7,875 · Retailer A</span></span>
                </div>
                <div className="lp-node" style={{ '--k': 1 }}>
                  <span className="lp-node-ico"><Truck size={20} /></span>
                  <span><b>Dispatch</b><span className="lp-node-sub">150 packets sent</span></span>
                </div>
                <div className="lp-node" style={{ '--k': 2 }}>
                  <span className="lp-node-ico"><Package size={20} /></span>
                  <span><b>Finished goods</b><span className="lp-node-sub">238 packets after the run</span></span>
                </div>
                <div className="lp-node" style={{ '--k': 3 }}>
                  <span className="lp-node-ico"><Factory size={20} /></span>
                  <span><b>Production batch</b><span className="lp-node-sub">188 good packets</span></span>
                </div>
                <div className="lp-node" style={{ '--k': 4 }}>
                  <span className="lp-node-ico"><Wheat size={20} /></span>
                  <span><b>Raw-material purchase</b><span className="lp-node-sub">60 kg rice flour @ ₹45</span></span>
                </div>
                <div className="lp-sack"><SackScene /></div>
              </div>
            </div>
          </div>
        </section>

        {/* 6 — text RIGHT */}
        <section {...slide(5)} data-side="right" data-theme="portals">
          <div className="lp-text">
            <h2 style={st(0)}>Choose your portal.</h2>
            <p className="lp-lede" style={st(1)}>
              Owners, production supervisors and customers each get a view built for their own job.
            </p>
            {portals.map((p, idx) => (
              <button key={p.key} onClick={() => navigate(p.path)} className="lp-portal" style={st(2 + idx)}>
                <span className="lp-portal-ico">{p.icon}</span>
                <span>
                  <span className="lp-portal-label">{p.label}</span>
                  <span className="lp-portal-desc">{p.desc}</span>
                </span>
                <ChevronRight size={20} className="lp-portal-go" />
              </button>
            ))}
            <p className="lp-foot" style={st(5)}>BatchLedger · NIT Tiruchirappalli · Centre for Digital Infrastructure · Internship Challenge 2024</p>
          </div>
          <div className="lp-art">
            <div className="lp-stage">
              <ShopScene />
              <div className="lp-card lp-float" style={{ '--k': 0, left: '60%', top: '71%', width: '39%' }}>
                <div style={{ display: 'flex', gap: '0.7em', alignItems: 'center', marginBottom: '0.5em' }}>
                  <span className="lp-order-ok"><Check size={14} strokeWidth={3} /></span>
                  <h4 style={{ margin: 0 }}>Order placed</h4>
                </div>
                <div className="lp-row"><span>Murukku 200 g</span><span>× 150</span></div>
                <div className="lp-row"><span>Invoice with GST</span><b>₹7,875</b></div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Pager */}
      <div className="lp-pager" role="group" aria-label="Slide navigation">
        <button className="lp-arrow" onClick={() => goTo(active - 1)} disabled={active <= 0} aria-label="Previous slide"><ChevronUp size={18} /></button>
        <div className="lp-dots">
          {slideTitles.map((t, i) => (
            <button key={t} onClick={() => goTo(i)} aria-label={`Go to slide ${i + 1}: ${t}`} aria-current={active === i} />
          ))}
        </div>
        <span className="lp-count" aria-live="polite">{String(Math.max(active, 0) + 1).padStart(2, '0')} / {String(slideTitles.length).padStart(2, '0')}</span>
        <button className="lp-arrow" onClick={() => goTo(active + 1)} disabled={active >= slideTitles.length - 1} aria-label="Next slide"><ChevronDown size={18} /></button>
      </div>
    </div>
  );
}
