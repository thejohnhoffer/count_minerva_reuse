const fs = require('fs')
const path = require('path');

const findCopies = (chans) => {
  return [...chans.reduce((o, chan) => {
    return new Map([...o,
      [chan, 1 + (o.get(chan) || 0)]
    ]);
  }, new Map).entries()].filter(([chan, count]) => {
    return [
      !chan.match(/DNA/i),
      !chan.match(/Hoechst/i)
    ].every(x => x)
  });
}

const toMax = (copies) => {
  return copies.sort((a, b) => b[1] - a[1])[0];
}

const read_dir = (o, root) => {
  let dirent
  const out = [...o];
  const dir = fs.opendirSync(root);
  while ((dirent = dir.readSync()) !== null) {
    const p = path.join(root, dirent.name);
    if (dirent.isDirectory()) {
      out.push(...read_dir(o, p));
      continue;
    }
    if (path.extname(dirent.name) !== ".json") {
      continue;
    }
    const file = fs.readFileSync(p);
    const { Groups } = JSON.parse(file);
    const chans = Groups.reduce((o, group) => {
      const { Channels } = group;
      return [...o, ...Channels];
    }, [])
    const copies = findCopies(chans);
    let total = 0;
    const dups = {}
    copies.forEach(([_, count]) => {
      if (count === 12) console.log(p);
      if (count === 12) console.log('n groups:', Groups.length);
      if (count === 12) console.log('channels:', [...new Set(...chans)].length);
      if (count > 1) {
        dups[count] = 1 + (dups[count] || 0);
      }
      total += 1;
    })
    out.push([total, dups]);
  }
  dir.closeSync();
  return out 
}

const dups = read_dir([], 'exhibits');
const done = dups.reduce(([t, d, m], [ti, di]) => {
  const max = [...Object.keys(di)].map(k => parseInt(k)).sort((a,b) => b-a)[0] || 1;
  m[max] = 1 + (m[max] || 0);
  const dict = Object.entries(di).reduce((o, [k, v]) => {
    o[k] = 1 + (o[k] || 0);
    return o;
  }, d);
  return [t + 1, dict, m];
}, [0, {}, {}]);
const [t, _, m] = done;
const round = f => (f*100).toFixed(1)+'%';

console.log(Object.entries(m).map(([k,v]) => {
  const s = k === '1' ? 'no copies' : `Channels copied ≤ ${k}x`;
  return [`${s}`, v, round(v/t)];
}))
