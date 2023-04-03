import fs from 'fs';
import path from 'path';
import {unified} from 'unified'
import { reporter } from 'vfile-reporter'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import rehypeFormat from 'rehype-format'
import rehypeDocument from 'rehype-document'
import rehypeStringify from 'rehype-stringify'

const md_to_html = async (md) => {
  return await unified()
    .use(remarkParse)
    .use(remarkRehype)
    .use(rehypeDocument)
    .use(rehypeFormat)
    .use(rehypeStringify)
    .process(md)
}

const findCopies = (chans, is3d, n_file_groups, file) => {
  const dim = [2, 3][+!!is3d];
  return [...chans.reduce((o, c) => {
    const old_list = o.get(c.chan) || [];
    const new_list = [...old_list, c.group];
    return new Map([...o, [c.chan, new_list] ]);
  }, new Map).entries()].reduce((o, [chan, groups]) => {
    const n_copies = groups.length - 1;
    return [...o, ...groups.map(group => {
      return { chan, dim, n_copies, group, n_file_groups, file };
    })];
  }, []);
}

const toMax = (copies) => {
  return copies.sort((a, b) => b[1] - a[1])[0];
}

const to_s3_map = (p) => {
  const str = fs.readFileSync(p, {encoding:'utf8'}).toString('utf8');
  return str.split('\n').slice(1).reduce((m, str) => {
    const [s3, cycif] = str.split(',');
    if (cycif) m.set(s3, cycif);
    return m;
  }, new Map);
}

const read_config = (p) => {
  const file = fs.readFileSync(p, {encoding:'utf8'});
  try {
    let exhibit = JSON.parse(file);
    if ("Exhibit" in exhibit) {
      exhibit = exhibit.Exhibit;
    }
    const Groups = exhibit.Groups;
    const is3d = exhibit['3D'];
    const channels = Groups.reduce((o, group) => {
      const { Channels, Name } = group;
      const uses = Channels.map(chan => {
        return { chan, group: Name };
      });
      return [...o, ...uses];
    }, [])
    const g = Groups.length;
    return findCopies(channels, is3d, g, p);
  }
  catch (e) {
    console.log(p);
  }
  return [];
}

const read_exhibit = (p) => {
  const file = fs.readFileSync(p, {encoding:'utf8'});
  try {
    let exhibit = JSON.parse(file);
    if ("Exhibit" in exhibit) {
      exhibit = exhibit.Exhibit;
    }
    const Groups = exhibit.Groups;
    const is3d = exhibit['3D'];
    if (!Groups) {
      console.log(JSON.stringify(Object.keys(exhibit)))
    }
    const channels = Groups.reduce((o, group) => {
      const { Channels, Name } = group;
      const uses = Channels.map(chan => {
        return { chan, group: Name };
      });
      return [...o, ...uses];
    }, [])
    const g = Groups.length;
    return findCopies(channels, is3d, g, p);
  }
  catch (e) {
    console.log(p);
  }
  return [];
}

const read_dir = (root) => {
  let dirent;
  const uses = [];
  const dir = fs.opendirSync(root);
  while ((dirent = dir.readSync()) !== null) {
    const p = path.join(root, dirent.name);
    if (dirent.isDirectory()) {
      const new_uses = read_dir(p);
      uses.push(...new_uses);
      continue;
    }
    if (path.extname(dirent.name) !== ".json") {
      continue;
    }
    if (path.basename(dirent.name) === "exhibit.json") {
      uses.push(...read_exhibit(p));
    }
    else {
//      uses.push(...read_config(p));
    }
  }
  dir.closeSync();
  return uses;
}

const main_filter = ({ chan, dim }) => {
  const skip = [
    new RegExp('^dna','i'),
    new RegExp('hematoxylin','i'),
    new RegExp('eosin','i'),
    new RegExp('hoechst','i')
  ]
  const bad_name = skip.some(r => chan.match(r));
  return (!bad_name && dim === 2);
}

