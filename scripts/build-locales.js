const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, '..', 'public', 'assets');
const strings = new Set();

for (const f of fs.readdirSync(assetsDir).filter((x) => x.endsWith('.js'))) {
  const s = fs.readFileSync(path.join(assetsDir, f), 'utf8');
  for (const re of [
    /children:"([^"]{2,120})"/g,
    /placeholder:"([^"]{2,80})"/g,
    /title:"([^"]{2,80})"/g,
    /tagline:"([^"]{2,80})"/g,
    /lead:"([^"]{10,300})"/g,
    /desc:"([^"]{10,300})"/g,
    /label:"([^"]{2,80})"/g,
    /value:"([^"]{2,80})"/g,
    /country:"([^"]{2,40})"/g,
    /region:"([^"]{2,80})"/g,
    /subtitle:"([^"]{10,200})"/g,
  ]) {
    let m;
    while ((m = re.exec(s))) {
      const t = m[1];
      if (!/^[a-z]/.test(t) && !t.includes('http') && !t.includes('className') && !t.includes('{{')) {
        strings.add(t);
      }
    }
  }
}

const extra = [
  'Home', 'Tours', 'Destinations', 'Services', 'About', 'Contact',
  'Book Journey', 'Quick Book', 'Explore Expeditions', 'Plan Your Journey',
  'Luxury Tajikistan Expeditions & Private Tours',
  'Tajikistan · Roof of the World', 'Where the mountains speak',
  'Curated expeditions into Tajikistan\'s most remote and sacred landscapes — for those who travel to be transformed.',
  'Years Experience', 'Satisfied Travelers', 'Curated Expeditions', 'Average Rating',
  'Born from a love of the mountains', 'Our Story', 'Scroll to discover',
  'Submit Booking Request', 'Please select a tour', 'Select travel dates',
  'Max 8 travelers', 'Pamir Highway', 'Authentic Discovery',
  'Please try again or contact us directly.',
  'All', 'View Tour', 'From', 'Days', 'Moderate', 'Easy', 'Hard',
  'No tours found for this destination.',
  'Destination Countries', 'Select countries for destination filtering on the website.',
];
extra.forEach((s) => strings.add(s));

const sorted = [...strings].sort((a, b) => a.localeCompare(b));
const en = {};
sorted.forEach((s) => { en[s] = s; });

const outDir = path.join(__dirname, '..', 'public', 'locales');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'en.json'), JSON.stringify(en, null, 2));
console.log('Wrote', sorted.length, 'keys to public/locales/en.json');