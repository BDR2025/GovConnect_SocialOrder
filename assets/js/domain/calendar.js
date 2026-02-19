/* social_order_v0.20.3.0 · domain/calendar (ESM)
   Deterministische Baseline-Generierung für Kalender-Blöcke.
   Ziel: realistische Demo über 2 Jahre ohne localStorage aufzublähen.
*/

function hashString(str){
  let h = 2166136261;
  for(let i=0;i<str.length;i++){
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0);
}

function rand01(seedStr){
  const h = hashString(seedStr);
  return (h % 1000000) / 1000000;
}

function isoDate(d){
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth()+1).padStart(2,'0');
  const day = String(d.getUTCDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}

function atUtc(dateObj, hh, mm){
  return new Date(Date.UTC(
    dateObj.getUTCFullYear(),
    dateObj.getUTCMonth(),
    dateObj.getUTCDate(),
    hh, mm, 0, 0
  )).toISOString();
}

function isWeekend(d){
  const wd = d.getUTCDay();
  return wd === 0 || wd === 6;
}

function addDaysUtc(d, n){
  const x = new Date(d.getTime());
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

function isInVacationWindow(ownerId, dateObj, seed){
  // one main summer vacation window per year + a few single days
  const y = dateObj.getUTCFullYear();
  const key = `${seed}|${ownerId}|vacMain|${y}`;
  const startDay = 180 + Math.floor(rand01(key) * 25); // around late June/July
  const len = 10 + Math.floor(rand01(key + "|len") * 8); // 10..17 workdays

  const jan1 = new Date(Date.UTC(y,0,1));
  const dayOfYear = Math.floor((dateObj.getTime() - jan1.getTime()) / 86400000) + 1;

  // approximate window in day-of-year
  if(dayOfYear >= startDay && dayOfYear <= (startDay + len + 6)) return true;

  // add 2-4 random single vacation days
  const singles = 2 + Math.floor(rand01(`${key}|singles`) * 3);
  for(let i=0;i<singles;i++){
    const d0 = 20 + Math.floor(rand01(`${key}|s|${i}`) * 320);
    if(dayOfYear === d0) return true;
  }
  return false;
}

function isSickDay(ownerId, dateObj, seed){
  // 3-8 sick days per year as small clusters, deterministic
  const y = dateObj.getUTCFullYear();
  const key = `${seed}|${ownerId}|sick|${y}`;
  const clusters = 1 + Math.floor(rand01(key) * 3); // 1..3 clusters

  const jan1 = new Date(Date.UTC(y,0,1));
  const dayOfYear = Math.floor((dateObj.getTime() - jan1.getTime()) / 86400000) + 1;

  for(let c=0;c<clusters;c++){
    const start = 30 + Math.floor(rand01(`${key}|c|${c}`) * 300);
    const len = 1 + Math.floor(rand01(`${key}|c|${c}|len`) * 4); // 1..4 days
    if(dayOfYear >= start && dayOfYear <= start + len) return true;
  }
  return false;
}

function isErrandDay(ownerId, dateObj, seed){
  // occasional errands: ~0-2 per month, deterministic
  const y = dateObj.getUTCFullYear();
  const m = dateObj.getUTCMonth()+1;
  const key = `${seed}|${ownerId}|errand|${y}-${String(m).padStart(2,'0')}`;
  const r = rand01(key);
  if(r < 0.06) return true; // ~6% of workdays in month
  return false;
}

export function generateBaselineBlocks({ startIso, endIso, ownerId, seed = "gc" }){
  const out = [];
  const start = new Date(startIso);
  const end = new Date(endIso);

  // iterate by day
  let d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const endDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));

  while(d.getTime() <= endDay.getTime()){
    const dayKey = isoDate(d);

    if(!isWeekend(d)){
      const vac = isInVacationWindow(ownerId, d, seed);
      const sick = !vac && isSickDay(ownerId, d, seed);

      if(vac){
        out.push({
          id: `blk_base_${ownerId}_leave_${dayKey}`,
          kind: "leave",
          ownerId,
          start: atUtc(d, 0, 0),
          end: atUtc(d, 23, 59),
          allDay: true,
          status: "approved",
          createdBy: "system",
          visibility: { mode: "ownerAndLeads" },
          dedupeKey: `base|${ownerId}|leave|${dayKey}`,
          subject: { kind: "time", id: `TD-${dayKey}-${ownerId}` },
          meta: { source: "baseline" }
        });
      } else if(sick){
        out.push({
          id: `blk_base_${ownerId}_sick_${dayKey}`,
          kind: "sick",
          ownerId,
          start: atUtc(d, 0, 0),
          end: atUtc(d, 23, 59),
          allDay: true,
          status: "recorded",
          createdBy: "system",
          visibility: { mode: "ownerAndLeads" },
          dedupeKey: `base|${ownerId}|sick|${dayKey}`,
          subject: { kind: "time", id: `TD-${dayKey}-${ownerId}` },
          meta: { source: "baseline" }
        });
      } else {
        // workday block
        const r1 = rand01(`${seed}|${ownerId}|work|${dayKey}`);
        const startMin = 7*60 + 30 + Math.floor(r1 * 60); // 07:30..08:30
        const endMin = 16*60 + 0 + Math.floor(rand01(`${seed}|${ownerId}|workEnd|${dayKey}`) * 60); // 16:00..17:00
        const sh = Math.floor(startMin/60), sm = startMin%60;
        const eh = Math.floor(endMin/60), em = endMin%60;

        out.push({
          id: `blk_base_${ownerId}_work_${dayKey}`,
          kind: "workday",
          ownerId,
          start: atUtc(d, sh, sm),
          end: atUtc(d, eh, em),
          allDay: false,
          status: "recorded",
          createdBy: "system",
          visibility: { mode: "owner" },
          dedupeKey: `base|${ownerId}|workday|${dayKey}`,
          subject: { kind: "time", id: `TD-${dayKey}-${ownerId}` },
          meta: { source: "baseline" }
        });

        // occasional errand
        if(isErrandDay(ownerId, d, seed)){
          const mid = 11*60 + 30 + Math.floor(rand01(`${seed}|${ownerId}|errMid|${dayKey}`) * 120); // 11:30..13:30
          const dur = 30 + Math.floor(rand01(`${seed}|${ownerId}|errDur|${dayKey}`) * 60); // 30..90
          const s2 = mid - Math.floor(dur/2);
          const e2 = s2 + dur;
          out.push({
            id: `blk_base_${ownerId}_errand_${dayKey}`,
            kind: "errand",
            ownerId,
            start: atUtc(d, Math.floor(s2/60), s2%60),
            end: atUtc(d, Math.floor(e2/60), e2%60),
            allDay: false,
            status: "recorded",
            createdBy: "system",
            visibility: { mode: "ownerAndLeads" },
            dedupeKey: `base|${ownerId}|errand|${dayKey}`,
            subject: { kind: "time", id: `TD-${dayKey}-${ownerId}` },
            meta: { source: "baseline", note: "Dienstgang" }
          });
        }
      }
    }

    d = addDaysUtc(d, 1);
  }

  return out;
}