const log_chans = (chans, mins) => {
  const counted = chans.filter(main_filter);
  const n = chans.length;
  const n_counted = counted.length;
  console.log('\nAll marker pyramids over all groups')
  console.log('Total: ', n);
  console.log('Considered: ', n_counted);
  for (const min of mins) {
    const n_copied = counted.reduce((o, { n_copies }) => {
      if (n_copies >= min) {
        return o + 1;
      }
      return o;
    }, 0);
    console.log(`Total Copied ≥ ${min}x: `, n_copied);
    console.log(`Copied ≥ ${min}x / Considered: `, round(n_copied/n_counted));
  }
  return counted;
}
const round = f => (f*100).toFixed(1)+'%';

const log_stories = (chans, mins, s3_map, tree) => {
  const counted = [...chans.reduce((stories, channel) => {
    const { file, n_copies, n_file_groups } = channel;
    const story = stories.get(file) || {
      file, mins: new Set, n_groups: n_file_groups
    };
    story.mins.add(n_copies);
    stories.set(file, story);
    return stories;
  }, new Map).values()];
  const n_counted = counted.length;
  console.log('\nAll stories')
  console.log('Total: ', n_counted);
  for (const min of mins) {
    const n_copied = counted.filter((story) => {
      const all_mins = [...story.mins];
      return all_mins.some(m => m >= min);
    }).length;
    console.log(`Total with Some Channel Copied ≥ ${min}x: `, n_copied);
    console.log(`with Some Channel Copied ≥ ${min}x / Total: `, round(n_copied/n_counted));
  }
  const minerva_story = fs.readFileSync('minerva_story.html', {encoding:'utf8'});
  const files_with_copies = counted.filter((story) => {
    return story.mins.has(1);
  }).map(({file}) => file);
  // Hello
  const urls_with_copies = files_with_copies.map((f) => {
    if (s3_map.has(f)) {
      return [f, s3_map.get(f), false];
    }
    const dir = path.dirname(f);
    return [f, dir, true];
  });
  fs.mkdirSync('docs/configs', { recursive: true });
  const md = urls_with_copies.map(([f, url, local]) => {
    const href = local ? url.replace('configs/', '') : url;
    if (local) {
      let data = JSON.parse(fs.readFileSync(f, {encoding:'utf8'}));
      if ('Exhibit' in data) data = data.Exhibit;
      const p = url.replace('configs', 'https://s3.amazonaws.com/www.cycif.org');
      data.Images = data.Images.map(image => {
        return {...image, Path: p };
      })
      const out_data = JSON.stringify(data);
      const dir = path.dirname(f.replace('configs', 'docs'));
      const minerva_out = path.join(dir, 'index.html');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(minerva_out, minerva_story, {encoding:'utf8'});
      const out_f = path.join(dir, 'exhibit.json');
      fs.writeFileSync(out_f, out_data, {encoding:'utf8'});
    }
    const name = url.replace(/.*cycif.org.data./, '').replace(/^configs./, '')
    const channels = [...(tree.get(f) || new Map).entries()].map(([k, v]) => {
      return `- ${k} in groups: ${v.join(', ')}`;
    }).join('\n');
    return `## ${name}
[${href}](${href})

${channels}
    `;
  }).join('\n');
  md_to_html(md).then(html => {
    fs.writeFileSync('docs/index.html', html.toString('utf8'), {encoding:'utf8'});
  });
/*  fs.writeFileSync('urls_with_copies.csv', urls_with_copies.map(([f, url]) => {
    return [f, url].join(',');
  }).join('\n'));
*/
}

// All references to a channel over all groups
const uses = read_dir('configs');

// All instances of a channel over all stories
const { chans } = uses.reduce(({ used, chans }, use) => {
  const { group, ...rest } = use;
  const key = [rest.chan, rest.file].join('---');
  if (used.has(key)) {
    return { used, chans };
  }
  used.add(key);
  chans.push(rest);
  return { used, chans };
}, { used: new Set(), chans: [] });

const tree = uses.reduce((tree, use) => {
  if (!main_filter(use) || !use.n_copies) return tree;
  const old_chans = tree.get(use.file) || new Map;
  const old_groups = old_chans.get(use.chan) || [];
  const new_groups = [...old_groups, use.group];
  old_chans.set(use.chan, new_groups);
tree.set(use.file, old_chans);
  return tree;
}, new Map);

const s3_map = to_s3_map('cycif_s3_map.csv')
//const counted = log_chans(chans, [1, 3, 6]);
const counted = chans.filter(main_filter);
log_stories(counted, [1, 3, 6], s3_map, tree);
