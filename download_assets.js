const fs = require('fs');
const https = require('https');
const path = require('path');

const themesDir = path.join(__dirname, 'client', 'public', 'assets', 'themes');

if (!fs.existsSync(themesDir)) {
    fs.mkdirSync(themesDir, { recursive: true });
}

const files = [
    { name: 'naruto.gif', url: 'https://i.imgur.com/N6d0h3a.gif' },
    { name: 'dragonball.gif', url: 'https://i.imgur.com/2D5s3fM.gif' },
    { name: 'sololeveling.gif', url: 'https://i.imgur.com/GOVT9pl.gif' },
    { name: 'hxh.gif', url: 'https://media.giphy.com/media/u4dQ8BMugUYp2/giphy.gif' },
    { name: 'lotr.gif', url: 'https://media.giphy.com/media/SMEDDr3CIB7s4/giphy.gif' }
];

files.forEach(file => {
    const filePath = path.join(themesDir, file.name);
    const fileStream = fs.createWriteStream(filePath);
    https.get(file.url, (response) => {
        response.pipe(fileStream);
        fileStream.on('finish', () => {
            fileStream.close();
            console.log(`Downloaded ${file.name}`);
        });
    }).on('error', (err) => {
        console.error(`Error downloading ${file.name}: ${err.message}`);
    });
});
